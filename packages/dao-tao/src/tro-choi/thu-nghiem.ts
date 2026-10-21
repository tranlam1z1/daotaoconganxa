/**
 * Trò mẫu "Trắc nghiệm nhanh" (docs/PLAN.md GĐ-G0): 3 câu một đáp án hoặc đúng/sai lấy từ ngân
 * hàng câu hỏi đã duyệt, mỗi câu 20 giây, có thưởng nhanh. Trò này chỉ để chứng minh khung chạy
 * trọn vòng: vào chơi, chấm, cộng XP, lưu kết quả, xem lại, chơi offline rồi đồng bộ.
 */
import {
  chamCauHoi,
  type DeCauHoi,
  deChoNguoiHoc,
  type KetQuaCauHoi,
  type LoaiCauHoi,
  type NoiDungCauHoi,
  type TraLoiCauHoi,
} from "../cau-hoi.ts";
import { type CauHoiNguon, type CauTrongDe, daoPhuongAn, tron } from "../de-thi.ts";
import type { BuocLuot, DinhNghiaTroChoi } from "./khung.ts";

export const MA_THU_NGHIEM = "thu_nghiem";
export const LOAI_CAU_THU_NGHIEM: readonly LoaiCauHoi[] = ["mot_dap_an", "dung_sai"];
export const DIEM_MOI_CAU_THU_NGHIEM = 10;

/** Đề của một bước: câu hỏi đã đảo phương án, không có đáp án. */
export type DeThuNghiem = DeCauHoi;
/** Câu trả lời: id phương án chọn (có thể rỗng khi hết giờ chưa chọn). */
export interface TraLoiThuNghiem {
  chon: string[];
}

function sangNoiDung(q: CauHoiNguon): NoiDungCauHoi {
  return {
    kind: q.kind,
    level: q.level,
    stem: q.stem,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    citations: q.citations,
    image_uris: q.image_uris,
  };
}

export const TRO_CHOI_THU_NGHIEM: DinhNghiaTroChoi<CauTrongDe, DeThuNghiem, TraLoiThuNghiem> = {
  ma: MA_THU_NGHIEM,
  ten: "Trắc nghiệm nhanh",
  moTa: "3 câu trắc nghiệm, mỗi câu 20 giây. Trả lời càng nhanh càng được thêm điểm.",
  offline: true,
  nguon: "cau_hoi",
  soBuoc: 3,
  thoiGian: { moiBuocMs: 20_000 },
  thuongNhanh: true,
  xpCoBan: 10,

  locNguon(nguon) {
    return (nguon as CauHoiNguon[]).filter((q) => LOAI_CAU_THU_NGHIEM.includes(q.kind));
  },

  taoLuot(nguon, rng) {
    // Sắp theo id trước khi trộn: kết quả chỉ phụ thuộc tập nguồn và seed, không phụ thuộc thứ tự
    // CSDL trả về, để máy chủ sinh lại đúng lượt đã chơi offline.
    const goc = [...(this.locNguon(nguon) as CauHoiNguon[])].sort((a, b) => a.id.localeCompare(b.id));
    return tron(goc, rng)
      .slice(0, this.soBuoc)
      .map((q, i): BuocLuot<CauTrongDe> => {
        const noiDung = sangNoiDung(q);
        return {
          thu_tu: i + 1,
          ref_kind: "question",
          ref_id: q.id,
          ref_version: q.version,
          topic_id: q.topic_id || null,
          diem_toi_da: DIEM_MOI_CAU_THU_NGHIEM,
          noi_dung: {
            question_id: q.id,
            version: q.version,
            topic_id: q.topic_id,
            level: q.level,
            de: daoPhuongAn(deChoNguoiHoc(noiDung), rng),
            noi_dung: noiDung,
          },
        };
      });
  },

  deChoNguoiChoi(buoc) {
    return buoc.noi_dung.de;
  },

  docTraLoi(raw) {
    if (!raw || typeof raw !== "object") return null;
    const chon = (raw as { chon?: unknown }).chon;
    if (!Array.isArray(chon) || chon.length > 12) return null;
    if (!chon.every((x) => typeof x === "string" && x.length > 0 && x.length <= 40)) return null;
    return { chon: chon as string[] };
  },

  chamBuoc(buoc, traLoi) {
    const kq: KetQuaCauHoi = chamCauHoi(buoc.noi_dung.noi_dung, traLoi as TraLoiCauHoi);
    return {
      diem: kq.dung ? buoc.diem_toi_da : 0,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.dung,
      chiTiet: kq,
      giaiThich: kq.giai_thich,
      canCu: kq.can_cu,
    };
  },
};
