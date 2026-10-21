/**
 * Vòng đời duyệt dùng chung cho mọi loại nội dung (docs/GAME_DESIGN.md §3.1): câu hỏi ngân hàng
 * (GĐ3), nội dung trò chơi, mức phạt, biển báo, quy trình (GĐ-G0).
 *
 *   nhap ──gửi duyệt──► cho_duyet ──duyệt──► da_duyet ──lưu trữ──► luu_tru
 *     ▲                     │                    │
 *     └──── sửa ◄── tu_choi ◄┘ từ chối           └── sửa ──► cho_duyet (version + 1)
 *
 * Dữ liệu tra cứu (mức phạt, biển báo, quy trình) gọi trạng thái lưu trữ là `ngung`; tầng CSDL
 * ánh xạ hai tên này, luật ở đây chỉ dùng `luu_tru`.
 */

export const TRANG_THAI_DUYET = ["nhap", "cho_duyet", "da_duyet", "tu_choi", "luu_tru"] as const;
export type TrangThaiDuyet = (typeof TRANG_THAI_DUYET)[number];

export const TEN_TRANG_THAI_DUYET: Record<TrangThaiDuyet, string> = {
  nhap: "Nháp",
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  tu_choi: "Bị từ chối",
  luu_tru: "Lưu trữ",
};

export type HanhDongDuyet = "gui_duyet" | "duyet" | "tu_choi" | "luu_tru";

export const HANH_DONG_DUYET: readonly HanhDongDuyet[] = ["gui_duyet", "duyet", "tu_choi", "luu_tru"];

/** Trạng thái được phép đi vào từng hành động, và trạng thái sau hành động. */
const CHUYEN_TRANG_THAI: Record<HanhDongDuyet, { tu: TrangThaiDuyet[]; den: TrangThaiDuyet }> = {
  gui_duyet: { tu: ["nhap", "tu_choi"], den: "cho_duyet" },
  duyet: { tu: ["cho_duyet"], den: "da_duyet" },
  tu_choi: { tu: ["cho_duyet"], den: "tu_choi" },
  luu_tru: { tu: ["nhap", "tu_choi", "da_duyet"], den: "luu_tru" },
};

/** Trạng thái sau hành động, hoặc null khi hành động không áp dụng được cho trạng thái hiện tại. */
export function chuyenTrangThai(hienTai: TrangThaiDuyet, hd: HanhDongDuyet): TrangThaiDuyet | null {
  const quy = CHUYEN_TRANG_THAI[hd];
  return quy.tu.includes(hienTai) ? quy.den : null;
}

/** Các trạng thái mà hành động áp dụng được. */
export function trangThaiTruoc(hd: HanhDongDuyet): TrangThaiDuyet[] {
  return [...CHUYEN_TRANG_THAI[hd].tu];
}

/**
 * Hệ quả của việc sửa nội dung.
 *
 * Nội dung đã duyệt có thể đã nằm trong lượt làm của người học, nên sửa thì phải tăng `version`
 * và quay về `cho_duyet` để duyệt lại. Nội dung chưa từng duyệt thì sửa thoải mái, giữ nguyên
 * version. Nội dung lưu trữ không sửa được (trả null).
 */
export function hauQuaSua(
  hienTai: TrangThaiDuyet,
  version: number,
): { status: TrangThaiDuyet; version: number } | null {
  if (hienTai === "luu_tru") return null;
  if (hienTai === "da_duyet") return { status: "cho_duyet", version: version + 1 };
  return { status: hienTai, version };
}
