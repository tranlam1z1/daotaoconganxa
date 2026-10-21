/**
 * Bộ kiểm dạng dữ liệu của trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14): xe và mục danh mục biến thể cải tạo
 * (game_content). Chỉ máy chủ và script nạp dùng; tách khỏi soi-xe-cai-tao.ts để mã tải xuống điện thoại gọn.
 */

import { DONG_THONG_SO, laNgay } from "./chung/giay-to.ts";
import { KIEU_BIEN_DOI, LOAI_XE_HINH, MAU_SON, type ThamSoXe } from "./hinh-xe-tham-so.ts";
import { type BienTheCaiTao, SO_MAN_SOI_XE, type XeCaiTao } from "./soi-xe-cai-tao.ts";

const chuoi = (v: unknown, min = 1) => typeof v === "string" && v.trim().length >= min;
const trong = (v: unknown, tu: number, den: number) =>
  Number.isInteger(v) && (v as number) >= tu && (v as number) <= den;

/** Khoảng hợp lệ của kích thước theo loại xe (mm): dài, rộng, cao, số chỗ. Chỉ để chặn số vô lý. */
const KHOANG: Record<
  ThamSoXe["loai"],
  { dai: [number, number]; rong: [number, number]; cao: [number, number]; cho: [number, number] }
> = {
  o_to_con: { dai: [3500, 5200], rong: [1600, 2000], cao: [1350, 1800], cho: [4, 8] },
  xe_khach_16: { dai: [5000, 7500], rong: [1800, 2200], cao: [2200, 2900], cho: [10, 29] },
  xe_tai_thung: { dai: [4500, 9100], rong: [1700, 2500], cao: [2500, 3400], cho: [2, 3] },
};

function kiemTraThamSoXe(x: Partial<ThamSoXe> | undefined): string[] {
  if (!x || !(LOAI_XE_HINH as readonly string[]).includes(x.loai as string)) return ["Loại xe không hợp lệ."];
  const loi: string[] = [];
  const k = KHOANG[x.loai!];
  if (!trong(x.dai_mm, ...k.dai) || !trong(x.rong_mm, ...k.rong) || !trong(x.cao_mm, ...k.cao))
    loi.push("Kích thước bao ngoài khoảng hợp lý của loại xe.");
  if (!trong(x.so_cho, ...k.cho)) loi.push("Số chỗ ngoài khoảng hợp lý của loại xe.");
  if (!x.mau || !Object.hasOwn(MAU_SON, x.mau)) loi.push("Màu sơn không hợp lệ.");
  if (!x.lop || !chuoi(x.lop.co, 5) || !trong(x.lop.duong_kinh_mm, 500, 1200))
    loi.push("Lốp cần cỡ và đường kính (mm).");
  const t = x.thung;
  if (x.loai === "xe_tai_thung") {
    if (!t || !trong(t.dai_mm, 2500, 7000) || !trong(t.rong_mm, 1600, 2400) || !trong(t.cao_mm, 1500, 2400))
      loi.push("Xe tải cần kích thước lòng thùng hợp lý.");
    else if (x.dai_mm !== t.dai_mm + 2050 || x.cao_mm !== t.cao_mm + 1000 || x.rong_mm !== t.rong_mm + 100)
      loi.push("Xe tải: kích thước bao phải bằng thùng + (2.050 dài, 100 rộng, 1.000 cao) mm.");
  } else if (t) loi.push("Chỉ xe tải có thùng.");
  return loi;
}

/** Kiểm dạng một xe. Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraXeCaiTao(p: (Partial<XeCaiTao> & { muc?: number }) | null | undefined): string[] {
  if (!p || typeof p !== "object") return ["Thiếu dữ kiện xe."];
  const loi: string[] = [];
  if (!trong(p.muc, 1, SO_MAN_SOI_XE)) loi.push(`Màn của xe (muc) phải từ 1 đến ${SO_MAN_SOI_XE}.`);
  if (!chuoi(p.bien_so, 5) || !laNgay(p.ngay_kiem_tra))
    loi.push("Xe cần biển số và ngày kiểm tra (YYYY-MM-DD).");
  if (!p.giay || !chuoi(p.giay.so, 3) || !laNgay(p.giay.co_gia_tri_den))
    loi.push("Giấy kiểm định cần số và thời hạn.");
  loi.push(...kiemTraThamSoXe(p.xe));
  const bt = p.bien_the;
  if (!Array.isArray(bt) || bt.length > 3) return [...loi, "Xe có tối đa 3 biến thể."];
  if (new Set(bt.map((b) => b?.ma)).size !== bt.length) loi.push("Một biến thể chỉ áp một lần.");
  for (const b of bt) {
    if (!b || !chuoi(b.ma, 3) || !b.tham_so || typeof b.tham_so !== "object") {
      loi.push("Biến thể cần mã và tham số.");
      continue;
    }
    const t = b.tham_so;
    if (t.mau !== undefined && (!Object.hasOwn(MAU_SON, t.mau) || t.mau === p.xe?.mau))
      loi.push("Màu mới phải khác màu gốc.");
    if (t.duong_kinh_mm !== undefined && !trong(t.duong_kinh_mm, (p.xe?.lop?.duong_kinh_mm ?? 0) + 60, 1400))
      loi.push("Lốp khác cỡ phải lớn hơn lốp gốc ít nhất 60 mm.");
    if (t.them_mm !== undefined && !trong(t.them_mm, 100, 1500))
      loi.push("Phần cơi nới thêm phải từ 100 đến 1.500 mm.");
  }
  if (p.muc === 1 && bt.length !== 1) loi.push("Màn 1: mỗi xe đúng một chỗ sai.");
  return loi;
}

/** Kiểm dạng một mục danh mục biến thể. */
export function kiemTraBienTheCaiTao(b: Partial<BienTheCaiTao> | null | undefined): string[] {
  if (!b || typeof b !== "object") return ["Thiếu biến thể."];
  const loi: string[] = [];
  if (!chuoi(b.ma, 3) || !chuoi(b.ten, 5)) loi.push("Biến thể cần mã và tên.");
  if (!(KIEU_BIEN_DOI as readonly string[]).includes(b.bien_doi as string))
    loi.push("Kiểu biến đổi không hợp lệ.");
  if (!(DONG_THONG_SO as readonly string[]).includes(b.dong as string)) loi.push("Dòng giấy không hợp lệ.");
  if (
    !Array.isArray(b.loai_xe) ||
    !b.loai_xe.length ||
    b.loai_xe.some((l) => !(LOAI_XE_HINH as readonly string[]).includes(l))
  )
    loi.push("Loại xe áp dụng không hợp lệ.");
  if (!trong(b.man_tu, 1, SO_MAN_SOI_XE)) loi.push("Màn đầu tiên phải từ 1 đến 5.");
  if (b.ma_muc_phat !== null && !chuoi(b.ma_muc_phat, 3)) loi.push("Mã mức phạt phải là mã dòng hoặc null.");
  if (!chuoi(b.can_cu) || !b.can_cu!.startsWith("vn:")) loi.push("Căn cứ phải là URN dạng vn:...");
  if (!chuoi(b.giai_thich, 10)) loi.push("Thiếu giải thích.");
  if (
    (b.bien_doi === "thung_cao_them" || b.bien_doi === "thung_dai_them") &&
    b.loai_xe?.some((l) => l !== "xe_tai_thung")
  )
    loi.push("Biến thể thùng chỉ áp cho xe tải.");
  if (b.bien_doi === "them_ghe" && b.loai_xe?.some((l) => l !== "xe_khach_16"))
    loi.push("Thêm ghế chỉ áp cho xe khách.");
  return loi;
}

/** Xe khớp với danh mục: mọi biến thể có trong danh mục, hợp loại xe, đủ tham số cho kiểu biến đổi. */
export function kiemTraXeVoiDanhMuc(
  x: XeCaiTao,
  danhMuc: readonly Pick<BienTheCaiTao, "ma" | "bien_doi" | "loai_xe">[],
): string[] {
  const loi: string[] = [];
  for (const b of x.bien_the) {
    const d = danhMuc.find((m) => m.ma === b.ma);
    if (!d) {
      loi.push(`Biến thể ${b.ma} không có trong danh mục.`);
      continue;
    }
    if (!d.loai_xe.includes(x.xe.loai)) loi.push(`Biến thể ${b.ma} không áp cho loại xe này.`);
    const t = b.tham_so;
    const can: Partial<Record<(typeof KIEU_BIEN_DOI)[number], boolean>> = {
      doi_mau_son: t.mau !== undefined,
      lop_khac_co: t.duong_kinh_mm !== undefined,
      thung_cao_them: t.them_mm !== undefined,
      thung_dai_them: t.them_mm !== undefined,
    };
    if (can[d.bien_doi] === false) loi.push(`Biến thể ${b.ma} thiếu tham số.`);
  }
  if (new Set(x.bien_the.map((b) => danhMuc.find((m) => m.ma === b.ma)?.bien_doi)).size !== x.bien_the.length)
    loi.push("Mỗi kiểu biến đổi chỉ một lần trên một xe.");
  return loi;
}
