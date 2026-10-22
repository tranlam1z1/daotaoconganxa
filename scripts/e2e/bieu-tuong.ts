/**
 * Chụp ảnh soát bộ biểu tượng (docs/PROMPT_BO_ICON.md mục 1, "Kiểm tra trước khi xong"): khung
 * 360×740, giao diện sáng và tối, các trang trang chủ, thanh điều hướng dưới (cả ngăn "Thêm"),
 * /toi, /tra-cuu-nhanh, một trang bài giảng; thêm trang xem trước
 * /xem-bieu-tuong ở khung 1280px.
 *
 *   E2E_NHAN=truoc QDPL_XEM_BIEU_TUONG=1 bun run e2e bieu-tuong
 *
 * Ảnh ở scripts/e2e/.anh/bieu-tuong-<nhãn>-<trang>-<sang|toi>.png (nhãn mặc định "sau"), để đặt
 * ảnh trước/sau cạnh nhau. Trang xem trước chỉ mở khi máy chủ web có QDPL_XEM_BIEU_TUONG=1; thiếu
 * biến này thì bỏ qua ảnh đó. Ngoài ra kịch bản kiểm mọi trang không cuộn ngang.
 */
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";

const NHAN = process.env.E2E_NHAN ?? "sau";
const GIAO_DIEN = [
  { ten: "sang", colorScheme: "light" },
  { ten: "toi", colorScheme: "dark" },
] as const;

async function mo(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

export default async function bieuTuong(n: NguCanhE2E) {
  const [bai] = await n.sql<Array<{ chuyen_de: string; slug: string }>>`
    SELECT c.slug AS chuyen_de, l.slug
    FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban'
    ORDER BY c.slug, l.ordinal LIMIT 1`;
  if (!bai) throw new Error("CSDL chưa có bài giảng xuất bản.");

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ biểu tượng E2E" });
  const TRANG = [
    { ten: "trang-chu", url: "/" },
    { ten: "toi", url: "/toi" },
    { ten: "tra-cuu-nhanh", url: "/tra-cuu-nhanh" },
    { ten: "bai-giang", url: `/hoc/${bai.chuyen_de}/${bai.slug}` },
  ];

  for (const gd of GIAO_DIEN) {
    const page = await n.moTrang();
    await page.emulateMedia({ colorScheme: gd.colorScheme, reducedMotion: "reduce" });
    await n.dangNhap(page, tk);

    for (const t of TRANG) {
      await mo(page, `${n.web}${t.url}`);
      await n.kiemKhongCuonNgang(page, t.url);
      await n.chupAnh(page, `${NHAN}-${t.ten}-${gd.ten}`);
    }

    // Thanh điều hướng dưới và ngăn "Thêm": chụp khung nhìn (thanh dính đáy màn hình).
    await mo(page, `${n.web}/hoc`);
    await page.screenshot({ path: duongAnh(`${NHAN}-thanh-duoi-${gd.ten}`) });
    await page.getByRole("button", { name: "Thêm" }).click();
    await page.locator("dialog.sheet[open]").waitFor();
    await page.screenshot({ path: duongAnh(`${NHAN}-ngan-them-${gd.ten}`) });
  }

  // Trang xem trước tự đặt hai bảng sáng và tối cạnh nhau: một ảnh là đủ.
  const rong = await n.moTrang({ width: 1280, height: 900 });
  await rong.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const res = await rong.goto(`${n.web}/xem-bieu-tuong`, { waitUntil: "networkidle" });
  if (res?.status() === 200) await n.chupAnh(rong, `${NHAN}-xem-truoc`);
  else console.log("  Bỏ qua /xem-bieu-tuong: máy chủ web chưa đặt QDPL_XEM_BIEU_TUONG=1.");
}

function duongAnh(ten: string) {
  return `${import.meta.dir}/.anh/bieu-tuong-${ten}.png`;
}
