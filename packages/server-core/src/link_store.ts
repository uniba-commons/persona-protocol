// Short-lived storage that ties the OIDC redirect round-trip to the browser
// that started it — without ever putting the credential in a URL (doc/protocol.md
// §7, P-14/P-15). Mirrors the Ruby gem's Persona::Oidc::LinkStore.
//
// The state entry is single-use (CSRF-style); the result entry is read
// non-destructively so a merge-preview round-trip can re-read it, then dropped
// on final success. Persistence is injected as a minimal KV so the same code
// runs over Redis, Upstash, Cloudflare KV, or an in-memory map.

// A minimal key/value store with per-entry expiry. Methods may be sync or async.
export interface KVStore {
  set(key: string, value: string, opts: { ttlSeconds: number }): Promise<void> | void;
  get(key: string): Promise<string | null> | string | null;
  delete(key: string): Promise<void> | void;
}

// `binding` is an opaque token tying the flow to the initiating browser — the
// agent_uid in the header profile, or a nonce the adapter sets in a cookie in
// the cookie profile. Optional; when present it is checked at complete (P-16a).
// `stash` carries the provider's per-flow secrets (PKCE code_verifier, nonce)
// from authorize to the callback's verify.
export type PendingData = { provider: string; binding?: string; stash?: Record<string, string> };
export type ResultData = { provider: string; subject: string; binding?: string };

export interface LinkStore {
  generateToken(): string;
  // begin: store which provider (and optionally which browser) a state belongs to.
  putPending(state: string, data: PendingData): Promise<void>;
  // callback: consume the pending entry (single-use, P-15).
  takePending(state: string): Promise<PendingData | null>;
  // callback: hand the verified result back to the app under an opaque token.
  putResult(linkToken: string, data: ResultData): Promise<void>;
  // complete: non-destructive so the merge-preview call leaves the token valid
  // for the confirm call (P-15).
  peekResult(linkToken: string): Promise<ResultData | null>;
  // complete: drop on final success.
  dropResult(linkToken: string): Promise<void>;
}

const PENDING_PREFIX = 'persona:oidc:pending:';
const RESULT_PREFIX = 'persona:oidc:result:';
const PENDING_TTL = 600; // 10 min to complete the IdP round-trip
const RESULT_TTL = 300; // 5 min to finish the client-side confirm

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// A url-safe opaque token (~32 bytes of CSPRNG entropy).
export const generateLinkToken = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));

export const createLinkStore = (opts: {
  kv: KVStore;
  pendingTtlSeconds?: number;
  resultTtlSeconds?: number;
}): LinkStore => {
  const { kv } = opts;
  const pendingTtl = opts.pendingTtlSeconds ?? PENDING_TTL;
  const resultTtl = opts.resultTtlSeconds ?? RESULT_TTL;

  return {
    generateToken: generateLinkToken,

    async putPending(state, data) {
      await kv.set(PENDING_PREFIX + state, JSON.stringify(data), { ttlSeconds: pendingTtl });
    },

    async takePending(state) {
      const key = PENDING_PREFIX + state;
      const raw = await kv.get(key);
      await kv.delete(key);
      return raw ? (JSON.parse(raw) as PendingData) : null;
    },

    async putResult(linkToken, data) {
      await kv.set(RESULT_PREFIX + linkToken, JSON.stringify(data), { ttlSeconds: resultTtl });
    },

    async peekResult(linkToken) {
      const raw = await kv.get(RESULT_PREFIX + linkToken);
      return raw ? (JSON.parse(raw) as ResultData) : null;
    },

    async dropResult(linkToken) {
      await kv.delete(RESULT_PREFIX + linkToken);
    },
  };
};
