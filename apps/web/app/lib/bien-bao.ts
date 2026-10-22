/**
 * Biển báo phía web (docs/PLAN.md GĐ12): kiểu, nhãn nhóm và lời gọi tra cứu công khai (không
 * cần token).
 */
import { apiBase } from "./api";

export type NhomBienBao = "cam" | "nguy_hiem" | "hieu_lenh" | "chi_dan" | "phu";

export const NHOM_BIEN_BAO: ReadonlyArray<{ value: NhomBienBao; label: string }> = [
  { value: "cam", label: "Biển cấm" },
  { value: "nguy_hiem", label: "Nguy hiểm" },
  { value: "hieu_lenh", label: "Hiệu lệnh" },
  { value: "chi_dan", label: "Chỉ dẫn" },
  { value: "phu", label: "Biển phụ" },
];

export function laNhomBienBao(v: string | null | undefined): v is NhomBienBao {
  return NHOM_BIEN_BAO.some((n) => n.value === v);
}

export interface BienBao {
  ma: string;
  nhom: NhomBienBao;
  ten: string;
  y_nghia: string;
  /** Tên tệp ảnh; web phục vụ ở /bien-bao/anh/<anh>. */
  anh: string;
  can_cu: string;
  /** Văn bản căn cứ đã có trong kho; chưa có thì không dẫn tới trang đọc. */
  can_cu_mo_duoc: boolean;
  ban_nhap: boolean;
}

export async function timBienBao(q: { q?: string; nhom?: NhomBienBao }) {
  const qs = new URLSearchParams();
  if (q.q) qs.set("q", q.q);
  if (q.nhom) qs.set("nhom", q.nhom);
  const res = await fetch(`${apiBase()}/v1/tra-cuu/bien-bao${qs.size ? `?${qs}` : ""}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`API biển báo trả về ${res.status}`);
  return (await res.json()) as { items: BienBao[]; ban_nhap: boolean };
}
