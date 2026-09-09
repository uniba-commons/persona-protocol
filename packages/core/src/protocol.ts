// The wire-protocol names shared by every persona-protocol transport. These are
// protocol, not implementation: the Ruby gem declares the same values, and
// docs/spec (the source of truth once written) must list them.

// HTTP header carrying the browser's agent_uid on header-transport consumers.
export const AGENT_ID_HEADER = 'X-Agent-Id';

// WebSocket query param fallback for transports that can't set custom
// headers (e.g. ActionCable).
export const AGENT_ID_PARAM = 'agent_id';

// Error code the server raises when a write is attempted by a visitor who
// hasn't opted in yet. A normal opt-in handshake signal, not an exception
// worth surfacing (e.g. to Sentry). How it travels (GraphQL extension code,
// HTTP status + body, HTML fragment) is transport-specific.
export const NOT_JOINED_CODE = 'NOT_JOINED';

// Protocol states of the account-linking flow (P-25). Like NOT_JOINED these are
// names, not transports: how one travels (GraphQL extension code, HTTP status +
// body, HTML fragment) is the consumer's choice.

// Linking is switched off, or no provider is registered: it can never succeed
// on this deployment.
export const ACCOUNT_LINKING_DISABLED_CODE = 'ACCOUNT_LINKING_DISABLED';

// The round-trip token (state or link_token) is unknown, already consumed, or
// expired.
export const INVALID_ACCOUNT_LINK_CODE = 'INVALID_ACCOUNT_LINK';

// The binding named for revocation is absent, or belongs to another persona.
// The two cases are deliberately indistinguishable to the caller (P-25).
export const BINDING_NOT_FOUND_CODE = 'BINDING_NOT_FOUND';
