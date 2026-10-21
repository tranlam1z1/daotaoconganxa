/**
 * Kịch bản E2E trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9), khung điện thoại 360×740.
 *
 * Dữ liệu: hai khu phố thử có tiền tố (màn 1, màn 2), cùng một phố ngang có đèn (xanh 20 giây đầu cho
 * hướng Đông–Tây) cắt một phố dọc; đích ở phố dọc, phải rẽ phải. Không có biển, nên không phụ thuộc
 * biển đã duyệt trong CSDL.
 *
 * Kiểm:
 * 1. Màn 1, chế độ thường, CPU chậm 4×: hướng dẫn hiện ở lượt đầu; giữ nút Ga bằng con trỏ, bật xi nhan
 *    phải và chọn rẽ phải bằng bàn phím khi nút đổi thành "Rẽ phải"; tới đích thì tự nộp. Khung hình
 *    ≥ 50/giây; máy chủ chấm 100 điểm, biên bản trắng (trong "Xem chi tiết", cả ở màn "Xem lại từng
 *    câu"); băm trạng thái cuối của máy chủ khớp điện thoại; đúng một dòng XP; không cuộn ngang.
 * 2. Màn 2, giảm chuyển động, chỉ bàn phím: rẽ phải KHÔNG xi nhan; biên bản chỉ có trong "Xem chi
 *    tiết" của hộp kết quả (GĐ17c), đủ số lỗi và số dòng căn cứ, có lỗi chuyển hướng không tín hiệu,
 *    ghi "Chưa có mức phạt đã duyệt"; đóng hộp thì bảng chơi còn danh sách lỗi; "Xem lại" hiện ảnh
 *    tĩnh, lùi/tới từng giây, khung vẽ không tự chạy.
 */
import { type ChiTietTuLai, type PayloadBanDo, TRO_CHOI_TU_LAI } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, taoNoiDungTroChoi } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, demCanCu, hopKetQua, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}tl-`;
const MA = "tu_lai";
const BIEN_BAN = "Biên bản (mô phỏng)";

/** Phần "Xem chi tiết" (GĐ17c): đủ số lỗi và số dòng căn cứ như `chi_tiet` máy chủ trả. */
async function kiemChiTiet(n: NguCanhE2E, vung: Locator, tkId: string, noi: string) {
  const ct = await chiTietDaCham<ChiTietTuLai>(n, TRO_CHOI_TU_LAI, tkId, 1);
  const so = await vung.locator(`section[aria-label="${BIEN_BAN}"] > ol > li`).count();
  if (so !== ct.loi.length) throw new Error(`${noi}: chi tiết có ${so} lỗi, cần ${ct.loi.length}.`);
  const canCu = await demCanCu(vung);
  if (canCu !== ct.loi.length)
    throw new Error(`${noi}: chi tiết có ${canCu} dòng căn cứ, cần ${ct.loi.length}.`);
  if (!ct.loi.length) await vung.getByText("Biên bản trắng", { exact: false }).waitFor();
}

const MA_DO = `
  window.__khung = null;
  let truoc = 0;
  const vong = (t) => {
    if (window.__khung) { if (truoc) window.__khung.push(t - truoc); truoc = t; } else truoc = 0;
    requestAnimationFrame(vong);
  };
  requestAnimationFrame(vong);
`;

const banDo = (man: number): PayloadBanDo => ({
  kieu: "ban_do",
  man,
  ten_pho: `Phố thử màn ${man}`,
  o: ["....|.......", "....|.......", "----+-------", "....|.......", "....|.......", "....|......."],
  xuat_phat: { o: [2, 0], huong: "dong" },
  dich: { o: [5, 4] },
  gio_giay: man === 1 ? null : 120,
  den: [{ o: [2, 4], xanh: 20, vang: 3, do_chung: 2, truc_dau: "ngang" }],
  bien: [],
  vach_di_bo: [],
  nguoi_di_bo: [],
  xe_khac: [],
});

async function luotMoiNhat(n: NguCanhE2E, accId: string, ids: readonly string[]) {
  const [l] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${accId} ORDER BY started_at DESC LIMIT 1`) as any[];
  if (!ids.includes(l.items[0].ref_id))
    throw new Error("Lượt chọn một khu phố khác trong CSDL (có khu phố tu_lai đã duyệt ngoài kịch bản).");
  return l.id as string;
}

/** Chờ nút "Rẽ phải" (xe đã vào vùng chuẩn bị rẽ). */
const choRePhai = (page: Page) =>
  page.getByRole("button", { name: "Rẽ phải", exact: true }).waitFor({ timeout: 30_000 });

export default async function tuLai(n: NguCanhE2E) {
  /* 0. Dữ liệu ---------------------------------------------------------- */
  n.donDep(async () => {
    const ids = (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[];
    await n.sql`DELETE FROM content_reviews WHERE ref IN ${n.sql(ids.map((r) => String(r.id)).concat("-"))}`;
    await n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  });
  const ids: string[] = [];
  for (const man of [1, 2]) {
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX}màn ${man}`,
        payload: banDo(man) as never,
        answer: {},
        explanation: null,
        citations: [],
        refs: [],
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
    ids.push(nd.id);
  }
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = ${MA}`);
  await n.sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
  const loiTrang: string[] = [];

  /* 1. Màn 1, chế độ thường ------------------------------------------ */
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ tự lái E2E" });
  n.donDep(() => n.sql`DELETE FROM game_level_progress WHERE account_id = ${tk.id}`);
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await page.addInitScript(MA_DO);
  await n.dangNhap(page, tk);

  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Tự lái qua phố", exact: true }).click();
  const the = page.getByRole("dialog", { name: "Tự lái qua phố" });
  await the.getByRole("button", { name: /Màn 1: Làm quen/ }).click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const hd = page.getByRole("dialog", { name: "Tự lái qua phố" });
  await hd.waitFor();
  await n.chupAnh(page, "0-huong-dan");
  await hd.getByRole("button", { name: "Bỏ qua" }).click();
  await page.getByRole("button", { name: "Bắt đầu lái" }).waitFor();
  const l1 = await luotMoiNhat(n, tk.id, ids);
  await n.kiemKhongCuonNgang(page, "Chọn xe");
  await n.chupAnh(page, "1-chon-xe");
  await page.getByRole("button", { name: "Bắt đầu lái" }).click();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    (window as any).__khung = [];
  });
  // Giữ Ga bằng con trỏ (nút giữ), rẽ và xi nhan bằng bàn phím trong lúc vẫn giữ Ga.
  const ga = page.getByRole("button", { name: "Ga (giữ)" });
  const o = (await ga.boundingBox())!;
  await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await n.kiemKhongCuonNgang(page, "Đang lái");
  await n.chupAnh(page, "2-dang-lai");
  await choRePhai(page);
  await page.keyboard.press("e");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: /Xi nhan phải, đang bật/ }).waitFor();
  const kq = page.locator("[data-bam-may]");
  await kq.waitFor({ timeout: 60_000 });
  await page.mouse.up();
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
    `  Lái, CPU chậm 4×: ${khung.length} khung trong ${(tong / 1000).toFixed(1)} giây, trung bình ${fps.toFixed(1)} khung/giây, p95 ${sx[Math.floor(sx.length * 0.95)]!.toFixed(1)} ms`,
  );
  if (fps < 50) throw new Error(`Lái chỉ đạt ${fps.toFixed(1)} khung/giây, cần ≥ 50.`);

  const [bamMay, bamChu] = [await kq.getAttribute("data-bam-may"), await kq.getAttribute("data-bam")];
  if (!bamMay || bamMay !== bamChu)
    throw new Error(`Băm trạng thái lệch: điện thoại ${bamMay}, máy chủ ${bamChu}.`);
  if (await page.getByText("Biên bản trắng", { exact: false }).isVisible())
    throw new Error("Biên bản trắng hiện trên trang khi chi tiết đang thu gọn.");
  await kiemChiTiet(n, await moChiTietRieng(page, [], "Màn 1"), tk.id, "Màn 1");
  await n.kiemKhongCuonNgang(page, "Kết quả màn 1");
  await n.chupAnh(page, "3-ket-qua");
  const [s1] = (await n.sql`
    SELECT points::float8 AS points FROM game_run_steps WHERE run_id = ${l1} AND ordinal = 1`) as any[];
  if (s1?.points !== 100) throw new Error(`Màn 1 được ${s1?.points} điểm, cần 100.`);
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await kiemChiTiet(n, await moXemLai(page, 1, []), tk.id, "Màn 1, xem lại");
  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = ${`game:${MA}`}`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);

  /* 2. Màn 2, giảm chuyển động, bàn phím ------------------------------ */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Chơi màn 2" }).click();
  await page.getByRole("button", { name: "Bắt đầu lái" }).waitFor();
  const l2 = await luotMoiNhat(n, tk.id, ids);
  await page.getByText(/giảm hiệu ứng/).waitFor();
  await page.getByRole("button", { name: "Xe mô tô" }).click();
  await page.getByRole("button", { name: "Bắt đầu lái" }).click();
  await page.getByRole("button", { name: "Ga (giữ)" }).waitFor();
  await page.keyboard.down("ArrowUp");
  await choRePhai(page);
  await page.keyboard.press("ArrowRight");
  await page.locator("[data-bam-may]").waitFor({ timeout: 60_000 });
  await page.keyboard.up("ArrowUp");
  const vung = await moChiTietRieng(page, [BIEN_BAN], "Màn 2");
  await kiemChiTiet(n, vung, tk.id, "Màn 2");
  await vung
    .getByText(/không có tín hiệu báo trước/)
    .first()
    .waitFor();
  await vung.getByText("Mức phạt: Chưa có mức phạt đã duyệt").first().waitFor();
  await n.chupAnh(page, "4-bien-ban");
  const [s2] = (await n.sql`
    SELECT points::float8 AS points FROM game_run_steps WHERE run_id = ${l2} AND ordinal = 1`) as any[];
  if (s2?.points !== 100)
    throw new Error(`Màn 2 được ${s2?.points} điểm, cần 100 (rẽ không xi nhan −5, tới đích +10).`);

  // Hộp kết quả (GĐ17a) che bảng chơi: đóng hộp để xem lại cảnh lái.
  await hopKetQua(page).waitFor();
  await page.keyboard.press("Escape");
  await hopKetQua(page).waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: /^Xem lại lúc/ })
    .first()
    .click();
  const lui = page.getByRole("button", { name: "Lùi 1 giây" });
  await lui.waitFor();
  await lui.click();
  await n.chupAnh(page, "5-xem-lai-tinh");
  const anh = () =>
    page
      .locator("canvas")
      .first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length + c.toDataURL().slice(-64));
  const truoc = await anh();
  await page.waitForTimeout(600);
  if ((await anh()) !== truoc) throw new Error("Giảm chuyển động nhưng cảnh xem lại vẫn tự chạy.");
  await n.kiemKhongCuonNgang(page, "Xem lại, giảm chuyển động");

  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
