/**
 * Mật khẩu và khóa tạm (docs/PLAN.md GĐ2). Phần quyết định khóa kiểm bằng hàm thuần; phần
 * đăng nhập chạy trên Postgres test thật, dữ liệu mang tiền tố riêng và được dọn sau khi chạy.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "@qdpl/db";
import {
  bamMatKhau,
  chuanHoaTenDangNhap,
  dangNhapMatKhau,
  datLaiMatKhau,
  doiMatKhau,
  KHOANG_KHOA_PHUT,
  kiemMatKhau,
  LoiMatKhau,
  loiDoManhMatKhau,
  loiTenDangNhap,
  quyetDinhKhoa,
  SO_LAN_SAI_TOI_DA,
  taoMatKhauTam,
} from "../src/mat-khau.ts";

const PREFIX = "test-mk";
const USER = `${PREFIX}-can-bo`;
const MAT_KHAU = "MatKhau2026";

async function donDep() {
  await sql`DELETE FROM login_attempts WHERE username LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`} OR target LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
}

let accountId = "";
beforeAll(async () => {
  await donDep();
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, password_hash, must_change_password)
    VALUES (${USER}, 'Cán bộ thử', 'can_bo', ${await bamMatKhau(MAT_KHAU)}, true)
    RETURNING id`) as any[];
  accountId = row.id;
});
afterAll(donDep);

describe("băm và kiểm mật khẩu", () => {
  test("băm argon2id, kiểm đúng và sai", async () => {
    const hash = await bamMatKhau("MotHaiBa123");
    expect(hash).toStartWith("$argon2id$");
    expect(hash).not.toContain("MotHaiBa123");
    expect(await kiemMatKhau("MotHaiBa123", hash)).toBe(true);
    expect(await kiemMatKhau("MotHaiBa124", hash)).toBe(false);
  });

  test("chuỗi băm hỏng coi như sai, không ném lỗi", async () => {
    expect(await kiemMatKhau("x", "khong-phai-chuoi-bam")).toBe(false);
  });

  test("quy tắc độ mạnh: tối thiểu 8 ký tự, có chữ và số", () => {
    expect(loiDoManhMatKhau("abc123")).not.toBeNull();
    expect(loiDoManhMatKhau("abcdefgh")).not.toBeNull();
    expect(loiDoManhMatKhau("12345678")).not.toBeNull();
    expect(loiDoManhMatKhau("Đường123")).toBeNull();
  });

  test("mật khẩu tạm luôn qua quy tắc độ mạnh và khác nhau mỗi lần", () => {
    const ds = Array.from({ length: 50 }, taoMatKhauTam);
    for (const mk of ds) {
      expect(mk).toHaveLength(10);
      expect(loiDoManhMatKhau(mk)).toBeNull();
      expect(mk).not.toMatch(/[0O1lI]/);
    }
    expect(new Set(ds).size).toBe(ds.length);
  });

  test("tên đăng nhập chuẩn hóa chữ thường và kiểm ký tự", () => {
    expect(chuanHoaTenDangNhap("  Nguyen.Van.A ")).toBe("nguyen.van.a");
    expect(loiTenDangNhap("nguyen.van.a")).toBeNull();
    expect(loiTenDangNhap("ab")).not.toBeNull();
    expect(loiTenDangNhap("nguyễn")).not.toBeNull();
  });
});

describe("quyết định khóa tạm (hàm thuần)", () => {
  const now = new Date("2026-09-24T10:00:00Z");
  const phutTruoc = (m: number) => new Date(now.getTime() - m * 60_000);

  test(`${SO_LAN_SAI_TOI_DA - 1} lần sai chưa khóa, lần sai thứ ${SO_LAN_SAI_TOI_DA} thì khóa`, () => {
    const bon = [1, 2, 3, 4].map(phutTruoc);
    expect(quyetDinhKhoa(bon, now).biKhoa).toBe(false);
    const nam = [1, 2, 3, 4, 5].map(phutTruoc);
    const kq = quyetDinhKhoa(nam, now);
    expect(kq.biKhoa).toBe(true);
    // Lần sai cũ nhất cách 5 phút, rời cửa sổ 15 phút sau 10 phút nữa.
    expect(kq.conLaiPhut).toBe(10);
  });

  test(`lần sai cũ hơn ${KHOANG_KHOA_PHUT} phút không tính`, () => {
    const lanSai = [1, 2, 3, 4, KHOANG_KHOA_PHUT + 1].map(phutTruoc);
    expect(quyetDinhKhoa(lanSai, now).biKhoa).toBe(false);
  });
});

describe("đăng nhập bằng mật khẩu trên CSDL", () => {
  test("đúng mật khẩu: trả tài khoản, báo phải đổi mật khẩu, ghi audit thành công", async () => {
    const kq = await dangNhapMatKhau(USER.toUpperCase(), MAT_KHAU, "127.0.0.1");
    expect(kq.ok).toBe(true);
    if (!kq.ok) return;
    expect(kq.taiKhoan.username).toBe(USER);
    expect(kq.taiKhoan.mustChangePassword).toBe(true);
    const [log] = (await sql`
      SELECT action FROM audit_log WHERE actor = ${USER} ORDER BY id DESC LIMIT 1`) as any[];
    expect(log.action).toBe("dang_nhap:thanh_cong");
  });

  test("tên đăng nhập không tồn tại trả cùng lý do với sai mật khẩu", async () => {
    const khongCo = await dangNhapMatKhau(`${PREFIX}-khong-co`, "gi-cung-duoc1");
    const saiMk = await dangNhapMatKhau(USER, "SaiMatKhau1");
    expect(khongCo).toEqual({ ok: false, lyDo: "sai_thong_tin" });
    expect(saiMk).toEqual({ ok: false, lyDo: "sai_thong_tin" });
  });

  test(`sai ${SO_LAN_SAI_TOI_DA} lần thì khóa tạm, kể cả khi nhập đúng mật khẩu`, async () => {
    await sql`DELETE FROM login_attempts WHERE username = ${USER}`;
    for (let i = 0; i < SO_LAN_SAI_TOI_DA; i++) {
      expect((await dangNhapMatKhau(USER, `Sai${i}abcdef`)).ok).toBe(false);
    }
    const kq = await dangNhapMatKhau(USER, MAT_KHAU);
    expect(kq.ok).toBe(false);
    if (!kq.ok) {
      expect(kq.lyDo).toBe("khoa_tam");
      expect(kq.conLaiPhut).toBeGreaterThan(0);
    }
    const [dem] = (await sql`
      SELECT count(*)::int AS n FROM audit_log WHERE actor = ${USER} AND action = 'dang_nhap:that_bai'`) as any[];
    expect(dem.n).toBeGreaterThanOrEqual(SO_LAN_SAI_TOI_DA);
    await sql`DELETE FROM login_attempts WHERE username = ${USER}`;
  });

  test("tài khoản bị khóa: chỉ báo khóa khi mật khẩu đúng", async () => {
    await sql`UPDATE accounts SET enabled = false WHERE id = ${accountId}`;
    expect(await dangNhapMatKhau(USER, "SaiMatKhau1")).toEqual({ ok: false, lyDo: "sai_thong_tin" });
    expect(await dangNhapMatKhau(USER, MAT_KHAU)).toEqual({ ok: false, lyDo: "bi_khoa" });
    await sql`UPDATE accounts SET enabled = true WHERE id = ${accountId}`;
    await sql`DELETE FROM login_attempts WHERE username = ${USER}`;
  });
});

describe("đổi và đặt lại mật khẩu", () => {
  test("đổi mật khẩu: sai mật khẩu cũ bị từ chối; đổi xong bỏ cờ phải đổi", async () => {
    await expect(doiMatKhau(accountId, "SaiMatKhau1", "MatKhauMoi2026")).rejects.toBeInstanceOf(LoiMatKhau);
    await expect(doiMatKhau(accountId, MAT_KHAU, "yeu")).rejects.toBeInstanceOf(LoiMatKhau);
    await expect(doiMatKhau(accountId, MAT_KHAU, MAT_KHAU)).rejects.toBeInstanceOf(LoiMatKhau);
    await doiMatKhau(accountId, MAT_KHAU, "MatKhauMoi2026");
    const kq = await dangNhapMatKhau(USER, "MatKhauMoi2026");
    expect(kq.ok && kq.taiKhoan.mustChangePassword).toBe(false);
    // argon2 chậm có chủ đích và test này băm/kiểm 6 lần: nới giới hạn 5 giây mặc định để không
    // hỏng khi máy đang bận (chạy song song nhiều bộ test).
  }, 20_000);

  test("đặt lại mật khẩu: mật khẩu tạm dùng được, bật cờ phải đổi, thu hồi phiên", async () => {
    await sql`INSERT INTO sessions (account_id, token_hash, expires_at)
              VALUES (${accountId}, ${`${PREFIX}-phien`}, now() + interval '1 day')`;
    const tam = await datLaiMatKhau(accountId, `${PREFIX}-quan-tri`);
    const kq = await dangNhapMatKhau(USER, tam);
    expect(kq.ok && kq.taiKhoan.mustChangePassword).toBe(true);
    const [phien] =
      (await sql`SELECT revoked_at FROM sessions WHERE token_hash = ${`${PREFIX}-phien`}`) as any[];
    expect(phien.revoked_at).not.toBeNull();
  });
});
