import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { loader } from "../app/routes/tra-cuu";

const fixtures = [
  { ma: "test-oto", xe: "o_to", nhom: "Tốc độ" },
  { ma: "test-moto", xe: "mo_to", nhom: "Tốc độ" },
  { ma: "test-con", xe: "o_to", nhom: "Nồng độ cồn, chất kích thích" },
];
let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => fetchSpy?.mockRestore());
function setup(items = fixtures) {
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(async () => Response.json({ items, total: items.length }), {
      preconnect: globalThis.fetch.preconnect,
    }),
  );
}
async function load(query: string) {
  return loader({
    request: new Request(`http://test/tra-cuu?tab=hanh-vi${query}`),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0]);
}
describe("tra cứu hành vi khi mở tab", () => {
  test("hiện danh sách cùng số đếm chủ đề ngay khi chưa nhập từ khóa", async () => {
    setup();
    const d = await load("");
    expect(d.daTra).toBe(true);
    expect(d.mucPhat).toHaveLength(3);
    expect((d.demChuDe as Record<string, number>)["Tốc độ"]).toBe(2);
  });
  test("lọc loại xe và chủ đề vẫn giữ đúng kết quả", async () => {
    setup();
    const d = await load("&xe=mo_to&cd=toc-do");
    expect(d.mucPhat.map((x) => x.ma)).toEqual(["test-moto"]);
    expect((d.demChuDe as Record<string, number>)["Tốc độ"]).toBe(1);
  });
  test("kho rỗng vẫn hiển thị trạng thái kết quả để báo thiếu dữ liệu", async () => {
    setup([]);
    const d = await load("");
    expect(d.daTra).toBe(true);
    expect(d.mucPhat).toHaveLength(0);
  });
});
