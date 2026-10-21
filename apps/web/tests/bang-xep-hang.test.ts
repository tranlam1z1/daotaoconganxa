/// <reference types="bun" />
/** Chia khối trang Bảng xếp hạng (app/lib/bang-xep-hang.ts): bục, bảng, nhóm 0 XP, đồng hạng, vị trí của mình. */
import { describe, expect, test } from "bun:test";
import { bangCap, chiaBoCuc, laDongHang, viTriCuaToi } from "../app/lib/bang-xep-hang";
import type { BangXepHang } from "../app/lib/diem-thuong";

type Dong = BangXepHang["items"][number];

/** Bảng cá nhân từ danh sách [tên, xp, hạng]; `toi` là tên của người xem. */
const caNhan = (
  ds: Array<[string, number, number]>,
  toi: string,
): Pick<BangXepHang, "pham_vi" | "items"> => ({
  pham_vi: "don_vi",
  items: ds.map(([ten, xp, hang]) => ({ ten, xp, hang, cap: 1, la_toi: ten === toi })),
});
const ten = (ds: Dong[]) => ds.map((d) => d.ten);

describe("chiaBoCuc", () => {
  test("bục là 3 dòng đầu có XP, bảng từ dòng thứ tư, người 0 XP tách riêng", () => {
    const b = caNhan(
      [
        ["A", 50, 1],
        ["B", 40, 2],
        ["C", 40, 2],
        ["D", 30, 4],
        ["E", 0, 5],
        ["F", 0, 5],
      ],
      "A",
    );
    const bc = chiaBoCuc(b);
    expect(ten(bc.buc)).toEqual(["A", "B", "C"]);
    expect(ten(bc.bang)).toEqual(["D"]);
    expect(ten(bc.chuaCoDiem)).toEqual(["E", "F"]);
  });

  test("ít hơn 3 người có XP: bục chỉ có số người đang có, bảng rỗng", () => {
    const bc = chiaBoCuc(
      caNhan(
        [
          ["A", 5, 1],
          ["B", 0, 2],
        ],
        "B",
      ),
    );
    expect(ten(bc.buc)).toEqual(["A"]);
    expect(bc.bang).toEqual([]);
    expect(ten(bc.chuaCoDiem)).toEqual(["B"]);
  });

  test("bảng đơn vị xét XP trung bình mỗi người", () => {
    const bc = chiaBoCuc({
      pham_vi: "cac_don_vi",
      items: [
        { ten: "Đội 1", xp_trung_binh: 12.5, hang: 1 },
        { ten: "Đội 2", xp_trung_binh: 0, hang: 2 },
      ],
    });
    expect(ten(bc.buc)).toEqual(["Đội 1"]);
    expect(ten(bc.chuaCoDiem)).toEqual(["Đội 2"]);
  });
});

describe("laDongHang", () => {
  test("đánh dấu cả hai phía của nhóm đồng hạng, kể cả khi nhóm vắt qua bục và bảng", () => {
    const ds = caNhan(
      [
        ["A", 50, 1],
        ["B", 40, 2],
        ["C", 30, 3],
        ["D", 30, 3],
        ["E", 20, 5],
      ],
      "A",
    ).items;
    expect(ds.map((_, i) => laDongHang(ds, i))).toEqual([false, false, true, true, false]);
  });

  test("ba người đầu đồng hạng 1", () => {
    const ds = caNhan(
      [
        ["A", 10, 1],
        ["B", 10, 1],
        ["C", 10, 1],
      ],
      "A",
    ).items;
    expect(ds.map((_, i) => laDongHang(ds, i))).toEqual([true, true, true]);
  });
});

describe("viTriCuaToi", () => {
  test("hạng X trên Y người có XP; còn (XP người trên − XP mình + 1) để lên hạng X − 1", () => {
    const v = viTriCuaToi(
      caNhan(
        [
          ["A", 50, 1],
          ["B", 40, 2],
          ["C", 25, 3],
          ["D", 0, 4],
        ],
        "C",
      ),
    );
    expect(v).toMatchObject({ hang: 3, tren: 3, diem: 25, dongHang: false, lenHang: { con: 16, hang: 2 } });
  });

  test("đang đồng hạng: tính theo người gần nhất có XP cao hơn, không theo người cùng hạng", () => {
    const b = caNhan(
      [
        ["A", 50, 1],
        ["B", 40, 2],
        ["C", 40, 2],
        ["D", 30, 4],
      ],
      "C",
    );
    expect(viTriCuaToi(b)).toMatchObject({ hang: 2, dongHang: true, lenHang: { con: 11, hang: 1 } });
    // Người hạng 4 dưới nhóm đồng hạng 2: vượt nhóm đó thì lên hạng 2 (không có hạng 3).
    expect(viTriCuaToi({ ...b, items: b.items.map((d) => ({ ...d, la_toi: d.ten === "D" })) })).toMatchObject(
      {
        hang: 4,
        lenHang: { con: 11, hang: 2 },
      },
    );
  });

  test("hạng 1, kể cả đồng hạng 1, không có dòng lên hạng", () => {
    expect(viTriCuaToi(caNhan([["A", 5, 1]], "A"))?.lenHang).toBeNull();
    const dong = viTriCuaToi(
      caNhan(
        [
          ["A", 5, 1],
          ["B", 5, 1],
        ],
        "B",
      ),
    );
    expect(dong).toMatchObject({ hang: 1, dongHang: true, lenHang: null });
  });

  test("bản thân 0 XP trong kỳ: không có vị trí", () => {
    expect(
      viTriCuaToi(
        caNhan(
          [
            ["A", 5, 1],
            ["B", 0, 2],
          ],
          "B",
        ),
      ),
    ).toBeNull();
  });

  test("bảng đơn vị: có hạng và XP/người, không tính dòng lên hạng", () => {
    const v = viTriCuaToi({
      pham_vi: "cac_don_vi",
      items: [
        { ten: "Đội 1", xp_trung_binh: 25, hang: 1 },
        { ten: "Đội 2", xp_trung_binh: 20.5, hang: 2, la_cua_toi: true },
      ],
    });
    expect(v).toMatchObject({ hang: 2, tren: 2, diem: 20.5, lenHang: null });
  });
});

describe("bangCap", () => {
  test("mỗi cấp từ ngưỡng của nó tới ngưỡng cấp sau trừ 1; cấp cuối không có trần", () => {
    const c = bangCap([0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000]);
    expect(c).toHaveLength(10);
    expect(c[0]).toEqual({ cap: 1, tuXp: 0, denXp: 99 });
    expect(c[2]).toEqual({ cap: 3, tuXp: 250, denXp: 499 });
    expect(c[9]).toEqual({ cap: 10, tuXp: 5000, denXp: null });
  });
});
