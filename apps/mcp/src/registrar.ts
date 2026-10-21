/**
 * Bộ đăng ký công cụ có kiểm soát quyền.
 *
 * Thay vì đăng ký hết rồi chặn lúc gọi, công cụ nào người dùng không có quyền thì
 * KHÔNG được đăng ký: client không nhìn thấy, không gọi được. Mỗi công cụ được
 * đăng ký đều kèm lớp kiểm tra lại và ghi nhật ký.
 *
 * Cách này không đụng vào thành phần nội bộ của SDK nên không vỡ khi SDK đổi phiên bản.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { canUseTool, logCall, type Principal } from "@qdpl/auth";

/**
 * Cấu hình công cụ. Khai báo tường minh thay vì suy từ kiểu generic của SDK,
 * vì `Parameters<McpServer["registerTool"]>` trên hàm nạp chồng suy ra `never`.
 */
export interface ToolConfig {
  title?: string;
  description?: string;
  /** Lược đồ tham số dạng Zod raw shape. */
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface ToolRegistrar {
  /** Đăng ký một công cụ nếu người dùng có quyền. Trả về true nếu đã đăng ký. */
  add(name: string, config: ToolConfig, handler: (...args: any[]) => any): boolean;
  /** Danh sách công cụ đã đăng ký cho phiên này. */
  readonly registered: string[];
  readonly principal: Principal;
}

export function createRegistrar(
  server: McpServer,
  principal: Principal,
  writeEnabled: boolean,
): ToolRegistrar {
  const registered: string[] = [];
  return {
    principal,
    registered,
    add(name, config, handler) {
      const decision = canUseTool(principal, name, writeEnabled);
      if (!decision.allowed) return false;

      (server.registerTool as any)(name, config, async (...args: any[]) => {
        const started = Date.now();
        // Kiểm tra lại lúc gọi: vai trò có thể đã bị hạ trong lúc phiên đang mở.
        const now = canUseTool(principal, name, writeEnabled);
        if (!now.allowed) {
          await logCall({ principal, tool: name, allowed: false, denyReason: now.reason }).catch(() => {});
          return {
            content: [{ type: "text" as const, text: `Từ chối: ${now.reason}` }],
            isError: true as const,
          };
        }
        try {
          const out = await handler(...args);
          await logCall({
            principal,
            tool: name,
            args: args[0],
            allowed: true,
            durationMs: Date.now() - started,
            ...(out?.isError ? { error: "công cụ trả về isError" } : {}),
          }).catch(() => {});
          return out;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logCall({
            principal,
            tool: name,
            args: args[0],
            allowed: true,
            durationMs: Date.now() - started,
            error: msg,
          }).catch(() => {});
          throw e;
        }
      });
      registered.push(name);
      return true;
    },
  };
}
