/**
 * Kịch bản E2E trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10), khung điện thoại 360×740.
 *
 * Dữ liệu: hai vụ mẫu TD-01 (màn 1) và TD-02 (màn 2) ở data/tro-choi/tai-dung.json, bản sao có tiền tố trỏ
 * tới hai dòng mức phạt thử, đặt `da_duyet` ngay trong kịch bản. Vụ đã duyệt khác trong CSDL (nếu có) vẫn
 * có thể được chọn, nên kịch bản đọc dựng cảnh gốc của lượt từ CSDL rồi mới dựng xe.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường: hướng dẫn hiện ở lượt đầu; đặt xe bằng CHẠM lên sơ đồ, KÉO xe trên sơ đồ, chỉnh
 *    từng mét bằng nút; xoay; chọn tốc độ, hành động; mô phỏng với CPU chậm 4× (đo khung hình); bảng "So
 *    với dấu vết" hiện; KÉO thẻ lỗi vào xe; chốt kết luận. Máy chủ chấm đủ điểm (vụ của kịch bản), băm
 *    trạng thái cuối của máy chủ khớp điện thoại, đúng một dòng XP, không cuộn ngang. Chi tiết (khớp từng
 *    xe, kết luận, biên bản) chỉ có trong "Xem chi tiết" của hộp kết quả; màn "Xem lại từng câu" có đủ.
 * 2. Màn 2, giảm chuyển động: dựng xe bằng BÀN PHÍM (phím mũi tên) sau khi chạm đặt; mô phỏng hiện NGAY
 *    vị trí cuối (không hoạt cảnh, khung vẽ đứng yên); gắn thẻ bằng chạm-chạm; chốt kết luận.
 */

import { join } from "node:path";
import {
  type BuocTaiDung,
  type ChiTietTaiDung,
  type DapAnTaiDung,
  type PayloadTaiDung,
  TEN_HANH_DONG_XE,
  TEN_LOI_TAI_DUNG,
  TEN_MUC_TOC_DO,
  TRO_CHOI_TAI_DUNG,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, dongHopXemBang, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}td-`;
const MA = "tai_dung_hien_truong";
const GOC = join(import.meta.dir, "..", "..");
const KHOI = ["Khớp dấu vết", "Kết luận"];

const MA_DO = `
  window.__khung = null;
  let truoc = 0;
  const vong = (t) => {
    if (window.__khung) { if (truoc) window.__khung.push(t - truoc); truoc = t; } else truoc = 0;
    requestAnimationFrame(vong);
  };
  requestAnimationFrame(vong);
`;

const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function buocCuaLuot(
  n: NguCanhE2E,
  accId: string,
): Promise<{ id: string; b: BuocTaiDung; ref: string }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, b: l.items[0].noi_dung, ref: l.items[0].ref_id };
}

/** Điểm màn hình (px) của một điểm trên sơ đồ (mét). */
async function diemTren(page: Page, b: BuocTaiDung, x: number, y: number) {
  const c = page.locator("canvas").first();
  await c.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const h = (await c.boundingBox())!;
  return { x: h.x + (x * h.width) / b.vu.so_do.rong_m, y: h.y + (y * h.height) / b.vu.so_do.cao_m };
}

/** Vị trí đang ghi ở bảng chỉnh xe: [x, y] mét. */
async function viTriDangChon(page: Page): Promise<[number, number] | null> {
  const t = await page
    .getByRole("region", { name: "Dựng xe" })
    .getByText(/tâm xe x \d+ m, y \d+ m/)
    .textContent();
  const m = t?.match(/x (\d+) m, y (\d+) m/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Chỉnh xe đang chọn tới đúng (x, y) bằng nút hoặc phím mũi tên. */
async function chinhToi(page: Page, x: number, y: number, banPhim: boolean) {
  for (let lan = 0; lan < 60; lan++) {
    const p = await viTriDangChon(page);
    if (!p) throw new Error("Xe chưa được đặt.");
    const [dx, dy] = [x - p[0], y - p[1]];
    if (!dx && !dy) return;
    const [phim, ten] = dx
      ? dx > 0
        ? ["ArrowRight", "Sang phải 1 mét"]
        : ["ArrowLeft", "Sang trái 1 mét"]
      : dy > 0
        ? ["ArrowDown", "Xuống 1 mét"]
        : ["ArrowUp", "Lên 1 mét"];
    if (banPhim) {
      await page.getByRole("button", { name: "Xoay phải 45 độ" }).focus();
      await page.keyboard.press(phim);
    } else await page.getByRole("button", { name: ten }).click();
    await page.waitForTimeout(30);
  }
  throw new Error(`Không chỉnh được xe tới (${x}, ${y}).`);
}

/** Dựng một xe theo dựng cảnh gốc: chọn xe, chạm (hoặc kéo) lên sơ đồ, chỉnh mét, xoay, tốc độ, hành động. */
async function dungXe(
  page: Page,
  b: BuocTaiDung,
  d: DapAnTaiDung["dung_canh"][number],
  cach: { keo: boolean; banPhim: boolean },
) {
  const nhan = b.vu.xe.find((x) => x.id === d.xe)!.nhan;
  await page
    .getByRole("list", { name: "Các xe" })
    .getByRole("button", { name: new RegExp(`^${thoat(nhan)}`) })
    .click();
  // Chạm chỗ lệch 3 m về phía nam, rồi (nếu `keo`) kéo xe lên đúng chỗ.
  const cham = await diemTren(page, b, d.x, Math.min(b.vu.so_do.cao_m, d.y + 3));
  await page.mouse.click(cham.x, cham.y);
  await page
    .getByRole("region", { name: "Dựng xe" })
    .getByText(/tâm xe x \d+ m/)
    .waitFor();
  if (cach.keo) {
    const p = (await viTriDangChon(page))!;
    const tu = await diemTren(page, b, p[0], p[1]);
    const den = await diemTren(page, b, d.x, d.y);
    await page.mouse.move(tu.x, tu.y);
    await page.mouse.down();
    await page.mouse.move(den.x, den.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(50);
    const sau = (await viTriDangChon(page))!;
    if (sau[1] >= p[1]) throw new Error(`Kéo xe không đổi chỗ: trước ${p}, sau ${sau}.`);
  }
  await chinhToi(page, d.x, d.y, cach.banPhim);
  for (let i = 0; i < d.huong; i++) await page.getByRole("button", { name: "Xoay phải 45 độ" }).click();
  const vung = page.getByRole("region", { name: "Dựng xe" });
  await vung.getByRole("button", { name: new RegExp(`^${TEN_MUC_TOC_DO[d.muc]}`) }).click();
  await vung.getByRole("button", { name: TEN_HANH_DONG_XE[d.hanh_dong], exact: true }).click();
}

/** Gắn thẻ lỗi vào xe: kéo bằng chuột, hoặc chạm thẻ rồi chạm xe. */
async function ganThe(page: Page, b: BuocTaiDung, keo: boolean) {
  await page.getByRole("tab", { name: /^Kết luận/ }).click();
  for (const l of b.dap_an.loi) {
    const the = page
      .getByRole("list", { name: "Thẻ lỗi" })
      .getByRole("button", { name: TEN_LOI_TAI_DUNG[l.loi] });
    const xe = page
      .getByRole("list", { name: "Xe" })
      .getByRole("button", { name: b.vu.xe.find((x) => x.id === l.xe)!.nhan, exact: true });
    if (keo) {
      await the.scrollIntoViewIfNeeded();
      const a = (await the.boundingBox())!;
      await xe.scrollIntoViewIfNeeded();
      const c = (await xe.boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 });
      await page.mouse.up();
    } else {
      await the.click();
      await xe.click();
    }
    await page
      .getByRole("button", { name: new RegExp(`^Gỡ thẻ ${thoat(TEN_LOI_TAI_DUNG[l.loi])}`) })
      .waitFor();
  }
}

async function kiemDiem(n: NguCanhE2E, idLuot: string, cua: boolean, noi: string) {
  const [s] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${idLuot} AND ordinal = 1`) as any[];
  if (cua && s?.points !== s?.toi_da)
    throw new Error(`${noi}: được ${s?.points}/${s?.toi_da} điểm, cần đủ điểm.`);
}

async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietTaiDung>(n, TRO_CHOI_TAI_DUNG, tkId, 1);
  const so = await vung.locator('section[aria-label="Khớp dấu vết"] li').count();
  if (so !== ct.khop.theo_xe.length)
    throw new Error(`${noi}: chi tiết có ${so} dòng khớp xe, cần ${ct.khop.theo_xe.length}.`);
  if (!(await vung.getByRole("region", { name: "Biên bản (mô phỏng)" }).count()))
    throw new Error(`${noi}: chi tiết thiếu biên bản.`);
}

export default async function taiDung(n: NguCanhE2E) {
  /* 0. Dữ liệu có tiền tố, đã duyệt ------------------------------------ */
  const vu = (
    (await Bun.file(join(GOC, "data", "tro-choi", "tai-dung.json")).json()) as {
      vu: Array<{ ma: string; tieu_de: string; payload: PayloadTaiDung; answer: DapAnTaiDung }>;
    }
  ).vu.filter((v) => v.ma === "TD-01" || v.ma === "TD-02");
  n.donDep(async () => {
    const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => String(r.id)).concat("-"))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
    await n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  });
  const cuaKichBan = new Set<string>();
  for (const v of vu) {
    const maPhat = `${PREFIX}${v.ma.toLowerCase()}`;
    await n.sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${maPhat}, 'o_to', 'Dòng mức phạt thử E2E', 1, 2, 'vn:vbqppl:nd:100/2026/NĐ-CP#dieu-1', '2025-01-01', 'da_duyet')
      ON CONFLICT DO NOTHING`;
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}${v.tieu_de}`,
        payload: v.payload as never,
        answer: { ...v.answer, loi: v.answer.loi.map((l) => ({ ...l, ma_muc_phat: maPhat })) } as never,
        explanation: null,
        citations: [],
        refs: [{ loai: "violation", ma: maPhat }],
        offline_ok: true,
        status: "cho_duyet",
      },
      "e2e",
    );
    cuaKichBan.add(nd.id);
    const kq = await chuyenTrangThaiNoiDung({
      id: nd.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "e2e",
    });
    if (!kq?.ok) throw new Error(`Không duyệt được vụ ${v.ma}.`);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
  const loiTrang: string[] = [];

  /* 1. Màn 1, chế độ thường ------------------------------------------ */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ tái dựng E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Tái dựng hiện trường", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Tái dựng hiện trường" })
    .getByRole("button", { name: /Màn 1: Một xe/ })
    .click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Tái dựng hiện trường" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();

  await page.getByText("Vụ 1/1").waitFor();
  await page.getByText("không phải phương pháp giám định").first().waitFor();
  const l1 = await buocCuaLuot(n, tk.id);
  await n.kiemKhongCuonNgang(page, "Tái dựng, màn 1");
  for (const [i, d] of l1.b.dap_an.dung_canh.entries())
    await dungXe(page, l1.b, d, { keo: i === 0, banPhim: false });
  await n.chupAnh(page, "1-dung-xe");

  // Mô phỏng với CPU chậm 4×, đo khung hình.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  await page.getByRole("button", { name: "Mô phỏng (còn 20)" }).click();
  await page.waitForTimeout(800);
  await n.chupAnh(page, "2-mo-phong");
  await page.getByRole("region", { name: "So với dấu vết" }).waitFor({ timeout: 60_000 });
  const khung = await page.evaluate(() => {
    const d = (window as any).__khung as number[];
    (window as any).__khung = null;
    return d;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const tong = khung.reduce((s, x) => s + x, 0);
  const sx = [...khung].sort((a, b) => a - b);
  console.log(
    `  Mô phỏng, CPU chậm 4×: ${khung.length} khung trong ${(tong / 1000).toFixed(1)} giây, trung bình ${((khung.length / tong) * 1000).toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]?.toFixed(1)} ms`,
  );
  await page
    .getByText(/vị trí cuối lệch 0 m/)
    .first()
    .waitFor();
  await n.kiemKhongCuonNgang(page, "Sau mô phỏng");
  await n.chupAnh(page, "3-so-sanh");

  await ganThe(page, l1.b, true);
  await n.chupAnh(page, "4-ket-luan");
  await page.getByRole("button", { name: "Chốt kết luận" }).click();

  const kq = page.locator("[data-bam-may]");
  await kq.waitFor({ timeout: 15_000 });
  const [bamMay, bamChu] = [await kq.getAttribute("data-bam-may"), await kq.getAttribute("data-bam")];
  if (!bamMay || bamMay !== bamChu)
    throw new Error(`Băm trạng thái lệch: điện thoại ${bamMay}, máy chủ ${bamChu}.`);
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "5-ket-qua");
  await kiemDiem(n, l1.id, cuaKichBan.has(l1.ref), "Màn 1");
  await kiemChiTiet(n, await moChiTietRieng(page, KHOI, "Màn 1"), tk.id, "Màn 1");
  await n.chupAnh(page, "5b-chi-tiet");
  await dongHopXemBang(page, page.getByRole("list", { name: "Điểm từng phần" }), "Màn 1");
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await kiemChiTiet(n, await moXemLai(page, 1, KHOI), tk.id, "Màn 1, xem lại");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 2. Màn 2, giảm chuyển động, bàn phím ------------------------------ */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Vụ 1/1").waitFor();
  const l2 = await buocCuaLuot(n, tk.id);
  for (const d of l2.b.dap_an.dung_canh) await dungXe(page, l2.b, d, { keo: false, banPhim: true });
  await n.kiemKhongCuonNgang(page, "Tái dựng, màn 2");
  const anh = () =>
    page
      .locator("canvas")
      .first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length + c.toDataURL().slice(-64));
  await page.getByRole("button", { name: "Mô phỏng (còn 20)" }).click();
  // Giảm chuyển động: kết quả hiện ngay, không có nút bỏ qua hoạt cảnh, khung vẽ đứng yên.
  await page.getByRole("region", { name: "So với dấu vết" }).waitFor({ timeout: 2_000 });
  if (await page.getByRole("button", { name: "Bỏ qua hoạt cảnh" }).count())
    throw new Error("Giảm chuyển động nhưng vẫn có hoạt cảnh mô phỏng.");
  const truoc = await anh();
  await page.waitForTimeout(600);
  if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng khung vẽ vẫn tự chạy.");
  await n.chupAnh(page, "6-giam-chuyen-dong");
  await ganThe(page, l2.b, false);
  await page.getByRole("button", { name: "Chốt kết luận" }).click();
  await page.locator("[data-bam-may]").waitFor({ timeout: 15_000 });
  await n.chupAnh(page, "7-ket-qua-man-2");
  await kiemDiem(n, l2.id, cuaKichBan.has(l2.ref), "Màn 2");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
