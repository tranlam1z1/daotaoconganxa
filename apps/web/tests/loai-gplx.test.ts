/// <reference types="bun" />
/** Xác định loại GPLX theo phương tiện (app/lib/loai-gplx.ts). */
import { describe, expect, test } from "bun:test";
import {
  doiChieuHangCu,
  doiChieuHangMoi,
  hangCanCo,
  khungKhongPhuHop,
  type PhuongTien,
} from "../app/lib/loai-gplx";

const moTo = (dungTich: number): PhuongTien => ({ loai: "mo-to-2", dongCo: "xang", dungTich });
const tai = (khoiLuongToanBo: number, them: Partial<PhuongTien> = {}): PhuongTien => ({
  loai: "tai",
  khoiLuongToanBo,
  ...them,
});
const choNguoi = (soCho: number, them: Partial<PhuongTien> = {}): PhuongTien => ({
  loai: "cho-nguoi",
  soCho,
  ...them,
});

describe("hangCanCo", () => {
  test("xe gắn máy không cần giấy phép lái xe", () => {
    expect(hangCanCo({ loai: "xe-gan-may" }).hang).toBeNull();
  });
  test("mô tô hai bánh chia ở 125 cm³ và 11 kW; ba bánh là B1", () => {
    expect(hangCanCo(moTo(125)).hang).toBe("A1");
    expect(hangCanCo(moTo(150)).hang).toBe("A");
    expect(hangCanCo({ loai: "mo-to-2", dongCo: "dien", congSuat: 11 }).hang).toBe("A1");
    expect(hangCanCo({ loai: "mo-to-2", dongCo: "dien", congSuat: 11.5 }).hang).toBe("A");
    expect(hangCanCo({ loai: "mo-to-3" }).hang).toBe("B1");
  });
  test("xe chở người chia theo số chỗ; xe giường nằm là hạng D", () => {
    expect(hangCanCo(choNguoi(8)).hang).toBe("B");
    expect(hangCanCo(choNguoi(9)).hang).toBe("D1");
    expect(hangCanCo(choNguoi(16)).hang).toBe("D1");
    expect(hangCanCo(choNguoi(29)).hang).toBe("D2");
    expect(hangCanCo(choNguoi(30)).hang).toBe("D");
    expect(hangCanCo(choNguoi(20, { giuongNam: true })).hang).toBe("D");
  });
  test("xe tải chia theo khối lượng toàn bộ theo thiết kế", () => {
    expect(hangCanCo(tai(3500)).hang).toBe("B");
    expect(hangCanCo(tai(7500)).hang).toBe("C1");
    expect(hangCanCo(tai(7501)).hang).toBe("C");
  });
  test("rơ moóc trên 750 kg cần hạng kéo rơ moóc, đến 750 kg thì hạng gốc", () => {
    expect(hangCanCo(tai(3000, { roMooc: 750 })).hang).toBe("B");
    expect(hangCanCo(tai(3000, { roMooc: 751 })).hang).toBe("BE");
    expect(hangCanCo(tai(9000, { roMooc: 2000 })).hang).toBe("CE");
    expect(hangCanCo(choNguoi(12, { roMooc: 1000 })).hang).toBe("D1E");
    expect(hangCanCo({ loai: "dau-keo" }).hang).toBe("CE");
    expect(hangCanCo({ loai: "noi-toa" }).hang).toBe("DE");
  });
  test("liệt kê các hạng khác gồm xe của hạng cần có", () => {
    expect(hangCanCo(tai(3000)).hangKhac).toEqual(["C1", "C", "D1", "D2", "D"]);
    expect(hangCanCo(moTo(110)).hangKhac).toEqual(["A", "B1"]);
    expect(hangCanCo({ loai: "dau-keo" }).hangKhac).toEqual([]);
  });
});

describe("doiChieuHangMoi", () => {
  test("hạng cao hơn gồm xe của hạng thấp hơn", () => {
    expect(doiChieuHangMoi(tai(3000), "C").ketLuan).toBe("phu-hop");
    expect(doiChieuHangMoi(choNguoi(12), "D2").ketLuan).toBe("phu-hop");
    expect(doiChieuHangMoi(moTo(110), "B1").ketLuan).toBe("phu-hop");
  });
  test("hạng không gồm loại xe thì không phù hợp", () => {
    expect(doiChieuHangMoi(tai(9000), "C1").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangMoi(choNguoi(12), "C").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangMoi(moTo(150), "A1").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangMoi(tai(3000), "A").ketLuan).toBe("khong-phu-hop");
  });
  test("hạng kéo rơ moóc với xe của hạng gốc: cần xem thêm, không khẳng định", () => {
    expect(doiChieuHangMoi(tai(9000), "CE").ketLuan).toBe("can-xem-them");
    expect(doiChieuHangMoi(tai(3000, { roMooc: 1000 }), "CE").ketLuan).toBe("can-xem-them");
    expect(doiChieuHangMoi(tai(9000), "BE").ketLuan).toBe("khong-phu-hop");
  });
  test("đầu kéo chỉ hạng CE, xe nối toa chỉ hạng DE", () => {
    expect(doiChieuHangMoi({ loai: "dau-keo" }, "CE").ketLuan).toBe("phu-hop");
    expect(doiChieuHangMoi({ loai: "dau-keo" }, "DE").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangMoi({ loai: "noi-toa" }, "DE").ketLuan).toBe("phu-hop");
  });
});

describe("doiChieuHangCu", () => {
  test("hạng A1 cũ điều khiển được mô tô dưới 175 cm³, kể cả xe trên 125 cm³", () => {
    expect(doiChieuHangCu(moTo(150), "A1").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(moTo(175), "A1").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu(moTo(175), "A2").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu({ loai: "mo-to-3" }, "A3").ketLuan).toBe("phu-hop");
  });
  test("xe tải xét theo trọng tải, không theo khối lượng toàn bộ", () => {
    // Khối lượng toàn bộ 5.000 kg cần hạng C1 mới, nhưng trọng tải 2.400 kg thuộc hạng B2 cũ.
    const xe = tai(5000, { trongTai: 2400 });
    expect(hangCanCo(xe).hang).toBe("C1");
    expect(doiChieuHangCu(xe, "B2").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(tai(9000, { trongTai: 3500 }), "B2").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu(tai(9000, { trongTai: 3500 }), "C").ketLuan).toBe("phu-hop");
  });
  test("xe chở người: D đến 29 chỗ, E trên 29 chỗ, hạng trên gồm hạng dưới", () => {
    expect(doiChieuHangCu(choNguoi(29), "D").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(choNguoi(30), "D").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu(choNguoi(45), "E").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(choNguoi(7), "E").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(choNguoi(7), "A2").ketLuan).toBe("khong-phu-hop");
  });
  test("B1 số tự động chỉ phù hợp có điều kiện", () => {
    expect(doiChieuHangCu(choNguoi(4), "B1-td").ketLuan).toBe("can-xem-them");
  });
  test("kéo rơ moóc trên 750 kg cần hạng F; đầu kéo chỉ FC, nối toa chỉ FE", () => {
    const xe = tai(9000, { trongTai: 5000, roMooc: 3000 });
    expect(doiChieuHangCu(xe, "C").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu(xe, "FC").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu(xe, "FB2").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu(tai(9000, { trongTai: 5000 }), "FC").ketLuan).toBe("can-xem-them");
    expect(doiChieuHangCu({ loai: "dau-keo" }, "FC").ketLuan).toBe("phu-hop");
    expect(doiChieuHangCu({ loai: "dau-keo" }, "FE").ketLuan).toBe("khong-phu-hop");
    expect(doiChieuHangCu({ loai: "noi-toa" }, "FE").ketLuan).toBe("phu-hop");
  });
});

describe("khungKhongPhuHop", () => {
  test("ba khung theo loại xe", () => {
    expect(khungKhongPhuHop(moTo(110))).toMatchObject({ phatTu: 2_000_000, phatDen: 4_000_000 });
    expect(khungKhongPhuHop(moTo(150))).toMatchObject({ phatTu: 6_000_000, phatDen: 8_000_000 });
    expect(khungKhongPhuHop({ loai: "mo-to-3" })).toMatchObject({ phatTu: 6_000_000, phatDen: 8_000_000 });
    expect(khungKhongPhuHop(tai(9000))).toMatchObject({ phatTu: 18_000_000, phatDen: 20_000_000 });
    expect(khungKhongPhuHop({ loai: "xe-gan-may" })).toBeNull();
  });
});
