/**
 * Đăng nhập bằng tên đăng nhập và mật khẩu cho tài khoản cán bộ (docs/PLAN.md GĐ2, A4).
 *
 * - Băm bằng Bun.password (argon2id). Chỉ API và MCP server (chạy trên Bun) gọi các hàm này;
 *   máy chủ web chạy trên Node không import gói @qdpl/auth.
 * - Khóa tạm: sai 5 lần trong 15 phút (tính từ lần đúng gần nhất) thì từ chối cho tới khi lần
 *   sai cũ nhất trong cửa sổ trôi qua. Đếm theo tên đăng nhập, kể cả tên không tồn tại.
 * - Mọi lần đăng nhập, đúng hay sai, đều ghi `audit_log`.
 */
import { randomInt } from "node:crypto";
import { sql } from "@qdpl/db";
import type { Role } from "./rbac.ts";

export const SO_LAN_SAI_TOI_DA = 5;
export const KHOANG_KHOA_PHUT = 15;

/* ------------------------------------------------------------------ */
/* Quy tắc tên đăng nhập và mật khẩu                                    */
/* ------------------------------------------------------------------ */

/** Tên đăng nhập lưu và so khớp ở dạng chữ thường, bỏ khoảng trắng hai đầu. */
export function chuanHoaTenDangNhap(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Trả thông báo lỗi, hoặc null khi hợp lệ. 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch. */
export function loiTenDangNhap(username: string): string | null {
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return "Tên đăng nhập gồm 3 đến 50 ký tự: chữ không dấu, chữ số, dấu chấm, gạch ngang hoặc gạch dưới.";
  }
  return null;
}

/** Trả thông báo lỗi, hoặc null khi đủ mạnh: tối thiểu 8 ký tự, có cả chữ và số. */
export function loiDoManhMatKhau(matKhau: string): string | null {
  if (matKhau.length < 8) return "Mật khẩu cần tối thiểu 8 ký tự.";
  if (matKhau.length > 200) return "Mật khẩu dài tối đa 200 ký tự.";
  if (!/\p{L}/u.test(matKhau) || !/\d/.test(matKhau)) return "Mật khẩu cần có cả chữ và chữ số.";
  return null;
}

export async function bamMatKhau(matKhau: string): Promise<string> {
  return await Bun.password.hash(matKhau, { algorithm: "argon2id" });
}

export async function kiemMatKhau(matKhau: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(matKhau, hash);
  } catch {
    // Chuỗi băm hỏng hoặc sai định dạng: coi như sai mật khẩu, không làm sập đăng nhập.
    return false;
  }
}

/**
 * Mật khẩu tạm 10 ký tự cho tài khoản mới và khi đặt lại. Bỏ các ký tự dễ đọc nhầm
 * (0/O, 1/l/I), luôn có cả chữ và số để qua được quy tắc độ mạnh.
 */
export function taoMatKhauTam(): string {
  const chu = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const so = "23456789";
  const tatCa = chu + so;
  const kyTu = [chu[randomInt(chu.length)], so[randomInt(so.length)]];
  while (kyTu.length < 10) kyTu.push(tatCa[randomInt(tatCa.length)]);
  // Trộn để chữ và số bắt buộc không luôn nằm ở hai vị trí đầu.
  for (let i = kyTu.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [kyTu[i], kyTu[j]] = [kyTu[j], kyTu[i]];
  }
  return kyTu.join("");
}

/* ------------------------------------------------------------------ */
/* Khóa tạm                                                             */
/* ------------------------------------------------------------------ */

export interface TinhTrangKhoa {
  biKhoa: boolean;
  /** Số phút (làm tròn lên) tới khi được thử lại; 0 khi không bị khóa. */
  conLaiPhut: number;
}

/**
 * Quyết định khóa từ danh sách thời điểm các lần sai trong cửa sổ, tách riêng để test không
 * cần CSDL. `lanSai` là các lần sai tính từ lần đúng gần nhất.
 */
export function quyetDinhKhoa(lanSai: Date[], now: Date = new Date()): TinhTrangKhoa {
  const cuaSoMs = KHOANG_KHOA_PHUT * 60_000;
  const trongCuaSo = lanSai
    .filter((t) => now.getTime() - t.getTime() < cuaSoMs)
    .sort((a, b) => a.getTime() - b.getTime());
  if (trongCuaSo.length < SO_LAN_SAI_TOI_DA) return { biKhoa: false, conLaiPhut: 0 };
  // Mở lại khi lần sai thứ (n - 4) tính từ cuối rời khỏi cửa sổ.
  const moc = trongCuaSo[trongCuaSo.length - SO_LAN_SAI_TOI_DA] as Date;
  const conLaiMs = moc.getTime() + cuaSoMs - now.getTime();
  return { biKhoa: true, conLaiPhut: Math.max(1, Math.ceil(conLaiMs / 60_000)) };
}

export async function tinhTrangKhoa(username: string): Promise<TinhTrangKhoa> {
  const rows = (await sql`
    SELECT created_at FROM login_attempts
    WHERE username = ${username}
      AND NOT ok
      AND created_at > now() - (${KHOANG_KHOA_PHUT} * interval '1 minute')
      AND created_at > COALESCE(
        (SELECT max(created_at) FROM login_attempts WHERE username = ${username} AND ok), '-infinity')
    ORDER BY created_at`) as Array<{ created_at: Date }>;
  return quyetDinhKhoa(rows.map((r) => new Date(r.created_at)));
}

/* ------------------------------------------------------------------ */
/* Đăng nhập, đổi mật khẩu, đặt lại                                     */
/* ------------------------------------------------------------------ */

export interface TaiKhoanMatKhau {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  role: Role;
  mustChangePassword: boolean;
}

export type KetQuaDangNhapMatKhau =
  | { ok: true; taiKhoan: TaiKhoanMatKhau }
  | { ok: false; lyDo: "sai_thong_tin" | "khoa_tam" | "bi_khoa"; conLaiPhut?: number };

/**
 * Chuỗi băm giả để kiểm mật khẩu cả khi tên đăng nhập không tồn tại: thời gian trả lời như
 * nhau, không lộ tên nào có thật.
 */
let bamGia: Promise<string> | null = null;
function layBamGia(): Promise<string> {
  bamGia ??= bamMatKhau("khong-co-tai-khoan-nay-0");
  return bamGia;
}

async function ghiNhatKyDangNhap(username: string, ok: boolean, ip: string | null, lyDo?: string) {
  await sql`INSERT INTO login_attempts (username, ok, ip) VALUES (${username}, ${ok}, ${ip})`;
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${username}, ${ok ? "dang_nhap:thanh_cong" : "dang_nhap:that_bai"}, ${username},
            ${sql.json({ ip, ...(lyDo ? { ly_do: lyDo } : {}) } as never)})`;
}

export async function dangNhapMatKhau(
  tenDangNhap: string,
  matKhau: string,
  ip: string | null = null,
): Promise<KetQuaDangNhapMatKhau> {
  const username = chuanHoaTenDangNhap(tenDangNhap);

  const khoa = await tinhTrangKhoa(username);
  if (khoa.biKhoa) {
    // Không ghi thêm lượt sai trong lúc khóa: nếu ghi, kẻ dò mật khẩu kéo dài khóa mãi được.
    await sql`
      INSERT INTO audit_log (actor, action, target, detail)
      VALUES (${username}, 'dang_nhap:tu_choi_khoa_tam', ${username}, ${sql.json({ ip } as never)})`;
    return { ok: false, lyDo: "khoa_tam", conLaiPhut: khoa.conLaiPhut };
  }

  const [row] = (await sql`
    SELECT id, username, email, name, role, enabled, password_hash, must_change_password
    FROM accounts WHERE username = ${username} LIMIT 1`) as any[];

  const dung = await kiemMatKhau(matKhau, row?.password_hash ?? (await layBamGia()));
  if (!row?.password_hash || !dung) {
    await ghiNhatKyDangNhap(username, false, ip, row ? "sai_mat_khau" : "khong_co_tai_khoan");
    return { ok: false, lyDo: "sai_thong_tin" };
  }
  // Kiểm trạng thái khóa SAU khi mật khẩu đúng, để không lộ tài khoản nào đang bị khóa.
  if (!row.enabled) {
    await ghiNhatKyDangNhap(username, false, ip, "tai_khoan_bi_khoa");
    return { ok: false, lyDo: "bi_khoa" };
  }

  await ghiNhatKyDangNhap(username, true, ip);
  await sql`UPDATE accounts SET last_login_at = now() WHERE id = ${row.id}`;
  return {
    ok: true,
    taiKhoan: {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      mustChangePassword: Boolean(row.must_change_password),
    },
  };
}

export class LoiMatKhau extends Error {}

/** Người dùng tự đổi mật khẩu; phải nhập đúng mật khẩu hiện tại. */
export async function doiMatKhau(accountId: string, matKhauCu: string, matKhauMoi: string): Promise<void> {
  const [row] = (await sql`
    SELECT username, password_hash FROM accounts WHERE id = ${accountId}`) as any[];
  if (!row?.password_hash) throw new LoiMatKhau("Tài khoản này đăng nhập bằng Google, không có mật khẩu.");
  if (!(await kiemMatKhau(matKhauCu, row.password_hash)))
    throw new LoiMatKhau("Mật khẩu hiện tại không đúng.");
  const loi = loiDoManhMatKhau(matKhauMoi);
  if (loi) throw new LoiMatKhau(loi);
  if (matKhauMoi === matKhauCu) throw new LoiMatKhau("Mật khẩu mới phải khác mật khẩu hiện tại.");

  await sql`
    UPDATE accounts
    SET password_hash = ${await bamMatKhau(matKhauMoi)},
        must_change_password = false,
        password_changed_at = now()
    WHERE id = ${accountId}`;
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${row.username}, 'tai_khoan:doi_mat_khau', ${row.username}, ${sql.json({} as never)})`;
}

/**
 * Quản trị đặt lại mật khẩu: sinh mật khẩu tạm, bắt đổi ở lần đăng nhập sau, thu hồi mọi phiên
 * đang mở của tài khoản. Trả mật khẩu tạm để hiển thị MỘT lần cho quản trị.
 */
export async function datLaiMatKhau(accountId: string, actor: string): Promise<string> {
  const matKhau = taoMatKhauTam();
  const [row] = (await sql`
    UPDATE accounts
    SET password_hash = ${await bamMatKhau(matKhau)}, must_change_password = true, password_changed_at = now()
    WHERE id = ${accountId} AND username IS NOT NULL
    RETURNING username`) as any[];
  if (!row) throw new LoiMatKhau("Không có tài khoản cán bộ này.");
  await sql`UPDATE sessions SET revoked_at = now() WHERE account_id = ${accountId} AND revoked_at IS NULL`;
  await sql`
    INSERT INTO audit_log (actor, action, target, detail)
    VALUES (${actor}, 'tai_khoan:dat_lai_mat_khau', ${row.username}, ${sql.json({} as never)})`;
  return matKhau;
}
