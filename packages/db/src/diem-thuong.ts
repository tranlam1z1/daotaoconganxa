/**
 * Trò chơi hóa (docs/PLAN.md GĐ9): ghi sổ XP, chuỗi ngày, huy hiệu, thử thách hằng ngày, bảng
 * xếp hạng. Luật tính nằm ở packages/dao-tao/src/diem-thuong.ts; tệp này đọc và ghi.
 *
 * `congXp` là lối duy nhất cộng XP, gọi TRONG giao dịch của hành động được thưởng (kết thúc phiên
 * luyện tập, nộp bài thi, kết thúc lượt chơi của GĐ10). Khóa (nguon, nguonId) trên xp_ledger bảo
 * đảm mỗi hành động chỉ được thưởng một lần, kể cả khi hành động bị gọi lại.
 */
import {
  type CauHoiNguon,
  capDo,
  chonCauThuThach,
  chuoiHienTai,
  ghiNgayHoc,
  huyHieuDat,
  type LuatHuyHieu,
  ngayVietNam,
  type ThongKeHuyHieu,
  type TrangThaiChuoi,
  thuHaiCuaTuan,
} from "@qdpl/dao-tao";
import { sql, type Tx } from "./client.ts";

/** Chuỗi ngày DB (kiểu date) trả về dạng Date nửa đêm UTC; đổi lại thành YYYY-MM-DD. */
function chuoiNgay(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Cộng XP                                                             */
/* ------------------------------------------------------------------ */

/**
 * Ghi XP cho một hành động và cập nhật mọi thứ đi kèm trong CÙNG giao dịch `tx`: XP theo ngày,
 * chuỗi ngày học, huy hiệu. Trả false khi hành động này đã được thưởng trước đó (không ghi gì)
 * hoặc khi xp = 0 (không tính là một ngày học).
 */
export async function congXp(
  tx: Tx,
  p: { accountId: string; nguon: string; nguonId: string; xp: number; luc?: Date },
): Promise<boolean> {
  if (p.xp <= 0) return false;
  const ngay = ngayVietNam(p.luc ?? new Date());
  // unit_id: đơn vị của người nhận TẠI LÚC nhận XP (docs/GAME_DESIGN.md §2.5), để mùa giải đơn vị
  // không kéo XP cũ theo khi người đó chuyển đơn vị.
  const [moi] = (await tx`
    INSERT INTO xp_ledger (account_id, source_kind, source_id, xp, day, unit_id)
    VALUES (${p.accountId}, ${p.nguon}, ${p.nguonId}, ${Math.round(p.xp)}, ${ngay},
            (SELECT unit_id FROM accounts WHERE id = ${p.accountId}))
    ON CONFLICT (source_kind, source_id) DO NOTHING
    RETURNING id`) as any[];
  if (!moi) return false;

  await tx`
    INSERT INTO daily_activity (account_id, day, xp) VALUES (${p.accountId}, ${ngay}, ${Math.round(p.xp)})
    ON CONFLICT (account_id, day) DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp`;

  const [cu] = (await tx`
    SELECT current, best, last_day, freezes_left, freeze_week FROM streaks
    WHERE account_id = ${p.accountId} FOR UPDATE`) as any[];
  const sau = ghiNgayHoc(cu ? { ...cu, last_day: chuoiNgay(cu.last_day) } : null, ngay);
  await tx`
    INSERT INTO streaks (account_id, current, best, last_day, freezes_left, freeze_week, updated_at)
    VALUES (${p.accountId}, ${sau.current}, ${sau.best}, ${sau.last_day}, ${sau.freezes_left}, ${sau.freeze_week}, now())
    ON CONFLICT (account_id) DO UPDATE SET
      current = EXCLUDED.current, best = EXCLUDED.best, last_day = EXCLUDED.last_day,
      freezes_left = EXCLUDED.freezes_left, freeze_week = EXCLUDED.freeze_week, updated_at = now()`;

  await xetHuyHieu(tx, p.accountId, sau.best);
  return true;
}

async function thongKeHuyHieu(db: Tx, accountId: string, chuoiTotNhat: number): Promise<ThongKeHuyHieu> {
  const [r] = (await db`
    SELECT
      (SELECT count(*)::int FROM xp_ledger WHERE account_id = ${accountId}
         AND source_kind IN ('phien_luyen_tap', 'thu_thach')) AS so_phien,
      (SELECT count(*)::int FROM xp_ledger WHERE account_id = ${accountId} AND source_kind = 'thu_thach') AS so_thu_thach,
      (SELECT count(*)::int FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id
         WHERE s.account_id = ${accountId} AND a.correct) AS so_cau_dung,
      (SELECT count(*)::int FROM exam_attempts WHERE account_id = ${accountId} AND passed) AS so_bai_thi_dat`) as any[];
  return { ...r, chuoi_tot_nhat: chuoiTotNhat } as ThongKeHuyHieu;
}

/** Trao các huy hiệu vừa đạt. Dùng thêm khi gộp tiến độ khách (tai-khoan-khach.ts). */
export async function xetHuyHieu(tx: Tx, accountId: string, chuoiTotNhat: number): Promise<void> {
  const luat = (await tx`SELECT code, rule FROM badges`) as unknown as LuatHuyHieu[];
  const dat = huyHieuDat(luat, await thongKeHuyHieu(tx, accountId, chuoiTotNhat));
  if (!dat.length) return;
  await tx`
    INSERT INTO account_badges (account_id, badge_code)
    SELECT ${accountId}, unnest(${dat}::text[])
    ON CONFLICT DO NOTHING`;
}

/* ------------------------------------------------------------------ */
/* Tổng quan của một người                                             */
/* ------------------------------------------------------------------ */

async function trangThaiChuoi(accountId: string): Promise<TrangThaiChuoi | null> {
  const [r] = (await sql`
    SELECT current, best, last_day, freezes_left, freeze_week FROM streaks WHERE account_id = ${accountId}`) as any[];
  return r ? { ...r, last_day: chuoiNgay(r.last_day) } : null;
}

async function tongXp(accountId: string): Promise<number> {
  const [r] =
    (await sql`SELECT COALESCE(sum(xp), 0)::int AS n FROM xp_ledger WHERE account_id = ${accountId}`) as any[];
  return Number(r?.n ?? 0);
}

/** Bản gọn cho thanh đầu trang: XP, cấp, chuỗi hiện tại. Hai truy vấn nhỏ. */
export async function tomTatDiem(accountId: string, now: Date = new Date()) {
  const [xp, chuoi] = await Promise.all([tongXp(accountId), trangThaiChuoi(accountId)]);
  const c = chuoiHienTai(chuoi, ngayVietNam(now));
  return { xp, cap: capDo(xp).cap, chuoi: c.hienTai, da_hoc_hom_nay: c.daHocHomNay };
}

export interface HuyHieuCuaToi {
  code: string;
  name: string;
  description: string;
  dat_luc: Date | null;
}

/**
 * XP, cấp, chuỗi ngày và huy hiệu của một người. Chỉ đọc, nên dùng được cho hồ sơ cán bộ do người
 * quản lý xem (packages/db/src/bao-cao.ts); phần thử thách hôm nay (có chốt danh sách câu) nằm
 * riêng ở `tongQuanDiem`.
 */
export async function diemVaHuyHieu(accountId: string, now: Date = new Date()) {
  const homNay = ngayVietNam(now);
  const [xp, chuoi, huyHieu, [tuan]] = await Promise.all([
    tongXp(accountId),
    trangThaiChuoi(accountId),
    sql`
      SELECT b.code, b.name, b.description, ab.awarded_at AS dat_luc
      FROM badges b LEFT JOIN account_badges ab ON ab.badge_code = b.code AND ab.account_id = ${accountId}
      ORDER BY b.ordinal` as unknown as Promise<HuyHieuCuaToi[]>,
    sql`SELECT COALESCE(sum(xp), 0)::int AS n FROM daily_activity
        WHERE account_id = ${accountId} AND day >= ${thuHaiCuaTuan(homNay)}` as unknown as Promise<
      Array<{ n: number }>
    >,
  ]);
  const c = chuoiHienTai(chuoi, homNay);
  return {
    xp_tong: xp,
    xp_tuan: Number(tuan?.n ?? 0),
    cap: capDo(xp),
    chuoi: {
      hien_tai: c.hienTai,
      tot_nhat: c.totNhat,
      da_hoc_hom_nay: c.daHocHomNay,
      con_dong_bang: c.conDongBang,
    },
    huy_hieu: huyHieu,
  };
}

export async function tongQuanDiem(accountId: string, now: Date = new Date()) {
  const [diem, thuThach] = await Promise.all([diemVaHuyHieu(accountId, now), thuThachCuaToi(accountId, now)]);
  return { ...diem, thu_thach: thuThach };
}

/* ------------------------------------------------------------------ */
/* Thử thách hằng ngày                                                 */
/* ------------------------------------------------------------------ */

/**
 * Danh sách câu của thử thách ngày `ngay`. Lần hỏi đầu tiên trong ngày chốt danh sách vào bảng;
 * các lần sau đọc lại đúng danh sách đó. Ngân hàng chưa có câu đã duyệt thì trả rỗng, không chốt.
 */
export async function cauThuThachNgay(ngay: string): Promise<string[]> {
  const [co] = (await sql`SELECT question_ids FROM daily_challenges WHERE day = ${ngay}`) as any[];
  if (co) return co.question_ids as string[];
  // Thử thách chấm máy ngay: không rút câu tự luận.
  const ids = (
    (await sql`SELECT id FROM questions WHERE status = 'da_duyet' AND kind <> 'tu_luan'`) as any[]
  ).map((r) => r.id as string);
  const chon = chonCauThuThach(ids, ngay);
  if (!chon.length) return [];
  await sql`
    INSERT INTO daily_challenges (day, question_ids) VALUES (${ngay}, ${chon}::uuid[])
    ON CONFLICT (day) DO NOTHING`;
  const [chot] = (await sql`SELECT question_ids FROM daily_challenges WHERE day = ${ngay}`) as any[];
  return (chot?.question_ids as string[]) ?? chon;
}

/** Câu đã duyệt theo danh sách id, đủ nội dung để dựng phiên thử thách. */
export async function cauHoiDaDuyetTheoId(ids: string[]): Promise<CauHoiNguon[]> {
  if (!ids.length) return [];
  return (await sql`
    SELECT id, version, topic_id, kind, level, stem, options, answer, explanation, citations, image_uris
    FROM questions WHERE status = 'da_duyet' AND id = ANY(${ids}::uuid[])`) as unknown as CauHoiNguon[];
}

/** Phiên thử thách của người này trong ngày (giờ Việt Nam), nếu đã bắt đầu. */
export async function phienThuThachHomNay(
  accountId: string,
  now: Date = new Date(),
): Promise<{ id: string; finished_at: Date | null; correct: number | null; total: number } | null> {
  const [r] = (await sql`
    SELECT id, finished_at, correct, total FROM practice_sessions
    WHERE account_id = ${accountId} AND source = 'thu_thach'
      AND (started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${ngayVietNam(now)}::date
    ORDER BY started_at LIMIT 1`) as any[];
  return r ?? null;
}

async function thuThachCuaToi(accountId: string, now: Date) {
  const ngay = ngayVietNam(now);
  const [ids, phien] = await Promise.all([cauThuThachNgay(ngay), phienThuThachHomNay(accountId, now)]);
  return {
    ngay,
    so_cau: ids.length,
    phien_id: phien?.id ?? null,
    da_xong: Boolean(phien?.finished_at),
    dung: phien?.finished_at ? phien.correct : null,
  };
}

/* ------------------------------------------------------------------ */
/* Bảng xếp hạng                                                       */
/* ------------------------------------------------------------------ */

export interface HangCaNhan {
  account_id: string;
  ten: string;
  xp: number;
  /** Cấp theo TỔNG XP từ trước tới nay (như chip điểm đầu trang), không theo XP trong kỳ. */
  cap: number;
  hang: number;
}

/**
 * Xếp hạng người trong MỘT đơn vị (không gồm đơn vị con) theo XP từ ngày `tuNgay`. Người chưa có
 * XP trong kỳ vẫn có mặt với 0 điểm. Cùng điểm thì cùng hạng (1, 2, 2, 4).
 */
export async function bangXepHangCaNhan(unitId: string, tuNgay: string): Promise<HangCaNhan[]> {
  const rows = (await sql`
    SELECT a.id AS account_id, COALESCE(a.name, a.username, a.email) AS ten,
           COALESCE(sum(d.xp), 0)::int AS xp,
           (SELECT COALESCE(sum(x.xp), 0)::int FROM xp_ledger x WHERE x.account_id = a.id) AS xp_tong
    FROM accounts a
    LEFT JOIN daily_activity d ON d.account_id = a.id AND d.day >= ${tuNgay}
    WHERE a.unit_id = ${unitId} AND a.enabled
    GROUP BY a.id
    ORDER BY xp DESC, ten`) as any[];
  // Chỉ trả cấp, không trả tổng XP của đồng nghiệp.
  const coCap = rows.map(({ xp_tong, ...r }) => ({ ...r, cap: capDo(Number(xp_tong)).cap }));
  return xepHang(coCap, (r) => r.xp) as HangCaNhan[];
}

export interface HangDonVi {
  unit_id: string;
  ten: string;
  so_nguoi: number;
  tong_xp: number;
  /** XP trung bình mỗi người: tổng XP trong kỳ chia số tài khoản đang dùng của đơn vị. */
  xp_trung_binh: number;
  hang: number;
}

/**
 * Xếp hạng các đơn vị ngang cấp (cùng đơn vị cấp trên) theo XP TRUNG BÌNH mỗi người, để đơn vị
 * đông người không luôn đứng đầu. Chỉ tính tài khoản gắn trực tiếp vào đơn vị.
 */
export async function bangXepHangDonVi(chaId: string | null, tuNgay: string): Promise<HangDonVi[]> {
  const rows = (await sql`
    SELECT u.id AS unit_id, u.name AS ten,
           count(DISTINCT a.id)::int AS so_nguoi,
           COALESCE(sum(d.xp), 0)::int AS tong_xp
    FROM units u
    LEFT JOIN accounts a ON a.unit_id = u.id AND a.enabled
    LEFT JOIN daily_activity d ON d.account_id = a.id AND d.day >= ${tuNgay}
    WHERE u.enabled AND u.parent_id IS NOT DISTINCT FROM ${chaId}::uuid
    GROUP BY u.id`) as any[];
  const coTb = rows
    .map((r) => ({ ...r, xp_trung_binh: r.so_nguoi ? Math.round((r.tong_xp / r.so_nguoi) * 10) / 10 : 0 }))
    .sort((a, b) => b.xp_trung_binh - a.xp_trung_binh || a.ten.localeCompare(b.ten, "vi"));
  return xepHang(coTb, (r) => r.xp_trung_binh) as HangDonVi[];
}

/** Cùng điểm thì cùng hạng, hạng kế tiếp nhảy qua (1, 2, 2, 4). `ds` đã sắp giảm dần. */
function xepHang<T>(ds: T[], diem: (r: T) => number): Array<T & { hang: number }> {
  let hang = 0;
  return ds.map((r, i) => {
    if (i === 0 || diem(r) !== diem(ds[i - 1] as T)) hang = i + 1;
    return { ...r, hang };
  });
}
