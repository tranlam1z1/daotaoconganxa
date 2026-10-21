/**
 * Xe và người nhìn từ trên cao, dùng chung cho "Dựng chốt an toàn ban đêm" (ve-chot.ts) và "Truy vết xe bỏ
 * trốn" (ve-truy-vet.ts). Tâm xe ở gốc tọa độ, đầu xe hướng −y (trò tự dời, xoay trước khi gọi).
 *
 * Mỗi loại xe có dáng riêng để nhận ra ngay khi lướt mắt: ô tô con (nắp ca-pô, kính lái, nóc, kính hậu, gương),
 * xe tải (ca-bin đầu bằng, thùng có nẹp, ba trục), xe khách (thân dài, dãy kính hai bên, cửa nóc), xe máy (hai
 * bánh, tay lái, người lái đội mũ bảo hiểm), xe tuần tra (thân trắng, sọc hai bên, dàn đèn nóc xanh đỏ).
 * Không chữ, không logo, không phù hiệu (GAME_DESIGN §1.5).
 *
 * `dem`: đèn pha, đèn hậu phát sáng; viền thân sáng để xe tối màu vẫn nổi trên mặt đường đêm.
 * Xe quá nhỏ trên màn thì bỏ chi tiết vụn (gương, nẹp), giữ dáng thân, kính và đèn.
 */

export type LoaiXeTren = "o_to" | "xe_tai" | "xe_khach" | "xe_may" | "xe_uu_tien" | "tuan_tra";

export interface KieuXeTren {
  /** Màu sơn thân xe. */
  son: string;
  /** Cảnh ban đêm. */
  dem?: boolean;
  /** Đang phanh: đèn hậu sáng mạnh. */
  phanh?: boolean;
  /** Pha đèn nháy của dàn đèn nóc (xe tuần tra, xe ưu tiên): đổi vế sáng. */
  phaDen?: boolean;
  /** Xe máy: người lái đội mũ bảo hiểm (mặc định có). */
  muBaoHiem?: boolean;
  /** Màu viền thân; mặc định theo độ sáng của sơn. */
  vien?: string;
  /** Bóng đổ dưới xe (cảnh ban ngày). */
  bong?: boolean;
}

const KINH = "#1f2a36";
const KINH_SANG = "rgba(170, 205, 235, 0.35)";
const LOP = "#141619";
const DEN_PHA = "#fff6cf";
const DEN_HAU = "#e5383b";
const DEN_HAU_TAT = "#8f2a2c";
const XANH_DEN = "#3b8bff";
const DO_DEN = "#ff4b4b";

/** Độ sáng tương đối (0–1) của màu #rrggbb, để chọn viền tương phản. */
export function doSang(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = Number.parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Pha màu với trắng (t > 0) hoặc đen (t < 0). */
export function phaMau(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1]!, 16);
  const kenh = (c: number) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t));
  const r = kenh((n >> 16) & 255);
  const g = kenh((n >> 8) & 255);
  const b = kenh(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const vienMacDinh = (son: string, dem: boolean | undefined) =>
  dem ? "rgba(236, 240, 245, 0.92)" : doSang(son) > 0.62 ? "rgba(30, 35, 42, 0.85)" : "rgba(12, 16, 22, 0.9)";

/** Đường bao thân xe (chưa tô): bóng đổ, vòng chọn. */
export function baoXeTren(ctx: CanvasRenderingContext2D, loai: LoaiXeTren, w: number, h: number) {
  ctx.beginPath();
  if (loai === "xe_may") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (loai === "xe_tai" || loai === "xe_khach")
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w * 0.18, 3));
  else ctx.roundRect(-w / 2, -h / 2, w, h, [w * 0.38, w * 0.38, w * 0.26, w * 0.26]);
}

/** Bánh xe ló hai bên ở các trục `cacY`. */
function banh(ctx: CanvasRenderingContext2D, w: number, h: number, cacY: readonly number[], to = 1) {
  ctx.fillStyle = LOP;
  const bw = Math.max(1.2, w * 0.12) * to;
  const bh = Math.max(2.5, h * 0.13) * to;
  for (const y of cacY)
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(s * (w / 2) - bw / 2, y - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
}

/** Gương chiếu hậu hai bên. */
function guong(ctx: CanvasRenderingContext2D, w: number, y: number, mau: string, co: number) {
  ctx.fillStyle = mau;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * (w / 2 + co * 0.7), y, co, co * 0.55, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Cặp đèn ở mép trước (pha) hoặc sau (hậu), có quầng khi sáng. */
function capDen(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  mau: string,
  quang: string | null,
  rong = 0.22,
) {
  const dw = Math.max(1.6, w * rong);
  const dh = Math.max(1.2, w * 0.09);
  for (const s of [-1, 1]) {
    const cx = s * (w / 2 - dw / 2 - w * 0.06);
    if (quang) {
      const g = ctx.createRadialGradient(cx, y, 0, cx, y, dw * 1.6);
      g.addColorStop(0, quang);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, y, dw * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = mau;
    ctx.beginPath();
    ctx.roundRect(cx - dw / 2, y - dh / 2, dw, dh, dh / 2);
    ctx.fill();
  }
}

function denHau(ctx: CanvasRenderingContext2D, w: number, y: number, k: KieuXeTren) {
  const sang = k.dem || k.phanh;
  capDen(
    ctx,
    w,
    y,
    k.phanh ? "#ff6b6b" : sang ? DEN_HAU : DEN_HAU_TAT,
    k.phanh ? "rgba(255,70,70,0.75)" : k.dem ? "rgba(255,60,60,0.35)" : null,
  );
}

function denPha(ctx: CanvasRenderingContext2D, w: number, y: number, k: KieuXeTren) {
  capDen(ctx, w, y, DEN_PHA, k.dem ? "rgba(255,246,207,0.55)" : null);
}

/** Dàn đèn nóc: nửa trái xanh, nửa phải đỏ; `phaDen` đổi vế sáng. */
function danDenNoc(ctx: CanvasRenderingContext2D, w: number, y: number, k: KieuXeTren) {
  const dw = w * 0.36;
  const dh = Math.max(1.6, w * 0.13);
  const sangTrai = k.phaDen !== false;
  for (const [s, mau, sang] of [
    [-1, XANH_DEN, sangTrai],
    [1, DO_DEN, !sangTrai],
  ] as const) {
    const cx = (s * dw) / 2;
    if (sang && k.dem) {
      const g = ctx.createRadialGradient(cx, y, 0, cx, y, w * 0.9);
      g.addColorStop(0, s < 0 ? "rgba(59,139,255,0.55)" : "rgba(255,75,75,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, y, w * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = sang ? mau : s < 0 ? "#1d3f73" : "#6e2224";
    ctx.fillRect(cx - dw / 2, y - dh / 2, dw, dh);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 0.6;
  ctx.strokeRect(-dw, y - dh / 2, dw * 2, dh);
}

/* ------------------------------------------------------------------ */

/** Ô tô con (cả xe tuần tra, xe ưu tiên dùng dáng này). */
function veOTo(ctx: CanvasRenderingContext2D, w: number, h: number, k: KieuXeTren, loai: LoaiXeTren) {
  const ro = w >= 9;
  const son = loai === "tuan_tra" || loai === "xe_uu_tien" ? "#f4f6f8" : k.son;
  banh(ctx, w * 1.02, h, [-h * 0.3, h * 0.3]);
  baoXeTren(ctx, "o_to", w, h);
  ctx.fillStyle = son;
  ctx.fill();
  ctx.lineWidth = k.dem ? 1.3 : 1;
  ctx.strokeStyle = k.vien ?? vienMacDinh(son, k.dem);
  ctx.stroke();

  // Nắp ca-pô và nắp cốp: hai đường gân mờ.
  if (ro) {
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(s * w * 0.2, -h * 0.46);
      ctx.lineTo(s * w * 0.26, -h * 0.24);
    }
    ctx.stroke();
  }
  // Kính lái (hình thang), kính hậu.
  ctx.fillStyle = KINH;
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, -h * 0.2);
  ctx.quadraticCurveTo(0, -h * 0.25, w * 0.4, -h * 0.2);
  ctx.lineTo(w * 0.34, -h * 0.06);
  ctx.lineTo(-w * 0.34, -h * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, h * 0.23);
  ctx.lineTo(w * 0.34, h * 0.23);
  ctx.lineTo(w * 0.38, h * 0.34);
  ctx.quadraticCurveTo(0, h * 0.37, -w * 0.38, h * 0.34);
  ctx.closePath();
  ctx.fill();
  // Kính hông hai bên nóc.
  if (ro) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * w * 0.36, -h * 0.05);
      ctx.lineTo(s * w * 0.45, -h * 0.03);
      ctx.lineTo(s * w * 0.45, h * 0.2);
      ctx.lineTo(s * w * 0.36, h * 0.22);
      ctx.closePath();
      ctx.fill();
    }
    // Ánh trời trên kính lái.
    ctx.fillStyle = KINH_SANG;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.19);
    ctx.lineTo(-w * 0.05, -h * 0.205);
    ctx.lineTo(-w * 0.15, -h * 0.08);
    ctx.lineTo(-w * 0.3, -h * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  // Nóc xe: sáng hơn thân một chút.
  ctx.fillStyle = phaMau(son.startsWith("#") ? son : "#888888", doSang(son) > 0.8 ? -0.06 : 0.16);
  ctx.beginPath();
  ctx.roundRect(-w * 0.33, -h * 0.05, w * 0.66, h * 0.27, Math.min(3, w * 0.12));
  ctx.fill();

  if (loai === "tuan_tra") {
    // Sọc xanh đậm dọc hai bên thân.
    ctx.fillStyle = "#123c8c";
    for (const s of [-1, 1]) ctx.fillRect(s * w * 0.5 - (s > 0 ? w * 0.1 : 0), -h * 0.36, w * 0.1, h * 0.72);
    ctx.fillStyle = "#f2c230";
    for (const s of [-1, 1])
      ctx.fillRect(s * w * 0.5 - (s > 0 ? w * 0.1 : 0), -h * 0.36, w * 0.1, Math.max(1, h * 0.04));
    danDenNoc(ctx, w, h * 0.06, k);
  } else if (loai === "xe_uu_tien") {
    ctx.fillStyle = "#d63031";
    for (const s of [-1, 1]) ctx.fillRect(s * w * 0.5 - (s > 0 ? w * 0.09 : 0), -h * 0.3, w * 0.09, h * 0.62);
    danDenNoc(ctx, w, -h * 0.02, k);
  }
  if (ro) guong(ctx, w, -h * 0.15, son, Math.max(1.2, w * 0.09));
  denPha(ctx, w, -h / 2 + Math.max(1, h * 0.03), k);
  denHau(ctx, w, h / 2 - Math.max(1, h * 0.025), k);
}

/** Xe tải: ca-bin đầu bằng, thùng có nẹp ngang; một trục trước, hai trục sau. */
function veXeTai(ctx: CanvasRenderingContext2D, w: number, h: number, k: KieuXeTren) {
  const ro = w >= 9;
  const dCab = h * 0.24;
  banh(ctx, w * 1.02, h, [-h * 0.36, h * 0.22, h * 0.36]);
  // Ca-bin.
  ctx.beginPath();
  ctx.roundRect(-w * 0.47, -h / 2, w * 0.94, dCab, [w * 0.16, w * 0.16, 1, 1]);
  ctx.fillStyle = k.son;
  ctx.fill();
  ctx.lineWidth = k.dem ? 1.3 : 1;
  ctx.strokeStyle = k.vien ?? vienMacDinh(k.son, k.dem);
  ctx.stroke();
  ctx.fillStyle = KINH;
  ctx.fillRect(-w * 0.38, -h / 2 + dCab * 0.12, w * 0.76, dCab * 0.28);
  ctx.fillStyle = phaMau(k.son, doSang(k.son) > 0.8 ? -0.08 : 0.18);
  ctx.fillRect(-w * 0.36, -h / 2 + dCab * 0.5, w * 0.72, dCab * 0.4);
  // Thùng: cùng màu sơn, sáng hơn chút, nẹp ngang.
  const y0 = -h / 2 + dCab + Math.max(1, h * 0.012);
  const dThung = h / 2 - y0;
  ctx.fillStyle = phaMau(k.son, doSang(k.son) > 0.8 ? -0.04 : 0.1);
  ctx.beginPath();
  ctx.roundRect(-w / 2, y0, w, dThung, 1.5);
  ctx.fill();
  ctx.strokeStyle = k.vien ?? vienMacDinh(k.son, k.dem);
  ctx.lineWidth = k.dem ? 1.3 : 1;
  ctx.stroke();
  if (ro) {
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const y = y0 + (dThung * i) / 6;
      ctx.moveTo(-w / 2 + 1, y);
      ctx.lineTo(w / 2 - 1, y);
    }
    ctx.stroke();
    guong(ctx, w, -h / 2 + dCab * 0.25, k.son, Math.max(1.2, w * 0.08));
  }
  denPha(ctx, w * 0.94, -h / 2 + Math.max(1, h * 0.02), k);
  denHau(ctx, w, h / 2 - Math.max(1, h * 0.02), k);
}

/** Xe khách: thân dài bo đầu, dãy kính hai bên, kính lái rộng, cửa nóc. */
function veXeKhach(ctx: CanvasRenderingContext2D, w: number, h: number, k: KieuXeTren) {
  const ro = w >= 9;
  banh(ctx, w * 1.02, h, [-h * 0.3, h * 0.28]);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, [w * 0.3, w * 0.3, w * 0.14, w * 0.14]);
  ctx.fillStyle = k.son;
  ctx.fill();
  ctx.lineWidth = k.dem ? 1.3 : 1;
  ctx.strokeStyle = k.vien ?? vienMacDinh(k.son, k.dem);
  ctx.stroke();
  ctx.fillStyle = KINH;
  ctx.beginPath();
  ctx.moveTo(-w * 0.42, -h * 0.36);
  ctx.quadraticCurveTo(0, -h * 0.44, w * 0.42, -h * 0.36);
  ctx.lineTo(w * 0.4, -h * 0.29);
  ctx.lineTo(-w * 0.4, -h * 0.29);
  ctx.closePath();
  ctx.fill();
  // Dãy kính hông.
  for (const s of [-1, 1]) ctx.fillRect(s * w * 0.5 - (s > 0 ? w * 0.1 : 0), -h * 0.26, w * 0.1, h * 0.62);
  // Nóc: sáng hơn thân, hai cửa thông gió.
  ctx.fillStyle = phaMau(k.son, doSang(k.son) > 0.8 ? -0.06 : 0.14);
  ctx.fillRect(-w * 0.36, -h * 0.26, w * 0.72, h * 0.66);
  if (ro) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (const y of [-h * 0.12, h * 0.18]) ctx.fillRect(-w * 0.14, y, w * 0.28, h * 0.06);
    guong(ctx, w, -h * 0.38, k.son, Math.max(1.2, w * 0.08));
  }
  ctx.fillStyle = KINH;
  ctx.fillRect(-w * 0.34, h * 0.42, w * 0.68, h * 0.04);
  denPha(ctx, w, -h / 2 + Math.max(1, h * 0.02), k);
  denHau(ctx, w, h / 2 - Math.max(1, h * 0.02), k);
}

/** Xe máy có người lái: hai bánh, thân xe, tay lái, người lái (vai, tay, mũ bảo hiểm hoặc đầu trần). */
function veXeMay(ctx: CanvasRenderingContext2D, w: number, h: number, k: KieuXeTren) {
  const bw = Math.max(1.8, w * 0.26);
  // Hai bánh.
  ctx.fillStyle = LOP;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -h / 2, bw, h * 0.28, bw / 2);
  ctx.roundRect(-bw / 2, h * 0.22, bw, h * 0.28, bw / 2);
  ctx.fill();
  // Thân xe: yếm trước và đuôi xe (màu sơn) lộ ra trước, sau người lái.
  ctx.fillStyle = k.son;
  ctx.strokeStyle = k.vien ?? vienMacDinh(k.son, k.dem);
  ctx.lineWidth = k.dem ? 1.1 : 0.9;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.2, w * 0.3, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, h * 0.17, w * 0.32, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Tay lái.
  ctx.strokeStyle = LOP;
  ctx.lineWidth = Math.max(1, w * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h * 0.27);
  ctx.lineTo(w * 0.48, -h * 0.27);
  ctx.stroke();
  // Người lái: áo, hai tay vươn tới tay lái.
  const ao = "#56606c";
  ctx.strokeStyle = ao;
  ctx.lineWidth = Math.max(1, w * 0.13);
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(s * w * 0.32, -h * 0.02);
    ctx.lineTo(s * w * 0.44, -h * 0.25);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = ao;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.02, w * 0.46, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Đầu: mũ bảo hiểm (vỏ sáng, kính chắn tối phía trước) hoặc tóc đen khi không đội.
  const r = Math.max(1.6, w * 0.27);
  if (k.muBaoHiem === false) {
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(0, -h * 0.03, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e9ecef";
    ctx.beginPath();
    ctx.arc(0, -h * 0.03, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = "#2b3440";
    ctx.beginPath();
    ctx.arc(0, -h * 0.03, r, Math.PI * 1.15, Math.PI * 1.85);
    ctx.closePath();
    ctx.fill();
  }
  // Đèn pha, đèn hậu.
  const d = Math.max(1.2, w * 0.18);
  if (k.dem) {
    const g = ctx.createRadialGradient(0, -h / 2, 0, 0, -h / 2, d * 2.4);
    g.addColorStop(0, "rgba(255,246,207,0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -h / 2, d * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = DEN_PHA;
  ctx.beginPath();
  ctx.arc(0, -h * 0.33, d * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = k.phanh ? "#ff6b6b" : k.dem ? DEN_HAU : DEN_HAU_TAT;
  ctx.fillRect(-d * 0.6, h * 0.36, d * 1.2, Math.max(1, d * 0.5));
}

/** Vẽ một xe nhìn từ trên: tâm ở gốc tọa độ, đầu xe hướng −y. */
export function veXeTrenCao(
  ctx: CanvasRenderingContext2D,
  loai: LoaiXeTren,
  w: number,
  h: number,
  k: KieuXeTren,
) {
  ctx.save();
  if (k.bong) {
    ctx.save();
    ctx.translate(Math.max(1, w * 0.08), Math.max(1.5, w * 0.12));
    baoXeTren(ctx, loai, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    ctx.restore();
  }
  if (loai === "xe_may") veXeMay(ctx, w, h, k);
  else if (loai === "xe_tai") veXeTai(ctx, w, h, k);
  else if (loai === "xe_khach") veXeKhach(ctx, w, h, k);
  else veOTo(ctx, w, h, k, loai);
  ctx.restore();
}

/**
 * Chiến sĩ đứng chốt, vẽ dạng biểu tượng đứng (như cọc tiêu, biển tạm) để nhận ra ngay: mũ kê-pi có lưỡi trai,
 * áo phản quang vàng chanh có dải phản quang bạc, quần sẫm, một tay giơ gậy chỉ huy phát sáng đỏ. Không phù
 * hiệu, cấp hiệu. Gốc tọa độ ở giữa hình; chân chạm đất ở +`co`. `co`: nửa chiều cao, px.
 */
export function veChienSi(ctx: CanvasRenderingContext2D, co: number, gaySang: boolean) {
  const s = co / 12;
  ctx.save();
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Bóng dưới chân.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 6, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gậy chỉ huy giơ chéo lên, quầng đỏ khi sáng.
  if (gaySang) {
    const g = ctx.createRadialGradient(9, -10, 0, 9, -10, 9);
    g.addColorStop(0, "rgba(255,80,60,0.7)");
    g.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(9, -10, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = gaySang ? "#ff5a3c" : "#8a2f24";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(6.5, -4.5);
  ctx.lineTo(11, -14);
  ctx.stroke();
  // Chân, quần sẫm.
  ctx.strokeStyle = "#2f3b2c";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-1.6, 3);
  ctx.lineTo(-2.2, 11.5);
  ctx.moveTo(1.6, 3);
  ctx.lineTo(2.2, 11.5);
  ctx.stroke();
  // Tay: trái buông, phải giơ gậy.
  ctx.strokeStyle = "#c9f24a";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-3.6, -4);
  ctx.lineTo(-5, 3);
  ctx.moveTo(3.6, -4);
  ctx.lineTo(6.5, -4.5);
  ctx.stroke();
  // Thân: áo phản quang, hai dải bạc.
  ctx.fillStyle = "#c9f24a";
  ctx.strokeStyle = "rgba(20,30,10,0.75)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.roundRect(-4, -6, 8, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#eef2f5";
  ctx.fillRect(-4, -2.2, 8, 1.3);
  ctx.fillRect(-4, 1, 8, 1.3);
  // Đầu, mũ kê-pi.
  ctx.fillStyle = "#e8b98f";
  ctx.beginPath();
  ctx.arc(0, -8.6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9e4cf";
  ctx.beginPath();
  ctx.ellipse(0, -11, 3.6, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b8322a";
  ctx.fillRect(-2.8, -10.4, 5.6, 1);
  ctx.fillStyle = "#1f2b22";
  ctx.beginPath();
  ctx.ellipse(0.6, -9.6, 3, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
