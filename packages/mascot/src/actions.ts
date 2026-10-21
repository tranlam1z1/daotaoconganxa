/**
 * Bộ chọn hành động của mascot (ke-hoach/09-b §5).
 *
 * Nhận một sự kiện + ngữ cảnh phiên học, trả về NHIỀU NHẤT MỘT hành động. Im lặng là kết
 * quả hợp lệ và là kết quả mặc định — phần lớn sự kiện không nên làm nhân vật xuất hiện.
 *
 * Hạn mức kiểm ở đây (chứ không chỉ ở giao diện) vì giao diện có thể bị nạp lại, còn phiên
 * học thì không: người học tải lại trang ba lần không được phép nhận ba lần chào.
 */

import {
  type DieuKien,
  type HanhDong,
  KICH_HOAT_PHAN_HOI,
  KICH_HOAT_PHAP_LY,
  type KichHoat,
  type LoiThoai,
  type MucXuatHien,
  type NguCanhPhien,
  type ToanTuDieuKien,
} from "./types.ts";

/** Hạn mức toàn cục, 09-b §5.4. Đọc từ `mascot_settings` khi có; đây là giá trị dự phòng. */
export interface HanMuc {
  maxPerSession: number;
  minGapSeconds: number;
}

export const HAN_MUC_MAC_DINH: HanMuc = { maxPerSession: 8, minGapSeconds: 180 };

export type LyDoImLang =
  | "da_tat"
  | "dang_nhap_lieu"
  | "vuot_han_muc_phien"
  | "chua_du_khoang_cach"
  | "yen_lang"
  | "khong_co_hanh_dong"
  | "het_han_muc_hanh_dong"
  | "dang_nghi"
  | "khong_khop_dieu_kien";

export interface KetQuaChonHanhDong {
  hanhDong: HanhDong | null;
  /** Lời thoại đã chọn trong các biến thể; null khi im lặng. */
  loiThoai: LoiThoai | null;
  lyDoImLang?: LyDoImLang;
}

/* ------------------------------------------------------------------ */
/* Điều kiện                                                           */
/* ------------------------------------------------------------------ */

function soSanh(thuc: unknown, toan_tu: ToanTuDieuKien, mong: string | number | boolean): boolean {
  switch (toan_tu) {
    case "bang":
      return String(thuc) === String(mong);
    case "khac":
      return String(thuc) !== String(mong);
    case "lon_hon":
      return Number(thuc) > Number(mong);
    case "nho_hon":
      return Number(thuc) < Number(mong);
    case "chua":
      return String(thuc ?? "").includes(String(mong));
    case "trong":
      // Giá trị mong đợi là danh sách phân tách bằng dấu phẩy.
      return String(mong)
        .split(",")
        .map((s) => s.trim())
        .includes(String(thuc));
  }
}

export function thoaDieuKien(dk: DieuKien[], bien: Record<string, string | number | boolean>): boolean {
  return dk.every((d) => soSanh(bien[d.truong], d.toan_tu, d.gia_tri));
}

/* ------------------------------------------------------------------ */
/* Chọn lời thoại                                                      */
/* ------------------------------------------------------------------ */

/**
 * Chọn một biến thể lời thoại. Xoay vòng theo số lần hành động đã chạy để người học không
 * nghe lại đúng một câu — nhàm chán là cách nhanh nhất để mascot bị tắt.
 *
 * Lời loại `loi_phap_ly` mà không có viện dẫn thì BỊ LOẠI: nhân vật không được phát biểu
 * nội dung pháp lý không có căn cứ, dù người soạn có cấu hình sai.
 */
export function chonLoiThoai(hd: HanhDong, soLanDaChay: number): LoiThoai | null {
  const hopLe = hd.speech.filter((s) => s.loai !== "loi_phap_ly" || (s.citations?.length ?? 0) > 0);
  if (!hopLe.length) return null;
  return hopLe[soLanDaChay % hopLe.length] ?? null;
}

/* ------------------------------------------------------------------ */
/* Chọn hành động                                                      */
/* ------------------------------------------------------------------ */

function batBuocBao(trigger: KichHoat): boolean {
  return (KICH_HOAT_PHAP_LY as readonly string[]).includes(trigger);
}

/** Sự kiện này là phản hồi cho thao tác của người học, không phải nhân vật tự lên tiếng. */
function laPhanHoi(trigger: KichHoat): boolean {
  return (KICH_HOAT_PHAN_HOI as readonly string[]).includes(trigger);
}

/** Chế độ `it` chỉ cho qua hành động ưu tiên cao và các sự kiện pháp lý. */
function quaDuocMucXuatHien(muc: MucXuatHien, hd: HanhDong): boolean {
  if (batBuocBao(hd.trigger)) return true;
  if (muc === "tat") return false;
  if (muc === "yen_lang") return false;
  if (muc === "it") return hd.priority >= 70;
  return true;
}

export function chonHanhDong(
  trigger: KichHoat,
  tatCa: HanhDong[],
  nc: NguCanhPhien,
  hanMuc: HanMuc = HAN_MUC_MAC_DINH,
): KetQuaChonHanhDong {
  const imLang = (lyDo: LyDoImLang): KetQuaChonHanhDong => ({
    hanhDong: null,
    loiThoai: null,
    lyDoImLang: lyDo,
  });

  const phapLy = batBuocBao(trigger);
  const duocGoi = nc.nguoiHocGoi === true;
  // Ba nhóm không chịu hạn mức TẦN SUẤT CHUNG: sự kiện pháp lý (không được im), yêu cầu
  // trực tiếp của người học, và phản hồi cho thao tác vừa rồi của người học. Hạn mức riêng
  // của từng hành động vẫn áp dụng cho hai nhóm sau.
  const boQuaHanMuc = phapLy || duocGoi || laPhanHoi(trigger);

  if (nc.mucXuatHien === "tat" && !boQuaHanMuc) return imLang("da_tat");
  // Không bao giờ chen ngang khi người học đang gõ hoặc đang trong câu hỏi tính giờ.
  // Ngoại lệ: chính người học vừa bấm gọi.
  if (nc.dangNhapLieu && !duocGoi) return imLang("dang_nhap_lieu");
  if (!boQuaHanMuc && nc.soLanTrongPhien >= hanMuc.maxPerSession) return imLang("vuot_han_muc_phien");
  if (!boQuaHanMuc && nc.giayTuLanTruoc < hanMuc.minGapSeconds) return imLang("chua_du_khoang_cach");

  const ungVien = tatCa.filter((hd) => hd.enabled && hd.trigger === trigger);
  if (!ungVien.length) return imLang("khong_co_hanh_dong");

  let coUngVienHopDieuKien = false;
  let coUngVienConHanMuc = false;

  const loc = ungVien.filter((hd) => {
    if (!duocGoi && !quaDuocMucXuatHien(nc.mucXuatHien, hd)) return false;
    if (hd.audiences.length && nc.audience && !hd.audiences.includes(nc.audience)) return false;
    if (hd.courseIds.length && nc.courseId && !hd.courseIds.includes(nc.courseId)) return false;
    if (!thoaDieuKien(hd.conditions, nc.bien)) return false;
    coUngVienHopDieuKien = true;

    if (duocGoi) {
      coUngVienConHanMuc = true;
      return true;
    }

    if (nc.daDong.includes(hd.code)) return false;
    if ((nc.soLanTrongPhienTheoCode[hd.code] ?? 0) >= hd.maxPerSession) return false;
    if ((nc.soLanHomNayTheoCode[hd.code] ?? 0) >= hd.maxPerDay) return false;
    coUngVienConHanMuc = true;

    const tuLanTruoc = nc.lanChayGanNhat[hd.code];
    if (tuLanTruoc !== undefined && tuLanTruoc < hd.cooldownSeconds) return false;
    return true;
  });

  if (!loc.length) {
    if (nc.mucXuatHien === "yen_lang" && !boQuaHanMuc) return imLang("yen_lang");
    if (!coUngVienHopDieuKien) return imLang("khong_khop_dieu_kien");
    if (!coUngVienConHanMuc) return imLang("het_han_muc_hanh_dong");
    return imLang("dang_nghi");
  }

  // Ưu tiên cao nhất; hoà thì lấy hành động lâu chưa dùng nhất.
  const chon = loc.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const la = nc.lanChayGanNhat[a.code] ?? Number.POSITIVE_INFINITY;
    const lb = nc.lanChayGanNhat[b.code] ?? Number.POSITIVE_INFINITY;
    return lb - la;
  })[0]!;

  return { hanhDong: chon, loiThoai: chonLoiThoai(chon, nc.soLanHomNayTheoCode[chon.code] ?? 0) };
}

/**
 * Có nên tự vô hiệu hoá một hành động không (09-b §9).
 * Tỷ lệ người học tắt hẳn mascot sau khi gặp hành động này là chỉ số nghiêm khắc nhất:
 * vượt 2% nghĩa là hành động đang đuổi người dùng đi, phải dừng ngay chứ không chờ họp.
 */
export interface SoLieuHanhDong {
  hien: number;
  bamCta: number;
  dong: number;
  tatMascot: number;
}

export interface DanhGiaHanhDong {
  tyLeBamCta: number;
  tyLeDong: number;
  tyLeTatMascot: number;
  nenTuTat: boolean;
  canhBao: string[];
}

export function danhGiaHanhDong(sl: SoLieuHanhDong): DanhGiaHanhDong {
  const n = sl.hien || 1;
  const bam = sl.bamCta / n;
  const dong = sl.dong / n;
  const tat = sl.tatMascot / n;
  const canhBao: string[] = [];
  // Dưới 30 lượt hiện thì mọi tỷ lệ đều là nhiễu, không kết luận.
  if (sl.hien >= 30) {
    if (bam < 0.08) canhBao.push("Rất ít người bấm — xem lại lời thoại và lời mời");
    if (dong > 0.3) canhBao.push("Nhiều người đóng — giảm ưu tiên hoặc tăng thời gian nghỉ");
    if (tat > 0.02) canhBao.push("Có người tắt hẳn mascot sau hành động này");
  }
  return {
    tyLeBamCta: Number(bam.toFixed(3)),
    tyLeDong: Number(dong.toFixed(3)),
    tyLeTatMascot: Number(tat.toFixed(3)),
    nenTuTat: sl.hien >= 30 && tat > 0.02,
    canhBao,
  };
}
