/**
 * Kịch bản E2E độ mượt của lớp hiệu ứng trò chơi (docs/VISUAL_STYLE.md §6), khung điện thoại 360×740,
 * CPU chậm 4× (giả lập máy tầm trung) qua Chrome DevTools Protocol.
 *
 * Kiểm:
 * 1. Chế độ thường, âm thanh tắt (mặc định): chơi 3 xe Súng bắn tốc độ, không có AudioContext nào được
 *    tạo; thẻ câu chạy hoạt ảnh thật (g-truot-vao hoặc g-vao-len). Bật loa rồi chơi xe 4 thì có âm.
 * 2. Hệ điều hành bật giảm chuyển động (prefers-reduced-motion): chơi trọn 10 xe tới tổng kết. Mọi
 *    `.g-a` chỉ còn hiện dần (g-hien), mọi `.g-t` tắt hẳn, vệt xe ẩn, không có pháo hoa, điểm hiện ngay.
 * 3. Đo khung hình trong các đoạn có hoạt ảnh (xe lao, số chạy, phản hồi) ở cả hai chế độ; in ra số
 *    liệu và hỏng khi quá 5% khung dài hơn 100 ms.
 * 4. Trang /game-style-demo: học viên không vào được; biên tập vào được, bấm hết các nút "Chạy lại"
 *    không lỗi, không cuộn ngang; công tắc "Giảm hiệu ứng" trong trang đổi được cả khu trò chơi.
 */

import type { BuocSungBan } from "@qdpl/dao-tao";
import type { Page } from "playwright-core";
import type { NguCanhE2E } from "./chay.ts";
import { TIEN_TO } from "./chay.ts";
import { chonVaChot, chuanBiSungBan } from "./sung-ban-toc-do.ts";

const PREFIX = `${TIEN_TO}muot-`;

/** Đếm AudioContext được tạo và ghi thời gian giữa các khung hình khi đang đo. */
const MA_DO = `
  window.__soAudio = 0;
  for (const ten of ["AudioContext", "webkitAudioContext"]) {
    const Goc = window[ten];
    if (!Goc) continue;
    window[ten] = class extends Goc { constructor(...a) { super(...a); window.__soAudio++; } };
  }
  window.__khung = null;
  let truoc = 0;
  const vong = (t) => {
    if (window.__khung) { if (truoc) window.__khung.push(t - truoc); truoc = t; } else truoc = 0;
    requestAnimationFrame(vong);
  };
  requestAnimationFrame(vong);
`;

async function doKhung(page: Page, ms: number, dsKhung: number[]) {
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  await page.waitForTimeout(ms);
  const ds = await page.evaluate(() => {
    const d = (window as any).__khung as number[];
    (window as any).__khung = null;
    return d;
  });
  dsKhung.push(...ds);
}

function thongKe(ds: number[]) {
  const sx = [...ds].sort((a, b) => a - b);
  const p = (q: number) => sx[Math.min(sx.length - 1, Math.floor(q * sx.length))] ?? 0;
  const dai = ds.filter((d) => d > 100).length;
  return {
    soKhung: ds.length,
    trungVi: p(0.5),
    p95: p(0.95),
    lonNhat: sx.at(-1) ?? 0,
    tiLeDai: ds.length ? dai / ds.length : 0,
  };
}

function inThongKe(ten: string, ds: number[]) {
  const t = thongKe(ds);
  console.log(
    `  ${ten}: ${t.soKhung} khung, trung vị ${t.trungVi.toFixed(1)} ms, p95 ${t.p95.toFixed(1)} ms, ` +
      `lớn nhất ${t.lonNhat.toFixed(0)} ms, khung >100 ms: ${(t.tiLeDai * 100).toFixed(1)}%`,
  );
  if (t.soKhung < 20) throw new Error(`${ten}: đo được quá ít khung (${t.soKhung}).`);
  if (t.tiLeDai > 0.05) throw new Error(`${ten}: ${(t.tiLeDai * 100).toFixed(1)}% khung dài hơn 100 ms.`);
}

async function moTrangDo(n: NguCanhE2E, giam: boolean) {
  const page = await n.moTrang();
  await page.addInitScript(MA_DO);
  if (giam) await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return page;
}

async function vaoChoi(n: NguCanhE2E, page: Page, tkId: string) {
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Súng bắn tốc độ", exact: true }).click();
  await page.getByRole("dialog", { name: "Súng bắn tốc độ" }).getByRole("button", { name: "Chơi" }).click();
  await page.getByText("Câu 1/10").waitFor();
  const [luot] = (await n.sql`
    SELECT items FROM game_runs WHERE account_id = ${tkId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return (luot.items as Array<{ noi_dung: BuocSungBan }>).map((b) => b.noi_dung);
}

/** Tên hoạt ảnh đang áp cho từng nhóm lớp. */
async function tenHoatAnh(page: Page) {
  return page.evaluate(() => {
    const lay = (sel: string) =>
      [...document.querySelectorAll(sel)].map((el) => getComputedStyle(el).animationName);
    const vet = [...document.querySelectorAll(".g-an-khi-giam")].map((el) => getComputedStyle(el).display);
    return { a: lay(".g-a"), t: lay(".g-t"), vet };
  });
}

async function soAudio(page: Page) {
  return page.evaluate(() => (window as any).__soAudio as number);
}

export default async function troChoiMuot(n: NguCanhE2E) {
  await chuanBiSungBan(n, PREFIX);
  const loiTrang: string[] = [];

  /* 1. Chế độ thường, âm thanh tắt ----------------------------------- */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ đo độ mượt E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const thuong = await moTrangDo(n, false);
  thuong.on("pageerror", (e) =>
    loiTrang.push(`${e.message.slice(0, 40)} @ ${new URL(thuong.url()).pathname}`),
  );
  await n.dangNhap(thuong, tk);
  const buocA = await vaoChoi(n, thuong, tk.id);
  const khungThuong: number[] = [];
  for (let i = 1; i <= 4; i++) {
    if (i > 1) await thuong.getByText(`Câu ${i}/10`).waitFor();
    if (i === 1) {
      const ha = await tenHoatAnh(thuong);
      if (!ha.a.some((x) => x === "g-truot-vao" || x === "g-vao-len" || x === "g-xe-lao"))
        throw new Error(`Chế độ thường không thấy hoạt ảnh vào câu: ${ha.a.join(", ")}`);
    }
    if (i === 4) {
      // Bật loa: từ đây mới được tạo AudioContext.
      await thuong.getByRole("button", { name: "Bật âm thanh" }).click();
    }
    await doKhung(thuong, 1200, khungThuong); // xe lao qua, số tốc độ chạy
    await chonVaChot(thuong, buocA[i - 1]!, i !== 2);
    await doKhung(thuong, 800, khungThuong); // dấu đúng/sai, rung ngang, +điểm
    if (i === 3 && (await soAudio(thuong)) !== 0)
      throw new Error(`Âm thanh đang tắt nhưng đã tạo ${await soAudio(thuong)} AudioContext.`);
    if (i < 4) await thuong.getByRole("link", { name: "Câu tiếp" }).click();
  }
  if ((await soAudio(thuong)) < 1) throw new Error("Đã bật âm thanh nhưng không phát âm nào.");
  await n.chupAnh(thuong, "1-thuong-cau-4");
  inThongKe("Chế độ thường, CPU chậm 4×", khungThuong);

  /* 2. Giảm chuyển động, âm thanh tắt -------------------------------- */
  const tk2 = await n.taoTaiKhoan({ ten: "Cán bộ giảm chuyển động E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk2.id}`);
  const giam = await moTrangDo(n, true);
  giam.on("pageerror", (e) => loiTrang.push(`${e.message.slice(0, 40)} @ ${new URL(giam.url()).pathname}`));
  await n.dangNhap(giam, tk2);
  const buocB = await vaoChoi(n, giam, tk2.id);
  const khungGiam: number[] = [];
  for (let i = 1; i <= 10; i++) {
    if (i > 1) await giam.getByText(`Câu ${i}/10`).waitFor();
    if (i <= 3) await doKhung(giam, 1200, khungGiam);
    await chonVaChot(giam, buocB[i - 1]!, true);
    if (i <= 3) await doKhung(giam, 800, khungGiam);
    if (i === 1) {
      const ha = await tenHoatAnh(giam);
      const aSai = ha.a.filter((x) => x !== "g-hien");
      const tSai = ha.t.filter((x) => x !== "none");
      if (!ha.a.length) throw new Error("Không thấy phần tử .g-a nào để kiểm.");
      if (aSai.length) throw new Error(`Giảm chuyển động nhưng .g-a còn: ${aSai.join(", ")}`);
      if (tSai.length) throw new Error(`Giảm chuyển động nhưng .g-t còn: ${tSai.join(", ")}`);
      if (ha.vet.some((d) => d !== "none")) throw new Error("Giảm chuyển động nhưng vệt xe vẫn hiện.");
      await n.chupAnh(giam, "2-giam-phan-hoi-xe-1");
    }
    await giam.getByRole(i < 10 ? "link" : "button", { name: i < 10 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await giam.getByText("Đúng 10/10").waitFor();
  await giam.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  if (await giam.locator("canvas").count()) throw new Error("Giảm chuyển động nhưng vẫn bắn pháo hoa.");
  const tSaiKq = (await tenHoatAnh(giam)).t.filter((x) => x !== "none");
  if (tSaiKq.length) throw new Error(`Màn kết quả khi giảm chuyển động còn: ${tSaiKq.join(", ")}`);
  if ((await soAudio(giam)) !== 0) throw new Error("Âm thanh đang tắt nhưng đã tạo AudioContext.");
  await n.kiemKhongCuonNgang(giam, "Kết quả khi giảm chuyển động");
  await n.chupAnh(giam, "3-giam-ket-qua");
  inThongKe("Giảm chuyển động, CPU chậm 4×", khungGiam);

  /* 3. Trang duyệt phong cách ---------------------------------------- */
  // Học viên không vào được.
  await thuong.goto(`${n.web}/game-style-demo`);
  if (await thuong.getByRole("heading", { name: "Duyệt phong cách trò chơi" }).count())
    throw new Error("Học viên vào được trang duyệt phong cách.");

  const bt = await n.taoTaiKhoan({ role: "bien_tap", ten: "Biên tập duyệt phong cách E2E" });
  const demo = await n.moTrang();
  demo.on("pageerror", (e) => loiTrang.push(`${e.message.slice(0, 40)} @ ${new URL(demo.url()).pathname}`));
  await n.dangNhap(demo, bt);
  await demo.goto(`${n.web}/game-style-demo`);
  await demo.getByRole("heading", { name: "Duyệt phong cách trò chơi" }).waitFor();
  await n.kiemKhongCuonNgang(demo, "Trang duyệt phong cách");
  await n.chupAnh(demo, "4-game-style-demo");
  const nut = demo.getByRole("button", { name: "Chạy lại" });
  const soNut = await nut.count();
  if (soNut < 12) throw new Error(`Trang duyệt cần 12 nút "Chạy lại", có ${soNut}.`);
  for (let i = 0; i < soNut; i++) {
    await nut.nth(i).click();
    // Lớp chúc mừng (lên cấp, huy hiệu) phủ lên trang: đóng trước khi bấm tiếp.
    const dong = demo.getByRole("button", { name: /^(Đóng|Tiếp tục)$/ });
    if (await dong.count()) await dong.first().click();
  }
  await n.kiemKhongCuonNgang(demo, "Sau khi chạy mọi hiệu ứng");
  await demo.getByRole("switch", { name: /Giảm hiệu ứng/ }).click();
  await demo.locator('[data-khu="tro-choi"][data-giam-hieu-ung="1"]').waitFor();
  const tDemo = (await tenHoatAnh(demo)).t.filter((x) => x !== "none");
  if (tDemo.length) throw new Error(`Bật "Giảm hiệu ứng" nhưng .g-t còn: ${tDemo.join(", ")}`);
  await n.chupAnh(demo, "5-game-style-demo-giam");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
