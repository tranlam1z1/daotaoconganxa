/**
 * Kịch bản E2E trò "Soi camera" (docs/PLAN.md GĐ-T5), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của đoạn SC-01 (màn 1) và SC-03 (màn 2) trong data/tro-choi/soi-camera.json,
 * kèm dòng mức phạt thử có tiền tố, đặt `da_duyet` ngay trong kịch bản. Kịch bản khác đã duyệt trong
 * CSDL (nếu có) vẫn có thể được chọn, nên kịch bản đọc bước thật của lượt từ CSDL.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường, CPU chậm 4× (≥ 50 khung/giây): hướng dẫn hiện; xem, "Dừng hình" trong
 *    cửa sổ vi phạm; KÉO khung quanh xe bằng chuột; kéo thẻ lỗi vào khung; "Tiếp tục"; hết phim thì
 *    nộp. Máy chủ chấm đủ điểm, đúng một dòng XP; màn kết quả có "Tua lại xem chậm" chạy được.
 *    Mô tả, căn cứ từng vi phạm và biên bản chỉ có trong "Xem chi tiết" của hộp kết quả, đủ số vi
 *    phạm và số dòng căn cứ (GĐ17c, Đ12); màn "Xem lại từng câu" cũng có đủ.
 * 2. Màn 2, giảm chuyển động: phim chạy từng đoạn 2 giây ("Chạy 2 giây"), khung vẽ không tự chạy;
 *    khoanh xe và gắn thẻ bằng BÀN PHÍM; tua lại một lần; nộp, đủ điểm.
 */
import { join } from "node:path";
import {
  type BuocSoiCamera,
  type ChiTietSoiCamera,
  chayKichBan,
  type DapAnKichBan,
  hopCacXe,
  type PayloadKichBan,
  TEN_VI_PHAM,
  TRO_CHOI_SOI_CAMERA,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, demCanCu, hopKetQua, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}sc-`;
const MA = "soi_camera";
const TUNG_VI_PHAM = "Từng vi phạm";

/** Phần "Xem chi tiết" (GĐ17c): đủ số vi phạm và số dòng căn cứ như `chi_tiet` máy chủ trả. */
async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietSoiCamera>(n, TRO_CHOI_SOI_CAMERA, tkId, 1);
  const so = await vung.locator(`section[aria-label="${TUNG_VI_PHAM}"] > ol > li`).count();
  if (so !== ct.vi_pham.length)
    throw new Error(`${noi}: chi tiết có ${so} vi phạm, cần ${ct.vi_pham.length}.`);
  const canCu = ct.vi_pham.length + ct.bien_ban.filter((d) => d.can_cu.length).length;
  const co = await demCanCu(vung);
  if (co !== canCu) throw new Error(`${noi}: chi tiết có ${co} dòng căn cứ, cần ${canCu}.`);
  if (ct.bien_ban.length) await vung.getByRole("region", { name: "Biên bản (mô phỏng)" }).waitFor();
}
const GOC = join(import.meta.dir, "..", "..");

const MA_DO = `
  window.__khung = null;
  let truoc = 0;
  const vong = (t) => {
    if (window.__khung) { if (truoc) window.__khung.push(t - truoc); truoc = t; } else truoc = 0;
    requestAnimationFrame(vong);
  };
  requestAnimationFrame(vong);
`;

async function buocCuaLuot(n: NguCanhE2E, accId: string): Promise<{ id: string; b: BuocSoiCamera }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, b: l.items[0].noi_dung };
}

const nhipHienTai = async (page: Page) => Number(await page.locator("[data-nhip]").getAttribute("data-nhip"));

export default async function soiCamera(n: NguCanhE2E) {
  /* 0. Dữ liệu ----------------------------------------------------------- */
  const tep = (await Bun.file(join(GOC, "data", "tro-choi", "soi-camera.json")).json()) as {
    doan: Array<{ ma: string; tieu_de: string; payload: PayloadKichBan; answer: DapAnKichBan }>;
  };
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  const maCu = [
    ...new Set(tep.doan.flatMap((d) => d.answer.vi_pham.map((v) => v.ma_muc_phat)).filter(Boolean)),
  ] as string[];
  for (const m of maCu)
    await n.sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${PREFIX + m}, 'o_to', ${`Hành vi thử ${m}`}, 100000, 200000, 'vn:vbqppl:nd:168/2024/NĐ-CP', '2025-01-01', 'da_duyet')`;
  n.donDep(async () => {
    const ids =
      (await n.sql`SELECT id::text AS id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    if (ids.length) await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => r.id))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  });
  for (const d of tep.doan.filter((x) => x.ma === "SC-01" || x.ma === "SC-03")) {
    const answer = {
      vi_pham: d.answer.vi_pham.map((v) => ({
        ...v,
        ma_muc_phat: v.ma_muc_phat ? PREFIX + v.ma_muc_phat : null,
      })),
    };
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}${d.tieu_de}`,
        payload: d.payload as never,
        answer: answer as never,
        explanation: null,
        citations: [],
        refs: [...new Set(answer.vi_pham.map((v) => v.ma_muc_phat).filter(Boolean))].map((ma) => ({
          loai: "violation" as const,
          ma: ma!,
        })),
        offline_ok: true,
        status: "cho_duyet",
      },
      "e2e",
    );
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

  /* 1. Màn 1, chế độ thường --------------------------------------------- */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ soi camera E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Soi camera", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Soi camera" })
    .getByRole("button", { name: /Màn 1: Một vi phạm rõ/ })
    .click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Soi camera" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await page.getByText("Đoạn phim 1/1").waitFor();
  const l1 = await buocCuaLuot(n, tk.id);
  const ds1 = chayKichBan(l1.b.kich_ban);
  const v1 = l1.b.vi_pham[0]!;
  await n.kiemKhongCuonNgang(page, "Soi camera, trước khi xem");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.getByRole("button", { name: "Bắt đầu xem" }).click();
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  // Chờ tới giữa cửa sổ vi phạm rồi dừng hình.
  const giua = Math.floor((v1.bat_dau + v1.ket_thuc) / 2);
  await page.waitForFunction(
    (g) => Number(document.querySelector("[data-nhip]")?.getAttribute("data-nhip")) >= g,
    giua - 20,
    {
      timeout: 60_000,
    },
  );
  const khung = await page.evaluate(() => {
    const d = (window as any).__khung as number[];
    (window as any).__khung = null;
    return d;
  });
  await page.getByRole("button", { name: "Dừng hình" }).click();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  // Chờ khung hình cuộn lên đầu màn hình.
  await page.waitForTimeout(800);
  const tong = khung.reduce((s, x) => s + x, 0);
  const fps = (khung.length / tong) * 1000;
  const sx = [...khung].sort((a, b) => a - b);
  console.log(
    `  Xem phim, CPU chậm 4×: ${khung.length} khung trong ${(tong / 1000).toFixed(1)} giây, trung bình ${fps.toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]!.toFixed(1)} ms`,
  );
  if (fps < 50) throw new Error(`Xem phim chỉ đạt ${fps.toFixed(1)} khung/giây, cần ≥ 50.`);

  // Kéo khung quanh xe vi phạm ở đúng nhịp đang dừng.
  const nh = await nhipHienTai(page);
  if (nh < v1.bat_dau || nh > v1.ket_thuc)
    throw new Error(`Dừng hình ở nhịp ${nh}, ngoài cửa sổ ${v1.bat_dau}–${v1.ket_thuc}.`);
  const h = hopCacXe(ds1[nh]!).get(v1.xe)!;
  const canvas = (await page.locator("canvas").first().boundingBox())!;
  const tl = canvas.width / 1000;
  await page.mouse.move(canvas.x + (h[0] - 12) * tl, canvas.y + (h[1] - 12) * tl);
  await page.mouse.down();
  await page.mouse.move(canvas.x + (h[2] + 12) * tl, canvas.y + (h[3] + 12) * tl, { steps: 10 });
  await page.mouse.up();
  const oKhung = page.getByRole("button", { name: "Khung vừa khoanh: thả thẻ lỗi vào đây" });
  await oKhung.waitFor();
  await n.chupAnh(page, "1-khoanh");
  // Kéo thẻ lỗi vào khung.
  const the = page.getByRole("list", { name: "Thẻ lỗi" }).getByRole("button", { name: TEN_VI_PHAM[v1.loai] });
  const a = (await the.boundingBox())!;
  const b = (await oKhung.boundingBox())!;
  // Khung vừa khoanh và thẻ lỗi phải cùng nằm trong màn hình 740 px để kéo bằng một tay.
  if (b.y < 0 || a.y + a.height > 740)
    throw new Error(
      `Khung (y=${Math.round(b.y)}) và thẻ lỗi (đáy=${Math.round(a.y + a.height)}) không cùng nằm trong màn hình.`,
    );
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.getByText(`Đã ghi: ${TEN_VI_PHAM[v1.loai]}.`, { exact: false }).waitFor();
  await n.kiemKhongCuonNgang(page, "Soi camera, đã khoanh");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Nộp kết quả" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Nộp kết quả" }).click();
  await page.getByRole("button", { name: "◀◀ Tua lại xem chậm" }).first().waitFor({ timeout: 15_000 });
  await n.chupAnh(page, "2-ket-qua");
  // Hộp kết quả (GĐ17a) che bảng chơi: đóng hộp để tua lại đoạn phim.
  await kiemChiTiet(n, await moChiTietRieng(page, [TUNG_VI_PHAM], "Màn 1"), tk.id, "Màn 1");
  await page.keyboard.press("Escape");
  await hopKetQua(page).waitFor({ state: "hidden" });
  await page.getByRole("list", { name: "Các vi phạm trong đoạn phim" }).waitFor();
  await page.getByRole("button", { name: "◀◀ Tua lại xem chậm" }).first().click();
  await page.waitForTimeout(700);
  await n.chupAnh(page, "3-tua-cham");
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  const [s1] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l1.id} AND ordinal = 1`) as any[];
  if (s1?.points !== s1?.toi_da) throw new Error(`Màn 1 được ${s1?.points}/${s1?.toi_da} điểm, cần đủ điểm.`);
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);
  await kiemChiTiet(n, await moXemLai(page, 1, [TUNG_VI_PHAM]), tk.id, "Màn 1, xem lại");

  /* 2. Màn 2, giảm chuyển động, bàn phím -------------------------------- */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Đoạn phim 1/1").waitFor();
  const l2 = await buocCuaLuot(n, tk.id);
  const ds2 = chayKichBan(l2.b.kich_ban);
  await page.getByRole("button", { name: "Bắt đầu xem" }).click();
  const chay2 = page.getByRole("button", { name: "Chạy 2 giây" });
  // Không bấm thì khung vẽ đứng yên.
  const anh = () =>
    page
      .locator("canvas")
      .first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().slice(-80));
  const truoc = await anh();
  await page.waitForTimeout(600);
  if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng phim vẫn tự chạy.");
  let daTua = false;
  for (const v of l2.b.vi_pham) {
    while ((await nhipHienTai(page)) < v.bat_dau) await chay2.click();
    if (!daTua) {
      // Tua lại một lần rồi chạy tới lại.
      await page.getByRole("button", { name: /Tua lại 5 giây/ }).click();
      daTua = true;
      while ((await nhipHienTai(page)) < v.bat_dau) await chay2.click();
    }
    await page.getByRole("button", { name: "Dừng hình" }).click();
    const nhip = await nhipHienTai(page);
    const x = ds2[nhip]!.xe.find((c) => c.id === v.xe)!;
    const thuTu = [...hopCacXe(ds2[nhip]!).keys()].indexOf(v.xe) + 1;
    if (thuTu < 1) throw new Error(`Xe ${v.xe} không hiện ở nhịp ${nhip}.`);
    const nutXe = page.getByRole("button", { name: new RegExp(`^Khoanh xe ${thuTu}: `) });
    await nutXe.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("list", { name: "Thẻ lỗi" })
      .getByRole("button", { name: TEN_VI_PHAM[v.loai] })
      .focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Khung vừa khoanh: thả thẻ lỗi vào đây" }).focus();
    await page.keyboard.press("Enter");
    await page.getByText(`Đã ghi: ${TEN_VI_PHAM[v.loai]}.`, { exact: false }).waitFor();
    if (x.loai === "xe_may") await n.chupAnh(page, "4-tung-buoc-ban-phim");
    await page.getByRole("button", { name: "Tiếp tục" }).click();
  }
  while (!(await page.getByRole("button", { name: "Nộp kết quả" }).isVisible())) await chay2.click();
  await page.getByRole("button", { name: "Nộp kết quả" }).click();
  await page
    .getByText(/Đã bắt|Bỏ sót/)
    .first()
    .waitFor({ timeout: 15_000 });
  await n.chupAnh(page, "5-ket-qua-man-2");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l2.id} AND ordinal = 1`) as any[];
  if (s2?.points !== s2?.toi_da) throw new Error(`Màn 2 được ${s2?.points}/${s2?.toi_da} điểm, cần đủ điểm.`);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
