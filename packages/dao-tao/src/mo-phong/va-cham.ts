/**
 * Va chạm, vết phanh và vị trí cuối (mô-đun M5, phần mở rộng của GĐ-T10 "Tái dựng hiện trường",
 * docs/GAME_DESIGN.md §5.10, §2.3).
 *
 * Khác vòng bước của mo-phong.ts (xe đi theo làn, người lái mô phỏng tự giữ khoảng cách), ở đây mỗi xe
 * đặt tự do trên sơ đồ theo TÂM xe, có hướng rời rạc (8 hướng), một mức tốc độ và một hành động từ đầu
 * tới lúc va chạm. Dùng để dựng lại diễn biến một vụ va chạm từ dựng cảnh, rồi đọc ra dấu vết: vị trí
 * cuối, vết phanh, vết trượt, điểm va chạm. Không sửa vòng bước cũ; trò 3, 5, 9, 15 chạy y như trước.
 *
 * Mô hình (thông số mô phỏng minh họa, KHÔNG phải phương pháp giám định):
 *  - Hành động: đi thẳng; phanh gấp ngay tại vị trí đặt (bánh bị hãm, để lại vết phanh); rẽ trái,
 *    rẽ phải (đi thẳng 6 m, chéo 45° 5 m, rồi đi hẳn theo hướng mới); chuyển làn trái, phải (đi thẳng
 *    3 m, chéo 45° tới khi lệch ngang một làn 3,5 m, rồi trở lại hướng cũ). Tốc độ giữ nguyên, trừ phanh.
 *  - Phanh và trượt giảm tốc theo mặt đường, tra bảng cố định GIAM_TOC_MAT_DUONG. Vết phanh dài gần
 *    bằng v² / (2a), nên xe càng nhanh vết càng dài.
 *  - Va chạm theo hộp bao thẳng trục (như mo-phong.ts; xe đi chéo dùng hộp bao ngoài của hình xoay 45°).
 *    Hai xe chạm nhau: va chạm mềm (dính), cùng lấy vận tốc chung theo khối lượng; xe bị xe kia đâm
 *    ngang (lệch 45°, 90°, 135°) xoay một bậc 45° về phía chiều chuyển động của xe kia. Sau đó hai xe
 *    trượt, giảm tốc theo mặt đường, để lại vết trượt, tới khi dừng. Xe chạm vật cố định (cột, rào,
 *    tường, cây) thì dừng ngay tại chỗ.
 *  - Mỗi cặp (xe, xe) hoặc (xe, vật) chỉ va chạm một lần.
 *
 * Tất định theo §2.3: nhịp NHIP_MS cố định, số nguyên (vị trí mm, vận tốc mm/nhịp), không lượng giác
 * (đi chéo nhân 707/1000), căn bậc hai làm tròn đúng theo IEEE. Hàm thuần.
 */
import { BUOC_HUONG, doLechHuong, type Huong } from "./duong.ts";
import { chongNhau, type HopBao } from "./mo-phong.ts";
import { KICH_THUOC_XE, type LoaiXe } from "./xe.ts";

/** Mức tốc độ người chơi chọn: chậm, vừa, nhanh, rất nhanh (km/h). */
export const MUC_TOC_DO_KMH = [20, 40, 60, 80] as const;
export type MucTocDo = 0 | 1 | 2 | 3;
/** Tốc độ (mm mỗi nhịp 50 ms) của một mức. */
export const tocDoCuaMuc = (muc: MucTocDo) => Math.round((MUC_TOC_DO_KMH[muc] * 125) / 9);

export const MAT_DUONG = ["kho", "uot", "soi"] as const;
export type MatDuong = (typeof MAT_DUONG)[number];
/**
 * Giảm tốc khi bánh bị hãm (phanh gấp, trượt sau va chạm), mm/nhịp mỗi nhịp. Bảng tra cố định, số minh
 * họa: 17 ≈ 6,8 m/s² (mặt nhựa khô), 12 ≈ 4,8 m/s² (mặt nhựa ướt), 9 ≈ 3,6 m/s² (đường sỏi, cát).
 */
export const GIAM_TOC_MAT_DUONG: Readonly<Record<MatDuong, number>> = { kho: 17, uot: 12, soi: 9 };

/** Khối lượng tương đối theo loại xe (trăm kg), chỉ dùng để chia vận tốc chung khi hai xe dính nhau. */
export const KHOI_LUONG_XE: Readonly<Record<LoaiXe, number>> = {
  o_to: 15,
  xe_tai: 60,
  xe_may: 2,
  xe_uu_tien: 20,
};

export const HANH_DONG_XE = [
  "di_thang",
  "phanh",
  "re_trai",
  "re_phai",
  "chuyen_lan_trai",
  "chuyen_lan_phai",
] as const;
export type HanhDongXe = (typeof HANH_DONG_XE)[number];

/** Mốc quãng đường (mm) đổi hướng của từng hành động, và chiều đổi ở mỗi mốc (+1 theo chiều kim đồng hồ). */
const MOC_HANH_DONG: Readonly<Record<HanhDongXe, ReadonlyArray<readonly [number, 1 | -1]>>> = {
  di_thang: [],
  phanh: [],
  re_trai: [
    [6000, -1],
    [11000, -1],
  ],
  re_phai: [
    [6000, 1],
    [11000, 1],
  ],
  // Chéo 45° đi 4.950 mm thì lệch ngang 3.500 mm, bằng một làn.
  chuyen_lan_trai: [
    [3000, -1],
    [7950, 1],
  ],
  chuyen_lan_phai: [
    [3000, 1],
    [7950, -1],
  ],
};

/** Một lần tái dựng dừng sau 30 giây mô phỏng dù xe còn chạy. */
export const NHIP_TOI_DA_VA_CHAM = 600;

/** 1/√2 nhân 1000, làm tròn. */
const CHEO = 707;

export interface DiemCm {
  x: number;
  y: number;
}

/** Một xe trong dựng cảnh: tâm xe (cm), hướng, mức tốc độ, hành động. */
export interface XeDungCanh {
  id: string;
  loai: LoaiXe;
  x: number;
  y: number;
  huong: Huong;
  muc: MucTocDo;
  hanh_dong: HanhDongXe;
}

/** Vật cố định trên sơ đồ, hộp thẳng trục (cm). */
export interface VatCoDinh {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Dựng cảnh một lần chạy. Sơ đồ từ (0, 0) tới (rong, cao), cm; trục y hướng xuống. */
export interface CanhVaCham {
  rong: number;
  cao: number;
  mat_duong: MatDuong;
  vat: readonly VatCoDinh[];
  xe: readonly XeDungCanh[];
}

/** `ra_ngoai`: tâm xe đã ra khỏi sơ đồ, không xét nữa. */
export type PhaXe = "chay" | "phanh" | "truot" | "dung" | "ra_ngoai";

export interface XeVaCham {
  id: string;
  loai: LoaiXe;
  hanh_dong: HanhDongXe;
  /** Tâm xe, mm. */
  x: number;
  y: number;
  huong: Huong;
  /** Tốc độ theo hướng xe trước va chạm, mm/nhịp. */
  v: number;
  /** Vận tốc khi trượt sau va chạm, mm/nhịp. */
  vx: number;
  vy: number;
  pha: PhaXe;
  /** Quãng đường đã đi trước va chạm, mm (để đổi hướng theo hành động). */
  quang: number;
  /** Số mốc đổi hướng đã qua. */
  moc: number;
  /** Vết đang để lại (phanh hoặc trượt) và điểm bắt đầu (cm); null khi không để vết. */
  vet: { loai: LoaiVet; tu: DiemCm } | null;
}

export type LoaiVet = "phanh" | "truot";

/** Một đoạn vết bánh (cm), theo tâm xe. */
export interface VetBanh {
  xe: string;
  loai: LoaiVet;
  tu: DiemCm;
  den: DiemCm;
}

/** Một lần va chạm: giữa hai xe (`vat` = false) hoặc giữa xe và vật cố định. Điểm va chạm là tâm vùng chồng nhau. */
export interface SuKienVaCham {
  nhip: number;
  xe: string;
  khac: string;
  vat: boolean;
  x: number;
  y: number;
  /** Tốc độ của `xe` lúc chạm, mm/nhịp. */
  v: number;
}

export interface TrangThaiVaCham {
  nhip: number;
  xe: XeVaCham[];
  vet: VetBanh[];
  va_cham: SuKienVaCham[];
  xong: boolean;
}

/** Vị trí cuối của một xe (cm). */
export interface ViTriCuoi {
  xe: string;
  x: number;
  y: number;
  huong: Huong;
  ra_ngoai: boolean;
}

/** Dấu vết đọc ra sau một lần chạy: thứ người chơi thấy trên sơ đồ hiện trường. */
export interface DauVet {
  cuoi: ViTriCuoi[];
  vet: VetBanh[];
  va_cham: Array<Omit<SuKienVaCham, "nhip" | "v">>;
}

/** Vận tốc (mm/nhịp) theo hướng rời rạc. */
export function vanTocTheoHuong(huong: Huong, v: number): [number, number] {
  const [bx, by] = BUOC_HUONG[huong];
  if (bx !== 0 && by !== 0) {
    const c = Math.trunc((v * CHEO) / 1000);
    return [bx * c, by * c];
  }
  return [bx * v, by * v];
}

/** Hộp bao (cm) của xe theo tâm, hướng và kích thước. */
export function hopBaoTam(x: number, y: number, huong: Huong, loai: LoaiXe): HopBao {
  const { dai, rong } = KICH_THUOC_XE[loai];
  const [bx, by] = BUOC_HUONG[huong];
  if (bx !== 0 && by !== 0) {
    const nua = Math.trunc(((dai + rong) * CHEO) / 2000);
    return { x1: x - nua, y1: y - nua, x2: x + nua, y2: y + nua };
  }
  const nd = Math.trunc(dai / 2);
  const nr = Math.trunc(rong / 2);
  return bx !== 0
    ? { x1: x - nd, x2: x + nd, y1: y - nr, y2: y + nr }
    : { x1: x - nr, x2: x + nr, y1: y - nd, y2: y + nd };
}

const cm = (mm: number) => Math.trunc(mm / 10);
const theoId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const hopCua = (x: XeVaCham) => hopBaoTam(cm(x.x), cm(x.y), x.huong, x.loai);

export function trangThaiDauVaCham(c: CanhVaCham): TrangThaiVaCham {
  const xe = [...c.xe].sort(theoId).map(
    (k): XeVaCham => ({
      id: k.id,
      loai: k.loai,
      hanh_dong: k.hanh_dong,
      x: k.x * 10,
      y: k.y * 10,
      huong: k.huong,
      v: tocDoCuaMuc(k.muc),
      vx: 0,
      vy: 0,
      pha: k.hanh_dong === "phanh" ? "phanh" : "chay",
      quang: 0,
      moc: 0,
      vet: k.hanh_dong === "phanh" ? { loai: "phanh", tu: { x: k.x, y: k.y } } : null,
    }),
  );
  return { nhip: 0, xe, vet: [], va_cham: [], xong: xe.length === 0 };
}

/** Vận tốc hiện tại của xe (mm/nhịp). */
function vanToc(x: XeVaCham): [number, number] {
  if (x.pha === "truot") return [x.vx, x.vy];
  if (x.pha === "chay" || x.pha === "phanh") return vanTocTheoHuong(x.huong, x.v);
  return [0, 0];
}

/** Xe bị đâm ngang xoay một bậc về phía chiều chuyển động của xe kia; đâm thẳng, đâm đuôi thì không xoay. */
function xoaySauVaCham(h: Huong, hKhac: Huong, vKhac: readonly [number, number]): Huong {
  const lech = doLechHuong(h, hKhac);
  if (lech === 0 || lech === 4) return h;
  const [bx, by] = BUOC_HUONG[h];
  const tich = bx * vKhac[1] - by * vKhac[0];
  if (tich > 0) return ((h + 1) % 8) as Huong;
  if (tich < 0) return ((h + 7) % 8) as Huong;
  return h;
}

/** Một nhịp. Trả trạng thái mới, không sửa trạng thái cũ. */
export function buocVaCham(c: CanhVaCham, tt: TrangThaiVaCham): TrangThaiVaCham {
  if (tt.xong) return tt;
  const nhip = tt.nhip + 1;
  const a = GIAM_TOC_MAT_DUONG[c.mat_duong];
  const xe = tt.xe.map((x) => ({ ...x, vet: x.vet && { loai: x.vet.loai, tu: { ...x.vet.tu } } }));
  const vet = [...tt.vet];
  const vaCham = [...tt.va_cham];

  const dongVet = (x: XeVaCham) => {
    if (!x.vet) return;
    const den = { x: cm(x.x), y: cm(x.y) };
    if (den.x !== x.vet.tu.x || den.y !== x.vet.tu.y)
      vet.push({ xe: x.id, loai: x.vet.loai, tu: x.vet.tu, den });
    x.vet = null;
  };
  const dung = (x: XeVaCham) => {
    x.v = 0;
    x.vx = 0;
    x.vy = 0;
    x.pha = "dung";
    dongVet(x);
  };

  // 1. Di chuyển.
  for (const x of xe) {
    if (x.pha === "dung" || x.pha === "ra_ngoai") continue;
    if (x.pha === "truot") {
      const m = Math.floor(Math.sqrt(x.vx * x.vx + x.vy * x.vy));
      if (m <= a) {
        dung(x);
        continue;
      }
      x.vx = Math.trunc((x.vx * (m - a)) / m);
      x.vy = Math.trunc((x.vy * (m - a)) / m);
      x.x += x.vx;
      x.y += x.vy;
    } else {
      if (x.pha === "phanh") {
        x.v = Math.max(0, x.v - a);
        if (x.v === 0) {
          dung(x);
          continue;
        }
      } else {
        const moc = MOC_HANH_DONG[x.hanh_dong][x.moc];
        if (moc && x.quang >= moc[0]) {
          x.huong = ((x.huong + moc[1] + 8) % 8) as Huong;
          x.moc++;
        }
      }
      const [dx, dy] = vanTocTheoHuong(x.huong, x.v);
      x.x += dx;
      x.y += dy;
      x.quang += x.v;
    }
    if (x.x < 0 || x.y < 0 || x.x > c.rong * 10 || x.y > c.cao * 10) {
      dongVet(x);
      x.v = 0;
      x.vx = 0;
      x.vy = 0;
      x.pha = "ra_ngoai";
    }
  }

  // 2. Va chạm giữa hai xe, xét từng cặp theo thứ tự id.
  const daCham = new Set(vaCham.map((e) => `${e.xe}|${e.khac}`));
  const tren = xe.filter((x) => x.pha !== "ra_ngoai");
  for (let i = 0; i < tren.length; i++) {
    for (let j = i + 1; j < tren.length; j++) {
      const p = tren[i]!;
      const q = tren[j]!;
      const khoa = `${p.id}|${q.id}`;
      if (daCham.has(khoa)) continue;
      const hp = hopCua(p);
      const hq = hopCua(q);
      if (!chongNhau(hp, hq)) continue;
      daCham.add(khoa);
      const vp = vanToc(p);
      const vq = vanToc(q);
      const mp = KHOI_LUONG_XE[p.loai];
      const mq = KHOI_LUONG_XE[q.loai];
      const cx = Math.trunc((mp * vp[0] + mq * vq[0]) / (mp + mq));
      const cy = Math.trunc((mp * vp[1] + mq * vq[1]) / (mp + mq));
      vaCham.push({
        nhip,
        xe: p.id,
        khac: q.id,
        vat: false,
        x: Math.trunc((Math.max(hp.x1, hq.x1) + Math.min(hp.x2, hq.x2)) / 2),
        y: Math.trunc((Math.max(hp.y1, hq.y1) + Math.min(hp.y2, hq.y2)) / 2),
        v: Math.floor(Math.sqrt(vp[0] * vp[0] + vp[1] * vp[1])),
      });
      const hMoi: [XeVaCham, Huong][] = [
        [p, xoaySauVaCham(p.huong, q.huong, vq)],
        [q, xoaySauVaCham(q.huong, p.huong, vp)],
      ];
      for (const [x, h] of hMoi) {
        dongVet(x);
        x.huong = h;
        x.v = 0;
        x.vx = cx;
        x.vy = cy;
        if (cx !== 0 || cy !== 0) {
          x.pha = "truot";
          x.vet = { loai: "truot", tu: { x: cm(x.x), y: cm(x.y) } };
        } else x.pha = "dung";
      }
    }
  }

  // 3. Va chạm với vật cố định: xe dừng ngay tại chỗ.
  for (const x of tren) {
    if (x.pha === "dung") continue;
    const h = hopCua(x);
    for (const v of c.vat) {
      const khoa = `${x.id}|${v.id}`;
      if (daCham.has(khoa) || !chongNhau(h, v)) continue;
      daCham.add(khoa);
      const [vx, vy] = vanToc(x);
      vaCham.push({
        nhip,
        xe: x.id,
        khac: v.id,
        vat: true,
        x: Math.trunc((Math.max(h.x1, v.x1) + Math.min(h.x2, v.x2)) / 2),
        y: Math.trunc((Math.max(h.y1, v.y1) + Math.min(h.y2, v.y2)) / 2),
        v: Math.floor(Math.sqrt(vx * vx + vy * vy)),
      });
      dung(x);
      break;
    }
  }

  const xong = nhip >= NHIP_TOI_DA_VA_CHAM || xe.every((x) => x.pha === "dung" || x.pha === "ra_ngoai");
  if (xong) for (const x of xe) dongVet(x);
  return { nhip, xe, vet, va_cham: vaCham, xong };
}

/** Chạy một dựng cảnh tới khi mọi xe dừng hoặc ra khỏi sơ đồ (tối đa NHIP_TOI_DA_VA_CHAM nhịp). */
export function chayVaCham(c: CanhVaCham): TrangThaiVaCham {
  let tt = trangThaiDauVaCham(c);
  while (!tt.xong) tt = buocVaCham(c, tt);
  return tt;
}

/** Dấu vết của một trạng thái (thường là trạng thái cuối). */
export function dauVetCua(tt: TrangThaiVaCham): DauVet {
  return {
    cuoi: tt.xe.map((x) => ({
      xe: x.id,
      x: cm(x.x),
      y: cm(x.y),
      huong: x.huong,
      ra_ngoai: x.pha === "ra_ngoai",
    })),
    vet: tt.vet.map((v) => ({ xe: v.xe, loai: v.loai, tu: { ...v.tu }, den: { ...v.den } })),
    va_cham: tt.va_cham.map(({ xe, khac, vat, x, y }) => ({ xe, khac, vat, x, y })),
  };
}

/** Độ dài một đoạn vết, cm. */
export const doDaiVet = (v: Pick<VetBanh, "tu" | "den">) => {
  const dx = v.den.x - v.tu.x;
  const dy = v.den.y - v.tu.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
};
