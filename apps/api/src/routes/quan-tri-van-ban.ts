/**
 * Quản lý kho văn bản trong trang quản trị, gắn ở /v1/quan-tri/van-ban.
 *
 * Nội dung văn bản là Markdown của phiên bản gốc (`document_versions.kind = 'original'`). Lưu là
 * phân tích lại Markdown thành cây Phần/Chương/Điều/khoản rồi ghi đè phiên bản gốc bằng
 * `saveVersion`, giống bước parse của pipeline, nên Markdown, cây và bảng `nodes` luôn khớp nhau.
 * Nội dung theo thời điểm vẫn dựng từ phiên bản gốc cộng lệnh sửa đổi đã duyệt (content.ts), nên
 * ở đây chỉ sửa phiên bản gốc: luật thay đổi thì nạp văn bản sửa đổi, không sửa tay văn bản gốc.
 *
 * Định danh (loại, số ký hiệu, địa phương) quyết định URN mà câu hỏi, bài giảng, dữ liệu tra cứu
 * trỏ tới, nên chỉ đặt khi tạo. Sai định danh thì xóa rồi tạo lại.
 *
 * Quyền: biên tập viên xem, thêm, sửa; xóa cần quản trị viên. Mọi thay đổi ghi audit_log.
 */

import {
  type AuthoringJobRow,
  batDauViecSoanBai,
  type DocumentRow,
  getDocumentByUrn,
  getStatusAsOf,
  ketThucViecSoanBai,
  saveVersion,
  sql,
  taoViecSoanBai,
  vieCSoanBaiTheoId,
} from "@qdpl/db";
import {
  buildUrn,
  DOC_TYPES,
  type DocStatus,
  docTypeByCode,
  inferDocType,
  type LegalNode,
  normalizeSoKyHieu,
  parseDocument,
  walk,
} from "@qdpl/legal-model";
import { isMock } from "@qdpl/llm";
import { derivedMarkdownKey, getObject, objectExists, putObject, putText } from "@qdpl/storage";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocVaiTro, ghiNhatKy } from "../auth.ts";
import { chayNen } from "../chay-soan-bai.ts";
import { contentAsOf } from "../content.ts";
import { coBanDaDoc, docHoacLayBanDaDoc, soTrangQuetToiDa } from "../doc-pdf-quet.ts";
import {
  asDate,
  badRequest,
  conflict,
  decodeUrnParam,
  notFound,
  parseBody,
  parseQuery,
  today,
} from "../http.ts";
import { DOC_STATUS_LABELS } from "../labels.ts";
import { shapeDocument } from "./documents.ts";

export const quanTriVanBanRoute = new Hono();

const TRANG_THAI = [
  "chua_hieu_luc",
  "con_hieu_luc",
  "het_hieu_luc_mot_phan",
  "het_hieu_luc",
  "ngung_hieu_luc",
  "khong_xac_dinh",
] as const satisfies readonly DocStatus[];

const ngay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
  .nullish();

/** Văn bản dài nhất trong kho cỡ vài MB Markdown; chặn trên để một lần gửi không làm nghẽn API. */
const markdownCoTheTrong = z.string().max(5_000_000, "Nội dung quá dài (tối đa 5 triệu ký tự).");
const NOI_DUNG_TRONG = "Nội dung văn bản đang trống.";
const markdown = markdownCoTheTrong.refine((s) => s.trim().length > 0, NOI_DUNG_TRONG);

/**
 * Tệp PDF gốc của bản quét, cất ở POST /tu-pdf. Tên theo hash nội dung nên nạp lại cùng tệp không
 * sinh tệp mới, và người gọi không trỏ được tới tệp khác trong kho.
 */
const TEP_GOC = /^van-ban-goc\/[0-9a-f]{16}\.pdf$/;

async function luuTepGoc(bytes: Uint8Array): Promise<string> {
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex").slice(0, 16);
  const uri = `van-ban-goc/${hash}.pdf`;
  await putObject(uri, bytes, { contentType: "application/pdf" });
  return uri;
}

/** Số trang của tệp gốc đã cất, ghi kèm văn bản để trang đọc hiện từng trang trên điện thoại. */
async function soTrangTepGoc(uri: string): Promise<number> {
  if (!(await objectExists(uri))) throw badRequest("Không còn tệp PDF đã nạp trong kho. Hãy chọn lại tệp.");
  const { soTrangPdf } = await import("@qdpl/sohoa");
  return soTrangPdf(await getObject(uri));
}

const thuocTinh = z.object({
  title: z.string().trim().min(5, "Tên văn bản cần ít nhất 5 ký tự.").max(1000),
  issuer: z.string().trim().max(300).nullish(),
  signer: z.string().trim().max(200).nullish(),
  issuedDate: ngay,
  effectiveFrom: ngay,
  effectiveTo: ngay,
  /** Bỏ trống là tự tính theo ngày hiệu lực. */
  status: z.enum(TRANG_THAI).nullish(),
  summary: z.string().trim().max(5000).nullish(),
  fields: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  /** Trống được khi văn bản là bản quét chỉ có tệp gốc (`tepGoc`). */
  markdown: markdownCoTheTrong,
  tepGoc: z.string().regex(TEP_GOC, "Tệp gốc không hợp lệ.").nullish(),
});

const ngayHopLe = [
  (d: { effectiveFrom?: string | null; effectiveTo?: string | null }) =>
    !d.effectiveFrom || !d.effectiveTo || d.effectiveFrom < d.effectiveTo,
  "Ngày hết hiệu lực phải sau ngày có hiệu lực.",
] as const;

const taoMoiSchema = thuocTinh
  .extend({
    docType: z.string().refine((c) => Boolean(docTypeByCode(c)), "Loại văn bản không có trong danh mục."),
    soKyHieu: z.string().trim().min(1, "Thiếu số ký hiệu.").max(100),
    locality: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, "Mã địa phương chỉ gồm chữ thường không dấu, số và dấu gạch ngang.")
      .nullish()
      .or(z.literal("").transform(() => null)),
  })
  .refine(...ngayHopLe);

const suaSchema = thuocTinh.refine(...ngayHopLe);

const xemTruocSchema = z.object({ markdown });

const danhSachSchema = z.object({
  q: z.string().trim().max(200).optional(),
  docType: z.string().trim().max(20).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Trạng thái suy từ ngày hiệu lực, cùng quy tắc với bước nạp (workers-ts/pipeline/ingest.ts). */
function trangThaiTheoNgay(d: { effectiveFrom?: string | null; effectiveTo?: string | null }): DocStatus {
  const homNay = today();
  if (d.effectiveTo && d.effectiveTo <= homNay) return "het_hieu_luc";
  if (d.effectiveFrom && d.effectiveFrom > homNay) return "chua_hieu_luc";
  if (d.effectiveFrom) return "con_hieu_luc";
  return "khong_xac_dinh";
}

/** Văn bản sửa đổi, bãi bỏ: cùng dấu hiệu với workers-ts/pipeline/parse.ts. */
function laVanBanSuaDoi(title: string, root: LegalNode): boolean {
  const t = title.toLowerCase();
  if (/sửa đổi,?\s*bổ sung/.test(t)) return true;
  if (/^\s*(luật|nghị định|thông tư|quyết định|nghị quyết|pháp lệnh)?\s*bãi bỏ(?=\s|$)/.test(t)) return true;
  let co = false;
  walk(root, (n) => {
    if (co || n.kind !== "dieu") return;
    const h = `${n.heading ?? ""} ${n.text}`.toLowerCase();
    if (
      /(sửa đổi,?\s*bổ sung|bãi bỏ|thay thế cụm từ|ngưng hiệu lực)/.test(h) &&
      /(điều|khoản|điểm|nghị định|luật|thông tư|quyết định)/.test(h)
    ) {
      co = true;
    }
  });
  return co;
}

const KIEU_MUC_LUC = new Set(["phan", "chuong", "muc", "tieu_muc", "dieu", "phu_luc"]);

/** Phân tích Markdown và tóm tắt cho người biên tập: số nút, cảnh báo, mục lục tới mức Điều. */
function phanTich(md: string) {
  const parsed = parseDocument(md);
  const mucLuc: Array<{
    kind: string;
    label: string;
    heading: string | null;
    depth: number;
    soKhoan: number;
  }> = [];
  let soNut = 0;
  walk(parsed.root, (n) => {
    if (n.kind === "van_ban") return;
    soNut += 1;
    if (!KIEU_MUC_LUC.has(n.kind) || mucLuc.length >= 3000) return;
    mucLuc.push({
      kind: n.kind,
      label: n.label,
      heading: n.heading ?? null,
      depth: n.fullPath ? n.fullPath.split(".").length - 1 : 0,
      soKhoan: n.children.filter((c) => c.kind === "khoan").length,
    });
  });
  return {
    parsed,
    tomTat: {
      soNut,
      dem: parsed.counts,
      canhBao: parsed.warnings.map((w) => ({ kind: w.kind, message: w.message, path: w.path ?? null })),
      mucLuc,
    },
  };
}

/** Mã tình trạng việc xếp hàng sau khi lưu, để giao diện nói rõ phần nào cập nhật ngay, phần nào chờ worker. */
type HangDoi = "da_xep" | "khong_co_redis" | "loi";

/**
 * Xếp các bước sau phân tích lên BullMQ như worker parse (bull/workers/parse.ts): quan hệ, chỉ
 * mục ngữ nghĩa, trích lệnh sửa đổi, và hợp nhất lại nếu có lệnh sửa đổi nhắm vào văn bản này.
 * Thiếu Redis hoặc quá 3 giây thì bỏ qua: nội dung đã lưu, tìm kiếm theo chữ dùng được ngay.
 */
async function xepViecSauLuu(urn: string, suaDoi: boolean, coLenhNhamVao: boolean): Promise<HangDoi> {
  try {
    const { add, hasRedis, QUEUES } = await import("@qdpl/queue");
    if (!hasRedis()) return "khong_co_redis";
    const key = `quan-tri:${urn}:${Date.now()}`;
    const viec = [
      add(QUEUES.relations, { documentUrn: urn }, { key }),
      add(QUEUES.index, { documentUrn: urn }, { key }),
      ...(suaDoi ? [add(QUEUES.extractOps, { documentUrn: urn }, { key, priority: 3 })] : []),
      ...(coLenhNhamVao ? [add(QUEUES.consolidate, { documentUrn: urn }, { key, priority: 2 })] : []),
    ];
    const xong = await Promise.race([
      Promise.all(viec).then(() => true),
      new Promise<false>((r) => setTimeout(() => r(false), 3000)),
    ]);
    return xong ? "da_xep" : "loi";
  } catch (err) {
    console.error("[api] không xếp được việc sau khi lưu văn bản:", err);
    return "loi";
  }
}

/**
 * Ghi Markdown thành phiên bản gốc. Văn bản đã có phiên bản gốc thì ghi đè đúng số phiên bản đó và
 * giữ nguyên khoảng hiệu lực (valid_to do bước hợp nhất đặt khi có phiên bản sau).
 */
async function luuPhienBanGoc(
  doc: DocumentRow,
  md: string,
  parsed: ReturnType<typeof parseDocument>,
  nguoiSua: string,
): Promise<{ versionNo: number }> {
  const [goc] = (await sql`
    SELECT id, version_no, valid_to FROM document_versions
    WHERE document_id = ${doc.id} AND kind = 'original'
    ORDER BY version_no LIMIT 1`) as Array<{ id: string; version_no: number; valid_to: unknown }>;
  let versionNo = goc?.version_no;
  if (versionNo === undefined) {
    const [m] = (await sql`
      SELECT COALESCE(max(version_no), 0)::int AS n FROM document_versions WHERE document_id = ${doc.id}`) as Array<{
      n: number;
    }>;
    versionNo = (m?.n ?? 0) + 1;
  }
  // saveVersion xóa rồi ghi lại dòng phiên bản; cột basis_version_id không có ON DELETE nên gỡ trước.
  if (goc) await sql`UPDATE document_versions SET basis_version_id = NULL WHERE basis_version_id = ${goc.id}`;

  const versionId = await saveVersion({
    documentId: doc.id,
    versionNo,
    kind: "original",
    validFrom: doc.effective_from ?? doc.issued_date ?? today(),
    validTo: goc ? asDate(goc.valid_to) : null,
    root: parsed.root,
    markdown: md,
    docTitle: doc.short_title || doc.title,
    quality: {
      counts: parsed.counts,
      warnings: parsed.warnings.length,
    },
    provenance: { step: "quan-tri", by: nguoiSua, at: new Date().toISOString() },
    docEffectiveFrom: doc.effective_from,
    docEffectiveTo: doc.effective_to,
  });

  // CSDL là nguồn sự thật; bản sao trên kho đối tượng hỏng thì chỉ ghi log (như pipeline/parse.ts).
  const uri = derivedMarkdownKey(doc.id, versionNo);
  try {
    await putText(uri, md);
    await sql`UPDATE document_versions SET markdown_uri = ${uri} WHERE id = ${versionId}`;
  } catch (err) {
    console.error("[api] không ghi được bản sao Markdown lên kho đối tượng:", err);
  }
  return { versionNo };
}

async function demLenhNhamVao(urn: string): Promise<number> {
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM amendment_ops
    WHERE target_doc_urn = ${urn} AND amending_doc_urn <> ${urn}`) as Array<{ n: number }>;
  return r?.n ?? 0;
}

/** Tách Markdown, ghi thành phiên bản gốc của văn bản rồi xếp các bước sau lưu. */
async function luuNoiDung(doc: DocumentRow, md: string, nguoiSua: string) {
  const { parsed, tomTat } = phanTich(md);
  await luuPhienBanGoc(doc, md, parsed, nguoiSua);
  const suaDoi = laVanBanSuaDoi(doc.title, parsed.root);
  const hangDoi = await xepViecSauLuu(doc.urn, suaDoi, (await demLenhNhamVao(doc.urn)) > 0);
  return { tomTat, suaDoi, hangDoi };
}

/** Cột text trỏ tới văn bản, hoặc tới một nút (`urn#...`), hoặc theo thời điểm (`urn@...`). */
function khopUrn(cot: string, urn: string) {
  return sql`(${sql(cot)} = ${urn} OR starts_with(${sql(cot)}, ${`${urn}#`}) OR starts_with(${sql(cot)}, ${`${urn}@`}))`;
}

/** Cột mảng căn cứ (`citations text[]`) có phần tử trỏ tới văn bản. */
function mangKhopUrn(cot: string, urn: string) {
  return sql`EXISTS (SELECT 1 FROM unnest(${sql(cot)}) AS c WHERE ${khopUrn("c", urn)})`;
}

/**
 * Những nơi đang trỏ tới văn bản. Xóa văn bản thì các căn cứ này gãy, nên API chặn xóa cho tới
 * khi người dùng xác nhận đã xem danh sách.
 */
async function thamChieu(urn: string): Promise<Array<{ loai: string; nhan: string; so: number }>> {
  const [r] = (await sql`
    SELECT
      (SELECT count(*)::int FROM questions WHERE ${mangKhopUrn("citations", urn)}) AS cau_hoi,
      (SELECT count(*)::int FROM lesson_blocks WHERE ${mangKhopUrn("citations", urn)}) AS khoi_bai,
      (SELECT count(*)::int FROM activities WHERE ${mangKhopUrn("citations", urn)}) AS hoat_dong,
      (SELECT count(*)::int FROM citations WHERE ${khopUrn("node_urn", urn)}) AS vien_dan,
      (SELECT count(*)::int FROM violations WHERE ${khopUrn("citation_urn", urn)}) AS muc_phat,
      (SELECT count(*)::int FROM traffic_signs WHERE ${khopUrn("citation_urn", urn)}) AS bien_bao,
      (SELECT count(*)::int FROM speed_limits WHERE ${khopUrn("citation_urn", urn)}) AS toc_do,
      (SELECT count(*)::int FROM document_rules WHERE ${khopUrn("citation_urn", urn)}) AS giay_to,
      (SELECT count(*)::int FROM load_limits WHERE ${khopUrn("citation_urn", urn)}) AS tai_trong,
      (SELECT count(*)::int FROM procedures
        WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(steps) AS s(b)
                      WHERE s.b->>'can_cu' = ${urn} OR starts_with(s.b->>'can_cu', ${`${urn}#`})
                         OR starts_with(s.b->>'can_cu', ${`${urn}@`}))) AS quy_trinh,
      (SELECT count(*)::int FROM amendment_ops
        WHERE target_doc_urn = ${urn} AND amending_doc_urn <> ${urn}) AS lenh_sua_doi,
      (SELECT count(*)::int FROM relations
        WHERE ${khopUrn("to_urn", urn)} AND NOT ${khopUrn("from_urn", urn)}) AS quan_he`) as Array<
    Record<string, number>
  >;
  const NHAN: Array<[string, string]> = [
    ["cau_hoi", "Câu hỏi trong ngân hàng câu hỏi"],
    ["khoi_bai", "Khối nội dung bài giảng"],
    ["hoat_dong", "Hoạt động trong bài học"],
    ["vien_dan", "Viện dẫn trong nội dung biên tập"],
    ["muc_phat", "Mức phạt (tra cứu nhanh)"],
    ["bien_bao", "Biển báo"],
    ["toc_do", "Tốc độ tối đa"],
    ["giay_to", "Luật kiểm tra giấy tờ"],
    ["tai_trong", "Giới hạn tải trọng"],
    ["quy_trinh", "Bước trong quy trình"],
    ["lenh_sua_doi", "Lệnh sửa đổi từ văn bản khác"],
    ["quan_he", "Quan hệ từ văn bản khác"],
  ];
  return NHAN.map(([loai, nhan]) => ({ loai, nhan, so: Number(r?.[loai] ?? 0) })).filter((x) => x.so > 0);
}

/** Danh mục loại văn bản cho biểu mẫu tạo mới. */
quanTriVanBanRoute.get("/loai", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  return c.json({
    items: DOC_TYPES.map((t) => ({ code: t.code, name: t.name, isNormative: t.isNormative })),
    trangThai: TRANG_THAI.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s] ?? s })),
  });
});

/** Danh sách văn bản trong kho, mới sửa trước. */
quanTriVanBanRoute.get("/", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const p = parseQuery(c, danhSachSchema);
  const q = p.q || null;
  const docType = p.docType || null;
  const where = sql`
        (${q}::text IS NULL
         OR d.so_ky_hieu ILIKE '%' || ${q}::text || '%'
         OR unaccent(d.title) ILIKE '%' || unaccent(${q}::text) || '%')
    AND (${docType}::text IS NULL OR d.doc_type = ${docType}::text)`;
  const [rows, [tong]] = await Promise.all([
    sql`
      SELECT d.*, (v.id IS NOT NULL) AS co_noi_dung, v.provenance->>'step' AS nguon_noi_dung
      FROM documents d
      LEFT JOIN LATERAL (
        SELECT id, provenance FROM document_versions
        WHERE document_id = d.id AND kind = 'original' ORDER BY version_no LIMIT 1
      ) v ON true
      WHERE ${where}
      ORDER BY d.updated_at DESC, d.so_ky_hieu
      LIMIT ${p.limit} OFFSET ${(p.page - 1) * p.limit}`,
    sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM documents d WHERE ${where}`,
  ]);
  const total = Number(tong?.n ?? 0);
  // Cùng hàm với danh sách tra cứu và trang đọc, để ba nơi ghi một trạng thái hiệu lực.
  const homNay = today();
  const trangThai = await Promise.all(rows.map((r) => getStatusAsOf(String(r.id), homNay)));
  return c.json({
    total,
    page: p.page,
    pages: Math.max(1, Math.ceil(total / p.limit)),
    items: rows.map((r, i) => {
      const row = r as Record<string, unknown>;
      return {
        ...shapeDocument(row, trangThai[i]),
        updatedAt: row.updated_at,
        primarySource: row.primary_source ?? null,
        coNoiDung: Boolean(row.co_noi_dung),
        coTepGoc: Boolean(row.original_file_uri),
        suaTrongQuanTri: row.nguon_noi_dung === "quan-tri",
      };
    }),
  });
});

/** Xem trước cấu trúc mà Markdown sẽ được tách thành, chưa ghi gì. */
quanTriVanBanRoute.post("/xem-truoc", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const body = await parseBody(c, xemTruocSchema);
  return c.json(phanTich(body.markdown).tomTat);
});

/** Nghị định dài kèm phụ lục trên Công báo cỡ 10–20 MB; lớn hơn gần như chắc chắn là nhầm tệp. */
const PDF_TOI_DA = 30 * 1024 * 1024;

/**
 * Nhận tệp PDF (form multipart, trường `tep`) cho biểu mẫu "Thêm văn bản": cất tệp vào kho làm tệp
 * gốc (`tepGoc`) và đoán thuộc tính từ trang đầu nếu PDF có lớp văn bản (`tuyen = "pdf_text"`); bản
 * quét không đoán được gì. Chưa ghi văn bản nào: người soạn soát thuộc tính rồi lưu qua POST / hoặc
 * PUT /:urn kèm `tepGoc`.
 *
 * Nội dung chữ không trích ở đây: văn bản nạp từ PDF hiện bằng tệp gốc cho tới khi biên tập viên
 * bấm "Đọc bằng AI" ở trang đọc (POST /:urn/doc-tep-goc).
 */
quanTriVanBanRoute.post("/tu-pdf", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const form = await c.req.raw.formData().catch(() => null);
  const bytes = await docTepPdf(form?.get("tep"));
  const kq = await nhapTuPdf(bytes);
  const { soKyHieu, docType } = kq.thuocTinh;
  // Trùng số ký hiệu với văn bản đã có: báo để người soạn mở văn bản đó thay vì tạo bản thứ hai.
  const trung =
    soKyHieu && docType
      ? await getDocumentByUrn(buildUrn({ docType, soKyHieu: normalizeSoKyHieu(soKyHieu) }))
      : null;
  return c.json({
    soTrang: kq.soTrang,
    tuyen: kq.tuyen,
    lyDo: kq.lyDo,
    thuocTinh: kq.thuocTinh,
    daCo: trung ? { urn: trung.urn, soKyHieu: trung.so_ky_hieu } : null,
    tepGoc: await luuTepGoc(bytes),
  });
});

/** Kiểm tệp gửi lên ở trường `tep` của form multipart rồi trả nội dung tệp. */
export async function docTepPdf(tep: unknown): Promise<Uint8Array> {
  if (!tep || typeof tep === "string") throw badRequest('Thiếu tệp PDF trong trường "tep".');
  const t = tep as File;
  if (t.size > PDF_TOI_DA) throw badRequest("Tệp quá lớn (tối đa 30 MB).");
  const bytes = new Uint8Array(await t.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw badRequest("Tệp không phải PDF. Tệp Word hãy lưu lại thành PDF rồi nạp.");
  }
  return bytes;
}

/**
 * Đọc lớp văn bản của PDF thành Markdown nháp và đoán thuộc tính từ trang đầu. Bản quét trả
 * `markdown: null`. Dùng chung cho biểu mẫu "Thêm văn bản" và luồng tạo chuyên đề từ PDF.
 */
export async function nhapTuPdf(bytes: Uint8Array) {
  // Nạp lười: bộ đọc PDF (MuPDF WASM) nặng, chỉ tải khi có người nạp PDF.
  const { danhGiaLopVanBan, doanThuocTinh, docTrangPdf, nhapTuLopVanBan, phatHienDongLap } = await import(
    "@qdpl/sohoa"
  );
  let trang: ReturnType<typeof docTrangPdf>;
  try {
    trang = docTrangPdf(bytes);
  } catch {
    throw badRequest("Không đọc được tệp PDF (tệp hỏng hoặc có mật khẩu).");
  }
  const danhGia = danhGiaLopVanBan(trang);
  const chung = { soTrang: danhGia.soTrang, tuyen: danhGia.tuyen, lyDo: danhGia.lyDo };
  if (danhGia.tuyen !== "pdf_text") return { ...chung, markdown: null, thuocTinh: {} as ThuocTinhTuPdf };

  // Không có agent đối chiếu lại bản in: giữ ô số trong bảng, chỉ bỏ số trang ở đầu và cuối trang.
  const md = nhapTuLopVanBan(trang, { dongLap: phatHienDongLap(trang), giuSoGiuaTrang: true });
  const doan = doanThuocTinh(trang);
  const docType = doan.soKyHieu ? inferDocType(doan.soKyHieu) : undefined;
  return {
    ...chung,
    markdown: md,
    thuocTinh: { ...doan, ...(docType ? { docType } : {}) } as ThuocTinhTuPdf,
  };
}

/** Thuộc tính đoán được từ PDF; trường nào không chắc thì vắng. */
export interface ThuocTinhTuPdf {
  soKyHieu?: string;
  docType?: string;
  title?: string;
  issuer?: string;
  issuedDate?: string;
  effectiveFrom?: string;
  signer?: string;
}

/** Thuộc tính, Markdown phiên bản gốc và các nơi đang trỏ tới văn bản. */
quanTriVanBanRoute.get("/:urn", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const urn = decodeUrnParam(c.req.param("urn"));
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw notFound(`Không tìm thấy văn bản có URN ${urn}`);
  const [goc] = (await sql`
    SELECT version_no, markdown, valid_from, valid_to, created_at, provenance
    FROM document_versions
    WHERE document_id = ${doc.id} AND kind = 'original'
    ORDER BY version_no LIMIT 1`) as Array<Record<string, any>>;
  const [dem] = (await sql`
    SELECT count(*)::int AS n FROM document_versions WHERE document_id = ${doc.id}`) as Array<{ n: number }>;
  return c.json({
    document: shapeDocument(doc as unknown as Record<string, unknown>),
    markdown: goc?.markdown ?? null,
    phienBanGoc: goc
      ? {
          versionNo: goc.version_no,
          validFrom: asDate(goc.valid_from),
          validTo: asDate(goc.valid_to),
          luuLuc: goc.created_at,
          nguon: goc.provenance?.step ?? null,
          nguoiSua: goc.provenance?.by ?? null,
        }
      : null,
    soPhienBan: dem?.n ?? 0,
    thamChieu: await thamChieu(urn),
    coTepGoc: Boolean(doc.original_file_uri),
  });
});

/** Thêm văn bản mới cùng nội dung Markdown. */
quanTriVanBanRoute.post("/", async (c) => {
  const nguoi = await batBuocVaiTro(c, "bien_tap");
  const b = await parseBody(c, taoMoiSchema);
  return c.json(await taoVanBanMoi(b, nguoi.email), 201);
});

export type VanBanMoi = z.infer<typeof taoMoiSchema>;

/**
 * Ghi văn bản mới cùng phiên bản gốc rồi xếp các bước sau lưu. Dùng chung cho biểu mẫu "Thêm văn
 * bản" và luồng tạo chuyên đề từ PDF. Trùng URN thì ném 409 kèm URN đang có.
 *
 * Bản quét (nội dung trống, có `tepGoc`) chỉ ghi thuộc tính và tệp gốc, không có phiên bản nội dung.
 */
export async function taoVanBanMoi(b: VanBanMoi, nguoiEmail: string) {
  const loai = docTypeByCode(b.docType)!;
  const soKyHieu = normalizeSoKyHieu(b.soKyHieu);
  const urn = buildUrn({ docType: b.docType, soKyHieu, ...(b.locality ? { locality: b.locality } : {}) });
  if (await getDocumentByUrn(urn)) {
    throw conflict(`Văn bản ${loai.name} số ${soKyHieu} đã có trong kho. Hãy mở văn bản đó để sửa.`, { urn });
  }
  const coNoiDung = b.markdown.trim().length > 0;
  if (!coNoiDung && !b.tepGoc) throw badRequest(NOI_DUNG_TRONG);
  const soTrang = b.tepGoc ? await soTrangTepGoc(b.tepGoc) : null;
  // Phân tích trước khi ghi: Markdown lỗi thì không để lại văn bản rỗng.
  const { parsed, tomTat } = phanTich(b.markdown);

  const [row] = (await sql`
    INSERT INTO documents (urn, doc_type, rank, is_normative, so_ky_hieu, locality, title, short_title,
                           issuer_name, signer, issued_date, effective_from, effective_to, fields,
                           status, summary, primary_source, original_file_uri, original_file_pages,
                           updated_at)
    VALUES (${urn}, ${b.docType}, ${loai.rank}, ${loai.isNormative}, ${soKyHieu}, ${b.locality ?? null},
            ${b.title}, ${`${loai.name} ${soKyHieu}`}, ${b.issuer || null}, ${b.signer || null},
            ${b.issuedDate || null}, ${b.effectiveFrom || null}, ${b.effectiveTo || null}, ${b.fields},
            ${b.status ?? trangThaiTheoNgay(b)}, ${b.summary || null}, 'quan-tri', ${b.tepGoc ?? null}, ${soTrang}, now())
    RETURNING *`) as any[];
  const doc = (await getDocumentByUrn(row.urn))!;
  if (!coNoiDung) {
    await ghiNhatKy(nguoiEmail, "van_ban.tao", urn, { tepGoc: b.tepGoc });
    return { urn, tomTat, laVanBanSuaDoi: false, hangDoi: null };
  }
  try {
    await luuPhienBanGoc(doc, b.markdown, parsed, nguoiEmail);
  } catch (err) {
    await sql`DELETE FROM documents WHERE id = ${doc.id}`;
    throw err;
  }

  const suaDoi = laVanBanSuaDoi(b.title, parsed.root);
  const hangDoi = await xepViecSauLuu(urn, suaDoi, (await demLenhNhamVao(urn)) > 0);
  await ghiNhatKy(nguoiEmail, "van_ban.tao", urn, { soNut: tomTat.soNut, hangDoi });
  return { urn, tomTat, laVanBanSuaDoi: suaDoi, hangDoi };
}

/** Lược đồ thuộc tính khi tạo văn bản, để luồng tạo từ PDF kiểm thuộc tính đoán được trước khi ghi. */
export const luocDoVanBanMoi = taoMoiSchema;

/** Sửa thuộc tính và nội dung. Nội dung không đổi thì không phân tích lại. */
quanTriVanBanRoute.put("/:urn", async (c) => {
  const nguoi = await batBuocVaiTro(c, "bien_tap");
  const urn = decodeUrnParam(c.req.param("urn"));
  const cu = await getDocumentByUrn(urn);
  if (!cu) throw notFound(`Không tìm thấy văn bản có URN ${urn}`);
  const b = await parseBody(c, suaSchema);
  const [goc] = (await sql`
    SELECT markdown FROM document_versions
    WHERE document_id = ${cu.id} AND kind = 'original' ORDER BY version_no LIMIT 1`) as Array<{
    markdown: string | null;
  }>;
  // Trống chỉ hợp lệ với bản quét chưa có nội dung chữ: đã có nội dung thì không xóa trắng qua đây.
  const coNoiDung = b.markdown.trim().length > 0;
  if (!coNoiDung && (goc || !(b.tepGoc || cu.original_file_uri))) throw badRequest(NOI_DUNG_TRONG);
  const soTrang = b.tepGoc ? await soTrangTepGoc(b.tepGoc) : null;

  await sql`
    UPDATE documents SET
      title = ${b.title}, issuer_name = ${b.issuer || null}, signer = ${b.signer || null},
      issued_date = ${b.issuedDate || null}, effective_from = ${b.effectiveFrom || null},
      effective_to = ${b.effectiveTo || null}, fields = ${b.fields},
      status = ${b.status ?? trangThaiTheoNgay(b)}, summary = ${b.summary || null},
      original_file_uri = COALESCE(${b.tepGoc ?? null}, original_file_uri),
      original_file_pages = COALESCE(${soTrang}, original_file_pages), updated_at = now()
    WHERE id = ${cu.id}`;
  const doc = (await getDocumentByUrn(urn))!;

  const doiNgay =
    cu.effective_from !== doc.effective_from ||
    cu.effective_to !== doc.effective_to ||
    cu.issued_date !== doc.issued_date;
  const doiNoiDung = coNoiDung && goc?.markdown !== b.markdown;

  let tomTat: ReturnType<typeof phanTich>["tomTat"] | null = null;
  let hangDoi: HangDoi | null = null;
  let suaDoi = false;
  // Đổi ngày hiệu lực cũng ghi lại phiên bản gốc: valid_from và trạng thái phiên bản tính từ các ngày đó.
  if (coNoiDung && (doiNoiDung || doiNgay)) {
    ({ tomTat, suaDoi, hangDoi } = await luuNoiDung(doc, b.markdown, nguoi.email));
  }
  await ghiNhatKy(nguoi.email, "van_ban.sua", urn, {
    doiNoiDung,
    doiNgay,
    ...(tomTat ? { soNut: tomTat.soNut } : {}),
    ...(hangDoi ? { hangDoi } : {}),
  });
  return c.json({ urn, doiNoiDung, tomTat, laVanBanSuaDoi: suaDoi, hangDoi });
});

/**
 * Xóa văn bản và mọi thứ sinh ra từ nó: phiên bản, nút, chỉ mục, quan hệ và lệnh sửa đổi do chính
 * văn bản này đặt ra. Giữ lại thứ do văn bản KHÁC sinh ra (lệnh sửa đổi nhắm vào, quan hệ trỏ tới):
 * nạp lại văn bản thì chúng tự nối lại. Tệp gốc trên kho đối tượng giữ nguyên để khôi phục được.
 * Còn nơi trỏ tới thì trả 409 kèm danh sách, trừ khi gọi với ?epBuoc=1.
 */
quanTriVanBanRoute.delete("/:urn", async (c) => {
  const nguoi = await batBuocVaiTro(c, "quan_tri");
  const urn = decodeUrnParam(c.req.param("urn"));
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw notFound(`Không tìm thấy văn bản có URN ${urn}`);
  const tc = await thamChieu(urn);
  if (tc.length > 0 && c.req.query("epBuoc") !== "1") {
    throw conflict("Văn bản đang được dùng ở nơi khác. Xem danh sách rồi xác nhận nếu vẫn muốn xóa.", {
      thamChieu: tc,
    });
  }
  await sql.begin(async (tx) => {
    await tx`DELETE FROM relations WHERE from_urn = ${urn} OR starts_with(from_urn, ${`${urn}#`})`;
    await tx`DELETE FROM amendment_ops WHERE amending_doc_urn = ${urn}`;
    await tx`
      UPDATE review_queue SET state = 'resolved', resolution = 'Văn bản đã bị xóa', resolved_at = now()
      WHERE document_urn = ${urn} AND state <> 'resolved'`;
    await tx`DELETE FROM documents WHERE id = ${doc.id}`;
  });
  await ghiNhatKy(nguoi.email, "van_ban.xoa", urn, {
    soKyHieu: doc.so_ky_hieu,
    title: doc.title,
    thamChieu: tc,
  });
  return c.json({ urn, daXoa: true });
});

/* ---- Đọc tệp gốc thành nội dung chữ: nút "Đọc bằng AI" ở trang đọc ---- */

/** Bước của việc đọc tệp gốc bản quét trong sổ `authoring_jobs`, cùng sổ với việc đọc PDF của chuyên đề. */
const BUOC_DOC_TEP_GOC = "doc_tep_goc";

/** Việc đọc tệp gốc gần nhất của một văn bản. */
async function viecDocTepGoc(urn: string): Promise<AuthoringJobRow | undefined> {
  const [v] = await sql<AuthoringJobRow[]>`
    SELECT * FROM authoring_jobs
    WHERE step = ${BUOC_DOC_TEP_GOC} AND input->>'urn' = ${urn}
    ORDER BY created_at DESC LIMIT 1`;
  return v;
}

async function coNoiDungGoc(documentId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM document_versions WHERE document_id = ${documentId} AND kind = 'original' LIMIT 1`;
  return rows.length > 0;
}

/** Chạy việc đọc bản quét: mô hình đọc từng cụm trang, rồi ghi kết quả thành nội dung gốc của văn bản. */
async function chayDocTepGoc(viecId: string): Promise<void> {
  const viec = await vieCSoanBaiTheoId(viecId);
  if (!viec || viec.step !== BUOC_DOC_TEP_GOC || viec.state === "xong") return;
  const inp = viec.input as { urn: string; file_uri: string };
  const nguoi = viec.requested_by ?? "ai";
  await batDauViecSoanBai(viec.id);
  try {
    const kq = await docHoacLayBanDaDoc(inp.file_uri, viec.id);
    const doc = await getDocumentByUrn(inp.urn);
    if (!doc) throw new Error("Văn bản đã bị xóa trong lúc đọc.");
    // Người soạn dán nội dung chữ trong lúc chờ thì giữ bản của họ.
    if (!(await coNoiDungGoc(doc.id))) {
      await luuNoiDung(doc, kq.markdown, nguoi);
      await ghiNhatKy(nguoi, "van_ban.doc_tep_goc", doc.urn, { ai: true, soChoKhongDoc: kq.soChoKhongDoc });
    }
    await ketThucViecSoanBai(viec.id, {
      output: { so_cum: kq.soCum, so_cho_khong_doc: kq.soChoKhongDoc, so_canh_bao: kq.soCanhBao },
      costUsd: kq.chiPhiUsd,
    });
  } catch (e) {
    await ketThucViecSoanBai(viec.id, { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/**
 * Đọc tệp PDF gốc của văn bản thành nội dung chữ, lưu chung cho mọi người đọc.
 *
 * PDF có lớp văn bản: lấy chữ sẵn có, không gọi mô hình, xong ngay (200, `dangDoc: false`).
 * Bản quét: mô hình đọc từng cụm trang, mất vài phút và tốn chi phí, nên chạy nền (202,
 * `dangDoc: true`); trang đọc hỏi tiến độ qua GET cùng đường dẫn. Việc lỗi thì gọi lại để chạy tiếp.
 */
quanTriVanBanRoute.post("/:urn/doc-tep-goc", async (c) => {
  const nguoi = await batBuocVaiTro(c, "bien_tap");
  const urn = decodeUrnParam(c.req.param("urn"));
  const doc = await getDocumentByUrn(urn);
  if (!doc) throw notFound(`Không tìm thấy văn bản có URN ${urn}`);
  const tepGoc = doc.original_file_uri;
  if (!tepGoc) throw badRequest("Văn bản này không có tệp PDF gốc để đọc.");
  if (await coNoiDungGoc(doc.id)) throw conflict("Văn bản đã có nội dung chữ.", { urn });
  const bytes = await getObject(tepGoc).catch(() => {
    throw notFound("Không còn tệp PDF gốc của văn bản này trong kho.");
  });
  const pdf = await nhapTuPdf(bytes);

  if (pdf.markdown !== null) {
    if (!pdf.markdown.trim()) throw badRequest("Không lấy được chữ nào từ tệp PDF này.");
    const kq = await luuNoiDung(doc, pdf.markdown, nguoi.email);
    await ghiNhatKy(nguoi.email, "van_ban.doc_tep_goc", urn, { ai: false, soNut: kq.tomTat.soNut });
    return c.json({ dangDoc: false, soTrang: pdf.soTrang });
  }

  if (isMock() && !(await coBanDaDoc(tepGoc))) {
    throw badRequest(
      "Tệp là bản quét (không có lớp chữ). Đọc bản quét cần mô hình AI, mà hệ thống chưa cấu hình ANTHROPIC_API_KEY.",
    );
  }
  if (pdf.soTrang > soTrangQuetToiDa()) {
    throw badRequest(
      `Bản quét dài ${pdf.soTrang} trang, vượt mức ${soTrangQuetToiDa()} trang của một lần đọc.`,
    );
  }
  const cu = await viecDocTepGoc(urn);
  const viec =
    cu && cu.state !== "xong"
      ? cu
      : await taoViecSoanBai({
          step: BUOC_DOC_TEP_GOC,
          input: { urn, file_uri: tepGoc, so_trang: pdf.soTrang },
          batch: false,
          requestedBy: nguoi.email,
        });
  // shortcut: chỉ biết việc đang chạy trong tiến trình này; chạy nhiều bản API thì chuyển sang hàng đợi.
  chayNen(viec.id, () => chayDocTepGoc(viec.id));
  return c.json({ dangDoc: true, soTrang: pdf.soTrang }, 202);
});

/** Tiến độ việc đọc bản quét, để trang đọc tự cập nhật. `state: null` khi chưa từng đọc. */
quanTriVanBanRoute.get("/:urn/doc-tep-goc", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const v = await viecDocTepGoc(decodeUrnParam(c.req.param("urn")));
  if (!v) return c.json({ state: null });
  const out = v.output as { cum_xong?: number; so_cum?: number };
  return c.json({
    state: v.state,
    error: v.error,
    cumXong: Number(out.cum_xong ?? 0),
    soCum: Number(out.so_cum ?? 0),
    soTrang: Number((v.input as { so_trang?: number }).so_trang ?? 0),
  });
});

/** Đối chiếu nhanh sau khi lưu: nội dung hôm nay có dựng được không (dùng cho kiểm thử, giao diện). */
quanTriVanBanRoute.get("/:urn/kiem-tra", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const urn = decodeUrnParam(c.req.param("urn"));
  const pit = await contentAsOf(urn, today());
  if (!pit.root.children.length) throw badRequest("Văn bản chưa có nội dung nào dựng được.");
  return c.json({
    urn,
    xungDot: pit.conflicts.map((x) => ({ op: x.op.op, targetPath: x.op.targetPath, reason: x.reason })),
  });
});
