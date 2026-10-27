import { expect, test } from "bun:test";
import { docBoLoc, duongTraCuu, loiBoLoc, nguonAnToan, voiNgay } from "../app/lib/bo-loc-van-ban";

test("phân trang và bỏ một lọc giữ từ khóa, ngày và các lọc khác", () => {
  const loc = docBoLoc(
    new URLSearchParams({
      q: "đánh giá viên chức",
      issuer: "Bộ Nội vụ",
      field: "cong-vu",
      asOf: "2026-10-27",
      sort: "moi_nhat",
    }),
  );
  const p = new URL(duongTraCuu(loc, 2), "http://test").searchParams;
  expect(p.get("page")).toBe("2");
  expect(p.get("q")).toBe(loc.q);
  expect(p.get("asOf")).toBe(loc.asOf);
  const clear = new URL(duongTraCuu(loc, 1, "issuer"), "http://test").searchParams;
  expect(clear.has("issuer")).toBe(false);
  expect(clear.get("field")).toBe(loc.field);
  expect(clear.has("page")).toBe(false);
});
test("ngày được giữ khi mở thẳng khoản và anchor", () => {
  expect(voiNgay("/van-ban/nd/1?dieu=dieu-2#dieu-2.khoan-1", "2026-01-01")).toBe(
    "/van-ban/nd/1?dieu=dieu-2&asOf=2026-01-01#dieu-2.khoan-1",
  );
});
test("không dùng ngày không tồn tại hoặc nguồn có giao thức nguy hiểm", () => {
  const loc = docBoLoc(new URLSearchParams({ asOf: "2026-02-30" }));
  expect(loiBoLoc(loc)).not.toBeNull();
  for (const s of ["javascript:alert(1)", "file:///secret", "https://user:password@example.com"])
    expect(nguonAnToan(s)).toBeUndefined();
  expect(nguonAnToan("https://example.com/van-ban")).toBe("https://example.com/van-ban");
});
