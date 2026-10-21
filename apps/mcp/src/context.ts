/**
 * Tiện ích dùng chung cho các công cụ MCP: phân giải cách người dùng gọi tên văn bản,
 * chuẩn hóa ngày, và định dạng kết quả cho mô hình đọc.
 */
import { sql } from "@qdpl/db";
import {
  buildUrn,
  docTypeByCode,
  inferDocType,
  normalizeSoKyHieu,
  parseUrn,
  refineDocTypeByTitle,
} from "@qdpl/legal-model";

/**
 * Chuẩn hóa giá trị ngày từ Postgres về YYYY-MM-DD.
 * postgres.js trả cột `date` dưới dạng đối tượng Date; nếu ép chuỗi trực tiếp sẽ ra
 * "Tue Jan 20 2026 ..." và cắt 10 ký tự đầu cho ra "Tue Jan 20" — sai hoàn toàn,
 * và làm hỏng mọi phép so sánh ngày dạng chuỗi (ví dụ đối chiếu thứ bậc hiệu lực).
 */
export function isoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Ngày hôm nay theo múi giờ Việt Nam, dạng YYYY-MM-DD. */
export function today(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function normalizeAsOf(asOf?: string): string {
  if (!asOf) return today();
  const s = asOf.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  throw new Error(`Ngày không hợp lệ: "${asOf}". Dùng dạng YYYY-MM-DD hoặc DD/MM/YYYY.`);
}

export interface ResolvedDoc {
  id: string;
  urn: string;
  soKyHieu: string;
  docType: string;
  title: string;
  shortTitle: string;
  issuer: string | null;
  issuedDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: string;
  rank: number;
}

/**
 * Nhận diện văn bản từ nhiều cách gọi: URN đầy đủ, số ký hiệu ("45/2026/NĐ-CP"),
 * hoặc tên gần đúng ("Nghị định 45/2026"). Trả về gợi ý khi không chắc chắn thay vì đoán bừa.
 */
export async function resolveDocument(
  ref: string,
): Promise<{ doc?: ResolvedDoc; candidates: ResolvedDoc[] }> {
  const input = ref.trim();
  const rows = async (where: ReturnType<typeof sql>) =>
    (await where) as unknown as Array<Record<string, any>>;

  const toDoc = (r: Record<string, any>): ResolvedDoc => ({
    id: r.id,
    urn: r.urn,
    soKyHieu: r.so_ky_hieu,
    docType: r.doc_type,
    title: r.title,
    shortTitle: r.short_title,
    issuer: r.issuer_name ?? null,
    issuedDate: isoDate(r.issued_date),
    effectiveFrom: isoDate(r.effective_from),
    effectiveTo: isoDate(r.effective_to),
    status: r.status,
    rank: r.rank,
  });

  // 1) URN đầy đủ
  const parsed = parseUrn(input);
  if (parsed) {
    const docUrn = input.split("#")[0]!.split("@")[0]!;
    const r = await rows(sql`SELECT * FROM documents WHERE urn = ${docUrn} LIMIT 1`);
    if (r[0]) return { doc: toDoc(r[0]), candidates: [] };
  }

  // 2) Số ký hiệu chính xác
  const sk = normalizeSoKyHieu(
    input.replace(/^(nghị định|thông tư|luật|bộ luật|pháp lệnh|quyết định|nghị quyết)\s+/i, ""),
  );
  if (/^\d+\/\d{4}/.test(sk)) {
    const r = await rows(sql`SELECT * FROM documents WHERE so_ky_hieu = ${sk} LIMIT 5`);
    if (r.length === 1) return { doc: toDoc(r[0]!), candidates: [] };
    if (r.length > 1) return { candidates: r.map(toDoc) };
    // Thiếu hậu tố: khớp theo tiền tố "45/2026/"
    const r2 = await rows(sql`SELECT * FROM documents WHERE so_ky_hieu LIKE ${`${sk}/%`} LIMIT 5`);
    if (r2.length === 1) return { doc: toDoc(r2[0]!), candidates: [] };
    if (r2.length > 1) return { candidates: r2.map(toDoc) };
  }

  // 3) Tìm gần đúng theo tên hoặc số ký hiệu
  const r3 = await rows(sql`
    SELECT *, GREATEST(similarity(so_ky_hieu, ${input}), similarity(title, ${input})) AS sim
    FROM documents
    WHERE so_ky_hieu ILIKE ${`%${input}%`} OR title ILIKE ${`%${input}%`}
       OR similarity(title, ${input}) > 0.25
    ORDER BY sim DESC LIMIT 5`);
  if (r3.length === 1) return { doc: toDoc(r3[0]!), candidates: [] };
  return { candidates: r3.map(toDoc) };
}

/** Lỗi có thông điệp hướng dẫn, dùng để trả về cho mô hình thay vì ném stack trace. */
export class ToolError extends Error {}

export async function mustResolve(ref: string): Promise<ResolvedDoc> {
  const { doc, candidates } = await resolveDocument(ref);
  if (doc) return doc;
  if (!candidates.length) {
    throw new ToolError(
      `Không tìm thấy văn bản nào khớp "${ref}". Kiểm tra lại số ký hiệu, hoặc dùng công cụ tim_kiem_quy_dinh để tìm trước.`,
    );
  }
  const list = candidates.map((c) => `  - ${c.soKyHieu} — ${c.shortTitle} (URN: ${c.urn})`).join("\n");
  throw new ToolError(`"${ref}" khớp nhiều văn bản, hãy chỉ rõ bằng URN:\n${list}`);
}

/** Tên loại văn bản tiếng Việt. */
export function docTypeName(code: string): string {
  return docTypeByCode(code)?.name ?? code;
}

/** Suy URN từ số ký hiệu và tên, dùng khi nạp văn bản mới. */
export function urnFor(soKyHieu: string, title: string): string {
  const sk = normalizeSoKyHieu(soKyHieu);
  const docType = refineDocTypeByTitle(inferDocType(sk), title) ?? "cv";
  return buildUrn({ docType, soKyHieu: sk });
}

/** Nhãn trạng thái hiệu lực để hiển thị. */
export const STATUS_LABEL: Record<string, string> = {
  chua_hieu_luc: "Chưa có hiệu lực",
  con_hieu_luc: "Còn hiệu lực",
  het_hieu_luc_mot_phan: "Hết hiệu lực một phần",
  het_hieu_luc: "Hết hiệu lực",
  ngung_hieu_luc: "Ngưng hiệu lực",
  khong_xac_dinh: "Chưa xác định",
};

/** Bọc kết quả thành nội dung MCP: văn bản cho người/mô hình đọc + dữ liệu có cấu trúc. */
export function result(text: string, structured?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function errorResult(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Lỗi: ${msg}` }], isError: true as const };
}
