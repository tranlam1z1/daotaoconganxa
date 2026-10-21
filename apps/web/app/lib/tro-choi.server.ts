/**
 * Gọi API trò chơi thay người đang đăng nhập (docs/PLAN.md GĐ10). Vượt màn và đua thời gian
 * trả lời, kết thúc qua API luyện tập (lib/luyen-tap.server.ts); tệp này lo phần riêng của game.
 */
import { goiApiQuanTri } from "./quan-tri.server";

export interface KyLuc {
  ky_luc: number | null;
  so_van: number;
  gan_day: Array<{ score: number; played_at: string }>;
}

export interface ChuDeVuotMan {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  so_man: number;
}

export interface ManTrenBanDo {
  id: string;
  thu_tu: number;
  so_cau: number;
  mo: boolean;
  sao: number;
  qua: boolean;
  ty_le_tot_nhat: number | null;
}

export interface DeGhepCap {
  trai: Array<{ id: string; text: string; loai_xe: string }>;
  phai: Array<{ id: string; text: string }>;
}

export interface KetQuaGhepCap {
  dung: number;
  tong: number;
  xp?: number;
  chi_tiet: Array<{ id: string; dung: boolean; muc_phat_dung: string; citation_urn: string }>;
}

export const tongQuanTroChoi = (token: string) =>
  goiApiQuanTri<{
    vuot_man: ChuDeVuotMan[];
    dua_thoi_gian: KyLuc;
    ghep_cap: KyLuc;
    /** Trò cũ nào đang hiện cho người học (bảng games, GĐ-G0). */
    bat?: Record<string, boolean>;
  }>(token, "/v1/tro-choi");

export const banDoMan = (token: string, chuDe: string) =>
  goiApiQuanTri<{ chu_de: { id: string; code: string; name: string }; man: ManTrenBanDo[] }>(
    token,
    `/v1/tro-choi/vuot-man/${encodeURIComponent(chuDe)}`,
  );

export const batDauMan = (token: string, manId: string) =>
  goiApiQuanTri<{ id: string; man: number; tong: number }>(
    token,
    `/v1/tro-choi/vuot-man/man/${encodeURIComponent(manId)}/bat-dau`,
    { method: "POST" },
  );

export const batDauDua = (token: string, chuDe?: string) =>
  goiApiQuanTri<{ id: string; bat_dau: string; han: string; tong: number }>(
    token,
    "/v1/tro-choi/dua-thoi-gian/bat-dau",
    {
      body: chuDe ? { chu_de: chuDe } : {},
    },
  );

export const batDauGhepCap = (token: string, xe?: "o_to" | "mo_to") =>
  goiApiQuanTri<{ id: string; de: DeGhepCap }>(token, "/v1/tro-choi/ghep-cap/bat-dau", {
    body: xe ? { xe } : {},
  });

export const nopGhepCap = (token: string, id: string, cap: Record<string, string>) =>
  goiApiQuanTri<KetQuaGhepCap>(token, `/v1/tro-choi/ghep-cap/${encodeURIComponent(id)}/nop`, {
    body: { cap },
  });

export const kyLucDua = (token: string) => goiApiQuanTri<KyLuc>(token, "/v1/tro-choi/dua-thoi-gian");

/* Hỏi nhanh bằng giọng nói (docs/PLAN.md GĐ14): trả lời, kết thúc qua API luyện tập như đua thời gian. */
export const kyLucHoiNhanh = (token: string) =>
  goiApiQuanTri<KyLuc>(token, "/v1/tro-choi/hoi-nhanh-giong-noi");

export const batDauHoiNhanh = (token: string) =>
  goiApiQuanTri<{ id: string; tong: number }>(token, "/v1/tro-choi/hoi-nhanh-giong-noi/bat-dau", {
    body: {},
  });
