/**
 * Ranh giới xã: điểm trong đa giác (kể cả lỗ), điểm ở khe giữa hai ranh lấy xã gần nhất, làm gọn ranh.
 */
import { describe, expect, test } from "bun:test";
import { ranhGioi } from "../src/index.ts";

type DaGiac = ranhGioi.DaGiac;

/** Hình vuông [x0, y0] – [x1, y1], có thể kèm một lỗ. */
const vuong = (x0: number, y0: number, x1: number, y1: number): ranhGioi.Diem[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

// Hai xã cạnh nhau, cách một khe 0,001° (≈ 100 m); xã A có lỗ ở giữa.
const A: DaGiac = [[vuong(105, 19, 105.01, 19.01), vuong(105.004, 19.004, 105.006, 19.006)]];
const B: DaGiac = [[vuong(105.011, 19, 105.02, 19.01)]];
const bo = ranhGioi.taoBoRanhGioi({
  phienBan: "2026-10-09",
  nguon: [],
  tinh: ["38"],
  xa: [
    { ma: "00001", bbox: [105, 19, 105.01, 19.01], vung: A },
    { ma: "00002", bbox: [105.011, 19, 105.02, 19.01], vung: B },
  ],
});

describe("ranh giới xã", () => {
  test("điểm trong đa giác, trong lỗ, ngoài vùng", () => {
    expect(bo.timXa(19.002, 105.002)).toEqual({ ma: "00001", ganRanh: false });
    expect(bo.timXa(19.005, 105.015)).toEqual({ ma: "00002", ganRanh: false });
    // Trong lỗ của A: không thuộc A, cách ranh lỗ ≈ 100 m nên lấy A là xã gần nhất.
    expect(bo.timXa(19.005, 105.005)).toEqual({ ma: "00001", ganRanh: true });
    expect(bo.timXa(19.5, 105.5)).toBeNull();
  });

  test("điểm ở khe giữa hai xã lấy xã có ranh gần hơn", () => {
    expect(bo.timXa(19.005, 105.0102)).toEqual({ ma: "00001", ganRanh: true });
    expect(bo.timXa(19.005, 105.0108)).toEqual({ ma: "00002", ganRanh: true });
    // Cách xa hơn GAN_RANH_M thì không nhận.
    expect(bo.timXa(19.005, 105.025)).toBeNull();
  });

  test("làm gọn bỏ điểm thẳng hàng, giữ vòng khép kín", () => {
    const vong: ranhGioi.Diem[] = [
      [0, 0],
      [0.5, 0.000001],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const gon = ranhGioi.lamGonVong(vong, 0.00001);
    expect(gon).toHaveLength(5);
    expect(gon[0]).toEqual(gon[gon.length - 1]!);
    expect(bo.hinhXa("00001")).not.toBeNull();
    expect(bo.hinhXa("99999")).toBeNull();
  });

  test("khoảng cách tới ranh tính theo mét", () => {
    // 0,001° vĩ độ ≈ 110,6 m.
    const m = ranhGioi.khoangCachToiRanh(105.005, 19.011, A);
    expect(m).toBeGreaterThan(105);
    expect(m).toBeLessThan(116);
  });
});
