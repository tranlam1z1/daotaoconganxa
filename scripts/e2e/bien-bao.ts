/**
 * Kịch bản E2E biển báo (docs/PLAN.md GĐ12) trên khung điện thoại 360×740:
 *  1. Lưới biển báo tải lần đầu dưới 2 giây trên mạng 4G giả lập (4 Mbit/s, trễ 20 ms), ảnh
 *     lười và mỗi ảnh ≤ 20 KB; lọc theo nhóm, tìm theo tên, mở chi tiết.
 *
 * Tự tạo bản sao đã duyệt của các biển mẫu (mã có tiền tố e2e-), dùng lại ảnh trong
 * data/bien-bao/anh/, xóa khi xong. Không đụng dữ liệu biển báo thật.
 */
import { join } from "node:path";
import { chuoiTimBienBao } from "@qdpl/dao-tao";
import { putFromFile } from "@qdpl/storage";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const THU_MUC = join(import.meta.dir, "..", "..", "data", "bien-bao");
const GIOI_HAN_MS = 2000;

export default async function bienBao(n: NguCanhE2E) {
  const mau = (
    (await Bun.file(join(THU_MUC, "bien-bao.json")).json()) as {
      bien: Array<{ ma: string; nhom: string; ten: string; y_nghia: string; anh: string; can_cu: string }>;
    }
  ).bien;
  const duoi = crypto.randomUUID().slice(0, 6);
  const ma = (m: string) => `${TIEN_TO}${duoi}-${m}`;
  n.donDep(() => n.sql`DELETE FROM traffic_signs WHERE code LIKE ${`${TIEN_TO}${duoi}-%`}`);
  for (const [i, b] of mau.entries()) {
    await putFromFile(`assets/bien-bao/${b.anh}`, join(THU_MUC, "anh", b.anh));
    const ten = `${b.ten} (E2E ${duoi})`;
    await n.sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, search_text, image_uri, citation_urn, ordinal, status)
      VALUES (${ma(b.ma)}, ${b.nhom}, ${ten}, ${b.y_nghia}, ${chuoiTimBienBao({ ma: ma(b.ma), ten })},
              ${`assets/bien-bao/${b.anh}`}, ${b.can_cu}, ${1000 + i}, 'da_duyet')`;
  }

  /* 1. Lưới biển báo trên 4G giả lập -------------------------------- */
  const page = await n.moTrang();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });
  const batDau = Date.now();
  await page.goto(`${n.web}/tra-cuu-nhanh/bien-bao`, { waitUntil: "load" });
  // Chờ mọi ảnh đang nằm trong khung nhìn tải xong (ảnh ngoài khung tải lười, không tính).
  await page.waitForFunction(() =>
    [...document.querySelectorAll("main img")]
      .filter((i) => i.getBoundingClientRect().top < window.innerHeight)
      .every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
  );
  const thoiGian = Date.now() - batDau;
  console.log(`  lưới biển báo tải lần đầu trên 4G giả lập: ${thoiGian} ms`);
  if (thoiGian >= GIOI_HAN_MS) throw new Error(`Lưới biển báo tải ${thoiGian} ms, quá ${GIOI_HAN_MS} ms.`);
  const anhLuoi = await page
    .locator("main ul img")
    .evaluateAll((ds) => ds.map((i) => ({ lazy: i.getAttribute("loading"), w: i.getAttribute("width") })));
  if (!anhLuoi.length || anhLuoi.some((a) => a.lazy !== "lazy" || !a.w)) {
    throw new Error("Ảnh trong lưới phải tải lười và có kích thước cố định.");
  }
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await n.kiemKhongCuonNgang(page, "Lưới biển báo");
  await n.chupAnh(page, "1-luoi");

  // Lọc nhóm "Biển cấm", tìm theo tên, mở chi tiết.
  await Promise.all([
    page.waitForURL(/nhom=cam/),
    page.getByRole("link", { name: "Biển cấm", exact: true }).click(),
  ]);
  // Sau khi lọc xong, biển nguy hiểm phải biến khỏi lưới.
  await page.getByText(`Trẻ em (E2E ${duoi})`).waitFor({ state: "detached" });
  await page.getByText(`Cấm đi ngược chiều (E2E ${duoi})`).waitFor();
  await page.getByLabel("Tên hoặc mã biển").fill(`nguoc chieu (e2e ${duoi})`);
  await page.getByRole("button", { name: "Tìm biển báo" }).click();
  await page.getByRole("link", { name: new RegExp(`Cấm đi ngược chiều \\(E2E ${duoi}\\)`) }).click();
  await page.getByRole("heading", { name: `Cấm đi ngược chiều (E2E ${duoi})` }).waitFor();
  await n.kiemKhongCuonNgang(page, "Chi tiết biển báo");
  await n.chupAnh(page, "2-chi-tiet");
}
