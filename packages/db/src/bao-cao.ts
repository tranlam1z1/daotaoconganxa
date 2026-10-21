/**
 * Truy vấn báo cáo cho lãnh đạo và cán bộ quản lý (docs/PLAN.md GĐ7).
 *
 * Bốn báo cáo: kết quả một đề thi, tổng hợp đơn vị, luyện tập, câu hỏi khó. GĐ16c thêm báo cáo
 * thứ năm, tiến độ học của từng người. Cuối tệp là hồ sơ chi tiết của một cán bộ và số liệu cho
 * trang Tổng quan của khu quản trị, cả hai đếm cùng cách với báo cáo tiến độ học.
 *
 * PHẠM VI áp ở chính câu truy vấn, không chỉ ở giao diện: mọi hàm nhận `phamVi` (đường dẫn
 * ltree của đơn vị gốc người gọi được xem; null là toàn bộ, chỉ dành cho quản trị) và chỉ đếm
 * người có đơn vị hiện tại nằm trong cây đó. `donVi` thu hẹp thêm; lớp route kiểm `donVi` nằm
 * trong phạm vi trước khi gọi.
 *
 * Ngày lọc (`tu`, `den`) là ngày theo giờ Việt Nam, tính cả hai đầu.
 *
 * Không hàm nào đọc `exam_attempts.items`: cột đó là ảnh chụp đề kèm đáp án.
 */
import { chiSoCauHoi, NHAN_KET_LUAN_CAU_HOI, TEN_MUC_DO, trungBinhXuong } from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { hoSoChuDe } from "./ho-so-chu-de.ts";
import { demChoXacMinh } from "./nguoi-dung.ts";
import { lanHocGanNhat, phanTramCacNhomCuaNguoi } from "./nhom-hoc.ts";

export interface LocBaoCao {
  /** Đường dẫn ltree đơn vị gốc được xem; null là toàn bộ. */
  phamVi: string | null;
  /** Đường dẫn ltree đơn vị đang lọc (đã kiểm nằm trong phạm vi). */
  donVi?: string | null;
  /** YYYY-MM-DD, giờ Việt Nam, tính cả ngày này. */
  tu?: string | null;
  den?: string | null;
}

const MUI_GIO = "Asia/Ho_Chi_Minh";

/** Điều kiện "đơn vị của người nằm trong phạm vi và trong đơn vị đang lọc" trên cột `cot`. */
function trongCay(cot: ReturnType<typeof sql>, l: LocBaoCao) {
  return sql`
    ${l.phamVi !== null ? sql`AND ${cot} <@ ${l.phamVi}::ltree` : sql``}
    ${l.donVi ? sql`AND ${cot} <@ ${l.donVi}::ltree` : sql``}`;
}

/** Điều kiện khoảng ngày trên cột thời điểm `cot`, viết để dùng được index. */
function trongKhoangNgay(cot: ReturnType<typeof sql>, l: LocBaoCao) {
  return sql`
    ${l.tu ? sql`AND ${cot} >= (${l.tu}::date::timestamp AT TIME ZONE ${MUI_GIO})` : sql``}
    ${l.den ? sql`AND ${cot} < ((${l.den}::date + 1)::timestamp AT TIME ZONE ${MUI_GIO})` : sql``}`;
}

function soHoac0(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Tỷ lệ phần trăm, một chữ số thập phân; null khi mẫu số bằng 0. */
function phanTram(tu: number, mau: number): number | null {
  return mau > 0 ? Math.round((tu / mau) * 1000) / 10 : null;
}

function lamTron(n: number | null, so = 2): number | null {
  if (n === null) return null;
  const k = 10 ** so;
  return Math.round(n * k) / k;
}

/* ------------------------------------------------------------------ */
/* Bộ lọc                                                              */
/* ------------------------------------------------------------------ */

export interface DeThiChoBaoCao {
  id: string;
  code: string;
  title: string;
  pass_score: number;
  status: string;
}

/** Đề đã xuất bản hoặc đã đóng, để chọn trong bộ lọc báo cáo. */
export async function deThiChoBaoCao(): Promise<DeThiChoBaoCao[]> {
  return (await sql`
    SELECT id, code, title, pass_score, status FROM exams
    WHERE status IN ('xuat_ban', 'dong')
    ORDER BY published_at DESC NULLS LAST, created_at DESC`) as unknown as DeThiChoBaoCao[];
}

/* ------------------------------------------------------------------ */
/* 1. Kết quả một đề thi                                               */
/* ------------------------------------------------------------------ */

export interface DongKetQuaThi {
  xep_hang: number;
  ho_ten: string;
  ten_dang_nhap: string | null;
  cap_bac: string | null;
  don_vi: string | null;
  diem: number;
  dat: boolean;
  ket_qua: string;
  so_cau_dung: number | null;
  so_cau: number;
  giay_lam: number;
  thoi_gian_lam: string;
  so_lan: number;
  nop_luc: Date;
}

export interface KetQuaDeThi {
  de: DeThiChoBaoCao;
  dong: DongKetQuaThi[];
  tong_hop: { so_nguoi: number; diem_trung_binh: number | null; so_dat: number; ty_le_dat: number | null };
}

/** "25 phút 04 giây" */
export function thoiGianDoc(giay: number): string {
  const p = Math.floor(giay / 60);
  const g = giay % 60;
  return p ? `${p} phút ${String(g).padStart(2, "0")} giây` : `${g} giây`;
}

/**
 * Kết quả từng người với một đề: lượt đã nộp có điểm cao nhất (view `v_ket_qua_thi`), số lần
 * đã nộp, thời gian làm của lượt đó. Xếp hạng theo điểm, bằng điểm thì ai làm nhanh hơn đứng
 * trước. Khoảng ngày lọc theo lúc nộp của lượt được tính.
 */
export async function ketQuaDeThi(examId: string, l: LocBaoCao): Promise<KetQuaDeThi | null> {
  const [de] = (await sql`
    SELECT id, code, title, pass_score, status FROM exams WHERE id = ${examId}`) as unknown as DeThiChoBaoCao[];
  if (!de) return null;
  const rows = (await sql`
    SELECT ho_ten, username, rank_title, unit_name, score, passed, correct, total, giay_lam, so_lan, submitted_at,
           rank() OVER (ORDER BY score DESC NULLS LAST, giay_lam ASC)::int AS xep_hang
    FROM v_ket_qua_thi k
    WHERE k.exam_id = ${examId}
      ${trongCay(sql`k.unit_path`, l)}
      ${trongKhoangNgay(sql`k.submitted_at`, l)}
    ORDER BY xep_hang, ho_ten`) as any[];
  const dong: DongKetQuaThi[] = rows.map((r) => ({
    xep_hang: r.xep_hang,
    ho_ten: r.ho_ten ?? "",
    ten_dang_nhap: r.username,
    cap_bac: r.rank_title,
    don_vi: r.unit_name,
    diem: soHoac0(r.score),
    dat: Boolean(r.passed),
    ket_qua: r.passed ? "Đạt" : "Không đạt",
    so_cau_dung: r.correct,
    so_cau: r.total,
    giay_lam: r.giay_lam,
    thoi_gian_lam: thoiGianDoc(r.giay_lam),
    so_lan: r.so_lan,
    nop_luc: r.submitted_at,
  }));
  const soDat = dong.filter((d) => d.dat).length;
  return {
    de,
    dong,
    tong_hop: {
      so_nguoi: dong.length,
      diem_trung_binh: dong.length ? lamTron(dong.reduce((s, d) => s + d.diem, 0) / dong.length) : null,
      so_dat: soDat,
      ty_le_dat: phanTram(soDat, dong.length),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Tổng hợp đơn vị                                                  */
/* ------------------------------------------------------------------ */

export interface DongTongHopDonVi {
  xep_hang: number | null;
  don_vi_id: string;
  don_vi: string;
  so_duoc_giao: number;
  so_da_lam: number;
  ty_le_hoan_thanh: number | null;
  so_dat: number;
  ty_le_dat: number | null;
  diem_trung_binh: number | null;
}

/**
 * Tổng hợp một đề theo các đơn vị CÙNG CẤP: các đơn vị con trực tiếp của đơn vị đang lọc (không
 * lọc thì của gốc phạm vi; quản trị không lọc thì các đơn vị gốc). Đơn vị không có con thì hiện
 * chính nó. Mỗi dòng cộng dồn cả cây con của đơn vị đó.
 *
 * - Được giao: tài khoản đang hoạt động thuộc diện của một bài giao chưa hủy (giao thẳng cho
 *   người, cho đơn vị của người, hoặc cho đơn vị cấp trên có kèm cấp dưới).
 * - Đã làm: người có ít nhất một lượt đã nộp (tính lượt tốt nhất, như báo cáo kết quả đề).
 * - Xếp hạng theo tỷ lệ đạt rồi điểm trung bình; đơn vị chưa ai làm không xếp hạng.
 */
export async function tongHopDonVi(examId: string, l: LocBaoCao): Promise<DongTongHopDonVi[]> {
  const goc = l.donVi ?? l.phamVi;
  const rows = (await sql`
    WITH cap AS (
      SELECT u.id, u.name, u.path, u.ordinal FROM units u
      WHERE ${goc === null ? sql`u.parent_id IS NULL` : sql`u.parent_id = (SELECT id FROM units WHERE path = ${goc}::ltree)`}
      UNION ALL
      -- Gốc không có đơn vị con: hiện chính nó.
      SELECT u.id, u.name, u.path, u.ordinal FROM units u
      WHERE ${goc === null ? sql`false` : sql`u.path = ${goc}::ltree`}
        AND NOT EXISTS (SELECT 1 FROM units c WHERE c.parent_id = u.id)
    ),
    giao AS (
      SELECT DISTINCT acc.id, au.path
      FROM exam_assignments a
      LEFT JOIN units gu ON gu.id = a.unit_id
      JOIN accounts acc ON acc.enabled
      JOIN units au ON au.id = acc.unit_id
      WHERE a.exam_id = ${examId} AND a.cancelled_at IS NULL
        AND (acc.id = a.account_id OR au.id = a.unit_id OR (a.include_subunits AND au.path <@ gu.path))
    ),
    kq AS (
      SELECT k.unit_path AS path, k.score, k.passed FROM v_ket_qua_thi k
      WHERE k.exam_id = ${examId} ${trongKhoangNgay(sql`k.submitted_at`, l)}
    )
    SELECT c.id, c.name,
      (SELECT count(*) FROM giao g WHERE g.path <@ c.path)::int AS so_duoc_giao,
      (SELECT count(*) FROM kq WHERE kq.path <@ c.path)::int AS so_da_lam,
      (SELECT count(*) FILTER (WHERE kq.passed) FROM kq WHERE kq.path <@ c.path)::int AS so_dat,
      (SELECT avg(kq.score) FROM kq WHERE kq.path <@ c.path) AS diem_tb
    FROM cap c
    WHERE true ${trongCay(sql`c.path`, { phamVi: l.phamVi })}
    ORDER BY c.ordinal, c.name`) as any[];

  const dong: DongTongHopDonVi[] = rows.map((r) => ({
    xep_hang: null,
    don_vi_id: r.id,
    don_vi: r.name,
    so_duoc_giao: r.so_duoc_giao,
    so_da_lam: r.so_da_lam,
    ty_le_hoan_thanh: phanTram(r.so_da_lam, r.so_duoc_giao),
    so_dat: r.so_dat,
    ty_le_dat: phanTram(r.so_dat, r.so_da_lam),
    diem_trung_binh: r.diem_tb === null ? null : lamTron(Number(r.diem_tb)),
  }));
  // Xếp hạng kiểu thi đấu: bằng nhau thì cùng hạng, hạng sau bỏ qua số tương ứng.
  const coLam = dong
    .filter((d) => d.so_da_lam > 0)
    .sort(
      (a, b) =>
        (b.ty_le_dat ?? 0) - (a.ty_le_dat ?? 0) || (b.diem_trung_binh ?? 0) - (a.diem_trung_binh ?? 0),
    );
  coLam.forEach((d, i) => {
    const truoc = coLam[i - 1];
    d.xep_hang =
      truoc && truoc.ty_le_dat === d.ty_le_dat && truoc.diem_trung_binh === d.diem_trung_binh
        ? truoc.xep_hang
        : i + 1;
  });
  return [...coLam, ...dong.filter((d) => d.so_da_lam === 0)];
}

/* ------------------------------------------------------------------ */
/* 3. Luyện tập                                                        */
/* ------------------------------------------------------------------ */

export type NhomLuyenTap = "nguoi" | "don_vi" | "chu_de";

/**
 * Nguồn phiên được tính là luyện tập. Phiên chơi game (GĐ10, `source` dạng `game:...`) dùng chung
 * bảng `practice_sessions` nhưng không tính vào báo cáo luyện tập. Báo cáo câu hỏi khó thì vẫn
 * gộp mọi câu trả lời, vì câu trả lời trong game cũng cho biết câu nào hay bị sai. Phiên đề ôn
 * tập của nhóm học cùng (`nhom`) được tính (docs/PLAN.md GĐ16a, câu N6).
 */
const NGUON_LUYEN_TAP = ["chu_de", "cau_sai", "thu_thach", "nhom"];

export interface DongLuyenTap {
  nhom: string;
  /** Đơn vị của người (khi nhóm theo người). */
  don_vi: string | null;
  so_phien: number;
  so_cau: number;
  so_dung: number;
  ty_le_dung: number | null;
}

/**
 * Luyện tập theo người, theo đơn vị (đơn vị trực tiếp của người) hoặc theo chủ đề câu hỏi. Chỉ
 * tính các phiên có nguồn trong `NGUON_LUYEN_TAP`.
 * Đếm từ câu trả lời trong khoảng ngày; `so_phien` là số phiên có ít nhất một câu trả lời
 * trong khoảng đó.
 */
export async function baoCaoLuyenTap(theo: NhomLuyenTap, l: LocBaoCao): Promise<DongLuyenTap[]> {
  const khoa = theo === "nguoi" ? sql`acc.id` : theo === "don_vi" ? sql`au.id` : sql`q.topic_id`;
  const ten =
    theo === "nguoi"
      ? sql`COALESCE(acc.name, acc.username, acc.email)`
      : theo === "don_vi"
        ? sql`au.name`
        : sql`COALESCE(t.name, 'Chưa có chủ đề')`;
  const rows = (await sql`
    SELECT ${ten} AS nhom,
           ${theo === "nguoi" ? sql`au.name` : sql`NULL::text`} AS don_vi,
           count(DISTINCT s.id)::int AS so_phien,
           count(*)::int AS so_cau,
           count(*) FILTER (WHERE pa.correct)::int AS so_dung
    FROM practice_answers pa
    JOIN practice_sessions s ON s.id = pa.session_id
    JOIN accounts acc ON acc.id = s.account_id
    JOIN units au ON au.id = acc.unit_id
    LEFT JOIN questions q ON q.id = pa.question_id
    LEFT JOIN question_topics t ON t.id = q.topic_id
    WHERE s.source IN ${sql(NGUON_LUYEN_TAP)}
      ${trongCay(sql`au.path`, l)}
      ${trongKhoangNgay(sql`pa.created_at`, l)}
    GROUP BY ${khoa}, 1, 2
    ORDER BY so_cau DESC, nhom`) as any[];
  return rows.map((r) => ({
    nhom: r.nhom,
    don_vi: r.don_vi,
    so_phien: r.so_phien,
    so_cau: r.so_cau,
    so_dung: r.so_dung,
    ty_le_dung: phanTram(r.so_dung, r.so_cau),
  }));
}

/* ------------------------------------------------------------------ */
/* 4. Câu hỏi khó                                                      */
/* ------------------------------------------------------------------ */

export interface DongCauHoiKho {
  cau_hoi_id: string;
  ma_cau: string;
  cau_hoi: string;
  chu_de: string | null;
  muc_do: string;
  so_luot: number;
  ty_le_sai: number;
  do_phan_biet: number;
  nhan_xet: string;
}

/**
 * Câu có tỷ lệ sai cao nhất, gộp câu trả lời thi (lượt đã nộp) và luyện tập của người trong
 * phạm vi. Độ khó và độ phân biệt tính bằng `chiSoCauHoi` của @qdpl/dao-tao: mỗi lượt thi hoặc
 * phiên luyện tập được coi là một người làm, mỗi câu trả lời là một lần làm đầu tiên.
 * Có `examId` thì chỉ lấy câu trả lời của đề đó (bỏ luyện tập).
 */
export async function cauHoiKho(
  l: LocBaoCao,
  o: { examId?: string | null; toiThieuLuot?: number; gioiHan?: number } = {},
): Promise<DongCauHoiKho[]> {
  const traLoi = (await sql`
    SELECT ea.question_id, ea.attempt_id AS nhom, ea.correct
    FROM exam_answers ea
    JOIN exam_attempts t ON t.id = ea.attempt_id AND t.status = 'da_nop'
    JOIN accounts acc ON acc.id = t.account_id
    JOIN units au ON au.id = acc.unit_id
    WHERE ea.correct IS NOT NULL
      ${o.examId ? sql`AND t.exam_id = ${o.examId}` : sql``}
      ${trongCay(sql`au.path`, l)}
      ${trongKhoangNgay(sql`t.submitted_at`, l)}
    ${
      o.examId
        ? sql``
        : sql`
    UNION ALL
    SELECT pa.question_id, pa.session_id AS nhom, pa.correct
    FROM practice_answers pa
    JOIN practice_sessions s ON s.id = pa.session_id
    JOIN accounts acc ON acc.id = s.account_id
    JOIN units au ON au.id = acc.unit_id
    WHERE true
      ${trongCay(sql`au.path`, l)}
      ${trongKhoangNgay(sql`pa.created_at`, l)}`
    }`) as unknown as Array<{ question_id: string; nhom: string; correct: boolean }>;

  const chiSo = chiSoCauHoi(
    traLoi.map((r) => ({
      activityId: r.question_id,
      enrollmentId: r.nhom,
      attemptNo: 1,
      score: r.correct ? 1 : 0,
      maxScore: 1,
      passed: r.correct,
      secondsSpent: 0,
      errorTags: [],
    })),
  )
    .filter((c) => c.soLuot >= (o.toiThieuLuot ?? 1))
    .sort((a, b) => a.doKho - b.doKho || b.soLuot - a.soLuot)
    .slice(0, o.gioiHan ?? 50);
  if (!chiSo.length) return [];

  const ids = chiSo.map((c) => c.activityId);
  const cau = new Map(
    (
      (await sql`
      SELECT q.id, q.code, q.stem, q.level, t.name AS topic_name
      FROM questions q LEFT JOIN question_topics t ON t.id = q.topic_id
      WHERE q.id = ANY(${ids}::uuid[])`) as any[]
    ).map((r) => [r.id as string, r]),
  );
  return chiSo.map((c) => {
    const q = cau.get(c.activityId);
    return {
      cau_hoi_id: c.activityId,
      ma_cau: q?.code ?? "",
      cau_hoi: q?.stem ?? "(câu đã bị xóa)",
      chu_de: q?.topic_name ?? null,
      muc_do: q ? (TEN_MUC_DO[q.level as keyof typeof TEN_MUC_DO] ?? q.level) : "",
      so_luot: c.soLuot,
      ty_le_sai: Math.round((1 - c.doKho) * 1000) / 10,
      do_phan_biet: c.doPhanBiet,
      nhan_xet: NHAN_KET_LUAN_CAU_HOI[c.ketLuan],
    };
  });
}

/* ------------------------------------------------------------------ */
/* 5. Tiến độ học (GĐ16c)                                              */
/* ------------------------------------------------------------------ */

export interface LocTienDoHoc extends LocBaoCao {
  /** Chỉ lấy thành viên đang ở trong nhóm này (route đã kiểm nhóm nằm trong phạm vi). */
  nhom?: string | null;
  /** Tìm theo họ tên, tên đăng nhập hoặc số hiệu. */
  q?: string | null;
}

export interface DongTienDoHoc {
  /** Id tài khoản, để mở hồ sơ chi tiết của người này. */
  id: string;
  ho_ten: string;
  cap_bac: string | null;
  don_vi: string;
  bai_xong: number;
  bai_ghi_danh: number;
  phan_tram_bai_hoc: number | null;
  so_phien: number;
  so_cau: number;
  ty_le_dung: number | null;
  bai_thi_duoc_giao: number;
  bai_thi_da_nop: number;
  bai_thi_dat: number;
  so_nhom: number;
  phan_tram_nhom: number | null;
  lan_hoc_gan_nhat: Date | null;
}

/**
 * Tiến độ học của từng người trong phạm vi (docs/PLAN.md GĐ16c, N13, đề xuất Đ12), mỗi người một
 * dòng, kể cả người chưa học gì.
 *
 * - Người: tài khoản đang hoạt động, vai trò từ `can_bo` trở lên, có đơn vị hiện tại trong phạm vi
 *   và trong đơn vị đang lọc. Tài khoản chưa gắn đơn vị không có trong báo cáo, như các báo cáo trên.
 *   Xếp đơn vị cấp trên trước, cùng cấp theo thứ tự đơn vị, rồi họ tên.
 * - Bài đã ghi danh: bài `xuat_ban` thuộc chuyên đề `xuat_ban` mà người đó đã ghi danh. Bài đã
 *   xong: trong số đó, bài có tiến độ `xong`, lọc khoảng ngày theo lúc xong.
 * - Luyện tập: như báo cáo luyện tập theo người (nguồn `NGUON_LUYEN_TAP`, đếm câu trả lời trong
 *   khoảng ngày).
 * - Bài thi được giao: số đề có bài giao chưa hủy phủ người đó, như cột "Được giao" của báo cáo
 *   tổng hợp đơn vị; không lọc ngày. Đã nộp, đạt: trong các đề đó, đề có lượt đã nộp, có lượt đạt
 *   (lọc khoảng ngày theo lúc nộp).
 * - Nhóm: các nhóm đang hoạt động người đó đang ở trong; phần trăm là trung bình làm tròn xuống
 *   của phần trăm chung trong từng nhóm, tính như trang nhóm.
 * - Lần học gần nhất: `lanHocGanNhat`, không lọc ngày.
 */
export async function tienDoHocVien(l: LocTienDoHoc): Promise<DongTienDoHoc[]> {
  const tuKhoa = l.q?.trim() ? `%${l.q.trim()}%` : null;
  const rows = (await sql`
    WITH nguoi AS (
      SELECT a.id, COALESCE(NULLIF(a.name, ''), a.username, a.email) AS ho_ten, a.rank_title,
             a.unit_id, u.name AS don_vi, u.path, u.ordinal AS thu_tu_don_vi
      FROM accounts a
      JOIN units u ON u.id = a.unit_id
      WHERE a.enabled AND a.role <> 'khach'
        ${trongCay(sql`u.path`, l)}
        ${
          l.nhom
            ? sql`AND EXISTS (SELECT 1 FROM study_group_members m
                               WHERE m.group_id = ${l.nhom} AND m.account_id = a.id AND m.left_at IS NULL)`
            : sql``
        }
        ${
          tuKhoa
            ? sql`AND (a.name ILIKE ${tuKhoa} OR a.username ILIKE ${tuKhoa} OR a.so_hieu ILIKE ${tuKhoa})`
            : sql``
        }
    ),
    bai AS (
      SELECT e.account_id, count(*)::int AS ghi_danh,
             count(*) FILTER (WHERE lp.state = 'xong'
               ${trongKhoangNgay(sql`COALESCE(lp.finished_at, lp.updated_at)`, l)})::int AS xong
      FROM nguoi n
      JOIN enrollments e ON e.account_id = n.id
      JOIN courses c ON c.id = e.course_id AND c.status = 'xuat_ban'
      JOIN lessons ls ON ls.course_id = c.id AND ls.status = 'xuat_ban'
      LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = ls.id
      GROUP BY e.account_id
    ),
    lt AS (
      SELECT s.account_id, count(DISTINCT s.id)::int AS so_phien, count(*)::int AS so_cau,
             count(*) FILTER (WHERE pa.correct)::int AS so_dung
      FROM nguoi n
      JOIN practice_sessions s ON s.account_id = n.id
      JOIN practice_answers pa ON pa.session_id = s.id
      WHERE s.source IN ${sql(NGUON_LUYEN_TAP)}
        ${trongKhoangNgay(sql`pa.created_at`, l)}
      GROUP BY s.account_id
    ),
    giao AS (
      SELECT DISTINCT n.id AS account_id, a.exam_id
      FROM exam_assignments a
      LEFT JOIN units gu ON gu.id = a.unit_id
      JOIN nguoi n ON n.id = a.account_id OR n.unit_id = a.unit_id OR (a.include_subunits AND n.path <@ gu.path)
      WHERE a.cancelled_at IS NULL
    ),
    nop AS (
      SELECT t.account_id, t.exam_id, bool_or(t.passed) AS dat
      FROM exam_attempts t
      JOIN nguoi n ON n.id = t.account_id
      WHERE t.status = 'da_nop' ${trongKhoangNgay(sql`t.submitted_at`, l)}
      GROUP BY t.account_id, t.exam_id
    ),
    thi AS (
      SELECT g.account_id, count(*)::int AS duoc_giao, count(nop.exam_id)::int AS da_nop,
             count(*) FILTER (WHERE nop.dat)::int AS dat
      FROM giao g
      LEFT JOIN nop ON nop.account_id = g.account_id AND nop.exam_id = g.exam_id
      GROUP BY g.account_id
    )
    SELECT n.id, n.ho_ten, n.rank_title, n.don_vi,
           COALESCE(bai.ghi_danh, 0) AS ghi_danh, COALESCE(bai.xong, 0) AS xong,
           COALESCE(lt.so_phien, 0) AS so_phien, COALESCE(lt.so_cau, 0) AS so_cau,
           COALESCE(lt.so_dung, 0) AS so_dung,
           COALESCE(thi.duoc_giao, 0) AS duoc_giao, COALESCE(thi.da_nop, 0) AS da_nop,
           COALESCE(thi.dat, 0) AS dat
    FROM nguoi n
    LEFT JOIN bai ON bai.account_id = n.id
    LEFT JOIN lt ON lt.account_id = n.id
    LEFT JOIN thi ON thi.account_id = n.id
    ORDER BY nlevel(n.path), n.thu_tu_don_vi, n.don_vi, n.ho_ten, n.id`) as any[];

  const ids = rows.map((r) => r.id as string);
  const [nhom, ganNhat] = await Promise.all([phanTramCacNhomCuaNguoi(ids), lanHocGanNhat(ids)]);
  return rows.map((r) => {
    const cacNhom = nhom.get(r.id) ?? [];
    return {
      id: r.id,
      ho_ten: r.ho_ten ?? "",
      cap_bac: r.rank_title,
      don_vi: r.don_vi,
      bai_xong: r.xong,
      bai_ghi_danh: r.ghi_danh,
      phan_tram_bai_hoc: phanTram(r.xong, r.ghi_danh),
      so_phien: r.so_phien,
      so_cau: r.so_cau,
      ty_le_dung: phanTram(r.so_dung, r.so_cau),
      bai_thi_duoc_giao: r.duoc_giao,
      bai_thi_da_nop: r.da_nop,
      bai_thi_dat: r.dat,
      so_nhom: cacNhom.length,
      phan_tram_nhom: trungBinhXuong(cacNhom.filter((v): v is number => v !== null)),
      lan_hoc_gan_nhat: ganNhat.get(r.id) ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 6. Hồ sơ một cán bộ                                                 */
/* ------------------------------------------------------------------ */

export interface CanBoBaoCao {
  id: string;
  ho_ten: string;
  ten_dang_nhap: string | null;
  cap_bac: string | null;
  so_hieu: string | null;
  don_vi_id: string;
  don_vi: string;
  /** Đường dẫn ltree của đơn vị, để tìm bài giao phủ người này. */
  duong_dan: string;
}

/**
 * Cán bộ có hồ sơ xem được trong phạm vi: cùng điều kiện với một dòng của báo cáo tiến độ học (tài
 * khoản đang hoạt động, không phải khách, đơn vị hiện tại nằm trong cây `phamVi`). Không có và
 * ngoài phạm vi đều trả null, để lớp route trả cùng một lỗi.
 */
export async function canBoTrongPhamVi(id: string, phamVi: string | null): Promise<CanBoBaoCao | null> {
  const [r] = (await sql`
    SELECT a.id, COALESCE(NULLIF(a.name, ''), a.username, a.email) AS ho_ten, a.username AS ten_dang_nhap,
           a.rank_title AS cap_bac, a.so_hieu, u.id AS don_vi_id, u.name AS don_vi, u.path::text AS duong_dan
    FROM accounts a
    JOIN units u ON u.id = a.unit_id
    WHERE a.id = ${id} AND a.enabled AND a.role <> 'khach'
      ${trongCay(sql`u.path`, { phamVi })}`) as unknown as CanBoBaoCao[];
  return r ?? null;
}

export type TrangThaiBaiThi = "dat" | "khong_dat" | "cho_cham" | "dang_lam" | "qua_han" | "chua_lam";

export const TEN_TRANG_THAI_BAI_THI: Record<TrangThaiBaiThi, string> = {
  dat: "Đạt",
  khong_dat: "Không đạt",
  cho_cham: "Chờ chấm tự luận",
  dang_lam: "Đang làm",
  qua_han: "Quá hạn, chưa làm",
  chua_lam: "Chưa làm",
};

export interface BaiThiCuaCanBo {
  de_thi_id: string;
  ma_de: string;
  ten_de: string;
  nguong_dat: number;
  /** Đề còn bài giao chưa hủy phủ người này; false là đề đã làm nhưng bài giao đã hủy. */
  duoc_giao: boolean;
  han: Date | null;
  trang_thai: TrangThaiBaiThi;
  ket_qua: string;
  /** Điểm, số câu của lượt đã nộp có điểm cao nhất. */
  diem: number | null;
  so_cau_dung: number | null;
  so_cau: number | null;
  /** Điểm phần tự luận của lượt đó; null khi đề không có câu tự luận. */
  diem_tu_luan: number | null;
  tu_luan_toi_da: number | null;
  so_lan: number;
  nop_luc: Date | null;
}

export interface BaiHocCuaCanBo {
  chuyen_de_id: string;
  chuyen_de: string;
  bai_xong: number;
  tong_bai: number;
  phan_tram: number | null;
  /** Số bài tập trong bài học đã làm ít nhất một lần; `so_tu_luan` là số bài AI hoặc người chấm. */
  so_bai_tap: number;
  so_tu_luan: number;
  /** Trung bình điểm tốt nhất của từng bài tập, theo phần trăm. */
  diem_bai_tap: number | null;
  ghi_danh_luc: Date;
  lan_hoc_gan_nhat: Date | null;
}

export interface ChuDeCuaCanBo {
  chu_de: string;
  so_phien: number;
  so_cau: number;
  so_dung: number;
  ty_le_dung: number | null;
}

/** Chủ đề mạnh, yếu theo hồ sơ chủ đề (luyện tập, thi và trò chơi gộp lại). */
export interface ChuDeManhYeu {
  ten: string;
  so_luot: number;
  so_dung: number;
  /** Điểm trung bình trượt, theo phần trăm. */
  diem: number;
}

export interface HoSoCanBo {
  tong_quan: Pick<
    DongTienDoHoc,
    | "bai_xong"
    | "bai_ghi_danh"
    | "phan_tram_bai_hoc"
    | "so_phien"
    | "so_cau"
    | "ty_le_dung"
    | "bai_thi_duoc_giao"
    | "bai_thi_da_nop"
    | "bai_thi_dat"
    | "lan_hoc_gan_nhat"
  >;
  bai_thi: BaiThiCuaCanBo[];
  bai_hoc: BaiHocCuaCanBo[];
  luyen_tap: {
    so_phien: number;
    so_cau: number;
    so_dung: number;
    ty_le_dung: number | null;
    chu_de: ChuDeCuaCanBo[];
    manh: ChuDeManhYeu[];
    yeu: ChuDeManhYeu[];
  };
}

/**
 * Hồ sơ học tập của một cán bộ: từng đề thi, từng chuyên đề, luyện tập theo chủ đề, trò chơi và
 * điểm thưởng. Người gọi đã kiểm người này nằm trong phạm vi (`canBoTrongPhamVi`).
 *
 * Các con số đếm cùng cách với dòng của người đó ở báo cáo tiến độ học (`tienDoHocVien`), nên phần
 * `tong_quan` khớp với danh sách:
 * - Bài thi: mọi đề có bài giao chưa hủy phủ người này, cộng đề đã có lượt làm. Mỗi đề lấy lượt đã
 *   nộp có điểm cao nhất (bằng điểm thì lượt nộp sớm hơn), như view `v_ket_qua_thi`.
 * - Bài học: bài `xuat_ban` của chuyên đề `xuat_ban` đã ghi danh.
 * - Luyện tập: phiên có nguồn trong `NGUON_LUYEN_TAP`.
 *
 * Khoảng ngày (`tu`, `den`) áp cho lúc nộp bài thi, lúc xong bài học, lúc làm bài tập, câu trả lời
 * luyện tập và lúc chơi. XP, chuỗi ngày, huy hiệu, hạng, chủ đề mạnh yếu và lần học gần nhất không
 * lọc theo ngày.
 */
export async function hoSoCanBo(
  nguoi: CanBoBaoCao,
  l: Pick<LocBaoCao, "tu" | "den"> = {},
  now: Date = new Date(),
): Promise<HoSoCanBo> {
  const khoang: LocBaoCao = { phamVi: null, tu: l.tu, den: l.den };
  const id = nguoi.id;

  const [thi, hoc, chuDe, [tongLt], hoSo, ganNhat] = await Promise.all([
    sql`
      WITH giao AS (
        SELECT a.exam_id, max(a.due_at) AS han
        FROM exam_assignments a
        LEFT JOIN units gu ON gu.id = a.unit_id
        WHERE a.cancelled_at IS NULL
          AND (a.account_id = ${id} OR a.unit_id = ${nguoi.don_vi_id}
               OR (a.include_subunits AND ${nguoi.duong_dan}::ltree <@ gu.path))
        GROUP BY a.exam_id
      ),
      dang AS (
        SELECT t.exam_id, bool_or(t.status = 'cho_cham') AS cho_cham,
               bool_or(t.status = 'dang_lam') AS dang_lam
        FROM exam_attempts t
        WHERE t.account_id = ${id} AND t.status <> 'da_nop'
        GROUP BY t.exam_id
      ),
      nop AS (
        SELECT t.exam_id, t.id, t.score, t.correct, t.total, t.submitted_at,
               (count(*) OVER w)::int AS so_lan,
               bool_or(t.passed) OVER w AS dat,
               row_number() OVER (PARTITION BY t.exam_id
                                  ORDER BY t.score DESC NULLS LAST, t.submitted_at) AS thu
        FROM exam_attempts t
        WHERE t.account_id = ${id} AND t.status = 'da_nop'
          ${trongKhoangNgay(sql`t.submitted_at`, khoang)}
        WINDOW w AS (PARTITION BY t.exam_id)
      ),
      tl AS (
        SELECT ea.attempt_id, sum(ea.points)::float8 AS diem, sum(ea.max_points)::float8 AS toi_da
        FROM exam_answers ea
        JOIN nop ON nop.id = ea.attempt_id AND nop.thu = 1
        JOIN questions q ON q.id = ea.question_id AND q.kind = 'tu_luan'
        GROUP BY ea.attempt_id
      )
      SELECT e.id, e.code, e.title, e.pass_score, g.han, (g.exam_id IS NOT NULL) AS duoc_giao,
             COALESCE(d.cho_cham, false) AS cho_cham, COALESCE(d.dang_lam, false) AS dang_lam,
             n.id AS luot_id, n.score::float8 AS score, n.dat, n.correct, n.total, n.submitted_at,
             COALESCE(n.so_lan, 0) AS so_lan, tl.diem AS diem_tu_luan, tl.toi_da AS tu_luan_toi_da
      FROM exams e
      LEFT JOIN giao g ON g.exam_id = e.id
      LEFT JOIN dang d ON d.exam_id = e.id
      LEFT JOIN nop n ON n.exam_id = e.id AND n.thu = 1
      LEFT JOIN tl ON tl.attempt_id = n.id
      WHERE g.exam_id IS NOT NULL OR d.exam_id IS NOT NULL OR n.exam_id IS NOT NULL
      ORDER BY g.han DESC NULLS LAST, e.title, e.id` as unknown as Promise<any[]>,
    sql`
      WITH bt AS (
        SELECT e.course_id, tr.activity_id, bool_or(ac.mode IN ('ai', 'nguoi')) AS tu_luan,
               max(tr.score / NULLIF(tr.max_score, 0))::float8 AS ty_le
        FROM enrollments e
        JOIN attempts tr ON tr.enrollment_id = e.id
        JOIN activities ac ON ac.id = tr.activity_id
        WHERE e.account_id = ${id} ${trongKhoangNgay(sql`tr.created_at`, khoang)}
        GROUP BY e.course_id, tr.activity_id
      ),
      bai_tap AS (
        SELECT course_id, count(*)::int AS so_bai_tap, count(*) FILTER (WHERE tu_luan)::int AS so_tu_luan,
               avg(ty_le)::float8 AS ty_le
        FROM bt GROUP BY course_id
      )
      SELECT c.id, c.title, e.started_at, count(*)::int AS tong_bai,
             count(*) FILTER (WHERE lp.state = 'xong'
               ${trongKhoangNgay(sql`COALESCE(lp.finished_at, lp.updated_at)`, khoang)})::int AS bai_xong,
             max(lp.updated_at) AS lan_hoc,
             COALESCE(b.so_bai_tap, 0) AS so_bai_tap, COALESCE(b.so_tu_luan, 0) AS so_tu_luan, b.ty_le
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id AND c.status = 'xuat_ban'
      JOIN lessons ls ON ls.course_id = c.id AND ls.status = 'xuat_ban'
      LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = ls.id
      LEFT JOIN bai_tap b ON b.course_id = c.id
      WHERE e.account_id = ${id}
      GROUP BY c.id, e.id, b.so_bai_tap, b.so_tu_luan, b.ty_le
      ORDER BY max(lp.updated_at) DESC NULLS LAST, c.title` as unknown as Promise<any[]>,
    sql`
      SELECT COALESCE(t.name, 'Chưa có chủ đề') AS chu_de, count(DISTINCT s.id)::int AS so_phien,
             count(*)::int AS so_cau, count(*) FILTER (WHERE pa.correct)::int AS so_dung
      FROM practice_sessions s
      JOIN practice_answers pa ON pa.session_id = s.id
      LEFT JOIN questions q ON q.id = pa.question_id
      LEFT JOIN question_topics t ON t.id = q.topic_id
      WHERE s.account_id = ${id} AND s.source IN ${sql(NGUON_LUYEN_TAP)}
        ${trongKhoangNgay(sql`pa.created_at`, khoang)}
      GROUP BY q.topic_id, 1
      ORDER BY so_cau DESC, 1` as unknown as Promise<any[]>,
    // Một phiên có thể gồm câu của nhiều chủ đề, nên số phiên đếm riêng, không cộng từ bảng trên.
    sql`
      SELECT count(DISTINCT s.id)::int AS so_phien
      FROM practice_sessions s
      JOIN practice_answers pa ON pa.session_id = s.id
      WHERE s.account_id = ${id} AND s.source IN ${sql(NGUON_LUYEN_TAP)}
        ${trongKhoangNgay(sql`pa.created_at`, khoang)}` as unknown as Promise<any[]>,
    hoSoChuDe(id),
    lanHocGanNhat([id]),
  ]);

  const baiThi: BaiThiCuaCanBo[] = thi.map((r) => {
    const han = (r.han as Date | null) ?? null;
    const trangThai: TrangThaiBaiThi = r.luot_id
      ? r.dat
        ? "dat"
        : "khong_dat"
      : r.cho_cham
        ? "cho_cham"
        : r.dang_lam
          ? "dang_lam"
          : han && han.getTime() < now.getTime()
            ? "qua_han"
            : "chua_lam";
    return {
      de_thi_id: r.id,
      ma_de: r.code,
      ten_de: r.title,
      nguong_dat: r.pass_score,
      duoc_giao: r.duoc_giao,
      han,
      trang_thai: trangThai,
      ket_qua: TEN_TRANG_THAI_BAI_THI[trangThai],
      diem: r.luot_id ? soHoac0(r.score) : null,
      so_cau_dung: r.correct ?? null,
      so_cau: r.total ?? null,
      diem_tu_luan: r.tu_luan_toi_da === null ? null : lamTron(soHoac0(r.diem_tu_luan)),
      tu_luan_toi_da: r.tu_luan_toi_da === null ? null : lamTron(Number(r.tu_luan_toi_da)),
      so_lan: r.so_lan,
      nop_luc: r.submitted_at ?? null,
    };
  });

  const baiHoc: BaiHocCuaCanBo[] = hoc.map((r) => ({
    chuyen_de_id: r.id,
    chuyen_de: r.title,
    bai_xong: r.bai_xong,
    tong_bai: r.tong_bai,
    phan_tram: phanTram(r.bai_xong, r.tong_bai),
    so_bai_tap: r.so_bai_tap,
    so_tu_luan: r.so_tu_luan,
    diem_bai_tap: r.ty_le === null ? null : Math.round(Number(r.ty_le) * 1000) / 10,
    ghi_danh_luc: r.started_at,
    lan_hoc_gan_nhat: r.lan_hoc ?? null,
  }));

  const chuDeLt: ChuDeCuaCanBo[] = chuDe.map((r) => ({
    chu_de: r.chu_de,
    so_phien: r.so_phien,
    so_cau: r.so_cau,
    so_dung: r.so_dung,
    ty_le_dung: phanTram(r.so_dung, r.so_cau),
  }));
  const soCau = chuDeLt.reduce((s, c) => s + c.so_cau, 0);
  const soDung = chuDeLt.reduce((s, c) => s + c.so_dung, 0);
  const manhYeu = (ds: typeof hoSo.manh): ChuDeManhYeu[] =>
    ds.map((c) => ({ ten: c.ten, so_luot: c.attempts, so_dung: c.correct, diem: Math.round(c.diem * 100) }));

  const duocGiao = baiThi.filter((b) => b.duoc_giao);
  const baiXong = baiHoc.reduce((s, b) => s + b.bai_xong, 0);
  const tongBai = baiHoc.reduce((s, b) => s + b.tong_bai, 0);
  return {
    tong_quan: {
      bai_xong: baiXong,
      bai_ghi_danh: tongBai,
      phan_tram_bai_hoc: phanTram(baiXong, tongBai),
      so_phien: soHoac0(tongLt?.so_phien),
      so_cau: soCau,
      ty_le_dung: phanTram(soDung, soCau),
      bai_thi_duoc_giao: duocGiao.length,
      bai_thi_da_nop: duocGiao.filter((b) => b.nop_luc).length,
      bai_thi_dat: duocGiao.filter((b) => b.trang_thai === "dat").length,
      lan_hoc_gan_nhat: ganNhat.get(id) ?? null,
    },
    bai_thi: baiThi,
    bai_hoc: baiHoc,
    luyen_tap: {
      so_phien: soHoac0(tongLt?.so_phien),
      so_cau: soCau,
      so_dung: soDung,
      ty_le_dung: phanTram(soDung, soCau),
      chu_de: chuDeLt,
      manh: manhYeu(hoSo.manh),
      yeu: manhYeu(hoSo.yeu),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 7. Tổng quan cho trang đầu khu quản trị                              */
/* ------------------------------------------------------------------ */

export interface NguoiCanChuY {
  id: string;
  ho_ten: string;
  cap_bac: string | null;
  don_vi: string;
  /** Số đề chưa làm hoặc số đề chưa đạt; null với danh sách chưa học. */
  so: number | null;
}

export interface NhomCanChuY {
  tong: number;
  dong: NguoiCanChuY[];
}

export interface TongQuanCanBo {
  so_can_bo: number;
  /** Số người có lần học trong 7 ngày gần đây. */
  hoc_7_ngay: number;
  bai_thi: {
    duoc_giao: number;
    da_nop: number;
    dat: number;
    ty_le_hoan_thanh: number | null;
    ty_le_dat: number | null;
  };
  cho_xac_minh: number;
  can_chu_y: { chua_hoc: NhomCanChuY; chua_lam_bai: NhomCanChuY; khong_dat: NhomCanChuY };
}

/**
 * Số liệu gọn cho trang Tổng quan: tính trên chính các dòng của báo cáo tiến độ học (không lọc
 * ngày), nên luôn khớp với danh sách cán bộ. Mỗi nhóm "cần chú ý" trả tổng số người và
 * `gioiHan` người đầu: chưa học lần nào; còn đề được giao chưa nộp (nhiều đề nhất trước); có đề
 * đã nộp mà chưa đạt (nhiều đề nhất trước).
 */
export async function tongQuanCanBo(
  l: Pick<LocBaoCao, "phamVi" | "donVi">,
  now: Date = new Date(),
  gioiHan = 8,
): Promise<TongQuanCanBo> {
  const [dong, choXacMinh] = await Promise.all([
    tienDoHocVien({ phamVi: l.phamVi, donVi: l.donVi }),
    demChoXacMinh(l.donVi ?? l.phamVi),
  ]);
  const moc = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const nhom = (
    so: (d: DongTienDoHoc) => number | null,
    chon: (d: DongTienDoHoc) => boolean,
  ): NhomCanChuY => {
    const ds = dong.filter(chon);
    // Array.prototype.sort ổn định: người cùng số giữ thứ tự đơn vị, họ tên của báo cáo.
    const xep = [...ds].sort((a, b) => (so(b) ?? 0) - (so(a) ?? 0));
    return {
      tong: ds.length,
      dong: xep
        .slice(0, gioiHan)
        .map((d) => ({ id: d.id, ho_ten: d.ho_ten, cap_bac: d.cap_bac, don_vi: d.don_vi, so: so(d) })),
    };
  };
  const duocGiao = dong.reduce((s, d) => s + d.bai_thi_duoc_giao, 0);
  const daNop = dong.reduce((s, d) => s + d.bai_thi_da_nop, 0);
  const dat = dong.reduce((s, d) => s + d.bai_thi_dat, 0);
  return {
    so_can_bo: dong.length,
    hoc_7_ngay: dong.filter((d) => d.lan_hoc_gan_nhat && d.lan_hoc_gan_nhat.getTime() >= moc).length,
    bai_thi: {
      duoc_giao: duocGiao,
      da_nop: daNop,
      dat,
      ty_le_hoan_thanh: phanTram(daNop, duocGiao),
      ty_le_dat: phanTram(dat, daNop),
    },
    cho_xac_minh: choXacMinh,
    can_chu_y: {
      chua_hoc: nhom(
        () => null,
        (d) => !d.lan_hoc_gan_nhat,
      ),
      chua_lam_bai: nhom(
        (d) => d.bai_thi_duoc_giao - d.bai_thi_da_nop,
        (d) => d.bai_thi_duoc_giao > d.bai_thi_da_nop,
      ),
      khong_dat: nhom(
        (d) => d.bai_thi_da_nop - d.bai_thi_dat,
        (d) => d.bai_thi_da_nop > d.bai_thi_dat,
      ),
    },
  };
}
