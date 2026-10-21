/**
 * Kịch bản E2E trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2), khung điện thoại 360×740: chơi trọn một
 * lượt 10 xe.
 *
 * Dữ liệu: bản sao có tiền tố của các khung phạt theo tốc độ trong data/tra-cuu/muc-phat.json và 20
 * tình huống demo trong data/tro-choi/sung-ban-toc-do.json, được DUYỆT ngay trong kịch bản (qua cùng
 * hàm duyệt của màn hình quản trị) để trò chơi dùng được. Dữ liệu thật trong CSDL không bị đụng tới.
 *
 * Kiểm: vào chơi một chạm từ trang Trò chơi; số tốc độ in từ 32px trở lên; không cuộn ngang; câu 2
 * và câu 3 chỉ hiện khi chọn "Có"; hết 10 xe ra tổng kết có XP; đúng một dòng XP.
 */

import type { BuocSungBan, DongMucPhat } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, napTraCuuNhanh } from "@qdpl/db";
import type { Page } from "playwright-core";
import { napTinhHuongSungBan } from "../../packages/db/src/seed-tro-choi.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { hopKetQua } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}sbtd-`;

export async function chonVaChot(page: Page, b: BuocSungBan, dung: boolean) {
  const d = b.dap_an;
  const viPham = dung ? d.vi_pham : !d.vi_pham;
  await page.getByRole("button", { name: viPham ? "Có" : "Không", exact: true }).click();
  if (viPham) {
    // Trả lời đúng thì chọn đúng khung và hình thức bổ sung; cố ý sai thì dừng ở câu 1.
    const khung = b.lua_chon_khung.find((k) => k.id === (d.khung_ma ?? b.lua_chon_khung[0]!.id))!;
    await page.getByRole("button", { name: khung.text }).click();
    const bs = b.lua_chon_bo_sung.find((o) => o.id === (d.bo_sung_ma ?? b.lua_chon_bo_sung[0]!.id))!;
    await page.getByRole("button", { name: bs.text }).click();
  }
  await page.getByRole("button", { name: "Chốt đáp án" }).click();
  await hopKetQua(page).waitFor();
}

/** Nạp khung phạt, biển, 20 tình huống có tiền tố rồi duyệt; bật trò. Dùng chung với tro-choi-muot.ts. */
export async function chuanBiSungBan(n: NguCanhE2E, PREFIX: string) {
  const mp = ((await Bun.file("data/tra-cuu/muc-phat.json").json()) as { dong: DongMucPhat[] }).dong
    .filter((d) => d.toc_do_vuot)
    .map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" as const }));
  n.donDep(() => n.sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`);
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX });
  const bien = `${PREFIX}P127`;
  n.donDep(() => n.sql`DELETE FROM traffic_signs WHERE code = ${bien}`);
  await n.sql`
    INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status)
    VALUES (${bien}, 'cam', 'Tốc độ tối đa cho phép (E2E)', 'Biển thử', 'assets/bien-bao/P.127.svg',
            'vn:vbqppl:qcvn:41/2024/BGTVT#dieu-1', 'da_duyet')`;
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napTinhHuongSungBan({ tienToTen: PREFIX, mucPhat: mp, maBien: bien });
  if (tao.daTao !== 20) throw new Error(`Cần tạo 20 tình huống demo, tạo được ${tao.daTao}.`);
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
  const [cu] = (await n.sql`SELECT enabled FROM games WHERE code = 'sung_ban_toc_do'`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(cu?.enabled)} WHERE code = 'sung_ban_toc_do'`);
  await n.sql`UPDATE games SET enabled = true WHERE code = 'sung_ban_toc_do'`;
}

export default async function sungBanTocDo(n: NguCanhE2E) {
  // 1. Dữ liệu có tiền tố, rồi duyệt.
  await chuanBiSungBan(n, PREFIX);

  // 2. Chơi một lượt trên điện thoại.
  const tk = await n.taoTaiKhoan({ ten: "Cán bộ bắn tốc độ E2E" });
  n.donDep(() => n.sql`DELETE FROM game_runs WHERE account_id = ${tk.id}`);
  const page = await n.moTrang();
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Súng bắn tốc độ", exact: true }).click();
  await page.getByRole("dialog", { name: "Súng bắn tốc độ" }).getByRole("button", { name: "Chơi" }).click();
  await page.getByText("Câu 1/10").waitFor();

  const [luot] = (await n.sql`
    SELECT id, items FROM game_runs WHERE account_id = ${tk.id} ORDER BY started_at DESC LIMIT 1`) as any[];
  const buoc = (luot.items as Array<{ noi_dung: BuocSungBan }>).map((b) => b.noi_dung);

  // Số tốc độ đo được đọc được: cỡ chữ từ 32px.
  const coChu = await page
    .getByText("Súng bắn tốc độ đo được")
    .locator("xpath=following-sibling::p")
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  if (coChu < 32) throw new Error(`Số tốc độ cỡ ${coChu}px, cần từ 32px.`);
  // Câu 2, 3 chưa hiện khi chưa chọn "Có".
  if (await page.getByText("2. Tốc độ vượt thuộc khung nào?").count())
    throw new Error("Câu 2 hiện trước khi chọn Có.");
  await n.kiemKhongCuonNgang(page, "Xe 1");
  await n.chupAnh(page, "1-xe-1");

  for (let i = 1; i <= 10; i++) {
    if (i > 1) await page.getByText(`Câu ${i}/10`).waitFor();
    // Cố ý trả lời sai xe thứ 4 để kết quả có cả đúng và sai.
    await chonVaChot(page, buoc[i - 1]!, i !== 4);
    if (i === 1) {
      await n.kiemKhongCuonNgang(page, "Phản hồi xe 1");
      await n.chupAnh(page, "2-phan-hoi-xe-1");
    }
    if (i === 4) await n.chupAnh(page, "3-phan-hoi-sai");
    await page.getByRole(i < 10 ? "link" : "button", { name: i < 10 ? "Câu tiếp" : "Xem kết quả" }).click();
  }
  await page.getByText(/\+\d+ điểm kinh nghiệm/).waitFor();
  await page.getByText("Đúng 9/10").waitFor();
  await n.kiemKhongCuonNgang(page, "Kết quả lượt");
  await n.chupAnh(page, "4-ket-qua");

  const [{ so }] = (await n.sql`
    SELECT count(*)::int AS so FROM xp_ledger WHERE account_id = ${tk.id} AND source_kind = 'game:sung_ban_toc_do'`) as any;
  if (so !== 1) throw new Error(`Lượt có ${so} dòng XP, cần đúng 1.`);
  if (loiTrang.length) throw new Error(`Lỗi JavaScript: ${loiTrang.join("; ")}`);
}
