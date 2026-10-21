/**
 * Kịch bản E2E trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4), khung điện thoại 360×740.
 *
 * Dữ liệu: bản sao có tiền tố của luật giấy tờ (duyệt sẵn), quy trình "dung-xe-kiem-tra" được đưa về
 * đã duyệt trong lúc chạy rồi trả lại trạng thái cũ, và 3 tình huống demo màn 1–3 trong
 * data/tro-choi/dung-xe.json (nạp có tiền tố, duyệt ngay trong kịch bản).
 *
 * Kiểm:
 * 1. Chế độ thường: màn 1 bằng cử chỉ thật của chuột (vuốt lên, chạm lời thoại, kéo từng giấy tờ vào
 *    khay, kéo thẻ kết quả vào "Cho đi"); có mũi tên "Tiếp theo"; sau khi chấm bảng chơi còn cảnh và dải
 *    từng bước; bảng so sánh với quy trình chuẩn, giấy tờ, biên bản chỉ có trong "Xem chi tiết" của hộp
 *    kết quả (GĐ17c), đủ số bước, số lỗi, số dòng căn cứ như máy chủ trả, ghi "Căn cứ đang được cập
 *    nhật"; đóng hộp vẫn thấy dải từng bước; màn "Xem lại từng câu" cũng có đủ; tổng kết; không cuộn ngang.
 * 2. Giảm chuyển động: màn 2 chỉ bằng đường thay thế (nút "Không vuốt được?", chạm giấy rồi chạm khay,
 *    bàn phím cho thẻ kết quả); cố ý đề nghị xuất trình trước khi nói lý do để thấy diễn biến xấu và
 *    bước "sai thứ tự" ở màn kết quả; không có hoạt ảnh trang trí.
 */
import { type BuocDungXe, type ChiTietDungXe, type QuyTrinh, TRO_CHOI_DUNG_XE } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, type DongLuatGiayToTep, napLuatGiayTo, napTraCuuNhanh } from "@qdpl/db";
import type { Locator, Page } from "playwright-core";
import { napTinhHuongDungXe, type TinhHuongDungXeTep } from "../../packages/db/src/seed-tro-choi.ts";
import { type NguCanhE2E, TIEN_TO } from "./chay.ts";
import { chiTietDaCham, demCanCu, dongHopXemBang, moChiTietRieng, moXemLai } from "./hop-ket-qua.ts";

const PREFIX = `${TIEN_TO}dx-`;
const MA_QT = "dung-xe-kiem-tra";
const TEN_GIAY: Record<string, string> = {
  gplx: "Giấy phép lái xe",
  dang_ky: "Giấy chứng nhận đăng ký xe",
  bao_hiem: "Giấy chứng nhận bảo hiểm bắt buộc trách nhiệm dân sự",
};

async function chuanBi(n: NguCanhE2E) {
  const luat = ((await Bun.file("data/tra-cuu/luat-giay-to.json").json()) as { dong: DongLuatGiayToTep[] })
    .dong;
  n.donDep(() => n.sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`);
  await napLuatGiayTo(
    luat.map((d) => ({ ...d, ma: `${PREFIX}${d.ma}`, trang_thai: "da_duyet" })),
    { tienTo: PREFIX },
  );

  const qt = (
    (await Bun.file("data/tra-cuu/quy-trinh.json").json()) as { quy_trinh: QuyTrinh[] }
  ).quy_trinh.find((q) => q.ma === MA_QT)!;
  const [cu] = (await n.sql`SELECT status FROM procedures WHERE code = ${MA_QT}`) as any[];
  n.donDep(() =>
    cu
      ? n.sql`UPDATE procedures SET status = ${cu.status} WHERE code = ${MA_QT}`
      : n.sql`DELETE FROM procedures WHERE code = ${MA_QT}`,
  );
  await napTraCuuNhanh([], [{ ...qt, trang_thai: "da_duyet" }], { tienTo: MA_QT });

  const mau = ((await Bun.file("data/tro-choi/dung-xe.json").json()) as { tinh_huong: TinhHuongDungXeTep[] })
    .tinh_huong;
  n.donDep(() => n.sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`);
  const tao = await napTinhHuongDungXe({
    tienToTen: PREFIX,
    tinhHuong: mau.filter((t) => t.tinh_huong.muc <= 3),
  });
  if (tao.daTao !== 3) throw new Error(`Cần tạo 3 tình huống demo, tạo được ${tao.daTao}.`);
  for (const r of (await n.sql`SELECT id FROM game_content WHERE title LIKE ${`${PREFIX}%`}`) as any[]) {
    const kq = await chuyenTrangThaiNoiDung({
      id: r.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: `${PREFIX}duyet`,
    });
    if (!kq?.ok) throw new Error(`Không duyệt được tình huống ${r.id}: ${JSON.stringify(kq)}`);
  }
  const [g] = (await n.sql`SELECT enabled FROM games WHERE code = 'dung_xe'`) as any[];
  n.donDep(() => n.sql`UPDATE games SET enabled = ${Boolean(g?.enabled)} WHERE code = 'dung_xe'`);
  await n.sql`UPDATE games SET enabled = true WHERE code = 'dung_xe'`;
}

async function vaoMan(n: NguCanhE2E, page: Page, tkId: string, man: number): Promise<BuocDungXe> {
  await page.goto(`${n.web}/tro-choi`);
  await page.getByRole("link", { name: "Dừng xe đúng quy trình", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Dừng xe đúng quy trình" })
    .getByRole("button", { name: new RegExp(`^Màn ${man}:`) })
    .click();
  await page.waitForURL(/\/tro-choi\/luot\//);
  const boQua = page.getByRole("button", { name: "Bỏ qua" });
  await page.getByText("Tình huống 1/1").waitFor();
  // Màn hướng dẫn hiện ở lượt đầu của mỗi trình duyệt (nhớ bằng localStorage), sau khi trang dựng xong.
  if (
    await boQua.waitFor({ timeout: 5000 }).then(
      () => true,
      () => false,
    )
  )
    await boQua.click();
  await page.getByText("Tình huống 1/1").waitFor();
  const [luot] = (await n.sql`
    SELECT items FROM game_runs WHERE account_id = ${tkId} ORDER BY started_at DESC LIMIT 1`) as any[];
  return luot.items[0].noi_dung;
}

/** Kéo bằng chuột thật (Pointer Events), từ giữa phần tử này tới giữa phần tử kia. */
async function keo(page: Page, tu: ReturnType<Page["locator"]>, den: ReturnType<Page["locator"]>) {
  // Cuộn tới ô thả trước: vật và ô phải cùng nằm trong khung nhìn, như khi người chơi kéo bằng tay.
  await den.scrollIntoViewIfNeeded();
  await tu.scrollIntoViewIfNeeded();
  const a = (await tu.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  const b = (await den.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

const SO_SANH = "So với quy trình chuẩn";
const KHOI = [SO_SANH, "Diễn biến", "Giấy tờ"];

/**
 * Hộp kết quả (GĐ17c): bảng so sánh, giấy tờ, biên bản chỉ hiện sau "Xem chi tiết"; đủ số bước, số lỗi
 * giấy tờ và số dòng căn cứ như `chi_tiet` máy chủ trả. Trả vùng chi tiết.
 */
async function moKetQua(n: NguCanhE2E, page: Page, tkId: string, noi: string): Promise<Locator> {
  const vung = await moChiTietRieng(page, KHOI, noi);
  await kiemChiTiet(vung, await chiTietDaCham<ChiTietDungXe>(n, TRO_CHOI_DUNG_XE, tkId, 1), noi);
  return vung;
}

async function kiemChiTiet(vung: Locator, ct: ChiTietDungXe, noi: string) {
  const soBuoc = await vung.locator(`[aria-label="${SO_SANH}"] li`).count();
  if (soBuoc !== ct.so_sanh.length)
    throw new Error(`${noi}: chi tiết có ${soBuoc} bước, cần ${ct.so_sanh.length}.`);
  const soLoi = await vung.locator('section[aria-label="Lỗi giấy tờ"] > ul > li').count();
  if (soLoi !== ct.loi_giay_to.length)
    throw new Error(`${noi}: chi tiết có ${soLoi} lỗi giấy tờ, cần ${ct.loi_giay_to.length}.`);
  const canCu =
    ct.so_sanh.length +
    ct.loi_giay_to.filter((l) => l.can_cu).length +
    ct.bien_ban.filter((d) => d.can_cu.length).length;
  const co = await demCanCu(vung);
  if (co !== canCu) throw new Error(`${noi}: chi tiết có ${co} dòng căn cứ, cần ${canCu}.`);
}

/** Đóng hộp: bảng chơi còn dải từng bước; xong lượt thì màn "Xem lại từng câu" có đủ chi tiết. */
async function ketThucLuot(n: NguCanhE2E, page: Page, tkId: string, noi: string) {
  await dongHopXemBang(page, page.getByRole("list", { name: "Các bước của quy trình chuẩn" }), noi);
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await page.locator("#tong-ket").waitFor({ state: "attached" });
  const vung = await moXemLai(page, 1, KHOI);
  await kiemChiTiet(
    vung,
    await chiTietDaCham<ChiTietDungXe>(n, TRO_CHOI_DUNG_XE, tkId, 1),
    `${noi}, xem lại`,
  );
}

export default async function dungXe(n: NguCanhE2E) {
  await chuanBi(n);
  const tk = await n.taoTaiKhoan({ ten: "dx" });

  // 1. Chế độ thường, màn 1, cử chỉ thật.
  {
    const page = await n.moTrang();
    await n.dangNhap(page, tk);
    const b = await vaoMan(n, page, tk.id, 1);
    if (!(await page.getByText("↓ Tiếp theo").first().isVisible()))
      throw new Error("Màn 1 thiếu mũi tên gợi ý.");
    const o = page.getByRole("button", { name: /Vuốt lên để giơ tay/ });
    await o.scrollIntoViewIfNeeded();
    const hop = (await o.boundingBox())!;
    await page.mouse.move(hop.x + hop.width / 2, hop.y + hop.height - 10);
    await page.mouse.down();
    await page.mouse.move(hop.x + hop.width / 2, hop.y + 10, { steps: 6 });
    await page.mouse.up();
    await page.getByText("Xe giảm tốc").waitFor();
    await page.getByRole("button", { name: /Chào, thông báo lý do dừng xe/ }).click();
    await page.getByRole("button", { name: /Đề nghị xuất trình giấy tờ/ }).click();
    for (const g of ["gplx", "dang_ky", "bao_hiem"] as const) {
      const khay = b.giay_to_dung[g] === "dat" ? "Khay Đạt" : "Khay Không đạt";
      await keo(
        page,
        page.getByRole("button", { name: new RegExp(`^${TEN_GIAY[g]}`) }),
        page.getByRole("button", { name: khay }),
      );
    }
    await n.kiemKhongCuonNgang(page, "dừng xe màn 1 đang chơi");
    await n.chupAnh(page, "man-1-dang-choi");
    await keo(
      page,
      page.getByRole("button", { name: /Kết quả kiểm tra/ }),
      page.getByRole("button", { name: "Cho đi", exact: true }),
    );
    const vung = await moKetQua(n, page, tk.id, "Màn 1");
    if (!(await vung.getByText("Căn cứ: Căn cứ đang được cập nhật").first().isVisible()))
      throw new Error("Màn kết quả không ghi căn cứ đang cập nhật.");
    const ket = (await vung.locator(`[aria-label="${SO_SANH}"] li`).allTextContents()).join("\n");
    if (/không làm/.test(ket)) throw new Error(`Màn 1 làm đủ mà có bước "không làm":\n${ket}`);
    await n.kiemKhongCuonNgang(page, "dừng xe màn 1 kết quả");
    await n.chupAnh(page, "man-1-ket-qua");
    await ketThucLuot(n, page, tk.id, "Màn 1");
    await page.close();
  }

  // 2. Giảm chuyển động, màn 2, chỉ đường thay thế; cố ý sai thứ tự.
  {
    const page = await n.moTrang();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await n.dangNhap(page, tk);
    const b = await vaoMan(n, page, tk.id, 2);
    await page.getByRole("button", { name: "Không vuốt được? Chạm để ra hiệu lệnh" }).click();
    await page
      .getByRole("button", {
        name: new RegExp(b.tinh_huong.vi_tri.find((v) => v.ma === b.vi_tri_an_toan[0])!.ten),
      })
      .click();
    await page.getByRole("button", { name: /Đề nghị xuất trình giấy tờ/ }).click();
    await page.getByText("khó chịu vì chưa được biết lý do").waitFor();
    await page.getByRole("button", { name: /Chào, thông báo lý do dừng xe/ }).click();
    for (const g of ["gplx", "dang_ky", "bao_hiem"] as const) {
      await page.getByRole("button", { name: new RegExp(`^${TEN_GIAY[g]}`) }).click();
      await page
        .getByRole("button", { name: b.giay_to_dung[g] === "dat" ? "Khay Đạt" : "Khay Không đạt" })
        .click();
    }
    const hoat = await page.evaluate(() =>
      [...document.querySelectorAll(".g-t")].map((el) =>
        getComputedStyle(el).transitionDuration.split(",")[0]!.trim(),
      ),
    );
    if (hoat.some((d) => Number.parseFloat(d || "0") > 0.01))
      throw new Error(`Giảm chuyển động mà còn chuyển động trang trí: ${hoat}`);
    // Thẻ kết quả bằng bàn phím: Tab tới thẻ, Enter, rồi tới ô, Enter.
    await page.getByRole("button", { name: /Kết quả kiểm tra/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Lập biên bản", exact: true }).focus();
    await page.keyboard.press("Enter");
    const vung = await moKetQua(n, page, tk.id, "Màn 2");
    const ket = (await vung.locator(`[aria-label="${SO_SANH}"] li`).allTextContents()).join("\n");
    if (!/sai thứ tự/.test(ket)) throw new Error(`Không thấy bước sai thứ tự ở màn kết quả:\n${ket}`);
    await n.kiemKhongCuonNgang(page, "dừng xe màn 2 kết quả");
    await n.chupAnh(page, "man-2-giam-chuyen-dong");
    await ketThucLuot(n, page, tk.id, "Màn 2");
    await page.close();
  }
}
