// @uniba-commons/persona-hono — the Hono adapter for persona-kit's cookie
// profile. It binds persona-server-core's session codec, claim codes, and
// claim decision table to Hono: signed session and pending-join cookies, a
// per-request persona-resolution middleware, and NOT_JOINED write gating.
// Framework glue only; the identity logic lives in persona-server-core.
export {
  createPersonaCookies,
  type PersonaCookies,
  type PersonaCookieOptions,
  type SessionData,
} from './cookies.js';
export {
  personaMiddleware,
  requireJoined,
  type PersonaEnv,
  type PersonaMiddlewareOptions,
  type RequireJoinedOptions,
} from './middleware.js';

// Re-exported for convenience so a Hono consumer needs only this package for
// the cookie-profile server side.
export {
  NOT_JOINED_CODE,
  AGENT_ID_HEADER,
  AGENT_ID_PARAM,
  createSessionCodec,
  generateClaimCode,
  normalizeClaimCode,
  formatClaimCode,
  digestClaimCode,
  performAccountLink,
  type AccountLinkStore,
  type AccountLinkResult,
  type ClaimIdentity,
  StubProvider,
  createProviderRegistry,
  createOidcVerifierProvider,
  unibaAuthProvider,
  createLinkStore,
  beginAccountLink,
  handleOidcCallback,
  completeAccountLink,
  type OidcProvider,
  type OidcVerifierConfig,
  type UnibaAuthConfig,
  type ProviderRegistry,
  type KVStore,
  type LinkStore,
  type Identity,
} from '@uniba-commons/persona-server-core';
