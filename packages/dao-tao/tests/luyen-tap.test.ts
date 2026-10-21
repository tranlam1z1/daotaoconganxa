/**
 * Luyện tập (docs/PLAN.md GĐ4): rút câu tái lập được, trộn mức độ, ưu tiên câu chưa làm hoặc
 * hay sai, đảo phương án mà chấm vẫn đúng, và quy tắc rời danh sách câu sai.
 */
import { describe, expect, test } from "bun:test";
import {
  type CauHoiNguon,
  capNhatCauSai,
  chamCauHoi,
  chiaMucDo,
  hangUuTien,
  type MucDoCauHoi,
  rutCauLuyenTap,
  type TraLoiCauHoi,
} from "../src/index.ts";

const PA = [
  { id: "a", text: "Phương án A" },
  { id: "b", text: "Phương án B" },
  { id: "c", text: "Phương án C" },
  { id: "d", text: "Phương án D" },
];

function cau(i: number, level: MucDoCauHoi): CauHoiNguon {
  return {
    id: `q-${String(i).padStart(3, "0")}`,
    version: 1,
    topic_id: "t",
    kind: "mot_dap_an",
    level,
    stem: `Câu ${i}?`,
    options: { phuong_an: PA },
    answer: { dung: ["c"] },
    explanation: "Vì vậy.",
    citations: [],
  };
}

/** 8 dễ, 8 trung bình, 5 khó. */
const KHO: CauHoiNguon[] = [
  ...Array.from({ length: 8 }, (_, i) => cau(i, "de")),
  ...Array.from({ length: 8 }, (_, i) => cau(100 + i, "trung_binh")),
  ...Array.from({ length: 5 }, (_, i) => cau(200 + i, "kho")),
];

const dem = (ds: Array<{ level: MucDoCauHoi }>) => ({
  de: ds.filter((c) => c.level === "de").length,
  trung_binh: ds.filter((c) => c.level === "trung_binh").length,
  kho: ds.filter((c) => c.level === "kho").length,
});

describe("rút câu", () => {
  test("cùng seed thì ra cùng đề, kể cả thứ tự phương án", () => {
    const a = rutCauLuyenTap({ nguon: KHO, seed: "phien-1" });
    const b = rutCauLuyenTap({ nguon: [...KHO].reverse(), seed: "phien-1" });
    expect(b).toEqual(a);
  });

  test("khác seed thì khác đề", () => {
    const a = rutCauLuyenTap({ nguon: KHO, seed: "phien-1" }).map((c) => c.question_id);
    const b = rutCauLuyenTap({ nguon: KHO, seed: "phien-2" }).map((c) => c.question_id);
    expect(b).not.toEqual(a);
  });

  test("10 câu theo tỷ lệ 4 dễ, 4 trung bình, 2 khó; không lặp câu", () => {
    const de = rutCauLuyenTap({ nguon: KHO, seed: "x" });
    expect(de).toHaveLength(10);
    expect(dem(de)).toEqual({ de: 4, trung_binh: 4, kho: 2 });
    expect(new Set(de.map((c) => c.question_id)).size).toBe(10);
  });

  test("thiếu câu khó thì bù bằng mức lân cận", () => {
    expect(chiaMucDo(10, { de: 8, trung_binh: 8, kho: 0 })).toEqual({ de: 4, trung_binh: 6, kho: 0 });
    expect(chiaMucDo(10, { de: 1, trung_binh: 2, kho: 20 })).toEqual({ de: 1, trung_binh: 2, kho: 7 });
  });

  test("ngân hàng ít hơn 10 câu thì rút hết", () => {
    expect(rutCauLuyenTap({ nguon: KHO.slice(0, 3), seed: "x" })).toHaveLength(3);
    expect(rutCauLuyenTap({ nguon: [], seed: "x" })).toEqual([]);
  });

  test("ưu tiên câu chưa làm, rồi câu hay sai", () => {
    expect(hangUuTien(undefined)).toBe(0);
    expect(hangUuTien({ so_lan: 2, so_sai: 1 })).toBe(1);
    expect(hangUuTien({ so_lan: 3, so_sai: 0 })).toBe(2);

    // Mọi câu dễ đều đã làm đúng, trừ q-005 (hay sai) và q-006 (chưa làm): hai câu này phải có mặt.
    const lichSu = new Map(KHO.filter((c) => c.level === "de").map((c) => [c.id, { so_lan: 3, so_sai: 0 }]));
    lichSu.set("q-005", { so_lan: 2, so_sai: 2 });
    lichSu.delete("q-006");
    for (const seed of ["s1", "s2", "s3"]) {
      const ids = rutCauLuyenTap({ nguon: KHO, seed, lichSu }).map((c) => c.question_id);
      expect(ids).toContain("q-005");
      expect(ids).toContain("q-006");
    }
  });

  test("ảnh chụp giữ id và version, phần đề không có đáp án", () => {
    const [c] = rutCauLuyenTap({ nguon: KHO, seed: "x", soCau: 1 });
    expect(c?.version).toBe(1);
    expect(JSON.stringify(c?.de)).not.toContain("answer");
    expect(c?.de.options.phuong_an?.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("đảo phương án rồi chấm", () => {
  const LOAI: CauHoiNguon[] = [
    { ...cau(1, "de"), kind: "nhieu_dap_an", answer: { dung: ["a", "c"] } },
    { ...cau(2, "de"), kind: "sap_xep", answer: { thu_tu: ["d", "b", "a", "c"] } },
    {
      ...cau(3, "de"),
      kind: "ghep_cap",
      options: {
        trai: [
          { id: "t1", text: "X" },
          { id: "t2", text: "Y" },
        ],
        phai: [
          { id: "p1", text: "1" },
          { id: "p2", text: "2" },
        ],
      },
      answer: { cap: { t1: "p1", t2: "p2" } },
    },
    { ...cau(4, "de"), kind: "dung_sai", options: {}, answer: { dung: ["sai"] } },
    {
      ...cau(5, "de"),
      kind: "dien_khuyet",
      stem: "Số ___",
      options: {},
      answer: { o_trong: { "1": ["36"] } },
    },
    cau(6, "de"),
  ];
  const DUNG: Record<string, TraLoiCauHoi> = {
    "q-001": { chon: ["c", "a"] },
    "q-002": { thu_tu: ["d", "b", "a", "c"] },
    "q-003": { cap: { t1: "p1", t2: "p2" } },
    "q-004": { chon: ["sai"] },
    "q-005": { o_trong: { "1": "36" } },
    "q-006": { chon: ["c"] },
  };

  test("với mọi loại câu và nhiều seed, trả lời theo id vẫn được chấm đúng", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const phien = rutCauLuyenTap({ nguon: LOAI, seed });
      expect(phien).toHaveLength(6);
      for (const c of phien) {
        expect(chamCauHoi(c.noi_dung, DUNG[c.question_id]!).dung).toBe(true);
      }
    }
  });

  test("thứ tự hiển thị thực sự thay đổi theo seed", () => {
    const thuTu = new Set(
      ["a", "b", "c", "d", "e", "f"].map((seed) =>
        rutCauLuyenTap({ nguon: [cau(6, "de")], seed })[0]!
          .de.options.phuong_an!.map((p) => p.id)
          .join(""),
      ),
    );
    expect(thuTu.size).toBeGreaterThan(1);
  });
});

describe("câu sai của tôi", () => {
  test("trả lời sai thì vào danh sách", () => {
    expect(capNhatCauSai(null, false)).toEqual({ wrong_count: 1, correct_streak: 0, trong_danh_sach: true });
  });

  test("đúng 2 lần liên tiếp thì rời danh sách", () => {
    let s = capNhatCauSai(null, false);
    s = capNhatCauSai(s, true);
    expect(s?.trong_danh_sach).toBe(true);
    s = capNhatCauSai(s, true);
    expect(s).toEqual({ wrong_count: 1, correct_streak: 2, trong_danh_sach: false });
  });

  test("đúng rồi sai thì đếm lại từ đầu", () => {
    let s = capNhatCauSai(null, false);
    s = capNhatCauSai(s, true);
    s = capNhatCauSai(s, false);
    expect(s).toEqual({ wrong_count: 2, correct_streak: 0, trong_danh_sach: true });
    s = capNhatCauSai(s, true);
    expect(s?.trong_danh_sach).toBe(true);
  });

  test("câu không có trong danh sách mà trả lời đúng thì không ghi gì", () => {
    expect(capNhatCauSai(null, true)).toBeNull();
    expect(capNhatCauSai({ wrong_count: 1, correct_streak: 2, trong_danh_sach: false }, true)).toBeNull();
  });
});
