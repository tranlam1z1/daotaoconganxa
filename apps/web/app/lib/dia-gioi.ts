/**
 * Gọi API chuyển đổi địa giới hành chính (apps/api/src/routes/dia-gioi.ts) và lưu lịch sử tra cứu trên
 * máy. Kiểu dữ liệu khớp packages/dao-tao/src/dia-gioi.ts.
 */
import { apiBase } from "./api";

export const DUONG_DIA_GIOI = "/cong-cu/dia-gioi-hanh-chinh";

export interface DonVi {
  ma: string;
  ten: string;
}
export interface XaMoi extends DonVi {
  tinh: string;
}
export interface HuyenCu extends DonVi {
  tinh: string;
  moi?: string[];
}
export interface XaCu extends DonVi {
  huyen: string;
  moi: string[];
}

/** Một dòng phương án sắp xếp thôn: các thôn cũ (ghi như nguồn) thành thôn `moi`. */
export interface DongThon {
  cu: string[];
  moi: string;
}
export interface KetQuaThon {
  canCu: string;
  dong: DongThon[];
}

export type KetQuaChuyenDoi =
  | {
      muc: "xa";
      xaCu: XaCu;
      huyenCu: HuyenCu;
      tinhCu: DonVi;
      /**
       * `thon` chỉ có khi gửi tên thôn: các dòng sắp xếp có thôn cũ đó trong xã mới kèm căn cứ; null khi
       * chưa có dữ liệu thôn của xã, `dong` rỗng khi không thấy tên.
       */
      moi: Array<{ xa: XaMoi; tinh: DonVi; thon?: KetQuaThon | null }>;
      biChia: boolean;
    }
  | { muc: "huyen"; huyenCu: HuyenCu; tinhCu: DonVi; tinhMoi: DonVi[]; xaMoi: XaMoi[] }
  | { muc: "tinh"; tinhCu: DonVi; tinhMoi: DonVi[]; hopNhatVoi: DonVi[] };

export interface KetQuaTraNguoc {
  xaMoi: XaMoi;
  tinhMoi: DonVi;
  xaCu: Array<{ xa: XaCu; huyen: HuyenCu; tinh: DonVi; motPhan: boolean }>;
  huyenCu: Array<{ huyen: HuyenCu; tinh: DonVi }>;
}

/**
 * Địa chỉ theo đơn vị trước sắp xếp tại một vị trí. Xã cũ đối chiếu theo tên đơn vị OpenStreetMap ghi
 * tại vị trí và tên nêu trong địa chỉ gõ; chưa xác định được thì `xa` trống, `coThe` là các xã cũ đã
 * nhập vào xã mới.
 */
export interface DiaChiCu {
  xa: XaCu | null;
  /** Huyện, tỉnh cũ: có khi đã rõ xã cũ, hoặc mọi đơn vị cũ nhập vào xã mới cùng huyện, cùng tỉnh. */
  huyen: HuyenCu | null;
  tinh: DonVi | null;
  coThe: Array<{ xa: XaCu; huyen: HuyenCu }>;
  /** Khi chưa rõ xã cũ: xã cũ có tâm gần vị trí nhất, chỉ là ước lượng; null khi không ước lượng được. */
  ganNhat: { xa: XaCu; huyen: HuyenCu; tinh: DonVi | null } | null;
  /** Ghép theo xã cũ đã rõ, hoặc theo `ganNhat` (khi đó là ước lượng). */
  diaChiDayDu: string | null;
}

/**
 * Địa chỉ tại một vị trí (POST /vi-tri, /dia-chi): xã, tỉnh theo ranh giới của hệ thống; số nhà, tên
 * đường theo OpenStreetMap.
 */
export interface DiaChiBanDo {
  lat: number;
  lon: number;
  soNha: string | null;
  tenDuong: string | null;
  xa: XaMoi | null;
  tinh: DonVi | null;
  /** Vị trí ở khe giữa các ranh nên lấy xã có ranh gần nhất. */
  ganRanh: boolean;
  /** Ranh giới xã (MultiPolygon, [kinh độ, vĩ độ]) để vẽ bản đồ; chỉ có ở /vi-tri. */
  ranhGioi: Array<Array<Array<[number, number]>>> | null;
  diaChiDayDu: string | null;
  /** Địa chỉ theo đơn vị cũ; null khi không xác định được xã mới. */
  cu: DiaChiCu | null;
  ghiChu: string | null;
}

export interface NguonDuLieu {
  phienBan: string;
  nguon: Array<{ ten: string; url: string; giayPhep: string; ghiChu: string }>;
}

/**
 * Lỗi API có mã: 404 (không có đơn vị, vị trí ngoài vùng có ranh giới), 501 (chưa kết nối dịch vụ bản
 * đồ), 503 (dịch vụ bản đồ không phản hồi)…
 */
export class LoiDiaGioi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function goi<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const res = await fetch(`${apiBase()}/v1/dia-gioi${path}`, {
    method: init?.method ?? "GET",
    headers: { accept: "application/json", ...(init ? { "content-type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const loi = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new LoiDiaGioi(
      res.status,
      loi?.error?.code ?? "loi_may_chu",
      loi?.error?.message ?? `API ${path} trả về ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

const items = async <T>(path: string) => (await goi<{ items: T[] }>(path)).items;
const m = encodeURIComponent;

export const dsTinhCu = () => items<DonVi>("/cu/tinh");
export const dsHuyenCu = (tinh: string) => items<HuyenCu>(`/cu/tinh/${m(tinh)}/huyen`);
export const dsXaCu = (huyen: string) => items<XaCu>(`/cu/huyen/${m(huyen)}/xa`);
export const dsTinhMoi = () => items<DonVi>("/moi/tinh");
export const dsXaMoi = (tinh: string) => items<XaMoi>(`/moi/tinh/${m(tinh)}/xa`);
export const layNguon = () => goi<NguonDuLieu>("/nguon");

export function chuyenDoi(q: { tinh: string; huyen?: string; xa?: string; thon?: string }) {
  const p = new URLSearchParams({ tinh: q.tinh });
  if (q.huyen) p.set("huyen", q.huyen);
  if (q.xa) p.set("xa", q.xa);
  if (q.thon) p.set("thon", q.thon);
  return goi<KetQuaChuyenDoi>(`/chuyen-doi?${p}`);
}

export function timXaMoi(q: string, tinh?: string) {
  const p = new URLSearchParams({ q });
  if (tinh) p.set("tinh", tinh);
  return items<{ xa: XaMoi; tinh: DonVi }>(`/moi/tim?${p}`);
}

export const traNguoc = (xa: string) => goi<KetQuaTraNguoc>(`/moi/xa/${m(xa)}`);

export const viTriRaDiaChi = (lat: number, lon: number) =>
  goi<DiaChiBanDo>("/vi-tri", { method: "POST", body: { lat, lon } });

export const diaChiRaViTri = async (q: string) =>
  (await goi<{ items: DiaChiBanDo[] }>("/dia-chi", { method: "POST", body: { q } })).items;

/** Các phần địa chỉ (bỏ phần trống) nối bằng dấu phẩy. */
export function noiDiaChi(...phan: Array<string | null | undefined>): string {
  return phan
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

/* ------------------------------------------------------------------ */
/* Lịch sử tra cứu (chỉ trên máy đang dùng)                            */
/* ------------------------------------------------------------------ */

const KHOA_LICH_SU = "lich-su-dia-gioi";
const SO_LICH_SU = 10;

/** Một lần tra: nhãn (đơn vị cũ → mới), đường dẫn mở lại, lúc tra (ms). */
export interface MucLichSuDiaGioi {
  nhan: string;
  phu: string;
  href: string;
  luc: number;
}

/** Đọc lịch sử. Bộ nhớ trình duyệt có thể bị chặn nên luôn bọc try/catch. */
export function docLichSuDiaGioi(): MucLichSuDiaGioi[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KHOA_LICH_SU) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is MucLichSuDiaGioi =>
          x &&
          typeof x.nhan === "string" &&
          typeof x.phu === "string" &&
          typeof x.href === "string" &&
          x.href.startsWith(DUONG_DIA_GIOI) &&
          typeof x.luc === "number",
      )
      .slice(0, SO_LICH_SU);
  } catch {
    return [];
  }
}

export function ghiLichSuDiaGioi(ds: MucLichSuDiaGioi[]) {
  try {
    if (ds.length) localStorage.setItem(KHOA_LICH_SU, JSON.stringify(ds.slice(0, SO_LICH_SU)));
    else localStorage.removeItem(KHOA_LICH_SU);
  } catch {
    // Không lưu được thì lịch sử chỉ giữ trong phiên hiện tại.
  }
}

/** Thêm một lần tra lên đầu, bỏ bản cũ cùng đường dẫn. */
export function themLichSuDiaGioi(muc: Omit<MucLichSuDiaGioi, "luc">): MucLichSuDiaGioi[] {
  const moi = [{ ...muc, luc: Date.now() }, ...docLichSuDiaGioi().filter((x) => x.href !== muc.href)];
  ghiLichSuDiaGioi(moi);
  return moi.slice(0, SO_LICH_SU);
}
