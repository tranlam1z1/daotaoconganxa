/**
 * Tầm nhìn ban đêm của người lái mô phỏng (mô-đun M5, mở rộng ở GĐ-T15; docs/GAME_DESIGN.md §5.15).
 *
 * Người lái thấy một vật phía trước khi còn trong tầm chiếu của đèn pha, hoặc xa hơn nếu vật tự phát
 * sáng (đèn cảnh báo, đèn nóc xe tuần tra) hay được đèn cảnh báo gần đó chiếu sáng. Đoạn cong, đỉnh
 * dốc che tầm nhìn: phần đường nhìn xuyên qua đoạn khuất không dài quá một mức tra bảng theo mức khuất.
 * Không dùng hàm lượng giác: mọi thứ tính theo quãng đường dọc làn (cm), tra bảng.
 *
 * Mọi số ở đây là THÔNG SỐ MÔ PHỎNG (cần đơn vị chuyên môn kiểm tra, GAME_DESIGN §5.15), không phải
 * khoảng cách theo quy chuẩn. Hàm thuần, chạy được ở máy chủ và trình duyệt.
 */

/** Vật tự phát sáng: đèn cảnh báo, xe tuần tra có đèn nóc. Biển và cọc chỉ phản quang. */
export type LoaiVatNhin = "bien" | "coc" | "den" | "xe";

/** Đèn pha chiếu tới biển phản quang: người lái thấy biển từ khoảng này (cm). */
export const TAM_NHIN_BIEN_DEM_CM = 5000;
/** Cọc tiêu, vật thấp: chỉ thấy khi đã gần (cm). */
export const TAM_NHIN_COC_DEM_CM = 2000;
/** Vật tự phát sáng thấy từ xa (cm). */
export const TAM_NHIN_DEN_DEM_CM = 20000;
/** Biển, cọc cách một đèn cảnh báo không quá khoảng này (cm, dọc đường) thì được chiếu sáng. */
export const BAN_KINH_CHIEU_SANG_CM = 1500;
/** Biển, cọc được chiếu sáng thấy từ khoảng này (cm). */
export const TAM_NHIN_DUOC_CHIEU_CM: Readonly<Record<"bien" | "coc", number>> = { bien: 10000, coc: 6000 };

/**
 * Đoạn khuất: khúc cong (mức 1 ≈ lệch 45°, mức 2 ≈ lệch 90°) hoặc đỉnh dốc. Nhìn xuyên qua đoạn này
 * thì chỉ thấy xa tới mức tra bảng tính từ đầu đoạn (hoặc từ chỗ người lái, nếu đã ở trong đoạn).
 */
export type LoaiKhuat = "cong" | "doc";
export const TAM_NHIN_QUA_KHUAT_CM: Readonly<Record<LoaiKhuat, Readonly<Record<1 | 2, number>>>> = {
  cong: { 1: 4000, 2: 2000 },
  doc: { 1: 5000, 2: 2500 },
};

export interface DoanKhuat {
  id: string;
  loai: LoaiKhuat;
  muc: 1 | 2;
  /** Quãng đường dọc làn, cm. */
  s_tu: number;
  s_den: number;
}

/** Nguồn sáng trên đường (đèn cảnh báo, xe tuần tra), quãng đường dọc làn, cm. */
export interface NguonSang {
  s: number;
}

export interface CanhDem {
  khuat: readonly DoanKhuat[];
  sang: readonly NguonSang[];
}

/** Vật ở `s` (cm) có được đèn cảnh báo gần đó chiếu sáng không. */
export function duocChieuSang(c: Pick<CanhDem, "sang">, s: number): boolean {
  return c.sang.some((d) => Math.abs(d.s - s) <= BAN_KINH_CHIEU_SANG_CM);
}

/** Tầm nhìn tối đa tới một vật loại `loai` ở `sVat` khi không có gì che (cm). */
export function tamNhinGoc(c: Pick<CanhDem, "sang">, loai: LoaiVatNhin, sVat: number): number {
  if (loai === "den" || loai === "xe") return TAM_NHIN_DEN_DEM_CM;
  if (duocChieuSang(c, sVat)) return TAM_NHIN_DUOC_CHIEU_CM[loai];
  return loai === "bien" ? TAM_NHIN_BIEN_DEM_CM : TAM_NHIN_COC_DEM_CM;
}

/**
 * Người lái ở `sNguoi` có thấy vật ở `sVat` không (cm, dọc làn). Vật ở sau lưng thì không. Khi người
 * lái tiến lại gần, kết quả chỉ đổi từ không thấy sang thấy (đơn điệu), nên không cần nhớ đã thấy.
 */
export function thayDuoc(c: CanhDem, loai: LoaiVatNhin, sNguoi: number, sVat: number): boolean {
  const d = sVat - sNguoi;
  if (d < 0 || d > tamNhinGoc(c, loai, sVat)) return false;
  for (const k of c.khuat) {
    if (sVat <= k.s_tu || sNguoi >= k.s_den) continue;
    if (sVat - Math.max(sNguoi, k.s_tu) > TAM_NHIN_QUA_KHUAT_CM[k.loai][k.muc]) return false;
  }
  return true;
}

/** Bước dò tầm nhìn, cm. */
const BUOC_DO_CM = 100;

/**
 * Người lái thấy vật từ xa nhất bao nhiêu (cm), dò lùi từng BUOC_DO_CM từ vật. Dùng để báo "biển bị
 * khuất" ở màn kết quả; không dùng trong vòng mô phỏng.
 */
export function tamNhinToi(c: CanhDem, loai: LoaiVatNhin, sVat: number): number {
  const goc = tamNhinGoc(c, loai, sVat);
  let xa = 0;
  for (let d = BUOC_DO_CM; d <= goc; d += BUOC_DO_CM) {
    if (!thayDuoc(c, loai, sVat - d, sVat)) break;
    xa = d;
  }
  return xa;
}
