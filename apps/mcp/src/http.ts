/**
 * Máy chủ MCP chạy trên HTTP, xác thực bằng Google Identity Services.
 *
 * Luồng đăng nhập:
 *   1. Người dùng mở trang chủ của server, bấm "Đăng nhập với Google" (GIS).
 *   2. GIS trả về ID token; trang gửi token đó tới POST /auth/google.
 *   3. Server kiểm chứng token với khóa công khai của Google, tạo/cập nhật tài khoản,
 *      rồi cấp một TOKEN PHIÊN riêng của hệ thống (thu hồi được, hạn dài hơn).
 *   4. Người dùng dán token phiên vào cấu hình MCP client dưới dạng
 *      Authorization: Bearer <token>.
 *
 * Mọi lời gọi công cụ đều đi kèm danh tính đó và được kiểm tra quyền, ghi nhật ký.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  AuthError,
  createSession,
  defaultRole,
  type Principal,
  principalFromToken,
  ROLE_LABEL,
  type Role,
  readAuthConfig,
  revokeSession,
  upsertAccount,
  verifyGoogleIdToken,
  visibleTools,
} from "@qdpl/auth";
import { bindHost, currentProfile, listenWithRetry, portFor } from "@qdpl/config";
import { sql } from "@qdpl/db";
import { buildServer } from "./server.ts";
import { writeEnabled } from "./tools/van-hanh.ts";

export interface HttpConfig {
  port: number;
  googleClientId: string;
  allowedDomains: string[];
  publicUrl: string;
}

export function readHttpConfig(): HttpConfig {
  const auth = readAuthConfig();
  return {
    port: portFor("mcp"),
    googleClientId: auth.googleClientId,
    allowedDomains: auth.allowedDomains,
    // APP_URL do DigitalOcean App Platform đặt sẵn bằng URL công khai của ứng dụng; dùng nó
    // khi chưa khai MCP_PUBLIC_URL, để metadata OAuth và cấu hình sinh ra trỏ đúng máy chủ.
    publicUrl: (
      process.env.MCP_PUBLIC_URL ??
      process.env.APP_URL ??
      `http://127.0.0.1:${portFor("mcp")}`
    ).replace(/\/+$/, ""),
  };
}

interface Session {
  transport: WebStandardStreamableHTTPServerTransport;
  principal: Principal;
  createdAt: number;
}

const sessions = new Map<string, Session>();

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function unauthorized(config: HttpConfig, message: string): Response {
  // Theo đặc tả MCP Authorization: chỉ ra nơi lấy thông tin xác thực.
  return json({ error: "unauthorized", message }, 401, {
    "WWW-Authenticate": `Bearer realm="quydinhphapluat", resource_metadata="${config.publicUrl}/.well-known/oauth-protected-resource"`,
  });
}

async function principalFromRequest(req: Request): Promise<Principal | undefined> {
  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return undefined;
  return await principalFromToken(auth.slice(7).trim());
}

function signInPage(config: HttpConfig): Response {
  const configured = Boolean(config.googleClientId);
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đăng nhập — MCP Quy định Pháp luật</title>
<style>
  :root { color-scheme: light dark; --bg:#fbfaf8; --fg:#1a1a1a; --muted:#5b5b5b; --line:#e2e0dc; --accent:#0b5cab; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#141414; --fg:#eee; --muted:#a0a0a0; --line:#333; --accent:#7ab8ff; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:640px; margin:0 auto; padding:40px 20px 80px; }
  h1 { font-size:1.5rem; margin:0 0 4px; }
  p.sub { color:var(--muted); margin:0 0 28px; }
  .card { border:1px solid var(--line); border-radius:12px; padding:20px; background:color-mix(in srgb, var(--bg) 92%, white); }
  .card + .card { margin-top:16px; }
  code, pre { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:0.85rem; }
  pre { background:color-mix(in srgb, var(--bg) 80%, gray 12%); padding:12px; border-radius:8px; overflow-x:auto; }
  .token { word-break:break-all; user-select:all; }
  button.copy { min-height:44px; padding:0 16px; border-radius:8px; border:1px solid var(--line); background:transparent; color:var(--fg); cursor:pointer; }
  .warn { border-left:3px solid #b4690e; padding-left:12px; color:var(--muted); }
  ul { padding-left:20px; }
</style></head>
<body><main>
<h1>MCP Quy định Pháp luật</h1>
<p class="sub">Đăng nhập để lấy token kết nối cho công cụ AI của bạn.</p>

${
  configured
    ? `<div class="card">
  <div id="gbtn"></div>
  <div id="out" hidden>
    <p><strong>Đăng nhập thành công.</strong> Tài khoản: <span id="email"></span> — vai trò: <span id="role"></span></p>
    <p>Token phiên (giữ bí mật, hết hạn <span id="exp"></span>):</p>
    <pre class="token" id="token"></pre>
    <button class="copy" id="copy">Sao chép token</button>
    <p>Thêm vào cấu hình MCP client:</p>
    <pre id="cfg"></pre>
  </div>
  <p id="err" class="warn" hidden></p>
</div>`
    : `<div class="card warn">
  <p><strong>Chưa cấu hình đăng nhập.</strong> Người vận hành cần đặt biến môi trường
  <code>GOOGLE_CLIENT_ID</code> bằng Client ID của ứng dụng web trên Google Cloud Console,
  và thêm <code>${config.publicUrl}</code> vào danh sách JavaScript origins được phép.</p>
</div>`
}

<div class="card">
  <h2 style="font-size:1.05rem;margin:0 0 8px">Vai trò và quyền</h2>
  <ul>
    ${Object.entries(ROLE_LABEL)
      .map(([k, v]) => `<li><code>${k}</code> — ${v}</li>`)
      .join("\n    ")}
  </ul>
  <p class="sub" style="margin:8px 0 0">Tài khoản mới nhận vai trò mặc định
  <code>${defaultRole()}</code>. Quản trị viên nâng quyền bằng công cụ
  <code>quan_ly_tai_khoan</code>.</p>
</div>

${
  configured
    ? `<script src="https://accounts.google.com/gsi/client" async defer></script>
<script>
  function show(el, on){ document.getElementById(el).hidden = !on; }
  async function onCredential(res){
    try {
      const r = await fetch("/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: res.credential, client: "trang-dang-nhap" })
      });
      const data = await r.json();
      if (!r.ok) { document.getElementById("err").textContent = data.message || "Đăng nhập thất bại."; show("err", true); return; }
      document.getElementById("email").textContent = data.email;
      document.getElementById("role").textContent = data.role + " — " + data.role_label;
      document.getElementById("token").textContent = data.token;
      document.getElementById("exp").textContent = new Date(data.expires_at).toLocaleString("vi-VN");
      document.getElementById("cfg").textContent = JSON.stringify({
        mcpServers: { quydinhphapluat: { type: "http", url: ${JSON.stringify(`${config.publicUrl}/mcp`)},
          headers: { Authorization: "Bearer " + data.token } } }
      }, null, 2);
      show("out", true); show("err", false);
    } catch (e) {
      document.getElementById("err").textContent = String(e); show("err", true);
    }
  }
  window.onload = function(){
    google.accounts.id.initialize({ client_id: ${JSON.stringify(config.googleClientId)}, callback: onCredential });
    google.accounts.id.renderButton(document.getElementById("gbtn"),
      { theme: "outline", size: "large", text: "signin_with", locale: "vi" });
    document.getElementById("copy").onclick = function(){
      navigator.clipboard.writeText(document.getElementById("token").textContent);
      this.textContent = "Đã sao chép";
    };
  };
</script>`
    : ""
}
</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function handle(req: Request, config: HttpConfig): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": req.headers.get("origin") ?? "*",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
        "access-control-expose-headers": "mcp-session-id",
      },
    });
  }

  if (url.pathname === "/" && req.method === "GET") return signInPage(config);

  if (url.pathname === "/health") {
    let db = "ok";
    try {
      await sql`SELECT 1`;
    } catch (e) {
      db = e instanceof Error ? e.message : "lỗi";
    }
    return json({
      status: db === "ok" ? "ok" : "degraded",
      db,
      xac_thuc: config.googleClientId ? "google" : "chưa cấu hình",
      cho_phep_ghi: writeEnabled(),
      mien_gioi_han: config.allowedDomains.length ? config.allowedDomains : null,
    });
  }

  // Metadata theo đặc tả MCP Authorization: client biết cần đăng nhập ở đâu.
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return json({
      resource: `${config.publicUrl}/mcp`,
      authorization_servers: ["https://accounts.google.com"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${config.publicUrl}/`,
      scopes_supported: ["openid", "email", "profile"],
    });
  }

  if (url.pathname === "/auth/google" && req.method === "POST") {
    try {
      const body = (await req.json()) as { credential?: string; client?: string };
      if (!body.credential)
        return json({ error: "invalid_request", message: "Thiếu trường credential." }, 400);
      const claims = await verifyGoogleIdToken(body.credential, {
        clientId: config.googleClientId,
        allowedDomains: config.allowedDomains,
      });
      const account = await upsertAccount({
        email: claims.email,
        sub: claims.sub,
        ...(claims.name ? { name: claims.name } : {}),
        ...(claims.picture ? { picture: claims.picture } : {}),
        ...(claims.hd ? { hd: claims.hd } : {}),
      });
      if (!account.enabled) {
        return json({ error: "forbidden", message: "Tài khoản đã bị khóa. Liên hệ quản trị viên." }, 403);
      }
      const session = await createSession(account.id, body.client ?? "unknown");
      return json({
        token: session.token,
        expires_at: session.expiresAt.toISOString(),
        email: account.email,
        role: account.role,
        role_label: ROLE_LABEL[account.role as Role],
        la_quan_tri_dau_tien: account.laQuanTriDauTien,
        cong_cu_kha_dung: visibleTools(
          { accountId: account.id, email: account.email, role: account.role as Role, source: "google" },
          writeEnabled(),
        ),
      });
    } catch (e) {
      if (e instanceof AuthError) {
        const status = e.code === "forbidden" ? 403 : e.code === "invalid_config" ? 500 : 401;
        return json({ error: e.code, message: e.message }, status);
      }
      return json({ error: "server_error", message: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  if (url.pathname === "/auth/logout" && req.method === "POST") {
    const auth = req.headers.get("authorization");
    if (!auth?.toLowerCase().startsWith("bearer ")) return json({ error: "invalid_request" }, 400);
    const ok = await revokeSession(auth.slice(7).trim());
    return json({ da_thu_hoi: ok });
  }

  if (url.pathname === "/me") {
    const principal = await principalFromRequest(req);
    if (!principal) return unauthorized(config, "Thiếu hoặc sai token phiên.");
    return json({
      email: principal.email,
      ten: principal.name ?? null,
      vai_tro: principal.role,
      mo_ta_vai_tro: ROLE_LABEL[principal.role],
      cong_cu_kha_dung: visibleTools(principal, writeEnabled()),
      cho_phep_ghi: writeEnabled(),
    });
  }

  if (url.pathname === "/mcp") {
    const principal = await principalFromRequest(req);
    if (!principal) {
      return unauthorized(config, `Cần đăng nhập. Mở ${config.publicUrl}/ để lấy token phiên.`);
    }

    const sessionId = req.headers.get("mcp-session-id") ?? undefined;
    let session = sessionId ? sessions.get(sessionId) : undefined;

    // Phiên đã có nhưng của người khác: từ chối, không cho dùng chung.
    if (session && session.principal.email !== principal.email) {
      return json({ error: "forbidden", message: "Phiên MCP thuộc về tài khoản khác." }, 403);
    }

    if (!session) {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (id: string) => {
          sessions.set(id, { transport, principal, createdAt: Date.now() });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      const server = buildServer(principal);
      await server.connect(transport);
      session = { transport, principal, createdAt: Date.now() };
    }

    const res = await session.transport.handleRequest(req);
    const headers = new Headers(res.headers);
    headers.set("access-control-allow-origin", req.headers.get("origin") ?? "*");
    headers.set("access-control-expose-headers", "mcp-session-id");
    return new Response(res.body, { status: res.status, headers });
  }

  return json({ error: "not_found", message: `Không có đường dẫn ${url.pathname}.` }, 404);
}

export async function startHttpServer(config = readHttpConfig()) {
  const server = await listenWithRetry(config.port, () =>
    Bun.serve({
      port: config.port,
      hostname: bindHost(),
      idleTimeout: 120,
      fetch: (req) => handle(req, config),
    }),
  );
  const lines = [
    `MCP Quy định Pháp luật đang chạy tại http://${server.hostname}:${server.port}`,
    `  trang đăng nhập : ${config.publicUrl}/`,
    `  điểm cuối MCP   : ${config.publicUrl}/mcp`,
    `  xác thực        : ${config.googleClientId ? "Google (GIS)" : "CHƯA CẤU HÌNH — đặt GOOGLE_CLIENT_ID"}`,
    `  giới hạn miền   : ${config.allowedDomains.length ? config.allowedDomains.join(", ") : "(không giới hạn)"}`,
    `  chế độ ghi      : ${writeEnabled() ? "BẬT" : "tắt (chỉ đọc)"}`,
    `  vai trò mặc định: ${defaultRole()}`,
    `  hồ sơ / pid     : ${currentProfile()} / ${process.pid}`,
  ];
  console.error(lines.join("\n"));
  return server;
}

export { sessions };
