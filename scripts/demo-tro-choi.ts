/**
 * Chuẩn bị trò "Súng bắn tốc độ" và "Cung đường biển báo" cho BẢN DEMO (docs/DEMO.md mục 7a), chỉ
 * chạy trên CSDL demo.
 *
 *   bun run scripts/demo-tro-choi.ts        (bun run demo gọi sẵn bước này)
 *
 * Việc làm, chạy lại được:
 *  1. Nạp 20 tình huống demo vào game_content (chờ duyệt) nếu chưa có.
 *  2. Duyệt 7 khung phạt theo tốc độ, biển P.127 và các tình huống "[Demo]", qua cùng hàm duyệt của
 *     màn hình quản trị. Người duyệt ghi là `demo-tu-dong`, kèm ghi chú "chưa đối chiếu văn bản".
 *  3. Bật trò cho người học.
 *  4. Cung đường biển báo (GĐ-G8): duyệt các biển có phản ứng (dữ liệu demo, chưa đối chiếu QCVN 41)
 *     rồi bật trò.
 *  5. Kiểm tra giấy tờ (GĐ-T1): nạp 30 hồ sơ demo, duyệt luật giấy tờ (bản nháp, chưa đối chiếu Luật
 *     số 36/2024/QH15) và các hồ sơ "[Demo]", rồi bật trò.
 *  6. Cắm biển cho tuyến đường (GĐ-T3): nạp 6 đoạn đường demo, duyệt các đoạn "[Demo]" (sau bước 4,
 *     để lúc duyệt ghi đúng phiên bản các biển đã duyệt), rồi bật trò.
 *  7. Soi camera (GĐ-T5): duyệt 3 dòng mức phạt mà kịch bản trỏ tới (vượt đèn đỏ ô tô, xe máy; không
 *     đội mũ bảo hiểm; bản nháp chưa đối chiếu), nạp 8 kịch bản demo, duyệt các kịch bản "[Demo]", bật trò.
 *  8. Tự lái qua phố (GĐ-T9): nạp 3 khu phố và bảng lỗi demo, duyệt các nội dung "[Demo]", bật trò.
 *  9. Duyệt hồ sơ phạt nguội (GĐ-T11): nạp 30 hồ sơ demo, duyệt các hồ sơ "[Demo]" (luật kiểm hồ sơ cùng
 *     bảng document_rules nên đã duyệt ở bước 5; mức phạt tốc độ, vượt đèn đỏ, mũ bảo hiểm ở bước 2, 7), bật trò.
 * 10. Trạm cân tải trọng (GĐ-T12): duyệt giới hạn tải trọng và các dòng mức phạt có khung phần trăm quá tải
 *     (SỐ MINH HỌA, chưa đối chiếu văn bản), nạp 30 xe demo, duyệt các xe "[Demo]", bật trò.
 * 11. Lên xe khách (GĐ-T13): luật vận tải hành khách cùng bảng document_rules nên đã duyệt ở bước 5 (ngưỡng
 *     thời gian lái là SỐ MINH HỌA; chưa có luật cách tính trẻ em nên 3 xe có trẻ em không vào lượt); duyệt
 *     4 dòng mức phạt vận tải hành khách (SỐ MINH HỌA), nạp 20 xe demo, duyệt các xe "[Demo]", bật trò.
 * 12. Dựng chốt an toàn ban đêm (GĐ-T15): nạp 3 bộ tiêu chí (NGƯỠNG MINH HỌA, chưa có căn cứ, câu D21) và
 *     10 đoạn đường demo, duyệt các nội dung "[Demo]", bật trò.
 * 13. Soi xe cải tạo (GĐ-T14): duyệt 4 dòng mức phạt cải tạo (SỐ MINH HỌA), nạp 7 biến thể (căn cứ chưa tra
 *     được kho) và 16 xe demo, duyệt các nội dung "[Demo]", bật trò.
 * 15. Tái dựng hiện trường (GĐ-T10): duyệt 3 dòng mức phạt khoảng cách, chuyển làn, nhường đường (SỐ MINH
 *     HỌA; tốc độ ở bước 2, vượt đèn đỏ ở bước 7), nạp 5 vụ demo (căn cứ chờ khách hàng, câu D10), duyệt các
 *     vụ "[Demo]", bật trò.
 *
 * Dữ liệu được duyệt ở đây CHƯA đối chiếu Nghị định số 168/2024/NĐ-CP (docs/GAME_DESIGN.md §5.2).
 * Vì vậy script từ chối chạy khi CSDL không phải CSDL demo trên máy.
 */
import {
  chuyenTrangThaiDuLieu,
  chuyenTrangThaiNoiDung,
  napChotDem,
  napDoanDuongCamBien,
  napHoSoPhatNguoi,
  napKichBanSoiCamera,
  napSoiXeCaiTao,
  napTaiDung,
  napTruyVet,
  napTuLai,
  napXeKhach,
  napXeTramCan,
  sql,
} from "@qdpl/db";
import { napHoSoGiayTo, napTinhHuongSungBan } from "../packages/db/src/seed-tro-choi.ts";

const NGUOI_DUYET = "demo-tu-dong";
const GHI_CHU = "Duyệt tự động cho bản demo; chưa đối chiếu văn bản gốc.";

const url = process.env.DATABASE_URL ?? "";
const laDemo = /@(127\.0\.0\.1|localhost)(:\d+)?\/[^/?]*_demo(\?|$)/.test(url);
if (!laDemo) {
  console.error("Dừng: script này chỉ chạy trên CSDL demo trên máy (tên CSDL kết thúc bằng _demo).");
  console.error("Chạy qua `bun run demo`, hoặc đặt DATABASE_URL trỏ vào quydinhphapluat_demo.");
  process.exit(1);
}

// 1. Tình huống demo.
const tao = await napTinhHuongSungBan();
console.log(`Tình huống demo: tạo ${tao.daTao}, đã có ${tao.daCo}.`);

// 2a. Khung phạt theo tốc độ và biển P.127: nháp → chờ duyệt → đã duyệt.
const maKhung = (
  (await sql`SELECT code FROM violations WHERE speed_over_min IS NOT NULL AND status <> 'ngung'`) as any[]
).map((r) => r.code as string);
for (const [loai, codes] of [
  ["muc-phat", maKhung],
  ["bien-bao", ["P.127"]],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai,
    codes: [...codes],
    tu: ["nhap", "tu_choi"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  const duyet = await chuyenTrangThaiDuLieu({
    loai,
    codes: [...codes],
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  console.log(`Duyệt ${loai}: ${duyet.length} dòng.`);
}

// 2b. Tình huống "[Demo]" đang chờ duyệt (hoặc cần xem lại vì khung phạt vừa được duyệt).
const tinhHuong = (await sql`
  SELECT id, status FROM game_content
  WHERE game_code = 'sung_ban_toc_do' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
let daDuyet = 0;
const loi: string[] = [];
for (const t of tinhHuong) {
  if (t.status === "nhap") {
    await chuyenTrangThaiNoiDung({
      id: t.id,
      tu: ["nhap"],
      den: "cho_duyet",
      hanhDong: "gui_duyet",
      actor: NGUOI_DUYET,
    });
  }
  const kq = await chuyenTrangThaiNoiDung({
    id: t.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq?.ok) daDuyet++;
  else if (kq) loi.push(...kq.loi);
}
console.log(
  `Duyệt tình huống: ${daDuyet}.${loi.length ? ` Không duyệt được: ${[...new Set(loi)].join(" ")}` : ""}`,
);

// 3. Bật trò.
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'sung_ban_toc_do'`;
const [{ n }] = (await sql`
  SELECT count(*)::int AS n FROM game_content WHERE game_code = 'sung_ban_toc_do' AND status = 'da_duyet'`) as any;
console.log(`Súng bắn tốc độ: đã bật, ${n} tình huống đã duyệt.`);

// 4. Cung đường biển báo: biển có phản ứng, nháp → chờ duyệt → đã duyệt; rồi bật trò.
const maBien = (
  (await sql`SELECT code FROM traffic_signs WHERE reaction IS NOT NULL AND status <> 'ngung'`) as any[]
).map((r) => r.code as string);
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "bien-bao",
    codes: maBien,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'cung_duong_bien_bao'`;
const [{ nb }] = (await sql`
  SELECT count(*)::int AS nb FROM traffic_signs WHERE reaction IS NOT NULL AND status = 'da_duyet'`) as any;
console.log(`Cung đường biển báo: đã bật, ${nb} biển có phản ứng đã duyệt.`);

// 5. Kiểm tra giấy tờ: luật giấy tờ và hồ sơ demo, nháp → chờ duyệt → đã duyệt; rồi bật trò.
const hs = await napHoSoGiayTo();
console.log(`Hồ sơ giấy tờ demo: tạo ${hs.daTao}, đã có ${hs.daCo}.`);
const maLuat = ((await sql`SELECT code FROM document_rules WHERE status <> 'ngung'`) as any[]).map(
  (r) => r.code as string,
);
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "luat-giay-to",
    codes: maLuat,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
const hoSoCho = (await sql`
  SELECT id FROM game_content
  WHERE game_code = 'kiem_tra_giay_to' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const h of hoSoCho) {
  await chuyenTrangThaiNoiDung({
    id: h.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  await chuyenTrangThaiNoiDung({
    id: h.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'kiem_tra_giay_to'`;
const [{ ng, nl }] = (await sql`
  SELECT (SELECT count(*)::int FROM game_content WHERE game_code = 'kiem_tra_giay_to' AND status = 'da_duyet') AS ng,
         (SELECT count(*)::int FROM document_rules WHERE status = 'da_duyet' AND nhom = 'giay_to_nguoi_lai') AS nl`) as any;
console.log(`Kiểm tra giấy tờ: đã bật, ${ng} hồ sơ và ${nl} luật giấy tờ đã duyệt.`);

// 6. Cắm biển cho tuyến đường: đoạn đường demo, chờ duyệt → đã duyệt (biển đã duyệt ở bước 4); rồi bật trò.
const cb = await napDoanDuongCamBien();
console.log(`Đoạn đường Cắm biển: tạo ${cb.daTao}, đã có ${cb.daCo}.`);
const doanCho = (await sql`
  SELECT id FROM game_content
  WHERE game_code = 'cam_bien' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const d of doanCho) {
  await chuyenTrangThaiNoiDung({
    id: d.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  await chuyenTrangThaiNoiDung({
    id: d.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'cam_bien'`;
const [{ nd }] = (await sql`
  SELECT count(*)::int AS nd FROM game_content WHERE game_code = 'cam_bien' AND status = 'da_duyet'`) as any;
console.log(`Cắm biển cho tuyến đường: đã bật, ${nd} đoạn đường đã duyệt.`);

// 7. Soi camera: mức phạt kịch bản trỏ tới, rồi kịch bản demo; bật trò.
const maPhatCamera = ["oto-den-do", "mt-den-do", "mt-mu-bao-hiem"];
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "muc-phat",
    codes: maPhatCamera,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
const sc = await napKichBanSoiCamera();
console.log(`Kịch bản Soi camera: tạo ${sc.daTao}, đã có ${sc.daCo}.`);
const kichBanCho = (await sql`
  SELECT id FROM game_content
  WHERE game_code = 'soi_camera' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const k of kichBanCho) {
  await chuyenTrangThaiNoiDung({
    id: k.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  await chuyenTrangThaiNoiDung({
    id: k.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'soi_camera'`;
const [{ nk }] = (await sql`
  SELECT count(*)::int AS nk FROM game_content WHERE game_code = 'soi_camera' AND status = 'da_duyet'`) as any;
console.log(`Soi camera: đã bật, ${nk} kịch bản đã duyệt.`);

// 8. Tự lái qua phố (GĐ-T9): khu phố và bảng lỗi demo. Biển đã duyệt ở bước 4; mức phạt tốc độ ở bước 2,
// vượt đèn đỏ ở bước 7 (bảng lỗi chỉ duyệt được khi mọi mức phạt nó trỏ tới đã duyệt). Rồi bật trò.
const tl = await napTuLai();
console.log(`Tự lái qua phố: tạo ${tl.daTao}, đã có ${tl.daCo}.`);
const tuLaiCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'tu_lai' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const k of tuLaiCho) {
  await chuyenTrangThaiNoiDung({
    id: k.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: k.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${k.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'tu_lai'`;
const [{ nt }] = (await sql`
  SELECT count(*)::int AS nt FROM game_content WHERE game_code = 'tu_lai' AND status = 'da_duyet'`) as any;
console.log(`Tự lái qua phố: đã bật, ${nt} nội dung đã duyệt (khu phố và bảng lỗi).`);

// 9. Duyệt hồ sơ phạt nguội (GĐ-T11): luật kiểm hồ sơ đã duyệt ở bước 5 (cùng bảng document_rules); mức
// phạt mà hồ sơ trỏ tới đã duyệt ở bước 2 (tốc độ) và 7 (đèn đỏ, mũ bảo hiểm). Rồi bật trò.
const pn = await napHoSoPhatNguoi();
console.log(`Hồ sơ phạt nguội demo: tạo ${pn.daTao}, đã có ${pn.daCo}.`);
const pnCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'duyet_phat_nguoi' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const h of pnCho) {
  await chuyenTrangThaiNoiDung({
    id: h.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: h.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${h.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'duyet_phat_nguoi'`;
const [{ npn, nlpn }] = (await sql`
  SELECT (SELECT count(*)::int FROM game_content WHERE game_code = 'duyet_phat_nguoi' AND status = 'da_duyet') AS npn,
         (SELECT count(*)::int FROM document_rules WHERE status = 'da_duyet' AND nhom = 'ho_so_phat_nguoi') AS nlpn`) as any;
console.log(`Duyệt hồ sơ phạt nguội: đã bật, ${npn} hồ sơ và ${nlpn} luật kiểm hồ sơ đã duyệt.`);
// 10. Trạm cân tải trọng (GĐ-T12): giới hạn tải trọng và khung phần trăm quá tải (số minh họa), xe demo.
const maTaiTrong = ((await sql`SELECT code FROM load_limits WHERE status <> 'ngung'`) as any[]).map(
  (r) => r.code as string,
);
const maQuaTai = (
  (await sql`SELECT code FROM violations WHERE qua_tai_loai IS NOT NULL AND status <> 'ngung'`) as any[]
).map((r) => r.code as string);
for (const [loai, codes] of [
  ["tai-trong", maTaiTrong],
  ["muc-phat", maQuaTai],
] as const) {
  for (const [tu, den, hanhDong] of [
    [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
    [["cho_duyet"], "da_duyet", "duyet"],
  ] as const) {
    await chuyenTrangThaiDuLieu({
      loai,
      codes,
      tu: [...tu],
      den,
      hanhDong,
      actor: NGUOI_DUYET,
      ghiChu: GHI_CHU,
    });
  }
}
const tc = await napXeTramCan();
console.log(`Xe Trạm cân demo: tạo ${tc.daTao}, đã có ${tc.daCo}.`);
const xeCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'tram_can' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of xeCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'tram_can'`;
const [{ nx, ngh }] = (await sql`
  SELECT (SELECT count(*)::int FROM game_content WHERE game_code = 'tram_can' AND status = 'da_duyet') AS nx,
         (SELECT count(*)::int FROM load_limits WHERE status = 'da_duyet') AS ngh`) as any;
console.log(`Trạm cân tải trọng: đã bật, ${nx} xe và ${ngh} giới hạn tải trọng đã duyệt.`);

// 11. Lên xe khách (GĐ-T13): mức phạt vận tải hành khách (số minh họa), xe demo, bật trò.
const maVanTai = (
  (await sql`SELECT code FROM violations WHERE code LIKE 'oto-khach-%' AND status <> 'ngung'`) as any[]
).map((r) => r.code as string);
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "muc-phat",
    codes: maVanTai,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
const xk = await napXeKhach();
console.log(`Xe khách demo: tạo ${xk.daTao}, đã có ${xk.daCo}.`);
const xkCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'len_xe_khach' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of xkCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'len_xe_khach'`;
const [{ nxk, nlvt }] = (await sql`
  SELECT (SELECT count(*)::int FROM game_content WHERE game_code = 'len_xe_khach' AND status = 'da_duyet') AS nxk,
         (SELECT count(*)::int FROM document_rules WHERE status = 'da_duyet' AND nhom = 'van_tai_khach') AS nlvt`) as any;
console.log(
  `Lên xe khách: đã bật, ${nxk} xe và ${nlvt} luật vận tải hành khách đã duyệt (chưa có luật trẻ em: xe có trẻ em không vào lượt).`,
);

// 12. Dựng chốt an toàn ban đêm (GĐ-T15): bộ tiêu chí (ngưỡng minh họa) và đoạn đường demo, bật trò.
const cd = await napChotDem();
console.log(`Chốt đêm demo: tạo ${cd.daTao}, đã có ${cd.daCo}.`);
const cdCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'chot_dem' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of cdCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'chot_dem'`;
const [{ ncd }] = (await sql`
  SELECT count(*)::int AS ncd FROM game_content
  WHERE game_code = 'chot_dem' AND status = 'da_duyet' AND payload->>'kieu' = 'doan_duong'`) as any;
console.log(`Dựng chốt an toàn ban đêm: đã bật, ${ncd} đoạn đường đã duyệt (ngưỡng chấm là số minh họa).`);

// 13. Soi xe cải tạo (GĐ-T14): mức phạt cải tạo (số minh họa) trước, vì mục danh mục trỏ tới chúng.
const maCaiTao = (
  (await sql`SELECT code FROM violations WHERE code LIKE 'oto-cai-tao-%' AND status <> 'ngung'`) as any[]
).map((r) => r.code as string);
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "muc-phat",
    codes: maCaiTao,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
const sx = await napSoiXeCaiTao();
console.log(`Soi xe cải tạo demo: tạo ${sx.daTao}, đã có ${sx.daCo}.`);
const sxCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'soi_xe_cai_tao' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of sxCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'soi_xe_cai_tao'`;
const [{ nsx }] = (await sql`
  SELECT count(*)::int AS nsx FROM game_content
  WHERE game_code = 'soi_xe_cai_tao' AND status = 'da_duyet' AND payload->>'kieu' = 'xe'`) as any;
console.log(
  `Soi xe cải tạo: đã bật, ${nsx} xe đã duyệt (căn cứ chưa tra được kho, mức phạt là số minh họa).`,
);

// 14. Truy vết xe bỏ trốn (GĐ-T17): 8 vụ demo (bản đồ, biển số hư cấu; lộ trình sinh từ seed), bật trò.
const tv = await napTruyVet();
console.log(`Truy vết demo: tạo ${tv.daTao}, đã có ${tv.daCo}.`);
const tvCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'truy_vet' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of tvCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'truy_vet'`;
const [{ ntv }] = (await sql`
  SELECT count(*)::int AS ntv FROM game_content WHERE game_code = 'truy_vet' AND status = 'da_duyet'`) as any;
console.log(`Truy vết xe bỏ trốn: đã bật, ${ntv} vụ đã duyệt (căn cứ chưa có trong kho văn bản).`);

// 15. Tái dựng hiện trường (GĐ-T10): mức phạt minh họa của ba lỗi mới trước, vì vụ trỏ tới chúng.
const maTaiDung = ["oto-khoang-cach", "oto-chuyen-lan", "oto-nhuong-duong"];
for (const [tu, den, hanhDong] of [
  [["nhap", "tu_choi"], "cho_duyet", "gui_duyet"],
  [["cho_duyet"], "da_duyet", "duyet"],
] as const) {
  await chuyenTrangThaiDuLieu({
    loai: "muc-phat",
    codes: maTaiDung,
    tu: [...tu],
    den,
    hanhDong,
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
}
const td = await napTaiDung();
console.log(`Tái dựng hiện trường demo: tạo ${td.daTao}, đã có ${td.daCo}.`);
const tdCho = (await sql`
  SELECT id, title FROM game_content
  WHERE game_code = 'tai_dung_hien_truong' AND title LIKE '[Demo]%' AND status IN ('nhap', 'cho_duyet')`) as any[];
for (const x of tdCho) {
  await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["nhap"],
    den: "cho_duyet",
    hanhDong: "gui_duyet",
    actor: NGUOI_DUYET,
  });
  const kq = await chuyenTrangThaiNoiDung({
    id: x.id,
    tu: ["cho_duyet"],
    den: "da_duyet",
    hanhDong: "duyet",
    actor: NGUOI_DUYET,
    ghiChu: GHI_CHU,
  });
  if (kq && !kq.ok) console.log(`  Chưa duyệt được "${x.title}": ${kq.loi.join(" ")}`);
}
await sql`UPDATE games SET enabled = true, updated_at = now() WHERE code = 'tai_dung_hien_truong'`;
const [{ ntd }] = (await sql`
  SELECT count(*)::int AS ntd FROM game_content WHERE game_code = 'tai_dung_hien_truong' AND status = 'da_duyet'`) as any;
console.log(
  `Tái dựng hiện trường: đã bật, ${ntd} vụ đã duyệt (mô phỏng minh họa; căn cứ chờ khách hàng cung cấp).`,
);
await sql.end();
