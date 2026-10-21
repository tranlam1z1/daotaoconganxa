/**
 * Mùa giải đơn vị (docs/GAME_DESIGN.md §5.10, docs/PLAN.md GĐ-G6). Luật thuần: không chạm CSDL.
 *
 * - Điểm tuần của đơn vị = tổng XP tính mùa giải của thành viên / quân số (mọi tài khoản đang hoạt
 *   động). XP mỗi người mỗi tuần có trần.
 * - Đơn vị có dưới `toi_thieu_thanh_vien` người không xếp hạng. Bằng điểm thì đơn vị có tỷ lệ người
 *   tham gia cao hơn đứng trên.
 * - Cuối tuần, trong mỗi nhóm: `so_len` đơn vị đầu lên hạng, `so_xuong` đơn vị cuối xuống hạng
 *   (hạng 1 không lên, hạng thấp nhất không xuống). Tuần sau chia nhóm lại, cân bằng theo điểm.
 * - Chốt tuần 06:00 thứ Hai giờ Việt Nam: XP chơi trong tuần mà ghi (đồng bộ) từ lúc đó trở đi
 *   không vào mùa giải, nhưng vẫn vào XP cá nhân.
 *
 * Mọi con số nằm trong `CauHinhMuaGiai` (lưu ở `seasons.config`), không cố định trong mã.
 */
import { ngayVietNam, thuHaiCuaTuan } from "./diem-thuong.ts";

/* ------------------------------------------------------------------ */
/* Cấu hình                                                            */
/* ------------------------------------------------------------------ */

export interface CauHinhMuaGiai {
  /** Số tuần của mùa. */
  so_tuan: number;
  /** Số hạng; hạng 1 cao nhất. */
  so_hang: number;
  /** Cỡ nhóm mong muốn trong một hạng; số nhóm = làm tròn(số đơn vị / cỡ nhóm), ít nhất 1. */
  co_nhom: number;
  /** Số đơn vị đầu nhóm lên hạng mỗi tuần. */
  so_len: number;
  /** Số đơn vị cuối nhóm xuống hạng mỗi tuần. */
  so_xuong: number;
  /** Trần XP tính mùa giải của một người trong một tuần. */
  tran_xp_tuan: number;
  /** Đơn vị có ít thành viên đang hoạt động hơn số này thì không xếp hạng. */
  toi_thieu_thanh_vien: number;
}

/** Đề xuất ở GAME_DESIGN §7 Q11, chờ khách hàng chốt. */
export const CAU_HINH_MUA_GIAI_MAC_DINH: CauHinhMuaGiai = {
  so_tuan: 12,
  so_hang: 4,
  co_nhom: 10,
  so_len: 2,
  so_xuong: 2,
  tran_xp_tuan: 700,
  toi_thieu_thanh_vien: 3,
};

/** Lỗi của cấu hình, rỗng nếu hợp lệ. */
export function kiemCauHinhMuaGiai(c: CauHinhMuaGiai): string[] {
  const loi: string[] = [];
  const nguyen = (k: keyof CauHinhMuaGiai, min: number, max: number) => {
    const v = c[k];
    if (!Number.isInteger(v) || v < min || v > max) loi.push(`${k} phải là số nguyên từ ${min} đến ${max}.`);
  };
  nguyen("so_tuan", 1, 52);
  nguyen("so_hang", 1, 10);
  nguyen("co_nhom", 2, 50);
  nguyen("so_len", 0, 10);
  nguyen("so_xuong", 0, 10);
  nguyen("tran_xp_tuan", 1, 100_000);
  nguyen("toi_thieu_thanh_vien", 1, 50);
  if (!loi.length && c.so_len + c.so_xuong >= c.co_nhom) {
    loi.push("Tổng số đơn vị lên và xuống hạng phải nhỏ hơn cỡ nhóm.");
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Ngày, tuần, mốc chốt                                                */
/* ------------------------------------------------------------------ */

const MOT_NGAY = 86_400_000;

export function congNgayMuaGiai(ngay: string, soNgay: number): string {
  return new Date(Date.parse(`${ngay}T00:00:00Z`) + soNgay * MOT_NGAY).toISOString().slice(0, 10);
}

/** Thứ Hai (giờ Việt Nam) của tuần chứa thời điểm `now`. */
export function tuanCua(now: Date): string {
  return thuHaiCuaTuan(ngayVietNam(now));
}

export function laThuHai(ngay: string): boolean {
  return new Date(`${ngay}T00:00:00Z`).getUTCDay() === 1;
}

/** Mốc chốt của tuần bắt đầu `thuHai`: 06:00 thứ Hai tuần sau, giờ Việt Nam. */
export function hanChotTuan(thuHai: string): Date {
  return new Date(`${congNgayMuaGiai(thuHai, 7)}T06:00:00+07:00`);
}

/**
 * Một dòng XP có vào mùa giải của tuần `thuHai` không: ngày chơi (giờ Việt Nam) trong tuần, và được
 * ghi TRƯỚC mốc chốt. Lượt offline chơi Chủ nhật đồng bộ lúc 05:59 thứ Hai được tính, 06:00 thì không.
 */
export function tinhVaoMuaGiai(p: { ngay: string; ghiLuc: Date }, thuHai: string): boolean {
  return p.ngay >= thuHai && p.ngay <= congNgayMuaGiai(thuHai, 6) && p.ghiLuc < hanChotTuan(thuHai);
}

/** Các tuần (thứ Hai) của mùa. */
export function cacTuanCuaMua(batDau: string, soTuan: number): string[] {
  return Array.from({ length: soTuan }, (_, i) => congNgayMuaGiai(batDau, 7 * i));
}

/** Ngày cuối (Chủ nhật) của mùa. */
export function ngayKetThucMua(batDau: string, soTuan: number): string {
  return congNgayMuaGiai(batDau, 7 * soTuan - 1);
}

/** Tuần thứ mấy của mùa (1-based); 0 nếu trước mùa, lớn hơn số tuần nếu đã qua. */
export function tuanThu(batDau: string, thuHai: string): number {
  return (
    Math.floor((Date.parse(`${thuHai}T00:00:00Z`) - Date.parse(`${batDau}T00:00:00Z`)) / (7 * MOT_NGAY)) + 1
  );
}

/**
 * Các tuần của mùa đã tới hạn chốt tại `now`, theo thứ tự. Worker lỡ nhịp (máy tắt cả tuần) thì
 * lần chạy sau chốt bù mọi tuần còn thiếu.
 */
export function tuanToiHanChot(batDau: string, soTuan: number, now: Date): string[] {
  return cacTuanCuaMua(batDau, soTuan).filter((t) => hanChotTuan(t) <= now);
}

/* ------------------------------------------------------------------ */
/* Điểm tuần của một đơn vị                                            */
/* ------------------------------------------------------------------ */

export interface DiemTuanDonVi {
  /** Tổng XP tính mùa giải (đã áp trần từng người). */
  xp_tinh: number;
  /** XP tính mùa giải / quân số, làm tròn 2 chữ số thập phân. */
  diem: number;
  /** Số người có XP > 0 trong tuần / quân số. */
  ty_le_tham_gia: number;
  so_nguoi_choi: number;
  /** false khi quân số dưới mức tối thiểu. */
  xep_hang: boolean;
}

const tron2 = (x: number) => Math.round(x * 100) / 100;

/** `xpTungNguoi`: XP trong tuần của từng thành viên có chơi (đã lọc theo mốc chốt). */
export function diemTuanDonVi(
  p: { xpTungNguoi: readonly number[]; quanSo: number },
  cfg: Pick<CauHinhMuaGiai, "tran_xp_tuan" | "toi_thieu_thanh_vien">,
): DiemTuanDonVi {
  const coChoi = p.xpTungNguoi.filter((x) => x > 0);
  const xpTinh = coChoi.reduce((s, x) => s + Math.min(x, cfg.tran_xp_tuan), 0);
  // Quân số không nhỏ hơn số người có chơi: người đã rời đơn vị giữa tuần vẫn có XP ở đơn vị cũ.
  const quanSo = Math.max(p.quanSo, coChoi.length);
  return {
    xp_tinh: xpTinh,
    diem: quanSo ? tron2(xpTinh / quanSo) : 0,
    ty_le_tham_gia: quanSo ? coChoi.length / quanSo : 0,
    so_nguoi_choi: coChoi.length,
    xep_hang: p.quanSo >= cfg.toi_thieu_thanh_vien,
  };
}

/* ------------------------------------------------------------------ */
/* Xếp hạng trong nhóm, lên/xuống hạng                                 */
/* ------------------------------------------------------------------ */

export type KetQuaTuan = "len" | "giu" | "xuong";

export interface DonViTrongNhom {
  unit_id: string;
  ten: string;
  diem: number;
  ty_le_tham_gia: number;
  xep_hang: boolean;
}

/**
 * Sắp đơn vị trong một nhóm: điểm giảm dần, rồi tỷ lệ tham gia giảm dần, rồi tên (để kết quả
 * luôn như nhau giữa các lần chạy). Đơn vị không xếp hạng nằm cuối, `hang` = null. Hạng là số
 * thứ tự 1..n, không đồng hạng, vì lên/xuống hạng cần một thứ tự duy nhất.
 */
export function xepTrongNhom<T extends DonViTrongNhom>(ds: readonly T[]): Array<T & { hang: number | null }> {
  const so = (a: T, b: T) =>
    b.diem - a.diem ||
    b.ty_le_tham_gia - a.ty_le_tham_gia ||
    a.ten.localeCompare(b.ten, "vi") ||
    a.unit_id.localeCompare(b.unit_id);
  const coHang = ds.filter((d) => d.xep_hang).sort(so);
  const khong = ds.filter((d) => !d.xep_hang).sort(so);
  return [...coHang.map((d, i) => ({ ...d, hang: i + 1 })), ...khong.map((d) => ({ ...d, hang: null }))];
}

/**
 * Kết quả cuối tuần của đơn vị đứng thứ `hang` trong nhóm có `soCoHang` đơn vị xếp hạng, ở hạng
 * `bac`. Nhóm quá nhỏ thì ưu tiên lên hạng, phần còn lại mới xét xuống hạng (không đơn vị nào vừa
 * lên vừa xuống).
 */
export function ketQuaTuan(
  hang: number | null,
  soCoHang: number,
  bac: number,
  cfg: Pick<CauHinhMuaGiai, "so_hang" | "so_len" | "so_xuong">,
): KetQuaTuan {
  if (hang === null) return "giu";
  if (bac > 1 && hang <= cfg.so_len) return "len";
  if (bac < cfg.so_hang && hang > Math.max(cfg.so_len, soCoHang - cfg.so_xuong)) return "xuong";
  return "giu";
}

export function bacTuanSau(bac: number, kq: KetQuaTuan, soHang: number): number {
  const moi = kq === "len" ? bac - 1 : kq === "xuong" ? bac + 1 : bac;
  return Math.min(soHang, Math.max(1, moi));
}

/* ------------------------------------------------------------------ */
/* Chia nhóm, xếp hạng ban đầu                                         */
/* ------------------------------------------------------------------ */

/** Số nhóm cho `n` đơn vị với cỡ nhóm mong muốn `coNhom`. */
export function soNhom(n: number, coNhom: number): number {
  return Math.max(1, Math.round(n / coNhom));
}

/**
 * Chia các đơn vị CÙNG HẠNG thành nhóm, cân bằng theo điểm tuần trước: sắp điểm giảm dần rồi chia
 * kiểu "rắn" (1→g, g→1, …), để nhóm nào cũng có đơn vị mạnh và yếu. Trả map unit_id → số nhóm (1..g).
 */
export function chiaNhom(
  ds: ReadonlyArray<{ unit_id: string; diem_truoc: number }>,
  coNhom: number,
): Map<string, number> {
  const g = soNhom(ds.length, coNhom);
  const sap = [...ds].sort((a, b) => b.diem_truoc - a.diem_truoc || a.unit_id.localeCompare(b.unit_id));
  const ra = new Map<string, number>();
  sap.forEach((d, i) => {
    const vong = Math.floor(i / g);
    const viTri = i % g;
    ra.set(d.unit_id, (vong % 2 === 0 ? viTri : g - 1 - viTri) + 1);
  });
  return ra;
}

/**
 * Mùa đầu tiên: xếp hạng ban đầu theo XP trung bình mỗi người của 4 tuần trước mùa. Chia đều các
 * đơn vị theo thứ tự đó vào `soHang` hạng (hạng trên nhận phần dư). Trả map unit_id → hạng.
 */
export function xepHangBanDau(
  ds: ReadonlyArray<{ unit_id: string; xp_trung_binh: number }>,
  soHang: number,
): Map<string, number> {
  const sap = [...ds].sort((a, b) => b.xp_trung_binh - a.xp_trung_binh || a.unit_id.localeCompare(b.unit_id));
  const co = Math.floor(sap.length / soHang);
  const du = sap.length % soHang;
  const ra = new Map<string, number>();
  let i = 0;
  for (let bac = 1; bac <= soHang; bac++) {
    const n = co + (bac <= du ? 1 : 0);
    for (let k = 0; k < n; k++) ra.set(sap[i++]!.unit_id, bac);
  }
  return ra;
}

/** Mùa sau: mỗi đơn vị xuống một hạng so với cuối mùa trước (đặt lại mềm), để mùa mới còn chỗ tiến. */
export function datLaiMem(bacCuoiMuaTruoc: number, soHang: number): number {
  return Math.min(soHang, bacCuoiMuaTruoc + 1);
}

/* ------------------------------------------------------------------ */
/* Chốt một tuần                                                       */
/* ------------------------------------------------------------------ */

export interface DonViDauVaoChot {
  unit_id: string;
  ten: string;
  bac: number;
  nhom: number;
  quan_so: number;
  /** XP trong tuần của từng thành viên có chơi, đã lọc theo mốc chốt. */
  xp_tung_nguoi: number[];
}

export interface DongChot extends DiemTuanDonVi {
  unit_id: string;
  ten: string;
  bac: number;
  nhom: number;
  quan_so: number;
  hang: number | null;
  ket_qua: KetQuaTuan | null;
  bac_tuan_sau: number;
}

/**
 * Chốt tuần: điểm, thứ hạng trong nhóm, kết quả lên/giữ/xuống, hạng của tuần sau. Đơn vị không
 * xếp hạng có `ket_qua` null và giữ hạng.
 */
export function chotTuan(ds: readonly DonViDauVaoChot[], cfg: CauHinhMuaGiai): DongChot[] {
  const coDiem = ds.map((d) => ({
    ...d,
    ...diemTuanDonVi({ xpTungNguoi: d.xp_tung_nguoi, quanSo: d.quan_so }, cfg),
  }));
  const theoNhom = new Map<string, typeof coDiem>();
  for (const d of coDiem) {
    const k = `${d.bac}:${d.nhom}`;
    theoNhom.set(k, [...(theoNhom.get(k) ?? []), d]);
  }
  const ra: DongChot[] = [];
  for (const nhom of theoNhom.values()) {
    const xep = xepTrongNhom(nhom);
    const soCoHang = xep.filter((d) => d.hang !== null).length;
    for (const d of xep) {
      const kq = d.hang === null ? null : ketQuaTuan(d.hang, soCoHang, d.bac, cfg);
      const { xp_tung_nguoi: _bo, ...con } = d;
      ra.push({ ...con, ket_qua: kq, bac_tuan_sau: bacTuanSau(d.bac, kq ?? "giu", cfg.so_hang) });
    }
  }
  return ra.sort((a, b) => a.bac - b.bac || a.nhom - b.nhom || (a.hang ?? 1e9) - (b.hang ?? 1e9));
}

/**
 * Phân nhóm cho tuần sau từ kết quả chốt: mỗi hạng chia lại nhóm theo điểm vừa chốt. `moi` là đơn vị
 * mới vào mùa giữa chừng (chưa có dòng nào): vào hạng thấp nhất với điểm 0.
 */
export function phanNhomTuanSau(
  chot: ReadonlyArray<Pick<DongChot, "unit_id" | "bac_tuan_sau" | "diem">>,
  moi: readonly string[],
  cfg: Pick<CauHinhMuaGiai, "so_hang" | "co_nhom">,
): Array<{ unit_id: string; bac: number; nhom: number }> {
  const theoBac = new Map<number, Array<{ unit_id: string; diem_truoc: number }>>();
  const them = (bac: number, unit_id: string, diem_truoc: number) =>
    theoBac.set(bac, [...(theoBac.get(bac) ?? []), { unit_id, diem_truoc }]);
  for (const d of chot) them(d.bac_tuan_sau, d.unit_id, d.diem);
  for (const id of moi) them(cfg.so_hang, id, 0);
  const ra: Array<{ unit_id: string; bac: number; nhom: number }> = [];
  for (const [bac, ds] of [...theoBac].sort((a, b) => a[0] - b[0])) {
    for (const [unit_id, nhom] of chiaNhom(ds, cfg.co_nhom)) ra.push({ unit_id, bac, nhom });
  }
  return ra;
}

/* ------------------------------------------------------------------ */
/* Hiển thị: cần bao nhiêu điểm để lên hạng                            */
/* ------------------------------------------------------------------ */

/**
 * Khoảng cách tới vùng lên hạng của đơn vị `unitId` trong nhóm đã xếp. null nếu đơn vị đang ở vùng
 * lên hạng, ở hạng 1, không xếp hạng, hoặc nhóm không có suất lên. Trả điểm (XP/người) còn thiếu
 * để vượt đơn vị đang giữ suất lên cuối cùng, và số XP cả đơn vị tương ứng.
 */
export function canDeLenHang(
  nhom: ReadonlyArray<{ unit_id: string; diem: number; hang: number | null; quan_so: number }>,
  unitId: string,
  bac: number,
  cfg: Pick<CauHinhMuaGiai, "so_len">,
): { diem_can: number; xp_can: number; diem_moc: number } | null {
  const toi = nhom.find((d) => d.unit_id === unitId);
  if (!toi || toi.hang === null || bac <= 1 || cfg.so_len <= 0 || toi.hang <= cfg.so_len) return null;
  const moc = nhom.find((d) => d.hang === cfg.so_len);
  if (!moc) return null;
  // Bằng điểm thì xét tỷ lệ tham gia, nên cần hơn 0,01 điểm mới chắc chắn vượt.
  const diemCan = tron2(moc.diem - toi.diem + 0.01);
  return { diem_can: diemCan, xp_can: Math.ceil(diemCan * Math.max(1, toi.quan_so)), diem_moc: moc.diem };
}

/** Số sao ở màn kết quả tuần: lên hạng 3, giữ hạng 2, xuống hạng 1. */
export function saoKetQuaTuan(kq: KetQuaTuan): 1 | 2 | 3 {
  return kq === "len" ? 3 : kq === "giu" ? 2 : 1;
}
