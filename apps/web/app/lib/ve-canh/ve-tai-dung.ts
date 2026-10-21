/**
 * Vẽ sơ đồ hiện trường của trò "Tái dựng hiện trường" (GĐ-T10; M6 mở rộng bằng tệp mới, không sửa tệp M6
 * cũ). Sơ đồ đúng tỷ lệ (một tỷ lệ cho cả hai trục), nhìn từ trên xuống: mặt đường, vạch, vật cố định,
 * đèn; dấu vết (vết phanh liền, vết trượt đứt nét, mảnh vỡ ở điểm va chạm, vị trí cuối vẽ viền đứt); xe
 * của người chơi vẽ đặc, có mũi tên hướng đi. Ký hiệu tự vẽ, không theo mẫu sơ đồ nghiệp vụ.
 *
 * Xe vẽ theo loại, nhìn từ trên: ô tô con (kính lái, nóc, kính sau, đèn), xe tải (ca-bin, thùng mui bạt),
 * xe máy (hai bánh, tay lái, người lái đội mũ), xe ưu tiên (thân trắng sọc đỏ, đèn nóc). Mỗi xe một màu sơn
 * theo nhãn (A xanh dương, B cam, C xanh lá…) để người chơi nhận ra xe nào là xe nào trong lời kể.
 */
import type { DauVet, SoDoTaiDung } from "../tai-dung";
import { type BienDoi, raX, raY } from "./bien-doi";
import type { BangMau } from "./mau";

type LoaiXe = "o_to" | "xe_tai" | "xe_may" | "xe_uu_tien";
const CO_XE: Record<LoaiXe, [number, number]> = {
  o_to: [450, 180],
  xe_tai: [700, 240],
  xe_may: [200, 80],
  xe_uu_tien: [520, 200],
};

export interface XeVe {
  id: string;
  loai: LoaiXe;
  /** Tâm xe, cm. */
  x: number;
  y: number;
  huong: number;
}

/** Nửa bề rộng mặt đường, cm. */
const nuaDuong = (sd: SoDoTaiDung) => sd.so_lan * 350;

/** Vật cố định: cột điện (cột tròn, bóng đổ), rào chắn (sọc đỏ trắng), cây (tán hai lớp), tường (gạch). */
function veVat(
  ctx: CanvasRenderingContext2D,
  loai: string,
  x1: number,
  y1: number,
  w: number,
  h: number,
  m: BangMau,
) {
  if (loai === "cay") {
    const r = Math.max(w, h) / 2;
    ctx.fillStyle = "#2b8a3e";
    ctx.beginPath();
    ctx.arc(x1 + w / 2, y1 + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#51cf66";
    ctx.beginPath();
    ctx.arc(x1 + w / 2 - r * 0.25, y1 + h / 2 - r * 0.25, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (loai === "rao") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, y1, w, h);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x1, y1, w, h);
    ctx.fillStyle = "#e03131";
    const buoc = Math.max(5, Math.min(w, h) * 1.2);
    for (let k = -h; k < w + h; k += buoc * 2) {
      ctx.beginPath();
      ctx.moveTo(x1 + k, y1 + h);
      ctx.lineTo(x1 + k + h, y1);
      ctx.lineTo(x1 + k + h + buoc, y1);
      ctx.lineTo(x1 + k + buoc, y1 + h);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#5c1010";
    ctx.strokeRect(x1, y1, w, h);
    return;
  }
  if (loai === "cot") {
    const r = Math.max(3, Math.min(w, h) / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.arc(x1 + w / 2 + 2, y1 + h / 2 + 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#adb5bd";
    ctx.beginPath();
    ctx.arc(x1 + w / 2, y1 + h / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#343a40";
    ctx.stroke();
    return;
  }
  // Tường: nền gạch, mạch vữa.
  ctx.fillStyle = "#b5651d";
  ctx.fillRect(x1, y1, w, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1;
  const ngang = w >= h;
  for (let k = 5; k < (ngang ? w : h); k += 6) {
    ctx.beginPath();
    if (ngang) {
      ctx.moveTo(x1 + k, y1);
      ctx.lineTo(x1 + k, y1 + h);
    } else {
      ctx.moveTo(x1, y1 + k);
      ctx.lineTo(x1 + w, y1 + k);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = m.chu;
  ctx.strokeRect(x1, y1, w, h);
}

export function veSoDo(ctx: CanvasRenderingContext2D, bd: BienDoi, m: BangMau, sd: SoDoTaiDung) {
  const W = sd.rong_m * 100;
  const H = sd.cao_m * 100;
  const cx = W / 2;
  const cy = H / 2;
  const n = nuaDuong(sd);
  ctx.fillStyle = m.co;
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  ctx.fillStyle = m.duong;
  const hop = (x1: number, y1: number, x2: number, y2: number) =>
    ctx.fillRect(raX(bd, x1), raY(bd, y1), (x2 - x1) * bd.tx, (y2 - y1) * bd.ty);
  hop(cx - n, 0, cx + n, H);
  if (sd.kieu === "nga_tu") hop(0, cy - n, W, cy + n);

  // Vạch: tim đường liền, vạch chia làn đứt; không kẻ trong nơi giao nhau.
  ctx.strokeStyle = m.vach;
  ctx.lineWidth = 1.5;
  const doan = (x1: number, y1: number, x2: number, y2: number, dut: boolean) => {
    ctx.setLineDash(dut ? [6, 6] : []);
    ctx.beginPath();
    ctx.moveTo(raX(bd, x1), raY(bd, y1));
    ctx.lineTo(raX(bd, x2), raY(bd, y2));
    ctx.stroke();
  };
  const doc = (x: number, dut: boolean) => {
    if (sd.kieu === "nga_tu") {
      doan(x, 0, x, cy - n, dut);
      doan(x, cy + n, x, H, dut);
    } else doan(x, 0, x, H, dut);
  };
  doc(cx, false);
  if (sd.so_lan === 2) {
    doc(cx - 350, true);
    doc(cx + 350, true);
  }
  if (sd.kieu === "nga_tu") {
    for (const y of sd.so_lan === 2 ? [cy, cy - 350, cy + 350] : [cy]) {
      doan(0, y, cx - n, y, y !== cy);
      doan(cx + n, y, W, y, y !== cy);
    }
  }
  ctx.setLineDash([]);

  // Vật cố định.
  for (const v of sd.vat) {
    const x1 = raX(bd, (v.x - v.rong / 2) * 100);
    const y1 = raY(bd, (v.y - v.dai / 2) * 100);
    const w = Math.max(3, v.rong * 100 * bd.tx);
    const h = Math.max(3, v.dai * 100 * bd.ty);
    veVat(ctx, v.loai, x1, y1, w, h, m);
  }

  // Đèn: ở góc phải phía trước của hướng đi vào nơi giao nhau.
  const viTriDen: Record<number, [number, number]> = {
    0: [cx + n + 150, cy + n + 150],
    2: [cx - n - 150, cy + n + 150],
    4: [cx - n - 150, cy - n - 150],
    6: [cx + n + 150, cy - n - 150],
  };
  for (const d of sd.den) {
    const [x, y] = viTriDen[d.huong]!;
    ctx.fillStyle = m.chu;
    ctx.beginPath();
    ctx.arc(raX(bd, x), raY(bd, y), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.mau === "do" ? m.nguy : d.mau === "vang" ? m.canhBao : m.dat;
    ctx.beginPath();
    ctx.arc(raX(bd, x), raY(bd, y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Xe nhìn từ trên (đầu xe hướng −y trước khi xoay)                    */
/* ------------------------------------------------------------------ */

/** Màu sơn theo nhãn xe (A, B, C…); màu cố định như màu sơn thật, không đổi theo giao diện. */
const SON_XE = ["#2563c9", "#e8590c", "#2f9e44", "#7048e8", "#c2255c", "#0c8599"];
export const mauSonXe = (id: string) => SON_XE[Math.abs((id.charCodeAt(0) || 65) - 65) % SON_XE.length]!;
const VIEN = "rgba(15, 20, 28, 0.8)";
const KINH = "#25313d";
const LOP = "#16191d";
const DEN_PHA = "#fff3bf";
const DEN_HAU = "#e03131";

/** Đường bao thân xe (chưa tô), dùng cho bóng đổ và viền vị trí cuối. */
function baoXe(ctx: CanvasRenderingContext2D, loai: LoaiXe, w: number, h: number) {
  ctx.beginPath();
  if (loai === "xe_may") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (loai === "xe_tai") {
    ctx.roundRect(-w * 0.46, -h / 2, w * 0.92, h * 0.26, [w * 0.2, w * 0.2, 1, 1]);
    ctx.rect(-w / 2, -h / 2 + h * 0.27, w, h * 0.73);
  } else {
    const r1 = Math.min(w * 0.4, h * 0.16);
    const r2 = Math.min(w * 0.25, h * 0.1);
    ctx.roundRect(-w / 2, -h / 2, w, h, [r1, r1, r2, r2]);
  }
}

/** Bánh xe ló ra hai bên thân, ở các vị trí trục `cacY`. */
function banh(ctx: CanvasRenderingContext2D, w: number, h: number, cacY: readonly number[]) {
  ctx.fillStyle = LOP;
  const bw = Math.max(1.5, w * 0.13);
  const bh = Math.max(3, h * 0.14);
  for (const y of cacY) for (const s of [-1, 1]) ctx.fillRect(s * (w / 2) - bw / 2, y - bh / 2, bw, bh);
}

/** Gương chiếu hậu hai bên ở độ cao `y`. */
function guong(ctx: CanvasRenderingContext2D, w: number, h: number, y: number, mau: string) {
  ctx.fillStyle = mau;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * (w / 2 + w * 0.07), y, w * 0.08, Math.max(1, h * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Đèn ở mép trước (pha) hoặc mép sau (hậu). */
function den(ctx: CanvasRenderingContext2D, w: number, h: number, sau: boolean, mau: string) {
  const d = Math.max(1.5, h * 0.03);
  ctx.fillStyle = mau;
  for (const s of [-1, 1])
    ctx.fillRect(s * w * 0.3 - w * 0.1, sau ? h / 2 - d - 0.5 : -h / 2 + 0.5, w * 0.2, d);
}

/** Ô tô con, xe ưu tiên: kính lái, nóc, kính sau, gương, đèn; xe ưu tiên thân trắng, sọc đỏ, đèn nóc. */
function veOTo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  son: string,
  uuTien: boolean,
  ro: boolean,
) {
  if (ro) banh(ctx, w * 1.02, h, [-h * 0.3, h * 0.3]);
  baoXe(ctx, "o_to", w, h);
  ctx.fillStyle = uuTien ? "#f8f9fa" : son;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = VIEN;
  ctx.stroke();
  ctx.fillStyle = KINH;
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, -h * 0.21);
  ctx.lineTo(w * 0.4, -h * 0.21);
  ctx.lineTo(w * 0.34, -h * 0.06);
  ctx.lineTo(-w * 0.34, -h * 0.06);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, h * 0.24);
  ctx.lineTo(w * 0.34, h * 0.24);
  ctx.lineTo(w * 0.38, h * 0.35);
  ctx.lineTo(-w * 0.38, h * 0.35);
  ctx.fill();
  if (!ro) return;
  // Nóc xe sáng hơn thân một chút.
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.roundRect(-w * 0.33, -h * 0.04, w * 0.66, h * 0.26, 2);
  ctx.fill();
  guong(ctx, w, h, -h * 0.15, uuTien ? "#ced4da" : son);
  den(ctx, w, h, false, DEN_PHA);
  den(ctx, w, h, true, DEN_HAU);
  if (uuTien) {
    ctx.fillStyle = "#e03131";
    for (const s of [-1, 1]) ctx.fillRect(s * w * 0.44 - w * 0.05, -h * 0.04, w * 0.1, h * 0.44);
    const d = Math.max(2, h * 0.06);
    ctx.fillRect(-w * 0.32, h * 0.06, w * 0.32, d);
    ctx.fillStyle = "#1c7ed6";
    ctx.fillRect(0, h * 0.06, w * 0.32, d);
  }
}

/** Xe tải: ca-bin có kính lái và gương, thùng mui bạt có khung ngang; một trục trước, hai trục sau. */
function veXeTai(ctx: CanvasRenderingContext2D, w: number, h: number, son: string, ro: boolean) {
  if (ro) banh(ctx, w * 1.02, h, [-h * 0.34, h * 0.2, h * 0.36]);
  ctx.beginPath();
  ctx.roundRect(-w * 0.46, -h / 2, w * 0.92, h * 0.26, [w * 0.2, w * 0.2, 1, 1]);
  ctx.fillStyle = son;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = VIEN;
  ctx.stroke();
  ctx.fillStyle = KINH;
  ctx.fillRect(-w * 0.38, -h / 2 + h * 0.035, w * 0.76, h * 0.06);
  const y0 = -h / 2 + h * 0.27;
  ctx.fillStyle = "#a8a07a";
  ctx.fillRect(-w / 2, y0, w, h * 0.73);
  ctx.strokeStyle = VIEN;
  ctx.strokeRect(-w / 2, y0, w, h * 0.73);
  if (!ro) return;
  ctx.strokeStyle = "rgba(50, 42, 20, 0.5)";
  for (let k = 1; k < 6; k++) {
    const y = y0 + (h * 0.73 * k) / 6;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 1, y);
    ctx.lineTo(w / 2 - 1, y);
    ctx.stroke();
  }
  guong(ctx, w, h, -h * 0.42, son);
  den(ctx, w * 0.92, h, false, DEN_PHA);
  den(ctx, w, h, true, DEN_HAU);
}

/** Xe máy có người lái: bánh trước, bánh sau, thân xe, tay lái, người lái (vai, tay, mũ bảo hiểm). */
function veXeMay(ctx: CanvasRenderingContext2D, w: number, h: number, son: string, ro: boolean) {
  const bw = Math.max(2, w * 0.24);
  ctx.fillStyle = LOP;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -h / 2, bw, h * 0.3, bw / 2);
  ctx.roundRect(-bw / 2, h * 0.2, bw, h * 0.3, bw / 2);
  ctx.fill();
  ctx.fillStyle = son;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.06, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = VIEN;
  ctx.stroke();
  ctx.strokeStyle = LOP;
  ctx.lineWidth = Math.max(1.2, w * 0.1);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.25);
  ctx.lineTo(w / 2, -h * 0.25);
  ctx.stroke();
  // Người lái: áo, hai tay vươn tới tay lái, mũ bảo hiểm.
  const ao = "#495057";
  if (ro) {
    ctx.strokeStyle = ao;
    ctx.lineWidth = Math.max(1, w * 0.12);
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(s * w * 0.34, h * 0.0);
      ctx.lineTo(s * w * 0.42, -h * 0.23);
    }
    ctx.stroke();
  }
  ctx.fillStyle = ao;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.04, w * 0.45, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c230";
  ctx.beginPath();
  ctx.arc(0, -h * 0.03, Math.max(1.8, w * 0.27), 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#7a5c00";
  ctx.stroke();
  if (ro) {
    ctx.fillStyle = DEN_PHA;
    ctx.fillRect(-w * 0.12, -h / 2 - 0.5, w * 0.24, Math.max(1.2, h * 0.025));
  }
}

/** Vẽ một xe (tâm, hướng). `kieu`: "dac" xe của người chơi, "vien" vị trí cuối trên dấu vết. */
export function veXe(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  x: XeVe,
  kieu: "dac" | "vien",
  mau: string,
  chon = false,
) {
  const [dai, rong] = CO_XE[x.loai];
  const xeMay = x.loai === "xe_may";
  const w = Math.max(xeMay ? 7 : 6, rong * bd.tx);
  const h = Math.max(xeMay ? 15 : 10, dai * bd.ty);
  const son = mauSonXe(x.id);
  ctx.save();
  ctx.translate(raX(bd, x.x), raY(bd, x.y));
  ctx.rotate((x.huong * Math.PI) / 4);
  if (kieu === "dac") {
    ctx.save();
    ctx.translate(1.5, 2);
    baoXe(ctx, x.loai, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fill();
    ctx.restore();
    // Xe quá nhỏ trên màn (ngã tư lớn) thì bỏ chi tiết vụn, giữ thân, kính và người lái.
    const ro = w >= 9;
    if (x.loai === "xe_tai") veXeTai(ctx, w, h, son, ro);
    else if (xeMay) veXeMay(ctx, w, h, son, ro);
    else veOTo(ctx, w, h, son, x.loai === "xe_uu_tien", ro);
  } else {
    baoXe(ctx, x.loai, w, h);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = mau;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = mau;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = mau;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 2);
    ctx.lineTo(Math.min(5, w / 3), -h / 2 + Math.min(9, h / 3));
    ctx.lineTo(-Math.min(5, w / 3), -h / 2 + Math.min(9, h / 3));
    ctx.fill();
  }
  if (chon) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = m.canhBao;
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 6);
    ctx.stroke();
  }
  ctx.restore();
  // Nhãn: ô tròn màu sơn của xe (vị trí cuối: nền trắng, viền màu dấu vết).
  const lx = raX(bd, x.x) + w / 2 + 11;
  const ly = raY(bd, x.y);
  ctx.beginPath();
  ctx.arc(lx, ly, 8, 0, Math.PI * 2);
  ctx.fillStyle = kieu === "dac" ? son : m.mat;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = kieu === "dac" ? m.mat : mau;
  ctx.stroke();
  ctx.fillStyle = kieu === "dac" ? "#ffffff" : mau;
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(x.id, lx, ly + 0.5);
}

/**
 * Vẽ dấu vết: vết phanh (hai vệt liền), vết trượt (hai vệt đứt), mảnh vỡ quanh điểm va chạm, vị trí cuối
 * (viền đứt). `loaiXe`: loại của từng xe để vẽ đúng cỡ.
 */
export function veDauVet(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  dv: DauVet,
  loaiXe: ReadonlyMap<string, LoaiXe>,
  mau: string,
  anXeCuoi = false,
) {
  ctx.strokeStyle = mau;
  ctx.lineWidth = 2;
  for (const v of dv.vet) {
    const dx = v.den.x - v.tu.x;
    const dy = v.den.y - v.tu.y;
    const d = Math.hypot(dx, dy) || 1;
    // Hai vệt bánh cách tâm 70 cm về hai bên.
    const ox = (-dy / d) * 70;
    const oy = (dx / d) * 70;
    ctx.setLineDash(v.loai === "truot" ? [5, 4] : []);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(raX(bd, v.tu.x + s * ox), raY(bd, v.tu.y + s * oy));
      ctx.lineTo(raX(bd, v.den.x + s * ox), raY(bd, v.den.y + s * oy));
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Mảnh vỡ: các mẩu nhỏ xếp cố định quanh điểm va chạm.
  const MAU_VO = [
    [0, 0],
    [9, -5],
    [-8, 6],
    [5, 10],
    [-11, -7],
    [13, 4],
  ];
  ctx.fillStyle = mau;
  for (const e of dv.va_cham)
    for (const [ox, oy] of MAU_VO) ctx.fillRect(raX(bd, e.x) + ox! - 2, raY(bd, e.y) + oy! - 2, 4, 3);
  if (!anXeCuoi)
    for (const c of dv.cuoi)
      if (!c.ra_ngoai) veXe(ctx, bd, m, { ...c, id: c.xe, loai: loaiXe.get(c.xe) ?? "o_to" }, "vien", mau);
}
