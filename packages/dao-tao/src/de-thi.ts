/**
 * Thi sát hạch (docs/PLAN.md GĐ6): logic thuần, không chạm CSDL, nhận `now` làm tham số để test
 * được mọi tình huống thời gian.
 *
 * - Ma trận đề: số câu theo (chủ đề × mức độ × dạng câu), kèm điểm mỗi câu; kiểm tra khả thi so
 *   với số câu đã duyệt. Dạng câu là trắc nghiệm (mọi loại chấm máy) hoặc tự luận.
 * - Điểm lượt = tổng điểm đạt / tổng điểm tối đa × 100. Câu chấm máy đúng hết mới được điểm; câu
 *   tự luận được điểm theo rubric (mô hình hoặc giảng viên chấm, ngoài các hàm ở đây).
 * - Sinh đề có seed: cùng seed cho cùng đề, khác seed cho thứ tự khác. Seed là id lượt thi.
 * - Đảo phương án chỉ đổi THỨ TỰ hiển thị, giữ nguyên id từng phương án, nên chấm theo id
 *   (chamCauHoi) vẫn đúng sau khi đảo.
 * - Đồng hồ: câu trả lời nhận tới `deadline + 30 giây` (bù độ trễ mạng); sau đó từ chối.
 */
import {
  chamCauHoi,
  type DeCauHoi,
  deChoNguoiHoc,
  type KetQuaCauHoi,
  type MucDoCauHoi,
  type NoiDungCauHoi,
  TEN_MUC_DO,
  type TraLoiCauHoi,
} from "./cau-hoi.ts";

export const SO_CAU_TOI_THIEU = 1;
export const SO_CAU_TOI_DA = 60;
/** Điểm một câu khai trong ma trận (trước khi quy về thang 100). */
export const DIEM_MOI_CAU = { toiThieu: 0.25, toiDa: 20 } as const;
/** Thời gian bù cho độ trễ mạng: câu trả lời gửi trong khoảng này sau hạn vẫn được nhận. */
export const DUNG_SAI_NOP_GIAY = 30;

/* ------------------------------------------------------------------ */
/* Ma trận đề                                                          */
/* ------------------------------------------------------------------ */

export const DANG_CAU = ["trac_nghiem", "tu_luan"] as const;
export type DangCau = (typeof DANG_CAU)[number];

export const TEN_DANG_CAU: Record<DangCau, string> = {
  trac_nghiem: "Trắc nghiệm",
  tu_luan: "Tự luận",
};

/** Dạng câu của một loại câu ngân hàng. */
export const dangCua = (kind: string): DangCau => (kind === "tu_luan" ? "tu_luan" : "trac_nghiem");

export interface OMaTran {
  topic_id: string;
  level: MucDoCauHoi;
  so_cau: number;
  /** Thiếu là trắc nghiệm: đề tạo trước khi có tự luận vẫn đọc đúng. */
  dang?: DangCau;
  /** Điểm mỗi câu của ô; thiếu là 1. */
  diem_moi_cau?: number;
}

export const dangO = (o: Pick<OMaTran, "dang">): DangCau => o.dang ?? "trac_nghiem";
export const diemO = (o: Pick<OMaTran, "diem_moi_cau">): number => o.diem_moi_cau ?? 1;

export const khoaO = (topicId: string, level: string, dang: DangCau = "trac_nghiem") =>
  `${topicId}|${level}|${dang}`;

/**
 * Kiểm ma trận so với số câu đã duyệt hiện có. Trả danh sách lỗi, mỗi lỗi chỉ đúng ô có vấn đề,
 * ví dụ "Chủ đề Tốc độ, mức Khó: cần 10 câu, ngân hàng mới có 6 câu đã duyệt."
 */
export function kiemTraMaTran(
  maTran: OMaTran[],
  khaDung: Map<string, number>,
  opts: { soCau?: number; tenChuDe?: Map<string, string> } = {},
): string[] {
  const loi: string[] = [];
  const ten = (id: string) => opts.tenChuDe?.get(id) ?? id;
  const daGap = new Set<string>();
  let tong = 0;
  for (const o of maTran) {
    const dang = dangO(o);
    const k = khoaO(o.topic_id, o.level, dang);
    const nhan = `Chủ đề ${ten(o.topic_id)}, mức ${TEN_MUC_DO[o.level] ?? o.level}${
      dang === "tu_luan" ? ", tự luận" : ""
    }`;
    if (daGap.has(k)) loi.push(`${nhan}: ô này khai hai lần.`);
    daGap.add(k);
    if (!Number.isInteger(o.so_cau) || o.so_cau < 0) {
      loi.push(`${nhan}: số câu phải là số nguyên không âm.`);
      continue;
    }
    const diem = diemO(o);
    if (!Number.isFinite(diem) || diem < DIEM_MOI_CAU.toiThieu || diem > DIEM_MOI_CAU.toiDa) {
      loi.push(`${nhan}: điểm mỗi câu phải từ ${DIEM_MOI_CAU.toiThieu} đến ${DIEM_MOI_CAU.toiDa}.`);
    }
    tong += o.so_cau;
    const co = khaDung.get(k) ?? 0;
    if (o.so_cau > co) loi.push(`${nhan}: cần ${o.so_cau} câu, ngân hàng mới có ${co} câu đã duyệt.`);
  }
  if (tong < SO_CAU_TOI_THIEU || tong > SO_CAU_TOI_DA) {
    loi.push(`Tổng số câu là ${tong}; đề thi cần từ ${SO_CAU_TOI_THIEU} đến ${SO_CAU_TOI_DA} câu.`);
  }
  if (opts.soCau !== undefined && tong !== opts.soCau) {
    loi.push(`Tổng số câu của ma trận là ${tong}, khác số câu của đề (${opts.soCau}).`);
  }
  return loi;
}

export const tongSoCau = (maTran: OMaTran[]) => maTran.reduce((s, o) => s + (o.so_cau > 0 ? o.so_cau : 0), 0);

/** Tổng điểm tối đa của đề theo ma trận (trước khi quy về thang 100). */
export const tongDiemMaTran = (maTran: OMaTran[]) =>
  maTran.reduce((s, o) => s + (o.so_cau > 0 ? o.so_cau * diemO(o) : 0), 0);

/* ------------------------------------------------------------------ */
/* Ngẫu nhiên có seed                                                  */
/* ------------------------------------------------------------------ */

/** Bộ sinh số ngẫu nhiên tất định từ một chuỗi (băm xmur3 + mulberry32). */
export function taoRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trộn Fisher–Yates, trả mảng mới. */
export function tron<T>(ds: readonly T[], rng: () => number): T[] {
  const a = [...ds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/* Sinh đề                                                             */
/* ------------------------------------------------------------------ */

/** Câu hỏi đã duyệt, đủ nội dung để chụp vào đề. */
export interface CauHoiNguon extends NoiDungCauHoi {
  id: string;
  version: number;
  topic_id: string;
}

/** Một câu trong đề của một lượt thi (ảnh chụp, lưu ở exam_attempts.items). */
export interface CauTrongDe {
  question_id: string;
  version: number;
  topic_id: string;
  level: MucDoCauHoi;
  /** Điểm tối đa của câu trong đề (theo ô ma trận); thiếu là 1 (luyện tập, đề cũ). */
  diem?: number;
  /** Phần gửi người thi, phương án đã theo thứ tự của lượt này. */
  de: DeCauHoi;
  /** Nội dung đầy đủ kèm đáp án (và rubric với câu tự luận); chỉ đọc ở máy chủ để chấm. */
  noi_dung: NoiDungCauHoi;
}

/**
 * Đảo thứ tự phương án của phần đề; id giữ nguyên nên chấm theo id không cần ánh xạ ngược.
 * Câu đúng/sai và điền chỗ trống không đảo. Luyện tập (GĐ4) dùng chung hàm này.
 */
export function daoPhuongAn(de: DeCauHoi, rng: () => number): DeCauHoi {
  if (de.kind === "ghep_cap")
    return { ...de, options: { ...de.options, phai: tron(de.options.phai ?? [], rng) } };
  if (de.kind === "mot_dap_an" || de.kind === "nhieu_dap_an" || de.kind === "sap_xep") {
    return { ...de, options: { ...de.options, phuong_an: tron(de.options.phuong_an ?? [], rng) } };
  }
  return de;
}

export class LoiSinhDe extends Error {}

/**
 * Sinh đề cho một lượt: rút ngẫu nhiên đúng số câu mỗi ô từ các câu đã duyệt, không lặp câu.
 * `tronCau` tắt thì câu xếp theo thứ tự ô của ma trận (trong một ô vẫn là thứ tự rút ngẫu nhiên).
 */
export function sinhDe(opts: {
  maTran: OMaTran[];
  nguon: CauHoiNguon[];
  seed: string;
  tronCau: boolean;
  tronPhuongAn: boolean;
}): CauTrongDe[] {
  const rng = taoRng(opts.seed);
  const theoO = new Map<string, CauHoiNguon[]>();
  for (const c of opts.nguon) {
    const k = khoaO(c.topic_id, c.level, dangCua(c.kind));
    theoO.set(k, [...(theoO.get(k) ?? []), c]);
  }
  // Rút theo thứ tự id ổn định trước khi trộn, để kết quả chỉ phụ thuộc seed, không phụ thuộc
  // thứ tự CSDL trả về.
  const chon: Array<{ c: CauHoiNguon; diem: number }> = [];
  for (const o of opts.maTran) {
    if (o.so_cau <= 0) continue;
    const dang = dangO(o);
    const kho = [...(theoO.get(khoaO(o.topic_id, o.level, dang)) ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    if (kho.length < o.so_cau) {
      throw new LoiSinhDe(
        `Ô ${o.topic_id}/${o.level}/${dang} cần ${o.so_cau} câu, chỉ có ${kho.length} câu đã duyệt.`,
      );
    }
    chon.push(
      ...tron(kho, rng)
        .slice(0, o.so_cau)
        .map((c) => ({ c, diem: diemO(o) })),
    );
  }
  const thuTu = opts.tronCau ? tron(chon, rng) : chon;
  return thuTu.map(({ c, diem }) => {
    const noiDung: NoiDungCauHoi = {
      kind: c.kind,
      level: c.level,
      stem: c.stem,
      options: c.options,
      answer: c.answer,
      explanation: c.explanation,
      citations: c.citations,
      image_uris: c.image_uris,
      ...(c.kind === "tu_luan" ? { rubric: c.rubric ?? {} } : {}),
    };
    const de = deChoNguoiHoc(noiDung);
    return {
      question_id: c.id,
      version: c.version,
      topic_id: c.topic_id,
      level: c.level,
      diem,
      de: opts.tronPhuongAn ? daoPhuongAn(de, rng) : de,
      noi_dung: noiDung,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

/** Kết quả một câu trong lượt. */
export interface KetQuaCauTrongLuot {
  thu_tu: number;
  /** Câu chấm máy: đúng hết. Câu tự luận: đạt ngưỡng rubric. */
  dung: boolean;
  /** Điểm đạt được, theo thang điểm của câu trong đề. */
  diem: number;
  diem_toi_da: number;
  /** Kết quả chấm máy; null với câu trống và câu tự luận. */
  ket_qua: KetQuaCauHoi | null;
  /** Câu tự luận có bài làm, chưa có điểm (chờ mô hình hoặc giảng viên). */
  cho_cham: boolean;
}

export interface KetQuaLuot {
  dung: number;
  tong: number;
  /** Điểm thang 100, làm tròn 2 chữ số. */
  diem: number;
  dat: boolean;
  /** Kết quả từng câu theo thứ tự đề (1..n); câu bỏ trống tính sai. */
  chiTiet: KetQuaCauTrongLuot[];
}

/** Câu trả lời trống: không chọn gì, không điền gì. Câu trống tính sai và không gọi chấm. */
export function traLoiTrong(t: TraLoiCauHoi | undefined): boolean {
  if (!t) return true;
  return (
    !t.chon?.length &&
    !t.thu_tu?.length &&
    !Object.keys(t.cap ?? {}).length &&
    !Object.values(t.o_trong ?? {}).some((v) => String(v).trim()) &&
    !String(t.bai_viet ?? "").trim()
  );
}

/** Điểm tối đa của một câu trong đề. */
export const diemCau = (item: Pick<CauTrongDe, "diem">) => item.diem ?? 1;

/**
 * Chấm phần máy chấm được của một lượt. Câu chấm máy đúng hết thì được trọn điểm câu, sai thì 0.
 * Câu bỏ trống (kể cả tự luận) được 0. Câu tự luận có bài làm đánh dấu `cho_cham`, điểm tạm 0.
 */
export function chamPhanMay(items: CauTrongDe[], traLoi: Map<number, TraLoiCauHoi>): KetQuaCauTrongLuot[] {
  return items.map((item, i) => {
    const t = traLoi.get(i + 1);
    const toiDa = diemCau(item);
    const rong = { thu_tu: i + 1, dung: false, diem: 0, diem_toi_da: toiDa, ket_qua: null };
    if (traLoiTrong(t)) return { ...rong, cho_cham: false };
    if (item.noi_dung.kind === "tu_luan") return { ...rong, cho_cham: true };
    const kq = chamCauHoi(item.noi_dung, t as TraLoiCauHoi);
    return { ...rong, dung: kq.dung, diem: kq.dung ? toiDa : 0, ket_qua: kq, cho_cham: false };
  });
}

/** Điểm lượt thang 100 từ điểm từng câu: tổng điểm đạt / tổng điểm tối đa. */
export function tongHopDiem(
  chiTiet: ReadonlyArray<Pick<KetQuaCauTrongLuot, "dung" | "diem" | "diem_toi_da">>,
  diemDat: number,
): { dung: number; tong: number; diem: number; dat: boolean } {
  const dat = chiTiet.reduce((s, c) => s + Math.max(0, Math.min(c.diem, c.diem_toi_da)), 0);
  const toiDa = chiTiet.reduce((s, c) => s + c.diem_toi_da, 0);
  const diem = toiDa > 0 ? Math.round((dat / toiDa) * 10_000) / 100 : 0;
  return { dung: chiTiet.filter((c) => c.dung).length, tong: chiTiet.length, diem, dat: diem >= diemDat };
}

/**
 * Chấm trọn một lượt chỉ bằng máy (câu tự luận chưa chấm tính 0). Đề chỉ có trắc nghiệm, mọi câu
 * 1 điểm, cho đúng điểm như cách tính cũ: số câu đúng / tổng số câu.
 */
export function chamLuot(
  items: CauTrongDe[],
  traLoi: Map<number, TraLoiCauHoi>,
  diemDat: number,
): KetQuaLuot {
  const chiTiet = chamPhanMay(items, traLoi);
  return { ...tongHopDiem(chiTiet, diemDat), chiTiet };
}

/* ------------------------------------------------------------------ */
/* Thời gian và điều kiện bắt đầu                                      */
/* ------------------------------------------------------------------ */

/**
 * Hạn nộp của một lượt: bắt đầu + thời lượng, nhưng không quá hạn của bài giao. Bắt đầu sát hạn
 * thì chỉ còn phần thời gian tới hạn, không được làm quá hạn đơn vị đặt.
 */
export function hanNop(batDau: Date, thoiLuongPhut: number, hanBaiGiao: Date): Date {
  return new Date(Math.min(batDau.getTime() + thoiLuongPhut * 60_000, hanBaiGiao.getTime()));
}

/** Còn nhận câu trả lời không (tính cả khoảng bù độ trễ mạng). */
export function conNhanTraLoi(deadline: Date, now: Date): boolean {
  return now.getTime() <= deadline.getTime() + DUNG_SAI_NOP_GIAY * 1000;
}

/** Số giây còn lại hiển thị cho người thi (không tính khoảng bù). */
export function giayConLai(deadline: Date, now: Date): number {
  return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
}

export type LyDoKhongBatDau =
  | "de_chua_xuat_ban"
  | "de_da_dong"
  | "bai_giao_da_huy"
  | "chua_mo"
  | "het_han"
  | "het_luot";

export const THONG_BAO_KHONG_BAT_DAU: Record<LyDoKhongBatDau, string> = {
  de_chua_xuat_ban: "Đề thi chưa được xuất bản.",
  de_da_dong: "Đề thi đã đóng, không nhận lượt làm mới.",
  bai_giao_da_huy: "Bài thi này đã bị hủy giao.",
  chua_mo: "Chưa tới giờ mở bài thi.",
  het_han: "Đã quá hạn làm bài.",
  het_luot: "Đã dùng hết số lần làm bài cho phép.",
};

/**
 * Được bắt đầu lượt mới không. Lượt đang làm dở không đi qua hàm này: người thi mở lại thì
 * tiếp tục lượt cũ.
 */
export function kiemTraBatDau(opts: {
  trangThaiDe: string;
  daHuy: boolean;
  moLuc: Date;
  han: Date;
  soLuotDaNop: number;
  soLuotToiDa: number;
  now: Date;
}): LyDoKhongBatDau | null {
  if (opts.trangThaiDe === "nhap") return "de_chua_xuat_ban";
  if (opts.trangThaiDe === "dong") return "de_da_dong";
  if (opts.daHuy) return "bai_giao_da_huy";
  if (opts.now < opts.moLuc) return "chua_mo";
  if (opts.now >= opts.han) return "het_han";
  if (opts.soLuotDaNop >= opts.soLuotToiDa) return "het_luot";
  return null;
}

export type CheDoXemDapAn = "khong" | "sau_nop" | "sau_han";

/** Người thi được xem lại đáp án từng câu chưa, theo cấu hình đề. */
export function duocXemDapAn(cheDo: CheDoXemDapAn, hanBaiGiao: Date, now: Date): boolean {
  if (cheDo === "sau_nop") return true;
  if (cheDo === "sau_han") return now >= hanBaiGiao;
  return false;
}
