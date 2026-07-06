// persona-server-core — the server-side half of persona-kit shared by every
// cookie-profile adapter (Hono, Next.js, ...): session token signing and
// verification, single-use claim codes, and the claim decision table.
// Framework wiring (cookie attributes, routes, middleware) lives in the
// adapter packages.
export { AGENT_ID_HEADER, AGENT_ID_PARAM, NOT_JOINED_CODE } from '@uniba-commons/persona-core';
export { createSessionCodec, type SessionCodec, type SessionPayload } from './session.js';
export {
  CLAIM_CODE_ALPHABET,
  generateClaimCode,
  normalizeClaimCode,
  formatClaimCode,
  digestClaimCode,
} from './claim_code.js';
export {
  performAccountLink,
  type AccountLinkStore,
  type AccountLinkResult,
  type ClaimIdentity,
} from './account_link.js';
export {
  StubProvider,
  createProviderRegistry,
  type Identity,
  type OidcProvider,
  type AuthorizeStart,
  type ProviderRegistry,
} from './oidc.js';
export {
  createOidcVerifierProvider,
  unibaAuthProvider,
  type OidcVerifierConfig,
  type UnibaAuthConfig,
} from './oidc_verifier.js';
export {
  decodeJwt,
  selectJwk,
  verifyJwtSignature,
  supportedAlgs,
  type Jwk,
  type Jwks,
  type DecodedJwt,
} from './jwt.js';
export {
  createLinkStore,
  generateLinkToken,
  type KVStore,
  type LinkStore,
  type PendingData,
  type ResultData,
} from './link_store.js';
export {
  beginAccountLink,
  handleOidcCallback,
  completeAccountLink,
} from './oidc_flow.js';
