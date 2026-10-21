/// <reference types="bun" />
/** Tính % quá tải (app/lib/tinh-qua-tai.ts). */
import { describe, expect, test } from "bun:test";
import { docSoKg, laLoaiXe, tinhQuaTai } from "../app/lib/tinh-qua-tai";

describe("docSoKg", () => {
  test("dấu chấm, khoảng trắng là phân cách hàng nghìn; dấu phẩy là thập phân", () => {
    expect(docSoKg("12500")).toBe(12500);
    expect(docSoKg("12.500")).toBe(12500);
    expect(docSoKg(" 1 250 000 ")).toBe(1250000);
    expect(docSoKg("150,5")).toBe(150.5);
  });
  test("không phải số thì trả null", () => {
    expect(docSoKg("")).toBeNull();
    expect(docSoKg("-5")).toBeNull();
    expect(docSoKg("12a")).toBeNull();
    expect(docSoKg("1,2,3")).toBeNull();
  });
  test("phần nguyên quá 9 chữ số thì trả null", () => {
    expect(docSoKg("999.999.999")).toBe(999999999);
    expect(docSoKg("1.000.000.000")).toBeNull();
    expect(docSoKg("99999999999999999999")).toBeNull();
  });
});

describe("laLoaiXe", () => {
  test("chỉ nhận ba loại xe", () => {
    expect(laLoaiXe("xe-tai")).toBe(true);
    expect(laLoaiXe("so-mi-ro-mooc")).toBe(true);
    expect(laLoaiXe("xe-khach")).toBe(false);
    expect(laLoaiXe(null)).toBe(false);
  });
});

describe("tinhQuaTai", () => {
  test("xe tải: chia cho khối lượng hàng chuyên chở theo thiết kế", () => {
    // (30.000 − 24.000) / 15.000 = 40%
    expect(tinhQuaTai("xe-tai", { can: 30000, toan_bo: 24000, hang: 15000 })).toEqual({
      khoiLuongQuaTai: 6000,
      phanTram: 40,
      quaTai: true,
    });
  });
  test("đầu kéo: chia cho khối lượng toàn bộ kéo theo", () => {
    // (48.000 − 9.000 − 35.000) / 35.000 = 11,428...% → 11,43%
    expect(tinhQuaTai("dau-keo", { can: 48000, ban_than_dk: 9000, keo_theo: 35000 })).toEqual({
      khoiLuongQuaTai: 4000,
      phanTram: 11.43,
      quaTai: true,
    });
  });
  test("sơ mi rơ moóc: trừ khối lượng kéo theo, chia cho hàng chuyên chở của rơ moóc", () => {
    // (45.000 − 8.500 − 32.000) / 25.500 = 17,647...% → 17,65%
    expect(
      tinhQuaTai("so-mi-ro-mooc", { can: 45000, ban_than_dk: 8500, keo_theo_rm: 32000, hang_rm: 25500 }),
    ).toEqual({ khoiLuongQuaTai: 4500, phanTram: 17.65, quaTai: true });
  });
  test("bằng hoặc dưới mức cho phép thì không quá tải", () => {
    expect(tinhQuaTai("xe-tai", { can: 24000, toan_bo: 24000, hang: 15000 }).quaTai).toBe(false);
    const kq = tinhQuaTai("xe-tai", { can: 23000, toan_bo: 24000, hang: 15000 });
    expect(kq.quaTai).toBe(false);
    expect(kq.khoiLuongQuaTai).toBe(-1000);
  });
  test("số lẻ không để lại sai số dấu phẩy động", () => {
    expect(tinhQuaTai("xe-tai", { can: 100.3, toan_bo: 100.1, hang: 10 }).khoiLuongQuaTai).toBe(0.2);
  });
});
