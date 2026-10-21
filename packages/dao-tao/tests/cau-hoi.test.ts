/**
 * Ngân hàng câu hỏi (docs/PLAN.md GĐ3): với mỗi loại câu có ít nhất một ca đúng, một ca sai
 * và một ca đề không hợp lệ. Cộng thêm vòng đời duyệt và ranh giới đáp án.
 */
import { describe, expect, test } from "bun:test";
import {
  cauHoiSangDongExcel,
  chamCauHoi,
  chuyenTrangThaiCauHoi,
  DONG_MAU_CAU_HOI,
  deChoNguoiHoc,
  dongExcelSangCauHoi,
  hauQuaSua,
  kiemTraCauHoi,
  kiemTraRubric,
  LOAI_CHAM_MAY,
  type NoiDungCauHoi,
  RUBRIC_TU_LUAN_MAC_DINH,
  soOTrong,
  tachDeDienKhuyet,
} from "../src/index.ts";

function cau(p: Partial<NoiDungCauHoi>): NoiDungCauHoi {
  return {
    kind: "mot_dap_an",
    level: "de",
    stem: "Câu hỏi?",
    options: {},
    answer: {},
    explanation: "Giải thích.",
    citations: ["vn:vbqppl:l:36/2024/QH15"],
    ...p,
  };
}

const BA_PHUONG_AN = [
  { id: "a", text: "Phương án A" },
  { id: "b", text: "Phương án B" },
  { id: "c", text: "Phương án C" },
];

describe("một đáp án", () => {
  const c = cau({ kind: "mot_dap_an", options: { phuong_an: BA_PHUONG_AN }, answer: { dung: ["b"] } });

  test("đề hợp lệ", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("chọn đúng", () => expect(chamCauHoi(c, { chon: ["b"] }).dung).toBe(true));
  test("chọn sai", () => {
    const kq = chamCauHoi(c, { chon: ["a"] });
    expect(kq.dung).toBe(false);
    expect(kq.dap_an.dung).toEqual(["b"]);
    expect(kq.giai_thich).toBe("Giải thích.");
  });
  test("đề có hai đáp án đúng bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { dung: ["a", "b"] } })).toContain(
      "Câu một đáp án phải có đúng một đáp án đúng",
    );
  });
  test("đáp án trỏ tới phương án không có bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { dung: ["x"] } })).toContain("Đáp án trỏ tới phương án không có");
  });
});

describe("nhiều đáp án", () => {
  const c = cau({
    kind: "nhieu_dap_an",
    options: { phuong_an: [...BA_PHUONG_AN, { id: "d", text: "Phương án D" }] },
    answer: { dung: ["a", "c"] },
  });

  test("đề hợp lệ", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("chọn đủ đúng", () => expect(chamCauHoi(c, { chon: ["c", "a"] }).dung).toBe(true));
  test("chọn thiếu là sai, vẫn có tỷ lệ từng phần", () => {
    const kq = chamCauHoi(c, { chon: ["a"] });
    expect(kq.dung).toBe(false);
    expect(kq.ty_le).toBe(0.5);
  });
  test("chọn thừa là sai", () => expect(chamCauHoi(c, { chon: ["a", "b", "c"] }).dung).toBe(false));
  test("đề chỉ có một đáp án đúng bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { dung: ["a"] } })).toContain(
      "Câu nhiều đáp án phải có ít nhất hai đáp án đúng",
    );
  });
  test("đề mà mọi phương án đều đúng bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { dung: ["a", "b", "c", "d"] } })).toContain(
      "Phải có ít nhất một phương án sai",
    );
  });
});

describe("đúng/sai", () => {
  const c = cau({
    kind: "dung_sai",
    stem: "Luật số 36/2024/QH15 có hiệu lực từ 01/01/2025.",
    answer: { dung: ["dung"] },
  });

  test("đề hợp lệ, không cần phương án", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("chọn đúng", () => expect(chamCauHoi(c, { chon: ["dung"] }).dung).toBe(true));
  test("chọn sai", () => expect(chamCauHoi(c, { chon: ["sai"] }).dung).toBe(false));
  test("đáp án khác Đúng/Sai bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { dung: ["co"] } })).toHaveLength(1);
  });
  test("người học nhận hai phương án cố định", () => {
    expect(deChoNguoiHoc(c).options.phuong_an?.map((p) => p.id)).toEqual(["dung", "sai"]);
  });
});

describe("điền chỗ trống", () => {
  const c = cau({
    kind: "dien_khuyet",
    stem: "Luật Trật tự, an toàn giao thông đường bộ có số hiệu ___/2024/QH15, có hiệu lực từ năm ___.",
    answer: { o_trong: { "1": ["36"], "2": ["2025", "năm 2025"] } },
  });

  test("đếm và tách ô trống", () => {
    expect(soOTrong(c.stem)).toBe(2);
    expect(tachDeDienKhuyet(c.stem)).toHaveLength(3);
  });
  test("đề hợp lệ", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("điền đúng, chấp nhận cách viết khác và không phân biệt dấu", () => {
    expect(chamCauHoi(c, { o_trong: { "1": "36", "2": "Nam 2025" } }).dung).toBe(true);
  });
  test("điền sai một ô", () => {
    const kq = chamCauHoi(c, { o_trong: { "1": "35", "2": "2025" } });
    expect(kq.dung).toBe(false);
    expect(kq.chi_tiet).toEqual([
      { ma: "1", dung: false },
      { ma: "2", dung: true },
    ]);
  });
  test("thiếu đáp án cho một ô bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { o_trong: { "1": ["36"] } } })).toContain(
      "Ô trống 2 chưa có đáp án",
    );
  });
  test("đề không có ô trống bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, stem: "Không có ô trống", answer: {} })).toHaveLength(1);
  });
  test("người học nhận số ô trống, không nhận đáp án", () => {
    const de = deChoNguoiHoc(c);
    expect(de.so_o_trong).toBe(2);
    expect(JSON.stringify(de)).not.toContain("2025");
  });
});

describe("sắp xếp", () => {
  const c = cau({
    kind: "sap_xep",
    options: { phuong_an: BA_PHUONG_AN },
    answer: { thu_tu: ["c", "a", "b"] },
  });

  test("đề hợp lệ", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("xếp đúng", () => expect(chamCauHoi(c, { thu_tu: ["c", "a", "b"] }).dung).toBe(true));
  test("xếp gần đúng vẫn là sai, có tỷ lệ từng phần", () => {
    const kq = chamCauHoi(c, { thu_tu: ["a", "c", "b"] });
    expect(kq.dung).toBe(false);
    expect(kq.ty_le).toBeGreaterThan(0);
  });
  test("thứ tự đúng thiếu bước bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { thu_tu: ["c", "a"] } })).toContain(
      "Thứ tự đúng phải gồm đủ mọi bước, mỗi bước một lần",
    );
  });
});

describe("ghép cặp", () => {
  const c = cau({
    kind: "ghep_cap",
    options: {
      trai: [
        { id: "t1", text: "Nghị định số 168/2024/NĐ-CP" },
        { id: "t2", text: "Nghị định số 158/2024/NĐ-CP" },
      ],
      phai: [
        { id: "p1", text: "Xử phạt vi phạm hành chính" },
        { id: "p2", text: "Vận tải đường bộ" },
      ],
    },
    answer: { cap: { t1: "p1", t2: "p2" } },
  });

  test("đề hợp lệ", () => expect(kiemTraCauHoi(c)).toEqual([]));
  test("ghép đúng", () => expect(chamCauHoi(c, { cap: { t1: "p1", t2: "p2" } }).dung).toBe(true));
  test("ghép sai", () => expect(chamCauHoi(c, { cap: { t1: "p2", t2: "p1" } }).dung).toBe(false));
  test("nhiều vế trái cùng ghép một vế phải là hợp lệ (câu phân loại)", () => {
    expect(kiemTraCauHoi({ ...c, answer: { cap: { t1: "p1", t2: "p1" } } })).toEqual([]);
  });
  test("ghép với vế phải không có thì đề bị từ chối", () => {
    expect(kiemTraCauHoi({ ...c, answer: { cap: { t1: "p1", t2: "p9" } } })).toContain(
      'Vế trái "t2" ghép với vế phải không có',
    );
  });
});

describe("kiểm tra chung", () => {
  test("thiếu đề, giải thích và loại sai đều được báo", () => {
    expect(kiemTraCauHoi({ kind: "van_dap" as never })).toEqual(["Loại câu hỏi không hợp lệ: van_dap"]);
    const loi = kiemTraCauHoi(
      cau({ stem: " ", explanation: "", options: { phuong_an: BA_PHUONG_AN }, answer: { dung: ["a"] } }),
    );
    expect(loi).toContain("Chưa có nội dung câu hỏi");
    expect(loi).toContain("Chưa có giải thích đáp án");
  });
  test("căn cứ phải là URN", () => {
    const loi = kiemTraCauHoi(
      cau({ citations: ["Nghị định 168"], options: { phuong_an: BA_PHUONG_AN }, answer: { dung: ["a"] } }),
    );
    expect(loi).toContain("Căn cứ không đúng dạng URN: Nghị định 168");
  });
  test("đề cho người học không lộ đáp án, giải thích hay căn cứ", () => {
    const c = cau({ options: { phuong_an: BA_PHUONG_AN }, answer: { dung: ["b"] } });
    const json = JSON.stringify(deChoNguoiHoc(c));
    expect(json).not.toContain('dung"');
    expect(json).not.toContain("Giải thích");
    expect(json).not.toContain("vn:");
  });
});

describe("vòng đời duyệt", () => {
  test("nháp gửi duyệt, chờ duyệt được duyệt hoặc từ chối", () => {
    expect(chuyenTrangThaiCauHoi("nhap", "gui_duyet")).toBe("cho_duyet");
    expect(chuyenTrangThaiCauHoi("tu_choi", "gui_duyet")).toBe("cho_duyet");
    expect(chuyenTrangThaiCauHoi("cho_duyet", "duyet")).toBe("da_duyet");
    expect(chuyenTrangThaiCauHoi("cho_duyet", "tu_choi")).toBe("tu_choi");
    expect(chuyenTrangThaiCauHoi("da_duyet", "luu_tru")).toBe("luu_tru");
  });
  test("không duyệt thẳng bản nháp, không duyệt lại câu đã duyệt", () => {
    expect(chuyenTrangThaiCauHoi("nhap", "duyet")).toBeNull();
    expect(chuyenTrangThaiCauHoi("da_duyet", "duyet")).toBeNull();
    expect(chuyenTrangThaiCauHoi("luu_tru", "gui_duyet")).toBeNull();
  });
  test("sửa câu đã duyệt thì về chờ duyệt và tăng version", () => {
    expect(hauQuaSua("da_duyet", 1)).toEqual({ status: "cho_duyet", version: 2 });
    expect(hauQuaSua("nhap", 1)).toEqual({ status: "nhap", version: 1 });
    expect(hauQuaSua("luu_tru", 3)).toBeNull();
  });
});

describe("dòng Excel", () => {
  test("đọc câu một đáp án, nhận nhãn tiếng Việt không dấu hoặc có dấu", () => {
    const { cau: c, loi } = dongExcelSangCauHoi({
      chu_de: "gt-toc-do",
      muc_do: "Trung bình",
      loai: "mot dap an",
      cau_hoi: "Câu hỏi?",
      A: "Một",
      B: "Hai",
      dap_an: "b",
      giai_thich: "Vì vậy.",
      can_cu: "vn:vbqppl:l:36/2024/QH15; vn:vbqppl:nd:168/2024/NĐ-CP",
    });
    expect(loi).toEqual([]);
    expect(c?.kind).toBe("mot_dap_an");
    expect(c?.level).toBe("trung_binh");
    expect(c?.answer.dung).toEqual(["b"]);
    expect(c?.citations).toHaveLength(2);
    expect(kiemTraCauHoi(c!)).toEqual([]);
  });

  test("đọc câu ghép cặp và điền chỗ trống", () => {
    const ghep = dongExcelSangCauHoi({
      muc_do: "de",
      loai: "Ghép cặp",
      cau_hoi: "Ghép",
      A: "X => 1",
      B: "Y -> 2",
      giai_thich: "g",
    });
    expect(ghep.cau?.answer.cap).toEqual({ t1: "p1", t2: "p2" });
    const phanLoai = dongExcelSangCauHoi({
      muc_do: "de",
      loai: "Ghép cặp",
      cau_hoi: "Phân loại",
      A: "X => Nhóm 1",
      B: "Y => Nhóm 2",
      C: "Z => nhóm 1",
      giai_thich: "g",
    });
    expect(phanLoai.cau?.options.phai).toHaveLength(2);
    expect(phanLoai.cau?.answer.cap).toEqual({ t1: "p1", t2: "p2", t3: "p1" });
    const dien = dongExcelSangCauHoi({
      muc_do: "kho",
      loai: "Điền chỗ trống",
      cau_hoi: "Số ___ năm ___",
      dap_an: "36; 2025 | năm 2025",
      giai_thich: "g",
    });
    expect(dien.cau?.answer.o_trong).toEqual({ "1": ["36"], "2": ["2025", "năm 2025"] });
  });

  test("loại, mức độ hoặc đáp án đúng/sai sai định dạng thì báo lỗi", () => {
    expect(dongExcelSangCauHoi({ loai: "Vấn đáp", muc_do: "de" }).loi).toHaveLength(1);
    expect(dongExcelSangCauHoi({ loai: "Đúng/sai", muc_do: "rất khó" }).loi).toHaveLength(1);
    expect(dongExcelSangCauHoi({ loai: "Đúng/sai", muc_do: "de", dap_an: "có" }).loi).toHaveLength(1);
  });

  test("xuất rồi đọc lại cho cùng nội dung", () => {
    const goc = {
      ...cau({ kind: "sap_xep", options: { phuong_an: BA_PHUONG_AN }, answer: { thu_tu: ["c", "a", "b"] } }),
      code: "CH-00001",
      topic_code: "gt",
    };
    const doc = dongExcelSangCauHoi(cauHoiSangDongExcel(goc)).cau!;
    expect(doc.answer.thu_tu).toEqual(["c", "a", "b"]);
    expect(doc.options.phuong_an).toEqual(BA_PHUONG_AN);
    expect(doc.code).toBe("CH-00001");
  });
});

describe("câu tự luận", () => {
  const tuLuan = (p: Partial<NoiDungCauHoi> = {}) =>
    cau({
      kind: "tu_luan",
      level: "kho",
      stem: "Nêu căn cứ xử phạt.",
      rubric: RUBRIC_TU_LUAN_MAC_DINH,
      ...p,
    });

  test("rubric mặc định hợp lệ, câu đủ căn cứ và rubric thì hợp lệ", () => {
    expect(kiemTraRubric(RUBRIC_TU_LUAN_MAC_DINH)).toEqual([]);
    expect(kiemTraCauHoi(tuLuan())).toEqual([]);
  });

  test("thiếu căn cứ hoặc rubric thì không hợp lệ", () => {
    expect(kiemTraCauHoi(tuLuan({ citations: [] }))).toContain("Câu tự luận phải có ít nhất một căn cứ");
    expect(kiemTraCauHoi(tuLuan({ rubric: {} })).some((l) => l.startsWith("Tiêu chí chấm:"))).toBe(true);
    const khongCanCu = {
      ...RUBRIC_TU_LUAN_MAC_DINH,
      tieu_chi: RUBRIC_TU_LUAN_MAC_DINH.tieu_chi.filter((t) => t.ma !== "can_cu"),
    };
    expect(kiemTraCauHoi(tuLuan({ rubric: khongCanCu })).length).toBeGreaterThan(0);
  });

  test("đề cho người thi không lộ đáp án gợi ý hay rubric", () => {
    const de = deChoNguoiHoc(tuLuan({ explanation: "Đáp án gợi ý bí mật" }));
    expect(de).toEqual({ kind: "tu_luan", stem: "Nêu căn cứ xử phạt.", options: {} });
    expect(JSON.stringify(de)).not.toContain("bí mật");
  });

  test("không chấm máy: luôn sai, tỷ lệ 0", () => {
    const kq = chamCauHoi(tuLuan(), { bai_viet: "Căn cứ Nghị định 168/2024/NĐ-CP..." });
    expect(kq.dung).toBe(false);
    expect(kq.ty_le).toBe(0);
  });

  test("nhập Excel dùng rubric mặc định; xuất Excel để trống phương án và đáp án", () => {
    const { cau: doc, loi } = dongExcelSangCauHoi({
      chu_de: "cd",
      muc_do: "Khó",
      loai: "Tự luận",
      cau_hoi: "Nêu căn cứ xử phạt.",
      giai_thich: "Dàn ý.",
      can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP",
    });
    expect(loi).toEqual([]);
    expect(doc?.kind).toBe("tu_luan");
    expect(doc?.rubric).toEqual(RUBRIC_TU_LUAN_MAC_DINH);
    expect(kiemTraCauHoi(doc!)).toEqual([]);
    const dong = cauHoiSangDongExcel({ ...doc!, code: "CH-1", topic_code: "cd" });
    expect(dong.loai).toBe("Tự luận");
    expect(dong.dap_an).toBe("");
    expect(dong.A).toBeUndefined();
  });

  test("dòng mẫu của tệp Excel đều đọc được và hợp lệ", () => {
    for (const d of DONG_MAU_CAU_HOI) {
      const { cau: doc, loi } = dongExcelSangCauHoi(d);
      expect(loi).toEqual([]);
      expect(kiemTraCauHoi(doc!)).toEqual([]);
    }
  });

  test("LOAI_CHAM_MAY không có tự luận", () => {
    expect((LOAI_CHAM_MAY as readonly string[]).includes("tu_luan")).toBe(false);
  });
});
