/**
 * Phần thuần của trình soạn theo mẫu (components/quan-tri/tro-choi/SoanTheoMau.tsx): tên hiển thị của
 * từng trường và gợi ý rút từ các nội dung đã có của cùng trò chơi.
 *
 * Trò chưa có trình soạn riêng không có lược đồ; kiểu của một trường và các giá trị hay dùng được suy
 * ra từ nội dung đã có, theo TÊN trường (không theo đường dẫn).
 */

export interface GoiYTruong {
  /** Kiểu của trường khi có giá trị; dùng lúc trường đang trống. */
  kieu?: "so" | "ngay" | "chu" | "khac";
  /** Có nội dung để trống trường này (null). */
  coRong: boolean;
  /** Có nội dung viết dài ở trường này: soạn bằng ô nhiều dòng. */
  dai: boolean;
  /** Các giá trị chữ ngắn đã dùng, làm danh sách gợi ý. */
  giaTri: string[];
}

export const LA_NGAY = /^\d{4}-\d{2}-\d{2}$/;
const DAI_TU = 80;
const GOI_Y_TOI_DA = 30;

export function rutGoiY(ds: readonly unknown[]): Record<string, GoiYTruong> {
  const kq: Record<string, GoiYTruong> = {};
  const ghi = (khoa: string, v: unknown, trongMang: boolean) => {
    kq[khoa] ??= { coRong: false, dai: false, giaTri: [] };
    const g = kq[khoa];
    if (v === null || v === undefined) {
      if (!trongMang) g.coRong = true;
    } else if (Array.isArray(v)) {
      if (!trongMang) g.kieu ??= "khac";
      for (const x of v) ghi(khoa, x, true);
    } else if (typeof v === "object") {
      if (!trongMang) g.kieu ??= "khac";
      for (const [k, x] of Object.entries(v)) ghi(k, x, false);
    } else {
      const ngay = typeof v === "string" && LA_NGAY.test(v);
      if (!trongMang)
        g.kieu ??= typeof v === "number" ? "so" : ngay ? "ngay" : typeof v === "string" ? "chu" : "khac";
      if (typeof v !== "string" || ngay) return;
      if (v.length > DAI_TU || v.includes("\n")) g.dai = true;
      else if (v && !g.giaTri.includes(v)) g.giaTri.push(v);
    }
  };
  for (const d of ds) ghi("", d, true);
  delete kq[""];
  // Trường có quá nhiều giá trị khác nhau là chữ tự do (họ tên, biển số): không gợi ý.
  for (const g of Object.values(kq)) if (g.dai || g.giaTri.length > GOI_Y_TOI_DA) g.giaTri = [];
  return kq;
}

const NHAN: Record<string, string> = {
  anh: "Ảnh",
  ban_do: "Bản đồ",
  bao_hiem: "Bảo hiểm",
  bat_dau: "Bắt đầu",
  bien: "Biển báo",
  bien_so: "Biển số",
  bien_so_he_thong: "Biển số hệ thống ghi nhận",
  bien_the: "Biến thể cải tạo",
  bien_toc_do: "Biển tốc độ (km/h)",
  boi_canh: "Bối cảnh",
  camera: "Camera",
  can_cu: "Căn cứ",
  canh: "Cảnh",
  cao: "Cao",
  cao_mm: "Cao (mm)",
  che: "Che khuất",
  cho_thieu: "Chỗ còn thiếu",
  chu_xe: "Chủ xe",
  co_gia_tri_den: "Có giá trị đến",
  dai_m: "Dài (m)",
  dai_mm: "Dài (mm)",
  dang_ky: "Giấy đăng ký xe",
  de_xuat: "Đề xuất xử lý",
  den: "Đèn",
  den_ngay: "Đến ngày",
  dich: "Đích",
  do_con: "Nồng độ cồn",
  do_mo: "Độ mờ của ảnh",
  don_vi: "Đơn vị",
  dung_tich: "Dung tích xi-lanh (cm³)",
  ghi_chu: "Ghi chú",
  giai_thich: "Giải thích",
  giam_sat_hanh_trinh: "Giám sát hành trình",
  giao_lo: "Giao lộ",
  giay: "Giấy chứng nhận",
  giay_kiem_dinh: "Giấy kiểm định",
  giay_phep_luu_hanh: "Giấy phép lưu hành",
  giay_to: "Giấy tờ",
  gio_kiem_tra: "Giờ kiểm tra",
  gio_xay_ra: "Giờ xảy ra",
  gioi_han: "Giới hạn",
  gplx: "Giấy phép lái xe",
  han_kiem_dinh: "Hạn kiểm định",
  hang: "Hạng",
  hang_cho_phep_kg: "Khối lượng hàng cho phép (kg)",
  hanh_vi: "Hành vi",
  hinh: "Hình",
  ho_so: "Hồ sơ",
  ho_ten: "Họ tên",
  huong: "Hướng",
  huong_xu_ly: "Hướng xử lý",
  ket_qua: "Kết quả",
  kieu: "Kiểu",
  ky_tu_mo: "Ký tự bị mờ",
  lai_xe: "Lái xe",
  lan: "Làn",
  lenh_van_chuyen: "Lệnh vận chuyển",
  loai: "Loại",
  loai_xe: "Loại xe",
  loi: "Lỗi",
  loi_giay_to: "Lỗi giấy tờ",
  loi_ke: "Lời kể",
  loi_noi: "Lời nói của người lái",
  lop: "Lốp",
  ly_do_dung: "Lý do dừng xe",
  ly_do_xu_ly: "Lý do xử lý",
  ma: "Mã",
  ma_muc_phat: "Mức phạt",
  man: "Màn chơi",
  mau: "Màu",
  mo_ta: "Mô tả",
  mo_ta_xe: "Mô tả xe",
  muc: "Màn chơi",
  muc_do: "Mức độ",
  ngay: "Ngày",
  ngay_can: "Ngày cân",
  ngay_kiem_tra: "Ngày kiểm tra",
  ngay_sinh: "Ngày sinh",
  nguoi_di_bo: "Người đi bộ",
  nguoi_lai: "Người lái",
  nguon: "Nguồn",
  nguong: "Ngưỡng",
  nhan_hieu: "Nhãn hiệu",
  nhom_truc: "Nhóm trục",
  noi_xay_ra: "Nơi xảy ra",
  o_to: "Ô tô",
  phan_loai: "Phân loại xe",
  phieu_can: "Phiếu cân",
  phu_hieu: "Phù hiệu",
  qua_vach: "Đã qua vạch dừng",
  rong: "Rộng",
  rong_mm: "Rộng (mm)",
  so: "Số",
  so_cho: "Số chỗ",
  so_truc: "Số trục",
  so_xe: "Số xe",
  ten: "Tên",
  ten_pho: "Tên phố",
  thiet_bi: "Thiết bị",
  thoi_diem: "Thời điểm",
  thung: "Thùng xe",
  tieu_chi: "Tiêu chí",
  tin_bao: "Tin báo",
  tinh_huong: "Tình huống",
  toan_bo_cho_phep_kg: "Khối lượng toàn bộ cho phép (kg)",
  toc_do: "Tốc độ (km/h)",
  toc_do_do: "Tốc độ đo được (km/h)",
  toi: "Ảnh tối",
  tong_kg: "Tổng khối lượng (kg)",
  truc_kg: "Khối lượng từng trục (kg)",
  tu_ngay: "Từ ngày",
  tu_trong_kg: "Tự trọng (kg)",
  tuyen: "Tuyến",
  tuyen_dang_di: "Tuyến đang đi",
  vach_di_bo: "Vạch đi bộ",
  vang: "Đèn vàng (giây)",
  vi_pham: "Vi phạm",
  vi_pham_khac: "Vi phạm khác",
  vi_tri: "Vị trí",
  xanh: "Đèn xanh (giây)",
  xe: "Xe",
  xe_khac: "Xe khác",
  xe_khach: "Xe khách",
  xe_may: "Xe máy",
  xe_tai: "Xe tải",
  xuat_phat: "Xuất phát",
};

/** Tên hiển thị của một trường; trường chưa có tên thì đọc từ mã: "nhip_giua" thành "Nhip giua". */
export function nhanTruong(khoa: string): string {
  if (Object.hasOwn(NHAN, khoa)) return NHAN[khoa]!;
  const s = khoa.replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
