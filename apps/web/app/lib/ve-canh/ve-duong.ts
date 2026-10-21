/**
 * Vẽ đoạn đường thẳng đi lên và các đặc điểm của nó (mô-đun M6). Hình vector đơn giản tự vẽ theo
 * VISUAL_STYLE (GAME_DESIGN §1.5); danh sách hình cần thay ở GAME_DESIGN §5.3 "Hình cần bổ sung".
 */
import type { LoaiDacDiem } from "../../../../../packages/dao-tao/src/mo-phong/duong.ts";
import { type BienDoi, raX, raY } from "./bien-doi";
import type { BangMau } from "./mau";

/** Bề rộng mặt đường hai làn, cm. */
export const RONG_DUONG_CM = 700;

export interface DoanVe {
  soO: number;
  oCm: number;
  dacDiem: ReadonlyArray<{ o: number; loai: LoaiDacDiem }>;
}

/** Đỉnh (y nhỏ) và đáy của ô `o`, px. Ô 0 ở dưới cùng. */
export function bienO(bd: BienDoi, d: Pick<DoanVe, "soO" | "oCm">, o: number) {
  return { tren: raY(bd, (d.soO - o - 1) * d.oCm), duoi: raY(bd, (d.soO - o) * d.oCm) };
}

function hinhNon(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, mau: string) {
  ctx.fillStyle = mau;
  ctx.beginPath();
  ctx.moveTo(x, y - c);
  ctx.lineTo(x + c * 0.6, y + c * 0.5);
  ctx.lineTo(x - c * 0.6, y + c * 0.5);
  ctx.closePath();
  ctx.fill();
}

function veDacDiem(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  loai: LoaiDacDiem,
  tren: number,
  duoi: number,
) {
  const trai = raX(bd, -RONG_DUONG_CM / 2);
  const phai = raX(bd, RONG_DUONG_CM / 2);
  const giua = (tren + duoi) / 2;
  const cao = duoi - tren;
  const rong = phai - trai;
  ctx.save();
  switch (loai) {
    case "nguoi_di_bo": {
      ctx.fillStyle = m.vach;
      const n = 6;
      for (let i = 0; i < n; i++)
        ctx.fillRect(trai + 4 + (i * (rong - 8)) / n, giua - cao * 0.3, (rong - 8) / n - 4, cao * 0.6);
      break;
    }
    case "truong_hoc": {
      // Ngôi trường bên trái đường: nhà mái dốc, cờ trên nóc.
      const x = trai - 34;
      ctx.fillStyle = m.chinhNhat;
      ctx.strokeStyle = m.chu;
      ctx.lineWidth = 1.5;
      ctx.fillRect(x - 14, giua - 6, 28, 16);
      ctx.strokeRect(x - 14, giua - 6, 28, 16);
      ctx.beginPath();
      ctx.moveTo(x - 17, giua - 6);
      ctx.lineTo(x, giua - 16);
      ctx.lineTo(x + 17, giua - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, giua - 16);
      ctx.lineTo(x, giua - 26);
      ctx.stroke();
      ctx.fillStyle = m.nguy;
      ctx.fillRect(x, giua - 26, 9, 6);
      break;
    }
    case "duong_cong_trai": {
      // Mũi tên cong sang trái trên mặt đường.
      ctx.strokeStyle = m.vach;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      const x = (trai + phai) / 2 + rong * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, duoi - 4);
      ctx.quadraticCurveTo(x, tren + 4, x - rong * 0.36, tren + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - rong * 0.36 + 8, tren - 2);
      ctx.lineTo(x - rong * 0.36, tren + 6);
      ctx.lineTo(x - rong * 0.36 + 8, tren + 14);
      ctx.stroke();
      break;
    }
    case "duong_hep_trai": {
      ctx.fillStyle = m.co;
      ctx.beginPath();
      ctx.moveTo(trai, duoi);
      ctx.lineTo(trai + rong * 0.3, giua + cao * 0.1);
      ctx.lineTo(trai + rong * 0.3, tren);
      ctx.lineTo(trai, tren);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "duong_sat_co_rao":
    case "duong_sat_khong_rao": {
      ctx.fillStyle = m.chuPhu;
      for (let x = trai - 20; x < phai + 20; x += 9) ctx.fillRect(x, giua - 9, 4, 18);
      ctx.fillStyle = m.chu;
      ctx.fillRect(trai - 24, giua - 6, rong + 48, 2.5);
      ctx.fillRect(trai - 24, giua + 4, rong + 48, 2.5);
      if (loai === "duong_sat_co_rao") {
        // Rào chắn sọc đỏ trắng hai bên, mở lên.
        for (const [x, huong] of [
          [trai - 8, 1],
          [phai + 8, -1],
        ] as const) {
          ctx.save();
          ctx.translate(x, giua + cao * 0.35);
          ctx.rotate(huong * -1.2);
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 ? m.mat : m.nguy;
            ctx.fillRect(i * 7 * huong, -2, 7 * huong, 4);
          }
          ctx.restore();
        }
      }
      break;
    }
    case "cong_truong": {
      for (let i = 0; i < 3; i++) hinhNon(ctx, trai + 10 + i * 12, giua - 4 + i * 6, 6, m.canhBao);
      ctx.fillStyle = m.canhBao;
      ctx.fillRect(trai + 2, giua + cao * 0.25, rong * 0.35, 4);
      break;
    }
    case "giao_lo": {
      ctx.fillStyle = m.duong;
      ctx.fillRect(0, giua - cao * 0.32, bd.rong, cao * 0.64);
      ctx.fillStyle = m.vach;
      ctx.fillRect(trai, giua + cao * 0.32, rong, 2);
      break;
    }
    case "vong_xuyen": {
      const x = (trai + phai) / 2;
      const r = Math.min(rong * 0.28, cao * 0.4);
      ctx.fillStyle = m.co;
      ctx.strokeStyle = m.vach;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, giua, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "ben_xe_buyt": {
      const x = phai + 26;
      ctx.fillStyle = m.chinh;
      ctx.fillRect(x - 12, giua - 8, 24, 16);
      ctx.fillStyle = m.mat;
      ctx.fillRect(x - 9, giua - 5, 18, 5);
      break;
    }
  }
  ctx.restore();
}

/** Vẽ nền, mặt đường, vạch giữa và các đặc điểm. */
export function veDoanDuong(ctx: CanvasRenderingContext2D, bd: BienDoi, m: BangMau, d: DoanVe) {
  ctx.fillStyle = m.nen;
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  const trai = raX(bd, -RONG_DUONG_CM / 2);
  const phai = raX(bd, RONG_DUONG_CM / 2);
  ctx.fillStyle = m.co;
  ctx.fillRect(trai - 14, 0, 14, bd.cao);
  ctx.fillRect(phai, 0, 14, bd.cao);
  ctx.fillStyle = m.duong;
  ctx.fillRect(trai, 0, phai - trai, bd.cao);
  // Đặc điểm cắt ngang đường (giao lộ) vẽ trước vạch giữa.
  for (const dd of d.dacDiem) {
    const { tren, duoi } = bienO(bd, d, dd.o);
    veDacDiem(ctx, bd, m, dd.loai, tren, duoi);
  }
  ctx.strokeStyle = m.vach;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo((trai + phai) / 2, 0);
  ctx.lineTo((trai + phai) / 2, bd.cao);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Cột biển và ảnh biển tại một điểm (px). */
export function veCotBien(
  ctx: CanvasRenderingContext2D,
  m: BangMau,
  x: number,
  y: number,
  anh: ReadonlyArray<CanvasImageSource | undefined>,
) {
  const c = 26;
  ctx.fillStyle = m.chu;
  ctx.fillRect(x - 1.5, y, 3, 12);
  anh.forEach((a, i) => {
    const yy = y - c - i * (c + 2);
    if (a) ctx.drawImage(a, x - c / 2, yy, c, c);
    else {
      ctx.strokeStyle = m.chu;
      ctx.strokeRect(x - c / 2, yy, c, c);
    }
  });
}

/** Dấu cảnh báo (tam giác chấm than) tại chỗ xảy ra tình huống nguy hiểm. */
export function veDauNguyHiem(ctx: CanvasRenderingContext2D, m: BangMau, x: number, y: number, doDam = 1) {
  ctx.save();
  ctx.globalAlpha = doDam;
  ctx.fillStyle = m.nguy;
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x + 12, y + 9);
  ctx.lineTo(x - 12, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = m.mat;
  ctx.fillRect(x - 1.5, y - 5, 3, 8);
  ctx.fillRect(x - 1.5, y + 5, 3, 2.5);
  ctx.restore();
}
