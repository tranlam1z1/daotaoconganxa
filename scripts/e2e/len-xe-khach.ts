/**
 * Kịch bản E2E trò "Lên xe khách" (docs/PLAN.md GĐ-T13), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của luật vận tải (data/tra-cuu/luat-van-tai-khach.json), 4 dòng mức phạt vận
 * tải hành khách (data/tra-cuu/muc-phat.json) và 20 xe mẫu (data/tro-choi/xe-khach.json), DUYỆT ngay trong
 * kịch bản. Dữ liệu thật không bị đụng.
 *
 * Kiểm:
 *  - trang Trò chơi có 5 màn, chỉ màn 1 mở; màn hướng dẫn hiện ở lượt đầu;
 *  - màn 1 bằng CHẠM: đếm từng người trên sơ đồ, số người vượt bằng nút +; dấu Lập biên bản khóa khi chưa báo
 *    vượt hay chạm chỗ sai; cố ý đếm dư (chạm vật) ở xe thứ 3; xe lập biên bản có biên bản;
 *  - các lỗi và biên bản không nằm trên trang mà trong "Xem chi tiết" của hộp kết quả, đủ số lỗi và số
 *    dòng căn cứ như máy chủ trả (GĐ17c); đóng hộp thì sơ đồ vẫn tô chỗ đếm dư; màn "Xem lại từng câu"
 *    cũng có đủ;
 *  - màn 2 ở chế độ giảm chuyển động, bằng BÀN PHÍM (Tab tới người, Enter); không có thẻ Giấy tờ, Giám sát;
 *    không chạy hoạt ảnh trượt; không hiện lại hướng dẫn;
 *  - màn 3: ba thẻ (Khoang xe, Giấy tờ), chạm chỗ sai trên lệnh vận chuyển, phù hiệu; xe có từ hai lỗi thì
 *    sắp lỗi vào biên bản bằng chạm-chạm rồi nộp;
 *  - không cuộn ngang, không lỗi JavaScript.
 */

import {
  type BuocXeKhach,
  type ChiTietXeKhach,
  type DauXeKhach,
  type DongMucPhat,
  TRO_CHOI_LEN_XE_KHACH,
} from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  type DongLuatVanTaiTep,
  napLuatGiayTo,
  napTraCuuNhanh,
  napXeKhach,
  type XeKhachTep,
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

const PREFIX = `${TIEN_TO}xk-`;
const MA = "len_xe_khach";
const TEN_DAU: Record<DauXeKhach, string> = { cho_di: "Cho đi", lap_bien_ban: "Lập biên bản" };
const laNguoi = (h: string) => h === "nguoi_lon" || h === "tre_em";

/** Chỗ chạm → (thẻ giấy, nhãn dòng) hoặc nút "không có"; nhãn ở bước sắp lỗi. */
const DONG: Record<string, [string, string]> = {
  "lvc.bien_so": ["Lệnh vận chuyển", "Biển số xe"],
  "lvc.lai_xe": ["Lệnh vận chuyển", "Lái xe"],
  "lvc.ngay": ["Lệnh vận chuyển", "Ngày thực hiện"],
  "ph.bien_so": ["Phù hiệu", "Biển số xe"],
  "ph.co_gia_tri_den": ["Phù hiệu", "Có giá trị đến"],
};
const THIEU: Record<string, string> = {
  "thieu.lenh_van_chuyen": "lệnh vận chuyển",
  "thieu.phu_hieu": "phù hiệu",
};
const NHAN_SAP: Record<string, string> = {
  "lvc.bien_so": "Lệnh vận chuyển: biển số",
  "lvc.lai_xe": "Lệnh vận chuyển: lái xe",
  "lvc.ngay": "Lệnh vận chuyển: ngày",
  "ph.bien_so": "Phù hiệu: biển số",
  "ph.co_gia_tri_den": "Phù hiệu: thời hạn",
  "thieu.lenh_van_chuyen": "Không có lệnh vận chuyển",
  "thieu.phu_hieu": "Không có phù hiệu",
};

async function chuanBi(n: NguCanhE2E) {
  const luat = (
    (await Bun.file("data/tra-cuu/luat-van-tai-khach.json").json()) as { dong: DongLuatVanTaiTep[] }
  ).dong.map((d) => ({
    ...d,
    ma: `${PREFIX}${d.ma}`,
    ma_muc_phat: d.ma_muc_phat ? `${PREFIX}${d.ma_muc_phat}` : null,
    trang_thai: "da_duyet",
  }));
  n.donDep(() => n.sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`);
  await napLuatGiayTo(luat, { tienTo: PREFIX, cheDo: "theo_tep", nhom: "van_tai_khach" });
  const mp = ((await Bun.file("data/tra-cuu/muc-phat.json").json()) as { dong: DongMucPhat[] }).dong
    .filter((d) => d.ma.startsWith("oto-khach-"))
    .map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" as const }));
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  const xe = ((await Bun.file("data/tro-choi/xe-khach.json").json()) as { xe: XeKhachTep[] }).xe;
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napXeKhach({ tienToTen: PREFIX, xe });
  if (tao.daTao !== 20) throw new Error(`Cần tạo 20 xe, tạo được ${tao.daTao}.`);
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

async function bam(page: Page, cach: "cham" | "phim", nut: ReturnType<Page["locator"]>) {
  if (cach === "cham") await nut.click();
  else {
    await nut.focus();
    await page.keyboard.press("Enter");
  }
}

/** Xử lý một xe: đếm, báo số vượt, chạm chỗ sai, đóng dấu, sắp lỗi (đúng, hoặc cố ý đếm dư). */
async function xuLy(page: Page, b: BuocXeKhach, dung: boolean, cach: "cham" | "phim") {
  const lap = page.getByRole("button", { name: "Lập biên bản", exact: true });
  if (!(await lap.isDisabled()))
    throw new Error("Lập biên bản bấm được khi chưa báo vượt, chưa chạm chỗ sai.");
  if (b.man < 3 && (await page.getByRole("tab").count()))
    throw new Error(`Màn ${b.man} có thẻ Giấy tờ, Giám sát.`);
  // Đếm đúng: chạm mọi người. Cố ý sai: chạm thêm một vật (đếm dư); xe không có vật thì bỏ sót một người.
  const nguoi = b.phan_tu.filter((p) => laNguoi(p.hinh)).map((p) => p.id);
  const vat = b.phan_tu.find((p) => !laNguoi(p.hinh))?.id;
  const cham = dung ? nguoi : vat ? [...nguoi, vat] : nguoi.slice(1);
  for (const id of cham) await bam(page, cach, page.locator(`[data-id="${id}"]`));
  await page.getByText(`Đã đếm: ${cham.length}`).waitFor();
  const tang = page.getByRole("button", { name: "Tăng số người vượt" });
  for (let i = 0; i < b.so_vuot; i++) await bam(page, cach, tang);
  // Chỗ sai trên giấy tờ (màn 3 trở đi).
  const loiGiay = b.loi.filter((l) => l.ma !== "cho_qua_nguoi");
  if (loiGiay.length) {
    await page.getByRole("tab", { name: "Giấy tờ" }).click();
    for (const l of loiGiay) {
      const c = l.cho[0]!;
      if (THIEU[c])
        await bam(page, cach, page.getByRole("button", { name: `Đánh dấu: không có ${THIEU[c]}` }));
      else {
        const [the, nhan] = DONG[c]!;
        await bam(
          page,
          cach,
          page.getByRole("region", { name: the }).getByRole("button", { name: new RegExp(`^${nhan}:`) }),
        );
      }
    }
    await page.getByRole("tab", { name: "Khoang xe" }).click();
  }
  await bam(page, cach, page.getByRole("button", { name: TEN_DAU[b.dau], exact: true }));
  // Bước sắp lỗi: xe lập biên bản có từ hai mục (số người, chỗ sai).
  const muc = [...(b.so_vuot > 0 ? ["so_nguoi"] : []), ...loiGiay.map((l) => l.cho[0]!)];
  if (b.dau === "lap_bien_ban" && muc.length >= 2) {
    await page.getByRole("region", { name: "Sắp lỗi vào biên bản" }).waitFor();
    const thuTu = [...b.loi]
      .sort((a, c) => (b.phat_toi_da[c.ma] ?? -1) - (b.phat_toi_da[a.ma] ?? -1))
      .map((l) => l.cho[0]!);
    for (const [i, m] of thuTu.entries()) {
      const nhan = m === "so_nguoi" ? `Chở quá số người (vượt ${b.so_vuot})` : NHAN_SAP[m]!;
      await page.getByRole("button", { name: nhan, exact: true }).click();
      await page.getByRole("button", { name: `${i + 1}. (chưa có)` }).click();
    }
    await page.getByRole("button", { name: "Nộp biên bản" }).click();
  }
  await hopKetQua(page).waitFor();
}

/**
 * Phần "Xem chi tiết" (GĐ17c) của xe `thuTu`: các lỗi và biên bản chỉ hiện sau khi mở; đủ số lỗi và số
 * dòng căn cứ như `chi_tiet` máy chủ trả. `xemLai`: mở ở màn "Xem lại từng câu" thay vì trong hộp.
 */
async function kiemChiTiet(
  n: NguCanhE2E,
  page: Page,
  tkId: string,
  thuTu: number,
  noi: string,
  xemLai = false,
) {
  const ct = await chiTietDaCham<ChiTietXeKhach>(n, TRO_CHOI_LEN_XE_KHACH, tkId, thuTu);
  const bienBan = ct.dau_dung === "lap_bien_ban" && ct.bien_ban.length > 0;
  const khoi = [...(ct.loi.length ? ["Các lỗi"] : []), ...(bienBan ? ["Biên bản (mô phỏng)"] : [])];
  const vung: Locator = xemLai ? await moXemLai(page, thuTu, khoi) : await moChiTietRieng(page, khoi, noi);
  const so = await vung.locator('section[aria-label="Các lỗi"] li').count();
  if (so !== ct.loi.length) throw new Error(`${noi}: chi tiết có ${so} lỗi, cần ${ct.loi.length}.`);
  const canCu = ct.loi.length + (bienBan ? ct.bien_ban.filter((d) => d.can_cu.length).length : 0);
  const co = await demCanCu(vung);
  if (co !== canCu) throw new Error(`${noi}: chi tiết có ${co} dòng căn cứ, cần ${canCu}.`);
}

async function choiLuot(
  n: NguCanhE2E,
  page: Page,
  taiKhoan: string,
  man: number,
  cach: "cham" | "phim",
  sai: number | null,
) {
  const [luot] = (await n.sql`
    SELECT items, level FROM game_runs WHERE account_id = ${taiKhoan} AND game_code = ${MA}
    ORDER BY started_at DESC LIMIT 1`) as any[];
  if (luot.level !== man) throw new Error(`Lượt ở màn ${luot.level}, cần màn ${man}.`);
  const buoc = (luot.items as Array<{ noi_dung: BuocXeKhach }>).map((b) => b.noi_dung);
  const so = buoc.length;
  for (let i = 1; i <= so; i++) {
    await page.getByText(`Xe ${i}/${so}`).waitFor();
    if (i === 1) {
      await n.kiemKhongCuonNgang(page, `Màn ${man}, xe 1`);
      await n.chupAnh(page, `man${man}-1-xe`);
    }
    await xuLy(page, buoc[i - 1]!, i !== sai, cach);
    await kiemChiTiet(n, page, taiKhoan, i, `Màn ${man}, xe ${i}`);
    if (i === sai)
      await dongHopXemBang(
        page,
        page.locator('button[data-id][style*="var(--danger)"]'),
        `Màn ${man}, xe ${i}`,
      );
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

export default async function lenXeKhach(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ kiểm tra xe khách E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Lên xe khách", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Lên xe khách" });
  await the.getByRole("button", { name: /Màn 1: Xe 16 chỗ/ }).waitFor();
  if (!(await the.getByRole("button", { name: /Màn 2: Người đứng lối đi/ }).isDisabled()))
    throw new Error("Màn 2 mở khi chưa qua màn 1.");
  await n.kiemKhongCuonNgang(page, "Danh sách màn");

  await the.getByRole("button", { name: /Màn 1: Xe 16 chỗ/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Lên xe khách" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await choiLuot(n, page, tk.id, 1, "cham", 3);
  await n.chupAnh(page, "3-tong-ket-man-1");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByText("Xe 1/3").waitFor();
  if (await page.getByRole("dialog", { name: "Lên xe khách" }).count())
    throw new Error("Hướng dẫn hiện lại ở lượt thứ hai.");
  const tenHoatAnh = await page
    .locator(".gt-vao")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  if (tenHoatAnh !== "g-hien") throw new Error(`Giảm chuyển động mà xe vẫn chạy hoạt ảnh ${tenHoatAnh}.`);
  await choiLuot(n, page, tk.id, 2, "phim", null);
  await n.chupAnh(page, "4-tong-ket-man-2");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Chơi màn 3" }).click();
  await page.getByText("Xe 1/3").waitFor();
  await page.getByRole("tab", { name: "Giấy tờ" }).click();
  await n.chupAnh(page, "5-man3-giay-to");
  await page.getByRole("tab", { name: "Khoang xe" }).click();
  await choiLuot(n, page, tk.id, 3, "cham", null);
  await n.chupAnh(page, "6-tong-ket-man-3");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
