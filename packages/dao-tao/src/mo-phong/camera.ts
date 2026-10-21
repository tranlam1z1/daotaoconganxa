/**
 * Phép chiếu camera giao thông (mô-đun M5, mở rộng ở GĐ-T5): từ bản đồ (cm) sang "đơn vị camera"
 * (khung rộng 1000, cao `cao`). Biến đổi tuyến tính cố định (co trục dọc, nghiêng nhẹ) để gợi góc
 * nhìn chéo từ trên cao; hệ số là số nguyên phần nghìn, kết quả làm tròn xuống, nên máy chủ và
 * điện thoại tính ra cùng hộp bao của từng xe.
 *
 * Người chơi khoanh vùng trên màn hình; điện thoại quy vùng về đơn vị camera trước khi ghi nhật ký.
 * Máy chủ so vùng đó với hộp bao của xe ở đúng nhịp dừng hình.
 */
import type { Huong } from "./duong.ts";
import { kichThuocXe, type LoaiXe } from "./xe.ts";

/** X = cx + ⌊(a·x + b·y)/1000⌋, Y = cy + ⌊(c·x + d·y)/1000⌋. */
export interface Camera {
  a: number;
  b: number;
  c: number;
  d: number;
  cx: number;
  cy: number;
  /** Chiều cao khung, đơn vị camera (chiều rộng luôn 1000). */
  cao: number;
}

export const RONG_KHUNG_CAMERA = 1000;

/** Hộp bao [x0, y0, x1, y1] theo đơn vị camera, x0 ≤ x1, y0 ≤ y1. */
export type Hop = readonly [number, number, number, number];

export function chieu(cam: Camera, x: number, y: number): [number, number] {
  return [
    cam.cx + Math.floor((cam.a * x + cam.b * y) / 1000),
    cam.cy + Math.floor((cam.c * x + cam.d * y) / 1000),
  ];
}

/** Hướng đơn vị × 1000 (chéo dùng 707), để tính góc xe mà không cần lượng giác. */
const DON_VI: Readonly<Record<Huong, readonly [number, number]>> = {
  0: [0, -1000],
  1: [707, -707],
  2: [1000, 0],
  3: [707, 707],
  4: [0, 1000],
  5: [-707, 707],
  6: [-1000, 0],
  7: [-707, -707],
};

/** Hộp bao trên camera của một xe (đầu xe ở (x, y), thân kéo về phía sau theo hướng). */
export function hopXe(
  cam: Camera,
  xe: { x: number; y: number; huong: Huong; loai: LoaiXe; kich_thuoc?: { dai: number; rong: number } },
): Hop {
  const [ux, uy] = DON_VI[xe.huong];
  const { dai, rong } = kichThuocXe(xe);
  const sauX = xe.x - Math.trunc((ux * dai) / 1000);
  const sauY = xe.y - Math.trunc((uy * dai) / 1000);
  // Pháp tuyến (quay 90°) nhân nửa bề rộng.
  const px = Math.trunc((-uy * rong) / 2000);
  const py = Math.trunc((ux * rong) / 2000);
  const goc = [
    chieu(cam, xe.x + px, xe.y + py),
    chieu(cam, xe.x - px, xe.y - py),
    chieu(cam, sauX + px, sauY + py),
    chieu(cam, sauX - px, sauY - py),
  ];
  return [
    Math.min(...goc.map((g) => g[0])),
    Math.min(...goc.map((g) => g[1])),
    Math.max(...goc.map((g) => g[0])),
    Math.max(...goc.map((g) => g[1])),
  ];
}

export const dienTich = (h: Hop) => Math.max(0, h[2] - h[0]) * Math.max(0, h[3] - h[1]);

export function giao(a: Hop, b: Hop): Hop {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
}

/** Tỷ lệ diện tích hộp xe nằm trong vùng khoanh (0–1). */
export function tyLePhu(vung: Hop, xe: Hop): number {
  const s = dienTich(xe);
  return s > 0 ? dienTich(giao(vung, xe)) / s : 0;
}

/** Xe có hiện trong khung camera không (hộp bao chạm khung). */
export function trongKhung(cam: Camera, h: Hop): boolean {
  return h[2] > 0 && h[0] < RONG_KHUNG_CAMERA && h[3] > 0 && h[1] < cam.cao;
}

/** Chuẩn hóa hộp người chơi vẽ (có thể vẽ ngược chiều), kẹp trong khung. */
export function chuanHop(cam: Camera, h: readonly number[]): Hop {
  const [a, b, c, d] = h as [number, number, number, number];
  const kep = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
  return [
    kep(Math.min(a, c), RONG_KHUNG_CAMERA),
    kep(Math.min(b, d), cam.cao),
    kep(Math.max(a, c), RONG_KHUNG_CAMERA),
    kep(Math.max(b, d), cam.cao),
  ];
}
