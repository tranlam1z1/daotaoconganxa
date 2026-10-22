/** Cấu hình dùng chung của trang: tên, điều hướng, tiêu đề thẻ. */

import type { IconName } from "../components/ui/Icon";

/**
 * Dòng chữ chữ nhận diện (docs/brand): "HỌC TẬP PHÁP LUẬT & BỒI DƯỠNG NGHIỆP VỤ".
 * Dùng ở logo đầu trang, trang đăng nhập/đăng ký và chân trang.
 */
export const SITE_NAME = "Học tập pháp luật & Bồi dưỡng nghiệp vụ";
/** Dòng chữ nhỏ dưới tên trang ở logo đầu trang. */
export const SITE_TAGLINE = "Cấp xã tỉnh Thanh Hóa";
/** Tên rút gọn dùng cho tiêu đề thẻ (tránh tiêu đề quá dài). */
export const SITE_NAME_SHORT = "Học tập pháp luật";

export interface NavItem {
  to: string;
  label: string;
  /** Các tiền tố đường dẫn cũng tính là đang ở mục này (ngoài chính `to`). */
  khop?: string[];
}

/**
 * Menu của cán bộ tối đa 4 mục (docs/PLAN.md §0.4): ba mục dưới đây cộng mục "Tôi" do
 * SiteHeader dựng theo trạng thái đăng nhập. Hỏi đáp, đọc văn bản nằm trong mục Tra cứu.
 * Các trang ngoài phạm vi (trường hợp ứng dụng, so sánh, đào tạo cũ) vẫn giữ route, chỉ ẩn khỏi menu.
 */
export const MAIN_NAV: NavItem[] = [
  { to: "/tra-cuu", label: "Tra cứu", khop: ["/tim-kiem", "/van-ban", "/hoi-dap", "/tra-cuu-nhanh"] },
  // Bài giảng gộp vào mục này (docs/PLAN.md GĐ11) để menu vẫn chỉ có 4 mục. Nhóm học cùng
  // (GĐ16b) cũng thuộc mục này; trên điện thoại có thêm một dòng trong ngăn "Thêm" (câu N1).
  { to: "/luyen-tap", label: "Học & luyện tập", khop: ["/hoc", "/dao-tao", "/nhom"] },
  { to: "/thi", label: "Thi" },
];

/* ------------------------------------------------------------------ */
/* Điều hướng điện thoại (dưới 768px): thanh dưới cùng + ngăn tiện ích   */
/* ------------------------------------------------------------------ */

export interface MobileNavItem extends NavItem {
  icon: IconName;
}

/**
 * Thanh dưới cùng: Tra cứu · Học · Trang chủ · Thi · Tôi. Trang chủ đứng giữa, hiện dạng nút tròn
 * nổi có logo (BottomNav). "Tôi" luôn dẫn tới /toi; chưa đăng nhập thì trang đó chuyển sang /dang-nhap.
 */
export const BOTTOM_NAV: MobileNavItem[] = [
  { ...MAIN_NAV[0]!, icon: "search" },
  { ...MAIN_NAV[1]!, label: "Học", icon: "cap" },
  { to: "/", label: "Trang chủ", icon: "home" },
  { ...MAIN_NAV[2]!, icon: "steps" },
  {
    to: "/toi",
    label: "Tôi",
    icon: "user",
    khop: ["/tai-khoan", "/doi-mat-khau", "/dang-nhap", "/dang-ky"],
  },
];

/**
 * Mục tiện ích trên điện thoại, nằm trong ngăn bên phải ở trang chủ (NganTienIch). `quanLy`: chỉ hiện với cán bộ
 * quản lý trở lên.
 */
export const MORE_NAV: Array<MobileNavItem & { quanLy?: boolean }> = [
  { to: "/hoi-dap", label: "Hỏi trợ lý AI", icon: "chat" },
  { to: "/nhom", label: "Nhóm học cùng", icon: "nhom" },
  { to: "/huong-dan", label: "Hướng dẫn sử dụng", icon: "help" },
  { to: "/quan-tri", label: "Quản trị", icon: "layers", quanLy: true },
];

/** Vai trò từ cán bộ quản lý trở lên (khớp thứ tự trong session.server.ts). */
const VAI_TRO_QUAN_LY = ["quan_ly", "bien_tap", "phap_che", "quan_tri"];
export function laQuanLy(vaiTro: string | undefined): boolean {
  return Boolean(vaiTro && VAI_TRO_QUAN_LY.includes(vaiTro));
}

/**
 * Thanh dưới cùng chỉ có ở trang chủ. Các trang khác nhường chỗ cho nội dung và có nút quay lại ở
 * đầu trang.
 */
export function coThanhDuoi(pathname: string): boolean {
  return pathname === "/";
}

/** Khu quản trị có cột điều hướng cố định ở mép trái (từ 1024px): chân trang, biểu ngữ lùi vào theo. */
export function coCotTrai(pathname: string): boolean {
  return pathname === "/quan-tri" || pathname.startsWith("/quan-tri/");
}

/**
 * Trang đăng nhập, đăng ký tự hiện logo và tên ở giữa: ẩn thanh đầu trang trên điện thoại (dưới
 * 768px).
 */
const AN_DAU_TRANG_DIEN_THOAI = ["/dang-nhap", "/dang-ky"];
export function anDauTrangDienThoai(pathname: string): boolean {
  return AN_DAU_TRANG_DIEN_THOAI.includes(pathname.replace(/\/+$/, "") || "/");
}

/** Trang gốc của điện thoại: header hiện tên trang web thay cho nút quay lại. Chỉ trang chủ. */
export function laTrangGoc(pathname: string): boolean {
  return (pathname.replace(/\/+$/, "") || "/") === "/";
}

/** Mục menu có đang được chọn với đường dẫn hiện tại không. */
export function dangOMuc(item: NavItem, pathname: string): boolean {
  return [item.to, ...(item.khop ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Thẻ meta chuẩn của một trang. `index: false` cho trang không cần lập chỉ mục. */
export function pageMeta(title: string, opts: { description?: string; index?: boolean } = {}) {
  return [
    { title: `${title} | ${SITE_NAME_SHORT}` },
    ...(opts.description ? [{ name: "description", content: opts.description }] : []),
    ...(opts.index === false ? [{ name: "robots", content: "noindex,nofollow" }] : []),
  ];
}
