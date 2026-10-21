/**
 * Bước 7: lập chỉ mục. Gọi `indexVersion()` của @qdpl/search NẾU package đã có.
 * Nhánh khác đang xây package này nên import động + bọc try/catch: thiếu package
 * thì bỏ qua có ghi log, KHÔNG làm hỏng pipeline.
 */
import { errText, log } from "../log.ts";

export interface IndexResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  indexed?: number;
}

let warned = false;

/** Nạp @qdpl/search một cách an toàn. */
async function loadSearch(): Promise<any | undefined> {
  try {
    return await import("@qdpl/search");
  } catch (e) {
    if (!warned) {
      log.warn("Chưa có @qdpl/search — bỏ qua bước lập chỉ mục", { error: String(e) });
      warned = true;
    }
    return undefined;
  }
}

export async function indexVersion(documentId: string, versionId: string): Promise<IndexResult> {
  // Chèn vector vào chỉ mục HNSW là bước ghi CSDL nặng nhất của đường ống (trung bình 31 giây/văn bản
  // trên cụm dùng chung 1 vCPU). Khi nạp kho hàng loạt, đặt QDPL_EMBEDDINGS=0 để bỏ qua bước này,
  // rồi chạy `bun run index` vào giờ thấp điểm.
  if ((process.env.QDPL_EMBEDDINGS ?? "1").trim() === "0") {
    return {
      ok: true,
      skipped: true,
      reason: "QDPL_EMBEDDINGS=0: tạm không sinh embedding để giảm tải CSDL",
    };
  }
  const mod = await loadSearch();
  if (!mod) return { ok: true, skipped: true, reason: "@qdpl/search chưa sẵn sàng" };
  const fn = mod.indexVersion ?? mod.default?.indexVersion;
  if (typeof fn !== "function") {
    log.warn("@qdpl/search không xuất indexVersion() — bỏ qua", {});
    return { ok: true, skipped: true, reason: "indexVersion() chưa được xuất" };
  }
  try {
    // Chữ ký của @qdpl/search có thể là (versionId) hoặc (documentId, versionId).
    const r = fn.length >= 2 ? await fn(documentId, versionId) : await fn(versionId);
    return { ok: true, skipped: false, indexed: typeof r === "number" ? r : (r?.indexed ?? undefined) };
  } catch (e) {
    // Lỗi thật của indexer thì KHÔNG nuốt.
    log.error("indexVersion() lỗi", { documentId, versionId, error: errText(e) });
    throw e;
  }
}

export * from "./consolidate.ts";
export * from "./convert.ts";
export * from "./extract-ops.ts";
export * from "./ingest.ts";
export * from "./parse.ts";
export * from "./relations.ts";
