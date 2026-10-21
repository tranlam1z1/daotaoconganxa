/** Logic thi sát hạch (docs/PLAN.md GĐ6): ma trận, sinh đề có seed, đảo phương án, chấm, đồng hồ. */
import { describe, expect, test } from "bun:test";
import type { MucDoCauHoi, TraLoiCauHoi } from "../src/cau-hoi.ts";
import {
  type CauHoiNguon,
  chamLuot,
  chamPhanMay,
  conNhanTraLoi,
  DUNG_SAI_NOP_GIAY,
  duocXemDapAn,
  giayConLai,
  hanNop,
  khoaO,
  kiemTraBatDau,
  kiemTraMaTran,
  LoiSinhDe,
  type OMaTran,
  sinhDe,
  taoRng,
  tongHopDiem,
  tron,
} from "../src/de-thi.ts";

/** Ngân hàng giả: mỗi (chủ đề, mức độ) một số câu, xen các loại câu. */
function nganHang(so: Record<string, number>): CauHoiNguon[] {
  const ds: CauHoiNguon[] = [];
  for (const [k, n] of Object.entries(so)) {
    const [topic, level] = k.split("|") as [string, MucDoCauHoi];
    for (let i = 0; i < n; i++) {
      const id = `${topic}-${level}-${String(i).padStart(2, "0")}`;
      const loai = i % 3;
      if (loai === 0) {
        ds.push({
          id,
          version: 1,
          topic_id: topic,
          kind: "mot_dap_an",
          level,
          stem: `Câu ${id}`,
          options: { phuong_an: ["a", "b", "c", "d"].map((x) => ({ id: x, text: `Phương án ${x}` })) },
          answer: { dung: ["c"] },
          explanation: "Giải thích.",
          citations: [],
        });
      } else if (loai === 1) {
        ds.push({
          id,
          version: 1,
          topic_id: topic,
          kind: "sap_xep",
          level,
          stem: `Xếp ${id}`,
          options: { phuong_an: ["a", "b", "c", "d"].map((x) => ({ id: x, text: `Bước ${x}` })) },
          answer: { thu_tu: ["b", "d", "a", "c"] },
          explanation: "Giải thích.",
          citations: [],
        });
      } else {
        ds.push({
          id,
          version: 1,
          topic_id: topic,
          kind: "ghep_cap",
          level,
          stem: `Ghép ${id}`,
          options: {
            trai: ["t1", "t2", "t3"].map((x) => ({ id: x, text: `Vế ${x}` })),
            phai: ["p1", "p2", "p3"].map((x) => ({ id: x, text: `Mức ${x}` })),
          },
          answer: { cap: { t1: "p1", t2: "p2", t3: "p3" } },
          explanation: "Giải thích.",
          citations: [],
        });
      }
    }
  }
  return ds;
}

const MA_TRAN_35: OMaTran[] = [
  { topic_id: "toc-do", level: "de", so_cau: 10 },
  { topic_id: "toc-do", level: "kho", so_cau: 5 },
  { topic_id: "nong-do-con", level: "de", so_cau: 12 },
  { topic_id: "nong-do-con", level: "trung_binh", so_cau: 8 },
];
const NGUON = nganHang({
  "toc-do|de": 15,
  "toc-do|kho": 8,
  "nong-do-con|de": 20,
  "nong-do-con|trung_binh": 10,
});
const KHA_DUNG = new Map([
  [khoaO("toc-do", "de"), 15],
  [khoaO("toc-do", "kho"), 8],
  [khoaO("nong-do-con", "de"), 20],
  [khoaO("nong-do-con", "trung_binh"), 10],
]);

describe("ma trận đề", () => {
  test("đòi 10 câu khó mà ngân hàng chỉ có 6 thì báo đúng ô", () => {
    const maTran: OMaTran[] = [
      { topic_id: "toc-do", level: "kho", so_cau: 10 },
      { topic_id: "toc-do", level: "de", so_cau: 25 },
    ];
    const loi = kiemTraMaTran(
      maTran,
      new Map([
        [khoaO("toc-do", "kho"), 6],
        [khoaO("toc-do", "de"), 30],
      ]),
      {
        tenChuDe: new Map([["toc-do", "Tốc độ"]]),
      },
    );
    expect(loi).toEqual(["Chủ đề Tốc độ, mức Khó: cần 10 câu, ngân hàng mới có 6 câu đã duyệt."]);
  });

  test("tổng số câu phải trong khoảng 1–60 và khớp số câu của đề", () => {
    expect(kiemTraMaTran(MA_TRAN_35, KHA_DUNG)).toEqual([]);
    expect(kiemTraMaTran(MA_TRAN_35, KHA_DUNG, { soCau: 36 })[0]).toContain("khác số câu của đề");
    const it = [{ topic_id: "toc-do", level: "de" as const, so_cau: 12 }];
    expect(kiemTraMaTran(it, KHA_DUNG)).toEqual([]);
    const rong = [{ topic_id: "toc-do", level: "de" as const, so_cau: 0 }];
    expect(kiemTraMaTran(rong, KHA_DUNG)[0]).toContain("từ 1 đến 60 câu");
    const nhieu = [{ topic_id: "x", level: "de" as const, so_cau: 61 }];
    expect(kiemTraMaTran(nhieu, new Map([[khoaO("x", "de"), 100]]))[0]).toContain("từ 1 đến 60 câu");
  });

  test("ô tự luận đếm riêng với ô trắc nghiệm cùng chủ đề, mức độ", () => {
    const maTran: OMaTran[] = [
      { topic_id: "toc-do", level: "kho", so_cau: 5 },
      { topic_id: "toc-do", level: "kho", so_cau: 3, dang: "tu_luan", diem_moi_cau: 5 },
    ];
    const loi = kiemTraMaTran(maTran, new Map([...KHA_DUNG, [khoaO("toc-do", "kho", "tu_luan"), 1]]), {
      tenChuDe: new Map([["toc-do", "Tốc độ"]]),
    });
    expect(loi).toEqual(["Chủ đề Tốc độ, mức Khó, tự luận: cần 3 câu, ngân hàng mới có 1 câu đã duyệt."]);
  });

  test("điểm mỗi câu phải trong khoảng cho phép", () => {
    const maTran: OMaTran[] = [{ topic_id: "toc-do", level: "de", so_cau: 5, diem_moi_cau: 0 }];
    expect(kiemTraMaTran(maTran, KHA_DUNG)[0]).toContain("điểm mỗi câu");
  });

  test("ô khai hai lần bị báo", () => {
    const loi = kiemTraMaTran([...MA_TRAN_35, { topic_id: "toc-do", level: "de", so_cau: 0 }], KHA_DUNG);
    expect(loi.some((l) => l.includes("khai hai lần"))).toBe(true);
  });
});

describe("sinh đề", () => {
  test("đề 35 câu đúng số câu từng ô, không lặp câu", () => {
    const de = sinhDe({
      maTran: MA_TRAN_35,
      nguon: NGUON,
      seed: "luot-1",
      tronCau: true,
      tronPhuongAn: true,
    });
    expect(de).toHaveLength(35);
    expect(new Set(de.map((c) => c.question_id)).size).toBe(35);
    for (const o of MA_TRAN_35) {
      expect(de.filter((c) => c.topic_id === o.topic_id && c.level === o.level)).toHaveLength(o.so_cau);
    }
  });

  test("cùng seed cho cùng đề; hai seed khác nhau cho hai thứ tự khác nhau", () => {
    const tao = (seed: string) =>
      sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed, tronCau: true, tronPhuongAn: true }).map(
        (c) => c.question_id,
      );
    expect(tao("luot-a")).toEqual(tao("luot-a"));
    expect(tao("luot-a")).not.toEqual(tao("luot-b"));
    // Thứ tự CSDL trả về không ảnh hưởng kết quả.
    const dao = sinhDe({
      maTran: MA_TRAN_35,
      nguon: [...NGUON].reverse(),
      seed: "luot-a",
      tronCau: true,
      tronPhuongAn: true,
    }).map((c) => c.question_id);
    expect(dao).toEqual(tao("luot-a"));
  });

  test("tắt trộn câu thì câu xếp theo thứ tự ô của ma trận", () => {
    const de = sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed: "x", tronCau: false, tronPhuongAn: false });
    expect(de.slice(0, 10).every((c) => c.topic_id === "toc-do" && c.level === "de")).toBe(true);
    expect(de.slice(10, 15).every((c) => c.level === "kho")).toBe(true);
  });

  test("thiếu câu thì ném LoiSinhDe", () => {
    const it = nganHang({ "toc-do|kho": 3 });
    expect(() =>
      sinhDe({
        maTran: [{ topic_id: "toc-do", level: "kho", so_cau: 5 }],
        nguon: it,
        seed: "x",
        tronCau: true,
        tronPhuongAn: true,
      }),
    ).toThrow(LoiSinhDe);
  });

  test("phần gửi người thi không có đáp án", () => {
    const de = sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed: "y", tronCau: true, tronPhuongAn: true });
    for (const c of de) expect(JSON.stringify(c.de)).not.toMatch(/"answer"|"dung"|"thu_tu"|"cap"/);
  });

  test("đảo phương án: thứ tự hiển thị khác nhau giữa các lượt, id giữ nguyên", () => {
    const thuTu = new Set<string>();
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
      const de = sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed, tronCau: false, tronPhuongAn: true });
      // Mọi câu một đáp án trong ngân hàng giả đều soạn theo thứ tự a, b, c, d.
      const cau = de.find((c) => c.de.kind === "mot_dap_an")!;
      expect(cau.de.options.phuong_an?.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d"]);
      thuTu.add(cau.de.options.phuong_an!.map((p) => p.id).join(""));
    }
    expect(thuTu.size).toBeGreaterThan(1);
  });
});

describe("chấm", () => {
  test("chấm sau khi đảo phương án vẫn đúng, với mọi loại câu", () => {
    const de = sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed: "cham", tronCau: true, tronPhuongAn: true });
    // Trả lời đúng mọi câu bằng id đáp án, bất kể phương án đang hiển thị theo thứ tự nào.
    const traLoi = new Map<number, TraLoiCauHoi>();
    de.forEach((c, i) => {
      const a = c.noi_dung.answer;
      traLoi.set(i + 1, a.dung ? { chon: a.dung } : a.thu_tu ? { thu_tu: a.thu_tu } : { cap: a.cap ?? {} });
    });
    const kq = chamLuot(de, traLoi, 70);
    expect(kq).toMatchObject({ dung: 35, tong: 35, diem: 100, dat: true });
  });

  test("chọn theo VỊ TRÍ hiển thị (không theo id) thì chấm theo đúng phương án được chọn", () => {
    const de = sinhDe({
      maTran: MA_TRAN_35,
      nguon: NGUON,
      seed: "vi-tri",
      tronCau: false,
      tronPhuongAn: true,
    });
    const cau = de.findIndex((c) => c.de.kind === "mot_dap_an" && c.de.options.phuong_an![0]!.id !== "c");
    // Người thi bấm phương án đầu tiên đang hiển thị, không phải đáp án c.
    const chon = de[cau]!.de.options.phuong_an![0]!.id;
    const kq = chamLuot(de, new Map([[cau + 1, { chon: [chon] }]]), 70);
    expect(kq.chiTiet[cau]!.dung).toBe(false);
  });

  test("câu bỏ trống tính sai; điểm thang 100 làm tròn 2 chữ số; đạt theo ngưỡng", () => {
    const de = sinhDe({ maTran: MA_TRAN_35, nguon: NGUON, seed: "z", tronCau: false, tronPhuongAn: false });
    const traLoi = new Map<number, TraLoiCauHoi>();
    // Làm đúng 24 câu đầu, bỏ trống phần còn lại: 24/35 = 68,57 điểm.
    de.slice(0, 24).forEach((c, i) => {
      const a = c.noi_dung.answer;
      traLoi.set(i + 1, a.dung ? { chon: a.dung } : a.thu_tu ? { thu_tu: a.thu_tu } : { cap: a.cap ?? {} });
    });
    const kq = chamLuot(de, traLoi, 70);
    expect(kq.dung).toBe(24);
    expect(kq.diem).toBe(68.57);
    expect(kq.dat).toBe(false);
    expect(kq.chiTiet[30]).toEqual({
      thu_tu: 31,
      dung: false,
      diem: 0,
      diem_toi_da: 1,
      ket_qua: null,
      cho_cham: false,
    });
    expect(chamLuot(de, traLoi, 60).dat).toBe(true);
  });
});

describe("đề kết hợp trắc nghiệm + tự luận", () => {
  const RUBRIC = {
    tieu_chi: [
      {
        ma: "can_cu",
        ten: "Căn cứ",
        trong_so: 1,
        muc: [
          { diem: 0, mo_ta: "" },
          { diem: 4, mo_ta: "" },
        ],
      },
    ],
    nguong_dat: 50,
  };
  const tuLuan = (i: number): CauHoiNguon => ({
    id: `tl-${i}`,
    version: 1,
    topic_id: "toc-do",
    kind: "tu_luan",
    level: "kho",
    stem: `Tình huống ${i}`,
    options: {},
    answer: {},
    explanation: "Đáp án gợi ý",
    citations: ["vn:x"],
    rubric: RUBRIC,
  });
  const NGUON_KET_HOP = [...NGUON, tuLuan(1), tuLuan(2), tuLuan(3)];
  const MA_TRAN: OMaTran[] = [
    { topic_id: "toc-do", level: "de", so_cau: 10, diem_moi_cau: 0.5 },
    { topic_id: "toc-do", level: "kho", so_cau: 2, dang: "tu_luan", diem_moi_cau: 5 },
  ];

  test("ô tự luận chỉ rút câu tự luận, ô trắc nghiệm không bao giờ rút câu tự luận", () => {
    const de = sinhDe({
      maTran: MA_TRAN,
      nguon: NGUON_KET_HOP,
      seed: "kh",
      tronCau: true,
      tronPhuongAn: true,
    });
    expect(de).toHaveLength(12);
    const tl = de.filter((c) => c.noi_dung.kind === "tu_luan");
    expect(tl).toHaveLength(2);
    expect(tl.every((c) => c.diem === 5)).toBe(true);
    expect(de.filter((c) => c.noi_dung.kind !== "tu_luan").every((c) => c.diem === 0.5)).toBe(true);
    // Rubric chụp vào đề để chấm; phần gửi người thi không có rubric hay đáp án gợi ý.
    expect(tl[0]!.noi_dung.rubric).toEqual(RUBRIC);
    expect(JSON.stringify(tl.map((c) => c.de))).not.toContain("Đáp án gợi ý");
  });

  test("ma trận cũ (không có dạng câu) rút y như trước khi có tự luận", () => {
    const cu = sinhDe({
      maTran: MA_TRAN_35,
      nguon: NGUON,
      seed: "on-dinh",
      tronCau: true,
      tronPhuongAn: true,
    });
    const moi = sinhDe({
      maTran: MA_TRAN_35,
      nguon: NGUON_KET_HOP,
      seed: "on-dinh",
      tronCau: true,
      tronPhuongAn: true,
    });
    expect(moi.map((c) => c.question_id)).toEqual(cu.map((c) => c.question_id));
  });

  test("tự luận có bài làm chờ chấm; điểm cuối tính theo điểm từng câu", () => {
    const de = sinhDe({
      maTran: MA_TRAN,
      nguon: NGUON_KET_HOP,
      seed: "diem",
      tronCau: false,
      tronPhuongAn: false,
    });
    const traLoi = new Map<number, TraLoiCauHoi>();
    de.forEach((c, i) => {
      const a = c.noi_dung.answer;
      if (c.noi_dung.kind === "tu_luan") traLoi.set(i + 1, { bai_viet: "Bài làm có căn cứ." });
      else
        traLoi.set(i + 1, a.dung ? { chon: a.dung } : a.thu_tu ? { thu_tu: a.thu_tu } : { cap: a.cap ?? {} });
    });
    const may = chamPhanMay(de, traLoi);
    expect(may.filter((c) => c.cho_cham)).toHaveLength(2);
    expect(may.filter((c) => !c.cho_cham).every((c) => c.dung && c.diem === 0.5)).toBe(true);

    // Trắc nghiệm đúng hết (5 điểm), tự luận 3/5 và 0/5: 8 / 15 = 53,33.
    const tl = may.filter((c) => c.cho_cham);
    const sauCham = may.map((c) =>
      c === tl[0] ? { ...c, diem: 3, dung: true } : c === tl[1] ? { ...c, diem: 0 } : c,
    );
    expect(tongHopDiem(sauCham, 50)).toEqual({ dung: 11, tong: 12, diem: 53.33, dat: true });
  });

  test("bài viết toàn khoảng trắng là bỏ trống, được 0 và không chờ chấm", () => {
    const de = sinhDe({
      maTran: MA_TRAN,
      nguon: NGUON_KET_HOP,
      seed: "trong",
      tronCau: false,
      tronPhuongAn: false,
    });
    const i = de.findIndex((c) => c.noi_dung.kind === "tu_luan");
    const kq = chamPhanMay(de, new Map([[i + 1, { bai_viet: "   " }]]));
    expect(kq[i]).toMatchObject({ cho_cham: false, diem: 0, diem_toi_da: 5 });
  });
});

describe("đồng hồ và điều kiện bắt đầu", () => {
  const batDau = new Date("2026-09-25T08:00:00Z");

  test("hạn nộp = bắt đầu + thời lượng, không quá hạn bài giao", () => {
    expect(hanNop(batDau, 45, new Date("2026-09-30T00:00:00Z"))).toEqual(new Date("2026-09-25T08:45:00Z"));
    expect(hanNop(batDau, 45, new Date("2026-09-25T08:20:00Z"))).toEqual(new Date("2026-09-25T08:20:00Z"));
  });

  test(`nhận câu trả lời tới hạn + ${DUNG_SAI_NOP_GIAY} giây, sau đó từ chối`, () => {
    const han = new Date("2026-09-25T08:45:00Z");
    const sau = (giay: number) => new Date(han.getTime() + giay * 1000);
    expect(conNhanTraLoi(han, sau(0))).toBe(true);
    expect(conNhanTraLoi(han, sau(DUNG_SAI_NOP_GIAY))).toBe(true);
    expect(conNhanTraLoi(han, sau(DUNG_SAI_NOP_GIAY + 1))).toBe(false);
    expect(giayConLai(han, sau(-90))).toBe(90);
    expect(giayConLai(han, sau(10))).toBe(0);
  });

  test("điều kiện bắt đầu lượt mới", () => {
    const co = {
      trangThaiDe: "xuat_ban",
      daHuy: false,
      moLuc: new Date("2026-09-25T00:00:00Z"),
      han: new Date("2026-09-26T00:00:00Z"),
      soLuotDaNop: 0,
      soLuotToiDa: 1,
      now: batDau,
    };
    expect(kiemTraBatDau(co)).toBeNull();
    expect(kiemTraBatDau({ ...co, soLuotDaNop: 1 })).toBe("het_luot");
    expect(kiemTraBatDau({ ...co, now: new Date("2026-09-24T23:00:00Z") })).toBe("chua_mo");
    expect(kiemTraBatDau({ ...co, now: new Date("2026-09-26T00:00:00Z") })).toBe("het_han");
    expect(kiemTraBatDau({ ...co, trangThaiDe: "dong" })).toBe("de_da_dong");
    expect(kiemTraBatDau({ ...co, daHuy: true })).toBe("bai_giao_da_huy");
  });

  test("xem đáp án theo cấu hình đề", () => {
    const han = new Date("2026-09-26T00:00:00Z");
    expect(duocXemDapAn("sau_nop", han, batDau)).toBe(true);
    expect(duocXemDapAn("khong", han, batDau)).toBe(false);
    expect(duocXemDapAn("sau_han", han, batDau)).toBe(false);
    expect(duocXemDapAn("sau_han", han, new Date("2026-09-26T00:00:01Z"))).toBe(true);
  });

  test("trộn có seed không làm mất phần tử", () => {
    const ds = Array.from({ length: 50 }, (_, i) => i);
    expect(tron(ds, taoRng("q")).sort((a, b) => a - b)).toEqual(ds);
  });
});
