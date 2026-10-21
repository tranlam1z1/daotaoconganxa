/**
 * Ghép cặp lỗi – mức phạt (docs/PLAN.md GĐ10, PRD #5): ghép 5 hành vi vi phạm với mức tiền phạt.
 *
 * Nội dung lấy từ dữ liệu tra cứu nhanh (bảng `violations`, GĐ5), chỉ dòng ĐÃ DUYỆT: game không
 * được dạy một mức phạt chưa được đối chiếu. Các dòng của một ván có mức phạt khác nhau từng đôi,
 * để mỗi hành vi chỉ có một vế phải đúng.
 */

import { taoRng, tron } from "../de-thi.ts";

export const SO_CAP_GHEP = 5;
/** Ít hơn số này thì không đủ để thành một ván có nghĩa. */
export const SO_CAP_TOI_THIEU = 3;

export interface DongMucPhatGame {
  id: string;
  hanh_vi: string;
  loai_xe: string;
  fine_min: number;
  fine_max: number;
  citation_urn: string;
}

const SO = new Intl.NumberFormat("vi-VN");

/** "Từ 800.000 đến 1.000.000 đồng", hoặc "2.000.000 đồng" khi hai mức bằng nhau. */
export function moTaMucPhat(fineMin: number, fineMax: number): string {
  if (fineMin === fineMax) return `${SO.format(fineMin)} đồng`;
  return `Từ ${SO.format(fineMin)} đến ${SO.format(fineMax)} đồng`;
}

export class LoiGhepCap extends Error {}

/**
 * Chọn các dòng cho một ván: trộn theo seed, lấy lần lượt các dòng có mức phạt chưa trùng, tối đa
 * `soCap`. Ném LoiGhepCap khi không đủ SO_CAP_TOI_THIEU mức phạt khác nhau.
 */
export function chonDongGhepCap(ds: DongMucPhatGame[], seed: string, soCap = SO_CAP_GHEP): DongMucPhatGame[] {
  const rng = taoRng(seed);
  const daCo = new Set<string>();
  const chon: DongMucPhatGame[] = [];
  for (const d of tron(
    [...ds].sort((a, b) => a.id.localeCompare(b.id)),
    rng,
  )) {
    const khoa = `${d.fine_min}-${d.fine_max}`;
    if (daCo.has(khoa)) continue;
    daCo.add(khoa);
    chon.push(d);
    if (chon.length === soCap) break;
  }
  if (chon.length < SO_CAP_TOI_THIEU) {
    throw new LoiGhepCap("Chưa đủ dữ liệu mức phạt đã duyệt để tạo một ván ghép cặp.");
  }
  return chon;
}

export interface DeGhepCap {
  trai: Array<{ id: string; text: string; loai_xe: string }>;
  phai: Array<{ id: string; text: string }>;
}

/**
 * Id vế phải của một dòng, suy từ seed của ván: khác id vế trái, nên nhìn id không đoán được
 * cặp đúng.
 */
function idPhai(d: DongMucPhatGame, seed: string): string {
  return `p${Math.floor(taoRng(`${seed}|${d.id}`)() * 1e9).toString(36)}`;
}

/** Đề của ván: vế trái giữ thứ tự chọn, vế phải trộn riêng. Không có đáp án. */
export function deGhepCap(ds: DongMucPhatGame[], seed: string): DeGhepCap {
  const rng = taoRng(`${seed}|phai`);
  return {
    trai: ds.map((d) => ({ id: d.id, text: d.hanh_vi, loai_xe: d.loai_xe })),
    phai: tron(
      ds.map((d) => ({ id: idPhai(d, seed), text: moTaMucPhat(d.fine_min, d.fine_max) })),
      rng,
    ),
  };
}

export interface KetQuaGhepCap {
  dung: number;
  tong: number;
  chi_tiet: Array<{ id: string; dung: boolean; muc_phat_dung: string; citation_urn: string }>;
}

/** Chấm ván: `cap` là { idTrái: idPhải }. Không phụ thuộc thứ tự người chơi ghép. */
export function chamGhepCap(ds: DongMucPhatGame[], seed: string, cap: Record<string, string>): KetQuaGhepCap {
  const chi_tiet = ds.map((d) => ({
    id: d.id,
    dung: cap[d.id] === idPhai(d, seed),
    muc_phat_dung: moTaMucPhat(d.fine_min, d.fine_max),
    citation_urn: d.citation_urn,
  }));
  return { dung: chi_tiet.filter((c) => c.dung).length, tong: ds.length, chi_tiet };
}
