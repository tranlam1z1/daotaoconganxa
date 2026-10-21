/**
 * Trò chơi hóa (docs/PLAN.md GĐ9): XP, cấp độ, chuỗi ngày học, huy hiệu, thử thách hằng ngày.
 * Luật thuần, nhận `now` hoặc chuỗi ngày làm tham số để test mọi mốc giờ.
 *
 * Mọi con số (XP từng việc, ngưỡng cấp, ngưỡng huy hiệu) là ĐỀ XUẤT, gom ở đầu tệp để sửa một
 * chỗ khi khách hàng chốt (docs/GAP_ANALYSIS.md câu hỏi 4.4-19).
 */
import { deChoNguoiHoc, type NoiDungCauHoi } from "./cau-hoi.ts";
import { type CauHoiNguon, type CauTrongDe, daoPhuongAn, taoRng, tron } from "./de-thi.ts";

/* ------------------------------------------------------------------ */
/* Bảng cấu hình                                                       */
/* ------------------------------------------------------------------ */

export const QUY_TAC_XP = {
  /** Mỗi câu đúng trong phiên luyện tập hoặc thử thách. */
  cau_dung_luyen_tap: 2,
  /** Hoàn thành một phiên luyện tập (trả lời ít nhất một câu). */
  hoan_thanh_phien: 5,
  /** Hoàn thành thử thách hằng ngày (thay cho thưởng hoàn thành phiên). */
  hoan_thanh_thu_thach: 10,
  /** Nộp một bài thi sát hạch. */
  nop_bai_thi: 10,
  /** Thưởng thêm khi bài thi đạt. */
  dat_bai_thi: 50,
  /** Hoàn thành một bài giảng (docs/PLAN.md GĐ11). */
  hoan_thanh_bai_hoc: 15,
} as const;

/** Tổng XP tối thiểu để đạt từng cấp: phần tử i là ngưỡng của cấp i + 1. */
export const NGUONG_CAP = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000] as const;

export const SO_CAU_THU_THACH = 5;
/** Số lượt "đóng băng" chuỗi ngày được cấp mỗi tuần (thứ Hai–Chủ nhật). */
export const DONG_BANG_MOI_TUAN = 1;

/* ------------------------------------------------------------------ */
/* XP                                                                  */
/* ------------------------------------------------------------------ */

export type NguonPhienXp = "chu_de" | "cau_sai" | "thu_thach" | "nhom";

/** XP của một phiên luyện tập khi kết thúc. Phiên không trả lời câu nào không có XP. */
export function xpPhienLuyenTap(p: { nguon: NguonPhienXp; dung: number; daTraLoi: number }): number {
  if (p.daTraLoi <= 0) return 0;
  const thuong = p.nguon === "thu_thach" ? QUY_TAC_XP.hoan_thanh_thu_thach : QUY_TAC_XP.hoan_thanh_phien;
  return Math.max(0, p.dung) * QUY_TAC_XP.cau_dung_luyen_tap + thuong;
}

/** XP của một lượt thi khi nộp. */
export function xpLuotThi(p: { dat: boolean }): number {
  return QUY_TAC_XP.nop_bai_thi + (p.dat ? QUY_TAC_XP.dat_bai_thi : 0);
}

export interface CapDo {
  cap: number;
  /** Ngưỡng XP của cấp hiện tại và cấp kế tiếp (null khi đã ở cấp cao nhất). */
  tuXp: number;
  denXp: number | null;
  /** Tiến độ trong cấp hiện tại, 0–1. */
  tienDo: number;
}

export function capDo(tongXp: number): CapDo {
  let i = 0;
  while (i + 1 < NGUONG_CAP.length && tongXp >= NGUONG_CAP[i + 1]!) i++;
  const tuXp = NGUONG_CAP[i]!;
  const denXp = NGUONG_CAP[i + 1] ?? null;
  const tienDo = denXp === null ? 1 : Math.min(1, Math.max(0, (tongXp - tuXp) / (denXp - tuXp)));
  return { cap: i + 1, tuXp, denXp, tienDo: Math.round(tienDo * 1000) / 1000 };
}

/* ------------------------------------------------------------------ */
/* Ngày giờ Việt Nam                                                   */
/* ------------------------------------------------------------------ */

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. 23:59 ngày 24 (UTC+7) là ngày 24, 00:00 là ngày 25. */
export function ngayVietNam(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const ngayThanhSo = (ngay: string) => Math.round(Date.parse(`${ngay}T00:00:00Z`) / 86_400_000);

/** Số ngày từ `tu` đến `den` (cùng ngày = 0). */
export function cachNgay(tu: string, den: string): number {
  return ngayThanhSo(den) - ngayThanhSo(tu);
}

function congNgay(ngay: string, soNgay: number): string {
  return new Date((ngayThanhSo(ngay) + soNgay) * 86_400_000).toISOString().slice(0, 10);
}

/** Ngày thứ Hai của tuần chứa `ngay` (tuần tính từ thứ Hai). */
export function thuHaiCuaTuan(ngay: string): string {
  const thu = new Date(`${ngay}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
  return congNgay(ngay, -((thu + 6) % 7));
}

/** Ngày đầu kỳ xếp hạng theo giờ Việt Nam: thứ Hai tuần này, hoặc ngày 1 tháng này. */
export function dauKy(ky: "tuan" | "thang", now: Date = new Date()): string {
  const homNay = ngayVietNam(now);
  return ky === "tuan" ? thuHaiCuaTuan(homNay) : `${homNay.slice(0, 8)}01`;
}

/* ------------------------------------------------------------------ */
/* Chuỗi ngày học                                                      */
/* ------------------------------------------------------------------ */

export interface TrangThaiChuoi {
  current: number;
  best: number;
  /** Ngày học gần nhất (YYYY-MM-DD, giờ Việt Nam). */
  last_day: string | null;
  freezes_left: number;
  /** Thứ Hai của tuần đã cấp lượt đóng băng gần nhất. */
  freeze_week: string | null;
}

/** Cấp lại lượt đóng băng khi sang tuần mới. */
function capDongBang(s: TrangThaiChuoi, ngay: string): TrangThaiChuoi {
  const tuan = thuHaiCuaTuan(ngay);
  return s.freeze_week === tuan ? s : { ...s, freezes_left: DONG_BANG_MOI_TUAN, freeze_week: tuan };
}

/**
 * Ghi nhận một ngày có học. Học liền ngày hôm trước thì chuỗi tăng; bỏ lỡ số ngày không quá số
 * lượt đóng băng còn lại thì chuỗi vẫn tăng và trừ lượt; bỏ lỡ nhiều hơn thì chuỗi bắt đầu lại từ 1.
 */
export function ghiNgayHoc(truoc: TrangThaiChuoi | null, ngay: string): TrangThaiChuoi {
  const s = capDongBang(
    truoc ?? { current: 0, best: 0, last_day: null, freezes_left: DONG_BANG_MOI_TUAN, freeze_week: null },
    ngay,
  );
  if (!s.last_day) return { ...s, current: 1, best: Math.max(s.best, 1), last_day: ngay };
  const gap = cachNgay(s.last_day, ngay);
  if (gap <= 0) return s; // cùng ngày (hoặc ghi muộn cho ngày cũ): không đổi
  const boLo = gap - 1;
  let { current, freezes_left } = s;
  if (boLo === 0) current += 1;
  else if (boLo <= freezes_left) {
    current += 1;
    freezes_left -= boLo;
  } else current = 1;
  return { ...s, current, freezes_left, best: Math.max(s.best, current), last_day: ngay };
}

export interface ChuoiHienTai {
  hienTai: number;
  totNhat: number;
  daHocHomNay: boolean;
  conDongBang: number;
}

/**
 * Chuỗi hiển thị hôm nay khi chưa ghi thêm ngày nào: chưa học hôm nay thì chuỗi vẫn giữ (còn cả
 * ngày để học); bỏ lỡ số ngày trong mức đóng băng thì vẫn giữ; bỏ lỡ nhiều hơn thì về 0.
 */
export function chuoiHienTai(s: TrangThaiChuoi | null, homNay: string): ChuoiHienTai {
  if (!s?.last_day)
    return { hienTai: 0, totNhat: s?.best ?? 0, daHocHomNay: false, conDongBang: DONG_BANG_MOI_TUAN };
  const conDongBang = capDongBang(s, homNay).freezes_left;
  const gap = cachNgay(s.last_day, homNay);
  const boLo = Math.max(0, gap - 1);
  const conGiu = gap <= 1 || boLo <= conDongBang;
  return {
    hienTai: conGiu ? s.current : 0,
    totNhat: s.best,
    daHocHomNay: gap === 0,
    conDongBang,
  };
}

/* ------------------------------------------------------------------ */
/* Huy hiệu                                                            */
/* ------------------------------------------------------------------ */

export interface ThongKeHuyHieu {
  so_phien: number;
  chuoi_tot_nhat: number;
  so_cau_dung: number;
  so_thu_thach: number;
  so_bai_thi_dat: number;
}

export interface LuatHuyHieu {
  code: string;
  rule: { chi_so: keyof ThongKeHuyHieu; nguong: number };
}

/** Mã các huy hiệu đạt điều kiện với thống kê hiện tại. Luật lạ (chỉ số không có) bị bỏ qua. */
export function huyHieuDat(luat: LuatHuyHieu[], tk: ThongKeHuyHieu): string[] {
  return luat
    .filter((l) => typeof tk[l.rule.chi_so] === "number" && tk[l.rule.chi_so] >= l.rule.nguong)
    .map((l) => l.code);
}

/* ------------------------------------------------------------------ */
/* Thử thách hằng ngày                                                 */
/* ------------------------------------------------------------------ */

/**
 * Chọn câu cho thử thách của một ngày: trộn có seed là chính ngày đó, nên mọi người trong ngày
 * nhận cùng một bộ, ngày khác nhận bộ khác. Sắp id trước khi trộn để kết quả không phụ thuộc thứ
 * tự CSDL trả về.
 */
export function chonCauThuThach(idCauDaDuyet: string[], ngay: string, soCau = SO_CAU_THU_THACH): string[] {
  const goc = [...new Set(idCauDaDuyet)].sort();
  return tron(goc, taoRng(`thu-thach|${ngay}`)).slice(0, soCau);
}

/**
 * Dựng các câu của phiên thử thách theo đúng thứ tự đã chốt trong ngày (giống nhau cho mọi người),
 * cùng dạng `CauTrongDe` với phiên luyện tập. Phương án đảo theo từng người (`seed`), id giữ
 * nguyên nên chấm không đổi. Câu không còn trong `nguon` (đã bị gỡ duyệt) thì bỏ qua.
 */
export function dungCauThuThach(ids: string[], nguon: CauHoiNguon[], seed: string): CauTrongDe[] {
  const rng = taoRng(seed);
  const theoId = new Map(nguon.map((c) => [c.id, c]));
  return ids
    .map((id) => theoId.get(id))
    .filter((c): c is CauHoiNguon => Boolean(c))
    .map((c) => {
      const noiDung: NoiDungCauHoi = {
        kind: c.kind,
        level: c.level,
        stem: c.stem,
        options: c.options,
        answer: c.answer,
        explanation: c.explanation,
        citations: c.citations,
        image_uris: c.image_uris,
      };
      return {
        question_id: c.id,
        version: c.version,
        topic_id: c.topic_id,
        level: c.level,
        de: daoPhuongAn(deChoNguoiHoc(noiDung), rng),
        noi_dung: noiDung,
      };
    });
}
