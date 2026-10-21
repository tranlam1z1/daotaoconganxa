/**
 * Kịch bản E2E ma trận đề ở trang riêng, khung điện thoại 360×740:
 *  1. trang đề chỉ hiện dòng tóm tắt ma trận và nút "Sửa ma trận", không còn ô nhập số câu;
 *  2. trang ma trận chỉ hiện chủ đề đề đang dùng; đổi số câu rồi lưu thì trang đề tóm tắt theo;
 *     lưu thông tin chung ở trang đề không làm mất ma trận;
 *  3. thêm chủ đề khác từ ô chọn, bỏ chủ đề khỏi ma trận;
 *  4. tạo đề hai bước: thông tin chung, rồi ma trận, rồi đề nháp được tạo.
 */
import { luuChuDeCauHoi, type TaoCauHoiInput, taoDeThi, taoNhieuCauHoi } from "@qdpl/db";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}ma-tran-de`;

async function bamVaCho(page: Page, nut: string) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page.getByRole("button", { name: nut, exact: true }).click(),
  ]);
  await page.waitForLoadState("networkidle");
}

export default async function maTranDe(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const tenA = `Ma trận E2E A ${duoi}`;
  const tenB = `Ma trận E2E B ${duoi}`;
  const [a, b] = await Promise.all([
    luuChuDeCauHoi({ code: `${TIEN_TO}mt-a-${duoi}`, name: tenA }),
    luuChuDeCauHoi({ code: `${TIEN_TO}mt-b-${duoi}`, name: tenB }),
  ]);
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id IN (${a.id}, ${b.id})`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE topic_id IN (${a.id}, ${b.id})`);
  n.donDep(() => n.sql`DELETE FROM exams WHERE created_by = ${NGUOI_TAO} OR title LIKE ${`%${duoi}`}`);
  const cau = (topicId: string, i: number): TaoCauHoiInput => ({
    topicId,
    level: "de",
    kind: "dung_sai",
    stem: `Câu ma trận E2E số ${i + 1}: Luật số 36/2024/QH15 là Luật Trật tự, an toàn giao thông đường bộ.`,
    options: {},
    answer: { dung: ["dung"] },
    explanation: "Đúng tên luật.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    [
      ...Array.from({ length: 3 }, (_, i) => cau(a.id, i)),
      ...Array.from({ length: 2 }, (_, i) => cau(b.id, i)),
    ],
    NGUOI_TAO,
  );
  const de = await taoDeThi(
    {
      title: `Đề ma trận E2E ${duoi}`,
      matrix: [{ topic_id: a.id, level: "de", so_cau: 1, dang: "trac_nghiem", diem_moi_cau: 1 }],
      question_count: 1,
      duration_minutes: 15,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: true,
      max_attempts: 1,
      show_answers: "sau_nop",
    },
    NGUOI_TAO,
  );

  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  const oSoCau = (ten: string) =>
    page
      .getByRole("listitem")
      .filter({ hasText: ten })
      .getByRole("group", { name: "Trắc nghiệm" })
      .getByLabel("Dễ");

  // 1. Trang đề: tóm tắt ma trận, không còn ô nhập số câu.
  await page.goto(`${n.web}/quan-tri/de-thi/${de.id}`);
  await page.getByText("1 câu (1 trắc nghiệm, 0 tự luận) · 1 điểm · 1 chủ đề").waitFor();
  await page.getByText(`${tenA}: 1 trắc nghiệm`).waitFor();
  if (await page.locator('input[name^="m__"]').count()) throw new Error("Trang đề còn ô nhập ma trận.");
  await n.kiemKhongCuonNgang(page, "trang đề");
  await n.chupAnh(page, "trang-de");

  // 2. Trang ma trận: chỉ chủ đề đang dùng; đổi số câu rồi lưu.
  await Promise.all([
    page.waitForURL(`**/quan-tri/de-thi/${de.id}/ma-tran`),
    page.getByRole("link", { name: "Sửa ma trận", exact: true }).click(),
  ]);
  await page.getByRole("heading", { name: "Ma trận đề", exact: true }).waitFor();
  const soThe = await page.locator('input[name^="m__"]').count();
  if (soThe !== 6) throw new Error(`Trang ma trận hiện ${soThe} ô số câu, mong 6 ô của một chủ đề.`);
  await oSoCau(tenA).fill("2");
  await page.getByText(/^Tổng: 2 câu/).waitFor();
  await n.kiemKhongCuonNgang(page, "trang ma trận");
  await n.chupAnh(page, "ma-tran");
  await bamVaCho(page, "Lưu ma trận");
  await page.getByText("Đã lưu ma trận.").first().waitFor();

  await Promise.all([
    page.waitForURL(`**/quan-tri/de-thi/${de.id}`),
    page.getByRole("link", { name: "Về đề thi", exact: true }).click(),
  ]);
  await page.getByText("2 câu (2 trắc nghiệm, 0 tự luận) · 2 điểm · 1 chủ đề").waitFor();
  // Lưu thông tin chung ở trang đề không đụng tới ma trận.
  await page.getByLabel("Thời gian làm bài (phút)", { exact: true }).fill("20");
  await bamVaCho(page, "Lưu đề thi");
  await page.getByText("Đã lưu đề thi.").first().waitFor();
  const [sau] = await n.sql<Array<{ question_count: number; duration_minutes: number }>>`
    SELECT question_count, duration_minutes FROM exams WHERE id = ${de.id}`;
  if (sau?.question_count !== 2 || sau.duration_minutes !== 20) {
    throw new Error(
      `Sau khi lưu: ${sau?.question_count} câu, ${sau?.duration_minutes} phút; mong 2 câu, 20 phút.`,
    );
  }

  // 3. Thêm chủ đề B, rồi bỏ chủ đề A.
  await page.goto(`${n.web}/quan-tri/de-thi/${de.id}/ma-tran`);
  await page.getByLabel("Thêm chủ đề vào ma trận", { exact: true }).selectOption(b.id);
  await page.getByRole("button", { name: "Thêm chủ đề", exact: true }).click();
  await oSoCau(tenB).fill("1");
  await page.getByText(/^Tổng: 3 câu/).waitFor();
  await page.getByRole("button", { name: `Bỏ chủ đề ${tenA} khỏi ma trận` }).click();
  await page.getByText(/^Tổng: 1 câu/).waitFor();
  await bamVaCho(page, "Lưu ma trận");
  await page.getByText("Đã lưu ma trận.").first().waitFor();
  const [maTran] = await n.sql<Array<{ matrix: Array<{ topic_id: string; so_cau: number }> }>>`
    SELECT matrix FROM exams WHERE id = ${de.id}`;
  if (maTran?.matrix.length !== 1 || maTran.matrix[0]?.topic_id !== b.id) {
    throw new Error(`Ma trận sau khi đổi chủ đề sai: ${JSON.stringify(maTran?.matrix)}`);
  }

  // 4. Tạo đề hai bước: thông tin chung → ma trận → đề nháp.
  const tenMoi = `Đề hai bước E2E ${duoi}`;
  await page.goto(`${n.web}/quan-tri/de-thi/moi`);
  await page.getByLabel("Tên đề thi", { exact: true }).fill(tenMoi);
  await page.getByLabel("Thời gian làm bài (phút)", { exact: true }).fill("30");
  await Promise.all([
    page.waitForURL("**/quan-tri/de-thi/moi/ma-tran**"),
    page.getByRole("button", { name: "Tiếp tục: soạn ma trận", exact: true }).click(),
  ]);
  await page.getByText(tenMoi).first().waitFor();
  await page.getByText("Ma trận chưa có chủ đề nào.").waitFor();
  if (!(await page.getByRole("button", { name: "Tạo đề thi (bản nháp)" }).isDisabled())) {
    throw new Error("Ma trận trống mà nút tạo đề vẫn bấm được.");
  }
  await page.getByLabel("Thêm chủ đề vào ma trận", { exact: true }).selectOption(a.id);
  await page.getByRole("button", { name: "Thêm chủ đề", exact: true }).click();
  await oSoCau(tenA).fill("3");
  await Promise.all([
    page.waitForURL(/\/quan-tri\/de-thi\/[0-9a-f-]{36}\?da-tao=1$/),
    page.getByRole("button", { name: "Tạo đề thi (bản nháp)", exact: true }).click(),
  ]);
  await page.getByRole("heading", { name: tenMoi }).waitFor();
  await page.getByText("3 câu (3 trắc nghiệm, 0 tự luận) · 3 điểm · 1 chủ đề").waitFor();
  const [moi] = await n.sql<Array<{ duration_minutes: number; status: string }>>`
    SELECT duration_minutes, status FROM exams WHERE title = ${tenMoi}`;
  if (moi?.duration_minutes !== 30 || moi.status !== "nhap") {
    throw new Error(`Đề hai bước lưu sai: ${JSON.stringify(moi)}`);
  }

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
