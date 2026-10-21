/**
 * Luật thuần của hộp kết quả đúng/sai trong trò chơi (docs/PLAN.md GĐ17a,
 * docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.2, 2.3, H6, đề xuất Đ5, Đ9).
 *
 * Một kiểu đầu vào chung cho mọi nơi báo kết quả: kết quả một bước của khung chơi chung
 * (`KetQuaBuocWeb`, có điểm và hết giờ) và kết quả một câu luyện tập (`KetQuaCauHoi`, Vượt màn: không
 * có điểm). Cả hai kiểu đều khớp `KetQuaHienThi` mà không cần chuyển đổi.
 */
import type { DeCauHoi, KetQuaCauHoi } from "./ngan-hang";

export interface KetQuaHienThi {
  /** `null`: trò chấm theo điểm, không có đúng/sai trọn vẹn. */
  dung: boolean | null;
  het_gio?: boolean;
  diem?: number;
  diem_toi_da?: number;
  thuong?: number;
  giai_thich: string | null;
  can_cu: string[];
}

export type LoaiKetQua = "dung" | "mot_phan" | "chua_dung" | "het_gio";

export const TIEU_DE_KET_QUA: Record<LoaiKetQua, string> = {
  dung: "Đúng",
  mot_phan: "Đúng một phần",
  chua_dung: "Chưa đúng",
  het_gio: "Hết giờ",
};

/**
 * Loại kết quả (H6). Hết giờ luôn là "Hết giờ". `dung` là true/false thì theo đó. `dung: null` thì theo
 * điểm: đủ điểm tối đa là "Đúng", 0 điểm là "Chưa đúng", còn lại "Đúng một phần". Không có điểm để xét
 * thì là "Chưa đúng", như trước đây.
 */
export function loaiKetQua(kq: Pick<KetQuaHienThi, "dung" | "het_gio" | "diem" | "diem_toi_da">): LoaiKetQua {
  if (kq.het_gio) return "het_gio";
  if (kq.dung === true) return "dung";
  if (kq.dung === false) return "chua_dung";
  if (kq.diem === undefined || !kq.diem_toi_da) return "chua_dung";
  if (kq.diem >= kq.diem_toi_da) return "dung";
  if (kq.diem <= 0) return "chua_dung";
  return "mot_phan";
}

export function tieuDeKetQua(kq: Pick<KetQuaHienThi, "dung" | "het_gio" | "diem" | "diem_toi_da">): string {
  return TIEU_DE_KET_QUA[loaiKetQua(kq)];
}

/** Có gì để hiện sau nút "Xem chi tiết" không (mục 2.3). Không có thì không hiện nút. */
export function coChiTiet(kq: Pick<KetQuaHienThi, "giai_thich" | "can_cu">, coChiTietRieng = false): boolean {
  return Boolean(kq.giai_thich?.trim()) || kq.can_cu.length > 0 || coChiTietRieng;
}

/**
 * Đáp án đúng viết một dòng, cho câu trắc nghiệm (Đ9): chữ của các phương án đúng. Loại câu khác
 * (sắp xếp, ghép cặp, điền khuyết) không có dạng ngắn, trả `null` để hộp bỏ dòng này.
 */
export function dapAnNgan(de: DeCauHoi, kq: Pick<KetQuaCauHoi, "dap_an">): string | null {
  const ids = kq.dap_an.dung ?? [];
  if (!ids.length) return null;
  if (de.kind === "dung_sai") {
    const id = ids[0];
    return id === "dung" ? "Đúng" : id === "sai" ? "Sai" : null;
  }
  if (de.kind !== "mot_dap_an" && de.kind !== "nhieu_dap_an") return null;
  const ten = new Map((de.options.phuong_an ?? []).map((p) => [p.id, p.text]));
  const chu = ids.map((id) => ten.get(id)).filter((x): x is string => Boolean(x));
  return chu.length === ids.length ? chu.join("; ") : null;
}

/** "m:ss" từ số mili giây còn lại (đồng hồ cả lượt trong hộp, Đ4). */
export function phutGiay(ms: number): string {
  const giay = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, "0")}`;
}
