/**
 * Kịch bản E2E trang Duyệt dữ liệu tra cứu (/quan-tri/du-lieu-tra-cuu), khung máy tính 1280×900:
 *  1. chưa chọn trạng thái thì người duyệt vào thẳng các dòng chờ duyệt; tab loại báo số chờ duyệt;
 *     dòng hiện tóm tắt mức phạt và căn cứ đọc được;
 *  2. duyệt ngay trên dòng; mở một dòng, sửa rồi "Lưu và duyệt" thì trang tự mở dòng chờ duyệt kế tiếp;
 *  3. từ chối ở khung chi tiết cũng tự sang dòng kế; tích "Chọn cả trang" rồi duyệt các dòng còn lại;
 *  4. quy trình: sửa bước bằng ô nhập, đổi thứ tự bước, phần trò chơi của bước được giữ nguyên;
 *  5. khung điện thoại 360×740 không cuộn ngang.
 */
import type { NguCanhE2E } from "./chay.ts";

const URN = "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6.khoan-2";
const DUONG = "/quan-tri/du-lieu-tra-cuu";

export default async function duyetDuLieuTraCuu(n: NguCanhE2E) {
  const tienTo = `e2e-duyet-${crypto.randomUUID().slice(0, 8)}`;
  const mp = [1, 2, 3, 4].map((i) => `${tienTo}-${i}`);
  const qt = `${tienTo}-qt`;
  n.donDep(async () => {
    await n.sql`DELETE FROM violations WHERE code LIKE ${`${tienTo}%`}`;
    await n.sql`DELETE FROM procedures WHERE code LIKE ${`${tienTo}%`}`;
    await n.sql`DELETE FROM content_reviews WHERE ref LIKE ${`${tienTo}%`}`;
  });
  for (const code of mp) {
    await n.sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, point_deduction, citation_urn,
        effective_from, status, created_by)
      VALUES (${code}, 'o_to', ${`E2E hành vi ${code}`}, 400000, 600000, 2, ${URN}, '2025-01-01',
        'cho_duyet', 'e2e')`;
  }
  const buoc = [
    { tieu_de: "Ra hiệu lệnh dừng xe", mo_ta: "Dùng gậy chỉ huy giao thông.", can_cu: null },
    {
      tieu_de: "Chào và thông báo lý do",
      mo_ta: "Chào theo điều lệnh, nêu lý do kiểm tra.",
      can_cu: null,
      tro_choi: {
        ma: "chao_hoi",
        thao_tac: "cham",
        bat_buoc: true,
        dieu_kien: null,
        nguon: "tai_lieu_nghiep_vu",
      },
    },
  ];
  await n.sql`
    INSERT INTO procedures (code, kind, title, steps, status, created_by)
    VALUES (${qt}, 'vi_pham', ${`E2E quy trình ${tienTo}`}, ${n.sql.json(buoc)}, 'nhap', 'e2e')`;

  const dongMucPhat = async (code: string) => {
    const [d] = await n.sql<
      Array<{ status: string; version: number; fine_max: string; reject_reason: string }>
    >`
      SELECT status, version, fine_max, reject_reason FROM violations WHERE code = ${code}`;
    return d!;
  };

  const tk = await n.taoTaiKhoan({ role: "quan_tri", ten: "Quản trị E2E" });
  const page = await n.moTrang({ width: 1280, height: 900 });
  const loiTrang: string[] = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(page, tk);

  // 1. Mặc định vào các dòng chờ duyệt; tab loại báo số chờ duyệt; dòng có tóm tắt và căn cứ đọc được.
  await page.goto(`${n.web}${DUONG}?loai=muc-phat&q=${tienTo}`);
  await page.getByText("4 dòng", { exact: true }).waitFor();
  const tabLoai = page.getByRole("navigation", { name: "Loại dữ liệu" });
  const nhanTab = (await tabLoai.getByRole("link", { name: /^Mức phạt/ }).textContent()) ?? "";
  const soCho = Number(/\((\d+)/.exec(nhanTab)?.[1] ?? 0);
  if (soCho < 4) throw new Error(`Tab Mức phạt phải báo ít nhất 4 dòng chờ duyệt, đang là "${nhanTab}".`);
  const dong1 = page.getByRole("listitem").filter({ hasText: mp[0]! });
  await dong1.getByText("Từ 400.000 đến 600.000 đồng · trừ 2 điểm giấy phép lái xe").waitFor();
  await dong1.getByText("Căn cứ: khoản 2 Điều 6 Nghị định số 168/2024/NĐ-CP").waitFor();
  await n.chupAnh(page, "danh-sach");

  // 2a. Duyệt ngay trên dòng: không mở dòng nào nên trang ở nguyên danh sách.
  await page.getByRole("button", { name: `Duyệt ${mp[0]}`, exact: true }).click();
  await page.getByText(`Đã duyệt ${mp[0]}.`).first().waitFor();
  await page.getByText("3 dòng", { exact: true }).waitFor();
  if ((await dongMucPhat(mp[0]!)).status !== "da_duyet")
    throw new Error("Duyệt trên dòng không có tác dụng.");

  // 2b. Mở dòng 2: căn cứ có dòng đọc được và liên kết; chưa sửa thì nút chính là "Duyệt".
  await page.getByRole("link", { name: new RegExp(mp[1]!) }).click();
  const chiTiet = page.getByRole("region", { name: new RegExp(`^${mp[1]}`) });
  await chiTiet.getByRole("heading", { name: `${mp[1]} · phiên bản 1` }).waitFor();
  await chiTiet.getByText("khoản 2 Điều 6 Nghị định số 168/2024/NĐ-CP").waitFor();
  const moDieu = await chiTiet.getByRole("link", { name: "Mở điều khoản" }).getAttribute("href");
  if (!moDieu?.includes("dieu=dieu-6")) throw new Error(`Liên kết mở điều khoản sai: ${moDieu}.`);
  await chiTiet.getByRole("button", { name: "Duyệt", exact: true }).waitFor();

  // Sửa mức phạt: nút chính đổi thành "Lưu và duyệt"; bấm thì lưu, duyệt và mở dòng 3.
  await chiTiet.getByLabel("Phạt đến (đồng)").fill("800000");
  await Promise.all([
    page.waitForURL((u) => u.searchParams.get("ma") === mp[2] && u.searchParams.get("truoc") === mp[1]),
    chiTiet.getByRole("button", { name: "Lưu và duyệt", exact: true }).click(),
  ]);
  await page.getByText(`Đã duyệt ${mp[1]}. Đã mở dòng kế tiếp.`).first().waitFor();
  const d2 = await dongMucPhat(mp[1]!);
  if (d2.status !== "da_duyet" || Number(d2.fine_max) !== 800000 || d2.version !== 1) {
    throw new Error(`Sau "Lưu và duyệt", dòng 2 sai: ${JSON.stringify(d2)}.`);
  }

  // 3a. Từ chối dòng 3 ở khung chi tiết: trang mở dòng 4.
  const chiTiet3 = page.getByRole("region", { name: new RegExp(`^${mp[2]}`) });
  await chiTiet3.getByRole("heading", { name: `${mp[2]} · phiên bản 1` }).waitFor();
  await chiTiet3.getByText("Từ chối", { exact: true }).click();
  await chiTiet3.getByLabel("Lý do từ chối").fill("Mức tiền chưa khớp nguyên văn.");
  await Promise.all([
    page.waitForURL((u) => u.searchParams.get("ma") === mp[3] && u.searchParams.get("vua") === "tu-choi"),
    chiTiet3.getByRole("button", { name: "Gửi từ chối", exact: true }).click(),
  ]);
  const d3 = await dongMucPhat(mp[2]!);
  if (d3.status !== "tu_choi" || d3.reject_reason !== "Mức tiền chưa khớp nguyên văn.") {
    throw new Error(`Sau khi từ chối, dòng 3 sai: ${JSON.stringify(d3)}.`);
  }

  // 3b. Còn một dòng chờ duyệt: tích cả trang rồi duyệt một lần.
  await page.getByText("1 dòng", { exact: true }).waitFor();
  await page.getByLabel("Chọn cả trang").check();
  await page.getByRole("button", { name: "Duyệt các dòng đã chọn", exact: true }).click();
  await page.getByText("Đã duyệt 1 dòng.").first().waitFor();
  await page.getByText("Không có dòng nào chờ duyệt").waitFor();
  if ((await dongMucPhat(mp[3]!)).status !== "da_duyet")
    throw new Error("Duyệt nhiều dòng không có tác dụng.");

  // 4. Quy trình nháp: bước sửa bằng ô nhập; đưa bước 2 lên đầu, sửa mô tả, lưu và duyệt.
  await page.goto(`${n.web}${DUONG}?loai=quy-trinh&trang_thai=nhap&q=${tienTo}&ma=${qt}`);
  const chiTietQt = page.getByRole("region", { name: new RegExp(`^${qt}`) });
  if ((await chiTietQt.getByLabel("Việc cần làm").count()) !== 2) throw new Error("Phải có 2 khối bước.");
  if (!(await chiTietQt.getByLabel("Bước này dùng trong trò chơi").nth(1).isChecked())) {
    throw new Error("Bước 2 phải được đánh dấu dùng trong trò chơi.");
  }
  if ((await chiTietQt.getByLabel("Loại bước").inputValue()) !== "chao_hoi") {
    throw new Error("Ô Loại bước phải mang mã của phần trò chơi.");
  }
  await chiTietQt.getByRole("button", { name: "Đưa bước 2 lên" }).click();
  await chiTietQt.getByLabel("Mô tả").first().fill("Chào theo điều lệnh, thông báo lý do kiểm tra.");
  await n.chupAnh(page, "quy-trinh");
  await Promise.all([
    page.waitForURL((u) => u.searchParams.get("truoc") === qt),
    chiTietQt.getByRole("button", { name: "Lưu và duyệt", exact: true }).click(),
  ]);
  await page.getByText(`Đã duyệt ${qt}. Mục này không còn dòng nào cần xử lý.`).first().waitFor();
  const [dqt] = await n.sql<Array<{ status: string; steps: typeof buoc }>>`
    SELECT status, steps FROM procedures WHERE code = ${qt}`;
  const [b1, b2] = dqt?.steps ?? [];
  if (
    dqt?.status !== "da_duyet" ||
    b1?.tieu_de !== "Chào và thông báo lý do" ||
    b1.mo_ta !== "Chào theo điều lệnh, thông báo lý do kiểm tra." ||
    b1.tro_choi?.ma !== "chao_hoi" ||
    b1.tro_choi.nguon !== "tai_lieu_nghiep_vu" ||
    b2?.tieu_de !== "Ra hiệu lệnh dừng xe" ||
    "tro_choi" in (b2 ?? {})
  ) {
    throw new Error(`Sau khi sửa bước, quy trình sai: ${JSON.stringify(dqt)}.`);
  }

  // 5. Điện thoại: danh sách và khung chi tiết không cuộn ngang.
  const dt = await n.moTrang();
  dt.on("pageerror", (e) => loiTrang.push(e.message));
  await n.dangNhap(dt, tk);
  await dt.goto(`${n.web}${DUONG}?loai=muc-phat&trang_thai=tat_ca&q=${tienTo}&ma=${mp[2]}`);
  await dt.getByRole("heading", { name: `${mp[2]} · phiên bản 1` }).waitFor();
  await n.kiemKhongCuonNgang(dt, "trang duyệt dữ liệu tra cứu");
  await n.chupAnh(dt, "dien-thoai");

  if (loiTrang.length) throw new Error(`Có lỗi JavaScript trên trang: ${loiTrang.join("; ")}`);
}
