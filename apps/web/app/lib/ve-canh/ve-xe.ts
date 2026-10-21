/**
 * Vẽ xe của bộ mô phỏng M5 (mô-đun M6): hình chữ nhật bo góc theo hướng rời rạc, nội suy vị trí
 * giữa hai nhịp, đèn phanh khi xe đang chậm lại. Cỡ xe theo px (cảnh là sơ đồ, không đúng tỷ lệ).
 */
import type { Xe } from "../../../../../packages/dao-tao/src/mo-phong/xe.ts";
import { type BienDoi, noiSuy, raX, raY } from "./bien-doi";
import type { BangMau } from "./mau";

const CO_XE: Record<Xe["loai"], [number, number]> = {
  o_to: [16, 28],
  xe_tai: [20, 40],
  xe_may: [8, 16],
  xe_uu_tien: [17, 30],
};

function mauXe(m: BangMau, loai: Xe["loai"]) {
  return loai === "xe_tai"
    ? m.chuPhu
    : loai === "xe_may"
      ? m.canhBao
      : loai === "xe_uu_tien"
        ? m.nguy
        : m.chinh;
}

/** Vẽ các xe đang trên đường, nội suy giữa trạng thái nhịp trước và nhịp sau. */
export function veXe(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  truoc: readonly Xe[],
  sau: readonly Xe[],
  alpha: number,
) {
  const cu = new Map(truoc.map((x) => [x.id, x]));
  for (const x of sau) {
    if (x.trang_thai === "cho" || x.trang_thai === "da_qua") continue;
    const a = cu.get(x.id);
    const X = raX(bd, a && a.trang_thai !== "cho" ? noiSuy(a.x, x.x, alpha) : x.x);
    const Y = raY(bd, a && a.trang_thai !== "cho" ? noiSuy(a.y, x.y, alpha) : x.y);
    const [w, h] = CO_XE[x.loai];
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate((x.huong * Math.PI) / 4);
    // Tọa độ xe là đầu xe; thân xe kéo về phía sau.
    ctx.fillStyle = mauXe(m, x.loai);
    ctx.beginPath();
    ctx.roundRect(-w / 2, 0, w, h, 4);
    ctx.fill();
    ctx.fillStyle = m.chinhNhat;
    ctx.fillRect(-w / 2 + 3, 4, w - 6, Math.max(3, h * 0.18));
    if (a && x.v < a.v) {
      ctx.fillStyle = m.nguy;
      ctx.fillRect(-w / 2 + 1, h - 3, 4, 3);
      ctx.fillRect(w / 2 - 5, h - 3, 4, 3);
    }
    ctx.restore();
  }
}
