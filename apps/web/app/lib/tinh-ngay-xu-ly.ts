/**
 * Tính ngày hẹn người vi phạm lên làm việc: ngày lập biên bản cộng SO_NGAY_HEN ngày làm việc, đếm
 * từ ngày kế tiếp. Ngày nghỉ gồm thứ Bảy, Chủ nhật và ngày nghỉ lễ, tết theo Điều 112 Bộ luật Lao
 * động 2019, cộng ngày nghỉ bù khi lễ trùng ngày nghỉ hằng tuần (khoản 3 Điều 111).
 *
 * Ngày hoán đổi do Thủ tướng quyết định từng năm (ví dụ nghỉ dài dịp Tết) chưa được tính.
 *
 * Mọi ngày là chuỗi YYYY-MM-DD, tính trên Date UTC để không lệch theo múi giờ của máy.
 */

export const SO_NGAY_HEN = 7;

/* ---------- Đổi ngày âm lịch sang dương lịch (thuật toán của Hồ Ngọc Đức, múi giờ +7) ---------- */

const MUI_GIO = 7;

function jdTuNgay(d: number, m: number, y: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

/** Ngày Julius của lần trăng mới thứ k kể từ 1/1/1900. */
function trangMoi(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

function ngayTrangMoi(k: number): number {
  return Math.floor(trangMoi(k) + 0.5 + MUI_GIO / 24);
}

/** Cung hoàng đạo (0..11) của mặt trời lúc 0h ngày Julius jdn. */
function kinhDoMatTroi(jdn: number): number {
  const T = (jdn - 2451545.5 - MUI_GIO / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}

/** Ngày bắt đầu tháng 11 âm lịch của năm dương lịch y. */
function thangMuoiMot(y: number): number {
  const off = jdTuNgay(31, 12, y) - 2415021;
  const k = Math.floor(off / 29.530588853);
  const nm = ngayTrangMoi(k);
  return kinhDoMatTroi(nm) >= 9 ? ngayTrangMoi(k - 1) : nm;
}

function viTriThangNhuan(a11: number): number {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = kinhDoMatTroi(ngayTrangMoi(k + i));
  do {
    last = arc;
    i++;
    arc = kinhDoMatTroi(ngayTrangMoi(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Ngày dương lịch (YYYY-MM-DD) của ngày âm d/m năm âm y, tháng không nhuận. */
export function amSangDuong(d: number, m: number, y: number): string {
  let a11: number;
  let b11: number;
  if (m < 11) {
    a11 = thangMuoiMot(y - 1);
    b11 = thangMuoiMot(y);
  } else {
    a11 = thangMuoiMot(y);
    b11 = thangMuoiMot(y + 1);
  }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = m - 11;
  if (off < 0) off += 12;
  // Năm có tháng nhuận: các tháng từ sau tháng nhuận trở đi lùi thêm một tuần trăng.
  if (b11 - a11 > 365 && off >= viTriThangNhuan(a11)) off += 1;
  const jd = ngayTrangMoi(k + off) + d - 1;
  // Ngày Julius -> dương lịch: số ngày lệch so với 1/1/1970 (JD 2440588).
  return isoTuDate(new Date((jd - 2440588) * 86_400_000));
}

/* ---------- Tiện ích ngày ---------- */

function dateTuIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function isoTuDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function congNgay(iso: string, soNgay: number): string {
  const d = dateTuIso(iso);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return isoTuDate(d);
}

/** 0 = Chủ nhật ... 6 = thứ Bảy. */
export function thuTrongTuan(iso: string): number {
  return dateTuIso(iso).getUTCDay();
}

const TEN_THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "Thứ Hai, 19/10/2026". */
export function ngayDayDu(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${TEN_THU[thuTrongTuan(iso)]}, ${d}/${m}/${y}`;
}

const laCuoiTuan = (iso: string) => {
  const t = thuTrongTuan(iso);
  return t === 0 || t === 6;
};

/* ---------- Ngày nghỉ lễ, tết ---------- */

/** Ngày nghỉ lễ, tết của năm dương lịch y (đã gồm ngày nghỉ bù), khóa YYYY-MM-DD, giá trị là tên. */
function ngayNghiTrongNam(y: number): Map<string, string> {
  const le = new Map<string, string>();
  const them = (iso: string, ten: string) => {
    if (iso.startsWith(`${y}-`) && !le.has(iso)) le.set(iso, ten);
  };

  them(`${y}-01-01`, "Tết Dương lịch");
  // Tết âm lịch 5 ngày: ngày cuối năm âm (30 hoặc 29 Tết) và mùng 1 đến mùng 4. Tết của năm âm y
  // rơi vào tháng 1-2 dương lịch năm y; xét cả Tết năm sau phòng ngày cuối năm âm sang năm y.
  for (const namAm of [y, y + 1]) {
    const mung1 = amSangDuong(1, 1, namAm);
    them(congNgay(mung1, -1), "Tết Nguyên đán (cuối năm âm lịch)");
    for (let i = 0; i < 4; i++) them(congNgay(mung1, i), `Tết Nguyên đán (mùng ${i + 1})`);
  }
  them(amSangDuong(10, 3, y), "Giỗ Tổ Hùng Vương (10/3 âm lịch)");
  them(`${y}-04-30`, "Ngày Chiến thắng 30/4");
  them(`${y}-05-01`, "Ngày Quốc tế lao động 1/5");
  them(`${y}-09-02`, "Quốc khánh 2/9");
  // Ngày liền kề Quốc khánh: lấy 1/9, trừ khi 1/9 là ngày nghỉ hằng tuần thì lấy 3/9.
  them(laCuoiTuan(`${y}-09-01`) ? `${y}-09-03` : `${y}-09-01`, "Quốc khánh (ngày liền kề)");

  // Nghỉ bù: lễ trùng thứ Bảy, Chủ nhật thì nghỉ bù vào ngày làm việc kế tiếp.
  const kq = new Map(le);
  for (const [iso, ten] of [...le].sort(([a], [b]) => a.localeCompare(b))) {
    if (!laCuoiTuan(iso)) continue;
    let bu = congNgay(iso, 1);
    while (laCuoiTuan(bu) || kq.has(bu)) bu = congNgay(bu, 1);
    kq.set(bu, `Nghỉ bù ${ten}`);
  }
  return kq;
}

const boNhoNam = new Map<number, Map<string, string>>();

/** Tên ngày nghỉ lễ, tết (kể cả nghỉ bù) nếu iso là ngày đó; không thì null. */
export function tenNgayLe(iso: string): string | null {
  const y = Number(iso.slice(0, 4));
  let nam = boNhoNam.get(y);
  if (!nam) {
    nam = ngayNghiTrongNam(y);
    boNhoNam.set(y, nam);
  }
  return nam.get(iso) ?? null;
}

/* ---------- Tính ngày hẹn ---------- */

export interface KetQuaNgayHen {
  ngayLap: string;
  ngayHen: string;
  /** Các ngày làm việc được đếm, theo thứ tự; phần tử cuối là ngày hẹn. */
  ngayLamViec: string[];
  /** Ngày lễ, tết (kể cả nghỉ bù) nằm giữa ngày lập biên bản và ngày hẹn, đã bỏ qua khi đếm. */
  ngayLeBoQua: { ngay: string; ten: string }[];
}

export function tinhNgayHen(ngayLap: string, soNgay = SO_NGAY_HEN): KetQuaNgayHen {
  const ngayLamViec: string[] = [];
  const ngayLeBoQua: KetQuaNgayHen["ngayLeBoQua"] = [];
  let ngay = ngayLap;
  while (ngayLamViec.length < soNgay) {
    ngay = congNgay(ngay, 1);
    const ten = tenNgayLe(ngay);
    if (ten) ngayLeBoQua.push({ ngay, ten });
    else if (!laCuoiTuan(ngay)) ngayLamViec.push(ngay);
  }
  return { ngayLap, ngayHen: ngay, ngayLamViec, ngayLeBoQua };
}
