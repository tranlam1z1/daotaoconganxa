/**
 * Trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3, docs/GAME_DESIGN.md §5.3).
 *
 * Một lượt là một đoạn đường nhìn từ trên xuống, chia ô 10 m, có các đặc điểm (trường học, đường
 * sắt…) và các vị trí cắm biển. Người chơi kéo biển từ khay vào vị trí, bấm "Cho xe chạy thử": xe
 * mô phỏng (M5) chạy qua và phản ứng theo biển đã cắm. Được chạy thử tối đa 3 lần; lần chạy cuối là
 * lần chấm.
 *
 * Người chơi gửi nhật ký thao tác (M7): đặt biển, gỡ biển, chạy thử. Máy chủ dựng lại bố trí từ nhật
 * ký, chấm BỐ TRÍ lúc chạy thử lần cuối (không chấm hoạt cảnh), rồi chạy lại mô phỏng để lấy danh
 * sách tình huống nguy hiểm cho màn kết quả.
 *
 * Chấm từng vị trí: biển đúng +10; biển "chấp nhận được" +5; để trống vị trí cần biển 0; biển sai −5;
 * vị trí nên để trống mà cắm biển −3. Điểm một vị trí không vượt điểm tối đa của vị trí; điểm cả
 * đoạn không âm (khung chung không cho điểm bước âm).
 *
 * Đánh đổi đã chấp nhận (GAME_DESIGN §1.2): đề gửi kèm `phan_ung` của từng biển trong khay để điện
 * thoại tự chạy thử ngay, không chờ máy chủ. Người chơi đoán được biển nào làm xe giảm tốc, nhưng
 * không biết biển nào đúng ở vị trí nào.
 *
 * Chỉ chấm "biển nào ở chỗ nào", không chấm khoảng cách đặt biển tính bằng mét (GAME_DESIGN §5.3).
 * Hàm thuần: không chạm CSDL, không đọc đồng hồ.
 */

import type { NhomBienBao, ThaoTacBienBao } from "../bien-bao.ts";
import { tron } from "../de-thi.ts";
import { type BienTrenDuong, TAM_NHIN_BIEN_CM } from "../mo-phong/bien.ts";
import {
  type DacDiem,
  type LoaiDacDiem,
  laLoaiDacDiem,
  lanThangDiLen,
  O_CM,
  RONG_LAN_CM,
  TEN_DAC_DIEM,
  TOC_DO_AN_TOAN,
} from "../mo-phong/duong.ts";
import {
  type CauHinhMoPhong,
  chayDenHet,
  dungMoPhong,
  NHIP_MS,
  type SuKien,
  type TrangThaiMoPhong,
} from "../mo-phong/mo-phong.ts";
import { TOC_DO_THUONG, type XeKhoiTao } from "../mo-phong/xe.ts";
import type { CauHinhMan } from "./chung/man-choi.ts";
import { bamTrangThai, chayLaiRoiCham, docNhatKy, LoiNhatKy, type NhatKy } from "./chung/nhat-ky.ts";
import type { BuocLuot, DinhNghiaTroChoi, KetQuaChamBuoc } from "./khung.ts";

export const MA_CAM_BIEN = "cam_bien";
export const SO_LAN_CHAY_THU = 3;
export const DIEM_BIEN_DUNG = 10;
export const DIEM_CHAP_NHAN = 5;
export const TRU_BIEN_SAI = 5;
export const TRU_THUA_BIEN = 3;
export const SO_O_TOI_THIEU = 6;
export const SO_O_TOI_DA = 16;
/** Số biển tối đa trên một cột (màn 5). */
export const BIEN_TOI_DA_MOT_COT = 2;
/** Xe chạy thử: 4 xe, cách nhau 2,5 giây. */
export const SO_XE_CHAY_THU = 4;
export const NHIP_GIUA_HAI_XE = 50;
/** Trần độ dài nhật ký đặt biển: 30 phút. */
export const TONG_NHIP_TOI_DA_CAM_BIEN = (30 * 60_000) / NHIP_MS;

/* ------------------------------------------------------------------ */
/* Màn chơi                                                            */
/* ------------------------------------------------------------------ */

export interface ThongSoManCamBien {
  so_vi_tri: number;
  so_bien_khay: number;
  /** Được có vị trí nhiều biển trên một cột. */
  nhieu_bien: boolean;
  /** Được có vị trí nên để trống. */
  de_trong: boolean;
}

/** GAME_DESIGN §5.3, bảng màn chơi. */
export const THONG_SO_MAN_CAM_BIEN: Readonly<Record<number, ThongSoManCamBien>> = {
  1: { so_vi_tri: 1, so_bien_khay: 3, nhieu_bien: false, de_trong: false },
  2: { so_vi_tri: 3, so_bien_khay: 6, nhieu_bien: false, de_trong: false },
  3: { so_vi_tri: 4, so_bien_khay: 8, nhieu_bien: false, de_trong: false },
  4: { so_vi_tri: 5, so_bien_khay: 10, nhieu_bien: false, de_trong: false },
  5: { so_vi_tri: 6, so_bien_khay: 12, nhieu_bien: true, de_trong: true },
};

export const MAN_CAM_BIEN: readonly CauHinhMan[] = [
  {
    so: 1,
    ten: "Màn 1: Một chỗ nguy hiểm",
    moTa: "Một vị trí, 3 biển trong khay. Làm quen cách cắm biển và cho xe chạy thử. Không tính giờ.",
    caLuotMs: null,
    xpCoBan: 10,
  },
  {
    so: 2,
    ten: "Màn 2: Trường học, người đi bộ",
    moTa: "Đoạn thẳng có trường học và chỗ người đi bộ sang đường: 3 vị trí, 6 biển.",
    caLuotMs: null,
    xpCoBan: 12,
  },
  {
    so: 3,
    ten: "Màn 3: Ngoặt, hẹp, đường sắt",
    moTa: "Chỗ ngoặt, đường hẹp, đường sắt cắt ngang: 4 vị trí, 8 biển.",
    caLuotMs: null,
    xpCoBan: 14,
  },
  {
    so: 4,
    ten: "Màn 4: Nơi giao nhau",
    moTa: "Có nơi giao nhau, thêm biển hiệu lệnh và biển cấm: 5 vị trí, 10 biển.",
    caLuotMs: null,
    xpCoBan: 16,
  },
  {
    so: 5,
    ten: "Màn 5: Nhiều biển một cột",
    moTa: "Có cột cắm được 2 biển, có vị trí nên để trống: 6 vị trí, 12 biển.",
    caLuotMs: null,
    xpCoBan: 18,
  },
];

export const SO_MAN_CAM_BIEN = MAN_CAM_BIEN.length;

const ganMan = (man: number | undefined) =>
  Math.min(SO_MAN_CAM_BIEN, Math.max(1, Number.isInteger(man) ? (man as number) : 1));

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                             */
/* ------------------------------------------------------------------ */

export type BenDuong = "phai" | "trai";

export interface DacDiemDoan {
  /** Ô của đặc điểm, 0 là ô dưới cùng (xe vào từ dưới). */
  o: number;
  loai: LoaiDacDiem;
}

export interface ViTriCamBien {
  id: string;
  o: number;
  ben: BenDuong;
  /** Số biển tối đa trên cột này. */
  toi_da: number;
}

/** Bố cục đoạn đường, lưu ở game_content.payload. */
export interface PayloadDoanDuong {
  muc: number;
  so_o: number;
  dac_diem: DacDiemDoan[];
  vi_tri: ViTriCamBien[];
  /** Mã các biển trong khay (gồm cả biển nhiễu). */
  khay: string[];
}

export interface DapAnViTri {
  /** Biển đúng; rỗng là vị trí nên để trống. */
  dung: string[];
  /** Biển chấp nhận được (người soạn khai báo). */
  chap_nhan: string[];
  ly_do: string;
}

/** Đáp án, lưu ở game_content.answer. */
export interface DapAnDoanDuong {
  vi_tri: Record<string, DapAnViTri>;
}

/** Biển đã duyệt có trong khay. */
export interface BienKhay {
  ma: string;
  version: number;
  nhom: NhomBienBao;
  ten: string;
  y_nghia: string;
  anh: string;
  can_cu: string;
  phan_ung: ThaoTacBienBao | null;
}

/** Một nguồn của trò: đoạn đường đã duyệt kèm các biển đã duyệt có trong khay. */
export interface NguonCamBien {
  id: string;
  code: string;
  version: number;
  topic_id: string | null;
  doan: PayloadDoanDuong;
  dap_an: DapAnDoanDuong;
  bien: BienKhay[];
}

/** Nội dung một bước trong ảnh chụp lượt (có đáp án). */
export interface BuocCamBien {
  man: number;
  doan: PayloadDoanDuong;
  dap_an: DapAnDoanDuong;
  bien: BienKhay[];
}

/** Phần đề gửi người chơi. */
export interface DeCamBien {
  man: number;
  so_o: number;
  dac_diem: Array<{ o: number; loai: LoaiDacDiem; ten: string }>;
  /** Theo thứ tự dọc đường (từ dưới lên); `so` là số hiện cho người chơi. */
  vi_tri: Array<ViTriCamBien & { so: number }>;
  khay: Array<{ ma: string; ten: string; nhom: NhomBienBao; anh: string; phan_ung: ThaoTacBienBao | null }>;
  so_lan_chay: number;
}

/** Bố trí: vị trí → các mã biển đã cắm, theo thứ tự cắm. */
export type BoTri = Record<string, string[]>;

export const THAO_TAC_CAM_BIEN = ["dat", "go", "chay_thu"] as const;
export type ThaoTacCamBien = (typeof THAO_TAC_CAM_BIEN)[number];
export type ThamSoCamBien = { vi_tri: string; ma: string } | null;
export type TraLoiCamBien = NhatKy<ThaoTacCamBien, ThamSoCamBien>;

/* ------------------------------------------------------------------ */
/* Kiểm bố cục                                                         */
/* ------------------------------------------------------------------ */

/** Một lỗi bố cục, chỉ đúng phần tử: "doan", "o:<ô>", "vi_tri:<id>", "khay:<mã>". */
export interface LoiBoCuc {
  phan_tu: string;
  loi: string;
}

const laMang = (v: unknown): v is unknown[] => Array.isArray(v);
const laChuoiNgan = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

/** Số thứ tự hiện cho người chơi của các vị trí: theo ô từ dưới lên, cùng ô thì bên phải trước. */
export function soThuTuViTri(viTri: readonly ViTriCamBien[]): Map<string, number> {
  const xep = [...viTri].sort(
    (a, b) => a.o - b.o || (a.ben === b.ben ? a.id.localeCompare(b.id) : a.ben === "phai" ? -1 : 1),
  );
  return new Map(xep.map((v, i) => [v.id, i + 1]));
}

/**
 * Kiểm bố cục một đoạn đường và đáp án. `bienDaDuyet` (mã biển đã duyệt có phản ứng) vắng thì bỏ
 * qua phần kiểm duyệt biển. Rỗng là hợp lệ. Chạy khi soạn, khi nạp dữ liệu mẫu và khi lấy nguồn.
 */
export function kiemTraDoanDuong(
  payload: Partial<PayloadDoanDuong> | null | undefined,
  dapAn: Partial<DapAnDoanDuong> | null | undefined,
  bienDaDuyet?: ReadonlySet<string>,
): LoiBoCuc[] {
  const loi: LoiBoCuc[] = [];
  const them = (phan_tu: string, l: string) => loi.push({ phan_tu, loi: l });
  if (!payload || typeof payload !== "object") return [{ phan_tu: "doan", loi: "Thiếu bố cục đoạn đường." }];

  const muc = payload.muc;
  const ts = Number.isInteger(muc) ? THONG_SO_MAN_CAM_BIEN[muc as number] : undefined;
  if (!ts) them("doan", `Màn của đoạn đường (muc) phải từ 1 đến ${SO_MAN_CAM_BIEN}.`);
  const soO = payload.so_o;
  const soOHopLe =
    Number.isInteger(soO) && (soO as number) >= SO_O_TOI_THIEU && (soO as number) <= SO_O_TOI_DA;
  if (!soOHopLe) them("doan", `Đoạn đường phải dài từ ${SO_O_TOI_THIEU} đến ${SO_O_TOI_DA} ô.`);
  const trongDuong = (o: unknown) =>
    Number.isInteger(o) && (o as number) >= 0 && (!soOHopLe || (o as number) < (soO as number));

  // Đặc điểm.
  const dacDiem = payload.dac_diem;
  if (!laMang(dacDiem)) them("doan", "Danh sách đặc điểm (dac_diem) phải là mảng.");
  else {
    const daCo = new Set<number>();
    for (const d of dacDiem as Partial<DacDiemDoan>[]) {
      const pt = `o:${d?.o}`;
      if (!trongDuong(d?.o))
        them(pt, `Đặc điểm ở ô ${d?.o} nằm ngoài đường (đường có ${soO} ô, từ 0 đến ${Number(soO) - 1}).`);
      if (!laLoaiDacDiem(d?.loai)) them(pt, `Ô ${d?.o}: loại đặc điểm "${d?.loai}" không có.`);
      if (daCo.has(d?.o as number)) them(pt, `Ô ${d?.o} có hai đặc điểm; mỗi ô chỉ một.`);
      daCo.add(d?.o as number);
    }
  }

  // Khay.
  const khay = payload.khay;
  const trongKhay = new Set<string>();
  if (!laMang(khay) || khay.some((m) => !laChuoiNgan(m, 20)))
    them("doan", "Khay biển (khay) phải là danh sách mã biển.");
  else {
    for (const m of khay as string[]) {
      if (trongKhay.has(m)) them(`khay:${m}`, `Biển ${m} có hai lần trong khay.`);
      trongKhay.add(m);
      if (bienDaDuyet && !bienDaDuyet.has(m))
        them(`khay:${m}`, `Biển ${m} chưa được duyệt (hoặc chưa có phản ứng đã duyệt).`);
    }
    if (ts && trongKhay.size !== ts.so_bien_khay)
      them("doan", `Màn ${muc} cần đúng ${ts.so_bien_khay} biển trong khay, đang có ${trongKhay.size}.`);
  }

  // Vị trí và đáp án.
  const viTri = payload.vi_tri;
  const da = dapAn?.vi_tri && typeof dapAn.vi_tri === "object" ? dapAn.vi_tri : null;
  if (!da) them("doan", "Thiếu đáp án của các vị trí (vi_tri).");
  if (!laMang(viTri)) them("doan", "Danh sách vị trí (vi_tri) phải là mảng.");
  else {
    if (ts && viTri.length !== ts.so_vi_tri)
      them("doan", `Màn ${muc} cần đúng ${ts.so_vi_tri} vị trí, đang có ${viTri.length}.`);
    const ids = new Set<string>();
    const cho = new Set<string>();
    let coBienDung = false;
    for (const v of viTri as Partial<ViTriCamBien>[]) {
      const id = v?.id;
      if (!laChuoiNgan(id, 20)) {
        them("doan", "Vị trí thiếu mã (id) hoặc mã dài quá 20 ký tự.");
        continue;
      }
      const pt = `vi_tri:${id}`;
      if (ids.has(id)) them(pt, `Mã vị trí ${id} bị trùng.`);
      ids.add(id);
      if (!trongDuong(v.o)) them(pt, `Vị trí ${id}: ô ${v.o} nằm ngoài đường (đường có ${soO} ô).`);
      if (v.ben !== "phai" && v.ben !== "trai")
        them(pt, `Vị trí ${id}: bên đường phải là "phai" hoặc "trai".`);
      if (cho.has(`${v.o}:${v.ben}`)) them(pt, `Vị trí ${id}: ô ${v.o} bên ${v.ben} đã có vị trí khác.`);
      cho.add(`${v.o}:${v.ben}`);
      const toiDa = v.toi_da;
      if (!Number.isInteger(toiDa) || (toiDa as number) < 1 || (toiDa as number) > BIEN_TOI_DA_MOT_COT)
        them(pt, `Vị trí ${id}: số biển tối đa trên cột phải từ 1 đến ${BIEN_TOI_DA_MOT_COT}.`);
      else if ((toiDa as number) > 1 && ts && !ts.nhieu_bien)
        them(pt, `Vị trí ${id}: màn ${muc} chưa cho cắm nhiều biển một cột.`);

      const d = da?.[id];
      if (!da) continue;
      if (!d || typeof d !== "object") {
        them(pt, `Vị trí ${id} chưa có đáp án.`);
        continue;
      }
      if (!laMang(d.dung) || !laMang(d.chap_nhan)) {
        them(pt, `Vị trí ${id}: đáp án cần danh sách biển đúng (dung) và biển chấp nhận được (chap_nhan).`);
        continue;
      }
      for (const m of d.dung)
        if (!trongKhay.has(m)) them(pt, `Vị trí ${id}: biển đúng ${m} không có trong khay.`);
      for (const m of d.chap_nhan)
        if (!trongKhay.has(m)) them(pt, `Vị trí ${id}: biển chấp nhận được ${m} không có trong khay.`);
      for (const m of d.dung)
        if (d.chap_nhan.includes(m)) them(pt, `Vị trí ${id}: biển ${m} vừa đúng vừa "chấp nhận được".`);
      if (new Set(d.dung).size !== d.dung.length) them(pt, `Vị trí ${id}: biển đúng bị trùng.`);
      if (Number.isInteger(toiDa) && d.dung.length > (toiDa as number))
        them(pt, `Vị trí ${id}: có ${d.dung.length} biển đúng nhưng cột chỉ cắm được ${toiDa}.`);
      if (!d.dung.length) {
        if (ts && !ts.de_trong)
          them(pt, `Vị trí ${id}: màn ${muc} chưa có vị trí nên để trống; cần ít nhất một biển đúng.`);
        if (d.chap_nhan.length)
          them(pt, `Vị trí ${id}: vị trí nên để trống thì không có biển chấp nhận được.`);
      } else coBienDung = true;
      if (!laChuoiNgan(d.ly_do, 1000)) them(pt, `Vị trí ${id}: cần ghi lý do (ly_do) để hiện ở màn kết quả.`);
    }
    if (!coBienDung && viTri.length) them("doan", "Cần ít nhất một vị trí có biển đúng.");
    if (da)
      for (const id of Object.keys(da))
        if (!ids.has(id)) them(`vi_tri:${id}`, `Đáp án có vị trí ${id} không có trên đường.`);
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Dựng lại bố trí từ nhật ký                                          */
/* ------------------------------------------------------------------ */

export function boTriRong(viTri: readonly Pick<ViTriCamBien, "id">[]): BoTri {
  return Object.fromEntries(viTri.map((v) => [v.id, [] as string[]]));
}

/**
 * Áp một thao tác đặt hoặc gỡ lên bố trí (trả bố trí mới). Thao tác không hợp lệ với bố trí thì ném
 * LoiNhatKy. Dùng chung cho máy chủ (chạy lại) và điện thoại (cắm biển).
 */
export function apThaoTac(
  de: { vi_tri: readonly Pick<ViTriCamBien, "id" | "toi_da">[]; khay: readonly (string | { ma: string })[] },
  boTri: BoTri,
  thaoTac: "dat" | "go",
  tham: { vi_tri: string; ma: string },
): BoTri {
  const v = de.vi_tri.find((x) => x.id === tham.vi_tri);
  if (!v) throw new LoiNhatKy("Nhật ký có vị trí không có trên đường.");
  const cot = boTri[v.id] ?? [];
  if (thaoTac === "dat") {
    if (!de.khay.some((k) => (typeof k === "string" ? k : k.ma) === tham.ma))
      throw new LoiNhatKy("Nhật ký có biển không có trong khay.");
    if (cot.includes(tham.ma)) throw new LoiNhatKy("Nhật ký cắm một biển hai lần trên cùng cột.");
    if (cot.length >= v.toi_da) throw new LoiNhatKy("Nhật ký cắm quá số biển của cột.");
    return { ...boTri, [v.id]: [...cot, tham.ma] };
  }
  if (!cot.includes(tham.ma)) throw new LoiNhatKy("Nhật ký gỡ một biển chưa cắm.");
  return { ...boTri, [v.id]: cot.filter((m) => m !== tham.ma) };
}

export interface BoTriDaDung {
  /** Bố trí được chấm: lúc chạy thử lần cuối, hoặc lúc nộp nếu chưa chạy thử lần nào. */
  cham: BoTri;
  so_lan_chay: number;
}

/** Dựng lại bố trí từ nhật ký. Chạy thử quá 3 lần, hay đổi bố trí sau lần chạy cuối: ném LoiNhatKy. */
export function dungLaiBoTri(
  de: { vi_tri: readonly Pick<ViTriCamBien, "id" | "toi_da">[]; khay: readonly (string | { ma: string })[] },
  nk: TraLoiCamBien,
): BoTriDaDung {
  let bt = boTriRong(de.vi_tri);
  let lanCuoi: BoTri | null = null;
  let soLan = 0;
  for (const t of nk.thao_tac) {
    if (t.thao_tac === "chay_thu") {
      soLan++;
      if (soLan > SO_LAN_CHAY_THU) throw new LoiNhatKy(`Nhật ký chạy thử quá ${SO_LAN_CHAY_THU} lần.`);
      lanCuoi = bt;
      continue;
    }
    if (soLan >= SO_LAN_CHAY_THU) throw new LoiNhatKy("Nhật ký đổi bố trí sau lần chạy thử cuối.");
    if (!t.tham_so) throw new LoiNhatKy("Nhật ký thiếu vị trí hoặc biển.");
    bt = apThaoTac(de, bt, t.thao_tac, t.tham_so);
  }
  return { cham: lanCuoi ?? bt, so_lan_chay: soLan };
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

export type KetBienCam = "dung" | "chap_nhan" | "sai" | "thua";
export type KetViTri = "dung" | "chap_nhan" | "thieu" | "sai" | "thua" | "de_trong_dung";

export interface KetQuaViTri {
  id: string;
  so: number;
  o: number;
  ben: BenDuong;
  dat: Array<{ ma: string; ket: KetBienCam; diem: number }>;
  dung: string[];
  chap_nhan: string[];
  diem: number;
  diem_toi_da: number;
  ket: KetViTri;
  ly_do: string;
}

export const diemToiDaViTri = (d: Pick<DapAnViTri, "dung">) => d.dung.length * DIEM_BIEN_DUNG;

export function chamViTri(v: ViTriCamBien, so: number, d: DapAnViTri, dat: readonly string[]): KetQuaViTri {
  const toiDa = diemToiDaViTri(d);
  const coBan = {
    id: v.id,
    so,
    o: v.o,
    ben: v.ben,
    dung: [...d.dung],
    chap_nhan: [...d.chap_nhan],
    diem_toi_da: toiDa,
    ly_do: d.ly_do,
  };
  if (!d.dung.length) {
    return dat.length
      ? {
          ...coBan,
          dat: dat.map((ma) => ({ ma, ket: "thua" as const, diem: 0 })),
          diem: -TRU_THUA_BIEN,
          ket: "thua",
        }
      : { ...coBan, dat: [], diem: 0, ket: "de_trong_dung" };
  }
  const kq = dat.map((ma) =>
    d.dung.includes(ma)
      ? { ma, ket: "dung" as const, diem: DIEM_BIEN_DUNG }
      : d.chap_nhan.includes(ma)
        ? { ma, ket: "chap_nhan" as const, diem: DIEM_CHAP_NHAN }
        : { ma, ket: "sai" as const, diem: -TRU_BIEN_SAI },
  );
  const diem = Math.min(
    toiDa,
    kq.reduce((s, k) => s + k.diem, 0),
  );
  const soDung = kq.filter((k) => k.ket === "dung").length;
  const coSai = kq.some((k) => k.ket === "sai");
  const ket: KetViTri = !dat.length
    ? "thieu"
    : coSai
      ? "sai"
      : soDung === d.dung.length
        ? "dung"
        : "chap_nhan";
  return { ...coBan, dat: kq, diem, ket };
}

/** Chấm một bố trí. Điểm cả đoạn không âm. */
export function chamBoTri(
  doan: Pick<PayloadDoanDuong, "vi_tri">,
  dapAn: DapAnDoanDuong,
  boTri: BoTri,
): { diem: number; diem_toi_da: number; vi_tri: KetQuaViTri[] } {
  const so = soThuTuViTri(doan.vi_tri);
  const viTri = [...doan.vi_tri]
    .sort((a, b) => so.get(a.id)! - so.get(b.id)!)
    .map((v) => chamViTri(v, so.get(v.id)!, dapAn.vi_tri[v.id]!, boTri[v.id] ?? []));
  const tong = viTri.reduce((s, v) => s + v.diem, 0);
  return {
    diem: Math.max(0, tong),
    diem_toi_da: viTri.reduce((s, v) => s + v.diem_toi_da, 0),
    vi_tri: viTri,
  };
}

/* ------------------------------------------------------------------ */
/* Chạy thử (bộ mô phỏng M5)                                           */
/* ------------------------------------------------------------------ */

export const LAN_CHAY_THU = "lan-1";
/** Đoạn chạy đà bên dưới ô 0, ngoài khung nhìn: xe vào đường ở tốc độ thường mà vẫn kịp thấy biển ô đầu. */
export const CHAY_DA_CM = 4 * O_CM;
const LOAI_XE_CHAY_THU = ["o_to", "xe_tai", "o_to", "xe_may"] as const;

/** Quãng đường trên làn tới đầu ô `o`, cm. */
export const sDauO = (o: number) => CHAY_DA_CM + o * O_CM;
/** Vị trí biển của một ô trên làn (giữa ô), cm. */
export const sCuaO = (o: number) => sDauO(o) + O_CM / 2;

/** Cấu hình mô phỏng của một lần chạy thử. `phanUng`: mã biển → thao tác đã duyệt. */
export function cauHinhChayThu(
  doan: Pick<PayloadDoanDuong, "so_o" | "dac_diem" | "vi_tri">,
  boTri: BoTri,
  phanUng: Readonly<Record<string, ThaoTacBienBao | null>>,
): CauHinhMoPhong {
  const dacDiem: DacDiem[] = doan.dac_diem.map((d) => ({
    id: `o${d.o}`,
    loai: d.loai,
    lan: LAN_CHAY_THU,
    s_tu: sDauO(d.o),
    s_den: sDauO(d.o + 1),
  }));
  const bien: BienTrenDuong[] = doan.vi_tri.flatMap((v) =>
    (boTri[v.id] ?? []).map((ma) => ({
      id: v.id,
      ma,
      lan: LAN_CHAY_THU,
      s: sCuaO(v.o),
      phan_ung: phanUng[ma] ?? null,
    })),
  );
  const xe: XeKhoiTao[] = LOAI_XE_CHAY_THU.slice(0, SO_XE_CHAY_THU).map((loai, i) => ({
    id: `xe-${i + 1}`,
    loai,
    lan: LAN_CHAY_THU,
    nhip_vao: i * NHIP_GIUA_HAI_XE,
  }));
  return {
    lan: [lanThangDiLen(LAN_CHAY_THU, doan.so_o, TOC_DO_THUONG, RONG_LAN_CM / 2, CHAY_DA_CM)],
    dac_diem: dacDiem,
    bien,
    xe,
  };
}

/**
 * `dung_vo_co`: xe dừng theo biển "dừng lại" mà trong tầm nhìn phía trước không có đặc điểm nào cần
 * dừng. Không gây nguy hiểm, nhưng là xe xử lý sai vì biển sai chỗ.
 */
export type LoaiTinhHuong = "phanh_gap" | "nguy_hiem" | "bi_chan" | "dung_vo_co";

/** Biển đã biết tên và phản ứng (khay của đề), để giải thích vì sao xe xử lý sai. */
export interface BienDaBiet {
  ma: string;
  ten: string;
  phan_ung: ThaoTacBienBao | null;
}

/** Số ô trước một đặc điểm mà biển đặt ở đó người lái còn kịp thấy (theo tầm nhìn biển của M5). */
const O_TAM_NHIN = Math.floor(TAM_NHIN_BIEN_CM / O_CM);

export interface TinhHuongNguyHiem {
  loai: LoaiTinhHuong;
  /** Ô xảy ra (theo đặc điểm, hoặc theo vị trí biển). */
  o: number;
  dac_diem: LoaiDacDiem | null;
  /** Số của vị trí biển gây ra, nếu do biển. */
  vi_tri: number | null;
  so_xe: number;
  /** Nhịp đầu tiên xảy ra, để phát lại. */
  nhip: number;
  /** Chuyện gì xảy ra. */
  mo_ta: string;
  /**
   * Vì sao: thiếu biển hay biển sai, biển nào. Chỉ dựa trên dữ kiện công khai (đặc điểm, biển đã cắm
   * và phản ứng của biển), không nói biển nào đúng; biển đúng chỉ hiện ở màn kết quả.
   */
  vi_sao: string;
}

const tenBien = (ma: string, bien: ReadonlyMap<string, BienDaBiet>) => `"${bien.get(ma)?.ten ?? ma}"`;

/** Giải thích vì sao xe phải phanh gấp hoặc lao nhanh vào một đặc điểm. */
function viSaoTaiDacDiem(
  dd: DacDiemDoan,
  doan: Pick<PayloadDoanDuong, "vi_tri">,
  so: ReadonlyMap<string, number>,
  boTri: BoTri,
  bien: ReadonlyMap<string, BienDaBiet>,
): string {
  const ten = TEN_DAC_DIEM[dd.loai].toLowerCase();
  const camTruoc = doan.vi_tri
    .filter((v) => v.o < dd.o && v.o >= dd.o - O_TAM_NHIN && (boTri[v.id]?.length ?? 0) > 0)
    .sort((a, b) => b.o - a.o);
  const giamToc = camTruoc.find((v) =>
    boTri[v.id]!.some((m) => bien.get(m)?.phan_ung === "giam_toc" || bien.get(m)?.phan_ung === "dung_lai"),
  );
  if (giamToc)
    return `Biển ở vị trí ${so.get(giamToc.id)} có yêu cầu giảm tốc nhưng xe vẫn không kịp: xem lại biển có hợp với ${ten} không.`;
  if (camTruoc.length) {
    const v = camTruoc[0]!;
    const ds = boTri[v.id]!.map((m) => tenBien(m, bien)).join(", ");
    return `Biển ${ds} ở vị trí ${so.get(v.id)} không báo cho người lái phải giảm tốc, nên xe vẫn chạy nhanh tới ${ten}.`;
  }
  const sau = doan.vi_tri.find((v) => v.o >= dd.o && (boTri[v.id]?.length ?? 0) > 0);
  if (sau && !doan.vi_tri.some((v) => v.o < dd.o && (boTri[v.id]?.length ?? 0) > 0))
    return `Biển ở vị trí ${so.get(sau.id)} nằm từ ${ten} trở đi: người lái tới ${ten} rồi mới thấy biển.`;
  return `Trước ${ten} chưa có biển nào báo trước: người lái chỉ thấy ${ten} khi đã tới gần.`;
}

/**
 * Tình huống nguy hiểm của một lần chạy: gộp theo (loại, nguyên nhân), đếm số xe gặp. Xếp theo
 * nhịp xảy ra đầu tiên.
 */
export function tinhHuongNguyHiem(
  doan: Pick<PayloadDoanDuong, "dac_diem" | "vi_tri">,
  suKien: readonly SuKien[],
  ngCanh: { boTri: BoTri; bien: readonly BienDaBiet[] } = { boTri: {}, bien: [] },
): TinhHuongNguyHiem[] {
  const so = soThuTuViTri(doan.vi_tri);
  const bien = new Map(ngCanh.bien.map((b) => [b.ma, b]));
  const boTri = ngCanh.boTri;
  const oCuaViTri = new Map(doan.vi_tri.map((v) => [v.id, v.o]));
  const loaiCuaO = new Map(doan.dac_diem.map((d) => [`o${d.o}`, d]));
  const gom = new Map<string, TinhHuongNguyHiem & { xe: Set<string> }>();
  for (const s of suKien) {
    let loai: LoaiTinhHuong;
    if (s.loai === "phanh_gap" || s.loai === "nguy_hiem" || s.loai === "bi_chan") loai = s.loai;
    else if (s.loai === "dung_theo_bien" && s.bien) {
      // Dừng vô cớ: không có đặc điểm cần giảm tốc từ ô của biển tới hết tầm nhìn.
      const o = oCuaViTri.get(s.bien) ?? 0;
      const coDacDiem = doan.dac_diem.some(
        (d) => d.o >= o && d.o <= o + O_TAM_NHIN && TOC_DO_AN_TOAN[d.loai] !== null,
      );
      if (coDacDiem) continue;
      loai = "dung_vo_co";
    } else continue;
    const khoa = `${loai}|${s.dac_diem ?? ""}|${s.bien ?? ""}`;
    const co = gom.get(khoa);
    if (co) {
      co.xe.add(s.xe);
      continue;
    }
    const dd = s.dac_diem ? loaiCuaO.get(s.dac_diem) : undefined;
    const soViTri = s.bien ? (so.get(s.bien) ?? null) : null;
    const o = dd ? dd.o : s.bien ? (oCuaViTri.get(s.bien) ?? 0) : 0;
    const ten = dd ? TEN_DAC_DIEM[dd.loai].toLowerCase() : "";
    const mo_ta =
      loai === "bi_chan"
        ? `Biển ở vị trí ${soViTri} làm xe dừng hẳn, không đi tiếp được.`
        : loai === "dung_vo_co"
          ? `Xe dừng lại ở vị trí ${soViTri}.`
          : loai === "nguy_hiem"
            ? `Xe lao vào ${ten} khi còn quá nhanh.`
            : dd
              ? `Xe phải phanh gấp trước ${ten}.`
              : `Xe phải phanh gấp vì biển ở vị trí ${soViTri}.`;
    const bienGay = s.bien ? (boTri[s.bien] ?? []).filter((m) => bien.get(m)?.phan_ung) : [];
    const tenGay = bienGay.length ? bienGay.map((m) => tenBien(m, bien)).join(", ") : "";
    const vi_sao = dd
      ? viSaoTaiDacDiem(dd, doan, so, boTri, bien)
      : loai === "bi_chan"
        ? `Biển ${tenGay || "đã cắm"} bắt xe không được đi tiếp, nên cả đoạn đường bị chặn.`
        : loai === "dung_vo_co"
          ? `Biển ${tenGay || "đã cắm"} bắt xe dừng, nhưng phía trước không có chỗ nào cần dừng: dòng xe bị chậm vô cớ.`
          : `Biển ${tenGay || "đã cắm"} bắt xe giảm tốc hoặc dừng quá đột ngột.`;
    gom.set(khoa, {
      loai,
      o,
      dac_diem: dd?.loai ?? null,
      vi_tri: soViTri,
      so_xe: 0,
      nhip: s.nhip,
      mo_ta,
      vi_sao,
      xe: new Set([s.xe]),
    });
  }
  return [...gom.values()].sort((a, b) => a.nhip - b.nhip).map(({ xe, ...t }) => ({ ...t, so_xe: xe.size }));
}

export interface KetQuaChayThu {
  trang_thai: TrangThaiMoPhong;
  tinh_huong: TinhHuongNguyHiem[];
}

export function chayThu(
  doan: Pick<PayloadDoanDuong, "so_o" | "dac_diem" | "vi_tri">,
  boTri: BoTri,
  phanUng: Readonly<Record<string, ThaoTacBienBao | null>>,
  bien: readonly BienDaBiet[] = [],
): KetQuaChayThu {
  const tt = chayDenHet(dungMoPhong(cauHinhChayThu(doan, boTri, phanUng)));
  return { trang_thai: tt, tinh_huong: tinhHuongNguyHiem(doan, tt.su_kien, { boTri, bien }) };
}

/* ------------------------------------------------------------------ */
/* Định nghĩa trò                                                      */
/* ------------------------------------------------------------------ */

export interface ChiTietCamBien {
  hop_le: boolean;
  ly_do: string | null;
  so_lan_chay: number;
  bo_tri: BoTri;
  vi_tri: KetQuaViTri[];
  /** Tên và ảnh các biển nhắc tới trong kết quả (biển đã cắm và biển đúng). */
  bien: Record<string, { ten: string; anh: string; can_cu: string }>;
  tinh_huong: TinhHuongNguyHiem[];
  /** Băm trạng thái cuối của lần chạy lại (test máy chủ và máy khách khớp nhau). */
  bam: string;
}

function dungBuoc(n: NguonCamBien, man: number): BuocLuot<BuocCamBien> {
  return {
    thu_tu: 1,
    ref_kind: "game_content",
    ref_id: n.id,
    ref_version: n.version,
    topic_id: n.topic_id,
    diem_toi_da: n.doan.vi_tri.reduce((s, v) => s + diemToiDaViTri(n.dap_an.vi_tri[v.id]!), 0),
    noi_dung: {
      man,
      doan: n.doan,
      dap_an: n.dap_an,
      // Chỉ giữ biển có trong khay, theo thứ tự khay.
      bien: n.doan.khay.map((m) => n.bien.find((b) => b.ma === m)!),
    },
  };
}

export const phanUngTheoMa = (bien: readonly Pick<BienKhay, "ma" | "phan_ung">[]) =>
  Object.fromEntries(bien.map((b) => [b.ma, b.phan_ung])) as Record<string, ThaoTacBienBao | null>;

export const TRO_CHOI_CAM_BIEN: DinhNghiaTroChoi<BuocCamBien, DeCamBien, TraLoiCamBien> = {
  ma: MA_CAM_BIEN,
  ten: "Cắm biển cho tuyến đường",
  moTa: "Cắm biển báo vào đúng chỗ trên đoạn đường, rồi cho xe chạy thử xem xe phản ứng thế nào.",
  offline: true,
  nguon: "cam_bien_doan_duong",
  soBuoc: 1,
  thoiGian: null,
  thuongNhanh: false,
  xpCoBan: 10,
  manChoi: MAN_CAM_BIEN,

  locNguon(nguon) {
    return (nguon as NguonCamBien[]).filter(
      (n) =>
        n?.doan &&
        Array.isArray(n.bien) &&
        kiemTraDoanDuong(n.doan, n.dap_an, new Set(n.bien.map((b) => b.ma))).length === 0,
    );
  },

  taoLuot(nguon, rng, man) {
    const m = ganMan(man);
    // Sắp theo id trước khi trộn: lượt chỉ phụ thuộc tập nguồn, seed và màn.
    const ds = (this.locNguon(nguon) as NguonCamBien[])
      .filter((n) => n.doan.muc === m)
      .sort((a, b) => a.id.localeCompare(b.id));
    const chon = tron(ds, rng)[0];
    return chon ? [dungBuoc(chon, m)] : [];
  },

  deChoNguoiChoi(buoc) {
    const b = buoc.noi_dung;
    const so = soThuTuViTri(b.doan.vi_tri);
    return {
      man: b.man,
      so_o: b.doan.so_o,
      dac_diem: b.doan.dac_diem.map((d) => ({ o: d.o, loai: d.loai, ten: TEN_DAC_DIEM[d.loai] })),
      vi_tri: [...b.doan.vi_tri]
        .sort((x, y) => so.get(x.id)! - so.get(y.id)!)
        .map((v) => ({ id: v.id, o: v.o, ben: v.ben, toi_da: v.toi_da, so: so.get(v.id)! })),
      khay: b.bien.map((k) => ({ ma: k.ma, ten: k.ten, nhom: k.nhom, anh: k.anh, phan_ung: k.phan_ung })),
      so_lan_chay: SO_LAN_CHAY_THU,
    };
  },

  docTraLoi(raw) {
    return docNhatKy<ThaoTacCamBien, ThamSoCamBien>(
      raw,
      (thaoTac, thamSo) => {
        if (thaoTac === "chay_thu") return thamSo == null ? { thao_tac: "chay_thu", tham_so: null } : null;
        if (thaoTac !== "dat" && thaoTac !== "go") return null;
        if (!thamSo || typeof thamSo !== "object") return null;
        const { vi_tri, ma } = thamSo as Record<string, unknown>;
        if (!laChuoiNgan(vi_tri, 20) || !laChuoiNgan(ma, 20)) return null;
        return { thao_tac: thaoTac, tham_so: { vi_tri, ma } };
      },
      { tongNhipToiDa: TONG_NHIP_TOI_DA_CAM_BIEN },
    );
  },

  chamBuoc(buoc, tl, ngCanh): KetQuaChamBuoc {
    const n = buoc.noi_dung;
    const theoMa = new Map(n.bien.map((b) => [b.ma, b]));
    const kq = chayLaiRoiCham(tl, ngCanh?.thoiGianMs ?? null, (nk) =>
      dungLaiBoTri({ vi_tri: n.doan.vi_tri, khay: n.doan.khay }, nk),
    );
    const boTri = kq.hop_le ? kq.ket_qua.cham : boTriRong(n.doan.vi_tri);
    const cham = chamBoTri(n.doan, n.dap_an, boTri);
    const chay = chayThu(n.doan, boTri, phanUngTheoMa(n.bien), n.bien);
    const nhac = new Set([
      ...cham.vi_tri.flatMap((v) => [...v.dung, ...v.chap_nhan, ...v.dat.map((d) => d.ma)]),
    ]);
    const chiTiet: ChiTietCamBien = {
      hop_le: kq.hop_le,
      ly_do: kq.hop_le ? null : kq.ly_do,
      so_lan_chay: kq.hop_le ? kq.ket_qua.so_lan_chay : 0,
      bo_tri: boTri,
      vi_tri: cham.vi_tri,
      bien: Object.fromEntries(
        [...nhac]
          .filter((m) => theoMa.has(m))
          .map((m) => {
            const b = theoMa.get(m)!;
            return [m, { ten: b.ten, anh: b.anh, can_cu: b.can_cu }];
          }),
      ),
      tinh_huong: kq.hop_le ? chay.tinh_huong : [],
      bam: bamTrangThai({
        xe: chay.trang_thai.xe,
        su_kien: chay.trang_thai.su_kien,
        nhip: chay.trang_thai.nhip,
      }),
    };
    const diem = kq.hop_le ? cham.diem : 0;
    const soDung = cham.vi_tri.filter((v) => v.ket === "dung" || v.ket === "de_trong_dung").length;
    const giaiThich = kq.hop_le
      ? `Đúng ${soDung}/${cham.vi_tri.length} vị trí. ${chay.tinh_huong.length ? `Lần chạy cuối có ${chay.tinh_huong.length} tình huống nguy hiểm.` : "Lần chạy cuối không có tình huống nguy hiểm."}`
      : `Không chấm được bố trí: ${kq.ly_do}`;
    return {
      diem,
      diemToiDa: buoc.diem_toi_da,
      dung: kq.hop_le && diem >= buoc.diem_toi_da,
      chiTiet,
      giaiThich,
      canCu: [
        ...new Set(
          cham.vi_tri
            .flatMap((v) => v.dung)
            .map((m) => theoMa.get(m)?.can_cu)
            .filter((c): c is string => Boolean(c)),
        ),
      ],
    };
  },
};
