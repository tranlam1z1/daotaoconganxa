/**
 * Nạp dữ liệu tra cứu nhanh (docs/PLAN.md GĐ5) từ data/tra-cuu/*.json vào CSDL.
 *
 * Ba bước, dừng ở bước đầu tiên có lỗi chặn:
 *   1. Kiểm tra hợp lệ tệp (trùng mã, mức phạt, dạng URN, khoảng tốc độ chồng nhau).
 *   2. Kiểm URN căn cứ có trong kho và còn áp dụng tại ngày kiểm tra.
 *      - Dòng `da_duyet` có URN hỏng: LỖI, không nạp. Người học không được thấy mức phạt
 *        dẫn tới điều khoản không tồn tại.
 *      - Dòng `nhap` có URN hỏng: chỉ cảnh báo (dữ liệu đang biên tập). `--nghiem` thì coi là lỗi.
 *   3. Nạp (thêm hoặc cập nhật theo mã) trong một giao dịch.
 *
 * Dùng:
 *   bun run tra-cuu:nap                     kiểm tra rồi nạp
 *   bun run tra-cuu:nap --kiem-tra          chỉ kiểm tra, không ghi CSDL (bước CI)
 *   bun run tra-cuu:nap --ngay 2026-01-01   kiểm URN tại ngày khác hôm nay
 *   bun run tra-cuu:nap --nghiem            URN hỏng ở dòng bản nháp cũng là lỗi
 *   bun run tra-cuu:nap --chap-nhan-trang-thai  lấy trạng thái ghi trong tệp (chỉ CSDL phát triển);
 *                                           mặc định dòng mới hoặc đổi nội dung vào chờ duyệt (GĐ-G0)
 */
import { join } from "node:path";
import {
  canCuCuaDuLieu,
  coSoLieuTocDo,
  type DongMucPhat,
  type DongTaiTrongTep,
  type DongTocDoToiDa,
  kiemTraLuatGiayTo,
  kiemTraMucPhat,
  kiemTraQuyTrinh,
  kiemTraTaiTrong,
  kiemTraTocDoToiDa,
  laNgay,
  type QuyTrinh,
} from "@qdpl/dao-tao";
import {
  type DongLuatGiayToTep,
  type DongLuatPhatNguoiTep,
  type DongLuatVanTaiTep,
  kiemTraCanCuTraCuu,
  napLuatGiayTo,
  napTaiTrong,
  napTocDoToiDa,
  napTraCuuNhanh,
  sql,
} from "@qdpl/db";

const THU_MUC = join(import.meta.dir, "..", "data", "tra-cuu");

export async function docDuLieuTraCuu(): Promise<{ mucPhat: DongMucPhat[]; quyTrinh: QuyTrinh[] }> {
  const mp = (await Bun.file(join(THU_MUC, "muc-phat.json")).json()) as { dong: DongMucPhat[] };
  const qt = (await Bun.file(join(THU_MUC, "quy-trinh.json")).json()) as { quy_trinh: QuyTrinh[] };
  return { mucPhat: mp.dong ?? [], quyTrinh: qt.quy_trinh ?? [] };
}

/** Tốc độ tối đa theo loại đường (docs/PLAN.md GĐ-G2). Dòng chưa có số liệu là khung chờ điền. */
export async function docTocDoToiDa(): Promise<DongTocDoToiDa[]> {
  const f = Bun.file(join(THU_MUC, "toc-do-toi-da.json"));
  if (!(await f.exists())) return [];
  return ((await f.json()) as { dong: DongTocDoToiDa[] }).dong ?? [];
}

/**
 * Luật giấy tờ của trò Kiểm tra giấy tờ (docs/PLAN.md GĐ-T1), hoặc luật kiểm hồ sơ của trò Duyệt hồ sơ
 * phạt nguội (GĐ-T11, tệp luat-ho-so-phat-nguoi.json, nhóm ho_so_phat_nguoi), hoặc luật vận tải hành
 * khách của trò Lên xe khách (GĐ-T13, tệp luat-van-tai-khach.json, nhóm van_tai_khach).
 */
export async function docLuatGiayTo<T = DongLuatGiayToTep>(tep = "luat-giay-to.json"): Promise<T[]> {
  const f = Bun.file(join(THU_MUC, tep));
  if (!(await f.exists())) return [];
  return ((await f.json()) as { dong: T[] }).dong ?? [];
}

/** Kiểm tệp luật giấy tờ: dạng từng luật (bộ kiểm chung) và mã không trùng. */
export function kiemTraTepLuatGiayTo(
  ds: Array<DongLuatGiayToTep | DongLuatPhatNguoiTep | DongLuatVanTaiTep>,
): Array<{ ma: string; loi: string }> {
  const kq: Array<{ ma: string; loi: string }> = [];
  const daCo = new Set<string>();
  for (const d of ds) {
    if (daCo.has(d.ma)) kq.push({ ma: d.ma, loi: "Mã luật bị trùng." });
    daCo.add(d.ma);
    for (const loi of kiemTraLuatGiayTo({ ...d, version: 1 })) kq.push({ ma: d.ma, loi });
    if (!laNgay(d.hieu_luc_tu)) kq.push({ ma: d.ma, loi: "Ngày hiệu lực phải có dạng YYYY-MM-DD." });
  }
  return kq;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const chiKiemTra = args.includes("--kiem-tra");
  const nghiem = args.includes("--nghiem");
  const iNgay = args.indexOf("--ngay");
  const ngay = iNgay >= 0 ? args[iNgay + 1]! : new Date().toISOString().slice(0, 10);

  const { mucPhat, quyTrinh } = await docDuLieuTraCuu();
  const tocDo = await docTocDoToiDa();
  const tocDoCoSo = tocDo.filter(coSoLieuTocDo);
  const luatGiayTo = await docLuatGiayTo();
  const luatPhatNguoi = await docLuatGiayTo<DongLuatPhatNguoiTep>("luat-ho-so-phat-nguoi.json");
  const luatVanTai = await docLuatGiayTo<DongLuatVanTaiTep>("luat-van-tai-khach.json");
  const luatMoiNhom = [...luatGiayTo, ...luatPhatNguoi, ...luatVanTai];
  // Giới hạn tải trọng của trò Trạm cân (GĐ-T12): cùng khuôn đọc với luật giấy tờ.
  const taiTrong = await docLuatGiayTo<DongTaiTrongTep>("tai-trong.json");
  console.log(
    `Đọc ${mucPhat.length} dòng mức phạt, ${quyTrinh.length} quy trình, ${tocDo.length} dòng tốc độ tối đa (${tocDo.length - tocDoCoSo.length} dòng chưa có số liệu, không nạp).`,
  );

  // 1. Hợp lệ tệp
  const loiTep = [
    ...kiemTraMucPhat(mucPhat),
    ...kiemTraQuyTrinh(quyTrinh),
    ...kiemTraTocDoToiDa(tocDo),
    ...kiemTraTepLuatGiayTo(luatMoiNhom),
    ...kiemTraTaiTrong(taiTrong),
    ...luatPhatNguoi
      .filter((d) => d.nhom !== "ho_so_phat_nguoi")
      .map((d) => ({ ma: d.ma, loi: "Luật trong tệp hồ sơ phạt nguội phải có nhom = ho_so_phat_nguoi." })),
    ...luatVanTai
      .filter((d) => d.nhom !== "van_tai_khach")
      .map((d) => ({ ma: d.ma, loi: "Luật trong tệp vận tải hành khách phải có nhom = van_tai_khach." })),
  ];
  if (loiTep.length) {
    console.log(`\nDữ liệu không hợp lệ (${loiTep.length} lỗi):`);
    for (const l of loiTep) console.log(`  [${l.ma}] ${l.loi}`);
    await sql.end();
    process.exit(1);
  }
  console.log("Tệp dữ liệu hợp lệ.");

  // 2. URN căn cứ
  const hong = await kiemTraCanCuTraCuu(
    [
      ...new Set([
        ...canCuCuaDuLieu(mucPhat, quyTrinh),
        ...tocDoCoSo.map((d) => d.can_cu),
        ...luatMoiNhom.map((d) => d.can_cu),
        ...taiTrong.map((d) => d.can_cu),
      ]),
    ],
    ngay,
  );
  const urnDaDuyet = new Set([
    ...canCuCuaDuLieu(
      mucPhat.filter((d) => d.trang_thai === "da_duyet"),
      quyTrinh.filter((q) => q.trang_thai === "da_duyet"),
    ),
    ...tocDoCoSo.filter((d) => d.trang_thai === "da_duyet").map((d) => d.can_cu),
    ...luatMoiNhom.filter((d) => d.trang_thai === "da_duyet").map((d) => d.can_cu),
    ...taiTrong.filter((d) => d.trang_thai === "da_duyet").map((d) => d.can_cu),
  ]);
  const hongChan = hong.filter((h) => nghiem || urnDaDuyet.has(h.urn));
  const hongCanhBao = hong.filter((h) => !hongChan.includes(h));

  console.log(`\nKiểm căn cứ tại ngày ${ngay}: ${hong.length} URN hỏng.`);
  for (const h of hongChan) console.log(`  [LỖI] ${h.urn}\n          ${h.lyDo}`);
  for (const h of hongCanhBao) console.log(`  [bản nháp] ${h.urn}\n          ${h.lyDo}`);

  const soNhap =
    mucPhat.filter((d) => d.trang_thai === "nhap").length +
    quyTrinh.filter((q) => q.trang_thai === "nhap").length;
  if (soNhap) console.log(`\nCòn ${soNhap} mục ở trạng thái bản nháp: người học chưa thấy các mục này.`);

  if (hongChan.length) {
    console.log(`\n${hongChan.length} URN hỏng ở dữ liệu đã duyệt. Không nạp.`);
    await sql.end();
    process.exit(1);
  }

  // 3. Nạp
  if (chiKiemTra) {
    console.log("\nChế độ chỉ kiểm tra: không ghi CSDL.");
  } else {
    // Tệp chỉ là nguồn nhập: dòng mới hoặc đổi nội dung vào chờ duyệt, duyệt trong ứng dụng
    // (docs/PLAN.md GĐ-G0). --chap-nhan-trang-thai lấy trạng thái trong tệp, chỉ cho CSDL phát triển.
    const r = await napTraCuuNhanh(mucPhat, quyTrinh, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
    });
    console.log(
      `\nĐã nạp ${r.mucPhat} dòng mức phạt, ${r.quyTrinh} quy trình; ${r.ngung} mục không còn trong tệp chuyển sang ngừng.`,
    );
    const td = await napTocDoToiDa(tocDo, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
    });
    console.log(`Đã nạp ${td.daNap} dòng tốc độ tối đa; bỏ qua ${td.boQua} dòng chưa có số liệu.`);
    const lg = await napLuatGiayTo(luatGiayTo, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
    });
    console.log(`Đã nạp ${lg.daNap} luật giấy tờ; ${lg.ngung} luật không còn trong tệp chuyển sang ngừng.`);
    const pn = await napLuatGiayTo(luatPhatNguoi, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
      nhom: "ho_so_phat_nguoi",
    });
    console.log(
      `Đã nạp ${pn.daNap} luật kiểm hồ sơ phạt nguội; ${pn.ngung} luật không còn trong tệp chuyển sang ngừng.`,
    );
    const vt = await napLuatGiayTo(luatVanTai, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
      nhom: "van_tai_khach",
    });
    console.log(
      `Đã nạp ${vt.daNap} luật vận tải hành khách; ${vt.ngung} luật không còn trong tệp chuyển sang ngừng.`,
    );
    const tt = await napTaiTrong(taiTrong, {
      cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet",
    });
    console.log(
      `Đã nạp ${tt.daNap} giới hạn tải trọng; ${tt.ngung} dòng không còn trong tệp chuyển sang ngừng.`,
    );
  }
  await sql.end();
}
