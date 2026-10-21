/**
 * Kịch bản E2E trang Quy trình, Biểu mẫu, khung điện thoại 360×740:
 *  1. quản trị tải một biểu mẫu PDF lên ở /quan-tri/du-lieu-tra-cuu/moi, gửi duyệt, duyệt, rồi ghim;
 *  2. /tra-cuu-nhanh/quy-trinh có hai tab nối với Tra cứu văn bản, mục phổ biến có biểu mẫu vừa ghim;
 *  3. tra theo từ khóa không dấu, loại tài liệu và phần nâng cao (phương tiện, loại vi phạm) ra đúng
 *     biểu mẫu đó; đổi loại sang Quy trình thì không còn kết quả;
 *  4. trang biểu mẫu có nút mở và tải tệp; tệp trả về là PDF, `?tai=1` thì tải về.
 */
import { join } from "node:path";
import { deleteObject } from "@qdpl/storage";
import type { NguCanhE2E } from "./chay.ts";

const PDF_MAU = join(import.meta.dir, "../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf");

export default async function bieuMau(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const ma = `e2e-bieu-mau-${duoi}`;
  const ten = `E2E mẫu biên bản làm việc ${duoi}`;
  n.donDep(async () => {
    const tep = await n.sql<Array<{ file_uri: string }>>`
      SELECT file_uri FROM form_templates WHERE code = ${ma}`;
    for (const t of tep) await deleteObject(t.file_uri).catch(() => {});
    await n.sql`DELETE FROM form_templates WHERE code = ${ma}`;
    await n.sql`DELETE FROM content_reviews WHERE kind = 'form_template' AND ref = ${ma}`;
  });

  // 1. Tải lên, duyệt và ghim ở khu quản trị.
  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const qt = await n.moTrang();
  const loiTrang: string[] = [];
  qt.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(qt, tk);
  await qt.goto(`${n.web}/quan-tri/du-lieu-tra-cuu/moi?loai=bieu-mau`);
  const o = (nhan: string) => qt.getByLabel(nhan, { exact: true });
  await o("Mã").fill(ma);
  await o("Loại tài liệu").selectOption("bieu_mau");
  await o("Tên biểu mẫu").fill(ten);
  await o("Tóm tắt").fill("Lập khi làm việc với người vi phạm.");
  await o("Tệp biểu mẫu").setInputFiles(PDF_MAU);
  await o("Phương tiện").selectOption("o_to");
  await o("Loại vi phạm").selectOption({ label: "Giấy tờ" });
  await n.kiemKhongCuonNgang(qt, "trang soạn biểu mẫu");
  await n.chupAnh(qt, "soan");
  await Promise.all([
    qt.waitForURL((u) => u.pathname === "/quan-tri/du-lieu-tra-cuu" && u.searchParams.get("ma") === ma),
    qt.getByRole("button", { name: "Lưu và gửi duyệt", exact: true }).click(),
  ]);
  await qt.getByRole("heading", { name: `${ma} · phiên bản 1` }).waitFor();
  const xemTep = await qt.getByRole("link", { name: "Xem tệp", exact: true }).getAttribute("href");
  const tepQuanTri = await qt.request.get(`${n.web}${xemTep}`);
  if (tepQuanTri.status() !== 200 || tepQuanTri.headers()["content-type"] !== "application/pdf") {
    throw new Error(`Người duyệt không xem được tệp trước khi duyệt: ${tepQuanTri.status()}.`);
  }

  // Ghim trước khi duyệt: duyệt xong dòng đang mở thì trang tự mở dòng chờ duyệt kế tiếp.
  await qt.getByLabel("Ghim lên đầu mục phổ biến").check();
  await qt.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
  await qt.getByText("Đã lưu phân loại. Trạng thái duyệt giữ nguyên.").first().waitFor();
  await Promise.all([
    qt.waitForURL((u) => u.searchParams.get("truoc") === ma),
    qt.getByRole("button", { name: "Duyệt", exact: true }).click(),
  ]);
  await qt.getByText(`Đã duyệt ${ma}.`).first().waitFor();
  const [dong] = await n.sql<Array<{ status: string; version: number; pinned: boolean; vehicle: string }>>`
    SELECT status, version, pinned, vehicle FROM form_templates WHERE code = ${ma}`;
  if (dong?.status !== "da_duyet" || dong.version !== 1 || !dong.pinned || dong.vehicle !== "o_to") {
    throw new Error(`Sau khi duyệt và ghim, dòng biểu mẫu sai: ${JSON.stringify(dong)}.`);
  }
  await n.kiemKhongCuonNgang(qt, "trang duyệt biểu mẫu");
  await n.chupAnh(qt, "duyet");

  // 2. Trang người dùng: hai tab và mục phổ biến.
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.goto(`${n.web}/tra-cuu-nhanh/quy-trinh`);
  const tab = page.getByRole("navigation", { name: "Loại tra cứu" });
  if (
    (await tab.getByRole("link", { name: "Quy trình, Biểu mẫu" }).getAttribute("aria-current")) !== "page"
  ) {
    throw new Error("Tab Quy trình, Biểu mẫu không được đánh dấu là tab đang mở.");
  }
  await page.getByRole("heading", { name: "Biểu mẫu làm việc phổ biến" }).waitFor();
  await page.getByRole("link", { name: new RegExp(ten) }).waitFor();
  await n.kiemKhongCuonNgang(page, "trang Quy trình, Biểu mẫu");
  await n.chupAnh(page, "pho-bien");

  // 3. Tra theo từ khóa không dấu, loại tài liệu, phương tiện, loại vi phạm.
  const tra = async () => {
    await Promise.all([
      page.waitForURL((u) => u.searchParams.has("q")),
      page.getByRole("button", { name: "Tra cứu biểu mẫu", exact: true }).click(),
    ]);
  };
  await page.getByLabel("Từ khóa tên quy trình, biểu mẫu").fill(`mau bien ban ${duoi}`);
  await page.getByLabel("Loại tài liệu", { exact: true }).selectOption("bieu_mau");
  await page.getByRole("button", { name: "Tra cứu nâng cao", exact: true }).click();
  await page.getByLabel("Phương tiện", { exact: true }).selectOption("o_to");
  await page.getByLabel("Loại vi phạm", { exact: true }).selectOption("giay-to");
  await tra();
  await page.getByRole("heading", { name: "Kết quả tra cứu" }).waitFor();
  await page.getByText("1 kết quả", { exact: true }).waitFor();
  const url = new URL(page.url());
  if (url.searchParams.get("xe") !== "o_to" || url.searchParams.get("nhom") !== "giay-to") {
    throw new Error(`Bộ lọc nâng cao không lên URL: ${url.search}`);
  }
  // Tra xong, các ô vẫn giữ giá trị đang lọc và phần nâng cao vẫn mở.
  if ((await page.getByLabel("Loại vi phạm", { exact: true }).inputValue()) !== "giay-to") {
    throw new Error("Ô loại vi phạm không giữ giá trị sau khi tra.");
  }
  await n.chupAnh(page, "ket-qua");

  await page.getByLabel("Loại tài liệu", { exact: true }).selectOption("quy_trinh");
  await Promise.all([
    page.waitForURL((u) => u.searchParams.get("loai") === "quy_trinh"),
    page.getByRole("button", { name: "Tra cứu biểu mẫu", exact: true }).click(),
  ]);
  await page.getByText("Không có quy trình, biểu mẫu nào khớp").waitFor();
  await page.getByRole("link", { name: "Bỏ bộ lọc", exact: true }).click();
  await page.getByRole("heading", { name: "Biểu mẫu làm việc phổ biến" }).waitFor();

  // 4. Trang biểu mẫu và tệp.
  await page.getByRole("link", { name: new RegExp(ten) }).click();
  await page.waitForURL((u) => u.pathname === `/tra-cuu-nhanh/bieu-mau/${ma}`);
  await page.getByRole("heading", { level: 1, name: ten }).waitFor();
  await page.getByText("Giấy tờ", { exact: true }).waitFor();
  const moTep = await page.getByRole("link", { name: "Mở tệp", exact: true }).getAttribute("href");
  const taiVe = await page.getByRole("link", { name: "Tải về", exact: true }).getAttribute("href");
  const xem = await page.request.get(`${n.web}${moTep}`);
  if (xem.status() !== 200 || xem.headers()["content-type"] !== "application/pdf") {
    throw new Error(`Không mở được tệp biểu mẫu: ${xem.status()} ${xem.headers()["content-type"]}.`);
  }
  if (!(xem.headers()["content-disposition"] ?? "").startsWith("inline")) {
    throw new Error("Tệp PDF phải mở ngay trong trình duyệt.");
  }
  const tai = await page.request.get(`${n.web}${taiVe}`);
  if (!(tai.headers()["content-disposition"] ?? "").startsWith("attachment")) {
    throw new Error("Nút Tải về phải trả tệp dạng tải về.");
  }
  await n.kiemKhongCuonNgang(page, "trang biểu mẫu");
  await n.chupAnh(page, "chi-tiet");

  // Trang Tra cứu văn bản có cùng hai tab, bấm sang được trang này.
  await page.goto(`${n.web}/tim-kiem`);
  await page
    .getByRole("navigation", { name: "Loại tra cứu" })
    .getByRole("link", { name: "Quy trình, Biểu mẫu" })
    .click();
  await page.waitForURL((u) => u.pathname === "/tra-cuu-nhanh/quy-trinh");
  await page.getByRole("heading", { level: 1, name: "Tra cứu biểu mẫu làm việc" }).waitFor();

  if (loiTrang.length) throw new Error(`Trang có lỗi JavaScript: ${loiTrang.join("; ")}`);
}
