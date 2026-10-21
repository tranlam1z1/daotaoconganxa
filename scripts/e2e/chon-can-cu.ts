/**
 * Kịch bản E2E ô chọn căn cứ ở trang soạn dữ liệu tra cứu, khung điện thoại 360×740:
 *  1. gõ số ký hiệu, bấm kết quả thì ô hiện tên văn bản và mở mục lục, biểu mẫu gửi URN văn bản;
 *  2. bấm một điều rồi một khoản của điều đó: biểu mẫu gửi đúng URN của khoản, ô hiện viện dẫn đọc được;
 *  3. "Đổi văn bản" đưa về ô tìm; Enter trong ô tìm chọn kết quả đầu tiên, không gửi biểu mẫu;
 *  4. "Nhập URN thủ công" hiện ô gõ tay còn giữ giá trị đang chọn.
 *
 * Cần văn bản mẫu 100/2026/NĐ-CP trong CSDL (`bun run db:seed`).
 */
import type { NguCanhE2E } from "./chay.ts";

const URN = "vn:vbqppl:nd:100/2026/NĐ-CP";

export default async function chonCanCu(n: NguCanhE2E) {
  const [vb] = await n.sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM documents WHERE urn = ${URN}`;
  if (!vb?.n) throw new Error("CSDL chưa có văn bản mẫu 100/2026/NĐ-CP. Chạy bun run db:seed.");

  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  const duong = "/quan-tri/du-lieu-tra-cuu/moi";
  await page.goto(`${n.web}${duong}?loai=toc-do-toi-da`);
  const urnGui = () => page.locator('input[name="citation_urn"]').inputValue();

  // 1. Tìm và chọn văn bản.
  const oTim = page.getByLabel("Căn cứ", { exact: true });
  await oTim.fill("100/2026");
  // Tên văn bản sửa đổi 150/2027 cũng nhắc "100/2026": khớp theo số ký hiệu đứng đầu.
  await page.getByRole("button", { name: /^100\/2026\/NĐ-CP/ }).click();
  await page.getByText("Nghị định số 100/2026/NĐ-CP", { exact: true }).waitFor();
  if ((await urnGui()) !== URN) throw new Error(`Chọn văn bản gửi sai URN: ${await urnGui()}`);

  // 2. Mục lục mở sẵn: bấm một điều rồi một khoản của điều đó.
  await page
    .getByRole("button", { name: /^Điều \d+.*\(\d+ khoản\)/ })
    .first()
    .click();
  if (!/#dieu-\d+$/.test(await urnGui())) throw new Error(`Chọn điều gửi sai URN: ${await urnGui()}`);
  await page
    .getByRole("button", { name: /^Khoản \d+/ })
    .first()
    .click();
  const khoan = await urnGui();
  if (!/#dieu-\d+\.khoan-\d+$/.test(khoan)) throw new Error(`Chọn khoản gửi sai URN: ${khoan}`);
  await page.getByText(/^khoản \d+ Điều \d+ Nghị định số 100\/2026\/NĐ-CP$/).waitFor();
  const moDieu = await page.getByRole("link", { name: "Mở điều khoản" }).getAttribute("href");
  if (!moDieu?.includes("dieu=dieu-")) throw new Error(`Liên kết mở điều khoản sai: ${moDieu}.`);
  await n.kiemKhongCuonNgang(page, "ô chọn căn cứ mở mục lục");
  await n.chupAnh(page, "muc-luc");

  // 3. Đổi văn bản; Enter chọn kết quả đầu tiên, trang không rời đi.
  await page.getByRole("button", { name: "Đổi văn bản", exact: true }).click();
  if ((await urnGui()) !== "") throw new Error("Đổi văn bản phải bỏ căn cứ đang chọn.");
  await oTim.fill("100/2026/NĐ-CP");
  await page.getByRole("button", { name: /^100\/2026\/NĐ-CP/ }).waitFor();
  await oTim.press("Enter");
  await page.getByRole("button", { name: "Thu gọn mục lục", exact: true }).waitFor();
  if (new URL(page.url()).pathname !== duong) throw new Error("Enter trong ô tìm đã gửi biểu mẫu.");

  // 4. Ô gõ tay giữ giá trị đang chọn.
  const dangChon = await urnGui();
  await page.getByRole("button", { name: "Nhập URN thủ công", exact: true }).click();
  if ((await page.getByLabel("Căn cứ", { exact: true }).inputValue()) !== dangChon) {
    throw new Error("Ô gõ tay không giữ URN đang chọn.");
  }

  if (loiTrang.length) throw new Error(`Trang báo lỗi JavaScript: ${loiTrang.join("; ")}`);
}
