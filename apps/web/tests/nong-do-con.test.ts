/// <reference types="bun" />
/** Tính mức xử phạt nồng độ cồn (app/lib/nong-do-con.ts, app/lib/doc-so.ts). */
import { describe, expect, test } from "bun:test";
import { docSoLe } from "../app/lib/doc-so";
import { mucTrungBinh } from "../app/lib/khung-phat";
import {
  khongChapHanhKiemTra,
  LOAI_XE_CON,
  moTaMuc,
  mucNongDo,
  tinhMucPhatCon,
} from "../app/lib/nong-do-con";

describe("docSoLe", () => {
  test("dấu phẩy và dấu chấm đều là dấu thập phân", () => {
    expect(docSoLe("0,25")).toBe(0.25);
    expect(docSoLe("0.25")).toBe(0.25);
    expect(docSoLe(" 80 ")).toBe(80);
  });
  test("không phải số thì trả null", () => {
    expect(docSoLe("")).toBeNull();
    expect(docSoLe("-0,1")).toBeNull();
    expect(docSoLe("1.234,5")).toBeNull();
    expect(docSoLe("0,2a")).toBeNull();
  });
  test("phần nguyên quá 9 chữ số thì trả null", () => {
    expect(docSoLe("999999999,5")).toBe(999999999.5);
    expect(docSoLe("1000000000")).toBeNull();
  });
});

describe("mucNongDo", () => {
  test("khí thở: đúng ngưỡng 0,25 và 0,4 còn ở mức dưới", () => {
    expect(mucNongDo("khi-tho", 0)).toBe(0);
    expect(mucNongDo("khi-tho", 0.001)).toBe(1);
    expect(mucNongDo("khi-tho", 0.25)).toBe(1);
    expect(mucNongDo("khi-tho", 0.251)).toBe(2);
    expect(mucNongDo("khi-tho", 0.4)).toBe(2);
    expect(mucNongDo("khi-tho", 0.401)).toBe(3);
  });
  test("máu: đúng ngưỡng 50 và 80 còn ở mức dưới", () => {
    expect(mucNongDo("mau", 50)).toBe(1);
    expect(mucNongDo("mau", 50.1)).toBe(2);
    expect(mucNongDo("mau", 80)).toBe(2);
    expect(mucNongDo("mau", 80.1)).toBe(3);
  });
});

describe("tinhMucPhatCon", () => {
  test("ô tô: ba khung, mức 1 và 2 trừ điểm, mức 3 tước giấy phép lái xe", () => {
    const m1 = tinhMucPhatCon("o-to", "khi-tho", 0.2).khung;
    expect(m1).toMatchObject({ phatTu: 6_000_000, phatDen: 8_000_000, truDiem: 4 });
    const m2 = tinhMucPhatCon("o-to", "mau", 60).khung;
    expect(m2).toMatchObject({ phatTu: 18_000_000, phatDen: 20_000_000, truDiem: 10 });
    const m3 = tinhMucPhatCon("o-to", "khi-tho", 0.5).khung;
    expect(m3).toMatchObject({ phatTu: 30_000_000, phatDen: 40_000_000 });
    expect(m3?.truDiem).toBeUndefined();
    expect(m3?.boSung?.[0]).toContain("22 tháng đến 24 tháng");
  });
  test("xe máy, xe máy chuyên dùng, xe thô sơ có khung riêng", () => {
    expect(tinhMucPhatCon("mo-to", "khi-tho", 0.3).khung).toMatchObject({
      phatTu: 6_000_000,
      phatDen: 8_000_000,
    });
    expect(tinhMucPhatCon("xe-may-chuyen-dung", "khi-tho", 0.5).khung).toMatchObject({
      phatTu: 18_000_000,
      phatDen: 20_000_000,
    });
    expect(tinhMucPhatCon("xe-tho-so", "khi-tho", 0.1).khung).toMatchObject({
      phatTu: 100_000,
      phatDen: 200_000,
    });
  });
  test("kết quả đo bằng 0 thì không có khung phạt", () => {
    expect(tinhMucPhatCon("mo-to", "khi-tho", 0)).toEqual({ muc: 0, khung: null });
  });
  test("không chấp hành kiểm tra phạt bằng khung của mức 3", () => {
    for (const loai of Object.keys(LOAI_XE_CON) as Array<keyof typeof LOAI_XE_CON>) {
      const kq = khongChapHanhKiemTra(loai);
      const m3 = LOAI_XE_CON[loai].muc[2];
      expect(kq.muc).toBeNull();
      expect(kq.khung).toMatchObject({ phatTu: m3.phatTu, phatDen: m3.phatDen });
      expect(kq.khung?.hanhVi).toContain("Không chấp hành");
    }
  });
});

test("moTaMuc viết khoảng nồng độ theo đơn vị của cách đo", () => {
  expect(moTaMuc("khi-tho", 2)).toBe("Vượt quá 0,25 đến 0,4 mg/1 lít khí thở");
  expect(moTaMuc("mau", 3)).toBe("Vượt quá 80 mg/100 ml máu");
});

test("mucTrungBinh là điểm giữa của khung", () => {
  expect(mucTrungBinh({ phatTu: 6_000_000, phatDen: 8_000_000 })).toBe(7_000_000);
});
