/**
 * Phạm vi đơn vị (docs/PLAN.md GĐ2): quản lý phòng thấy các đội con, quản lý đội không thấy
 * đội bên cạnh. Cây 3 cấp: Phòng P > Đội A > Tổ A1, và Phòng P > Đội B.
 */
import { describe, expect, test } from "bun:test";
import { type Principal, trongPhamVi } from "../src/rbac.ts";

const P = "uphong";
const A = `${P}.udoia`;
const A1 = `${A}.utoa1`;
const B = `${P}.udoib`;
// Nhãn có tiền tố trùng với Đội A: so theo tiền tố chuỗi thuần sẽ nhầm "udoia" với "udoiab".
const AB = `${P}.udoiab`;

const nguoi = (role: Principal["role"], unitPath?: string) => ({ role, unitPath });

describe("trongPhamVi", () => {
  test("quản lý phòng thấy phòng và mọi đội, tổ bên dưới", () => {
    const qlPhong = nguoi("lanh_dao", P);
    for (const path of [P, A, A1, B, AB]) expect(trongPhamVi(qlPhong, path)).toBe(true);
  });

  test("quản lý đội A thấy đội A và tổ A1, không thấy đội B, không thấy phòng", () => {
    const qlA = nguoi("lanh_dao", A);
    expect(trongPhamVi(qlA, A)).toBe(true);
    expect(trongPhamVi(qlA, A1)).toBe(true);
    expect(trongPhamVi(qlA, B)).toBe(false);
    expect(trongPhamVi(qlA, P)).toBe(false);
  });

  test("không nhầm đơn vị có nhãn bắt đầu giống nhau", () => {
    expect(trongPhamVi(nguoi("lanh_dao", A), AB)).toBe(false);
  });

  test("quản trị thấy mọi đơn vị, kể cả khi không gắn đơn vị", () => {
    expect(trongPhamVi(nguoi("quan_tri"), B)).toBe(true);
  });

  test("Admin quản lý quản trị toàn hệ thống nên thấy mọi đơn vị", () => {
    expect(trongPhamVi(nguoi("quan_ly"), B)).toBe(true);
    expect(trongPhamVi(nguoi("quan_ly"), A)).toBe(true);
  });

  test("chưa gắn đơn vị thì không thấy đơn vị nào; đơn vị đích rỗng thì không khớp", () => {
    expect(trongPhamVi(nguoi("lanh_dao"), A)).toBe(false);
    expect(trongPhamVi(nguoi("lanh_dao", A), null)).toBe(false);
  });

  test("phạm vi của lãnh đạo Công an xã là cây đơn vị của mình, không tính thứ bậc vai trò", () => {
    const lanhDao = nguoi("lanh_dao", A);
    expect(trongPhamVi(lanhDao, A1)).toBe(true);
    expect(trongPhamVi(lanhDao, B)).toBe(false);
  });
});
