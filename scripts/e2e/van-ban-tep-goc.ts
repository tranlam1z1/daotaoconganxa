/**
 * Kịch bản E2E lưu văn bản kèm tệp PDF gốc, khung máy tính 1280×900:
 *  1. chọn PDF có lớp chữ ở /quan-tri/van-ban/moi: thuộc tính được điền sẵn, ô Nội dung để trống;
 *  2. lưu: trang sửa báo trang đọc đang hiện tệp PDF gốc, văn bản chưa có phiên bản nội dung;
 *  3. trang đọc hiện khung PDF, tệp gốc trả về đúng tệp đã nạp; quản trị viên nội dung có nút "Đọc bằng AI",
 *     cán bộ thì không; trên điện thoại 360×740 khung PDF ẩn, thay bằng ảnh từng trang;
 *  4. bản quét (không có lớp chữ) cũng lưu được, điền thuộc tính bằng tay.
 *
 * Kịch bản KHÔNG bấm "Đọc bằng AI": bấm thật sẽ ghi nội dung văn bản và xếp việc lên hàng đợi mà máy
 * chủ E2E dùng chung với môi trường thật (như nap-pdf.ts). Phần đọc tệp gốc đã có kiểm thử ở apps/api.
 * Lưu văn bản chỉ có tệp gốc không ghi bản sao Markdown và không xếp việc; tệp gốc trong kho được gỡ
 * khi kịch bản xong.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deleteObject } from "@qdpl/storage";
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";

const PDF_MAU = readFileSync(
  join(import.meta.dir, "../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf"),
);

/** PDF một trang trắng, không có lớp văn bản: như bản quét. */
const PDF_TRANG = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

export default async function vanBanTepGoc(n: NguCanhE2E) {
  // Năm 2098 để không đụng dữ liệu mẫu và văn bản thử của kiểm thử API (2099).
  const so = 100 + Math.floor(Math.random() * 800);
  const vanBan = (i: number) => ({
    soKyHieu: `${so + i}/2098/NĐ-CP`,
    urn: `vn:vbqppl:nd:${so + i}/2098/NĐ-CP`,
    trangDoc: `${n.web}/van-ban/nd/${so + i}-2098-nd-cp`,
  });
  const coChu = vanBan(0);
  const banQuet = vanBan(1);
  n.donDep(async () => {
    const xoa = await n.sql<Array<{ original_file_uri: string | null; original_file_pages: number | null }>>`
      DELETE FROM documents WHERE urn IN (${coChu.urn}, ${banQuet.urn})
      RETURNING original_file_uri, original_file_pages`;
    for (const d of xoa) {
      if (!d.original_file_uri) continue;
      await deleteObject(d.original_file_uri);
      // Ảnh trang kết xuất cho điện thoại nằm cạnh tệp gốc.
      for (let i = 1; i <= (d.original_file_pages ?? 0); i++) {
        await deleteObject(`${d.original_file_uri}.trang-${i}.jpg`).catch(() => {});
      }
    }
  });

  const tk = await n.taoTaiKhoan({ role: "quan_ly", ten: "Admin quản lý E2E" });
  const page = await n.moTrang({ width: 1280, height: 900 });
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  const o = (nhan: string) => page.getByLabel(nhan, { exact: true });

  /** Bấm "Thêm văn bản", chờ trang sửa, rồi kiểm văn bản có tệp gốc và chưa có phiên bản nội dung. */
  const luu = async (urn: string) => {
    await Promise.all([
      page.waitForURL((u) => u.pathname === "/quan-tri/van-ban/sua"),
      page.getByRole("button", { name: "Thêm văn bản", exact: true }).click(),
    ]);
    await page.getByText(/Trang đọc của văn bản này đang hiện tệp PDF gốc/).waitFor();
    const [vb] = await n.sql<Array<{ so_phien_ban: number; original_file_uri: string | null }>>`
      SELECT d.original_file_uri,
             (SELECT count(*)::int FROM document_versions v WHERE v.document_id = d.id) AS so_phien_ban
      FROM documents d WHERE d.urn = ${urn}`;
    if (!vb?.original_file_uri || vb.so_phien_ban !== 0) {
      throw new Error(`${urn}: phải có tệp gốc và chưa có phiên bản nội dung.`);
    }
  };

  /** Trang đọc hiện khung PDF trỏ tới tệp gốc, và tệp trả về đúng nội dung đã nạp. */
  const kiemTrangDoc = async (trang: Page, trangDoc: string, tep: Buffer) => {
    await trang.goto(trangDoc);
    const khung = trang.locator('iframe[title^="Tệp PDF gốc"]');
    await khung.waitFor({ state: "visible" });
    if (!(await khung.getAttribute("src"))?.endsWith("/tep-goc")) throw new Error("Khung PDF trỏ sai tệp.");
    const res = await trang.request.get(`${trangDoc}/tep-goc`);
    if (res.status() !== 200 || res.headers()["content-type"] !== "application/pdf") {
      throw new Error(`Tệp gốc trả ${res.status()} ${res.headers()["content-type"]}.`);
    }
    if (!(await res.body()).equals(tep)) throw new Error("Tệp gốc khác tệp đã nạp.");
  };

  // 1. PDF có lớp chữ: điền sẵn thuộc tính, không điền nội dung.
  await page.goto(`${n.web}/quan-tri/van-ban/moi`);
  await o("Chọn tệp PDF").setInputFiles({ name: "nd-45.pdf", mimeType: "application/pdf", buffer: PDF_MAU });
  await page.getByText(/Đã điền các thuộc tính đọc được từ nd-45\.pdf \(5 trang\)/).waitFor();
  if ((await o("Người ký").inputValue()) !== "Nguyễn Văn A") throw new Error("Chưa điền người ký từ PDF.");
  if ((await o("Nội dung (Markdown)").inputValue()) !== "") {
    throw new Error("Nạp PDF không được điền ô Nội dung: văn bản lưu bằng tệp gốc.");
  }
  await n.chupAnh(page, "da-nap");

  // 2. Đổi sang số ký hiệu thử rồi lưu.
  await o("Số ký hiệu").fill(coChu.soKyHieu);
  await luu(coChu.urn);

  // 3. Trang đọc: khung PDF; quản trị viên nội dung có nút "Đọc bằng AI", cán bộ thì không.
  await kiemTrangDoc(page, coChu.trangDoc, PDF_MAU);
  await page.getByRole("button", { name: "Đọc bằng AI", exact: true }).waitFor();
  await n.chupAnh(page, "trang-doc");
  const canBo = await n.moTrang({ width: 1280, height: 900 });
  await n.dangNhap(canBo, await n.taoTaiKhoan({ role: "can_bo" }));
  await kiemTrangDoc(canBo, coChu.trangDoc, PDF_MAU);
  if (await canBo.getByRole("button", { name: "Đọc bằng AI" }).count()) {
    throw new Error("Cán bộ không được thấy nút Đọc bằng AI.");
  }

  // Điện thoại 360×740: khung PDF ẩn, thay bằng ảnh từng trang (tệp mẫu có 5 trang).
  const dienThoai = await n.moTrang();
  await dienThoai.goto(coChu.trangDoc);
  const anhTrang = dienThoai.locator('img[alt^="Trang "]');
  await anhTrang.first().waitFor({ state: "visible" });
  if ((await anhTrang.count()) !== 5) throw new Error("Trang đọc trên điện thoại phải có đủ 5 ảnh trang.");
  await dienThoai.waitForFunction(() => {
    const anh = document.querySelector<HTMLImageElement>('img[alt^="Trang 1 "]');
    return Boolean(anh?.complete && anh.naturalWidth > 0);
  });
  if (await dienThoai.locator('iframe[title^="Tệp PDF gốc"]').isVisible()) {
    throw new Error("Khung PDF phải ẩn trên điện thoại.");
  }
  await n.kiemKhongCuonNgang(dienThoai, "trang đọc tệp gốc trên điện thoại");
  await n.chupAnh(dienThoai, "dien-thoai");

  // 4. Bản quét: không đọc được thuộc tính, điền tay rồi lưu.
  await page.goto(`${n.web}/quan-tri/van-ban/moi`);
  await o("Chọn tệp PDF").setInputFiles({
    name: "ban-quet.pdf",
    mimeType: "application/pdf",
    buffer: PDF_TRANG,
  });
  await page.getByText(/là bản quét/).waitFor();
  await o("Số ký hiệu").fill(banQuet.soKyHieu);
  await o("Tên văn bản (trích yếu)").fill("Văn bản thử E2E lưu từ bản quét");
  await luu(banQuet.urn);
  await kiemTrangDoc(page, banQuet.trangDoc, PDF_TRANG);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
