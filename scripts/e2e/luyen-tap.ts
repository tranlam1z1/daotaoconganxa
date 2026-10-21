/**
 * Kịch bản E2E luyện tập (docs/PLAN.md GĐ4) trên khung điện thoại 360×740:
 * đăng nhập → chọn chủ đề → làm 10 câu (mở căn cứ ở một câu) → xem kết quả → trang "Tôi".
 *
 * Tự tạo một chủ đề riêng với 12 câu đã duyệt, để kết quả không phụ thuộc dữ liệu seed.
 */
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}luyen-tap`;
const CAN_CU = "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3";

export default async function luyenTap(n: NguCanhE2E) {
  // Dữ liệu riêng của kịch bản.
  const ma = `${TIEN_TO}luyen-tap-${crypto.randomUUID().slice(0, 8)}`;
  const tenChuDe = `Chủ đề E2E ${ma.slice(-8)}`;
  const chuDe = await luuChuDeCauHoi({ code: ma, name: tenChuDe });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO} AND topic_id = ${chuDe.id}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: i % 4 === 3 ? "dung_sai" : "mot_dap_an",
    stem: `Câu luyện tập E2E số ${i + 1}: Luật số 36/2024/QH15 là luật gì?`,
    options:
      i % 4 === 3
        ? {}
        : {
            phuong_an: [
              { id: "a", text: "Luật Trật tự, an toàn giao thông đường bộ" },
              { id: "b", text: "Luật Đường bộ" },
              { id: "c", text: "Luật Xử lý vi phạm hành chính" },
            ],
          },
    answer: { dung: [i % 4 === 3 ? "dung" : "a"] },
    explanation: "Luật số 36/2024/QH15 là Luật Trật tự, an toàn giao thông đường bộ.",
    // Căn cứ trỏ vào văn bản mẫu mà seed.ts luôn nạp, để ngăn kéo căn cứ hiện được nội dung thật.
    citations: [CAN_CU],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 12 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ luyện tập E2E" });
  const page = await n.moTrang();
  await n.dangNhap(page, tk);

  // 1. Chọn chủ đề.
  await page.goto(`${n.web}/luyen-tap`);
  await n.kiemKhongCuonNgang(page, "Trang chọn chủ đề");
  await n.chupAnh(page, "1-chu-de");
  await Promise.all([
    page.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}/),
    page.locator("button", { hasText: tenChuDe }).click(),
  ]);

  // 2. Làm 10 câu: câu dạng đúng/sai chọn "Sai" (trả lời sai), còn lại chọn phương án đầu.
  let soSai = 0;
  for (let i = 1; i <= 10; i++) {
    await page.getByText(`Câu ${i}/10`).waitFor();
    const coSai = await page.getByRole("button", { name: "Sai", exact: true }).count();
    if (coSai) {
      await page.getByRole("button", { name: "Sai", exact: true }).click();
      soSai++;
    } else {
      await page.getByRole("button", { name: /Luật Trật tự, an toàn giao thông đường bộ/ }).click();
    }
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    await page
      .locator("[role=status]")
      .filter({ hasText: /Đúng\.|Chưa đúng\./ })
      .waitFor();

    if (i === 1) {
      await n.kiemKhongCuonNgang(page, "Câu 1 sau khi kiểm tra");
      await n.chupAnh(page, "2-phan-hoi");
      // Mở căn cứ trong ngăn kéo rồi đóng lại.
      await page
        .getByRole("button", { name: /Điều 3 Nghị định số 100\/2026/ })
        .first()
        .click();
      await page.getByRole("dialog", { name: "Căn cứ pháp lý" }).waitFor();
      // Nội dung điều khoản đã tải: có tiêu đề "Điều 3" bên trong ngăn kéo, không phải thông báo lỗi.
      await page
        .getByRole("dialog")
        .locator("h3, h4, strong, p")
        .filter({ hasText: /^Điều 3/ })
        .first()
        .waitFor();
      await n.chupAnh(page, "3-can-cu");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "detached" });
    }

    if (i < 10) {
      await page.getByRole("link", { name: "Câu tiếp" }).click();
    } else {
      await Promise.all([
        page.waitForURL(/\/ket-qua$/),
        page.getByRole("button", { name: "Xem kết quả" }).click(),
      ]);
    }
  }

  // 3. Kết quả.
  await page.getByText(`Đúng ${10 - soSai}/10 câu`).waitFor();
  await n.kiemKhongCuonNgang(page, "Trang kết quả");
  await n.chupAnh(page, "4-ket-qua");
  if (soSai > 0) await page.getByRole("button", { name: "Luyện lại câu sai" }).waitFor();

  // 4. Trang Tôi có phiên vừa làm và đúng số câu sai.
  await page.goto(`${n.web}/toi`);
  await page
    .getByText(`${10 - soSai}/10`)
    .first()
    .waitFor();
  if (soSai > 0) await page.getByRole("button", { name: `Luyện câu sai (${soSai})` }).waitFor();
  await n.kiemKhongCuonNgang(page, "Trang Tôi");
  await n.chupAnh(page, "5-toi");
}
