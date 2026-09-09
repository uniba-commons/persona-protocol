import { describe, it, expect } from 'vitest';
import { createOidcVerifierProvider, unibaAuthProvider } from '../src/index.js';

// Contract tests for the production OIDC verifier, run entirely offline: a
// locally generated RS256 keypair signs id_tokens, and a fake fetch stands in
// for the IdP's discovery, token, and JWKS endpoints. This proves the full
// validation path (signature, iss/aud/exp/nonce, claim checks, key rotation)
// without a live authorization server.

const ISSUER = 'https://auth.example.test';
const CLIENT_ID = 'example-client';
const REDIRECT = 'https://app.example.test/auth/oidc/callback';
const NOW = 1_800_000_000_000; // fixed clock (ms)

type Key = { privateKey: CryptoKey; jwk: JsonWebKey & { kid: string; alg: string; use: string } };

async function makeKey(kid: string): Promise<Key> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, jwk: { ...pub, kid, alg: 'RS256', use: 'sig' } };
}

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlJson = (obj: unknown): string => b64url(new TextEncoder().encode(JSON.stringify(obj)));

async function signIdToken(key: Key, claims: Record<string, unknown>): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid: key.jwk.kid };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

const nowSec = Math.floor(NOW / 1000);

// A stubbed IdP: discovery + JWKS + a token endpoint that returns whatever
// id_token the test queued. Records the token-endpoint body so PKCE can be
// asserted.
function fakeIdp(opts: { jwksKeys: Array<{ kid: string; alg: string; use: string }> & JsonWebKey[]; idToken: string | null }) {
  const state = { tokenBody: null as URLSearchParams | null, jwksHits: 0 };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/.well-known/openid-configuration')) {
      return Response.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
      });
    }
    if (url.endsWith('/jwks')) {
      state.jwksHits++;
      return Response.json({ keys: opts.jwksKeys });
    }
    if (url.endsWith('/token')) {
      state.tokenBody = new URLSearchParams(init!.body as string);
      return opts.idToken ? Response.json({ id_token: opts.idToken }) : new Response('nope', { status: 400 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { fetchImpl, state };
}

function baseClaims(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { iss: ISSUER, aud: CLIENT_ID, sub: 'person-1', exp: nowSec + 300, iat: nowSec, ...over };
}

describe('OIDC verifier — authorize', () => {
  it('builds a PKCE authorize URL and stashes verifier + nonce', async () => {
    const { fetchImpl } = fakeIdp({ jwksKeys: [], idToken: null });
    const provider = createOidcVerifierProvider({
      name: 'x', issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT, fetch: fetchImpl, now: () => NOW,
    });
    const { url, stash } = await provider.authorize('state-123');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${ISSUER}/authorize`);
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(u.searchParams.get('state')).toBe('state-123');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('code_challenge')).toBeTruthy();
    expect(stash?.codeVerifier).toBeTruthy();
    expect(stash?.nonce).toBe(u.searchParams.get('nonce'));
  });
});

describe('OIDC verifier — verify', () => {
  const build = async (over: { claims?: Record<string, unknown>; config?: Record<string, unknown> } = {}) => {
    const key = await makeKey('key-1');
    const idToken = await signIdToken(key, baseClaims({ nonce: 'n-1', ...over.claims }));
    const idp = fakeIdp({ jwksKeys: [key.jwk], idToken });
    const provider = createOidcVerifierProvider({
      name: 'x', issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT,
      fetch: idp.fetchImpl, now: () => NOW, ...over.config,
    });
    return { provider, idp, key };
  };

  it('exchanges the code (sending PKCE) and returns the verified identity', async () => {
    const { provider, idp } = await build();
    const identity = await provider.verify({ code: 'auth-code' }, { codeVerifier: 'cv-1', nonce: 'n-1' });
    expect(identity).toEqual({ provider: 'x', subject: 'person-1' });
    expect(idp.state.tokenBody?.get('grant_type')).toBe('authorization_code');
    expect(idp.state.tokenBody?.get('code')).toBe('auth-code');
    expect(idp.state.tokenBody?.get('code_verifier')).toBe('cv-1');
  });

  it('rejects a token signed by an unknown key', async () => {
    const good = await makeKey('key-1');
    const attacker = await makeKey('key-1'); // same kid, different key
    const idToken = await signIdToken(attacker, baseClaims({ nonce: 'n-1' }));
    const idp = fakeIdp({ jwksKeys: [good.jwk], idToken });
    const provider = createOidcVerifierProvider({
      name: 'x', issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT, fetch: idp.fetchImpl, now: () => NOW,
    });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });

  it('rejects a nonce mismatch (replay defense)', async () => {
    const { provider } = await build();
    expect(await provider.verify({ code: 'c' }, { nonce: 'different' })).toBeNull();
  });

  it('rejects a wrong audience', async () => {
    const { provider } = await build({ claims: { aud: 'someone-else' } });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });

  it('rejects an expired token', async () => {
    const { provider } = await build({ claims: { exp: nowSec - 3600 } });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });

  it('rejects a wrong issuer', async () => {
    const { provider } = await build({ claims: { iss: 'https://evil.test' } });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });

  it('accepts an audience array containing the client id', async () => {
    const { provider } = await build({ claims: { aud: ['other', CLIENT_ID] } });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toEqual({ provider: 'x', subject: 'person-1' });
  });

  it('enforces an allowed email domain when configured', async () => {
    const ok = await build({
      claims: { email: 'a@uniba.jp', email_verified: true },
      config: { allowedEmailDomain: 'uniba.jp' },
    });
    expect(await ok.provider.verify({ code: 'c' }, { nonce: 'n-1' })).not.toBeNull();

    const wrongDomain = await build({
      claims: { email: 'a@gmail.com', email_verified: true },
      config: { allowedEmailDomain: 'uniba.jp' },
    });
    expect(await wrongDomain.provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();

    const unverified = await build({
      claims: { email: 'a@uniba.jp', email_verified: false },
      config: { allowedEmailDomain: 'uniba.jp' },
    });
    expect(await unverified.provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });

  it('refetches the JWKS once when a cached keyset misses the kid (rotation)', async () => {
    const oldKey = await makeKey('old');
    const newKey = await makeKey('new');
    const oldToken = await signIdToken(oldKey, baseClaims({ nonce: 'n-1', sub: 'person-old' }));
    const newToken = await signIdToken(newKey, baseClaims({ nonce: 'n-1', sub: 'person-new' }));

    // A mutable IdP: it starts serving only the old key, then rotates to the new
    // key. The token endpoint returns whichever id_token the current `code` names.
    const served: { keys: JsonWebKey[]; tokens: Record<string, string> } = {
      keys: [oldKey.jwk],
      tokens: { old: oldToken, new: newToken },
    };
    let jwksHits = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/.well-known/openid-configuration')) {
        return Response.json({
          issuer: ISSUER, authorization_endpoint: `${ISSUER}/authorize`,
          token_endpoint: `${ISSUER}/token`, jwks_uri: `${ISSUER}/jwks`,
        });
      }
      if (url.endsWith('/jwks')) {
        jwksHits++;
        return Response.json({ keys: served.keys });
      }
      if (url.endsWith('/token')) {
        const code = new URLSearchParams(init!.body as string).get('code')!;
        return Response.json({ id_token: served.tokens[code] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const provider = createOidcVerifierProvider({
      name: 'x', issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT, fetch: fetchImpl, now: () => NOW,
    });

    // First verify warms the cache with the old keyset (one JWKS fetch).
    expect(await provider.verify({ code: 'old' }, { nonce: 'n-1' })).toEqual({ provider: 'x', subject: 'person-old' });
    expect(jwksHits).toBe(1);

    // The IdP rotates. The cached keyset misses the new kid, forcing exactly one
    // refetch, after which the new token verifies.
    served.keys = [newKey.jwk];
    expect(await provider.verify({ code: 'new' }, { nonce: 'n-1' })).toEqual({ provider: 'x', subject: 'person-new' });
    expect(jwksHits).toBe(2);
  });

  it('returns null when the token endpoint has no id_token', async () => {
    const idp = fakeIdp({ jwksKeys: [], idToken: null });
    const provider = createOidcVerifierProvider({
      name: 'x', issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT, fetch: idp.fetchImpl, now: () => NOW,
    });
    expect(await provider.verify({ code: 'c' }, { nonce: 'n-1' })).toBeNull();
  });
});

describe('unibaAuthProvider preset', () => {
  it('names itself uniba-auth, sends hd=uniba.jp, and enforces the email domain', async () => {
    const key = await makeKey('key-1');
    const idToken = await signIdToken(key, baseClaims({ nonce: 'n-1', email: 'a@uniba.jp', email_verified: true }));
    const idp = fakeIdp({ jwksKeys: [key.jwk], idToken });
    const provider = unibaAuthProvider({
      issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT, fetch: idp.fetchImpl, now: () => NOW,
    });
    expect(provider.name).toBe('uniba-auth');

    const { url } = await provider.authorize('s');
    expect(new URL(url).searchParams.get('hd')).toBe('uniba.jp');

    const identity = await provider.verify({ code: 'c' }, { nonce: 'n-1' });
    expect(identity).toEqual({ provider: 'uniba-auth', subject: 'person-1' });
  });
});
