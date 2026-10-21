/**
 * Màn chơi và độ khó (mô-đun M8, docs/GAME_DESIGN.md §2.4, §4).
 *
 * Trò có màn khai `manChoi` trong định nghĩa (khung.ts). Màn 1 luôn mở; qua màn (đạt từ
 * SAO_QUA_MAN sao) thì mở màn kế tiếp. Không màn nào khóa vì thiếu XP. Tiến độ lưu ở bảng
 * `game_level_progress` (packages/db/src/man-choi.ts). Hàm thuần.
 */

/** Số sao tối thiểu để qua màn. */
export const SAO_QUA_MAN = 1;

export interface CauHinhMan {
  so: number;
  ten: string;
  moTa: string;
  /** Giờ cả lượt của màn; null hoặc vắng: không tính giờ cả lượt. */
  caLuotMs?: number | null;
  /** Giờ từng bước của màn; null hoặc vắng: không tính giờ từng bước. */
  moiBuocMs?: number | null;
  /** XP cơ bản của màn; vắng thì dùng XP cơ bản của trò. */
  xpCoBan?: number;
}

/** Màn cao nhất đã qua (0 khi chưa qua màn nào), từ số sao tốt nhất của từng màn. */
export function manCaoNhatDaQua(saoTheoMan: ReadonlyMap<number, number>): number {
  let cao = 0;
  // Qua màn phải đi lần lượt: màn 3 chỉ tính khi màn 1, 2 đã qua.
  for (let so = 1; (saoTheoMan.get(so) ?? 0) >= SAO_QUA_MAN; so++) cao = so;
  return cao;
}

/** Các màn đang mở: màn 1 tới màn kế tiếp sau màn cao nhất đã qua. */
export function manDangMo(soMan: number, saoTheoMan: ReadonlyMap<number, number>): number[] {
  const toi = Math.min(soMan, manCaoNhatDaQua(saoTheoMan) + 1);
  return Array.from({ length: Math.max(0, toi) }, (_, i) => i + 1);
}

export function moDuocMan(so: number, soMan: number, saoTheoMan: ReadonlyMap<number, number>): boolean {
  return Number.isInteger(so) && so >= 1 && manDangMo(soMan, saoTheoMan).includes(so);
}

/** Màn mặc định khi người chơi không chọn: màn cao nhất đang mở. */
export function manMacDinh(soMan: number, saoTheoMan: ReadonlyMap<number, number>): number {
  return manDangMo(soMan, saoTheoMan).at(-1) ?? 1;
}
