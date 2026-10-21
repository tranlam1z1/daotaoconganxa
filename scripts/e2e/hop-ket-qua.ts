/**
 * Kịch bản E2E hộp kết quả đúng/sai trong trò chơi (docs/PLAN.md GĐ17a,
 * docs/PROMPT_HOP_KET_QUA_TRO_CHOI.md mục 2.7), khung điện thoại 360×740.
 *
 * Kiểm:
 * 1. Cung đường biển báo (khung chung, có đồng hồ cả lượt), âm thanh bật:
 *    - chốt đúng thì hộp tên "Đúng" hiện, nút "Câu tiếp" có tiêu điểm, có âm thanh;
 *    - giải thích ẩn (`hidden`) tới khi bấm "Xem chi tiết" (`aria-expanded`), bấm lại thì ẩn;
 *    - dòng giờ còn lại trong hộp giảm dần và khớp đồng hồ đầu trang;
 *    - Esc đóng hộp, tiêu điểm ở "Xem lại kết quả"; mở lại thì chi tiết thu gọn, không phát lại âm;
 *    - khóa cuộn khi hộp mở; bấm "Câu tiếp" trong hộp thì sang bước sau, không còn dialog mở,
 *      khóa cuộn đã gỡ;
 *    - chốt sai thì hộp "Chưa đúng", bảng chơi vẫn tô "Đáp án đúng", chi tiết lại thu gọn (H9);
 *    - không cuộn ngang; "Xem chi tiết" và nút chính cao ≥ 48px.
 * 2. Vượt màn (trang /luyen-tap/:phien, H1): hộp cho câu của màn; câu sai có dòng "Đáp án: …" (Đ9);
 *    giải thích dài thì phần chi tiết cuộn trong hộp, nút chính vẫn trong khung nhìn (Đ2); căn cứ mở
 *    rộng tại chỗ (H8); tải lại trang thì hộp không tự mở, đáy trang có "Xem lại kết quả".
 * 3. Giảm chuyển động của hệ điều hành: hộp chỉ hiện dần, không phóng to; công tắc "Giảm hiệu ứng" của
 *    trò chơi: hộp không có hiệu ứng nào (Đ3).
 * 4. Lập biên bản (khung chung, không có đồng hồ): hộp hiện, không có dòng giờ; con dấu trên mẫu
 *    biên bản vẫn ở bảng chơi.
 * Chơi offline kiểm trong tro-choi-khung.ts.
 */
import { join } from "node:path";
import type { BienBao, BuocCungDuong, ThaoTacBienBao } from "@qdpl/dao-tao";
import { luuChuDeCauHoi, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { putFromFile } from "@qdpl/storage";
import type { Locator, Page } from "playwright-core";
import { docBienBao, uriAnhBienBao } from "../bien-bao.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chuanBi as chuanBiLapBienBan, dienVaKy, vaoChoi as vaoLapBienBan } from "./lap-bien-ban.ts";

/** Tên truy cập của hộp kết quả (mục 2.7). */
export const TEN_HOP_KET_QUA = /^(Đúng|Chưa đúng|Đúng một phần|Hết giờ)$/;

/** Hộp kết quả đang mở trên trang; `ten` để chờ đúng một loại kết quả. */
export function hopKetQua(page: Page, ten: string | RegExp = TEN_HOP_KET_QUA): Locator {
  return page.getByRole("dialog", { name: ten });
}

const PREFIX = `${TIEN_TO}hkq-`;
const DUNG = "Đây là phương án đúng";
const CAN_CU = "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3";

/** Đếm nốt nhạc được phát (mỗi âm tạo vài oscillator); bật âm thanh trò chơi khi `amThanh`. */
const maDem = (amThanh: boolean, giamHieuUng = false) => `
  ${amThanh ? `localStorage.setItem("qdpl.game.am-thanh", "1");` : ""}
  ${giamHieuUng ? `localStorage.setItem("qdpl.game.giam-hieu-ung", "1");` : ""}
  window.__soNot = 0;
  for (const ten of ["AudioContext", "webkitAudioContext"]) {
    const Goc = window[ten];
    if (!Goc) continue;
    const tao = Goc.prototype.createOscillator;
    Goc.prototype.createOscillator = function (...a) { window.__soNot++; return tao.apply(this, a); };
  }
`;

const soNot = (page: Page) => page.evaluate(() => (window as any).__soNot as number);
const tieuDiem = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
const khoaCuon = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).overflow);

async function cho(dieuKien: () => Promise<boolean>, moTa: string, giay = 10) {
  const het = Date.now() + giay * 1000;
  while (Date.now() < het) {
    if (await dieuKien()) return;
    await Bun.sleep(200);
  }
  throw new Error(`Hết giờ chờ: ${moTa}`);
}

/** Nút "Xem chi tiết" của hộp và vùng nó điều khiển. */
async function chiTiet(hop: Locator) {
  const nut = hop.getByRole("button", { name: /^(Xem chi tiết|Ẩn chi tiết)$/ });
  const id = await nut.getAttribute("aria-controls");
  if (!id) throw new Error('Nút "Xem chi tiết" thiếu aria-controls.');
  return { nut, vung: hop.page().locator(`[id="${id}"]`) };
}

async function kiemThuGon(hop: Locator, noi: string) {
  const { nut, vung } = await chiTiet(hop);
  if ((await nut.getAttribute("aria-expanded")) !== "false") throw new Error(`${noi}: chi tiết đang mở.`);
  if ((await nut.innerText()).trim() !== "Xem chi tiết") throw new Error(`${noi}: nhãn nút sai.`);
  if (!(await vung.evaluate((el) => (el as HTMLElement).hidden)))
    throw new Error(`${noi}: vùng chi tiết không có hidden.`);
  if (await vung.isVisible()) throw new Error(`${noi}: vùng chi tiết vẫn nhìn thấy.`);
}

/** Chờ hộp thoại chứa `loc` chạy xong hiệu ứng mở (phóng 0,9 → 1) rồi mới đo kích thước, vị trí. */
async function choHopMoXong(loc: Locator) {
  await loc.evaluate((el) =>
    Promise.all((el.closest("dialog") ?? el).getAnimations().map((a) => a.finished.catch(() => {}))),
  );
}

async function kiemCao48(loc: Locator, ten: string) {
  await choHopMoXong(loc);
  const b = await loc.boundingBox();
  if (!b || b.height < 48) throw new Error(`${ten} cao ${b?.height ?? 0}px, cần ≥ 48px.`);
}

async function kiemTrongKhung(loc: Locator, ten: string) {
  await choHopMoXong(loc);
  const b = await loc.boundingBox();
  if (!b || b.y < 0 || b.y + b.height > 740)
    throw new Error(`${ten} nằm ngoài khung nhìn: ${JSON.stringify(b)}.`);
}

/**
 * Không có hiệu ứng phóng to: không hoạt ảnh, hộp không biến đổi kích thước. `chiMoDan`: giảm chuyển
 * động của hệ điều hành vẫn cho hộp hiện dần, mờ dần (chuyển tiếp opacity), còn công tắc "Giảm hiệu
 * ứng" của trò chơi tắt hẳn chuyển tiếp (không có hoặc ≤ 1 ms).
 */
async function kiemKhongHieuUng(hop: Locator, noi: string, chiMoDan: boolean) {
  const s = await hop.evaluate((el) => {
    const c = getComputedStyle(el);
    return {
      prop: c.transitionProperty,
      dur: c.transitionDuration,
      anim: c.animationName,
      bien: c.transform,
    };
  });
  const tg = s.dur.split(",").map((x) => Number.parseFloat(x) * (x.trim().endsWith("ms") ? 0.001 : 1));
  const thuocTinh = s.prop.split(",").map((x) => x.trim());
  if (s.anim !== "none") throw new Error(`${noi}: hộp có hoạt ảnh ${s.anim}.`);
  if (s.bien !== "none") throw new Error(`${noi}: hộp còn biến đổi ${s.bien}.`);
  if (chiMoDan) {
    // Chuyển tiếp còn lại (nếu có) chỉ là opacity và các thuộc tính rời rạc display, overlay.
    const la = thuocTinh.filter(
      (p, i) => (tg[i % tg.length] ?? 0) > 0.001 && !["opacity", "display", "overlay"].includes(p),
    );
    if (la.length) throw new Error(`${noi}: hộp còn chuyển tiếp ${la.join(", ")} (${s.dur}).`);
    return;
  }
  if (s.prop !== "none" && Math.max(...tg) > 0.001)
    throw new Error(`${noi}: hộp còn chuyển tiếp ${s.prop} ${s.dur}.`);
}

/* ------------------------------------------------------------------ */
/* Chi tiết riêng của từng trò (GĐ17c), dùng ở kịch bản của từng trò    */
/* ------------------------------------------------------------------ */

/** Nút đi tiếp trong hộp: liên kết ("Câu tiếp", nhãn riêng của trò) hoặc nút "Xem kết quả". */
export function nutChinhCuaHop(hop: Locator): Locator {
  return hop.locator("a[href], form button[type=submit]").last();
}

/**
 * Hộp vừa mở: các khối `khoi` (tên vùng, ví dụ "Lỗi của người lái này") không có trên trang vì chi
 * tiết đang thu gọn. Bấm "Xem chi tiết" thì có đủ trong phần chi tiết; phần chi tiết cuộn trong hộp,
 * nút chính vẫn trong khung nhìn. Trả vùng chi tiết để kịch bản đếm mục.
 */
export async function moChiTietRieng(page: Page, khoi: readonly string[], noi: string): Promise<Locator> {
  const hop = hopKetQua(page);
  await hop.waitFor();
  await kiemThuGon(hop, noi);
  for (const ten of khoi)
    if (await page.getByRole("region", { name: ten, exact: true }).count())
      throw new Error(`${noi}: khối "${ten}" còn trên trang khi chi tiết đang thu gọn.`);
  const { nut, vung } = await chiTiet(hop);
  await nut.click();
  for (const ten of khoi) await vung.getByRole("region", { name: ten, exact: true }).first().waitFor();
  if ((await vung.evaluate((el) => getComputedStyle(el).overflowY)) !== "auto")
    throw new Error(`${noi}: phần chi tiết không cuộn trong hộp.`);
  await kiemTrongKhung(nutChinhCuaHop(hop), `${noi}: nút chính của hộp`);
  return vung;
}

/**
 * `chi_tiet` máy chủ trả cho bước `thuTu` của lượt mới nhất: chấm lại câu trả lời đã ghi bằng hàm chấm
 * của trò, như máy chủ dựng màn xem lại (routes/luot-choi.ts `ketQuaDaGhi`). Để so nội dung "Xem chi
 * tiết" với dữ liệu gốc.
 */
export async function chiTietDaCham<C>(
  n: NguCanhE2E,
  dn: { chamBuoc: (b: any, tl: any, ng?: any) => { chiTiet?: unknown } },
  taiKhoan: string,
  thuTu: number,
): Promise<C> {
  const [r] = (await n.sql`
    SELECT l.items, s.response, s.elapsed_ms FROM game_runs l JOIN game_run_steps s ON s.run_id = l.id
    WHERE l.account_id = ${taiKhoan} AND s.ordinal = ${thuTu} ORDER BY l.started_at DESC LIMIT 1`) as any[];
  if (!r) throw new Error(`Chưa ghi bước ${thuTu}.`);
  const b = (r.items as Array<{ thu_tu: number }>).find((x) => x.thu_tu === thuTu);
  return dn.chamBuoc(b, r.response, { thoiGianMs: r.elapsed_ms, offline: false }).chiTiet as C;
}

/** Số dòng "Căn cứ: …" trong một vùng. */
export function demCanCu(vung: Locator): Promise<number> {
  return vung.getByText(/^Căn cứ:/).count();
}

/** Đóng hộp bằng Esc: bảng chơi vẫn có `danhDau` (tô đáp án); rồi mở lại hộp bằng "Xem lại kết quả". */
export async function dongHopXemBang(page: Page, danhDau: Locator, noi: string) {
  await page.keyboard.press("Escape");
  await hopKetQua(page).waitFor({ state: "hidden" });
  if (!(await danhDau.count())) throw new Error(`${noi}: đóng hộp mà bảng chơi không còn đánh dấu.`);
  await danhDau.first().scrollIntoViewIfNeeded();
  if (!(await danhDau.first().isVisible()))
    throw new Error(`${noi}: đánh dấu trên bảng chơi không nhìn thấy.`);
  await page.getByRole("button", { name: "Xem lại kết quả" }).click();
  await hopKetQua(page).waitFor();
}

/**
 * Màn "Xem lại từng câu" cuối lượt: câu `thuTu` chưa hiện các khối `khoi`; bấm "Xem chi tiết" của câu
 * đó thì có đủ. Trả vùng chi tiết của câu.
 */
export async function moXemLai(page: Page, thuTu: number, khoi: readonly string[]): Promise<Locator> {
  const muc = page
    .locator('[aria-labelledby="xem-lai"] ol')
    .first()
    .locator(":scope > li")
    .nth(thuTu - 1);
  await muc.waitFor();
  for (const ten of khoi)
    if (await muc.getByRole("region", { name: ten, exact: true }).count())
      throw new Error(`Xem lại câu ${thuTu}: khối "${ten}" hiện khi chi tiết đang thu gọn.`);
  const nut = muc.getByRole("button", { name: "Xem chi tiết" }).last();
  const id = await nut.getAttribute("aria-controls");
  await nut.click();
  const vung = page.locator(`[id="${id}"]`);
  for (const ten of khoi) await vung.getByRole("region", { name: ten, exact: true }).first().waitFor();
  return vung;
}

/* ------------------------------------------------------------------ */
/* 1. Cung đường biển báo                                              */
/* ------------------------------------------------------------------ */

type Doan = Extract<BuocCungDuong, { loai: "doan" }>;

async function cungDuong(n: NguCanhE2E, loiTrang: string[]) {
  const pre = `${PREFIX}cd-`;
  const ds = (await docBienBao()).filter((b): b is BienBao & { phan_ung: ThaoTacBienBao } =>
    Boolean(b.phan_ung),
  );
  n.donDep(() => n.sql`DELETE FROM traffic_signs WHERE code LIKE ${`${pre}%`}`);
  for (const b of ds) {
    await putFromFile(
      uriAnhBienBao(b.anh),
      join(import.meta.dir, "..", "..", "data", "bien-bao", "anh", b.anh),
    );
    await n.sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction, reaction_note)
      VALUES (${`${pre}${b.ma}`}, ${b.nhom}, ${b.ten}, ${b.y_nghia}, ${uriAnhBienBao(b.anh)}, ${b.can_cu},
              'da_duyet', ${b.phan_ung}, ${b.ghi_chu_phan_ung ?? null})`;
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = 'cung_duong_bien_bao'`) as any[];
  n.donDep(
    () => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = 'cung_duong_bien_bao'`,
  );
  await n.sql`UPDATE games SET enabled = true WHERE code = 'cung_duong_bien_bao'`;

  const tk = await n.taoTaiKhoan({ ten: "Cán bộ hộp kết quả E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(maDem(true));
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/tro-choi/cung-duong-bien-bao`);
  await page.getByRole("button", { name: "Chơi", exact: true }).click();
  await page.getByText("Câu 1/4").waitFor();
  const [l] = (await n.sql`
    SELECT items FROM game_runs WHERE account_id = ${tk.id} ORDER BY started_at DESC LIMIT 1`) as any[];
  const doan = (l.items as Array<{ noi_dung: BuocCungDuong }>).slice(0, 3).map((b) => b.noi_dung as Doan);

  // Câu 1: đúng.
  await page.getByRole("button", { name: doan[0]!.ten, exact: true }).click();
  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  const hop = hopKetQua(page, "Đúng");
  await hop.waitFor();
  const nutTiep = hop.getByRole("link", { name: "Câu tiếp" });
  await cho(async () => (await tieuDiem(page)) === "Câu tiếp", 'tiêu điểm ở nút "Câu tiếp"');
  await cho(async () => (await soNot(page)) > 0, "âm thanh khi hộp mở");
  const notLanDau = await soNot(page);
  if ((await khoaCuon(page)) !== "hidden") throw new Error("Hộp mở nhưng trang phía sau không khóa cuộn.");
  await kiemThuGon(hop, "Hộp câu 1 lúc mở");
  const giaiThich = `Biển ${doan[0]!.ma} "${doan[0]!.ten}"`;
  if (await page.getByText(giaiThich).isVisible())
    throw new Error("Giải thích hiện khi chưa bấm Xem chi tiết.");
  await n.kiemKhongCuonNgang(page, "Hộp kết quả");
  const { nut, vung } = await chiTiet(hop);
  await kiemCao48(nut, 'Nút "Xem chi tiết"');
  await kiemCao48(nutTiep, 'Nút "Câu tiếp"');
  await n.chupAnh(page, "1-hop-dung");

  // Dòng giờ trong hộp giảm và khớp đồng hồ đầu trang (H2, Đ4).
  const docGio = () =>
    page.evaluate(() => {
      const giay = (s: string | null | undefined) => {
        const m = /^(\d+):(\d{2})$/.exec((s ?? "").trim());
        return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
      };
      const trongHop = document.querySelector("dialog[open] [data-gio-con-lai]")?.textContent;
      const dau = [...document.querySelectorAll(".g-so")].find(
        (e) => !e.closest("dialog") && /^\d+:\d{2}$/.test(e.textContent?.trim() ?? ""),
      )?.textContent;
      return { hop: giay(trongHop), dau: giay(dau) };
    });
  const g1 = await docGio();
  if (Number.isNaN(g1.hop) || Number.isNaN(g1.dau))
    throw new Error(`Không đọc được đồng hồ: ${JSON.stringify(g1)}`);
  if (Math.abs(g1.hop - g1.dau) > 1)
    throw new Error(`Giờ trong hộp lệch đồng hồ đầu trang: ${JSON.stringify(g1)}`);
  await page.waitForTimeout(2300);
  const g2 = await docGio();
  if (!(g2.hop < g1.hop) || !(g2.dau < g1.dau))
    throw new Error(`Đồng hồ không giảm khi hộp mở: ${JSON.stringify([g1, g2])}`);

  // Mở, đóng phần chi tiết.
  await nut.click();
  if ((await nut.getAttribute("aria-expanded")) !== "true")
    throw new Error("Bấm Xem chi tiết nhưng aria-expanded chưa là true.");
  await vung.getByText(giaiThich).waitFor();
  await vung.getByRole("heading", { name: "Căn cứ pháp lý" }).waitFor();
  await kiemTrongKhung(nutTiep, 'Nút "Câu tiếp" khi mở chi tiết');
  await n.chupAnh(page, "2-chi-tiet");
  await nut.click();
  await kiemThuGon(hop, "Sau khi bấm Ẩn chi tiết");

  // Esc: đóng hộp, tiêu điểm ở "Xem lại kết quả"; mở lại: thu gọn, không phát lại âm.
  await nut.click();
  await page.keyboard.press("Escape");
  await hop.waitFor({ state: "hidden" });
  await cho(async () => (await tieuDiem(page)) === "Xem lại kết quả", 'tiêu điểm ở "Xem lại kết quả"');
  await page.getByText("Đáp án đúng").waitFor();
  await n.chupAnh(page, "3-da-dong");
  await page.getByRole("button", { name: "Xem lại kết quả" }).click();
  await hop.waitFor();
  await kiemThuGon(hop, "Hộp mở lại");
  await page.waitForTimeout(400);
  if ((await soNot(page)) !== notLanDau) throw new Error("Mở lại hộp mà phát lại âm thanh.");

  // Câu tiếp trong hộp: sang bước sau, không còn dialog, gỡ khóa cuộn.
  await nutTiep.click();
  await page.getByText("Câu 2/4").waitFor();
  if (await page.locator("dialog[open]").count()) throw new Error("Sang bước sau mà vẫn còn hộp mở.");
  await cho(async () => (await khoaCuon(page)) !== "hidden", "gỡ khóa cuộn sau khi sang bước");

  // Câu 2: sai; bảng chơi vẫn tô đáp án; chi tiết thu gọn (H9).
  const sai = doan[1]!.phuong_an.find((p) => p.ten !== doan[1]!.ten)!;
  await page.getByRole("button", { name: sai.ten, exact: true }).click();
  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  const hopSai = hopKetQua(page, "Chưa đúng");
  await hopSai.waitFor();
  await page.getByText("Đáp án đúng").waitFor();
  await kiemThuGon(hopSai, "Hộp câu 2");
  await n.kiemKhongCuonNgang(page, "Hộp chưa đúng");
  await n.chupAnh(page, "4-hop-chua-dung");
  await hopSai.getByRole("link", { name: "Câu tiếp" }).click();
  await page.getByText("Câu 3/4").waitFor();
}

/* ------------------------------------------------------------------ */
/* 2–3. Vượt màn, giảm chuyển động                                     */
/* ------------------------------------------------------------------ */

async function taoChuDeVuotMan(n: NguCanhE2E) {
  const duoi = crypto.randomUUID().slice(0, 8);
  const chuDe = await luuChuDeCauHoi({ code: `${PREFIX}vm-${duoi}`, name: `Hộp kết quả E2E ${duoi}` });
  n.donDep(() => n.sql`DELETE FROM question_topics WHERE id = ${chuDe.id}`);
  n.donDep(() => n.sql`DELETE FROM questions WHERE created_by = ${`${PREFIX}vm`} AND topic_id = ${chuDe.id}`);
  const dai = Array.from(
    { length: 30 },
    (_, i) => `Ý ${i + 1} của lời giải thích dài: người chơi đọc kỹ quy định trước khi chọn phương án.`,
  ).join(" ");
  const cau = (i: number): TaoCauHoiInput => ({
    topicId: chuDe.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: "mot_dap_an",
    stem: `Câu hộp kết quả E2E số ${i + 1}?`,
    options: {
      phuong_an: [
        { id: "a", text: DUNG },
        { id: "b", text: "Phương án sai" },
      ],
    },
    answer: { dung: ["a"] },
    explanation: `Mở đầu giải thích. ${dai}`,
    citations: [CAN_CU],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 10 }, (_, i) => cau(i)),
    `${PREFIX}vm`,
  );
  return chuDe.id;
}

async function moManMot(n: NguCanhE2E, page: Page, chuDeId: string) {
  await page.goto(`${n.web}/tro-choi/vuot-man/${chuDeId}`);
  await Promise.all([
    page.waitForURL(/\/luyen-tap\/[0-9a-f-]{36}\?cau=1/),
    page.getByRole("button", { name: /^Chơi màn 1/ }).click(),
  ]);
}

async function kiemTra(page: Page, dung: boolean) {
  await page.getByRole("button", { name: dung ? DUNG : "Phương án sai" }).click();
  await page.getByRole("button", { name: "Kiểm tra" }).click();
}

async function vuotMan(n: NguCanhE2E, chuDeId: string, loiTrang: string[]) {
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ Vượt màn hộp E2E" });
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(maDem(true));
  await n.dangNhap(page, tk);
  await moManMot(n, page, chuDeId);

  // Câu 1 đúng: hộp "Đúng", không có dòng đáp án, không có khối phản hồi cũ.
  await kiemTra(page, true);
  const hop = hopKetQua(page, "Đúng");
  await hop.waitFor();
  if (await hop.getByText(/^Đáp án:/).count()) throw new Error("Câu đúng mà hộp có dòng đáp án.");
  if (
    await page
      .locator("[role=status]")
      .filter({ hasText: /Đúng\.|Chưa đúng\./ })
      .count()
  )
    throw new Error("Câu Vượt màn vẫn hiện khối phản hồi cũ.");
  await cho(async () => (await tieuDiem(page)) === "Câu tiếp", 'tiêu điểm ở "Câu tiếp" (Vượt màn)');
  await hop.getByRole("link", { name: "Câu tiếp" }).click();
  await page.waitForURL(/\?cau=2$/);

  // Câu 2 sai: "Chưa đúng", dòng đáp án, chi tiết dài cuộn trong hộp.
  await kiemTra(page, false);
  const hopSai = hopKetQua(page, "Chưa đúng");
  await hopSai.waitFor();
  await hopSai.getByText(`Đáp án: ${DUNG}`).waitFor();
  await kiemThuGon(hopSai, "Hộp Vượt màn câu 2");
  const { nut, vung } = await chiTiet(hopSai);
  await nut.click();
  await vung.getByText("Mở đầu giải thích.", { exact: false }).waitFor();
  const cuon = await vung.evaluate((el) => ({ h: el.scrollHeight, c: el.clientHeight }));
  if (!(cuon.h > cuon.c))
    throw new Error(`Giải thích dài nhưng vùng chi tiết không cuộn: ${JSON.stringify(cuon)}.`);
  const nutTiep = hopSai.getByRole("link", { name: "Câu tiếp" });
  await kiemTrongKhung(nutTiep, 'Nút "Câu tiếp" khi chi tiết dài');
  await kiemCao48(nutTiep, 'Nút "Câu tiếp" (Vượt màn)');
  await n.kiemKhongCuonNgang(page, "Hộp Vượt màn, chi tiết dài");
  await n.chupAnh(page, "5-vuot-man-chi-tiet-dai");

  // Căn cứ mở rộng tại chỗ, không mở ngăn kéo (H8).
  const canCu = vung.getByRole("button", { expanded: false }).first();
  await canCu.scrollIntoViewIfNeeded();
  await canCu.click();
  await cho(
    async () =>
      !(await vung.getByText("Đang tải điều khoản.").count()) &&
      (await vung.getByRole("link", { name: "Mở trong trang đọc văn bản" }).count()) > 0,
    "tải nguyên văn căn cứ",
  );
  if (
    (await page.locator("dialog[open]").count()) !== 1 ||
    (await page.getByRole("dialog", { name: "Căn cứ pháp lý" }).count())
  )
    throw new Error("Mở căn cứ mà có thêm hộp hoặc ngăn kéo.");

  // Tải lại trang: hộp không tự mở, không phát âm; "Xem lại kết quả" mở lại hộp.
  await page.reload();
  await page.getByRole("button", { name: "Xem lại kết quả" }).waitFor();
  if (await page.locator("dialog[open]").count()) throw new Error("Tải lại trang mà hộp tự mở.");
  await page.getByRole("button", { name: "Xem lại kết quả" }).click();
  await hopSai.waitFor();
  await kiemThuGon(hopSai, "Hộp mở lại sau khi tải trang");
  await page.waitForTimeout(400);
  if (await soNot(page)) throw new Error("Mở lại kết quả sau khi tải trang mà phát âm thanh.");
  await hopSai.getByRole("link", { name: "Câu tiếp" }).click();
  await page.waitForURL(/\?cau=3$/);
}

async function giamHieuUng(n: NguCanhE2E, chuDeId: string, loiTrang: string[]) {
  for (const cach of ["he-dieu-hanh", "cong-tac"] as const) {
    const tk = await n.taoTaiKhoan({ ten: `Cán bộ giảm hiệu ứng ${cach} E2E` });
    const page = await n.moTrang();
    page.on("pageerror", (e) => loiTrang.push(e.message));
    await page.addInitScript(maDem(false, cach === "cong-tac"));
    if (cach === "he-dieu-hanh") await page.emulateMedia({ reducedMotion: "reduce" });
    await n.dangNhap(page, tk);
    await moManMot(n, page, chuDeId);
    await kiemTra(page, true);
    const hop = hopKetQua(page, "Đúng");
    await hop.waitFor();
    await kiemKhongHieuUng(
      hop,
      cach === "he-dieu-hanh" ? "Giảm chuyển động (hệ điều hành)" : 'Công tắc "Giảm hiệu ứng"',
      cach === "he-dieu-hanh",
    );
    await hop.getByRole("link", { name: "Câu tiếp" }).click();
    await page.waitForURL(/\?cau=2$/);
  }
}

/* ------------------------------------------------------------------ */
/* 4. Lập biên bản: trò không có đồng hồ                               */
/* ------------------------------------------------------------------ */

async function lapBienBan(n: NguCanhE2E, loiTrang: string[]) {
  await chuanBiLapBienBan(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ biên bản hộp E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  const buoc = await vaoLapBienBan(n, page, tk.id);

  await dienVaKy(page, buoc[0]!);
  const hop = hopKetQua(page);
  await hop.waitFor();
  if (await hop.locator("[data-gio-con-lai]").count())
    throw new Error("Trò không có đồng hồ mà hộp có dòng giờ.");
  await page.locator(".lbb-dau").getByText("ĐẠT", { exact: true }).waitFor();
  await n.chupAnh(page, "6-lap-bien-ban");
  await hop.getByRole("link", { name: "Câu tiếp" }).click();
  await page.getByText("Câu 2/3").waitFor();

  await dienVaKy(page, buoc[1]!, -1);
  await hop.waitFor();
  const ten = await hop
    .getAttribute("aria-labelledby")
    .then((id) => page.locator(`[id="${id}"]`).innerText());
  if (ten.trim() === "Đúng") throw new Error("Biên bản sai tiền mà hộp ghi Đúng.");
  await page.locator(".lbb-dau").getByText("CHƯA ĐẠT", { exact: true }).waitFor();
  console.log(`  Lập biên bản sai tiền: hộp "${ten.trim()}".`);
}

export default async function hopKetQuaE2E(n: NguCanhE2E) {
  const loiTrang: string[] = [];
  await cungDuong(n, loiTrang);
  const chuDe = await taoChuDeVuotMan(n);
  await vuotMan(n, chuDe, loiTrang);
  await giamHieuUng(n, chuDe, loiTrang);
  await lapBienBan(n, loiTrang);
  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
