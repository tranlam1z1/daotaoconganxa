/**
 * Phân quyền theo vai trò ở máy chủ web.
 *
 * Ẩn/hiện nút trên giao diện chỉ để cho gọn; API luôn kiểm quyền lại. Hàm ở đây ném Response
 * (chuyển hướng hoặc 403) chứ không ném Error, để trạng thái trả về đúng nghĩa.
 */
import { redirect } from "react-router";

import { docPhienHienTai, layToken, type NguoiDung } from "./auth.server";

/**
 * Thứ tự vai trò từ thấp lên cao, khớp với ROLES trong packages/auth/src/rbac.ts.
 *
 * Web không import được @qdpl/auth (gói đó kéo theo @qdpl/db — chỉ chạy ở server Node/Bun,
 * không dựng được vào gói React Router), nên thang này là bản sao. Sửa thang ở đây thì
 * sửa cả hai bên cùng lúc.
 */
const VAI_TRO_THU_TU = ["khach", "can_bo", "lanh_dao", "quan_ly", "quan_tri"] as const;
export type VaiTro = (typeof VAI_TRO_THU_TU)[number];
const TEN_VAI_TRO: Record<VaiTro, string> = {
  khach: "Khách",
  can_bo: "Cán bộ, công chức",
  lanh_dao: "Lãnh đạo UBND xã",
  quan_ly: "Admin quản lý",
  quan_tri: "Admin quản trị hệ thống",
};

export function duVaiTro(nguoiDung: Pick<NguoiDung, "vai_tro"> | null, can: VaiTro): boolean {
  if (!nguoiDung) return false;
  return VAI_TRO_THU_TU.indexOf(nguoiDung.vai_tro as VaiTro) >= VAI_TRO_THU_TU.indexOf(can);
}

/**
 * URL trang người dùng đang xem. Có `v8_passThroughRequests`, khi chuyển trang phía trình duyệt
 * `request.url` là URL dữ liệu (`/luyen-tap.data?_routes=…`), không phải trang thật: bỏ đuôi
 * `.data` và tham số nội bộ của React Router (cùng quy tắc với `v8_trailingSlashAwareDataRequests`).
 */
export function urlTrang(request: Request): URL {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/_.data")) url.pathname = url.pathname.slice(0, -"_.data".length);
  else if (url.pathname.endsWith(".data")) url.pathname = url.pathname.slice(0, -".data".length);
  url.searchParams.delete("_routes");
  // `?index` trống do React Router thêm khi gửi form tới route index.
  if (url.searchParams.get("index") === "") url.searchParams.delete("index");
  return url;
}

/** Đường dẫn đăng nhập kèm trang quay lại sau khi đăng nhập xong. */
export function duongDangNhap(request: Request): string {
  const url = urlTrang(request);
  return `/dang-nhap?tiep=${encodeURIComponent(url.pathname + url.search)}`;
}

/**
 * Bắt buộc đăng nhập bằng tài khoản đã được xác minh cán bộ; trả về danh tính và token phiên để gọi
 * API thay người dùng. Chưa đăng nhập thì chuyển tới trang đăng nhập, xong quay lại đúng trang này.
 * Mọi trang học, luyện tập và thi đều đi qua đây.
 *
 * Tài khoản chưa được xác minh (chờ duyệt hoặc bị từ chối) chỉ dùng được trang Tài khoản: API từ
 * chối mọi việc khác, nên chuyển về đó xem trạng thái xét duyệt. Trang Tài khoản và đổi mật khẩu
 * truyền `choPhepChoXacMinh`.
 */
export async function yeuCauDangNhap(
  request: Request,
  { choPhepChoXacMinh = false }: { choPhepChoXacMinh?: boolean } = {},
): Promise<{ token: string; nguoiDung: NguoiDung }> {
  const token = layToken(request);
  if (!token) throw redirect(duongDangNhap(request));
  const phien = await docPhienHienTai(request);
  if (phien.trangThaiPhien === "tam_loi") {
    throw new Response("Chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại sau.", { status: 503 });
  }
  const { nguoiDung } = phien;
  if (!nguoiDung) throw redirect(duongDangNhap(request));
  if (nguoiDung.cho_xac_minh && !choPhepChoXacMinh) throw redirect("/tai-khoan?can-xac-minh=1");
  return { token, nguoiDung };
}

/** Bắt buộc đăng nhập và có vai trò tối thiểu `can`; thiếu quyền trả 403. */
export async function yeuCauVaiTro(request: Request, can: VaiTro) {
  const phien = await yeuCauDangNhap(request);
  if (!duVaiTro(phien.nguoiDung, can)) {
    throw new Response(
      `Tài khoản có vai trò "${phien.nguoiDung.mo_ta_vai_tro}", trang này cần vai trò ${TEN_VAI_TRO[can]} trở lên.`,
      {
        status: 403,
        statusText: "Forbidden",
      },
    );
  }
  return phien;
}
