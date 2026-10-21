/**
 * Trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2): suy đáp án từ khung phạt, chấm ba câu nhỏ, bộ sinh
 * lượt, và kiểm tra các tệp dữ liệu thật (mức phạt theo tốc độ, tốc độ tối đa, 20 tình huống demo).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { taoRng } from "../src/de-thi.ts";
import {
  type DongMucPhat,
  type DongTocDoToiDa,
  type KhoangTocDo,
  kiemTraTocDoToiDa,
  LOAI_XE,
  type LoaiXe,
} from "../src/tra-cuu-nhanh.ts";
import { chamBuocCoGio } from "../src/tro-choi/khung.ts";
import {
  DIEM_MOI_XE,
  type KhungPhatTocDo,
  khoaBoSung,
  kiemTraTinhHuongTocDo,
  type NguonSungBan,
  TRO_CHOI_SUNG_BAN_TOC_DO as SB,
  suyDapAnSungBan,
  type TinhHuongTocDo,
} from "../src/tro-choi/sung-ban-toc-do.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const mucPhat = ((await Bun.file(join(GOC, "data/tra-cuu/muc-phat.json")).json()) as { dong: DongMucPhat[] })
  .dong;
const tinhHuongTep = (
  (await Bun.file(join(GOC, "data/tro-choi/sung-ban-toc-do.json")).json()) as {
    tinh_huong: Array<{ ma: string; du_kien: TinhHuongTocDo }>;
  }
).tinh_huong;
const tocDoTep = (
  (await Bun.file(join(GOC, "data/tra-cuu/toc-do-toi-da.json")).json()) as { dong: DongTocDoToiDa[] }
).dong;

/** Khung phạt theo tốc độ trong tệp thật (bản nháp), dạng trò chơi dùng. */
function khungTuTep(xe: LoaiXe): KhungPhatTocDo[] {
  return mucPhat
    .filter((d) => d.xe === xe && d.toc_do_vuot)
    .map((d) => ({
      ma: d.ma,
      version: 1,
      toc_do_vuot: d.toc_do_vuot!,
      phat_tu: d.phat_tu,
      phat_den: d.phat_den,
      tru_diem: d.tru_diem ?? null,
      hinh_thuc_bo_sung: d.hinh_thuc_bo_sung ?? [],
      can_cu: d.can_cu,
    }));
}

const k = (
  ma: string,
  tu: number,
  den: number | null,
  bien: KhoangTocDo["bien"],
  truDiem: number | null = null,
): KhungPhatTocDo => ({
  ma,
  version: 1,
  toc_do_vuot: { tu, den, bien },
  phat_tu: 1_000_000,
  phat_den: 2_000_000,
  tru_diem: truDiem,
  hinh_thuc_bo_sung: [],
  can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6",
});
const KHUNG = [
  k("a", 5, 10, "[)"),
  k("b", 10, 20, "[]", 2),
  k("c", 20, 35, "(]", 4),
  k("d", 35, null, "()", 6),
];
const xe = (bien: number, doDuoc: number): TinhHuongTocDo => ({
  loai_xe: "o_to",
  mo_ta_xe: "Xe thử",
  boi_canh: "Đoạn thử",
  bien_toc_do: bien,
  toc_do_do: doDuoc,
});

describe("suy đáp án", () => {
  test("trên toàn bộ khung phạt thật: mọi tổ hợp biển × tốc độ ra đúng một đáp án, không có khoảng trống", () => {
    for (const loai of LOAI_XE) {
      const khung = khungTuTep(loai);
      expect(khung.length).toBeGreaterThan(0);
      const thapNhat = Math.min(...khung.map((x) => x.toc_do_vuot.tu));
      for (let bien = 5; bien <= 150; bien += 5) {
        for (let v = 0; v <= 300; v += 0.5) {
          const d = suyDapAnSungBan({ ...xe(bien, v), loai_xe: loai }, khung);
          if (!d) throw new Error(`${loai}, biển ${bien}, đo ${v}: không suy được đáp án`);
          const vuot = Math.max(0, Math.round((v - bien) * 10) / 10);
          expect(d.vi_pham).toBe(vuot >= thapNhat);
          if (d.vi_pham) expect(khung.filter((x) => x.ma === d.khung_ma)).toHaveLength(1);
        }
      }
    }
  });

  test("biên: dưới 5 km/h không bị phạt; đúng 5, 10, 20, 35 rơi đúng khoảng theo cách viết cận", () => {
    expect(suyDapAnSungBan(xe(50, 48), KHUNG)).toMatchObject({ vi_pham: false, vuot: 0 });
    expect(suyDapAnSungBan(xe(50, 54.5), KHUNG)).toMatchObject({ vi_pham: false, vuot: 4.5 });
    expect(suyDapAnSungBan(xe(50, 55), KHUNG)).toMatchObject({ vi_pham: true, khung_ma: "a" });
    expect(suyDapAnSungBan(xe(50, 60), KHUNG)).toMatchObject({ khung_ma: "b" });
    expect(suyDapAnSungBan(xe(50, 70), KHUNG)).toMatchObject({ khung_ma: "b" });
    expect(suyDapAnSungBan(xe(50, 70.5), KHUNG)).toMatchObject({ khung_ma: "c" });
    expect(suyDapAnSungBan(xe(50, 85), KHUNG)).toMatchObject({ khung_ma: "c" });
    expect(suyDapAnSungBan(xe(50, 85.5), KHUNG)).toMatchObject({ khung_ma: "d" });
  });

  test("tốc độ tối đa là số trên biển của tình huống", () => {
    expect(suyDapAnSungBan(xe(80, 86), KHUNG)).toMatchObject({ vuot: 6, khung_ma: "a" });
    expect(suyDapAnSungBan(xe(40, 46), KHUNG)).toMatchObject({ vuot: 6, khung_ma: "a" });
  });

  test("thiếu khung ở giữa hoặc khung chồng nhau: không dùng được tình huống", () => {
    const thieu = [k("a", 5, 10, "[)"), k("d", 35, null, "()")];
    expect(suyDapAnSungBan(xe(50, 65), thieu)).toBeNull();
    expect(suyDapAnSungBan(xe(50, 52), thieu)).toMatchObject({ vi_pham: false });
    expect(suyDapAnSungBan(xe(50, 65), [...KHUNG, k("x", 12, 18, "[]")])).toBeNull();
    expect(suyDapAnSungBan(xe(50, 90), [])).toBeNull();
  });
});

describe("chấm ba câu nhỏ", () => {
  const nguon = (id: string, t: TinhHuongTocDo): NguonSungBan => ({
    id,
    code: id,
    version: 1,
    topic_id: null,
    tinh_huong: t,
    khung: KHUNG,
  });
  const [bViPham] = SB.taoLuot([nguon("x1", xe(50, 65))], taoRng("s"));
  const [bKhong] = SB.taoLuot([nguon("x2", xe(50, 52))], taoRng("s"));

  test("đúng cả ba câu: 10 điểm; sai câu 1: 0 điểm", () => {
    expect(
      SB.chamBuoc(bViPham!, { vi_pham: true, khung: "b", bo_sung: khoaBoSung(KHUNG[1]!) }),
    ).toMatchObject({
      diem: DIEM_MOI_XE,
      dung: true,
    });
    expect(SB.chamBuoc(bViPham!, { vi_pham: false })).toMatchObject({ diem: 0, dung: false });
    expect(SB.chamBuoc(bViPham!, { vi_pham: null })).toMatchObject({ diem: 0, dung: false });
  });

  test("đúng câu 1, sai khung: 3 + 3; sai hình thức bổ sung: 3 + 4", () => {
    expect(SB.chamBuoc(bViPham!, { vi_pham: true, khung: "a", bo_sung: khoaBoSung(KHUNG[1]!) }).diem).toBe(6);
    expect(SB.chamBuoc(bViPham!, { vi_pham: true, khung: "b", bo_sung: "khong" }).diem).toBe(7);
    expect(SB.chamBuoc(bViPham!, { vi_pham: true, khung: null, bo_sung: null }).diem).toBe(3);
  });

  test("xe không bị phạt, trả lời Không: đủ 10 điểm", () => {
    expect(SB.chamBuoc(bKhong!, { vi_pham: false })).toMatchObject({ diem: 10, dung: true });
    expect(SB.chamBuoc(bKhong!, { vi_pham: true, khung: "a", bo_sung: "khong" })).toMatchObject({ diem: 0 });
  });

  test("giải thích và căn cứ lấy từ khung phạt; câu 3 có lựa chọn Không và các tổ hợp của khung", () => {
    const kq = SB.chamBuoc(bViPham!, { vi_pham: true, khung: "b", bo_sung: "khong" });
    expect(kq.giaiThich).toContain("vượt 15 km/h");
    expect(kq.giaiThich).toContain("trừ 2 điểm");
    expect(kq.canCu).toEqual(["vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6"]);
    const ids = bViPham!.noi_dung.lua_chon_bo_sung.map((o) => o.id).sort();
    expect(ids).toEqual(["bs|2|", "bs|4|", "bs|6|", "khong"].sort());
  });

  test("12 giây mỗi xe: quá hạn + dung sai được 0 điểm (dùng luật giờ của khung chung)", () => {
    const t0 = new Date("2026-09-25T02:00:00Z");
    const tl = { vi_pham: true, khung: "b", bo_sung: khoaBoSung(KHUNG[1]!) };
    const trongHan = chamBuocCoGio(SB, bViPham!, tl, {
      moLuc: t0,
      luc: new Date(t0.getTime() + 13_000),
      offline: false,
    });
    expect(trongHan).toMatchObject({ diem: 10, hetGio: false });
    const quaHan = chamBuocCoGio(SB, bViPham!, tl, {
      moLuc: t0,
      luc: new Date(t0.getTime() + 14_001),
      offline: false,
    });
    expect(quaHan).toMatchObject({ diem: 0, hetGio: true });
  });

  test("đề gửi đi không có đáp án, mức tiền hay khung đúng", () => {
    const de = JSON.stringify(SB.deChoNguoiChoi(bViPham!));
    for (const cam of ["dap_an", "phat_tu", "phat_den", "tru_diem", "can_cu", "khung_ma"])
      expect(de).not.toContain(cam);
  });

  test("đọc câu trả lời: sai dạng trả null", () => {
    expect(SB.docTraLoi({ vi_pham: false })).toEqual({ vi_pham: false, khung: null, bo_sung: null });
    expect(SB.docTraLoi({ vi_pham: null })).toEqual({ vi_pham: null, khung: null, bo_sung: null });
    expect(SB.docTraLoi({ vi_pham: "co" })).toBeNull();
    expect(SB.docTraLoi({ vi_pham: true, khung: 5 })).toBeNull();
    expect(SB.docTraLoi(null)).toBeNull();
  });
});

describe("bộ sinh lượt", () => {
  const ds: NguonSungBan[] = Array.from({ length: 14 }, (_, i) => ({
    id: `id-${String(i).padStart(2, "0")}`,
    code: `TC-${i}`,
    version: 1,
    topic_id: null,
    tinh_huong: xe(50, i < 3 ? 48 : 56 + i * 3),
    khung: KHUNG,
  }));

  test("10 xe, ít nhất 2 xe không bị phạt, tất định theo seed và không phụ thuộc thứ tự nguồn", () => {
    const a = SB.taoLuot(ds, taoRng("seed"));
    expect(a).toHaveLength(10);
    expect(a.filter((b) => !b.noi_dung.dap_an.vi_pham).length).toBeGreaterThanOrEqual(2);
    expect(SB.taoLuot([...ds].reverse(), taoRng("seed"))).toEqual(a);
  });

  test("bỏ tình huống không suy được đáp án (thiếu khung đã duyệt) và tình huống sai dữ kiện", () => {
    const hong: NguonSungBan[] = [
      { ...ds[5]!, id: "thieu-khung", khung: [] },
      { ...ds[6]!, id: "sai", tinh_huong: { ...xe(50, 60), bien_toc_do: 0 } },
    ];
    expect(SB.locNguon([...hong, ds[7]!]).map((n) => (n as NguonSungBan).id)).toEqual([ds[7]!.id]);
  });
});

describe("tệp dữ liệu thật", () => {
  test("20 tình huống demo hợp lệ, suy được đáp án với khung phạt trong tệp, phủ mọi khung", () => {
    expect(tinhHuongTep).toHaveLength(20);
    const khungGap = new Set<string>();
    let khong = 0;
    for (const t of tinhHuongTep) {
      expect(kiemTraTinhHuongTocDo(t.du_kien)).toEqual([]);
      const d = suyDapAnSungBan(t.du_kien, khungTuTep(t.du_kien.loai_xe));
      if (!d) throw new Error(`${t.ma}: không suy được đáp án`);
      if (d.khung_ma) khungGap.add(d.khung_ma);
      else khong++;
    }
    expect(khong).toBeGreaterThanOrEqual(2);
    const moiKhung = mucPhat.filter((d) => d.toc_do_vuot).map((d) => d.ma);
    expect([...khungGap].sort()).toEqual(moiKhung.sort());
  });

  test("tệp tốc độ tối đa hợp lệ; dòng chưa có số liệu không được ở trạng thái đã duyệt", () => {
    expect(kiemTraTocDoToiDa(tocDoTep)).toEqual([]);
    expect(tocDoTep.every((d) => d.toc_do_toi_da === null)).toBe(true);
    const sai = kiemTraTocDoToiDa([{ ...tocDoTep[0]!, toc_do_toi_da: 50, can_cu: null }]);
    expect(sai[0]?.loi).toContain("căn cứ");
    expect(kiemTraTocDoToiDa([{ ...tocDoTep[0]!, trang_thai: "da_duyet" }])[0]?.loi).toContain("đã duyệt");
  });
});
