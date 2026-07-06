import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  createPersonaCookies,
  personaMiddleware,
  requireJoined,
  type PersonaEnv,
} from '../src/index.js';

// A minimal persona store standing in for an app's database.
type User = { id: string; name: string };
const USERS: Record<string, User> = { 'persona-1': { id: 'persona-1', name: 'yamane42' } };

const SECRET = 'hono-adapter-test-secret';

// Builds an app wired exactly as a cookie-profile consumer would wire it, plus
// test-only routes to drive the session cookie.
function buildApp() {
  const cookies = createPersonaCookies({ secret: SECRET, secure: false });
  const app = new Hono<PersonaEnv<User>>();

  app.use('*', personaMiddleware({ cookies, resolvePersona: (sub) => USERS[sub] ?? null }));
  app.use(
    '*',
    requireJoined({
      // The join flow and claim redemption are writes a guest may perform.
      allow: (c) => c.req.path === '/join' || c.req.path === '/claim',
      redirectTo: '/welcome',
    }),
  );

  app.get('/', (c) => c.text('anyone can read'));
  app.get('/me', (c) => c.json({ persona: c.get('persona') }));
  app.post('/write', (c) => c.json({ ok: true, by: c.get('persona')?.id ?? null }));
  app.post('/join', async (c) => {
    await cookies.setSession(c, { sub: 'persona-1', bid: 'browser-1' });
    return c.json({ joined: true });
  });
  app.post('/logout', (c) => {
    cookies.clearSession(c);
    return c.json({ ok: true });
  });

  return app;
}

// Carries the Set-Cookie value from one response into the next request, the way
// a browser would.
function jar() {
  let cookie = '';
  return {
    capture(res: Response) {
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0]!;
    },
    header(): Record<string, string> {
      return cookie ? { cookie } : {};
    },
  };
}

describe('persona-hono adapter', () => {
  it('lets anyone read without a session (P-1)', async () => {
    const app = buildApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('anyone can read');
  });

  it('resolves no persona for an anonymous browser', async () => {
    const app = buildApp();
    const res = await app.request('/me');
    expect(await res.json()).toEqual({ persona: null });
  });

  it('rejects an un-joined write with NOT_JOINED for a scripted caller (C-4)', async () => {
    const app = buildApp();
    const res = await app.request('/write', { method: 'POST' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'NOT_JOINED' });
  });

  it('redirects an un-joined full-page write to the join flow (C-4)', async () => {
    const app = buildApp();
    const res = await app.request('/write', { method: 'POST', headers: { accept: 'text/html' } });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/welcome');
  });

  it('allows the join flow itself while un-joined (allowlist)', async () => {
    const app = buildApp();
    const res = await app.request('/join', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ joined: true });
  });

  it('carries the persona across requests once joined, then gates again on logout', async () => {
    const app = buildApp();
    const cookies = jar();

    const joined = await app.request('/join', { method: 'POST' });
    cookies.capture(joined);

    // The session cookie is set with the credential-protecting attributes (C-2).
    const setCookie = joined.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/persona_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await app.request('/me', { headers: cookies.header() });
    expect(await me.json()).toEqual({ persona: { id: 'persona-1', name: 'yamane42' } });

    const write = await app.request('/write', { method: 'POST', headers: cookies.header() });
    expect(write.status).toBe(200);
    expect(await write.json()).toEqual({ ok: true, by: 'persona-1' });

    const out = await app.request('/logout', { method: 'POST', headers: cookies.header() });
    cookies.capture(out);
    const afterLogout = await app.request('/write', { method: 'POST', headers: cookies.header() });
    expect(afterLogout.status).toBe(401);
  });

  it('treats a tampered session cookie as anonymous', async () => {
    const app = buildApp();
    const joined = await app.request('/join', { method: 'POST' });
    const good = (joined.headers.get('set-cookie') ?? '').split(';')[0]!;
    const tampered = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A');

    const res = await app.request('/me', { headers: { cookie: tampered } });
    expect(await res.json()).toEqual({ persona: null });
  });
});

describe('persona-hono pending-join cookie', () => {
  it('round-trips a proposal and clears it', async () => {
    const cookies = createPersonaCookies({ secret: SECRET, secure: false });
    const app = new Hono();
    app.post('/propose', async (c) => {
      await cookies.setPending(c, { username: 'yamane42', agentKey: 'abc' });
      return c.text('proposed');
    });
    app.get('/pending', async (c) => c.json((await cookies.readPending<{ username: string }>(c)) ?? {}));

    const proposed = await app.request('/propose', { method: 'POST' });
    const cookie = (proposed.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(cookie).toMatch(/persona_pending=/);

    const read = await app.request('/pending', { headers: { cookie } });
    const body = (await read.json()) as { username?: string };
    expect(body.username).toBe('yamane42');
  });
});
