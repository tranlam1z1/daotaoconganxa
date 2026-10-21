/// <reference types="bun" />
/** Xác định tuổi vi phạm (app/lib/xac-dinh-tuoi.ts). */
import { describe, expect, test } from "bun:test";
import {
  ketLuanVphc,
  laNgayCoThat,
  ngayDuTuoi,
  ngaySinhTinh,
  tuoiDayDu,
  xacDinhTuoi,
} from "../app/lib/xac-dinh-tuoi";

describe("tuoiDayDu", () => {
  test("đúng ngày sinh nhật là đủ tuổi", () => {
    expect(tuoiDayDu("2010-10-09", "2026-10-09")).toEqual({ nam: 16, thang: 0, ngay: 0 });
    expect(tuoiDayDu("2010-10-10", "2026-10-09")).toEqual({ nam: 15, thang: 11, ngay: 29 });
  });
  test("qua năm, qua tháng không có ngày tương ứng", () => {
    expect(tuoiDayDu("2011-12-20", "2026-01-05")).toEqual({ nam: 14, thang: 0, ngay: 16 });
    expect(tuoiDayDu("2011-01-31", "2026-02-28")).toEqual({ nam: 15, thang: 0, ngay: 28 });
    expect(tuoiDayDu("2011-01-31", "2026-03-01")).toEqual({ nam: 15, thang: 1, ngay: 0 });
    expect(tuoiDayDu("2026-10-09", "2026-10-09")).toEqual({ nam: 0, thang: 0, ngay: 0 });
  });
  test("sinh 29/02: năm không nhuận chưa đủ tuổi vào 28/02", () => {
    expect(tuoiDayDu("2008-02-29", "2026-02-28")).toEqual({ nam: 17, thang: 11, ngay: 30 });
    expect(tuoiDayDu("2008-02-29", "2026-03-01")).toEqual({ nam: 18, thang: 0, ngay: 0 });
  });
});

describe("ngayDuTuoi", () => {
  test("ngày sinh nhật thứ n; 29/02 sang 01/03 khi năm không nhuận", () => {
    expect(ngayDuTuoi("2010-05-17", 16)).toBe("2026-05-17");
    expect(ngayDuTuoi("2008-02-29", 18)).toBe("2026-03-01");
    expect(ngayDuTuoi("2008-02-29", 16)).toBe("2024-02-29");
  });
});

describe("ngaySinhTinh", () => {
  test("không rõ ngày thì lấy ngày cuối tháng hoặc cuối năm", () => {
    expect(ngaySinhTinh("thang", 2012, 2)).toBe("2012-02-29");
    expect(ngaySinhTinh("thang", 2011, 4)).toBe("2011-04-30");
    expect(ngaySinhTinh("nam", 2010)).toBe("2010-12-31");
    expect(ngaySinhTinh("ngay", 2010, 3, 5)).toBe("2010-03-05");
  });
});

test("laNgayCoThat loại ngày không có trên lịch", () => {
  expect(laNgayCoThat("2010-02-30")).toBe(false);
  expect(laNgayCoThat("2012-02-29")).toBe(true);
  expect(laNgayCoThat("2012-2-9")).toBe(false);
});

test("ketLuanVphc theo các mốc 14, 16, 18", () => {
  expect([13, 14, 15, 16, 17, 18].map((t) => ketLuanVphc(t).nhom)).toEqual([
    "Dưới 14 tuổi",
    "Từ đủ 14 tuổi đến dưới 16 tuổi",
    "Từ đủ 14 tuổi đến dưới 16 tuổi",
    "Từ đủ 16 tuổi đến dưới 18 tuổi",
    "Từ đủ 16 tuổi đến dưới 18 tuổi",
    "Từ đủ 18 tuổi trở lên",
  ]);
});

describe("xacDinhTuoi", () => {
  test("tổng ngày, mốc kế tiếp và mốc lái xe", () => {
    const kq = xacDinhTuoi("2010-10-19", "2026-10-09");
    expect(kq.tuoi.nam).toBe(15);
    expect(kq.tongNgay).toBe(5834);
    expect(kq.mocKeTiep).toEqual({ tuoi: 16, ngayDu: "2026-10-19", conNgay: 10 });
    expect(kq.vphc.nhom).toBe("Từ đủ 14 tuổi đến dưới 16 tuổi");
    expect(kq.laiXe[0]).toMatchObject({ tuoi: 16, conNgay: 10 });
  });
  test("đã qua mọi mốc thì không còn mốc kế tiếp", () => {
    const kq = xacDinhTuoi("1990-01-01", "2026-10-09");
    expect(kq.mocKeTiep).toBeNull();
    expect(kq.laiXe.every((m) => m.conNgay === 0)).toBe(true);
  });
});
