/**
 * Kịch bản E2E trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của các biển trong hai đoạn đường mẫu CB-01 (màn 1) và CB-03 (màn 2) ở
 * data/tro-choi/cam-bien.json, đặt `da_duyet` ngay trong kịch bản; ảnh đưa lên kho đối tượng như
 * script nạp. Đoạn đường đã duyệt khác trong CSDL (nếu có) vẫn có thể được chọn, nên kịch bản đọc
 * đoạn đường thật của lượt từ CSDL rồi mới cắm biển.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường: hướng dẫn hiện ở lượt đầu; KÉO biển sai vào vị trí, chạy thử với CPU
 *    chậm 4× (≥ 50 khung/giây), có tình huống nguy hiểm; chỉnh lại bằng chạm-chạm, chạy thử lần 2
 *    (bỏ qua hoạt cảnh), không nguy hiểm; nộp. Máy chủ chấm đủ điểm, băm trạng thái cuối của máy
 *    chủ khớp điện thoại, đúng một dòng XP, không cuộn ngang. Sau khi chấm, bảng chơi còn biển đã cắm
 *    và biển đúng từng vị trí; lý do, căn cứ chỉ có trong "Xem chi tiết" của hộp kết quả, đủ số vị trí
 *    và số dòng căn cứ (GĐ17c); đóng hộp vẫn thấy bảng từng vị trí; màn "Xem lại từng câu" có đủ.
 * 2. Màn 2, giảm chuyển động: cắm biển bằng BÀN PHÍM; chạy thử theo từng bước ("Bước tiếp"), rồi
 *    "Xem kết quả"; khung vẽ không chạy vòng hoạt ảnh; nộp, đủ điểm.
 */

import { join } from "node:path";
import {
  type BuocCamBien,
  type ChiTietCamBien,
  type DapAnDoanDuong,
  type PayloadDoanDuong,
  TRO_CHOI_CAM_BIEN,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import { putFromFile } from "@qdpl/storage";
import type { Locator, Page } from "playwright-core";
import { docBienBao, uriAnhBienBao } from "../bien-bao.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, demCanCu, dongHopXemBang, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}cb-`;
const MA = "cam_bien";
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

const LY_DO = "Lý do từng vị trí";

/** Phần "Xem chi tiết" (GĐ17c): đủ số vị trí và số dòng căn cứ như `chi_tiet` máy chủ trả. */
async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietCamBien>(n, TRO_CHOI_CAM_BIEN, tkId, 1);
  const so = await vung.locator(`[aria-label="${LY_DO}"] li`).count();
  if (so !== ct.vi_tri.length) throw new Error(`${noi}: chi tiết có ${so} vị trí, cần ${ct.vi_tri.length}.`);
  const canCu = await demCanCu(vung);
  if (canCu !== ct.vi_tri.length)
    throw new Error(`${noi}: chi tiết có ${canCu} dòng căn cứ, cần ${ct.vi_tri.length}.`);
}

async function buocCuaLuot(n: NguCanhE2E, accId: string): Promise<{ id: string; b: BuocCamBien }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, b: l.items[0].noi_dung };
}

const oViTri = (page: Page, so: number) =>
  page.getByRole("button", { name: new RegExp(`^Vị trí ${so}[,:]`) });
const oBien = (page: Page, ten: string) =>
  page
    .getByRole("list", { name: "Khay biển" })
    .getByRole("button", { name: new RegExp(`^${ten.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });

/** Kéo thật bằng chuột: nhấn giữ biển, di qua nhiều bước, thả trên vị trí. */
async function keo(page: Page, tu: ReturnType<typeof oBien>, den: ReturnType<typeof oViTri>) {
  await den.scrollIntoViewIfNeeded();
  const a = (await tu.boundingBox())!;
  const b = (await den.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

export default async function camBien(n: NguCanhE2E) {
  /* 0. Dữ liệu có tiền tố, đã duyệt ------------------------------------ */
  const tep = (await Bun.file(join(GOC, "data", "tro-choi", "cam-bien.json")).json()) as {
    doan: Array<{ ma: string; tieu_de: string; payload: PayloadDoanDuong; answer: DapAnDoanDuong }>;
  };
  const mau = tep.doan.filter((d) => d.ma === "CB-01" || d.ma === "CB-03");
  const can = new Set(mau.flatMap((d) => d.payload.khay));
  const bien = (await docBienBao()).filter((b) => can.has(b.ma));
  n.donDep(() => n.sql`DELETE FROM traffic_signs WHERE code LIKE ${`${PREFIX}%`}`);
  for (const b of bien) {
    await putFromFile(uriAnhBienBao(b.anh), join(GOC, "data", "bien-bao", "anh", b.anh));
    await n.sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction)
      VALUES (${`${PREFIX}${b.ma}`}, ${b.nhom}, ${b.ten}, ${b.y_nghia}, ${uriAnhBienBao(b.anh)}, ${b.can_cu},
              'da_duyet', ${b.phan_ung ?? null})`;
  }
  const doiMa = (m: string) => `${PREFIX}${m}`;
  n.donDep(async () => {
    const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => String(r.id)).concat("-"))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  });
  for (const d of mau) {
    const payload = { ...d.payload, khay: d.payload.khay.map(doiMa) };
    const answer = {
      vi_tri: Object.fromEntries(
        Object.entries(d.answer.vi_tri).map(([k, v]) => [
          k,
          { ...v, dung: v.dung.map(doiMa), chap_nhan: v.chap_nhan.map(doiMa) },
        ]),
      ),
    };
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}${d.tieu_de}`,
        payload: payload as never,
        answer: answer as never,
        explanation: null,
        citations: [],
        refs: payload.khay.map((ma) => ({ loai: "traffic_sign" as const, ma })),
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

  /* 1. Màn 1, chế độ thường ------------------------------------------ */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ cắm biển E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Cắm biển cho tuyến đường", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Cắm biển cho tuyến đường" });
  await the.getByRole("button", { name: /Màn 1: Một chỗ nguy hiểm/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Cắm biển cho tuyến đường" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();

  await page.getByText("Đoạn đường 1/1").waitFor();
  const l1 = await buocCuaLuot(n, tk.id);
  const v1 = [...l1.b.doan.vi_tri].sort((a, b) => a.o - b.o)[0]!;
  const da1 = l1.b.dap_an.vi_tri[v1.id]!;
  const tenCua = (ma: string) => l1.b.bien.find((x) => x.ma === ma)!.ten;
  const sai = l1.b.doan.khay.find((m) => !da1.dung.includes(m) && !da1.chap_nhan.includes(m))!;
  await n.kiemKhongCuonNgang(page, "Cắm biển, màn 1");
  await n.chupAnh(page, "1-cam-bien");

  // Kéo biển sai vào vị trí 1.
  await keo(page, oBien(page, tenCua(sai)), oViTri(page, 1));
  await oViTri(page, 1)
    .and(page.getByRole("button", { name: new RegExp(`đã cắm ${tenCua(sai)}`) }))
    .waitFor();

  // Chạy thử với CPU chậm 4×, đo khung hình.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  await page.getByRole("button", { name: "Cho xe chạy thử (còn 3 lần)" }).click();
  await page.waitForTimeout(1500);
  await n.chupAnh(page, "2-chay-thu");
  await page.getByText(/^Chạy thử xong/).waitFor({ timeout: 60_000 });
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
  await page.getByRole("heading", { name: "Xe xử lý sai khi chạy thử" }).waitFor();
  if (!(await page.getByText("Vì sao:").first().isVisible()))
    throw new Error("Chạy thử có tình huống mà không có giải thích vì sao.");
  await n.kiemKhongCuonNgang(page, "Sau chạy thử");
  await n.chupAnh(page, "3-tinh-huong");

  // Chỉnh lại bằng chạm-chạm: chạm vị trí để gỡ, chạm biển đúng rồi chạm vị trí.
  await page.getByRole("button", { name: "Chỉnh lại biển" }).click();
  await oViTri(page, 1).click();
  await oViTri(page, 1)
    .and(page.getByRole("button", { name: /: trống$/ }))
    .waitFor();
  await oBien(page, tenCua(da1.dung[0]!)).click();
  await oViTri(page, 1).click();
  await page.getByRole("button", { name: "Cho xe chạy thử (còn 2 lần)" }).click();
  await page.getByRole("button", { name: "Bỏ qua hoạt cảnh" }).click();
  await page.getByText("Xe qua cả đoạn đường an toàn, không phải phanh gấp.").waitFor();
  await page.getByRole("button", { name: "Nộp bố trí này" }).click();

  const kq = page.locator("[data-bam-may]");
  await kq.waitFor({ timeout: 15_000 });
  const [bamMay, bamChu] = [await kq.getAttribute("data-bam-may"), await kq.getAttribute("data-bam")];
  if (!bamMay || bamMay !== bamChu)
    throw new Error(`Băm trạng thái lệch: điện thoại ${bamMay}, máy chủ ${bamChu}.`);
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "4-ket-qua");
  const [s1] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l1.id} AND ordinal = 1`) as any[];
  if (s1?.points !== s1?.toi_da) throw new Error(`Màn 1 được ${s1?.points}/${s1?.toi_da} điểm, cần đủ điểm.`);
  await kiemChiTiet(n, await moChiTietRieng(page, [LY_DO], "Màn 1"), tk.id, "Màn 1");
  await n.chupAnh(page, "4b-chi-tiet");
  await dongHopXemBang(page, page.getByRole("list", { name: "Kết quả từng vị trí" }), "Màn 1");
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await kiemChiTiet(n, await moXemLai(page, 1, [LY_DO]), tk.id, "Màn 1, xem lại");
  await n.chupAnh(page, "5-tong-ket");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 2. Màn 2, giảm chuyển động, bàn phím ------------------------------ */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Đoạn đường 1/1").waitFor();
  const l2 = await buocCuaLuot(n, tk.id);
  const soCua = new Map([...l2.b.doan.vi_tri].sort((a, b) => a.o - b.o).map((v, i) => [v.id, i + 1]));
  for (const v of l2.b.doan.vi_tri) {
    for (const ma of l2.b.dap_an.vi_tri[v.id]!.dung) {
      await oBien(page, l2.b.bien.find((x) => x.ma === ma)!.ten).focus();
      await page.keyboard.press("Enter");
      await oViTri(page, soCua.get(v.id)!).focus();
      await page.keyboard.press("Enter");
    }
  }
  await n.kiemKhongCuonNgang(page, "Cắm biển, màn 2");
  await page.getByRole("button", { name: "Cho xe chạy thử (còn 3 lần)" }).click();
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  const buocTiep = page.getByRole("button", { name: "Bước tiếp (1 giây)" });
  await buocTiep.click();
  await buocTiep.click();
  await n.chupAnh(page, "6-tung-buoc");
  // Chế độ từng bước: khung vẽ không tự chạy, ảnh canvas đứng yên khi không bấm.
  const anh = () =>
    page
      .locator("canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length + c.toDataURL().slice(-64));
  const truoc = await anh();
  await page.waitForTimeout(600);
  if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng cảnh vẫn tự chạy.");
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText("Xe qua cả đoạn đường an toàn, không phải phanh gấp.").waitFor();
  await page.getByRole("button", { name: "Nộp bố trí này" }).click();
  await page.locator("[data-bam-may]").waitFor({ timeout: 15_000 });
  await n.chupAnh(page, "7-ket-qua-man-2");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l2.id} AND ordinal = 1`) as any[];
  if (s2?.points !== s2?.toi_da) throw new Error(`Màn 2 được ${s2?.points}/${s2?.toi_da} điểm, cần đủ điểm.`);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
