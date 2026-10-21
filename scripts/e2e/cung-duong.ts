/**
 * Kịch bản E2E trò "Cung đường biển báo" (docs/PLAN.md GĐ-G8), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của các biển có phản ứng trong data/bien-bao/bien-bao.json (dữ liệu demo,
 * chưa duyệt), được đặt `da_duyet` ngay trong kịch bản; ảnh đưa lên kho đối tượng như script nạp.
 * Dữ liệu thật trong CSDL không bị đụng tới.
 *
 * Kiểm:
 * 1. Đường dẫn cũ /tro-choi/doan-bien-bao chuyển về trò mới; vào chơi một chạm từ trang Trò chơi.
 * 2. Chơi trọn một lượt bằng nút, CPU chậm 4×: 3 câu khởi động đúng, đường chạy 12 biển, cố ý sai
 *    biển thứ 2 (mất một mạng). Máy chủ chấm lại: đường chạy 110/120, đúng một dòng XP. Khung hình
 *    trung bình ≥ 50/giây trong lúc chạy. Không cuộn ngang. Sau khi chấm đường chạy, vùng chơi hiện
 *    "Xử lý đúng 11/12 biển" và dải biển có dấu; bảng từng biển chỉ có trong "Xem chi tiết" của hộp kết
 *    quả, đủ 12 biển như máy chủ trả (GĐ17c, Đ12); màn "Xem lại từng câu" cũng có đủ.
 * 3. Giảm chuyển động (prefers-reduced-motion): chế độ từng bước, biển hiện tĩnh có đếm giây, vạch kẻ
 *    đứng yên, mọi `.g-t` tắt; âm thanh tắt thì không tạo AudioContext. Sai 3 biển đầu thì hết mạng,
 *    các biển sau không tính.
 */

import { join } from "node:path";
import {
  type BienBao,
  type BuocCungDuong,
  type ChiTietDuong,
  TEN_THAO_TAC_BIEN_BAO,
  type ThaoTacBienBao,
  TRO_CHOI_CUNG_DUONG,
} from "@qdpl/dao-tao";
import { putFromFile } from "@qdpl/storage";
import type { Locator, Page } from "playwright-core";
import { docBienBao, uriAnhBienBao } from "../bien-bao.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, dongHopXemBang, hopKetQua, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const TUNG_BIEN = "Từng biển trên đường";

/** Bảng từng biển trong "Xem chi tiết" (GĐ17c, Đ12): đủ số biển như `chi_tiet` máy chủ trả. */
async function kiemTungBien(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietDuong>(n, TRO_CHOI_CUNG_DUONG, tkId, 4);
  const so = await vung.locator(`section[aria-label="${TUNG_BIEN}"] > ol > li`).count();
  if (so !== ct.bien.length) throw new Error(`${noi}: chi tiết có ${so} biển, cần ${ct.bien.length}.`);
  if ((await vung.getByText(/^Cần:/).count()) !== ct.bien.length)
    throw new Error(`${noi}: thiếu dòng "Cần: …".`);
}

const PREFIX = `${TIEN_TO}cd-`;
type Duong = Extract<BuocCungDuong, { loai: "duong" }>;

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

async function buocCuaLuot(
  n: NguCanhE2E,
  accId: string,
): Promise<{ id: string; items: Array<{ noi_dung: BuocCungDuong }> }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, items: l.items };
}

/** Trả lời đúng 3 câu khởi động, sang đường chạy. */
async function khoiDong(n: NguCanhE2E, page: Page, items: Array<{ noi_dung: BuocCungDuong }>, anh: boolean) {
  for (let i = 1; i <= 3; i++) {
    await page.getByText(`Câu ${i}/4`).waitFor();
    const c = items[i - 1]!.noi_dung as Extract<BuocCungDuong, { loai: "doan" }>;
    await page.getByRole("button", { name: c.ten, exact: true }).click();
    await page.getByRole("button", { name: "Chốt đáp án" }).click();
    await hopKetQua(page).waitFor();
    if (anh && i === 1) {
      await n.kiemKhongCuonNgang(page, "Câu khởi động");
      await n.chupAnh(page, "1-khoi-dong");
    }
    await page.getByRole("link", { name: "Câu tiếp" }).click();
  }
  await page.getByText("Câu 4/4").waitFor();
}

/** Bấm "Xuất phát", chờ xe chạy; trả mốc 0 của đồng hồ đường chạy (theo đồng hồ máy chạy test). */
async function xuatPhat(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Xuất phát" }).click();
  await page.getByText("Xe đang chạy", { exact: false }).waitFor({ timeout: 8000 });
  return Date.now();
}

async function bamLuc(page: Page, t0: number, ms: number, tt: ThaoTacBienBao) {
  const cho = t0 + ms - Date.now();
  if (cho > 0) await page.waitForTimeout(cho);
  await page.getByRole("button", { name: TEN_THAO_TAC_BIEN_BAO[tt], exact: true }).click();
}

const sai = (tt: ThaoTacBienBao): ThaoTacBienBao => (tt === "khong_vao" ? "giam_toc" : "khong_vao");

export default async function cungDuong(n: NguCanhE2E) {
  // 1. Dữ liệu có tiền tố, đã duyệt.
  const ds = (await docBienBao()).filter((b): b is BienBao & { phan_ung: ThaoTacBienBao } =>
    Boolean(b.phan_ung),
  );
  if (ds.length < 20) throw new Error(`Tệp biển báo cần ít nhất 20 biển có phản ứng, có ${ds.length}.`);
  n.donDep(() => n.sql`DELETE FROM traffic_signs WHERE code LIKE ${`${PREFIX}%`}`);
  for (const b of ds) {
    await putFromFile(
      uriAnhBienBao(b.anh),
      join(import.meta.dir, "..", "..", "data", "bien-bao", "anh", b.anh),
    );
    await n.sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction, reaction_note)
      VALUES (${`${PREFIX}${b.ma}`}, ${b.nhom}, ${b.ten}, ${b.y_nghia}, ${uriAnhBienBao(b.anh)}, ${b.can_cu},
              'da_duyet', ${b.phan_ung}, ${b.ghi_chu_phan_ung ?? null})`;
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = 'cung_duong_bien_bao'`) as any[];
  n.donDep(
    () => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = 'cung_duong_bien_bao'`,
  );
  await n.sql`UPDATE games SET enabled = true WHERE code = 'cung_duong_bien_bao'`;
  const loiTrang: string[] = [];

  /* 2. Chơi trọn một lượt, CPU chậm 4× ------------------------------- */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ cung đường E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi/doan-bien-bao`);
  await page.waitForURL(/\/tro-choi\/cung-duong-bien-bao$/);
  await page.getByRole("heading", { name: "Cung đường biển báo" }).waitFor();
  await n.chupAnh(page, "0-gioi-thieu");

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Cung đường biển báo", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Cung đường biển báo" })
    .getByRole("button", { name: "Chơi" })
    .click();
  await page.getByText("Câu 1/4").waitFor();
  const { id, items } = await buocCuaLuot(n, tk.id);
  await khoiDong(n, page, items, true);

  const duong = items[3]!.noi_dung as Duong;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = await xuatPhat(page);
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  for (const b of duong.bien) {
    const tt = b.thu_tu === 2 ? sai(b.phan_ung) : b.phan_ung;
    await bamLuc(page, t0, b.hien_ms + 900, tt);
    if (b.thu_tu === 3) {
      await n.kiemKhongCuonNgang(page, "Đường chạy");
      await n.chupAnh(page, "2-duong-chay");
    }
  }
  await page.getByText("Về đích", { exact: true }).waitFor({ timeout: 15_000 });
  const khung = await page.evaluate(() => {
    const d = (window as any).__khung as number[];
    (window as any).__khung = null;
    return d;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const tong = khung.reduce((s, x) => s + x, 0);
  const fps = (khung.length / tong) * 1000;
  const sx = [...khung].sort((a, b) => a - b);
  console.log(
    `  Đường chạy, CPU chậm 4×: ${khung.length} khung trong ${(tong / 1000).toFixed(1)} giây, trung bình ${fps.toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]!.toFixed(1)} ms`,
  );
  if (fps < 50) throw new Error(`Đường chạy chỉ đạt ${fps.toFixed(1)} khung/giây, cần ≥ 50.`);
  await n.chupAnh(page, "3-ve-dich");

  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  // Lời giải thích của máy chủ và bảng từng biển nằm sau "Xem chi tiết" trong hộp kết quả (GĐ17a, GĐ17c).
  const vung = await moChiTietRieng(page, [TUNG_BIEN], "Đường chạy");
  await hopKetQua(page).getByText("Phản ứng đúng 11/12 biển, còn 2/3 mạng.").waitFor();
  await kiemTungBien(n, vung, tk.id, "Đường chạy");
  await n.kiemKhongCuonNgang(page, "Kết quả đường chạy");
  await n.chupAnh(page, "4-ket-qua-duong");
  await dongHopXemBang(page, page.getByRole("list", { name: "Các biển trên đường" }), "Đường chạy");
  await page.getByText("Xử lý đúng 11/12 biển").waitFor();
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await kiemTungBien(n, await moXemLai(page, 4, [TUNG_BIEN]), tk.id, "Đường chạy, xem lại");
  await n.kiemKhongCuonNgang(page, "Tổng kết");
  await n.chupAnh(page, "5-tong-ket");

  const [s4] = (await n.sql`
    SELECT points::float8 AS points, bonus::float8 AS bonus FROM game_run_steps WHERE run_id = ${id} AND ordinal = 4`) as any[];
  if (s4?.points !== 110) throw new Error(`Đường chạy được ${s4?.points} điểm, cần 110.`);
  if (!(s4.bonus > 0)) throw new Error("Đường chạy online phải có thưởng nhanh.");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = 'game:cung_duong_bien_bao'`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 3. Giảm chuyển động, âm thanh tắt -------------------------------- */
  const tk2 = await n.taoTaiKhoan({ ten: "Cán bộ từng bước E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk2.id}`);
  const giam = await n.moTrang();
  giam.on("pageerror", (e) => loiTrang.push(e.message));
  await giam.addInitScript(MA_DO);
  await giam.emulateMedia({ reducedMotion: "reduce" });
  await n.dangNhap(giam, tk2);
  await giam.goto(`${n.web}/tro-choi/cung-duong-bien-bao`);
  await giam.getByRole("button", { name: "Chơi", exact: true }).click();
  await giam.getByText("Câu 1/4").waitFor();
  const l2 = await buocCuaLuot(n, tk2.id);
  await khoiDong(n, giam, l2.items, false);
  const d2 = l2.items[3]!.noi_dung as Duong;
  const t2 = await xuatPhat(giam);

  const vach = () =>
    giam.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[style*='repeating-linear-gradient']")][0];
      return el ? getComputedStyle(el).transform : "khong-co";
    });
  const vachTruoc = await vach();
  await giam.waitForTimeout(Math.max(0, t2 + d2.bien[0]!.hien_ms + 400 - Date.now()));
  await giam.getByRole("img", { name: "Biển thứ 1" }).waitFor();
  await giam.getByText(/^\d giây$/).waitFor();
  if ((await vach()) !== vachTruoc) throw new Error("Giảm chuyển động nhưng vạch kẻ đường vẫn chạy.");
  const hoatAnh = await giam.evaluate(() => ({
    a: [...document.querySelectorAll(".g-a")].map((e) => getComputedStyle(e).animationName),
    t: [...document.querySelectorAll(".g-t")].map((e) => getComputedStyle(e).animationName),
  }));
  if (hoatAnh.a.some((x) => x !== "g-hien"))
    throw new Error(`Giảm chuyển động nhưng .g-a còn: ${hoatAnh.a.join(", ")}`);
  if (hoatAnh.t.some((x) => x !== "none"))
    throw new Error(`Giảm chuyển động nhưng .g-t còn: ${hoatAnh.t.join(", ")}`);
  await n.chupAnh(giam, "6-tung-buoc");

  for (const b of d2.bien.slice(0, 3)) await bamLuc(giam, t2, b.hien_ms + 900, sai(b.phan_ung));
  await giam.getByText("Hết mạng", { exact: true }).waitFor();
  await n.chupAnh(giam, "7-het-mang");
  await giam.getByRole("button", { name: "Chốt đáp án" }).click();
  await hopKetQua(giam).getByRole("button", { name: "Xem chi tiết" }).click();
  await hopKetQua(giam).getByText("Phản ứng đúng 0/12 biển, còn 0/3 mạng.").waitFor();
  if (await giam.evaluate(() => (window as any).__soAudio as number))
    throw new Error("Âm thanh đang tắt nhưng đã tạo AudioContext.");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points FROM game_run_steps WHERE run_id = ${l2.id} AND ordinal = 4`) as any[];
  if (s2?.points !== 0) throw new Error(`Hết mạng ngay 3 biển đầu nhưng được ${s2?.points} điểm.`);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
