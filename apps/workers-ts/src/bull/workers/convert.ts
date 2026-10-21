/**
 * Giai đoạn 4 — CHUYỂN ĐỔI: file thô -> Markdown.
 *  - DOCX / HTML / MD: chuyển ngay trong TS (`pipeline/convert.ts`) rồi đẩy `parse`.
 *  - PDF             : đẩy sang hàng đợi `qdpl-sohoa` để dựng việc cho agent đọc trang
 *                      (ke-hoach/05). Job `parse` do agent đẩy sau khi hoàn tất số hóa.
 */
import { getDocumentByUrn, sql } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { convert, routeOf } from "../../pipeline/convert.ts";
import { getSourceRecord, type SourceRecordRow } from "../../pipeline/ingest.ts";
import { chuanBiPdfSoHoa } from "../../pipeline/pdf-phan.ts";
import { add } from "../queues.ts";
import { defineStage } from "../stage.ts";

export interface PickedFile {
  uri: string;
  kind: string;
  sourceRecordId: string;
}

/** Thứ tự ưu tiên: DOCX (chuyển thẳng) > PDF (số hóa) > Markdown/txt > HTML. */
function rankKind(kind: string): number {
  if (kind === "docx") return 0;
  if (kind === "pdf") return 1;
  if (kind === "md" || kind === "markdown" || kind === "txt") return 2;
  if (kind === "html") return 3;
  return 4;
}

/** Tìm file tốt nhất để chuyển đổi cho một văn bản. */
export async function pickFileToConvert(
  documentId: string,
  sourceRecordId?: string,
): Promise<PickedFile | undefined> {
  let rec: SourceRecordRow | undefined;
  if (sourceRecordId) rec = await getSourceRecord(sourceRecordId);
  if (!rec) {
    const rows = await sql`
      SELECT * FROM source_records
      WHERE document_id = ${documentId} AND file_uri IS NOT NULL
      ORDER BY fetched_at DESC LIMIT 1`;
    rec = rows[0] as SourceRecordRow | undefined;
  }
  if (!rec) return undefined;

  const md = rec.metadata ?? {};
  const stored: { kind?: string; uri?: string }[] = Array.isArray(md.storedFiles) ? md.storedFiles : [];
  const usable = stored.filter((f) => f.uri && f.kind).sort((a, b) => rankKind(a.kind!) - rankKind(b.kind!));
  const pick = usable[0];
  if (pick?.uri) return { uri: pick.uri, kind: pick.kind!, sourceRecordId: rec.id };
  if (rec.file_uri) {
    return { uri: rec.file_uri, kind: rec.content_type ?? "", sourceRecordId: rec.id };
  }
  return undefined;
}

/**
 * Tệp PDF của một văn bản — dùng cho VIỆC SỐ HÓA và cho màn hình "xem bản gốc".
 * Khác `pickFileToConvert`: ở đó DOCX được ưu tiên vì chuyển đổi thẳng chính xác hơn,
 * còn ở đây bắt buộc phải là PDF vì agent số hóa đọc trang in.
 */
export async function pickPdfFile(documentId: string): Promise<PickedFile | undefined> {
  const rows = await sql`
    SELECT * FROM source_records
    WHERE document_id = ${documentId} AND file_uri IS NOT NULL
    ORDER BY fetched_at DESC`;
  for (const rec of rows as unknown as SourceRecordRow[]) {
    const stored: { kind?: string; uri?: string }[] = Array.isArray(rec.metadata?.storedFiles)
      ? (rec.metadata.storedFiles as { kind?: string; uri?: string }[])
      : [];
    const pdf = stored.find((f) => f.kind === "pdf" && f.uri);
    if (pdf?.uri) return { uri: pdf.uri, kind: "pdf", sourceRecordId: rec.id };
    if (rec.file_uri?.toLowerCase().endsWith(".pdf")) {
      return { uri: rec.file_uri, kind: "pdf", sourceRecordId: rec.id };
    }
  }
  return undefined;
}

export const convertStage = defineStage(QUEUES.convert, async (job, ctx) => {
  const { documentUrn, sourceRecordId, runId } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  const file = await pickFileToConvert(doc.id, sourceRecordId);
  if (!file) {
    return { documentId: doc.id, documentUrn, skipped: true, reason: "không có file nào để chuyển đổi" };
  }
  const route = routeOf(file.kind, file.uri);
  await ctx.progress(30, `tuyến ${route}`);

  if (route === "sohoa") {
    // PDF: giai đoạn `sohoa` đọc lớp văn bản, chia cụm trang và tạo việc cho agent.
    // Văn bản đăng nhiều kỳ Công báo có nhiều tệp PDF: ghép lại trước, không số hóa mỗi phần đầu.
    const pdf = await chuanBiPdfSoHoa(doc.id, file.sourceRecordId);
    const inputPath = pdf?.uri ?? file.uri;
    await add(
      QUEUES.sohoa,
      {
        ...(runId ? { runId } : {}),
        documentUrn,
        inputPath,
        sourceRecordId: pdf?.sourceRecordId ?? file.sourceRecordId,
      },
      { key: `${runId ?? "adhoc"}:${documentUrn}` },
    );
    return {
      documentId: doc.id,
      documentUrn,
      route,
      next: 1,
      detail: { inputPath, kind: file.kind, soPhan: pdf?.soPhan ?? 1 },
    };
  }

  const r = await convert({
    documentId: doc.id,
    sourceRecordId: file.sourceRecordId,
    fileUri: file.uri,
    kind: file.kind,
    enqueueParse: false, // job `parse` được đẩy qua BullMQ ngay dưới đây
  });
  await ctx.progress(80, "đã có Markdown");

  await add(
    QUEUES.parse,
    { ...(runId ? { runId } : {}), documentUrn, ...(r.markdownUri ? { markdownPath: r.markdownUri } : {}) },
    { key: `${runId ?? "adhoc"}:${documentUrn}` },
  );

  return {
    documentId: doc.id,
    documentUrn,
    route: r.route,
    next: 1,
    ...(r.warnings.length ? { warnings: r.warnings } : {}),
    detail: { markdownUri: r.markdownUri, bytes: r.markdown?.length ?? 0, ...(r.stats ?? {}) },
  };
});
