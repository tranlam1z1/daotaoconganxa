/// <reference types="bun" />
/** Tính cơi nới thành thùng xe (app/lib/coi-noi-thung.ts). */
import { describe, expect, test } from "bun:test";
import { tinhCoiNoi } from "../app/lib/coi-noi-thung";

describe("tinhCoiNoi", () => {
  test("chiều cao lớn hơn giấy là cơi nới, có khung phạt người điều khiển và chủ xe", () => {
    const kq = tinhCoiNoi({ cao: { giay: 2000, doDuoc: 2150 } });
    expect(kq.chieu).toEqual([
      { chieu: "cao", giay: 2000, doDuoc: 2150, chenh: 150, phanTram: 7.5, trangThai: "lon-hon" },
    ]);
    expect(kq.coiNoi).toBe(true);
    expect(kq.khongDung).toBe(true);
    expect(kq.theTich).toBeNull();
    expect(kq.khung.map((k) => k.doiTuong)).toEqual(["Người điều khiển", "Chủ xe"]);
    expect(kq.khung[0]).toMatchObject({ phatTu: 2_000_000, phatDen: 3_000_000, truDiem: 2 });
    expect(kq.khung[1]?.toChuc).toEqual({ phatTu: 56_000_000, phatDen: 60_000_000 });
  });
  test("khớp giấy thì không có khung phạt", () => {
    const kq = tinhCoiNoi({ dai: { giay: 6200, doDuoc: 6200 }, cao: { giay: 2000, doDuoc: 2000 } });
    expect(kq.khongDung).toBe(false);
    expect(kq.coiNoi).toBe(false);
    expect(kq.khung).toEqual([]);
  });
  test("chênh trong sai số cho phép vẫn coi là đúng, vượt sai số thì không", () => {
    expect(tinhCoiNoi({ cao: { giay: 2000, doDuoc: 2010 } }, 10).khongDung).toBe(false);
    expect(tinhCoiNoi({ cao: { giay: 2000, doDuoc: 2011 } }, 10).coiNoi).toBe(true);
  });
  test("nhỏ hơn giấy quá sai số: không đúng giấy chứng nhận nhưng không phải cơi nới", () => {
    const kq = tinhCoiNoi({ rong: { giay: 2350, doDuoc: 2300 } });
    expect(kq.chieu[0]?.trangThai).toBe("nho-hon");
    expect(kq.chieu[0]?.chenh).toBe(-50);
    expect(kq.khongDung).toBe(true);
    expect(kq.coiNoi).toBe(false);
  });
  test("đủ ba chiều thì tính thể tích theo m³", () => {
    // 6 × 2 × 2 = 24 m³; 6 × 2 × 2,5 = 30 m³
    const kq = tinhCoiNoi({
      dai: { giay: 6000, doDuoc: 6000 },
      rong: { giay: 2000, doDuoc: 2000 },
      cao: { giay: 2000, doDuoc: 2500 },
    });
    expect(kq.theTich).toEqual({ giay: 24, doDuoc: 30, chenh: 6, phanTram: 25 });
  });
});
