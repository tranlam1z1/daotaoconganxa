/**
 * Tự đăng ký tài khoản (/dang-ky). Chuẩn hóa dữ liệu kiểm bằng hàm thuần; phần ghi tài khoản chạy
 * trên Postgres test thật, email mang tiền tố riêng và được dọn sau khi chạy.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql, suaDonVi, taoDonVi } from "@qdpl/db";
import {
  capNhatKhaiBao,
  chuanHoaSoDienThoai,
  chuanHoaSoHieu,
  dangKyTaiKhoan,
  LoiDangKy,
  loiEmail,
  SO_LAN_DANG_KY_TOI_DA,
  thongTinXacMinh,
} from "../src/dang-ky.ts";
import { dangNhapMatKhau } from "../src/mat-khau.ts";
import { upsertAccount } from "../src/rbac.ts";
import { createSession, principalFromToken } from "../src/session.ts";

const PREFIX = "test-dk";
const MIEN = "dang-ky.vidu.vn";
const MAT_KHAU = "MatKhau2026";
/** Đơn vị người đăng ký khai; tạo trong beforeAll. */
let DON_VI = "";

const duLieu = (ten: string, thayDoi: Partial<Parameters<typeof dangKyTaiKhoan>[0]> = {}) => ({
  ten: "Nguyễn Văn An",
  email: `${PREFIX}-${ten}@${MIEN}`,
  soDienThoai: "0912 345 678",
  matKhau: MAT_KHAU,
  soHieu: "123-456",
  donViId: DON_VI,
  capBacChucVu: "Thượng úy",
  ...thayDoi,
});

async function donDep() {
  const mau = `${PREFIX}%`;
  await sql`DELETE FROM login_attempts WHERE username LIKE ${mau}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${mau} OR target LIKE ${mau} OR detail->>'ip' LIKE ${mau}`;
  await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email LIKE ${mau})`;
  await sql`DELETE FROM accounts WHERE email LIKE ${mau}`;
  await sql`DELETE FROM units WHERE code LIKE ${mau}`;
}
beforeAll(async () => {
  await donDep();
  DON_VI = (await taoDonVi({ code: `${PREFIX}-DV`, name: "Đội đăng ký thử" }, `${PREFIX}-seed`)).id;
});
afterAll(donDep);

describe("chuẩn hóa dữ liệu đăng ký", () => {
  test("số điện thoại về dạng 0xxxxxxxxx", () => {
    expect(chuanHoaSoDienThoai("0912 345 678")).toBe("0912345678");
    expect(chuanHoaSoDienThoai("+84 912.345.678")).toBe("0912345678");
    expect(chuanHoaSoDienThoai("84912345678")).toBe("0912345678");
    expect(chuanHoaSoDienThoai("(024) 3825-1234")).toBe("02438251234");
    expect(chuanHoaSoDienThoai("12345")).toBeNull();
    expect(chuanHoaSoDienThoai("0912abc678")).toBeNull();
  });

  test("số hiệu CAND về chữ in hoa và chữ số liền nhau", () => {
    expect(chuanHoaSoHieu("123-456")).toBe("123456");
    expect(chuanHoaSoHieu(" ab 12.34 ")).toBe("AB1234");
    expect(chuanHoaSoHieu("12")).toBeNull();
    expect(chuanHoaSoHieu("12#456")).toBeNull();
  });

  test("email chỉ kiểm dạng", () => {
    expect(loiEmail("an@vidu.vn")).toBeNull();
    expect(loiEmail("an@vidu")).not.toBeNull();
    expect(loiEmail("an vidu.vn")).not.toBeNull();
  });
});

describe("đăng ký tài khoản", () => {
  test("tạo tài khoản chờ xác minh, vai trò khách, email làm tên đăng nhập, đăng nhập được ngay", async () => {
    const tk = await dangKyTaiKhoan(duLieu("moi", { email: `  ${PREFIX}-Moi@${MIEN.toUpperCase()} ` }));
    const email = `${PREFIX}-moi@${MIEN}`;
    expect(tk.username).toBe(email);
    expect(tk.role).toBe("khach");
    expect(tk.mustChangePassword).toBe(false);

    const [row] = (await sql`
      SELECT email, phone, unit_id, self_registered, password_hash, xac_minh, so_hieu, don_vi_khai, rank_title
      FROM accounts WHERE id = ${tk.id}`) as any[];
    expect(row.email).toBe(email);
    expect(row.phone).toBe("0912345678");
    expect(row.unit_id).toBeNull();
    expect(row.self_registered).toBe(true);
    expect(row.password_hash).not.toContain(MAT_KHAU);
    expect(row).toMatchObject({
      xac_minh: "cho_duyet",
      so_hieu: "123456",
      don_vi_khai: DON_VI,
      rank_title: "Thượng úy",
    });

    const kq = await dangNhapMatKhau(email.toUpperCase(), MAT_KHAU);
    expect(kq.ok).toBe(true);

    // Danh tính mang cờ chờ xác minh; API dựa vào đó để chỉ mở nhóm tài khoản.
    const phien = await createSession(tk.id, "test");
    expect(await principalFromToken(phien.token)).toMatchObject({ role: "khach", choXacMinh: true });
  });

  test("đăng ký không có mã cán bộ vẫn lưu đơn vị và chờ xác minh", async () => {
    const tk = await dangKyTaiKhoan(duLieu("khong-ma", { soHieu: "", capBacChucVu: "Giáo viên" }));
    expect(await thongTinXacMinh(tk.id)).toMatchObject({
      trangThai: "cho_duyet",
      soHieu: null,
      donVi: { id: DON_VI },
      capBacChucVu: "Giáo viên",
    });
  });
  test("khai lại thông tin sau khi bị từ chối thì vào lại hàng chờ; đã xác minh thì không khai được", async () => {
    const tk = await dangKyTaiKhoan(duLieu("khai-lai"));
    await sql`UPDATE accounts SET xac_minh = 'tu_choi', xac_minh_ly_do = 'Sai số hiệu' WHERE id = ${tk.id}`;
    expect((await thongTinXacMinh(tk.id))?.lyDo).toBe("Sai số hiệu");

    const tt = await capNhatKhaiBao(tk.id, {
      soHieu: "654321",
      donViId: DON_VI,
      capBacChucVu: "",
      soDienThoai: "0987654321",
    });
    expect(tt).toMatchObject({
      trangThai: "cho_duyet",
      soHieu: "654321",
      donVi: { id: DON_VI, ten: "Đội đăng ký thử" },
      capBacChucVu: null,
      soDienThoai: "0987654321",
      lyDo: null,
    });

    await sql`UPDATE accounts SET xac_minh = 'da_xac_minh' WHERE id = ${tk.id}`;
    const loi = await capNhatKhaiBao(tk.id, {
      soHieu: "111111",
      donViId: DON_VI,
      soDienThoai: "0987654321",
    }).catch((e) => e);
    expect(loi).toBeInstanceOf(LoiDangKy);
    expect(loi.code).toBe("da_xac_minh");
  });

  test("email đã có tài khoản thì từ chối, không phân biệt hoa thường", async () => {
    await dangKyTaiKhoan(duLieu("trung"));
    const loi = await dangKyTaiKhoan(duLieu("trung", { email: `${PREFIX}-TRUNG@${MIEN}` })).catch((e) => e);
    expect(loi).toBeInstanceOf(LoiDangKy);
    expect(loi.code).toBe("da_ton_tai");
  });

  test("dữ liệu sai bị từ chối trước khi ghi", async () => {
    for (const sai of [
      { ten: " a " },
      { email: "khong-phai-email" },
      { soDienThoai: "123" },
      { matKhau: "ngan1" },
      { soHieu: "12" },
      { donViId: "khong-phai-uuid" },
      { donViId: "00000000-0000-0000-0000-000000000000" },
    ]) {
      const loi = await dangKyTaiKhoan(duLieu("sai", sai)).catch((e) => e);
      expect(loi).toBeInstanceOf(LoiDangKy);
      expect(loi.code).toBe("khong_hop_le");
    }
    const [dem] =
      (await sql`SELECT count(*)::int AS n FROM accounts WHERE email = ${`${PREFIX}-sai@${MIEN}`}`) as any[];
    expect(dem.n).toBe(0);
  });

  test("giới hạn số lượt đăng ký của một IP trong một giờ", async () => {
    const ip = `${PREFIX}-ip`;
    for (let i = 0; i < SO_LAN_DANG_KY_TOI_DA; i++) await dangKyTaiKhoan(duLieu(`ip${i}`), ip);
    const loi = await dangKyTaiKhoan(duLieu("ip-qua"), ip).catch((e) => e);
    expect(loi).toBeInstanceOf(LoiDangKy);
    expect(loi.code).toBe("qua_nhieu_lan");
    // IP khác vẫn đăng ký được.
    await dangKyTaiKhoan(duLieu("ip-khac"), `${PREFIX}-ip-2`);
  });

  test("chủ email đăng nhập Google thì mật khẩu do người tự đăng ký đặt bị bỏ", async () => {
    const tk = await dangKyTaiKhoan(duLieu("chiem"));
    const email = `${PREFIX}-chiem@${MIEN}`;
    await sql`INSERT INTO sessions (account_id, token_hash, expires_at)
              VALUES (${tk.id}, ${`${PREFIX}-phien`}, now() + interval '1 day')`;

    const google = await upsertAccount({ email, sub: `${PREFIX}-sub` });
    expect(google.id).toBe(tk.id);

    const [row] =
      (await sql`SELECT password_hash, self_registered FROM accounts WHERE id = ${tk.id}`) as any[];
    expect(row.password_hash).toBeNull();
    expect(row.self_registered).toBe(false);
    // Thông tin xác minh do người kia khai bị xóa; chủ email tự khai lại.
    expect(await thongTinXacMinh(tk.id)).toMatchObject({ trangThai: "cho_duyet", soHieu: null, donVi: null });
    const [phien] =
      (await sql`SELECT revoked_at FROM sessions WHERE token_hash = ${`${PREFIX}-phien`}`) as any[];
    expect(phien.revoked_at).not.toBeNull();
    expect((await dangNhapMatKhau(email, MAT_KHAU)).ok).toBe(false);
  });
});

describe("nơi sinh hoạt Đảng", () => {
  let TO_CHUC_DANG = "";
  let CO_QUAN = "";
  beforeAll(async () => {
    TO_CHUC_DANG = (
      await taoDonVi({ code: `${PREFIX}-DANG`, name: "Đảng ủy thử", loai: "to_chuc_dang" }, `${PREFIX}-seed`)
    ).id;
    CO_QUAN = (
      await taoDonVi({ code: `${PREFIX}-CQ`, name: "UBND thử", loai: "co_quan_hanh_chinh" }, `${PREFIX}-seed`)
    ).id;
  });

  test("khai tổ chức Đảng thì lưu riêng bên cạnh nơi công tác", async () => {
    const tk = await dangKyTaiKhoan(duLieu("dang-1", { donViDangId: TO_CHUC_DANG }));
    const tt = await thongTinXacMinh(tk.id);
    expect(tt?.donVi?.id).toBe(DON_VI);
    expect(tt?.donViDang).toEqual({ id: TO_CHUC_DANG, ten: "Đảng ủy thử" });
  });

  test("đơn vị không phải tổ chức Đảng bị từ chối", async () => {
    const loi = await dangKyTaiKhoan(duLieu("dang-2", { donViDangId: CO_QUAN })).catch((e) => e);
    expect(loi).toBeInstanceOf(LoiDangKy);
    expect(loi.message).toContain("tổ chức Đảng");
  });

  test("bỏ trống thì không có nơi sinh hoạt Đảng", async () => {
    const tk = await dangKyTaiKhoan(duLieu("dang-3", { donViDangId: "" }));
    expect((await thongTinXacMinh(tk.id))?.donViDang).toBeNull();
  });

  test("khai lại đổi được nơi sinh hoạt Đảng", async () => {
    const tk = await dangKyTaiKhoan(duLieu("dang-4"));
    const tt = await capNhatKhaiBao(tk.id, { ...duLieu("dang-4"), donViDangId: TO_CHUC_DANG });
    expect(tt.donViDang?.id).toBe(TO_CHUC_DANG);
  });
});

describe("khai lại khi tổ chức Đảng đã ngừng dùng", () => {
  test("giữ nơi sinh hoạt Đảng đang gắn; chọn mới tổ chức đã ngừng thì bị từ chối", async () => {
    const dang = await taoDonVi(
      { code: `${PREFIX}-DANG-NGUNG`, name: "Chi bộ sẽ ngừng", loai: "to_chuc_dang" },
      `${PREFIX}-seed`,
    );
    const tk = await dangKyTaiKhoan(duLieu("dang-ngung", { donViDangId: dang.id }));
    await suaDonVi(dang.id, { enabled: false }, `${PREFIX}-seed`);

    const tt = await capNhatKhaiBao(tk.id, { ...duLieu("dang-ngung"), donViDangId: dang.id });
    expect(tt.donViDang?.id).toBe(dang.id);

    const tk2 = await dangKyTaiKhoan(duLieu("dang-ngung-2"));
    const loi = await capNhatKhaiBao(tk2.id, { ...duLieu("dang-ngung-2"), donViDangId: dang.id }).catch(
      (e) => e,
    );
    expect(loi).toBeInstanceOf(LoiDangKy);
  });
});
