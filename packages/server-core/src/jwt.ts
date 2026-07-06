// Minimal JWS/JWKS verification for OIDC id_tokens, on Web Crypto only (Node
// 18+, edge, workers). Supports the algorithms an OIDC AS realistically signs
// with: RS256, ES256, and EdDSA (Ed25519). No JWT dependency.

export type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
export type Jwks = { keys: Jwk[] };

type AlgParams = {
  importAlgorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams;
  verifyAlgorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
};

const ALGS: Record<string, AlgParams> = {
  RS256: {
    importAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    verifyAlgorithm: { name: 'RSASSA-PKCS1-v1_5' },
  },
  ES256: {
    importAlgorithm: { name: 'ECDSA', namedCurve: 'P-256' },
    verifyAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
  },
  EdDSA: {
    importAlgorithm: { name: 'Ed25519' },
    verifyAlgorithm: { name: 'Ed25519' },
  },
};

export const supportedAlgs = (): string[] => Object.keys(ALGS);

const b64urlToBytes = (str: string): Uint8Array => {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const b64urlToString = (str: string): string => new TextDecoder().decode(b64urlToBytes(str));

export type DecodedJwt = {
  header: { alg?: string; kid?: string; typ?: string };
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Uint8Array;
};

// Splits and decodes a compact JWS without verifying it. Returns null on any
// structural or JSON error.
export const decodeJwt = (token: string): DecodedJwt | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  try {
    return {
      header: JSON.parse(b64urlToString(h)),
      payload: JSON.parse(b64urlToString(p)),
      signingInput: `${h}.${p}`,
      signature: b64urlToBytes(s),
    };
  } catch {
    return null;
  }
};

// Picks the JWK to verify with: by kid when the token carries one, otherwise the
// sole signing key. Honors `use` and `alg` hints when present.
export const selectJwk = (jwks: Jwks, kid: string | undefined, alg: string | undefined): Jwk | null => {
  const candidates = jwks.keys.filter(
    (k) => (k.use ? k.use === 'sig' : true) && (k.alg && alg ? k.alg === alg : true),
  );
  if (kid) return candidates.find((k) => k.kid === kid) ?? null;
  return candidates.length === 1 ? candidates[0]! : null;
};

// Verifies a compact JWS signature against a JWK. Returns false for an
// unsupported algorithm or any import/verify failure (never throws).
export const verifyJwtSignature = async (
  decoded: DecodedJwt,
  jwk: Jwk,
): Promise<boolean> => {
  const alg = decoded.header.alg;
  if (!alg) return false;
  const params = ALGS[alg];
  if (!params) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, params.importAlgorithm, false, ['verify']);
    return await crypto.subtle.verify(
      params.verifyAlgorithm,
      key,
      decoded.signature as BufferSource,
      new TextEncoder().encode(decoded.signingInput) as BufferSource,
    );
  } catch {
    return false;
  }
};
