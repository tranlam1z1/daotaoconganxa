/**
 * Kịch bản E2E soạn, sửa, ngừng, khôi phục, xóa dữ liệu tra cứu trong ứng dụng, khung máy tính 1280×900:
 *  1. trang soạn mở được khung nhập của cả bảy loại;
 *  2. soạn một dòng tốc độ tối đa, trang chuyển sang khung sửa của dòng đó;
 *  3. sửa tên loại đường (trường trước đây chỉ sửa qua tệp nạp) rồi lưu;
 *  4. ngừng dùng, khôi phục về bản nháp, rồi xóa hẳn (dòng chưa từng duyệt).
 */
import type { NguCanhE2E } from "./chay.ts";

const DUONG = "/quan-tri/du-lieu-tra-cuu";
/** Một nhãn chỉ có ở khung nhập của từng loại. */
const NHAN_RIENG = {
  "muc-phat": "Hành vi vi phạm",
  "bien-bao": "Ảnh biển",
  "quy-trinh": "Loại quy trình",
  "toc-do-toi-da": "Mã loại đường",
  "luat-giay-to": "Kiểu kiểm",
  "tai-trong": "Giới hạn (kg)",
  "bieu-mau": "Tệp biểu mẫu",
};

export default async function crudDuLieuTraCuu(n: NguCanhE2E) {
  const ma = `e2e-crud-${crypto.randomUUID().slice(0, 8)}`;
  n.donDep(async () => {
    await n.sql`DELETE FROM speed_limits WHERE code = ${ma}`;
    await n.sql`DELETE FROM content_reviews WHERE ref = ${ma}`;
  });
  const dong = async () => (await n.sql`SELECT * FROM speed_limits WHERE code = ${ma}`)[0] as any;

  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const page = await n.moTrang({ width: 1280, height: 900 });
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  page.on("dialog", (d) => d.accept());
  await n.dangNhap(page, tk);

  // 1. Khung nhập của cả bảy loại.
  for (const [loai, nhan] of Object.entries(NHAN_RIENG)) {
    await page.goto(`${n.web}${DUONG}/moi?loai=${loai}`);
    await page.getByLabel(nhan, { exact: true }).waitFor();
  }

  // 2. Soạn dòng tốc độ tối đa.
  await page.goto(`${n.web}${DUONG}/moi?loai=toc-do-toi-da`);
  await page.getByLabel("Mã", { exact: true }).fill(ma);
  await page.getByLabel("Loại xe theo văn bản").fill(`${ma} xe ô tô con`);
  await page.getByLabel("Mã loại đường").fill(ma);
  await page.getByLabel("Tên loại đường").fill("Đường thử E2E");
  await page.getByLabel("Tốc độ tối đa (km/h)").fill("60");
  await page.getByRole("button", { name: "Nhập URN thủ công" }).click();
  await page.getByLabel("Căn cứ", { exact: true }).fill("vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6");
  await page.getByLabel("Hiệu lực từ ngày").fill("2025-01-01");
  await n.chupAnh(page, "soan-toc-do");
  await Promise.all([
    page.waitForURL((u) => u.pathname === DUONG && u.searchParams.get("ma") === ma),
    page.getByRole("button", { name: "Lưu nháp", exact: true }).click(),
  ]);
  const chiTiet = page.getByRole("region", { name: new RegExp(`^${ma}`) });
  await chiTiet.getByRole("heading", { name: `${ma} · phiên bản 1` }).waitFor();
  if ((await dong())?.created_by == null) throw new Error("Dòng soạn trong ứng dụng phải ghi người soạn.");

  // 3. Sửa tên loại đường.
  await chiTiet.getByLabel("Tên loại đường").fill("Đường thử E2E đã sửa");
  await chiTiet.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await page.getByText("Đã lưu thay đổi.").first().waitFor();
  const sauSua = await dong();
  if (
    sauSua.road_type_name !== "Đường thử E2E đã sửa" ||
    !String(sauSua.name).endsWith("Đường thử E2E đã sửa")
  )
    throw new Error(`Sửa tên loại đường không có tác dụng: ${JSON.stringify(sauSua)}.`);
  await n.chupAnh(page, "sua-toc-do");

  // 4. Ngừng dùng, khôi phục, xóa hẳn.
  await chiTiet.getByRole("button", { name: "Ngừng dùng", exact: true }).click();
  await page.getByText(`Đã ngừng dùng ${ma}.`).first().waitFor();
  await chiTiet.getByRole("button", { name: "Khôi phục về bản nháp", exact: true }).click();
  await page.getByText(`Đã khôi phục ${ma} về bản nháp.`).first().waitFor();
  if ((await dong()).status !== "nhap") throw new Error("Khôi phục phải đưa dòng về bản nháp.");
  await chiTiet.getByRole("button", { name: "Xóa hẳn", exact: true }).click();
  await page.getByText(`Đã xóa ${ma}.`).first().waitFor();
  if (await dong()) throw new Error("Xóa hẳn không xóa dòng khỏi CSDL.");

  if (loiTrang.length) throw new Error(`Trang báo lỗi JavaScript: ${loiTrang.join("; ")}`);
}
