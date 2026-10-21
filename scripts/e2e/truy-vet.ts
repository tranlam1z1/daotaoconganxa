/**
 * Kịch bản E2E trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17), khung điện thoại 360×740.
 *
 * Dữ liệu: hai vụ mẫu TV-01 (màn 1), TV-03 (màn 2) ở data/tro-choi/truy-vet.json, bản sao có tiền tố, đặt
 * `da_duyet` ngay trong kịch bản. Vụ đã duyệt khác trong CSDL (nếu có) vẫn có thể được chọn, nên kịch bản đọc
 * vụ thật của lượt từ CSDL (lộ trình, bí mật của lượt) để biết camera nào đúng, xe nào cần khóa.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường: hướng dẫn hiện ở lượt đầu; chọn camera bằng danh sách, mở (chờ khi cần); phát đoạn
 *    cảnh với CPU chậm 4× (≥ 50 khung/giây ở đoạn đầu); tạm dừng đúng lúc xe cần tìm trong khung, chọn xe; mở
 *    camera kế tiếp (khóa gửi kèm); đặt điểm chặn bằng CHẠM trên bản đồ; đủ điểm; phần chi tiết của hộp kết quả
 *    có từng đoạn cảnh và điểm chặn; đúng một dòng XP; không cuộn ngang.
 * 2. Màn 2, giảm chuyển động, bàn phím: đoạn cảnh hiện khung tĩnh, bước tới từng giây bằng nút; khung vẽ không
 *    tự chạy; đặt điểm chặn bằng phím mũi tên trên bản đồ và Enter; nộp.
 */

import { join } from "node:path";
import {
  type BuocTruyVet,
  cauHinhDoanCanh,
  chayNhatKyTV,
  type DoanCanh,
  dungDoanCanh,
  dungVu,
  GIAY_CHAN_TRUOC,
  NHIP_DAN,
  NHIP_DOAN,
  type PayloadVuTruyVet,
  type ToaDoO,
  xeTrongDoan,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import type { Page } from "playwright-core";
import { buocMoPhong, dungMoPhong, trangThaiDau } from "../../packages/dao-tao/src/mo-phong/mo-phong.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { moChiTietRieng } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}tv-`;
const MA = "truy_vet";
const GOC = join(import.meta.dir, "..", "..");
const KHOI = ["Từng đoạn cảnh đã xem", "Điểm chặn và điểm số"];
const NHIP_GIAY = 20;

const MA_DO = `
  window.__khung = null;
  let truoc = 0;
  const vong = (t) => {
    if (window.__khung) { if (truoc) window.__khung.push(t - truoc); truoc = t; } else truoc = 0;
    requestAnimationFrame(vong);
  };
  requestAnimationFrame(vong);
`;

async function luotMoiNhat(
  n: NguCanhE2E,
  accId: string,
): Promise<{ id: string; b: BuocTruyVet; ref: string }> {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return { id: l.id, b: l.items[0].noi_dung, ref: l.items[0].ref_id };
}

/** Các giây (tính từ đầu đoạn) mà xe bỏ chạy nằm gọn trong khung hình, theo cùng bộ mô phỏng điện thoại chạy. */
function giayThayXe(dc: DoanCanh, id: string): number[] {
  const mp = dungMoPhong(cauHinhDoanCanh(dc));
  let tt = trangThaiDau(mp);
  const kq: number[] = [];
  for (let i = 1; i <= NHIP_DAN + NHIP_DOAN; i++) {
    tt = buocMoPhong(mp, tt);
    if (i < NHIP_DAN || (i - NHIP_DAN) % NHIP_GIAY) continue;
    const x = tt.xe.find((v) => v.id === id);
    if (x && x.trang_thai === "chay" && Math.abs(x.x) < 2400 && Math.abs(x.y) < 2400)
      kq.push((i - NHIP_DAN) / NHIP_GIAY);
  }
  return kq;
}

/** Mở camera `camId` qua danh sách chọn; bấm nút xem (có thể là "Chờ … rồi xem"). */
async function moCamera(page: Page, camId: string, soDoan: number) {
  await page.getByLabel("Chọn camera").selectOption(camId);
  await page.getByRole("button", { name: /^(Xem camera|Chờ \d+ giây rồi xem)$/ }).click();
  await page.locator(`[data-doan="${soDoan}"]`).waitFor();
}

/** Xe cần khóa trong đoạn vừa mở (đọc ảnh chụp bước từ CSDL, như máy chủ). */
async function xeCanKhoa(n: NguCanhE2E, accId: string, so: number) {
  const { b } = await luotMoiNhat(n, accId);
  const v = dungVu(b.vu, b.bi_mat);
  const tt = chayNhatKyTV(v, b.nhat_ky, b.lo_trinh);
  const d = tt.doan[so]!;
  const id = xeTrongDoan(v, d, b.lo_trinh).find((x) => x.vai === "bo_chay")!.id;
  return { id, dc: dungDoanCanh(v, d, b.lo_trinh), tt };
}

/** Ô chặn đúng đầu tiên theo đồng hồ hiện tại của lượt. */
async function oChanDung(n: NguCanhE2E, accId: string): Promise<ToaDoO> {
  const { b } = await luotMoiNhat(n, accId);
  const tt = chayNhatKyTV(dungVu(b.vu, b.bi_mat), b.nhat_ky, b.lo_trinh);
  return b.lo_trinh.o[b.lo_trinh.t.findIndex((t) => t >= tt.dong_ho + GIAY_CHAN_TRUOC)]!;
}

async function chamO(page: Page, o: ToaDoO, bd: { rong: number; cao: number }) {
  const svg = page.getByRole("application", { name: /Bản đồ khu phố/ });
  await svg.scrollIntoViewIfNeeded();
  const h = (await svg.boundingBox())!;
  await page.mouse.click(h.x + ((o.x + 0.5) / bd.rong) * h.width, h.y + ((o.y + 0.5) / bd.cao) * h.height);
}

export default async function truyVet(n: NguCanhE2E) {
  /* 0. Dữ liệu có tiền tố, đã duyệt ------------------------------------ */
  const vu = (
    (await Bun.file(join(GOC, "data", "tro-choi", "truy-vet.json")).json()) as {
      vu: Array<{ ma: string; tieu_de: string; payload: PayloadVuTruyVet }>;
    }
  ).vu.filter((v) => v.ma === "tv-01" || v.ma === "tv-03");
  n.donDep(async () => {
    const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => String(r.id)).concat("-"))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  });
  const cuaKichBan = new Set<string>();
  for (const v of vu) {
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}${v.tieu_de}`,
        payload: v.payload as never,
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
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ truy vết E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Truy vết xe bỏ trốn", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Truy vết xe bỏ trốn" })
    .getByRole("button", { name: /Màn 1: Làm quen/ })
    .click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Truy vết xe bỏ trốn" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await page.getByText("Vụ 1/1").waitFor();
  await page.getByText(/^Tin báo lúc/).waitFor();
  const l1 = await luotMoiNhat(n, tk.id);
  await n.kiemKhongCuonNgang(page, "Truy vết, màn 1");
  await n.chupAnh(page, "1-tin-bao-ban-do");

  const cdp = await page.context().newCDPSession(page);
  for (const [i, c] of l1.b.lo_trinh.camera.entries()) {
    await moCamera(page, c.id, i);
    const { id, dc } = await xeCanKhoa(n, tk.id, i);
    const thay = giayThayXe(dc, id);
    if (!thay.length) throw new Error(`Đoạn ${i + 1}: xe bỏ chạy không hiện trong khung hình.`);
    const giay = thay[Math.floor(thay.length / 2)]!;
    const khung = page.locator(`[data-doan="${i}"]`);
    if (i === 0) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.evaluate(() => {
        (window as any).__khung = [];
      });
    }
    await page.getByRole("button", { name: "Phát" }).click();
    await page.locator(`[data-doan="${i}"][data-giay="${giay}"]`).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Tạm dừng" }).click();
    if (i === 0) {
      const ds = await page.evaluate(() => {
        const d = (window as any).__khung as number[];
        (window as any).__khung = null;
        return d;
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      const tong = ds.reduce((s, x) => s + x, 0);
      const fps = (ds.length / tong) * 1000;
      const sx = [...ds].sort((a, b) => a - b);
      console.log(
        `  Đoạn cảnh, CPU chậm 4×: ${ds.length} khung, trung bình ${fps.toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]!.toFixed(1)} ms`,
      );
      if (fps < 50) throw new Error(`Đoạn cảnh chỉ đạt ${fps.toFixed(1)} khung/giây, cần ≥ 50.`);
      await n.chupAnh(page, "2-doan-canh");
    }
    // Giây đang hiện có thể lệch một nhịp: tìm nút xe; không có thì lùi về đúng giây.
    await khung.locator(`[data-xe="${id}"]`).click();
    await page.getByText(/sẽ được khóa khi bạn mở camera tiếp theo/).waitFor();
    if (i === 0) await n.chupAnh(page, "3-chon-xe");
  }
  await page.getByRole("button", { name: "Đặt điểm chặn trên bản đồ" }).click();
  const o1 = await oChanDung(n, tk.id);
  await chamO(page, o1, l1.b.vu.ban_do);
  await page.getByText(`Điểm chặn: ô cột ${o1.x + 1}, dòng ${o1.y + 1}.`).waitFor();
  await n.kiemKhongCuonNgang(page, "Đặt điểm chặn");
  await n.chupAnh(page, "4-dat-chan");
  await page.getByRole("button", { name: "Chốt điểm chặn" }).click();
  const vung = await moChiTietRieng(page, KHOI, "Màn 1");
  const soDoan = await vung.locator('section[aria-label="Từng đoạn cảnh đã xem"] li').count();
  if (soDoan !== l1.b.lo_trinh.camera.length)
    throw new Error(`Chi tiết có ${soDoan} đoạn cảnh, cần ${l1.b.lo_trinh.camera.length}.`);
  await vung.getByText("Căn cứ đang được cập nhật", { exact: false }).waitFor();
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "5-ket-qua");
  const [s1] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l1.id} AND ordinal = 1`) as any[];
  if (cuaKichBan.has(l1.ref) && s1?.points !== s1?.toi_da)
    throw new Error(`Màn 1 được ${s1?.points}/${s1?.toi_da} điểm, cần đủ điểm.`);
  await page.getByRole("dialog").getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await n.chupAnh(page, "6-tong-ket");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 2. Màn 2, giảm chuyển động, bàn phím ------------------------------ */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Vụ 1/1").waitFor();
  const l2 = await luotMoiNhat(n, tk.id);
  for (const [i, c] of l2.b.lo_trinh.camera.entries()) {
    await moCamera(page, c.id, i);
    const { id, dc } = await xeCanKhoa(n, tk.id, i);
    const giay = giayThayXe(dc, id)[0]!;
    const toi = page.getByRole("button", { name: "Tới 1 giây" });
    for (let s = 0; s < giay; s++) await toi.click();
    await page.locator(`[data-doan="${i}"][data-giay="${giay}"]`).waitFor();
    if (i === 0) {
      // Giảm chuyển động: khung vẽ không tự chạy.
      const anh = () =>
        page
          .locator(`[data-doan="${i}"] canvas`)
          .evaluate((cv: HTMLCanvasElement) => cv.toDataURL().slice(-80));
      const truoc = await anh();
      await page.waitForTimeout(600);
      if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng đoạn cảnh vẫn tự chạy.");
      await n.chupAnh(page, "7-khung-tinh");
    }
    const nut = page.locator(`[data-doan="${i}"] [data-xe="${id}"]`);
    await nut.focus();
    await page.keyboard.press("Enter");
    await page.getByText(/sẽ được khóa khi bạn mở camera tiếp theo/).waitFor();
  }
  await page.getByRole("button", { name: "Đặt điểm chặn trên bản đồ" }).click();
  const o2 = await oChanDung(n, tk.id);
  const svg = page.getByRole("application", { name: /Bản đồ khu phố/ });
  await svg.focus();
  // Ô trỏ ban đầu ở giữa bản đồ; đi bằng phím mũi tên tới ô chặn rồi Enter.
  const bd = l2.b.vu.ban_do;
  const giua = { x: Math.floor(bd.rong / 2), y: Math.floor(bd.cao / 2) };
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  for (let k = 0; k < Math.abs(o2.x - giua.x); k++)
    await page.keyboard.press(o2.x > giua.x ? "ArrowRight" : "ArrowLeft");
  for (let k = 0; k < Math.abs(o2.y - giua.y); k++)
    await page.keyboard.press(o2.y > giua.y ? "ArrowDown" : "ArrowUp");
  await page.keyboard.press("Enter");
  await page.getByText(`Điểm chặn: ô cột ${o2.x + 1}, dòng ${o2.y + 1}.`).waitFor();
  await n.kiemKhongCuonNgang(page, "Truy vết, màn 2");
  const chot = page.getByRole("button", { name: "Chốt điểm chặn" });
  await chot.focus();
  await page.keyboard.press("Enter");
  await moChiTietRieng(page, KHOI, "Màn 2");
  await n.chupAnh(page, "8-ket-qua-man-2");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points, max_points::float8 AS toi_da FROM game_run_steps WHERE run_id = ${l2.id} AND ordinal = 1`) as any[];
  if (cuaKichBan.has(l2.ref) && s2?.points !== s2?.toi_da)
    throw new Error(`Màn 2 được ${s2?.points}/${s2?.toi_da} điểm, cần đủ điểm.`);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
