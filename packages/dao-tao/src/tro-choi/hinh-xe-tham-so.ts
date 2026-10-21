/**
 * Bộ dựng hình xe từ tham số (GĐ-T14, trò "Soi xe cải tạo"; T19 "Tạm giữ phương tiện" dùng lại).
 *
 * Từ tham số xe gốc (loại xe, kích thước, thùng, lốp, số chỗ, màu) và các biến đổi cải tạo, dựng hai hình
 * nhìn nghiêng và nhìn sau dạng danh sách nét (path SVG) có kiểu tô, KHÔNG gắn tên bộ phận. Cùng hình học đó
 * cho vùng đáp án của từng biến đổi (hộp bao, đơn vị hình), nên vùng đáp án không phải soạn tay.
 *
 * Đơn vị hình: 1 đơn vị = TY_LE_MM mm, để thước đo trên hình đọc ra mm. Hàm thuần, tất định.
 */
import type { KichThuocMm, ThongSoKyThuat } from "./chung/giay-to.ts";

export const TY_LE_MM = 10;

export const LOAI_XE_HINH = ["o_to_con", "xe_khach_16", "xe_tai_thung"] as const;
export type LoaiXeHinh = (typeof LOAI_XE_HINH)[number];
export const TEN_LOAI_XE_HINH: Record<LoaiXeHinh, string> = {
  o_to_con: "Ô tô con",
  xe_khach_16: "Ô tô khách 16 chỗ",
  xe_tai_thung: "Ô tô tải thùng kín",
};

/** Màu sơn: tên in trên giấy và màu vẽ. */
export const MAU_SON = {
  trang: ["Trắng", "#e9edf1"],
  bac: ["Bạc", "#aab3bd"],
  do: ["Đỏ", "#b83a2e"],
  xanh: ["Xanh dương", "#2f67a8"],
  xanh_la: ["Xanh lá", "#3d8a57"],
  den: ["Đen", "#2a2e35"],
  vang: ["Vàng", "#d9a634"],
} as const;
export type MauSon = keyof typeof MAU_SON;

export interface ThamSoXe {
  loai: LoaiXeHinh;
  /** Kích thước bao. Xe tải: dài = thùng + 2.050, cao = thùng + 1.000, rộng = thùng + 100 (kiểm ở bộ kiểm). */
  dai_mm: number;
  rong_mm: number;
  cao_mm: number;
  thung: KichThuocMm | null;
  lop: { co: string; duong_kinh_mm: number };
  so_cho: number;
  mau: MauSon;
}

/** Các biến đổi cải tạo bộ dựng hình biết vẽ. Danh mục có duyệt (game_content) trỏ tới một kiểu này. */
export const KIEU_BIEN_DOI = [
  "doi_mau_son",
  "den_noc",
  "ong_xa_do",
  "lop_khac_co",
  "thung_cao_them",
  "thung_dai_them",
  "them_ghe",
] as const;
export type KieuBienDoi = (typeof KIEU_BIEN_DOI)[number];

export interface ThamSoBienDoi {
  mau?: MauSon;
  duong_kinh_mm?: number;
  them_mm?: number;
}
export interface BienDoi {
  kieu: KieuBienDoi;
  tham_so: ThamSoBienDoi;
}

/** Kiểu tô của một nét. Chỉ là màu, không phải tên bộ phận ("do": đỏ, "sang": vàng sáng). */
export type KieuNet = "son" | "hang" | "kinh" | "toi" | "sang" | "ghe" | "do";
const LOP_VE: readonly KieuNet[] = ["son", "hang", "kinh", "toi", "ghe", "sang", "do"];

export interface NetVe {
  d: string;
  kieu: KieuNet;
}
export type GocNhin = "nghieng" | "sau";
export interface HinhGoc {
  goc: GocNhin;
  rong: number;
  cao: number;
  net: NetVe[];
}
/** Hộp [x0, y0, x1, y1], đơn vị hình. */
export type Hop = [number, number, number, number];

export interface HinhXe {
  hinh: Record<GocNhin, HinhGoc>;
  /** Màu vẽ phần sơn (màu thật của xe sau cải tạo). */
  mau_ve: string;
  /** Vùng đáp án của từng biến đổi (theo thứ tự `bienDoi`): các hộp theo góc nhìn. Chỉ máy chủ dùng để chấm. */
  vung: Array<Array<{ goc: GocNhin; hop: Hop }>>;
  /** Hộp bao phần sơn theo góc nhìn (vùng của biến đổi màu sơn). */
  than: Record<GocNhin, Hop>;
}

/* ------------------------------------------------------------------ */

const r = (n: number) => Math.round(n);
const hcn = (x0: number, y0: number, x1: number, y1: number) =>
  `M${r(x0)} ${r(y0)}H${r(x1)}V${r(y1)}H${r(x0)}Z`;
const daGiac = (ds: Array<[number, number]>) => `M${ds.map(([x, y]) => `${r(x)} ${r(y)}`).join("L")}Z`;
const tron = (cx: number, cy: number, bk: number) =>
  `M${r(cx - bk)} ${r(cy)}a${r(bk)} ${r(bk)} 0 1 0 ${r(2 * bk)} 0a${r(bk)} ${r(bk)} 0 1 0 ${r(-2 * bk)} 0Z`;
const noi = (h: Hop, m: number): Hop => [r(h[0] - m), r(h[1] - m), r(h[2] + m), r(h[3] + m)];
/** Đường vẽ tự do: các lệnh SVG với tọa độ làm tròn (số trong mảng được làm tròn, chữ giữ nguyên). */
const duong = (...p: Array<string | number>) => p.map((x) => (typeof x === "number" ? r(x) : x)).join(" ");
/** Hình chữ nhật bo góc bán kính `bk`. */
const hcnBo = (x0: number, y0: number, x1: number, y1: number, bk: number) =>
  duong(
    "M",
    x0 + bk,
    y0,
    "H",
    x1 - bk,
    "Q",
    x1,
    y0,
    x1,
    y0 + bk,
    "V",
    y1 - bk,
    "Q",
    x1,
    y1,
    x1 - bk,
    y1,
    "H",
    x0 + bk,
    "Q",
    x0,
    y1,
    x0,
    y1 - bk,
    "V",
    y0 + bk,
    "Q",
    x0,
    y0,
    x0 + bk,
    y0,
    "Z",
  );
/** Hốc bánh (nửa đĩa phía trên tâm bánh), bán kính `bk`, đáy ở `day`. */
const hocBanh = (cx: number, cy: number, bk: number, day: number) =>
  duong("M", cx - bk, day, "V", cy, "A", bk, bk, 0, 0, 1, cx + bk, cy, "V", day, "Z");
/** Lưng ghế nhìn ngang: tựa đầu và tựa lưng, tâm `cx`, từ `y0` xuống `y1`. */
const lungGhe = (cx: number, y0: number, y1: number, rong: number) => {
  const dau = (y1 - y0) * 0.28;
  return `${hcnBo(cx - rong * 0.32, y0, cx + rong * 0.32, y0 + dau, 2)} ${hcnBo(cx - rong / 2, y0 + dau + 1, cx + rong / 2, y1, 3)}`;
};
const gop = (a: Hop, b: Hop): Hop => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];

/** Lề trái, phải (chỗ cho ống xả nhô ra), trên (chỗ cho đèn nóc), dưới. */
const LE_NGANG = 30;
const LE_TREN = 30;
const LE_DUOI = 10;
/** Xe tải: cabin dài 1.800 mm, khe 50 mm, đuôi 200 mm; sàn thùng cao 1.000 mm. */
const CABIN = 180;
const SAN = 100;

/** Tham số xe sau khi áp các biến đổi. */
function apDung(x: ThamSoXe, ds: readonly BienDoi[]) {
  const thung = x.thung ? { ...x.thung } : null;
  const co = (k: KieuBienDoi) => ds.find((b) => b.kieu === k);
  if (thung && co("thung_cao_them")) thung.cao_mm += co("thung_cao_them")!.tham_so.them_mm ?? 0;
  if (thung && co("thung_dai_them")) thung.dai_mm += co("thung_dai_them")!.tham_so.them_mm ?? 0;
  return {
    loai: x.loai,
    dai: (thung ? thung.dai_mm + 2050 : x.dai_mm) / TY_LE_MM,
    rong: x.rong_mm / TY_LE_MM,
    cao: (thung ? thung.cao_mm + 1000 : x.cao_mm) / TY_LE_MM,
    thung: thung && {
      dai: thung.dai_mm / TY_LE_MM,
      rong: thung.rong_mm / TY_LE_MM,
      cao: thung.cao_mm / TY_LE_MM,
    },
    bk: (co("lop_khac_co")?.tham_so.duong_kinh_mm ?? x.lop.duong_kinh_mm) / TY_LE_MM / 2,
    mau: co("doi_mau_son")?.tham_so.mau ?? x.mau,
    denNoc: !!co("den_noc"),
    ongXa: !!co("ong_xa_do"),
    themGhe: !!co("them_ghe"),
  };
}

type XeVe = ReturnType<typeof apDung>;

/**
 * Hình nhìn nghiêng, đầu xe bên trái. Dáng xe theo loại: ô tô con (ca-pô, kính lái nghiêng, nóc, cốp), xe khách
 * 16 chỗ (đầu ngắn, dãy kính có hàng ghế bên trong, cửa trượt), xe tải thùng kín (ca-bin đầu bằng, thùng có
 * khung, chắn bùn, bình dầu). Hốc bánh theo cỡ lốp GỐC: lốp to hơn giấy thì tràn khỏi hốc, nhìn là thấy.
 */
function veNghieng(v: XeVe, goc: XeVe) {
  const W = v.dai + 2 * LE_NGANG;
  const H = v.cao + LE_TREN + LE_DUOI;
  const nen = H - LE_DUOI;
  const x0 = LE_NGANG;
  const x1 = x0 + v.dai;
  const top = nen - v.cao;
  const L = v.dai;
  const C = v.cao;
  const net: NetVe[] = [];
  const them = (d: string, kieu: KieuNet) => net.push({ d, kieu });
  const vung: Partial<Record<KieuBienDoi, Hop[]>> = {};
  const hoc = (cx: number, day: number) => them(hocBanh(cx, nen - goc.bk, goc.bk * 1.16, day), "toi");
  let than: Hop;
  let noc: [number, number];
  let duoiThan: number;

  // Bánh xe: trước, sau (xe tải thêm một bánh sau).
  const banh =
    v.loai === "xe_tai_thung" ? [x0 + 45, x1 - 60, x1 - 60 - 2.3 * v.bk] : [x0 + L * 0.18, x1 - L * 0.2];

  if (v.loai === "o_to_con") {
    const tb = nen - C * 0.55;
    duoiThan = nen - 12;
    const mui = nen - C * 0.5;
    // Thân: mũi bo, ca-pô dốc lên kính lái, nóc, kính hậu dốc xuống cốp, đuôi bo.
    them(
      duong(
        "M",
        x0 + 8,
        duoiThan,
        "Q",
        x0,
        duoiThan,
        x0,
        duoiThan - 10,
        "L",
        x0,
        mui + 8,
        "Q",
        x0,
        mui,
        x0 + L * 0.05,
        mui,
        "L",
        x0 + L * 0.27,
        tb - C * 0.04,
        "L",
        x0 + L * 0.37,
        top + 3,
        "Q",
        x0 + L * 0.39,
        top,
        x0 + L * 0.42,
        top,
        "L",
        x0 + L * 0.65,
        top,
        "Q",
        x0 + L * 0.69,
        top,
        x0 + L * 0.72,
        top + 5,
        "L",
        x0 + L * 0.85,
        tb - C * 0.06,
        "L",
        x0 + L * 0.97,
        tb - C * 0.04,
        "Q",
        x1,
        tb - C * 0.04,
        x1,
        tb + 6,
        "L",
        x1,
        duoiThan - 10,
        "Q",
        x1,
        duoiThan,
        x1 - 8,
        duoiThan,
        "Z",
      ),
      "son",
    );
    const yk = tb - C * 0.05;
    const yt = top + 6;
    them(
      daGiac([
        [x0 + L * 0.3, yk],
        [x0 + L * 0.38, yt],
        [x0 + L * 0.52, yt],
        [x0 + L * 0.52, yk],
      ]),
      "kinh",
    );
    them(
      daGiac([
        [x0 + L * 0.54, yk],
        [x0 + L * 0.54, yt],
        [x0 + L * 0.67, yt],
        [x0 + L * 0.81, yk],
      ]),
      "kinh",
    );
    // Khe cửa trước, cửa sau; tay nắm; gương; nẹp sườn giữa hai hốc bánh.
    for (const k of [0.285, 0.53, 0.7])
      them(hcn(x0 + L * k, tb - C * 0.04, x0 + L * k + 1.5, duoiThan - 3), "toi");
    for (const k of [0.45, 0.64]) them(hcn(x0 + L * k, tb + 6, x0 + L * k + 11, tb + 9), "toi");
    them(
      daGiac([
        [x0 + L * 0.29, tb - C * 0.02],
        [x0 + L * 0.28, tb - C * 0.11],
        [x0 + L * 0.315, tb - C * 0.11],
        [x0 + L * 0.325, tb - C * 0.02],
      ]),
      "toi",
    );
    them(hcn(x0 + L * 0.27, duoiThan - 4, x0 + L * 0.71, duoiThan), "toi");
    for (const cx of banh) hoc(cx, duoiThan);
    them(
      daGiac([
        [x0 + 1, mui + 5],
        [x0 + L * 0.07, mui + 2],
        [x0 + L * 0.065, mui + 9],
        [x0 + 1, mui + 12],
      ]),
      "sang",
    );
    them(hcn(x1 - 7, tb + 5, x1, tb + 14), "do");
    than = [x0, top, x1, duoiThan];
    noc = [x0 + L * 0.42, x0 + L * 0.65];
  } else if (v.loai === "xe_khach_16") {
    duoiThan = nen - 14;
    const mui = nen - C * 0.5;
    // Thân: đầu ngắn, kính lái nghiêng lớn, nóc thẳng, đuôi vuông bo góc.
    them(
      duong(
        "M",
        x0 + 10,
        duoiThan,
        "Q",
        x0,
        duoiThan,
        x0,
        duoiThan - 10,
        "L",
        x0,
        mui + 10,
        "Q",
        x0,
        mui,
        x0 + L * 0.05,
        mui - 4,
        "L",
        x0 + L * 0.135,
        top + 14,
        "Q",
        x0 + L * 0.155,
        top,
        x0 + L * 0.19,
        top,
        "L",
        x1 - 8,
        top,
        "Q",
        x1,
        top,
        x1,
        top + 8,
        "L",
        x1,
        duoiThan - 8,
        "Q",
        x1,
        duoiThan,
        x1 - 8,
        duoiThan,
        "Z",
      ),
      "son",
    );
    them(
      daGiac([
        [x0 + L * 0.058, mui - 8],
        [x0 + L * 0.138, top + 17],
        [x0 + L * 0.175, top + 8],
        [x0 + L * 0.175, mui - 8],
      ]),
      "kinh",
    );
    // Dãy cửa sổ khoang khách, thấy lưng ghế bên trong; cửa sổ cuối là khoang hành lý (thêm ghế thì thấy ghế ở đây).
    const n = 4;
    const tu = x0 + L * 0.2;
    const buoc = (x1 - 8 - tu) / n;
    for (let i = 0; i < n; i++) {
      const a = tu + i * buoc + 3;
      const b = tu + (i + 1) * buoc - 3;
      them(hcnBo(a, top + 8, b, top + C * 0.42, 3), "kinh");
      if (i < n - 1 || v.themGhe)
        for (const k of [0.3, 0.7])
          them(lungGhe(a + (b - a) * k, top + C * 0.17, top + C * 0.42, Math.min(24, (b - a) * 0.36)), "ghe");
      if (i === n - 1) vung.them_ghe = [[r(a), r(top + 8), r(b), r(top + C * 0.42)]];
    }
    // Khe cửa lái, cửa trượt; tay nắm; gương; cản trước, cản sau; nẹp sườn.
    const sau = tu + 2 * buoc;
    for (const x of [x0 + L * 0.185, sau]) them(hcn(x, top + C * 0.44, x + 1.5, duoiThan - 4), "toi");
    them(hcn(x0 + L * 0.185, top + C * 0.44, sau, top + C * 0.44 + 1.5), "toi");
    them(hcn(sau - 18, top + C * 0.52, sau - 6, top + C * 0.52 + 3), "toi");
    them(
      daGiac([
        [x0 + L * 0.04, mui - 12],
        [x0 + L * 0.025, mui - 32],
        [x0 + L * 0.045, mui - 34],
        [x0 + L * 0.06, mui - 14],
      ]),
      "toi",
    );
    them(hcn(x0 + 2, duoiThan - 18, x0 + L * 0.07, duoiThan - 8), "toi");
    them(hcn(x1 - L * 0.05, duoiThan - 16, x1 - 2, duoiThan - 6), "toi");
    them(hcn(x0 + L * 0.25, duoiThan - 4, x1 - L * 0.28, duoiThan), "toi");
    for (const cx of banh) hoc(cx, duoiThan);
    them(
      daGiac([
        [x0 + 1, mui + 12],
        [x0 + 16, mui + 10],
        [x0 + 16, mui + 22],
        [x0 + 1, mui + 24],
      ]),
      "sang",
    );
    them(hcn(x1 - 7, top + C * 0.5, x1, top + C * 0.68), "do");
    than = [x0, top, x1, duoiThan];
    noc = [x0 + L * 0.25, x0 + L * 0.6];
  } else {
    const t = v.thung!;
    const tg = goc.thung!;
    duoiThan = nen - 16;
    const cabTop = nen - Math.min(v.cao, 300) * 0.8;
    const cx1 = x0 + CABIN;
    // Ca-bin đầu bằng: mặt trước gần đứng, nóc bo.
    them(
      duong(
        "M",
        x0 + 3,
        duoiThan,
        "L",
        x0,
        nen - 70,
        "L",
        x0 + 3,
        cabTop + 40,
        "Q",
        x0 + 6,
        cabTop,
        x0 + 34,
        cabTop,
        "L",
        cx1 - 5,
        cabTop,
        "Q",
        cx1,
        cabTop,
        cx1,
        cabTop + 6,
        "L",
        cx1,
        duoiThan,
        "Z",
      ),
      "son",
    );
    them(
      daGiac([
        [x0 + 4, cabTop + 92],
        [x0 + 7, cabTop + 14],
        [x0 + 18, cabTop + 8],
        [x0 + 18, cabTop + 92],
      ]),
      "kinh",
    );
    them(
      daGiac([
        [x0 + 26, cabTop + 92],
        [x0 + 26, cabTop + 24],
        [x0 + 40, cabTop + 10],
        [x0 + 122, cabTop + 10],
        [x0 + 122, cabTop + 92],
      ]),
      "kinh",
    );
    // Cửa ca-bin (khe, tay nắm), bậc lên xuống, gương, cản trước.
    const dayCua = nen - goc.bk * 2.16 - 4;
    for (const x of [x0 + 21, x0 + 126]) them(hcn(x, cabTop + 6, x + 2, dayCua), "toi");
    them(hcn(x0 + 21, dayCua - 2, x0 + 128, dayCua), "toi");
    them(hcn(x0 + 100, cabTop + 102, x0 + 112, cabTop + 106), "toi");
    for (const y of [nen - 60, nen - 38]) them(hcn(x0 + 95, y, x0 + 140, y + 5), "toi");
    them(hcn(x0 - 6, cabTop + 36, x0 + 6, cabTop + 39), "toi");
    them(hcnBo(x0 - 12, cabTop + 28, x0 - 5, cabTop + 72, 2), "toi");
    them(hcn(x0 - 2, nen - 58, x0 + 12, duoiThan), "toi");
    hoc(banh[0]!, duoiThan);
    // Sát-xi, thùng kín có khung viền và cột đứng.
    them(hcn(cx1, nen - SAN * 0.95, x1, nen - SAN * 0.8), "toi");
    const bx0 = cx1 + 5;
    const bx1 = bx0 + t.dai;
    const bDay = nen - SAN * 0.95;
    const bTop = bDay - t.cao;
    them(hcn(bx0, bTop, bx1, bDay), "hang");
    for (let i = 1; i < 4; i++)
      them(hcn(bx0 + (t.dai * i) / 4 - 0.5, bTop + 2, bx0 + (t.dai * i) / 4 + 0.5, bDay - 2), "toi");
    them(hcn(bx0, bTop, bx1, bTop + 3), "toi");
    them(hcn(bx0, bDay - 4, bx1, bDay), "toi");
    them(hcn(bx0, bTop, bx0 + 3, bDay), "toi");
    them(hcn(bx1 - 3, bTop, bx1, bDay), "toi");
    // Chắn bùn trên cụm bánh sau (theo cỡ lốp gốc), bình dầu, thanh chắn hông.
    const sauX = banh.slice(1);
    const xa = Math.min(...sauX) - v.bk - 6;
    const xb = Math.max(...sauX) + v.bk + 6;
    them(hcn(xa, nen - 2 * goc.bk - 9, xb, nen - 2 * goc.bk - 4), "toi");
    const coBinh = cx1 + 82 < xa - 6;
    if (coBinh) them(hcnBo(cx1 + 20, nen - 80, cx1 + 78, nen - 50, 6), "ghe");
    const chanTu = cx1 + (coBinh ? 86 : 20);
    if (xa - 4 - chanTu > 20) them(hcn(chanTu, nen - 58, xa - 4, nen - 54), "toi");
    them(hcn(x0 - 1, nen - 74, x0 + 8, nen - 62), "sang");
    them(hcn(x1 - 7, bDay - 2, x1, bDay + 8), "do");
    than = [x0, cabTop, cx1, duoiThan];
    noc = [x0 + 20, cx1 - 20];
    const cuTop = bDay - tg.cao;
    if (t.cao > tg.cao) vung.thung_cao_them = [[r(bx0), r(bTop), r(bx1), r(cuTop + 10)]];
    const cuX1 = bx0 + tg.dai;
    if (t.dai > tg.dai) vung.thung_dai_them = [[r(cuX1 - 10), r(bTop), r(bx1), r(bDay)]];
  }

  const hopBanh: Hop[] = [];
  for (const cx of banh) {
    them(tron(cx, nen - v.bk, v.bk), "toi");
    them(tron(cx, nen - v.bk, v.bk * 0.58), "ghe");
    hopBanh.push([r(cx - v.bk), r(nen - 2 * v.bk), r(cx + v.bk), r(nen)]);
  }
  if (v.bk !== goc.bk) vung.lop_khac_co = hopBanh;
  const mai = v.loai === "xe_tai_thung" ? nen - Math.min(v.cao, 300) * 0.8 : top;
  if (v.denNoc) {
    const h: Hop = [noc[0], mai - 9, noc[1], mai - 1];
    them(hcn(...h), "sang");
    them(hcn(noc[0] + 8, mai - 1, noc[0] + 12, mai), "toi");
    them(hcn(noc[1] - 12, mai - 1, noc[1] - 8, mai), "toi");
    vung.den_noc = [noi(h, 4)];
  }
  if (v.ongXa) {
    const h: Hop = [x1 - 25, duoiThan - 3, x1 + 18, duoiThan + 6];
    them(hcn(...h), "toi");
    them(tron(x1 + 15, duoiThan + 1.5, 3), "ghe");
    vung.ong_xa_do = [noi(h, 4)];
  }
  return { hinh: { goc: "nghieng" as const, rong: r(W), cao: r(H), net }, vung, than: than.map(r) as Hop };
}

/** Hình nhìn sau: kính hậu, đèn hậu đỏ, biển số, cản sau, gương hai bên; xe tải thấy cửa thùng có thanh khóa. */
function veSau(v: XeVe, goc: XeVe) {
  const W = v.rong + 2 * LE_NGANG;
  const H = v.cao + LE_TREN + LE_DUOI;
  const nen = H - LE_DUOI;
  const x0 = LE_NGANG;
  const x1 = x0 + v.rong;
  const top = nen - v.cao;
  const R = v.rong;
  const C = v.cao;
  const giua = (x0 + x1) / 2;
  const net: NetVe[] = [];
  const them = (d: string, kieu: KieuNet) => net.push({ d, kieu });
  const vung: Partial<Record<KieuBienDoi, Hop[]>> = {};
  const rongBanh = Math.max(14, v.bk * 0.75);
  const duoiThan = nen - v.bk * 0.9;
  let than: Hop;
  let mai: number;
  let noc: [number, number];

  if (v.loai === "xe_tai_thung") {
    const t = v.thung!;
    const tg = goc.thung!;
    const bDay = nen - SAN * 0.95;
    const bTop = bDay - t.cao;
    const bx0 = x0 + (v.rong - t.rong) / 2;
    const bx1 = bx0 + t.rong;
    them(hcn(bx0, bTop, bx1, bDay), "hang");
    // Hai cánh cửa thùng: khe giữa, bốn thanh khóa đứng, khung viền.
    them(hcn((bx0 + bx1) / 2 - 0.5, bTop + 2, (bx0 + bx1) / 2 + 0.5, bDay - 2), "toi");
    for (const k of [0.2, 0.36, 0.64, 0.8])
      them(hcn(bx0 + t.rong * k - 1, bTop + 8, bx0 + t.rong * k + 1, bDay - 6), "toi");
    them(hcn(bx0, bTop, bx1, bTop + 3), "toi");
    them(hcn(bx0, bDay - 4, bx1, bDay), "toi");
    them(hcn(x0 + 8, bDay, x1 - 8, bDay + 12), "toi");
    them(hcn(giua - 18, bDay + 15, giua + 18, bDay + 27), "hang");
    const cabTop = nen - Math.min(v.cao, 300) * 0.8;
    them(hcn(x0 + 12, cabTop, x1 - 12, bTop < cabTop ? cabTop + 4 : cabTop + 10), "son");
    than = [x0 + 12, cabTop, x1 - 12, cabTop + 10];
    them(hcn(x0 + 4, bDay + 2, x0 + 16, bDay + 10), "do");
    them(hcn(x1 - 16, bDay + 2, x1 - 4, bDay + 10), "do");
    them(hcn(x0 + 17, bDay + 2, x0 + 23, bDay + 10), "sang");
    them(hcn(x1 - 23, bDay + 2, x1 - 17, bDay + 10), "sang");
    mai = cabTop;
    noc = [x0 + 30, x1 - 30];
    const cuTop = bDay - tg.cao;
    if (t.cao > tg.cao) vung.thung_cao_them = [[r(bx0), r(bTop), r(bx1), r(cuTop + 10)]];
  } else {
    const con = v.loai === "o_to_con";
    const tb = con ? nen - C * 0.55 : top;
    const bo = con ? 6 : 12;
    // Thân dưới (xe khách: cả thân), bo góc.
    them(
      duong(
        "M",
        x0 + bo,
        tb,
        "H",
        x1 - bo,
        "Q",
        x1,
        tb,
        x1,
        tb + bo,
        "V",
        duoiThan - 8,
        "Q",
        x1,
        duoiThan,
        x1 - 8,
        duoiThan,
        "H",
        x0 + 8,
        "Q",
        x0,
        duoiThan,
        x0,
        duoiThan - 8,
        "V",
        tb + bo,
        "Q",
        x0,
        tb,
        x0 + bo,
        tb,
        "Z",
      ),
      "son",
    );
    if (con) {
      them(
        duong(
          "M",
          x0 + R * 0.08,
          tb,
          "L",
          x0 + R * 0.19,
          top + 4,
          "Q",
          x0 + R * 0.2,
          top,
          x0 + R * 0.24,
          top,
          "H",
          x1 - R * 0.24,
          "Q",
          x1 - R * 0.2,
          top,
          x1 - R * 0.19,
          top + 4,
          "L",
          x1 - R * 0.08,
          tb,
          "Z",
        ),
        "son",
      );
      them(
        daGiac([
          [x0 + R * 0.14, tb - 3],
          [x0 + R * 0.225, top + 7],
          [x1 - R * 0.225, top + 7],
          [x1 - R * 0.14, tb - 3],
        ]),
        "kinh",
      );
      them(hcnBo(x0 + 3, tb + 6, x0 + R * 0.22, tb + 17, 2), "do");
      them(hcnBo(x1 - R * 0.22, tb + 6, x1 - 3, tb + 17, 2), "do");
      them(hcn(giua - 26, tb + C * 0.17, giua + 26, tb + C * 0.17 + 12), "hang");
    } else {
      them(hcnBo(x0 + R * 0.12, top + 10, x1 - R * 0.12, top + C * 0.36, 4), "kinh");
      for (const x of [x0 + R * 0.07, x1 - R * 0.07 - 1.5])
        them(hcn(x, top + 6, x + 1.5, duoiThan - 14), "toi");
      them(hcn(x0 + 3, top + C * 0.45, x0 + 14, top + C * 0.66), "do");
      them(hcn(x1 - 14, top + C * 0.45, x1 - 3, top + C * 0.66), "do");
      them(hcn(giua - 26, top + C * 0.62, giua + 26, top + C * 0.62 + 12), "hang");
    }
    them(hcn(x0 + 2, duoiThan - 12, x1 - 2, duoiThan - 5), "toi");
    const yg = con ? tb - 4 : top + C * 0.35;
    them(hcnBo(x0 - 9, yg, x0 + 1, yg + 9, 2), "son");
    them(hcnBo(x1 - 1, yg, x1 + 9, yg + 9, 2), "son");
    than = [x0, top, x1, duoiThan];
    mai = top;
    noc = [x0 + R * 0.25, x1 - R * 0.25];
  }

  // Lốp: xe tải bánh đôi thấy trọn dưới thùng; xe con, xe khách thấy phần dưới thân.
  const hopBanh: Hop[] = [];
  for (const x of [x0 + 4, x1 - 4 - rongBanh]) {
    const yTren = v.loai === "xe_tai_thung" ? nen - 2 * v.bk * 0.95 : duoiThan - 3;
    const h: Hop = [x, yTren, x + rongBanh, nen];
    if (v.loai === "xe_tai_thung") {
      them(hcnBo(x, yTren, x + rongBanh * 0.47, nen, 2), "toi");
      them(hcnBo(x + rongBanh * 0.53, yTren, x + rongBanh, nen, 2), "toi");
    } else them(hcnBo(...h, 3), "toi");
    hopBanh.push(h.map(r) as Hop);
  }
  if (v.bk !== goc.bk) vung.lop_khac_co = hopBanh;
  // Xe tải: thùng cao hơn cabin thì từ phía sau không thấy đèn trên nóc cabin.
  const biChe = v.loai === "xe_tai_thung" && nen - SAN * 0.95 - v.thung!.cao <= mai - 9;
  if (v.denNoc && !biChe) {
    const h: Hop = [noc[0], mai - 9, noc[1], mai - 1];
    them(hcn(...h), "sang");
    vung.den_noc = [noi(h, 4)];
  }
  if (v.ongXa) {
    const cx = x1 - v.rong * 0.28;
    them(tron(cx, duoiThan + 4, 6), "toi");
    them(tron(cx, duoiThan + 4, 3), "ghe");
    vung.ong_xa_do = [noi([cx - 6, duoiThan - 2, cx + 6, duoiThan + 10], 4)];
  }
  return { hinh: { goc: "sau" as const, rong: r(W), cao: r(H), net }, vung, than: than.map(r) as Hop };
}

const sapNet = (ds: NetVe[]) =>
  [...ds].sort(
    (a, b) => LOP_VE.indexOf(a.kieu) - LOP_VE.indexOf(b.kieu) || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0),
  );

/**
 * Dựng hai hình và vùng đáp án. Nét sắp theo lớp tô rồi theo chuỗi, để thứ tự nét không lộ phần nào được
 * thêm vào. Vùng của biến đổi màu sơn là hộp bao phần sơn (`than`); biến đổi nào không thấy được trên hình
 * (ví dụ thùng dài thêm nhìn từ sau) thì không có hộp ở góc đó.
 */
export function dungHinhXe(xe: ThamSoXe, bienDoi: readonly BienDoi[]): HinhXe {
  const goc = apDung(xe, []);
  const v = apDung(xe, bienDoi);
  const n = veNghieng(v, goc);
  const s = veSau(v, goc);
  return {
    hinh: {
      nghieng: { ...n.hinh, net: sapNet(n.hinh.net) },
      sau: { ...s.hinh, net: sapNet(s.hinh.net) },
    },
    mau_ve: MAU_SON[v.mau][1],
    than: { nghieng: n.than, sau: s.than },
    vung: bienDoi.map((b) =>
      b.kieu === "doi_mau_son"
        ? [
            { goc: "nghieng" as const, hop: n.than },
            { goc: "sau" as const, hop: s.than },
          ]
        : [
            ...(n.vung[b.kieu] ?? []).map((hop) => ({ goc: "nghieng" as const, hop })),
            ...(s.vung[b.kieu] ?? []).map((hop) => ({ goc: "sau" as const, hop })),
          ],
    ),
  };
}

/** Thông số in trên giấy chứng nhận kiểm định: của xe GỐC (trước cải tạo). */
export function thongSoTuXe(x: ThamSoXe): ThongSoKyThuat {
  const t = x.thung;
  return {
    kich_thuoc_bao: t
      ? { dai_mm: t.dai_mm + 2050, rong_mm: x.rong_mm, cao_mm: t.cao_mm + 1000 }
      : { dai_mm: x.dai_mm, rong_mm: x.rong_mm, cao_mm: x.cao_mm },
    kich_thuoc_thung: t ? { ...t } : null,
    co_lop: x.lop.co,
    so_cho: x.so_cho,
    mau_son: MAU_SON[x.mau][0],
    den: "2 đèn chiếu sáng phía trước, 2 đèn phía sau",
  };
}

/** Hộp bao gộp (tiện cho trò dùng lại). */
export const gopHop = gop;
