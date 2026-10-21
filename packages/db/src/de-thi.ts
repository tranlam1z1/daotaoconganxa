/**
 * Thi sát hạch (docs/PLAN.md GĐ6): đề thi, giao bài, lượt thi.
 *
 * Luật (ma trận, sinh đề, chấm, đồng hồ) nằm ở packages/dao-tao/src/de-thi.ts. Các thao tác cần
 * cả luật lẫn giao dịch CSDL (bắt đầu lượt, nộp lượt, chấm tự luận, chốt điểm) đặt ở đây để API
 * và worker tự nộp dùng chung một đường đi, không chép lại cách chấm.
 *
 * Câu tự luận: nộp lượt chỉ chấm phần máy (trong giao dịch); câu tự luận có bài làm chờ mô hình
 * chấm NGOÀI giao dịch (`chamTuLuanCuaLuot`), mô hình không chấm được thì chờ giảng viên. Lượt ở
 * trạng thái `cho_cham` tới khi mọi câu có điểm thì `chotLuotNeuDu` mới chốt điểm, cộng XP.
 * Gói này không gọi mô hình trực tiếp: người gọi truyền hàm gọi mô hình (`goiMoHinhChamTuLuan`
 * của @qdpl/llm) để gói db không phụ thuộc gói llm.
 */
import {
  type CauHoiNguon,
  type CauTrongDe,
  type CheDoXemDapAn,
  chamPhanMay,
  conNhanTraLoi,
  DO_DAI_BAI_VIET,
  DUNG_SAI_NOP_GIAY,
  dangCua,
  diemCau,
  diemToiDaTieuChi,
  docKetQuaChamAi,
  hanNop,
  ketQuaChamTuLuan,
  khoaO,
  kiemTraBatDau,
  laRubric,
  type OMaTran,
  sinhDe,
  THONG_BAO_KHONG_BAT_DAU,
  type TraLoiCauHoi,
  tinhDiemRubric,
  tongHopDiem,
  xpLuotThi,
} from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";
import { congXp } from "./diem-thuong.ts";
import { LoiNghiepVu } from "./don-vi.ts";
import { ghiKetQuaChuDe } from "./ho-so-chu-de.ts";
import { nguCanhCanCu } from "./ngan-hang.ts";

/* ------------------------------------------------------------------ */
/* Đề thi                                                              */
/* ------------------------------------------------------------------ */

export type TrangThaiDeThi = "nhap" | "xuat_ban" | "dong";

export interface DeThiRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  field_id: string | null;
  matrix: OMaTran[];
  question_count: number;
  duration_minutes: number;
  pass_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  show_answers: CheDoXemDapAn;
  status: TrangThaiDeThi;
  /** Việc AI sinh câu hỏi tạo cùng đề (sinh đề từ văn bản). */
  authoring_job_ids: string[];
  created_by: string | null;
  updated_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  so_bai_giao?: number;
  so_luot_nop?: number;
}

export async function danhSachDeThi(trangThai?: TrangThaiDeThi[]): Promise<DeThiRow[]> {
  const loc = trangThai?.length ? trangThai : null;
  return (await sql`
    SELECT e.*,
      (SELECT count(*)::int FROM exam_assignments a WHERE a.exam_id = e.id AND a.cancelled_at IS NULL) AS so_bai_giao,
      (SELECT count(*)::int FROM exam_attempts t WHERE t.exam_id = e.id AND t.status <> 'dang_lam') AS so_luot_nop
    FROM exams e
    WHERE (${loc}::text[] IS NULL OR e.status = ANY(${loc}::text[]))
    ORDER BY e.updated_at DESC`) as unknown as DeThiRow[];
}

export async function layDeThi(id: string): Promise<DeThiRow | null> {
  const [row] = await sql`SELECT * FROM exams WHERE id = ${id}`;
  return (row as unknown as DeThiRow) ?? null;
}

export interface DuLieuDeThi {
  title: string;
  description?: string | null;
  field_id?: string | null;
  matrix: OMaTran[];
  question_count: number;
  duration_minutes: number;
  pass_score: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  show_answers: CheDoXemDapAn;
  /** Chỉ khi tạo: việc AI sinh câu hỏi đi kèm đề (sinh đề từ văn bản). */
  authoring_job_ids?: string[];
}

export async function taoDeThi(d: DuLieuDeThi, actor: string): Promise<DeThiRow> {
  const [row] = (await sql`
    INSERT INTO exams (title, description, field_id, matrix, question_count, duration_minutes, pass_score,
                       shuffle_questions, shuffle_options, max_attempts, show_answers, authoring_job_ids,
                       created_by, updated_by)
    VALUES (${d.title}, ${d.description ?? null}, ${d.field_id ?? null}, ${sql.json(d.matrix as never)},
            ${d.question_count}, ${d.duration_minutes}, ${d.pass_score}, ${d.shuffle_questions},
            ${d.shuffle_options}, ${d.max_attempts}, ${d.show_answers}, ${d.authoring_job_ids ?? []}::uuid[],
            ${actor}, ${actor})
    RETURNING *`) as any[];
  await ghiNhatKy(actor, "de_thi:tao", row.code, { title: d.title });
  return row as DeThiRow;
}

/** Sửa toàn bộ cấu hình; route chỉ cho sửa khi đề còn là bản nháp. */
export async function suaDeThi(id: string, d: DuLieuDeThi, actor: string): Promise<DeThiRow> {
  const [row] = (await sql`
    UPDATE exams SET
      title = ${d.title}, description = ${d.description ?? null}, field_id = ${d.field_id ?? null},
      matrix = ${sql.json(d.matrix as never)}, question_count = ${d.question_count},
      duration_minutes = ${d.duration_minutes}, pass_score = ${d.pass_score},
      shuffle_questions = ${d.shuffle_questions}, shuffle_options = ${d.shuffle_options},
      max_attempts = ${d.max_attempts}, show_answers = ${d.show_answers},
      updated_by = ${actor}, updated_at = now()
    WHERE id = ${id}
    RETURNING *`) as any[];
  if (!row) throw new LoiNghiepVu("Không tìm thấy đề thi.", "khong_tim_thay");
  await ghiNhatKy(actor, "de_thi:sua", row.code, { title: d.title });
  return row as DeThiRow;
}

/** Chỉ sửa tên và mô tả: dùng cho đề đã xuất bản (cấu hình đã khóa vì có thể đã có lượt thi). */
export async function suaTenDeThi(id: string, title: string, description: string | null, actor: string) {
  const [row] = (await sql`
    UPDATE exams SET title = ${title}, description = ${description}, updated_by = ${actor}, updated_at = now()
    WHERE id = ${id} RETURNING *`) as any[];
  if (!row) throw new LoiNghiepVu("Không tìm thấy đề thi.", "khong_tim_thay");
  await ghiNhatKy(actor, "de_thi:sua_ten", row.code, { title });
  return row as DeThiRow;
}

export async function doiTrangThaiDeThi(
  id: string,
  status: TrangThaiDeThi,
  actor: string,
): Promise<DeThiRow> {
  const [row] = (await sql`
    UPDATE exams SET status = ${status}, updated_by = ${actor}, updated_at = now(),
      published_at = CASE WHEN ${status} = 'xuat_ban' AND published_at IS NULL THEN now() ELSE published_at END
    WHERE id = ${id} RETURNING *`) as any[];
  if (!row) throw new LoiNghiepVu("Không tìm thấy đề thi.", "khong_tim_thay");
  await ghiNhatKy(actor, `de_thi:${status}`, row.code, {});
  return row as DeThiRow;
}

/**
 * Số câu đã duyệt theo (chủ đề, mức độ, dạng câu): dữ liệu cho form ma trận và cho kiểm tra khả
 * thi. Khóa theo `khoaO` của @qdpl/dao-tao.
 */
export async function demCauKhaDung(): Promise<Map<string, number>> {
  const rows = (await sql`
    SELECT topic_id, level, (kind = 'tu_luan') AS tu_luan, count(*)::int AS n FROM questions
    WHERE status = 'da_duyet' AND topic_id IS NOT NULL
    GROUP BY topic_id, level, (kind = 'tu_luan')`) as any[];
  return new Map(
    rows.map((r) => [khoaO(r.topic_id, r.level, dangCua(r.tu_luan ? "tu_luan" : "")), r.n as number]),
  );
}

/** Câu đã duyệt của các ô trong ma trận, đủ nội dung để chụp vào đề. */
export async function nguonCauHoiChoMaTran(
  maTran: OMaTran[],
  db: Tx = sql as unknown as Tx,
): Promise<CauHoiNguon[]> {
  const chuDe = [...new Set(maTran.filter((o) => o.so_cau > 0).map((o) => o.topic_id))];
  if (!chuDe.length) return [];
  return (await db`
    SELECT id, version, topic_id, kind, level, stem, options, answer, explanation, citations, rubric, image_uris
    FROM questions
    WHERE status = 'da_duyet' AND topic_id = ANY(${chuDe}::uuid[])`) as unknown as CauHoiNguon[];
}

/* ------------------------------------------------------------------ */
/* Giao bài                                                            */
/* ------------------------------------------------------------------ */

export interface GiaoBaiRow {
  id: string;
  exam_id: string;
  exam_code: string;
  exam_title: string;
  unit_id: string | null;
  unit_name: string | null;
  unit_path: string | null;
  account_id: string | null;
  account_name: string | null;
  /** Đơn vị của người được giao (khi giao cho một người), để kiểm phạm vi. */
  account_unit_path: string | null;
  include_subunits: boolean;
  opens_at: Date;
  due_at: Date;
  assigned_by: string;
  note: string | null;
  cancelled_at: Date | null;
  created_at: Date;
  so_nguoi?: number;
  so_da_nop?: number;
}

const COT_GIAO_BAI = sql`
  a.id, a.exam_id, e.code AS exam_code, e.title AS exam_title,
  a.unit_id, u.name AS unit_name, u.path::text AS unit_path,
  a.account_id, COALESCE(acc.name, acc.username, acc.email) AS account_name,
  au.path::text AS account_unit_path,
  a.include_subunits, a.opens_at, a.due_at, a.assigned_by, a.note, a.cancelled_at, a.created_at`;

const TU_GIAO_BAI = sql`
  exam_assignments a
  JOIN exams e ON e.id = a.exam_id
  LEFT JOIN units u ON u.id = a.unit_id
  LEFT JOIN accounts acc ON acc.id = a.account_id
  LEFT JOIN units au ON au.id = acc.unit_id`;

export async function layGiaoBai(id: string): Promise<GiaoBaiRow | null> {
  const [row] = await sql`SELECT ${COT_GIAO_BAI} FROM ${TU_GIAO_BAI} WHERE a.id = ${id}`;
  return (row as unknown as GiaoBaiRow) ?? null;
}

/**
 * Bài đã giao trong phạm vi (null = mọi đơn vị). Kèm số người thuộc diện được giao và số người
 * đã nộp ít nhất một lượt.
 */
export async function danhSachGiaoBai(opts: {
  phamVi: string | null;
  examId?: string;
}): Promise<GiaoBaiRow[]> {
  return (await sql`
    SELECT ${COT_GIAO_BAI},
      CASE WHEN a.account_id IS NOT NULL THEN 1 ELSE (
        SELECT count(*)::int FROM accounts x JOIN units xu ON xu.id = x.unit_id
        WHERE x.enabled AND (xu.id = a.unit_id OR (a.include_subunits AND xu.path <@ u.path))
      ) END AS so_nguoi,
      (SELECT count(DISTINCT t.account_id)::int FROM exam_attempts t
       WHERE t.assignment_id = a.id AND t.status <> 'dang_lam') AS so_da_nop
    FROM ${TU_GIAO_BAI}
    WHERE (${opts.examId ?? null}::uuid IS NULL OR a.exam_id = ${opts.examId ?? null}::uuid)
      AND (${opts.phamVi}::ltree IS NULL
           OR u.path <@ ${opts.phamVi}::ltree
           OR au.path <@ ${opts.phamVi}::ltree)
    ORDER BY a.cancelled_at NULLS FIRST, a.due_at DESC`) as unknown as GiaoBaiRow[];
}

export interface DuLieuGiaoBai {
  exam_id: string;
  unit_id: string | null;
  account_id: string | null;
  include_subunits: boolean;
  opens_at: Date;
  due_at: Date;
  note?: string | null;
}

export async function taoGiaoBai(
  d: DuLieuGiaoBai,
  actor: string,
  actorAccount: string | null,
): Promise<GiaoBaiRow> {
  const [row] = (await sql`
    INSERT INTO exam_assignments (exam_id, unit_id, account_id, include_subunits, opens_at, due_at,
                                  assigned_by, assigned_by_account, note)
    VALUES (${d.exam_id}, ${d.unit_id}, ${d.account_id}, ${d.include_subunits}, ${d.opens_at}, ${d.due_at},
            ${actor}, ${actorAccount}, ${d.note ?? null})
    RETURNING id`) as any[];
  const bai = (await layGiaoBai(row.id)) as GiaoBaiRow;
  await ghiNhatKy(actor, "giao_bai:tao", bai.exam_code, {
    giao_bai: bai.id,
    don_vi: bai.unit_name,
    nguoi: bai.account_name,
    han: d.due_at,
  });
  return bai;
}

export async function huyGiaoBai(id: string, actor: string): Promise<void> {
  const [row] = (await sql`
    UPDATE exam_assignments SET cancelled_at = now(), cancelled_by = ${actor}
    WHERE id = ${id} AND cancelled_at IS NULL RETURNING exam_id`) as any[];
  if (!row) throw new LoiNghiepVu("Không có bài giao đang hiệu lực này.", "khong_tim_thay");
  await ghiNhatKy(actor, "giao_bai:huy", id, {});
}

/* ------------------------------------------------------------------ */
/* Phía người thi                                                      */
/* ------------------------------------------------------------------ */

/**
 * Điều kiện "bài giao áp dụng cho người này": giao thẳng cho người đó, hoặc giao cho đơn vị
 * của người đó, hoặc cho đơn vị cấp trên có kèm đơn vị cấp dưới.
 */
function apDungCho(accountId: string, unitPath: string | null) {
  return sql`(
    a.account_id = ${accountId}
    OR (${unitPath}::ltree IS NOT NULL AND a.unit_id IS NOT NULL
        AND (u.path = ${unitPath}::ltree OR (a.include_subunits AND ${unitPath}::ltree <@ u.path)))
  )`;
}

export interface BaiThiCuaToi {
  assignment_id: string;
  exam_id: string;
  exam_title: string;
  question_count: number;
  duration_minutes: number;
  pass_score: number;
  max_attempts: number;
  exam_status: TrangThaiDeThi;
  opens_at: Date;
  due_at: Date;
  so_luot_nop: number;
  luot_dang_lam: string | null;
  luot_gan_nhat: string | null;
  diem_cao_nhat: number | null;
  da_dat: boolean;
}

export async function baiThiCuaToi(accountId: string, unitPath: string | null): Promise<BaiThiCuaToi[]> {
  return (await sql`
    SELECT a.id AS assignment_id, e.id AS exam_id, e.title AS exam_title, e.question_count,
           e.duration_minutes, e.pass_score, e.max_attempts, e.status AS exam_status, a.opens_at, a.due_at,
           (SELECT count(*)::int FROM exam_attempts t WHERE t.assignment_id = a.id AND t.account_id = ${accountId}
              AND t.status <> 'dang_lam') AS so_luot_nop,
           (SELECT t.id FROM exam_attempts t WHERE t.assignment_id = a.id AND t.account_id = ${accountId}
              AND t.status = 'dang_lam' LIMIT 1) AS luot_dang_lam,
           (SELECT t.id FROM exam_attempts t WHERE t.assignment_id = a.id AND t.account_id = ${accountId}
              AND t.status <> 'dang_lam' ORDER BY t.submitted_at DESC LIMIT 1) AS luot_gan_nhat,
           (SELECT max(t.score)::float FROM exam_attempts t WHERE t.assignment_id = a.id
              AND t.account_id = ${accountId} AND t.status = 'da_nop') AS diem_cao_nhat,
           COALESCE((SELECT bool_or(t.passed) FROM exam_attempts t WHERE t.assignment_id = a.id
              AND t.account_id = ${accountId} AND t.status = 'da_nop'), false) AS da_dat
    FROM exam_assignments a
    JOIN exams e ON e.id = a.exam_id
    LEFT JOIN units u ON u.id = a.unit_id
    WHERE a.cancelled_at IS NULL AND e.status <> 'nhap' AND ${apDungCho(accountId, unitPath)}
    ORDER BY a.due_at`) as unknown as BaiThiCuaToi[];
}

/** Bài giao áp dụng cho người này, hoặc null (không có, đã hủy, không thuộc diện được giao). */
export async function giaoBaiChoNguoi(
  assignmentId: string,
  accountId: string,
  unitPath: string | null,
): Promise<(GiaoBaiRow & { exam: DeThiRow }) | null> {
  const [row] = (await sql`
    SELECT a.id FROM exam_assignments a LEFT JOIN units u ON u.id = a.unit_id
    WHERE a.id = ${assignmentId} AND ${apDungCho(accountId, unitPath)}`) as any[];
  if (!row) return null;
  const bai = (await layGiaoBai(assignmentId)) as GiaoBaiRow;
  return { ...bai, exam: (await layDeThi(bai.exam_id)) as DeThiRow };
}

export interface LuotThiRow {
  id: string;
  exam_id: string;
  assignment_id: string;
  account_id: string;
  attempt_no: number;
  items: CauTrongDe[];
  started_at: Date;
  deadline_at: Date;
  submitted_at: Date | null;
  submit_kind: "nguoi_thi" | "het_gio" | null;
  correct: number | null;
  total: number;
  score: number | null;
  passed: boolean | null;
  /** `cho_cham`: đã nộp, còn câu tự luận chưa có điểm. */
  status: "dang_lam" | "cho_cham" | "da_nop";
}

export async function layLuot(id: string): Promise<LuotThiRow | null> {
  const [row] = await sql`SELECT *, score::float AS score FROM exam_attempts WHERE id = ${id}`;
  return (row as unknown as LuotThiRow) ?? null;
}

export async function traLoiCuaLuot(attemptId: string): Promise<Map<number, TraLoiCauHoi>> {
  const rows =
    (await sql`SELECT ordinal, response FROM exam_answers WHERE attempt_id = ${attemptId}`) as any[];
  return new Map(rows.map((r) => [r.ordinal as number, r.response as TraLoiCauHoi]));
}

/**
 * Bắt đầu lượt thi, hoặc trả lượt đang làm dở (bấm "Bắt đầu" lại hay mở trên máy khác thì làm
 * tiếp đúng lượt cũ). Khóa tư vấn theo (bài giao, người) để hai yêu cầu đồng thời không sinh
 * hai lượt. Không được bắt đầu thì ném LoiNghiepVu "xung_dot" kèm lý do.
 */
export async function batDauLuot(opts: {
  assignment: GiaoBaiRow & { exam: DeThiRow };
  accountId: string;
  now?: Date;
}): Promise<{ id: string; tiepTuc: boolean }> {
  const now = opts.now ?? new Date();
  const { assignment: a, accountId } = opts;
  return (await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`${a.id}|${accountId}`}))`;
    const [dangLam] = (await tx`
      SELECT id FROM exam_attempts
      WHERE assignment_id = ${a.id} AND account_id = ${accountId} AND status = 'dang_lam'`) as any[];
    if (dangLam) return { id: dangLam.id as string, tiepTuc: true };

    const [dem] = (await tx`
      SELECT count(*)::int AS nop, COALESCE(max(attempt_no), 0) AS lan FROM exam_attempts
      WHERE assignment_id = ${a.id} AND account_id = ${accountId}`) as any[];
    const lyDo = kiemTraBatDau({
      trangThaiDe: a.exam.status,
      daHuy: Boolean(a.cancelled_at),
      moLuc: new Date(a.opens_at),
      han: new Date(a.due_at),
      soLuotDaNop: dem.nop,
      soLuotToiDa: a.exam.max_attempts,
      now,
    });
    if (lyDo) throw new LoiNghiepVu(THONG_BAO_KHONG_BAT_DAU[lyDo], "xung_dot");

    const id = crypto.randomUUID();
    const items = sinhDe({
      maTran: a.exam.matrix,
      nguon: await nguonCauHoiChoMaTran(a.exam.matrix, tx),
      seed: id,
      tronCau: a.exam.shuffle_questions,
      tronPhuongAn: a.exam.shuffle_options,
    });
    await tx`
      INSERT INTO exam_attempts (id, exam_id, assignment_id, account_id, attempt_no, items, started_at,
                                 deadline_at, total)
      VALUES (${id}, ${a.exam.id}, ${a.id}, ${accountId}, ${Number(dem.lan) + 1}, ${tx.json(items as never)},
              ${now}, ${hanNop(now, a.exam.duration_minutes, new Date(a.due_at))}, ${items.length})`;
    return { id, tiepTuc: false };
  })) as { id: string; tiepTuc: boolean };
}

/**
 * Lưu câu trả lời cho một câu (ghi đè được tới khi nộp). Quá hạn + khoảng bù thì từ chối và tự
 * nộp lượt luôn, để người thi thấy kết quả thay vì một lượt treo.
 */
export async function luuTraLoi(opts: {
  luot: LuotThiRow;
  thuTu: number;
  traLoi: TraLoiCauHoi;
  now?: Date;
}): Promise<void> {
  const now = opts.now ?? new Date();
  const { luot, thuTu } = opts;
  if (luot.status !== "dang_lam")
    throw new LoiNghiepVu("Bài thi đã nộp, không sửa được câu trả lời.", "xung_dot");
  if (!conNhanTraLoi(new Date(luot.deadline_at), now)) {
    await nopLuot(luot.id, "het_gio", now);
    throw new LoiNghiepVu("Đã hết giờ làm bài. Bài thi đã được tự động nộp.", "xung_dot");
  }
  const item = luot.items[thuTu - 1];
  if (!item) throw new LoiNghiepVu(`Đề không có câu số ${thuTu}.`, "khong_hop_le");
  if (item.noi_dung.kind === "tu_luan" && String(opts.traLoi.bai_viet ?? "").length > DO_DAI_BAI_VIET.toiDa) {
    throw new LoiNghiepVu(
      `Bài viết dài quá ${DO_DAI_BAI_VIET.toiDa.toLocaleString("vi-VN")} ký tự.`,
      "khong_hop_le",
    );
  }
  await sql`
    INSERT INTO exam_answers (attempt_id, ordinal, question_id, question_version, response, updated_at)
    VALUES (${luot.id}, ${thuTu}, ${item.question_id}, ${item.version}, ${sql.json(opts.traLoi as never)}, ${now})
    ON CONFLICT (attempt_id, ordinal) DO UPDATE SET response = EXCLUDED.response, updated_at = EXCLUDED.updated_at`;
}

/**
 * Nộp và chấm phần máy của một lượt. Gọi lại trên lượt đã nộp thì không làm gì (API bấm "Nộp"
 * hai lần và worker tự nộp cùng lúc không chấm hai lần). Người thi bấm nộp khi đã quá hạn +
 * khoảng bù thì vẫn ghi là hết giờ.
 *
 * Không có câu tự luận chờ chấm thì chốt điểm ngay như trước. Có thì lượt sang `cho_cham`, câu
 * tự luận ở `cho_ai`; người gọi chạy `chamTuLuanCuaLuot` sau giao dịch (API ngay khi nộp, worker
 * vớt phần còn lại). Trả `choCham` để người gọi biết có cần chấm tiếp.
 */
export async function nopLuot(
  attemptId: string,
  kieu: "nguoi_thi" | "het_gio",
  now: Date = new Date(),
): Promise<{ choCham: boolean }> {
  return (await sql.begin(async (tx) => {
    const [luot] = (await tx`
      SELECT e.pass_score, t.items, t.deadline_at, t.status, t.account_id
      FROM exam_attempts t JOIN exams e ON e.id = t.exam_id
      WHERE t.id = ${attemptId} FOR UPDATE OF t`) as any[];
    if (luot?.status !== "dang_lam") return { choCham: luot?.status === "cho_cham" };
    const traLoi = new Map(
      ((await tx`SELECT ordinal, response FROM exam_answers WHERE attempt_id = ${attemptId}`) as any[]).map(
        (r) => [r.ordinal as number, r.response as TraLoiCauHoi],
      ),
    );
    const cauTrongDe = luot.items as CauTrongDe[];
    const chiTiet = chamPhanMay(cauTrongDe, traLoi);
    const quaHan = !conNhanTraLoi(new Date(luot.deadline_at), now);
    // Giờ nộp không vượt mốc hết giờ: lượt bỏ dở được quét nộp muộn (worker chậm, hoặc tới lúc người
    // thi mở lại danh sách) vẫn ghi thời gian làm đúng bằng thời lượng của đề.
    const nopLuc = tx`LEAST(${now}::timestamptz, deadline_at)`;
    for (const c of chiTiet) {
      if (!traLoi.has(c.thu_tu)) continue;
      await tx`
        UPDATE exam_answers SET
          correct = ${c.cho_cham ? null : c.dung}, points = ${c.diem}, max_points = ${c.diem_toi_da},
          graded_by = ${c.cho_cham ? null : "may"}, grading_state = ${c.cho_cham ? "cho_ai" : "xong"}
        WHERE attempt_id = ${attemptId} AND ordinal = ${c.thu_tu}`;
      // Hồ sơ chủ đề (docs/PLAN.md GĐ-G0): chỉ câu đã trả lời và đã có kết quả, cùng giao dịch
      // với việc chấm. Câu tự luận ghi khi chốt lượt.
      if (!c.cho_cham) {
        await ghiKetQuaChuDe(tx, {
          accountId: luot.account_id,
          topicId: cauTrongDe[c.thu_tu - 1]?.topic_id,
          dung: c.dung,
          luc: now,
        });
      }
    }
    const submitKind = quaHan ? "het_gio" : kieu;
    if (chiTiet.some((c) => c.cho_cham)) {
      await tx`
        UPDATE exam_attempts SET status = 'cho_cham', submitted_at = ${nopLuc}, submit_kind = ${submitKind}
        WHERE id = ${attemptId}`;
      return { choCham: true };
    }
    const kq = tongHopDiem(chiTiet, luot.pass_score);
    await tx`
      UPDATE exam_attempts SET status = 'da_nop', submitted_at = ${nopLuc},
        submit_kind = ${submitKind}, correct = ${kq.dung}, score = ${kq.diem}, passed = ${kq.dat}
      WHERE id = ${attemptId}`;
    // XP nộp bài và thưởng đạt, trong cùng giao dịch (docs/PLAN.md GĐ9). Lượt đã nộp thì dừng ở trên.
    await congXp(tx, {
      accountId: luot.account_id,
      nguon: "luot_thi",
      nguonId: attemptId,
      xp: xpLuotThi({ dat: kq.dat }),
      luc: now,
    });
    return { choCham: false };
  })) as { choCham: boolean };
}

/* ------------------------------------------------------------------ */
/* Chấm tự luận và chốt điểm                                           */
/* ------------------------------------------------------------------ */

/** Hàm gọi mô hình chấm tự luận (`goiMoHinhChamTuLuan` của @qdpl/llm). */
export type GoiMoHinhChamTuLuan = (y: {
  deBai: string;
  rubric: unknown;
  nguCanh: string;
  baiLam: string;
  asOf: string;
}) => Promise<{ json: unknown; model: string; costUsd: number }>;

/** Tiến trình nhận chấm một câu quá thời gian này mà chưa xong thì tiến trình khác nhận lại. */
const HAN_NHAN_CHAM_MS = 5 * 60_000;
/** Số câu tự luận của một lượt gửi mô hình cùng lúc. */
const SO_CAU_CHAM_SONG_SONG = 3;

/** Ngày áp dụng khi chấm: ngày người thi bắt đầu lượt (giờ Việt Nam). */
function ngayApDung(batDau: Date): string {
  return new Date(new Date(batDau).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

async function chayGioiHan<T>(ds: T[], soLuong: number, f: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const tho = async () => {
    while (i < ds.length) await f(ds[i++] as T);
  };
  await Promise.all(Array.from({ length: Math.min(soLuong, ds.length) }, tho));
}

/**
 * Gửi mô hình chấm các câu tự luận đang chờ của một lượt, rồi chốt lượt nếu đủ điểm. Nhận việc
 * nguyên tử (`cho_ai` -> `dang_ai`), nên hai tiến trình chạy cùng lúc (người thi bấm nộp hai lần,
 * API và worker) không gọi mô hình hai lần cho cùng một câu. Mô hình lỗi hoặc trả kết quả không
 * dùng được thì câu sang `cho_nguoi` (hàng chấm của giảng viên), không bịa điểm.
 * Trả số câu đã gửi mô hình.
 */
export async function chamTuLuanCuaLuot(
  attemptId: string,
  goi: GoiMoHinhChamTuLuan,
  now: Date = new Date(),
): Promise<number> {
  const nhan = (await sql`
    UPDATE exam_answers SET grading_state = 'dang_ai', ai_claimed_at = ${now}
    WHERE attempt_id = ${attemptId}
      AND (grading_state = 'cho_ai'
           OR (grading_state = 'dang_ai' AND ai_claimed_at < ${new Date(now.getTime() - HAN_NHAN_CHAM_MS)}))
    RETURNING ordinal, response`) as Array<{ ordinal: number; response: TraLoiCauHoi }>;
  if (nhan.length) {
    const luot = (await layLuot(attemptId)) as LuotThiRow;
    const asOf = ngayApDung(luot.started_at);
    await chayGioiHan(nhan, SO_CAU_CHAM_SONG_SONG, async (r) => {
      const item = luot.items[r.ordinal - 1];
      const rubric = item?.noi_dung.rubric;
      const baiLam = String(r.response?.bai_viet ?? "");
      let ghi: { points: number; correct: boolean; feedback: unknown } | null = null;
      let model: string | null = null;
      let cost = 0;
      if (item && laRubric(rubric)) {
        try {
          const res = await goi({
            deBai: item.noi_dung.stem,
            rubric,
            nguCanh: await nguCanhCanCu(item.noi_dung.citations, asOf),
            baiLam,
            asOf,
          });
          model = res.model;
          cost = res.costUsd;
          const doc = docKetQuaChamAi(res.json, rubric, baiLam);
          if (doc.dungDuoc) {
            const kq = ketQuaChamTuLuan(
              { points: diemCau(item), citations: item.noi_dung.citations },
              rubric,
              doc,
            );
            ghi = { points: kq.score, correct: kq.passed, feedback: kq.feedback };
          }
        } catch (e) {
          console.error("[thi:cham-tu-luan] mô hình không chấm được:", e instanceof Error ? e.message : e);
        }
      }
      await sql`
        UPDATE exam_answers SET
          ${
            ghi
              ? sql`points = ${ghi.points}, correct = ${ghi.correct}, feedback = ${sql.json(ghi.feedback as never)},
                    graded_by = 'ai', grading_state = 'xong',`
              : sql`grading_state = 'cho_nguoi',`
          }
          model = ${model}, cost_usd = ${cost}, ai_claimed_at = NULL
        WHERE attempt_id = ${attemptId} AND ordinal = ${r.ordinal} AND grading_state = 'dang_ai'`;
    });
  }
  await chotLuotNeuDu(attemptId, now);
  return nhan.length;
}

/**
 * Vớt các câu tự luận còn chờ mô hình (lượt tự nộp khi hết giờ, hoặc API dừng giữa chừng). Worker
 * gọi mỗi phút. Trả số lượt đã xử lý.
 */
export async function chamTuLuanConTon(
  goi: GoiMoHinhChamTuLuan,
  limit = 20,
  now: Date = new Date(),
): Promise<number> {
  const rows = (await sql`
    SELECT DISTINCT attempt_id FROM exam_answers
    WHERE grading_state = 'cho_ai'
       OR (grading_state = 'dang_ai' AND ai_claimed_at < ${new Date(now.getTime() - HAN_NHAN_CHAM_MS)})
    LIMIT ${limit}`) as Array<{ attempt_id: string }>;
  for (const r of rows) await chamTuLuanCuaLuot(r.attempt_id, goi, now);
  return rows.length;
}

/**
 * Chốt điểm lượt khi mọi câu đã có điểm: `cho_cham` -> `da_nop`, ghi hồ sơ chủ đề cho câu tự luận,
 * cộng XP. Lượt đã chốt (phúc khảo) thì chỉ tính lại điểm. Còn câu chưa có điểm thì không làm gì.
 */
export async function chotLuotNeuDu(attemptId: string, now: Date = new Date()): Promise<boolean> {
  return (await sql.begin(async (tx) => {
    const [luot] = (await tx`
      SELECT e.pass_score, t.items, t.status, t.account_id
      FROM exam_attempts t JOIN exams e ON e.id = t.exam_id
      WHERE t.id = ${attemptId} FOR UPDATE OF t`) as any[];
    if (luot?.status !== "cho_cham" && luot?.status !== "da_nop") return false;
    const traLoi = new Map(
      (
        (await tx`
          SELECT ordinal, points::float AS points, correct, grading_state FROM exam_answers
          WHERE attempt_id = ${attemptId}`) as any[]
      ).map((r) => [r.ordinal as number, r]),
    );
    if ([...traLoi.values()].some((r) => r.grading_state !== "xong")) return false;
    const items = luot.items as CauTrongDe[];
    const chiTiet = items.map((item, i) => {
      const r = traLoi.get(i + 1);
      // Câu chấm trước khi có cột `points` chỉ có cờ đúng/sai: đúng là trọn điểm câu.
      const diem = r?.points ?? (r?.correct ? diemCau(item) : 0);
      return { dung: Boolean(r?.correct), diem: Number(diem), diem_toi_da: diemCau(item) };
    });
    const kq = tongHopDiem(chiTiet, luot.pass_score);
    await tx`
      UPDATE exam_attempts SET status = 'da_nop', correct = ${kq.dung}, score = ${kq.diem}, passed = ${kq.dat}
      WHERE id = ${attemptId}`;
    if (luot.status === "cho_cham") {
      for (const [i, item] of items.entries()) {
        const r = traLoi.get(i + 1);
        if (item.noi_dung.kind !== "tu_luan" || !r || r.correct === null) continue;
        await ghiKetQuaChuDe(tx, {
          accountId: luot.account_id,
          topicId: item.topic_id,
          dung: r.correct,
          luc: now,
        });
      }
      await congXp(tx, {
        accountId: luot.account_id,
        nguon: "luot_thi",
        nguonId: attemptId,
        xp: xpLuotThi({ dat: kq.dat }),
        luc: now,
      });
    }
    return true;
  })) as boolean;
}

export interface CauTuLuanCanCham {
  attempt_id: string;
  ordinal: number;
  exam_id: string;
  exam_title: string;
  account_name: string | null;
  unit_name: string | null;
  unit_path: string | null;
  submitted_at: Date | null;
  attempt_status: LuotThiRow["status"];
  grading_state: string;
  graded_by: string | null;
  points: number | null;
  max_points: number | null;
  feedback: unknown;
  reviewer: string | null;
  response: TraLoiCauHoi;
  /** Ảnh chụp câu trong đề (đề, rubric, đáp án gợi ý, căn cứ). */
  item: CauTrongDe;
}

/**
 * Hàng chấm tự luận của giảng viên: `cho_nguoi` là câu mô hình không chấm được (lượt đang chờ
 * điểm); `da_cham_ai` là câu mô hình đã chấm, để lấy mẫu đối chiếu hoặc phúc khảo. `phamVi` là
 * đường dẫn cây đơn vị (null = mọi đơn vị).
 */
export async function hangChamTuLuanThi(opts: {
  cheDo: "cho_nguoi" | "da_cham_ai";
  phamVi: string | null;
  limit?: number;
}): Promise<CauTuLuanCanCham[]> {
  return (await sql`
    SELECT a.attempt_id, a.ordinal, t.exam_id, e.title AS exam_title,
           COALESCE(acc.name, acc.username, acc.email) AS account_name, u.name AS unit_name,
           u.path::text AS unit_path, t.submitted_at, t.status AS attempt_status, a.grading_state,
           a.graded_by, a.points::float AS points, a.max_points::float AS max_points, a.feedback,
           a.reviewer, a.response, t.items -> (a.ordinal - 1) AS item
    FROM exam_answers a
    JOIN exam_attempts t ON t.id = a.attempt_id
    JOIN exams e ON e.id = t.exam_id
    JOIN accounts acc ON acc.id = t.account_id
    LEFT JOIN units u ON u.id = acc.unit_id
    WHERE ${
      opts.cheDo === "cho_nguoi"
        ? sql`a.grading_state = 'cho_nguoi'`
        : sql`a.grading_state = 'xong' AND a.graded_by = 'ai'`
    }
      AND (${opts.phamVi}::ltree IS NULL OR u.path <@ ${opts.phamVi}::ltree)
    ORDER BY t.submitted_at ${opts.cheDo === "cho_nguoi" ? sql`ASC` : sql`DESC`}
    LIMIT ${opts.limit ?? 50}`) as unknown as CauTuLuanCanCham[];
}

/**
 * Giảng viên chấm (hoặc chấm lại) một câu tự luận theo rubric: điểm thô từng tiêu chí, quy về
 * điểm câu bằng `tinhDiemRubric`. Câu đang chờ thì chốt lượt nếu đủ điểm; câu đã có điểm (phúc
 * khảo) thì tính lại điểm lượt. Ghi nhật ký kèm điểm cũ.
 */
export async function chamTayCauTuLuan(opts: {
  attemptId: string;
  ordinal: number;
  diemTieuChi: Record<string, number>;
  nhanXet?: string | null;
  reviewer: string;
  now?: Date;
}): Promise<{ points: number; maxPoints: number }> {
  const now = opts.now ?? new Date();
  const luot = await layLuot(opts.attemptId);
  if (!luot) throw new LoiNghiepVu("Không tìm thấy lượt thi.", "khong_tim_thay");
  if (luot.status === "dang_lam") throw new LoiNghiepVu("Lượt thi chưa nộp.", "xung_dot");
  const item = luot.items[opts.ordinal - 1];
  if (item?.noi_dung.kind !== "tu_luan") {
    throw new LoiNghiepVu(`Câu số ${opts.ordinal} không phải câu tự luận.`, "khong_hop_le");
  }
  const rubric = item.noi_dung.rubric;
  if (!laRubric(rubric)) throw new LoiNghiepVu("Câu này không có tiêu chí chấm.", "khong_hop_le");
  const [cu] = (await sql`
    SELECT points::float AS points, grading_state, response FROM exam_answers
    WHERE attempt_id = ${opts.attemptId} AND ordinal = ${opts.ordinal}`) as any[];
  if (!cu) throw new LoiNghiepVu("Câu này bỏ trống, không có bài để chấm.", "khong_hop_le");
  if (cu.grading_state === "dang_ai" || cu.grading_state === "cho_ai") {
    throw new LoiNghiepVu("Mô hình đang chấm câu này. Hãy thử lại sau ít phút.", "xung_dot");
  }

  const maxPoints = diemCau(item);
  const phanTram = tinhDiemRubric(rubric, opts.diemTieuChi);
  const points = Math.round((phanTram / 100) * maxPoints * 100) / 100;
  const feedback = {
    tom_tat: opts.nhanXet?.trim() || "Giảng viên đã chấm bài này.",
    tieu_chi: rubric.tieu_chi.map((tc) => ({
      ma: tc.ma,
      ten: tc.ten,
      diem: Math.min(Math.max(opts.diemTieuChi[tc.ma] ?? 0, 0), diemToiDaTieuChi(tc)),
      diem_toi_da: diemToiDaTieuChi(tc),
    })),
    can_cu: item.noi_dung.citations,
  };
  await sql`
    UPDATE exam_answers SET points = ${points}, max_points = ${maxPoints}, correct = ${phanTram >= rubric.nguong_dat},
      feedback = ${sql.json(feedback as never)}, graded_by = 'nguoi', grading_state = 'xong',
      reviewer = ${opts.reviewer}, reviewed_at = ${now}
    WHERE attempt_id = ${opts.attemptId} AND ordinal = ${opts.ordinal}`;
  await chotLuotNeuDu(opts.attemptId, now);
  await ghiNhatKy(opts.reviewer, "thi:cham_tu_luan", opts.attemptId, {
    cau: opts.ordinal,
    diem_cu: cu.points,
    diem_moi: points,
    trang_thai_cu: cu.grading_state,
  });
  return { points, maxPoints };
}

/** Điểm, nhận xét và trạng thái chấm từng câu của một lượt (trang kết quả). */
export async function ketQuaTungCau(attemptId: string): Promise<
  Map<
    number,
    {
      response: TraLoiCauHoi;
      correct: boolean | null;
      points: number | null;
      max_points: number | null;
      feedback: unknown;
      graded_by: string | null;
      grading_state: string;
    }
  >
> {
  const rows = (await sql`
    SELECT ordinal, response, correct, points::float AS points, max_points::float AS max_points, feedback,
           graded_by, grading_state
    FROM exam_answers WHERE attempt_id = ${attemptId}`) as any[];
  return new Map(rows.map((r) => [r.ordinal as number, r]));
}

/**
 * Tự nộp mọi lượt đã quá hạn + khoảng bù (worker gọi mỗi phút, kể cả khi người thi đã đóng trình
 * duyệt). Trả số lượt đã nộp.
 */
export async function tuNopLuotQuaHan(now: Date = new Date(), accountId?: string): Promise<number> {
  const moc = new Date(now.getTime() - DUNG_SAI_NOP_GIAY * 1000);
  // accountId: API chỉ dọn lượt của chính người đang xem; worker bỏ trống để quét tất cả.
  const rows = (await sql`
    SELECT id FROM exam_attempts
    WHERE status = 'dang_lam' AND deadline_at < ${moc}
      AND (${accountId ?? null}::uuid IS NULL OR account_id = ${accountId ?? null}::uuid)
    ORDER BY deadline_at LIMIT 500`) as any[];
  for (const r of rows) await nopLuot(r.id, "het_gio", now);
  return rows.length;
}

async function ghiNhatKy(actor: string, action: string, target: string, detail: unknown) {
  await sql`INSERT INTO audit_log (actor, action, target, detail)
            VALUES (${actor}, ${action}, ${target}, ${sql.json(detail as never)})`;
}
