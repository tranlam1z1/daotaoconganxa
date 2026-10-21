/**
 * Kịch bản E2E tạo chuyên đề từ tệp PDF ở khu quản trị, khung điện thoại 360×740:
 *  1. từ danh sách chuyên đề mở trang "Tạo từ tệp PDF"; tệp không phải PDF báo lý do tại chỗ;
 *  2. trang chuyên đề hiện khung tiến độ AI soạn, tự tải lại khi việc soạn đổi trạng thái;
 *  3. việc soạn lỗi thì có nút Chạy tiếp; soạn xong thì có nút xuất bản cả chuyên đề, bài chưa đạt
 *     bảng kiểm được báo tên và giữ nguyên.
 *
 * Kịch bản KHÔNG gửi một tệp PDF thật: gửi thật sẽ lưu văn bản vào kho và xếp việc lên hàng đợi
 * mà máy chủ E2E dùng chung với môi trường thật (như nap-pdf.ts). Tiến độ được dựng bằng cách ghi
 * thẳng việc soạn vào CSDL; phần lưu văn bản và soạn bài đã có kiểm thử ở apps/api.
 */
import { luuBaiHoc, luuChuyenDe, taoViecSoanBai } from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

export default async function chuyenDeTuPdf(n: NguCanhE2E) {
  const [linhVuc] = await n.sql<Array<{ id: string }>>`SELECT id FROM fields ORDER BY ordinal LIMIT 1`;
  const slug = `${TIEN_TO}tu-pdf-${crypto.randomUUID().slice(0, 6)}`;
  n.donDep(() => n.sql`DELETE FROM courses WHERE slug = ${slug}`);
  n.donDep(
    () => n.sql`DELETE FROM authoring_jobs WHERE course_id IN (SELECT id FROM courses WHERE slug = ${slug})`,
  );

  const tk = await n.taoTaiKhoan({ role: "phap_che", ten: "Pháp chế E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Mở trang tạo từ PDF từ danh sách chuyên đề.
  await page.goto(`${n.web}/quan-tri/chuyen-de`);
  await Promise.all([
    page.waitForURL("**/quan-tri/chuyen-de/tu-pdf"),
    page.getByRole("link", { name: "Tạo từ tệp PDF", exact: true }).click(),
  ]);
  await page.getByRole("heading", { name: "Tạo chuyên đề từ tệp PDF" }).waitFor();
  for (const nhan of ["Một câu tự luận có thang chấm", /Sáu câu trắc nghiệm/]) {
    if (!(await page.getByLabel(nhan).isChecked())) throw new Error(`Ô "${nhan}" phải được chọn sẵn.`);
  }
  await n.kiemKhongCuonNgang(page, "trang tạo chuyên đề từ PDF");
  await n.chupAnh(page, "bieu-mau");

  await page.getByLabel(/^Tệp PDF/).setInputFiles({
    name: "van-ban.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PK khong phai pdf"),
  });
  await page.getByRole("button", { name: "Tạo chuyên đề", exact: true }).click();
  await page.getByText(/Tệp không phải PDF/).waitFor();
  if (!page.url().endsWith("/quan-tri/chuyen-de/tu-pdf")) throw new Error("Tệp sai mà trang vẫn chuyển đi.");
  await n.kiemKhongCuonNgang(page, "trang tạo chuyên đề từ PDF khi báo lỗi");

  // 2. Chuyên đề đang được AI soạn: một phần xong, một phần còn chờ.
  const course = await luuChuyenDe({
    slug,
    title: "Thông tư thử E2E: tạo từ tệp PDF",
    asOf: new Date().toISOString().slice(0, 10),
    fieldId: linhVuc?.id ?? null,
  });
  await luuBaiHoc({ courseId: course.id, slug: "bai-mot", ordinal: 1, title: "Bài một E2E", source: "ai" });
  const cha = await taoViecSoanBai({ courseId: course.id, step: "soan_tu_dong", input: {}, batch: false });
  const con = [
    await taoViecSoanBai({ courseId: course.id, step: "soan_bai", input: {}, parentId: cha.id }),
    await taoViecSoanBai({ courseId: course.id, step: "sinh_bai_tap", input: {}, parentId: cha.id }),
  ];
  const datTrangThai = (id: string, state: string, error: string | null = null) =>
    n.sql`UPDATE authoring_jobs SET state = ${state}, error = ${error}, started_at = now() WHERE id = ${id}::uuid`;
  await datTrangThai(cha.id, "xong");
  await datTrangThai(con[0]!.id, "xong");
  await datTrangThai(con[1]!.id, "dang_chay");

  await page.goto(`${n.web}/quan-tri/chuyen-de/${slug}`);
  await page.getByText("AI đang soạn bài: xong 1/2 phần.").waitFor();
  if (await page.getByRole("button", { name: "Xuất bản cả chuyên đề" }).count()) {
    throw new Error("Đang soạn dở mà đã hiện nút xuất bản cả chuyên đề.");
  }
  await n.kiemKhongCuonNgang(page, "trang chuyên đề khi AI đang soạn");
  await n.chupAnh(page, "dang-soan");

  // 3. Việc soạn lỗi: trang tự tải lại, báo lỗi và cho chạy tiếp.
  await datTrangThai(con[1]!.id, "loi", "Lỗi thử E2E");
  await page.getByText(/1 phần soạn bị lỗi\. Lỗi thử E2E/).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Chạy tiếp", exact: true }).waitFor();
  await n.chupAnh(page, "loi");

  // Soạn xong: xuất bản cả chuyên đề; bài chưa có khối nội dung không đạt bảng kiểm nên bị giữ lại.
  await datTrangThai(con[1]!.id, "xong");
  await page.reload();
  await page.getByText(/AI đã soạn xong 2\/2 phần/).waitFor();
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Xuất bản cả chuyên đề", exact: true }).click(),
  ]);
  await page
    .getByText(/1 bài chưa đạt bảng kiểm nên giữ nguyên: Bài một E2E/)
    .first()
    .waitFor();
  const [bai] = await n.sql<Array<{ status: string }>>`
    SELECT status FROM lessons WHERE course_id = ${course.id}::uuid`;
  if (bai?.status === "xuat_ban") throw new Error("Bài chưa đạt bảng kiểm mà vẫn được xuất bản.");
  await n.kiemKhongCuonNgang(page, "trang chuyên đề sau khi xuất bản");
  await n.chupAnh(page, "xuat-ban");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
