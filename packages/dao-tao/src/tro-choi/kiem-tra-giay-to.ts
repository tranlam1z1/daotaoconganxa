/**
 * Trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1, docs/GAME_DESIGN.md §5.1).
 *
 * Mỗi lượt 8 người lái. Với từng người, người chơi soi giấy tờ (giấy phép lái xe, giấy đăng ký
 * xe, giấy bảo hiểm bắt buộc), chạm vào chi tiết sai để đánh dấu, rồi đóng dấu "Cho qua" hoặc
 * "Giữ lại". Mỗi người 20 điểm:
 *   - quyết định đúng: 10 điểm;
 *   - người có lỗi, giữ lại: thêm tối đa 10 điểm theo tỷ lệ lỗi đã chỉ ra, trừ 2 điểm cho mỗi chi
 *     tiết đánh dấu nhầm (phần này không âm);
 *   - người hợp lệ, cho qua: đủ 20 điểm; giữ lại người hợp lệ: 0 điểm.
 * (GAME_DESIGN §5.1 đề xuất giữ nhầm bị trừ nặng hơn cho qua nhầm; khung chung không cho điểm bước
 * âm, nên cả hai cùng 0 điểm và màn kết quả nêu rõ.)
 *
 * 5 màn, lỗi tinh vi dần: màn 1 chỉ giấy phép lái xe; màn 2 thêm đăng ký xe; màn 3 thêm bảo hiểm;
 * màn 4 thêm hạng giấy phép; màn 5 thêm giấy phép của người khác và các lỗi sát biên.
 *
 * Hồ sơ (game_content) chỉ có dữ kiện và danh sách lỗi người soạn dự kiến. Đáp án suy ra từ luật
 * giấy tờ ĐÃ DUYỆT bằng bộ kiểm M1 (chung/giay-to.ts). Hồ sơ mà luật đã duyệt cho kết quả khác dự
 * kiến, hoặc còn thiếu luật cho màn đang chơi, thì không vào lượt.
 */

import { tron } from "../de-thi.ts";
import { type DongBienBan, dongBienBan, type MucPhatDaDuyet } from "./chung/bien-ban.ts";
import {
  DAU_HIEU,
  type DauHieu,
  type HoSoGiayTo,
  kiemTraDuLieuHoSo,
  kiemTraHoSo,
  type LoaiGiayTo,
  type LoiPhatHien,
  type LuatGiayTo,
  luatConThieu,
  MA_LOI_GIAY_TO,
  type MaLoiGiayTo,
  type PhanLoaiXe,
  TEN_DAU_HIEU,
  TEN_LOI_GIAY_TO,
  TEN_PHAN_LOAI_XE,
} from "./chung/giay-to.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_KIEM_TRA_GIAY_TO = "kiem_tra_giay_to";
export const SO_NGUOI_MOI_LUOT = 8;
export const DIEM_QUYET_DINH = 10;
export const DIEM_CHI_RA = 10;
export const DIEM_MOI_NGUOI = DIEM_QUYET_DINH + DIEM_CHI_RA;
export const TRU_DANH_DAU_NHAM = 2;

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

/** Lỗi mới xuất hiện ở từng màn. Màn sau gồm cả lỗi của các màn trước. */
export const LOI_MOI_CUA_MAN: Readonly<Record<number, readonly MaLoiGiayTo[]>> = {
  1: ["thieu_gplx", "gplx_ngoai_han"],
  2: ["thieu_dang_ky", "dang_ky_sai_bien_so", "dang_ky_sai_nhan_hieu"],
  3: ["thieu_bao_hiem", "bao_hiem_ngoai_han", "bao_hiem_sai_bien_so"],
  4: ["gplx_sai_hang"],
  5: ["gplx_nguoi_khac"],
};

export const MAN_KIEM_TRA_GIAY_TO: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Giấy phép lái xe",
    moTa: "Chỉ soi giấy phép lái xe: có xuất trình không, còn giá trị không. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Đăng ký xe",
    moTa: "Thêm giấy đăng ký xe: biển số, nhãn hiệu phải khớp với xe. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Bảo hiểm",
    moTa: "Thêm giấy bảo hiểm bắt buộc: còn hiệu lực, đúng biển số. 4 phút cho cả ca.",
    caLuotMs: 240_000,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Hạng giấy phép",
    moTa: "Hạng giấy phép lái xe phải phù hợp với loại xe. 3 phút 30 giây cho cả ca.",
    caLuotMs: 210_000,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Lỗi tinh vi",
    moTa: "Lệch một chữ số, hết hạn đúng một ngày, giấy phép của người khác. 3 phút cho cả ca.",
    caLuotMs: 180_000,
    xpCoBan: 18,
  },
];

export const SO_MAN_GIAY_TO = MAN_KIEM_TRA_GIAY_TO.length;

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_GIAY_TO, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/** Các lỗi được kiểm ở một màn (gồm lỗi của các màn trước). */
export function loiCuaMan(man: number): Set<MaLoiGiayTo> {
  const m = ganMan(man);
  const kq = new Set<MaLoiGiayTo>();
  for (let i = 1; i <= m; i++) for (const l of LOI_MOI_CUA_MAN[i] ?? []) kq.add(l);
  return kq;
}

/** Giấy tờ người chơi được xem ở một màn. */
export function giayToCuaMan(man: number): LoaiGiayTo[] {
  const m = ganMan(man);
  return m === 1 ? ["gplx"] : m === 2 ? ["gplx", "dang_ky"] : ["gplx", "dang_ky", "bao_hiem"];
}

/** Màn đầu tiên có lỗi này. */
export function manCuaLoi(ma: MaLoiGiayTo): number {
  for (let i = 1; i <= SO_MAN_GIAY_TO; i++) if (LOI_MOI_CUA_MAN[i]?.includes(ma)) return i;
  return SO_MAN_GIAY_TO;
}

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

/** Dữ kiện lưu ở game_content.payload: hồ sơ và màn nhỏ nhất hồ sơ được dùng. */
export interface PayloadHoSo extends HoSoGiayTo {
  muc: number;
}

/** Một nguồn của trò: hồ sơ đã duyệt kèm luật giấy tờ và mức phạt đã duyệt dùng cho hồ sơ đó. */
export interface NguonGiayTo {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  muc: number;
  ho_so: HoSoGiayTo;
  /** Lỗi người soạn dự kiến (game_content.answer.loi). */
  loi_du_kien: MaLoiGiayTo[];
  luat: LuatGiayTo[];
  muc_phat: Record<string, MucPhatDaDuyet>;
}

/** Nội dung một bước trong ảnh chụp lượt (có đáp án, chỉ máy chủ và gói offline giữ). */
export interface BuocGiayTo {
  man: number;
  ho_so: HoSoGiayTo;
  giay_to_hien: LoaiGiayTo[];
  loi: LoiPhatHien[];
  luat: LuatGiayTo[];
  bien_ban: DongBienBan[];
}

/** Phần đề gửi người chơi: dữ kiện nhìn thấy được, không có lỗi hay luật. */
export interface DeGiayTo {
  man: number;
  ngay_kiem_tra: string;
  loi_noi: string;
  xe: HoSoGiayTo["xe"] & { ten_phan_loai: string };
  /** Chỉ các giấy tờ được xem ở màn này; null là người lái không xuất trình. */
  giay_to: {
    gplx?: HoSoGiayTo["giay_to"]["gplx"];
    dang_ky?: HoSoGiayTo["giay_to"]["dang_ky"];
    bao_hiem?: HoSoGiayTo["giay_to"]["bao_hiem"];
  };
  giay_to_kiem: LoaiGiayTo[];
}

export type QuyetDinh = "cho_qua" | "giu_lai";

export interface TraLoiGiayTo {
  quyet_dinh: QuyetDinh;
  dau_hieu: DauHieu[];
}

export interface ChiTietGiayTo {
  quyet_dinh: QuyetDinh;
  quyet_dinh_dung: QuyetDinh;
  diem_quyet_dinh: number;
  diem_chi_ra: number;
  loi: Array<{
    ma_loi: MaLoiGiayTo;
    ten: string;
    mo_ta: string;
    da_chi_ra: boolean;
    dau_hieu: DauHieu[];
    giai_thich: string;
    can_cu: string;
  }>;
  dau_hieu_sai: Array<{ ma: DauHieu; ten: string }>;
  bien_ban: DongBienBan[];
}

/* ------------------------------------------------------------------ */
/* Kiểm nguồn                                                          */
/* ------------------------------------------------------------------ */

/** Kiểm dữ kiện một hồ sơ trò chơi (payload + lỗi dự kiến). Trả danh sách lỗi; rỗng là hợp lệ. */
export function kiemTraHoSoTroChoi(payload: Partial<PayloadHoSo> | null | undefined, loi: unknown): string[] {
  const kq = kiemTraDuLieuHoSo(payload);
  if (!payload) return kq;
  if (!Number.isInteger(payload.muc) || (payload.muc ?? 0) < 1 || (payload.muc ?? 0) > SO_MAN_GIAY_TO)
    kq.push(`Màn của hồ sơ (muc) phải từ 1 đến ${SO_MAN_GIAY_TO}.`);
  if (!Array.isArray(loi) || loi.some((l) => !(MA_LOI_GIAY_TO as readonly string[]).includes(l as string)))
    kq.push("Danh sách lỗi dự kiến có mã không hợp lệ.");
  else if (Number.isInteger(payload.muc)) {
    const cho = loiCuaMan(payload.muc!);
    for (const l of loi as MaLoiGiayTo[])
      if (!cho.has(l))
        kq.push(
          `Lỗi "${TEN_LOI_GIAY_TO[l]}" chỉ có từ màn ${manCuaLoi(l)}, hồ sơ đang ở màn ${payload.muc}.`,
        );
  }
  return kq;
}

const cungTap = (a: readonly string[], b: readonly string[]) => {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Hồ sơ dùng được ở một màn: màn của hồ sơ không cao hơn màn đang chơi, đủ luật đã duyệt cho mọi lỗi
 * của màn, và luật đã duyệt cho đúng các lỗi người soạn dự kiến.
 */
export function dungDuocOMan(n: NguonGiayTo, man: number): boolean {
  const bat = loiCuaMan(man);
  if (n.muc > ganMan(man)) return false;
  if (luatConThieu(n.ho_so, n.luat, bat).length) return false;
  return cungTap(
    kiemTraHoSo(n.ho_so, n.luat, bat).map((l) => l.ma_loi),
    n.loi_du_kien,
  );
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

function dungBuoc(n: NguonGiayTo, thuTu: number, man: number): BuocLuot<BuocGiayTo> {
  const loi = kiemTraHoSo(n.ho_so, n.luat, loiCuaMan(man));
  const theoMa = new Map(n.luat.map((l) => [l.ma, l]));
  return {
    thu_tu: thuTu,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: DIEM_MOI_NGUOI,
    noi_dung: {
      man,
      ho_so: n.ho_so,
      giay_to_hien: giayToCuaMan(man),
      loi,
      // Chỉ giữ luật của các lỗi có trong hồ sơ, để ảnh chụp lượt gọn.
      luat: loi.map((l) => theoMa.get(l.luat_ma)!),
      bien_ban: loi.map((l) => {
        const lu = theoMa.get(l.luat_ma)!;
        return dongBienBan({
          hanhVi: TEN_LOI_GIAY_TO[l.ma_loi],
          chiTiet: l.mo_ta,
          canCu: [lu.can_cu],
          maMucPhat: lu.ma_muc_phat,
          mucPhat: n.muc_phat,
        });
      }),
    },
  };
}

function giaiThich(b: BuocGiayTo, tl: TraLoiGiayTo): string {
  if (!b.loi.length) {
    return tl.quyet_dinh === "cho_qua"
      ? "Giấy tờ đầy đủ, còn giá trị và khớp với xe, với người lái: cho qua là đúng."
      : "Giấy tờ đầy đủ, còn giá trị và khớp với xe, với người lái. Giữ lại người có giấy tờ hợp lệ là sai.";
  }
  const ds = b.loi.map((l) => TEN_LOI_GIAY_TO[l.ma_loi].toLowerCase()).join("; ");
  const dau = `Người lái này có ${b.loi.length} lỗi: ${ds}. Phải giữ lại để xử lý.`;
  return tl.quyet_dinh === "cho_qua" ? `${dau} Bạn đã cho qua.` : dau;
}

export const TRO_CHOI_KIEM_TRA_GIAY_TO: DinhNghiaTroChoi<BuocGiayTo, DeGiayTo, TraLoiGiayTo> = {
  ma: MA_KIEM_TRA_GIAY_TO,
  ten: "Kiểm tra giấy tờ",
  moTa: "Soi giấy phép lái xe, đăng ký xe, bảo hiểm của từng người lái; đóng dấu cho qua hoặc giữ lại.",
  offline: true,
  nguon: "giay_to_ho_so",
  soBuoc: SO_NGUOI_MOI_LUOT,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_KIEM_TRA_GIAY_TO,

  locNguon(nguon) {
    return (nguon as NguonGiayTo[]).filter(
      (n) =>
        n?.ho_so &&
        kiemTraHoSoTroChoi({ ...n.ho_so, muc: n.muc }, n.loi_du_kien).length === 0 &&
        Array.isArray(n.luat),
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const dung = tron(
      (this.locNguon(nguon) as NguonGiayTo[])
        .filter((n) => dungDuocOMan(n, m))
        .sort((a, b) => a.id.localeCompare(b.id)),
      rng,
    );
    const pool = [...dung.filter((n) => n.muc === m), ...dung.filter((n) => n.muc !== m)];
    const chon: NguonGiayTo[] = [];
    const lay = (dk: (n: NguonGiayTo) => boolean, soLuong: number) => {
      for (const n of pool) {
        if (soLuong <= 0 || chon.length >= this.soBuoc) return;
        if (!chon.includes(n) && dk(n)) {
          chon.push(n);
          soLuong--;
        }
      }
    };
    const coLoi = (n: NguonGiayTo) => n.loi_du_kien.length > 0;
    // Ít nhất 2 người hợp lệ và 3 người có lỗi (nếu đủ nguồn), ưu tiên hồ sơ đúng màn đang chơi.
    lay((n) => !coLoi(n), 2);
    lay((n) => coLoi(n) && n.muc === m, 3);
    lay(coLoi, 3 - chon.filter(coLoi).length);
    lay((n) => n.muc === m, this.soBuoc);
    lay(() => true, this.soBuoc);
    return tron(chon, rng).map((n, i) => dungBuoc(n, i + 1, m));
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    const h = b.ho_so;
    const giay_to: DeGiayTo["giay_to"] = {};
    for (const gt of b.giay_to_hien) (giay_to as Record<string, unknown>)[gt] = h.giay_to[gt] ?? null;
    return {
      man: b.man,
      ngay_kiem_tra: h.ngay_kiem_tra,
      loi_noi: h.nguoi_lai.loi_noi,
      xe: { ...h.xe, ten_phan_loai: TEN_PHAN_LOAI_XE[h.xe.phan_loai as PhanLoaiXe] },
      giay_to,
      giay_to_kiem: b.giay_to_hien,
    };
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (r.quyet_dinh !== "cho_qua" && r.quyet_dinh !== "giu_lai") return null;
    const ds = r.dau_hieu ?? [];
    if (!Array.isArray(ds) || ds.length > DAU_HIEU.length) return null;
    if (ds.some((d) => !(DAU_HIEU as readonly string[]).includes(d as string))) return null;
    const dau_hieu = [...new Set(ds as DauHieu[])];
    // Giữ lại phải chỉ ra ít nhất một chi tiết sai; cho qua thì bỏ các dấu đã đánh.
    if (r.quyet_dinh === "giu_lai" && !dau_hieu.length) return null;
    return { quyet_dinh: r.quyet_dinh, dau_hieu: r.quyet_dinh === "giu_lai" ? dau_hieu : [] };
  },

  chamBuoc(buoc, tl) {
    const b = buoc.noi_dung;
    const coLoi = b.loi.length > 0;
    const dungQd: QuyetDinh = coLoi ? "giu_lai" : "cho_qua";
    const quyetDinhDung = tl.quyet_dinh === dungQd;
    const chon = new Set(tl.dau_hieu);
    const hopLe = new Set(b.loi.flatMap((l) => l.dau_hieu));
    const sai = tl.dau_hieu.filter((d) => !hopLe.has(d));
    const theoMa = new Map(b.luat.map((l) => [l.ma, l]));
    const loi = b.loi.map((l) => ({
      ma_loi: l.ma_loi,
      ten: TEN_LOI_GIAY_TO[l.ma_loi],
      mo_ta: l.mo_ta,
      da_chi_ra: tl.quyet_dinh === "giu_lai" && l.dau_hieu.some((d) => chon.has(d)),
      dau_hieu: [...l.dau_hieu],
      giai_thich: theoMa.get(l.luat_ma)?.giai_thich ?? "",
      can_cu: theoMa.get(l.luat_ma)?.can_cu ?? "",
    }));
    const diemQd = quyetDinhDung ? DIEM_QUYET_DINH : 0;
    let diemChiRa = 0;
    if (quyetDinhDung && !coLoi) diemChiRa = DIEM_CHI_RA;
    else if (quyetDinhDung) {
      const tyLe = loi.filter((l) => l.da_chi_ra).length / loi.length;
      const tho = DIEM_CHI_RA * tyLe - TRU_DANH_DAU_NHAM * sai.length;
      diemChiRa = Math.max(0, Math.min(DIEM_CHI_RA, Math.round(tho * 10) / 10));
    }
    const diem = diemQd + diemChiRa;
    const chiTiet: ChiTietGiayTo = {
      quyet_dinh: tl.quyet_dinh,
      quyet_dinh_dung: dungQd,
      diem_quyet_dinh: diemQd,
      diem_chi_ra: diemChiRa,
      loi,
      dau_hieu_sai: sai.map((d) => ({ ma: d, ten: TEN_DAU_HIEU[d] })),
      bien_ban: b.bien_ban,
    };
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich: giaiThich(b, tl),
      canCu: [...new Set(loi.map((l) => l.can_cu).filter(Boolean))],
    };
  },
};
