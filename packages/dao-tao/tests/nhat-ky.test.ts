/**
 * Nhật ký thao tác và chấm lại (mô-đun M7, docs/PLAN.md GĐ-T3): đọc nhật ký, kiểm mốc thời gian,
 * bộ ghi phía máy khách, băm trạng thái.
 */
import { describe, expect, test } from "bun:test";
import {
  BoGhiNhatKy,
  bamTrangThai,
  chayLaiRoiCham,
  docNhatKy,
  kiemMocThoiGian,
  LoiNhatKy,
  NHIP_MS,
  type NhatKy,
  SO_THAO_TAC_TOI_DA,
} from "../src/tro-choi/chung/nhat-ky.ts";

const docMot = (t: unknown, p: unknown) =>
  t === "bam" && p == null ? { thao_tac: "bam" as const, tham_so: null } : null;
const nk = (nhip: number[], tong: number): NhatKy<"bam", null> => ({
  thao_tac: nhip.map((n) => ({ nhip: n, thao_tac: "bam" as const, tham_so: null })),
  tong_nhip: tong,
});

describe("đọc nhật ký", () => {
  test("đọc đúng dạng", () => {
    expect(
      docNhatKy({ thao_tac: [{ nhip: 3, thao_tac: "bam", tham_so: null }], tong_nhip: 10 }, docMot),
    ).toEqual(nk([3], 10));
  });

  test(`quá ${SO_THAO_TAC_TOI_DA} thao tác bị từ chối`, () => {
    const vua = {
      thao_tac: Array.from({ length: SO_THAO_TAC_TOI_DA }, () => ({ nhip: 1, thao_tac: "bam" })),
      tong_nhip: 5,
    };
    expect(docNhatKy(vua, docMot)).not.toBeNull();
    const qua = { ...vua, thao_tac: [...vua.thao_tac, { nhip: 1, thao_tac: "bam" }] };
    expect(docNhatKy(qua, docMot)).toBeNull();
  });

  test("sai dạng bị từ chối", () => {
    for (const raw of [
      null,
      "x",
      { thao_tac: [], tong_nhip: -1 },
      { thao_tac: [], tong_nhip: 1.5 },
      { thao_tac: {}, tong_nhip: 1 },
      { thao_tac: [{ nhip: 0.5, thao_tac: "bam" }], tong_nhip: 1 },
      { thao_tac: [{ nhip: 1, thao_tac: "la" }], tong_nhip: 1 },
      { thao_tac: [], tong_nhip: 10 },
    ]) {
      const r = docNhatKy(raw, docMot, { tongNhipToiDa: 5 });
      expect(r).toBeNull();
    }
  });

  test("mốc âm vẫn đọc được để chấm 0, không từ chối", () => {
    const r = docNhatKy({ thao_tac: [{ nhip: -2, thao_tac: "bam" }], tong_nhip: 5 }, docMot)!;
    expect(kiemMocThoiGian(r, null)).toBe("Nhật ký có mốc trước lúc mở đề.");
  });
});

describe("kiểm mốc thời gian", () => {
  test("hợp lệ", () => {
    expect(kiemMocThoiGian(nk([0, 2, 2, 9], 10), 10 * NHIP_MS)).toBeNull();
    expect(kiemMocThoiGian(nk([], 0), 0)).toBeNull();
  });

  test("mốc sau lúc kết thúc, không theo thứ tự", () => {
    expect(kiemMocThoiGian(nk([11], 10), null)).toBe("Nhật ký có mốc sau lúc kết thúc.");
    expect(kiemMocThoiGian(nk([5, 3], 10), null)).toBe("Nhật ký không theo thứ tự thời gian.");
  });

  test("tổng thời gian lệch quá 10% cộng 2 giây so với đồng hồ máy chủ", () => {
    // Máy chủ đo 20 giây: trần 20 × 1,1 + 2 = 24 giây = 480 nhịp.
    expect(kiemMocThoiGian(nk([], 480), 20_000)).toBeNull();
    expect(kiemMocThoiGian(nk([], 481), 20_000)).toBe("Nhật ký không khớp đồng hồ máy chủ.");
    // Không biết giờ máy chủ (offline): bỏ qua phần so đồng hồ.
    expect(kiemMocThoiGian(nk([], 481), null)).toBeNull();
  });
});

describe("chạy lại rồi chấm", () => {
  test("mốc sai thì không chạy lại", () => {
    let daChay = false;
    const r = chayLaiRoiCham(nk([-1], 5), null, () => {
      daChay = true;
      return 1;
    });
    expect(r).toEqual({ hop_le: false, ly_do: "Nhật ký có mốc trước lúc mở đề." });
    expect(daChay).toBe(false);
  });

  test("LoiNhatKy thành lý do; lỗi khác vẫn ném", () => {
    expect(
      chayLaiRoiCham(nk([1], 5), null, () => {
        throw new LoiNhatKy("Thao tác sai.");
      }),
    ).toEqual({ hop_le: false, ly_do: "Thao tác sai." });
    expect(() =>
      chayLaiRoiCham(nk([1], 5), null, () => {
        throw new TypeError("lỗi lập trình");
      }),
    ).toThrow(TypeError);
    expect(chayLaiRoiCham(nk([1], 5), 1000, (x) => x.thao_tac.length)).toEqual({ hop_le: true, ket_qua: 1 });
  });
});

describe("bộ ghi phía máy khách", () => {
  test("ghi theo nhịp, không tính lúc tạm dừng", () => {
    let t = 1000;
    const g = new BoGhiNhatKy<"bam", null>(() => t);
    t += 120;
    expect(g.ghi("bam", null)!.nhip).toBe(2);
    g.tamDung();
    t += 10_000;
    g.tiepTuc();
    t += 100;
    expect(g.ghi("bam", null)!.nhip).toBe(4);
    t += 55;
    const kq = g.ketThuc();
    expect(kq.tong_nhip).toBe(5);
    expect(kiemMocThoiGian(kq, 275)).toBeNull();
  });

  test("dừng ghi khi đủ số thao tác tối đa", () => {
    const g = new BoGhiNhatKy<"bam", null>(() => 0);
    for (let i = 0; i < SO_THAO_TAC_TOI_DA; i++) g.ghi("bam", null);
    expect(g.ghi("bam", null)).toBeNull();
    expect(g.soThaoTac).toBe(SO_THAO_TAC_TOI_DA);
  });
});

describe("băm trạng thái", () => {
  test("không phụ thuộc thứ tự khóa, đổi khi dữ liệu đổi", () => {
    expect(bamTrangThai({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(
      bamTrangThai({ b: [1, { d: 3, c: 2 }], a: 1 }),
    );
    expect(bamTrangThai({ a: 1 })).not.toBe(bamTrangThai({ a: 2 }));
    expect(bamTrangThai([1, 2])).not.toBe(bamTrangThai([2, 1]));
    expect(bamTrangThai({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
});
