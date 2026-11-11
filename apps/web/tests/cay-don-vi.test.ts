import { describe, expect, test } from "bun:test";
import {
  dsChon,
  ketQuaChon,
  khoaTimDonVi,
  locCay,
  locTheoThu,
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

  test("tìm được theo mã đơn vị và mã xã", () => {
    const ds = [
      { id: "a", parent_id: null, name: "Xã A", loai: "xa" as const, code: "XA-MH", ma_hanh_chinh: "00070" },
      { id: "c", parent_id: "a", name: "UBND", loai: "co_quan_hanh_chinh" as const, code: "UBND-MH" },
    ];
    expect(locCay(ds, "ubnd-mh", "")).toEqual(new Set(["a", "c"]));
    expect(locCay(ds, "00070", "")).toEqual(new Set(["a"]));
  });
});

describe("locTheoThu", () => {
  const id = (ds: { id: string }[]) => ds.map((d) => d.id);

  test("ẩn con cháu của nhánh đang thu", () => {
    expect(id(locTheoThu(CAY, new Set(["a"])))).toEqual(["a"]);
  });

  test("thu nhánh con không ẩn anh em", () => {
    expect(id(locTheoThu(CAY, new Set(["b"])))).toEqual(["a", "b", "c"]);
  });

  test("không thu gì thì hiện hết, giữ thứ tự", () => {
    expect(id(locTheoThu(CAY, new Set()))).toEqual(["a", "b", "c", "d"]);
  });
});

describe("ketQuaChon", () => {
  const NHIEU = Array.from({ length: 60 }, (_, i) => ({ id: `u${i}`, ten: `Đơn vị ${i}`, duong: "" }));

  test("chưa gõ: hiện giới hạn đầu và báo số còn lại", () => {
    const kq = ketQuaChon(NHIEU, "", "", 50);
    expect(kq.muc).toHaveLength(50);
    expect(kq.conLai).toBe(10);
  });

  test("đơn vị đang chọn nằm ngoài giới hạn vẫn có trong danh sách, đứng đầu", () => {
    const kq = ketQuaChon(NHIEU, "", "u55", 50);
    expect(kq.muc[0]?.id).toBe("u55");
    expect(kq.muc).toHaveLength(51);
    expect(kq.conLai).toBe(9);
  });

  test("đang gõ thì chỉ hiện kết quả khớp, không chèn đơn vị đang chọn", () => {
    const kq = ketQuaChon(NHIEU, "don vi 5", "u10", 50);
    expect(kq.muc[0]?.id).toBe("u5");
    expect(kq.muc.some((d) => d.id === "u10")).toBe(false);
    expect(kq.conLai).toBe(0);
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
