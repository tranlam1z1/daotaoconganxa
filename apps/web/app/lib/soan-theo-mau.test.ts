import { expect, test } from "bun:test";

import { nhanTruong, rutGoiY } from "./soan-theo-mau";

test("rutGoiY suy kiểu, chỗ để trống và giá trị hay dùng theo tên trường", () => {
  const g = rutGoiY([
    { xe: { loai_xe: "o_to", dung_tich: null, han: "2027-03-31" }, hang: ["B"], loi_ke: "x".repeat(81) },
    { xe: { loai_xe: "xe_may", dung_tich: 115, han: null }, hang: ["A1", "B"], giay_phep: null },
  ]);
  expect(g.loai_xe).toEqual({ kieu: "chu", coRong: false, dai: false, giaTri: ["o_to", "xe_may"] });
  expect(g.dung_tich).toMatchObject({ kieu: "so", coRong: true });
  expect(g.han).toMatchObject({ kieu: "ngay", coRong: true, giaTri: [] });
  // Phần tử của mảng góp giá trị gợi ý, không đổi kiểu của trường chứa mảng.
  expect(g.hang).toMatchObject({ kieu: "khac", giaTri: ["B", "A1"] });
  expect(g.loi_ke).toMatchObject({ dai: true, giaTri: [] });
  expect(g.giay_phep).toEqual({ coRong: true, dai: false, giaTri: [] });
});

test("nhanTruong đọc mã khi chưa có tên", () => {
  expect(nhanTruong("bien_so")).toBe("Biển số");
  expect(nhanTruong("nhip_giua")).toBe("Nhip giua");
});
