// The wire-protocol names shared by every persona-kit transport. These are
// protocol, not implementation: the Ruby gem declares the same values, and
// doc/protocol.md (the source of truth once written) must list them.

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
