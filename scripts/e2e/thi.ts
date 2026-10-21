/**
 * Kịch bản E2E thi sát hạch (docs/PLAN.md GĐ6) trên khung điện thoại 360×740:
 * danh sách bài thi → bắt đầu → trả lời → TẢI LẠI TRANG giữa chừng (câu đã chọn còn nguyên)
 * → nộp qua hộp xác nhận → kết quả → danh sách báo "Đã làm".
 *
 * Tự tạo chủ đề với 35 câu đã duyệt (đáp án đúng luôn là "Phương án c"), một đề 35 câu và một
 * bài giao cho tài khoản E2E, để kết quả không phụ thuộc dữ liệu seed.
 */
import {
  doiTrangThaiDeThi,
  luuChuDeCauHoi,
  type TaoCauHoiInput,
  taoDeThi,
  taoGiaoBai,
  taoNhieuCauHoi,
} from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}thi`;

export default async function thi(n: NguCanhE2E) {
  const ma = `${TIEN_TO}thi-${crypto.randomUUID().slice(0, 8)}`;
  const chuDe = await luuChuDeCauHoi({ code: ma, name: `Chủ đề thi E2E ${ma.slice(-8)}` });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO} AND topic_id = ${chuDe.id}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: "de",
    kind: "mot_dap_an",
    stem: `Câu thi E2E số ${i + 1}: chọn phương án c.`,
    options: { phuong_an: ["a", "b", "c", "d"].map((x) => ({ id: x, text: `Phương án ${x}` })) },
    answer: { dung: ["c"] },
    explanation: "Đáp án đúng là phương án c.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 35 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );

  const tieuDe = `Đề thi E2E ${ma.slice(-8)}`;
  const de = await taoDeThi(
    {
      title: tieuDe,
      matrix: [{ topic_id: chuDe.id, level: "de", so_cau: 35 }],
      question_count: 35,
      duration_minutes: 20,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: true,
      max_attempts: 1,
      show_answers: "sau_nop",
    },
    NGUOI_TAO,
  );
  n.donDep(() => n.sql`DELETE FROM exams WHERE id = ${de.id}`);
  await doiTrangThaiDeThi(de.id, "xuat_ban", NGUOI_TAO);

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ thi E2E" });
  await taoGiaoBai(
    {
      exam_id: de.id,
      unit_id: null,
      account_id: tk.id,
      include_subunits: false,
      opens_at: new Date(Date.now() - 60_000),
      due_at: new Date(Date.now() + 86_400_000),
    },
    NGUOI_TAO,
    null,
  );

  const page = await n.moTrang();
  await n.dangNhap(page, tk);

  // 1. Danh sách bài thi.
  await page.goto(`${n.web}/thi`);
  await page.getByText(tieuDe).waitFor();
  await n.kiemKhongCuonNgang(page, "Danh sách bài thi");
  await n.chupAnh(page, "1-danh-sach");
  await Promise.all([
    page.waitForURL(/\/thi\/luot\/[0-9a-f-]{36}/),
    page.getByRole("button", { name: "Bắt đầu làm bài" }).click(),
  ]);
  const urlLuot = page.url().split("?")[0] as string;

  // 2. Trả lời câu 1 đúng, câu 2 sai.
  const daLuu = () => page.getByText("Câu trả lời đã được lưu").waitFor({ timeout: 10_000 });
  await page.getByText("Câu 1/35").waitFor();
  // Đồng hồ đếm ngược hiện dạng mm:ss, còn khoảng 20 phút.
  const dongHo =
    (
      await page
        .getByText(/^\d{2}:\d{2}$/)
        .first()
        .textContent()
    )?.trim() ?? "";
  if (!/^(19|20):\d{2}$/.test(dongHo)) throw new Error(`Đồng hồ hiển thị sai: "${dongHo}"`);
  await page.getByRole("button", { name: /Phương án c/ }).click();
  await daLuu();
  await n.kiemKhongCuonNgang(page, "Trang làm bài");
  await n.chupAnh(page, "2-lam-bai");
  await page.getByRole("button", { name: "Câu sau" }).click();
  await page.getByText("Câu 2/35").waitFor();
  await page.getByRole("button", { name: /Phương án a/ }).click();
  await daLuu();

  // 3. Tải lại trang giữa chừng: vẫn ở câu 2, câu đã chọn còn nguyên, đồng hồ vẫn chạy.
  await page.reload();
  await page.getByText("Câu 2/35").waitFor();
  const chon2 = await page.getByRole("button", { name: /Phương án a/ }).getAttribute("aria-pressed");
  if (chon2 !== "true") throw new Error("Tải lại trang: câu 2 mất lựa chọn đã lưu");
  await page.getByRole("button", { name: "Câu trước" }).click();
  await page.getByText("Câu 1/35").waitFor();
  const chon1 = await page.getByRole("button", { name: /Phương án c/ }).getAttribute("aria-pressed");
  if (chon1 !== "true") throw new Error("Tải lại trang: câu 1 mất lựa chọn đã lưu");
  if (!(await page.getByText("(2 đã làm)").isVisible()))
    throw new Error("Bộ đếm câu đã làm sai sau khi tải lại");

  // 4. Nộp bài qua hộp xác nhận.
  await page.getByRole("button", { name: "Nộp bài" }).first().click();
  const hop = page.getByRole("dialog");
  await hop.getByText("Còn 33 câu chưa trả lời").waitFor();
  await n.chupAnh(page, "3-xac-nhan-nop");
  await Promise.all([
    page.waitForURL(`${urlLuot}/ket-qua`),
    hop.getByRole("button", { name: "Nộp bài" }).click(),
  ]);

  // 5. Kết quả: 1/35 câu đúng, chưa đạt, có phần xem lại (đề cho xem sau khi nộp).
  await page.getByRole("heading", { name: "Chưa đạt" }).waitFor();
  if (!(await page.getByText("1/35").isVisible())) throw new Error("Kết quả không phải 1/35 câu đúng");
  if (!(await page.getByRole("heading", { name: "Xem lại bài làm" }).isVisible())) {
    throw new Error("Thiếu phần xem lại bài làm dù đề cho xem đáp án sau khi nộp");
  }
  await n.kiemKhongCuonNgang(page, "Trang kết quả");
  await n.chupAnh(page, "4-ket-qua");

  // 6. Mở lại trang làm bài của lượt đã nộp thì chuyển sang kết quả; danh sách báo "Đã làm".
  await page.goto(urlLuot);
  await page.waitForURL(`${urlLuot}/ket-qua`);
  await page.goto(`${n.web}/thi`);
  await page.getByText("Đã làm", { exact: true }).waitFor();
  if (await page.getByRole("button", { name: "Bắt đầu làm bài" }).count()) {
    throw new Error("Đề chỉ cho làm 1 lần nhưng vẫn hiện nút bắt đầu");
  }
}
