import { describe, expect, test } from "bun:test";
import { khopTuKhoa, LOAI_TRU_GTDB, TU_KHOA_GTDB } from "../src/crawler/tu-khoa.ts";

describe("khopTuKhoa — lọc mục danh mục theo tiêu đề", () => {
  test("không có từ khóa thì giữ mọi mục", () => {
    expect(khopTuKhoa("Bất kỳ", [])).toBe(true);
    expect(khopTuKhoa(undefined, [])).toBe(true);
  });

  test("thiếu tiêu đề thì bỏ khi đang lọc", () => {
    expect(khopTuKhoa(undefined, ["đường bộ"])).toBe(false);
  });

  test("khớp không phân biệt hoa thường và dạng Unicode", () => {
    const tieuDe = "Luật số 36/2024/QH15 luật Trật tự, an toàn giao thông ĐƯỜNG BỘ.".normalize("NFD");
    expect(khopTuKhoa(tieuDe, [...TU_KHOA_GTDB], [...LOAI_TRU_GTDB])).toBe(true);
  });

  test("từ loại trừ thắng từ khóa", () => {
    const tieuDe = "Thông tư quy định thuế tiêu thụ đặc biệt đối với xe ô tô";
    expect(khopTuKhoa(tieuDe, [...TU_KHOA_GTDB], [...LOAI_TRU_GTDB])).toBe(false);
  });

  test("văn bản ngành khác không lọt", () => {
    expect(khopTuKhoa("Luật số 95/2025/QH15 luật Đường sắt.", [...TU_KHOA_GTDB], [...LOAI_TRU_GTDB])).toBe(
      false,
    );
    expect(
      khopTuKhoa(
        "Nghị định quy định chi tiết Luật Giao thông đường thủy nội địa",
        [...TU_KHOA_GTDB],
        [...LOAI_TRU_GTDB],
      ),
    ).toBe(false);
  });

  test("các văn bản trụ cột của lĩnh vực đều khớp", () => {
    const mau = [
      "Luật số 35/2024/QH15 luật Đường bộ.",
      "Nghị định số 168/2024/NĐ-CP quy định xử phạt vi phạm hành chính về trật tự, an toàn giao thông trong lĩnh vực giao thông đường bộ; trừ điểm, phục hồi điểm giấy phép lái xe",
      "Nghị định số 158/2024/NĐ-CP quy định về hoạt động vận tải đường bộ",
      "Thông tư số 73/2024/TT-BCA quy định công tác tuần tra, kiểm soát, xử lý vi phạm pháp luật về trật tự, an toàn giao thông đường bộ của Cảnh sát giao thông",
      "Thông tư quy định về cấp, thu hồi chứng nhận đăng ký xe, biển số xe cơ giới, xe máy chuyên dùng",
    ];
    for (const t of mau) expect(khopTuKhoa(t, [...TU_KHOA_GTDB], [...LOAI_TRU_GTDB])).toBe(true);
  });
});
