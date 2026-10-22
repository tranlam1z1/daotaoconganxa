/**
 * Người dùng tự đăng ký tài khoản ở /dang-ky, và khai báo thông tin để được xác minh cán bộ
 * (migration 0064).
 *
 * - Người đăng ký khai số hiệu CAND, đơn vị công tác, cấp bậc/chức vụ. Tài khoản mới ở trạng thái
 *   chờ xác minh, vai trò `khach`: đăng nhập được nhưng chỉ vào trang Tài khoản (xem trạng thái xét
 *   duyệt, sửa thông tin đã khai, đổi mật khẩu); học, luyện tập và thi đều chờ duyệt.
 *   Quản trị viên hoặc cán bộ quản lý của đơn vị đã khai duyệt thì thành cán bộ (`duyetTaiKhoan`
 *   trong @qdpl/db).
 * - Đăng nhập bằng email: `username` = email chữ thường, nên dùng chung luồng mật khẩu,
 *   khóa tạm và đặt lại mật khẩu với tài khoản cán bộ.
 * - Không gửi email kích hoạt. Vì email chưa được xác minh, tài khoản mang cờ `self_registered`;
 *   chủ thật của email đăng nhập bằng Google thì mật khẩu do người đăng ký đặt bị bỏ (rbac.ts).
 * - Mỗi địa chỉ IP đăng ký tối đa SO_LAN_DANG_KY_TOI_DA tài khoản mỗi giờ.
 */
import { sql } from "@qdpl/db";
import { bamMatKhau, loiDoManhMatKhau, type TaiKhoanMatKhau } from "./mat-khau.ts";
import type { Role } from "./rbac.ts";

/** Vai trò khi chưa được xác minh; duyệt xong mới lên `can_bo`. */
export const VAI_TRO_TU_DANG_KY: Role = "khach";
export const SO_LAN_DANG_KY_TOI_DA = 5;

export class LoiDangKy extends Error {
  constructor(
    message: string,
    readonly code: "khong_hop_le" | "da_ton_tai" | "qua_nhieu_lan" | "da_xac_minh" = "khong_hop_le",
  ) {
    super(message);
    this.name = "LoiDangKy";
  }
}

export function chuanHoaEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Trả thông báo lỗi, hoặc null khi hợp lệ. Chỉ kiểm dạng; email không được xác minh. */
export function loiEmail(email: string): string | null {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ.";
  return null;
}

/**
 * Số điện thoại Việt Nam về dạng 0xxxxxxxxx: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; +84/84
 * đổi thành 0. Trả null khi không phải 10–11 chữ số bắt đầu bằng 0.
 */
export function chuanHoaSoDienThoai(raw: string): string | null {
  let so = raw.replace(/[\s.\-()]/g, "");
  if (so.startsWith("+84")) so = `0${so.slice(3)}`;
  else if (/^84\d{9,10}$/.test(so)) so = `0${so.slice(2)}`;
  return /^0\d{9,10}$/.test(so) ? so : null;
}

/**
 * Số hiệu CAND về dạng chữ in hoa và chữ số liền nhau ("123-456" thành "123456"). Trả null khi sau
 * khi bỏ khoảng trắng, dấu chấm, gạch không còn 4–12 chữ cái hoặc chữ số.
 */
export function chuanHoaSoHieu(raw: string): string | null {
  const so = raw.replace(/[\s.-]/g, "").toUpperCase();
  return /^[0-9A-Z]{4,12}$/.test(so) ? so : null;
}

/** Thông tin người dùng khai để được xác minh cán bộ. */
export interface KhaiBaoXacMinh {
  soHieu: string;
  donViId: string;
  /** Cấp bậc, chức vụ; không bắt buộc. */
  capBacChucVu?: string | null;
  soDienThoai: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kiểm và chuẩn hóa thông tin khai báo; đơn vị phải có thật và đang hoạt động. Ném LoiDangKy. */
async function kiemKhaiBao(kb: KhaiBaoXacMinh): Promise<Required<KhaiBaoXacMinh>> {
  const soHieu = chuanHoaSoHieu(kb.soHieu);
  if (!soHieu) throw new LoiDangKy("Số hiệu CAND không hợp lệ.");
  const soDienThoai = chuanHoaSoDienThoai(kb.soDienThoai);
  if (!soDienThoai) throw new LoiDangKy("Số điện thoại không hợp lệ.");
  const capBacChucVu = kb.capBacChucVu?.trim().replace(/\s+/g, " ") || null;
  if (capBacChucVu && capBacChucVu.length > 200) throw new LoiDangKy("Cấp bậc, chức vụ quá dài.");
  const donVi = UUID.test(kb.donViId)
    ? ((await sql`SELECT 1 FROM units WHERE id = ${kb.donViId} AND enabled`) as any[])
    : [];
  if (!donVi.length) throw new LoiDangKy("Chọn đơn vị công tác trong danh sách.");
  return { soHieu, donViId: kb.donViId, capBacChucVu, soDienThoai };
}

export interface DuLieuDangKy extends KhaiBaoXacMinh {
  ten: string;
  email: string;
  matKhau: string;
}

export async function dangKyTaiKhoan(dl: DuLieuDangKy, ip: string | null = null): Promise<TaiKhoanMatKhau> {
  const ten = dl.ten.trim().replace(/\s+/g, " ");
  if (ten.length < 2 || ten.length > 100) throw new LoiDangKy("Họ và tên cần từ 2 đến 100 ký tự.");
  const email = chuanHoaEmail(dl.email);
  const loiMail = loiEmail(email);
  if (loiMail) throw new LoiDangKy(loiMail);
  const loiMk = loiDoManhMatKhau(dl.matKhau);
  if (loiMk) throw new LoiDangKy(loiMk);
  const kb = await kiemKhaiBao(dl);

  if (ip) {
    const [dem] = (await sql`
      SELECT count(*)::int AS n FROM audit_log
      WHERE action = 'tai_khoan:tu_dang_ky' AND detail->>'ip' = ${ip}
        AND created_at > now() - interval '1 hour'`) as any[];
    if (Number(dem?.n ?? 0) >= SO_LAN_DANG_KY_TOI_DA) {
      throw new LoiDangKy("Có quá nhiều lượt đăng ký từ mạng này. Thử lại sau một giờ.", "qua_nhieu_lan");
    }
  }

  // Email của tài khoản Google có thể còn chữ hoa nên so không phân biệt hoa thường.
  const daTonTai = new LoiDangKy("Email này đã có tài khoản. Hãy đăng nhập.", "da_ton_tai");
  const daCo = (await sql`
    SELECT 1 FROM accounts WHERE lower(email) = ${email} OR username = ${email} LIMIT 1`) as any[];
  if (daCo.length) throw daTonTai;

  // ON CONFLICT DO NOTHING bắt nốt trường hợp hai lượt đăng ký cùng email chạy song song.
  const [row] = (await sql`
    INSERT INTO accounts (email, username, name, phone, password_hash, role, self_registered,
                          xac_minh, so_hieu, don_vi_khai, rank_title,
                          password_changed_at, last_login_at)
    VALUES (${email}, ${email}, ${ten}, ${kb.soDienThoai}, ${await bamMatKhau(dl.matKhau)},
            ${VAI_TRO_TU_DANG_KY}, true,
            'cho_duyet', ${kb.soHieu}, ${kb.donViId}, ${kb.capBacChucVu},
            now(), now())
    ON CONFLICT DO NOTHING
    RETURNING id, username, email, name, role`) as any[];
  if (!row) throw daTonTai;

  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${email}, 'tai_khoan:tu_dang_ky', ${email}, ${sql.json({ ip } as never)})`;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    mustChangePassword: false,
  };
}

export type TrangThaiXacMinh = "cho_duyet" | "da_xac_minh" | "tu_choi";

export interface ThongTinXacMinh {
  trangThai: TrangThaiXacMinh;
  soHieu: string | null;
  donVi: { id: string; ten: string } | null;
  capBacChucVu: string | null;
  soDienThoai: string | null;
  /** Lý do từ chối lần gần nhất; null khi chưa bị từ chối. */
  lyDo: string | null;
}

/** Trạng thái và thông tin đã khai của một tài khoản; null khi không có tài khoản. */
export async function thongTinXacMinh(accountId: string): Promise<ThongTinXacMinh | null> {
  const [r] = (await sql`
    SELECT a.xac_minh, a.so_hieu, a.rank_title, a.phone, a.xac_minh_ly_do, u.id AS dv_id, u.name AS dv_ten
    FROM accounts a LEFT JOIN units u ON u.id = a.don_vi_khai
    WHERE a.id = ${accountId} AND NOT a.la_khach`) as any[];
  if (!r) return null;
  return {
    trangThai: r.xac_minh,
    soHieu: r.so_hieu,
    donVi: r.dv_id ? { id: r.dv_id, ten: r.dv_ten } : null,
    capBacChucVu: r.rank_title,
    soDienThoai: r.phone,
    lyDo: r.xac_minh === "tu_choi" ? r.xac_minh_ly_do : null,
  };
}

/**
 * Người chưa được xác minh khai (hoặc sửa sau khi bị từ chối) thông tin, rồi vào lại hàng chờ duyệt.
 * Tài khoản đã xác minh không đi qua đây: thông tin của họ do quản trị sửa.
 */
export async function capNhatKhaiBao(accountId: string, khai: KhaiBaoXacMinh): Promise<ThongTinXacMinh> {
  const kb = await kiemKhaiBao(khai);
  const rows = (await sql`
    UPDATE accounts SET
      so_hieu = ${kb.soHieu}, don_vi_khai = ${kb.donViId}, rank_title = ${kb.capBacChucVu},
      phone = ${kb.soDienThoai}, xac_minh = 'cho_duyet'
    WHERE id = ${accountId} AND NOT la_khach AND xac_minh <> 'da_xac_minh'
    RETURNING COALESCE(email, username) AS ten`) as any[];
  if (!rows.length) throw new LoiDangKy("Tài khoản này đã được xác minh.", "da_xac_minh");
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${rows[0].ten}, 'tai_khoan:khai_xac_minh', ${rows[0].ten},
            ${sql.json({ so_hieu: kb.soHieu, don_vi: kb.donViId } as never)})`;
  return (await thongTinXacMinh(accountId)) as ThongTinXacMinh;
}
