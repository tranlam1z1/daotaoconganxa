/**
 * Bước 2 của luồng nạp (ke-hoach/02 §4.1): source_records -> documents.
 * Tạo/cập nhật danh tính văn bản rồi đẩy job `convert`.
 */
import { type DocumentRow, enqueue, sql, upsertDocument } from "@qdpl/db";
import { buildUrn, type DocStatus, type DocumentMeta } from "@qdpl/legal-model";
import { fileKindOf, type RawDocMeta } from "../crawler/adapters/types.ts";
import { normalizeAgency, normalizeDocType, normalizeSoKyHieu, normalizeText } from "../crawler/normalize.ts";
import { linkSourceRecordToDocument } from "../crawler/store.ts";
import { log } from "../log.ts";

export interface SourceRecordRow {
  id: string;
  source: string;
  source_id: string;
  url: string;
  file_uri: string | null;
  content_type: string | null;
  file_hash: string | null;
  document_id: string | null;
  metadata: any;
}

export async function getSourceRecord(id: string): Promise<SourceRecordRow | undefined> {
  const rows = await sql`SELECT * FROM source_records WHERE id = ${id} LIMIT 1`;
  return rows[0] as SourceRecordRow | undefined;
}

/** Trạng thái ban đầu suy từ ngày hiệu lực (chưa có ops nào). */
export function initialStatus(
  meta: { effectiveFrom?: string; effectiveTo?: string },
  asOf: string,
): DocStatus {
  if (meta.effectiveTo && meta.effectiveTo <= asOf) return "het_hieu_luc";
  if (meta.effectiveFrom && meta.effectiveFrom > asOf) return "chua_hieu_luc";
  if (meta.effectiveFrom) return "con_hieu_luc";
  return "khong_xac_dinh";
}

/** Tên hiển thị ngắn: "Nghị định 100/2026/NĐ-CP". */
function buildShortTitle(typeName: string | undefined, soKyHieu: string): string {
  return `${normalizeText(typeName ?? "Văn bản")} ${soKyHieu}`.trim();
}

/** RawDocMeta (thô từ nguồn) -> DocumentMeta (chuẩn hệ thống). */
export function toDocumentMeta(
  raw: RawDocMeta,
  asOf = new Date().toISOString().slice(0, 10),
): DocumentMeta & {
  locality?: string;
} {
  const soKyHieu = normalizeSoKyHieu(raw.soKyHieu);
  if (!soKyHieu) throw new Error(`Thiếu số ký hiệu, không tạo được URN (title="${raw.title}")`);
  const dt = normalizeDocType({ soKyHieu, typeName: raw.typeName, title: raw.title });
  const agency = normalizeAgency(raw.issuer, raw.issuedDate);
  const urn = buildUrn({
    docType: dt.docType,
    soKyHieu,
    ...(raw.locality ? { locality: raw.locality } : {}),
  });
  const title = normalizeText(raw.title || raw.summary || buildShortTitle(raw.typeName, soKyHieu));
  return {
    urn,
    docType: dt.docType,
    rank: dt.rank,
    isNormative: dt.isNormative,
    soKyHieu,
    title,
    shortTitle: buildShortTitle(raw.typeName, soKyHieu),
    issuer: agency.name,
    ...(raw.signer ? { signer: normalizeText(raw.signer) } : {}),
    issuedDate: raw.issuedDate ?? "",
    ...(raw.effectiveFrom ? { effectiveFrom: raw.effectiveFrom } : {}),
    ...(raw.effectiveTo ? { effectiveTo: raw.effectiveTo } : {}),
    ...(raw.gazetteNo ? { gazetteNo: raw.gazetteNo } : {}),
    ...(raw.gazetteDate ? { gazetteDate: raw.gazetteDate } : {}),
    fields: raw.fields ?? [],
    status: initialStatus(raw, asOf),
    ...(raw.summary ? { summary: normalizeText(raw.summary) } : {}),
    ...(raw.locality ? { locality: raw.locality } : {}),
  };
}

export interface IngestResult {
  documentId: string;
  urn: string;
  created: boolean;
  convertJobId?: string;
  /** File được chọn để chuyển đổi. */
  route?: string;
}

/**
 * Nạp một `source_record` thành `document`.
 * Idempotent: gọi lại chỉ cập nhật thuộc tính.
 */
export async function ingestSourceRecord(
  sourceRecordId: string,
  opts: { enqueueConvert?: boolean } = {},
): Promise<IngestResult> {
  const rec = await getSourceRecord(sourceRecordId);
  if (!rec) throw new Error(`Không có source_record ${sourceRecordId}`);
  const md = rec.metadata ?? {};
  if (typeof md !== "object") {
    throw new Error(
      `source_records.metadata của ${sourceRecordId} không phải object (kiểu ${typeof md}) — ` +
        "có thể đã bị JSON.stringify hai lần khi ghi",
    );
  }
  const raw = (md.meta ?? {}) as RawDocMeta;
  if (!raw.soKyHieu) throw new Error(`source_record ${sourceRecordId} thiếu meta.soKyHieu`);

  const meta = toDocumentMeta(raw);
  const existed = await sql`SELECT 1 FROM documents WHERE urn = ${meta.urn} LIMIT 1`;
  const doc: DocumentRow = await upsertDocument({ ...meta, primarySource: rec.source });
  await linkSourceRecordToDocument(rec.id, doc.id);

  const result: IngestResult = { documentId: doc.id, urn: doc.urn, created: existed.length === 0 };

  if (opts.enqueueConvert !== false) {
    const stored: any[] = Array.isArray(md.storedFiles) ? md.storedFiles : [];
    const pick =
      stored.find((f) => f.kind === "docx") ??
      stored.find((f) => f.kind === "pdf") ??
      stored.find((f) => f.kind === "html") ??
      (rec.file_uri ? { kind: fileKindOf(rec.file_uri), uri: rec.file_uri } : undefined);
    if (pick?.uri) {
      result.route = pick.kind;
      result.convertJobId = await enqueue("convert", {
        documentId: doc.id,
        sourceRecordId: rec.id,
        fileUri: pick.uri,
        kind: pick.kind,
      });
    } else {
      log.warn("Không có file để chuyển đổi", { sourceRecordId, urn: doc.urn });
    }
  }

  // Văn bản này có thể là đích của lệnh sửa đổi đã trích trước đó -> kích hoạt hợp nhất.
  const pendingOps = await sql`
    SELECT count(*)::int AS n FROM amendment_ops WHERE target_doc_urn = ${doc.urn}`;
  if (((pendingOps[0] as any)?.n ?? 0) > 0) {
    await enqueue("consolidate", { targetDocUrn: doc.urn }, { priority: 2 });
    log.info("Có lệnh sửa đổi chờ sẵn, đã đẩy job hợp nhất", { urn: doc.urn });
  }

  log.info("Đã nạp văn bản", { urn: doc.urn, documentId: doc.id, created: result.created });
  return result;
}

/** Nạp trực tiếp từ metadata (dùng cho CLI ingest-file và test). */
export async function ingestMeta(raw: RawDocMeta, primarySource = "manual"): Promise<DocumentRow> {
  const meta = toDocumentMeta(raw);
  return upsertDocument({ ...meta, primarySource });
}
