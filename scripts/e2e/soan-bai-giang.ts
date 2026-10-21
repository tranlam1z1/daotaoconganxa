/**
 * Kịch bản E2E soạn bài giảng trong khu quản trị (/quan-tri/chuyen-de) trên khung điện thoại 360×740:
 *  1. tài khoản pháp chế tạo chuyên đề (đường dẫn tự gợi ý từ tên), thêm một bài;
 *  2. thêm khối Thẻ căn cứ, Hỏi nhanh, Ghi nhớ qua biểu mẫu từng loại; xem trước cập nhật khi gõ;
 *  3. mở Sửa rồi đóng không lưu thì nội dung cũ giữ nguyên;
 *  4. đưa bài và chuyên đề qua vòng duyệt tới xuất bản, học viên mở được bài ở /hoc;
 *  5. tài khoản biên tập viên soạn được nhưng không thấy nút Xuất bản.
 *
 * Cần ít nhất một lĩnh vực đào tạo trong CSDL (`bun run db:seed:dao-tao:gtdb`).
 */
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

async function bamVaCho(page: Page, nut: string | RegExp) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST"),
    page
      .getByRole("button", typeof nut === "string" ? { name: nut, exact: true } : { name: nut })
      .first()
      .click(),
  ]);
  await page.waitForLoadState("networkidle");
}

export default async function soanBaiGiang(n: NguCanhE2E) {
  const [linhVuc] = await n.sql<Array<{ id: string }>>`SELECT id FROM fields ORDER BY ordinal LIMIT 1`;
  if (!linhVuc) throw new Error("CSDL chưa có lĩnh vực đào tạo. Chạy bun run db:seed:dao-tao:gtdb.");

  const slug = `${TIEN_TO}soan-${crypto.randomUUID().slice(0, 6)}`;
  n.donDep(() => n.sql`DELETE FROM courses WHERE slug = ${slug}`);

  const tk = await n.taoTaiKhoan({ role: "phap_che", ten: "Pháp chế E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Tạo chuyên đề: gõ tên thì đường dẫn tự gợi ý; đặt lại đường dẫn có tiền tố để dọn được.
  await page.goto(`${n.web}/quan-tri/chuyen-de/moi`);
  await page.getByLabel("Tên chuyên đề", { exact: true }).fill("Xử lý vi phạm E2E");
  const goiY = await page.getByLabel("Đường dẫn", { exact: true }).inputValue();
  if (goiY !== "xu-ly-vi-pham-e2e") throw new Error(`Đường dẫn gợi ý sai: "${goiY}"`);
  await page.getByLabel("Đường dẫn", { exact: true }).fill(slug);
  await page.getByLabel("Lĩnh vực", { exact: true }).selectOption(linhVuc.id);
  await Promise.all([
    page.waitForURL(`**/quan-tri/chuyen-de/${slug}`),
    page.getByRole("button", { name: "Tạo chuyên đề (bản nháp)" }).click(),
  ]);
  await n.kiemKhongCuonNgang(page, "trang chuyên đề");

  // Thêm bài
  await Promise.all([page.waitForURL("**/bai/moi**"), page.getByRole("link", { name: "Thêm bài" }).click()]);
  await page.getByLabel("Tên bài", { exact: true }).fill("Bài một E2E");
  await Promise.all([
    page.waitForURL(/\/bai\/[0-9a-f-]{36}$/),
    page.getByRole("button", { name: "Tạo bài (bản nháp)" }).click(),
  ]);
  const baiUrl = page.url();

  // 2. Thẻ căn cứ: biểu mẫu mở sẵn sau khi thêm; xem trước hiện nguyên văn ngay khi gõ.
  await bamVaCho(page, /^Thẻ căn cứ/);
  await page.getByLabel("Tên điều khoản trích", { exact: true }).fill("Điều 1 Luật số 36/2024/QH15");
  await page
    .getByLabel("Mã văn bản (URN) của điều khoản", { exact: true })
    .fill("vn:vbqppl:l:36/2024/QH15#dieu-1");
  await page
    .getByLabel("Nguyên văn", { exact: true })
    .fill("Luật này quy định về quy tắc giao thông đường bộ.");
  await page.getByText("Luật này quy định về quy tắc giao thông đường bộ.", { exact: true }).last().waitFor();
  await n.kiemKhongCuonNgang(page, "biểu mẫu thẻ căn cứ");
  await bamVaCho(page, "Lưu khối");
  if (await page.getByRole("button", { name: "Lưu khối" }).count()) {
    throw new Error("Biểu mẫu khối không đóng sau khi lưu.");
  }

  // Hỏi nhanh: hai phương án, chọn phương án thứ hai là đáp án.
  await bamVaCho(page, /^Hỏi nhanh/);
  await page.getByLabel("Câu hỏi", { exact: true }).fill("Bước đầu tiên khi chọn văn bản áp dụng là gì?");
  await page.getByLabel("Phương án 1", { exact: true }).fill("Chọn mức phạt");
  await page.getByLabel("Phương án 2", { exact: true }).fill("Xác định thời điểm hành vi");
  await page.getByRole("radio").nth(1).check();
  await page
    .getByLabel("Giải thích sau khi chọn", { exact: true })
    .fill("Thời điểm hành vi quyết định văn bản có hiệu lực.");
  await bamVaCho(page, "Lưu khối");

  // Ghi nhớ
  await bamVaCho(page, /^Ghi nhớ/);
  await page.getByLabel("Ý 1", { exact: true }).fill("Xác định thời điểm hành vi trước.");
  await page.getByRole("button", { name: "Thêm ý" }).click();
  await page.getByLabel("Ý 2", { exact: true }).fill("Tra hiệu lực văn bản tại thời điểm đó.");
  await bamVaCho(page, "Lưu khối");

  // Câu hỏi nhanh chấm đúng trên trang soạn (vẽ bằng component của học viên).
  await page.getByRole("button", { name: "Xác định thời điểm hành vi" }).click();
  await page.getByText("Đúng.", { exact: true }).waitFor();

  // 3. Sửa rồi đóng không lưu: nội dung giữ nguyên sau khi tải lại.
  await page.getByRole("button", { name: "Sửa", exact: true }).first().click();
  await page.getByLabel("Nguyên văn", { exact: true }).fill("Nội dung sẽ bị bỏ.");
  await page.getByRole("button", { name: "Đóng, không lưu" }).click();
  await page.reload();
  if (await page.getByText("Nội dung sẽ bị bỏ.").count())
    throw new Error("Đóng không lưu mà nội dung vẫn đổi.");

  // 4. Vòng duyệt bài
  for (const nut of ["Chuyển sang biên tập", "Gửi pháp chế duyệt", "Xuất bản"]) await bamVaCho(page, nut);
  await page.getByText("Đã xuất bản bài.").first().waitFor();
  // Thông báo hiện ngay khi action xong; chờ loader tải lại để nút trạng thái mới xuất hiện.
  await page.getByRole("button", { name: "Đánh dấu cần cập nhật" }).waitFor();
  await n.kiemKhongCuonNgang(page, "trang bài");
  await n.chupAnh(page, "bai");

  // Vòng duyệt chuyên đề
  await page.goto(`${n.web}/quan-tri/chuyen-de/${slug}`);
  for (const nut of ["Chuyển sang biên tập", "Gửi pháp chế duyệt", "Xuất bản"]) await bamVaCho(page, nut);
  await page.getByText("Đã xuất bản", { exact: true }).first().waitFor();

  // Học viên mở được bài
  const hocVien = await n.taoTaiKhoan({ ten: "Học viên E2E" });
  const trangHoc = await n.moTrang();
  await n.dangNhap(trangHoc, hocVien);
  const baiSlug = (
    await n.sql<
      Array<{ slug: string }>
    >`SELECT slug FROM lessons WHERE id = ${baiUrl.split("/").pop()!}::uuid`
  )[0]?.slug;
  const res = await trangHoc.goto(`${n.web}/hoc/${slug}/${baiSlug}`);
  if (res?.status() !== 200) throw new Error(`Học viên không mở được bài (${res?.status()}).`);
  await trangHoc.getByText("Luật này quy định về quy tắc giao thông đường bộ.").first().waitFor();

  // 5. Biên tập viên: soạn được, không có nút Xuất bản.
  const bienTap = await n.taoTaiKhoan({ role: "bien_tap", ten: "Biên tập E2E" });
  const trangBt = await n.moTrang();
  await n.dangNhap(trangBt, bienTap);
  await trangBt.goto(baiUrl);
  await trangBt.getByRole("button", { name: "Đánh dấu cần cập nhật" }).waitFor();
  if (await trangBt.getByRole("button", { name: "Xuất bản", exact: true }).count()) {
    throw new Error("Biên tập viên thấy nút Xuất bản.");
  }
  if (await trangBt.getByRole("button", { name: "Xóa bài này" }).count()) {
    throw new Error("Biên tập viên thấy nút xóa bài.");
  }

  if (loiTrang.length) throw new Error(`Lỗi JavaScript trên trang: ${loiTrang.join(" | ")}`);
}
