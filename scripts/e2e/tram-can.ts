/**
 * Kịch bản E2E trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của giới hạn tải trọng (data/tra-cuu/tai-trong.json), các dòng mức phạt có
 * khung phần trăm quá tải (data/tra-cuu/muc-phat.json) và 30 xe mẫu (data/tro-choi/tram-can.json), DUYỆT
 * ngay trong kịch bản. Dữ liệu thật không bị đụng.
 *
 * Kiểm:
 *  - trang Trò chơi có 5 màn, chỉ màn 1 mở; màn hướng dẫn hiện ở lượt đầu;
 *  - các dấu khóa khi chưa ghim cặp số; ghim bằng CHẠM, hiện hiệu số kg; ước bằng nút +;
 *  - chơi trọn màn 1 (cố ý đóng sai dấu ở xe thứ 3), xe lập biên bản có biên bản;
 *  - các cặp số và biên bản không nằm trên trang mà trong "Xem chi tiết" của hộp kết quả, đủ số cặp và
 *    số dòng căn cứ như máy chủ trả (GĐ17c); đóng hộp thì giấy tờ vẫn tô cặp quyết định; màn "Xem lại
 *    từng câu" cũng có đủ;
 *  - màn 2 ở chế độ giảm chuyển động: ghim bằng BÀN PHÍM (Tab tới dòng, Enter), thanh trượt bằng phím
 *    mũi tên; không chạy hoạt ảnh trượt; không hiện lại hướng dẫn;
 *  - không cuộn ngang, không lỗi JavaScript.
 */

import {
  type BuocTramCan,
  type ChiTietTramCan,
  type DauTramCan,
  type DongMucPhat,
  type DongTaiTrongTep,
  TRO_CHOI_TRAM_CAN,
} from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  napTaiTrong,
  napTraCuuNhanh,
  napXeTramCan,
  type XeTramCanTep,
} from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import {
  chiTietDaCham,
  demCanCu,
  dongHopXemBang,
  hopKetQua,
  moChiTietRieng,
  moXemLai,
} from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}tc-`;
const MA = "tram_can";
const TEN_DAU: Record<DauTramCan, string> = {
  cho_di: "Cho đi",
  ha_tai: "Hạ tải",
  lap_bien_ban: "Lập biên bản",
};
/** Tên các số chạm được ở màn 1–2 (nhãn dòng trên thẻ). */
const TEN_SO: Record<string, string> = {
  "phieu.tong": "Tổng trọng lượng",
  "phieu.hang": "Khối lượng hàng",
  "kd.toan_bo": "Khối lượng toàn bộ cho phép",
  "kd.hang": "Khối lượng hàng chuyên chở cho phép",
};

async function chuanBi(n: NguCanhE2E) {
  const tt = ((await Bun.file("data/tra-cuu/tai-trong.json").json()) as { dong: DongTaiTrongTep[] }).dong.map(
    (d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" }),
  );
  n.donDep(() => n.sql`DELETE FROM load_limits WHERE code LIKE ${`${PREFIX}%`}`);
  await napTaiTrong(tt, { tienTo: PREFIX, cheDo: "theo_tep" });
  const mp = ((await Bun.file("data/tra-cuu/muc-phat.json").json()) as { dong: DongMucPhat[] }).dong
    .filter((d) => d.qua_tai)
    .map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" as const }));
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  const xe = ((await Bun.file("data/tro-choi/tram-can.json").json()) as { xe: XeTramCanTep[] }).xe;
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napXeTramCan({ tienToTen: PREFIX, xe });
  if (tao.daTao !== 30) throw new Error(`Cần tạo 30 xe, tạo được ${tao.daTao}.`);
  const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
  for (const r of ids) {
    const kq = await chuyenTrangThaiNoiDung({
      id: r.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: `${PREFIX}duyet`,
    });
    if (!kq?.ok) throw new Error(`Không duyệt được xe ${r.id}: ${JSON.stringify(kq)}`);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
}

const dongSo = (page: Page, ma: string) =>
  page.getByRole("button", { name: new RegExp(`^${TEN_SO[ma]}:`) }).first();

/** Xử lý một xe: ghim cặp quyết định, ước phần trăm, đóng dấu (đúng, hoặc cố ý sai dấu). */
async function xuLy(page: Page, b: BuocTramCan, dung: boolean, cach: "cham" | "phim") {
  const q = b.cap[b.quyet]!;
  const dauDung = TEN_DAU[b.dau];
  if (!(await page.getByRole("button", { name: dauDung, exact: true }).isDisabled()))
    throw new Error("Dấu bấm được khi chưa ghim cặp số nào.");
  for (const ma of [q.phieu, q.gioi_han]) {
    if (cach === "cham") await dongSo(page, ma).click();
    else {
      await dongSo(page, ma).focus();
      await page.keyboard.press("Enter");
    }
  }
  await page
    .getByText(/Hiệu số: [+−±]/)
    .first()
    .waitFor();
  const uoc = Math.round(Math.max(0, q.phan_tram));
  if (cach === "cham") {
    const tang = page.getByRole("button", { name: "Tăng 1%" });
    for (let i = 0; i < uoc; i++) await tang.click();
  } else {
    const thanh = page.getByRole("slider", { name: "Ước phần trăm vượt" });
    await thanh.focus();
    for (let i = 0; i < uoc; i++) await page.keyboard.press("ArrowRight");
  }
  await page
    .locator("output")
    .filter({ hasText: `${uoc}%` })
    .waitFor();
  const dau = dung ? dauDung : TEN_DAU[b.dau === "cho_di" ? "lap_bien_ban" : "cho_di"];
  await page.getByRole("button", { name: dau, exact: true }).click();
  await hopKetQua(page).waitFor();
}

const CAC_CAP = "Các cặp số";
const BIEN_BAN = "Biên bản (mô phỏng)";
const khoiChiTiet = (b: BuocTramCan) => [CAC_CAP, ...(b.dau === "lap_bien_ban" ? [BIEN_BAN] : [])];

/** Phần "Xem chi tiết" (GĐ17c): đủ số cặp số và số dòng căn cứ như `chi_tiet` máy chủ trả. */
async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, thuTu: number, noi: string) {
  const ct = await chiTietDaCham<ChiTietTramCan>(n, TRO_CHOI_TRAM_CAN, tkId, thuTu);
  const so = await vung.locator(`section[aria-label="${CAC_CAP}"] li`).count();
  if (so !== ct.cac_cap.length)
    throw new Error(`${noi}: chi tiết có ${so} cặp số, cần ${ct.cac_cap.length}.`);
  const canCu = ct.dau_dung === "lap_bien_ban" ? ct.bien_ban.filter((d) => d.can_cu.length).length : 0;
  const co = await demCanCu(vung);
  if (co !== canCu) throw new Error(`${noi}: chi tiết có ${co} dòng căn cứ, cần ${canCu}.`);
}

async function choiLuot(n: NguCanhE2E, page: Page, taiKhoan: string, man: number, cach: "cham" | "phim") {
  const [luot] = (await n.sql`
    SELECT items, level FROM game_runs WHERE account_id = ${taiKhoan} AND game_code = ${MA}
    ORDER BY started_at DESC LIMIT 1`) as any[];
  if (luot.level !== man) throw new Error(`Lượt ở màn ${luot.level}, cần màn ${man}.`);
  const buoc = (luot.items as Array<{ noi_dung: BuocTramCan }>).map((b) => b.noi_dung);
  const so = buoc.length;
  for (let i = 1; i <= so; i++) {
    await page.getByText(`Xe ${i}/${so}`).waitFor();
    if (i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, xe 1`);
      await n.chupAnh(page, `man${man}-1-xe`);
    }
    const b = buoc[i - 1]!;
    await xuLy(page, b, i !== 3, cach);
    const noi = `Màn ${man}, xe ${i}`;
    await kiemChiTiet(n, await moChiTietRieng(page, khoiChiTiet(b), noi), taiKhoan, i, noi);
    if (i === 3) await dongHopXemBang(page, page.locator("[data-ket-qua]"), noi);
    if (i === 3 || i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, kết quả xe ${i}`);
      await n.chupAnh(page, `man${man}-2-ket-qua-xe-${i}`);
    }
    await page
      .getByRole(i < so ? "link" : "button", { name: i < so ? "Xe tiếp theo" : "Xem kết quả" })
      .click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText(`Đúng ${so - 1}/${so}`).waitFor();
  const vung = await moXemLai(page, 3, khoiChiTiet(buoc[2]!));
  await kiemChiTiet(n, vung, taiKhoan, 3, `Màn ${man}, xem lại xe 3`);
}

export default async function tramCan(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ trạm cân E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Trạm cân tải trọng", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Trạm cân tải trọng" });
  await the.getByRole("button", { name: /Màn 1: Tổng trọng lượng/ }).waitFor();
  if (!(await the.getByRole("button", { name: /Màn 2: Hàng chuyên chở/ }).isDisabled()))
    throw new Error("Màn 2 mở khi chưa qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Danh sách màn");

  await the.getByRole("button", { name: /Màn 1: Tổng trọng lượng/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Trạm cân tải trọng" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await choiLuot(n, page, tk.id, 1, "cham");
  await n.chupAnh(page, "3-tong-ket-man-1");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Xe 1/6").waitFor();
  if (await page.getByRole("dialog", { name: "Trạm cân tải trọng" }).count())
    throw new Error("Hướng dẫn hiện lại ở lượt thứ hai.");
  const tenHoatAnh = await page
    .locator(".gt-vao")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  if (tenHoatAnh !== "g-hien") throw new Error(`Giảm chuyển động mà xe vẫn chạy hoạt ảnh ${tenHoatAnh}.`);
  await choiLuot(n, page, tk.id, 2, "phim");
  await n.chupAnh(page, "4-tong-ket-man-2");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
