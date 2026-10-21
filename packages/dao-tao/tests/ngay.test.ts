/** Tiện ích lịch: ngày theo giờ Việt Nam, đầu kỳ tuần và tháng. */
import { describe, expect, test } from "bun:test";
import { cachNgay, congNgayLich, dauKy, laNgay, ngayVietNam, ngayVn, thuHaiCuaTuan } from "../src/ngay.ts";

describe("ngày giờ Việt Nam", () => {
  test("qua mốc 0h giờ Việt Nam (UTC+7) thì sang ngày mới", () => {
    expect(ngayVietNam(new Date("2026-09-24T16:59:59Z"))).toBe("2026-09-24"); // 23:59:59 giờ VN
    expect(ngayVietNam(new Date("2026-09-24T17:00:00Z"))).toBe("2026-09-25"); // 00:00 giờ VN
  });

  test("đầu kỳ: thứ Hai của tuần và ngày 1 của tháng, theo giờ Việt Nam", () => {
    // Chủ nhật 27/9/2026 lúc 23:30 giờ VN vẫn thuộc tuần bắt đầu thứ Hai 21/9.
    expect(dauKy("tuan", new Date("2026-09-27T16:30:00Z"))).toBe("2026-09-21");
    // 0:30 thứ Hai 28/9 giờ VN đã sang tuần mới.
    expect(dauKy("tuan", new Date("2026-09-27T17:30:00Z"))).toBe("2026-09-28");
    expect(dauKy("thang", new Date("2026-09-30T17:30:00Z"))).toBe("2026-10-01");
    expect(thuHaiCuaTuan("2026-09-21")).toBe("2026-09-21");
  });
});

describe("kiểm ngày", () => {
  test("chỉ nhận ngày có thật, dạng YYYY-MM-DD", () => {
    expect(laNgay("2026-09-24")).toBe(true);
    expect(laNgay("2026-02-30")).toBe(false);
    expect(laNgay("24/09/2026")).toBe(false);
    expect(laNgay(20260924)).toBe(false);
  });

  test("cộng ngày và đo khoảng cách", () => {
    expect(congNgayLich("2026-09-24", 1)).toBe("2026-09-25");
    expect(congNgayLich("2026-12-31", 1)).toBe("2027-01-01");
    expect(cachNgay("2026-09-21", "2026-09-24")).toBe(3);
    expect(cachNgay("2026-09-24", "2026-09-21")).toBe(-3);
  });

  test("đổi ngày sang dạng Việt Nam", () => {
    expect(ngayVn("2026-09-15")).toBe("15/09/2026");
  });
});
