/**
 * Kịch bản E2E trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của 4 dòng mức phạt cải tạo (data/tra-cuu/muc-phat.json), danh mục biến thể
 * (data/tro-choi/bien-the-cai-tao.json) và 16 xe mẫu (data/tro-choi/xe-cai-tao.json), DUYỆT ngay trong kịch
 * bản. Dữ liệu thật không bị đụng.
 *
 * Kiểm:
 *  - trang Trò chơi có 5 màn, chỉ màn 1 mở; màn hướng dẫn hiện ở lượt đầu;
 *  - màn 1: khoanh bằng KÉO KHUNG (đèn nóc) và bằng CHẠM (màu sơn: chạm giữa thân xe), nối dòng giấy bằng chạm;
 *    cố ý đóng sai dấu ở xe thứ 3; xe không đạt có biên bản; thước đo dời được bằng phím mũi tên;
 *  - các chỗ khác giấy và biên bản không nằm trên trang mà trong "Xem chi tiết" của hộp kết quả, đủ số
 *    chỗ và số dòng căn cứ như máy chủ trả (GĐ17c); đóng hộp thì hình vẫn tô vùng đáp án; màn "Xem lại
 *    từng câu" cũng có đủ;
 *  - màn 2 ở chế độ giảm chuyển động, bằng BÀN PHÍM: nút "Thêm khung", phím mũi tên dời, Shift + mũi tên đổi
 *    cỡ, Enter trên dòng giấy; không hiện lại hướng dẫn;
 *  - không cuộn ngang, không lỗi JavaScript.
 */

import {
  type BuocSoiXe,
  type ChiTietSoiXe,
  type DongMucPhat,
  type Hop,
  TRO_CHOI_SOI_XE_CAI_TAO,
} from "@qdpl/dao-tao";
import {
  type BienTheCaiTaoTep,
  chuyenTrangThaiNoiDung,
  napSoiXeCaiTao,
  napTraCuuNhanh,
  type XeCaiTaoTep,
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

const PREFIX = `${TIEN_TO}sx-`;
const MA = "soi_xe_cai_tao";
const TEN_GOC = { nghieng: "nhìn nghiêng", sau: "nhìn sau" } as const;
const TEN_DONG: Record<string, string> = {
  kich_thuoc_bao: "Kích thước bao",
  kich_thuoc_thung: "Kích thước lòng thùng",
  co_lop: "Cỡ lốp",
  so_cho: "Số người cho phép chở",
  mau_son: "Màu sơn",
  den: "Đèn chiếu sáng, tín hiệu",
};

async function chuanBi(n: NguCanhE2E) {
  const mp = ((await Bun.file("data/tra-cuu/muc-phat.json").json()) as { dong: DongMucPhat[] }).dong
    .filter((d) => d.ma.startsWith("oto-cai-tao-"))
    .map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" as const }));
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  const danhMuc = (
    (await Bun.file("data/tro-choi/bien-the-cai-tao.json").json()) as { bien_the: BienTheCaiTaoTep[] }
  ).bien_the.map((b) => ({ ...b, ma_muc_phat: b.ma_muc_phat ? `${PREFIX}${b.ma_muc_phat}` : null }));
  const xe = ((await Bun.file("data/tro-choi/xe-cai-tao.json").json()) as { xe: XeCaiTaoTep[] }).xe;
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napSoiXeCaiTao({ tienToTen: PREFIX, danhMuc, xe });
  if (tao.daTao !== 23) throw new Error(`Cần tạo 7 biến thể và 16 xe, tạo được ${tao.daTao}.`);
  const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
  for (const r of ids) {
    const kq = await chuyenTrangThaiNoiDung({
      id: r.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: `${PREFIX}duyet`,
    });
    if (!kq?.ok) throw new Error(`Không duyệt được ${r.id}: ${JSON.stringify(kq)}`);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
}

/** Khung đích của một chỗ sai (đơn vị hình): vùng đáp án; màu sơn thì khung nhỏ giữa phần sơn. */
function dich(b: BuocSoiXe, j: number): { goc: "nghieng" | "sau"; hop: Hop } {
  const c = b.cho_sai[j]!;
  if (c.bien_doi !== "doi_mau_son") return c.vung[0]!;
  const t = b.than.nghieng;
  const cx = (t[0] + t[2]) / 2;
  const cy = (t[1] + t[3]) / 2;
  return { goc: "nghieng", hop: [cx - 15, cy - 10, cx + 15, cy + 10] };
}

async function lopPhu(page: Page, goc: "nghieng" | "sau") {
  const o = page.getByRole("application", { name: new RegExp(`^Hình ${TEN_GOC[goc]}`) });
  const box = (await o.boundingBox())!;
  const rong = await o.evaluate((el) =>
    Number(el.parentElement!.querySelector("svg")!.getAttribute("viewBox")!.split(" ")[2]),
  );
  return { box, s: box.width / rong };
}

/** Khoanh bằng chuột (kéo khung) hoặc bằng chạm nhẹ vào giữa đích. */
async function khoanhChuot(page: Page, goc: "nghieng" | "sau", h: Hop, cach: "keo" | "cham") {
  const { box, s } = await lopPhu(page, goc);
  const px = (x: number, y: number): [number, number] => [box.x + x * s, box.y + y * s];
  if (cach === "cham") {
    await page.mouse.click(...px((h[0] + h[2]) / 2, (h[1] + h[3]) / 2));
    return;
  }
  await page.mouse.move(...px(h[0], h[1]));
  await page.mouse.down();
  await page.mouse.move(...px((h[0] + h[2]) / 2, (h[1] + h[3]) / 2), { steps: 4 });
  await page.mouse.move(...px(h[2], h[3]), { steps: 4 });
  await page.mouse.up();
}

/** Khoanh bằng bàn phím: "Thêm khung" (khung 40×30 giữa hình), Shift + mũi tên đổi cỡ, mũi tên dời. */
async function khoanhPhim(page: Page, goc: "nghieng" | "sau", h: Hop) {
  const vung = page.getByRole("region", { name: `Hình ${TEN_GOC[goc]}` });
  await vung.getByRole("button", { name: "Thêm khung" }).focus();
  await page.keyboard.press("Enter");
  const [rong, cao] = await vung
    .locator("svg")
    .first()
    .evaluate((el) => el.getAttribute("viewBox")!.split(" ").slice(2).map(Number));
  const x0 = Math.round(rong! / 2 - 20);
  const y0 = Math.round(cao! / 2 - 15);
  await page.getByRole("button", { name: "Dời trái" }).focus();
  const bam = async (phim: string, lan: number) => {
    for (let i = 0; i < Math.abs(lan); i++) await page.keyboard.press(phim);
  };
  const dw = Math.round((h[2] - h[0] - 40) / 5);
  const dh = Math.round((h[3] - h[1] - 30) / 5);
  await bam(dw >= 0 ? "Shift+ArrowRight" : "Shift+ArrowLeft", dw);
  await bam(dh >= 0 ? "Shift+ArrowDown" : "Shift+ArrowUp", dh);
  const dx = Math.round((h[0] - x0) / 5);
  const dy = Math.round((h[1] - y0) / 5);
  await bam(dx >= 0 ? "ArrowRight" : "ArrowLeft", dx);
  await bam(dy >= 0 ? "ArrowDown" : "ArrowUp", dy);
}

async function xuLy(page: Page, b: BuocSoiXe, dung: boolean, cach: "chuot" | "phim") {
  for (const [j, c] of b.cho_sai.entries()) {
    const d = dich(b, j);
    if (cach === "phim") await khoanhPhim(page, d.goc, d.hop);
    else await khoanhChuot(page, d.goc, d.hop, c.bien_doi === "doi_mau_son" ? "cham" : "keo");
    await page.getByText(new RegExp(`^Khung ${j + 1} · `)).waitFor();
    const dong = page.getByRole("button", { name: new RegExp(`^${TEN_DONG[c.dong]}`) });
    if (cach === "phim") {
      await dong.focus();
      await page.keyboard.press("Enter");
    } else await dong.click();
    await page.getByText(new RegExp(`^Khung ${j + 1} · .* · ${TEN_DONG[c.dong]}`)).waitFor();
  }
  const dau = (dung ? b.dau : b.dau === "dat" ? "khong_dat" : "dat") === "dat" ? "Đạt" : "Không đạt";
  const nut = page.getByRole("button", { name: dau, exact: true });
  if (cach === "phim") {
    await nut.focus();
    await page.keyboard.press("Enter");
  } else await nut.click();
  await hopKetQua(page).waitFor();
}

/**
 * Phần "Xem chi tiết" (GĐ17c) của xe `thuTu`: các chỗ khác giấy và biên bản chỉ hiện sau khi mở; đủ số
 * chỗ và số dòng căn cứ như `chi_tiet` máy chủ trả. `xemLai`: mở ở màn "Xem lại từng câu".
 */
async function kiemChiTiet(
  n: NguCanhE2E,
  page: Page,
  tkId: string,
  thuTu: number,
  noi: string,
  xemLai = false,
) {
  const ct = await chiTietDaCham<ChiTietSoiXe>(n, TRO_CHOI_SOI_XE_CAI_TAO, tkId, thuTu);
  const bienBan = ct.dau_dung === "khong_dat" && ct.bien_ban.length > 0;
  const khoi = [
    ...(ct.cho_sai.length ? ["Các chỗ khác giấy"] : []),
    ...(bienBan ? ["Biên bản (mô phỏng)"] : []),
  ];
  const vung: Locator = xemLai ? await moXemLai(page, thuTu, khoi) : await moChiTietRieng(page, khoi, noi);
  const so = await vung.locator('section[aria-label="Các chỗ khác giấy"] li').count();
  if (so !== ct.cho_sai.length) throw new Error(`${noi}: chi tiết có ${so} chỗ, cần ${ct.cho_sai.length}.`);
  const canCu = ct.cho_sai.length + (bienBan ? ct.bien_ban.filter((d) => d.can_cu.length).length : 0);
  const co = await demCanCu(vung);
  if (co !== canCu) throw new Error(`${noi}: chi tiết có ${co} dòng căn cứ, cần ${canCu}.`);
}

async function choiLuot(
  n: NguCanhE2E,
  page: Page,
  taiKhoan: string,
  man: number,
  cach: "chuot" | "phim",
  sai: number | null,
) {
  const [luot] = (await n.sql`
    SELECT items, level FROM game_runs WHERE account_id = ${taiKhoan} AND game_code = ${MA}
    ORDER BY started_at DESC LIMIT 1`) as any[];
  if (luot.level !== man) throw new Error(`Lượt ở màn ${luot.level}, cần màn ${man}.`);
  const buoc = (luot.items as Array<{ noi_dung: BuocSoiXe }>).map((b) => b.noi_dung);
  const so = buoc.length;
  for (let i = 1; i <= so; i++) {
    await page.getByText(`Xe ${i}/${so}`).waitFor();
    if (i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, xe 1`);
      await n.chupAnh(page, `man${man}-1-xe`);
    }
    if (i === 1 && man === 1) {
      // Thước đo bằng bàn phím: dời đầu thước 2 sang phải 10 đơn vị (100 mm).
      const vung = page.getByRole("region", { name: "Hình nhìn nghiêng" });
      await vung.getByRole("button", { name: "Thước đo" }).click();
      const dauThuoc = page.getByRole("button", { name: /^Đầu thước 2: đang đo/ });
      const truoc = Number((await dauThuoc.getAttribute("aria-label"))!.match(/đo (\d+) mm/)![1]);
      await dauThuoc.focus();
      await page.keyboard.press("Shift+ArrowRight");
      const sau = Number((await dauThuoc.getAttribute("aria-label"))!.match(/đo (\d+) mm/)![1]);
      if (sau - truoc !== 100) throw new Error(`Thước đo đổi ${sau - truoc} mm, cần 100 mm.`);
      await n.chupAnh(page, "man1-thuoc-do");
      await vung.getByRole("button", { name: "Thước đo" }).click();
    }
    await xuLy(page, buoc[i - 1]!, i !== sai, cach);
    await kiemChiTiet(n, page, taiKhoan, i, `Màn ${man}, xe ${i}`);
    if (i === sai && buoc[i - 1]!.cho_sai.length)
      await dongHopXemBang(page, page.locator('rect[stroke-dasharray="4 3"]'), `Màn ${man}, xe ${i}`);
    if (i === 1 || i === sai) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, kết quả xe ${i}`);
      await n.chupAnh(page, `man${man}-2-ket-qua-xe-${i}`);
    }
    await page
      .getByRole(i < so ? "link" : "button", { name: i < so ? "Xe tiếp theo" : "Xem kết quả" })
      .click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText(`Đúng ${sai ? so - 1 : so}/${so}`).waitFor();
  if (sai) await kiemChiTiet(n, page, taiKhoan, sai, `Màn ${man}, xem lại xe ${sai}`, true);
}

export default async function soiXeCaiTao(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ soi xe cải tạo E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Soi xe cải tạo", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Soi xe cải tạo" });
  await the.getByRole("button", { name: /Màn 1: Chỗ sai rõ/ }).waitFor();
  if (!(await the.getByRole("button", { name: /Màn 2: Có xe đạt/ }).isDisabled()))
    throw new Error("Màn 2 mở khi chưa qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Danh sách màn");

  await the.getByRole("button", { name: /Màn 1: Chỗ sai rõ/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Soi xe cải tạo" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await choiLuot(n, page, tk.id, 1, "chuot", 3);
  await n.chupAnh(page, "3-tong-ket-man-1");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Xe 1/8").waitFor();
  if (await page.getByRole("dialog", { name: "Soi xe cải tạo" }).count())
    throw new Error("Hướng dẫn hiện lại ở lượt thứ hai.");
  const tenHoatAnh = await page
    .locator(".gt-vao")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  if (tenHoatAnh !== "g-hien") throw new Error(`Giảm chuyển động mà xe vẫn chạy hoạt ảnh ${tenHoatAnh}.`);
  await choiLuot(n, page, tk.id, 2, "phim", null);
  await n.chupAnh(page, "4-tong-ket-man-2");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
