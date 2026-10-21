/**
 * Kịch bản E2E lưới thẻ bài giảng ở `/hoc` và `/hoc/:course` (components/bai-giang/TheBaiHoc.tsx):
 *  1. chưa đăng nhập: cả hai trang chuyển sang đăng nhập, kèm đường quay lại;
 *  2. đã đăng nhập, xong một bài, đang học một bài: badge 100%, phần trăm trung gian và 0% ở
 *     `/hoc/:course`; badge của chuyên đề ở `/hoc`; chữ ẩn "Đã học" cho trình đọc màn hình;
 *  3. ở 375px: một cột, không cuộn ngang, badge không đè tiêu đề; ở màn rộng: hai cột;
 *  4. viền focus-visible khi đi bằng bàn phím; giao diện tối.
 *
 * Cần CSDL đã gieo bài giảng giao thông (`bun run db:seed:dao-tao:gtdb`).
 */
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";

const HEP = { width: 375, height: 812 };
const RONG = { width: 1280, height: 900 };

interface The {
  href: string;
  tieuDe: string;
  badge: string | null;
  bieuTuong: string;
  deLen: boolean;
  tranNgang: boolean;
  hop: { x: number; y: number; bottom: number };
}

/** Đọc mọi thẻ trong danh sách `chon` (ul/ol): nội dung và hình học của từng thẻ. */
async function docThe(page: Page, chon: string): Promise<The[]> {
  await page.locator(`${chon} > li > a`).first().waitFor();
  return page.locator(`${chon} > li > a`).evaluateAll((ds) =>
    ds.map((a) => {
      const tieuDe = a.querySelector(":scope > span.font-semibold") as HTMLElement;
      const badge = a.querySelector("span.rounded-full") as HTMLElement | null;
      const r = a.getBoundingClientRect();
      const rt = tieuDe.getBoundingClientRect();
      const rb = badge?.getBoundingClientRect();
      const de = rb
        ? !(rb.bottom <= rt.top || rb.top >= rt.bottom || rb.right <= rt.left || rb.left >= rt.right)
        : false;
      return {
        href: a.getAttribute("href") ?? "",
        tieuDe: tieuDe.textContent ?? "",
        badge: badge?.textContent ?? null,
        bieuTuong: a.querySelector("svg path")?.getAttribute("d") ?? "",
        deLen: de,
        tranNgang: a.scrollWidth > a.clientWidth,
        hop: { x: Math.round(r.x), y: Math.round(r.y), bottom: Math.round(r.bottom) },
      };
    }),
  );
}

function kiemThe(ds: The[], noi: string, khung: typeof HEP) {
  if (!ds.length) throw new Error(`${noi}: không có thẻ nào.`);
  for (const t of ds) {
    if (!t.bieuTuong) throw new Error(`${noi}: thẻ "${t.tieuDe}" không có biểu tượng.`);
    if (t.deLen) throw new Error(`${noi}: badge đè lên tiêu đề "${t.tieuDe}".`);
    if (t.tranNgang) throw new Error(`${noi}: thẻ "${t.tieuDe}" tràn ngang.`);
  }
  if (ds.length >= 2) {
    const [a, b] = [ds[0]!, ds[1]!];
    const haiCot = a.hop.y === b.hop.y && a.hop.x !== b.hop.x;
    if (khung === RONG && !haiCot) throw new Error(`${noi}: màn rộng mà thẻ không xếp hai cột.`);
    if (khung === HEP && b.hop.y < a.hop.bottom)
      throw new Error(`${noi}: màn 375px mà thẻ không xếp một cột.`);
  }
}

export default async function theBaiHoc(n: NguCanhE2E) {
  // Chuyên đề giao thông có nhiều bài xuất bản nhất: đủ chỗ cho ba trạng thái 100%, trung gian, 0%.
  const [cd] = await n.sql<Array<{ id: string; slug: string; so_bai: number }>>`
    SELECT c.id, c.slug, count(l.id)::int AS so_bai
    FROM courses c JOIN fields f ON f.id = c.field_id
    JOIN lessons l ON l.course_id = c.id AND l.status = 'xuat_ban'
    WHERE c.status = 'xuat_ban' AND f.slug = 'giao-thong-duong-bo'
    GROUP BY c.id ORDER BY count(l.id) DESC, c.slug LIMIT 1`;
  if (!cd) throw new Error("CSDL chưa có bài giảng giao thông. Chạy bun run db:seed:dao-tao:gtdb.");
  const bai = await n.sql<Array<{ id: string; so_khoi: number }>>`
    SELECT l.id, (SELECT count(*)::int FROM lesson_blocks k WHERE k.lesson_id = l.id) AS so_khoi
    FROM lessons l WHERE l.course_id = ${cd.id} AND l.status = 'xuat_ban' ORDER BY l.ordinal`;
  const DS_BAI = `ol:has(> li > a[href^="/hoc/${cd.slug}/"])`;
  const DS_CD = `ul:has(> li > a[href="/hoc/${cd.slug}"])`;

  // 1. Chưa đăng nhập: bài giảng cần tài khoản đã được xác minh, trang chuyển sang đăng nhập.
  {
    const page = await n.moTrang(HEP);
    for (const duong of ["/hoc", `/hoc/${cd.slug}`]) {
      await page.goto(`${n.web}${duong}`);
      const url = new URL(page.url());
      if (url.pathname !== "/dang-nhap" || url.searchParams.get("tiep") !== duong)
        throw new Error(`${duong} chưa đăng nhập mà không chuyển sang đăng nhập: ${page.url()}`);
    }
  }

  // 2. Đã đăng nhập: xong bài 1, đang học bài 2 (đọc tới nửa số khối), còn lại chưa mở.
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ thẻ bài học E2E" });
  const [e] = await n.sql<Array<{ id: string }>>`
    INSERT INTO enrollments (account_id, course_id) VALUES (${tk.id}, ${cd.id}) RETURNING id`;
  await n.sql`
    INSERT INTO lesson_progress (enrollment_id, lesson_id, state, finished_at)
    VALUES (${e!.id}, ${bai[0]!.id}, 'xong', now())`;
  const kyVong = ["100%"];
  if (bai[1]) {
    const doc = Math.max(1, Math.floor(bai[1].so_khoi / 2));
    await n.sql`
      INSERT INTO lesson_progress (enrollment_id, lesson_id, state, last_block_ordinal)
      VALUES (${e!.id}, ${bai[1].id}, 'dang_hoc', ${doc})`;
    kyVong.push(`${Math.min(99, Math.round((doc / bai[1].so_khoi) * 100))}%`);
  }
  for (let i = 2; i < bai.length; i++) kyVong.push("0%");
  const kyVongCd = `${Math.round((1 / bai.length) * 100)}%`;

  for (const khung of [HEP, RONG]) {
    const ten = khung === HEP ? "375" : "rong";
    const page = await n.moTrang(khung);
    await n.dangNhap(page, tk);

    await page.goto(`${n.web}/hoc`);
    const dsCd = await docThe(page, DS_CD);
    kiemThe(dsCd, `/hoc đã đăng nhập ${ten}`, khung);
    const theCd = dsCd.find((t) => t.href === `/hoc/${cd.slug}`)!;
    if (theCd.badge !== `Đã học ${kyVongCd}`)
      throw new Error(`/hoc: badge chuyên đề là "${theCd.badge}", cần "Đã học ${kyVongCd}".`);
    await n.kiemKhongCuonNgang(page, `/hoc đã đăng nhập ${ten}`);
    await n.chupAnh(page, `hoc-dang-nhap-${ten}`);

    await page.goto(`${n.web}/hoc/${cd.slug}`);
    const dsBai = await docThe(page, DS_BAI);
    kiemThe(dsBai, `/hoc/${cd.slug} đã đăng nhập ${ten}`, khung);
    const badge = dsBai.map((t) => t.badge);
    if (JSON.stringify(badge) !== JSON.stringify(kyVong.map((x) => `Đã học ${x}`)))
      throw new Error(`Badge các bài là ${JSON.stringify(badge)}, cần ${JSON.stringify(kyVong)}.`);
    if (!dsBai.every((t, i) => t.tieuDe.startsWith(`Bài ${i + 1}. `)))
      throw new Error(
        `Tiêu đề thẻ bài không theo mẫu "Bài N. ...": ${dsBai.map((t) => t.tieuDe).join(" | ")}`,
      );
    if (dsBai.length > 1 && new Set(dsBai.map((t) => t.bieuTuong)).size < 2)
      throw new Error("Mọi thẻ bài cùng một biểu tượng.");
    const nhan = bai.length === 1 ? "Học lại từ đầu" : "Học tiếp";
    await page.getByRole("link", { name: nhan }).waitFor();
    await n.kiemKhongCuonNgang(page, `/hoc/${cd.slug} đã đăng nhập ${ten}`);
    await n.chupAnh(page, `chuyen-de-dang-nhap-${ten}`);

    // 4. Viền focus khi đi bằng bàn phím, rồi giao diện tối.
    if (khung === RONG) {
      await page.keyboard.press("Tab");
      const the = page.locator(`${DS_BAI} > li > a`).first();
      await the.focus();
      const vien = await the.evaluate((a) => {
        const s = getComputedStyle(a);
        return { khop: a.matches(":focus-visible"), kieu: s.outlineStyle, day: s.outlineWidth };
      });
      if (!vien.khop || vien.kieu !== "solid" || vien.day !== "2px")
        throw new Error(`Thẻ không có viền focus-visible rõ ràng: ${JSON.stringify(vien)}.`);
      await n.chupAnh(page, "chuyen-de-focus");

      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload();
      if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== "dark")
        throw new Error("Không vào được giao diện tối.");
      kiemThe(await docThe(page, DS_BAI), "giao diện tối", khung);
      await n.chupAnh(page, "chuyen-de-toi");
      await page.goto(`${n.web}/hoc`);
      await docThe(page, DS_CD);
      await n.chupAnh(page, "hoc-toi");
    }
  }
}
