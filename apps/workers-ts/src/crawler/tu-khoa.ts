/**
 * Lọc mục danh mục theo TIÊU ĐỀ, dùng cho ô khung theo lĩnh vực (corpus_targets.tu_khoa).
 *
 * Nguồn (Công báo) chỉ liệt kê theo loại văn bản, không tìm được theo lĩnh vực. Trang danh
 * mục có sẵn tiêu đề và số ký hiệu, nên lọc ở bước phát hiện tốn đúng chi phí đọc trang
 * danh mục, không tải trang chi tiết hay tệp của văn bản không thuộc lĩnh vực.
 */

/** Chuẩn hóa để so khớp: NFC, chữ thường, gộp khoảng trắng, bỏ dấu câu quanh từ. */
export function chuanHoaSoKhop(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[“”"'’‘]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tiêu đề khớp khi chứa ít nhất một từ khóa VÀ không chứa từ loại trừ nào.
 * Danh sách từ khóa rỗng nghĩa là không lọc (giữ mọi mục).
 */
export function khopTuKhoa(
  tieuDe: string | undefined,
  tuKhoa: string[] = [],
  loaiTru: string[] = [],
): boolean {
  if (!tuKhoa.length) return true;
  if (!tieuDe) return false;
  const t = chuanHoaSoKhop(tieuDe);
  if (loaiTru.some((k) => k && t.includes(chuanHoaSoKhop(k)))) return false;
  return tuKhoa.some((k) => k && t.includes(chuanHoaSoKhop(k)));
}

/**
 * Từ khóa của lĩnh vực GIAO THÔNG ĐƯỜNG BỘ (phục vụ đào tạo cảnh sát giao thông đường bộ).
 * Bao trùm: quy tắc giao thông, phương tiện, người lái, vận tải, hạ tầng, xử lý vi phạm.
 * Dùng chung cho ô khung (frame.ts) và cho content/khung-van-ban.json.
 */
export const TU_KHOA_GTDB = [
  "giao thông đường bộ",
  "đường bộ",
  "trật tự, an toàn giao thông",
  "an toàn giao thông",
  "cảnh sát giao thông",
  "tuần tra, kiểm soát",
  "tai nạn giao thông",
  "giấy phép lái xe",
  "sát hạch lái xe",
  "đào tạo lái xe",
  "đăng ký xe",
  "biển số xe",
  "xe cơ giới",
  "xe ô tô",
  "xe mô tô",
  "xe gắn máy",
  "xe máy chuyên dùng",
  "phương tiện giao thông",
  "đường cao tốc",
  "báo hiệu đường bộ",
  "thiết bị giám sát hành trình",
  "nồng độ cồn",
  "tải trọng xe",
  "xử lý vi phạm hành chính",
] as const;

/** Tiêu đề chứa các cụm này thì không thuộc lĩnh vực dù có khớp từ khóa (thuế, hải quan, ngành khác). */
export const LOAI_TRU_GTDB = [
  "thuế tiêu thụ đặc biệt",
  "hải quan",
  "nhập khẩu",
  "xuất khẩu",
  "đường thủy nội địa",
  "hàng không dân dụng",
  "hàng hải",
  // Khớp "xe ô tô" nhưng thuộc lĩnh vực tài chính, tài sản công — không phải trật tự, an toàn giao thông.
  "lệ phí trước bạ",
  "định mức sử dụng xe ô tô",
] as const;
