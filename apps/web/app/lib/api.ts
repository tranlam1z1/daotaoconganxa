/**
 * Lớp bọc mọi lời gọi tới API nội bộ (`apps/api`, Hono).
 *
 * Nguyên tắc: trang CHỈ hiển thị dữ liệu thật. Trước đây mọi lỗi đều rơi về dữ liệu mẫu
 * trong `fixtures.ts` kèm nhãn "dữ liệu mẫu"; cách đó đã bỏ vì người đọc có thể nhầm nội
 * dung minh hoạ là quy định pháp luật. Nay:
 *
 *  - Dữ liệu pháp lý (văn bản, toàn văn, tìm kiếm, quan hệ, phiên bản, so sánh, hỏi đáp):
 *    lỗi thì NÉM, để loader dừng và ErrorBoundary ở `root.tsx` báo rõ là không lấy được dữ liệu.
 *  - Danh mục phụ trợ (chuyên đề, trường hợp ứng dụng, khoá đào tạo): API chưa có các
 *    endpoint này, nên trả DANH SÁCH RỖNG để trang vẫn dùng được và tự hiện trạng thái
 *    "chưa có dữ liệu". Rỗng là trung thực; bịa nội dung thì không.
 */

import { toContent, toDetail, toDocumentList, toRelations, toSearchResponse, toVersions } from "./adapters";
import type {
  AskResponse,
  CourseItem,
  DiffResponse,
  DocumentContent,
  DocumentDetail,
  DocumentListResponse,
  DocumentVersion,
  RelationGroup,
  SearchResponse,
  TopicItem,
  UseCaseItem,
} from "./types";

// Cổng API của hồ sơ dev (packages/config/src/ports.ts). scripts/serve.ts đặt sẵn API_URL;
// giá trị này chỉ dùng khi chạy web một mình.
const DEFAULT_API_URL = "http://127.0.0.1:3031";

/**
 * Trước đây chờ 2,5 giây là đủ vì hết giờ thì đã có dữ liệu mẫu đỡ. Nay hết giờ nghĩa là
 * trang báo lỗi, nên phải rộng tay hơn cho truy vấn thật trên kho lớn.
 */
const TIMEOUT_MS = 10_000;

export function apiBase(): string {
  if (typeof process !== "undefined" && process.env && process.env.API_URL) {
    return process.env.API_URL.replace(/\/+$/, "");
  }
  return DEFAULT_API_URL;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** API trả 404: route bắt lỗi này để báo "không tìm thấy" thay vì lỗi tải dữ liệu chung. */
export class ApiKhongTimThay extends Error {}

/** Gọi API với thời gian chờ; ném lỗi khi không dùng được. */
async function fetchJson<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 404) throw new ApiKhongTimThay(`API ${path} trả về 404`);
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) throw new Error(`API ${path} không trả JSON`);
  return (await res.json()) as T;
}

/**
 * Danh mục phụ trợ: API chưa cung cấp endpoint. Không có thì trả rỗng, không ném lỗi và
 * tuyệt đối không bịa dữ liệu.
 */
async function optionalList<T>(path: string): Promise<T[]> {
  try {
    const raw = await fetchJson<T[] | { items: T[] }>(path);
    const list = Array.isArray(raw) ? raw : raw.items;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Văn bản                                                             */
/* ------------------------------------------------------------------ */

export interface DocumentQuery {
  asOf?: string;
  issuer?: string;
  locality?: string;
  q?: string;
  docType?: string;
  status?: string;
  field?: string;
  /** Mặc định theo thứ bậc hiệu lực pháp lý; "moi_nhat" đưa văn bản ban hành gần đây lên đầu. */
  sort?: "thu_bac" | "moi_nhat";
  page?: number;
  limit?: number;
}

export async function getDocuments(query: DocumentQuery = {}): Promise<DocumentListResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return toDocumentList(await fetchJson(`/v1/documents${buildQuery({ ...query, page, limit })}`));
}

/** URN thật của văn bản ở đường dẫn /van-ban/:docType/:slug; không có thì ném ApiKhongTimThay. */
export async function getDocumentUrnBySlug(docType: string, slug: string): Promise<string> {
  const path = `/v1/documents/by-slug/${encodeURIComponent(docType)}/${encodeURIComponent(slug)}`;
  return (await fetchJson<{ urn: string }>(path)).urn;
}

export async function getDocument(urn: string, asOf?: string): Promise<DocumentDetail> {
  return toDetail(await fetchJson(`/v1/documents/${encodeURIComponent(urn)}${buildQuery({ asOf })}`));
}

export async function getDocumentContent(urn: string, asOf?: string): Promise<DocumentContent> {
  const path = `/v1/documents/${encodeURIComponent(urn)}/content${buildQuery({ asOf, format: "json" })}`;
  return toContent(await fetchJson(path));
}

export async function getRelations(urn: string): Promise<RelationGroup[]> {
  return toRelations(await fetchJson(`/v1/documents/${encodeURIComponent(urn)}/relations`));
}

/** Danh sách rỗng là kết quả hợp lệ: văn bản chưa từng được sửa đổi thì không có phiên bản nào. */
export async function getVersions(urn: string): Promise<DocumentVersion[]> {
  return toVersions(await fetchJson(`/v1/documents/${encodeURIComponent(urn)}/versions`));
}

export async function getDiff(urn: string, from: string, to: string): Promise<DiffResponse> {
  const path = `/v1/documents/${encodeURIComponent(urn)}/diff${buildQuery({ from, to })}`;
  const r = await fetchJson<{
    from: string;
    to: string;
    summary: { added: number; removed: number; modified: number };
    diffs: Array<{
      path: string;
      label: string;
      change: "added" | "removed" | "modified" | "unchanged";
      before?: string;
      after?: string;
      statusBefore?: string;
      statusAfter?: string;
      words?: Array<{ type: "same" | "add" | "del"; text: string }>;
    }>;
  }>(path);
  if (!r || !Array.isArray(r.diffs)) throw new Error("Dữ liệu so sánh không hợp lệ");
  return {
    from: r.from,
    to: r.to,
    stats: { added: r.summary.added, removed: r.summary.removed, changed: r.summary.modified },
    nodes: r.diffs.map((n) => ({
      path: n.path,
      label: n.label,
      changeKind: n.change === "modified" ? "changed" : n.change,
      statusBefore: n.statusBefore,
      statusAfter: n.statusAfter,
      tokens: n.words?.length
        ? n.words.map((w) => ({ kind: w.type === "same" ? "equal" : w.type, text: w.text }))
        : [
            {
              kind: n.change === "removed" ? "del" : n.change === "added" ? "add" : "equal",
              text: n.after ?? n.before ?? "",
            },
          ],
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Tìm kiếm                                                            */
/* ------------------------------------------------------------------ */

export interface SearchQuery {
  q?: string;
  asOf?: string;
  docType?: string;
  issuer?: string;
  field?: string;
  status?: string;
  year?: string;
  includeExpired?: boolean;
  page?: number;
  limit?: number;
}

export async function search(query: SearchQuery): Promise<SearchResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return toSearchResponse(await fetchJson(`/v1/search${buildQuery({ ...query, page, limit })}`));
}

/* ------------------------------------------------------------------ */
/* Hỏi đáp                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lỗi hỏi đáp mà trang cần xử lý riêng thay vì rơi về ErrorBoundary:
 * 401 (chưa đăng nhập), 429 (hết lượt hỏi trong ngày) và 503 (máy chủ chưa cấu hình AI).
 */
export class LoiHoiDap extends Error {
  constructor(
    readonly status: 401 | 429 | 503,
    message: string,
  ) {
    super(message);
  }
}

/** `token` là phiên của người đang hỏi; API tính lượt hỏi theo tài khoản (docs/PLAN.md GĐ0 S2). */
export async function ask(question: string, asOf?: string, token?: string | null): Promise<AskResponse> {
  const res = await fetch(`${apiBase()}/v1/ask`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, asOf }),
    // Hỏi đáp phải gọi mô hình nên chậm hơn hẳn các endpoint tra cứu.
    signal: AbortSignal.timeout(TIMEOUT_MS * 6),
  });
  if (res.status === 401 || res.status === 429 || res.status === 503) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new LoiHoiDap(res.status, body?.error?.message ?? "");
  }
  if (!res.ok) throw new Error(`API /v1/ask trả về ${res.status}`);
  const data = (await res.json()) as AskResponse;
  if (typeof data.answer !== "string") throw new Error("Dữ liệu trả lời không hợp lệ");
  return data;
}

/* ------------------------------------------------------------------ */
/* Danh mục phụ trợ — API chưa có endpoint, thiếu thì để rỗng           */
/* ------------------------------------------------------------------ */

export async function getUseCases(): Promise<UseCaseItem[]> {
  return optionalList<UseCaseItem>("/v1/use-cases");
}

export async function getCourses(): Promise<CourseItem[]> {
  return optionalList<CourseItem>("/v1/courses");
}

export async function getTopics(): Promise<TopicItem[]> {
  return optionalList<TopicItem>("/v1/topics");
}

/** Tra cứu nhanh một văn bản theo URN (dùng cho thẻ căn cứ ở trang hỏi đáp). */
export async function getDocumentByUrn(urn: string): Promise<DocumentDetail> {
  return getDocument(urn);
}

export type GroupedDocumentItem = import("./types").DocumentListItem & {
  matchCount: number;
  matches: Array<{ path: string; label: string; heading?: string; snippet: string; nodeStatus: string }>;
};
export async function traVanBan(query: Record<string, string | number | undefined>): Promise<{
  items: GroupedDocumentItem[];
  total: number;
  asOf: string;
  facets: import("./bo-loc-van-ban").DanhMucLoc;
}> {
  const raw = await fetchJson<{
    items: unknown[];
    total: number;
    asOf: string;
    facets: import("./bo-loc-van-ban").DanhMucLoc;
  }>(`/v1/search/documents${buildQuery(query)}`);
  const base = toDocumentList(raw);
  return {
    ...base,
    asOf: raw.asOf,
    facets: raw.facets,
    items: base.items.map((d, i) => {
      const r = raw.items[i] as { matchCount: number; matches: GroupedDocumentItem["matches"] };
      return { ...d, matchCount: r.matchCount, matches: r.matches };
    }),
  };
}
