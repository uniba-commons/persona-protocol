import uuid from 'uuid/v4';

const STORAGE_KEY = 'agent_id';

// Module-level cache so a join completed in this tab is picked up
// by subsequent reads without going through localStorage every time.
// Initialized lazily; resolveCached() syncs from localStorage on first call.
let cached: string | null | undefined = undefined;

const readStorage = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStorage = (uid: string): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, uid);
  } catch {
    // localStorage unavailable: keep id in module cache only.
  }
};

// Returns the agent_id if the visitor has joined, otherwise null.
// IMPORTANT: never generates an id. Read-only path stays anonymous.
export const getAgentId = (): string | null => {
  if (cached !== undefined) return cached;
  cached = readStorage();
  return cached;
};

// Caller (the join dialog) hands in the agent_uid the server accepted
// for the new guest. Persisted to localStorage and pinned in cache so
// subsequent requests carry the X-Agent-Id header.
export const setAgentId = (uid: string): void => {
  cached = uid;
  writeStorage(uid);
};

// Generate a fresh agent_uid (a v4 UUID). The caller is responsible
// for sending it through the joinAsGuest mutation; only after the
// server accepts it should setAgentId be called to persist.
export const generateAgentId = (): string => uuid();

// Wipe the persisted agent_id so the browser falls back to anonymous
// on the next request. Used when the user revokes their own binding
// from /settings/info — the server-side binding is gone, so the local
// id no longer resolves to anything.
export const clearAgentId = (): void => {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — module cache update is enough.
  }
};
