/** Công cụ QUẢN TRỊ: quản lý tài khoản và vai trò. Chỉ vai trò quan_tri dùng được. */

import {
  listAccounts,
  ROLE_LABEL,
  ROLES,
  type Role,
  revokeAllForEmail,
  setEnabled,
  setRole,
} from "@qdpl/auth";
import { z } from "zod";
import { errorResult, result, ToolError } from "../context.ts";
import type { ToolRegistrar } from "../registrar.ts";
import { writeEnabled } from "./van-hanh.ts";

export function registerAdminTools(reg: ToolRegistrar): void {
  const principal = reg.principal;
  reg.add(
    "quan_ly_tai_khoan",
    {
      title: "Quản lý tài khoản và vai trò",
      description:
        "Xem danh sách tài khoản, đổi vai trò, khóa hoặc mở khóa tài khoản, thu hồi phiên đăng nhập. " +
        "Vai trò: khach < can_bo < lanh_dao < quan_ly < quan_tri.",
      inputSchema: {
        hanh_dong: z.enum(["liet_ke", "doi_vai_tro", "khoa", "mo_khoa", "thu_hoi_phien"]),
        email: z.string().email().optional().describe("Bắt buộc với mọi hành động trừ liet_ke."),
        vai_tro: z.enum(ROLES).optional().describe("Bắt buộc khi hành động là doi_vai_tro."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        if (args.hanh_dong === "liet_ke") {
          const rows = await listAccounts();
          if (!rows.length) return result("Chưa có tài khoản nào đăng nhập.", { so_luong: 0, tai_khoan: [] });
          const lines = rows.map(
            (r: any) =>
              `- ${r.email}${r.name ? ` (${r.name})` : ""}\n  vai trò: ${r.role} — ${ROLE_LABEL[r.role as Role]}` +
              `${r.enabled ? "" : " [ĐÃ KHÓA]"}${r.hosted_domain ? ` | miền: ${r.hosted_domain}` : ""}` +
              `${r.last_login_at ? ` | đăng nhập gần nhất: ${new Date(r.last_login_at).toISOString().slice(0, 16).replace("T", " ")}` : ""}`,
          );
          return result(`${rows.length} tài khoản:\n${lines.join("\n")}`, {
            so_luong: rows.length,
            tai_khoan: rows,
          });
        }

        if (!writeEnabled()) {
          throw new ToolError(
            "Server đang chạy chế độ chỉ đọc nên không đổi được tài khoản. Đặt QDPL_MCP_ALLOW_WRITE=1.",
          );
        }
        if (!args.email) throw new ToolError("Thiếu email.");
        const actor = principal.email;

        if (args.hanh_dong === "doi_vai_tro") {
          if (!args.vai_tro) throw new ToolError("Thiếu vai_tro.");
          if (args.email === actor && args.vai_tro !== "quan_tri") {
            // Tránh tự hạ quyền rồi mất đường quản trị.
            throw new ToolError(
              "Không thể tự hạ vai trò của chính mình. Nhờ một quản trị viên khác thực hiện.",
            );
          }
          const row = await setRole(args.email, args.vai_tro, actor);
          return result(`Đã đặt vai trò của ${row.email} thành "${row.role}" (${ROLE_LABEL[row.role]}).`, {
            tai_khoan: row,
          });
        }
        if (args.hanh_dong === "khoa" || args.hanh_dong === "mo_khoa") {
          const enable = args.hanh_dong === "mo_khoa";
          if (!enable && args.email === actor)
            throw new ToolError("Không thể tự khóa tài khoản của chính mình.");
          const row = await setEnabled(args.email, enable, actor);
          const n = enable ? 0 : await revokeAllForEmail(args.email);
          return result(
            `Đã ${enable ? "mở khóa" : "khóa"} tài khoản ${row.email}.` +
              (n ? ` Thu hồi ${n} phiên đang mở.` : ""),
            { tai_khoan: row, phien_thu_hoi: n },
          );
        }
        const n = await revokeAllForEmail(args.email);
        return result(`Đã thu hồi ${n} phiên đăng nhập của ${args.email}.`, { phien_thu_hoi: n });
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
