import { describe, expect, test } from "bun:test";
import { loader as daNgung } from "../app/components/tra-cuu/ChucNangDaNgung";
import { BOTTOM_NAV, dangOMuc, MAIN_NAV, MORE_NAV } from "../app/lib/site";
import { loader } from "../app/routes/tra-cuu";

function load(query = "") {
  return loader({
    request: new Request(`http://test/tra-cuu${query}`),
    params: {},
    context: {},
  } as Parameters<typeof loader>[0]);
}
describe("cửa vào tra cứu chung", () => {
  test("không coi từ khóa tìm văn bản là yêu cầu tra giao thông", () => {
    expect(load().lienKetCu).toBe(false);
    expect(load("?q=danh-gia-vien-chuc").lienKetCu).toBe(false);
  });
  test("nhận diện các liên kết giao thông cũ để hiển thị thông báo", () => {
    for (const q of ["?tab=hanh-vi", "?tab=bien-bao", "?xe=mo_to", "?cd=toc-do", "?ma=P.101"]) {
      expect(load(q).lienKetCu).toBe(true);
    }
  });
  test("URL chức năng đã ngừng trả trạng thái Gone", () => {
    expect(daNgung().init?.status).toBe(410);
  });
});
describe("điều hướng ba nhóm", () => {
  test("desktop và điện thoại có đích học và luyện tập riêng", () => {
    for (const nav of [MAIN_NAV, BOTTOM_NAV]) {
      expect(nav.some((x) => x.to === "/hoc")).toBe(true);
      expect(nav.some((x) => x.to === "/luyen-tap")).toBe(true);
      expect(nav.some((x) => x.to === "/tra-cuu")).toBe(true);
    }
    expect([...MAIN_NAV, ...BOTTOM_NAV, ...MORE_NAV].some((x) => x.to === "/dich-vu-cong")).toBe(false);
  });
  test("trang con vẫn được đánh dấu đúng mục cha", () => {
    const hoc = MAIN_NAV.find((x) => x.to === "/hoc")!;
    const luyen = MAIN_NAV.find((x) => x.to === "/luyen-tap")!;
    expect(dangOMuc(hoc, "/hoc/chuyen-de/bai")).toBe(true);
    expect(dangOMuc(luyen, "/thi/luot/123")).toBe(true);
    expect(dangOMuc(MAIN_NAV[0]!, "/hoc")).toBe(false);
  });
});
