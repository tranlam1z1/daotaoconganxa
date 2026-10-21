/**
 * Chụp hình minh hoạ trực tiếp từ giao diện đang chạy, khoanh đỏ và ghi chú từng vùng.
 *
 * Lớp khoanh vẽ bằng DOM ngay trong trang (position: fixed, toạ độ khung nhìn) rồi mới chụp, nên
 * chữ ghi chú dùng đúng phông của trình duyệt và khung đỏ khớp từng điểm ảnh với thành phần thật.
 */
import { existsSync } from "node:fs";

import { type Browser, chromium, type Locator, type Page } from "playwright-core";

import type { KichBanAnh, ThaoTac, ThietBi } from "../../apps/web/app/lib/huong-dan.ts";

export const MAU_DO = "#d71920";

export const KHUNG_NHIN: Record<
  ThietBi,
  {
    viewport: { width: number; height: number };
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
  }
> = {
  "may-tinh": {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  "dien-thoai": {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

export class LoiKichBan extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoiKichBan";
  }
}

export async function moTrinhDuyet(): Promise<Browser> {
  const duongDan = process.env.CHROMIUM_PATH ?? chromium.executablePath();
  if (!existsSync(duongDan)) {
    throw new Error(
      `Không tìm thấy Chromium tại ${duongDan}. Cài bằng: bunx playwright install chromium, hoặc đặt CHROMIUM_PATH.`,
    );
  }
  return await chromium.launch({
    executablePath: duongDan,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/** Tắt con trỏ nhấp nháy, chuyển động và thanh cuộn để hình ổn định giữa các lần chụp. */
const CSS_CHUP = `
*, *::before, *::after { caret-color: transparent !important; transition: none !important; animation: none !important; }
html { scrollbar-width: none !important; }
::-webkit-scrollbar { display: none !important; }
`;

async function choThay(loc: Locator, boChon: string, url: string): Promise<void> {
  try {
    await loc.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    throw new LoiKichBan(`Không thấy thành phần "${boChon}" trên ${url}.`);
  }
}

async function thucHien(page: Page, tt: ThaoTac, url: string): Promise<void> {
  if ("bam" in tt) {
    const loc = page.locator(tt.bam).first();
    await choThay(loc, tt.bam, url);
    await loc.click();
  } else if ("nhap" in tt) {
    const loc = page.locator(tt.nhap).first();
    await choThay(loc, tt.nhap, url);
    await loc.fill(tt.gia_tri);
  } else if ("cho" in tt) {
    await choThay(page.locator(tt.cho).first(), tt.cho, url);
  } else if ("doi_ms" in tt) {
    await page.waitForTimeout(tt.doi_ms);
  } else if ("phim" in tt) {
    await page.keyboard.press(tt.phim);
  }
}

interface Hop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface HopDanhDau extends Hop {
  so: number;
  ghi_chu: string;
  huong: string;
}

/** Chạy trong trang: vẽ khung đỏ, số thứ tự, nhãn ghi chú, đường nối; trả vùng bao tất cả. */
function veDanhDau(arg: { hop: HopDanhDau[]; vung: Hop; vw: number; vh: number; mau: string }): Hop {
  const { hop, vung, vw, vh, mau } = arg;
  const goc = document.createElement("div");
  goc.setAttribute("data-hd-lop-danh-dau", "");
  Object.assign(goc.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${vw}px`,
    height: `${vh}px`,
    zIndex: "2147483647",
    pointerEvents: "none",
    fontFamily: '"Be Vietnam Pro", "Inter", "Noto Sans", system-ui, sans-serif',
  });
  // Hộp thoại modal nằm ở lớp trên cùng (top layer), phủ lên mọi thứ trong body kể cả z-index lớn nhất;
  // lớp khoanh phải nằm trong chính hộp thoại đang mở mới hiện lên trên nó.
  const dialogMo = [...document.querySelectorAll("dialog[open]")].at(-1);
  (dialogMo ?? document.body).appendChild(goc);
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("width", String(vw));
  svg.setAttribute("height", String(vh));
  Object.assign(svg.style, { position: "absolute", left: "0", top: "0", overflow: "visible" });
  goc.appendChild(svg);

  const giao = (a: Hop, b: Hop) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const hop1 = (a: Hop, b: Hop): Hop => {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const trong = (a: Hop) => a.x >= 4 && a.y >= 4 && a.x + a.w <= vw - 4 && a.y + a.h <= vh - 4;

  const khung = hop.map((h) => ({ x: h.x - 5, y: h.y - 5, w: h.w + 10, h: h.h + 10 }));
  const nhanDaDat: Hop[] = [];
  let bao: Hop = { ...vung };

  hop.forEach((h, i) => {
    const k = khung[i]!;
    const vien = document.createElement("div");
    Object.assign(vien.style, {
      position: "absolute",
      left: `${k.x}px`,
      top: `${k.y}px`,
      width: `${k.w}px`,
      height: `${k.h}px`,
      border: `3px solid ${mau}`,
      borderRadius: "10px",
      boxSizing: "border-box",
      boxShadow: "0 0 0 2px rgba(255,255,255,.9), 0 2px 12px rgba(215,25,32,.35)",
    });
    goc.appendChild(vien);

    const nhan = document.createElement("div");
    Object.assign(nhan.style, {
      position: "absolute",
      left: "0",
      top: "0",
      display: "flex",
      alignItems: "flex-start",
      gap: "7px",
      maxWidth: "280px",
      background: "#ffffff",
      color: "#1b1b1b",
      border: `2px solid ${mau}`,
      borderRadius: "8px",
      padding: "5px 10px 5px 5px",
      font: "600 13.5px/1.35 inherit",
      boxShadow: "0 4px 14px rgba(0,0,0,.18)",
      boxSizing: "border-box",
    });
    const soNhan = document.createElement("span");
    Object.assign(soNhan.style, {
      flex: "none",
      width: "21px",
      height: "21px",
      borderRadius: "999px",
      background: mau,
      color: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      font: "700 12px/1 inherit",
    });
    soNhan.textContent = String(h.so);
    const chu = document.createElement("span");
    chu.textContent = h.ghi_chu;
    chu.style.paddingTop = "1px";
    nhan.append(soNhan, chu);
    goc.appendChild(nhan);
    const nw = nhan.offsetWidth;
    const nh = nhan.offsetHeight;
    const cach = 18;
    const viTri = (huong: string): Hop => {
      switch (huong) {
        case "trai":
          return { x: k.x - cach - nw, y: k.y + k.h / 2 - nh / 2, w: nw, h: nh };
        case "duoi":
          return { x: k.x + k.w / 2 - nw / 2, y: k.y + k.h + cach, w: nw, h: nh };
        case "tren":
          return { x: k.x + k.w / 2 - nw / 2, y: k.y - cach - nh, w: nw, h: nh };
        default:
          return { x: k.x + k.w + cach, y: k.y + k.h / 2 - nh / 2, w: nw, h: nh };
      }
    };
    const vaCham = (a: Hop) =>
      nhanDaDat.some((b) => giao(a, b)) || khung.some((b, j) => j !== i && giao(a, b));
    const thuTu = [...new Set([h.huong, "phai", "duoi", "trai", "tren"])];
    let chon = thuTu.map(viTri).find((p) => trong(p) && !vaCham(p)) ?? viTri(h.huong);
    chon.x = Math.min(Math.max(chon.x, 4), vw - 4 - nw);
    chon.y = Math.min(Math.max(chon.y, 4), vh - 4 - nh);
    for (let lan = 0; lan < 60 && nhanDaDat.some((b) => giao(chon, b)); lan++) {
      chon = { ...chon, y: Math.min(chon.y + 8, vh - 4 - nh) };
    }
    nhan.style.left = `${chon.x}px`;
    nhan.style.top = `${chon.y}px`;
    nhanDaDat.push(chon);

    // Đường nối từ nhãn tới khung, chỉ vẽ khi hai bên không chạm nhau.
    if (!giao(chon, k)) {
      const tamNhan = { x: chon.x + chon.w / 2, y: chon.y + chon.h / 2 };
      const tamKhung = { x: k.x + k.w / 2, y: k.y + k.h / 2 };
      const kep = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
      const p1 = { x: kep(tamKhung.x, chon.x, chon.x + chon.w), y: kep(tamKhung.y, chon.y, chon.y + chon.h) };
      const p2 = { x: kep(tamNhan.x, k.x, k.x + k.w), y: kep(tamNhan.y, k.y, k.y + k.h) };
      const duong = document.createElementNS(svgNs, "line");
      duong.setAttribute("x1", String(p1.x));
      duong.setAttribute("y1", String(p1.y));
      duong.setAttribute("x2", String(p2.x));
      duong.setAttribute("y2", String(p2.y));
      duong.setAttribute("stroke", mau);
      duong.setAttribute("stroke-width", "2.5");
      duong.setAttribute("stroke-linecap", "round");
      svg.appendChild(duong);
    }

    const huy = document.createElement("div");
    Object.assign(huy.style, {
      position: "absolute",
      left: `${k.x - 12}px`,
      top: `${k.y - 12}px`,
      width: "24px",
      height: "24px",
      borderRadius: "999px",
      background: mau,
      color: "#fff",
      border: "2px solid #fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      font: "700 12.5px/1 inherit",
      boxSizing: "border-box",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
    });
    huy.textContent = String(h.so);
    goc.appendChild(huy);

    bao = hop1(hop1(bao, k), chon);
    bao = hop1(bao, { x: k.x - 12, y: k.y - 12, w: 24, h: 24 });
  });

  const dem = 10;
  const x = Math.max(0, Math.floor(bao.x - dem));
  const y = Math.max(0, Math.floor(bao.y - dem));
  return {
    x,
    y,
    w: Math.min(vw, Math.ceil(bao.x + bao.w + dem)) - x,
    h: Math.min(vh, Math.ceil(bao.y + bao.h + dem)) - y,
  };
}

const LOC_LAM_MO = "blur(6px)";

/**
 * Chạy trong trang: làm mờ email, token phiên và số điện thoại ở mọi nút chữ và ô nhập.
 * Hình minh hoạ được phát hành công khai nên không được lộ thông tin cá nhân, kể cả của tài khoản thật
 * xuất hiện trong các bảng quản trị.
 */
function lamMoTuDong(loc: string): number {
  const mau = () =>
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+|qdpl_[A-Za-z0-9_-]{10,}|(?<![\d/.-])(?:\+84|0)\d{9,10}(?![\d/])/g;
  const nut: Text[] = [];
  const duyet = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (duyet.nextNode()) {
    const n = duyet.currentNode as Text;
    if (mau().test(n.data)) nut.push(n);
  }
  let dem = 0;
  for (const n of nut) {
    const manh = document.createDocumentFragment();
    const re = mau();
    let cuoi = 0;
    for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
      manh.append(n.data.slice(cuoi, m.index));
      const vo = document.createElement("span");
      vo.textContent = m[0];
      Object.assign(vo.style, { filter: loc, display: "inline-block" });
      manh.append(vo);
      cuoi = m.index + m[0].length;
      dem++;
    }
    manh.append(n.data.slice(cuoi));
    n.replaceWith(manh);
  }
  for (const o of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")) {
    if (mau().test(o.value)) {
      o.style.filter = loc;
      dem++;
    }
  }
  return dem;
}

async function lamMo(page: Page, kb: KichBanAnh): Promise<void> {
  await page.evaluate(lamMoTuDong, LOC_LAM_MO);
  for (const boChon of kb.lam_mo ?? []) {
    await page.locator(boChon).evaluateAll((ds, loc) => {
      for (const el of ds) (el as HTMLElement).style.filter = loc;
    }, LOC_LAM_MO);
  }
}

async function doiHydrate(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => Boolean((window as any).__reactRouterRouteModules) && document.readyState === "complete",
      {
        timeout: 20_000,
      },
    )
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

export interface TuyChonChup {
  coSo: string;
  kb: KichBanAnh;
  tepRa: string;
  tokenPhien?: string;
}

export async function chupAnh(browser: Browser, { coSo, kb, tepRa, tokenPhien }: TuyChonChup): Promise<void> {
  const khung = KHUNG_NHIN[kb.thiet_bi ?? "may-tinh"];
  const ctx = await browser.newContext({
    ...khung,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  try {
    if (kb.dang_nhap) {
      if (!tokenPhien) throw new LoiKichBan("Hình này cần phiên đăng nhập nhưng chưa lấy được phiên.");
      await ctx.addCookies([{ name: "qdpl_phien", value: tokenPhien, url: coSo }]);
    }
    const page = await ctx.newPage();
    const url = new URL(kb.url, coSo).toString();
    const phanHoi = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    if (!phanHoi || phanHoi.status() >= 400) {
      throw new LoiKichBan(`${kb.url} trả về HTTP ${phanHoi?.status() ?? "không phản hồi"}.`);
    }
    await doiHydrate(page);
    for (const tt of kb.thao_tac ?? []) await thucHien(page, tt, kb.url);
    await page.addStyleTag({ content: CSS_CHUP });
    await lamMo(page, kb);
    await page.evaluate(() => document.fonts.ready);

    const { width: vw } = khung.viewport;
    let vh = khung.viewport.height;
    const cuonToi = async (loc: Locator) => {
      const cuon = (dinh: number) =>
        loc.evaluate((el, d) => {
          const r = el.getBoundingClientRect();
          // Chừa khoảng cho số thứ tự và lề cắt, để vùng cắt không lẹm vào các thanh dính trên cùng.
          window.scrollTo({ top: window.scrollY + r.top - d - 48, behavior: "instant" });
        }, dinh);
      // Đo chiều cao phần bị che SAU khi cuộn: thanh tiêu đề văn bản chỉ dính khi đã cuộn qua nó.
      const dinhBiChe = () =>
        page.evaluate(() => {
          let day = 0;
          for (const el of document.querySelectorAll<HTMLElement>("body *")) {
            const vt = getComputedStyle(el).position;
            if (vt !== "sticky" && vt !== "fixed") continue;
            const r = el.getBoundingClientRect();
            if (r.top < 200 && r.bottom < window.innerHeight / 3 && r.width > window.innerWidth / 2) {
              day = Math.max(day, r.bottom);
            }
          }
          return day;
        });
      await cuon(
        await page.evaluate(() => document.querySelector("header")?.getBoundingClientRect().height ?? 0),
      );
      await page.waitForTimeout(150);
      await cuon(await dinhBiChe());
      await page.waitForTimeout(200);
    };

    let vung = { x: 0, y: 0, w: vw, h: vh };
    if (kb.vung) {
      const loc = page.locator(kb.vung).first();
      await choThay(loc, kb.vung, kb.url);
      const cao = (await loc.boundingBox())?.height ?? 0;
      const can = Math.ceil(cao + 140);
      if (can > vh) {
        vh = Math.min(can, 3000);
        await page.setViewportSize({ width: vw, height: vh });
      }
      await cuonToi(loc);
      const b = (await loc.boundingBox())!;
      vung = { x: Math.max(0, b.x - 12), y: Math.max(0, b.y - 12), w: b.width + 24, h: b.height + 24 };
    } else if (kb.danh_dau[0]) {
      // Không khai vùng: nếu vùng khoanh đầu tiên nằm ngoài màn hình đầu thì cuộn tới nó.
      const loc = page.locator(kb.danh_dau[0].o).first();
      await choThay(loc, kb.danh_dau[0].o, kb.url);
      const b = await loc.boundingBox();
      if (b && b.y + b.height > vh) await cuonToi(loc);
    }

    const hop: HopDanhDau[] = [];
    for (const [i, d] of kb.danh_dau.entries()) {
      const loc = page.locator(d.o).first();
      await choThay(loc, d.o, kb.url);
      const b = await loc.boundingBox();
      if (!b) throw new LoiKichBan(`Thành phần "${d.o}" không có kích thước trên ${kb.url}.`);
      hop.push({
        x: b.x,
        y: b.y,
        w: b.width,
        h: b.height,
        so: i + 1,
        ghi_chu: d.ghi_chu,
        huong: d.huong ?? "phai",
      });
    }

    const cat = await page.evaluate(veDanhDau, { hop, vung, vw, vh, mau: MAU_DO });
    await page.screenshot({
      path: tepRa,
      clip: { x: cat.x, y: cat.y, width: cat.w, height: cat.h },
      animations: "disabled",
      caret: "hide",
    });
  } finally {
    await ctx.close();
  }
}
