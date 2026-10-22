#!/usr/bin/env bun
/**
 * Điểm vào MCP server của quydinhphapluat.vn.
 *
 *   bun src/index.ts            # stdio, dùng cho client chạy trên chính máy này
 *   bun src/index.ts --http     # HTTP có xác thực Google, dùng cho nhiều người dùng
 *
 * Vì sao có hai chế độ: stdio do chính người vận hành khởi chạy trên máy của họ nên danh tính
 * là danh tính hệ điều hành; HTTP phục vụ nhiều người nên bắt buộc xác thực và phân quyền.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type Principal, ROLES, type Role } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { readHttpConfig, startHttpServer } from "./http.ts";
import { buildServer } from "./server.ts";
import { writeEnabled } from "./tools/van-hanh.ts";

async function runStdio(): Promise<void> {
  const role = (process.env.MCP_LOCAL_ROLE ?? "can_bo") as Role;
  if (!ROLES.includes(role)) {
    console.error(`MCP_LOCAL_ROLE không hợp lệ: ${role}. Chọn một trong: ${ROLES.join(", ")}`);
    process.exit(1);
  }
  const principal: Principal = {
    email: process.env.MCP_LOCAL_EMAIL ?? `local@${process.env.USER ?? "may-cuc-bo"}`,
    name: "Phiên cục bộ (stdio)",
    role,
    source: "local",
  };
  // Ghi ra stderr: stdout dành riêng cho giao thức MCP.
  console.error(
    `MCP Quy định Pháp luật — stdio | danh tính: ${principal.email} | vai trò: ${role} | ghi dữ liệu: ${writeEnabled() ? "bật" : "tắt"}`,
  );
  const server = buildServer(principal);
  await server.connect(new StdioServerTransport());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      [
        "MCP server Quy định Pháp luật",
        "",
        "  --http            chạy trên HTTP có xác thực Google (GIS)",
        "  (mặc định)        chạy stdio cho client trên cùng máy",
        "",
        "Biến môi trường:",
        "  DATABASE_URL            kết nối Postgres (bắt buộc)",
        "  QDPL_MCP_ALLOW_WRITE=1  bật các công cụ ghi dữ liệu (mặc định chỉ đọc)",
        "  MCP_PORT                cổng HTTP, mặc định 3002",
        "  MCP_PUBLIC_URL          URL công khai để sinh cấu hình và metadata",
        "  GOOGLE_CLIENT_ID        Client ID ứng dụng web (bắt buộc cho chế độ HTTP)",
        "  AUTH_ALLOWED_DOMAINS    danh sách miền được phép, phân tách bằng dấu phẩy",
        "  AUTH_DEFAULT_ROLE       vai trò cho tài khoản mới, mặc định khach",
        "  AUTH_BOOTSTRAP_ADMIN    =0 để tắt việc người đăng nhập đầu tiên thành quản trị",
        "  AUTH_SESSION_TTL_HOURS  hạn token phiên, mặc định 336 giờ",
        "  MCP_LOCAL_ROLE          vai trò cho chế độ stdio, mặc định can_bo",
      ].join("\n"),
    );
    return;
  }

  try {
    await sql`SELECT 1`;
  } catch (e) {
    console.error(
      `Không kết nối được CSDL: ${e instanceof Error ? e.message : e}\n` +
        "Kiểm tra DATABASE_URL, hoặc chạy: docker compose -f infra/docker-compose.yml up -d postgres",
    );
    process.exit(1);
  }

  if (args.includes("--http")) {
    const config = readHttpConfig();
    if (!config.googleClientId) {
      console.error(
        "CẢNH BÁO: chưa đặt GOOGLE_CLIENT_ID. Server vẫn chạy nhưng KHÔNG ai đăng nhập được,\n" +
          "vì mọi ID token đều bị từ chối do không kiểm chứng được audience.",
      );
    }
    await startHttpServer(config);
    return;
  }
  await runStdio();
}

await main();
