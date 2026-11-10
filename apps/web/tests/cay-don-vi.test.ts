import { describe, expect, test } from "bun:test";
import {
  canHien,
  dsChon,
  khoaTimDonVi,
  locCay,
  NHAN_LOAI,
  thanhMucDonVi,
  timDonVi,
} from "../app/lib/cay-don-vi";

const CAY = [
  { id: "a", parent_id: null, name: "Xã A", loai: "xa" as const },
  { id: "b", parent_id: "a", name: "Trường B", loai: "don_vi_su_nghiep" as const },
  { id: "c", parent_id: "a", name: "UBND", loai: "co_quan_hanh_chinh" as const },
  { id: "d", parent_id: "b", name: "Tổ chuyên môn", loai: "khac" as const },
];

describe("khoaTimDonVi", () => {
  test("bỏ dấu, đ thành d, chữ thường, gộp khoảng trắng", () => {
    expect(khoaTimDonVi("  Đảng ủy   xã Minh Hòa ")).toBe("dang uy xa minh hoa");
  });
});

describe("timDonVi", () => {
  test("tìm không dấu", () => {
    expect(timDonVi([{ ten: "Đảng ủy xã Minh Hòa", duong: "" }], "dang uy minh hoa")).toHaveLength(1);
  });

  test("tìm theo đường dẫn cấp trên", () => {
    expect(timDonVi([{ ten: "UBND", duong: "Xã Minh Hòa" }], "minh hoa")).toHaveLength(1);
  });

  test("mọi từ phải khớp", () => {
    expect(timDonVi([{ ten: "UBND xã A", duong: "" }], "ubnd truong")).toHaveLength(0);
  });

  test("tên khớp ở đầu xếp trước", () => {
    const ds = [
      { ten: "Trường Minh Hòa", duong: "" },
      { ten: "Minh Hòa", duong: "" },
    ];
    expect(timDonVi(ds, "minh").map((d) => d.ten)).toEqual(["Minh Hòa", "Trường Minh Hòa"]);
  });

  test("chuỗi rỗng trả tối đa giới hạn", () => {
    const ds = Array.from({ length: 80 }, (_, i) => ({ ten: `Đơn vị ${i}`, duong: "" }));
    expect(timDonVi(ds, "")).toHaveLength(50);
    expect(timDonVi(ds, "  ", 10)).toHaveLength(10);
  });
});

describe("locCay", () => {
  test("giữ cấp trên của đơn vị khớp", () => {
    expect(locCay(CAY, "truong", "")).toEqual(new Set(["a", "b"]));
  });

  test("lọc theo loại", () => {
    expect(locCay(CAY, "", "co_quan_hanh_chinh")).toEqual(new Set(["a", "c"]));
  });

  test("vừa tìm vừa lọc loại", () => {
    expect(locCay(CAY, "to", "khac")).toEqual(new Set(["a", "b", "d"]));
    expect(locCay(CAY, "ubnd", "khac")).toEqual(new Set());
  });

  test("không lọc trả null", () => {
    expect(locCay(CAY, " ", "")).toBeNull();
  });
});

describe("canHien", () => {
  test("ẩn con cháu của nhánh đang thu", () => {
    const thu = new Set(["a"]);
    expect(canHien(CAY, "a", thu)).toBe(true);
    expect(canHien(CAY, "b", thu)).toBe(false);
    expect(canHien(CAY, "d", thu)).toBe(false);
  });

  test("thu nhánh con không ẩn anh em", () => {
    const thu = new Set(["b"]);
    expect(canHien(CAY, "c", thu)).toBe(true);
    expect(canHien(CAY, "d", thu)).toBe(false);
  });
});

test("nhãn loại đủ 6 loại", () => {
  expect(Object.keys(NHAN_LOAI)).toHaveLength(6);
  expect(NHAN_LOAI.to_chuc_dang).toBe("Tổ chức Đảng");
});

test("thanhMucDonVi dựng đường dẫn cấp trên", () => {
  const ds = CAY.map((d) => ({ ...d, cap: d.parent_id === null ? 1 : d.id === "d" ? 3 : 2 }));
  expect(thanhMucDonVi(ds).find((m) => m.id === "d")).toEqual({
    id: "d",
    ten: "Tổ chuyên môn",
    cap: 3,
    loai: "khac",
    duong: "Xã A › Trường B",
  });
});

describe("dsChon", () => {
  const MUC = [
    { id: "x", ten: "Xã A", cap: 1, loai: "xa" as const, duong: "" },
    { id: "d1", ten: "Chi bộ 1", cap: 2, loai: "to_chuc_dang" as const, duong: "Xã A" },
  ];

  test("lọc theo loại", () => {
    expect(dsChon(MUC, "to_chuc_dang", null).map((m) => m.id)).toEqual(["d1"]);
  });

  test("giữ giá trị đang gắn dù đã ngừng dùng hoặc đổi loại, kèm nhãn ngừng dùng", () => {
    const ds = dsChon(MUC, "to_chuc_dang", { id: "d0", ten: "Chi bộ cũ" });
    expect(ds[0]).toEqual({
      id: "d0",
      ten: "Chi bộ cũ (ngừng dùng)",
      cap: 1,
      loai: "to_chuc_dang",
      duong: "",
    });
    expect(ds).toHaveLength(2);
  });

  test("giá trị đang gắn có trong danh sách thì không thêm", () => {
    expect(dsChon(MUC, "to_chuc_dang", { id: "d1", ten: "Chi bộ 1" })).toHaveLength(1);
  });
});
