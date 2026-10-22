/**
 * Vòng đời duyệt dùng chung (docs/PLAN.md GĐ-G0) và hồ sơ điểm mạnh/yếu theo chủ đề.
 */
import { describe, expect, test } from "bun:test";
import { chuyenTrangThaiCauHoi, hauQuaSua as hauQuaSuaCauHoi } from "../src/cau-hoi.ts";
import { capNhatHoSo, type DongHoSo, manhYeu } from "../src/ho-so-chu-de.ts";
import { chuyenTrangThai, hauQuaSua, trangThaiTruoc } from "../src/vong-doi-duyet.ts";

describe("vòng đời duyệt", () => {
  test("chuyển trạng thái đúng luật; hành động không hợp lệ trả null", () => {
    expect(chuyenTrangThai("nhap", "gui_duyet")).toBe("cho_duyet");
    expect(chuyenTrangThai("tu_choi", "gui_duyet")).toBe("cho_duyet");
    expect(chuyenTrangThai("cho_duyet", "duyet")).toBe("da_duyet");
    expect(chuyenTrangThai("cho_duyet", "tu_choi")).toBe("tu_choi");
    expect(chuyenTrangThai("da_duyet", "luu_tru")).toBe("luu_tru");
    expect(chuyenTrangThai("nhap", "duyet")).toBeNull();
    expect(chuyenTrangThai("da_duyet", "duyet")).toBeNull();
    expect(chuyenTrangThai("luu_tru", "gui_duyet")).toBeNull();
    expect(trangThaiTruoc("duyet")).toEqual(["cho_duyet"]);
  });

  test("sửa nội dung đã duyệt thì về chờ duyệt và tăng phiên bản; lưu trữ không sửa được", () => {
    expect(hauQuaSua("da_duyet", 3)).toEqual({ status: "cho_duyet", version: 4 });
    expect(hauQuaSua("nhap", 1)).toEqual({ status: "nhap", version: 1 });
    expect(hauQuaSua("tu_choi", 2)).toEqual({ status: "tu_choi", version: 2 });
    expect(hauQuaSua("luu_tru", 2)).toBeNull();
  });

  test("tên cũ của câu hỏi (GĐ3) dùng cùng luật", () => {
    expect(chuyenTrangThaiCauHoi).toBe(chuyenTrangThai);
    expect(hauQuaSuaCauHoi).toBe(hauQuaSua);
  });
});

describe("hồ sơ chủ đề", () => {
  test("trung bình trượt nghiêng về lần gần đây", () => {
    let s = capNhatHoSo(null, true);
    expect(s).toEqual({ attempts: 1, correct: 1, score_ema: 1 });
    s = capNhatHoSo(s, false);
    expect(s).toEqual({ attempts: 2, correct: 1, score_ema: 0.8 });
    s = capNhatHoSo(s, false);
    expect(s.score_ema).toBe(0.64);
  });

  const dong = (
    topic_id: string,
    attempts: number,
    score_ema: number,
    parent_id: string | null = null,
  ): DongHoSo => ({
    topic_id,
    ten: topic_id,
    parent_id,
    attempts,
    correct: Math.round(attempts * score_ema),
    score_ema,
  });

  test("chưa đủ 5 lượt thì không xếp; mạnh từ 0,7, yếu dưới 0,7", () => {
    const r = manhYeu([dong("a", 5, 0.9), dong("b", 6, 0.3), dong("c", 4, 0.1), dong("d", 8, 0.5)]);
    expect(r.manh.map((c) => c.topic_id)).toEqual(["a"]);
    expect(r.yeu.map((c) => c.topic_id)).toEqual(["b", "d"]);
  });

  test("chủ đề con chưa đủ lượt gộp lên chủ đề cha (có trọng số)", () => {
    const cay = [
      { topic_id: "cha", ten: "Cha", parent_id: null },
      { topic_id: "con1", ten: "Con 1", parent_id: "cha" },
      { topic_id: "con2", ten: "Con 2", parent_id: "cha" },
    ];
    const r = manhYeu([dong("con1", 3, 1, "cha"), dong("con2", 2, 0, "cha")], cay);
    expect(r.manh).toEqual([]);
    expect(r.yeu).toEqual([{ topic_id: "cha", ten: "Cha", attempts: 5, correct: 3, diem: 0.6 }]);
  });

  test("mỗi phía tối đa 3 chủ đề", () => {
    const ds = ["a", "b", "c", "d", "e"].map((t, i) => dong(t, 10, 0.1 + i * 0.01));
    expect(manhYeu(ds).yeu.map((c) => c.topic_id)).toEqual(["a", "b", "c"]);
  });
});
