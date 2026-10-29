/**
 * Chạy bản demo trên máy bằng một lệnh (docs/DEMO.md).
 *
 *   bun run demo                 dựng CSDL, gieo dữ liệu, bật API và web
 *   bun run demo --nhanh         bỏ qua bước gieo dữ liệu (đã gieo từ lần trước)
 *   bun run demo --khong-build   dùng bản build web có sẵn (mặc định build lại để khớp mã nguồn)
 *   bun run demo --duong-ham     mở thêm đường hầm HTTPS (cloudflared) để cài PWA trên điện thoại
 *   bun run demo --chi-chuan-bi  chỉ dựng CSDL và gieo dữ liệu, không bật máy chủ
 *   bun run demo --lam-lai       xóa CSDL demo trên máy rồi dựng lại từ đầu
 *
 * Cấu hình: .env.demo, rồi .env.demo.local (không vào git) đè lên. Hai tệp này đè lên .env, để
 * demo luôn dùng CSDL riêng trên máy và không đụng tới hệ thống thật.
 *
 * Các bước: bật Postgres trong Docker → tạo CSDL demo nếu chưa có → migration → gieo dữ liệu
 * (chạy lại nhiều lần không trùng) → build web nếu cần → bật API và web → in địa chỉ.
 * Ctrl+C để tắt API và web; Postgres vẫn chạy (tắt bằng `docker compose -f infra/docker-compose.yml stop`).
 */

import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { type Subprocess, spawn, spawnSync } from "bun";
import postgres from "postgres";

const ROOT = join(import.meta.dir, "..");
const co = (c: string) => process.argv.includes(c);
const NHANH = co("--nhanh");
const KHONG_BUILD = co("--khong-build");
const DUONG_HAM = co("--duong-ham");
const CHI_CHUAN_BI = co("--chi-chuan-bi");
const LAM_LAI = co("--lam-lai");

/* ------------------------------------------------------------------ */
/* Môi trường                                                           */
/* ------------------------------------------------------------------ */

function docEnv(tep: string): Record<string, string> {
  const duong = join(ROOT, tep);
  if (!existsSync(duong)) return {};
  const ra: Record<string, string> = {};
  for (const dong of readFileSync(duong, "utf8").split(/\r?\n/)) {
    const m = dong.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    ra[m[1]!] = v;
  }
  return ra;
}

if (!existsSync(join(ROOT, ".env.demo"))) {
  console.error("Không thấy .env.demo ở thư mục gốc dự án.");
  process.exit(1);
}
const demoEnv = { ...docEnv(".env.demo"), ...docEnv(".env.demo.local") };
const WEB_PORT = Number(demoEnv.DEMO_WEB_PORT || 3080);
const API_PORT = Number(demoEnv.DEMO_API_PORT || 3081);

/**
 * Địa chỉ IPv4 của máy trong mạng nội bộ. Xếp 192.168.x và 10.x (thường là Wi-Fi, LAN thật) lên
 * trước 172.x (thường là card mạng ảo của Docker, WSL, Hyper-V).
 */
function diaChiLan(): string[] {
  const hang = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
  return Object.values(networkInterfaces())
    .flat()
    .filter((i): i is NonNullable<typeof i> => Boolean(i) && i!.family === "IPv4" && !i!.internal)
    .map((i) => i.address)
    .sort((a, b) => hang(a) - hang(b));
}
const LAN = diaChiLan();

const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  ...demoEnv,
  // Máy chủ demo không bao giờ tự tắt tiến trình khác đang giữ cổng.
  QDPL_KILL_PORT: "0",
  CORS_ORIGINS: [demoEnv.CORS_ORIGINS, ...LAN.map((ip) => `http://${ip}:${WEB_PORT}`)]
    .filter(Boolean)
    .join(","),
};
// Tiến trình con vẫn tự đọc .env của dự án, nhưng Bun không đè biến đã có sẵn, kể cả biến
// rỗng: giá trị của .env.demo luôn thắng. Bỏ NODE_ENV thừa hưởng (ví dụ "test") để API chạy ở
// chế độ phát triển trên máy.
delete env.NODE_ENV;

const DB_URL = env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(DB_URL)) {
  console.error(
    "DATABASE_URL trong .env.demo phải trỏ vào Postgres trên máy (127.0.0.1). Dừng để không đụng CSDL thật.",
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Tiện ích                                                             */
/* ------------------------------------------------------------------ */

function buoc(ten: string) {
  console.log(`\n== ${ten}`);
}

function chay(lenh: string[], opts: { cwd?: string; tenBuoc?: string } = {}) {
  const r = spawnSync(lenh, { cwd: opts.cwd ?? ROOT, env, stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) {
    throw new Error(`${opts.tenBuoc ?? lenh.join(" ")} hỏng (mã thoát ${r.exitCode}).`);
  }
}

async function congDangBan(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

async function choSan(url: string, ten: string, giay = 90) {
  const han = Date.now() + giay * 1000;
  while (Date.now() < han) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      // Chưa lên.
    }
    await Bun.sleep(500);
  }
  throw new Error(`${ten} không lên sau ${giay} giây (${url}).`);
}

/* ------------------------------------------------------------------ */
/* 1. CSDL                                                              */
/* ------------------------------------------------------------------ */

async function dungCsdl() {
  buoc("Bật Postgres (Docker)");
  const docker = spawnSync(["docker", "compose", "-f", "infra/docker-compose.yml", "up", "-d", "postgres"], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (docker.exitCode !== 0) {
    throw new Error("Không bật được Postgres. Kiểm tra Docker Desktop đã chạy chưa (xem docs/DEMO.md).");
  }

  const url = new URL(DB_URL);
  const tenCsdl = url.pathname.slice(1);
  const quanTri = new URL(DB_URL);
  quanTri.pathname = "/postgres";
  const han = Date.now() + 60_000;
  for (;;) {
    const sql = postgres(quanTri.toString(), { max: 1, connect_timeout: 3, onnotice: () => {} });
    try {
      await sql`SELECT 1`;
      if (LAM_LAI) {
        // Chỉ xóa đúng CSDL demo (DATABASE_URL đã được kiểm là Postgres trên máy).
        await sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${tenCsdl} AND pid <> pg_backend_pid()`;
        await sql.unsafe(`DROP DATABASE IF EXISTS "${tenCsdl.replace(/"/g, "")}"`);
        console.log(`- xóa CSDL ${tenCsdl} để dựng lại`);
      }
      const [co] = await sql`SELECT 1 FROM pg_database WHERE datname = ${tenCsdl}`;
      if (!co) {
        await sql.unsafe(`CREATE DATABASE "${tenCsdl.replace(/"/g, "")}"`);
        console.log(`+ tạo CSDL ${tenCsdl}`);
      } else {
        console.log(`= CSDL ${tenCsdl} đã có`);
      }
      await sql.end();
      break;
    } catch (e) {
      await sql.end().catch(() => {});
      if (Date.now() > han) throw e;
      await Bun.sleep(1500);
    }
  }

  buoc("Migration");
  chay(["bun", "run", "packages/db/src/migrate.ts"], { tenBuoc: "Migration" });
}

/* ------------------------------------------------------------------ */
/* 2. Dữ liệu                                                           */
/* ------------------------------------------------------------------ */

function gieoDuLieu() {
  const cacBuoc: Array<[string, string[]]> = [
    ["Dữ liệu nền và hai văn bản mẫu", ["bun", "run", "packages/db/src/seed.ts"]],
    ["Nhân vật, danh mục đào tạo", ["bun", "run", "packages/db/src/seed-dao-tao.ts"]],
    ["Bài giảng giao thông đường bộ", ["bun", "run", "packages/db/src/seed-dao-tao-gtdb.ts"]],
    ["Ngân hàng câu hỏi", ["bun", "run", "packages/db/src/seed-ngan-hang.ts"]],
    ["Tra cứu nhanh (mức phạt, tốc độ, quy trình)", ["bun", "run", "scripts/tra-cuu-nhanh.ts"]],
    ["Biển báo", ["bun", "run", "scripts/bien-bao.ts"]],
    // Đặt sau câu hỏi, bài giảng, tra cứu nhanh: script đọc căn cứ của các nội dung đó để
    // biết cần chép văn bản nào (docs/DEMO.md mục 5). Trước chỉ mục tìm kiếm để văn bản được đánh chỉ mục.
    [
      "Văn bản được nội dung trích dẫn (chép từ kho thật)",
      ["bun", "run", "packages/db/src/seed-demo-van-ban.ts"],
    ],
    // Văn bản kho thật chưa có: nạp từ tệp Markdown đã soát trong docs/demo/van-ban. Chỉ chạy trên CSDL demo.
    ["Văn bản từ tệp Markdown (docs/demo/van-ban)", ["bun", "run", "scripts/demo-van-ban-tep.ts"]],
    ["Đơn vị và tài khoản mẫu", ["bun", "run", "packages/db/src/seed-don-vi.ts"]],
    ["Chỉ mục tìm kiếm", ["bun", "run", "packages/search/src/cli.ts"]],
  ];
  for (const [ten, lenh] of cacBuoc) {
    buoc(ten);
    chay(lenh, { tenBuoc: ten });
  }
}

/* ------------------------------------------------------------------ */
/* 3. Máy chủ                                                           */
/* ------------------------------------------------------------------ */

const tienTrinh: Subprocess[] = [];

function tatHet() {
  for (const p of tienTrinh) {
    if (p.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync(["taskkill", "/PID", String(p.pid), "/T", "/F"]);
    else p.kill();
  }
}

async function batMayChu(): Promise<string | null> {
  for (const [port, ten] of [
    [API_PORT, "API"],
    [WEB_PORT, "web"],
  ] as const) {
    if (await congDangBan(port)) {
      throw new Error(
        `Cổng ${port} (${ten}) đang có tiến trình khác. Tắt tiến trình đó, hoặc đổi DEMO_${ten === "API" ? "API" : "WEB"}_PORT trong .env.demo.local.`,
      );
    }
  }

  const buildWeb = join(ROOT, "apps", "web", "build", "server", "index.js");
  if (!KHONG_BUILD || !existsSync(buildWeb)) {
    buoc("Build giao diện web");
    chay(["bun", "run", "build:web"], { tenBuoc: "Build web" });
  }

  buoc("Bật API và web");
  tienTrinh.push(
    spawn(["bun", "run", "apps/api/src/index.ts"], {
      cwd: ROOT,
      env: { ...env, PORT: String(API_PORT), API_PORT: String(API_PORT) },
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  tienTrinh.push(
    spawn(["bunx", "react-router-serve", "./build/server/index.js"], {
      cwd: join(ROOT, "apps", "web"),
      env: {
        ...env,
        PORT: String(WEB_PORT),
        WEB_PORT: String(WEB_PORT),
        API_URL: `http://127.0.0.1:${API_PORT}`,
      },
      stdout: "inherit",
      stderr: "inherit",
    }),
  );
  await choSan(`http://127.0.0.1:${API_PORT}/health`, "API");
  await choSan(`http://127.0.0.1:${WEB_PORT}/`, "Web");

  if (!DUONG_HAM) return null;
  buoc("Đường hầm HTTPS (cloudflared)");
  const coCloudflared = spawnSync(["cloudflared", "--version"], { stdout: "ignore", stderr: "ignore" });
  if (coCloudflared.exitCode !== 0) {
    console.warn("! Chưa cài cloudflared: bỏ qua đường hầm. Cách cài xem docs/DEMO.md.");
    return null;
  }
  const ham = spawn(["cloudflared", "tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${WEB_PORT}`], {
    stdout: "ignore",
    stderr: "pipe",
  });
  tienTrinh.push(ham);
  // cloudflared in địa chỉ https://<tên>.trycloudflare.com ra stderr.
  const doc = ham.stderr.getReader();
  const giaiMa = new TextDecoder();
  let daDoc = "";
  const han = Date.now() + 30_000;
  while (Date.now() < han) {
    const { value, done } = await doc.read();
    if (done) break;
    daDoc += giaiMa.decode(value);
    const m = daDoc.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      doc.releaseLock();
      return m[0];
    }
  }
  console.warn("! Không lấy được địa chỉ đường hầm sau 30 giây.");
  return null;
}

function inHuongDan(duongHam: string | null) {
  const dong = "─".repeat(64);
  console.log(`\n${dong}`);
  console.log("BẢN DEMO ĐÃ CHẠY. Ctrl+C để tắt.\n");
  console.log(`  Trên máy này      http://localhost:${WEB_PORT}`);
  for (const ip of LAN)
    console.log(
      `  Cùng mạng Wi-Fi   http://${ip}:${WEB_PORT}${ip.startsWith("172.") ? "   (có thể là card mạng ảo)" : ""}`,
    );
  if (duongHam) console.log(`  HTTPS (cài PWA)   ${duongHam}`);
  console.log(`  Trang quản trị    http://localhost:${WEB_PORT}/quan-tri`);
  console.log(`  API               http://localhost:${API_PORT}/health`);
  console.log("\n  Tài khoản (mật khẩu chung Matkhau2026, đổi bằng SEED_MAT_KHAU):");
  console.log("    quantri        Admin quản trị hệ thống");
  console.log("    quanly         Admin quản lý nội dung (toàn hệ thống)");
  console.log("    lanhdao.xa     Lãnh đạo xã Minh Hòa");
  console.log("    lanhdao.ubnd   Lãnh đạo UBND xã Minh Hòa");
  console.log("    congchuc.01 … congchuc.03; vienchuc.01 … vienchuc.02; dangvien.01 … dangvien.02");
  console.log(
    `\n  Hỏi đáp AI: ${env.LLM_PROVIDER === "none" ? "chưa cấu hình (đặt key ở .env.demo.local)" : "bật"}`,
  );
  console.log(dong);
}

/* ------------------------------------------------------------------ */

try {
  await dungCsdl();
  if (NHANH) console.log("\n(--nhanh: bỏ qua gieo dữ liệu)");
  else gieoDuLieu();
  if (CHI_CHUAN_BI) {
    console.log("\nĐã chuẩn bị xong CSDL demo (--chi-chuan-bi: không bật máy chủ).");
    process.exit(0);
  }
  const duongHam = await batMayChu();
  inHuongDan(duongHam);
  const tat = () => {
    console.log("\nĐang tắt API và web…");
    tatHet();
    process.exit(0);
  };
  process.on("SIGINT", tat);
  process.on("SIGTERM", tat);
  // Một máy chủ tự dừng thì tắt nốt cái còn lại và báo.
  await Promise.race(tienTrinh.slice(0, 2).map((p) => p.exited));
  console.error("\nAPI hoặc web đã dừng bất ngờ. Xem nhật ký phía trên.");
  tatHet();
  process.exit(1);
} catch (e) {
  console.error(`\nDEMO DỪNG: ${e instanceof Error ? e.message : e}`);
  tatHet();
  process.exit(1);
}
