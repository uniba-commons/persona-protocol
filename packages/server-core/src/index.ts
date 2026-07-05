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
