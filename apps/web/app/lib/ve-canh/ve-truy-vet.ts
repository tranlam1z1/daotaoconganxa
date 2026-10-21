/**
 * Vẽ đoạn cảnh camera của trò "Truy vết xe bỏ trốn" (GĐ-T17; tệp mới của M6, không sửa tệp M6 cũ): ngã tư nhìn
 * từ trên cao quanh ô camera: mái nhà, vỉa hè, các nhánh đường có vạch giữa và vạch đi bộ; xe theo màu thật,
 * mỗi loại một dáng (ve-xe-tren-cao.ts: ô tô con có kính lái, nóc; xe tải ca-bin và thùng; xe máy có người lái),
 * viền tương phản để xe tối màu vẫn thấy trên mặt đường; xe đang chọn và xe đã khóa có vòng đánh dấu.
 */
import type { Xe } from "../../../../../packages/dao-tao/src/mo-phong/xe.ts";
import type { DoanCanh, HuongO, MauXeTV } from "../truy-vet";
import { type BienDoi, noiSuy, raX, raY } from "./bien-doi";
import type { BangMau } from "./mau";
import { veXeTrenCao } from "./ve-xe-tren-cao";

/** Màu thân xe (màu vật, không đổi theo giao diện sáng/tối). */
export const MAU_THAN_XE: Record<MauXeTV, string> = {
  trang: "#f3f3f0",
  den: "#1d2025",
  bac: "#a7aeb6",
  do: "#c62828",
  xanh_duong: "#1f5fbf",
  vang: "#e3b30c",
  xanh_la: "#2e7d32",
};

const NUA_DUONG_CM = 350;
const CANH_CM = 3_000;
const DON: Record<HuongO, [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

/** Kích thước xe trên màn hình, px: theo cỡ thật nhưng không nhỏ hơn mức chạm được bằng mắt. */
function coXe(bd: BienDoi, loai: Xe["loai"]): [number, number] {
  const [dai, rong] = loai === "xe_tai" ? [700, 240] : loai === "xe_may" ? [200, 80] : [450, 180];
  // Xe máy được vẽ to hơn tỷ lệ thật để thấy màu thân xe và người lái.
  return [
    Math.max(loai === "xe_may" ? 8 : 10, rong * bd.tx),
    Math.max(loai === "xe_may" ? 15 : 22, dai * bd.ty),
  ];
}

/** Vị trí (px) giữa thân xe, nội suy giữa hai nhịp; null khi xe chưa vào hoặc đã ra khỏi đường. */
export function tamXePx(bd: BienDoi, truoc: Xe | undefined, sau: Xe, alpha: number): [number, number] | null {
  if (sau.trang_thai === "cho" || sau.trang_thai === "da_qua") return null;
  const a = truoc && truoc.trang_thai !== "cho" ? truoc : sau;
  const x = raX(bd, noiSuy(a.x, sau.x, alpha));
  const y = raY(bd, noiSuy(a.y, sau.y, alpha));
  const [, dai] = coXe(bd, sau.loai);
  // Tọa độ của xe là đầu xe; giữa thân lùi nửa thân theo hướng ngược.
  const r = (sau.huong * Math.PI) / 4;
  return [x - (Math.sin(r) * dai) / 2, y + (Math.cos(r) * dai) / 2];
}

export interface VeDoanCanh {
  doan: DoanCanh;
  truoc: readonly Xe[];
  sau: readonly Xe[];
  alpha: number;
  m: BangMau;
  chon: string | null;
  khoa: string | null;
}

export function veDoanCanh(ctx: CanvasRenderingContext2D, bd: BienDoi, v: VeDoanCanh) {
  const rect = (x0: number, y0: number, x1: number, y1: number) =>
    ctx.fillRect(
      raX(bd, Math.min(x0, x1)),
      raY(bd, Math.min(y0, y1)),
      Math.abs(x1 - x0) * bd.tx,
      Math.abs(y1 - y0) * bd.ty,
    );
  // Nền khu nhà: mái nhà nhiều màu, xếp theo lô, có cây xanh xen kẽ (tất định theo vị trí).
  ctx.fillStyle = "#cfc8b8";
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  const MAI = ["#b5654a", "#9aa3ad", "#c99a5b", "#8f7f6b", "#a4483a", "#7f8c8d"];
  const oNha = 900;
  for (let i = 0, x = -CANH_CM; x < CANH_CM; i++, x += oNha)
    for (let j = 0, y = -CANH_CM; y < CANH_CM; j++, y += oNha) {
      const k = i * 7 + j * 13;
      ctx.fillStyle = MAI[k % MAI.length]!;
      rect(x + 60, y + 60, x + oNha - 60, y + oNha - 60);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      rect(x + 60, y + oNha / 2 - 15, x + oNha - 60, y + oNha / 2 + 15);
      if (k % 3 === 0) {
        ctx.fillStyle = "#5d8a4e";
        ctx.beginPath();
        ctx.arc(raX(bd, x + 30), raY(bd, y + 30), Math.max(3, 140 * bd.tx), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  // Vỉa hè hai bên các nhánh và quanh ngã tư.
  ctx.fillStyle = "#e3ddd0";
  const he = NUA_DUONG_CM + 200;
  rect(-he, -he, he, he);
  for (const h of v.doan.nhanh) {
    const [dx, dy] = DON[h];
    if (dx) rect(0, -he, dx * (CANH_CM + 200), he);
    else rect(-he, 0, he, dy * (CANH_CM + 200));
  }
  // Mặt đường: các nhánh và ô ngã tư.
  ctx.fillStyle = "#4b5058";
  rect(-NUA_DUONG_CM, -NUA_DUONG_CM, NUA_DUONG_CM, NUA_DUONG_CM);
  for (const h of v.doan.nhanh) {
    const [dx, dy] = DON[h];
    if (dx) rect(0, -NUA_DUONG_CM, dx * (CANH_CM + 200), NUA_DUONG_CM);
    else rect(-NUA_DUONG_CM, 0, NUA_DUONG_CM, dy * (CANH_CM + 200));
  }
  // Vạch giữa đường (nét đứt) và vạch đi bộ qua đường ở đầu mỗi nhánh.
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const h of v.doan.nhanh) {
    const [dx, dy] = DON[h];
    for (let s = NUA_DUONG_CM + 650; s < CANH_CM; s += 500) {
      if (dx) rect(dx * s, -12, dx * (s + 250), 12);
      else rect(-12, dy * s, 12, dy * (s + 250));
    }
    for (let c = -NUA_DUONG_CM + 40; c < NUA_DUONG_CM - 40; c += 100) {
      const s0 = NUA_DUONG_CM + 60;
      const s1 = NUA_DUONG_CM + 360;
      if (dx) rect(dx * s0, c, dx * s1, c + 50);
      else rect(c, dy * s0, c + 50, dy * s1);
    }
  }
  // Xe.
  const cu = new Map(v.truoc.map((x) => [x.id, x]));
  const xeDoan = new Map(v.doan.xe.map((x) => [x.id, x]));
  for (const x of v.sau) {
    const tam = tamXePx(bd, cu.get(x.id), x, v.alpha);
    if (!tam) continue;
    const [w, h] = coXe(bd, x.loai);
    const mau = xeDoan.get(x.id)?.mau ?? "bac";
    ctx.save();
    ctx.translate(tam[0], tam[1]);
    ctx.rotate((x.huong * Math.PI) / 4);
    veXeTrenCao(ctx, x.loai, w, h, {
      son: MAU_THAN_XE[mau],
      bong: true,
      // Xe sáng màu viền tối, xe tối màu viền sáng: xe đen vẫn nổi trên mặt đường xám.
      vien: mau === "trang" || mau === "vang" || mau === "bac" ? "#2a2e34" : "#f4f4f2",
    });
    ctx.restore();
    if (x.id === v.chon || x.id === v.khoa) {
      ctx.save();
      ctx.strokeStyle = x.id === v.khoa ? v.m.nguy : v.m.canhBao;
      ctx.lineWidth = 3;
      if (x.id !== v.khoa) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(tam[0], tam[1], Math.max(w, h) / 2 + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
