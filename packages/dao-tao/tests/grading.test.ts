/** Chấm bài: phần tất định phải đúng tuyệt đối, vì đây là điểm số của người học. */
import { describe, expect, test } from "bun:test";
import {
  chamBaiTap,
  chuanHoa,
  diemThuTu,
  type HoatDong,
  kiemTraRubric,
  type Rubric,
  tinhDiemRubric,
} from "../src/index.ts";

function hoatDong(p: Partial<HoatDong>): HoatDong {
  return {
    id: "a1",
    lessonId: "l1",
    courseId: "c1",
    ordinal: 1,
    kind: "trac_nghiem",
    mode: "may",
    prompt: { cau_hoi: "?" },
    answer: {},
    rubric: {},
    skills: [],
    errorTags: [],
    citations: [],
    difficulty: 0.5,
    points: 1,
    level: 1,
    status: "xuat_ban",
    retired: false,
    ...p,
  } as HoatDong;
}

describe("chuanHoa", () => {
  test("bỏ dấu, hạ chữ thường, gộp khoảng trắng", () => {
    expect(chuanHoa("  Nghị  Định 224/2026/NĐ-CP ")).toBe("nghi dinh 224/2026/nd-cp");
  });
});

describe("trắc nghiệm", () => {
  const hd = hoatDong({
    answer: {
      dung: ["a", "c"],
      phuong_an: [
        { id: "a", text: "A", dung: true },
        { id: "b", text: "B", ma_loi: "nham_chuyen_tiep", giai_thich: "Đây là chuyện chuyển tiếp." },
        { id: "c", text: "C", dung: true },
      ],
    },
    points: 2,
  });

  test("chọn đủ và đúng thì trọn điểm", () => {
    const kq = chamBaiTap(hd, { chon: ["a", "c"] });
    expect(kq.score).toBe(2);
    expect(kq.passed).toBe(true);
  });

  test("chọn thừa bị trừ điểm theo Jaccard", () => {
    const kq = chamBaiTap(hd, { chon: ["a", "b", "c"] });
    // 2 đúng / 3 đã hợp = 2/3; điểm làm tròn tới hai chữ số thập phân khi lưu.
    expect(kq.score).toBe(1.33);
    expect(kq.passed).toBe(false);
  });

  test("chọn phương án sai thì thu được mã lỗi khái niệm và lời giải thích", () => {
    const kq = chamBaiTap(hd, { chon: ["b"] });
    expect(kq.errorTags).toEqual(["nham_chuyen_tiep"]);
    expect(kq.feedback.tom_tat).toContain("chuyển tiếp");
  });
});

describe("điền khuyết", () => {
  const hd = hoatDong({
    kind: "dien_khuyet",
    answer: { o_trong: { o1: ["01/7/2026", "1/7/2026"], o2: ["10%"] } },
    points: 2,
  });

  test("chấp nhận mọi cách viết đã khai, không phân biệt dấu", () => {
    const kq = chamBaiTap(hd, { o_trong: { o1: "1/7/2026", o2: "10%" } });
    expect(kq.score).toBe(2);
  });

  test("sai một ô thì được nửa điểm và chỉ rõ ô nào", () => {
    const kq = chamBaiTap(hd, { o_trong: { o1: "01/7/2026", o2: "15%" } });
    expect(kq.score).toBe(1);
    expect(kq.feedback.chi_tiet?.find((c) => c.ma === "o2")?.dung).toBe(false);
  });
});

describe("sắp xếp trình tự", () => {
  test("đúng hoàn toàn là 1, đảo ngược hoàn toàn là 0", () => {
    expect(diemThuTu(["a", "b", "c", "d"], ["a", "b", "c", "d"])).toBe(1);
    expect(diemThuTu(["d", "c", "b", "a"], ["a", "b", "c", "d"])).toBe(0);
  });

  test("sai một chỗ vẫn được phần lớn điểm — trình tự gần đúng khác hẳn sai toàn bộ", () => {
    const d = diemThuTu(["a", "c", "b", "d"], ["a", "b", "c", "d"]);
    expect(d).toBeGreaterThan(0.7);
    expect(d).toBeLessThan(1);
  });
});

describe("bài tính", () => {
  test("sai số mặc định 0,5% nên chênh lệch do làm tròn vẫn đúng", () => {
    const hd = hoatDong({ kind: "tinh_toan", answer: { so: 14_500_000_000 } });
    expect(chamBaiTap(hd, { so: 14_540_000_000 }).passed).toBe(true);
    expect(chamBaiTap(hd, { so: 15_000_000_000 }).passed).toBe(false);
  });
});

describe("truy tìm căn cứ", () => {
  const hd = hoatDong({ kind: "truy_tim", answer: { urn: "vn:nd:224-2026#dieu-91.khoan-2" }, points: 2 });

  test("đúng nút thì trọn điểm, đúng văn bản sai khoản thì nửa điểm", () => {
    expect(chamBaiTap(hd, { urn: "vn:nd:224-2026#dieu-91.khoan-2" }).score).toBe(2);
    expect(chamBaiTap(hd, { urn: "vn:nd:224-2026#dieu-15" }).score).toBe(1);
    expect(chamBaiTap(hd, { urn: "vn:nd:45-2026#dieu-91" }).score).toBe(0);
  });
});

describe("bài tự luận", () => {
  test("máy không chấm được thì trả cờ chờ chấm chứ không trả điểm bịa", () => {
    const hd = hoatDong({ kind: "viet_co_can_cu", mode: "ai", points: 10 });
    const kq = chamBaiTap(hd, { bai_lam: "..." });
    expect(kq.canChamTiep).toBe(true);
    expect(kq.score).toBe(0);
    expect(kq.passed).toBe(false);
    expect(kq.gradedBy).toBe("ai");
  });
});

describe("rubric", () => {
  const rubric: Rubric = {
    tieu_chi: [
      {
        ma: "can_cu",
        ten: "Viện dẫn đúng",
        trong_so: 40,
        muc: [
          { diem: 0, mo_ta: "..." },
          { diem: 4, mo_ta: "..." },
        ],
      },
      {
        ma: "day_du",
        ten: "Đủ nội dung",
        trong_so: 30,
        muc: [
          { diem: 0, mo_ta: "..." },
          { diem: 4, mo_ta: "..." },
        ],
      },
      {
        ma: "lap_luan",
        ten: "Lập luận",
        trong_so: 30,
        muc: [
          { diem: 0, mo_ta: "..." },
          { diem: 4, mo_ta: "..." },
        ],
      },
    ],
    nguong_dat: 70,
  };

  test("quy về thang 100 theo trọng số", () => {
    expect(tinhDiemRubric(rubric, { can_cu: 4, day_du: 4, lap_luan: 4 })).toBe(100);
    expect(tinhDiemRubric(rubric, { can_cu: 4, day_du: 0, lap_luan: 0 })).toBe(40);
  });

  test("rubric thiếu tiêu chí căn cứ bị từ chối", () => {
    const loi = kiemTraRubric({
      tieu_chi: [{ ma: "trinh_bay", ten: "x", trong_so: 100, muc: [] }],
      nguong_dat: 70,
    });
    expect(loi.join(" ")).toContain("can_cu");
  });

  test("tiêu chí căn cứ phải nặng nhất và phải có mức 0 điểm", () => {
    const nhe: Rubric = {
      tieu_chi: [
        { ma: "can_cu", ten: "x", trong_so: 10, muc: [{ diem: 2, mo_ta: "" }] },
        { ma: "trinh_bay", ten: "y", trong_so: 90, muc: [] },
      ],
      nguong_dat: 70,
    };
    const loi = kiemTraRubric(nhe);
    expect(loi.some((l) => l.includes("trọng số lớn nhất"))).toBe(true);
    expect(loi.some((l) => l.includes("mức 0 điểm"))).toBe(true);
  });

  test("rubric hợp lệ không có lỗi nào", () => {
    expect(kiemTraRubric(rubric)).toEqual([]);
  });
});
