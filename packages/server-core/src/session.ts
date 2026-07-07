// Cookie-profile session tokens (docs/spec C-1): an HMAC-SHA256-signed
// payload carrying at least the persona reference and an expiry. Built on
// Web Crypto only, so it runs identically on Node (>= 18), edge runtimes,
// and workers. The cookie *attributes* (HttpOnly, Secure, SameSite — C-2)
// are the adapter's concern; this module only produces and checks the value.

const encoder = new TextEncoder();

const b64urlEncode = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (str: string): Uint8Array | null => {
  try {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
};

// Constant-time comparison of the encoded signatures (C-1).
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type SessionPayload = Record<string, unknown> & { exp: number };

export type SessionCodec = {
  // Signs payload plus an `exp` claim ttlSeconds from `at` (defaults to the
  // real clock). Payload keys must be JSON-serializable.
  sign(payload: Record<string, unknown>, ttlSeconds: number, opts?: { at?: number }): Promise<string>;
  // Returns the payload for a token with a valid signature and unexpired
  // `exp`, otherwise null. Never throws on malformed input.
  verify<T extends SessionPayload = SessionPayload>(
    token: string | null | undefined,
    opts?: { at?: number },
  ): Promise<T | null>;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export const createSessionCodec = ({ secret }: { secret: string }): SessionCodec => {
  const keyPromise = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = async (data: string): Promise<string> => {
    const key = await keyPromise;
    return b64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
  };

  return {
    async sign(payload, ttlSeconds, opts = {}) {
      const at = opts.at ?? nowSeconds();
      const body = { ...payload, exp: at + ttlSeconds };
      const data = b64urlEncode(encoder.encode(JSON.stringify(body)));
      return `${data}.${await mac(data)}`;
    },

    async verify(token, opts = {}) {
      if (!token || !token.includes('.')) return null;
      const [data, sig] = token.split('.');
      if (!data || !sig) return null;
      if (!timingSafeEqual(sig, await mac(data))) return null;
      const raw = b64urlDecode(data);
      if (!raw) return null;
      try {
        const payload = JSON.parse(new TextDecoder().decode(raw));
        const at = opts.at ?? nowSeconds();
        if (typeof payload.exp !== 'number' || payload.exp <= at) return null;
        return payload;
      } catch {
        return null;
      }
    },
  };
};
