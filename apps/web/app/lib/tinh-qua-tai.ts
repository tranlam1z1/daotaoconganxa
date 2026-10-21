/**
 * Tính % quá tải của xe (routes/cong-cu.tinh-qua-tai.tsx). Mọi khối lượng tính bằng kg.
 *
 * - Xe tải: (khối lượng cân được − KL toàn bộ theo thiết kế) / KL hàng chuyên chở theo thiết kế.
 * - Đầu kéo: (khối lượng cân được − KL bản thân đầu kéo − KL toàn bộ kéo theo) / KL toàn bộ kéo theo.
 * - Sơ mi rơ moóc: (khối lượng cân được − KL bản thân đầu kéo − KL toàn bộ kéo theo thiết kế rơ moóc)
 *   / KL hàng chuyên chở theo thiết kế rơ moóc.
 * Tử số là khối lượng quá tải; % làm tròn đến 2 chữ số thập phân.
 */

export type LoaiXe = "xe-tai" | "dau-keo" | "so-mi-ro-mooc";

/** Mã ô nhập, cũng là tên tham số trên URL. "can", "ban_than_dk" dùng chung giữa các loại xe. */
export type MaO = "can" | "toan_bo" | "hang" | "ban_than_dk" | "keo_theo" | "keo_theo_rm" | "hang_rm";

export interface ONhap {
  ma: MaO;
  ten: string;
  /** Lời giải thích mở bằng nút "i" cạnh tên ô. */
  giaiThich?: string;
}

const O: Record<MaO, ONhap> = {
  can: { ma: "can", ten: "Khối lượng toàn bộ của xe cân được" },
  toan_bo: { ma: "toan_bo", ten: "Khối lượng toàn bộ theo thiết kế" },
  hang: { ma: "hang", ten: "Khối lượng hàng chuyên chở theo thiết kế" },
  ban_than_dk: { ma: "ban_than_dk", ten: "Khối lượng bản thân đầu kéo" },
  keo_theo: { ma: "keo_theo", ten: "Khối lượng toàn bộ kéo theo của đầu kéo" },
  keo_theo_rm: {
    ma: "keo_theo_rm",
    ten: "Khối lượng toàn bộ kéo theo thiết kế rơ moóc",
    giaiThich: "Gồm khối lượng hàng chuyên chở của rơ moóc cộng khối lượng bản thân rơ moóc.",
  },
  hang_rm: { ma: "hang_rm", ten: "Khối lượng hàng chuyên chở theo thiết kế rơ moóc" },
};

/** Tử số: đại lượng đầu trừ các đại lượng sau (là khối lượng quá tải); chia mẫu số, nhân 100%. */
export interface CongThuc {
  tuSo: readonly [MaO, ...MaO[]];
  mauSo: MaO;
}

export const LOAI_XE: Record<LoaiXe, { ten: string; congThuc: CongThuc; o: ReadonlyArray<ONhap> }> = {
  "xe-tai": {
    ten: "Xe tải",
    congThuc: { tuSo: ["can", "toan_bo"], mauSo: "hang" },
    o: [O.can, O.toan_bo, O.hang],
  },
  "dau-keo": {
    ten: "Đầu kéo",
    congThuc: { tuSo: ["can", "ban_than_dk", "keo_theo"], mauSo: "keo_theo" },
    o: [O.can, O.ban_than_dk, O.keo_theo],
  },
  "so-mi-ro-mooc": {
    ten: "Sơ mi rơ moóc",
    congThuc: { tuSo: ["can", "ban_than_dk", "keo_theo_rm"], mauSo: "hang_rm" },
    o: [O.can, O.ban_than_dk, O.keo_theo_rm, O.hang_rm],
  },
};

/** Tên đại lượng trong công thức. */
export const tenO = (ma: MaO) => O[ma].ten;

/** Công thức thành một câu, cho trình đọc màn hình. */
export const congThucChu = ({ tuSo, mauSo }: CongThuc) =>
  `Phần trăm quá tải bằng ${tuSo.map(tenO).join(" trừ ")}, chia cho ${tenO(mauSo)}, nhân 100%.`;

export const laLoaiXe = (v: string | null): v is LoaiXe => v !== null && v in LOAI_XE;

/**
 * Đọc số kg người dùng gõ. Dấu chấm và khoảng trắng là dấu phân cách hàng nghìn ("12.500" là
 * 12500 kg), dấu phẩy là dấu thập phân. Trả null khi không phải số hoặc phần nguyên quá 9 chữ số.
 */
export function docSoKg(v: string): number | null {
  const s = v.trim().replace(/[\s.]/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export interface KetQuaQuaTai {
  /** Khối lượng vượt (kg); âm hoặc 0 là không quá tải. */
  khoiLuongQuaTai: number;
  /** % quá tải, làm tròn 2 chữ số thập phân; âm hoặc 0 là không quá tải. */
  phanTram: number;
  quaTai: boolean;
}

/** Tính theo loại xe; `so` phải có đủ các ô của loại xe đó, mẫu số lớn hơn 0. */
export function tinhQuaTai(loai: LoaiXe, so: Partial<Record<MaO, number>>): KetQuaQuaTai {
  const g = (m: MaO) => so[m] ?? 0;
  const { tuSo, mauSo } = LOAI_XE[loai].congThuc;
  const [dau, ...tru] = tuSo;
  const tu = tru.reduce((a, m) => a - g(m), g(dau));
  // Làm tròn khối lượng tới 0,01 kg để bỏ sai số dấu phẩy động khi nhập số lẻ.
  const khoiLuongQuaTai = Math.round(tu * 100) / 100;
  const phanTram = Math.round((tu / g(mauSo)) * 10000) / 100;
  return { khoiLuongQuaTai, phanTram, quaTai: khoiLuongQuaTai > 0 };
}
