/**
 * Văn bản dài trên Công báo được đăng thành NHIỀU KỲ, mỗi kỳ một tệp (ví dụ Luật 36/2024/QH15:
 * "2024_977 + 978_36-2024-QH15.pdf" và "2024_979 + 980_36-2024-QH15.pdf"). Kho lưu đủ các tệp,
 * nhưng việc số hóa chỉ đọc MỘT tệp nên bản Markdown chỉ có phần đầu (23/89 điều) — lỗi phát
 * hiện ngày 08/9/2026 trên 25 văn bản, trong đó có các nghị định 168, 165, 158/2024/NĐ-CP.
 *
 * Mô-đun này gom các phần PDF của cùng một bản ghi nguồn, sắp theo số Công báo, ghép thành một
 * tệp `derived/{documentId}/so-hoa/goc-ghep.pdf` và trả về tệp đó cho việc số hóa.
 */
import { sql } from "@qdpl/db";
import { ghepPdf } from "@qdpl/sohoa";
import { getObject, objectExists, putObject } from "@qdpl/storage";
import { log } from "../log.ts";
import { getSourceRecord, type SourceRecordRow } from "./ingest.ts";

export interface PhanPdf {
  uri: string;
  /** Tên tệp ở nguồn, ví dụ "2024_977 + 978_36-2024-QH15.pdf". */
  ten: string;
  /** Số Công báo (kỳ) đọc từ tên tệp; phần không đọc được xếp sau cùng theo thứ tự gốc. */
  thuTu: number;
}

/** "2024_977 + 978_36-2024-QH15.pdf" -> 977. Tên không theo mẫu Công báo thì không xác định. */
export function thuTuPhan(ten: string): number | undefined {
  const m = /^\s*(\d{4})_(\d+)/.exec(ten);
  return m ? Number(m[2]) : undefined;
}

/** Tên tệp từ URL tải của Công báo (`…&file_name=2024_977+%2b+978_…pdf`) hoặc từ đường dẫn. */
export function tenTepTuUrl(url: string): string {
  try {
    const u = new URL(url);
    const fn = u.searchParams.get("file_name");
    if (fn) return fn;
    return decodeURIComponent(u.pathname.split("/").pop() ?? "");
  } catch {
    return url.split("/").pop() ?? url;
  }
}

interface StoredFile {
  kind?: string;
  url?: string;
  uri?: string;
}

/** Các phần PDF của một bản ghi nguồn, đã sắp theo kỳ Công báo. */
export function cacPhanPdf(rec: SourceRecordRow): PhanPdf[] {
  const md = (rec.metadata ?? {}) as {
    storedFiles?: StoredFile[];
    files?: { url?: string; fileName?: string }[];
  };
  const stored = Array.isArray(md.storedFiles) ? md.storedFiles : [];
  const nguon = Array.isArray(md.files) ? md.files : [];
  const phan = stored
    .filter((f) => f.kind === "pdf" && f.uri)
    .map((f, i) => {
      const ten = nguon.find((n) => n.url && n.url === f.url)?.fileName ?? tenTepTuUrl(f.url ?? "");
      return {
        uri: f.uri as string,
        ten,
        thuTu: thuTuPhan(ten) ?? Number.MAX_SAFE_INTEGER - stored.length + i,
      };
    });
  phan.sort((a, b) => a.thuTu - b.thuTu);
  if (!phan.length && rec.file_uri?.toLowerCase().endsWith(".pdf")) {
    phan.push({ uri: rec.file_uri, ten: rec.file_uri.split("/").pop() ?? rec.file_uri, thuTu: 0 });
  }
  return phan;
}

export function uriPdfGhep(documentId: string): string {
  return `derived/${documentId}/so-hoa/goc-ghep.pdf`;
}

export interface PdfSoHoa {
  uri: string;
  soPhan: number;
  sourceRecordId: string;
  cacPhan: PhanPdf[];
}

async function banGhiCoPdf(
  documentId: string,
  sourceRecordId?: string,
): Promise<SourceRecordRow | undefined> {
  if (sourceRecordId) {
    const rec = await getSourceRecord(sourceRecordId);
    if (rec && cacPhanPdf(rec).length) return rec;
  }
  const rows = await sql`
    SELECT * FROM source_records
    WHERE document_id = ${documentId} AND file_uri IS NOT NULL
    ORDER BY fetched_at DESC`;
  for (const rec of rows as unknown as SourceRecordRow[]) {
    if (cacPhanPdf(rec).length) return rec;
  }
  return undefined;
}

/**
 * Tệp PDF để số hóa một văn bản: một phần thì trả thẳng tệp đó; nhiều phần thì ghép (một lần,
 * lần sau dùng lại tệp đã ghép) và trả về tệp ghép.
 */
export async function chuanBiPdfSoHoa(
  documentId: string,
  sourceRecordId?: string,
): Promise<PdfSoHoa | undefined> {
  const rec = await banGhiCoPdf(documentId, sourceRecordId);
  if (!rec) return undefined;
  const cacPhan = cacPhanPdf(rec);
  if (cacPhan.length === 1) {
    return { uri: cacPhan[0]!.uri, soPhan: 1, sourceRecordId: rec.id, cacPhan };
  }
  const uri = uriPdfGhep(documentId);
  if (!(await objectExists(uri))) {
    const bytes: Uint8Array[] = [];
    for (const p of cacPhan) bytes.push(await getObject(p.uri));
    const ghep = await ghepPdf(bytes);
    await putObject(uri, ghep, { contentType: "application/pdf" });
    log.info("Đã ghép các phần PDF của văn bản để số hóa", {
      documentId,
      soPhan: cacPhan.length,
      thuTu: cacPhan.map((p) => p.ten),
      uri,
      bytes: ghep.byteLength,
    });
  }
  return { uri, soPhan: cacPhan.length, sourceRecordId: rec.id, cacPhan };
}
