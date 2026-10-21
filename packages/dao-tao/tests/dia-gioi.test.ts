/**
 * Chuyển đổi địa giới hành chính trên tệp dữ liệu thật (data/dia-gioi/dia-gioi.json): chuẩn hóa dấu,
 * chuyển xã/huyện/tỉnh cũ, xã cũ bị chia, huyện đảo, tra ngược và tìm xã mới.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { diaGioi } from "../src/index.ts";

const duLieu = (await Bun.file(
  join(import.meta.dir, "..", "..", "..", "data", "dia-gioi", "dia-gioi.json"),
).json()) as diaGioi.DuLieuDiaGioi;
const bo = diaGioi.taoBoTra(duLieu);

const tinhCu = (ten: string) => bo.dsTinhCu().find((t) => t.ten === ten)!;
const huyenCu = (tinh: string, ten: string) => bo.dsHuyenCu(tinhCu(tinh).ma).find((h) => h.ten === ten)!;
const xaCu = (tinh: string, huyen: string, ten: string) =>
  bo.dsXaCu(huyenCu(tinh, huyen).ma).find((x) => x.ten === ten)!;

describe("chữ", () => {
  test("đặt dấu kiểu cũ ở oa, oe, uy cuối tiếng; giữ qu và tiếng có phụ âm cuối", () => {
    expect(diaGioi.dauKieuCu("Tỉnh Thanh Hoá")).toBe("Tỉnh Thanh Hóa");
    expect(diaGioi.dauKieuCu("Xã Hoà Lạc")).toBe("Xã Hòa Lạc");
    expect(diaGioi.dauKieuCu("Phường Xuân Thuỵ")).toBe("Phường Xuân Thụy");
    expect(diaGioi.dauKieuCu("Xã Quý Lộc")).toBe("Xã Quý Lộc");
    expect(diaGioi.dauKieuCu("Phường Hoàng Liệt")).toBe("Phường Hoàng Liệt");
  });

  test("khóa tìm bỏ dấu, đ thành d; tên riêng bỏ loại đơn vị", () => {
    expect(diaGioi.khoaTim("  Phường  Đông Hải ")).toBe("phuong dong hai");
    expect(diaGioi.tenRieng("Thành phố Hồ Chí Minh")).toBe("Hồ Chí Minh");
    expect(diaGioi.tenRieng("Đặc khu Côn Đảo")).toBe("Côn Đảo");
  });
});

describe("dữ liệu", () => {
  test("đủ 63 tỉnh cũ, 34 tỉnh mới, 3.321 xã mới; xã mới nào cũng có đơn vị cũ", () => {
    expect(duLieu.tinhCu).toHaveLength(63);
    expect(duLieu.tinhMoi).toHaveLength(34);
    expect(duLieu.xaMoi).toHaveLength(3321);
    const daDung = new Set([
      ...duLieu.xaCu.flatMap((x) => x.moi),
      ...duLieu.huyenCu.flatMap((h) => h.moi ?? []),
    ]);
    expect(duLieu.xaMoi.every((x) => daDung.has(x.ma))).toBe(true);
  });

  test("mỗi tỉnh cũ nhập vào đúng một tỉnh mới", () => {
    for (const t of duLieu.tinhCu) expect(bo.chuyenTinh(t.ma)?.tinhMoi).toHaveLength(1);
  });
});

describe("chuyển đổi", () => {
  test("phường Trường Thi (TP Thanh Hóa) nay là phường Hạc Thành, tỉnh Thanh Hóa", () => {
    const kq = bo.chuyenXa(xaCu("Tỉnh Thanh Hóa", "Thành phố Thanh Hóa", "Phường Trường Thi").ma)!;
    expect(kq.biChia).toBe(false);
    expect(kq.moi.map((m) => [m.xa.ten, m.tinh.ten])).toEqual([["Phường Hạc Thành", "Tỉnh Thanh Hóa"]]);
  });

  test("xã cũ bị chia trả đủ các xã mới", () => {
    const kq = bo.chuyenXa(xaCu("Thành phố Hà Nội", "Quận Ba Đình", "Phường Điện Biên").ma)!;
    expect(kq.biChia).toBe(true);
    expect(kq.moi.map((m) => m.xa.ten).sort()).toEqual(
      ["Phường Ba Đình", "Phường Hoàn Kiếm", "Phường Ô Chợ Dừa", "Phường Văn Miếu - Quốc Tử Giám"].sort(),
    );
  });

  test("tỉnh cũ hợp nhất: Bà Rịa - Vũng Tàu vào TP Hồ Chí Minh cùng Bình Dương", () => {
    const kq = bo.chuyenTinh(tinhCu("Tỉnh Bà Rịa - Vũng Tàu").ma)!;
    expect(kq.tinhMoi.map((t) => t.ten)).toEqual(["Thành phố Hồ Chí Minh"]);
    expect(kq.hopNhatVoi.map((t) => t.ten)).toEqual(["Tỉnh Bình Dương", "Thành phố Hồ Chí Minh"]);
  });

  test("huyện đảo không chia xã chuyển nguyên vào đặc khu", () => {
    const h = huyenCu("Tỉnh Bà Rịa - Vũng Tàu", "Huyện Côn Đảo");
    expect(bo.dsXaCu(h.ma)).toHaveLength(0);
    expect(bo.chuyenHuyen(h.ma)?.xaMoi.map((x) => x.ten)).toEqual(["Đặc khu Côn Đảo"]);
  });

  test("tên mới theo nghị quyết điều chỉnh sau 01/7/2025 (Bắc Ninh thành thành phố)", () => {
    expect(bo.dsTinhMoi().some((t) => t.ten === "Thành phố Bắc Ninh")).toBe(true);
  });
});

describe("tra ngược và tìm", () => {
  test("phường Hạc Thành gồm các phường cũ của TP Thanh Hóa, ghi rõ phường chỉ nhập một phần", () => {
    const [hac] = bo.timXaMoi("hac thanh");
    expect(hac?.xa.ten).toBe("Phường Hạc Thành");
    const kq = bo.traNguoc(hac!.xa.ma)!;
    const ten = kq.xaCu.map((x) => x.xa.ten);
    expect(ten).toContain("Phường Trường Thi");
    expect(kq.xaCu.every((x) => x.huyen.ten === "Thành phố Thanh Hóa")).toBe(true);
    expect(kq.xaCu.find((x) => x.xa.ten === "Phường Trường Thi")?.motPhan).toBe(false);
  });

  test("xã cũ tại vị trí: nhận tên bản đồ trùng đúng một xã cũ đã nhập vào xã mới", () => {
    const hac = bo.timXaMoi("hac thanh")[0]!.xa.ma;
    // OpenStreetMap ghi phường cũ không kèm loại đơn vị, phường mới ở cấp trên.
    const kq = bo.xaCuTaiViTri(hac, ["Lam Sơn", "Phường Hạc Thành"])!;
    expect([kq.xa?.ten, kq.huyen?.ten, kq.tinh?.ten]).toEqual([
      "Phường Lam Sơn",
      "Thành phố Thanh Hóa",
      "Tỉnh Thanh Hóa",
    ]);
    expect(kq.coThe).toEqual([]);

    // Không có tên, hoặc tên không thuộc xã mới: liệt kê các xã cũ, giữ huyện, tỉnh chung.
    for (const ten of [[], ["Quảng Đông", "Phường Hạc Thành"]]) {
      const chuaRo = bo.xaCuTaiViTri(hac, ten)!;
      expect(chuaRo.xa).toBeNull();
      expect(chuaRo.huyen?.ten).toBe("Thành phố Thanh Hóa");
      expect(chuaRo.coThe.map((c) => c.xa.ten)).toContain("Phường Trường Thi");
    }
    expect(bo.xaCuTaiViTri("99999", [])).toBeNull();
  });

  test("xã cũ trùng tên xã mới chỉ nhận khi tên lặp ở cấp dưới hoặc bản đồ còn ghi huyện cũ", () => {
    const giang = bo.timXaMoi("hoang giang").find((m) => m.xa.ten === "Xã Hoằng Giang")!.xa.ma;
    expect(bo.xaCuTaiViTri(giang, ["Xã Hoằng Giang"])?.xa).toBeNull();
    expect(bo.xaCuTaiViTri(giang, ["Hoằng Giang", "Xã Hoằng Giang"])?.xa?.ten).toBe("Xã Hoằng Giang");
    expect(bo.xaCuTaiViTri(giang, ["Xã Hoằng Giang", "Huyện Hoằng Hóa"])?.xa?.ten).toBe("Xã Hoằng Giang");
    expect(bo.xaCuTaiViTri(giang, ["Hoằng Quỳ", "Xã Hoằng Giang"])?.xa?.ten).toBe("Xã Hoằng Quỳ");
  });

  test("xã cũ nêu trong địa chỉ gõ: kèm loại đơn vị hoặc đứng riêng sau phần tên đường", () => {
    const hac = bo.timXaMoi("hac thanh")[0]!.xa.ma;
    const theoChu = (go: string) => bo.xaCuTaiViTri(hac, ["Phường Hạc Thành"], go)?.xa?.ten ?? null;
    expect(theoChu("12 Lê Lợi, phường Lam Sơn, Thanh Hóa")).toBe("Phường Lam Sơn");
    expect(theoChu("12 Lê Lợi P.Lam Sơn TP Thanh Hóa")).toBe("Phường Lam Sơn");
    expect(theoChu("Lê Lợi, Lam Sơn, Thanh Hóa")).toBe("Phường Lam Sơn");
    // Phần đầu là tên đường, kể cả khi trùng tên một phường cũ.
    expect(theoChu("Lam Sơn, Thanh Hóa")).toBeNull();
    expect(theoChu("12 Trường Thi, phường Điện Biên, Thanh Hóa")).toBe("Phường Điện Biên");
    // Nêu hai phường cũ, hoặc chỉ nêu phường mới: chưa rõ.
    expect(theoChu("phường Lam Sơn, phường Ba Đình")).toBeNull();
    expect(theoChu("Trần Phú, Hạc Thành, Thanh Hóa")).toBeNull();
    // Bản đồ đã ghi rõ phường cũ tại vị trí thì theo bản đồ, không theo phường nêu trong địa chỉ gõ.
    expect(bo.xaCuTaiViTri(hac, ["Điện Biên", "Phường Hạc Thành"], "Lê Lợi, phường Lam Sơn")?.xa?.ten).toBe(
      "Phường Điện Biên",
    );

    // "thị xã Nghi Sơn" là cấp huyện, không phải xã Nghi Sơn cũ.
    const nghiSon = bo.timXaMoi("nghi son").find((m) => m.xa.ten === "Phường Nghi Sơn")!.xa.ma;
    expect(bo.xaCuTaiViTri(nghiSon, [], "Quốc lộ 1, thị xã Nghi Sơn, Thanh Hóa")?.xa).toBeNull();
    expect(bo.xaCuTaiViTri(nghiSon, [], "Quốc lộ 1, xã Nghi Sơn, thị xã Nghi Sơn")?.xa?.ten).toBe(
      "Xã Nghi Sơn",
    );

    // Xã cũ trùng tên xã mới: địa chỉ gõ phải còn ghi huyện cũ.
    const giang = bo.timXaMoi("hoang giang").find((m) => m.xa.ten === "Xã Hoằng Giang")!.xa.ma;
    expect(bo.xaCuTaiViTri(giang, [], "xã Hoằng Giang, Thanh Hóa")?.xa).toBeNull();
    expect(bo.xaCuTaiViTri(giang, [], "xã Hoằng Giang, huyện Hoằng Hóa")?.xa?.ten).toBe("Xã Hoằng Giang");
  });

  test("ước lượng xã cũ theo tâm gần vị trí nhất; có xã thiếu tâm dùng được thì không ước lượng", () => {
    const hac = bo.timXaMoi("hac thanh")[0]!.xa.ma;
    const { coThe } = bo.xaCuTaiViTri(hac, [])!;
    const lamSon = coThe.find((c) => c.xa.ten === "Phường Lam Sơn")!.xa;
    const [lon, lat] = lamSon.tam!;
    expect(diaGioi.xaCuGanNhat(coThe, lat + 0.001, lon)?.xa.ten).toBe("Phường Lam Sơn");
    expect(diaGioi.xaCuGanNhat(coThe, lat, lon, (x) => x.ma !== lamSon.ma)).toBeNull();
    expect(
      diaGioi.xaCuGanNhat([...coThe, { xa: { ...lamSon, ma: "x", tam: undefined } }], lat, lon),
    ).toBeNull();
    expect(diaGioi.xaCuGanNhat([], lat, lon)).toBeNull();
  });

  test("xã mới chỉ có một đơn vị cũ thì rõ ngay, kể cả huyện đảo không chia xã", () => {
    const conDao = bo.timXaMoi("con dao")[0]!.xa.ma;
    const kq = bo.xaCuTaiViTri(conDao, [])!;
    expect([kq.xa, kq.huyen?.ten, kq.tinh?.ten]).toEqual([null, "Huyện Côn Đảo", "Tỉnh Bà Rịa - Vũng Tàu"]);
    expect(kq.coThe).toEqual([]);
  });

  test("tìm không phân biệt dấu, lọc theo tỉnh, ưu tiên tên khớp từ đầu", () => {
    const thanhHoa = bo.dsTinhMoi().find((t) => t.ten === "Tỉnh Thanh Hóa")!;
    const ds = bo.timXaMoi("Hạc", thanhHoa.ma);
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((d) => d.tinh.ma === thanhHoa.ma)).toBe(true);
    expect(diaGioi.khoaTim(diaGioi.tenRieng(ds[0]!.xa.ten)).startsWith("hac")).toBe(true);
    expect(bo.timXaMoi("   ")).toEqual([]);
  });
});

const boThon = diaGioi.taoBoTraThon(
  (await Bun.file(
    join(import.meta.dir, "..", "..", "..", "data", "dia-gioi", "thon.json"),
  ).json()) as diaGioi.DuLieuThon,
);

describe("thôn, tổ dân phố (tỉnh Thanh Hóa)", () => {
  /** Tên thôn mới của các dòng sắp xếp khớp `thon` trong xã mới tên `xa`. */
  const moi = (xa: string, thon: string, xaCu?: string) =>
    boThon.tra(bo.timXaMoi(xa, "38")[0]!.xa.ma, thon, xaCu)?.dong.map((d) => d.moi);

  test("khớp tên không phân biệt dấu, có hay không có loại đơn vị", () => {
    expect(moi("Hoằng Thanh", "Thôn Đức Tiến")).toEqual(["Thôn Nhân Ngọc"]);
    expect(moi("Hoằng Thanh", "duc tien")).toEqual(["Thôn Nhân Ngọc"]);
    expect(moi("Bỉm Sơn", "tổ 8")).toEqual(["Tổ dân phố 4"]);
    // Tên riêng mở đầu bằng chữ trùng loại đơn vị; nguồn ghi "Thôn Thôn 2" cho thôn 2.
    expect(moi("Sao Vàng", "Làng Pheo")).toEqual(["Thôn Tiên Bạn"]);
    expect(moi("Hoa Lộc", "Thôn 2")).toEqual(["Thôn Miễu Nhị"]);
    expect(moi("Giao An", "Thôn 1")).toEqual([]);
    // Tên gọi quen thuộc ghi trong ngoặc.
    expect(moi("Quảng Yên", "Hòa Trinh")).toEqual(moi("Quảng Yên", "Thôn 3"));
  });

  test("thôn trùng tên giữa các xã cũ: chọn theo xã cũ khi nguồn ghi kèm, không thì trả mọi dòng", () => {
    expect(moi("Biện Thượng", "Thôn 5", "Xã Minh Tân")).toEqual(["Thôn Bồng Hạ"]);
    expect(moi("Biện Thượng", "Thôn 5", "Xã Vĩnh Hùng")).toHaveLength(3);
    expect(moi("Nam Sầm Sơn", "Tổ dân phố 1", "Xã Quảng Minh")).toEqual(["Tổ dân phố Minh Trường"]);
  });

  test("thôn cũ bị chia thì trả mọi dòng; không thấy tên thì rỗng; xã chưa có dữ liệu thì null", () => {
    expect(moi("Hạc Thành", "TDP Ái Sơn 1")).toHaveLength(2);
    expect(moi("Hoằng Thanh", "Thôn Không Có")).toEqual([]);
    expect(moi("Hoằng Thanh", "  ")).toEqual([]);
    expect(boThon.tra(bo.timXaMoi("Ba Đình", "01")[0]!.xa.ma, "Thôn 1")).toBeNull();
  });
});
