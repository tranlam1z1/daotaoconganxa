/**
 * Gọi API luyện tập thay người đang đăng nhập (docs/PLAN.md GĐ4). Token phiên nằm trong cookie
 * HttpOnly nên mọi lời gọi đi qua máy chủ web (action/loader của React Router).
 */

import type { DeCauHoi, KetQuaCauHoi, MucDoCauHoi, TraLoiCauHoi } from "./ngan-hang";
import { goiApiQuanTri } from "./quan-tri.server";

export interface ChuDeLuyenTap {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  ordinal: number;
  so_cau: number;
  da_lam_dung: number;
}

export interface CauTrongPhien {
  stt: number;
  muc_do: MucDoCauHoi;
  de: DeCauHoi;
  tra_loi?: TraLoiCauHoi;
  ket_qua?: KetQuaCauHoi;
}

export interface PhienLuyenTap {
  id: string;
  /** Phiên của trò chơi (Vượt màn, Đua, Hỏi nhanh) có nguồn `game:<mã trò>` (docs/PLAN.md GĐ17a, Đ6). */
  nguon: "chu_de" | "cau_sai" | "thu_thach" | "nhom" | `game:${string}`;
  chu_de: string | null;
  /** Đề ôn tập của nhóm học cùng (docs/PLAN.md GĐ16b, đề xuất Đ14): nhóm để quay về và tên đề. */
  nhom?: { id: string; ten_de: string };
  bat_dau: string;
  ket_thuc: string | null;
  tong: number;
  dung: number | null;
  da_tra_loi: number;
  cau: CauTrongPhien[];
}

export interface PhienTomTat {
  id: string;
  source: PhienLuyenTap["nguon"];
  topic_name: string | null;
  started_at: string;
  finished_at: string | null;
  correct: number | null;
  total: number;
  da_tra_loi: number;
}

export interface CauSai {
  question_id: string;
  code: string;
  stem: string;
  topic_name: string | null;
  wrong_count: number;
  correct_streak: number;
}

// goiApiQuanTri là lớp gọi API chung có token (tên theo nơi dùng đầu tiên ở GĐ2): 401 chuyển
// về đăng nhập, 403 ném Response, lỗi nghiệp vụ ném LoiApi mang thông báo tiếng Việt.
export const layChuDe = (token: string) =>
  goiApiQuanTri<{ items: ChuDeLuyenTap[]; so_cau_sai: number }>(token, "/v1/luyen-tap/chu-de");

export const taoPhien = (
  token: string,
  body: { nguon: "chu_de" | "cau_sai"; chu_de?: string; so_cau?: number },
) => goiApiQuanTri<{ id: string; tong: number }>(token, "/v1/luyen-tap/phien", { body });

export const layPhien = (token: string, id: string) =>
  goiApiQuanTri<PhienLuyenTap>(token, `/v1/luyen-tap/phien/${encodeURIComponent(id)}`);

/** Lưu tạm câu trả lời của một câu, chưa chấm; sửa được tới khi kết thúc phiên. */
export const luuTam = (
  token: string,
  id: string,
  body: { stt: number; tra_loi: TraLoiCauHoi; giay?: number },
) =>
  goiApiQuanTri<{ stt: number; da_luu: true }>(
    token,
    `/v1/luyen-tap/phien/${encodeURIComponent(id)}/luu-tam`,
    {
      body,
    },
  );

/** Chấm ngay một câu: chỉ Đua thời gian dùng; các phiên khác lưu tạm rồi chấm khi kết thúc. */
export const traLoi = (
  token: string,
  id: string,
  body: { stt: number; tra_loi: TraLoiCauHoi; giay?: number },
) =>
  goiApiQuanTri<KetQuaCauHoi & { stt: number }>(
    token,
    `/v1/luyen-tap/phien/${encodeURIComponent(id)}/tra-loi`,
    {
      body,
    },
  );

/** Phần riêng của game trong phản hồi kết thúc phiên (GĐ10). */
export type KetQuaTroChoi =
  | { ma: "vuot_man"; man: number; chu_de_id: string; ty_le: number; dat: boolean; sao: number; xp: number }
  | { ma: "dua_thoi_gian"; diem: number; ky_luc: number; pha_ky_luc: boolean; xp: number }
  | {
      ma: "hoi_nhanh_giong_noi";
      diem: number;
      tong: number;
      ky_luc: number;
      pha_ky_luc: boolean;
      xp: number;
    };

export const ketThuc = (token: string, id: string) =>
  goiApiQuanTri<{ dung: number; tong: number; giay: number; tro_choi?: KetQuaTroChoi }>(
    token,
    `/v1/luyen-tap/phien/${encodeURIComponent(id)}/ket-thuc`,
    { method: "POST" },
  );

export const lichSuCuaToi = (token: string) =>
  goiApiQuanTri<{ items: PhienTomTat[] }>(token, "/v1/toi/lich-su");

export const cauSaiCuaToi = (token: string) =>
  goiApiQuanTri<{ items: CauSai[]; tong: number }>(token, "/v1/toi/cau-sai");
