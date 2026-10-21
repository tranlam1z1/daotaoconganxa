/**
 * HTTP client cho crawler: giới hạn tốc độ theo host, retry + backoff mũ,
 * ETag / If-Modified-Since, timeout, và tôn trọng robots.txt.
 * Xem ke-hoach/04 §3 ("Lịch sự", "Idempotent").
 */
import { readFileSync } from "node:fs";
import * as tls from "node:tls";
import { config } from "../config.ts";
import { log } from "../log.ts";
import { crawlDelayFor, EMPTY_ROBOTS, isAllowed, parseRobots, type RobotsTxt } from "./robots.ts";

export class RobotsDisallowedError extends Error {
  readonly url: string;
  constructor(url: string, userAgent: string) {
    super(`robots.txt cấm tải ${url} với User-Agent "${userAgent}"`);
    this.name = "RobotsDisallowedError";
    this.url = url;
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly bodySnippet: string;
  constructor(url: string, status: number, bodySnippet: string) {
    super(`HTTP ${status} khi tải ${url}${bodySnippet ? ` — ${bodySnippet}` : ""}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.bodySnippet = bodySnippet;
  }
}

export interface FetchOptions {
  /** ETag của lần tải trước -> gửi If-None-Match. */
  etag?: string | null;
  /** Last-Modified của lần tải trước -> gửi If-Modified-Since. */
  lastModified?: string | null;
  accept?: string;
  referer?: string;
  timeoutMs?: number;
  retries?: number;
  /** Chỉ dùng khi tải chính robots.txt (tránh đệ quy vô hạn). */
  skipRobots?: boolean;
  method?: "GET" | "HEAD";
}

export interface FetchResult {
  /** URL cuối cùng sau khi theo redirect. */
  url: string;
  status: number;
  ok: boolean;
  /** true khi máy chủ trả 304 (nội dung không đổi). */
  notModified: boolean;
  headers: Headers;
  bytes: Uint8Array;
  contentType: string;
  etag?: string;
  lastModified?: string;
  elapsedMs: number;
  text(): string;
}

/** Bộ điều tiết tốc độ cho MỘT host: bảo đảm khoảng cách tối thiểu giữa 2 request. */
class HostLimiter {
  private nextAt = 0;
  constructor(public intervalMs: number) {}
  raiseInterval(ms: number) {
    if (ms > this.intervalMs) this.intervalMs = ms;
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.nextAt);
    this.nextAt = at + this.intervalMs;
    const delay = at - now;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const m = /charset=\s*"?([\w-]+)"?/i.exec(contentType);
  const label = (m?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(label === "utf8" ? "utf-8" : label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);

/** Lỗi TLS do máy chủ gửi thiếu chứng thư trung gian (chain không đầy đủ). */
const TLS_CHAIN_ERROR =
  /unable to verify the first certificate|UNABLE_TO_VERIFY_LEAF_SIGNATURE|unable to get local issuer certificate/i;

function derToPem(der: Uint8Array): string {
  const b64 = Buffer.from(der)
    .toString("base64")
    .replace(/(.{64})/g, "$1\n");
  return `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
}

/**
 * "AIA chasing": lấy chứng thư trung gian còn thiếu từ trường
 * Authority Information Access của chứng thư máy chủ — đúng cách trình duyệt làm.
 * Nhờ vậy KHÔNG phải tắt kiểm tra TLS khi nguồn cấu hình thiếu chain
 * (trường hợp thật: g7.cdnchinhphu.vn của Công báo).
 */
export async function fetchAiaIntermediates(host: string, port = 443): Promise<string[]> {
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
  let cert: any;
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
      setTimeout(() => reject(new Error("timeout khi bắt tay TLS")), 15_000);
    });
    cert = socket.getPeerCertificate(true);
  } finally {
    socket.destroy();
  }
  const uri: string | undefined = cert?.infoAccess?.["CA Issuers - URI"]?.[0];
  if (!uri) return [];
  const res = await fetch(uri);
  if (!res.ok) return [];
  const der = new Uint8Array(await res.arrayBuffer());
  return der.byteLength ? [derToPem(der)] : [];
}

export interface FetcherStats {
  requests: number;
  bytes: number;
  notModified: number;
  retries: number;
  blockedByRobots: number;
}

export class Fetcher {
  private limiters = new Map<string, HostLimiter>();
  private robotsCache = new Map<string, Promise<RobotsTxt>>();
  /** Chứng thư trung gian bổ sung theo host (lấy qua AIA khi chain thiếu). */
  private extraCa = new Map<string, string[]>();
  private aiaTried = new Set<string>();
  readonly stats: FetcherStats = { requests: 0, bytes: 0, notModified: 0, retries: 0, blockedByRobots: 0 };

  constructor(
    private opts: {
      userAgent?: string;
      rps?: number;
      timeoutMs?: number;
      maxRetries?: number;
      obeyRobots?: boolean;
      /** Cho phép test tiêm fetch giả. */
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  get userAgent(): string {
    return this.opts.userAgent ?? config.userAgent;
  }

  /** CA bundle cho một host: gốc hệ thống + CA cấu hình thêm + trung gian lấy qua AIA. */
  private caFor(host: string): string[] | undefined {
    const extra = this.extraCa.get(host) ?? [];
    const configured = config.caFile ? [readFileSync(config.caFile, "utf8")] : [];
    if (!extra.length && !configured.length) return undefined;
    return [...(tls.rootCertificates as readonly string[]), ...configured, ...extra];
  }

  private limiterFor(host: string): HostLimiter {
    let l = this.limiters.get(host);
    if (!l) {
      const rps = this.opts.rps ?? config.rps;
      l = new HostLimiter(Math.ceil(1000 / Math.max(rps, 0.01)));
      this.limiters.set(host, l);
    }
    return l;
  }

  /** Tải và cache robots.txt theo host. Không tải được -> coi như cho phép (REP). */
  async robotsFor(url: string): Promise<RobotsTxt> {
    const u = new URL(url);
    const key = u.origin;
    let p = this.robotsCache.get(key);
    if (!p) {
      p = (async () => {
        try {
          const res = await this.rawFetch(`${key}/robots.txt`, { skipRobots: true, retries: 1 });
          if (res.status === 200) {
            const robots = parseRobots(res.text());
            const delay = crawlDelayFor(robots, this.userAgent);
            if (delay && delay > 0) {
              this.limiterFor(u.host).raiseInterval(delay * 1000);
              log.info("robots.txt yêu cầu Crawl-delay", { host: u.host, seconds: delay });
            }
            return robots;
          }
          log.info("Không có robots.txt (coi như cho phép)", { host: u.host, status: res.status });
          return EMPTY_ROBOTS;
        } catch (e) {
          log.warn("Lỗi tải robots.txt (coi như cho phép)", { host: u.host, error: String(e) });
          return EMPTY_ROBOTS;
        }
      })();
      this.robotsCache.set(key, p);
    }
    return p;
  }

  /** Kiểm tra robots trước khi tải. Trả về lý do nếu bị cấm. */
  async checkRobots(url: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!(this.opts.obeyRobots ?? config.obeyRobots)) return { allowed: true };
    const robots = await this.robotsFor(url);
    const allowed = isAllowed(robots, this.userAgent, url);
    return allowed ? { allowed } : { allowed, reason: "robots.txt disallow" };
  }

  /** Tải một URL. Ném RobotsDisallowedError nếu robots cấm. */
  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    if (!opts.skipRobots) {
      const { allowed } = await this.checkRobots(url);
      if (!allowed) {
        this.stats.blockedByRobots += 1;
        log.warn("BỎ QUA vì robots.txt cấm", { url, userAgent: this.userAgent });
        throw new RobotsDisallowedError(url, this.userAgent);
      }
    }
    return this.rawFetch(url, opts);
  }

  /** Như fetch() nhưng trả về undefined thay vì ném lỗi khi robots cấm. */
  async fetchIfAllowed(url: string, opts: FetchOptions = {}): Promise<FetchResult | undefined> {
    try {
      return await this.fetch(url, opts);
    } catch (e) {
      if (e instanceof RobotsDisallowedError) return undefined;
      throw e;
    }
  }

  private async rawFetch(url: string, opts: FetchOptions): Promise<FetchResult> {
    const u = new URL(url);
    const limiter = this.limiterFor(u.host);
    const maxRetries = opts.retries ?? this.opts.maxRetries ?? config.maxRetries;
    const timeoutMs = opts.timeoutMs ?? this.opts.timeoutMs ?? config.timeoutMs;
    const doFetch = this.opts.fetchImpl ?? fetch;

    const headers: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi,en;q=0.8",
    };
    if (opts.etag) headers["If-None-Match"] = opts.etag;
    if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;
    if (opts.referer) headers.Referer = opts.referer;

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        this.stats.retries += 1;
        const backoff = Math.min(30_000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
        log.warn("Thử lại sau lỗi tải", { url, attempt, backoffMs: backoff, error: String(lastError) });
        await new Promise((r) => setTimeout(r, backoff));
      }
      await limiter.acquire();
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(new Error(`timeout ${timeoutMs}ms`)), timeoutMs);
      try {
        const ca = this.caFor(u.host);
        const res = await doFetch(url, {
          method: opts.method ?? "GET",
          headers,
          redirect: "follow",
          signal: ctrl.signal,
          ...(ca ? ({ tls: { ca } } as any) : {}),
        } as RequestInit);
        this.stats.requests += 1;
        const contentType = res.headers.get("content-type") ?? "";
        if (res.status === 304) {
          this.stats.notModified += 1;
          clearTimeout(timer);
          return this.makeResult(res, url, new Uint8Array(0), contentType, Date.now() - started, true);
        }
        if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            limiter.raiseInterval(Math.min(retryAfter * 1000, 60_000));
          }
          lastError = new HttpError(url, res.status, "");
          clearTimeout(timer);
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        this.stats.bytes += buf.byteLength;
        clearTimeout(timer);
        return this.makeResult(res, url, buf, contentType, Date.now() - started, false);
      } catch (e) {
        clearTimeout(timer);
        lastError = e;
        // Chain TLS thiếu chứng thư trung gian -> lấy qua AIA rồi thử lại
        // (giữ nguyên việc kiểm tra chứng thư, KHÔNG tắt xác thực).
        if (TLS_CHAIN_ERROR.test(String((e as Error)?.message ?? e)) && !this.aiaTried.has(u.host)) {
          this.aiaTried.add(u.host);
          try {
            const pems = await fetchAiaIntermediates(u.hostname, Number(u.port) || 443);
            if (pems.length) {
              this.extraCa.set(u.host, pems);
              log.info("Đã bổ sung chứng thư trung gian qua AIA", { host: u.host, count: pems.length });
              attempt -= 1; // lần thử lại này không tính là retry lỗi
              continue;
            }
            log.warn("Không lấy được chứng thư trung gian qua AIA", { host: u.host });
          } catch (aiaErr) {
            log.warn("Lỗi khi lấy chứng thư trung gian qua AIA", { host: u.host, error: String(aiaErr) });
          }
        }
        if (attempt >= maxRetries) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private makeResult(
    res: Response,
    requestedUrl: string,
    bytes: Uint8Array,
    contentType: string,
    elapsedMs: number,
    notModified: boolean,
  ): FetchResult {
    const etag = res.headers.get("etag") ?? undefined;
    const lastModified = res.headers.get("last-modified") ?? undefined;
    return {
      url: res.url || requestedUrl,
      status: res.status,
      ok: res.ok,
      notModified,
      headers: res.headers,
      bytes,
      contentType,
      ...(etag ? { etag } : {}),
      ...(lastModified ? { lastModified } : {}),
      elapsedMs,
      text: () => decodeBody(bytes, contentType),
    };
  }
}

/** Fetcher dùng chung cho toàn tiến trình (một bộ điều tiết cho mỗi host). */
export const fetcher = new Fetcher();

/** Bắt buộc HTTP 2xx, ngược lại ném HttpError kèm trích đoạn body để chẩn đoán. */
export function requireOk(res: FetchResult): FetchResult {
  if (!res.ok) {
    const snippet = res.bytes.byteLength ? res.text().slice(0, 300).replace(/\s+/g, " ") : "";
    throw new HttpError(res.url, res.status, snippet);
  }
  return res;
}
