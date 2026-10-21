/**
 * Truy vấn CSDL cho ngân hàng câu hỏi (docs/PLAN.md GĐ3).
 *
 * Tệp này chỉ đọc và ghi. Luật nghiệp vụ (hợp lệ theo loại, chuyển trạng thái, hệ quả của việc
 * sửa) nằm ở packages/dao-tao/src/cau-hoi.ts; lớp route gọi luật đó rồi truyền kết quả xuống
 * đây. Mọi thao tác đổi nội dung hay trạng thái đều ghi một dòng `question_reviews`.
 *
 * Hàm trả `CauHoiRow` có `answer`: chỉ dùng cho API quản trị. Phía người học (GĐ4, GĐ6) phải
 * đi qua `deChoNguoiHoc` của @qdpl/dao-tao.
 */

import { sql, type Tx } from "./client.ts";
import { docBangExcel, LoiTepExcel, taoTepExcel } from "./excel.ts";

export type TrangThaiCauHoiDb = "nhap" | "cho_duyet" | "da_duyet" | "tu_choi" | "luu_tru";

export interface ChuDeCauHoiRow {
  id: string;
  field_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  ordinal: number;
}

export interface ChuDeKemSoLieu extends ChuDeCauHoiRow {
  field_name: string | null;
  so_cau: number;
  so_da_duyet: number;
}

export interface CauHoiRow {
  id: string;
  code: string;
  topic_id: string | null;
  topic_code: string | null;
  topic_name: string | null;
  level: "de" | "trung_binh" | "kho";
  kind: "mot_dap_an" | "nhieu_dap_an" | "dung_sai" | "dien_khuyet" | "sap_xep" | "ghep_cap" | "tu_luan";
  stem: string;
  options: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string | null;
  citations: string[];
  /** Tiêu chí chấm của câu tự luận; `{}` với câu chấm máy. */
  rubric: Record<string, unknown>;
  image_uris: string[];
  status: TrangThaiCauHoiDb;
  source: "nguoi" | "ai" | "nhap_excel";
  version: number;
  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  reject_reason: string | null;
  offline_ok: boolean;
  /** Việc AI đã sinh câu này (GĐ8). */
  authoring_job_id: string | null;
  /** Câu đã có mà câu này gần giống, do hậu kiểm đánh dấu (GĐ8). */
  duplicate_of: string | null;
  duplicate_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LichSuDuyetRow {
  id: string;
  version: number;
  action: string;
  actor: string;
  note: string | null;
  created_at: Date;
}

/* ------------------------------------------------------------------ */
/* Chủ đề                                                              */
/* ------------------------------------------------------------------ */

/** Mọi chủ đề, kèm số câu và số câu đã duyệt của riêng chủ đề đó (không cộng dồn cây con). */
export async function danhSachChuDeCauHoi(): Promise<ChuDeKemSoLieu[]> {
  return await sql<ChuDeKemSoLieu[]>`
    SELECT t.*, f.name AS field_name,
           count(q.id) FILTER (WHERE q.status <> 'luu_tru')::int AS so_cau,
           count(q.id) FILTER (WHERE q.status = 'da_duyet')::int AS so_da_duyet
    FROM question_topics t
    LEFT JOIN fields f ON f.id = t.field_id
    LEFT JOIN questions q ON q.topic_id = t.id
    GROUP BY t.id, f.name
    ORDER BY f.name NULLS LAST, t.ordinal, t.name`;
}

export async function chuDeTheoMa(code: string): Promise<ChuDeCauHoiRow | undefined> {
  const [row] = await sql<ChuDeCauHoiRow[]>`SELECT * FROM question_topics WHERE code = ${code}`;
  return row;
}

export interface LuuChuDeInput {
  code: string;
  name: string;
  fieldId?: string | null;
  parentId?: string | null;
  ordinal?: number;
}

/** Tạo hoặc cập nhật chủ đề theo mã. */
export async function luuChuDeCauHoi(inp: LuuChuDeInput): Promise<ChuDeCauHoiRow> {
  const [row] = await sql<ChuDeCauHoiRow[]>`
    INSERT INTO question_topics (code, name, field_id, parent_id, ordinal)
    VALUES (${inp.code}, ${inp.name}, ${inp.fieldId ?? null}, ${inp.parentId ?? null}, ${inp.ordinal ?? 0})
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name, field_id = EXCLUDED.field_id, parent_id = EXCLUDED.parent_id,
      ordinal = EXCLUDED.ordinal, updated_at = now()
    RETURNING *`;
  return row!;
}

/* ------------------------------------------------------------------ */
/* Đọc câu hỏi                                                         */
/* ------------------------------------------------------------------ */

export interface LocCauHoi {
  /** Mã chủ đề; lấy cả cây con. */
  chuDe?: string;
  mucDo?: string;
  loai?: string;
  trangThai?: string;
  nguon?: string;
  /**
   * Id việc AI sinh câu (authoring_jobs), để xem đúng lô câu một việc vừa sinh. Id của một lần
   * soạn tự động thì lấy câu của mọi việc con, tức câu của cả chuyên đề vừa soạn.
   */
  viec?: string;
  /** Tìm trong đề, mã câu và giải thích, không phân biệt hoa thường. */
  q?: string;
  ids?: string[];
  limit?: number;
  offset?: number;
}

function dieuKienLoc(l: LocCauHoi) {
  const q = l.q?.trim() ? `%${l.q.trim()}%` : null;
  return sql`
    ${
      l.chuDe
        ? sql`AND q.topic_id IN (
      WITH RECURSIVE cay AS (
        SELECT id FROM question_topics WHERE code = ${l.chuDe}
        UNION ALL SELECT t.id FROM question_topics t JOIN cay ON t.parent_id = cay.id
      ) SELECT id FROM cay)`
        : sql``
    }
    ${l.mucDo ? sql`AND q.level = ${l.mucDo}` : sql``}
    ${l.loai ? sql`AND q.kind = ${l.loai}` : sql``}
    ${l.trangThai ? sql`AND q.status = ${l.trangThai}` : sql``}
    ${l.nguon ? sql`AND q.source = ${l.nguon}` : sql``}
    ${
      l.viec
        ? sql`AND (q.authoring_job_id = ${l.viec}::uuid OR q.authoring_job_id IN (
      SELECT id FROM authoring_jobs WHERE parent_id = ${l.viec}::uuid))`
        : sql``
    }
    ${l.ids ? sql`AND q.id = ANY(${l.ids}::uuid[])` : sql``}
    ${q ? sql`AND (q.stem ILIKE ${q} OR q.code ILIKE ${q} OR q.explanation ILIKE ${q})` : sql``}`;
}

export async function danhSachCauHoi(l: LocCauHoi = {}): Promise<{ items: CauHoiRow[]; tong: number }> {
  const loc = dieuKienLoc(l);
  const [items, [dem]] = await Promise.all([
    sql<CauHoiRow[]>`
      SELECT q.*, t.code AS topic_code, t.name AS topic_name, d.code AS duplicate_code
      FROM questions q LEFT JOIN question_topics t ON t.id = q.topic_id
      LEFT JOIN questions d ON d.id = q.duplicate_of
      WHERE true ${loc}
      ORDER BY q.updated_at DESC, q.code
      LIMIT ${l.limit ?? 50} OFFSET ${l.offset ?? 0}`,
    sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM questions q WHERE true ${loc}`,
  ]);
  return { items, tong: dem?.n ?? 0 };
}

/** Số câu theo từng trạng thái, cho bộ đếm "Đã duyệt: N / mục tiêu". */
export async function demCauHoiTheoTrangThai(): Promise<Record<TrangThaiCauHoiDb, number>> {
  const rows = await sql<Array<{ status: TrangThaiCauHoiDb; n: number }>>`
    SELECT status, count(*)::int AS n FROM questions GROUP BY status`;
  const ra: Record<TrangThaiCauHoiDb, number> = {
    nhap: 0,
    cho_duyet: 0,
    da_duyet: 0,
    tu_choi: 0,
    luu_tru: 0,
  };
  for (const r of rows) ra[r.status] = r.n;
  return ra;
}

export async function cauHoiTheoId(id: string): Promise<CauHoiRow | undefined> {
  const [row] = await sql<CauHoiRow[]>`
    SELECT q.*, t.code AS topic_code, t.name AS topic_name, d.code AS duplicate_code
    FROM questions q LEFT JOIN question_topics t ON t.id = q.topic_id
    LEFT JOIN questions d ON d.id = q.duplicate_of
    WHERE q.id = ${id}`;
  return row;
}

export async function lichSuDuyetCauHoi(id: string): Promise<LichSuDuyetRow[]> {
  return await sql<LichSuDuyetRow[]>`
    SELECT id::text, version, action, actor, note, created_at
    FROM question_reviews WHERE question_id = ${id} ORDER BY created_at DESC, id DESC`;
}

/** Mã câu đã có trong CSDL, trong số các mã cho trước. */
export async function maCauHoiDaCo(codes: string[]): Promise<Set<string>> {
  if (!codes.length) return new Set();
  const rows = await sql<Array<{ code: string }>>`SELECT code FROM questions WHERE code = ANY(${codes})`;
  return new Set(rows.map((r) => r.code));
}

/* ------------------------------------------------------------------ */
/* Ghi câu hỏi                                                         */
/* ------------------------------------------------------------------ */

export interface NoiDungCauHoiDb {
  topicId: string | null;
  level: string;
  kind: string;
  stem: string;
  options: unknown;
  answer: unknown;
  explanation: string | null;
  citations: string[];
  /** Tiêu chí chấm, chỉ câu tự luận. */
  rubric?: unknown;
  imageUris?: string[];
  offlineOk?: boolean;
}

/** Câu tự luận cần mô hình hoặc người chấm: không bao giờ vào gói luyện tập offline. */
function offlineDuoc(nd: NoiDungCauHoiDb): boolean {
  return nd.kind === "tu_luan" ? false : (nd.offlineOk ?? true);
}

export interface TaoCauHoiInput extends NoiDungCauHoiDb {
  code?: string | null;
  status?: TrangThaiCauHoiDb;
  source?: "nguoi" | "ai" | "nhap_excel";
  authoringJobId?: string | null;
  duplicateOf?: string | null;
}

async function ghiLichSu(
  tx: Tx,
  questionId: string,
  version: number,
  action: string,
  actor: string,
  note?: string | null,
) {
  await tx`
    INSERT INTO question_reviews (question_id, version, action, actor, note)
    VALUES (${questionId}, ${version}, ${action}, ${actor}, ${note ?? null})`;
}

async function taoTrong(tx: Tx, inp: TaoCauHoiInput, actor: string): Promise<CauHoiRow> {
  const [row] = await tx<CauHoiRow[]>`
    INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, citations, rubric,
                           image_uris, offline_ok, status, source, created_by, updated_by, approved_by, approved_at,
                           authoring_job_id, duplicate_of)
    VALUES (COALESCE(${inp.code ?? null}, 'CH-' || lpad(nextval('questions_code_seq')::text, 5, '0')),
            ${inp.topicId}, ${inp.level}, ${inp.kind}, ${inp.stem},
            ${tx.json(inp.options as never)}, ${tx.json(inp.answer as never)}, ${inp.explanation},
            ${inp.citations}, ${tx.json((inp.rubric ?? {}) as never)}, ${inp.imageUris ?? []}, ${offlineDuoc(inp)},
            ${inp.status ?? "nhap"}, ${inp.source ?? "nguoi"}, ${actor}, ${actor},
            ${inp.status === "da_duyet" ? actor : null}, ${inp.status === "da_duyet" ? new Date() : null},
            ${inp.authoringJobId ?? null}, ${inp.duplicateOf ?? null})
    RETURNING *`;
  const hanhDong = inp.source === "nhap_excel" ? "nhap_excel" : inp.source === "ai" ? "ai_sinh" : "tao";
  await ghiLichSu(tx, row!.id, 1, hanhDong, actor);
  return row!;
}

export async function taoCauHoi(inp: TaoCauHoiInput, actor: string): Promise<CauHoiRow> {
  return (await sql.begin((tx) => taoTrong(tx, inp, actor))) as unknown as CauHoiRow;
}

/** Tạo nhiều câu trong một giao dịch: một câu lỗi thì không câu nào được ghi. */
export async function taoNhieuCauHoi(ds: TaoCauHoiInput[], actor: string): Promise<CauHoiRow[]> {
  return (await sql.begin(async (tx) => {
    const ra: CauHoiRow[] = [];
    for (const inp of ds) ra.push(await taoTrong(tx, inp, actor));
    return ra;
  })) as unknown as CauHoiRow[];
}

/**
 * Ghi nội dung mới. `sau` là trạng thái và version do luật `hauQuaSua` tính. Chỉ ghi khi
 * version trong CSDL vẫn là `versionCu`, để hai người sửa cùng lúc không đè lên nhau: trả
 * undefined khi đã có người sửa trước.
 */
export async function suaCauHoi(
  id: string,
  noiDung: NoiDungCauHoiDb,
  versionCu: number,
  sau: { status: TrangThaiCauHoiDb; version: number },
  actor: string,
): Promise<CauHoiRow | undefined> {
  return (await sql.begin(async (tx) => {
    const [row] = await tx<CauHoiRow[]>`
      UPDATE questions SET
        topic_id = ${noiDung.topicId}, level = ${noiDung.level}, kind = ${noiDung.kind}, stem = ${noiDung.stem},
        options = ${tx.json(noiDung.options as never)}, answer = ${tx.json(noiDung.answer as never)},
        explanation = ${noiDung.explanation}, citations = ${noiDung.citations},
        rubric = ${tx.json((noiDung.rubric ?? {}) as never)},
        image_uris = ${noiDung.imageUris ?? []}, offline_ok = ${offlineDuoc(noiDung)},
        status = ${sau.status}, version = ${sau.version}, updated_by = ${actor}, updated_at = now(),
        approved_by = CASE WHEN ${sau.status} = 'da_duyet' THEN approved_by END,
        approved_at = CASE WHEN ${sau.status} = 'da_duyet' THEN approved_at END
      WHERE id = ${id} AND version = ${versionCu} AND status <> 'luu_tru'
      RETURNING *`;
    if (!row) return undefined;
    await ghiLichSu(
      tx,
      id,
      sau.version,
      "sua",
      actor,
      sau.version > versionCu ? "Sửa câu đã duyệt: tăng phiên bản, chờ duyệt lại" : null,
    );
    return row;
  })) as unknown as CauHoiRow | undefined;
}

/**
 * Chuyển trạng thái nhiều câu một lần. Chỉ câu đang ở một trong các trạng thái `tu` mới được
 * chuyển; câu khác bị bỏ qua (người gọi so số câu trả về với số câu yêu cầu).
 */
export async function chuyenTrangThaiCauHoiDb(
  ids: string[],
  tu: TrangThaiCauHoiDb[],
  den: TrangThaiCauHoiDb,
  hanhDong: string,
  actor: string,
  ghiChu?: string | null,
): Promise<Array<{ id: string; version: number }>> {
  if (!ids.length) return [];
  return (await sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string; version: number }>>`
      UPDATE questions SET
        status = ${den}, updated_at = now(),
        approved_by = CASE WHEN ${den} = 'da_duyet' THEN ${actor} ELSE approved_by END,
        approved_at = CASE WHEN ${den} = 'da_duyet' THEN now() ELSE approved_at END,
        reject_reason = CASE WHEN ${den} = 'tu_choi' THEN ${ghiChu ?? null}
                             WHEN ${den} = 'cho_duyet' THEN NULL ELSE reject_reason END
      WHERE id = ANY(${ids}::uuid[]) AND status = ANY(${tu}::text[])
      RETURNING id, version`;
    for (const r of rows) await ghiLichSu(tx, r.id, r.version, hanhDong, actor, ghiChu);
    return rows;
  })) as unknown as Array<{ id: string; version: number }>;
}

/* ------------------------------------------------------------------ */
/* AI sinh câu hỏi (GĐ8)                                               */
/* ------------------------------------------------------------------ */

/** Bước của `authoring_jobs` dành cho việc sinh câu hỏi vào ngân hàng. */
export const BUOC_SINH_CAU_HOI = "sinh_cau_hoi_ngan_hang";

/** Trần số điều khoản đưa vào một lần sinh, để ngữ cảnh (và chi phí) không phình vô hạn. */
export const SO_DIEU_KHOAN_TOI_DA = 40;

export interface DieuKhoanNguCanh {
  urn: string;
  doc_urn: string;
  short_title: string | null;
  label: string;
  heading: string | null;
  text: string;
  node_status: string;
}

function tachUrn(urn: string): { docUrn: string; path: string | null } {
  const i = urn.indexOf("#");
  return i < 0 ? { docUrn: urn, path: null } : { docUrn: urn.slice(0, i), path: urn.slice(i + 1) || null };
}

/**
 * Nguyên văn các điều khoản có hiệu lực tại `asOf`, để làm ngữ cảnh cho mô hình. URN điều,
 * khoản lấy đúng nút đó; URN văn bản lấy mọi điều của văn bản. Nút không có tại `asOf` bị bỏ
 * (người gọi so với danh sách yêu cầu để báo lại).
 */
export async function dieuKhoanNguCanh(urns: string[], asOf: string): Promise<DieuKhoanNguCanh[]> {
  const ra: DieuKhoanNguCanh[] = [];
  const daCo = new Set<string>();
  for (const urn of [...new Set(urns)]) {
    const { docUrn, path } = tachUrn(urn);
    const rows = await sql<DieuKhoanNguCanh[]>`
      SELECT d.urn || '#' || n.path AS urn, d.urn AS doc_urn, d.short_title, n.label, n.heading,
             n.text_md AS text, n.node_status
      FROM documents d
      JOIN LATERAL (
        SELECT v.id FROM document_versions v
        WHERE v.document_id = d.id AND v.valid_from <= ${asOf}::date
          AND (v.valid_to IS NULL OR v.valid_to > ${asOf}::date)
        ORDER BY v.valid_from DESC LIMIT 1
      ) v ON true
      JOIN nodes n ON n.version_id = v.id
      WHERE d.urn = ${docUrn}
        AND ${path ? sql`n.path = ${path}` : sql`n.kind = 'dieu'`}
      ORDER BY n.ordinal, n.path
      LIMIT ${SO_DIEU_KHOAN_TOI_DA}`;
    for (const r of rows) {
      if (daCo.has(r.urn) || ra.length >= SO_DIEU_KHOAN_TOI_DA) continue;
      daCo.add(r.urn);
      ra.push(r);
    }
  }
  return ra;
}

/**
 * Ngữ cảnh căn cứ cho mô hình chấm tự luận: nguyên văn các điều khoản có hiệu lực tại `asOf`,
 * mỗi điều mở đầu bằng `### <urn>`. Rỗng khi bài không ghi căn cứ hoặc không điều nào còn hiệu lực.
 */
export async function nguCanhCanCu(urns: string[], asOf: string): Promise<string> {
  const dieuKhoan = urns.length ? await dieuKhoanNguCanh(urns, asOf) : [];
  return dieuKhoan
    .map((d) => `### ${d.urn}\n${d.label}${d.heading ? ` — ${d.heading}` : ""}\n${d.text}`)
    .join("\n\n");
}

/** Cùng giá trị với `TinhTrangCanCu` của @qdpl/dao-tao. */
export type TinhTrangCanCuDb =
  | "hieu_luc"
  | "khong_ton_tai"
  | "chua_hieu_luc"
  | "het_hieu_luc"
  | "bai_bo"
  | "ngung_hieu_luc";

/**
 * Tình trạng từng URN căn cứ tại `asOf`, cùng cách hiểu hiệu lực với `lookupNode` (phiên bản
 * chứa `asOf`, `valid_to` loại trừ): không có trong kho, chưa có hoặc đã hết hiệu lực, bị bãi
 * bỏ, bị ngưng hiệu lực, hoặc còn hiệu lực.
 */
export async function tinhTrangCanCu(urns: string[], asOf: string): Promise<Map<string, TinhTrangCanCuDb>> {
  const ra = new Map<string, TinhTrangCanCuDb>();
  for (const urn of [...new Set(urns)]) {
    const { docUrn, path } = tachUrn(urn);
    const rows = await sql<Array<{ tu: string; den: string | null; node_status: string | null }>>`
      SELECT v.valid_from::text AS tu, v.valid_to::text AS den,
             ${path ? sql`n.node_status` : sql`NULL::text`} AS node_status
      FROM documents d
      JOIN document_versions v ON v.document_id = d.id
      ${path ? sql`JOIN nodes n ON n.version_id = v.id AND n.path = ${path}` : sql``}
      WHERE d.urn = ${docUrn}
      ORDER BY v.valid_from DESC`;
    if (!rows.length) {
      ra.set(urn, "khong_ton_tai");
      continue;
    }
    const dangApDung = rows.find((r) => r.tu <= asOf && (r.den === null || r.den > asOf));
    if (!dangApDung) ra.set(urn, rows.some((r) => r.tu > asOf) ? "chua_hieu_luc" : "het_hieu_luc");
    else if (dangApDung.node_status === "repealed") ra.set(urn, "bai_bo");
    else if (dangApDung.node_status === "suspended") ra.set(urn, "ngung_hieu_luc");
    else ra.set(urn, "hieu_luc");
  }
  return ra;
}

/**
 * Câu đã có trong ngân hàng (trừ câu lưu trữ) gần giống `stem`, lọc sơ bằng pg_trgm. Quyết
 * định trùng hay không nằm ở `hauKiemCauHoiAi` của @qdpl/dao-tao.
 */
export async function cauHoiGanGiong(
  stem: string,
  o: { nguong?: number; limit?: number } = {},
): Promise<Array<{ id: string; code: string; stem: string }>> {
  return await sql<Array<{ id: string; code: string; stem: string }>>`
    SELECT id, code, stem FROM questions
    WHERE status <> 'luu_tru' AND similarity(lower(stem), lower(${stem})) >= ${o.nguong ?? 0.3}
    ORDER BY similarity(lower(stem), lower(${stem})) DESC
    LIMIT ${o.limit ?? 5}`;
}

/**
 * Đề bài các câu đã có (trừ câu lưu trữ) có căn cứ thuộc các điều khoản `urns`, kể cả khoản, điểm
 * con hoặc điều cha của chúng; câu mới nhất trước. Đưa cho mô hình để không hỏi lại ý đã có.
 */
export async function deBaiDaCoTheoCanCu(urns: string[], limit = 50): Promise<string[]> {
  if (!urns.length) return [];
  const rows = await sql<Array<{ stem: string }>>`
    SELECT q.stem FROM questions q
    WHERE q.status <> 'luu_tru' AND EXISTS (
      SELECT 1 FROM unnest(q.citations) c, unnest(${urns}::text[]) u
      WHERE c = u OR starts_with(c, u || '.') OR starts_with(u, c || '.'))
    ORDER BY q.created_at DESC
    LIMIT ${limit}`;
  return rows.map((r) => r.stem);
}

/**
 * Ghi các câu AI sinh trong một giao dịch, theo thứ tự. `trungTrongLo` là chỉ số của câu đứng
 * trước trong cùng danh sách mà câu này gần giống; nó được đổi thành `duplicate_of` trỏ tới id
 * vừa ghi của câu đó.
 */
export async function taoCauHoiAi(
  ds: Array<TaoCauHoiInput & { trungTrongLo?: number }>,
  actor: string,
): Promise<CauHoiRow[]> {
  return (await sql.begin(async (tx) => {
    const ra: CauHoiRow[] = [];
    for (const { trungTrongLo, ...inp } of ds) {
      const duplicateOf = inp.duplicateOf ?? (trungTrongLo !== undefined ? ra[trungTrongLo]?.id : undefined);
      ra.push(await taoTrong(tx, { ...inp, source: "ai", duplicateOf: duplicateOf ?? null }, actor));
    }
    return ra;
  })) as unknown as CauHoiRow[];
}

export async function soCauHoiCuaViec(jobId: string): Promise<number> {
  const [r] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM questions WHERE authoring_job_id = ${jobId}::uuid`;
  return r?.n ?? 0;
}

export interface ViecSinhCauHoiRow {
  id: string;
  state: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  cost_usd: string;
  budget_usd: string | null;
  requested_by: string | null;
  created_at: Date;
  finished_at: Date | null;
  so_cau: number;
  so_cho_duyet: number;
  so_da_duyet: number;
}

/**
 * Các việc sinh câu hỏi gần nhất (hoặc đúng các việc `ids`, cho màn hình đề sinh từ văn bản),
 * kèm số câu mỗi việc đã đưa vào ngân hàng.
 */
export async function danhSachViecSinhCauHoi(limit = 10, ids?: string[]): Promise<ViecSinhCauHoiRow[]> {
  return await sql<ViecSinhCauHoiRow[]>`
    SELECT j.id, j.state, j.input, j.output, j.error, j.cost_usd, j.budget_usd, j.requested_by,
           j.created_at, j.finished_at,
           count(q.id)::int AS so_cau,
           count(q.id) FILTER (WHERE q.status = 'cho_duyet')::int AS so_cho_duyet,
           count(q.id) FILTER (WHERE q.status = 'da_duyet')::int AS so_da_duyet
    FROM authoring_jobs j
    LEFT JOIN questions q ON q.authoring_job_id = j.id
    WHERE j.step = ${BUOC_SINH_CAU_HOI}
      ${ids ? sql`AND j.id = ANY(${ids}::uuid[])` : sql``}
    GROUP BY j.id
    ORDER BY j.created_at ${ids ? sql`ASC` : sql`DESC`}
    LIMIT ${limit}`;
}

/* ------------------------------------------------------------------ */
/* Tệp Excel                                                           */
/* ------------------------------------------------------------------ */

/** Giới hạn số câu mỗi lần nhập, để một tệp lớn bất thường không làm nghẽn máy chủ. */
export const SO_DONG_NHAP_CAU_HOI_TOI_DA = 2000;

/**
 * Đọc tệp nhập câu hỏi thành các dòng { khóa: chuỗi }. Ý nghĩa từng cột (COT_EXCEL_CAU_HOI)
 * nằm ở @qdpl/dao-tao; phần đọc tệp dùng chung excel.ts. Ném LoiTepExcel khi tệp hỏng,
 * thiếu cột bắt buộc hoặc quá dài.
 */
export async function docTepCauHoi(
  duLieu: ArrayBuffer | Uint8Array,
  cot: ReadonlyArray<{ khoa: string; tieuDe: string }>,
  batBuoc: readonly string[],
): Promise<Array<{ dong: number; o: Record<string, string> }>> {
  const dong = await docBangExcel(
    duLieu,
    cot.map((c) => ({ khoa: c.khoa, tieuDe: [c.tieuDe], batBuoc: batBuoc.includes(c.khoa) })),
  );
  if (dong.length > SO_DONG_NHAP_CAU_HOI_TOI_DA) {
    throw new LoiTepExcel(`Tệp có hơn ${SO_DONG_NHAP_CAU_HOI_TOI_DA} câu. Hãy chia thành nhiều tệp.`);
  }
  return dong.map((d) => ({ dong: d.dong, o: d.giaTri }));
}

/**
 * Ghi tệp .xlsx: trang "Câu hỏi" (trang được đọc khi nhập) và trang "Hướng dẫn" riêng, để ghi
 * chú không bị đọc nhầm thành câu hỏi khi người dùng nhập lại chính tệp này.
 */
export async function taoTepCauHoi(
  cot: ReadonlyArray<{ khoa: string; tieuDe: string; rong?: number }>,
  dong: Array<Record<string, string>>,
  huongDan: readonly string[] = [],
): Promise<Uint8Array> {
  const trang = [{ ten: "Câu hỏi", cot: [...cot], dong }];
  if (huongDan.length) {
    const [tieuDe, ...cacDong] = huongDan;
    trang.push({
      ten: "Hướng dẫn",
      cot: [{ tieuDe: tieuDe!, khoa: "g", rong: 110 }],
      dong: cacDong.map((g) => ({ g })),
    });
  }
  return await taoTepExcel(trang);
}
