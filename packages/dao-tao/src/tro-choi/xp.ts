/**
 * Điểm kinh nghiệm (XP) của trò chơi (docs/PLAN.md GĐ10). Quy tắc XP chung của luyện tập, thử
 * thách và thi nằm ở diem-thuong.ts (GĐ9); tệp này chỉ có phần riêng của game, cũng là một bảng
 * cấu hình để sửa khi khách hàng chốt (GAP 4.4-19).
 *
 * XP của một ván được ghi MỘT lần qua `congXp` của @qdpl/db, với nguồn `game:<mã>` và id phiên.
 */

export const QUY_TAC_XP_TRO_CHOI = {
  vuot_man: { moi_cau_dung: 2, qua_man_lan_dau: 10 },
  dua_thoi_gian: { moi_cau_dung: 1, pha_ky_luc: 5 },
  ghep_cap: { moi_cap_dung: 1, dung_het: 5 },
  doan_bien_bao: { moi_cau_dung: 1, dung_het: 5 },
  hoi_nhanh_giong_noi: { moi_cau_dung: 1, dung_het: 5 },
} as const;

export type MaTroChoi = keyof typeof QUY_TAC_XP_TRO_CHOI;

/* ------------------------------------------------------------------ */
/* Khung lượt chơi chung (docs/PLAN.md GĐ-G0)                          */
/* ------------------------------------------------------------------ */

/**
 * Hệ số XP theo thứ tự của lượt trong ngày (giờ Việt Nam), cùng một trò: lượt 1–3 đủ XP, lượt 4–6
 * một nửa, từ lượt 7 không có XP (kết quả vẫn được lưu). Chống chơi lặp chỉ để lấy XP
 * (docs/GAME_DESIGN.md §2.5, câu Q12).
 */
export const BAC_XP_THEO_LUOT: ReadonlyArray<{ tuLuot: number; heSo: number }> = [
  { tuLuot: 1, heSo: 1 },
  { tuLuot: 4, heSo: 0.5 },
  { tuLuot: 7, heSo: 0 },
];

export function heSoXpTheoLuot(thuTuTrongNgay: number): number {
  let heSo = 1;
  for (const b of BAC_XP_THEO_LUOT) if (thuTuTrongNgay >= b.tuLuot) heSo = b.heSo;
  return heSo;
}

/**
 * XP của một lượt trên khung chung: XP cơ bản × tỷ lệ điểm (không tính thưởng nhanh) + thưởng
 * riêng của trò, tất cả nhân hệ số theo số lượt trong ngày. Làm tròn tới số nguyên.
 */
export function xpLuotChoi(p: {
  xpCoBan: number;
  tyLe: number;
  thuTuTrongNgay: number;
  thuong?: number;
}): number {
  const tyLe = Math.min(1, Math.max(0, p.tyLe));
  return Math.round((p.xpCoBan * tyLe + Math.max(0, p.thuong ?? 0)) * heSoXpTheoLuot(p.thuTuTrongNgay));
}

export function xpTroChoi(
  ma: MaTroChoi,
  kq: { soDung: number; tong: number; quaManLanDau?: boolean; phaKyLuc?: boolean },
): number {
  switch (ma) {
    case "vuot_man": {
      const q = QUY_TAC_XP_TRO_CHOI.vuot_man;
      return kq.soDung * q.moi_cau_dung + (kq.quaManLanDau ? q.qua_man_lan_dau : 0);
    }
    case "dua_thoi_gian": {
      const q = QUY_TAC_XP_TRO_CHOI.dua_thoi_gian;
      return kq.soDung * q.moi_cau_dung + (kq.phaKyLuc && kq.soDung > 0 ? q.pha_ky_luc : 0);
    }
    case "ghep_cap": {
      const q = QUY_TAC_XP_TRO_CHOI.ghep_cap;
      return kq.soDung * q.moi_cap_dung + (kq.tong > 0 && kq.soDung === kq.tong ? q.dung_het : 0);
    }
    case "doan_bien_bao": {
      const q = QUY_TAC_XP_TRO_CHOI.doan_bien_bao;
      return kq.soDung * q.moi_cau_dung + (kq.tong > 0 && kq.soDung === kq.tong ? q.dung_het : 0);
    }
    case "hoi_nhanh_giong_noi": {
      const q = QUY_TAC_XP_TRO_CHOI.hoi_nhanh_giong_noi;
      return kq.soDung * q.moi_cau_dung + (kq.tong > 0 && kq.soDung === kq.tong ? q.dung_het : 0);
    }
  }
}
