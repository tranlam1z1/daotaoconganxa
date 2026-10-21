/**
 * Gọi API lượt chơi thay người đang đăng nhập (docs/PLAN.md GĐ-G0). Token nằm trong cookie
 * HttpOnly, chỉ đọc ở máy chủ web.
 */
import { apiBase } from "./api";
import type { DanhMucTroChoi, HoSoChuDeWeb, KetQuaBuocWeb, LuotChoiWeb, TongQuanLuotChoi } from "./luot-choi";
import { goiApiQuanTri } from "./quan-tri.server";

export const tongQuanLuotChoi = (token: string) => goiApiQuanTri<TongQuanLuotChoi>(token, "/v1/luot-choi");

/** Danh mục trò đang bật cho người chưa đăng nhập (không gửi token). */
export async function danhMucTroChoi(): Promise<DanhMucTroChoi> {
  const res = await fetch(`${apiBase()}/v1/luot-choi/danh-muc`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Không tải được danh mục trò chơi (${res.status}).`);
  return (await res.json()) as DanhMucTroChoi;
}

/** Bắt đầu lượt mới. `man` chỉ dùng với trò có màn; vắng thì máy chủ chọn màn cao nhất đang mở. */
export const batDauLuot = (token: string, ma: string, man?: number | null) =>
  goiApiQuanTri<LuotChoiWeb>(token, `/v1/luot-choi/${encodeURIComponent(ma)}/bat-dau`, {
    body: man ? { man } : {},
  });

export const layLuot = (token: string, id: string) =>
  goiApiQuanTri<LuotChoiWeb>(token, `/v1/luot-choi/luot/${encodeURIComponent(id)}`);

export const traLoiBuoc = (token: string, id: string, thuTu: number, traLoi: unknown) =>
  goiApiQuanTri<{ thu_tu: number; ket_qua: KetQuaBuocWeb; con_buoc: boolean }>(
    token,
    `/v1/luot-choi/luot/${encodeURIComponent(id)}/buoc/${thuTu}`,
    { body: { tra_loi: traLoi } },
  );

export const ketThucLuot = (token: string, id: string) =>
  goiApiQuanTri<LuotChoiWeb>(token, `/v1/luot-choi/luot/${encodeURIComponent(id)}/ket-thuc`, { body: {} });

export const hoSoChuDe = (token: string) => goiApiQuanTri<HoSoChuDeWeb>(token, "/v1/toi/ho-so-chu-de");
