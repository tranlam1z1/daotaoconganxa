/**
 * Kịch bản E2E trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của luật kiểm hồ sơ (data/tra-cuu/luat-ho-so-phat-nguoi.json) và 30 hồ sơ
 * mẫu (data/tro-choi/phat-nguoi.json), DUYỆT ngay trong kịch bản; mã mức phạt của hồ sơ trỏ sang dòng
 * mức phạt thử đã duyệt. Dữ liệu thật không bị đụng.
 *
 * Kiểm:
 *  - trang Trò chơi có 5 màn, chỉ màn 1 mở; màn hướng dẫn hiện ở lượt đầu;
 *  - màn 1 chơi bằng VUỐT (chuột kéo trên ô vuốt): vuốt phải khi chưa chạm chỗ thiếu thì bị nhắc, không
 *    nộp; chạm chỗ thiếu rồi vuốt phải; vuốt trái để gửi; cố ý sai hồ sơ thứ 3; hồ sơ gửi đúng có
 *    "Thông báo vi phạm (mô phỏng)";
 *  - chỗ thiếu và thông báo vi phạm không nằm trên trang mà trong "Xem chi tiết" của hộp kết quả, đủ số
 *    chỗ thiếu và số dòng căn cứ (GĐ17c); đóng hộp thì thẻ hồ sơ vẫn tô chỗ thiếu; màn "Xem lại từng
 *    câu" cũng có đủ;
 *  - tổng kết có XP, mở màn 2;
 *  - màn 2 chơi bằng NÚT THAY THẾ ở chế độ giảm chuyển động: nút "Trả lại" khóa khi chưa chạm chỗ nào,
 *    thẻ không chạy hoạt ảnh trượt; không hiện lại hướng dẫn;
 *  - không cuộn ngang, không lỗi JavaScript.
 */

import { type BuocPhatNguoi, CHO_CUA_THIEU, TEN_CHO_CHAM } from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  type DongLuatPhatNguoiTep,
  type HoSoPhatNguoiTep,
  napHoSoPhatNguoi,
  napLuatGiayTo,
} from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { demCanCu, dongHopXemBang, hopKetQua, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}dpn-`;
const MA = "duyet_phat_nguoi";
const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function chuanBi(n: NguCanhE2E) {
  const luat = (
    (await Bun.file("data/tra-cuu/luat-ho-so-phat-nguoi.json").json()) as { dong: DongLuatPhatNguoiTep[] }
  ).dong.map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" }));
  n.donDep(() => n.sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`);
  await napLuatGiayTo(luat, { tienTo: PREFIX, cheDo: "theo_tep", nhom: "ho_so_phat_nguoi" });

  const hoSo = (
    (await Bun.file("data/tro-choi/phat-nguoi.json").json()) as { ho_so: HoSoPhatNguoiTep[] }
  ).ho_so.map((h) => {
    const ma = h.ho_so.de_xuat.ma_muc_phat;
    return {
      ...h,
      ho_so: { ...h.ho_so, de_xuat: { ...h.ho_so.de_xuat, ma_muc_phat: ma ? `${PREFIX}${ma}` : null } },
    };
  });
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  for (const ma of new Set(hoSo.map((h) => h.ho_so.de_xuat.ma_muc_phat).filter((m): m is string => !!m))) {
    await n.sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${ma}, 'o_to', 'Hành vi thử E2E', 400000, 600000, 'vn:vbqppl:nd:168/2024/NĐ-CP', '2025-01-01', 'da_duyet')`;
  }
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napHoSoPhatNguoi({ tienToTen: PREFIX, hoSo });
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

/** Kéo chuột trên ô vuốt: dx < 0 là vuốt trái (gửi), dx > 0 là vuốt phải (trả lại). */
async function vuot(page: Page, dx: number) {
  const o = page.getByRole("button", { name: /Vuốt trái: gửi thông báo/ });
  await o.scrollIntoViewIfNeeded();
  const h = (await o.boundingBox())!;
  const x = h.x + h.width / 2;
  const y = h.y + h.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + 4, { steps: 8 });
  await page.mouse.up();
}

const chamCho = (page: Page, ten: string) =>
  page
    .getByRole("button", { name: new RegExp(`^${thoat(ten)}`) })
    .first()
    .click();

/** Xử lý một hồ sơ: đúng (chạm đủ chỗ thiếu rồi quyết định đúng) hoặc cố ý sai. */
async function xuLy(page: Page, b: BuocPhatNguoi, dung: boolean, cachLam: "vuot" | "nut") {
  const thieu = b.cho_thieu.length > 0;
  const traLai = page.getByRole("button", { name: "Trả lại (không vuốt)" });
  if (!(await traLai.isDisabled())) throw new Error("Nút Trả lại bấm được khi chưa chạm chỗ thiếu nào.");
  const lamTraLai = thieu === dung;
  if (lamTraLai) {
    if (cachLam === "vuot" && thieu) {
      // Vuốt phải khi chưa chạm chỗ nào: bị nhắc, hồ sơ chưa nộp.
      await vuot(page, 140);
      await page.getByText("Chạm vào chỗ thiếu trên thẻ trước khi trả lại.").waitFor();
    }
    if (thieu) for (const c of b.cho_thieu) await chamCho(page, TEN_CHO_CHAM[CHO_CUA_THIEU[c.ma][0]!]);
    else await chamCho(page, TEN_CHO_CHAM.vi_tri); // cố ý trả lại hồ sơ đủ căn cứ
    if (cachLam === "vuot") await vuot(page, 140);
    else await traLai.click();
  } else if (cachLam === "vuot") await vuot(page, -140);
  else await page.getByRole("button", { name: "Gửi thông báo (không vuốt)" }).click();
  await hopKetQua(page).waitFor();
}

const CHO_THIEU = "Chỗ thiếu của hồ sơ";
const THONG_BAO = "Thông báo vi phạm (mô phỏng)";

/** Người chơi gửi thông báo (không trả lại) theo cách `xuLy` làm. */
const daGui = (b: BuocPhatNguoi, dung: boolean) => b.cho_thieu.length > 0 !== dung;

/** Khối trong "Xem chi tiết" (GĐ17c): chỗ thiếu (hoặc chỗ chạm nhầm) và thông báo khi đã gửi. */
function khoiChiTiet(b: BuocPhatNguoi, dung: boolean): string[] {
  const gui = daGui(b, dung);
  return [
    ...(b.cho_thieu.length || !gui ? [CHO_THIEU] : []),
    ...(gui && b.thong_bao.length ? [THONG_BAO] : []),
  ];
}

/** Đủ số chỗ thiếu và số dòng "Căn cứ: …" như máy chủ trả (`chamBuoc` của trò). */
async function kiemChiTiet(vung: Locator, b: BuocPhatNguoi, dung: boolean, noi: string) {
  const luat = new Map(b.luat.map((l) => [l.ma, l]));
  const soCanCu =
    b.cho_thieu.filter((c) => luat.get(c.luat_ma)?.can_cu).length +
    (daGui(b, dung) ? b.thong_bao.filter((t) => t.can_cu.length).length : 0);
  const so = await vung.locator(`section[aria-label="${CHO_THIEU}"] > ul > li`).count();
  if (so !== b.cho_thieu.length)
    throw new Error(`${noi}: chi tiết có ${so} chỗ thiếu, hồ sơ có ${b.cho_thieu.length}.`);
  const canCu = await demCanCu(vung);
  if (canCu !== soCanCu) throw new Error(`${noi}: chi tiết có ${canCu} dòng căn cứ, cần ${soCanCu}.`);
}

async function choiLuot(n: NguCanhE2E, page: Page, taiKhoan: string, man: number, cachLam: "vuot" | "nut") {
  const [luot] = (await n.sql`
    SELECT id, items, level FROM game_runs WHERE account_id = ${taiKhoan} AND game_code = ${MA}
    ORDER BY started_at DESC LIMIT 1`) as any[];
  if (luot.level !== man) throw new Error(`Lượt ở màn ${luot.level}, cần màn ${man}.`);
  const buoc = (luot.items as Array<{ noi_dung: BuocPhatNguoi }>).map((b) => b.noi_dung);
  const so = buoc.length;
  for (let i = 1; i <= so; i++) {
    await page.getByText(`Hồ sơ ${i}/${so}`).waitFor();
    if (i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, hồ sơ 1`);
      await n.chupAnh(page, `man${man}-1-the-ho-so`);
    }
    const b = buoc[i - 1]!;
    await xuLy(page, b, i !== 3, cachLam);
    const noi = `Màn ${man}, hồ sơ ${i}`;
    const vung = await moChiTietRieng(page, khoiChiTiet(b, i !== 3), noi);
    await kiemChiTiet(vung, b, i !== 3, noi);
    if (i !== 3 && !b.cho_thieu.length) await vung.getByRole("region", { name: THONG_BAO }).waitFor();
    if (i === 3) await dongHopXemBang(page, page.locator("[data-ket-qua]"), noi);
    if (i === 3) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, kết quả sai`);
      await n.chupAnh(page, `man${man}-2-ket-qua-sai`);
    }
    await page
      .getByRole(i < so ? "link" : "button", { name: i < so ? "Hồ sơ tiếp theo" : "Xem kết quả" })
      .click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText(`Đúng ${so - 1}/${so}`).waitFor();
  const vung = await moXemLai(page, 3, khoiChiTiet(buoc[2]!, false));
  await kiemChiTiet(vung, buoc[2]!, false, `Màn ${man}, xem lại hồ sơ 3`);
}

export default async function duyetPhatNguoi(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ xử lý phạt nguội E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Danh sách màn: chỉ màn 1 mở.
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Duyệt hồ sơ phạt nguội", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Duyệt hồ sơ phạt nguội" });
  await the.getByRole("button", { name: /Màn 1: Thời điểm và ảnh/ }).waitFor();
  if (!(await the.getByRole("button", { name: /Màn 2: Biển số và thiết bị/ }).isDisabled()))
    throw new Error("Màn 2 mở khi chưa qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Danh sách màn");

  // 2. Màn 1 bằng vuốt; hướng dẫn hiện ở lượt đầu.
  await the.getByRole("button", { name: /Màn 1: Thời điểm và ảnh/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Duyệt hồ sơ phạt nguội" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await choiLuot(n, page, tk.id, 1, "vuot");
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "3-tong-ket-man-1");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  // 3. Màn 2 bằng nút thay thế, giảm chuyển động.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Hồ sơ 1/12").waitFor();
  if (await page.getByRole("dialog", { name: "Duyệt hồ sơ phạt nguội" }).count())
    throw new Error("Hướng dẫn hiện lại ở lượt thứ hai.");
  const tenHoatAnh = await page
    .locator(".gt-vao")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  if (tenHoatAnh !== "g-hien") throw new Error(`Giảm chuyển động mà thẻ vẫn chạy hoạt ảnh ${tenHoatAnh}.`);
  await choiLuot(n, page, tk.id, 2, "nut");
  await n.chupAnh(page, "4-tong-ket-man-2");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
