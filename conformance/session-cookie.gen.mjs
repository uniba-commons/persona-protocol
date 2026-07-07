// Regenerates session-cookie.json from the TypeScript implementation.
// Run from the repository root after building:
//
//   npm run build && node conformance/session-cookie.gen.mjs
//
// Tokens are deterministic given (secret, payload, at), so the output is
// stable; regeneration is only needed when the vector set itself changes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSessionCodec } from '../packages/server-core/dist/session.js';

const SECRET = 'conformance-test-secret';
const VERIFY_AT = 1751700000; // 2025-07-05T07:20:00Z, the pinned clock

const codec = createSessionCodec({ secret: SECRET });

const valid = await codec.sign({ sub: 'persona-1', bid: 'browser-1' }, 3600, { at: VERIFY_AT - 60 });
const expired = await codec.sign({ sub: 'persona-1', bid: 'browser-1' }, 60, { at: VERIFY_AT - 3600 });
const foreign = await createSessionCodec({ secret: 'some-other-secret' })
  .sign({ sub: 'persona-1' }, 3600, { at: VERIFY_AT - 60 });

// Flip the last signature character to break the MAC.
const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');

const fixture = {
  spec: 'docs/spec/cookie-profile.md (C-1)',
  secret: SECRET,
  vectors: [
    {
      id: 'valid-token-returns-payload',
      token: valid,
      verify_at: VERIFY_AT,
      valid: true,
      payload: { sub: 'persona-1', bid: 'browser-1', exp: VERIFY_AT - 60 + 3600 },
    },
    { id: 'expired-token-rejected', token: expired, verify_at: VERIFY_AT, valid: false },
    { id: 'tampered-signature-rejected', token: tampered, verify_at: VERIFY_AT, valid: false },
    { id: 'foreign-secret-rejected', token: foreign, verify_at: VERIFY_AT, valid: false },
    { id: 'exp-exactly-now-rejected', token: valid, verify_at: VERIFY_AT - 60 + 3600, valid: false },
    { id: 'malformed-no-separator-rejected', token: 'not-a-token', verify_at: VERIFY_AT, valid: false },
    { id: 'malformed-bad-base64-rejected', token: '!!!.???', verify_at: VERIFY_AT, valid: false },
    { id: 'empty-token-rejected', token: '', verify_at: VERIFY_AT, valid: false },
  ],
};

const out = fileURLToPath(new URL('./session-cookie.json', import.meta.url));
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
console.log(`wrote ${out}`);
