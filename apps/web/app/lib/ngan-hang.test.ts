import { describe, expect, test } from "bun:test";
import { type ChuDeCauHoi, maChuDeMoi, sapXepCayChuDe } from "./ngan-hang";

const cd = (id: string, parent_id: string | null, hidden = false): ChuDeCauHoi => ({
  id,
  code: `ma-${id}`,
  name: id,
  parent_id,
  field_name: null,
  ordinal: 0,
  hidden,
  so_cau: 0,
  so_da_duyet: 0,
});

describe("cây chủ đề", () => {
  const ds = [cd("a", null), cd("b", null, true), cd("b1", "b"), cd("a1", "a")];

  test("bỏ chủ đề ẩn cùng cây con", () => {
    expect(sapXepCayChuDe(ds).map((t) => t.id)).toEqual(["a", "a1"]);
  });

  test("caAn giữ đủ cây kèm độ sâu", () => {
    expect(sapXepCayChuDe(ds, { caAn: true }).map((t) => `${t.id}:${t.cap}`)).toEqual([
      "a:0",
      "a1:1",
      "b:0",
      "b1:1",
    ]);
  });

  test("giữ chủ đề đang chọn dù bị ẩn, theo id hoặc mã", () => {
    expect(sapXepCayChuDe(ds, { giu: "b1" }).map((t) => t.id)).toEqual(["a", "a1", "b1"]);
    expect(sapXepCayChuDe(ds, { giu: "ma-b" }).map((t) => t.id)).toEqual(["a", "a1", "b"]);
  });
});

describe("mã chủ đề mới", () => {
  test("sinh từ tên, bỏ dấu", () => {
    expect(maChuDeMoi("Tốc độ tối đa", new Set())).toBe("toc-do-toi-da");
  });

  test("trùng thì thêm hậu tố", () => {
    expect(maChuDeMoi("Tốc độ", new Set(["toc-do", "toc-do-2"]))).toBe("toc-do-3");
  });

  test("tên không có chữ cái dùng mã mặc định", () => {
    expect(maChuDeMoi("!!", new Set())).toBe("chu-de");
  });
});
