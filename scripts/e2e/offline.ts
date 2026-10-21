/**
 * Kịch bản E2E luyện tập offline (docs/PLAN.md GĐ13) trên khung điện thoại 360×740:
 *  0. trang cài được: Chrome không báo lỗi cài đặt (Page.getInstallabilityErrors, cùng kiểm tra mà
 *     Lighthouse dùng cho mục "Installable"), manifest có đủ icon;
 *  1. tải gói một chủ đề;
 *  2. context.setOffline(true);
 *  3. tải lại trang, luyện 10 câu; mở /thi và /hoi-dap thấy "Cần có mạng";
 *  4. setOffline(false);
 *  5. máy chủ có đúng 10 practice_answers; đồng bộ lần hai không sinh bản trùng.
 *
 * Tự tạo một chủ đề riêng với 12 câu đã duyệt, để kết quả không phụ thuộc dữ liệu seed.
 */
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";

const NGUOI_TAO = `${TIEN_TO}offline`;

async function cho(dieuKien: () => Promise<boolean>, moTa: string, giay = 20) {
  const het = Date.now() + giay * 1000;
  while (Date.now() < het) {
    if (await dieuKien()) return;
    await Bun.sleep(300);
  }
  throw new Error(`Hết giờ chờ: ${moTa}`);
}

async function soCauTraLoiOffline(n: NguCanhE2E, accountId: string): Promise<number> {
  const [r] = await n.sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM practice_answers a JOIN practice_sessions s ON s.id = a.session_id
    WHERE s.account_id = ${accountId} AND s.offline`;
  return r?.n ?? 0;
}

/** Đánh dấu mọi phiên trên máy là chưa gửi, để buộc đồng bộ lần hai. */
async function datLaiChuaGui(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((xong, loi) => {
        const mo = indexedDB.open("qdpl-offline");
        mo.onerror = () => loi(mo.error);
        mo.onsuccess = () => {
          const tx = mo.result.transaction("phien", "readwrite");
          const kho = tx.objectStore("phien");
          const tatCa = kho.getAll();
          tatCa.onsuccess = () => {
            for (const p of tatCa.result) kho.put({ ...p, da_dong_bo: null });
          };
          tx.oncomplete = () => xong();
          tx.onerror = () => loi(tx.error);
        };
      }),
  );
}

export default async function offline(n: NguCanhE2E) {
  // Dữ liệu riêng của kịch bản.
  const ma = `${TIEN_TO}offline-${crypto.randomUUID().slice(0, 8)}`;
  const tenChuDe = `Chủ đề offline ${ma.slice(-8)}`;
  const chuDe = await luuChuDeCauHoi({ code: ma, name: tenChuDe });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO} AND topic_id = ${chuDe.id}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: "mot_dap_an",
    stem: `Câu offline E2E số ${i + 1}: Luật số 36/2024/QH15 là Luật Trật tự, an toàn giao thông đường bộ?`,
    options: {
      phuong_an: [
        { id: "a", text: "Có" },
        { id: "b", text: "Không" },
      ],
    },
    answer: { dung: ["a"] },
    explanation: "Luật số 36/2024/QH15 là Luật Trật tự, an toàn giao thông đường bộ.",
    citations: ["vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3"],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 12 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ offline E2E" });
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 0. Service worker và khả năng cài đặt.
  await page.goto(`${n.web}/luyen-tap/offline`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Tải lại để service worker điều khiển trang (và giữ các tệp của trang).
  await page.reload();
  await cho(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    "service worker điều khiển trang",
  );
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as {
    installabilityErrors: Array<{ errorId: string }>;
  };
  // Context của Playwright luôn là cửa sổ ẩn danh, nên Chrome luôn báo "in-incognito"; đó là
  // điều kiện của môi trường chạy thử, không phải lỗi của ứng dụng. Mọi mã lỗi khác đều tính.
  const loiCaiDat = installabilityErrors.map((e) => e.errorId).filter((ma) => ma !== "in-incognito");
  if (loiCaiDat.length) throw new Error(`Chrome báo chưa cài được: ${loiCaiDat.join(", ")}`);
  const manifest = (await (await fetch(`${n.web}/manifest.webmanifest`)).json()) as {
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  for (const c of ["192x192", "512x512"]) {
    if (!manifest.icons.some((i) => i.sizes === c)) throw new Error(`Manifest thiếu icon ${c}.`);
  }
  if (!manifest.icons.some((i) => i.purpose === "maskable")) throw new Error("Manifest thiếu icon maskable.");
  for (const i of manifest.icons) {
    if ((await fetch(`${n.web}${i.src}`)).status !== 200) throw new Error(`Không tải được icon ${i.src}.`);
  }

  // 1. Tải gói chủ đề.
  await page.locator("li", { hasText: tenChuDe }).getByRole("button", { name: "Tải về" }).click();
  await page.getByRole("button", { name: "Luyện 10 câu" }).waitFor();
  await n.kiemKhongCuonNgang(page, "Trang luyện tập offline");
  await n.chupAnh(page, "1-da-tai");
  await cho(
    () => page.evaluate(async () => Boolean(await caches.match("/luyen-tap/offline"))),
    "service worker giữ sẵn trang luyện tập offline",
  );

  // Mất mạng khi đang ở trang khác: liên kết trên biểu ngữ mở được trang đã giữ (chuyển trang phía
  // client cần tải /__manifest nên hỏng khi mất mạng; liên kết phải tải cả trang).
  const trangChu = await page.context().newPage();
  await trangChu.goto(`${n.web}/`);
  await page.context().setOffline(true);
  await trangChu.getByRole("link", { name: "Luyện tập không cần mạng" }).click();
  await trangChu.getByRole("heading", { name: "Luyện tập không cần mạng" }).waitFor();
  await trangChu.close();

  // 2–3. Mất mạng, tải lại trang, luyện 10 câu (câu lẻ chọn sai).
  await page.context().setOffline(true);
  await page.reload();
  await page.getByText("Đang không có mạng. Bạn vẫn luyện được các chủ đề đã tải về máy.").waitFor();
  await page.getByRole("button", { name: "Luyện 10 câu" }).click();
  for (let i = 1; i <= 10; i++) {
    await page.getByText(`Câu ${i}/10`).waitFor();
    await page.getByRole("button", { name: i % 2 ? "Không" : "Có", exact: true }).click();
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    await page
      .locator("[role=status]")
      .filter({ hasText: /Đúng\.|Chưa đúng\./ })
      .waitFor();
    if (i === 3) {
      // Tải lại giữa chừng khi vẫn mất mạng: làm tiếp đúng câu 4.
      await page.reload();
      await page.getByText("Câu 4/10").waitFor();
      await page.getByText("Câu 4/10").waitFor();
      continue;
    }
    await page.getByRole("button", { name: i < 10 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await page.getByText("Đúng 5/10 câu").waitFor();
  await page.getByText("Kết quả đã lưu trên máy và sẽ tự gửi khi có mạng.").waitFor();
  await n.chupAnh(page, "2-ket-qua-offline");
  if ((await soCauTraLoiOffline(n, tk.id)) !== 0)
    throw new Error("Chưa có mạng mà máy chủ đã có câu trả lời.");

  // Trang cần mạng: "Cần có mạng", không phải trang lỗi.
  const trangKhac = await page.context().newPage();
  for (const duong of ["/thi", "/hoi-dap"]) {
    await trangKhac.goto(`${n.web}${duong}`);
    await trangKhac.getByRole("heading", { name: "Cần có mạng" }).waitFor();
  }
  await n.chupAnh(trangKhac, "3-can-co-mang");
  await trangKhac.close();

  // 4–5. Có mạng lại: tự gửi, máy chủ có đúng 10 câu trả lời.
  await page.context().setOffline(false);
  await cho(async () => (await soCauTraLoiOffline(n, tk.id)) === 10, "máy chủ nhận đủ 10 câu trả lời");
  const [phien] = await n.sql<Array<{ correct: number; total: number; finished_at: Date | null }>>`
    SELECT correct, total, finished_at FROM practice_sessions WHERE account_id = ${tk.id} AND offline`;
  if (phien?.correct !== 5 || phien.total !== 10 || !phien.finished_at) {
    throw new Error(`Phiên đồng bộ sai: ${JSON.stringify(phien)}`);
  }

  // Đồng bộ lần hai không sinh bản trùng.
  await datLaiChuaGui(page);
  await page.goto(`${n.web}/luyen-tap/offline`);
  await page.getByRole("heading", { name: "Luyện tập không cần mạng" }).waitFor();
  await cho(() => page.evaluate(() => navigator.onLine), "trình duyệt có mạng");
  // Trang tự gửi phiên đang chờ khi mở; đợi hàng đợi trống.
  await cho(
    async () => !(await page.getByText(/phiên đã làm trên máy chưa gửi lên/).count()),
    "gửi lại xong",
  );
  if ((await soCauTraLoiOffline(n, tk.id)) !== 10) throw new Error("Đồng bộ lần hai sinh bản trùng.");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
