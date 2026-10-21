/**
 * Xác định loại giấy phép lái xe (GPLX) theo phương tiện (routes/cong-cu.loai-gplx.tsx): từ loại xe
 * và thông số (dung tích, số chỗ, khối lượng, rơ moóc kéo theo) ra hạng GPLX cần có, rồi đối chiếu
 * với hạng người lái đang có.
 *
 * Hạng cấp từ 01/01/2025 theo khoản 1 Điều 57 Luật Trật tự, an toàn giao thông đường bộ số
 * 36/2024/QH15; hạng cấp trước ngày đó còn dùng theo khoản 2 Điều 89 của Luật. Hai hệ xét khác
 * nhau: hạng mới chia xe tải theo khối lượng toàn bộ theo thiết kế, hạng cũ theo trọng tải; hạng
 * mới chia xe mô tô ở mốc 125 cm³ (11 kW), hạng cũ ở mốc 175 cm³ (14 kW).
 *
 * Luật không ghi các hạng kéo rơ moóc (BE, C1E, CE, D1E, D2E, DE; FB2, FC, FD, FE) gồm cả xe của
 * hạng gốc khi không kéo rơ moóc, nên trường hợp đó kết luận "cần xem thêm" chứ không khẳng định.
 *
 * Kho văn bản chưa có Luật và Nghị định số 168/2024/NĐ-CP nên mọi căn cứ đều chưa đối chiếu.
 */
import { type KhungPhat, ND_168 } from "./khung-phat";

export type LoaiPhuongTien =
  | "xe-gan-may"
  | "mo-to-2"
  | "mo-to-3"
  | "cho-nguoi"
  | "tai"
  | "dau-keo"
  | "noi-toa";

export const LOAI_PHUONG_TIEN: Record<LoaiPhuongTien, string> = {
  "xe-gan-may": "Xe gắn máy",
  "mo-to-2": "Xe mô tô hai bánh",
  "mo-to-3": "Xe mô tô ba bánh",
  "cho-nguoi": "Xe ô tô chở người",
  tai: "Xe ô tô tải, ô tô chuyên dùng",
  "dau-keo": "Xe ô tô đầu kéo kéo sơ mi rơ moóc",
  "noi-toa": "Xe ô tô chở khách nối toa",
};

export const laLoaiPhuongTien = (v: string | null): v is LoaiPhuongTien =>
  v !== null && v in LOAI_PHUONG_TIEN;

export type DongCo = "xang" | "dien";

export interface PhuongTien {
  loai: LoaiPhuongTien;
  /** Xe mô tô hai bánh: động cơ đốt trong tính theo dung tích (cm³), động cơ điện theo công suất (kW). */
  dongCo?: DongCo;
  dungTich?: number;
  congSuat?: number;
  /** Xe chở người: số chỗ không kể chỗ của người lái xe. */
  soCho?: number;
  giuongNam?: boolean;
  /** Xe tải, xe chuyên dùng: khối lượng toàn bộ theo thiết kế (kg), dùng cho hạng mới. */
  khoiLuongToanBo?: number;
  /** Xe tải: trọng tải, tức khối lượng hàng chuyên chở theo thiết kế (kg), dùng cho hạng cũ. */
  trongTai?: number;
  /** Khối lượng toàn bộ theo thiết kế của rơ moóc kéo theo (kg); 0 hoặc bỏ trống là không kéo. */
  roMooc?: number;
}

export const HANG_MOI = [
  "A1",
  "A",
  "B1",
  "B",
  "C1",
  "C",
  "D1",
  "D2",
  "D",
  "BE",
  "C1E",
  "CE",
  "D1E",
  "D2E",
  "DE",
] as const;
export type HangMoi = (typeof HANG_MOI)[number];

export const HANG_CU = [
  "A1",
  "A2",
  "A3",
  "A4",
  "B1-td",
  "B1",
  "B2",
  "C",
  "D",
  "E",
  "FB2",
  "FC",
  "FD",
  "FE",
] as const;
export type HangCu = (typeof HANG_CU)[number];

export const tenHangCu = (h: HangCu) => (h === "B1-td" ? "B1 số tự động" : h);

export const laHangMoi = (v: string | null): v is HangMoi => HANG_MOI.includes(v as HangMoi);
export const laHangCu = (v: string | null): v is HangCu => HANG_CU.includes(v as HangCu);

/** Rơ moóc đến mức này (kg) thì hạng gốc được kéo, trên mức này cần hạng kéo rơ moóc. */
export const RO_MOOC_NHE = 750;

const LUAT = "Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15";

export const CAN_CU_GPLX = {
  dieu57: { nhan: `Khoản 1 Điều 57 ${LUAT}`, daDoiChieu: false },
  dieu59: { nhan: `Khoản 1 Điều 59 ${LUAT}`, daDoiChieu: true },
  dieu89: { nhan: `Khoản 2 Điều 89 ${LUAT}`, daDoiChieu: false },
} as const;

/** Phạm vi của từng hạng mới, tóm lược theo khoản 1 Điều 57. */
export const PHAM_VI_HANG_MOI: Record<HangMoi, string> = {
  A1: "Xe mô tô hai bánh có dung tích xi-lanh đến 125 cm³ hoặc công suất động cơ điện đến 11 kW",
  A: "Xe mô tô hai bánh có dung tích xi-lanh trên 125 cm³ hoặc công suất động cơ điện trên 11 kW; xe của hạng A1",
  B1: "Xe mô tô ba bánh; xe của hạng A1",
  B: "Xe ô tô chở người đến 08 chỗ (không kể chỗ của người lái xe); xe ô tô tải, ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế đến 3.500 kg; kéo rơ moóc đến 750 kg",
  C1: "Xe ô tô tải, ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 3.500 kg đến 7.500 kg; kéo rơ moóc đến 750 kg; xe của hạng B",
  C: "Xe ô tô tải, ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế trên 7.500 kg; kéo rơ moóc đến 750 kg; xe của hạng B, C1",
  D1: "Xe ô tô chở người trên 08 chỗ đến 16 chỗ; kéo rơ moóc đến 750 kg; xe của hạng B, C1, C",
  D2: "Xe ô tô chở người (kể cả xe buýt) trên 16 chỗ đến 29 chỗ; kéo rơ moóc đến 750 kg; xe của hạng B, C1, C, D1",
  D: "Xe ô tô chở người (kể cả xe buýt) trên 29 chỗ; xe ô tô chở người giường nằm; kéo rơ moóc đến 750 kg; xe của hạng B, C1, C, D1, D2",
  BE: "Xe của hạng B kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg",
  C1E: "Xe của hạng C1 kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg",
  CE: "Xe của hạng C kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg; xe ô tô đầu kéo kéo sơ mi rơ moóc",
  D1E: "Xe của hạng D1 kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg",
  D2E: "Xe của hạng D2 kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg",
  DE: "Xe của hạng D kéo rơ moóc có khối lượng toàn bộ theo thiết kế trên 750 kg; xe ô tô chở khách nối toa",
};

/** Tuổi tối thiểu được cấp từng hạng (khoản 1 Điều 59). */
export const TUOI_TOI_THIEU: Record<HangMoi, number> = {
  A1: 18,
  A: 18,
  B1: 18,
  B: 18,
  C1: 18,
  C: 21,
  BE: 21,
  D1: 24,
  D2: 24,
  C1E: 24,
  CE: 24,
  D: 27,
  D1E: 27,
  D2E: 27,
  DE: 27,
};

/** Các hạng mà luật ghi rõ "và các loại xe quy định cho giấy phép lái xe hạng..." (khoản 1 Điều 57). */
const BAO_GOM: Partial<Record<HangMoi, readonly HangMoi[]>> = {
  A: ["A1"],
  B1: ["A1"],
  C1: ["B"],
  C: ["B", "C1"],
  D1: ["B", "C1", "C"],
  D2: ["B", "C1", "C", "D1"],
  D: ["B", "C1", "C", "D1", "D2"],
};

/** Hạng kéo rơ moóc và hạng gốc của nó. */
const HANG_GOC: Partial<Record<HangMoi, HangMoi>> = {
  BE: "B",
  C1E: "C1",
  CE: "C",
  D1E: "D1",
  D2E: "D2",
  DE: "D",
};
const HANG_KEO: Partial<Record<HangMoi, HangMoi>> = {
  B: "BE",
  C1: "C1E",
  C: "CE",
  D1: "D1E",
  D2: "D2E",
  D: "DE",
};

const gomHang = (co: HangMoi, can: HangMoi) => co === can || (BAO_GOM[co]?.includes(can) ?? false);

export interface HangCanCo {
  /** null là không cần giấy phép lái xe (xe gắn máy). */
  hang: HangMoi | null;
  lyDo: string;
  /** Các hạng khác cũng điều khiển được xe này theo câu chữ của khoản 1 Điều 57. */
  hangKhac: HangMoi[];
  canCu: keyof typeof CAN_CU_GPLX;
}

const kg = (n: number) => `${n.toLocaleString("vi-VN")} kg`;
const keoNang = (pt: PhuongTien) => (pt.roMooc ?? 0) > RO_MOOC_NHE;

/** Hạng gốc của xe khi chưa xét rơ moóc; null với xe gắn máy, đầu kéo, xe nối toa. */
function hangGoc(pt: PhuongTien): { hang: HangMoi; lyDo: string } | null {
  switch (pt.loai) {
    case "mo-to-2": {
      if (pt.dongCo === "dien") {
        const kw = pt.congSuat ?? 0;
        const s = `${kw.toLocaleString("vi-VN")} kW`;
        return kw <= 11
          ? { hang: "A1", lyDo: `Xe mô tô hai bánh có công suất động cơ điện ${s}, đến 11 kW` }
          : { hang: "A", lyDo: `Xe mô tô hai bánh có công suất động cơ điện ${s}, trên 11 kW` };
      }
      const cc = pt.dungTich ?? 0;
      const s = `${cc.toLocaleString("vi-VN")} cm³`;
      return cc <= 125
        ? { hang: "A1", lyDo: `Xe mô tô hai bánh có dung tích xi-lanh ${s}, đến 125 cm³` }
        : { hang: "A", lyDo: `Xe mô tô hai bánh có dung tích xi-lanh ${s}, trên 125 cm³` };
    }
    case "mo-to-3":
      return { hang: "B1", lyDo: "Xe mô tô ba bánh" };
    case "cho-nguoi": {
      const cho = pt.soCho ?? 0;
      if (pt.giuongNam) return { hang: "D", lyDo: "Xe ô tô chở người giường nằm" };
      const s = `Xe ô tô chở người ${cho} chỗ (không kể chỗ của người lái xe)`;
      if (cho <= 8) return { hang: "B", lyDo: `${s}, đến 08 chỗ` };
      if (cho <= 16) return { hang: "D1", lyDo: `${s}, trên 08 chỗ đến 16 chỗ` };
      if (cho <= 29) return { hang: "D2", lyDo: `${s}, trên 16 chỗ đến 29 chỗ` };
      return { hang: "D", lyDo: `${s}, trên 29 chỗ` };
    }
    case "tai": {
      const kl = pt.khoiLuongToanBo ?? 0;
      const s = `Xe ô tô tải, ô tô chuyên dùng có khối lượng toàn bộ theo thiết kế ${kg(kl)}`;
      if (kl <= 3500) return { hang: "B", lyDo: `${s}, đến 3.500 kg` };
      if (kl <= 7500) return { hang: "C1", lyDo: `${s}, trên 3.500 kg đến 7.500 kg` };
      return { hang: "C", lyDo: `${s}, trên 7.500 kg` };
    }
    default:
      return null;
  }
}

/** Hạng GPLX thấp nhất điều khiển được phương tiện, theo hệ hạng mới. */
export function hangCanCo(pt: PhuongTien): HangCanCo {
  const kq = (hang: HangMoi | null, lyDo: string): HangCanCo => ({
    hang,
    lyDo,
    hangKhac: hang ? HANG_MOI.filter((h) => h !== hang && gomHang(h, hang)) : [],
    // Xe gắn máy: căn cứ là tuổi được điều khiển xe gắn máy, không phải hạng giấy phép lái xe.
    canCu: hang ? "dieu57" : "dieu59",
  });
  if (pt.loai === "xe-gan-may")
    return kq(null, "Xe gắn máy không cần giấy phép lái xe; người điều khiển phải đủ 16 tuổi trở lên");
  if (pt.loai === "dau-keo") return kq("CE", "Xe ô tô đầu kéo kéo sơ mi rơ moóc");
  if (pt.loai === "noi-toa") return kq("DE", "Xe ô tô chở khách nối toa");
  const goc = hangGoc(pt);
  if (!goc) return kq(null, "");
  const keo = HANG_KEO[goc.hang];
  if (keoNang(pt) && keo) {
    return kq(
      keo,
      `${goc.lyDo}, kéo rơ moóc có khối lượng toàn bộ theo thiết kế ${kg(pt.roMooc ?? 0)}, trên 750 kg`,
    );
  }
  if ((pt.roMooc ?? 0) > 0) return kq(goc.hang, `${goc.lyDo}, kéo rơ moóc ${kg(pt.roMooc ?? 0)}, đến 750 kg`);
  return kq(goc.hang, goc.lyDo);
}

export type KetLuanGplx = "phu-hop" | "khong-phu-hop" | "can-xem-them";

export interface DoiChieuGplx {
  ketLuan: KetLuanGplx;
  lyDo: string;
  canCu: keyof typeof CAN_CU_GPLX;
}

const XEM_GPLX = "Hãy xem các hạng ghi trên giấy phép lái xe của người lái.";

/** Đối chiếu một hạng cấp từ 01/01/2025 với phương tiện. */
export function doiChieuHangMoi(pt: PhuongTien, co: HangMoi): DoiChieuGplx {
  const canCu = "dieu57";
  const can = hangCanCo(pt);
  if (!can.hang) return { ketLuan: "phu-hop", lyDo: `${can.lyDo}.`, canCu: can.canCu };
  if (gomHang(co, can.hang)) {
    return {
      ketLuan: "phu-hop",
      lyDo:
        co === can.hang
          ? `Xe thuộc phạm vi của hạng ${co}.`
          : `Hạng ${co} gồm các loại xe quy định cho hạng ${can.hang}.`,
      canCu,
    };
  }
  // Hạng kéo rơ moóc với xe của hạng gốc: luật không ghi rõ, nhưng người có hạng này đã có hạng gốc.
  const goc = HANG_GOC[co];
  const canGoc = HANG_GOC[can.hang];
  const rieng = pt.loai === "dau-keo" || pt.loai === "noi-toa";
  if (goc && !rieng && (gomHang(goc, can.hang) || (canGoc !== undefined && gomHang(goc, canGoc)))) {
    return {
      ketLuan: "can-xem-them",
      lyDo: `Hạng ${co} cấp cho xe của hạng ${goc} kéo rơ moóc trên 750 kg; luật không ghi hạng ${co} gồm xe của hạng ${can.hang}. Người có hạng ${co} thường đã có hạng ${goc}. ${XEM_GPLX}`,
      canCu,
    };
  }
  return {
    ketLuan: "khong-phu-hop",
    lyDo: `Xe cần hạng ${can.hang}; hạng ${co} không gồm loại xe này.`,
    canCu,
  };
}

/** Nhóm xe theo cách chia của hạng cũ (khoản 2 Điều 89). */
type LopCu = "moto-a1" | "moto-a2" | "moto-3" | "b" | "c" | "d" | "e";

function lopCu(pt: PhuongTien): LopCu | null {
  switch (pt.loai) {
    case "mo-to-2":
      if (pt.dongCo === "dien") return (pt.congSuat ?? 0) < 14 ? "moto-a1" : "moto-a2";
      return (pt.dungTich ?? 0) < 175 ? "moto-a1" : "moto-a2";
    case "mo-to-3":
      return "moto-3";
    case "cho-nguoi": {
      const cho = pt.soCho ?? 0;
      return cho <= 8 ? "b" : cho <= 29 ? "d" : "e";
    }
    case "tai":
      return (pt.trongTai ?? 0) < 3500 ? "b" : "c";
    default:
      return null;
  }
}

const TEN_LOP_CU: Record<LopCu, string> = {
  "moto-a1": "xe mô tô hai bánh từ 50 cm³ đến dưới 175 cm³ (từ 04 kW đến dưới 14 kW)",
  "moto-a2": "xe mô tô hai bánh từ 175 cm³ trở lên (từ 14 kW trở lên)",
  "moto-3": "xe mô tô ba bánh",
  b: "xe ô tô chở người đến 08 chỗ, xe ô tô tải có trọng tải dưới 3.500 kg",
  c: "xe ô tô tải có trọng tải từ 3.500 kg trở lên",
  d: "xe ô tô chở người từ 09 chỗ đến 29 chỗ",
  e: "xe ô tô chở người trên 29 chỗ",
};

type HangCuGoc = Exclude<HangCu, "FB2" | "FC" | "FD" | "FE">;

const PHAM_VI_CU: Record<HangCuGoc, readonly LopCu[]> = {
  A1: ["moto-a1"],
  A2: ["moto-a2", "moto-a1"],
  A3: ["moto-3", "moto-a1"],
  // Hạng A4 cấp cho máy kéo có trọng tải đến 1.000 kg, không có trong các loại xe của công cụ.
  A4: [],
  "B1-td": ["b"],
  B1: ["b"],
  B2: ["b"],
  C: ["c", "b"],
  D: ["d", "c", "b"],
  E: ["e", "d", "c", "b"],
};

const GOC_CUA_F: Record<Exclude<HangCu, HangCuGoc>, HangCuGoc> = { FB2: "B2", FC: "C", FD: "D", FE: "E" };

/** Đối chiếu một hạng cấp trước 01/01/2025 (chưa đổi) với phương tiện. */
export function doiChieuHangCu(pt: PhuongTien, co: HangCu): DoiChieuGplx {
  const canCu = "dieu89";
  const ten = tenHangCu(co);
  const khong = (lyDo: string): DoiChieuGplx => ({ ketLuan: "khong-phu-hop", lyDo, canCu });
  if (pt.loai === "xe-gan-may")
    return { ketLuan: "phu-hop", lyDo: `${hangCanCo(pt).lyDo}.`, canCu: "dieu59" };
  if (pt.loai === "dau-keo") {
    return co === "FC"
      ? { ketLuan: "phu-hop", lyDo: "Hạng FC được điều khiển xe ô tô đầu kéo kéo sơ mi rơ moóc.", canCu }
      : khong(`Xe ô tô đầu kéo kéo sơ mi rơ moóc cần hạng FC; hạng ${ten} không gồm loại xe này.`);
  }
  if (pt.loai === "noi-toa") {
    return co === "FE"
      ? { ketLuan: "phu-hop", lyDo: "Hạng FE được điều khiển xe ô tô chở khách nối toa.", canCu }
      : khong(`Xe ô tô chở khách nối toa cần hạng FE; hạng ${ten} không gồm loại xe này.`);
  }
  const lop = lopCu(pt);
  if (!lop) return khong("Không xác định được nhóm xe.");
  const laF = co in GOC_CUA_F;
  const goc = laF ? GOC_CUA_F[co as keyof typeof GOC_CUA_F] : (co as HangCuGoc);
  if (!PHAM_VI_CU[goc].includes(lop)) {
    return khong(`Xe thuộc nhóm ${TEN_LOP_CU[lop]}; hạng ${ten} cấp trước 01/01/2025 không gồm nhóm xe này.`);
  }
  const giuong = pt.giuongNam ? " Hạng cũ xét xe giường nằm theo số chỗ." : "";
  const roMooc = pt.roMooc ?? 0;
  if (laF) {
    return roMooc > 0
      ? {
          ketLuan: "phu-hop",
          lyDo: `Hạng ${ten} được điều khiển xe của hạng ${goc} có kéo rơ moóc.${giuong}`,
          canCu,
        }
      : {
          ketLuan: "can-xem-them",
          lyDo: `Hạng ${ten} cấp cho xe của hạng ${goc} có kéo rơ moóc; người có hạng ${ten} thường đã có hạng ${goc}. ${XEM_GPLX}`,
          canCu,
        };
  }
  if (roMooc > RO_MOOC_NHE)
    return khong(`Xe kéo rơ moóc ${kg(roMooc)}, trên 750 kg, cần hạng F tương ứng (FB2, FC, FD, FE).`);
  if (roMooc > 0) {
    return {
      ketLuan: "can-xem-them",
      lyDo: `Hạng ${ten} gồm nhóm ${TEN_LOP_CU[lop]}, nhưng khoản 2 Điều 89 cần đối chiếu thêm về việc kéo rơ moóc đến 750 kg.`,
      canCu,
    };
  }
  if (co === "B1-td") {
    return {
      ketLuan: "can-xem-them",
      lyDo: `Hạng B1 số tự động chỉ được điều khiển xe số tự động thuộc nhóm ${TEN_LOP_CU[lop]}. Phù hợp nếu xe đang điều khiển là xe số tự động.`,
      canCu,
    };
  }
  return {
    ketLuan: "phu-hop",
    lyDo: `Hạng ${ten} cấp trước 01/01/2025 được tiếp tục điều khiển ${TEN_LOP_CU[lop]}.${giuong}`,
    canCu,
  };
}

/** Khung phạt khi có GPLX nhưng không phù hợp với loại xe đang điều khiển (Điều 18 Nghị định 168/2024). */
export function khungKhongPhuHop(pt: PhuongTien): KhungPhat | null {
  if (pt.loai === "xe-gan-may") return null;
  const chung = { doiTuong: "Người điều khiển", daDoiChieu: false } as const;
  const hanhVi = "Có giấy phép lái xe nhưng không phù hợp với loại xe đang điều khiển";
  if (pt.loai === "mo-to-2" && hangGoc(pt)?.hang === "A1") {
    return {
      ...chung,
      hanhVi: `${hanhVi} (xe mô tô hai bánh có dung tích xi-lanh đến 125 cm³ hoặc công suất động cơ điện đến 11 kW)`,
      phatTu: 2_000_000,
      phatDen: 4_000_000,
      canCu: `Điểm a khoản 5 Điều 18 ${ND_168}`,
    };
  }
  if (pt.loai === "mo-to-2" || pt.loai === "mo-to-3") {
    return {
      ...chung,
      hanhVi: `${hanhVi} (xe mô tô hai bánh có dung tích xi-lanh trên 125 cm³ hoặc công suất động cơ điện trên 11 kW, xe mô tô ba bánh)`,
      phatTu: 6_000_000,
      phatDen: 8_000_000,
      canCu: `Điểm a khoản 7 Điều 18 ${ND_168}`,
    };
  }
  return {
    ...chung,
    hanhVi: `${hanhVi} (xe ô tô và các loại xe tương tự xe ô tô)`,
    phatTu: 18_000_000,
    phatDen: 20_000_000,
    canCu: `Điểm a khoản 9 Điều 18 ${ND_168}`,
  };
}
