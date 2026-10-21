/**
 * Vật cản tạm, người đứng trên đường và hàng chờ (mô-đun M5, mở rộng ở GĐ-T15; docs/GAME_DESIGN.md
 * §5.15).
 *
 *  - Vật cản tạm (cọc, biển, đèn đặt trong làn, xe đỗ chiếm làn) chặn một đoạn làn. Xe thấy vật cản
 *    thì sang làn tránh (`lan_tranh`) khi làn đó đủ khoảng trống, không thì dừng trước vật cản chờ.
 *    Làn tránh phải song song và cùng độ dài với làn có vật cản (xe giữ nguyên quãng đường khi sang).
 *  - Người đứng trên đường có vùng nguy hiểm bán kính BAN_KINH_VUNG_NGUY_HIEM_CM: hộp bao xe đi vào
 *    vùng thì phát sự kiện `vao_vung_nguy_hiem` (mỗi cặp xe, người một lần). Người không phải vật cản.
 *  - Hàng chờ: các xe đi chậm nối đuôi nhau trên một làn; `doHangCho` đọc trạng thái, không sửa.
 *
 * Mọi số ở đây là THÔNG SỐ MÔ PHỎNG (GAME_DESIGN §5.15, bảng "Cần đơn vị chuyên môn kiểm tra").
 * Hàm thuần, số nguyên, chạy được ở máy chủ và trình duyệt.
 */
import type { HopBao } from "./mo-phong.ts";
import { KHOANG_CACH_TOI_THIEU_CM, kichThuocXe, type Xe } from "./xe.ts";

export type LoaiVatCan = "coc" | "bien" | "den" | "xe_do";

export interface VatCan {
  id: string;
  loai: LoaiVatCan;
  lan: string;
  /** Đoạn làn bị chặn, quãng đường cm. */
  s_tu: number;
  s_den: number;
  /** Làn song song để xe tránh; null thì xe chỉ dừng chờ. */
  lan_tranh: string | null;
}

export interface NguoiTrenDuong {
  id: string;
  /** Tọa độ trên bản đồ, cm. */
  x: number;
  y: number;
}

/** Bán kính vùng nguy hiểm quanh người đứng trên đường (cm). */
export const BAN_KINH_VUNG_NGUY_HIEM_CM = 150;
/** Xe dừng cách đầu vật cản khoảng này (cm) khi chưa sang làn được. */
export const DUNG_TRUOC_VAT_CAN_CM = 200;
/** Xe bắt đầu tìm chỗ sang làn khi còn cách vật cản chừng này (cm). */
export const XET_CHUYEN_LAN_CM = 4000;
/** Xe phía sau trên làn tránh cần cách đuôi xe sang làn thêm quãng nó đi trong ngần này nhịp (1 giây). */
export const NHIP_NHUONG_CHUYEN_LAN = 20;
/** Xe đi chậm hơn mức này (mm/nhịp, ≈ 10 km/h) tính là đang trong hàng chờ. */
export const TOC_DO_HANG_CHO = 140;
/** Hai xe chậm cách nhau (đuôi xe trước tới đầu xe sau) không quá khoảng này thì cùng một hàng (cm). */
export const KHOANG_HANG_CHO_CM = 1500;

/** Vật cản gần nhất phía trước xe trên làn của xe (đầu xe chưa qua hết vật cản). */
export function vatCanPhiaTruoc(ds: readonly VatCan[], lan: string, sMm: number): VatCan | null {
  let gan: VatCan | null = null;
  for (const v of ds) {
    if (v.lan !== lan || v.s_den * 10 < sMm) continue;
    if (!gan || v.s_tu < gan.s_tu || (v.s_tu === gan.s_tu && v.id < gan.id)) gan = v;
  }
  return gan;
}

/**
 * Làn tránh có đủ chỗ cho xe `x` sang ở quãng đường hiện tại không. `khac` là các xe khác đang trên
 * đường (trạng thái mới nhất đã biết). Làn tránh cũng không được có vật cản ngay tại chỗ sang.
 */
export function coChoChuyenLan(
  x: Pick<Xe, "id" | "s" | "loai" | "kich_thuoc">,
  lanTranh: string,
  khac: ReadonlyArray<Pick<Xe, "id" | "lan" | "s" | "v" | "loai" | "kich_thuoc" | "trang_thai">>,
  vatCan: readonly VatCan[],
): boolean {
  const daiX = kichThuocXe(x).dai * 10;
  const kc = KHOANG_CACH_TOI_THIEU_CM * 10;
  for (const v of vatCan)
    if (v.lan === lanTranh && v.s_tu * 10 - kc <= x.s && v.s_den * 10 + daiX + kc >= x.s) return false;
  for (const o of khac) {
    if (o.id === x.id || o.lan !== lanTranh || o.trang_thai === "cho" || o.trang_thai === "da_qua") continue;
    if (o.s >= x.s) {
      // Xe phía trước: đuôi của nó phải cách đầu xe mình đủ khoảng tối thiểu.
      if (o.s - kichThuocXe(o).dai * 10 - x.s < kc) return false;
    } else if (x.s - daiX - o.s < kc + o.v * NHIP_NHUONG_CHUYEN_LAN) return false;
  }
  return true;
}

/** Bình phương khoảng cách từ một điểm tới hộp bao (cm²); 0 khi điểm nằm trong hộp. */
export function binhPhuongKhoangCach(h: HopBao, x: number, y: number): number {
  const dx = Math.max(h.x1 - x, 0, x - h.x2);
  const dy = Math.max(h.y1 - y, 0, y - h.y2);
  return dx * dx + dy * dy;
}

/** Hộp bao xe có chạm vùng nguy hiểm quanh người không. */
export function trongVungNguyHiem(h: HopBao, n: Pick<NguoiTrenDuong, "x" | "y">): boolean {
  return binhPhuongKhoangCach(h, n.x, n.y) < BAN_KINH_VUNG_NGUY_HIEM_CM * BAN_KINH_VUNG_NGUY_HIEM_CM;
}

/**
 * Độ dài hàng chờ dài nhất lúc này (cm): trên mỗi làn, chuỗi xe đi chậm hơn TOC_DO_HANG_CHO nối đuôi
 * nhau (khoảng hở không quá KHOANG_HANG_CHO_CM), tính từ đầu xe đầu hàng tới đuôi xe cuối hàng. Một xe
 * đứng một mình cũng là hàng chờ dài bằng thân xe.
 */
export function doHangCho(
  xe: ReadonlyArray<Pick<Xe, "lan" | "s" | "v" | "loai" | "kich_thuoc" | "trang_thai">>,
): number {
  const theoLan = new Map<string, Array<{ dau: number; duoi: number }>>();
  for (const x of xe) {
    if (x.trang_thai === "cho" || x.trang_thai === "da_qua" || x.v > TOC_DO_HANG_CHO) continue;
    const ds = theoLan.get(x.lan) ?? [];
    ds.push({ dau: x.s, duoi: x.s - kichThuocXe(x).dai * 10 });
    theoLan.set(x.lan, ds);
  }
  let dai = 0;
  for (const ds of theoLan.values()) {
    ds.sort((a, b) => b.dau - a.dau);
    let dau = ds[0]!.dau;
    let duoi = ds[0]!.duoi;
    for (let i = 1; i < ds.length; i++) {
      const x = ds[i]!;
      if (duoi - x.dau > KHOANG_HANG_CHO_CM * 10) {
        dai = Math.max(dai, dau - duoi);
        dau = x.dau;
        duoi = x.duoi;
        continue;
      }
      duoi = Math.min(duoi, x.duoi);
    }
    dai = Math.max(dai, dau - duoi);
  }
  return Math.floor(dai / 10);
}
