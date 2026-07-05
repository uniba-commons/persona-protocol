// Single-use claim codes (doc/protocol.md §6, P-7): generation, input
// normalization, display formatting, and digest-at-rest. Codes use Crockford
// base32 (no I, L, O, U) so they survive being read aloud or typed. Storage
// keeps only the digest; consumption is the adapter's concern (single-use,
// atomic — P-7).

export const CLAIM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// 16 chars ≈ 80 bits — fine for a short-lived, single-use code. Raise the
// length for codes expected to sit unused for long periods.
export const generateClaimCode = (length = 16): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += CLAIM_CODE_ALPHABET[b & 31];
  return out;
};

// Accept a pasted code in any spacing or case.
export const normalizeClaimCode = (input: string): string =>
  input.toUpperCase().replace(/[^0-9A-Z]/g, '');

// Group into 4-char blocks for display: "3F7K-9B2D-…".
export const formatClaimCode = (code: string): string => {
  const normalized = normalizeClaimCode(code);
  return (normalized.match(/.{1,4}/g) ?? []).join('-');
};

// What gets persisted instead of the code (P-7). SHA-256 hex of the
// normalized form.
export const digestClaimCode = async (code: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeClaimCode(code)));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
};
