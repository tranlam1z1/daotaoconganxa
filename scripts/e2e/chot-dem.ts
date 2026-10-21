/**
 * Kịch bản E2E trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15), khung điện thoại 360×740.
 *
 * Dữ liệu: bộ tiêu chí TCC-DEMO-THANG và hai đoạn đường mẫu CD-01 (màn 1), CD-03 (màn 2) ở
 * data/tro-choi/*.json, bản sao có tiền tố, đặt `da_duyet` ngay trong kịch bản. Đoạn đã duyệt khác trong
 * CSDL (nếu có) vẫn có thể được chọn, nên kịch bản đọc đoạn đường thật của lượt từ CSDL rồi mới đặt vật.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường: hướng dẫn hiện ở lượt đầu; KÉO một biển vào đường, đặt các vật còn lại bằng
 *    chạm-chạm, chỉnh từng mét bằng nút; chạy thử với CPU chậm 4× (≥ 50 khung/giây); kết quả chạy thử
 *    hiện; nộp. Máy chủ chấm đủ điểm (đoạn của kịch bản), băm trạng thái cuối của máy chủ khớp điện thoại,
 *    đúng một dòng XP, không cuộn ngang. Sau khi chấm, bảng chơi còn điểm từng tiêu chí và ảnh bố trí;
 *    đo được, ngưỡng, căn cứ và kết quả chạy chỉ có trong "Xem chi tiết" của hộp kết quả, đủ số tiêu
 *    chí và số dòng căn cứ (GĐ17c); đóng hộp vẫn thấy điểm từng tiêu chí; màn "Xem lại từng câu" có đủ.
 * 2. Màn 2, giảm chuyển động: đặt vật bằng BÀN PHÍM (Enter chọn vật, Enter chọn ô, phím mũi tên chỉnh
 *    mét); chạy thử hiện ảnh tĩnh theo mốc 10 giây, có nút tới, lùi; khung vẽ không tự chạy; nộp.
 */

import { join } from "node:path";
import {
  type BoTriChot,
  type BuocChotDem,
  type ChiTietChotDem,
  type CotChot,
  type PayloadDoanChot,
  type PayloadTieuChiChot,
  TRO_CHOI_CHOT_DEM,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, demCanCu, dongHopXemBang, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}cd-`;
const KHOI = ["Sáu tiêu chí", "Kết quả chạy thử"];

/** Phần "Xem chi tiết" (GĐ17c): đủ số tiêu chí và số dòng căn cứ như `chi_tiet` máy chủ trả. */
async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietChotDem>(n, TRO_CHOI_CHOT_DEM, tkId, 1);
  const so = await vung.locator('section[aria-label="Sáu tiêu chí"] > ol > li').count();
  if (so !== ct.tieu_chi.length)
    throw new Error(`${noi}: chi tiết có ${so} tiêu chí, cần ${ct.tieu_chi.length}.`);
  const canCu = await demCanCu(vung);
  if (canCu !== ct.tieu_chi.length)
    throw new Error(`${noi}: chi tiết có ${canCu} dòng căn cứ, cần ${ct.tieu_chi.length}.`);
}
const MA = "chot_dem";
const GOC = join(import.meta.dir, "..", "..");
const TEN_COT: Record<CotChot, string> = {
  le_trai: "lề trái",
  lan_1: "làn trái",
  lan_2: "làn phải",
  le_phai: "lề phải",
};
const TEN_VAT: Record<string, string> = {
  bien: "Biển báo tạm",
  coc: "Cọc tiêu",
  den: "Đèn cảnh báo",
  xe: "Xe tuần tra",
  cs: "Chiến sĩ",
};
const tenVat = (id: string) => `${TEN_VAT[id.split("-")[0]!]} ${id.split("-")[1]}`;

const MA_DO = `
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
): Promise<{ id: string; b: BuocChotDem; ref: string }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, b: l.items[0].noi_dung, ref: l.items[0].ref_id };
}

/** Bố trí tốt cho đoạn thẳng: 2 biển xa chốt, hàng cọc 5 m tới sát chốt, đèn đầu hàng cọc, chiến sĩ sau chốt. */
function boTriTot(d: PayloadDoanChot): BoTriChot {
  const le: CotChot = d.lan_dong === "lan_2" ? "le_phai" : "le_trai";
  const bt: BoTriChot = {};
  const c = d.chot_m;
  for (let i = 0; i < d.tui.bien; i++) bt[`bien-${i + 1}`] = { m: c - 100 + 50 * i, cot: le, huong: 0 };
  for (let i = 0; i < d.tui.coc; i++)
    bt[`coc-${i + 1}`] = { m: c - 5 * (d.tui.coc - i), cot: d.lan_dong, huong: 0 };
  for (let i = 0; i < d.tui.den; i++)
    bt[`den-${i + 1}`] = { m: c - 5 * d.tui.coc - 2 - 20 * i, cot: le, huong: 0 };
  for (let i = 0; i < d.tui.cs; i++) bt[`cs-${i + 1}`] = { m: c + 2 + 4 * i, cot: d.lan_dong, huong: 0 };
  return bt;
}

const nutVat = (page: Page, id: string) =>
  page.getByRole("list", { name: "Túi đồ" }).getByRole("button", { name: new RegExp(`^${tenVat(id)}:`) });
const oDuong = (page: Page, m: number, cot: CotChot) => {
  const b = Math.min(Math.floor(m / 10), 99);
  return page.getByRole("button", { name: `${TEN_COT[cot]}, mét ${b * 10} đến ${b * 10 + 9}`, exact: true });
};

/** Chênh lệch từ chỗ thả (giữa ô 10 m) tới mét cần đặt. */
const lechTuO = (m: number) => m - (Math.floor(m / 10) * 10 + 5);

async function chinhMet(page: Page, lech: number, banPhim: boolean) {
  for (let i = 0; i < Math.abs(lech); i++) {
    if (banPhim) await page.keyboard.press(lech > 0 ? "ArrowUp" : "ArrowDown");
    else await page.getByRole("button", { name: lech > 0 ? "+1 m" : "−1 m", exact: true }).click();
  }
}

/** Cuộn phần tử vào giữa màn hình (không bị thanh trên và bảng dính ở đáy che). */
const raGiua = (l: ReturnType<Page["locator"]>) =>
  l.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));

async function datCaBoTri(page: Page, bt: BoTriChot, cach: "cham" | "phim", keoDau = false) {
  let dau = keoDau;
  const xong = page.getByRole("button", { name: "Xong", exact: true });
  for (const [id, p] of Object.entries(bt)) {
    const o = oDuong(page, p.m, p.cot);
    if (dau) {
      // Kéo thật bằng chuột: nhấn giữ vật trong túi đồ, kéo qua nhiều bước, thả vào ô đang hiện trên màn.
      dau = false;
      await raGiua(o);
      const nut = nutVat(page, id);
      await nut.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      const a = (await nut.boundingBox())!;
      const b = (await o.boundingBox())!;
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.getByRole("region", { name: `Chỉnh ${tenVat(id)}` }).waitFor();
    } else if (cach === "cham") {
      await nutVat(page, id).click();
      await raGiua(o);
      await o.click();
    } else {
      await nutVat(page, id).focus();
      await page.keyboard.press("Enter");
      await raGiua(o);
      await o.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "+1 m", exact: true }).focus();
    }
    await chinhMet(page, lechTuO(p.m), cach === "phim");
    await page
      .getByRole("region", { name: `Chỉnh ${tenVat(id)}` })
      .getByText(new RegExp(`mét ${p.m}, ${TEN_COT[p.cot]}`))
      .waitFor();
    if (cach === "phim") {
      await xong.focus();
      await page.keyboard.press("Enter");
    } else await xong.click();
  }
}

export default async function chotDem(n: NguCanhE2E) {
  /* 0. Dữ liệu có tiền tố, đã duyệt ------------------------------------ */
  const tc = (
    (await Bun.file(join(GOC, "data", "tro-choi", "tieu-chi-chot.json")).json()) as {
      tieu_chi: Array<{ ma: string; tieu_de: string; payload: PayloadTieuChiChot }>;
    }
  ).tieu_chi.find((t) => t.ma === "TCC-DEMO-THANG")!;
  const doan = (
    (await Bun.file(join(GOC, "data", "tro-choi", "chot-dem.json")).json()) as {
      doan: Array<{ ma: string; tieu_de: string; payload: PayloadDoanChot }>;
    }
  ).doan.filter((d) => d.ma === "CD-01" || d.ma === "CD-03");
  const maTc = `${PREFIX}${tc.ma}`;
  n.donDep(async () => {
    const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => String(r.id)).concat("-"))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  });
  const cuaKichBan = new Set<string>();
  for (const [tieuDe, payload] of [
    [tc.tieu_de, { ...tc.payload, ma: maTc }],
    ...doan.map((d) => [d.tieu_de, { ...d.payload, ma_tieu_chi: maTc }] as const),
  ] as const) {
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}${tieuDe}`,
        payload: payload as never,
        answer: {},
        explanation: null,
        citations: [],
        refs: [],
        offline_ok: true,
        status: "cho_duyet",
      },
      "e2e",
    );
    cuaKichBan.add(nd.id);
    await chuyenTrangThaiNoiDung({
      id: nd.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "e2e",
    });
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
  const loiTrang: string[] = [];

  /* 1. Màn 1, chế độ thường ------------------------------------------ */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ chốt đêm E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Dựng chốt an toàn ban đêm", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Dựng chốt an toàn ban đêm" });
  await the.getByRole("button", { name: /Màn 1: Đường thẳng/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Dựng chốt an toàn ban đêm" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();

  await page.getByText("Đoạn đường 1/1").waitFor();
  const l1 = await buocCuaLuot(n, tk.id);
  await n.kiemKhongCuonNgang(page, "Chốt đêm, màn 1");
  await datCaBoTri(page, boTriTot(l1.b.doan), "cham", true);
  await n.chupAnh(page, "1-dat-vat");

  // Chạy thử với CPU chậm 4×, đo khung hình.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  await page.getByRole("button", { name: "Chạy thử (còn 2)" }).click();
  await page.waitForTimeout(2000);
  await n.chupAnh(page, "2-chay-thu");
  await page.getByRole("region", { name: "Kết quả chạy thử" }).waitFor({ timeout: 60_000 });
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
    `  Chạy thử, CPU chậm 4×: ${khung.length} khung trong ${(tong / 1000).toFixed(1)} giây, trung bình ${fps.toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]!.toFixed(1)} ms`,
  );
  if (fps < 50) throw new Error(`Chạy thử chỉ đạt ${fps.toFixed(1)} khung/giây, cần ≥ 50.`);
  await n.kiemKhongCuonNgang(page, "Sau chạy thử");
  await n.chupAnh(page, "3-ket-qua-chay-thu");
  await page.getByRole("button", { name: "Nộp bố trí" }).click();

  const kq = page.locator("[data-bam-may]");
  await kq.waitFor({ timeout: 15_000 });
  const [bamMay, bamChu] = [await kq.getAttribute("data-bam-may"), await kq.getAttribute("data-bam")];
  if (!bamMay || bamMay !== bamChu)
    throw new Error(`Băm trạng thái lệch: điện thoại ${bamMay}, máy chủ ${bamChu}.`);
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "4-ket-qua");
  const [s1] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l1.id} AND ordinal = 1`) as any[];
  if (cuaKichBan.has(l1.ref) && s1?.points !== s1?.toi_da)
    throw new Error(`Màn 1 được ${s1?.points}/${s1?.toi_da} điểm, cần đủ điểm.`);
  await kiemChiTiet(n, await moChiTietRieng(page, KHOI, "Màn 1"), tk.id, "Màn 1");
  await n.chupAnh(page, "4b-chi-tiet");
  await dongHopXemBang(page, page.getByRole("list", { name: "Điểm từng tiêu chí" }), "Màn 1");
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await kiemChiTiet(n, await moXemLai(page, 1, KHOI), tk.id, "Màn 1, xem lại");
  await n.chupAnh(page, "5-tong-ket");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 2. Màn 2, giảm chuyển động, bàn phím ------------------------------ */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Đoạn đường 1/1").waitFor();
  const l2 = await buocCuaLuot(n, tk.id);
  await datCaBoTri(page, boTriTot(l2.b.doan), "phim");
  await n.kiemKhongCuonNgang(page, "Chốt đêm, màn 2");
  await page.getByRole("button", { name: "Chạy thử (còn 2)" }).click();
  await page.getByRole("region", { name: "Kết quả chạy thử" }).waitFor();
  await page.getByText("Giây 60").waitFor();
  const lui = page.getByRole("button", { name: "Lùi 10 giây" });
  await lui.click();
  await lui.click();
  await page.getByText("Giây 40").waitFor();
  await n.chupAnh(page, "6-anh-tinh");
  // Giảm chuyển động: khung vẽ không tự chạy, ảnh canvas đứng yên khi không bấm.
  const anh = () =>
    page
      .locator("canvas")
      .first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length + c.toDataURL().slice(-64));
  const truoc = await anh();
  await page.waitForTimeout(600);
  if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng cảnh vẫn tự chạy.");
  await page.getByRole("button", { name: "Tới 10 giây" }).click();
  await page.getByText("Giây 50").waitFor();
  await page.getByRole("button", { name: "Nộp bố trí" }).click();
  await page.locator("[data-bam-may]").waitFor({ timeout: 15_000 });
  await n.chupAnh(page, "7-ket-qua-man-2");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l2.id} AND ordinal = 1`) as any[];
  if (cuaKichBan.has(l2.ref) && s2?.points !== s2?.toi_da)
    throw new Error(`Màn 2 được ${s2?.points}/${s2?.toi_da} điểm, cần đủ điểm.`);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
