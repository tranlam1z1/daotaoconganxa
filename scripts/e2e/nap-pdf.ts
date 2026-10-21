/**
 * Kịch bản E2E nạp văn bản từ tệp PDF ở /quan-tri/van-ban/moi, khung điện thoại 360×740:
 *  1. chọn PDF có lớp chữ: số ký hiệu, loại, tên, cơ quan, người ký được điền sẵn; ô Nội dung để
 *     trống vì văn bản lưu bằng tệp PDF gốc;
 *  2. ô người soạn đã gõ không bị ghi đè khi nạp lại tệp;
 *  3. bản quét (không có lớp chữ) và tệp không phải PDF báo lý do, không làm hỏng biểu mẫu.
 *
 * Kịch bản KHÔNG bấm lưu; phần lưu kèm tệp gốc và trang đọc ở van-ban-tep-goc.ts.
 */
import { join } from "node:path";
import type { NguCanhE2E } from "./chay.ts";

const PDF_MAU = join(import.meta.dir, "../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf");

/** PDF một trang trắng, không có lớp văn bản: như bản quét. */
const PDF_TRANG = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

export default async function napPdf(n: NguCanhE2E) {
  const tk = await n.taoTaiKhoan({ role: "bien_tap", ten: "Biên tập E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/quan-tri/van-ban/moi`);

  const chonPdf = page.getByLabel("Chọn tệp PDF", { exact: true });
  const o = (nhan: string) => page.getByLabel(nhan, { exact: true });

  // 1. PDF có lớp chữ: điền sẵn thuộc tính, không điền nội dung.
  await chonPdf.setInputFiles(PDF_MAU);
  await page.getByText(/Đã điền các thuộc tính đọc được từ .* \(5 trang\)/).waitFor();
  const mong: Array<[string, string]> = [
    ["Số ký hiệu", "45/2026/NĐ-CP"],
    ["Loại văn bản", "nd"],
    [
      "Tên văn bản (trích yếu)",
      "Quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước",
    ],
    ["Cơ quan ban hành", "CHÍNH PHỦ"],
    ["Người ký", "Nguyễn Văn A"],
  ];
  for (const [nhan, giaTri] of mong) {
    const co = await o(nhan).inputValue();
    if (co !== giaTri) throw new Error(`Ô "${nhan}" điền "${co}", mong "${giaTri}".`);
  }
  if ((await o("Nội dung (Markdown)").inputValue()) !== "") {
    throw new Error("Nạp PDF không được điền ô Nội dung: văn bản lưu bằng tệp gốc.");
  }
  // Nội dung người soạn tự gõ phải còn nguyên khi nạp tệp khác.
  const noiDung = "Điều 1. Nội dung người soạn tự gõ";
  await o("Nội dung (Markdown)").fill(noiDung);
  await n.kiemKhongCuonNgang(page, "trang thêm văn bản sau khi nạp PDF");
  await n.chupAnh(page, "da-nap");

  // 2. Ô người soạn đã sửa thì nạp lại tệp không ghi đè; ô trang tự điền thì được điền lại.
  await o("Tên văn bản (trích yếu)").fill("Tên do người soạn gõ");
  await o("Cơ quan ban hành").fill("");
  await chonPdf.setInputFiles(PDF_MAU);
  // Thông báo của lần nạp trước còn trên trang: chờ theo ô được điền lại, không chờ theo thông báo.
  const han = Date.now() + 15_000;
  while ((await o("Cơ quan ban hành").inputValue()) !== "CHÍNH PHỦ") {
    if (Date.now() > han) throw new Error("Nạp lại PDF không điền ô cơ quan ban hành đang trống.");
    await page.waitForTimeout(100);
  }
  if ((await o("Tên văn bản (trích yếu)").inputValue()) !== "Tên do người soạn gõ") {
    throw new Error("Nạp lại PDF đã ghi đè tên văn bản người soạn tự gõ.");
  }

  // 3. Bản quét và tệp không phải PDF: báo lý do, nội dung đã có giữ nguyên.
  await chonPdf.setInputFiles({ name: "ban-quet.pdf", mimeType: "application/pdf", buffer: PDF_TRANG });
  await page.getByText(/là bản quét/).waitFor();
  if ((await o("Nội dung (Markdown)").inputValue()) !== noiDung) {
    throw new Error("Nạp bản quét làm đổi nội dung đang có.");
  }
  await page
    .getByLabel("Mở tệp PDF hoặc .md", { exact: true })
    .setInputFiles({ name: "van-ban.docx", mimeType: "application/msword", buffer: Buffer.from("PK") });
  await page.getByText(/Chỉ nhận tệp PDF, \.md hoặc \.txt/).waitFor();
  await n.kiemKhongCuonNgang(page, "trang thêm văn bản khi báo lỗi tệp");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
