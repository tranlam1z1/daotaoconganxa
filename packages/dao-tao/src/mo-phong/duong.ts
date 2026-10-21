/**
 * Mạng đường của bộ mô phỏng giao thông (mô-đun M5, docs/GAME_DESIGN.md §4, §2.3).
 *
 * Bản đồ tính bằng cm, số nguyên. Một làn là một đường gấp khúc; mỗi đoạn đi theo một trong 8
 * hướng (dọc, ngang hoặc chéo 45°), nên vị trí trên làn tính bằng phép chia số nguyên, không cần
 * hàm lượng giác. Trò 3 dùng một làn thẳng; trò 8 thêm giao lộ và xe rẽ bằng các đoạn chéo.
 *
 * Đặc điểm của đường (trường học, đường sắt…) là chỗ xe phải qua ở tốc độ an toàn. Tốc độ an toàn
 * ở đây là THÔNG SỐ MÔ PHỎNG để hoạt cảnh chạy thử có ý nghĩa, không phải tốc độ theo quy định.
 *
 * Hàm thuần, chạy được ở máy chủ và trình duyệt.
 */
import type { LoaiXe } from "./xe.ts";

/** Một ô của lưới đường: 10 m. */
export const O_CM = 1000;
/** Bề rộng một làn xe. */
export const RONG_LAN_CM = 350;

/** 8 hướng, theo chiều kim đồng hồ: 0 là lên (bắc), 2 là sang phải (đông), 4 là xuống, 6 là sang trái. */
export type Huong = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Bước đơn vị của từng hướng trên màn hình (trục y hướng xuống). */
export const BUOC_HUONG: Readonly<Record<Huong, readonly [number, number]>> = {
  0: [0, -1],
  1: [1, -1],
  2: [1, 0],
  3: [1, 1],
  4: [0, 1],
  5: [-1, 1],
  6: [-1, 0],
  7: [-1, -1],
};

export interface Diem {
  x: number;
  y: number;
}

/** Một làn khai trong cấu hình: các điểm gấp khúc và tốc độ tối đa của làn (mm mỗi nhịp). */
export interface Lan {
  id: string;
  diem: readonly Diem[];
  toc_do_toi_da: number;
  /** GĐ-T5: loại xe được đi trên làn; vắng là mọi loại. Xe khác loại vào làn thì phát `sai_lan`. */
  danh_cho?: readonly LoaiXe[];
}

/** GĐ-T5: đoạn cấm dừng trên một làn, quãng đường cm. Xe dừng trong đoạn thì phát `dung_do_sai`. */
export interface VungCamDung {
  id: string;
  lan: string;
  s_tu: number;
  s_den: number;
}

export interface DoanLan {
  tu: Diem;
  den: Diem;
  huong: Huong;
  /** Độ dài đoạn, cm. */
  dai: number;
  /** Quãng đường trên làn tại đầu đoạn, cm. */
  s0: number;
}

export interface LanDaDung {
  id: string;
  doan: DoanLan[];
  /** Tổng độ dài làn, cm. */
  dai: number;
  toc_do_toi_da: number;
  danh_cho?: readonly LoaiXe[];
}

function huongCua(dx: number, dy: number): Huong | null {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (sx === 0 && sy === 0) return null;
  // Chỉ nhận dọc, ngang, hoặc chéo đúng 45°.
  if (sx !== 0 && sy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  for (const [h, [bx, by]] of Object.entries(BUOC_HUONG))
    if (bx === sx && by === sy) return Number(h) as Huong;
  return null;
}

/**
 * Dựng làn từ các điểm. Ném lỗi khi điểm không phải số nguyên hoặc có đoạn không theo 8 hướng
 * (lỗi cấu hình, không phải lỗi người chơi).
 */
export function dungLan(l: Lan): LanDaDung {
  if (l.diem.length < 2) throw new Error(`Làn ${l.id} cần ít nhất 2 điểm.`);
  const doan: DoanLan[] = [];
  let s = 0;
  for (let i = 1; i < l.diem.length; i++) {
    const tu = l.diem[i - 1]!;
    const den = l.diem[i]!;
    if (![tu.x, tu.y, den.x, den.y].every(Number.isInteger))
      throw new Error(`Làn ${l.id}: tọa độ phải là số nguyên (cm).`);
    const dx = den.x - tu.x;
    const dy = den.y - tu.y;
    const huong = huongCua(dx, dy);
    if (huong === null) throw new Error(`Làn ${l.id}: đoạn ${i} không đi theo 8 hướng.`);
    // Căn bậc hai được chuẩn IEEE làm tròn đúng, nên cho cùng kết quả trên mọi bộ máy JavaScript.
    const dai = dx !== 0 && dy !== 0 ? Math.round(Math.sqrt(dx * dx + dy * dy)) : Math.abs(dx) + Math.abs(dy);
    doan.push({ tu, den, huong, dai, s0: s });
    s += dai;
  }
  return {
    id: l.id,
    doan,
    dai: s,
    toc_do_toi_da: l.toc_do_toi_da,
    ...(l.danh_cho ? { danh_cho: l.danh_cho } : {}),
  };
}

/** Số bậc 45° giữa hai hướng (0 tới 4), không kể chiều quay. */
export function doLechHuong(a: Huong, b: Huong): 0 | 1 | 2 | 3 | 4 {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d) as 0 | 1 | 2 | 3 | 4;
}

/** Điểm và hướng tại quãng đường `s` (cm) trên làn; ngoài làn thì kẹp về hai đầu. */
export function viTriTrenLan(l: LanDaDung, s: number): { x: number; y: number; huong: Huong } {
  const sc = Math.max(0, Math.min(l.dai, Math.trunc(s)));
  let d = l.doan[0]!;
  for (const x of l.doan) {
    if (x.s0 > sc) break;
    d = x;
  }
  const t = sc - d.s0;
  const x = d.tu.x + Math.trunc(((d.den.x - d.tu.x) * t) / d.dai);
  const y = d.tu.y + Math.trunc(((d.den.y - d.tu.y) * t) / d.dai);
  return { x, y, huong: d.huong };
}

/**
 * Làn thẳng đi lên của một đoạn đường `soO` ô (trò 3). Ô 0 ở dưới cùng; mép dưới của đoạn ở
 * y = soO × O_CM. Xe vào từ `dauCm` bên dưới mép dưới (đoạn chạy đà ngoài khung nhìn, để người lái
 * kịp thấy biển ở ô đầu) và ra khỏi mép trên thêm một ô. Quãng đường tới ô `o` là dauCm + o × O_CM.
 */
export function lanThangDiLen(id: string, soO: number, tocDoToiDa: number, x = 0, dauCm = 0): Lan {
  return {
    id,
    diem: [
      { x, y: soO * O_CM + dauCm },
      { x, y: -O_CM },
    ],
    toc_do_toi_da: tocDoToiDa,
  };
}

/* ------------------------------------------------------------------ */
/* Đặc điểm của đường                                                  */
/* ------------------------------------------------------------------ */

export const LOAI_DAC_DIEM = [
  "truong_hoc",
  "nguoi_di_bo",
  "duong_cong_trai",
  "duong_hep_trai",
  "duong_sat_co_rao",
  "duong_sat_khong_rao",
  "cong_truong",
  "giao_lo",
  "vong_xuyen",
  "ben_xe_buyt",
] as const;
export type LoaiDacDiem = (typeof LOAI_DAC_DIEM)[number];

export const TEN_DAC_DIEM: Record<LoaiDacDiem, string> = {
  truong_hoc: "Trường học",
  nguoi_di_bo: "Chỗ người đi bộ sang đường",
  duong_cong_trai: "Chỗ ngoặt sang trái",
  duong_hep_trai: "Đường hẹp bên trái",
  duong_sat_co_rao: "Đường sắt có rào chắn",
  duong_sat_khong_rao: "Đường sắt không có rào chắn",
  cong_truong: "Công trường",
  giao_lo: "Nơi giao nhau",
  vong_xuyen: "Vòng xuyến",
  ben_xe_buyt: "Bến xe buýt",
};

/**
 * Tốc độ an toàn (mm mỗi nhịp 50 ms) khi qua từng đặc điểm; null là không cần giảm tốc. Thông số
 * mô phỏng, chỉ để hoạt cảnh chạy thử phân biệt "kịp giảm tốc" với "phanh gấp".
 * 420 mm/nhịp ≈ 30 km/h; 280 ≈ 20 km/h; 350 ≈ 25 km/h.
 */
export const TOC_DO_AN_TOAN: Record<LoaiDacDiem, number | null> = {
  truong_hoc: 420,
  nguoi_di_bo: 420,
  duong_cong_trai: 420,
  duong_hep_trai: 420,
  duong_sat_co_rao: 350,
  duong_sat_khong_rao: 280,
  cong_truong: 350,
  giao_lo: 420,
  vong_xuyen: 350,
  ben_xe_buyt: null,
};

export function laLoaiDacDiem(v: unknown): v is LoaiDacDiem {
  return typeof v === "string" && (LOAI_DAC_DIEM as readonly string[]).includes(v);
}

/** Một đặc điểm đặt trên làn: từ `s_tu` tới `s_den` (cm). */
export interface DacDiem {
  id: string;
  loai: LoaiDacDiem;
  lan: string;
  s_tu: number;
  s_den: number;
}
