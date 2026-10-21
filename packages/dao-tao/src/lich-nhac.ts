/**
 * Lịch nhắc học và thông báo đẩy (docs/PLAN.md GĐ15): logic thuần, nhận `now` làm tham số để
 * test được mọi mốc giờ. Mọi giờ tính theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa).
 *
 * Job gửi chạy mỗi 15 phút nhưng có thể trễ hoặc lỡ một nhịp, nên mỗi loại thông báo có một
 * CỬA SỔ (không phải một thời điểm): nằm trong cửa sổ và chưa gửi hôm nay thì gửi. Chống gửi trùng
 * do khóa UNIQUE (account_id, kind, ref) ở CSDL, `ref` là ngày hoặc id bài giao.
 */

export type LoaiThongBao = "nhac_hoc" | "de_thi_moi" | "nhom_hoc";

/** Độ rộng cửa sổ gửi của các thông báo theo giờ. */
export const CUA_SO_PHUT = 120;

export interface GioVietNam {
  /** YYYY-MM-DD theo giờ Việt Nam. */
  ngay: string;
  /** Phút trong ngày theo giờ Việt Nam, 0–1439. */
  phut: number;
}

export function gioVietNam(now: Date): GioVietNam {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return { ngay: vn.toISOString().slice(0, 10), phut: vn.getUTCHours() * 60 + vn.getUTCMinutes() };
}

/** "HH:MM" hoặc "HH:MM:SS" -> phút trong ngày; sai dạng trả null. */
export function phutTuChuoi(gio: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(gio ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const p = Number(m[2]);
  return h < 24 && p < 60 ? h * 60 + p : null;
}

/** Có nằm trong giờ yên lặng không; khoảng qua nửa đêm (22:00–06:00) được xử lý đúng. */
export function trongGioYenLang(phut: number, tu: number, den: number): boolean {
  if (tu === den) return false;
  return tu < den ? phut >= tu && phut < den : phut >= tu || phut < den;
}

/** Trong cửa sổ [batDau, batDau + CUA_SO_PHUT) của cùng ngày. */
function trongCuaSo(phut: number, batDau: number): boolean {
  return phut >= batDau && phut < batDau + CUA_SO_PHUT;
}

export interface CaiDatNhac {
  /** "HH:MM"; null là không nhắc giờ học. */
  remind_at: string | null;
  new_exam: boolean;
  /** Thông báo nhóm học cùng: lượt cổ vũ mới, bài mới trong nhóm (docs/PLAN.md GĐ16a, câu N15). */
  group_activity: boolean;
  quiet_from: string;
  quiet_to: string;
}

export const CAI_DAT_MAC_DINH: CaiDatNhac = {
  remind_at: null,
  new_exam: true,
  group_activity: true,
  quiet_from: "22:00",
  quiet_to: "06:00",
};

/** Tình trạng một người tại thời điểm xét, do job đọc từ CSDL. */
export interface TinhTrangNguoiHoc {
  cai_dat: CaiDatNhac;
  /** Hôm nay (giờ Việt Nam) đã có hoạt động học chưa. */
  da_hoc_hom_nay: boolean;
  /** Bài thi mới được giao, đang mở, chưa làm. */
  bai_giao_moi: Array<{ id: string; ten: string }>;
  /** Hoạt động hôm nay trong các nhóm học cùng đang tham gia; thiếu là không có. */
  nhom_hoc?: { co_vu_moi: number; muc_moi: number };
}

export interface ThongBaoCanGui {
  kind: LoaiThongBao;
  ref: string;
  tieu_de: string;
  noi_dung: string;
  /** Đường dẫn mở khi bấm vào thông báo. */
  url: string;
}

/**
 * Các thông báo một người cần nhận lúc `now`. Trong giờ yên lặng thì không gửi gì, kể cả đề thi
 * mới: thông báo đề thi được gửi ở nhịp đầu tiên sau giờ yên lặng.
 */
export function thongBaoCanGui(t: TinhTrangNguoiHoc, now: Date): ThongBaoCanGui[] {
  const { ngay, phut } = gioVietNam(now);
  const c = t.cai_dat;
  const yenTu = phutTuChuoi(c.quiet_from) ?? 22 * 60;
  const yenDen = phutTuChuoi(c.quiet_to) ?? 6 * 60;
  if (trongGioYenLang(phut, yenTu, yenDen)) return [];

  const ra: ThongBaoCanGui[] = [];
  const nhac = phutTuChuoi(c.remind_at);
  // Đã học hôm nay thì không nhắc nữa: nhắc là để bắt đầu, không phải để làm phiền.
  if (nhac !== null && !t.da_hoc_hom_nay && trongCuaSo(phut, nhac)) {
    ra.push({
      kind: "nhac_hoc",
      ref: ngay,
      tieu_de: "Đến giờ học",
      noi_dung: "Dành 5 phút luyện 10 câu hỏi hôm nay.",
      url: "/luyen-tap",
    });
  }
  if (c.new_exam) {
    for (const b of t.bai_giao_moi) {
      ra.push({
        kind: "de_thi_moi",
        ref: b.id,
        tieu_de: "Có bài thi mới được giao",
        noi_dung: b.ten,
        url: "/thi",
      });
    }
  }
  // Nhóm học cùng (N9): gộp mọi lượt cổ vũ và bài mới trong ngày thành tối đa một thông báo,
  // `ref` là ngày. Gửi ở nhịp đầu tiên ngoài giờ yên lặng, như thông báo đề thi.
  const nhom = t.nhom_hoc;
  if (c.group_activity && nhom && (nhom.co_vu_moi > 0 || nhom.muc_moi > 0)) {
    const cau: string[] = [];
    if (nhom.co_vu_moi > 0) cau.push(`Hôm nay bạn nhận ${nhom.co_vu_moi} lượt cổ vũ.`);
    if (nhom.muc_moi > 0) cau.push(`Nhóm của bạn có ${nhom.muc_moi} bài mới được chia sẻ.`);
    ra.push({ kind: "nhom_hoc", ref: ngay, tieu_de: "Nhóm học cùng", noi_dung: cau.join(" "), url: "/nhom" });
  }
  return ra;
}

/** Mã trạng thái của dịch vụ đẩy báo đăng ký đã hết hạn hoặc bị hủy: xóa đăng ký, không thử lại. */
export function dangKyHetHan(status: number): boolean {
  return status === 404 || status === 410;
}
