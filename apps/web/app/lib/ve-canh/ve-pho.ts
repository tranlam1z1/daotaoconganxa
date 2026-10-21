/**
 * Vẽ khu phố dạng ô từ trên xuống cho trò "Tự lái qua phố" (mô-đun M6, phần mở rộng của GĐ-T9):
 * nhà, mặt đường, vạch, vạch người đi bộ, vạch dừng, đèn, biển, người đi bộ, xe khác (qua `veXe`),
 * xe người chơi có xi nhan và đèn phanh. Hình vector đơn giản tự vẽ theo VISUAL_STYLE; danh sách hình
 * cần thay ở GAME_DESIGN §5.9 "Hình cần bổ sung". Hàm vẽ được dùng góc quay (chỉ để vẽ, không vào
 * logic mô phỏng).
 */
import type { TheGioi, TrangThaiPho } from "../tu-lai";
import { HUONG_THEO_TEN, mauDenPho, viTriNguoiDiBo } from "../tu-lai";
import { type BienDoi, noiSuy, raX, raY } from "./bien-doi";
import type { BangMau } from "./mau";
import { veXe } from "./ve-xe";

const O = 1000;
const VIA = 150;
const BUOC: Record<number, [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };
const laDuongKt = (ch: string) => "-|+<>^v".includes(ch) && ch !== "";
const ngang = (ch: string) => ch === "-" || ch === "<" || ch === ">";

function kt(the: TheGioi, r: number, c: number) {
  return r < 0 || r >= the.hang ? "#" : (the.luoi[r]![c] ?? "#");
}

/** Góc quay (radian) của hướng rời rạc, 0 là lên. */
const gocHuong = (h: number) => (h * Math.PI) / 4;

function hcn(ctx: CanvasRenderingContext2D, bd: BienDoi, x1: number, y1: number, x2: number, y2: number) {
  ctx.fillRect(raX(bd, x1), raY(bd, y1), (x2 - x1) * bd.tx, (y2 - y1) * bd.ty);
}

/** Nền khu phố: nhà, mặt đường, vạch kẻ, vạch người đi bộ, vạch dừng, đích. */
export function veNenPho(ctx: CanvasRenderingContext2D, bd: BienDoi, m: BangMau, the: TheGioi) {
  ctx.fillStyle = m.nen;
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  const c0 = Math.max(0, Math.floor(bd.x0 / O));
  const c1 = Math.min(the.cot - 1, Math.floor((bd.x0 + bd.rong / bd.tx) / O));
  const r0 = Math.max(0, Math.floor(bd.y0 / O));
  const r1 = Math.min(the.hang - 1, Math.floor((bd.y0 + bd.cao / bd.ty) / O));

  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const ch = kt(the, r, c);
      const x = c * O;
      const y = r * O;
      if (!laDuongKt(ch)) {
        // Khối nhà, trường, chợ, công viên.
        ctx.fillStyle = ch === "V" ? m.co : m.chinhNhat;
        hcn(ctx, bd, x + 80, y + 80, x + O - 80, y + O - 80);
        if (ch === "T" || ch === "C") {
          ctx.fillStyle = ch === "T" ? m.nguy : m.canhBao;
          hcn(ctx, bd, x + 380, y + 300, x + 620, y + 450);
        } else if (ch === "V") {
          ctx.fillStyle = m.dat;
          for (const [a, b] of [
            [300, 300],
            [700, 400],
            [450, 700],
          ] as const)
            ctx.fillRect(raX(bd, x + a) - 3, raY(bd, y + b) - 3, 6, 6);
        }
        continue;
      }
      ctx.fillStyle = m.duong;
      const doc = ch === "|" || ch === "^" || ch === "v";
      const coNgang = ch === "+" ? laDuongKt(kt(the, r, c - 1)) || laDuongKt(kt(the, r, c + 1)) : !doc;
      const coDoc = ch === "+" ? laDuongKt(kt(the, r - 1, c)) || laDuongKt(kt(the, r + 1, c)) : doc;
      if (ch === "+") hcn(ctx, bd, x + VIA, y + VIA, x + O - VIA, y + O - VIA);
      if (coNgang)
        hcn(
          ctx,
          bd,
          ch === "+" && !laDuongKt(kt(the, r, c - 1)) ? x + VIA : x,
          y + VIA,
          ch === "+" && !laDuongKt(kt(the, r, c + 1)) ? x + O - VIA : x + O,
          y + O - VIA,
        );
      if (coDoc)
        hcn(
          ctx,
          bd,
          x + VIA,
          ch === "+" && !laDuongKt(kt(the, r - 1, c)) ? y + VIA : y,
          x + O - VIA,
          ch === "+" && !laDuongKt(kt(the, r + 1, c)) ? y + O - VIA : y + O,
        );
      if (ch === "+") continue;
      // Vạch giữa: nét đứt; đường hai chiều vạch trắng, một chiều vạch chia làn và mũi tên.
      ctx.strokeStyle = m.vach;
      ctx.lineWidth = Math.max(1, 12 * bd.tx);
      ctx.setLineDash([Math.max(3, 150 * bd.tx), Math.max(3, 150 * bd.tx)]);
      ctx.beginPath();
      if (doc) {
        ctx.moveTo(raX(bd, x + O / 2), raY(bd, y));
        ctx.lineTo(raX(bd, x + O / 2), raY(bd, y + O));
      } else {
        ctx.moveTo(raX(bd, x), raY(bd, y + O / 2));
        ctx.lineTo(raX(bd, x + O), raY(bd, y + O / 2));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const mc = ch === ">" ? 2 : ch === "<" ? 6 : ch === "^" ? 0 : ch === "v" ? 4 : null;
      if (mc !== null) {
        ctx.fillStyle = m.vach;
        for (const l of [-1, 1]) {
          const [dx, dy] = BUOC[mc]!;
          const cx = x + O / 2 + (dy !== 0 ? l * 175 : 0);
          const cy = y + O / 2 + (dx !== 0 ? l * 175 : 0);
          ctx.save();
          ctx.translate(raX(bd, cx), raY(bd, cy));
          ctx.rotate(gocHuong(mc));
          const s = Math.max(4, 90 * bd.tx);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.6, 0);
          ctx.lineTo(-s * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(-s * 0.2, 0, s * 0.4, s);
          ctx.restore();
        }
      }
    }

  // Vạch người đi bộ: vạch sọc song song chiều xe chạy.
  ctx.fillStyle = m.vach;
  for (const v of the.bd.vach_di_bo) {
    const [r, c] = v.o;
    if (r < r0 - 1 || r > r1 + 1 || c < c0 - 1 || c > c1 + 1) continue;
    const x = c * O;
    const y = r * O;
    for (let k = 0; k < 6; k++) {
      const a = VIA + 20 + k * 115;
      if (ngang(kt(the, r, c))) hcn(ctx, bd, x + 350, y + a, x + 650, y + a + 60);
      else hcn(ctx, bd, x + a, y + 350, x + a + 60, y + 650);
    }
  }

  // Vạch dừng ở nơi giao nhau có đèn.
  for (const d of the.bd.den) {
    const [r, c] = d.o;
    for (const h of [0, 2, 4, 6]) {
      const [dx, dy] = BUOC[h]!;
      if (!laDuongKt(kt(the, r - dy, c - dx))) continue;
      // Làn đi vào nửa bên phải theo chiều đi; vạch ở mép ô.
      const cx = c * O + O / 2 - (dx * O) / 2;
      const cy = r * O + O / 2 - (dy * O) / 2;
      const [px2, py2] = BUOC[(h + 2) % 8]!;
      const a = { x: cx + px2 * 20, y: cy + py2 * 20 };
      const b = { x: cx + px2 * 340, y: cy + py2 * 340 };
      ctx.fillStyle = m.vach;
      hcn(
        ctx,
        bd,
        Math.min(a.x, b.x) - (dx ? 25 : 0),
        Math.min(a.y, b.y) - (dy ? 25 : 0),
        Math.max(a.x, b.x) + (dx ? 25 : 0),
        Math.max(a.y, b.y) + (dy ? 25 : 0),
      );
    }
  }

  // Đích.
  const [dr, dc] = the.bd.dich.o;
  const dx0 = raX(bd, dc * O + O / 2);
  const dy0 = raY(bd, dr * O + O / 2);
  ctx.save();
  ctx.fillStyle = m.dat;
  ctx.globalAlpha = 0.35;
  hcn(ctx, bd, dc * O + VIA, dr * O + VIA, dc * O + O - VIA, dr * O + O - VIA);
  ctx.globalAlpha = 1;
  ctx.fillStyle = m.chu;
  ctx.fillRect(dx0 - 1, dy0 - 16, 2, 18);
  ctx.fillStyle = m.dat;
  ctx.fillRect(dx0 + 1, dy0 - 16, 11, 8);
  ctx.restore();
}

/** Đèn tín hiệu và biển (biển vẽ bằng ảnh đã tải). */
export function veDenBien(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  the: TheGioi,
  nhip: number,
  anh: ReadonlyMap<string, HTMLImageElement>,
  gocCam = 0,
) {
  const c = Math.max(14, Math.min(26, 260 * bd.tx));
  for (const d of the.bd.den) {
    const [r, cc] = d.o;
    for (const h of [0, 2, 4, 6]) {
      const [dx, dy] = BUOC[h]!;
      if (!laDuongKt(kt(the, r - dy, cc - dx))) continue;
      const [px, py] = BUOC[(h + 2) % 8]!;
      // Cột đèn ở góc bên phải, ngay trước nơi giao nhau.
      const x = cc * O + O / 2 - (dx * O) / 2 + px * 440 - dx * 60;
      const y = r * O + O / 2 - (dy * O) / 2 + py * 440 - dy * 60;
      const mau = mauDenPho(d, nhip, h === 0 || h === 4 ? "doc" : "ngang");
      const X = raX(bd, x);
      const Y = raY(bd, y);
      ctx.fillStyle = m.chu;
      ctx.beginPath();
      ctx.roundRect(X - 5, Y - 5, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = mau === "xanh" ? m.dat : mau === "vang" ? m.canhBao : m.nguy;
      ctx.beginPath();
      ctx.arc(X, Y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const b of the.bd.bien) {
    const h = HUONG_THEO_TEN[b.huong];
    const [dx, dy] = BUOC[h]!;
    const [px, py] = BUOC[(h + 2) % 8]!;
    const [r, cc] = b.o;
    const tai = kt(the, r, cc) === "+";
    // Biển ở lề phải, đầu ô theo chiều đi; biển của nơi giao nhau đặt ngay trước nơi giao nhau.
    const lui = tai ? -O / 2 - 150 : -O / 2 + 250;
    const x = cc * O + O / 2 + dx * lui + px * 430;
    const y = r * O + O / 2 + dy * lui + py * 430;
    const X = raX(bd, x);
    const Y = raY(bd, y);
    if (X < -c || Y < -c || X > bd.rong + c || Y > bd.cao + c) continue;
    const a = anh.get(b.ma);
    const lech = the.bd.bien
      .filter((k) => k !== b && k.o[0] === r && k.o[1] === cc && k.huong === b.huong)
      .indexOf(b);
    // Khung nhìn xoay theo xe thì xoay ngược biển để biển luôn đứng thẳng trên màn.
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(gocCam);
    if (a?.complete && a.naturalWidth) ctx.drawImage(a, -c / 2, -c / 2 - Math.max(0, lech) * (c + 2), c, c);
    else {
      ctx.strokeStyle = m.chu;
      ctx.strokeRect(-c / 2, -c / 2, c, c);
    }
    if (b.toc_do && !(a?.complete && a.naturalWidth)) {
      ctx.fillStyle = m.chu;
      ctx.font = `bold ${Math.round(c * 0.45)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(b.toc_do), 0, c * 0.16);
    }
    ctx.restore();
  }
}

/** Người đi bộ: chấm tròn; đang chờ thì đứng ở mép vỉa hè. */
export function veNguoiDiBo(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  the: TheGioi,
  tt: TrangThaiPho,
) {
  tt.di_bo.forEach((d, i) => {
    if (d.tt === "xong") return;
    const p = viTriNguoiDiBo(the.nguoi_di_bo[i]!, d.p);
    ctx.fillStyle = d.tt === "di" ? m.nguy : m.chuPhu;
    ctx.strokeStyle = m.mat;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(raX(bd, p.x), raY(bd, p.y), Math.max(4, 45 * bd.tx), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

/** Xe người chơi: thân xe theo tỷ lệ thật, kính, đèn phanh, xi nhan nhấp nháy. */
export function veXeNguoiChoi(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  truoc: TrangThaiPho,
  sau: TrangThaiPho,
  alpha: number,
  nhayXiNhan: boolean,
) {
  const a = truoc.nguoi.xe;
  const b = sau.nguoi.xe;
  const X = raX(bd, noiSuy(a.x, b.x, alpha) / 10);
  const Y = raY(bd, noiSuy(a.y, b.y, alpha) / 10);
  let d = b.huong - a.huong;
  if (d > 4) d -= 8;
  if (d < -4) d += 8;
  const goc = gocHuong(a.huong + d * alpha);
  const oTo = b.loai === "o_to";
  const w = Math.max(oTo ? 12 : 6, (oTo ? 180 : 80) * bd.tx);
  const h = Math.max(oTo ? 24 : 14, (oTo ? 450 : 200) * bd.ty);
  ctx.save();
  ctx.translate(X, Y);
  ctx.rotate(goc);
  ctx.fillStyle = m.dat;
  ctx.strokeStyle = m.mat;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, 0, w, h, oTo ? 4 : 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = m.mat;
  ctx.fillRect(-w / 2 + 2, h * 0.14, w - 4, Math.max(3, h * 0.16));
  if (sau.nguoi.phanh || b.v < a.v) {
    ctx.fillStyle = m.nguy;
    ctx.fillRect(-w / 2, h - 3, Math.max(3, w * 0.3), 3);
    ctx.fillRect(w / 2 - Math.max(3, w * 0.3), h - 3, Math.max(3, w * 0.3), 3);
  }
  const xn = sau.nguoi.xi_nhan;
  if (xn && nhayXiNhan) {
    ctx.fillStyle = m.canhBao;
    const x = xn === "trai" ? -w / 2 - 2 : w / 2 - 2;
    ctx.fillRect(x, 0, 4, 5);
    ctx.fillRect(x, h - 5, 4, 5);
  }
  ctx.restore();
}

/**
 * Toàn cảnh động: đèn, biển, người đi bộ, xe khác, xe người chơi. `gocCam`: góc khung nhìn đang xoay
 * (radian), để biển vẽ đứng thẳng.
 */
export function veCanhPho(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  the: TheGioi,
  truoc: TrangThaiPho,
  sau: TrangThaiPho,
  alpha: number,
  anh: ReadonlyMap<string, HTMLImageElement>,
  nhayXiNhan: boolean,
  gocCam = 0,
) {
  veNenPho(ctx, bd, m, the);
  veDenBien(ctx, bd, m, the, sau.nhip, anh, gocCam);
  veNguoiDiBo(ctx, bd, m, the, sau);
  veXe(ctx, bd, m, truoc.mp.xe, sau.mp.xe, alpha);
  veXeNguoiChoi(ctx, bd, m, truoc, sau, alpha, nhayXiNhan);
}

/** Vết đường đã đi (cm, cặp x y) và chấm lỗi đánh số. */
export function veVetVaLoi(
  ctx: CanvasRenderingContext2D,
  bd: BienDoi,
  m: BangMau,
  vet: readonly number[],
  loi: ReadonlyArray<{ stt: number; x: number; y: number }>,
  chon: number | null,
  gocCam = 0,
) {
  if (vet.length >= 4) {
    ctx.strokeStyle = m.chinh;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(raX(bd, vet[0]!), raY(bd, vet[1]!));
    for (let i = 2; i + 1 < vet.length; i += 2) ctx.lineTo(raX(bd, vet[i]!), raY(bd, vet[i + 1]!));
    ctx.stroke();
  }
  for (const l of loi) {
    const X = raX(bd, l.x);
    const Y = raY(bd, l.y);
    ctx.fillStyle = m.nguy;
    ctx.strokeStyle = m.mat;
    ctx.lineWidth = l.stt === chon ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(X, Y, l.stt === chon ? 11 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = m.mat;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(gocCam);
    ctx.fillText(String(l.stt), 0, 0.5);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";
}
