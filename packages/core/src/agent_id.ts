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
// for sending it through the join call; only after the server accepts
// it should setAgentId be called to persist.
//
// crypto.randomUUID needs a secure context (https / localhost), so fall
// back to assembling the UUID from getRandomValues for plain-http LAN
// dev servers.
export const generateAgentId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Wipe the persisted agent_id so the browser falls back to anonymous on the
// next request. Used when the application drops this browser's persona — for
// example after the person revokes their own binding server-side, leaving the
// local id resolving to nothing.
export const clearAgentId = (): void => {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable — module cache update is enough.
  }
};
