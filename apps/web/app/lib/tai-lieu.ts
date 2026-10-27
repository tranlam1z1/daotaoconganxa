/**
 * Gọi API của trang "Quy trình, Biểu mẫu": tra chung quy trình dạng các bước và biểu mẫu, hướng dẫn
 * dạng tệp. Hằng số ở đây cũng dùng cho màn soạn, duyệt trong khu quản trị.
 */
import { apiBase } from "./api";
import { KhongTimThay, type LoaiXe } from "./tra-cuu-nhanh";

/** Giá trị của ô "Loại tài liệu" (khớp LOAI_TAI_LIEU ở @qdpl/db). */
export const LOAI_TAI_LIEU = [
  { value: "quy_trinh", label: "Quy trình" },
  { value: "bieu_mau", label: "Biểu mẫu" },
  { value: "huong_dan", label: "Hướng dẫn" },
] as const;
export type LoaiTaiLieu = (typeof LOAI_TAI_LIEU)[number]["value"];

export function laLoaiTaiLieu(v: string | null | undefined): v is LoaiTaiLieu {
  return LOAI_TAI_LIEU.some((l) => l.value === v);
}

export const tenLoaiTaiLieu = (loai: LoaiTaiLieu) => LOAI_TAI_LIEU.find((l) => l.value === loai)!.label;

/** Loại của tệp tải lên: mọi loại tài liệu trừ quy trình (quy trình soạn theo từng bước). */
export const LOAI_TEP_TAI_LIEU = LOAI_TAI_LIEU.filter((l) => l.value !== "quy_trinh");

/** Đuôi tệp nhận khi tải lên, cho thuộc tính `accept` của ô chọn tệp. */
export const NHAN_TEP_TAI_LIEU = ".pdf,.docx,.doc,.xlsx,.xls";

export interface TaiLieu {
  loai: LoaiTaiLieu;
  ma: string;
  tieuDe: string;
  tomTat: string | null;
  /** null: áp dụng cho mọi phương tiện. */
  xe: LoaiXe | null;
  tenXe: string | null;
  /** Loại vi phạm; null: chưa phân loại. */
  nhom: string | null;
  /** Số bước, chỉ có với quy trình. */
  soBuoc: number | null;
  /** Tệp đính kèm, chỉ có với biểu mẫu và hướng dẫn. */
  tep: { ten: string; duoi: string; kichThuoc: number } | null;
  ghim: boolean;
  luotXem: number;
  /** Mục đang biên tập. Chỉ xuất hiện khi máy chủ bật xem trước bản nháp. */
  banNhap: boolean;
}

async function goi<T>(path: string, qs?: URLSearchParams): Promise<T> {
  const res = await fetch(`${apiBase()}${path}${qs?.size ? `?${qs}` : ""}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new KhongTimThay(path);
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);
  return (await res.json()) as T;
}

/** Tra quy trình, biểu mẫu. Không có bộ lọc nào thì là danh sách phổ biến: ghim trước, rồi lượt mở. */
export async function timTaiLieu(loc: {
  q?: string;
  loai?: LoaiTaiLieu;
  xe?: LoaiXe;
  /** Tên loại vi phạm (trường `ten` của CHU_DE_MUC_PHAT). */
  nhom?: string;
  gioiHan?: number;
}) {
  const qs = new URLSearchParams();
  if (loc.q) qs.set("q", loc.q);
  if (loc.loai) qs.set("loai", loc.loai);
  if (loc.xe) qs.set("xe", loc.xe);
  if (loc.nhom) qs.set("nhom", loc.nhom);
  if (loc.gioiHan) qs.set("gioi_han", String(loc.gioiHan));
  return (await goi<{ items: TaiLieu[] }>("/v1/tra-cuu/tai-lieu", qs)).items;
}

export async function layBieuMau(ma: string) {
  return goi<TaiLieu>(`/v1/tra-cuu/bieu-mau/${encodeURIComponent(ma)}`);
}

/** Trang chi tiết của một mục: quy trình mở các bước, biểu mẫu và hướng dẫn mở trang tệp. */
export function hrefTaiLieu(t: Pick<TaiLieu, "loai" | "ma">): string {
  const nhanh = t.loai === "quy_trinh" ? "quy-trinh" : "bieu-mau";
  return `/tra-cuu-nhanh/${nhanh}/${encodeURIComponent(t.ma)}`;
}

/** Đường dẫn tệp của một biểu mẫu (resource route chuyển tiếp từ API). */
export function hrefTepBieuMau(ma: string, taiVe = false): string {
  return `/tra-cuu-nhanh/bieu-mau/${encodeURIComponent(ma)}/tep${taiVe ? "?tai=1" : ""}`;
}

/** Dung lượng tệp dạng đọc được: "85 KB", "1,2 MB". */
export function dungLuongTep(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;
}

export async function timTaiLieuPage(loc: {
  q?: string;
  loai?: LoaiTaiLieu;
  gioiHan?: number;
  page?: number;
}) {
  const qs = new URLSearchParams();
  if (loc.q) qs.set("q", loc.q);
  if (loc.loai) qs.set("loai", loc.loai);
  qs.set("gioi_han", String(loc.gioiHan ?? 20));
  qs.set("page", String(loc.page ?? 1));
  return goi<{ items: TaiLieu[]; total: number; pages: number }>("/v1/tra-cuu/tai-lieu", qs);
}
