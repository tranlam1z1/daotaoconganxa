/**
 * Khung kiểm thử đầu cuối bằng trình duyệt (docs/PLAN.md GĐ4).
 *
 *   bun run e2e                 # chạy mọi kịch bản trong scripts/e2e/
 *   bun run e2e luyen-tap       # chỉ chạy kịch bản luyen-tap.ts
 *   bun run e2e --khong-build   # dùng bản build web có sẵn, không build lại
 *
 * Việc làm: build web → dựng API và web ở hai cổng riêng (mặc định 3291, 3290, đổi bằng
 * E2E_API_PORT, E2E_WEB_PORT) → mở Chrome có sẵn trên máy qua playwright-core → chạy từng kịch
 * bản → dọn dữ liệu kịch bản đã tạo → tắt máy chủ.
 *
 * Máy chủ E2E không bao giờ tự kết thúc tiến trình đang giữ cổng (QDPL_KILL_PORT=0), để không
 * đụng máy chủ dev của người khác. Chạy trên CSDL mà DATABASE_URL trỏ tới; mọi dữ liệu kịch bản
 * tạo ra mang tiền tố "e2e-" và được xóa khi xong.
 *
 * Viết kịch bản mới: tạo scripts/e2e/<ten>.ts, export default một hàm nhận `NguCanhE2E`. Ném
 * lỗi là kịch bản hỏng. Xem luyen-tap.ts.
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { bamMatKhau } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { type Browser, chromium, type Page } from "playwright-core";

const ROOT = join(import.meta.dir, "..", "..");
const THU_MUC = import.meta.dir;
const API_PORT = Number(process.env.E2E_API_PORT ?? 3291);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3290);
export const TIEN_TO = "e2e-";

export interface TaiKhoanE2E {
  id: string;
  username: string;
  password: string;
}

export interface NguCanhE2E {
  /** Địa chỉ gốc của web, ví dụ http://127.0.0.1:3290 */
  web: string;
  sql: typeof sql;
  /** Mở một trang mới, mặc định khung điện thoại 360×740. */
  moTrang(khung?: { width: number; height: number }): Promise<Page>;
  /** Tạo tài khoản mật khẩu (tên đăng nhập có tiền tố e2e-), tự xóa khi kịch bản xong. */
  taoTaiKhoan(opts?: { role?: string; ten?: string }): Promise<TaiKhoanE2E>;
  /** Đăng nhập qua trang /dang-nhap bằng biểu mẫu tên đăng nhập + mật khẩu. */
  dangNhap(page: Page, tk: TaiKhoanE2E): Promise<void>;
  /** Đăng ký việc dọn dữ liệu, chạy theo thứ tự ngược khi kịch bản xong (kể cả khi hỏng). */
  donDep(fn: () => Promise<unknown>): void;
  /** Chụp toàn trang vào scripts/e2e/.anh/<kịch bản>-<ten>.png, để soát tay sau khi chạy. */
  chupAnh(page: Page, ten: string): Promise<void>;
  /** Ném lỗi khi trang cuộn ngang (bảng kiểm §0.4 của PLAN). */
  kiemKhongCuonNgang(page: Page, noi: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Máy chủ                                                             */
/* ------------------------------------------------------------------ */

function timChrome(): string {
  const ung = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((x): x is string => Boolean(x));
  const co = ung.find((p) => existsSync(p));
  if (!co) throw new Error("Không tìm thấy Chrome. Đặt CHROME_PATH trỏ tới tệp chạy Chrome hoặc Chromium.");
  return co;
}

async function choSan(url: string, ten: string, giay = 60): Promise<void> {
  const het = Date.now() + giay * 1000;
  while (Date.now() < het) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      // Chưa lên, thử lại.
    }
    await Bun.sleep(300);
  }
  throw new Error(`${ten} không lên sau ${giay} giây (${url}).`);
}

function dungMayChu(ds: ChildProcess[]) {
  for (const p of ds) {
    if (p.exitCode !== null || !p.pid) continue;
    // Trên Windows, bunx sinh tiến trình con; phải hạ cả cây.
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    else p.kill("SIGTERM");
  }
}

/** E2E_LOG=1 thì in nhật ký của API và web ra màn hình, để tìm lỗi khi kịch bản đứng chờ. */
const nhatKy = process.env.E2E_LOG === "1" ? "inherit" : "ignore";

/** Cổng đã có máy chủ trả lời chưa (một lượt E2E khác, hay máy chủ của người khác). */
async function congDangBan(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

async function dungMayChuE2E(): Promise<ChildProcess[]> {
  // Không dựng đè lên máy chủ có sẵn: nếu không, kịch bản sẽ chạy trên máy chủ của lượt khác và
  // hỏng khó hiểu khi lượt đó tắt máy chủ giữa chừng.
  for (const [port, bien] of [
    [API_PORT, "E2E_API_PORT"],
    [WEB_PORT, "E2E_WEB_PORT"],
  ] as const) {
    if (await congDangBan(port)) {
      throw new Error(
        `Cổng ${port} đang có máy chủ khác (có thể một lượt E2E khác đang chạy). Đặt ${bien} sang cổng khác.`,
      );
    }
  }
  const env = { ...process.env, QDPL_KILL_PORT: "0" };
  const api = spawn("bun", ["run", "apps/api/src/index.ts"], {
    cwd: ROOT,
    env: { ...env, API_PORT: String(API_PORT) },
    stdio: nhatKy,
  });
  const web = spawn("bunx", ["react-router-serve", "./build/server/index.js"], {
    cwd: join(ROOT, "apps", "web"),
    env: { ...env, PORT: String(WEB_PORT), API_URL: `http://127.0.0.1:${API_PORT}` },
    stdio: nhatKy,
    shell: process.platform === "win32",
  });
  const ds = [api, web];
  try {
    await choSan(`http://127.0.0.1:${API_PORT}/health`, "API");
    await choSan(`http://127.0.0.1:${WEB_PORT}/`, "Web");
  } catch (err) {
    dungMayChu(ds);
    throw err;
  }
  return ds;
}

/* ------------------------------------------------------------------ */
/* Ngữ cảnh cho kịch bản                                               */
/* ------------------------------------------------------------------ */

function taoNguCanh(
  trinhDuyet: Browser,
  tenKichBan: string,
  viecDon: Array<() => Promise<unknown>>,
  trangDaMo: Page[],
): NguCanhE2E {
  const web = `http://127.0.0.1:${WEB_PORT}`;
  const ngu: NguCanhE2E = {
    web,
    sql,
    async moTrang(khung = { width: 360, height: 740 }) {
      const ctx = await trinhDuyet.newContext({ viewport: khung, locale: "vi-VN" });
      viecDon.push(() => ctx.close());
      const page = await ctx.newPage();
      trangDaMo.push(page);
      // Lỗi JavaScript trên trang thường là nguyên nhân kịch bản đứng chờ: in ra để dễ tìm.
      page.on("pageerror", (e) => console.error(`  [lỗi trang] ${e.message}`));
      page.setDefaultTimeout(15_000);
      return page;
    },
    async taoTaiKhoan(opts = {}) {
      const username = `${TIEN_TO}${tenKichBan}-${crypto.randomUUID().slice(0, 8)}`;
      const password = `E2e-${crypto.randomUUID().slice(0, 12)}`;
      const [acc] = await sql<Array<{ id: string }>>`
        INSERT INTO accounts (username, password_hash, name, role, must_change_password)
        VALUES (${username}, ${await bamMatKhau(password)}, ${opts.ten ?? "Cán bộ E2E"}, ${opts.role ?? "can_bo"}, false)
        RETURNING id`;
      // Phiên luyện tập, câu trả lời, câu sai xóa dây chuyền theo tài khoản.
      viecDon.push(() => sql`DELETE FROM accounts WHERE id = ${acc!.id}`);
      return { id: acc!.id, username, password };
    },
    async dangNhap(page, tk) {
      await page.goto(`${web}/dang-nhap`);
      await page.fill('input[name="ten_dang_nhap"]', tk.username);
      await page.fill('input[name="mat_khau"]', tk.password);
      await Promise.all([
        page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap")),
        page.locator('form:has(input[name="ten_dang_nhap"]) button[type="submit"]').click(),
      ]);
    },
    donDep(fn) {
      viecDon.push(fn);
    },
    async chupAnh(page, ten) {
      const thuMuc = join(THU_MUC, ".anh");
      await mkdir(thuMuc, { recursive: true });
      await page.screenshot({ path: join(thuMuc, `${tenKichBan}-${ten}.png`), fullPage: true });
    },
    async kiemKhongCuonNgang(page, noi) {
      const { rong, khung } = await page.evaluate(() => ({
        rong: document.documentElement.scrollWidth,
        khung: document.documentElement.clientWidth,
      }));
      if (rong > khung) throw new Error(`${noi}: trang cuộn ngang (${rong}px > ${khung}px).`);
    },
  };
  return ngu;
}

/* ------------------------------------------------------------------ */

async function main() {
  const doi = process.argv.slice(2);
  const khongBuild = doi.includes("--khong-build");
  const chon = doi.filter((a) => !a.startsWith("--"));

  const tatCa = (await readdir(THU_MUC))
    .filter((f) => f.endsWith(".ts") && f !== "chay.ts")
    .map((f) => f.slice(0, -3))
    .sort();
  const chay = chon.length ? tatCa.filter((k) => chon.includes(k)) : tatCa;
  const thieu = chon.filter((k) => !tatCa.includes(k));
  if (thieu.length) throw new Error(`Không có kịch bản: ${thieu.join(", ")}. Có: ${tatCa.join(", ")}.`);

  if (!khongBuild) {
    console.log("Build web…");
    const b = spawnSync("bun", ["run", "build:web"], { cwd: ROOT, stdio: "inherit" });
    if (b.status !== 0) throw new Error("Build web hỏng.");
  }

  console.log(`Dựng API (cổng ${API_PORT}) và web (cổng ${WEB_PORT})…`);
  const mayChu = await dungMayChuE2E();
  const trinhDuyet = await chromium.launch({ executablePath: timChrome() });
  let hong = 0;
  try {
    for (const ten of chay) {
      const viecDon: Array<() => Promise<unknown>> = [];
      const trangDaMo: Page[] = [];
      const batDau = Date.now();
      try {
        const mod = (await import(join(THU_MUC, `${ten}.ts`))) as {
          default: (n: NguCanhE2E) => Promise<void>;
        };
        await mod.default(taoNguCanh(trinhDuyet, ten, viecDon, trangDaMo));
        console.log(`[ĐẠT] ${ten} (${((Date.now() - batDau) / 1000).toFixed(1)} giây)`);
      } catch (err) {
        hong++;
        // Chụp mọi trang đang mở lúc hỏng, trước khi dọn dẹp đóng chúng.
        await mkdir(join(THU_MUC, ".anh"), { recursive: true });
        for (const [i, p] of trangDaMo.entries()) {
          await p
            .screenshot({ path: join(THU_MUC, ".anh", `${ten}-loi-${i + 1}.png`), fullPage: true })
            .catch(() => {});
        }
        console.error(`[HỎNG] ${ten}: ${err instanceof Error ? err.message : err}`);
      } finally {
        for (const fn of viecDon.reverse()) await fn().catch(() => {});
      }
    }
  } finally {
    await trinhDuyet.close();
    dungMayChu(mayChu);
    await sql.end();
  }
  console.log(`${chay.length - hong}/${chay.length} kịch bản đạt. Ảnh chụp ở scripts/e2e/.anh/`);
  process.exit(hong ? 1 : 0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
