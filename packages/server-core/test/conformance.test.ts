import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AGENT_ID_HEADER, AGENT_ID_PARAM, NOT_JOINED_CODE } from '@uniba-commons/persona-core';
import { performAccountLink } from '../src/account_link.js';
import { normalizeClaimCode, formatClaimCode, digestClaimCode } from '../src/claim_code.js';
import { createSessionCodec, type SessionPayload } from '../src/session.js';
import { FakeAccountLinkStore, type FakeUser } from './fake_store.js';

// Shared cross-language vectors (conformance/ at the repository root); see
// conformance/README.md for the vector formats.
const fixture = (name: string): any =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../conformance/${name}`, import.meta.url)), 'utf8'));

describe('conformance: wire names', () => {
  const vectors = fixture('wire-names.json');

  it('matches the exported constants', () => {
    expect(AGENT_ID_HEADER).toBe(vectors.agent_id_header);
    expect(AGENT_ID_PARAM).toBe(vectors.agent_id_param);
    expect(NOT_JOINED_CODE).toBe(vectors.not_joined_code);
  });
});

describe('conformance: claim codes', () => {
  const vectors = fixture('claim-code.json');

  it('normalizes pasted input', () => {
    for (const v of vectors.normalize) expect(normalizeClaimCode(v.input), v.input).toBe(v.normalized);
  });

  it('formats for display', () => {
    for (const v of vectors.format) expect(formatClaimCode(v.input), v.input).toBe(v.formatted);
  });

  it('digests the normalized code', async () => {
    for (const v of vectors.digest) expect(await digestClaimCode(v.input), v.input).toBe(v.sha256_hex);
  });
});

describe('conformance: session cookie', () => {
  const vectors = fixture('session-cookie.json');

  it('verifies (or rejects) every vector', async () => {
    const codec = createSessionCodec({ secret: vectors.secret });
    for (const v of vectors.vectors) {
      const payload = await codec.verify(v.token, { at: v.verify_at });
      if (v.valid) {
        expect(payload, v.id).toEqual(v.payload);
      } else {
        expect(payload, v.id).toBeNull();
      }
    }
  });
});

describe('conformance: claim decision table', () => {
  const table = fixture('claim-decision.json');
  const identity = table.identity as { provider: string; subject: string };

  for (const kase of table.cases) {
    it(kase.id, async () => {
      const store = new FakeAccountLinkStore();
      const given = kase.given;
      const expected = kase.expect;

      // Arrange the holder and the acting browser per the vector.
      let holder: FakeUser | null = null;
      if (given.holder && typeof given.holder === 'object') {
        holder = await store.createGuest(given.holder.agent_uid);
        await store.addAccountBinding(holder, identity.provider, identity.subject);
      }
      let currentUser: FakeUser | null = null;
      if (given.browser === 'joined') {
        currentUser = await store.createGuest(given.agent_uid);
        if (given.holder === 'current') {
          await store.addAccountBinding(currentUser, identity.provider, identity.subject);
          holder = currentUser;
        }
      }

      const personasBefore = store.users.length;
      const agentBindingsBefore = store.agentBindings.length;
      const accountBindingsBefore = store.accountBindings.length;

      const result = await performAccountLink({
        identity,
        currentUser,
        agentUid: given.agent_uid,
        confirmMerge: given.confirm_merge,
        store,
      });

      if ('personas_delta' in expected) {
        expect(store.users.length - personasBefore, 'personas_delta').toBe(expected.personas_delta);
      }
      if ('result_user' in expected) {
        if (expected.result_user === 'current') expect(result.user.id, 'result_user').toBe(currentUser!.id);
        if (expected.result_user === 'holder') expect(result.user.id, 'result_user').toBe(holder!.id);
        if (expected.result_user === 'new') {
          expect(result.user.id, 'result_user').not.toBe(currentUser?.id);
          expect(result.user.id, 'result_user').not.toBe(holder?.id);
        }
      }
      if ('subject_holder' in expected) {
        const subjectHolder = await store.holderFor(identity.provider, identity.subject);
        const target =
          expected.subject_holder === 'result' ? result.user
          : expected.subject_holder === 'current' ? currentUser
          : holder;
        expect(subjectHolder?.id, 'subject_holder').toBe(target!.id);
      }
      if ('result_has_agent_binding' in expected) {
        expect(await store.hasAgentBinding(result.user, given.agent_uid), 'result_has_agent_binding')
          .toBe(expected.result_has_agent_binding);
      }
      if ('agent_bindings_delta' in expected) {
        expect(store.agentBindings.length - agentBindingsBefore, 'agent_bindings_delta')
          .toBe(expected.agent_bindings_delta);
      }
      if ('account_bindings_delta' in expected) {
        expect(store.accountBindings.length - accountBindingsBefore, 'account_bindings_delta')
          .toBe(expected.account_bindings_delta);
      }
      if ('merged' in expected) expect(result.merged, 'merged').toBe(expected.merged);
      if ('merge_preview' in expected) {
        expect(result.mergePreview !== null, 'merge_preview').toBe(expected.merge_preview);
      }
      if ('echoed_agent_uid' in expected) {
        expect(result.agentUid, 'echoed_agent_uid').toBe(expected.echoed_agent_uid);
      }
      if ('current_retired' in expected) {
        expect(store.user(currentUser!.id) === null, 'current_retired').toBe(expected.current_retired);
      }
      if (expected.browser_binding_moved_to_holder) {
        expect(store.userForAgent(given.agent_uid)?.id, 'browser_binding_moved_to_holder').toBe(holder!.id);
      }
    });
  }
});

describe('session codec round-trip (sign side of C-1)', () => {
  it('signs and verifies its own tokens', async () => {
    const codec = createSessionCodec({ secret: 'roundtrip-secret' });
    const token = await codec.sign({ sub: 'persona-9', bid: 'browser-9' }, 3600, { at: 1_000_000 });
    const payload = await codec.verify<SessionPayload & { sub: string }>(token, { at: 1_000_001 });
    expect(payload?.sub).toBe('persona-9');
    expect(payload?.exp).toBe(1_003_600);
    // Expired for a later clock; rejected under a different secret.
    expect(await codec.verify(token, { at: 1_003_600 })).toBeNull();
    const other = createSessionCodec({ secret: 'different-secret' });
    expect(await other.verify(token, { at: 1_000_001 })).toBeNull();
  });
});
