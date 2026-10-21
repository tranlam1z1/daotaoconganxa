/**
 * Biển báo (docs/PLAN.md GĐ12): kiểm tra tệp dữ liệu, và game đoán biển báo: 4 phương án khác
 * nhau, cùng nhóm, đúng một đáp án đúng.
 */
import { describe, expect, test } from "bun:test";
import {
  type BienBao,
  type BienBaoGame,
  chamCauDoan,
  chuoiTimBienBao,
  deCauDoan,
  kiemTraBienBao,
  LoiDoanBienBao,
  taoVanDoan,
  xpTroChoi,
} from "../src/index.ts";

const bien = (ma: string, nhom: string): BienBaoGame => ({
  ma,
  nhom,
  ten: `Tên ${ma}`,
  y_nghia: "Ý nghĩa",
  anh: `${ma}.svg`,
  can_cu: "vn:x",
});

/** 6 biển cấm, 5 biển nguy hiểm, 2 biển phụ. */
const DS: BienBaoGame[] = [
  ...["P.101", "P.102", "P.103a", "P.123a", "P.130", "P.131a"].map((m) => bien(m, "cam")),
  ...["W.201a", "W.202a", "W.208", "W.224", "W.225"].map((m) => bien(m, "nguy_hiem")),
  ...["S.501", "S.502"].map((m) => bien(m, "phu")),
];
const theoMa = new Map(DS.map((b) => [b.ma, b]));

describe("đoán biển báo", () => {
  test("mỗi câu có 4 phương án khác nhau, cùng nhóm, đúng một đáp án đúng", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      for (const cau of taoVanDoan(DS, seed)) {
        expect(new Set(cau.phuong_an).size).toBe(4);
        expect(cau.phuong_an.filter((m) => m === cau.ma)).toHaveLength(1);
        const nhom = theoMa.get(cau.ma)!.nhom;
        if (nhom !== "phu") {
          // Nhóm đủ 4 biển trở lên thì mọi phương án cùng nhóm.
          expect(cau.phuong_an.every((m) => theoMa.get(m)!.nhom === nhom)).toBe(true);
        }
      }
    }
  });

  test("nhóm không đủ 4 biển thì bù phương án từ nhóm khác, vẫn 4 phương án khác nhau", () => {
    const van = taoVanDoan(DS, "x", DS.length);
    const cauPhu = van.find((c) => theoMa.get(c.ma)!.nhom === "phu")!;
    expect(new Set(cauPhu.phuong_an).size).toBe(4);
    expect(cauPhu.phuong_an.filter((m) => theoMa.get(m)!.nhom === "phu")).toHaveLength(2);
  });

  test("một ván 10 câu không lặp biển; cùng seed thì cùng ván", () => {
    const van = taoVanDoan(DS, "seed");
    expect(van).toHaveLength(10);
    expect(new Set(van.map((c) => c.ma)).size).toBe(10);
    expect(taoVanDoan([...DS].reverse(), "seed")).toEqual(van);
  });

  test("chấm theo phương án đã chọn; đề gửi đi không có mã biển", () => {
    const [cau] = taoVanDoan(DS, "k");
    const dungO = cau!.phuong_an.indexOf(cau!.ma);
    expect(chamCauDoan(cau!, String(dungO))).toBe(true);
    expect(chamCauDoan(cau!, String((dungO + 1) % 4))).toBe(false);
    expect(chamCauDoan(cau!, "9")).toBe(false);
    const de = deCauDoan(cau!, theoMa);
    expect(de.phuong_an[dungO]!.text).toBe(theoMa.get(cau!.ma)!.ten);
    expect(JSON.stringify(de)).not.toContain(`"${cau!.ma}"`);
  });

  test("ít hơn 4 biển đã duyệt thì báo thiếu dữ liệu", () => {
    expect(() => taoVanDoan(DS.slice(0, 3), "s")).toThrow(LoiDoanBienBao);
  });

  test("XP: 1 mỗi câu đúng, thêm 5 khi đúng hết", () => {
    expect(xpTroChoi("doan_bien_bao", { soDung: 10, tong: 10 })).toBe(15);
    expect(xpTroChoi("doan_bien_bao", { soDung: 7, tong: 10 })).toBe(7);
  });
});

describe("kiểm tra tệp biển báo", () => {
  const hopLe: BienBao = {
    ma: "P.102",
    nhom: "cam",
    ten: "Cấm đi ngược chiều",
    y_nghia: "Ý nghĩa.",
    anh: "P.102.svg",
    can_cu: "vn:vbqppl:qcvn:41/2024/BGTVT",
    trang_thai: "nhap",
  };

  test("dòng hợp lệ không có lỗi", () => expect(kiemTraBienBao([hopLe])).toEqual([]));

  test("bắt mã sai dạng, trùng mã, xếp nhầm nhóm, thiếu nội dung, căn cứ sai", () => {
    const loi = kiemTraBienBao([
      hopLe,
      { ...hopLe },
      { ...hopLe, ma: "W.224", nhom: "cam" },
      { ...hopLe, ma: "P102", ten: " ", can_cu: "QCVN 41" },
    ]).map((l) => l.loi);
    expect(loi).toContain("Mã biển bị trùng");
    expect(loi).toContain('Mã W.224 không thuộc nhóm "Biển báo cấm"');
    expect(loi).toContain('Mã biển không đúng dạng (ví dụ P.102): "P102"');
    expect(loi).toContain("Chưa có tên biển");
    expect(loi).toContain('Căn cứ không đúng dạng URN: "QCVN 41"');
  });

  test("chuỗi tìm kiếm không dấu", () => {
    expect(chuoiTimBienBao(hopLe)).toBe("p.102 cam di nguoc chieu");
  });
});
