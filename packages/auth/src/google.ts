/**
 * Xác thực danh tính bằng Google Identity Services (GIS).
 *
 * Luồng: người dùng bấm "Đăng nhập với Google" trên trang của server -> GIS trả về
 * một ID token (JWT ký RS256) -> server này kiểm chứng chữ ký bằng khóa công khai
 * của Google, kiểm tra issuer, audience, hạn dùng -> đổi lấy token phiên của hệ thống.
 *
 * Tự kiểm chứng JWT bằng WebCrypto thay vì thêm thư viện: chỉ cần RS256, và việc
 * tự viết giúp kiểm soát đúng từng điều kiện bắt buộc (aud, iss, exp, nbf).
 */

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const VALID_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export interface GoogleIdToken {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  hd?: string;
  exp: number;
  iat: number;
  nbf?: number;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_token" | "invalid_config" | "forbidden" = "invalid_token",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

interface Jwk {
  kid: string;
  n: string;
  e: string;
  alg?: string;
  kty: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | undefined;
const JWKS_TTL_MS = 60 * 60 * 1000;

/** Khóa công khai của Google, có cache. Cho phép tiêm sẵn để test không cần mạng. */
export async function getJwks(fetchImpl: typeof fetch = fetch): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetchImpl(GOOGLE_JWKS_URL);
  if (!res.ok)
    throw new AuthError(`Không tải được khóa công khai của Google (HTTP ${res.status})`, "invalid_config");
  const body = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/** Nạp sẵn bộ khóa (dùng trong test). */
export function setJwks(keys: Jwk[]): void {
  jwksCache = { keys, fetchedAt: Date.now() };
}

export function clearJwksCache(): void {
  jwksCache = undefined;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

async function importJwk(jwk: Jwk): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export interface VerifyOptions {
  /** Client ID của ứng dụng web (aud bắt buộc phải khớp). */
  clientId: string;
  /** Chỉ chấp nhận tài khoản thuộc các miền này (claim "hd"). Rỗng = không giới hạn. */
  allowedDomains?: string[];
  /** Độ lệch đồng hồ cho phép, giây. */
  clockSkewSec?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Kiểm chứng ID token của Google. Ném AuthError nếu bất kỳ điều kiện nào không đạt.
 * Không có đường tắt: thiếu cấu hình clientId cũng là lỗi, để tránh chạy mà không kiểm audience.
 */
export async function verifyGoogleIdToken(token: string, opts: VerifyOptions): Promise<GoogleIdToken> {
  if (!opts.clientId) {
    throw new AuthError(
      "Chưa cấu hình GOOGLE_CLIENT_ID nên không kiểm chứng được audience của token.",
      "invalid_config",
    );
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("ID token không đúng định dạng JWT.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = b64urlToJson<{ alg: string; kid: string }>(headerB64);
  if (header.alg !== "RS256") throw new AuthError(`Thuật toán ký không được chấp nhận: ${header.alg}.`);

  const keys = await getJwks(opts.fetchImpl ?? fetch);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError("Không tìm thấy khóa công khai khớp kid của token.");

  const key = await importJwk(jwk);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) throw new AuthError("Chữ ký của ID token không hợp lệ.");

  const claims = b64urlToJson<GoogleIdToken>(payloadB64);
  const now = Math.floor((opts.now?.() ?? Date.now()) / 1000);
  const skew = opts.clockSkewSec ?? 60;

  if (!VALID_ISSUERS.has(claims.iss)) throw new AuthError(`Issuer không hợp lệ: ${claims.iss}.`);
  if (claims.aud !== opts.clientId) throw new AuthError("Token được cấp cho ứng dụng khác (aud không khớp).");
  if (claims.exp + skew < now) throw new AuthError("ID token đã hết hạn.");
  if (claims.nbf && claims.nbf - skew > now) throw new AuthError("ID token chưa có hiệu lực.");
  if (!claims.email) throw new AuthError("Token không có email.");
  if (claims.email_verified === false) throw new AuthError("Email của tài khoản Google chưa được xác minh.");

  const domains = opts.allowedDomains?.filter(Boolean) ?? [];
  if (domains.length) {
    const domain = claims.hd ?? claims.email.split("@")[1] ?? "";
    if (!domains.includes(domain)) {
      throw new AuthError(
        `Tài khoản thuộc miền "${domain}" không được phép truy cập hệ thống này.`,
        "forbidden",
      );
    }
  }
  return claims;
}
