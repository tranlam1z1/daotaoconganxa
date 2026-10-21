/**
 * Kịch bản E2E khung trò chơi chung (docs/PLAN.md GĐ-G0) bằng trò mẫu "Trắc nghiệm nhanh", khung
 * điện thoại 360×740:
 *  1. Trang chủ → "Chơi ngay" (một chạm) → chơi 3 câu → kết quả có XP → xem lại từng câu.
 *     Máy chủ có đúng một dòng XP cho lượt đó.
 *  2. Tải trò về máy → mất mạng → tải lại trang → chơi hết lượt → kết quả lưu trên máy.
 *  3. Có mạng lại: máy chủ có đúng 1 lượt offline, 3 bước, 1 dòng XP. Gửi lại lần hai không
 *     sinh bản trùng, không cộng XP lần hai.
 *
 * Trò mẫu rút câu từ mọi câu đã duyệt, nên đáp án đọc từ ảnh chụp của lượt (online) hoặc tính lại
 * từ gói và seed trên máy (offline), bằng đúng hàm sinh lượt của khung.
 */
import { type CauTrongDe, TRO_CHOI_THU_NGHIEM, taoRng } from "@qdpl/dao-tao";
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import type { Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { hopKetQua } from "./hop-ket-qua.ts";

const NGUOI_TAO = `${TIEN_TO}tro-choi-khung`;

async function cho(dieuKien: () => Promise<boolean>, moTa: string, giay = 20) {
  const het = Date.now() + giay * 1000;
  while (Date.now() < het) {
    if (await dieuKien()) return;
    await Bun.sleep(300);
  }
  throw new Error(`Hết giờ chờ: ${moTa}`);
}

/** Chữ trên nút của đáp án đúng trong một câu đã chụp. */
function chuDapAn(c: CauTrongDe): string {
  const id = c.noi_dung.answer.dung![0]!;
  if (c.noi_dung.kind === "dung_sai") return id === "dung" ? "Đúng" : "Sai";
  return c.de.options.phuong_an!.find((p) => p.id === id)!.text;
}

async function chonVaChot(page: Page, chu: string) {
  await page.getByRole("button", { name: chu, exact: true }).first().click();
  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  await hopKetQua(page).waitFor();
}

async function demServer(n: NguCanhE2E, accountId: string) {
  const [r] = await n.sql<Array<{ luot: number; buoc: number; xp: number }>>`
    SELECT (SELECT count(*)::int FROM game_runs WHERE account_id = ${accountId} AND offline) AS luot,
           (SELECT count(*)::int FROM game_run_steps s JOIN game_runs g ON g.id = s.run_id
              WHERE g.account_id = ${accountId} AND g.offline) AS buoc,
           (SELECT count(*)::int FROM xp_ledger x JOIN game_runs g ON g.id::text = x.source_id
              WHERE x.account_id = ${accountId} AND g.offline) AS xp`;
  return r!;
}

export default async function troChoiKhung(n: NguCanhE2E) {
  // Chủ đề riêng với 4 câu đã duyệt, để chắc chắn đủ nội dung cho trò mẫu.
  const ma = `${TIEN_TO}khung-${crypto.randomUUID().slice(0, 8)}`;
  const chuDe = await luuChuDeCauHoi({ code: ma, name: `Chủ đề khung trò chơi ${ma.slice(-8)}` });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${NGUOI_TAO}`);
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: "de",
    kind: "mot_dap_an",
    stem: `Câu khung trò chơi E2E số ${i + 1}?`,
    options: {
      phuong_an: [
        { id: "a", text: `Phương án đúng ${i + 1}` },
        { id: "b", text: `Phương án sai ${i + 1}` },
      ],
    },
    answer: { dung: ["a"] },
    explanation: "Giải thích của câu E2E.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 4 }, (_, i) => cau(i)),
    NGUOI_TAO,
  );

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ trò chơi E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_packs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Online: một chạm từ trang chủ.
  await page.goto(`${n.web}/`);
  await page.getByRole("button", { name: "Chơi ngay" }).click();
  await page.getByText("Câu 1/3").waitFor();
  await n.kiemKhongCuonNgang(page, "Màn chơi một lượt");
  await n.chupAnh(page, "1-cau-1");
  const [luot] = await n.sql<Array<{ id: string; items: Array<{ noi_dung: CauTrongDe }> }>>`
    SELECT id, items FROM game_runs WHERE account_id = ${tk.id} ORDER BY started_at DESC LIMIT 1`;
  const dapAn = luot!.items.map((b) => chuDapAn(b.noi_dung));
  for (let i = 1; i <= 3; i++) {
    if (i > 1) await page.getByText(`Câu ${i}/3`).waitFor();
    await chonVaChot(page, dapAn[i - 1]!);
    if (i === 1) await n.chupAnh(page, "2-phan-hoi");
    await page.getByRole(i < 3 ? "link" : "button", { name: i < 3 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByRole("heading", { name: "Xem lại từng câu" }).waitFor();
  // Màn xem lại không có hộp (H10); chi tiết của từng câu thu gọn tại chỗ, bấm thì mở.
  if (await page.locator("dialog[open]").count()) throw new Error("Màn xem lại có hộp đang mở.");
  const xemChiTiet = page.getByRole("button", { name: "Xem chi tiết" });
  const soNut = await xemChiTiet.count();
  const coGiaiThich = luot!.items.filter(
    (b) => b.noi_dung.noi_dung.explanation?.trim() || b.noi_dung.noi_dung.citations.length,
  ).length;
  if (soNut !== coGiaiThich)
    throw new Error(`Màn xem lại có ${soNut} nút "Xem chi tiết", cần ${coGiaiThich}.`);
  if (soNut) {
    const nut = xemChiTiet.first();
    const vung = page.locator(`[id="${await nut.getAttribute("aria-controls")}"]`);
    if ((await nut.getAttribute("aria-expanded")) !== "false" || (await vung.isVisible()))
      throw new Error("Chi tiết ở màn xem lại không thu gọn.");
    await nut.click();
    await vung.waitFor();
  }
  await n.kiemKhongCuonNgang(page, "Kết quả lượt chơi");
  await n.chupAnh(page, "3-ket-qua");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_id = ${luot!.id}`) as any;
  if (so !== 1) throw new Error(`Lượt online có ${so} dòng XP, cần đúng 1.`);

  // 2. Offline: tải về, mất mạng, chơi.
  await page.goto(`${n.web}/tro-choi/offline`);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await cho(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    "service worker điều khiển trang",
  );
  await page.locator("li", { hasText: "Trắc nghiệm nhanh" }).getByRole("button", { name: "Tải về" }).click();
  await page.getByRole("button", { name: "Chơi", exact: true }).waitFor();
  await cho(
    () => page.evaluate(async () => Boolean(await caches.match("/tro-choi/offline"))),
    "service worker giữ sẵn trang chơi offline",
  );
  await n.kiemKhongCuonNgang(page, "Trang chơi offline");
  await n.chupAnh(page, "4-da-tai");

  await page.context().setOffline(true);
  await page.reload();
  await page.getByText("Đang không có mạng. Bạn chơi được các trò đã tải về máy.").waitFor();
  await page.getByRole("button", { name: "Chơi", exact: true }).click();
  await page.getByText(/Câu 1\/3/).waitFor();

  // Đáp án tính lại từ gói và seed đang nằm trên máy, bằng đúng hàm sinh lượt của khung.
  const tren = (await page.evaluate(
    () =>
      new Promise((xong, loi) => {
        const mo = indexedDB.open("qdpl-offline");
        mo.onerror = () => loi(mo.error);
        mo.onsuccess = () => {
          const tx = mo.result.transaction(["luot_choi", "goi_tro_choi"], "readonly");
          const l = tx.objectStore("luot_choi").getAll();
          const g = tx.objectStore("goi_tro_choi").get("thu_nghiem");
          tx.oncomplete = () => xong({ luot: l.result, goi: g.result });
        };
      }),
  )) as { luot: Array<{ seed: string; ket_thuc: string | null }>; goi: { nguon: unknown[] } };
  const dangChoi = tren.luot.find((l) => !l.ket_thuc)!;
  const buoc = TRO_CHOI_THU_NGHIEM.taoLuot(tren.goi.nguon, taoRng(dangChoi.seed));
  for (let i = 1; i <= 3; i++) {
    await page.getByText(new RegExp(`Câu ${i}/3`)).waitFor();
    await chonVaChot(page, chuDapAn(buoc[i - 1]!.noi_dung));
    if (i === 1) {
      // Hộp kết quả offline (GĐ17a): giải thích và căn cứ dạng chữ sau "Xem chi tiết".
      const nd = buoc[0]!.noi_dung.noi_dung;
      const hop = hopKetQua(page, "Đúng");
      const xem = hop.getByRole("button", { name: "Xem chi tiết" });
      if (nd.explanation?.trim() || nd.citations.length) {
        await xem.click();
        if (nd.explanation?.trim()) await hop.getByText(nd.explanation.trim()).waitFor();
        if (nd.citations.length) await hop.getByText(/^Căn cứ: /).waitFor();
      } else if (await xem.count())
        throw new Error("Câu không có giải thích, căn cứ mà hộp có Xem chi tiết.");
      await n.chupAnh(page, "5a-hop-offline");
    }
    await hopKetQua(page)
      .getByRole("button", { name: i < 3 ? "Câu tiếp" : "Xem kết quả" })
      .click();
  }
  await page.getByText("Kết quả đã lưu trên máy và sẽ tự gửi khi có mạng.").waitFor();
  await n.chupAnh(page, "5-ket-qua-offline");
  if ((await demServer(n, tk.id)).luot !== 0) throw new Error("Chưa có mạng mà máy chủ đã có lượt offline.");

  // 3. Có mạng lại: tự gửi; máy chủ có 1 lượt, 3 bước, 1 dòng XP.
  await page.context().setOffline(false);
  await cho(async () => {
    const d = await demServer(n, tk.id);
    return d.luot === 1 && d.buoc === 3 && d.xp === 1;
  }, "máy chủ nhận đủ lượt offline");

  // Gửi lại lần hai: không trùng.
  await page.evaluate(
    () =>
      new Promise<void>((xong, loi) => {
        const mo = indexedDB.open("qdpl-offline");
        mo.onsuccess = () => {
          const tx = mo.result.transaction("luot_choi", "readwrite");
          const kho = tx.objectStore("luot_choi");
          const tatCa = kho.getAll();
          tatCa.onsuccess = () => {
            for (const l of tatCa.result) kho.put({ ...l, da_dong_bo: null });
          };
          tx.oncomplete = () => xong();
          tx.onerror = () => loi(tx.error);
        };
      }),
  );
  await page.goto(`${n.web}/tro-choi/offline`);
  await page.getByRole("heading", { name: "Chơi khi không có mạng" }).waitFor();
  await cho(async () => !(await page.getByText(/lượt chơi trên máy chưa gửi lên/).count()), "gửi lại xong");
  const sau = await demServer(n, tk.id);
  if (sau.luot !== 1 || sau.buoc !== 3 || sau.xp !== 1) {
    throw new Error(`Gửi lại lần hai sinh bản trùng: ${JSON.stringify(sau)}`);
  }

  // 4. Trang Tôi: khối điểm mạnh/yếu hiện chủ đề đủ 5 lượt. Ghi thẳng hồ sơ để kết quả không phụ
  // thuộc câu nào được rút vào lượt.
  await n.sql`
    INSERT INTO topic_stats (account_id, topic_id, attempts, correct, score_ema, last_at)
    VALUES (${tk.id}, ${chuDe.id}, 6, 2, 0.3, now())
    ON CONFLICT (account_id, topic_id) DO UPDATE SET attempts = 6, correct = 2, score_ema = 0.3`;
  await page.goto(`${n.web}/toi`);
  const khoi = page.locator("section", { has: page.getByRole("heading", { name: "Điểm mạnh, điểm yếu" }) });
  await khoi.getByText(chuDe.name).waitFor();
  await khoi.getByText("30%").waitFor();
  await n.kiemKhongCuonNgang(page, "Trang Tôi");
  await n.chupAnh(page, "6-ho-so-chu-de");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
