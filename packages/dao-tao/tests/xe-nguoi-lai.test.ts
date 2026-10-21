/**
 * Xe người chơi lái (M5 mở rộng ở GĐ-T9): ga, phanh, đi theo mốc 8 hướng, đổi đơn vị tốc độ.
 */
import { describe, expect, test } from "bun:test";
import {
  diChuyen,
  huongDoan,
  kmh,
  mmNhip,
  THONG_SO_XE_NGUOI_LAI,
  tocDoSau,
  vMaxXe,
  type XeNguoiLai,
} from "../src/mo-phong/xe-nguoi-lai.ts";

const xe = (p: Partial<XeNguoiLai> = {}): XeNguoiLai => ({
  loai: "o_to",
  x: 0,
  y: 0,
  huong: 0,
  v: 0,
  moc: [],
  ...p,
});

describe("Xe người lái: tốc độ", () => {
  test("ga tăng tới trần, phanh thắng ga, nhả thì chậm dần, không âm", () => {
    const ts = THONG_SO_XE_NGUOI_LAI.o_to;
    expect(tocDoSau("o_to", 0, { ga: true, phanh: false }, 1100)).toBe(ts.tang);
    expect(tocDoSau("o_to", 1098, { ga: true, phanh: false }, 1100)).toBe(1100);
    expect(tocDoSau("o_to", 500, { ga: true, phanh: true }, 1100)).toBe(500 - ts.phanh);
    expect(tocDoSau("o_to", 5, { ga: false, phanh: true }, 1100)).toBe(0);
    expect(tocDoSau("o_to", 500, { ga: false, phanh: false }, 1100)).toBe(500 - ts.tha);
    expect(tocDoSau("o_to", 1, { ga: false, phanh: false }, 1100)).toBe(0);
  });

  test("giảm chuyển động: tốc độ tối đa còn 70%", () => {
    expect(vMaxXe("o_to", false)).toBe(1100);
    expect(vMaxXe("o_to", true)).toBe(770);
    expect(vMaxXe("xe_may", true)).toBe(630);
  });

  test("đổi km/h và mm/nhịp", () => {
    expect(kmh(700)).toBe(50);
    expect(mmNhip(50)).toBe(694);
    expect(kmh(mmNhip(40))).toBe(39);
    expect(kmh(mmNhip(40) + 1)).toBe(40);
  });
});

describe("Xe người lái: di chuyển theo mốc", () => {
  test("không có mốc thì đi thẳng theo hướng", () => {
    const x = diChuyen(xe({ x: 1000, y: 1000, huong: 2 }), 300);
    expect([x.x, x.y, x.huong]).toEqual([1300, 1000, 2]);
  });

  test("đi hết mốc thẳng rồi chéo, phần dư đi tiếp mốc sau, hướng cuối là hướng đoạn cuối", () => {
    const moc = [
      { x: 0, y: -500 },
      { x: 1000, y: -1500 },
      { x: 2000, y: -1500 },
    ];
    let x = xe({ moc });
    x = diChuyen(x, 600);
    // 500 lên, 100 theo chéo (≈ 70 mỗi trục).
    expect([x.x, x.y, x.huong]).toEqual([70, -570, 1]);
    x = diChuyen(x, 10_000);
    expect(x.moc).toEqual([]);
    expect(x.huong).toBe(2);
    expect(x.y).toBe(-1500);
    expect(x.x).toBeGreaterThan(2000);
  });

  test("mốc lệch góc là lỗi lập trình", () => {
    expect(() => diChuyen(xe({ moc: [{ x: 100, y: -300 }] }), 50)).toThrow();
    expect(huongDoan(3, -3)).toBe(1);
    expect(huongDoan(3, -4)).toBeNull();
  });

  test("tất định: cùng đầu vào cùng kết quả, không sửa xe cũ", () => {
    const goc = xe({
      moc: [
        { x: 0, y: -400 },
        { x: 300, y: -700 },
      ],
    });
    const a = diChuyen(goc, 555);
    const b = diChuyen(goc, 555);
    expect(a).toEqual(b);
    expect(goc.moc).toHaveLength(2);
    expect([goc.x, goc.y]).toEqual([0, 0]);
  });
});
