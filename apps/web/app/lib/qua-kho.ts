/**
 * Tính quá khổ hàng hóa (routes/cong-cu.qua-kho-hang-hoa.tsx): so kích thước xếp hàng đo được với
 * giới hạn xếp hàng của xe ô tô tải. Mọi kích thước tính bằng mét, khối lượng bằng kg.
 *
 * Giới hạn xếp hàng (Điều 16, Điều 17 Thông tư số 39/2024/TT-BGTVT):
 * - Chiều cao, xe tải thùng hở không mui, tính từ mặt đường: khối lượng hàng chuyên chở theo thiết
 *   kế từ 5 tấn trở lên không quá 4,2 m; từ 2,5 tấn đến dưới 5 tấn không quá 3,5 m; dưới 2,5 tấn
 *   không quá 2,8 m.
 * - Chiều cao, xe tải thùng hở có mui: trong phạm vi chiều cao thùng xe theo thiết kế.
 * - Chiều cao, xe chở công te nơ, tính từ mặt đường: không quá 4,35 m.
 * - Chiều rộng: không quá chiều rộng thùng xe theo thiết kế.
 * - Chiều dài: không quá 1,1 lần chiều dài toàn bộ của xe theo thiết kế và không quá 20 m.
 *
 * Căn cứ xử phạt: Điều 21 và điểm c khoản 9 Điều 32 Nghị định số 168/2024/NĐ-CP. Kho văn bản chưa
 * có thông tư và nghị định này nên mọi căn cứ đều chưa đối chiếu (xem lib/khung-phat.ts).
 */
import { type KhungPhat, ND_168 } from "./khung-phat";

export type LoaiThung = "khong-mui" | "co-mui" | "cong-te-no";

export const LOAI_THUNG: Record<LoaiThung, { ten: string; moTa: string }> = {
  "khong-mui": { ten: "Thùng hở không mui", moTa: "Giới hạn chiều cao theo khối lượng hàng chuyên chở" },
  "co-mui": { ten: "Thùng hở có mui", moTa: "Giới hạn chiều cao là chiều cao thùng xe theo thiết kế" },
  "cong-te-no": { ten: "Xe chở công te nơ", moTa: "Chiều cao không quá 4,35 m tính từ mặt đường" },
};

export const laLoaiThung = (v: string | null): v is LoaiThung => v !== null && v in LOAI_THUNG;

const TT_39 = "Thông tư số 39/2024/TT-BGTVT";
export const HE_SO_CHIEU_DAI = 1.1;
export const CHIEU_DAI_TOI_DA = 20;
export const CAO_CONG_TE_NO = 4.35;

/** Chiều cao xếp hàng tối đa (m) của xe tải thùng hở không mui theo khối lượng hàng chuyên chở (kg). */
export function caoToiDaKhongMui(hangKg: number): number {
  if (hangKg >= 5000) return 4.2;
  return hangKg >= 2500 ? 3.5 : 2.8;
}

export type ChieuKho = "cao" | "rong" | "dai";

export interface SoSanhKho {
  chieu: ChieuKho;
  ten: string;
  gioiHan: number;
  /** Giới hạn lấy từ đâu, viết thành câu. */
  moTaGioiHan: string;
  canCuGioiHan: string;
  doDuoc: number;
  /** Đo được trừ giới hạn (m), làm tròn tới mm; dương là vượt. */
  vuot: number;
  /** Phần vượt so với giới hạn, làm tròn 2 chữ số thập phân. */
  phanTram: number;
  viPham: boolean;
}

export interface NhapQuaKho {
  loai: LoaiThung;
  /** Chiều cao xếp hàng đo được. Thùng không mui cần `hangKg`, thùng có mui cần `caoThung`. */
  cao?: { doDuoc: number; hangKg?: number; caoThung?: number };
  rong?: { doDuoc: number; rongThung: number };
  dai?: { doDuoc: number; daiXe: number };
}

export interface KetQuaQuaKho {
  chieu: SoSanhKho[];
  quaKho: boolean;
  khung: KhungPhat[];
}

const KHUNG_CAO: readonly KhungPhat[] = [
  {
    doiTuong: "Người điều khiển",
    hanhVi:
      "Điều khiển xe ô tô tải (kể cả rơ moóc và sơ mi rơ moóc) chở hàng vượt quá chiều cao xếp hàng cho phép",
    phatTu: 2_000_000,
    phatDen: 3_000_000,
    truDiem: 2,
    canCu: `Khoản 4, điểm a khoản 13 Điều 21 ${ND_168}`,
    daDoiChieu: false,
  },
  {
    doiTuong: "Chủ xe",
    hanhVi:
      "Giao xe hoặc để cho người làm công, người đại diện điều khiển xe chở hàng vượt quá chiều cao xếp hàng cho phép (hành vi tại khoản 4 Điều 21)",
    phatTu: 4_000_000,
    phatDen: 6_000_000,
    toChuc: { phatTu: 8_000_000, phatDen: 12_000_000 },
    canCu: `Điểm c khoản 9 Điều 32 ${ND_168}`,
    daDoiChieu: false,
  },
];

const KHUNG_RONG_DAI: KhungPhat = {
  doiTuong: "Người điều khiển",
  hanhVi:
    "Chở hàng vượt quá bề rộng thùng xe; chở hàng vượt phía trước, phía sau thùng xe trên 1,1 lần chiều dài toàn bộ của xe theo thiết kế",
  phatTu: 800_000,
  phatDen: 1_000_000,
  truDiem: 2,
  canCu: `Điểm b khoản 2, điểm a khoản 13 Điều 21 ${ND_168}`,
  daDoiChieu: false,
};

const tronMm = (n: number) => Math.round(n * 1000) / 1000;

function soSanh(
  chieu: ChieuKho,
  ten: string,
  doDuoc: number,
  gioiHan: number,
  moTaGioiHan: string,
  canCuGioiHan: string,
): SoSanhKho {
  const vuot = tronMm(doDuoc - gioiHan);
  return {
    chieu,
    ten,
    gioiHan,
    moTaGioiHan,
    canCuGioiHan,
    doDuoc,
    vuot,
    phanTram: Math.round((vuot / gioiHan) * 10000) / 100,
    viPham: vuot > 0,
  };
}

const met = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

/** So các chiều đã nhập với giới hạn xếp hàng; chiều nào không nhập thì bỏ qua. */
export function tinhQuaKho(nhap: NhapQuaKho): KetQuaQuaKho {
  const chieu: SoSanhKho[] = [];
  const { cao, rong, dai } = nhap;

  if (cao) {
    const ten = "Chiều cao xếp hàng";
    if (nhap.loai === "cong-te-no") {
      chieu.push(
        soSanh(
          "cao",
          ten,
          cao.doDuoc,
          CAO_CONG_TE_NO,
          "Xe chở công te nơ, tính từ mặt đường",
          `Khoản 3 Điều 16 ${TT_39}`,
        ),
      );
    } else if (nhap.loai === "co-mui") {
      chieu.push(
        soSanh(
          "cao",
          ten,
          cao.doDuoc,
          cao.caoThung ?? 0,
          "Chiều cao giới hạn trong phạm vi thùng xe theo thiết kế",
          `Khoản 1 Điều 16 ${TT_39}`,
        ),
      );
    } else {
      const hang = cao.hangKg ?? 0;
      const nhom =
        hang >= 5000 ? "từ 5 tấn trở lên" : hang >= 2500 ? "từ 2,5 tấn đến dưới 5 tấn" : "dưới 2,5 tấn";
      chieu.push(
        soSanh(
          "cao",
          ten,
          cao.doDuoc,
          caoToiDaKhongMui(hang),
          `Xe có khối lượng hàng chuyên chở ${nhom}, tính từ mặt đường`,
          `Khoản 2 Điều 16 ${TT_39}`,
        ),
      );
    }
  }

  if (rong) {
    chieu.push(
      soSanh(
        "rong",
        "Chiều rộng xếp hàng",
        rong.doDuoc,
        rong.rongThung,
        "Chiều rộng thùng xe theo thiết kế",
        `Khoản 1 Điều 17 ${TT_39}`,
      ),
    );
  }

  if (dai) {
    const theoXe = tronMm(HE_SO_CHIEU_DAI * dai.daiXe);
    chieu.push(
      soSanh(
        "dai",
        "Chiều dài xếp hàng",
        dai.doDuoc,
        Math.min(theoXe, CHIEU_DAI_TOI_DA),
        theoXe <= CHIEU_DAI_TOI_DA
          ? `1,1 lần chiều dài toàn bộ của xe (${met(dai.daiXe)} m)`
          : `Không quá 20 m (1,1 lần chiều dài toàn bộ của xe là ${met(theoXe)} m)`,
        `Khoản 2 Điều 17 ${TT_39}`,
      ),
    );
  }

  const vp = (c: ChieuKho) => chieu.some((x) => x.chieu === c && x.viPham);
  const khung: KhungPhat[] = [];
  if (vp("cao")) khung.push(...KHUNG_CAO);
  // Hành vi về chiều dài trong nghị định tính theo 1,1 lần chiều dài xe; chỉ vượt mốc 20 m thì
  // trang vẫn báo vượt giới hạn xếp hàng nhưng không gắn khung này.
  const daiVuotTheoXe = dai !== undefined && dai.doDuoc > tronMm(HE_SO_CHIEU_DAI * dai.daiXe);
  if (vp("rong") || daiVuotTheoXe) khung.push(KHUNG_RONG_DAI);
  return { chieu, quaKho: chieu.some((c) => c.viPham), khung };
}
