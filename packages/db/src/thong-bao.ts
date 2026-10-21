/**
 * Đăng ký thông báo đẩy, cài đặt nhắc học và việc phát thông báo (docs/PLAN.md GĐ15).
 *
 * Việc GỬI thật (Web Push, VAPID) không ở đây: `chayNhacHoc` và `phatThongBao` nhận hàm `gui` từ
 * người gọi (worker dùng thư viện web-push, test dùng hàm giả). Nhờ vậy gói CSDL không phụ thuộc
 * mạng, và test kiểm được cả trường hợp dịch vụ đẩy trả 410.
 */
import {
  CAI_DAT_MAC_DINH,
  type CaiDatNhac,
  dangKyHetHan,
  gioVietNam,
  type ThongBaoCanGui,
  type TinhTrangNguoiHoc,
  thongBaoCanGui,
} from "@qdpl/dao-tao";
import { sql } from "./client.ts";
import { cauThuThachNgay } from "./diem-thuong.ts";

/* ------------------------------------------------------------------ */
/* Đăng ký thiết bị                                                    */
/* ------------------------------------------------------------------ */

export interface DangKyDay {
  id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Lưu đăng ký của một trình duyệt. Cùng endpoint thì cập nhật (kể cả khi đổi người đăng nhập). */
export async function luuDangKyDay(p: {
  accountId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO push_subscriptions (account_id, endpoint, p256dh, auth, user_agent)
    VALUES (${p.accountId}, ${p.endpoint}, ${p.p256dh}, ${p.auth}, ${p.userAgent ?? null})
    ON CONFLICT (endpoint) DO UPDATE SET
      account_id = EXCLUDED.account_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent, failed_count = 0`;
}

/** Hủy đăng ký một endpoint của chính người này. Trả số dòng đã xóa. */
export async function huyDangKyDay(accountId: string, endpoint: string): Promise<number> {
  const rows = await sql`
    DELETE FROM push_subscriptions WHERE account_id = ${accountId} AND endpoint = ${endpoint} RETURNING id`;
  return rows.length;
}

export async function soThietBiDaDangKy(accountId: string): Promise<number> {
  const [r] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM push_subscriptions WHERE account_id = ${accountId}`;
  return r?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* Cài đặt                                                             */
/* ------------------------------------------------------------------ */

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

export async function caiDatNhac(accountId: string): Promise<CaiDatNhac> {
  const [r] = await sql<Array<Record<string, any>>>`
    SELECT remind_at::text, streak_warning, new_exam, new_challenge, group_activity, quiet_from::text, quiet_to::text
    FROM notification_prefs WHERE account_id = ${accountId}`;
  if (!r) return { ...CAI_DAT_MAC_DINH };
  return {
    remind_at: hhmm(r.remind_at),
    streak_warning: r.streak_warning,
    new_exam: r.new_exam,
    new_challenge: r.new_challenge,
    group_activity: r.group_activity,
    quiet_from: hhmm(r.quiet_from) ?? CAI_DAT_MAC_DINH.quiet_from,
    quiet_to: hhmm(r.quiet_to) ?? CAI_DAT_MAC_DINH.quiet_to,
  };
}

/** Lưu cài đặt. Không gửi `group_activity` (công tắc thêm ở GĐ16a) thì giữ giá trị đang có. */
export async function luuCaiDatNhac(
  accountId: string,
  c: Omit<CaiDatNhac, "group_activity"> & { group_activity?: boolean },
): Promise<CaiDatNhac> {
  const nhom = c.group_activity ?? null;
  await sql`
    INSERT INTO notification_prefs (account_id, remind_at, streak_warning, new_exam, new_challenge, group_activity,
                                    quiet_from, quiet_to)
    VALUES (${accountId}, ${c.remind_at}::time, ${c.streak_warning}, ${c.new_exam}, ${c.new_challenge},
            COALESCE(${nhom}::boolean, true), ${c.quiet_from}::time, ${c.quiet_to}::time)
    ON CONFLICT (account_id) DO UPDATE SET
      remind_at = EXCLUDED.remind_at, streak_warning = EXCLUDED.streak_warning, new_exam = EXCLUDED.new_exam,
      new_challenge = EXCLUDED.new_challenge,
      group_activity = COALESCE(${nhom}::boolean, notification_prefs.group_activity),
      quiet_from = EXCLUDED.quiet_from, quiet_to = EXCLUDED.quiet_to,
      updated_at = now()`;
  return await caiDatNhac(accountId);
}

/* ------------------------------------------------------------------ */
/* Phát thông báo                                                      */
/* ------------------------------------------------------------------ */

/** Hàm gửi một thông báo tới một thiết bị. `status` là mã HTTP của dịch vụ đẩy khi lỗi. */
export type GuiDay = (
  dk: DangKyDay,
  noiDung: string,
) => Promise<{ ok: true } | { ok: false; status: number }>;

export interface KetQuaPhat {
  /** false khi thông báo này (account, kind, ref) đã được gửi trước đó: không gửi lại. */
  moi: boolean;
  thanh_cong: number;
  that_bai: number;
  da_xoa: number;
}

/** Sau bao nhiêu lần lỗi liên tiếp (không phải 404/410) thì bỏ đăng ký, để không gửi mãi vào chỗ hỏng. */
const SO_LOI_TOI_DA = 5;

/**
 * Phát một thông báo cho một người, tới mọi thiết bị của người đó. GHI `notifications_sent` TRƯỚC
 * khi gửi: hai lần phát cùng (kind, ref) chỉ có một lần gửi thật. Endpoint trả 404/410 thì xóa
 * đăng ký ngay; lỗi khác thì tăng bộ đếm lỗi.
 */
export async function phatThongBao(accountId: string, tb: ThongBaoCanGui, gui: GuiDay): Promise<KetQuaPhat> {
  const [giu] = await sql<Array<{ id: string }>>`
    INSERT INTO notifications_sent (account_id, kind, ref)
    VALUES (${accountId}, ${tb.kind}, ${tb.ref})
    ON CONFLICT ON CONSTRAINT notifications_sent_mot_lan DO NOTHING
    RETURNING id::text`;
  const kq: KetQuaPhat = { moi: Boolean(giu), thanh_cong: 0, that_bai: 0, da_xoa: 0 };
  if (!giu) return kq;

  const noiDung = JSON.stringify({ tieu_de: tb.tieu_de, noi_dung: tb.noi_dung, url: tb.url, loai: tb.kind });
  const dsDangKy = await sql<DangKyDay[]>`
    SELECT id, account_id, endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = ${accountId}`;
  for (const dk of dsDangKy) {
    const r = await gui(dk, noiDung).catch(() => ({ ok: false as const, status: 0 }));
    if (r.ok) {
      kq.thanh_cong++;
      await sql`UPDATE push_subscriptions SET last_ok_at = now(), failed_count = 0 WHERE id = ${dk.id}`;
    } else if (dangKyHetHan(r.status)) {
      kq.da_xoa++;
      await sql`DELETE FROM push_subscriptions WHERE id = ${dk.id}`;
    } else {
      kq.that_bai++;
      await sql`
        WITH t AS (UPDATE push_subscriptions SET failed_count = failed_count + 1 WHERE id = ${dk.id} RETURNING id, failed_count)
        DELETE FROM push_subscriptions p USING t WHERE p.id = t.id AND t.failed_count >= ${SO_LOI_TOI_DA}`;
    }
  }
  await sql`UPDATE notifications_sent SET delivered = ${kq.thanh_cong} WHERE id = ${giu.id}::bigint`;
  return kq;
}

/**
 * Tình trạng của mọi người có ít nhất một thiết bị đăng ký, tại ngày `ngay` (giờ Việt Nam).
 * Bài giao mới: đang mở, chưa hết hạn, giao trong 7 ngày gần đây, người đó chưa làm lượt nào và
 * chưa được báo.
 * Nhóm học cùng (GĐ16a): lượt cổ vũ nhận trong ngày và bài người khác chia sẻ trong ngày, chỉ ở
 * nhóm đang hoạt động mà người đó đang là thành viên.
 */
async function tinhTrangNguoiNhan(
  ngay: string,
  now: Date,
  coThuThach: boolean,
): Promise<Array<{ account_id: string } & TinhTrangNguoiHoc>> {
  const rows = await sql<Array<Record<string, any>>>`
    SELECT a.id AS account_id,
           p.remind_at::text AS remind_at, p.streak_warning, p.new_exam, p.new_challenge, p.group_activity,
           p.quiet_from::text AS quiet_from, p.quiet_to::text AS quiet_to,
           (SELECT count(*)::int FROM study_group_cheers c
              JOIN study_groups g ON g.id = c.group_id AND g.status = 'hoat_dong'
              JOIN study_group_members m ON m.group_id = c.group_id AND m.account_id = a.id AND m.left_at IS NULL
             WHERE c.to_account_id = a.id AND c.day = ${ngay}::date) AS co_vu_moi,
           (SELECT count(*)::int FROM study_group_items i
              JOIN study_groups g ON g.id = i.group_id AND g.status = 'hoat_dong'
              JOIN study_group_members m ON m.group_id = i.group_id AND m.account_id = a.id AND m.left_at IS NULL
             WHERE i.removed_at IS NULL AND i.shared_by IS DISTINCT FROM a.id AND i.created_at > m.joined_at
               AND i.created_at >= (${ngay}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS muc_moi,
           EXISTS (SELECT 1 FROM daily_activity d WHERE d.account_id = a.id AND d.day = ${ngay}::date) AS da_hoc,
           -- Chuỗi chỉ còn sống khi ngày học gần nhất là hôm nay hoặc hôm qua.
           CASE WHEN s.last_day >= ${ngay}::date - 1 THEN s.current ELSE 0 END AS chuoi,
           COALESCE((
             SELECT json_agg(json_build_object('id', g.id, 'ten', e.title))
             FROM exam_assignments g
             JOIN exams e ON e.id = g.exam_id
             LEFT JOIN units gu ON gu.id = g.unit_id
             WHERE g.cancelled_at IS NULL AND e.status <> 'nhap'
               AND g.opens_at <= ${now} AND g.due_at > ${now}
               AND g.created_at > ${now}::timestamptz - interval '7 days'
               AND (g.account_id = a.id
                    OR (u.path IS NOT NULL AND g.unit_id IS NOT NULL
                        AND (gu.path = u.path OR (g.include_subunits AND u.path <@ gu.path))))
               AND NOT EXISTS (SELECT 1 FROM exam_attempts t WHERE t.assignment_id = g.id AND t.account_id = a.id)
               AND NOT EXISTS (SELECT 1 FROM notifications_sent n
                               WHERE n.account_id = a.id AND n.kind = 'de_thi_moi' AND n.ref = g.id::text)
           ), '[]'::json) AS bai_giao
    FROM accounts a
    LEFT JOIN notification_prefs p ON p.account_id = a.id
    LEFT JOIN streaks s ON s.account_id = a.id
    LEFT JOIN units u ON u.id = a.unit_id
    WHERE a.enabled AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.account_id = a.id)`;
  return rows.map((r) => ({
    account_id: r.account_id,
    cai_dat:
      r.streak_warning === null
        ? { ...CAI_DAT_MAC_DINH }
        : {
            remind_at: hhmm(r.remind_at),
            streak_warning: r.streak_warning,
            new_exam: r.new_exam,
            new_challenge: r.new_challenge,
            group_activity: r.group_activity,
            quiet_from: hhmm(r.quiet_from) ?? CAI_DAT_MAC_DINH.quiet_from,
            quiet_to: hhmm(r.quiet_to) ?? CAI_DAT_MAC_DINH.quiet_to,
          },
    da_hoc_hom_nay: Boolean(r.da_hoc),
    chuoi_ngay: Number(r.chuoi ?? 0),
    co_thu_thach: coThuThach,
    bai_giao_moi: r.bai_giao ?? [],
    nhom_hoc: { co_vu_moi: Number(r.co_vu_moi ?? 0), muc_moi: Number(r.muc_moi ?? 0) },
  }));
}

export interface KetQuaNhipNhac {
  so_nguoi: number;
  da_gui: number;
  thiet_bi_nhan: number;
  dang_ky_da_xoa: number;
}

/**
 * Một nhịp của job nhắc học (mỗi 15 phút): tính ai cần nhận gì lúc `now`, phát từng thông báo.
 * Gọi lại trong cùng cửa sổ không gửi trùng (khóa UNIQUE trong `phatThongBao`).
 */
export async function chayNhacHoc(now: Date, gui: GuiDay): Promise<KetQuaNhipNhac> {
  const { ngay } = gioVietNam(now);
  // Hỏi thử thách hôm nay cũng là chốt thử thách (GĐ9); ngân hàng rỗng thì không có gì để báo.
  const coThuThach = (await cauThuThachNgay(ngay)).length > 0;
  const ds = await tinhTrangNguoiNhan(ngay, now, coThuThach);
  const kq: KetQuaNhipNhac = { so_nguoi: ds.length, da_gui: 0, thiet_bi_nhan: 0, dang_ky_da_xoa: 0 };
  for (const n of ds) {
    for (const tb of thongBaoCanGui(n, now)) {
      const r = await phatThongBao(n.account_id, tb, gui);
      if (r.moi) kq.da_gui++;
      kq.thiet_bi_nhan += r.thanh_cong;
      kq.dang_ky_da_xoa += r.da_xoa;
    }
  }
  return kq;
}
