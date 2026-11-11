/**
 * Đăng nhập Google (GIS) phía máy chủ web.
 *
 * Vì sao trình duyệt không nói chuyện thẳng với API: token phiên phải nằm trong cookie
 * HttpOnly để JavaScript của trang (và mọi mã lạ chèn vào trang) không đọc được. Web và API
 * chạy ở hai cổng khác nhau nên cookie không dùng chung được; máy chủ web đứng giữa, nhận
 * ID token từ nút GIS, đổi lấy token phiên ở API rồi tự đặt cookie trên miền của mình.
 *
 * Tệp có hậu tố `.server` nên không bao giờ bị gói vào mã chạy trên trình duyệt.
 */

import { apiBase } from "./api";
import type { PhienHienThi } from "./phien-hien-thi";
import type { DonViChon, NguoiDung } from "./types";

export type { NguoiDung };

/** Tên cookie giữ token phiên. Đổi tên = mọi người phải đăng nhập lại. */
export const COOKIE_PHIEN = "qdpl_phien";

export interface KetQuaDangNhap {
  token: string;
  het_han: string;
  email: string;
  ten: string | null;
  vai_tro: string;
  mo_ta_vai_tro: string;
  la_quan_tri: boolean;
  la_quan_tri_dau_tien: boolean;
  /** Chỉ có ở đăng nhập bằng mật khẩu: true khi đang dùng mật khẩu tạm. */
  phai_doi_mat_khau?: boolean;
  /** true khi tiến độ của một tài khoản khách cũ trên máy này vừa được gộp vào tài khoản. */
  da_gop_khach?: boolean;
}

export interface CauHinhDangNhap {
  google_client_id: string;
  da_cau_hinh: boolean;
  mien_gioi_han: string[] | null;
  vai_tro_mac_dinh: string;
  /** Có bật đăng nhập tài khoản demo bằng mật khẩu (AUTH_DEMO_PASSWORD) hay không. */
  demo: boolean;
}

/** Lỗi đăng nhập đã có thông báo tiếng Việt sẵn sàng hiển thị cho người dùng. */
export class LoiDangNhap extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "LoiDangNhap";
  }
}

async function goiApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { accept: "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new LoiDangNhap(data?.error?.message ?? `API ${path} trả về ${res.status}`, res.status);
  }
  return data as T;
}

export function layToken(request: Request): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const phan of raw.split(";")) {
    const [ten, ...gia_tri] = phan.trim().split("=");
    if (ten === COOKIE_PHIEN) return decodeURIComponent(gia_tri.join("="));
  }
  return null;
}

/**
 * Cookie chỉ đặt Secure khi thật sự chạy trên HTTPS: đặt cứng thì bản dev ở
 * http://127.0.0.1 sẽ không bao giờ giữ được phiên. Sau reverse proxy nhận HTTPS (Traefik), máy chủ
 * web chỉ thấy http, nên xét thêm X-Forwarded-Proto do proxy ghi.
 */
export function thuocTinhCookie(request: Request): string {
  const https =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  return `Path=/; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
}

export function cookieDangNhap(request: Request, token: string, hetHan: string): string {
  const maxAge = Math.max(60, Math.floor((new Date(hetHan).getTime() - Date.now()) / 1000));
  return `${COOKIE_PHIEN}=${encodeURIComponent(token)}; ${thuocTinhCookie(request)}; Max-Age=${maxAge}`;
}

export function cookieDangXuat(request: Request): string {
  return `${COOKIE_PHIEN}=; ${thuocTinhCookie(request)}; Max-Age=0`;
}

/** Cấu hình để dựng nút GIS. Không lấy được API thì coi như chưa cấu hình, trang tự báo. */
export async function cauHinhDangNhap(): Promise<CauHinhDangNhap> {
  try {
    return await goiApi<CauHinhDangNhap>("/v1/auth/config");
  } catch {
    return {
      google_client_id: "",
      da_cau_hinh: false,
      mien_gioi_han: null,
      vai_tro_mac_dinh: "khach",
      demo: false,
    };
  }
}

/** Đổi ID token của Google lấy token phiên. Ném LoiDangNhap kèm thông báo hiển thị được. */
export async function doiIdTokenLayPhien(
  credential: string,
  tokenKhach?: string | null,
): Promise<KetQuaDangNhap> {
  return await goiApi<KetQuaDangNhap>("/v1/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential, client: "web", token_khach: tokenKhach ?? undefined }),
  });
}

/**
 * Đăng nhập tài khoản cán bộ bằng tên đăng nhập và mật khẩu. Ném LoiDangNhap với thông báo
 * của API: sai thông tin (401), tài khoản bị khóa (403), khóa tạm vì sai nhiều lần (429).
 */
export async function dangNhapMatKhau(
  tenDangNhap: string,
  matKhau: string,
  tokenKhach?: string | null,
): Promise<KetQuaDangNhap> {
  return await goiApi<KetQuaDangNhap>("/v1/auth/mat-khau", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ten_dang_nhap: tenDangNhap,
      mat_khau: matKhau,
      client: "web",
      token_khach: tokenKhach ?? undefined,
    }),
  });
}

/** Thông tin khai để được xác minh cán bộ; dùng khi đăng ký và khi khai lại ở trang Tài khoản. */
export interface KhaiBaoXacMinh {
  so_hieu: string;
  don_vi_id: string;
  cap_bac_chuc_vu?: string;
  so_dien_thoai: string;
  /** Nơi sinh hoạt Đảng; rỗng nếu không khai. */
  don_vi_dang_id?: string;
}

/**
 * Tự đăng ký tài khoản rồi đăng nhập luôn; tài khoản chờ xác minh cán bộ. Ném LoiDangNhap với thông
 * báo của API: dữ liệu không hợp lệ (400), email đã có tài khoản (409), quá nhiều lượt đăng ký (429).
 */
export async function dangKyTaiKhoan(
  duLieu: KhaiBaoXacMinh & {
    ten: string;
    email: string;
    mat_khau: string;
  },
  tokenKhach?: string | null,
): Promise<KetQuaDangNhap> {
  return await goiApi<KetQuaDangNhap>("/v1/auth/dang-ky", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...duLieu, client: "web", token_khach: tokenKhach ?? undefined }),
  });
}

/** Đơn vị đang hoạt động để chọn đơn vị công tác. API trục trặc thì trả danh sách rỗng. */
export async function danhSachDonViChon(): Promise<DonViChon[]> {
  try {
    return (await goiApi<{ items: DonViChon[] }>("/v1/auth/don-vi")).items;
  } catch {
    return [];
  }
}

/** Khai lại thông tin xác minh (sau khi bị từ chối, hoặc tài khoản Google chưa khai). */
export async function khaiXacMinh(token: string, khai: KhaiBaoXacMinh): Promise<void> {
  await goiApi("/v1/auth/xac-minh", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(khai),
  });
}

/** Đổi mật khẩu của người đang đăng nhập. Ném LoiDangNhap khi mật khẩu cũ sai hoặc mật khẩu mới yếu. */
export async function doiMatKhau(token: string, matKhauCu: string, matKhauMoi: string): Promise<void> {
  await goiApi("/v1/auth/doi-mat-khau", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ mat_khau_cu: matKhauCu, mat_khau_moi: matKhauMoi }),
  });
}

/** Đặt ảnh đại diện mới (PNG, JPEG, WebP, tối đa 2 MB). Ném LoiDangNhap khi ảnh không hợp lệ. */
export async function doiAnhDaiDien(token: string, tep: File): Promise<void> {
  const form = new FormData();
  form.set("tep", tep);
  await goiApi("/v1/toi/anh-dai-dien", {
    method: "PUT",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
}

/** Bỏ ảnh đại diện, quay về chữ cái đầu của tên. */
export async function xoaAnhDaiDien(token: string): Promise<void> {
  await goiApi("/v1/toi/anh-dai-dien", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
}

/** Đăng nhập tài khoản demo bằng mật khẩu chung. Ném LoiDangNhap khi sai mật khẩu hoặc demo đang tắt. */
export async function dangNhapDemo(
  matKhau: string,
  vaiTro: "hoc_vien" | "quan_tri",
  tokenKhach?: string | null,
): Promise<KetQuaDangNhap> {
  return await goiApi<KetQuaDangNhap>("/v1/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mat_khau: matKhau,
      vai_tro: vaiTro,
      client: "web-demo",
      token_khach: tokenKhach ?? undefined,
    }),
  });
}

/** Phân biệt phiên không hợp lệ với lỗi tạm thời để header không báo đăng xuất nhầm. */
export async function docPhienHienTai(request: Request): Promise<PhienHienThi> {
  const token = layToken(request);
  if (!token) return { nguoiDung: null, trangThaiPhien: "khach" };
  try {
    const nguoiDung = await goiApi<NguoiDung>("/v1/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!nguoiDung || typeof nguoiDung.email !== "string")
      return { nguoiDung: null, trangThaiPhien: "tam_loi" };
    return { nguoiDung, trangThaiPhien: "hop_le" };
  } catch (error) {
    const biTuChoi = error instanceof LoiDangNhap && (error.status === 401 || error.status === 403);
    return { nguoiDung: null, trangThaiPhien: biTuChoi ? "khach" : "tam_loi" };
  }
}

/** Các loader bảo vệ vẫn chỉ nhận danh tính vừa được API xác nhận. */
export async function nguoiDungHienTai(request: Request): Promise<NguoiDung | null> {
  return (await docPhienHienTai(request)).nguoiDung;
}

export async function thuHoiPhien(token: string): Promise<void> {
  try {
    await goiApi("/v1/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    // Token đã hỏng hoặc API không trả lời: cookie vẫn bị xóa ở bước sau, người dùng vẫn thoát được.
  }
}

/** Cấp token mới để dán vào cấu hình MCP client. */
export async function capTokenMcp(token: string): Promise<{ token: string; het_han: string }> {
  return await goiApi("/v1/auth/mcp-token", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}
