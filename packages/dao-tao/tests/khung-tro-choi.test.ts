/**
 * Khung lượt chơi chung (docs/PLAN.md GĐ-G0): luật giờ từng bước, thưởng nhanh, sao, tổng kết,
 * XP giảm dần theo số lượt trong ngày, và trò mẫu "Trắc nghiệm nhanh" (tất định theo seed để máy
 * chủ sinh lại được lượt offline).
 */
import { describe, expect, test } from "bun:test";
import type { CauHoiNguon } from "../src/de-thi.ts";
import { taoRng } from "../src/de-thi.ts";
import { layTroChoi } from "../src/tro-choi/dang-ky.ts";
import {
  buocHienTai,
  chamBuocCoGio,
  conLaiBuocMs,
  conNhanTheoHanLuot,
  DUNG_SAI_BUOC_MS,
  saoLuot,
  thuongNhanh,
  tongKetLuot,
} from "../src/tro-choi/khung.ts";
import { TRO_CHOI_THU_NGHIEM as TN } from "../src/tro-choi/thu-nghiem.ts";
import { heSoXpTheoLuot, xpLuotChoi } from "../src/tro-choi/xp.ts";

function cau(i: number, kind: CauHoiNguon["kind"] = "mot_dap_an"): CauHoiNguon {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    version: 1,
    topic_id: "chu-de",
    kind,
    level: "de",
    stem: `Câu ${i}?`,
    options:
      kind === "mot_dap_an"
        ? {
            phuong_an: [
              { id: "a", text: "Một" },
              { id: "b", text: "Hai" },
              { id: "c", text: "Ba" },
            ],
          }
        : {},
    answer: { dung: [kind === "mot_dap_an" ? "b" : "sai"] },
    explanation: "Vì thế.",
    citations: ["vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6"],
  };
}

const NGUON = [cau(1), cau(2), cau(3), cau(4, "dung_sai"), cau(5, "sap_xep")];
const T0 = new Date("2026-09-25T02:00:00Z");
const sau = (ms: number) => new Date(T0.getTime() + ms);

describe("trò mẫu Trắc nghiệm nhanh", () => {
  test("đăng ký trong bảng trò chơi", () => {
    expect(layTroChoi("thu_nghiem")).toBe(TN);
    expect(layTroChoi("khong_co")).toBeUndefined();
    expect(layTroChoi("__proto__")).toBeUndefined();
  });

  test("lượt có 3 bước, chỉ câu một đáp án hoặc đúng/sai, đề không lộ đáp án", () => {
    const buoc = TN.taoLuot(NGUON, taoRng("seed-1"));
    expect(buoc.map((b) => b.thu_tu)).toEqual([1, 2, 3]);
    for (const b of buoc) {
      expect(["mot_dap_an", "dung_sai"]).toContain(b.noi_dung.noi_dung.kind);
      const de = JSON.stringify(TN.deChoNguoiChoi(b));
      expect(de).not.toContain("answer");
      expect(de).not.toContain("explanation");
      expect(de).not.toContain("Vì thế.");
    }
  });

  test("cùng nguồn và seed thì cùng lượt, bất kể thứ tự nguồn (máy chủ sinh lại lượt offline)", () => {
    const a = TN.taoLuot(NGUON, taoRng("seed-offline"));
    const b = TN.taoLuot([...NGUON].reverse(), taoRng("seed-offline"));
    expect(b).toEqual(a);
    const c = TN.taoLuot(NGUON, taoRng("seed-khac"));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
  });

  test("đọc câu trả lời: sai dạng trả null, mảng rỗng hợp lệ (hết giờ chưa chọn)", () => {
    expect(TN.docTraLoi({ chon: ["a"] })).toEqual({ chon: ["a"] });
    expect(TN.docTraLoi({ chon: [] })).toEqual({ chon: [] });
    expect(TN.docTraLoi({ chon: "a" })).toBeNull();
    expect(TN.docTraLoi({ chon: [1] })).toBeNull();
    expect(TN.docTraLoi(null)).toBeNull();
  });

  test("chấm trên đáp án của ảnh chụp: đúng 10 điểm, sai 0", () => {
    const [b] = TN.taoLuot([cau(1)], taoRng("x"));
    expect(TN.chamBuoc(b!, { chon: ["b"] })).toMatchObject({ diem: 10, diemToiDa: 10, dung: true });
    expect(TN.chamBuoc(b!, { chon: ["a"] })).toMatchObject({ diem: 0, dung: false });
    expect(TN.chamBuoc(b!, { chon: [] })).toMatchObject({ diem: 0, dung: false });
  });
});

describe("luật giờ từng bước", () => {
  const [b] = TN.taoLuot([cau(1)], taoRng("x"));

  test("trong 20 giây: đủ điểm và có thưởng nhanh", () => {
    const kq = chamBuocCoGio(TN, b!, { chon: ["b"] }, { moLuc: T0, luc: sau(5_000), offline: false });
    expect(kq).toMatchObject({ diem: 10, hetGio: false, thoiGianMs: 5_000 });
    expect(kq.thuong).toBe(3.8); // 10 × 0,5 × (1 − 5/20) = 3,75 → 3,8
  });

  test("trong dung sai 2 giây sau hạn: vẫn được điểm, thưởng 0", () => {
    const kq = chamBuocCoGio(
      TN,
      b!,
      { chon: ["b"] },
      {
        moLuc: T0,
        luc: sau(20_000 + DUNG_SAI_BUOC_MS),
        offline: false,
      },
    );
    expect(kq).toMatchObject({ diem: 10, dung: true, thuong: 0, hetGio: false });
  });

  test("quá hạn + dung sai: 0 điểm, đánh dấu hết giờ, không ném lỗi", () => {
    const kq = chamBuocCoGio(
      TN,
      b!,
      { chon: ["b"] },
      {
        moLuc: T0,
        luc: sau(20_000 + DUNG_SAI_BUOC_MS + 1),
        offline: false,
      },
    );
    expect(kq).toMatchObject({ diem: 0, dung: false, thuong: 0, hetGio: true });
  });

  test("trả lời sai thì không có thưởng nhanh", () => {
    const kq = chamBuocCoGio(TN, b!, { chon: ["a"] }, { moLuc: T0, luc: sau(1_000), offline: false });
    expect(kq).toMatchObject({ diem: 0, thuong: 0 });
  });

  test("lượt offline: không tính giờ, không có thưởng nhanh", () => {
    const kq = chamBuocCoGio(TN, b!, { chon: ["b"] }, { moLuc: T0, luc: sau(3_600_000), offline: true });
    expect(kq).toMatchObject({ diem: 10, dung: true, thuong: 0, hetGio: false, thoiGianMs: null });
  });

  test("thưởng nhanh giảm tuyến tính, không vượt 50% điểm bước", () => {
    expect(thuongNhanh(10, 0, 20_000)).toBe(5);
    expect(thuongNhanh(10, 10_000, 20_000)).toBe(2.5);
    expect(thuongNhanh(10, 25_000, 20_000)).toBe(0);
    expect(thuongNhanh(10, -5, 20_000)).toBe(5);
  });

  test("thời gian còn lại và hạn cả lượt", () => {
    expect(conLaiBuocMs(TN, T0, sau(15_000))).toBe(5_000);
    expect(conLaiBuocMs(TN, T0, sau(30_000))).toBe(0);
    expect(conLaiBuocMs({ thoiGian: null }, T0, sau(1))).toBeNull();
    expect(conNhanTheoHanLuot(null, sau(1e9))).toBe(true);
    expect(conNhanTheoHanLuot(T0, sau(DUNG_SAI_BUOC_MS))).toBe(true);
    expect(conNhanTheoHanLuot(T0, sau(DUNG_SAI_BUOC_MS + 1))).toBe(false);
  });

  test("bước hiện tại là bước đầu chưa trả lời", () => {
    expect(buocHienTai(3, new Set())).toBe(1);
    expect(buocHienTai(3, new Set([1]))).toBe(2);
    expect(buocHienTai(3, new Set([1, 2, 3]))).toBeNull();
  });
});

describe("tổng kết và sao", () => {
  test("ngưỡng sao 50 / 70 / 90%", () => {
    expect(saoLuot(0.49)).toBe(0);
    expect(saoLuot(0.5)).toBe(1);
    expect(saoLuot(0.7)).toBe(2);
    expect(saoLuot(0.9)).toBe(3);
    expect(saoLuot(1)).toBe(3);
  });

  test("bước chưa trả lời vẫn tính vào điểm tối đa; thưởng nhanh không vào tỷ lệ", () => {
    const buoc = [{ diem_toi_da: 10 }, { diem_toi_da: 10 }, { diem_toi_da: 10 }];
    const tk = tongKetLuot(
      [
        { diem: 10, thuong: 4, dung: true },
        { diem: 0, thuong: 0, dung: false },
      ],
      buoc,
    );
    expect(tk).toMatchObject({
      diem: 10,
      thuong: 4,
      diemToiDa: 30,
      tyLe: 0.333,
      sao: 0,
      soDung: 1,
      soDaTraLoi: 2,
    });
    const du = tongKetLuot(
      buoc.map(() => ({ diem: 10, thuong: 5, dung: true })),
      buoc,
    );
    expect(du).toMatchObject({ tyLe: 1, sao: 3, thuong: 15 });
  });
});

describe("XP của lượt chơi", () => {
  test("lượt 1–3 đủ, 4–6 một nửa, từ lượt 7 bằng 0", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(heSoXpTheoLuot)).toEqual([1, 1, 1, 0.5, 0.5, 0.5, 0, 0]);
  });

  test("XP = cơ bản × tỷ lệ, nhân hệ số theo lượt", () => {
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 1, thuTuTrongNgay: 1 })).toBe(10);
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 2 / 3, thuTuTrongNgay: 2 })).toBe(7);
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 1, thuTuTrongNgay: 4 })).toBe(5);
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 1, thuTuTrongNgay: 7 })).toBe(0);
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 0, thuTuTrongNgay: 1 })).toBe(0);
    expect(xpLuotChoi({ xpCoBan: 10, tyLe: 1.5, thuTuTrongNgay: 1, thuong: 5 })).toBe(15);
  });
});
