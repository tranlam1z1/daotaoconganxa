/**
 * Đoán biển báo (docs/PLAN.md GĐ12, PRD #4): hiện ảnh một biển, chọn đúng tên trong 4 phương án.
 *
 * Ba phương án nhiễu lấy CÙNG NHÓM với biển hỏi (biển cấm nhiễu bằng biển cấm…), vì phân biệt
 * trong một nhóm mới là chỗ người học hay nhầm. Nhóm không đủ biển thì bù bằng nhóm khác. Chỉ
 * dùng biển đã duyệt. Chấm theo mã biển nên thứ tự phương án không ảnh hưởng kết quả.
 */

import { taoRng, tron } from "../de-thi.ts";

export const SO_CAU_DOAN = 10;
export const SO_PHUONG_AN_DOAN = 4;

export interface BienBaoGame {
  ma: string;
  nhom: string;
  ten: string;
  y_nghia: string;
  anh: string;
  can_cu: string;
}

export interface CauDoan {
  stt: number;
  /** Mã biển hỏi; chỉ lưu ở máy chủ, không gửi người chơi (mã lộ đáp án). */
  ma: string;
  anh: string;
  /** Mã các biển làm phương án, đã trộn. */
  phuong_an: string[];
}

export class LoiDoanBienBao extends Error {}

/**
 * Dựng một ván: trộn biển theo seed, lấy `soCau` biển làm câu hỏi; mỗi câu 3 phương án nhiễu
 * khác nhau, ưu tiên cùng nhóm. Cần ít nhất 4 biển đã duyệt.
 */
export function taoVanDoan(ds: BienBaoGame[], seed: string, soCau = SO_CAU_DOAN): CauDoan[] {
  if (ds.length < SO_PHUONG_AN_DOAN) {
    throw new LoiDoanBienBao("Chưa đủ biển báo đã duyệt để chơi (cần ít nhất 4 biển).");
  }
  const rng = taoRng(seed);
  const xep = [...ds].sort((a, b) => a.ma.localeCompare(b.ma));
  const cauHoi = tron(xep, rng).slice(0, Math.min(soCau, xep.length));
  return cauHoi.map((b, i) => {
    const cungNhom = tron(
      xep.filter((x) => x.ma !== b.ma && x.nhom === b.nhom),
      rng,
    );
    const khacNhom = tron(
      xep.filter((x) => x.ma !== b.ma && x.nhom !== b.nhom),
      rng,
    );
    const nhieu = [...cungNhom, ...khacNhom].slice(0, SO_PHUONG_AN_DOAN - 1);
    return {
      stt: i + 1,
      ma: b.ma,
      anh: b.anh,
      phuong_an: tron([b.ma, ...nhieu.map((x) => x.ma)], rng),
    };
  });
}

/** Phần gửi người chơi: ảnh và 4 tên, không có mã biển (mã lộ nhóm và đáp án). */
export function deCauDoan(cau: CauDoan, theoMa: ReadonlyMap<string, BienBaoGame>) {
  return {
    stt: cau.stt,
    anh: cau.anh,
    phuong_an: cau.phuong_an.map((ma, i) => ({ id: String(i), text: theoMa.get(ma)?.ten ?? "" })),
  };
}

/** Chấm một câu theo chỉ số phương án người chơi chọn. */
export function chamCauDoan(cau: CauDoan, chon: string): boolean {
  const i = Number(chon);
  return Number.isInteger(i) && cau.phuong_an[i] === cau.ma;
}
