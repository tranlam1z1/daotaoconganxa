/**
 * Sinh icon ứng dụng cài được (PWA) cho apps/web/public/icons (docs/PLAN.md GĐ13).
 *
 *   bun run scripts/pwa-icons.ts
 *
 * Vẽ logo "Học tập pháp luật & Bồi dưỡng nghiệp vụ" (apps/web/public/logo.svg, cùng hình với
 * logo ở thanh đầu trang) lên canvas của Chrome có sẵn trên máy (playwright-core, như
 * scripts/e2e).
 *
 * Căn cứ thương hiệu (docs/brand): bản "Icon ứng dụng" là dấu logo màu trắng đặt trên nền
 * xanh dương #0052CC. Vì vậy:
 *  - Icon thường (manifest "any"): nền trong suốt, logo màu đầy đủ phủ ~95% cạnh.
 *  - Icon "maskable": Android chỉ hiện vùng giữa khoảng 80/108 cạnh (hình tròn, bo góc…), vùng
 *    an toàn là hình tròn đường kính 80/108. Logo rộng nên chừa sao cho cả góc chữa vẫn nằm
 *    trong vùng an toàn.
 *  - Icon iPhone: iOS tự bo góc và không nhận nền trong suốt, nên nền xanh #0052CC phủ kín,
 *    dấu logo màu trắng.
 *
 * Sinh lại icon thì tăng số `?v=` ở manifest.webmanifest, root.tsx, sw.js và offline.html: service
 * worker giữ icon theo kiểu cache-first, máy đã cài chỉ lấy icon mới khi URL đổi.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const PUBLIC = join(import.meta.dir, "..", "apps", "web", "public");
const THU_MUC = join(PUBLIC, "icons");
/** Xanh dương thương hiệu (docs/brand): nền của icon ứng dụng. */
const XANH_DUONG = "#0052CC";
/** Tỉ lệ chiều cao / chiều rộng của dấu logo trong logo.svg. */
const TINH = 323 / 429;

type Kieu = { nen: string | null; trang: boolean; rong: number };
/** Manifest "any": nền trong suốt, logo màu đầy đủ. */
const THUONG: Kieu = { nen: null, trang: false, rong: 0.95 };
/** Manifest "maskable": nền phủ kín, hình nằm trong vùng an toàn; Android tự cắt theo hình của máy. */
const MASKABLE: Kieu = { nen: XANH_DUONG, trang: true, rong: 0.62 };
/** iOS tự bo góc, nên icon màn hình chính của iPhone, iPad để vuông, phủ kín. */
const APPLE: Kieu = { nen: XANH_DUONG, trang: true, rong: 0.78 };

const ICON: Array<{ ten: string; co: number; kieu: Kieu }> = [
  // Android: mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192; 512 cho màn hình chờ, cửa hàng.
  ...[48, 72, 96, 144, 192, 512].map((co) => ({ ten: `icon-${co}.png`, co, kieu: THUONG })),
  ...[192, 512].map((co) => ({ ten: `maskable-${co}.png`, co, kieu: MASKABLE })),
  // iPhone @3x 180 (tên mặc định), iPad Pro 167, iPad 152, iPhone @2x 120.
  { ten: "apple-touch-icon.png", co: 180, kieu: APPLE },
  ...[167, 152, 120].map((co) => ({ ten: `apple-touch-icon-${co}.png`, co, kieu: APPLE })),
];

function timChrome(): string {
  const ung = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((x): x is string => Boolean(x));
  const co = ung.find((p) => existsSync(p));
  if (!co) throw new Error("Không tìm thấy Chrome. Đặt CHROME_PATH.");
  return co;
}

const svg = await readFile(join(PUBLIC, "logo.svg"), "utf8");
/** Bản trắng đơn sắc: thay mọi chỗ tô gradient bằng trắng (bản "âm" của thương hiệu). */
const svgTrang = svg.replace(/fill="url\(#[^"]+\)"/g, 'fill="#FFFFFF"');

const duongDan = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;

await mkdir(THU_MUC, { recursive: true });
const trinhDuyet = await chromium.launch({ executablePath: timChrome() });
try {
  const page = await trinhDuyet.newPage();
  for (const i of ICON) {
    const dataUrl = await page.evaluate(
      async ({ co, nen, rong, tinh, svgUrl }) => {
        const anh = new Image();
        anh.src = svgUrl;
        await anh.decode();
        const c = document.createElement("canvas");
        c.width = co;
        c.height = co;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Không mở được canvas 2D.");
        if (nen) {
          ctx.fillStyle = nen;
          ctx.fillRect(0, 0, co, co);
        }
        // Logo rộng hơn cao: canh theo cạnh ngang rồi đặt giữa theo chiều cao.
        const r = co * rong;
        const cao = r * tinh;
        ctx.drawImage(anh, (co - r) / 2, (co - cao) / 2, r, cao);
        return c.toDataURL("image/png");
      },
      {
        co: i.co,
        nen: i.kieu.nen,
        rong: i.kieu.rong,
        tinh: TINH,
        svgUrl: duongDan(i.kieu.trang ? svgTrang : svg),
      },
    );
    await writeFile(join(THU_MUC, i.ten), Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
    console.log(`  ${i.ten} (${i.co}×${i.co})`);
  }
} finally {
  await trinhDuyet.close();
}
