/**
 * Gọi API nhóm học cùng thay người đang đăng nhập (docs/PLAN.md GĐ16b). Token phiên nằm trong
 * cookie HttpOnly nên mọi lời gọi đi qua máy chủ web (loader, action của React Router).
 */
import type {
  ChiTietNhom,
  NguonBaiHoc,
  NguonChuDe,
  NhomTomTat,
  TienDoCuaThanhVien,
  XemTruocNhom,
} from "./nhom";
import { goiApiQuanTri } from "./quan-tri.server";

const ma = (s: string) => encodeURIComponent(s);
const nhom = (id: string) => `/v1/nhom/${ma(id)}`;

export const nhomCuaToi = (token: string) => goiApiQuanTri<{ items: NhomTomTat[] }>(token, "/v1/nhom");

export const taoNhom = (token: string, body: { ten: string; mo_ta?: string }) =>
  goiApiQuanTri<{ id: string; ten: string; ma_moi: string }>(token, "/v1/nhom", { body });

export const xemTruocNhom = (token: string, maMoi: string) =>
  goiApiQuanTri<XemTruocNhom>(token, `/v1/nhom/ma/${ma(maMoi)}`);

export const thamGiaNhom = (token: string, maMoi: string) =>
  goiApiQuanTri<{ id: string }>(token, "/v1/nhom/tham-gia", { body: { ma: maMoi } });

export const chiTietNhom = (token: string, id: string) => goiApiQuanTri<ChiTietNhom>(token, nhom(id));

export const suaNhom = (token: string, id: string, body: { ten?: string; mo_ta?: string | null }) =>
  goiApiQuanTri<ChiTietNhom>(token, nhom(id), { method: "PATCH", body });

export const doiMaMoi = (token: string, id: string) =>
  goiApiQuanTri<{ ma_moi: string }>(token, `${nhom(id)}/ma-moi`, { method: "POST" });

export const roiNhom = (token: string, id: string) =>
  goiApiQuanTri<{ trang_thai_nhom: string }>(token, `${nhom(id)}/roi`, { method: "POST" });

export const moiRaKhoiNhom = (token: string, id: string, accountId: string) =>
  goiApiQuanTri(token, `${nhom(id)}/thanh-vien/${ma(accountId)}/moi-ra`, { method: "POST" });

export const chuyenTruongNhom = (token: string, id: string, accountId: string) =>
  goiApiQuanTri(token, `${nhom(id)}/thanh-vien/${ma(accountId)}/truong-nhom`, { method: "POST" });

export const tienDoThanhVien = (token: string, id: string, accountId: string) =>
  goiApiQuanTri<TienDoCuaThanhVien>(token, `${nhom(id)}/thanh-vien/${ma(accountId)}/tien-do`);

export const nguonBaiHoc = (token: string, q: string) =>
  goiApiQuanTri<{ items: NguonBaiHoc[] }>(token, `/v1/nhom/nguon?loai=bai_hoc&q=${ma(q)}`);

export const nguonChuDe = (token: string, q: string) =>
  goiApiQuanTri<{ items: NguonChuDe[] }>(token, `/v1/nhom/nguon?loai=chu_de&q=${ma(q)}`);

export const chiaSeMuc = (
  token: string,
  id: string,
  body:
    | { loai: "bai_hoc"; lesson_id: string }
    | { loai: "de_on_tap"; topic_id: string; so_cau: number; ten: string },
) => goiApiQuanTri<{ id: string }>(token, `${nhom(id)}/muc`, { body });

export const goMuc = (token: string, id: string, itemId: string) =>
  goiApiQuanTri(token, `${nhom(id)}/muc/${ma(itemId)}`, { method: "DELETE" });

export const sapThuTu = (token: string, id: string, itemIds: string[]) =>
  goiApiQuanTri(token, `${nhom(id)}/muc/thu-tu`, { method: "PUT", body: { item_ids: itemIds } });

export const datHanGoiY = (token: string, id: string, itemId: string, han: string | null) =>
  goiApiQuanTri(token, `${nhom(id)}/muc/${ma(itemId)}`, { method: "PATCH", body: { han_goi_y: han } });

export const batDauMuc = (token: string, id: string, itemId: string) =>
  goiApiQuanTri<
    | { loai: "bai_hoc"; duong_dan: string }
    | { loai: "de_on_tap"; phien_id: string; tong: number; da_co: boolean }
  >(token, `${nhom(id)}/muc/${ma(itemId)}/bat-dau`, { method: "POST" });

export const coVu = (token: string, id: string, accountId: string) =>
  goiApiQuanTri<{ da_co_vu: boolean; tong: number }>(token, `${nhom(id)}/co-vu/${ma(accountId)}`, {
    method: "POST",
  });

export const luuTruNhom = (token: string, id: string) =>
  goiApiQuanTri(token, `${nhom(id)}/luu-tru`, { method: "POST" });
