/**
 * Luyện tập (docs/PLAN.md GĐ4): logic thuần, không chạm CSDL.
 *
 * - Rút câu có seed: cùng seed, cùng nguồn và cùng lịch sử thì ra cùng đề (tái lập khi test).
 * - Trộn mức độ theo tỷ lệ 4 dễ / 4 trung bình / 2 khó; thiếu mức nào thì bù bằng mức khác.
 * - Trong mỗi mức, ưu tiên câu chưa làm, rồi câu hay sai, rồi các câu còn lại.
 * - Đảo phương án dùng chung `daoPhuongAn` của đề thi (de-thi.ts): chỉ đổi thứ tự hiển thị,
 *   giữ id, nên `chamCauHoi` chấm thẳng được mà không cần ánh xạ ngược.
 * - Câu sai rời danh sách khi làm đúng 2 lần liên tiếp.
 */

import { deChoNguoiHoc, type MucDoCauHoi, type NoiDungCauHoi } from "./cau-hoi.ts";
import { type CauHoiNguon, type CauTrongDe, daoPhuongAn, taoRng, tron } from "./de-thi.ts";

export const SO_CAU_MOI_PHIEN = 10;

/** Tỷ lệ mức độ trong một phiên 10 câu. */
export const TY_LE_MUC_DO: Readonly<Record<MucDoCauHoi, number>> = { de: 4, trung_binh: 4, kho: 2 };

/** Số lần đúng liên tiếp để một câu rời danh sách "Câu sai của tôi". */
export const SO_LAN_DUNG_DE_ROI = 2;

/** Lịch sử của người học với một câu, để ưu tiên câu chưa làm hoặc hay sai. */
export interface LichSuCau {
  so_lan: number;
  so_sai: number;
}

/** Một câu trong phiên luyện tập: cùng cấu trúc ảnh chụp với câu trong đề thi. */
export type CauTrongPhien = CauTrongDe;

/** Hạng ưu tiên: 0 chưa làm, 1 hay sai (sai từ một nửa số lần trở lên), 2 còn lại. */
export function hangUuTien(ls: LichSuCau | undefined): 0 | 1 | 2 {
  if (!ls || ls.so_lan === 0) return 0;
  return ls.so_sai * 2 >= ls.so_lan ? 1 : 2;
}

/**
 * Số câu cần rút mỗi mức cho một phiên `soCau` câu. Chia theo tỷ lệ 4/4/2 (làm tròn, phần dư
 * dồn cho mức dễ rồi trung bình); mức thiếu câu thì phần thiếu chuyển sang mức còn câu, ưu tiên
 * mức gần nhất (dễ ↔ trung bình ↔ khó).
 */
export function chiaMucDo(
  soCau: number,
  coSan: Readonly<Record<MucDoCauHoi, number>>,
): Record<MucDoCauHoi, number> {
  const tong = TY_LE_MUC_DO.de + TY_LE_MUC_DO.trung_binh + TY_LE_MUC_DO.kho;
  const can: Record<MucDoCauHoi, number> = {
    de: Math.floor((soCau * TY_LE_MUC_DO.de) / tong),
    trung_binh: Math.floor((soCau * TY_LE_MUC_DO.trung_binh) / tong),
    kho: Math.floor((soCau * TY_LE_MUC_DO.kho) / tong),
  };
  let du = soCau - can.de - can.trung_binh - can.kho;
  for (const m of ["de", "trung_binh", "kho"] as const) {
    if (du <= 0) break;
    can[m] += 1;
    du -= 1;
  }
  // Cắt theo số câu có sẵn, dồn phần thiếu sang mức lân cận.
  const THU_TU_BU: Record<MucDoCauHoi, MucDoCauHoi[]> = {
    de: ["trung_binh", "kho"],
    trung_binh: ["de", "kho"],
    kho: ["trung_binh", "de"],
  };
  const ra = { ...can };
  for (const m of ["de", "trung_binh", "kho"] as const) {
    const thieu = ra[m] - coSan[m];
    if (thieu <= 0) continue;
    ra[m] = coSan[m];
    let conThieu = thieu;
    for (const k of THU_TU_BU[m]) {
      const them = Math.min(conThieu, coSan[k] - ra[k]);
      if (them > 0) {
        ra[k] += them;
        conThieu -= them;
      }
    }
  }
  return ra;
}

/**
 * Rút câu cho một phiên và dựng ảnh chụp đề. `nguon` là các câu đã duyệt được phép rút (theo
 * chủ đề hoặc theo danh sách câu sai). Ít hơn `soCau` câu thì rút hết.
 */
export function rutCauLuyenTap(opts: {
  nguon: CauHoiNguon[];
  seed: string;
  lichSu?: ReadonlyMap<string, LichSuCau>;
  soCau?: number;
}): CauTrongPhien[] {
  const soCau = opts.soCau ?? SO_CAU_MOI_PHIEN;
  const rng = taoRng(opts.seed);
  // Sắp theo id trước khi trộn để kết quả chỉ phụ thuộc seed, không phụ thuộc thứ tự CSDL trả về.
  const theoMuc: Record<MucDoCauHoi, CauHoiNguon[]> = { de: [], trung_binh: [], kho: [] };
  for (const c of [...opts.nguon].sort((a, b) => a.id.localeCompare(b.id))) theoMuc[c.level].push(c);

  const coSan = { de: theoMuc.de.length, trung_binh: theoMuc.trung_binh.length, kho: theoMuc.kho.length };
  const can = chiaMucDo(Math.min(soCau, opts.nguon.length), coSan);

  const chon: CauHoiNguon[] = [];
  for (const m of ["de", "trung_binh", "kho"] as const) {
    // Trộn rồi sắp ổn định theo hạng ưu tiên: cùng hạng thì giữ thứ tự ngẫu nhiên.
    const xep = tron(theoMuc[m], rng)
      .map((c, i) => ({ c, i, h: hangUuTien(opts.lichSu?.get(c.id)) }))
      .sort((a, b) => a.h - b.h || a.i - b.i)
      .map((x) => x.c);
    chon.push(...xep.slice(0, can[m]));
  }

  return tron(chon, rng).map((c) => {
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

/* ------------------------------------------------------------------ */
/* Câu sai của tôi                                                     */
/* ------------------------------------------------------------------ */

export interface TrangThaiCauSai {
  wrong_count: number;
  correct_streak: number;
  /** true khi câu đang nằm trong danh sách câu sai. */
  trong_danh_sach: boolean;
}

/**
 * Trạng thái mới của một câu trong danh sách câu sai sau một lần trả lời. Trả null khi câu
 * không có trong danh sách và vừa trả lời đúng: không có gì phải ghi.
 */
export function capNhatCauSai(hienTai: TrangThaiCauSai | null, dung: boolean): TrangThaiCauSai | null {
  if (!dung) {
    return { wrong_count: (hienTai?.wrong_count ?? 0) + 1, correct_streak: 0, trong_danh_sach: true };
  }
  if (!hienTai?.trong_danh_sach) return null;
  const streak = hienTai.correct_streak + 1;
  return {
    wrong_count: hienTai.wrong_count,
    correct_streak: streak,
    trong_danh_sach: streak < SO_LAN_DUNG_DE_ROI,
  };
}
