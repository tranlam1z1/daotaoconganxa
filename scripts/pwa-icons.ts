/** Sinh favicon/PWA và logo offline từ hình học nhận diện dùng chung. Chạy: bun run scripts/pwa-icons.ts */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { brandMarkSvg } from "../apps/web/app/lib/brand-mark";

const PUBLIC = join(import.meta.dir, "..", "apps", "web", "public");
const THU_MUC = join(PUBLIC, "icons");
/** Nền đỏ của bản ứng dụng theo bộ nhận diện mới. */
const DO_THUONG_HIEU = "#A61C30";
/** Tỉ lệ chiều cao / chiều rộng của dấu logo trong logo.svg. */
const TINH = 1;

type Kieu = { nen: string | null; trang: boolean; rong: number };
/** Manifest "any": nền kem, logo màu đầy đủ. */
const THUONG: Kieu = { nen: "#FFF9EE", trang: false, rong: 0.88 };
/** Manifest "maskable": nền phủ kín, hình nằm trong vùng an toàn; Android tự cắt theo hình của máy. */
const MASKABLE: Kieu = { nen: DO_THUONG_HIEU, trang: true, rong: 0.62 };
/** iOS tự bo góc, nên icon màn hình chính của iPhone, iPad để vuông, phủ kín. */
const APPLE: Kieu = { nen: DO_THUONG_HIEU, trang: true, rong: 0.78 };

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

const svg = brandMarkSvg();
await writeFile(join(PUBLIC, "logo.svg"), svg);
const offlinePath = join(PUBLIC, "offline.html");
const offline = await readFile(offlinePath, "utf8");
await writeFile(
  offlinePath,
  offline.replace(/<svg class="dau"[\s\S]*?<\/svg>/, svg.replace("<svg ", '<svg class="dau" ')),
);
/** Bản trắng đơn sắc: thay mọi chỗ tô gradient bằng trắng (bản "âm" của thương hiệu). */
const svgTrang = brandMarkSvg(true);

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
        // Logo vuông: đặt giữa và chừa vùng an toàn theo từng nền tảng.
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
