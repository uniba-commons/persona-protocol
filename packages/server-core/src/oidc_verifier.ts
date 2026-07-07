// A production OIDC verifier provider (docs/spec §7, P-16): the
// authorization-code + PKCE flow, code exchange at the token endpoint, and
// id_token validation against the IdP's published JWKS. Web Crypto + fetch
// only, so it runs on Node 18+, edge, and workers. Configure it per IdP, or use
// a preset (see unibaAuthProvider).

import type { AuthorizeStart, Identity, OidcProvider } from './oidc.js';
import { decodeJwt, selectJwk, verifyJwtSignature, type Jwks } from './jwt.js';

export type OidcVerifierConfig = {
  // Stored on account bindings and matched by the registry.
  name: string;
  // The IdP's issuer identifier. Endpoints are discovered from
  // `${issuer}/.well-known/openid-configuration` unless given explicitly.
  issuer: string;
  clientId: string;
  // Confidential clients send a secret at the token endpoint; omit for a public
  // client relying on PKCE alone.
  clientSecret?: string;
  redirectUri: string;
  scope?: string; // default 'openid email'
  // Explicit endpoints override discovery.
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  // Extra authorize-request params (e.g. { hd: 'uniba.jp', prompt: 'select_account' }).
  authorizeParams?: Record<string, string>;
  // Deployment-specific claim checks beyond iss/aud/exp/nonce/sub (P-16).
  requireHostedDomain?: string; // require the `hd` claim to equal this
  allowedEmailDomain?: string; // require email_verified and email @ this domain
  // Injected for testability and custom runtimes.
  fetch?: typeof fetch;
  now?: () => number; // ms since epoch
  clockToleranceSeconds?: number; // default 60
};

type Discovered = { authorizationEndpoint: string; tokenEndpoint: string; jwksUri: string };

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const randomB64url = (bytes: number): string => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

const s256Challenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
};

const audienceMatches = (aud: unknown, clientId: string): boolean =>
  aud === clientId || (Array.isArray(aud) && aud.includes(clientId));

export const createOidcVerifierProvider = (config: OidcVerifierConfig): OidcProvider => {
  const fetchImpl = config.fetch ?? fetch;
  const now = () => (config.now ?? Date.now)();
  const tolerance = config.clockToleranceSeconds ?? 60;
  const scope = config.scope ?? 'openid email';
  const issuer = config.issuer.replace(/\/$/, '');

  let discovered: Discovered | null = null;
  let jwksCache: Jwks | null = null;

  const discover = async (): Promise<Discovered> => {
    if (discovered) return discovered;
    if (config.authorizationEndpoint && config.tokenEndpoint && config.jwksUri) {
      discovered = {
        authorizationEndpoint: config.authorizationEndpoint,
        tokenEndpoint: config.tokenEndpoint,
        jwksUri: config.jwksUri,
      };
      return discovered;
    }
    const res = await fetchImpl(`${issuer}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`OIDC discovery failed for ${issuer}: ${res.status}`);
    const doc = (await res.json()) as Record<string, string>;
    // OIDC requires the discovered issuer to match (mix-up defense).
    if (doc.issuer && doc.issuer.replace(/\/$/, '') !== issuer) {
      throw new Error(`OIDC issuer mismatch: expected ${issuer}, got ${doc.issuer}`);
    }
    discovered = {
      authorizationEndpoint: config.authorizationEndpoint ?? doc.authorization_endpoint!,
      tokenEndpoint: config.tokenEndpoint ?? doc.token_endpoint!,
      jwksUri: config.jwksUri ?? doc.jwks_uri!,
    };
    return discovered;
  };

  const getJwks = async (force: boolean): Promise<Jwks> => {
    if (jwksCache && !force) return jwksCache;
    const { jwksUri } = await discover();
    const res = await fetchImpl(jwksUri);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    jwksCache = (await res.json()) as Jwks;
    return jwksCache;
  };

  const validateIdToken = async (idToken: string, nonce: string | undefined): Promise<Identity | null> => {
    const decoded = decodeJwt(idToken);
    if (!decoded) return null;

    // Resolve the signing key by kid, refetching the JWKS once on a miss so key
    // rotation is picked up without a restart.
    const kid = decoded.header.kid;
    let jwks = await getJwks(false);
    let jwk = selectJwk(jwks, kid, decoded.header.alg);
    if (!jwk) {
      jwks = await getJwks(true);
      jwk = selectJwk(jwks, kid, decoded.header.alg);
    }
    if (!jwk) return null;
    if (!(await verifyJwtSignature(decoded, jwk))) return null;

    const p = decoded.payload;
    const nowSec = Math.floor(now() / 1000);
    if (typeof p.iss !== 'string' || p.iss.replace(/\/$/, '') !== issuer) return null;
    if (!audienceMatches(p.aud, config.clientId)) return null;
    if (typeof p.exp !== 'number' || p.exp + tolerance <= nowSec) return null;
    if (typeof p.nbf === 'number' && p.nbf - tolerance > nowSec) return null;
    // nonce binds the id_token to this browser's authorize request (replay
    // defense). When we issued a nonce, the token MUST echo it.
    if (nonce !== undefined && p.nonce !== nonce) return null;
    if (config.requireHostedDomain && p.hd !== config.requireHostedDomain) return null;
    if (config.allowedEmailDomain) {
      const email = typeof p.email === 'string' ? p.email : '';
      if (p.email_verified !== true || !email.toLowerCase().endsWith(`@${config.allowedEmailDomain.toLowerCase()}`)) {
        return null;
      }
    }
    if (typeof p.sub !== 'string' || p.sub === '') return null;

    return { provider: config.name, subject: p.sub };
  };

  return {
    name: config.name,

    async authorize(state: string): Promise<AuthorizeStart> {
      const { authorizationEndpoint } = await discover();
      const codeVerifier = randomB64url(32);
      const nonce = randomB64url(16);
      const url = new URL(authorizationEndpoint);
      const params: Record<string, string> = {
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope,
        state,
        nonce,
        code_challenge: await s256Challenge(codeVerifier),
        code_challenge_method: 'S256',
        ...config.authorizeParams,
      };
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      return { url: url.toString(), stash: { codeVerifier, nonce } };
    },

    async verify(params: Record<string, unknown>, stash?: Record<string, string>): Promise<Identity | null> {
      const code = params.code;
      if (typeof code !== 'string' || code === '') return null;

      const { tokenEndpoint } = await discover();
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
      });
      if (stash?.codeVerifier) body.set('code_verifier', stash.codeVerifier);
      if (config.clientSecret) body.set('client_secret', config.clientSecret);

      const res = await fetchImpl(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body,
      });
      if (!res.ok) return null;
      const tokens = (await res.json()) as { id_token?: string };
      if (!tokens.id_token) return null;

      return validateIdToken(tokens.id_token, stash?.nonce);
    },
  };
};

// Preset for uniba/auth (github.com/uniba/auth): the uniba.jp shared OIDC AS.
// Fills in the name, scope, and the hd=uniba.jp upstream constraint; the issuer
// and client credentials are still per-deployment. auth is not yet published,
// so `issuer` is required (no default endpoint is assumed) and the token-claim
// domain check defaults to the email domain — provisional until auth's token
// spec lands.
export type UnibaAuthConfig = {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  // Override or disable (null) the provisional email-domain claim check.
  allowedEmailDomain?: string | null;
  fetch?: typeof fetch;
  now?: () => number;
};

export const unibaAuthProvider = (config: UnibaAuthConfig): OidcProvider =>
  createOidcVerifierProvider({
    name: 'uniba-auth',
    issuer: config.issuer,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scope: 'openid email',
    authorizeParams: { hd: 'uniba.jp' },
    allowedEmailDomain: config.allowedEmailDomain === null ? undefined : (config.allowedEmailDomain ?? 'uniba.jp'),
    fetch: config.fetch,
    now: config.now,
  });
