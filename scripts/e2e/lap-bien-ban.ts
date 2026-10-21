/**
 * Kịch bản E2E trò "Lập biên bản" (docs/PLAN.md GĐ-G3), khung điện thoại 360×740, CPU chậm 4×.
 *
 * Dữ liệu: bản sao có tiền tố của MỌI dòng trong data/tra-cuu/muc-phat.json và mọi tình huống demo
 * trong data/tro-choi/lap-bien-ban.json, được DUYỆT ngay trong kịch bản (cùng hàm duyệt của màn hình
 * quản trị). Dữ liệu thật trong CSDL không bị đụng tới.
 *
 * Kiểm:
 * 1. Chế độ thường, âm thanh tắt: vào chơi từ trang Trò chơi; chọn hành vi bằng tìm không dấu (gõ ba
 *    từ đầu của hành vi, bỏ dấu, ví dụ "khong doi mu"); chọn Điều; ô tiền tự định dạng nghìn; ký; thấy
 *    kết quả từng ô, chữ ký vẽ nét, con dấu "ĐẠT" đóng xuống. Biên bản 2 cố ý nhập tiền dưới khung 1
 *    đồng: dấu "CHƯA ĐẠT", ô tiền "Chưa đúng"; khung đúng chỉ có trong "Xem chi tiết" của hộp kết quả
 *    (GĐ17c), đóng hộp thì ô tiền vẫn ghi "Chưa đúng". Hết 3 biên bản ra tổng kết có XP, đúng một dòng
 *    XP; màn "Xem lại từng câu" có đáp án ô tiền của biên bản 2. Không tạo AudioContext nào; không cuộn
 *    ngang.
 * 2. Giảm chuyển động (hệ điều hành): chơi trọn lượt; mọi `.g-a` chỉ còn hiện dần, mọi `.g-t` tắt,
 *    vệt lóe quanh con dấu ẩn, con dấu vẫn hiện rõ; không pháo hoa; không AudioContext.
 * 3. Đo khung hình quanh lúc ký (chuỗi chữ ký → chấm từng ô → con dấu) ở cả hai chế độ; hỏng khi quá
 *    5% khung dài hơn 100 ms.
 */

import type { BuocBienBan, DongMucPhat } from "@qdpl/dao-tao";
import { chuanHoa } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, napTraCuuNhanh } from "@qdpl/db";
import type { Page } from "playwright-core";
import { napTinhHuongLapBienBan } from "../../packages/db/src/seed-tro-choi.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { dongHopXemBang, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const DAP_AN_O = "Đáp án các ô chưa đúng";
const dapAnTien = (b: BuocBienBan) =>
  `Đáp án: trong khung ${b.dap_an.dong[0]!.phat_tu.toLocaleString("vi-VN")} đồng`;

const PREFIX = `${TIEN_TO}lbb-`;

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

export async function chuanBi(n: NguCanhE2E) {
  const goc = ((await Bun.file("data/tra-cuu/muc-phat.json").json()) as { dong: DongMucPhat[] }).dong;
  const mp = goc.map((d) => ({
    ...d,
    ma: `${PREFIX}${d.ma}`,
    trang_thai: "da_duyet" as const,
  }));
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX });
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const soTinhHuong = (
    (await Bun.file("data/tro-choi/lap-bien-ban.json").json()) as { tinh_huong: unknown[] }
  ).tinh_huong.length;
  const tao = await napTinhHuongLapBienBan({ tienToTen: PREFIX, tienToMa: PREFIX, mucPhat: goc });
  if (tao.daTao !== soTinhHuong)
    throw new Error(`Cần tạo ${soTinhHuong} tình huống demo, tạo được ${tao.daTao}.`);
  const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
  for (const r of ids) {
    const kq = await chuyenTrangThaiNoiDung({
      id: r.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: `${PREFIX}duyet`,
    });
    if (!kq?.ok) throw new Error(`Không duyệt được tình huống ${r.id}: ${JSON.stringify(kq)}`);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = 'lap_bien_ban'`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = 'lap_bien_ban'`);
  await n.sql`UPDATE games SET enabled = true WHERE code = 'lap_bien_ban'`;
}

async function moTrangDo(n: NguCanhE2E, giam: boolean) {
  const page = await n.moTrang();
  await page.addInitScript(MA_DO);
  if (giam) await page.emulateMedia({ reducedMotion: "reduce" });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return page;
}

async function doKhung(page: Page, ms: number, ds: number[]) {
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  await page.waitForTimeout(ms);
  ds.push(
    ...(await page.evaluate(() => {
      const d = (window as any).__khung as number[];
      (window as any).__khung = null;
      return d;
    })),
  );
}

function inThongKe(ten: string, ds: number[]) {
  const sx = [...ds].sort((a, b) => a - b);
  const p = (q: number) => sx[Math.min(sx.length - 1, Math.floor(q * sx.length))] ?? 0;
  const tiLeDai = ds.length ? ds.filter((d) => d > 100).length / ds.length : 0;
  console.log(
    `  ${ten}: ${ds.length} khung, trung vị ${p(0.5).toFixed(1)} ms, p95 ${p(0.95).toFixed(1)} ms, ` +
      `lớn nhất ${(sx.at(-1) ?? 0).toFixed(0)} ms, khung >100 ms: ${(tiLeDai * 100).toFixed(1)}%`,
  );
  if (ds.length < 20) throw new Error(`${ten}: đo được quá ít khung (${ds.length}).`);
  if (tiLeDai > 0.05) throw new Error(`${ten}: ${(tiLeDai * 100).toFixed(1)}% khung dài hơn 100 ms.`);
}

async function tenHoatAnh(page: Page) {
  return page.evaluate(() => {
    const lay = (sel: string) =>
      [...document.querySelectorAll(sel)].map((el) => getComputedStyle(el).animationName);
    const an = [...document.querySelectorAll(".g-an-khi-giam")].map((el) => getComputedStyle(el).display);
    return { a: lay(".g-a"), t: lay(".g-t"), an };
  });
}

const soAudio = (page: Page) => page.evaluate(() => (window as any).__soAudio as number);

export async function vaoChoi(n: NguCanhE2E, page: Page, tkId: string): Promise<BuocBienBan[]> {
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Lập biên bản", exact: true }).click();
  await page.getByRole("dialog", { name: "Lập biên bản" }).getByRole("button", { name: "Chơi" }).click();
  await page.getByText("Câu 1/3").waitFor();
  const [luot] = (await n.sql`
    SELECT items FROM game_runs WHERE account_id = ${tkId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return (luot.items as Array<{ noi_dung: BuocBienBan }>).map((b) => b.noi_dung);
}

/**
 * Điền biểu mẫu. `lechTien`: cộng vào số tiền của dòng 1 (−1 là dưới khung 1 đồng). Hành vi chọn bằng
 * tìm không dấu: ba từ đầu của hành vi đúng, bỏ dấu.
 */
export async function dienVaKy(page: Page, b: BuocBienBan, lechTien = 0) {
  const n = b.dap_an.dong.length;
  for (let i = 0; i < n; i++) {
    const d = b.dap_an.dong[i]!;
    const hauTo = n > 1 ? ` (hành vi ${i + 1})` : "";
    const tuKhoa = chuanHoa(d.hanh_vi_text).split(" ").slice(0, 3).join(" ");
    await page.getByLabel(`Tìm hành vi vi phạm${hauTo}`).fill(tuKhoa);
    const ung = page.getByRole("button").filter({ hasText: d.hanh_vi_text });
    await ung.first().click();

    const dieu = /^(.*#dieu-[^.]+)/.exec(d.dieu_khoan)![1]!;
    const nhom = page.getByRole("group", { name: `Điều khoản áp dụng${hauTo}` });
    await nhom.getByLabel("Điều", { exact: true }).selectOption(dieu);
    const khoan = /^(.*\.khoan-[^.]+)/.exec(d.dieu_khoan)?.[1];
    if (khoan) await nhom.getByLabel("Khoản", { exact: true }).selectOption(khoan);
    if (/\.diem-/.test(d.dieu_khoan))
      await nhom.getByLabel("Điểm", { exact: true }).selectOption(d.dieu_khoan);

    const tien = d.phat_tu + (i === 0 ? lechTien : 0);
    const o = page.getByLabel(`3. Mức phạt tiền${hauTo}`);
    await o.fill(String(tien));
    const hien = await o.inputValue();
    if (hien !== tien.toLocaleString("vi-VN"))
      throw new Error(`Ô tiền hiện "${hien}", cần "${tien.toLocaleString("vi-VN")}".`);
  }
  const tenBs = new Map(b.lua_chon_bo_sung.map((o) => [o.id, o.text]));
  for (const id of b.dap_an.bo_sung) await page.getByRole("checkbox", { name: tenBs.get(id)! }).check();
  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  await page
    .locator("[role=status]")
    .filter({ hasText: /^(ĐẠT|CHƯA ĐẠT)$/ })
    .waitFor();
}

export default async function lapBienBan(n: NguCanhE2E) {
  await chuanBi(n);
  const loiTrang: string[] = [];

  /* 1. Chế độ thường, âm thanh tắt ----------------------------------- */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ lập biên bản E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await moTrangDo(n, false);
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  const buoc = await vaoChoi(n, page, tk.id);
  await n.kiemKhongCuonNgang(page, "Biểu mẫu biên bản 1");
  await n.chupAnh(page, "1-bieu-mau");
  const khungThuong: number[] = [];

  for (let i = 1; i <= 3; i++) {
    if (i > 1) await page.getByText(`Câu ${i}/3`).waitFor();
    const b = buoc[i - 1]!;
    const saiTien = i === 2;
    const cho = doKhung(page, 1600, khungThuong);
    await dienVaKy(page, b, saiTien ? -1 : 0);
    await cho;
    const dau = page.locator(".lbb-dau");
    const chu = (await dau.innerText()).trim();
    if (chu !== (saiTien ? "CHƯA ĐẠT" : "ĐẠT")) throw new Error(`Biên bản ${i}: con dấu "${chu}".`);
    if (i === 1) {
      const ha = await tenHoatAnh(page);
      if (!ha.a.includes("lbb-dong-dau")) throw new Error(`Không thấy hoạt ảnh con dấu: ${ha.a.join(", ")}`);
      if (!ha.t.includes("g-ve-net")) throw new Error("Không thấy chữ ký vẽ nét.");
      if ((await page.getByText("Đúng", { exact: true }).count()) < 4)
        throw new Error("Chưa thấy kết quả đủ 4 ô.");
      await n.kiemKhongCuonNgang(page, "Kết quả biên bản 1");
      await n.chupAnh(page, "2-ket-qua-dat");
    }
    if (saiTien) {
      // Đáp án của ô sai chỉ có trong "Xem chi tiết" (GĐ17c); ô trên mẫu vẫn ghi "Chưa đúng".
      const vung = await moChiTietRieng(page, [DAP_AN_O], "Biên bản 2");
      await vung.getByText(dapAnTien(b)).waitFor();
      const so = await vung.locator(`section[aria-label="${DAP_AN_O}"] li`).count();
      if (so !== 1) throw new Error(`Biên bản 2 chỉ sai ô tiền mà chi tiết có ${so} đáp án.`);
      await n.chupAnh(page, "3-ket-qua-chua-dat");
      await dongHopXemBang(page, page.getByText("Chưa đúng", { exact: true }), "Biên bản 2");
    }
    await page.getByRole(i < 3 ? "link" : "button", { name: i < 3 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText("Đúng 2/3").waitFor();
  await (await moXemLai(page, 2, [DAP_AN_O])).getByText(dapAnTien(buoc[1]!)).waitFor();
  await n.kiemKhongCuonNgang(page, "Tổng kết lượt");
  await n.chupAnh(page, "4-tong-ket");
  if ((await soAudio(page)) !== 0) throw new Error("Âm thanh đang tắt nhưng đã tạo AudioContext.");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = 'game:lap_bien_ban'`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);
  inThongKe("Chế độ thường, CPU chậm 4×", khungThuong);

  /* 2. Giảm chuyển động, âm thanh tắt -------------------------------- */
  const tk2 = await n.taoTaiKhoan({ ten: "Cán bộ biên bản giảm chuyển động E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk2.id}`);
  const giam = await moTrangDo(n, true);
  giam.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(giam, tk2);
  const buoc2 = await vaoChoi(n, giam, tk2.id);
  const khungGiam: number[] = [];
  for (let i = 1; i <= 3; i++) {
    if (i > 1) await giam.getByText(`Câu ${i}/3`).waitFor();
    const cho = doKhung(giam, 1200, khungGiam);
    await dienVaKy(giam, buoc2[i - 1]!);
    await cho;
    if (i === 1) {
      const ha = await tenHoatAnh(giam);
      const aSai = ha.a.filter((x) => x !== "g-hien");
      const tSai = ha.t.filter((x) => x !== "none");
      if (aSai.length) throw new Error(`Giảm chuyển động nhưng .g-a còn: ${aSai.join(", ")}`);
      if (tSai.length) throw new Error(`Giảm chuyển động nhưng .g-t còn: ${tSai.join(", ")}`);
      if (ha.an.some((d) => d !== "none"))
        throw new Error("Giảm chuyển động nhưng vệt lóe con dấu vẫn hiện.");
      await giam.waitForTimeout(300);
      const doMo = await giam.locator(".lbb-dau").evaluate((el) => Number(getComputedStyle(el).opacity));
      if (doMo < 1) throw new Error(`Giảm chuyển động: con dấu chưa hiện rõ (opacity ${doMo}).`);
      await n.chupAnh(giam, "5-giam-ket-qua-bien-ban");
    }
    await giam.getByRole(i < 3 ? "link" : "button", { name: i < 3 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await giam.getByText("Đúng 3/3").waitFor();
  if (await giam.locator("canvas").count()) throw new Error("Giảm chuyển động nhưng vẫn bắn pháo hoa.");
  if ((await soAudio(giam)) !== 0) throw new Error("Âm thanh đang tắt nhưng đã tạo AudioContext.");
  await n.chupAnh(giam, "6-giam-tong-ket");
  inThongKe("Giảm chuyển động, CPU chậm 4×", khungGiam);

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
