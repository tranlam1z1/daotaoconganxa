/// <reference types="bun" />
/** Tính quá khổ hàng hóa (app/lib/qua-kho.ts). */
import { describe, expect, test } from "bun:test";
import { caoToiDaKhongMui, tinhQuaKho } from "../app/lib/qua-kho";

describe("caoToiDaKhongMui", () => {
  test("ba nhóm theo khối lượng hàng chuyên chở", () => {
    expect(caoToiDaKhongMui(2499)).toBe(2.8);
    expect(caoToiDaKhongMui(2500)).toBe(3.5);
    expect(caoToiDaKhongMui(4999)).toBe(3.5);
    expect(caoToiDaKhongMui(5000)).toBe(4.2);
  });
});

describe("tinhQuaKho", () => {
  test("thùng không mui vượt chiều cao: khung của người điều khiển và chủ xe", () => {
    const kq = tinhQuaKho({ loai: "khong-mui", cao: { doDuoc: 4.5, hangKg: 8000 } });
    expect(kq.quaKho).toBe(true);
    expect(kq.chieu[0]).toMatchObject({
      chieu: "cao",
      gioiHan: 4.2,
      vuot: 0.3,
      phanTram: 7.14,
      viPham: true,
    });
    expect(kq.khung.map((k) => k.doiTuong)).toEqual(["Người điều khiển", "Chủ xe"]);
    expect(kq.khung[0]).toMatchObject({ phatTu: 2_000_000, phatDen: 3_000_000, truDiem: 2 });
  });
  test("đúng bằng giới hạn thì không vượt", () => {
    const kq = tinhQuaKho({ loai: "khong-mui", cao: { doDuoc: 3.5, hangKg: 3000 } });
    expect(kq.chieu[0]?.viPham).toBe(false);
    expect(kq.quaKho).toBe(false);
    expect(kq.khung).toEqual([]);
  });
  test("xe chở công te nơ không quá 4,35 m; thùng có mui theo chiều cao thùng", () => {
    expect(tinhQuaKho({ loai: "cong-te-no", cao: { doDuoc: 4.4 } }).chieu[0]).toMatchObject({
      gioiHan: 4.35,
      vuot: 0.05,
      viPham: true,
    });
    expect(tinhQuaKho({ loai: "co-mui", cao: { doDuoc: 2.3, caoThung: 2.2 } }).chieu[0]).toMatchObject({
      gioiHan: 2.2,
      vuot: 0.1,
    });
  });
  test("chiều rộng so với thùng xe, chiều dài so với 1,1 lần chiều dài xe", () => {
    const kq = tinhQuaKho({
      loai: "khong-mui",
      rong: { doDuoc: 2.6, rongThung: 2.35 },
      dai: { doDuoc: 13.3, daiXe: 12 },
    });
    expect(kq.chieu.map((c) => [c.chieu, c.gioiHan, c.vuot, c.viPham])).toEqual([
      ["rong", 2.35, 0.25, true],
      ["dai", 13.2, 0.1, true],
    ]);
    // Bề rộng và chiều dài chung một điểm của nghị định: chỉ một khung.
    expect(kq.khung).toHaveLength(1);
    expect(kq.khung[0]).toMatchObject({ phatTu: 800_000, phatDen: 1_000_000 });
  });
  test("chiều dài không quá 20 m dù 1,1 lần chiều dài xe lớn hơn", () => {
    const kq = tinhQuaKho({ loai: "khong-mui", dai: { doDuoc: 20.5, daiXe: 19 } });
    expect(kq.chieu[0]).toMatchObject({ gioiHan: 20, vuot: 0.5, viPham: true });
    // Chưa vượt 1,1 lần chiều dài xe (20,9 m) nên không gắn khung phạt của hành vi đó.
    expect(kq.khung).toEqual([]);
  });
});
