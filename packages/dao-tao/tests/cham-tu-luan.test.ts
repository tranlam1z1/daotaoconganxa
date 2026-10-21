/**
 * Chấm tự luận bằng AI (ke-hoach/09-a §4.3): điểm cuối cùng tính tất định từ điểm thô của mô hình,
 * và mô hình không được cho điểm phần người học không viết.
 */
import { describe, expect, test } from "bun:test";
import { coTrongBaiLam, docKetQuaChamAi, ketQuaChamTuLuan, type Rubric } from "../src/index.ts";

const rubric: Rubric = {
  tieu_chi: [
    {
      ma: "can_cu",
      ten: "Căn cứ",
      trong_so: 50,
      muc: [
        { diem: 0, mo_ta: "Sai hoặc hết hiệu lực" },
        { diem: 50, mo_ta: "Đúng" },
      ],
    },
    { ma: "lap_luan", ten: "Lập luận", trong_so: 30, muc: [{ diem: 30, mo_ta: "Tốt" }] },
    { ma: "trinh_bay", ten: "Trình bày", trong_so: 20, muc: [{ diem: 20, mo_ta: "Rõ" }] },
  ],
  nguong_dat: 60,
};

const BAI = "Theo Điều 2 Nghị định 100/2026/NĐ-CP, người điều khiển xe phải mang theo giấy phép lái xe.";

describe("bằng chứng", () => {
  test("khớp bỏ qua khoảng trắng, ngoặc kép, chữ hoa", () => {
    expect(coTrongBaiLam('"theo  ĐIỀU 2 nghị định"', BAI)).toBe(true);
  });

  test("đoạn không có trong bài, hoặc quá ngắn, không phải bằng chứng", () => {
    expect(coTrongBaiLam("theo Điều 5 Luật Giao thông", BAI)).toBe(false);
    expect(coTrongBaiLam("xe", BAI)).toBe(false);
  });
});

describe("đọc và hậu kiểm kết quả chấm", () => {
  test("điểm kẹp trong thang của tiêu chí; tiêu chí lạ bị bỏ; tiêu chí thiếu tính 0", () => {
    const doc = docKetQuaChamAi(
      {
        tieu_chi: [
          { ma: "can_cu", diem: 99, bang_chung: "Theo Điều 2 Nghị định 100/2026/NĐ-CP" },
          { ma: "lap_luan", diem: -5, bang_chung: "mang theo giấy phép" },
          { ma: "bia", diem: 100, bang_chung: "x" },
        ],
        tom_tat: "Ổn.",
      },
      rubric,
      BAI,
    );
    expect(doc.dungDuoc).toBe(true);
    expect(doc.diem).toEqual({ can_cu: 50, lap_luan: 0, trinh_bay: 0 });
    expect(doc.tieuChi.find((t) => t.ma === "trinh_bay")!.nhan_xet).toContain("Chưa chấm");
  });

  test("điểm không kèm bằng chứng có thật trong bài thì về 0", () => {
    const doc = docKetQuaChamAi(
      { tieu_chi: [{ ma: "can_cu", diem: 50, bang_chung: "Điều 9 Luật Trật tự an toàn giao thông" }] },
      rubric,
      BAI,
    );
    expect(doc.diem.can_cu).toBe(0);
    expect(doc.tieuChi[0]!.nhan_xet).toContain("Không tìm thấy");
  });

  test("không tiêu chí nào khớp rubric thì không dùng được", () => {
    expect(docKetQuaChamAi("[MOCK]", rubric, BAI).dungDuoc).toBe(false);
    expect(docKetQuaChamAi({ tieu_chi: [{ ma: "khac", diem: 1 }] }, rubric, BAI).dungDuoc).toBe(false);
  });
});

describe("điểm cuối cùng", () => {
  const hd = { points: 10, citations: ["vn:x#dieu-2"] };

  test("quy về thang điểm của bài theo trọng số; đạt khi chạm ngưỡng", () => {
    const du = ketQuaChamTuLuan(hd, rubric, {
      diem: { can_cu: 50, lap_luan: 30, trinh_bay: 0 },
      tieuChi: [],
      tomTat: "",
      dungDuoc: true,
    });
    expect(du.score).toBe(8);
    expect(du.passed).toBe(true);
    expect(du.gradedBy).toBe("ai");
    expect(du.canChamTiep).toBe(false);
    expect(du.feedback.can_cu).toEqual(["vn:x#dieu-2"]);

    const thieuCanCu = ketQuaChamTuLuan(hd, rubric, {
      diem: { can_cu: 0, lap_luan: 30, trinh_bay: 20 },
      tieuChi: [],
      tomTat: "",
      dungDuoc: true,
    });
    expect(thieuCanCu.score).toBe(5);
    expect(thieuCanCu.passed).toBe(false);
  });
});
