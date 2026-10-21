/**
 * Nhóm học cùng (docs/PLAN.md GĐ16b): kiểu dữ liệu API trả về và định dạng hiển thị, dùng được
 * ở cả máy chủ web và trình duyệt. Gọi API ở lib/nhom.server.ts.
 */

export type VaiTroNhom = "truong_nhom" | "thanh_vien";
export type TrangThaiNhom = "hoat_dong" | "luu_tru";
export type LoaiMucNhom = "bai_hoc" | "de_on_tap";
export type TrangThaiMucNhom = "tinh" | "khong_con_xuat_ban" | "khong_du_cau";

export interface NhomTomTat {
  id: string;
  ten: string;
  trang_thai: TrangThaiNhom;
  vai_tro: VaiTroNhom;
  so_thanh_vien: number;
  phan_tram_cua_toi: number | null;
  trung_binh_nhom: number | null;
}

export interface MucNhom {
  id: string;
  loai: LoaiMucNhom;
  ten: string;
  chu_de: string | null;
  so_cau: number | null;
  han_goi_y: string | null;
  trang_thai: TrangThaiMucNhom;
  phan_tram_cua_toi: number | null;
  cua_toi: boolean;
}

export interface ThanhVienNhom {
  id: string;
  ho_ten: string;
  vai_tro: VaiTroNhom;
  phan_tram: number | null;
  luot_co_vu: number;
  da_co_vu: boolean;
  la_toi: boolean;
}

export interface ChiTietNhom {
  id: string;
  ten: string;
  mo_ta: string | null;
  trang_thai: TrangThaiNhom;
  ma_moi: string;
  vai_tro_cua_toi: VaiTroNhom;
  phan_tram_cua_toi: number | null;
  trung_binh_nhom: number | null;
  muc: MucNhom[];
  thanh_vien: ThanhVienNhom[];
}

export interface TienDoCuaThanhVien {
  thanh_vien: { id: string; ho_ten: string };
  phan_tram: number | null;
  muc: Array<{
    id: string;
    loai: LoaiMucNhom;
    ten: string;
    trang_thai: TrangThaiMucNhom;
    phan_tram: number | null;
  }>;
}

export interface XemTruocNhom {
  id: string;
  ten: string;
  trang_thai: TrangThaiNhom;
  truong_nhom: string;
  so_thanh_vien: number;
  da_la_thanh_vien: boolean;
}

export interface NguonBaiHoc {
  id: string;
  ten: string;
  chuyen_de: string;
  so_phut: number;
}

export interface NguonChuDe {
  id: string;
  ten: string;
  so_cau: number;
}

/** Kết quả chia sẻ một bài vào một nhóm, từ trang bài học. */
export interface KetQuaChiaSeVaoNhom {
  id: string;
  ten: string;
  ok: boolean;
  loi?: string;
}

/** Kết quả action của các trang nhóm, đọc qua `useFetcher`. */
export type KetQuaThaoTacNhom =
  | {
      intent: string;
      ok: true;
      coVu?: { da_co_vu: boolean; tong: number };
      taoXong?: { id: string; ten: string; ma_moi: string };
      xemTruoc?: XemTruocNhom;
      /** Mã mời đã chuẩn hóa của lần xem trước, để bước tham gia gửi lại đúng mã. */
      ma?: string;
      chiaSe?: KetQuaChiaSeVaoNhom[];
    }
  | { intent: string; loi: string };

export const loiCua = (d: KetQuaThaoTacNhom | undefined): string | null => (d && "loi" in d ? d.loi : null);
export const xongCua = (d: KetQuaThaoTacNhom | undefined) => (d && "ok" in d ? d : null);

/** Giới hạn nhập liệu, khớp với API (packages/dao-tao/src/nhom-hoc.ts). */
export const GIOI_HAN_NHAP = {
  tenNhom: { toiThieu: 3, toiDa: 80 },
  moTa: 500,
  tenDe: { toiThieu: 3, toiDa: 80 },
  soCau: { toiThieu: 5, toiDa: 20, macDinh: 10 },
} as const;

export const TEN_LOAI_MUC: Record<LoaiMucNhom, string> = {
  bai_hoc: "Bài học",
  de_on_tap: "Đề ôn tập",
};

export const TEN_TRANG_THAI_MUC: Record<Exclude<TrangThaiMucNhom, "tinh">, string> = {
  khong_con_xuat_ban: "Nội dung không còn được xuất bản",
  khong_du_cau: "Nội dung không còn đủ câu",
};

/** Câu nêu quyền riêng tư khi tham gia nhóm (câu N4). */
export const CAU_QUYEN_RIENG_TU =
  "Thành viên khác trong nhóm thấy họ tên, phần trăm tiến độ và số lượt cổ vũ của bạn. Thành viên khác không thấy điểm và kết quả làm bài của bạn.";

/** Tên hiện ở đầu trang làm bài và trang kết quả luyện tập, gồm cả đề ôn tập của nhóm (Đ14). */
export function tenPhienLuyenTap(p: {
  nguon: string;
  chu_de: string | null;
  nhom?: { ten_de: string };
}): string {
  if (p.nguon === "cau_sai") return "Luyện lại câu sai";
  if (p.nguon === "nhom" && p.nhom?.ten_de) return `Đề ôn tập của nhóm: ${p.nhom.ten_de}`;
  return p.chu_de ?? "Luyện tập";
}

/** "dd/mm/yyyy" từ "YYYY-MM-DD". */
export function ngayVn(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Đường dẫn liên kết mời; `goc` là origin của trang (rỗng thì trả đường dẫn tương đối). */
export function lienKetMoi(goc: string, ma: string): string {
  return `${goc}/nhom/tham-gia/${ma}`;
}
