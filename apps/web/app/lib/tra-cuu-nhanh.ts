/**
 * Gọi API tra cứu nhanh (docs/PLAN.md GĐ5): mức phạt, tốc độ, quy trình.
 * Tách khỏi api.ts để giữ tệp đó cho dữ liệu văn bản; dùng chung apiBase().
 */
import type { IconName } from "../components/ui/Icon";
import { apiBase } from "./api";

export const LOAI_XE = [
  { value: "o_to", label: "Ô tô" },
  { value: "mo_to", label: "Xe máy" },
] as const;
export type LoaiXe = (typeof LOAI_XE)[number]["value"];

export function laLoaiXe(v: string | null | undefined): v is LoaiXe {
  return LOAI_XE.some((x) => x.value === v);
}

/**
 * Chủ đề mức phạt cho lưới "Tra cứu theo chủ đề". `ten` khớp đúng trường `nhom` của dòng mức phạt
 * (CHU_DE_MUC_PHAT trong packages/dao-tao); `ma` là giá trị trên URL (`?cd=`).
 */
export const CHU_DE_MUC_PHAT: ReadonlyArray<{ ma: string; ten: string; icon: IconName }> = [
  { ma: "hieu-lenh", ten: "Hiệu lệnh, chỉ dẫn", icon: "trafficLight" },
  { ma: "giay-to", ten: "Giấy tờ", icon: "idCard" },
  { ma: "dung-do", ten: "Dừng xe, đỗ xe", icon: "timer" },
  { ma: "uu-tien", ten: "Thiết bị ưu tiên", icon: "loa" },
  { ma: "toc-do", ten: "Tốc độ", icon: "gauge" },
  { ma: "van-chuyen", ten: "Vận chuyển người, hàng hóa", icon: "truck" },
  { ma: "trang-thiet-bi", ten: "Trang thiết bị phương tiện", icon: "puzzle" },
  { ma: "duong-cam", ten: "Đường cấm, đường một chiều", icon: "ban" },
  { ma: "nong-do-con", ten: "Nồng độ cồn, chất kích thích", icon: "alert" },
  { ma: "chuyen-huong", ten: "Chuyển hướng, nhường đường", icon: "turn" },
  { ma: "khac", ten: "Khác", icon: "layers" },
  { ma: "duong-sat", ten: "Đường sắt", icon: "road" },
];

export interface MucPhat {
  khungPhat?: Array<{
    id: string;
    conditions: string[];
    required_facts: string[];
    fine_min: string;
    fine_max: string;
    point_deduction: number | null;
    suspension_months_min: number | null;
    suspension_months_max: number | null;
    additional_penalties: string[];
    remedies: string[];
    citation_urn: string;
    effective_from: string;
    effective_to: string | null;
  }>;
  ma: string;
  xe: LoaiXe;
  tenXe: string;
  nhom: string | null;
  hanhVi: string;
  phatTu: number;
  phatDen: number;
  hinhThucBoSung: string[];
  truDiem: number | null;
  moTaTocDo: string | null;
  canCu: string;
  /** Văn bản căn cứ đã có trong kho; chưa có thì không dẫn tới trang đọc. */
  canCuMoDuoc: boolean;
  hieuLucTu: string;
  hieuLucDen: string | null;
  /** Dòng đang biên tập, chưa đối chiếu. Chỉ xuất hiện khi máy chủ bật xem trước bản nháp. */
  banNhap: boolean;
}

export interface KetQuaTocDo {
  xe: LoaiXe;
  tenXe: string;
  choPhep: number;
  doDuoc: number;
  vuot: number;
  ngay: string;
  ketQua: MucPhat | null;
  /** Có khi tra theo loại đường (GĐ-G2): dòng tốc độ tối đa đã dùng. */
  tocDoTheoDuong?: TocDoToiDa | null;
}

/** Tốc độ tối đa theo loại đường đã duyệt (docs/PLAN.md GĐ-G2). */
export interface TocDoToiDa {
  ma: string;
  xe: LoaiXe;
  loaiXeChiTiet: string;
  loaiDuong: string;
  tenLoaiDuong: string;
  tocDoToiDa: number;
  canCu: string;
}

export interface QuyTrinhTomTat {
  ma: string;
  loai: "vi_pham" | "tai_nan" | "hanh_chinh" | "nghiep_vu" | "cong_tac_dang";
  tieuDe: string;
  tomTat: string | null;
  soBuoc: number;
  banNhap: boolean;
}

export interface BuocQuyTrinh {
  tieuDe: string;
  moTa: string;
  canCu: string | null;
}

export interface QuyTrinhChiTiet extends QuyTrinhTomTat {
  cacBuoc: BuocQuyTrinh[];
}

/** Lỗi 404 để route trả trang "không tìm thấy" thay vì báo lỗi máy chủ. */
export class KhongTimThay extends Error {}

async function goi<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${apiBase()}${path}${qs.size ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new KhongTimThay(path);
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);
  return (await res.json()) as T;
}

export async function timMucPhat(q: {
  q?: string;
  nhom?: string;
  xe?: LoaiXe;
  ngay?: string;
  page?: number;
}) {
  return goi<{ total: number; items: MucPhat[]; page: number }>("/api/v1/tra-cuu/muc-phat", q);
}
export async function layChuDeMucPhat() {
  return goi<{ items: Array<{ name: string }> }>("/api/v1/tra-cuu/chu-de-muc-phat");
}

export async function traTocDo(q: {
  xe: LoaiXe;
  choPhep?: number;
  duong?: string;
  doDuoc: number;
  ngay?: string;
}) {
  return goi<KetQuaTocDo>("/v1/tra-cuu/toc-do", {
    xe: q.xe,
    cho_phep: q.choPhep,
    duong: q.duong,
    do_duoc: q.doDuoc,
    ngay: q.ngay,
  });
}

/** Tốc độ tối đa theo loại đường đã duyệt của một loại xe; rỗng khi chưa có dòng nào được duyệt. */
export async function danhSachTocDoToiDa(xe: LoaiXe, ngay?: string) {
  return (await goi<{ items: TocDoToiDa[] }>("/v1/tra-cuu/toc-do-toi-da", { xe, ngay })).items;
}

export async function danhSachQuyTrinh() {
  return (await goi<{ items: QuyTrinhTomTat[] }>("/v1/tra-cuu/quy-trinh")).items;
}

export async function layQuyTrinh(ma: string) {
  return goi<QuyTrinhChiTiet>(`/v1/tra-cuu/quy-trinh/${encodeURIComponent(ma)}`);
}

/**
 * Số tiền theo quy ước QUY-TAC-HANH-VAN.md §9: "6.000.000 đồng".
 * Khoảng tiền: "Từ 6.000.000 đến 8.000.000 đồng".
 */
export function khoangTien(tu: number, den: number): string {
  const f = (n: number) => n.toLocaleString("vi-VN");
  return tu === den ? `${f(tu)} đồng` : `Từ ${f(tu)} đến ${f(den)} đồng`;
}
