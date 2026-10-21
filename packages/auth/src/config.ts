/**
 * Cấu hình xác thực dùng chung cho mọi mặt tiền (web, API, MCP).
 *
 * Chỉ có MỘT ứng dụng OAuth trên Google Cloud Console, nên chỉ có một biến
 * GOOGLE_CLIENT_ID. Các biến còn lại từng mang tiền tố MCP_ vì lúc đầu chỉ MCP
 * server dùng; nay giữ lại tên cũ làm phương án dự phòng để cấu hình đang chạy
 * không hỏng khi nâng cấp.
 */
import { ROLES, type Role } from "./rbac.ts";

export interface AuthConfig {
  /** Client ID ứng dụng web trên Google Cloud Console. Rỗng = chưa cấu hình đăng nhập. */
  googleClientId: string;
  /** Chỉ nhận tài khoản thuộc các miền này. Rỗng = không giới hạn. */
  allowedDomains: string[];
  /** Vai trò cho tài khoản mới (sau người đầu tiên). */
  defaultRole: Role;
  /** Người đăng nhập đầu tiên có được làm quản trị hay không. */
  bootstrapAdmin: boolean;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Vai trò mặc định cho tài khoản mới; sai tên thì báo lỗi chứ không đoán. */
export function defaultRole(): Role {
  const raw = process.env.AUTH_DEFAULT_ROLE ?? process.env.MCP_DEFAULT_ROLE ?? "khach";
  if (!ROLES.includes(raw as Role)) {
    throw new Error(`AUTH_DEFAULT_ROLE không hợp lệ: ${raw}. Chọn một trong: ${ROLES.join(", ")}`);
  }
  return raw as Role;
}

/**
 * Cho phép người đăng nhập ĐẦU TIÊN của một kho trống trở thành quản trị.
 * Bật sẵn để hệ thống mới dựng có người quản trị mà không phải sửa CSDL bằng tay;
 * đặt AUTH_BOOTSTRAP_ADMIN=0 để tắt sau khi đã có quản trị.
 */
export function bootstrapAdminEnabled(): boolean {
  const raw = (process.env.AUTH_BOOTSTRAP_ADMIN ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off");
}

export function readAuthConfig(): AuthConfig {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    allowedDomains: list(process.env.AUTH_ALLOWED_DOMAINS ?? process.env.MCP_ALLOWED_DOMAINS),
    defaultRole: defaultRole(),
    bootstrapAdmin: bootstrapAdminEnabled(),
  };
}
