/**
 * Ranh giới (đa giác) xã, phường hiện nay: xác định một tọa độ GPS thuộc xã nào và đưa đường ranh
 * đã làm gọn để vẽ bản đồ. Hiện có tỉnh Thanh Hóa.
 *
 * Dữ liệu nằm ở data/dia-gioi/ranh-gioi.json, do scripts/ranh-gioi.ts dựng (xem data/dia-gioi/README.md).
 * Tệp này không đọc tệp: nơi gọi đọc rồi truyền vào `taoBoRanhGioi`.
 */

/** [kinh độ, vĩ độ], thứ tự của GeoJSON. */
export type Diem = [number, number];
/** Đa giác nhiều phần (MultiPolygon): phần → vòng (vòng đầu là biên ngoài, sau là lỗ) → điểm. */
export type DaGiac = Diem[][][];

export interface RanhGioiXa {
  /** Mã xã mới (5 số), trùng với `xaMoi` của dia-gioi.json. */
  ma: string;
  /** [kinh độ nhỏ nhất, vĩ độ nhỏ nhất, kinh độ lớn nhất, vĩ độ lớn nhất]. */
  bbox: [number, number, number, number];
  vung: DaGiac;
}

export interface DuLieuRanhGioi {
  /** Ngày dựng tệp (YYYY-MM-DD). */
  phienBan: string;
  nguon: Array<{ ten: string; url: string; giayPhep: string; ghiChu: string }>;
  /** Mã các tỉnh có ranh giới trong tệp. */
  tinh: string[];
  xa: RanhGioiXa[];
}

export interface ViTriXa {
  ma: string;
  /**
   * Điểm không nằm trong đa giác xã nào (khe hở giữa các ranh, ven biển) nên lấy xã có ranh gần
   * nhất, cách không quá `GAN_RANH_M`.
   */
  ganRanh: boolean;
}

export interface BoRanhGioi {
  phienBan: string;
  nguon: DuLieuRanhGioi["nguon"];
  tinh: string[];
  /** Xã chứa tọa độ; null khi nằm ngoài vùng có ranh giới. */
  timXa(lat: number, lon: number): ViTriXa | null;
  /** Ranh giới xã đã làm gọn (lệch tối đa khoảng 10 m) để vẽ bản đồ. */
  hinhXa(ma: string): DaGiac | null;
}

/** Khoảng cách tối đa từ điểm tới ranh xã gần nhất khi điểm không nằm trong xã nào. */
export const GAN_RANH_M = 200;
/** Độ lệch khi làm gọn ranh để vẽ: 0,0001° ≈ 11 m. */
const LAM_GON_VE = 0.0001;

const M_MOT_DO_VI = 110_574;
const M_MOT_DO_KINH = 111_320;

/* ------------------------------------------------------------------ */
/* Hình học                                                            */
/* ------------------------------------------------------------------ */

/** Tia ngang từ điểm cắt cạnh vòng một số lẻ lần thì điểm nằm trong vòng. */
function trongVong(x: number, y: number, vong: Diem[]): boolean {
  let trong = false;
  for (let i = 0, j = vong.length - 1; i < vong.length; j = i++) {
    const [xi, yi] = vong[i]!;
    const [xj, yj] = vong[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) trong = !trong;
  }
  return trong;
}

export function trongDaGiac(lon: number, lat: number, vung: DaGiac): boolean {
  return vung.some(
    ([ngoai, ...lo]) => !!ngoai && trongVong(lon, lat, ngoai) && !lo.some((l) => trongVong(lon, lat, l)),
  );
}

/** Khoảng cách (mét) từ điểm tới ranh gần nhất, tính phẳng quanh điểm (đủ đúng trong vài km). */
export function khoangCachToiRanh(lon: number, lat: number, vung: DaGiac): number {
  const kx = M_MOT_DO_KINH * Math.cos((lat * Math.PI) / 180);
  let min = Number.POSITIVE_INFINITY;
  for (const phan of vung)
    for (const vong of phan)
      for (let i = 1; i < vong.length; i++) {
        const ax = (vong[i - 1]![0] - lon) * kx;
        const ay = (vong[i - 1]![1] - lat) * M_MOT_DO_VI;
        const bx = (vong[i]![0] - lon) * kx;
        const by = (vong[i]![1] - lat) * M_MOT_DO_VI;
        const dx = bx - ax;
        const dy = by - ay;
        const l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
        min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
      }
  return min;
}

/**
 * Làm gọn một vòng (Douglas–Peucker): bỏ các điểm lệch khỏi đường nối không quá `doLech` độ. Vòng
 * còn dưới 4 điểm (không còn là đa giác) thì giữ nguyên.
 */
export function lamGonVong(vong: Diem[], doLech: number): Diem[] {
  if (vong.length <= 4) return vong;
  const giu = new Uint8Array(vong.length);
  giu[0] = 1;
  giu[vong.length - 1] = 1;
  const ngan: Array<[number, number]> = [[0, vong.length - 1]];
  while (ngan.length) {
    const [a, b] = ngan.pop()!;
    const [ax, ay] = vong[a]!;
    const [bx, by] = vong[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let xa = -1;
    let iXa = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = vong[i]!;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const d = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2;
      if (d > xa) {
        xa = d;
        iXa = i;
      }
    }
    if (xa > doLech * doLech) {
      giu[iXa] = 1;
      ngan.push([a, iXa], [iXa, b]);
    }
  }
  const kq = vong.filter((_, i) => giu[i]);
  return kq.length >= 4 ? kq : vong;
}

export const lamGonDaGiac = (vung: DaGiac, doLech: number): DaGiac =>
  vung.map((phan) => phan.map((vong) => lamGonVong(vong, doLech)));

/* ------------------------------------------------------------------ */
/* Tra cứu                                                             */
/* ------------------------------------------------------------------ */

export function taoBoRanhGioi(d: DuLieuRanhGioi): BoRanhGioi {
  const theoMa = new Map(d.xa.map((x) => [x.ma, x]));
  const daLamGon = new Map<string, DaGiac>();
  const trongHop = (x: RanhGioiXa, lon: number, lat: number, du = 0) =>
    lon >= x.bbox[0] - du && lon <= x.bbox[2] + du && lat >= x.bbox[1] - du && lat <= x.bbox[3] + du;

  return {
    phienBan: d.phienBan,
    nguon: d.nguon,
    tinh: d.tinh,

    timXa(lat, lon) {
      const trong = d.xa.find((x) => trongHop(x, lon, lat) && trongDaGiac(lon, lat, x.vung));
      if (trong) return { ma: trong.ma, ganRanh: false };
      // Hộp bao nới thêm GAN_RANH_M (theo độ, lấy rộng) để chỉ đo khoảng cách tới các xã quanh điểm.
      const du = GAN_RANH_M / (M_MOT_DO_KINH * Math.cos((lat * Math.PI) / 180));
      let gan: { ma: string; m: number } | null = null;
      for (const x of d.xa) {
        if (!trongHop(x, lon, lat, du)) continue;
        const m = khoangCachToiRanh(lon, lat, x.vung);
        if (m <= GAN_RANH_M && (!gan || m < gan.m)) gan = { ma: x.ma, m };
      }
      return gan ? { ma: gan.ma, ganRanh: true } : null;
    },

    hinhXa(ma) {
      const x = theoMa.get(ma);
      if (!x) return null;
      let h = daLamGon.get(ma);
      if (!h) {
        h = lamGonDaGiac(x.vung, LAM_GON_VE);
        daLamGon.set(ma, h);
      }
      return h;
    },
  };
}
