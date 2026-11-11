/**
 * Xử lý phím của ô chọn kiểu combobox (components/ui/ChonDonVi.tsx), tách ra để kiểm được.
 * Mở danh sách không tự đánh dấu dòng đầu: Enter khi chưa đánh dấu dòng nào thì để biểu mẫu gửi đi,
 * không thay giá trị đang chọn.
 */

export type HanhDongPhim = "nhan" | "dong" | "dong_gui" | "mo" | "giu" | null;

/** Dòng được đánh dấu khi mở danh sách: dòng đang chọn, hoặc -1 nếu không có. */
export function viTriKhiMo(ids: string[], chon: string): number {
  return chon ? ids.indexOf(chon) : -1;
}

/**
 * Kết quả một lần bấm phím. `giu`: chặn hành vi mặc định, chỉ đổi dòng đánh dấu; `dong_gui`: đóng
 * danh sách và để phím Enter gửi biểu mẫu; `null`: không xử lý.
 */
export function phimCombobox(
  phim: string,
  viTri: number,
  soDong: number,
  mo: boolean,
): { viTri: number; hanhDong: HanhDongPhim } {
  if (phim === "ArrowDown") {
    if (!mo) return { viTri, hanhDong: "mo" };
    return { viTri: soDong ? Math.min(viTri + 1, soDong - 1) : -1, hanhDong: "giu" };
  }
  if (phim === "ArrowUp") return { viTri: mo && soDong ? Math.max(viTri - 1, 0) : viTri, hanhDong: "giu" };
  if (phim === "Enter" && mo) return { viTri, hanhDong: viTri >= 0 && viTri < soDong ? "nhan" : "dong_gui" };
  if (phim === "Escape" && mo) return { viTri, hanhDong: "dong" };
  return { viTri, hanhDong: null };
}
