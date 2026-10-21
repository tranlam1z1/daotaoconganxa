/// <reference types="bun" />
/** Luật thuần của lớp hiệu ứng trò chơi (docs/VISUAL_STYLE.md). */
import { describe, expect, test } from "bun:test";
import {
  CAI_DAT_MAC_DINH,
  chuoiDung,
  docCaiDat,
  giaTriSoChay,
  huyHieuTrongLuot,
  KHOA_CAI_DAT,
  laMocCombo,
  vuaLenCap,
} from "../app/lib/hieu-ung";

describe("combo", () => {
  test("đếm câu đúng liên tiếp từ câu gần nhất; sai hoặc không chấm làm đứt chuỗi", () => {
    expect(chuoiDung([])).toBe(0);
    expect(chuoiDung([true, true, true])).toBe(3);
    expect(chuoiDung([true, false, true, true])).toBe(2);
    expect(chuoiDung([true, true, null])).toBe(0);
    expect(chuoiDung([true, true, false])).toBe(0);
  });
  test("mốc có tia sáng: 5, 10, rồi mỗi 5", () => {
    expect([3, 4, 5, 6, 10, 12, 15].map(laMocCombo)).toEqual([false, false, true, false, true, false, true]);
  });
});

describe("chúc mừng sau lượt", () => {
  test("lên cấp khi XP trước lượt còn dưới ngưỡng cấp hiện tại", () => {
    expect(vuaLenCap({ xpTong: 105, xpLuot: 10, tuXpCapHienTai: 100, cap: 2 })).toBe(true);
    expect(vuaLenCap({ xpTong: 115, xpLuot: 10, tuXpCapHienTai: 100, cap: 2 })).toBe(false);
    expect(vuaLenCap({ xpTong: 5, xpLuot: 5, tuXpCapHienTai: 0, cap: 1 })).toBe(false);
    expect(vuaLenCap({ xpTong: 105, xpLuot: 0, tuXpCapHienTai: 100, cap: 2 })).toBe(false);
  });
  test("huy hiệu nhận trong lượt: cách lúc kết thúc không quá 10 giây", () => {
    const ketThuc = "2026-09-25T02:00:00.000Z";
    const ds = [
      { code: "a", dat_luc: "2026-09-25T02:00:01.000Z" },
      { code: "b", dat_luc: "2026-09-24T02:00:00.000Z" },
      { code: "c", dat_luc: null },
    ];
    expect(huyHieuTrongLuot(ds, ketThuc).map((h) => h.code)).toEqual(["a"]);
    expect(huyHieuTrongLuot(ds, null)).toEqual([]);
  });
});

describe("số chạy", () => {
  test("bắt đầu ở giá trị đầu, kết thúc đúng giá trị cuối, tăng dần", () => {
    expect(giaTriSoChay(0, 80, 0)).toBe(0);
    expect(giaTriSoChay(0, 80, 1)).toBe(80);
    expect(giaTriSoChay(0, 80, 2)).toBe(80);
    const giua = giaTriSoChay(0, 80, 0.5);
    expect(giua).toBeGreaterThan(40);
    expect(giua).toBeLessThan(80);
  });
});

describe("cài đặt", () => {
  test("mặc định: âm thanh tắt, rung bật, không giảm hiệu ứng", () => {
    expect(docCaiDat(() => null)).toEqual(CAI_DAT_MAC_DINH);
    expect(CAI_DAT_MAC_DINH).toEqual({ amThanh: false, rung: true, giamHieuUng: false });
  });
  test("đọc giá trị đã lưu; giá trị lạ dùng mặc định", () => {
    const luu: Record<string, string> = {
      [KHOA_CAI_DAT.amThanh]: "1",
      [KHOA_CAI_DAT.rung]: "0",
      [KHOA_CAI_DAT.giamHieuUng]: "x",
    };
    expect(docCaiDat((k) => luu[k] ?? null)).toEqual({ amThanh: true, rung: false, giamHieuUng: false });
  });
});
