/**
 * Kịch bản E2E tạo đề thi từ tệp PDF ở khu quản trị, khung điện thoại 360×740:
 *  1. từ danh sách đề thi mở trang "Tạo từ tệp PDF"; mẫu 45 phút chọn sẵn; tệp không phải PDF báo
 *     lý do tại chỗ;
 *  2. trang đề hiện tiến độ AI sinh câu hỏi và tự tải lại khi việc sinh xong;
 *  3. câu chờ duyệt hiện kèm đáp án; từ chối một câu, rồi một nút duyệt câu còn lại và xuất bản đề,
 *     sau đó có lối sang Giao bài.
 *
 * Kịch bản KHÔNG gửi một tệp PDF thật: gửi thật sẽ lưu văn bản vào kho và xếp việc lên hàng đợi
 * mà máy chủ E2E dùng chung với môi trường thật (như nap-pdf.ts). Việc sinh và câu hỏi được ghi
 * thẳng vào CSDL; phần lưu văn bản và sinh câu hỏi đã có kiểm thử ở apps/api.
 */
import { luuChuDeCauHoi, type TaoCauHoiInput, taoDeThi, taoNhieuCauHoi, taoViecSoanBai } from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}de-thi-tu-pdf`;

export default async function deThiTuPdf(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const chuDe = await luuChuDeCauHoi({ code: `${TIEN_TO}de-pdf-${duoi}`, name: `Đề từ PDF E2E ${duoi}` });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE topic_id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM authoring_jobs WHERE requested_by = ${NGUOI_TAO}`);
  n.donDep(() => n.sql`DELETE FROM exams WHERE created_by = ${NGUOI_TAO}`);

  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Mở trang tạo từ PDF từ danh sách đề thi.
  await page.goto(`${n.web}/quan-tri/de-thi`);
  await Promise.all([
    page.waitForURL("**/quan-tri/de-thi/tu-pdf"),
    page.getByRole("link", { name: "Tạo từ tệp PDF", exact: true }).click(),
  ]);
  await page.getByRole("heading", { name: "Tạo đề thi từ tệp PDF" }).waitFor();
  if (!(await page.getByLabel(/^45 phút/).isChecked())) throw new Error("Mẫu 45 phút phải được chọn sẵn.");
  await n.kiemKhongCuonNgang(page, "trang tạo đề thi từ PDF");
  await n.chupAnh(page, "bieu-mau");

  await page.getByLabel(/^Tệp PDF/).setInputFiles({
    name: "van-ban.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PK khong phai pdf"),
  });
  await page.getByRole("button", { name: "Tạo đề thi", exact: true }).click();
  await page.getByText(/Tệp không phải PDF/).waitFor();
  if (!page.url().endsWith("/quan-tri/de-thi/tu-pdf")) throw new Error("Tệp sai mà trang vẫn chuyển đi.");

  // 2. Đề nháp cần một câu trắc nghiệm mức dễ, AI đang sinh.
  const viec = await taoViecSoanBai({
    step: "sinh_cau_hoi_ngan_hang",
    input: { muc_do: "de", loai: ["mot_dap_an"], so_cau: 3 },
    batch: false,
    requestedBy: NGUOI_TAO,
  });
  await n.sql`UPDATE authoring_jobs SET state = 'dang_chay', started_at = now() WHERE id = ${viec.id}::uuid`;
  const de = await taoDeThi(
    {
      title: `Kiểm tra Thông tư thử E2E ${duoi}`,
      matrix: [{ topic_id: chuDe.id, level: "de", so_cau: 1, dang: "trac_nghiem", diem_moi_cau: 1 }],
      question_count: 1,
      duration_minutes: 15,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: true,
      max_attempts: 1,
      show_answers: "sau_nop",
      authoring_job_ids: [viec.id],
    },
    NGUOI_TAO,
  );
  await page.goto(`${n.web}/quan-tri/de-thi/${de.id}`);
  await page.getByText("AI đang sinh câu hỏi: xong 0/1 lượt.").waitFor();
  if (await page.getByRole("button", { name: /Duyệt .* và xuất bản đề/ }).count()) {
    throw new Error("Đang sinh dở mà đã hiện nút duyệt và xuất bản.");
  }
  await n.kiemKhongCuonNgang(page, "trang đề khi AI đang sinh");

  // AI sinh xong hai câu: trang tự tải lại và liệt kê câu chờ duyệt kèm đáp án.
  const cau = (so: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: "de",
    kind: "mot_dap_an",
    stem: `Câu AI sinh E2E số ${so}: Luật số 36/2024/QH15 là luật gì?`,
    options: {
      phuong_an: [
        { id: "a", text: "Luật Trật tự, an toàn giao thông đường bộ" },
        { id: "b", text: "Luật Đường bộ" },
      ],
    },
    answer: { dung: ["a"] },
    explanation: "Luật số 36/2024/QH15 là Luật Trật tự, an toàn giao thông đường bộ.",
    citations: [],
    status: "cho_duyet",
    source: "ai",
    authoringJobId: viec.id,
  });
  await taoNhieuCauHoi([cau(1), cau(2)], NGUOI_TAO);
  await n.sql`UPDATE authoring_jobs SET state = 'xong', finished_at = now() WHERE id = ${viec.id}::uuid`;
  await page.getByText(/còn 2 câu chờ duyệt/).waitFor({ timeout: 15_000 });
  await page.getByText("Câu AI sinh E2E số 1").waitFor();
  await n.kiemKhongCuonNgang(page, "trang đề khi có câu chờ duyệt");
  await n.chupAnh(page, "cho-duyet");

  // 3. Từ chối câu số 2, rồi duyệt câu còn lại và xuất bản.
  const cau2 = page.getByRole("listitem").filter({ hasText: "Câu AI sinh E2E số 2" });
  await cau2.getByText("Từ chối câu này").click();
  await cau2.getByLabel("Lý do từ chối").fill("Trùng ý với câu 1");
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    cau2.getByRole("button", { name: "Từ chối", exact: true }).click(),
  ]);
  await page
    .getByText(/Đã từ chối câu/)
    .first()
    .waitFor();
  await page.getByText(/còn 1 câu chờ duyệt/).waitFor();

  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: "Duyệt 1 câu và xuất bản đề", exact: true }).click(),
  ]);
  await page
    .getByText(/Đã duyệt 1 câu và xuất bản đề thi/)
    .first()
    .waitFor();
  await page.getByRole("link", { name: "Giao bài", exact: true }).waitFor();
  const [sau] = await n.sql<Array<{ status: string }>>`SELECT status FROM exams WHERE id = ${de.id}`;
  if (sau?.status !== "xuat_ban") throw new Error(`Đề ở trạng thái "${sau?.status}", mong "xuat_ban".`);
  const trangThai = await n.sql<Array<{ status: string }>>`
    SELECT status FROM questions WHERE authoring_job_id = ${viec.id}::uuid ORDER BY stem`;
  if (trangThai.map((q) => q.status).join(",") !== "da_duyet,tu_choi") {
    throw new Error(`Trạng thái hai câu sai: ${trangThai.map((q) => q.status).join(",")}`);
  }
  await n.kiemKhongCuonNgang(page, "trang đề sau khi xuất bản");
  await n.chupAnh(page, "xuat-ban");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
