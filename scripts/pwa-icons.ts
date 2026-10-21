/**
 * Sinh icon ứng dụng cài được (PWA) cho apps/web/public/icons (docs/PLAN.md GĐ13).
 *
 *   bun run scripts/pwa-icons.ts
 *
 * Vẽ logo "Khiên tri thức" (apps/web/public/logo.svg, cùng hình với logo ở thanh đầu trang) lên
 * canvas của Chrome có sẵn trên máy (playwright-core, như scripts/e2e). Hình trong logo.svg đã chừa
 * lề sẵn (khiên chiếm khoảng 88×106 trên khung 120×120).
 *
 * Cỡ hình theo icon ứng dụng điện thoại (tính theo cạnh khung logo so với cạnh icon):
 *  - Icon thường: nền trong suốt, logo phủ cả icon.
 *  - Icon "maskable": Android chỉ hiện vùng giữa khoảng 72/108 cạnh (hình tròn, bo góc…), vùng an
 *    toàn là hình tròn đường kính 66/108. Logo 60% cạnh: góc trên của khiên cách tâm khoảng 29%
 *    cạnh, vẫn nằm trọn trong vùng an toàn (bán kính 30.5%).
 *  - Icon iPhone: iOS tự bo góc và không nhận nền trong suốt, nên nền giấy phủ kín, logo 80% cạnh.
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
const CANVAS = "#f7f5f0";

type Kieu = { nen: string | null; logo: number };
/** Manifest "any": nền trong suốt. */
const THUONG: Kieu = { nen: null, logo: 1 };
/** Manifest "maskable": nền phủ kín, hình nằm trong vùng an toàn; Android tự cắt theo hình của máy. */
const MASKABLE: Kieu = { nen: CANVAS, logo: 0.6 };
/** iOS tự bo góc, nên icon màn hình chính của iPhone, iPad để vuông, phủ kín. */
const APPLE: Kieu = { nen: CANVAS, logo: 0.8 };

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
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

await mkdir(THU_MUC, { recursive: true });
const trinhDuyet = await chromium.launch({ executablePath: timChrome() });
try {
  const page = await trinhDuyet.newPage();
  for (const i of ICON) {
    const dataUrl = await page.evaluate(
      async ({ co, nen, logo, svgUrl }) => {
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
        const canh = co * logo;
        ctx.drawImage(anh, (co - canh) / 2, (co - canh) / 2, canh, canh);
        return c.toDataURL("image/png");
      },
      { co: i.co, nen: i.kieu.nen, logo: i.kieu.logo, svgUrl },
    );
    await writeFile(join(THU_MUC, i.ten), Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
    console.log(`  ${i.ten} (${i.co}×${i.co})`);
  }
} finally {
  await trinhDuyet.close();
}
