/**
 * Xe do người chơi lái (mô-đun M5, phần mở rộng của GĐ-T9, docs/GAME_DESIGN.md §5.9, §2.3).
 *
 * Xe đi theo "đường ray" dựng từ các điểm mốc: mỗi đoạn giữa hai mốc theo một trong 8 hướng (dọc,
 * ngang, chéo 45°), như làn của xe tự chạy (duong.ts). Hết mốc thì xe đi thẳng theo hướng hiện tại.
 * Trò chơi (tro-choi/tu-lai-pho.ts) dựng mốc khi người chơi rẽ, chuyển làn, quay đầu; tệp này chỉ lo
 * ga, phanh và di chuyển.
 *
 * Tất định như mọi phần của M5: số nguyên, tọa độ và quãng đường tính bằng mm, tốc độ mm mỗi nhịp;
 * không dùng hàm lượng giác, Math.random, Date.now.
 */
import { BUOC_HUONG, type Huong } from "./duong.ts";

export type LoaiXeNguoiLai = "o_to" | "xe_may";
export const LOAI_XE_NGUOI_LAI: readonly LoaiXeNguoiLai[] = ["o_to", "xe_may"];

export interface ThongSoXeNguoiLai {
  /** Tốc độ tối đa của xe, mm mỗi nhịp (1.100 ≈ 79 km/h). */
  v_max: number;
  /** Tăng tốc khi giữ ga, mm/nhịp mỗi nhịp (6 ≈ 2,4 m/s²). */
  tang: number;
  /** Giảm tốc khi giữ phanh (20 ≈ 8 m/s²). */
  phanh: number;
  /** Giảm tốc khi nhả cả ga lẫn phanh (lực cản). */
  tha: number;
}

export const THONG_SO_XE_NGUOI_LAI: Readonly<Record<LoaiXeNguoiLai, ThongSoXeNguoiLai>> = {
  o_to: { v_max: 1100, tang: 6, phanh: 20, tha: 2 },
  xe_may: { v_max: 900, tang: 7, phanh: 18, tha: 2 },
};

/** Chế độ giảm chuyển động: tốc độ tối đa còn 70% (GAME_DESIGN §5.9). */
export const TY_LE_TOC_DO_GIAM = 70;

export interface DiemMm {
  x: number;
  y: number;
}

export interface XeNguoiLai {
  loai: LoaiXeNguoiLai;
  /** Đầu xe, mm. */
  x: number;
  y: number;
  huong: Huong;
  /** mm mỗi nhịp. */
  v: number;
  /** Các mốc còn phải đi; rỗng thì đi thẳng theo `huong`. */
  moc: DiemMm[];
}

/** Đổi mm/nhịp sang km/h (1 mm/nhịp = 0,072 km/h), làm tròn xuống. */
export const kmh = (v: number) => Math.floor((v * 72) / 1000);
/** Tốc độ (mm/nhịp) ứng với `k` km/h, làm tròn xuống. */
export const mmNhip = (k: number) => Math.floor((k * 1000) / 72);

/** Tốc độ tối đa của xe theo chế độ. */
export function vMaxXe(loai: LoaiXeNguoiLai, giam: boolean): number {
  const v = THONG_SO_XE_NGUOI_LAI[loai].v_max;
  return giam ? Math.floor((v * TY_LE_TOC_DO_GIAM) / 100) : v;
}

/** Tốc độ nhịp sau theo ga, phanh. Phanh thắng ga khi giữ cả hai. */
export function tocDoSau(
  loai: LoaiXeNguoiLai,
  v: number,
  dk: { ga: boolean; phanh: boolean },
  vMax: number,
): number {
  const ts = THONG_SO_XE_NGUOI_LAI[loai];
  if (dk.phanh) return Math.max(0, v - ts.phanh);
  if (dk.ga) return Math.min(vMax, v + ts.tang);
  return Math.max(0, v - ts.tha);
}

/** Hướng của đoạn (dx, dy) nếu theo 8 hướng; null khi trùng điểm hoặc lệch góc. */
export function huongDoan(dx: number, dy: number): Huong | null {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (sx === 0 && sy === 0) return null;
  if (sx !== 0 && sy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  for (let h = 0; h < 8; h++) {
    const [bx, by] = BUOC_HUONG[h as Huong];
    if (bx === sx && by === sy) return h as Huong;
  }
  return null;
}

/** √2 × 1000 và 1/√2 × 1000, làm tròn: đổi giữa độ dài đoạn chéo và độ dời theo trục. */
const CAN2 = 1414;
const NGHICH_CAN2 = 707;

/**
 * Đi `quang` mm theo các mốc rồi thẳng theo hướng cuối. Trả xe mới (không sửa xe cũ). Mốc không theo
 * 8 hướng là lỗi lập trình (ném lỗi).
 */
export function diChuyen(xe: XeNguoiLai, quang: number): XeNguoiLai {
  let { x, y, huong } = xe;
  const moc = [...xe.moc];
  let con = Math.max(0, Math.trunc(quang));
  while (con > 0 && moc.length) {
    const w = moc[0]!;
    const dx = w.x - x;
    const dy = w.y - y;
    const h = huongDoan(dx, dy);
    if (h === null) {
      if (dx === 0 && dy === 0) {
        moc.shift();
        continue;
      }
      throw new Error(`Mốc (${w.x}, ${w.y}) không theo 8 hướng từ (${x}, ${y}).`);
    }
    huong = h;
    const cheo = dx !== 0 && dy !== 0;
    const truc = Math.max(Math.abs(dx), Math.abs(dy));
    const dai = cheo ? Math.trunc((truc * CAN2) / 1000) : truc;
    if (con >= dai) {
      x = w.x;
      y = w.y;
      con -= dai;
      moc.shift();
    } else {
      const buoc = cheo ? Math.max(1, Math.trunc((con * NGHICH_CAN2) / 1000)) : con;
      const [bx, by] = BUOC_HUONG[h];
      x += bx * Math.min(buoc, truc);
      y += by * Math.min(buoc, truc);
      con = 0;
    }
  }
  if (con > 0) {
    const [bx, by] = BUOC_HUONG[huong];
    const cheo = bx !== 0 && by !== 0;
    const buoc = cheo ? Math.trunc((con * NGHICH_CAN2) / 1000) : con;
    x += bx * buoc;
    y += by * buoc;
  }
  return { ...xe, x, y, huong, moc };
}

/**
 * Quãng đường (mm) từ đầu xe tới một mốc nằm trên đường xe sẽ đi, qua các mốc hiện có rồi thẳng theo
 * hướng cuối. Dùng để hỏi "còn bao xa tới vạch". Không tới được (điểm không nằm trên đường) thì null.
 */
export function quangToi(xe: Pick<XeNguoiLai, "x" | "y" | "huong" | "moc">, p: DiemMm): number | null {
  let { x, y, huong } = xe;
  let s = 0;
  const tren = (ax: number, ay: number, bx: number, by: number): number | null => {
    // p nằm trên đoạn a→b (theo 8 hướng)?
    const h = huongDoan(bx - ax, by - ay);
    if (h === null) return null;
    const hp = p.x === ax && p.y === ay ? h : huongDoan(p.x - ax, p.y - ay);
    if (hp !== h) return null;
    const tp = Math.max(Math.abs(p.x - ax), Math.abs(p.y - ay));
    const tb = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    if (tp > tb) return null;
    const cheo = bx !== ax && by !== ay;
    return cheo ? Math.trunc((tp * CAN2) / 1000) : tp;
  };
  for (const w of xe.moc) {
    const t = tren(x, y, w.x, w.y);
    if (t !== null) return s + t;
    const h = huongDoan(w.x - x, w.y - y);
    if (h === null) continue;
    const truc = Math.max(Math.abs(w.x - x), Math.abs(w.y - y));
    s += w.x !== x && w.y !== y ? Math.trunc((truc * CAN2) / 1000) : truc;
    x = w.x;
    y = w.y;
    huong = h;
  }
  const [bx, by] = BUOC_HUONG[huong];
  if (bx !== 0 && by !== 0) return null;
  const dx = p.x - x;
  const dy = p.y - y;
  if (bx === 0 ? dx !== 0 || Math.sign(dy) !== by : dy !== 0 || Math.sign(dx) !== bx) {
    return dx === 0 && dy === 0 ? s : null;
  }
  return s + Math.abs(dx) + Math.abs(dy);
}
