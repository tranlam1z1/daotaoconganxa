/**
 * Gọi API game đoán biển báo thay người đang đăng nhập (docs/PLAN.md GĐ12).
 */
import { goiApiQuanTri } from "./quan-tri.server";

export interface CauDoanBienBao {
  stt: number;
  anh: string;
  phuong_an: Array<{ id: string; text: string }>;
}

export interface KetQuaCauDoan {
  stt: number;
  dung: boolean;
  dap_an: string;
  ten: string;
  y_nghia: string;
  can_cu: string;
}

const API_GAME = "/v1/tro-choi/doan-bien-bao";

export const batDauDoan = (token: string) =>
  goiApiQuanTri<{ id: string; cau: CauDoanBienBao[] }>(token, `${API_GAME}/bat-dau`, { method: "POST" });

export const traLoiDoan = (token: string, id: string, stt: number, chon: string) =>
  goiApiQuanTri<KetQuaCauDoan>(token, `${API_GAME}/${encodeURIComponent(id)}/tra-loi`, {
    body: { stt, chon },
  });

export const ketThucDoan = (token: string, id: string) =>
  goiApiQuanTri<{ dung: number; tong: number; xp: number }>(
    token,
    `${API_GAME}/${encodeURIComponent(id)}/ket-thuc`,
    {
      method: "POST",
    },
  );
