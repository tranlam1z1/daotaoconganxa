/**
 * Tiện ích test: tự sinh cặp khóa RSA và ký ID token giống Google,
 * để kiểm chứng luồng xác thực THẬT mà không cần gọi mạng.
 */
import { setJwks } from "../src/google.ts";

export interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  jwk: { kid: string; kty: string; n: string; e: string; alg: string; use: string };
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlText(s: string): string {
  return b64url(new TextEncoder().encode(s));
}

export async function makeKey(kid = "test-key-1"): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { n: string; e: string; kty: string };
  return {
    kid,
    privateKey: pair.privateKey,
    jwk: { kid, kty: pub.kty, n: pub.n, e: pub.e, alg: "RS256", use: "sig" },
  };
}

/** Nạp khóa công khai vào cache JWKS để verifyGoogleIdToken dùng, không gọi mạng. */
export function installKeys(...keys: TestKey[]): void {
  setJwks(keys.map((k) => k.jwk));
}

export interface TokenClaims {
  iss?: string;
  aud: string;
  sub?: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
}

/** Ký một ID token giống hệt định dạng Google trả về. */
export async function signIdToken(
  key: TestKey,
  claims: TokenClaims,
  opts: { alg?: string } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: opts.alg ?? "RS256", kid: key.kid, typ: "JWT" };
  const payload = {
    iss: claims.iss ?? "https://accounts.google.com",
    sub: claims.sub ?? "1234567890",
    email_verified: claims.email_verified ?? true,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + 3600,
    ...claims,
  };
  const head = b64urlText(JSON.stringify(header));
  const body = b64urlText(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

/** Token có chữ ký sai (ký bằng khóa khác). */
export async function signWithWrongKey(
  wrong: TestKey,
  kidToClaim: string,
  claims: TokenClaims,
): Promise<string> {
  const t = await signIdToken({ ...wrong, kid: kidToClaim }, claims);
  return t;
}
