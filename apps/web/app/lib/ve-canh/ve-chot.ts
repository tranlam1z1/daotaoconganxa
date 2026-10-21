/**
 * Vẽ cảnh "Dựng chốt an toàn ban đêm" (mô-đun M6, tệp mới của GĐ-T15; không sửa tệp M6 cũ): đoạn đường
 * ban đêm nhìn từ trên xuống, đoạn khuất (khúc cua, đỉnh dốc), giao lộ, vật của chốt (cọc, biển tạm, đèn
 * cảnh báo, xe tuần tra, chiến sĩ và vùng nguy hiểm), xe có đèn pha, dấu phanh gấp.
 *
 * Cảnh là sơ đồ: dọc đường theo tỷ lệ của khung (CanhTrenXuong), ngang đường chia 4 cột bằng nhau (lề
 * trái, làn trái, làn phải, lề phải) để ô chạm đủ rộng trên màn 360 px; lề hẹp vẽ phần nhựa hẹp lại.
 * Hình vector đơn giản tự vẽ, không logo, không phù hiệu (GAME_DESIGN §1.5, §5.15 "Hình cần bổ sung").
 * Xe và chiến sĩ vẽ bằng ve-xe-tren-cao.ts: mỗi loại xe một dáng (ô tô con, xe tải, xe khách, xe máy có người
 * lái), xe tuần tra có dàn đèn nóc, chiến sĩ đứng (áo phản quang, mũ kê-pi, giơ gậy chỉ huy phát sáng).
 * Giảm chuyển động: đèn cảnh báo sáng tĩnh, không nhấp nháy.
 */
import type { Xe } from "../../../../../packages/dao-tao/src/mo-phong/xe.ts";
import { type BoTriChot, type DeChotDem, sinhDongXe } from "../chot-dem";
import { type BienDoi, noiSuy, raY } from "./bien-doi";
import { type LoaiXeTren, veChienSi, veXeTrenCao } from "./ve-xe-tren-cao";

/** Lề trong mỗi bên, px. */
const LE_PX = 6;
const NEN = "#0d1218";
const NHUA = "#272d36";
const LE = "#1c232c";
const CO = "#132a1c";
const VACH = "#d6dbe2";
const CAM = "#ff8a1f";
const DO = "#ff5a4e";
const VANG = "#ffd84a";

/** Bề rộng một cột, px. */
export const rongCot = (bd: BienDoi) => (bd.rong - 2 * LE_PX) / 4;
/** Mép trái cột `i` (0 lề trái … 3 lề phải), px. */
export const traiCot = (bd: BienDoi, i: number) => LE_PX + i * rongCot(bd);

/** Tọa độ x bản đồ (cm) → px, tuyến tính trong từng cột. */
export function xPx(bd: BienDoi, d: Pick<DeChotDem, "rong_le_cm">, x: number): number {
  const w = rongCot(bd);
  if (x < -350) return traiCot(bd, 0) + (w * Math.max(0, x + 450)) / 100;
  if (x < 0) return traiCot(bd, 1) + (w * (x + 350)) / 350;
  if (x < 350) return traiCot(bd, 2) + (w * x) / 350;
  return traiCot(bd, 3) + (w * Math.min(d.rong_le_cm, x - 350)) / d.rong_le_cm;
}

/** Tâm y (px) của vị trí `m`. */
export const yM = (bd: BienDoi, d: Pick<DeChotDem, "dai_m">, m: number) => raY(bd, (d.dai_m - m) * 100);

export const CHI_SO_COT: Record<string, number> = { le_trai: 0, lan_1: 1, lan_2: 2, le_phai: 3 };

/** Nền đêm, mặt đường, vạch, đoạn khuất, giao lộ, chốt. */
export function veDuongDem(ctx: CanvasRenderingContext2D, bd: BienDoi, d: DeChotDem) {
  const w = rongCot(bd);
  ctx.fillStyle = NEN;
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  ctx.fillStyle = CO;
  ctx.fillRect(traiCot(bd, 0), 0, w, bd.cao);
  ctx.fillRect(traiCot(bd, 3), 0, w, bd.cao);
  ctx.fillStyle = LE;
  ctx.fillRect(traiCot(bd, 0) + w * 0.4, 0, w * 0.6, bd.cao);
  ctx.fillRect(traiCot(bd, 3), 0, (w * Math.min(300, d.rong_le_cm)) / 300, bd.cao);
  ctx.fillStyle = NHUA;
  ctx.fillRect(traiCot(bd, 1), 0, 2 * w, bd.cao);
  if (d.giao_lo) {
    const t = yM(bd, d, d.giao_lo.m + 6);
    ctx.fillRect(0, t, bd.rong, yM(bd, d, d.giao_lo.m - 6) - t);
  }
  ctx.strokeStyle = VACH;
  ctx.lineWidth = 2;
  for (const i of [1, 3]) {
    ctx.beginPath();
    ctx.moveTo(traiCot(bd, i), 0);
    ctx.lineTo(traiCot(bd, i), bd.cao);
    ctx.stroke();
  }
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(traiCot(bd, 2), 0);
  ctx.lineTo(traiCot(bd, 2), bd.cao);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "600 12px system-ui, sans-serif";
  for (const k of d.khuat) {
    const t = yM(bd, d, k.m_den);
    const h = yM(bd, d, k.m_tu) - t;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, t, bd.rong, h);
    ctx.strokeStyle = "rgba(214,219,226,0.5)";
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(1, t, bd.rong - 2, h);
    ctx.setLineDash([]);
    ctx.fillStyle = VACH;
    ctx.fillText(
      k.loai === "cong" ? `Khúc cua ${k.muc === 2 ? "gắt" : "thoải"}` : "Đỉnh dốc",
      traiCot(bd, 0) + 2,
      t + 14,
    );
  }
  // Chốt: vạch đứt màu cam ngang làn thu hẹp.
  const yc = yM(bd, d, d.chot_m);
  const xc = traiCot(bd, CHI_SO_COT[d.lan_dong]!);
  ctx.strokeStyle = CAM;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(xc, yc);
  ctx.lineTo(xc + w, yc);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = CAM;
  ctx.fillText("CHỐT", xc + 4, yc - 4);
}

/** Vật của chốt theo bố trí. `sang`: đèn đang sáng (nhấp nháy); giảm chuyển động thì luôn sáng. */
export function veVatChot(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  d: DeChotDem,
  bt: BoTriChot,
  sang: boolean,
  nguy: ReadonlySet<string>,
  chon: string | null,
) {
  const loaiCua = new Map(d.tui.map((v) => [v.id, v.loai]));
  const w = rongCot(bd);
  const vung = (150 * w) / 350;
  // Vùng nguy hiểm vẽ trước để vật nằm trên.
  for (const [id, p] of Object.entries(bt)) {
    if (loaiCua.get(id) !== "cs") continue;
    ctx.beginPath();
    ctx.ellipse(
      traiCot(bd, CHI_SO_COT[p.cot]!) + w / 2,
      yM(bd, d, p.m),
      vung,
      Math.max(8, vung / 2),
      0,
      0,
      7,
    );
    ctx.fillStyle = nguy.has(id) ? "rgba(255,90,78,0.35)" : "rgba(255,216,74,0.14)";
    ctx.fill();
    ctx.strokeStyle = nguy.has(id) ? DO : "rgba(255,216,74,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const [id, p] of Object.entries(bt)) {
    const x = traiCot(bd, CHI_SO_COT[p.cot]!) + w / 2;
    const y = yM(bd, d, p.m);
    ctx.save();
    ctx.translate(x, y);
    switch (loaiCua.get(id)) {
      case "coc":
        veCocTieu(ctx);
        break;
      case "bien":
        // Biển tạm tam giác; quay sai hướng thì xoay theo hướng và vẽ mờ.
        ctx.rotate((p.huong * Math.PI) / 2);
        ctx.globalAlpha = p.huong ? 0.55 : 1;
        veBienTam(ctx);
        break;
      case "den":
        veDenCanhBao(ctx, sang);
        break;
      case "xe": {
        // Xe tuần tra: đầu xe ở vị trí đặt, thân lùi về phía xe tới; dàn đèn nóc xanh đỏ, không chữ, không logo.
        const dai = Math.max(26, 500 * bd.ty);
        ctx.translate(0, dai / 2);
        veXeTrenCao(ctx, "tuan_tra", Math.min(w * 0.6, 20), dai, { son: "#f4f6f8", dem: true, phaDen: sang });
        break;
      }
      case "cs":
        // Chiến sĩ dạng biểu tượng đứng; gậy chỉ huy sáng theo nhịp đèn.
        veChienSi(ctx, 13, sang);
        break;
    }
    ctx.restore();
    if (id === chon) {
      ctx.strokeStyle = "#7cc4ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 15, y - 15, 30, 30);
    }
  }
}

/** Cọc tiêu (nón giao thông) nhìn nghiêng: thân cam, hai vòng phản quang, đế vuông tối. */
function veCocTieu(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255,138,31,0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#2a2f36";
  ctx.fillRect(-8, 6, 16, 3);
  ctx.fillStyle = CAM;
  ctx.beginPath();
  ctx.moveTo(-1.5, -10);
  ctx.lineTo(1.5, -10);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4f6f8";
  ctx.beginPath();
  ctx.moveTo(-2.6, -5.5);
  ctx.lineTo(2.6, -5.5);
  ctx.lineTo(3.4, -2.5);
  ctx.lineTo(-3.4, -2.5);
  ctx.closePath();
  ctx.moveTo(-4.1, 0);
  ctx.lineTo(4.1, 0);
  ctx.lineTo(4.9, 3);
  ctx.lineTo(-4.9, 3);
  ctx.closePath();
  ctx.fill();
}

/** Biển báo tạm: tam giác viền đỏ nền vàng nhạt, dấu chấm than, chân chữ A. */
function veBienTam(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "#8b939e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, 7);
  ctx.lineTo(-7, 14);
  ctx.moveTo(4, 7);
  ctx.lineTo(7, 14);
  ctx.stroke();
  ctx.fillStyle = "#fff4c2";
  ctx.strokeStyle = DO;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(11, 8);
  ctx.lineTo(-11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineJoin = "miter";
  ctx.fillStyle = "#1b1f24";
  ctx.fillRect(-1.2, -5, 2.4, 6.5);
  ctx.fillRect(-1.2, 3, 2.4, 2.2);
}

/** Đèn cảnh báo trên chân: chụp đèn vàng hổ phách; sáng thì có quầng và tia. */
function veDenCanhBao(ctx: CanvasRenderingContext2D, sang: boolean) {
  if (sang) {
    const g = ctx.createRadialGradient(0, -2, 0, 0, -2, 18);
    g.addColorStop(0, "rgba(255,216,74,0.55)");
    g.addColorStop(1, "rgba(255,216,74,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -2, 18, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,216,74,0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const a of [-2.4, -1.57, -0.74]) {
      ctx.moveTo(Math.cos(a) * 9, -2 + Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a) * 13, -2 + Math.sin(a) * 13);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#2a2f36";
  ctx.fillRect(-6, 4, 12, 4);
  ctx.fillRect(-1.5, 1, 3, 4);
  ctx.fillStyle = sang ? VANG : "#7a6a25";
  ctx.beginPath();
  ctx.arc(0, -1, 5.5, Math.PI, 0);
  ctx.lineTo(5.5, 2);
  ctx.lineTo(-5.5, 2);
  ctx.closePath();
  ctx.fill();
  if (sang) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(-1.8, -3, 1.5, 0, 7);
    ctx.fill();
  }
}

/** Cỡ xe trên màn (rộng, dài), px: sơ đồ, không đúng tỷ lệ dọc. */
const CO_XE: Record<LoaiXeTren, [number, number]> = {
  o_to: [16, 26],
  xe_tai: [20, 38],
  xe_khach: [20, 40],
  xe_may: [9, 16],
  xe_uu_tien: [17, 28],
  tuan_tra: [17, 28],
};

/** Màu sơn theo id xe (cố định như sơn thật, không đổi theo giao diện), để dòng xe trông như ngoài đường. */
const SON: Record<LoaiXeTren, readonly string[]> = {
  o_to: ["#e9edf1", "#a7aeb6", "#c62828", "#1f5fbf", "#3a3f47", "#d9a634", "#2e7d32"],
  xe_may: ["#c62828", "#1f5fbf", "#2a2e35", "#e9edf1", "#a7aeb6"],
  xe_tai: ["#2f67a8", "#e9edf1", "#3d8a57", "#b83a2e"],
  xe_khach: ["#e9edf1", "#2f67a8", "#d9a634"],
  xe_uu_tien: ["#f4f6f8"],
  tuan_tra: ["#f4f6f8"],
};
const bamId = (id: string) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Loại xe hiện cho người chơi theo id (xe khách chạy trong M5 như xe tải): tính lại từ dòng xe của đề. */
const loaiHienCache = new WeakMap<DeChotDem, Map<string, LoaiXeTren>>();
function loaiHien(d: DeChotDem, x: Xe): LoaiXeTren {
  let m = loaiHienCache.get(d);
  if (!m) {
    m = new Map();
    try {
      for (const xe of sinhDongXe(d)) m.set(xe.khoi_tao.id, xe.loai);
    } catch {
      // Đề thiếu dòng xe: vẽ theo loại của bộ mô phỏng.
    }
    loaiHienCache.set(d, m);
  }
  return m.get(x.id) ?? x.loai;
}

/** Xe ban đêm: vệt đèn pha, thân xe viền sáng (tương phản ≥ 3:1 với mặt đường tối), đèn hậu, đèn phanh. */
export function veXeDem(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  d: DeChotDem,
  truoc: readonly Xe[],
  sau: readonly Xe[],
  alpha: number,
) {
  const cu = new Map(truoc.map((x) => [x.id, x]));
  for (const x of sau) {
    if (x.trang_thai === "cho" || x.trang_thai === "da_qua") continue;
    const a = cu.get(x.id);
    const dung = a && a.trang_thai !== "cho";
    const X = xPx(bd, d, dung ? noiSuy(a.x, x.x, alpha) : x.x);
    const Y = raY(bd, dung ? noiSuy(a.y, x.y, alpha) : x.y);
    const loai = loaiHien(d, x);
    const [w, h] = CO_XE[loai];
    // Vệt đèn pha chiếu về phía trước (lên trên), nhạt dần.
    const may = loai === "xe_may";
    const tam = may ? 34 : 48;
    const g = ctx.createLinearGradient(0, Y, 0, Y - tam);
    g.addColorStop(0, "rgba(255,240,180,0.32)");
    g.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(X - w * 0.4, Y);
    ctx.lineTo(X - w * (may ? 0.9 : 1.1), Y - tam);
    ctx.lineTo(X + w * (may ? 0.9 : 1.1), Y - tam);
    ctx.lineTo(X + w * 0.4, Y);
    ctx.fill();
    const bang = SON[loai];
    ctx.save();
    ctx.translate(X, Y + h / 2);
    veXeTrenCao(ctx, loai, w, h, {
      son: bang[bamId(x.id) % bang.length]!,
      dem: true,
      phanh: Boolean(a && x.v < a.v),
      muBaoHiem: x.mu_bao_hiem,
    });
    ctx.restore();
  }
}

/** Dấu chỗ xe phanh gấp hoặc vào vùng nguy hiểm. */
export function veDauSuCo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = DO;
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x + 8, y + 6);
  ctx.lineTo(x - 8, y + 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 1, y - 4, 2, 6);
}
