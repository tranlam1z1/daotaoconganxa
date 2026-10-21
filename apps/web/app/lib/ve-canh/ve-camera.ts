/**
 * Vẽ cảnh qua camera giao thông (mô-đun M6, mở rộng ở GĐ-T5): phép chiếu nhìn chéo của M5
 * (mo-phong/camera.ts) áp thẳng lên Canvas, xe theo kích thước thật, người đi xe máy có hoặc không đội
 * mũ bảo hiểm, hình xe nhìn chéo (thấy mặt xe hướng về camera), đèn xe, khung tô xe, đầu đèn tín hiệu, lớp nhiễu nhẹ.
 *
 * Khung vẽ (CanhTrenXuong) dùng hệ "đơn vị camera": khung rộng 1000, cao `cam.cao`. Các hàm ở đây nhận
 * phép biến đổi đơn vị camera → px (`bd`) và tự ghép phép chiếu bản đồ → đơn vị camera.
 */
import type { Camera, Hop } from "../../../../../packages/dao-tao/src/mo-phong/camera.ts";
import type { MauDen } from "../../../../../packages/dao-tao/src/mo-phong/den.ts";
import { kichThuocXe, type Xe } from "../../../../../packages/dao-tao/src/mo-phong/xe.ts";
import {
  type KieuXeCamera,
  THONG_TIN_KIEU_XE,
} from "../../../../../packages/dao-tao/src/tro-choi/soi-camera.ts";
import { type BienDoi, noiSuy } from "./bien-doi";

/** Ghép phép chiếu camera vào ctx: từ đây vẽ theo tọa độ bản đồ (cm). Gọi trong save/restore. */
export function apCamera(ctx: CanvasRenderingContext2D, bd: BienDoi, cam: Camera) {
  ctx.transform(
    (bd.tx * cam.a) / 1000,
    (bd.ty * cam.c) / 1000,
    (bd.tx * cam.b) / 1000,
    (bd.ty * cam.d) / 1000,
    bd.tx * cam.cx,
    bd.ty * cam.cy,
  );
}

/** Điểm bản đồ → px (không làm tròn, chỉ để vẽ). */
export function raPx(bd: BienDoi, cam: Camera, x: number, y: number): [number, number] {
  return [
    bd.tx * (cam.cx + (cam.a * x + cam.b * y) / 1000),
    bd.ty * (cam.cy + (cam.c * x + cam.d * y) / 1000),
  ];
}

/* ------------------------------------------------------------------ */
/* Hình xe                                                             */
/* ------------------------------------------------------------------ */

/*
 * Camera đặt ở phía dưới khung, nhìn chéo về phía trên: mỗi xe hiện nóc xe và MẶT XE HƯỚNG VỀ CAMERA
 * (mép dưới của xe trên màn hình). Xe đi lên thấy đuôi xe (đèn hậu, đèn phanh, biển số); xe đi xuống
 * thấy đầu xe (đèn pha, kính chắn gió, lưới tản nhiệt). Toàn bộ hình vẽ nằm gọn trong hình bao của xe
 * (hopXe) để khung tô và vùng chạm khớp với cái người chơi nhìn thấy.
 *
 * Hình vector dưới đây chỉ dùng cho xe ưu tiên và khi ảnh xe (mục "Ảnh xe") chưa tải xong. Màu xe,
 * màu áo, màu mũ lấy theo id xe (cố định suốt phim). Mũ bảo hiểm chỉ dùng màu sáng, có vệt bóng, để
 * không lẫn với tóc đen.
 */

const MAU_O_TO = ["#f1f1ec", "#b9c0c8", "#c0392b", "#2459a6", "#3f6b4f", "#d8a13a"] as const;
const MAU_CABIN = ["#2459a6", "#c0392b", "#e9e7e1", "#2f7d4f"] as const;
const MAU_THUNG = ["#6f8a6a", "#b8bcc2", "#3d5a80"] as const;
const MAU_XE_MAY = ["#c62828", "#1d2733", "#1e5aa8", "#e6e4de", "#7b3fa0", "#2e7d32"] as const;
const MAU_AO = ["#2f6db5", "#e8e8e2", "#c94f3d", "#3d8b5a", "#e0a526", "#5c4a8a", "#37474f"] as const;
const MAU_MU = ["#e53935", "#fafafa", "#fdd835", "#1e88e5", "#43a047", "#ec407a"] as const;
const MAU_DA = "#d9a57a";
const MAU_TOC = "#2a1d16";
const MAU_CAN = "#25282c";
const MAU_BIEN_TRANG = "#f4f4f0";
const MAU_BIEN_VANG = "#f2c230";

function bam(s: string, muoi: number): number {
  let h = 2166136261 ^ muoi;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const chiSo = (id: string, n: number, muoi = 0) => bam(id, muoi) % n;

/** Pha màu "#rrggbb" về trắng (k > 0) hoặc về đen (k < 0). */
function pha(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const kenh = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)),
  );
  return `#${kenh.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------------ */
/* Ảnh xe                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ảnh xe nhìn qua camera: WebP trong app/assets/tro-choi/soi-camera/, tên `<kiểu>-ngay`, `<kiểu>-dem`
 * (kiểu viết gạch nối: `o-to-con`, `xe-buyt`, `xe-may-mu`…) và `den-tin-hieu`. Ảnh ô tô, xe tải thấy
 * đầu xe ở mép dưới (xe đi xuống); ảnh xe máy thấy lưng người lái, đuôi xe ở mép dưới (xe đi lên).
 * Màu xe cố định theo ảnh. Ảnh được kéo vừa hình bao của xe, nên khung tô và vùng chạm vẫn khớp.
 * Ảnh chưa tải xong (hoặc xe ưu tiên, chưa có ảnh) thì vẽ bằng hình vector bên dưới.
 */
const ANH = import.meta.glob<string>("../../assets/tro-choi/soi-camera/*.webp", {
  eager: true,
  import: "default",
});
const anhDaTao = new Map<string, HTMLImageElement>();

function taoAnh(ten: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let a = anhDaTao.get(ten);
  if (!a) {
    const url = ANH[`../../assets/tro-choi/soi-camera/${ten}.webp`];
    if (!url) return null;
    a = new Image();
    a.decoding = "async";
    a.src = url;
    anhDaTao.set(ten, a);
  }
  return a;
}

function anh(ten: string): HTMLImageElement | null {
  const a = taoAnh(ten);
  return a?.complete && a.naturalWidth ? a : null;
}

/** Tải trước mọi ảnh của trò; xong thì gọi lại để khung vẽ vẽ lại (khi phim đang dừng). */
export function taiTruocAnhCamera(xong: () => void): void {
  const ds = Object.keys(ANH)
    .map((k) => taoAnh(k.slice(k.lastIndexOf("/") + 1, -".webp".length)))
    .filter((a): a is HTMLImageElement => a !== null);
  void Promise.allSettled(ds.map((a) => a.decode())).then(xong);
}

/** Tên ảnh (không có hậu tố ngày/đêm) của một xe; null khi chưa có ảnh (xe ưu tiên). */
function tenAnhXe(
  xe: Pick<Xe, "loai" | "mu_bao_hiem">,
  kieu: KieuXeCamera | null | undefined,
): string | null {
  if (xe.loai === "xe_may") return xe.mu_bao_hiem ? "xe-may-mu" : "xe-may-khong-mu";
  if (xe.loai === "xe_uu_tien") return null;
  return (kieu ?? (xe.loai === "o_to" ? "o_to_con" : "xe_tai")).replaceAll("_", "-");
}

/** Màu xe theo ảnh, để mô tả cho trình đọc màn hình khớp với hình. */
const MAU_ANH: Record<KieuXeCamera, string> = {
  o_to_con: "trắng",
  o_to_lon: "đỏ",
  taxi: "vàng",
  ban_tai: "xanh lá",
  xe_tai_nho: "xanh dương",
  xe_tai: "trắng",
  xe_buyt: "xanh lá",
  xe_khach: "trắng",
};

/** Mô tả ngắn theo ảnh, để đọc cho trình đọc màn hình và nút chọn xe: "taxi vàng", "xe máy đỏ". */
export function moTaXeCamera(
  xe: Pick<Xe, "loai">,
  kieu: KieuXeCamera | null | undefined,
  banDem: boolean,
): string {
  if (xe.loai === "xe_uu_tien") return "xe cứu thương";
  if (xe.loai === "xe_may") return "xe máy đỏ";
  const k = kieu ?? (xe.loai === "o_to" ? "o_to_con" : "xe_tai");
  // Ảnh ban đêm của ô tô con màu xám sẫm.
  return `${THONG_TIN_KIEU_XE[k].ten} ${k === "o_to_con" && banDem ? "xám" : MAU_ANH[k]}`;
}

type Ctx = CanvasRenderingContext2D;

interface CanhXe {
  /** Bề rộng, chiều dài (cm). Hình xe nằm trong [-w/2, w/2] × [0, L]. */
  w: number;
  L: number;
  /** Đầu xe ở mép dưới (xe đi xuống, thấy mặt trước); ngược lại thấy mặt sau. */
  tien: boolean;
  dem: boolean;
  /** Đang phanh hoặc đứng yên: đèn phanh sáng. */
  phanh: boolean;
  /** Pha nhấp nháy (đèn khẩn cấp, đèn ưu tiên). */
  nhay: boolean;
  khanCap: boolean;
}

/** Dải ngang từ t0·L tới t1·L, thụt vào hai bên `le`·w. */
function dai(ctx: Ctx, c: CanhXe, t0: number, t1: number, mau: string, le = 0, r: number | number[] = 0) {
  ctx.fillStyle = mau;
  ctx.beginPath();
  ctx.roundRect(-c.w / 2 + c.w * le, c.L * t0, c.w * (1 - 2 * le), c.L * (t1 - t0), r);
  ctx.fill();
}

/** Kính hình thang (hẹp ở `leTren`, rộng ở `leDuoi`). */
function kinh(ctx: Ctx, c: CanhXe, t0: number, t1: number, leTren: number, leDuoi: number) {
  const { w, L } = c;
  ctx.fillStyle = c.dem ? "#0e1217" : "#28323d";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + w * leTren, L * t0);
  ctx.lineTo(w / 2 - w * leTren, L * t0);
  ctx.lineTo(w / 2 - w * leDuoi, L * t1);
  ctx.lineTo(-w / 2 + w * leDuoi, L * t1);
  ctx.closePath();
  ctx.fill();
  // Vệt phản chiếu.
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(-w / 2 + w * Math.max(leTren, leDuoi) + 8, L * t0 + 4, w * 0.28, L * (t1 - t0) * 0.35);
}

/** Cặp đèn ở hai góc, cao t0..t1, rộng `rong`·w. */
function capDen(ctx: Ctx, c: CanhXe, t0: number, t1: number, rong: number, mau: string, le = 0.04) {
  const { w, L } = c;
  ctx.fillStyle = mau;
  ctx.fillRect(-w / 2 + w * le, L * t0, w * rong, L * (t1 - t0));
  ctx.fillRect(w / 2 - w * le - w * rong, L * t0, w * rong, L * (t1 - t0));
}

function bienSo(ctx: Ctx, c: CanhXe, t0: number, t1: number, mau: string, rong = 0.3) {
  ctx.fillStyle = mau;
  ctx.fillRect((-c.w * rong) / 2, c.L * t0, c.w * rong, c.L * (t1 - t0));
}

const denHau = (c: CanhXe) => (c.phanh ? "#ff2d2d" : c.dem ? "#c62020" : "#8e1c1c");
const denPha = (c: CanhXe) => (c.dem ? "#fff7d6" : "#e9e6da");

/** Mặt sau: đèn hậu (sáng khi phanh), biển số, cản. */
function matSau(ctx: Ctx, c: CanhXe, t0: number, than: string, bien: string) {
  dai(ctx, c, t0, 1, than, 0, [0, 0, 40, 40]);
  const h = 1 - t0;
  capDen(ctx, c, t0 + h * 0.15, t0 + h * 0.45, 0.2, denHau(c));
  bienSo(ctx, c, t0 + h * 0.45, t0 + h * 0.75, bien);
  dai(ctx, c, 1 - h * 0.18, 1, MAU_CAN, 0.02, [0, 0, 30, 30]);
}

/** Mặt trước: đèn pha, lưới tản nhiệt, biển số, cản. */
function matTruoc(ctx: Ctx, c: CanhXe, t0: number, than: string, bien: string) {
  dai(ctx, c, t0, 1, than, 0, [0, 0, 40, 40]);
  const h = 1 - t0;
  capDen(ctx, c, t0 + h * 0.12, t0 + h * 0.42, 0.22, denPha(c));
  dai(ctx, c, t0 + h * 0.15, t0 + h * 0.42, "#1b1e22", 0.32, 6);
  bienSo(ctx, c, t0 + h * 0.48, t0 + h * 0.76, bien);
  dai(ctx, c, 1 - h * 0.18, 1, MAU_CAN, 0.02, [0, 0, 30, 30]);
}

/** Đèn hậu nhỏ ở mép trên (xe đi xuống: đuôi xe ở xa camera). */
function denHauXa(ctx: Ctx, c: CanhXe) {
  capDen(ctx, c, 0, 0.035, 0.18, denHau(c), 0.06);
}

function guong(ctx: Ctx, c: CanhXe, t: number, mau: string, to = 1) {
  const { w, L } = c;
  ctx.fillStyle = mau;
  ctx.fillRect(-w / 2 - 22 * to, L * t, 24 * to, L * 0.05);
  ctx.fillRect(w / 2 - 2 * to, L * t, 24 * to, L * 0.05);
}

function veOTo(ctx: Ctx, c: CanhXe, goc: string) {
  const than = c.dem ? pha(goc, -0.45) : goc;
  const sang = pha(than, 0.14);
  const toi = pha(than, -0.3);
  dai(ctx, c, 0, 1, than, 0, 45);
  if (!c.tien) {
    guong(ctx, c, 0.27, toi);
    dai(ctx, c, 0.03, 0.22, sang, 0.1, 30); // capô
    kinh(ctx, c, 0.23, 0.36, 0.17, 0.1); // kính chắn gió (nhìn từ sau, chỉ thấy mép)
    dai(ctx, c, 0.37, 0.6, sang, 0.12, 25); // nóc
    kinh(ctx, c, 0.61, 0.72, 0.12, 0.1); // kính sau
    matSau(ctx, c, 0.74, toi, MAU_BIEN_TRANG);
  } else {
    denHauXa(ctx, c);
    dai(ctx, c, 0.05, 0.13, sang, 0.1, 20); // cốp
    kinh(ctx, c, 0.14, 0.23, 0.13, 0.11); // kính sau
    dai(ctx, c, 0.24, 0.45, sang, 0.12, 25); // nóc
    guong(ctx, c, 0.55, toi);
    kinh(ctx, c, 0.46, 0.63, 0.12, 0.06); // kính chắn gió
    dai(ctx, c, 0.64, 0.74, sang, 0.08, 15); // capô
    matTruoc(ctx, c, 0.75, toi, MAU_BIEN_TRANG);
  }
}

function veXeTai(ctx: Ctx, c: CanhXe, gocCabin: string, gocThung: string) {
  const cabin = c.dem ? pha(gocCabin, -0.45) : gocCabin;
  const thung = c.dem ? pha(gocThung, -0.45) : gocThung;
  const gan = pha(thung, -0.18);
  const veThung = (t0: number, t1: number) => {
    dai(ctx, c, t0, t1, thung, 0, 14);
    // Gân thùng.
    for (let t = t0 + 0.08; t < t1 - 0.04; t += 0.09) dai(ctx, c, t, t + 0.012, gan, 0.03);
  };
  if (!c.tien) {
    dai(ctx, c, 0, 0.22, cabin, 0.05, [40, 40, 10, 10]);
    dai(ctx, c, 0.03, 0.19, pha(cabin, 0.14), 0.1, 20); // nóc cabin
    guong(ctx, c, 0.1, MAU_CAN, 1.4);
    dai(ctx, c, 0.22, 0.25, MAU_CAN, 0.2);
    veThung(0.25, 0.85);
    dai(ctx, c, 0.85, 1, pha(thung, -0.3), 0, [0, 0, 20, 20]);
    dai(ctx, c, 0.86, 0.95, "rgba(0,0,0,0.35)", 0.495); // khe cửa thùng
    capDen(ctx, c, 0.88, 0.93, 0.14, denHau(c));
    bienSo(ctx, c, 0.92, 0.97, MAU_BIEN_VANG, 0.26);
    dai(ctx, c, 0.97, 1, MAU_CAN, 0.02);
  } else {
    capDen(ctx, c, 0, 0.025, 0.14, denHau(c), 0.05);
    veThung(0.02, 0.58);
    dai(ctx, c, 0.58, 0.61, MAU_CAN, 0.2);
    dai(ctx, c, 0.61, 1, cabin, 0.03, [30, 30, 30, 30]);
    dai(ctx, c, 0.62, 0.72, pha(cabin, 0.14), 0.08, 20); // nóc cabin
    guong(ctx, c, 0.74, MAU_CAN, 1.4);
    kinh(ctx, c, 0.72, 0.85, 0.08, 0.05);
    matTruoc(ctx, c, 0.86, pha(cabin, -0.3), MAU_BIEN_VANG);
  }
}

function veCuuThuong(ctx: Ctx, c: CanhXe) {
  const than = c.dem ? "#9a9c9e" : "#f4f4f0";
  const sang = c.dem ? "#a9abad" : "#ffffff";
  const vien = c.dem ? "#8a8c8e" : "#dcdcd6";
  const do_ = c.dem ? "#a12424" : "#d32f2f";
  dai(ctx, c, 0, 1, vien, 0, 40);
  const chuThap = (tam: number) => {
    ctx.fillStyle = do_;
    ctx.fillRect(-40, c.L * tam - 25, 80, 50);
    ctx.fillRect(-11, c.L * tam - 90, 22, 180);
  };
  const denUuTien = (t0: number, t1: number) => {
    dai(ctx, c, t0, t1, "#2a2d31", 0.18, 8);
    const { w, L } = c;
    const x0 = -w / 2 + w * 0.2;
    const nua = w * 0.3;
    ctx.fillStyle = c.nhay ? "#ff3030" : "#6e1818";
    ctx.fillRect(x0, L * t0 + 4, nua, L * (t1 - t0) - 8);
    ctx.fillStyle = c.nhay ? "#1d3f7a" : "#2f8bff";
    ctx.fillRect(x0 + nua, L * t0 + 4, nua, L * (t1 - t0) - 8);
    // Quầng sáng phía đang bật.
    const gx = c.nhay ? x0 + nua / 2 : x0 + nua * 1.5;
    const gy = (L * (t0 + t1)) / 2;
    const q = ctx.createRadialGradient(gx, gy, 0, gx, gy, 220);
    const mau = c.nhay ? "255,48,48" : "47,139,255";
    q.addColorStop(0, `rgba(${mau},${c.dem ? 0.65 : 0.28})`);
    q.addColorStop(1, `rgba(${mau},0)`);
    ctx.fillStyle = q;
    ctx.fillRect(gx - 220, gy - 220, 440, 440);
  };
  if (!c.tien) {
    dai(ctx, c, 0.03, 0.14, vien, 0.1, 20);
    kinh(ctx, c, 0.15, 0.25, 0.14, 0.09);
    dai(ctx, c, 0.31, 0.77, sang, 0.08, 20);
    chuThap(0.54);
    denUuTien(0.25, 0.31);
    dai(ctx, c, 0.78, 1, than, 0, [0, 0, 40, 40]);
    dai(ctx, c, 0.81, 0.85, do_, 0); // sọc đỏ
    dai(ctx, c, 0.79, 0.95, "rgba(0,0,0,0.3)", 0.495); // khe cửa sau
    capDen(ctx, c, 0.86, 0.92, 0.16, denHau(c));
    bienSo(ctx, c, 0.9, 0.95, MAU_BIEN_TRANG, 0.26);
    dai(ctx, c, 0.96, 1, MAU_CAN, 0.02, [0, 0, 30, 30]);
  } else {
    denHauXa(ctx, c);
    dai(ctx, c, 0.05, 0.5, sang, 0.08, 20);
    chuThap(0.28);
    denUuTien(0.5, 0.56);
    kinh(ctx, c, 0.56, 0.7, 0.1, 0.06);
    dai(ctx, c, 0.71, 0.78, vien, 0.08, 12);
    dai(ctx, c, 0.79, 0.83, do_, 0);
    matTruoc(ctx, c, 0.83, than, MAU_BIEN_TRANG);
  }
}

/** Xe máy và thân người lái; đầu người lái vẽ riêng theo px (veDau). */
function veXeMay(ctx: Ctx, c: CanhXe, goc: string, gocAo: string) {
  const { w, L } = c;
  const xe = c.dem ? pha(goc, -0.4) : goc;
  const ao = c.dem ? pha(gocAo, -0.4) : gocAo;
  const banh = "#15171a";
  // Bánh trước, bánh sau.
  ctx.fillStyle = banh;
  ctx.beginPath();
  ctx.roundRect(-11, 0, 22, L * 0.24, 10);
  ctx.roundRect(-11, L * 0.76, 22, L * 0.24, 10);
  ctx.fill();
  // Thân xe.
  dai(ctx, c, 0.16, 0.86, xe, 0.27, 16);
  const tLai = c.tien ? 0.74 : 0.26; // tay lái ở phía đầu xe
  const tVai = c.tien ? 0.54 : 0.46;
  // Tay lái và gương.
  dai(ctx, c, tLai - 0.02, tLai + 0.02, MAU_CAN, 0.02);
  ctx.fillStyle = MAU_CAN;
  ctx.fillRect(-w / 2 - 4, L * (tLai - 0.07), 10, L * 0.06);
  ctx.fillRect(w / 2 - 6, L * (tLai - 0.07), 10, L * 0.06);
  // Tay người lái.
  ctx.fillStyle = ao;
  ctx.fillRect(-w / 2 + 2, L * Math.min(tLai, tVai), 14, L * Math.abs(tVai - tLai));
  ctx.fillRect(w / 2 - 16, L * Math.min(tLai, tVai), 14, L * Math.abs(tVai - tLai));
  // Vai và lưng.
  ctx.beginPath();
  ctx.ellipse(0, L * tVai, w * 0.56, L * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(0, L * (tVai + (c.tien ? -0.05 : 0.05)), w * 0.4, L * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  if (c.tien) {
    // Đèn pha đầu xe, đèn hậu đuôi xe.
    dai(ctx, c, 0.93, 1, denPha(c), 0.32, 8);
    dai(ctx, c, 0, 0.05, denHau(c), 0.36, 6);
  } else {
    dai(ctx, c, 0.86, 0.93, denHau(c), 0.3, 6);
    dai(ctx, c, 0.93, 0.99, MAU_BIEN_TRANG, 0.32, 2);
  }
}

/** Đầu người lái xe máy (px): mũ bảo hiểm màu sáng có vệt bóng, hoặc đầu trần (tóc sẫm, da). */
function veDau(
  ctx: Ctx,
  px: number,
  py: number,
  r: number,
  mu: boolean,
  mauMu: string,
  c: CanhXe,
  kieu: number,
) {
  const tron = (x: number, y: number, rr: number) => {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
  };
  const da = c.dem ? pha(MAU_DA, -0.25) : MAU_DA;
  ctx.lineWidth = 1.2;
  if (mu) {
    const R = r * 1.12;
    tron(px, py, R);
    ctx.fillStyle = c.dem ? pha(mauMu, -0.2) : mauMu;
    ctx.fill();
    ctx.strokeStyle = "#15181c";
    ctx.stroke();
    if (c.tien) {
      // Nhìn từ phía trước: mũ nửa đầu lộ mặt, mũ có kính che thấy kính sẫm.
      ctx.beginPath();
      ctx.ellipse(px, py + R * 0.42, R * 0.62, R * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = kieu === 0 ? "#1f2a33" : da;
      ctx.fill();
    } else {
      // Nhìn từ phía sau: gờ mũ.
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(px - R * 0.62, py + R * 0.45, R * 1.24, R * 0.22);
    }
    tron(px - R * 0.36, py - R * 0.4, R * 0.26);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fill();
  } else {
    const R = r * 0.95;
    ctx.save();
    tron(px, py, R);
    ctx.fillStyle = da;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = MAU_TOC;
    if (c.tien) {
      // Thấy mặt: tóc phủ nửa trên.
      ctx.fillRect(px - R, py - R, R * 2, R * 0.85);
    } else {
      // Thấy gáy: gần hết là tóc, lộ cổ và tai.
      tron(px, py - R * 0.32, R * 1.02);
      ctx.fill();
    }
    ctx.restore();
    tron(px, py, R);
    ctx.strokeStyle = "#3b2a20";
    ctx.stroke();
  }
}

/**
 * Vẽ xe (nội suy giữa hai nhịp). `nhip` dùng cho đèn nhấp nháy; cùng nhịp thì hình đứng yên. `kieu`:
 * kiểu xe theo id (kịch bản Soi camera); xe không có trong đó dùng kiểu mặc định của loại xe.
 */
export function veXeCamera(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  cam: Camera,
  truoc: readonly Xe[],
  sau: readonly Xe[],
  alpha: number,
  banDem: boolean,
  nhip = 0,
  kieu: ReadonlyMap<string, KieuXeCamera> = new Map(),
) {
  const cu = new Map(truoc.map((x) => [x.id, x]));
  const rDau = Math.max(3.5, Math.min(7, bd.tx * 11));
  // Xe xa (y nhỏ) vẽ trước để xe gần camera che lên.
  const dsXe = sau
    .filter((x) => x.trang_thai !== "cho" && x.trang_thai !== "da_qua")
    .map((x) => {
      const a = cu.get(x.id);
      const dung = a && a.trang_thai !== "cho" && a.lan === x.lan;
      return {
        x,
        a,
        X: dung ? noiSuy(a.x, x.x, alpha) : x.x,
        Y: dung ? noiSuy(a.y, x.y, alpha) : x.y,
        goc: (x.huong * Math.PI) / 4,
      };
    })
    .sort((p, q) => p.Y - q.Y);

  // Quầng đèn pha phía trước (ban đêm), vẽ hết trước để không đè lên xe khác.
  if (banDem)
    for (const { x, X, Y, goc } of dsXe) {
      const w = kichThuocXe(x).rong;
      ctx.save();
      apCamera(ctx, bd, cam);
      ctx.translate(X, Y);
      ctx.rotate(goc);
      const q = ctx.createLinearGradient(0, 0, 0, -1000);
      q.addColorStop(0, "rgba(255, 236, 170, 0.42)");
      q.addColorStop(1, "rgba(255, 236, 170, 0)");
      ctx.fillStyle = q;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w * 1.1, -1000);
      ctx.lineTo(w * 1.1, -1000);
      ctx.lineTo(w / 2, 0);
      ctx.fill();
      ctx.restore();
    }

  for (const { x, a, X, Y, goc } of dsXe) {
    const { dai: L, rong: w } = kichThuocXe(x);
    const tien = x.huong === 4;
    const tenAnh = tenAnhXe(x, kieu.get(x.id));
    const hinh = tenAnh ? anh(`${tenAnh}-${banDem ? "dem" : "ngay"}`) : null;
    const c: CanhXe = {
      w,
      L,
      tien,
      dem: banDem,
      phanh: (!!a && x.v < a.v) || x.v === 0,
      nhay: Math.floor(nhip / 6) % 2 === 0,
      khanCap: x.dang_dung_kb && x.loai !== "xe_may",
    };

    ctx.save();
    apCamera(ctx, bd, cam);
    // Gốc hình: góc trên của hình bao. Xe đi xuống: đầu xe ở mép dưới.
    ctx.translate(X, tien ? Y - L : Y);
    if (!tien) ctx.rotate(goc);
    // Bóng đổ (ban ngày) hoặc viền sáng (ban đêm) để xe tách khỏi mặt đường.
    ctx.fillStyle = banDem ? "rgba(232, 236, 240, 0.35)" : "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    if (banDem) ctx.roundRect(-w / 2 - 14, -40, w + 28, L + 80, 50);
    else ctx.roundRect(-w / 2 + 18, 40, w + 6, L + 10, 45);
    ctx.fill();

    if (hinh) {
      // Ảnh ô tô, xe tải có đầu xe ở mép dưới, ảnh xe máy có đuôi xe ở mép dưới; trong hình bao, đầu
      // xe ở mép dưới khi xe đi xuống (tien). Khác nhau thì xoay ảnh 180°.
      const dauODuoi = x.loai !== "xe_may";
      ctx.save();
      if (dauODuoi !== tien) {
        ctx.translate(0, L);
        ctx.rotate(Math.PI);
      }
      ctx.drawImage(hinh, -w / 2, 0, w, L);
      ctx.restore();
      // Đèn phanh ở đuôi xe (ảnh ô tô không vẽ sẵn đèn hậu sáng).
      if (dauODuoi && c.phanh) capDen(ctx, c, tien ? 0.01 : 0.955, tien ? 0.045 : 0.99, 0.18, "#ff2d2d", 0.1);
    } else if (x.loai === "o_to") veOTo(ctx, c, MAU_O_TO[chiSo(x.id, MAU_O_TO.length)]!);
    else if (x.loai === "xe_tai")
      veXeTai(
        ctx,
        c,
        MAU_CABIN[chiSo(x.id, MAU_CABIN.length)]!,
        MAU_THUNG[chiSo(x.id, MAU_THUNG.length, 1)]!,
      );
    else if (x.loai === "xe_uu_tien") veCuuThuong(ctx, c);
    else veXeMay(ctx, c, MAU_XE_MAY[chiSo(x.id, MAU_XE_MAY.length)]!, MAU_AO[chiSo(x.id, MAU_AO.length, 2)]!);

    // Đèn khẩn cấp khi dừng giữa đường (bốn góc nhấp nháy vàng cam).
    if (c.khanCap && c.nhay) {
      ctx.fillStyle = "#ffb300";
      for (const [ox, oy] of [
        [-w / 2, 0],
        [w / 2 - 36, 0],
        [-w / 2, L - 50],
        [w / 2 - 36, L - 50],
      ] as const)
        ctx.fillRect(ox, oy, 36, 50);
    }
    // Đèn hậu ban đêm: quầng đỏ phía đuôi xe.
    if (banDem) {
      const yDuoi = tien ? 0 : L;
      const q = ctx.createRadialGradient(0, yDuoi, 0, 0, yDuoi, w * 0.9);
      q.addColorStop(0, `rgba(255, 40, 40, ${c.phanh ? 0.55 : 0.3})`);
      q.addColorStop(1, "rgba(255, 40, 40, 0)");
      ctx.fillStyle = q;
      ctx.fillRect(-w, yDuoi - w, w * 2, w * 2);
    }
    ctx.restore();

    if (x.loai === "xe_may" && !hinh) {
      // Đầu người lái ngay trên vai, nhích lên vài px gợi chiều cao.
      const d = L * (tien ? 0.6 : 0.42);
      const [px, py] = tien
        ? raPx(bd, cam, X, Y - L + d)
        : raPx(bd, cam, X - d * Math.sin(goc), Y + d * Math.cos(goc));
      veDau(
        ctx,
        px,
        py - rDau * 0.5,
        rDau,
        x.mu_bao_hiem,
        MAU_MU[chiSo(x.id, MAU_MU.length, 3)]!,
        c,
        chiSo(x.id, 3, 4),
      );
    }
  }
}

/** Khung tô một xe (đơn vị camera) theo px, có thể nhấp nháy theo `doDam`. */
export function veKhungTo(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  h: Hop,
  mau: string,
  doDam = 1,
  net = false,
) {
  ctx.save();
  ctx.globalAlpha = doDam;
  ctx.strokeStyle = mau;
  ctx.lineWidth = 2.5;
  if (net) ctx.setLineDash([6, 4]);
  ctx.strokeRect(bd.tx * h[0] - 3, bd.ty * h[1] - 3, bd.tx * (h[2] - h[0]) + 6, bd.ty * (h[3] - h[1]) + 6);
  ctx.restore();
}

/** Tâm ba bóng trong ảnh đầu đèn (đỏ, vàng, xanh), theo tỷ lệ chiều cao ảnh; bán kính theo tỷ lệ chiều rộng. */
const BONG_ANH_DEN: ReadonlyArray<[MauDen, number]> = [
  ["do", 0.213],
  ["vang", 0.479],
  ["xanh", 0.748],
];
const BAN_KINH_BONG = 0.25;

/** Đầu đèn tín hiệu ba bóng tại một điểm px. */
export function veDauDen(ctx: CanvasRenderingContext2D, x: number, y: number, mau: MauDen) {
  const hinh = anh("den-tin-hieu");
  if (hinh) {
    // Ảnh vẽ cả ba bóng đều sáng: phủ tối bóng tắt, thêm quầng cho bóng đang sáng.
    const cao = 34;
    const rong = (cao * hinh.naturalWidth) / hinh.naturalHeight;
    ctx.drawImage(hinh, x - rong / 2, y - 18, rong, cao);
    const r = rong * BAN_KINH_BONG;
    for (const [ten, t] of BONG_ANH_DEN) {
      const by = y - 18 + cao * t;
      ctx.beginPath();
      if (ten === mau) {
        const q = ctx.createRadialGradient(x, by, r * 0.6, x, by, r * 2.4);
        q.addColorStop(
          0,
          ten === "do"
            ? "rgba(255,70,60,0.55)"
            : ten === "vang"
              ? "rgba(255,200,60,0.55)"
              : "rgba(80,220,110,0.55)",
        );
        q.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = q;
        ctx.arc(x, by, r * 2.4, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = "rgba(24, 26, 30, 0.78)";
        ctx.arc(x, by, r * 1.08, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    return;
  }
  ctx.fillStyle = "#1d1f23";
  ctx.fillRect(x - 6, y - 18, 12, 34);
  const bong: Array<[MauDen, string, number]> = [
    ["do", "#e53935", -11],
    ["vang", "#fbc02d", -1],
    ["xanh", "#43a047", 9],
  ];
  for (const [ten, sang, dy] of bong) {
    ctx.beginPath();
    ctx.arc(x, y + dy, 4, 0, Math.PI * 2);
    ctx.fillStyle = ten === mau ? sang : "#3a3d42";
    ctx.fill();
  }
}

let mauNhieu: HTMLCanvasElement | null = null;

/** Lớp nhiễu hạt nhẹ của camera. `tinh`: không đổi theo thời gian (giảm chuyển động). */
export function veNhieu(ctx: CanvasRenderingContext2D, bd: BienDoi, doDam: number, tinh: boolean) {
  if (typeof document === "undefined") return;
  if (!mauNhieu) {
    mauNhieu = document.createElement("canvas");
    mauNhieu.width = mauNhieu.height = 96;
    const c = mauNhieu.getContext("2d")!;
    const anh = c.createImageData(96, 96);
    for (let i = 0; i < anh.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      anh.data[i] = anh.data[i + 1] = anh.data[i + 2] = v;
      anh.data[i + 3] = 255;
    }
    c.putImageData(anh, 0, 0);
  }
  const mau = ctx.createPattern(mauNhieu, "repeat");
  if (!mau) return;
  ctx.save();
  ctx.globalAlpha = doDam;
  ctx.globalCompositeOperation = "overlay";
  const dx = tinh ? 0 : Math.floor(Math.random() * 96);
  const dy = tinh ? 0 : Math.floor(Math.random() * 96);
  ctx.translate(-dx, -dy);
  ctx.fillStyle = mau;
  ctx.fillRect(0, 0, bd.rong + 96, bd.cao + 96);
  ctx.restore();
}
