/**
 * Kịch bản E2E trang chủ mobile-first ở khung 360, 390, 430 và 1024px, khi chưa và đã đăng nhập:
 * - không cuộn ngang, không phần tử nào tràn mép phải (trừ các trang carousel nằm ngoài khung);
 * - thanh điều hướng dưới không che nội dung khi cuộn hết trang;
 * - carousel trò chơi (cần đăng nhập) có số chấm bằng số trang, bấm chấm thì sang trang; mũi tên
 * chỉ hiện từ 768px; chạm thẻ trò không có màn là vào chơi ngay; khách thấy lời mời đăng nhập;
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

async function kiemTrangChu(n: NguCanhE2E, page: Page, noi: string, dienThoai: boolean, daDangNhap: boolean) {
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

  // Carousel: số trang = trần(số thẻ / 6); số chấm = số trang (một trang thì không có chấm).
  const carousel = page.locator('section[aria-labelledby="tro-choi-tieu-de"]');
  if (!daDangNhap) {
    await carousel.getByText("Đăng nhập để chơi và lưu điểm.").waitFor();
    if (await carousel.locator("ul").count())
      throw new Error(`${noi}: khách không được thấy danh sách trò chơi.`);
  }
  const soThe = await carousel.locator("ul > li").count();
  const soTrang = await carousel.locator("ul").count();
  if ((daDangNhap && soThe < 1) || soTrang !== Math.ceil(soThe / 6)) {
    throw new Error(`${noi}: carousel có ${soThe} thẻ nhưng ${soTrang} trang.`);
  }
  const cham = carousel.getByRole("button", { name: /^Tới trang/ });
  if ((await cham.count()) !== (soTrang > 1 ? soTrang : 0)) {
    throw new Error(`${noi}: ${await cham.count()} chấm cho ${soTrang} trang.`);
  }
  if (soTrang > 1) {
    const muiTen = await carousel.getByRole("button", { name: "Trang sau" }).isVisible();
    if (muiTen === dienThoai) throw new Error(`${noi}: mũi tên ${muiTen ? "hiện" : "ẩn"} sai khung.`);
    // Chấm đổi ngay giữa lúc cuộn; chờ cuộn dừng đúng mép trang để thẻ không bị cắt.
    const vungCuon = await carousel.locator(".khong-thanh-cuon").elementHandle();
    const dungTaiTrang = (i: number) =>
      page.waitForFunction(([el, trang]) => Math.abs(el!.scrollLeft - trang * el!.clientWidth) < 1, [
        vungCuon,
        i,
      ] as const);
    await cham.nth(1).click();
    await carousel.locator('button[aria-label="Tới trang 2"][aria-current="true"]').waitFor();
    await dungTaiTrang(1);
    await cham.nth(0).click();
    await dungTaiTrang(0);
    await carousel.locator('button[aria-label="Tới trang 1"][aria-current="true"]').waitFor();
  }

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
    await kiemTrangChu(n, khach, `Chưa đăng nhập ${khung.width}px`, dienThoai, false);
    await khach.getByRole("link", { name: "Đăng nhập" }).first().waitFor();
    await n.chupAnh(khach, `khach-${khung.width}`);

    const page = await n.moTrang(khung);
    await n.dangNhap(page, tk);
    await page.goto(`${n.web}/`);
    await page.getByRole("heading", { level: 1, name: "Xin chào, Cán bộ trang chủ E2E" }).waitFor();
    await kiemTrangChu(n, page, `Đã đăng nhập ${khung.width}px`, dienThoai, true);
    // Thẻ "Thử thách hôm nay" (GĐ9) vẫn ở trang chủ sau khi đổi bố cục.
    await page.getByRole("heading", { name: "Thử thách hôm nay" }).waitFor();
    if (dienThoai) await page.getByRole("link", { name: "Trang cá nhân" }).waitFor();
    await n.chupAnh(page, `can-bo-${khung.width}`);
  }

  // Chạm thẻ trên carousel (khung 360px). Trò mẫu "Trắc nghiệm nhanh" luôn bật (migration 0027).
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/`);
  const carousel = page.locator('section[aria-labelledby="tro-choi-tieu-de"]');
  const vuotMan = carousel.getByRole("link", { name: "Vượt màn" });
  if (await vuotMan.count()) {
    await vuotMan.click();
    await page.waitForURL((u) => u.pathname === "/tro-choi" && u.searchParams.get("tro") === "vuot_man");
    await page.getByRole("heading", { name: "Vượt màn" }).waitFor();
    await page.goto(`${n.web}/`);
  }
  // Trò không có màn: một chạm là vào câu đầu tiên.
  await carousel.getByRole("button", { name: "Trắc nghiệm nhanh" }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/tro-choi/luot/"));
  await page.getByText("Câu 1/3").waitFor();
}
