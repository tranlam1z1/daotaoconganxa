/**
 * Kịch bản E2E trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của luật giấy tờ (data/tra-cuu/luat-giay-to.json) và 30 hồ sơ mẫu
 * (data/tro-choi/kiem-tra-giay-to.json), được DUYỆT ngay trong kịch bản. Dữ liệu thật không bị đụng.
 *
 * Kiểm:
 *  - trang Trò chơi có danh sách màn, chỉ màn 1 mở; vào màn 1 một chạm; màn hướng dẫn hiện ở lượt đầu;
 *  - soi giấy tờ phóng to, đánh dấu chi tiết sai, đóng dấu; nút "Giữ lại" khóa khi chưa đánh dấu;
 *  - chơi trọn 8 người lái (cố ý sai người thứ 3); danh sách lỗi và biên bản không nằm trên trang mà
 *    trong "Xem chi tiết" của hộp kết quả, đủ số lỗi và số dòng căn cứ (GĐ17c); đóng hộp thì giấy tờ
 *    vẫn tô chỗ sai; màn "Xem lại từng câu" cũng có đủ;
 *  - tổng kết có XP, đúng một dòng XP, tiến độ màn 1 được ghi, có nút "Chơi màn 2";
 *  - màn 2 chơi trọn ở chế độ giảm chuyển động: có đồng hồ cả ca dạng phút:giây, không có hoạt ảnh
 *    trượt hay đập dấu (chỉ còn hiện dần), không hiện lại hướng dẫn;
 *  - không cuộn ngang, không lỗi JavaScript.
 */

import { type BuocGiayTo, type DauHieu, type LoaiGiayTo, TEN_DAU_HIEU, TEN_GIAY_TO } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, type DongLuatGiayToTep, napLuatGiayTo } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { napHoSoGiayTo } from "../../packages/db/src/seed-tro-choi.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { demCanCu, dongHopXemBang, hopKetQua, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}ktgt-`;
const MA = "kiem_tra_giay_to";
const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function chuanBi(n: NguCanhE2E) {
  const luat = (
    (await Bun.file("data/tra-cuu/luat-giay-to.json").json()) as { dong: DongLuatGiayToTep[] }
  ).dong.map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" }));
  n.donDep(() => n.sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`);
  await napLuatGiayTo(luat, { tienTo: PREFIX, cheDo: "theo_tep" });
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napHoSoGiayTo({ tienToTen: PREFIX });
  if (tao.daTao !== 30) throw new Error(`Cần tạo 30 hồ sơ, tạo được ${tao.daTao}.`);
  const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
  for (const r of ids) {
    const kq = await chuyenTrangThaiNoiDung({
      id: r.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: `${PREFIX}duyet`,
    });
    if (!kq?.ok) throw new Error(`Không duyệt được hồ sơ ${r.id}: ${JSON.stringify(kq)}`);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
}

/** Chạm một chi tiết: trên xe, lời người lái, giấy thiếu, hoặc một dòng trong giấy tờ phóng to. */
async function danhDau(page: Page, d: DauHieu) {
  const [nhom] = d.split(".") as [string];
  if (nhom === "thieu") {
    await page
      .getByRole("button", { name: /Đánh dấu: không có giấy này/ })
      .first()
      .click();
    return;
  }
  if (nhom === "xe" || nhom === "nguoi_lai") {
    await page.getByRole("button", { name: new RegExp(`^${thoat(TEN_DAU_HIEU[d])}`) }).click();
    return;
  }
  const loai = nhom as LoaiGiayTo;
  await page.getByRole("button", { name: `${TEN_GIAY_TO[loai]}. Chạm để phóng to và soi chi tiết.` }).click();
  const hop = page.getByRole("dialog");
  await hop.getByRole("button", { name: new RegExp(`^${thoat(TEN_DAU_HIEU[d])}:`) }).click();
  await hop.getByRole("button", { name: "Xong" }).click();
  await hop.waitFor({ state: "detached" });
}

/** Xử lý một người lái: đúng (đánh dấu đủ lỗi rồi đóng dấu đúng) hoặc cố ý sai. */
async function xuLy(page: Page, b: BuocGiayTo, dung: boolean, chupPhongTo?: () => Promise<void>) {
  if (chupPhongTo) {
    const loai = b.giay_to_hien.find((g) => b.ho_so.giay_to[g]) ?? "gplx";
    await page
      .getByRole("button", { name: `${TEN_GIAY_TO[loai]}. Chạm để phóng to và soi chi tiết.` })
      .click();
    await page.getByRole("dialog").waitFor();
    await chupPhongTo();
    await page.getByRole("dialog").getByRole("button", { name: "Xong" }).click();
  }
  const giuLai = page.getByRole("button", { name: "Giữ lại", exact: true });
  if (!(await giuLai.isDisabled())) throw new Error("Nút Giữ lại bấm được khi chưa đánh dấu chi tiết nào.");
  const coLoi = b.loi.length > 0;
  if (coLoi === dung) {
    for (const l of b.loi) await danhDau(page, l.dau_hieu[0]!);
    if (!coLoi) await danhDau(page, "gplx.so"); // cố ý giữ nhầm người hợp lệ
    await giuLai.click();
  } else {
    await page.getByRole("button", { name: "Cho qua", exact: true }).click();
  }
  await hopKetQua(page).waitFor();
}

/**
 * Chi tiết riêng của một người lái (GĐ17c): khối lỗi (khi hồ sơ có lỗi, hoặc người chơi đánh dấu nhầm)
 * và biên bản chỉ hiện sau "Xem chi tiết"; đủ số lỗi và số dòng "Căn cứ: …" của hồ sơ.
 */
function khoiChiTiet(b: BuocGiayTo, coNham: boolean): string[] {
  return [
    ...(b.loi.length || coNham ? ["Lỗi của người lái này"] : []),
    ...(b.bien_ban.length ? ["Biên bản (mô phỏng)"] : []),
  ];
}

async function kiemChiTiet(vung: Locator, b: BuocGiayTo, noi: string) {
  const luat = new Map(b.luat.map((l) => [l.ma, l]));
  const soCanCu =
    b.loi.filter((l) => luat.get(l.luat_ma)?.can_cu).length +
    b.bien_ban.filter((d) => d.can_cu.length).length;
  const soLoi = await vung.locator('section[aria-label="Lỗi của người lái này"] > ul > li').count();
  if (soLoi !== b.loi.length) throw new Error(`${noi}: chi tiết có ${soLoi} lỗi, hồ sơ có ${b.loi.length}.`);
  const canCu = await demCanCu(vung);
  if (canCu !== soCanCu) throw new Error(`${noi}: chi tiết có ${canCu} dòng căn cứ, cần ${soCanCu}.`);
}

async function choiLuot(n: NguCanhE2E, page: Page, taiKhoan: string, man: number, chup: boolean) {
  const [luot] = (await n.sql`
    SELECT id, items, level FROM game_runs WHERE account_id = ${taiKhoan} AND game_code = ${MA}
    ORDER BY started_at DESC LIMIT 1`) as any[];
  if (luot.level !== man) throw new Error(`Lượt ở màn ${luot.level}, cần màn ${man}.`);
  const buoc = (luot.items as Array<{ noi_dung: BuocGiayTo }>).map((b) => b.noi_dung);
  for (let i = 1; i <= 8; i++) {
    await page.getByText(`Người lái ${i}/8`).waitFor();
    if (chup && i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, người lái 1`);
      await n.chupAnh(page, `man${man}-1-ban-kiem-tra`);
    }
    const b = buoc[i - 1]!;
    await xuLy(page, b, i !== 3, chup && i === 1 ? () => n.chupAnh(page, `man${man}-2-phong-to`) : undefined);
    const noi = `Màn ${man}, người lái ${i}`;
    const vung = await moChiTietRieng(page, khoiChiTiet(b, i === 3 && !b.loi.length), noi);
    await kiemChiTiet(vung, b, noi);
    if (i === 3) await dongHopXemBang(page, page.locator("[data-ket-qua]"), noi);
    if (chup && i === 3) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, kết quả sai`);
      await n.chupAnh(page, `man${man}-3-ket-qua-sai`);
    }
    await page
      .getByRole(i < 8 ? "link" : "button", { name: i < 8 ? "Người lái tiếp theo" : "Xem kết quả" })
      .click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText("Đúng 7/8").waitFor();
  // Màn "Xem lại từng câu": người lái 3 (cố ý sai) có đủ chi tiết sau khi bấm "Xem chi tiết".
  const b3 = buoc[2]!;
  const vung = await moXemLai(page, 3, khoiChiTiet(b3, !b3.loi.length));
  await kiemChiTiet(vung, b3, `Màn ${man}, xem lại người lái 3`);
}

export default async function kiemTraGiayTo(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ kiểm tra giấy tờ E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Danh sách màn: chỉ màn 1 mở.
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Kiểm tra giấy tờ", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Kiểm tra giấy tờ" });
  await the.getByRole("button", { name: /Màn 1: Giấy phép lái xe/ }).waitFor();
  if (!(await the.getByRole("button", { name: /Màn 2: Đăng ký xe/ }).isDisabled()))
    throw new Error("Màn 2 mở khi chưa qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Danh sách màn");
  await n.chupAnh(page, "0-danh-sach-man");

  // 2. Màn 1, chế độ thường; hướng dẫn hiện ở lượt đầu.
  await the.getByRole("button", { name: /Màn 1: Giấy phép lái xe/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Kiểm tra giấy tờ" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await choiLuot(n, page, tk.id, 1, true);
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "4-tong-ket-man-1");

  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);
  const [td] = (await n.sql`
    SELECT best_stars FROM game_level_progress WHERE account_id = ${tk.id} AND game_code = ${MA} AND level = 1`) as any[];
  if (!td || td.best_stars < 1) throw new Error("Chưa ghi tiến độ màn 1.");

  // 3. Màn 2, giảm chuyển động.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Người lái 1/8").waitFor();
  if (await page.getByRole("dialog", { name: "Kiểm tra giấy tờ" }).count())
    throw new Error("Hướng dẫn hiện lại ở lượt thứ hai.");
  if (!(await page.getByText(/^\d:\d\d$/).count()))
    throw new Error("Không thấy đồng hồ cả ca dạng phút:giây.");
  const tenHoatAnh = await page
    .locator(".gt-vao")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  if (tenHoatAnh !== "g-hien")
    throw new Error(`Giảm chuyển động mà giấy tờ vẫn chạy hoạt ảnh ${tenHoatAnh}.`);
  await choiLuot(n, page, tk.id, 2, true);
  await n.chupAnh(page, "5-tong-ket-man-2");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
