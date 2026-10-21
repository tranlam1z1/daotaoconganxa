/**
 * Kịch bản E2E trang Bảng xếp hạng (apps/web/app/routes/bang-xep-hang.tsx) ở khung 375px và
 * 1280px, giao diện sáng và tối:
 * - tab Trong đơn vị: thẻ "Vị trí của bạn" (đồng hạng, XP còn thiếu để lên hạng, cấp và vạch tiến
 *   độ), bục 2 – 1 – 3 có đồng hạng 2, bảng từ hạng 4 (tên dài cắt gọn, cột số không xuống dòng),
 *   nhóm chưa có XP đóng sẵn và không đánh số hạng, chú giải cấp tô cấp của người xem;
 * - bản thân 0 XP trong kỳ và ít hơn 3 người có XP; tài khoản chưa gắn đơn vị;
 * - tab Các đơn vị: đồng hạng 3 vắt qua bục và bảng, không có cột Cấp;
 * - tab Mùa giải: nhóm thi đấu gọi là "Bậc", không còn "Hạng N" hay "lên/xuống hạng";
 * - bục: hạng càng cao càng nổi (nền vàng cam > màu chính > màu chính nhạt, hoạt ảnh tăng dần), mỗi
 *   hoạt ảnh ≤ 1,2 giây và không lặp; giảm chuyển động (hệ điều hành hoặc công tắc "Giảm hiệu ứng")
 *   chỉ còn hiện dần, tắt bật số và dải sáng.
 * Không trang nào cuộn ngang hay có phần tử tràn mép phải. Các lượt kiểm bố cục bật giảm chuyển
 * động để vị trí đo được không lệch vì hoạt ảnh đang chạy.
 *
 * Dữ liệu: một đơn vị cha và 6 đội cùng cấp "Đội e2e BXH"; XP gieo thẳng vào xp_ledger (tổng XP,
 * mùa giải) và daily_activity (XP tuần này); một mùa giải 4 tuần bắt đầu thứ Hai hai tuần trước,
 * API tự chốt hai tuần đã qua khi mở tab Mùa giải. Chạy trên CSDL mà DATABASE_URL trỏ tới.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ngayVietNam, thuHaiCuaTuan } from "@qdpl/dao-tao";
import { taoDonVi, taoMuaGiai } from "@qdpl/db";
import type { Page } from "playwright-core";
import type { NguCanhE2E, TaiKhoanE2E } from "./chay.ts";

const THU_MUC_ANH = join(import.meta.dir, ".anh");

const TIEN_TO = "e2e-bxh";
const CAP_THI_DAU = "Đội e2e BXH";
const TEN_DAI = "Nguyễn Thị Phương Thảo Hoàng Minh Châu Lê Anh";
const KHUNG = [
  { ten: "375", width: 375, height: 812 },
  { ten: "1280", width: 1280, height: 900 },
] as const;

const congNgay = (ngay: string, so: number) =>
  new Date(Date.parse(`${ngay}T00:00:00Z`) + so * 86_400_000).toISOString().slice(0, 10);

async function donDuLieu(n: NguCanhE2E) {
  await n.sql`DELETE FROM seasons WHERE code LIKE ${`${TIEN_TO}%`}`;
  await n.sql`DELETE FROM accounts WHERE username LIKE ${`${TIEN_TO}-%`}`;
  for (const cap of [3, 2, 1])
    await n.sql`DELETE FROM units WHERE code LIKE ${`${TIEN_TO}%`} AND nlevel(path) = ${cap}`;
  await n.sql`DELETE FROM audit_log WHERE actor = ${TIEN_TO}`;
}

async function dungDuLieu(n: NguCanhE2E) {
  await donDuLieu(n); // lượt trước hỏng giữa chừng
  n.donDep(() => donDuLieu(n));

  const cha = await taoDonVi({ code: `${TIEN_TO}-P`, name: "Phòng e2e BXH", levelLabel: "Phòng" }, TIEN_TO);
  const dv: string[] = [];
  const tenDoi = [
    "Đội Cảnh sát giao thông trật tự số 1 (e2e)",
    ...[2, 3, 4, 5, 6].map((i) => `Đội ${i} (e2e)`),
  ];
  for (const [i, ten] of tenDoi.entries()) {
    dv.push(
      (
        await taoDonVi(
          { code: `${TIEN_TO}-D${i + 1}`, name: ten, parentId: cha.id, levelLabel: CAP_THI_DAU },
          TIEN_TO,
        )
      ).id,
    );
  }

  // Tài khoản không đăng nhập: chỉ để có mặt trên bảng.
  const taoNguoi = async (ten: string, unitId: string) => {
    const [r] = (await n.sql`
      INSERT INTO accounts (username, name, role, unit_id)
      VALUES (${`${TIEN_TO}-${crypto.randomUUID().slice(0, 8)}`}, ${ten}, 'can_bo', ${unitId}) RETURNING id`) as any[];
    return r.id as string;
  };
  const vaoDonVi = async (tk: TaiKhoanE2E, unitId: string | null) => {
    await n.sql`UPDATE accounts SET unit_id = ${unitId} WHERE id = ${tk.id}`;
  };

  const homNay = ngayVietNam();
  const batDauMua = congNgay(thuHaiCuaTuan(homNay), -14);
  let soNguon = 0;
  const ghiXp = async (id: string, xp: number, ngay: string) => {
    const luc = ngay === homNay ? new Date().toISOString() : `${ngay}T05:00:00Z`;
    await n.sql`
      INSERT INTO xp_ledger (account_id, source_kind, source_id, xp, day, unit_id, created_at)
      VALUES (${id}, ${TIEN_TO}, ${`${TIEN_TO}-${++soNguon}`}, ${xp}, ${ngay},
              (SELECT unit_id FROM accounts WHERE id = ${id}), ${luc})`;
    if (ngay === homNay) {
      await n.sql`INSERT INTO daily_activity (account_id, day, xp) VALUES (${id}, ${ngay}, ${xp})
                  ON CONFLICT (account_id, day) DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp`;
    }
  };

  // Người xem 1 ở đội 1: đồng hạng 5 với 45 XP tuần này; tổng XP 345 (cấp 3).
  const toi = await n.taoTaiKhoan({ ten: "Ngô Thanh Tâm" });
  await vaoDonVi(toi, dv[0]!);
  await ghiXp(toi.id, 300, "2026-01-05");
  const doi1: Array<[string, number]> = [
    ["Trần Văn An", 120],
    ["Lê Thị Bình", 90],
    ["Phạm Minh Châu", 90],
    [TEN_DAI, 60],
    ["Võ Văn Dũng", 45],
    ["Đặng Thu Hà", 30],
    ["Bùi Quang Huy", 0],
    ["Hồ Ngọc Lan", 0],
  ];
  const id1: string[] = [];
  for (const [ten, xp] of doi1) {
    const id = await taoNguoi(ten, dv[0]!);
    id1.push(id);
    if (xp) await ghiXp(id, xp, homNay);
  }
  await ghiXp(toi.id, 45, homNay);

  // Người xem 2 ở đội 2: 0 XP tuần này, chỉ hai người trong đội có XP.
  const khongXp = await n.taoTaiKhoan({ ten: "Mai Văn Khoa" });
  await vaoDonVi(khongXp, dv[1]!);
  const long = await taoNguoi("Trịnh Văn Long", dv[1]!);
  const mai = await taoNguoi("Lý Thị Mai", dv[1]!);
  await ghiXp(long, 50, homNay);
  await ghiXp(mai, 20, homNay);

  // Đội 3–6, mỗi đội 3 người (đủ quân số tối thiểu của mùa giải). Tuần này đội 3 và 4 cùng 10 XP/người.
  const dau: string[] = [];
  for (const i of [2, 3, 4, 5]) {
    for (const k of [1, 2, 3]) {
      const id = await taoNguoi(`Thành viên ${k} đội ${i + 1}`, dv[i]!);
      if (k === 1) dau.push(id);
    }
  }
  await ghiXp(dau[0]!, 30, homNay);
  await ghiXp(dau[1]!, 30, homNay);

  // Mùa giải: trước mùa D1 > D2 > … > D6 (bậc 1: D1–D3). Tuần 1: D3 xuống, D4 lên. Tuần 2: D1 cuối
  // bậc 1 nên xuống bậc 2, D3 lên lại.
  const [truoc, tuan1, tuan2] = [-7, 2, 9].map((x) => congNgay(batDauMua, x));
  for (const [id, xp] of [
    [id1[0]!, 400],
    [long, 300],
    [dau[0]!, 200],
    [dau[1]!, 100],
    [dau[2]!, 50],
    [dau[3]!, 10],
  ] as const)
    await ghiXp(id, xp, truoc!);
  for (const [id, xp] of [
    [id1[0]!, 300],
    [long, 150],
    [dau[0]!, 30],
    [dau[1]!, 90],
    [dau[2]!, 15],
  ] as const)
    await ghiXp(id, xp, tuan1!);
  for (const [id, xp] of [
    [id1[0]!, 18],
    [long, 60],
    [dau[1]!, 30],
    [dau[0]!, 90],
  ] as const)
    await ghiXp(id, xp, tuan2!);
  await taoMuaGiai(
    {
      code: `${TIEN_TO}-mua`,
      name: "Mùa giải e2e BXH",
      startsOn: batDauMua,
      unitLevelLabel: CAP_THI_DAU,
      config: { so_tuan: 4, so_hang: 2, co_nhom: 3, so_len: 1, so_xuong: 1 },
    },
    TIEN_TO,
  );

  const chuaGan = await n.taoTaiKhoan({ ten: "Đỗ Minh Quân" });
  return { toi, khongXp, chuaGan };
}

/* ------------------------------------------------------------------ */
/* Kiểm tra chung                                                      */
/* ------------------------------------------------------------------ */

async function moTab(page: Page, web: string, query: string) {
  await page.goto(`${web}/bang-xep-hang?${query}`);
  await page.getByRole("heading", { level: 1, name: "Bảng xếp hạng" }).waitFor();
}

/** Ảnh toàn trang chụp từ đầu trang: nếu đang cuộn, thanh đầu trang dính sẽ nằm giữa ảnh. */
async function chup(n: NguCanhE2E, page: Page, ten: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await n.chupAnh(page, ten);
}

/** Ảnh riêng một khối, đặt giữa khung để thanh đầu trang và thanh điều hướng dưới không che. */
async function chupKhoi(page: Page, selector: string, ten: string) {
  const khoi = page.locator(selector).first();
  await khoi.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await mkdir(THU_MUC_ANH, { recursive: true });
  await khoi.screenshot({ path: join(THU_MUC_ANH, `bang-xep-hang-${ten}.png`) });
}

async function kiemBoCuc(n: NguCanhE2E, page: Page, noi: string) {
  await n.kiemKhongCuonNgang(page, noi);
  const tran = await page.evaluate(() => {
    const rong = document.documentElement.clientWidth;
    return [...document.body.querySelectorAll<HTMLElement>("main *")]
      .filter((el) => !el.closest(".sr-only") && el.getClientRects().length > 0)
      .filter((el) => el.getBoundingClientRect().right > rong + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
  });
  if (tran.length) throw new Error(`${noi}: phần tử tràn mép phải: ${tran.join(" | ")}`);
  // Hai hàng nút có nhóm và nhãn nhìn thấy được.
  for (const nhan of ["Phạm vi", "Kỳ"]) {
    const nhom = page.locator(`[role="group"][aria-label="${nhan}"]`);
    if (noi.includes("mùa giải") && nhan === "Kỳ") continue;
    if (!(await nhom.getByText(nhan, { exact: true }).isVisible()))
      throw new Error(`${noi}: thiếu nhãn nhìn thấy được "${nhan}".`);
  }
  if (!(await page.getByText("Cấp tính theo tổng XP từ trước tới nay", { exact: false }).first().isVisible()))
    throw new Error(`${noi}: thiếu câu giải thích hạng và cấp dưới tiêu đề.`);
}

/** Ô số (hạng, XP, số người) chỉ có một dòng chữ. */
async function kiemSoMotDong(page: Page, noi: string) {
  const loi = await page.evaluate(() => {
    const motDong = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const dong = new Set([...r.getClientRects()].map((x) => Math.round(x.top)));
      return dong.size <= 1;
    };
    return [...document.querySelectorAll("tbody tr")].flatMap((tr) => {
      const o = [tr.querySelector("td > span"), tr.querySelector("td:last-child")];
      return o.filter((el): el is Element => Boolean(el) && !motDong(el!)).map((el) => el.textContent);
    });
  });
  if (loi.length) throw new Error(`${noi}: cột số bị xuống dòng: ${loi.join(", ")}`);
}

/** Bục: dòng đầu ở giữa và đứng cao nhất, dòng hai bên trái, dòng ba bên phải. */
async function kiemBuc(page: Page, noi: string, soO: number) {
  const o = page.locator('section[aria-labelledby="ba-hang-dau"] ol > li');
  if ((await o.count()) !== soO) throw new Error(`${noi}: bục có ${await o.count()} ô, cần ${soO}.`);
  const hop = await o.evaluateAll((ds) =>
    ds.map((li) => {
      const r = (li.firstElementChild as HTMLElement).getBoundingClientRect();
      return { giua: r.left + r.width / 2, tren: r.top };
    }),
  );
  if (hop.length >= 2 && !(hop[1]!.giua < hop[0]!.giua && hop[0]!.tren < hop[1]!.tren))
    throw new Error(`${noi}: người hạng 2 phải ở bên trái và thấp hơn người hạng 1.`);
  if (hop.length === 3 && !(hop[2]!.giua > hop[0]!.giua && hop[0]!.tren < hop[2]!.tren))
    throw new Error(`${noi}: người hạng 3 phải ở bên phải và thấp hơn người hạng 1.`);
  return o;
}

async function kiemNhomChuaCoXp(page: Page, noi: string, tieuDe: string) {
  const nhom = page.locator("details", { hasText: "Chưa có XP trong kỳ này" });
  if (!(await nhom.locator("summary").innerText()).includes(tieuDe))
    throw new Error(`${noi}: tiêu đề nhóm chưa có XP phải có "${tieuDe}".`);
  if (await nhom.evaluate((d) => (d as HTMLDetailsElement).open))
    throw new Error(`${noi}: nhóm chưa có XP phải đóng sẵn.`);
  const soHang = await nhom
    .locator("li")
    .evaluateAll(
      (ds) =>
        ds.filter((li) =>
          [...li.querySelectorAll("span")].some((s) => /^\d+$/.test(s.textContent?.trim() ?? "")),
        ).length,
    );
  if (soHang) throw new Error(`${noi}: nhóm chưa có XP không được hiện số hạng.`);
  return nhom;
}

/* ------------------------------------------------------------------ */
/* Từng tab                                                             */
/* ------------------------------------------------------------------ */

async function kiemTrongDonVi(n: NguCanhE2E, page: Page, noi: string, hep: boolean) {
  await moTab(page, n.web, "pham_vi=don_vi&ky=tuan");
  await kiemBoCuc(n, page, noi);

  const the = page.locator('section[aria-labelledby="vi-tri-cua-ban"]');
  const chu = await the.innerText();
  for (const can of [
    "Vị trí của bạn",
    "Đồng hạng 5",
    "trên 7 người có XP",
    "Còn 16 XP để lên hạng 4.",
    "Cấp 3",
  ])
    if (!chu.includes(can)) throw new Error(`${noi}: thẻ vị trí thiếu "${can}". Có: ${chu}`);
  if ((await the.getByRole("progressbar").getAttribute("aria-valuenow")) !== "38")
    throw new Error(`${noi}: vạch tiến độ lên cấp 4 phải ở 38% (345 XP trong khoảng 250–500).`);

  const buc = await kiemBuc(page, noi, 3);
  const chuBuc = await buc.allInnerTexts();
  if (!/^Hạng\s+1\b/.test(chuBuc[0]!) || !chuBuc[0]!.includes("Trần Văn An"))
    throw new Error(`${noi}: ô giữa bục phải là "Hạng 1 · Trần Văn An". Có: ${chuBuc[0]}`);
  for (const i of [1, 2])
    if (!/^Đồng hạng\s+2\b/.test(chuBuc[i]!))
      throw new Error(`${noi}: ô ${i + 1} của bục phải ghi "Đồng hạng 2". Có: ${chuBuc[i]}`);
  // Đồng hạng 2 đứng cao bằng nhau.
  const tren = await buc.evaluateAll((ds) =>
    ds.map((li) => li.firstElementChild!.getBoundingClientRect().top),
  );
  if (Math.abs(tren[1]! - tren[2]!) > 1) throw new Error(`${noi}: hai người đồng hạng 2 phải cao bằng nhau.`);

  const bang = page.locator("table");
  const tieuDe = await bang.locator("thead th").allInnerTexts();
  if (tieuDe.map((t) => t.replace(/\s+/g, " ").trim()).join("|") !== "Hạng|Họ tên|Cấp|XP tuần này")
    throw new Error(`${noi}: hàng tiêu đề bảng sai: ${tieuDe.join(" | ")}`);
  if (!(await bang.locator("caption.sr-only").count()))
    throw new Error(`${noi}: bảng thiếu caption sr-only.`);
  if ((await bang.locator("tbody tr").count()) !== 4)
    throw new Error(`${noi}: bảng phải có 4 dòng (hạng 4–7).`);
  const dongToi = bang.locator('tbody tr[aria-current="true"]');
  const chuDongToi = await dongToi.innerText();
  if (!chuDongToi.includes("(bạn)") || !chuDongToi.includes("Đồng hạng"))
    throw new Error(`${noi}: dòng của mình phải có "(bạn)" và "Đồng hạng". Có: ${chuDongToi}`);
  if (
    (await dongToi
      .locator("td")
      .first()
      .evaluate((td) => getComputedStyle(td).borderTopWidth)) !== "2px"
  )
    throw new Error(`${noi}: dòng của mình thiếu viền primary.`);
  await kiemSoMotDong(page, noi);
  if (hep) {
    const tenDai = bang.locator("th span", { hasText: "Nguyễn Thị Phương Thảo" });
    // Điện thoại: cột Cấp gộp xuống dưới tên nên cột tên rộng hơn; tên dài hiện tối đa hai dòng
    // (dài hơn thì cắt gọn), không đẩy dòng cao lên.
    const haiDong = await tenDai.evaluate((el) => {
      const cao = Number.parseFloat(getComputedStyle(el).lineHeight);
      return el.clientHeight <= cao * 2 + 1;
    });
    if (!haiDong) throw new Error(`${noi}: tên dài phải gọn trong hai dòng.`);
  }

  await kiemNhomChuaCoXp(page, noi, "(2 người)");
  const chuGiai = page.locator("details", { hasText: "Cách tính cấp" });
  await chuGiai.locator("summary").click();
  if ((await chuGiai.locator("li").count()) !== 10) throw new Error(`${noi}: chú giải phải liệt kê 10 cấp.`);
  const capToi = await chuGiai.locator('li[aria-current="true"]').innerText();
  if (!capToi.includes("Cấp 3") || !capToi.includes("cấp của bạn") || !capToi.includes("250–499"))
    throw new Error(`${noi}: chú giải phải tô cấp 3 (250–499 XP) của người xem. Có: ${capToi}`);
  await kiemBoCuc(n, page, `${noi}, mở chú giải`);
}

async function kiemCacDonVi(n: NguCanhE2E, page: Page, noi: string) {
  await moTab(page, n.web, "pham_vi=cac_don_vi&ky=tuan");
  await kiemBoCuc(n, page, noi);
  const chu = await page.locator('section[aria-labelledby="vi-tri-cua-ban"]').innerText();
  for (const can of ["Đơn vị của bạn", "Hạng 1", "trên 4 đơn vị có XP", "XP/người"])
    if (!chu.includes(can)) throw new Error(`${noi}: thẻ đơn vị thiếu "${can}". Có: ${chu}`);
  if (!(await page.getByText(/^Xếp theo XP trung bình mỗi người/).isVisible()))
    throw new Error(`${noi}: thiếu câu giải thích XP trung bình.`);
  const buc = await kiemBuc(page, noi, 3);
  if (!/^Đồng hạng\s+3\b/.test((await buc.allInnerTexts())[2]!))
    throw new Error(`${noi}: ô thứ ba của bục phải ghi "Đồng hạng 3".`);
  const tieuDe = await page.locator("table thead th").allInnerTexts();
  if (tieuDe.map((t) => t.replace(/\s+/g, " ").trim()).join("|") !== "Hạng|Đơn vị|Số người|XP/người")
    throw new Error(`${noi}: hàng tiêu đề bảng đơn vị sai: ${tieuDe.join(" | ")}`);
  if (!(await page.locator("table tbody tr").first().innerText()).includes("Đồng hạng"))
    throw new Error(`${noi}: dòng hạng 3 trong bảng phải ghi "Đồng hạng".`);
  if (await page.getByText(/^Cấp \d+$/).count()) throw new Error(`${noi}: tab Các đơn vị không có cấp.`);
  await kiemSoMotDong(page, noi);
  await kiemNhomChuaCoXp(page, noi, "(2 đơn vị)");
}

async function kiemMuaGiai(n: NguCanhE2E, page: Page, noi: string) {
  await moTab(page, n.web, "pham_vi=mua_giai");
  await page.getByRole("heading", { name: /^Nhóm của bạn · Bậc 2/ }).waitFor();
  await kiemBoCuc(n, page, `${noi} (mùa giải)`);
  // innerText theo chữ đang hiện (dấu kết quả in hoa), nên so khớp không phân biệt hoa thường.
  const chu = (await page.locator("main").innerText()).toLowerCase();
  const cu = chu.match(/hạng \d|(lên|giữ|xuống) hạng/);
  if (cu) throw new Error(`${noi}: tab Mùa giải còn chữ cũ "${cu[0]}".`);
  for (const can of ["bậc 2 · đang đứng thứ", "vùng lên bậc", "đang ở vùng lên bậc"])
    if (!chu.includes(can)) throw new Error(`${noi}: tab Mùa giải thiếu "${can}".`);
  const dau = await page.evaluate(() =>
    [...document.querySelectorAll("main span")].some((s) => s.textContent === "Xuống bậc"),
  );
  if (!dau) throw new Error(`${noi}: dấu kết quả tuần trước phải là "Xuống bậc".`);
  if (!(await page.locator('ol[aria-label="Bậc 1 sang bậc 2"]').count()))
    throw new Error(`${noi}: thang bậc phải có nhãn "Bậc 1 sang bậc 2".`);
}

/* ------------------------------------------------------------------ */
/* Màu và hoạt ảnh của bục theo hạng                                   */
/* ------------------------------------------------------------------ */

interface OBuc {
  hang: string;
  nen: string;
  hoatAnh: string;
  so: string;
  quet: string | null;
}

/** Nền và tên hoạt ảnh của từng ô bục, theo thứ tự dòng (hạng 1 trước). Chờ hoạt ảnh của bục chạy xong. */
async function docBuc(page: Page): Promise<OBuc[]> {
  return page.evaluate(async () => {
    const buc = document.querySelector<HTMLElement>(".bxh-buc")!;
    await Promise.all(buc.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => null)));
    return [...buc.querySelectorAll("ol > li > div")].map((o) => {
      const quet = o.querySelector(".bxh-quet");
      return {
        hang: o.querySelector("span")!.textContent!,
        nen: getComputedStyle(o).backgroundColor,
        hoatAnh: getComputedStyle(o).animationName,
        so: getComputedStyle(o.querySelectorAll("span")[1]!).animationName,
        quet: quet
          ? getComputedStyle(quet).display === "none"
            ? "an"
            : getComputedStyle(quet, "::after").animationName
          : null,
      };
    });
  });
}

async function kiemHoatAnhBuc(n: NguCanhE2E, tk: TaiKhoanE2E) {
  const page = await n.moTrang({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await n.dangNhap(page, tk);

  // Không giảm chuyển động: hạng 1 bật lên và có trang trí, đồng hạng 2 cùng một kiểu.
  await moTab(page, n.web, "pham_vi=don_vi&ky=tuan");
  const moiHoatAnh = await page.evaluate(() =>
    document
      .querySelector(".bxh-buc")!
      .getAnimations({ subtree: true })
      .map((a) => {
        const t = a.effect!.getComputedTiming();
        return { dai: Number(t.duration), lap: t.iterations };
      }),
  );
  if (!moiHoatAnh.length) throw new Error("Bục: không có hoạt ảnh nào khi không giảm chuyển động.");
  if (moiHoatAnh.some((a) => a.dai > 1200 || a.lap !== 1))
    throw new Error(`Bục: có hoạt ảnh dài quá 1,2 giây hoặc lặp: ${JSON.stringify(moiHoatAnh)}`);
  const ca = await docBuc(page);
  if (ca[0]!.hoatAnh !== "bxh-len-1" || ca[0]!.so !== "g-bat" || ca[0]!.quet !== "bxh-quet")
    throw new Error(`Bục: hạng 1 phải bật lên, số bật ra và có dải sáng. Có: ${JSON.stringify(ca[0])}`);
  if (ca[1]!.hoatAnh !== "bxh-len-2" || ca[2]!.hoatAnh !== "bxh-len-2" || ca[1]!.so !== "none")
    throw new Error(`Bục: đồng hạng 2 phải cùng kiểu hạng 2, không trang trí. Có: ${JSON.stringify(ca)}`);
  if (ca[0]!.nen !== "rgb(242, 165, 22)" || ca[1]!.nen !== ca[2]!.nen || ca[1]!.nen === ca[0]!.nen)
    throw new Error(`Bục: hạng 1 nền vàng cam, đồng hạng 2 cùng nền khác hạng 1. Có: ${JSON.stringify(ca)}`);
  await kiemBuc(page, "Bục có hoạt ảnh, 375px", 3);
  await chupKhoi(page, 'section[aria-labelledby="ba-hang-dau"]', "6-buc-hoat-anh-xong-375-light");

  // Tab Các đơn vị có đủ ba nấc: hạng 3 hiện ra bằng trượt lên, nền nhạt hơn hạng 2.
  await moTab(page, n.web, "pham_vi=cac_don_vi&ky=tuan");
  const dv = await docBuc(page);
  if (dv[2]!.hoatAnh !== "g-vao-len" || new Set(dv.map((o) => o.nen)).size !== 3)
    throw new Error(`Bục đơn vị: ba hạng phải có ba nền, hạng 3 trượt lên. Có: ${JSON.stringify(dv)}`);

  // Công tắc "Giảm hiệu ứng" trong app (đọc sau khi hydrate), rồi giảm chuyển động của hệ điều hành.
  for (const cach of ["công tắc Giảm hiệu ứng", "hệ điều hành"] as const) {
    const congTac = cach === "công tắc Giảm hiệu ứng";
    await page.evaluate(
      (bat) =>
        bat
          ? localStorage.setItem("qdpl.game.giam-hieu-ung", "1")
          : localStorage.removeItem("qdpl.game.giam-hieu-ung"),
      congTac,
    );
    await page.emulateMedia({ reducedMotion: congTac ? "no-preference" : "reduce" });
    await moTab(page, n.web, "pham_vi=don_vi&ky=tuan");
    if (congTac) await page.locator('.bxh-buc[data-giam-hieu-ung="1"]').waitFor({ state: "attached" });
    const giam = await docBuc(page);
    if (giam.some((o) => o.hoatAnh !== "g-hien" || o.so !== "none") || giam[0]!.quet !== "an")
      throw new Error(`Bục, giảm chuyển động theo ${cach}: chỉ còn hiện dần. Có: ${JSON.stringify(giam)}`);
  }
}

/* ------------------------------------------------------------------ */

export default async function bangXepHang(n: NguCanhE2E) {
  const { toi, khongXp, chuaGan } = await dungDuLieu(n);

  // Người xem 1: cả ba tab, hai khung, sáng và tối. Giảm chuyển động để ảnh tab Mùa giải ổn định.
  const page = await n.moTrang(KHUNG[0]);
  await n.dangNhap(page, toi);
  for (const k of KHUNG) {
    await page.setViewportSize({ width: k.width, height: k.height });
    for (const toiMau of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: toiMau, reducedMotion: "reduce" });
      const noi = `${k.ten}px, ${toiMau === "dark" ? "tối" : "sáng"}`;
      await kiemTrongDonVi(n, page, `Trong đơn vị, ${noi}`, k.width < 640);
      if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== toiMau)
        throw new Error(`${noi}: giao diện không đổi sang ${toiMau}.`);
      await chup(n, page, `1-trong-don-vi-${k.ten}-${toiMau}`);
      await chupKhoi(page, 'section[aria-labelledby="ba-hang-dau"]', `1-buc-${k.ten}-${toiMau}`);
      await kiemCacDonVi(n, page, `Các đơn vị, ${noi}`);
      await chup(n, page, `2-cac-don-vi-${k.ten}-${toiMau}`);
      await chupKhoi(page, 'section[aria-labelledby="ba-hang-dau"]', `2-buc-${k.ten}-${toiMau}`);
      await kiemMuaGiai(n, page, `Mùa giải, ${noi}`);
      await chup(n, page, `3-mua-giai-${k.ten}-${toiMau}`);
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light" });
  await moTab(page, n.web, "pham_vi=don_vi&ky=thang");
  if (!(await page.locator("table thead").innerText()).includes("XP tháng này"))
    throw new Error("Kỳ tháng: cột XP phải ghi 'XP tháng này'.");
  await kiemBoCuc(n, page, "Trong đơn vị, tháng này, 375px");
  await kiemHoatAnhBuc(n, toi);

  // Người xem 2: 0 XP, đội chỉ có 2 người có XP.
  const p2 = await n.moTrang({ width: 375, height: 812 });
  await p2.emulateMedia({ reducedMotion: "reduce" });
  await n.dangNhap(p2, khongXp);
  await moTab(p2, n.web, "pham_vi=don_vi&ky=tuan");
  await kiemBoCuc(n, p2, "0 XP, 375px");
  const the2 = p2.locator('section[aria-labelledby="vi-tri-cua-ban"]');
  if (!(await the2.innerText()).includes("Bạn chưa có XP trong tuần này."))
    throw new Error("0 XP: thẻ vị trí phải ghi 'Bạn chưa có XP trong tuần này.'");
  if ((await the2.getByRole("link").getAttribute("href")) !== "/luyen-tap")
    throw new Error("0 XP: thẻ vị trí phải có liên kết tới /luyen-tap.");
  await kiemBuc(p2, "0 XP, 375px", 2);
  if (await p2.locator("table").count()) throw new Error("0 XP: ít hơn 4 người có XP thì không có bảng.");
  const nhom2 = await kiemNhomChuaCoXp(p2, "0 XP, 375px", "(1 người)");
  await nhom2.locator("summary").click();
  if (!(await nhom2.locator('li[aria-current="true"]').innerText()).includes("(bạn)"))
    throw new Error("0 XP: dòng của mình trong nhóm chưa có XP phải có '(bạn)'.");
  await chup(n, p2, "4-khong-xp-375-light");
  await chupKhoi(p2, 'section[aria-labelledby="ba-hang-dau"]', "4-buc-khong-xp-375-light");
  await p2.emulateMedia({ colorScheme: "dark" });
  await p2.reload();
  await chup(n, p2, "4-khong-xp-375-dark");

  // Người xem 3: chưa gắn đơn vị.
  const p3 = await n.moTrang({ width: 375, height: 812 });
  await n.dangNhap(p3, chuaGan);
  for (const q of ["pham_vi=don_vi", "pham_vi=cac_don_vi"]) {
    await moTab(p3, n.web, q);
    await p3.getByText("Tài khoản chưa gắn đơn vị nên chưa có bảng xếp hạng.").waitFor();
    if (await p3.locator('section[aria-labelledby="vi-tri-cua-ban"]').count())
      throw new Error("Chưa gắn đơn vị: không được hiện thẻ vị trí.");
    await kiemBoCuc(n, p3, `Chưa gắn đơn vị, ${q}`);
  }
  await chup(n, p3, "5-chua-gan-don-vi-375");
  await moTab(p3, n.web, "pham_vi=mua_giai");
  await kiemBoCuc(n, p3, "Chưa gắn đơn vị, mùa giải");
  await chup(n, p3, "5-chua-gan-don-vi-mua-giai-375");
}
