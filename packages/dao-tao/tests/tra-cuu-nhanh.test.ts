/** Tra cứu nhanh: khớp khoảng tốc độ và kiểm tra hợp lệ dữ liệu (docs/PLAN.md GĐ5). */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  apDungTai,
  type DongMucPhat,
  type KhoangTocDo,
  khoangChongNhau,
  kiemTraMucPhat,
  kiemTraQuyTrinh,
  moTaKhoang,
  type QuyTrinh,
  timTheoTocDo,
  tocDoVuot,
  trongKhoang,
} from "../src/index.ts";

const DATA = join(import.meta.dir, "..", "..", "..", "data", "tra-cuu");

function dong(p: Partial<DongMucPhat>): DongMucPhat {
  return {
    ma: "x",
    xe: "mo_to",
    hanh_vi: "Hành vi mẫu",
    phat_tu: 100_000,
    phat_den: 200_000,
    can_cu: "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3.khoan-2",
    hieu_luc_tu: "2025-01-01",
    trang_thai: "da_duyet",
    ...p,
  };
}

// Ba bậc tốc độ của xe mô tô, viết đúng như văn bản: "từ 05 đến dưới 10", "từ 10 đến 20", "trên 20".
const XE_MAY: DongMucPhat[] = [
  dong({ ma: "5-10", toc_do_vuot: { tu: 5, den: 10, bien: "[)" } }),
  dong({ ma: "10-20", toc_do_vuot: { tu: 10, den: 20, bien: "[]" } }),
  dong({ ma: "tren-20", toc_do_vuot: { tu: 20, den: null, bien: "()" } }),
];

const maKhop = (vuot: number) => timTheoTocDo(XE_MAY, vuot).map((d) => d.ma);

describe("khoảng tốc độ", () => {
  test("xe máy vượt 5 đến dưới 10, 10 đến 20, trên 20 rơi đúng khoảng", () => {
    expect(maKhop(5)).toEqual(["5-10"]);
    expect(maKhop(7)).toEqual(["5-10"]);
    expect(maKhop(9.9)).toEqual(["5-10"]);
    expect(maKhop(15)).toEqual(["10-20"]);
    expect(maKhop(20)).toEqual(["10-20"]);
    expect(maKhop(20.1)).toEqual(["tren-20"]);
    expect(maKhop(60)).toEqual(["tren-20"]);
  });

  test("biên đúng 10 km/h thuộc đúng một khoảng", () => {
    expect(maKhop(10)).toEqual(["10-20"]);
  });

  test("dưới 5 km/h không có mức phạt theo tốc độ", () => {
    expect(maKhop(4.9)).toEqual([]);
    expect(maKhop(0)).toEqual([]);
  });

  test("trongKhoang tôn trọng từng loại cận", () => {
    const k = (bien: KhoangTocDo["bien"]): KhoangTocDo => ({ tu: 10, den: 20, bien });
    expect([trongKhoang(k("[)"), 10), trongKhoang(k("[)"), 20)]).toEqual([true, false]);
    expect([trongKhoang(k("(]"), 10), trongKhoang(k("(]"), 20)]).toEqual([false, true]);
    expect([trongKhoang(k("()"), 10), trongKhoang(k("()"), 20)]).toEqual([false, false]);
    expect([trongKhoang(k("[]"), 10), trongKhoang(k("[]"), 20)]).toEqual([true, true]);
  });

  test("khoangChongNhau: chạm nhau tại một điểm chỉ chồng khi cả hai cùng gồm điểm đó", () => {
    const a: KhoangTocDo = { tu: 10, den: 20, bien: "[]" };
    expect(khoangChongNhau(a, { tu: 20, den: null, bien: "()" })).toBe(false);
    expect(khoangChongNhau(a, { tu: 20, den: 35, bien: "[]" })).toBe(true);
    expect(khoangChongNhau(a, { tu: 15, den: 30, bien: "[)" })).toBe(true);
    expect(khoangChongNhau({ tu: 5, den: 10, bien: "[)" }, a)).toBe(false);
    expect(khoangChongNhau({ tu: 0, den: null, bien: "[)" }, a)).toBe(true);
  });

  test("tocDoVuot không âm và không lệch do số thực", () => {
    expect(tocDoVuot(50, 60.1)).toBe(10.1);
    expect(tocDoVuot(60, 55)).toBe(0);
  });

  test("moTaKhoang đọc thành chữ như văn bản", () => {
    expect(moTaKhoang({ tu: 5, den: 10, bien: "[)" })).toBe("từ 5 km/h đến dưới 10 km/h");
    expect(moTaKhoang({ tu: 10, den: 20, bien: "[]" })).toBe("từ 10 km/h đến 20 km/h");
    expect(moTaKhoang({ tu: 20, den: null, bien: "()" })).toBe("trên 20 km/h");
  });
});

describe("hiệu lực", () => {
  test("hieu_luc_den là ngày đầu tiên hết áp dụng", () => {
    const d = { hieu_luc_tu: "2025-01-01", hieu_luc_den: "2026-07-01" };
    expect(apDungTai(d, "2024-12-31")).toBe(false);
    expect(apDungTai(d, "2025-01-01")).toBe(true);
    expect(apDungTai(d, "2026-06-30")).toBe(true);
    expect(apDungTai(d, "2026-07-01")).toBe(false);
    expect(apDungTai({ hieu_luc_tu: "2025-01-01" }, "2099-01-01")).toBe(true);
  });
});

describe("kiemTraMucPhat", () => {
  test("dữ liệu đúng không có lỗi", () => {
    expect(kiemTraMucPhat(XE_MAY)).toEqual([]);
  });

  test("bắt khoảng tốc độ chồng nhau cùng loại xe, cùng thời gian", () => {
    const loi = kiemTraMucPhat([
      ...XE_MAY,
      dong({ ma: "chong", toc_do_vuot: { tu: 15, den: 25, bien: "[)" } }),
    ]);
    expect(loi.some((l) => l.loi.includes("chồng lên"))).toBe(true);
  });

  test("khoảng giống nhau nhưng khác loại xe hoặc khác thời gian hiệu lực thì không chồng", () => {
    const k: KhoangTocDo = { tu: 5, den: 10, bien: "[)" };
    expect(
      kiemTraMucPhat([dong({ ma: "a", toc_do_vuot: k }), dong({ ma: "b", xe: "o_to", toc_do_vuot: k })]),
    ).toEqual([]);
    const cu = dong({ ma: "cu", toc_do_vuot: k, hieu_luc_den: "2026-07-01" });
    const moi = dong({ ma: "moi", toc_do_vuot: k, hieu_luc_tu: "2026-07-01" });
    expect(kiemTraMucPhat([cu, moi])).toEqual([]);
  });

  test("chủ đề phải nằm trong danh sách chủ đề tra cứu", () => {
    expect(kiemTraMucPhat([dong({ ma: "a", nhom: "Tốc độ" })])).toEqual([]);
    expect(kiemTraMucPhat([dong({ ma: "a", nhom: "Mũ bảo hiểm" })])).toEqual([
      { ma: "a", loi: "Chủ đề không có trong danh sách: Mũ bảo hiểm" },
    ]);
  });

  test("bắt lỗi từng dòng", () => {
    const loi = kiemTraMucPhat([
      dong({ ma: "a", phat_tu: 500, phat_den: 100 }),
      dong({ ma: "a" }),
      dong({ ma: "b", can_cu: "vn:vbqppl:nd:100/2026/NĐ-CP" }),
      dong({ ma: "c", tru_diem: 13 }),
      dong({ ma: "d", hieu_luc_tu: "2026-01-01", hieu_luc_den: "2025-01-01" }),
      dong({ ma: "e", xe: "tau_bay" as never }),
    ]);
    const theoMa = (ma: string) => loi.filter((l) => l.ma === ma).map((l) => l.loi);
    expect(theoMa("a")).toContain("Mức phạt tối thiểu lớn hơn mức tối đa");
    expect(theoMa("a")).toContain("Trùng mã với dòng khác");
    expect(theoMa("b")[0]).toStartWith("Căn cứ phải là URN tới điều");
    expect(theoMa("c")).toContain("Số điểm trừ phải là số nguyên từ 1 đến 12");
    expect(theoMa("d")).toContain("Ngày hết hiệu lực phải sau ngày bắt đầu");
    expect(theoMa("e")[0]).toStartWith("Loại xe không hợp lệ");
  });
});

describe("kiemTraQuyTrinh", () => {
  const qt = (p: Partial<QuyTrinh>): QuyTrinh => ({
    ma: "q",
    loai: "vi_pham",
    tieu_de: "Quy trình mẫu",
    cac_buoc: [{ tieu_de: "Bước 1", mo_ta: "", can_cu: "vn:vbqppl:l:15/2012/QH13#dieu-56" }],
    trang_thai: "nhap",
    ...p,
  });

  test("hợp lệ và các lỗi thường gặp", () => {
    expect(kiemTraQuyTrinh([qt({})])).toEqual([]);
    expect(kiemTraQuyTrinh([qt({ cac_buoc: [] })])[0]?.loi).toBe("Quy trình chưa có bước nào");
    expect(kiemTraQuyTrinh([qt({ cac_buoc: [{ tieu_de: "", mo_ta: "" }] })])[0]?.loi).toBe(
      "Bước 1 thiếu tiêu đề",
    );
  });
});

describe("tệp dữ liệu thật data/tra-cuu", () => {
  test("muc-phat.json hợp lệ, không có khoảng tốc độ chồng nhau", async () => {
    const { dong: ds } = (await Bun.file(join(DATA, "muc-phat.json")).json()) as { dong: DongMucPhat[] };
    expect(ds.length).toBeGreaterThan(0);
    expect(kiemTraMucPhat(ds)).toEqual([]);
  });

  test("mỗi tốc độ vượt từ 5 km/h trở lên ra đúng một mức phạt cho mỗi loại xe", async () => {
    const { dong: ds } = (await Bun.file(join(DATA, "muc-phat.json")).json()) as { dong: DongMucPhat[] };
    for (const xe of ["o_to", "mo_to"] as const) {
      const cua = ds.filter((d) => d.xe === xe && d.trang_thai !== "ngung" && apDungTai(d, "2025-06-01"));
      if (!cua.some((d) => d.toc_do_vuot)) continue;
      for (let v = 5; v <= 80; v += 0.5) expect(timTheoTocDo(cua, v).length).toBe(1);
    }
  });

  test("quy-trinh.json hợp lệ", async () => {
    const { quy_trinh } = (await Bun.file(join(DATA, "quy-trinh.json")).json()) as { quy_trinh: QuyTrinh[] };
    expect(kiemTraQuyTrinh(quy_trinh)).toEqual([]);
  });
});
