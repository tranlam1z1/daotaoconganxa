/**
 * Kịch bản E2E trang chủ mobile-first ở khung 360, 390, 430 và 1024px, khi chưa và đã đăng nhập:
 * - không cuộn ngang, không phần tử nào tràn mép phải (trừ các trang carousel nằm ngoài khung);
 * - thanh điều hướng dưới không che nội dung khi cuộn hết trang;
 * - mọi nút, liên kết trong nội dung trang có vùng chạm ≥ 44 × 44px (trừ liên kết nằm giữa câu);
 * - các ô chức năng hết khung chờ sau khi số liệu về.
 */
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";

const KHUNG = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
];

async function kiemTrangChu(n: NguCanhE2E, page: Page, noi: string, dienThoai: boolean) {
  await page.getByRole("heading", { level: 1, name: /^Xin chào/ }).waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  await n.kiemKhongCuonNgang(page, noi);

  const tran = await page.evaluate(() => {
    const rong = document.documentElement.clientWidth;
    return [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((el) => !el.closest(".khong-thanh-cuon, dialog, .sr-only") && el.getClientRects().length > 0)
      .filter((el) => el.getBoundingClientRect().right > rong + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
  });
  if (tran.length) throw new Error(`${noi}: phần tử tràn mép phải: ${tran.join(" | ")}`);

  const nhoQua = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#noi-dung-chinh :is(a, button)")]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "inline")
      .map((el) => ({
        ten: el.textContent?.trim() || el.getAttribute("aria-label"),
        r: el.getBoundingClientRect(),
      }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ ten, r }) => `"${ten}" ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  if (nhoQua.length) throw new Error(`${noi}: vùng chạm dưới 44px: ${nhoQua.join(", ")}`);

  if (dienThoai) {
    // Cuộn hết trang: phần nội dung và chân trang phải nằm trên thanh điều hướng dưới.
    const che = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const thanh = document.querySelector("nav.fixed")?.getBoundingClientRect();
      if (!thanh) return "không thấy thanh điều hướng dưới";
      const cuoi = ["#noi-dung-chinh", "footer"]
        .map((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      return cuoi > thanh.top + 1
        ? `nội dung tới ${Math.round(cuoi)}px, thanh bắt đầu ${Math.round(thanh.top)}px`
        : null;
    });
    if (che) throw new Error(`${noi}: thanh dưới che nội dung (${che}).`);
  }
}

export default async function trangChu(n: NguCanhE2E) {
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ trang chủ E2E" });

  for (const khung of KHUNG) {
    const dienThoai = khung.width < 768;
    const khach = await n.moTrang(khung);
    await khach.goto(`${n.web}/`);
    await kiemTrangChu(n, khach, `Chưa đăng nhập ${khung.width}px`, dienThoai);
    await khach.getByRole("link", { name: "Đăng nhập" }).first().waitFor();
    await n.chupAnh(khach, `khach-${khung.width}`);

    const page = await n.moTrang(khung);
    await n.dangNhap(page, tk);
    await page.goto(`${n.web}/`);
    await page.getByRole("heading", { level: 1, name: "Xin chào, Cán bộ trang chủ E2E" }).waitFor();
    await kiemTrangChu(n, page, `Đã đăng nhập ${khung.width}px`, dienThoai);
    if (dienThoai) await page.getByRole("link", { name: "Trang cá nhân" }).waitFor();
    await n.chupAnh(page, `can-bo-${khung.width}`);
  }
}
