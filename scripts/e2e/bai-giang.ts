/**
 * Kịch bản E2E bài giảng (docs/PLAN.md GĐ11) trên khung điện thoại 360×740:
 *  1. mở MỌI bài `xuat_ban` của lĩnh vực giao thông ở chế độ đọc cuộn và chế độ slide: không lỗi
 *     JavaScript, không cuộn ngang, chế độ slide chuyển trang được bằng phím mũi tên;
 *  2. chế độ slide chuyển trang bằng vuốt ngang;
 *  3. hoàn thành một bài (được cộng XP), rồi vào kiểm tra cuối bài (phiên luyện tập của GĐ4);
 *  4. đường cũ /dao-tao chuyển sang /hoc; menu có mục "Học & luyện tập".
 *
 * Cần CSDL đã gieo bài giảng giao thông (`bun run db:seed:dao-tao:gtdb`, `bun run db:seed:ngan-hang`).
 */
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";

async function trangSlide(page: Page): Promise<{ so: number; tong: number }> {
  const chu = (await page.locator("text=/^Trang \\d+\\/\\d+$/").first().textContent()) ?? "";
  const m = /Trang (\d+)\/(\d+)/.exec(chu);
  if (!m) throw new Error(`Không đọc được số trang slide: "${chu}"`);
  return { so: Number(m[1]), tong: Number(m[2]) };
}

/** Vuốt ngang trên vùng nội dung slide bằng sự kiện chạm thật của trình duyệt. */
async function vuot(page: Page, huong: "trai" | "phai") {
  await page.evaluate((h) => {
    const vung = document.querySelector('[aria-roledescription="trang"]') as HTMLElement;
    const r = vung.getBoundingClientRect();
    const y = r.top + 40;
    const [tu, den] = h === "trai" ? [r.right - 20, r.left + 20] : [r.left + 20, r.right - 20];
    const cham = (x: number) => new Touch({ identifier: 1, target: vung, clientX: x, clientY: y });
    vung.dispatchEvent(
      new TouchEvent("touchstart", { bubbles: true, touches: [cham(tu)], changedTouches: [cham(tu)] }),
    );
    vung.dispatchEvent(
      new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [cham(den)] }),
    );
  }, huong);
}

export default async function baiGiang(n: NguCanhE2E) {
  const bai = await n.sql<Array<{ chuyen_de: string; slug: string; title: string }>>`
    SELECT c.slug AS chuyen_de, l.slug, l.title
    FROM lessons l JOIN courses c ON c.id = l.course_id JOIN fields f ON f.id = c.field_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban' AND f.slug = 'giao-thong-duong-bo'
    ORDER BY c.slug, l.ordinal`;
  if (!bai.length) throw new Error("CSDL chưa có bài giảng giao thông. Chạy bun run db:seed:dao-tao:gtdb.");

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ bài giảng E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 4. Menu và đường cũ.
  await page.goto(`${n.web}/dao-tao`);
  if (new URL(page.url()).pathname !== "/hoc")
    throw new Error(`/dao-tao không chuyển sang /hoc (${page.url()})`);
  await page.locator("h1", { hasText: "Bài giảng" }).waitFor();
  if (!(await page.locator("a", { hasText: "Học & luyện tập" }).count())) {
    throw new Error('Menu không có mục "Học & luyện tập".');
  }
  await n.kiemKhongCuonNgang(page, "/hoc");
  await n.chupAnh(page, "danh-muc");

  // 1. Mọi bài, hai chế độ.
  for (const b of bai) {
    const duong = `${n.web}/hoc/${b.chuyen_de}/${b.slug}`;
    await page.goto(duong);
    await page.locator("h1", { hasText: b.title }).waitFor();
    await page.locator("#ket-bai").waitFor();
    await n.kiemKhongCuonNgang(page, `${b.chuyen_de}/${b.slug} (đọc cuộn)`);

    await page.goto(`${duong}?che_do=slide`);
    await page.locator('[aria-roledescription="trang"]').waitFor();
    const dau = await trangSlide(page);
    if (dau.so !== 1 || dau.tong < 2)
      throw new Error(`${b.slug}: slide bắt đầu sai (${dau.so}/${dau.tong}).`);
    await page.keyboard.press("ArrowRight");
    if ((await trangSlide(page)).so !== 2) throw new Error(`${b.slug}: phím → không sang trang 2.`);
    await page.keyboard.press("ArrowLeft");
    if ((await trangSlide(page)).so !== 1) throw new Error(`${b.slug}: phím ← không về trang 1.`);
    // Đi hết các trang để mọi khối đều được vẽ ở chế độ slide.
    for (let i = 1; i < dau.tong; i++) {
      await page.keyboard.press("ArrowRight");
      await n.kiemKhongCuonNgang(page, `${b.chuyen_de}/${b.slug} (slide trang ${i + 1})`);
    }
    if ((await trangSlide(page)).so !== dau.tong) throw new Error(`${b.slug}: không tới được trang cuối.`);
    await page.locator("#ket-bai").waitFor();
    if (loiTrang.length) throw new Error(`${b.slug}: lỗi JavaScript: ${loiTrang.join("; ")}`);
  }

  // 2. Vuốt ngang ở bài đầu tiên.
  const dauTien = bai[0]!;
  await page.goto(`${n.web}/hoc/${dauTien.chuyen_de}/${dauTien.slug}?che_do=slide`);
  await page.locator('[aria-roledescription="trang"]').waitFor();
  await n.chupAnh(page, "slide");
  await vuot(page, "trai");
  if ((await trangSlide(page)).so !== 2) throw new Error("Vuốt sang trái không sang trang 2.");
  await vuot(page, "phai");
  if ((await trangSlide(page)).so !== 1) throw new Error("Vuốt sang phải không về trang 1.");

  // 3. Hoàn thành bài rồi kiểm tra cuối bài (bài đầu tiên có chủ đề trong ngân hàng).
  const coKiemTra = await n.sql<Array<{ chuyen_de: string; slug: string }>>`
    SELECT c.slug AS chuyen_de, l.slug FROM lessons l JOIN courses c ON c.id = l.course_id
    JOIN fields f ON f.id = c.field_id
    WHERE l.status = 'xuat_ban' AND c.status = 'xuat_ban' AND f.slug = 'giao-thong-duong-bo'
      AND l.topic_id IS NOT NULL
    ORDER BY c.slug, l.ordinal LIMIT 1`;
  const b = coKiemTra[0] ?? dauTien;
  await page.goto(`${n.web}/hoc/${b.chuyen_de}/${b.slug}`);
  await n.chupAnh(page, "doc-cuon");
  await page.locator("button", { hasText: "Hoàn thành bài" }).click();
  await page.locator("text=/Đã hoàn thành bài/").waitFor();
  const [xp] = await n.sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = 'bai_hoc'`;
  if (xp?.n !== 1) throw new Error(`Hoàn thành bài không cộng XP (số dòng xp_ledger: ${xp?.n}).`);

  const nutKiemTra = page.locator("button", { hasText: "Làm bài kiểm tra" });
  if (await nutKiemTra.count()) {
    await Promise.all([page.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}(\?|$)/), nutKiemTra.click()]);
    await n.chupAnh(page, "kiem-tra-cuoi-bai");
  } else {
    console.warn("  bài chưa đủ câu đã duyệt theo chủ đề nên không có kiểm tra cuối bài");
  }
  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
