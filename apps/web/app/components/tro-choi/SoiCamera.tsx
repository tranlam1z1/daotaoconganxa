/**
 * Một đoạn phim trong trò "Soi camera" (docs/PLAN.md GĐ-T5, GAME_DESIGN §5.5).
 *
 * Hoạt cảnh dựng ngay trên điện thoại từ kịch bản xe bằng bộ mô phỏng M5 (không video, chạy offline),
 * vẽ qua khung camera (M6): dấu giờ chạy, chấm REC, nhiễu hạt nhẹ, ban đêm ở màn 5. Người chơi bấm
 * "Dừng hình", khoanh xe (kéo khung, vẽ vòng, chạm vào xe, hoặc chọn xe bằng bàn phím; M2
 * `KhoanhVung`), kéo thẻ lỗi vào khung (M2 `useKeoTha`), rồi "Tiếp tục". Tua lại 5 giây tối đa 3 lần
 * (hình chạy lùi nhanh). Hết phim thì nộp nhật ký (M7); máy chủ chấm lại.
 *
 * Màn kết quả: mỗi vi phạm một khung hình đúng lúc vi phạm, xe được tô; "Tua lại xem chậm" chạy lùi
 * nhanh rồi phát chậm một nửa qua cửa sổ vi phạm. Giảm chuyển động: phim chạy từng đoạn 2 giây, kết
 * quả là ảnh tĩnh; chấm y hệt. Mô tả, cách chấm, căn cứ, khoanh nhầm và biên bản nằm trong "Xem chi
 * tiết" của hộp kết quả (`ChiTietRiengSoiCamera`, GĐ17c).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import {
  BoGhiNhatKy,
  CAMERA,
  type ChiTietSoiCamera,
  chayKichBan,
  type DeSoiCamera,
  GIAY_TUA,
  type Hop,
  hopCacXe,
  type KetQuaViPham,
  type KieuXeCamera,
  kieuXeCamera,
  type LoaiViPham,
  MA_LAN,
  mauDen,
  TEN_LAN,
  TEN_VI_PHAM,
  type ThamSoCamera,
  type ThaoTacCamera,
  type TraLoiSoiCamera,
  type TrangThaiMoPhong,
  X_LAN,
  Y_NGUOI_DI_BO,
  Y_VACH,
} from "../../lib/soi-camera";
import type { BienDoi } from "../../lib/ve-canh/bien-doi";
import {
  apCamera,
  moTaXeCamera,
  raPx,
  taiTruocAnhCamera,
  veDauDen,
  veKhungTo,
  veNhieu,
  veXeCamera,
} from "../../lib/ve-canh/ve-camera";
import { Button } from "../ui/Button";
import { BienBan } from "./chung/BienBan";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { useKeoTha } from "./chung/tuong-tac/KeoTha";
import { type HopPx, KhoanhVung } from "./chung/tuong-tac/KhoanhVung";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export type TraLoiSoiCameraWeb = TraLoiSoiCamera | null;

const NHIP_GIAY = 20;
const KHUNG = { x0: 0, y0: 0, x1: 1000, y1: CAMERA.cao };
const TY_LE_CAO = CAMERA.cao / 1000;
const NHIP_TUA = GIAY_TUA * NHIP_GIAY;
const NHIP_MOI_DOAN = 2 * NHIP_GIAY;
/** Lề thêm quanh xe khi khoanh bằng chạm hay bàn phím, đơn vị camera. */
const LE_CHAM = 10;

type CheDo = "cho" | "chay" | "dung" | "het";

/* ------------------------------------------------------------------ */
/* Vẽ                                                                  */
/* ------------------------------------------------------------------ */

const giayNhip = (g: number) => Math.round(g * NHIP_GIAY);
const denNhip = (de: DeSoiCamera) => ({
  xanh: giayNhip(de.kich_ban.den.xanh),
  vang: giayNhip(de.kich_ban.den.vang),
  do: giayNhip(de.kich_ban.den.do),
  lech: giayNhip(de.kich_ban.den.lech),
});

export function gioCamera(gioBatDau: string, nhip: number): string {
  const [h, m, s] = gioBatDau.split(":").map(Number) as [number, number, number];
  const t = (h * 3600 + m * 60 + s + Math.floor(nhip / NHIP_GIAY)) % 86_400;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}

const phutGiay = (nhip: number) => {
  const s = Math.floor(nhip / NHIP_GIAY);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

interface VeCanh {
  de: DeSoiCamera;
  truoc: TrangThaiMoPhong;
  sau: TrangThaiMoPhong;
  alpha: number;
  nhip: number;
  tinh: boolean;
  to?: ReadonlyArray<{ hop: Hop; mau: string; net?: boolean; doDam?: number }>;
}

const KIEU_THEO_KICH_BAN = new WeakMap<DeSoiCamera["kich_ban"], Map<string, KieuXeCamera>>();

/** Kiểu xe (chọn ảnh xe) theo id, tính một lần cho mỗi kịch bản. */
function kieuXe(de: DeSoiCamera): Map<string, KieuXeCamera> {
  let m = KIEU_THEO_KICH_BAN.get(de.kich_ban);
  if (!m) {
    m = new Map();
    for (const x of de.kich_ban.xe) {
      const k = kieuXeCamera(x);
      if (k) m.set(x.id, k);
    }
    KIEU_THEO_KICH_BAN.set(de.kich_ban, m);
  }
  return m;
}

/** 0 tới khi ảnh xe tải xong rồi 1; đưa vào phienBan để khung vẽ vẽ lại cả khi phim đang dừng. */
function useAnhCamera(): number {
  const [san, datSan] = useState(0);
  useEffect(() => taiTruocAnhCamera(() => datSan(1)), []);
  return san;
}

function veCanh(ctx: CanvasRenderingContext2D, bd: BienDoi, v: VeCanh) {
  const dem = v.de.kich_ban.ban_dem;
  // Màu cảnh cố định, không theo giao diện sáng/tối: đây là hình camera ngoài đường, và xe (màu thật)
  // cần nền nhựa đường sẫm để nổi lên.
  ctx.fillStyle = dem ? "#0f1216" : "#8f9a86";
  ctx.fillRect(0, 0, bd.rong, bd.cao);
  ctx.save();
  apCamera(ctx, bd, CAMERA);
  ctx.fillStyle = dem ? "#1a1e23" : "#d6d1c4";
  ctx.fillRect(-1200, -3000, 500, 12000);
  ctx.fillRect(700, -3000, 500, 12000);
  // Bó vỉa.
  ctx.fillStyle = dem ? "#30353b" : "#a39d90";
  ctx.fillRect(-730, -3000, 30, 12000);
  ctx.fillRect(700, -3000, 30, 12000);
  ctx.fillStyle = dem ? "#262b31" : "#555a61";
  ctx.fillRect(-700, -3000, 1400, 12000);
  ctx.fillStyle = "#e0b43c";
  ctx.fillRect(-18, -3000, 12, 12000);
  ctx.fillRect(6, -3000, 12, 12000);
  ctx.fillStyle = dem ? "#9aa3ad" : "#f2f2ee";
  for (const x of [-350, 350]) for (let y = -3000; y < 9000; y += 600) ctx.fillRect(x - 6, y, 12, 300);
  for (let x = -690; x < 700; x += 100)
    ctx.fillRect(x, Y_NGUOI_DI_BO[0], 55, Y_NGUOI_DI_BO[1] - Y_NGUOI_DI_BO[0]);
  ctx.fillRect(0, Y_VACH.len, 700, 30);
  ctx.fillRect(-700, Y_VACH.xuong - 30, 700, 30);
  // Vùng cấm dừng: vạch vàng zích zắc sát mép phải làn (theo chiều xe chạy).
  ctx.strokeStyle = "#f2c230";
  ctx.lineWidth = 22;
  for (const z of v.de.kich_ban.vung_cam_dung) {
    const len = z.lan.startsWith("bac");
    const x = X_LAN[z.lan] + (len ? 160 : -160);
    ctx.beginPath();
    for (let y = z.y_tu * 100, i = 0; y <= z.y_den * 100; y += 150, i++) ctx.lineTo(x + (i % 2 ? -40 : 0), y);
    ctx.stroke();
  }
  ctx.restore();

  // Chữ trên mặt đường (px, không nghiêng).
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = dem ? "rgba(220,226,232,0.75)" : "rgba(255,255,255,0.8)";
  for (const lan of MA_LAN) {
    const [x, y] = raPx(bd, CAMERA, X_LAN[lan], lan.startsWith("bac") ? 5500 : 500);
    ctx.fillText(lan.endsWith("xm") ? "XE MÁY" : "Ô TÔ", x, y);
  }

  veXeCamera(ctx, bd, CAMERA, v.truoc.xe, v.sau.xe, v.alpha, dem, v.nhip, kieuXe(v.de));
  const mau = mauDen(denNhip(v.de), v.nhip);
  const [x1, y1] = raPx(bd, CAMERA, 800, Y_VACH.len);
  const [x2, y2] = raPx(bd, CAMERA, -800, Y_VACH.xuong);
  veDauDen(ctx, x1, y1, mau);
  veDauDen(ctx, x2, y2, mau);
  for (const t of v.to ?? []) veKhungTo(ctx, bd, t.hop, t.mau, t.doDam ?? 1, t.net);
  veNhieu(ctx, bd, dem ? 0.14 : 0.08, v.tinh);
}

/** Lớp chữ camera: chấm REC, số camera, dấu giờ. */
function DauGio({ de, nhip, dung }: { de: DeSoiCamera; nhip: number; dung: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1 font-mono text-xs text-white">
      <span className="flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5">
        <span
          className={cn("inline-block size-2 rounded-full bg-red-500", !dung && "motion-safe:animate-pulse")}
        />
        {dung ? "DỪNG HÌNH" : "REC"}
      </span>
      <span className="g-so rounded bg-black/55 px-1.5 py-0.5">
        CAM 03 · {gioCamera(de.kich_ban.gio_bat_dau, nhip)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Xem phim, dừng hình, khoanh                                         */
/* ------------------------------------------------------------------ */

export function SoiCamera({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
  chiTietTrongHop = false,
}: {
  de: DeSoiCamera;
  traLoi: TraLoiSoiCameraWeb;
  datTraLoi: (t: TraLoiSoiCameraWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiSoiCameraWeb) => void;
  /** Phần chữ của kết quả nằm trong hộp kết quả (khung chơi, GĐ17c); bảng chơi chỉ giữ phần tóm tắt. */
  chiTietTrongHop?: boolean;
}) {
  const giam = useGiamChuyenDong();
  const ds = useMemo(() => chayKichBan(de.kich_ban), [de.kich_ban]);
  const anhSan = useAnhCamera();
  const n = ds.length - 1;
  const [cheDo, datCheDo] = useState<CheDo>("cho");
  const [nhip, datNhip] = useState(0);
  const [phien, datPhien] = useState(0);
  const [soTua, datSoTua] = useState(0);
  const [cho, datCho] = useState<Hop | null>(null);
  const [khoanh, datKhoanh] = useState<Array<{ nhip_phim: number; hop: Hop; loi: LoaiViPham }>>([]);
  const [thongBao, datThongBao] = useState("");
  const f = useRef(0);
  const fTruoc = useRef(0);
  const tuaDen = useRef<number | null>(null);
  const ghi = useRef<BoGhiNhatKy<ThaoTacCamera, ThamSoCamera> | null>(null);
  const bdRef = useRef<BienDoi | null>(null);
  const daGui = useRef(false);
  const khungRef = useRef<HTMLDivElement>(null);
  const khoa = daCham || traLoi !== null;

  useEffect(() => {
    ghi.current = new BoGhiNhatKy(() => performance.now());
    const doi = () => (document.hidden ? ghi.current?.tamDung() : ghi.current?.tiepTuc());
    document.addEventListener("visibilitychange", doi);
    return () => document.removeEventListener("visibilitychange", doi);
  }, []);

  const tienNhip = useCallback(() => {
    fTruoc.current = f.current;
    if (tuaDen.current !== null) {
      f.current = Math.max(tuaDen.current, f.current - 6);
      if (f.current === tuaDen.current) tuaDen.current = null;
    } else f.current = Math.min(n, f.current + 1);
    if (Math.floor(f.current / NHIP_GIAY) !== Math.floor(fTruoc.current / NHIP_GIAY)) datNhip(f.current);
    return f.current < n;
  }, [n]);

  const hetPhim = useCallback(() => {
    fTruoc.current = f.current;
    datNhip(f.current);
    datCheDo("het");
    datThongBao("Hết đoạn phim. Có thể tua lại, hoặc nộp kết quả.");
    phatAm("hoan_thanh");
  }, []);

  const ve = (ctx: CanvasRenderingContext2D, bd: BienDoi, alpha: number) => {
    bdRef.current = bd;
    const a = tuaDen.current !== null || cheDo !== "chay" || giam ? 1 : alpha;
    veCanh(ctx, bd, {
      de,
      truoc: ds[fTruoc.current]!,
      sau: ds[f.current]!,
      alpha: a,
      nhip: f.current,
      tinh: giam || cheDo !== "chay",
      to: khoanh
        .filter((k) => k.nhip_phim === f.current && cheDo === "dung")
        .map((k) => ({ hop: k.hop, mau: "#f2c230", net: true })),
    });
  };

  const gioiThieu = (s: string) => {
    datThongBao(s);
    rung("dung");
  };

  const batDau = () => {
    datCheDo("chay");
    phatAm("khoi_dong");
  };

  const dungHinh = () => {
    if (khoa || cheDo !== "chay") return;
    tuaDen.current = null;
    fTruoc.current = f.current;
    ghi.current?.ghi("dung_hinh", { nhip_phim: f.current });
    datNhip(f.current);
    datCheDo("dung");
    datPhien((p) => p + 1);
    phatAm("tich");
    datThongBao("Đã dừng hình. Khoanh xe vi phạm: kéo khung, vẽ vòng, hoặc chạm vào xe.");
    // Đưa khung hình lên đầu màn hình để khung hình và thẻ lỗi cùng nằm trong tầm một ngón tay.
    khungRef.current?.scrollIntoView({ block: "start", behavior: giam ? "auto" : "smooth" });
  };

  const tiepTuc = () => {
    if (khoa || cheDo !== "dung") return;
    ghi.current?.ghi("tiep_tuc", null);
    datCho(null);
    datCheDo(f.current >= n ? "het" : "chay");
    datThongBao("");
  };

  const tuaLai = () => {
    if (khoa || soTua >= de.so_lan_tua || cheDo === "cho") return;
    const den = Math.max(0, f.current - NHIP_TUA);
    ghi.current?.ghi("tua", { nhip_phim: den });
    datSoTua((s) => s + 1);
    datCho(null);
    if (giam) {
      f.current = den;
      fTruoc.current = den;
      datNhip(den);
      datPhien((p) => p + 1);
    } else tuaDen.current = den;
    datCheDo("chay");
    datThongBao(`Đã tua lại ${GIAY_TUA} giây.`);
  };

  const chayDoan = () => {
    for (let i = 0; i < NHIP_MOI_DOAN; i++) if (!tienNhip()) break;
    fTruoc.current = f.current;
    datNhip(f.current);
    datPhien((p) => p + 1);
    if (f.current >= n) hetPhim();
  };

  const nop = () => {
    if (khoa || daGui.current || !ghi.current) return;
    daGui.current = true;
    const nk = ghi.current.ketThuc();
    datTraLoi(nk);
    gui?.(nk);
  };

  const xeHien = useMemo(() => (cheDo === "dung" ? [...hopCacXe(ds[nhip]!)] : []), [cheDo, ds, nhip]);
  const tangLe = (h: Hop): Hop => [h[0] - LE_CHAM, h[1] - LE_CHAM, h[2] + LE_CHAM, h[3] + LE_CHAM];

  const khoanhPx = (h: HopPx) => {
    const bd = bdRef.current;
    if (!bd) return;
    datCho([h[0] / bd.tx, h[1] / bd.ty, h[2] / bd.tx, h[3] / bd.ty].map(Math.round) as unknown as Hop);
    gioiThieu("Đã khoanh. Kéo thẻ lỗi vào khung, hoặc chạm thẻ rồi chạm khung.");
  };

  const chamPx = (x: number, y: number) => {
    const bd = bdRef.current;
    if (!bd) return;
    const [cx, cy] = [x / bd.tx, y / bd.ty];
    const trung = xeHien.find(
      ([, h]) => cx >= h[0] - 6 && cx <= h[2] + 6 && cy >= h[1] - 6 && cy <= h[3] + 6,
    );
    if (!trung) {
      datThongBao("Chỗ chạm không có xe. Kéo khung hoặc vẽ vòng quanh xe.");
      return;
    }
    datCho(tangLe(trung[1]));
    gioiThieu("Đã khoanh xe. Kéo thẻ lỗi vào khung, hoặc chạm thẻ rồi chạm khung.");
  };

  const keo = useKeoTha((loi) => {
    if (!cho || cheDo !== "dung") return;
    const hop = cho.map((v) => Math.round(v)) as unknown as Hop;
    ghi.current?.ghi("khoanh", { nhip_phim: f.current, hop, loi: loi as LoaiViPham });
    datKhoanh((k) => [...k, { nhip_phim: f.current, hop, loi: loi as LoaiViPham }]);
    datCho(null);
    datPhien((p) => p + 1);
    phatAm("dung");
    rung("dung");
    datThongBao(`Đã ghi: ${TEN_VI_PHAM[loi as LoaiViPham]}. Khoanh tiếp, hoặc bấm "Tiếp tục".`);
  });

  if (daCham && chiTiet)
    return <KetQuaSoiCamera de={de} ds={ds} ct={chiTiet as ChiTietSoiCamera} coChu={!chiTietTrongHop} />;

  const lopPhu = (bd: BienDoi) => (
    <>
      <DauGio de={de} nhip={nhip} dung={cheDo === "dung"} />
      {tuaDen.current !== null ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0_2px,transparent_2px_5px)]">
          <span className="rounded bg-black/60 px-2 py-1 font-mono text-lg font-bold text-white">
            ◀◀ TUA LẠI
          </span>
        </div>
      ) : null}
      <KhoanhVung
        bat={cheDo === "dung" && !khoa && !cho}
        onKhoanh={khoanhPx}
        onCham={chamPx}
        nhan="Khung hình đã dừng: kéo khung hoặc vẽ vòng quanh xe vi phạm"
      />
      {cho && cheDo === "dung"
        ? (() => {
            const p = keo.vung("cho", khoa);
            return (
              <button
                {...p}
                aria-label="Khung vừa khoanh: thả thẻ lỗi vào đây"
                className={cn("absolute rounded border-2 border-dashed", p["data-san-sang"] && "ring-2")}
                style={{
                  left: cho[0] * bd.tx,
                  top: cho[1] * bd.ty,
                  width: Math.max(24, (cho[2] - cho[0]) * bd.tx),
                  height: Math.max(24, (cho[3] - cho[1]) * bd.ty),
                  borderColor: "var(--warn)",
                  background: "rgb(242 194 48 / 0.15)",
                }}
              />
            );
          })()
        : null}
    </>
  );

  return (
    <div className="space-y-3" data-nhip={nhip} data-che-do={cheDo}>
      <div className="flex items-center justify-between gap-2 text-sm text-ink-2">
        <span className="g-so">
          {phutGiay(nhip)} / {phutGiay(n)}
          {de.toc_do_phat !== 1 ? ` · ${String(de.toc_do_phat).replace(".", ",")}×` : ""}
        </span>
        <span>
          Đã khoanh <strong className="text-ink">{khoanh.length}</strong> · Tua lại còn{" "}
          {de.so_lan_tua - soTua}
        </span>
      </div>

      <div ref={khungRef} className="scroll-mt-16">
        <CanhTrenXuong
          khung={KHUNG}
          cao={420}
          tyLeCao={TY_LE_CAO}
          ve={ve}
          chay={cheDo === "chay" && !giam}
          tienNhip={tienNhip}
          heSoTua={de.toc_do_phat}
          onXong={hetPhim}
          onTamDung={(d) => (d ? ghi.current?.tamDung() : ghi.current?.tiepTuc())}
          phienBan={`${phien}|${cheDo}|${nhip}|${khoanh.length}|${anhSan}`}
          nhan={`Camera giao thông, đoạn đường bốn làn có đèn tín hiệu ở chỗ người đi bộ sang đường${de.kich_ban.ban_dem ? ", ban đêm" : ""}.`}
          lopPhu={lopPhu}
          className="overflow-hidden rounded-2xl border-4 border-[#1d1f23]"
        />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(nhip / n) * 100}%` }} />
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {thongBao}
      </p>

      {cheDo === "dung" && !khoa ? (
        <div className="space-y-2">
          {xeHien.length ? (
            <ul className="flex flex-wrap gap-1" aria-label="Chọn xe bằng bàn phím">
              {xeHien.map(([id, h], i) => {
                const x = ds[nhip]!.xe.find((c) => c.id === id)!;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="sr-only rounded-lg border border-line px-2 py-1 text-sm focus:not-sr-only"
                      onClick={() => {
                        datCho(tangLe(h));
                        gioiThieu(`Đã khoanh xe ${i + 1}. Chọn thẻ lỗi.`);
                      }}
                    >
                      Khoanh xe {i + 1}: {moTaXeCamera(x, kieuXe(de).get(x.id), de.kich_ban.ban_dem)},{" "}
                      {TEN_LAN[x.lan as keyof typeof TEN_LAN]}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {cho ? (
            <>
              <ul className="grid grid-cols-2 gap-2" aria-label="Thẻ lỗi">
                {de.the_loi.map((t) => {
                  const p = keo.vat(t.ma, khoa);
                  return (
                    <li key={t.ma}>
                      <button
                        {...p}
                        className={cn(
                          p.className,
                          "min-h-12 w-full rounded-xl border-2 bg-surface px-2 text-[15px] font-semibold",
                        )}
                        style={{
                          ...p.style,
                          borderColor: keo.chon === t.ma ? "var(--primary)" : "var(--line-strong)",
                        }}
                      >
                        {t.ten}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Button variant="secondary" className="min-h-11 w-full" onClick={() => datCho(null)}>
                Bỏ khung này
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {!khoa ? (
        <div className="grid grid-cols-2 gap-2">
          {cheDo === "cho" ? (
            <Button className="g-nut col-span-2 min-h-14 text-lg" onClick={batDau}>
              Bắt đầu xem
            </Button>
          ) : cheDo === "chay" ? (
            <>
              <Button
                variant="secondary"
                className="min-h-14"
                onClick={tuaLai}
                disabled={soTua >= de.so_lan_tua}
              >
                ◀◀ Tua lại {GIAY_TUA} giây
              </Button>
              {giam ? (
                <div className="grid gap-2">
                  <Button variant="secondary" className="min-h-12" onClick={chayDoan}>
                    Chạy 2 giây
                  </Button>
                  <Button className="g-nut min-h-12" onClick={dungHinh}>
                    Dừng hình
                  </Button>
                </div>
              ) : (
                <Button className="g-nut min-h-14 text-lg" onClick={dungHinh}>
                  Dừng hình
                </Button>
              )}
            </>
          ) : cheDo === "dung" ? (
            <>
              <Button
                variant="secondary"
                className="min-h-14"
                onClick={tuaLai}
                disabled={soTua >= de.so_lan_tua}
              >
                ◀◀ Tua lại {GIAY_TUA} giây
              </Button>
              <Button className="g-nut min-h-14 text-lg" onClick={tiepTuc}>
                Tiếp tục
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                className="min-h-14"
                onClick={tuaLai}
                disabled={soTua >= de.so_lan_tua}
              >
                ◀◀ Tua lại {GIAY_TUA} giây
              </Button>
              <Button className="g-nut min-h-14 text-lg" onClick={nop}>
                Nộp kết quả
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Màn kết quả                                                         */
/* ------------------------------------------------------------------ */

/** Khung hình đúng lúc vi phạm, xe được tô; "Tua lại xem chậm" chạy lùi nhanh rồi phát chậm. */
/**
 * Khung hình tiêu biểu của một vi phạm: vượt đèn đỏ là lúc qua vạch; vi phạm kéo dài (sai làn, không
 * mũ, dừng sai) là giữa cửa sổ, vì đầu cửa sổ xe mới chạm mép khung camera.
 */
const khungDaiDien = (v: Pick<KetQuaViPham, "loai" | "bat_dau" | "ket_thuc">) =>
  v.loai === "vuot_den_do" ? v.bat_dau : Math.floor((v.bat_dau + v.ket_thuc) / 2);

function PhatLaiViPham({
  de,
  ds,
  v,
  xemKhoanh,
}: {
  de: DeSoiCamera;
  ds: TrangThaiMoPhong[];
  v: KetQuaViPham;
  xemKhoanh: boolean;
}) {
  const giam = useGiamChuyenDong();
  const n = ds.length - 1;
  const goc = xemKhoanh && v.khoanh ? v.khoanh.nhip_phim : khungDaiDien(v);
  const anhSan = useAnhCamera();
  const [chay, datChay] = useState(false);
  const [phien, datPhien] = useState(0);
  const f = useRef(goc);
  const fTruoc = useRef(goc);
  const pha = useRef<"lui" | "cham">("lui");
  const dem = useRef(0);
  const [tua, datTua] = useState(false);
  const tu = Math.max(0, v.bat_dau - NHIP_GIAY);
  const den = Math.min(n, v.ket_thuc + NHIP_GIAY);

  useEffect(() => {
    f.current = goc;
    fTruoc.current = goc;
    datPhien((p) => p + 1);
  }, [goc]);

  const tienNhip = () => {
    fTruoc.current = f.current;
    if (pha.current === "lui") {
      f.current = Math.max(tu, f.current - 5);
      if (f.current === tu) {
        pha.current = "cham";
        datTua(false);
      }
      return true;
    }
    // Phát chậm một nửa: một nhịp phim mỗi hai nhịp thật.
    if (++dem.current % 2 === 0) f.current = Math.min(den, f.current + 1);
    return f.current < den;
  };

  const xe = hopCacXe(ds[f.current]!).get(v.xe);
  const to = [
    ...(xe
      ? [
          {
            hop: xe,
            mau: "#e53935",
            doDam: chay && pha.current === "cham" ? 0.55 + 0.45 * ((dem.current % 16) / 16) : 1,
          },
        ]
      : []),
    ...(v.khoanh && f.current === v.khoanh.nhip_phim
      ? [{ hop: v.khoanh.hop, mau: "#f2c230", net: true }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <CanhTrenXuong
        khung={KHUNG}
        cao={420}
        tyLeCao={TY_LE_CAO}
        ve={(ctx, bd, alpha) =>
          veCanh(ctx, bd, {
            de,
            truoc: ds[fTruoc.current]!,
            sau: ds[f.current]!,
            alpha: pha.current === "cham" && chay ? alpha : 1,
            nhip: f.current,
            tinh: !chay,
            to,
          })
        }
        chay={chay}
        tienNhip={tienNhip}
        onXong={() => {
          datChay(false);
          f.current = goc;
          fTruoc.current = goc;
          datPhien((p) => p + 1);
        }}
        phienBan={`${phien}|${goc}|${anhSan}`}
        nhan={`Khung hình lúc ${gioCamera(de.kich_ban.gio_bat_dau, f.current)}, xe vi phạm được tô đỏ.`}
        lopPhu={() => (
          <>
            <DauGio de={de} nhip={f.current} dung={!chay} />
            {tua ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0_2px,transparent_2px_5px)]">
                <span className="rounded bg-black/60 px-2 py-1 font-mono text-lg font-bold text-white">
                  ◀◀ TUA LẠI
                </span>
              </div>
            ) : null}
          </>
        )}
        className="overflow-hidden rounded-xl border-4 border-[#1d1f23]"
      />
      {!giam ? (
        <Button
          variant="secondary"
          className="min-h-11 w-full"
          disabled={chay}
          onClick={() => {
            f.current = Math.min(n, den);
            fTruoc.current = f.current;
            pha.current = "lui";
            dem.current = 0;
            datTua(true);
            datChay(true);
          }}
        >
          ◀◀ Tua lại xem chậm
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Màn kết quả (bảng chơi sau khi chấm): mỗi vi phạm một khung hình, đã bắt hay bỏ sót, điểm. Phần chữ
 * (mô tả, cách chấm, căn cứ, khoanh nhầm, biên bản) ở `ChiTietRiengSoiCamera`; `coChu` gộp cả phần chữ
 * vào đây (trang soạn kịch bản của quản trị, không có hộp kết quả).
 */
function KetQuaSoiCamera({
  de,
  ds,
  ct,
  coChu,
}: {
  de: DeSoiCamera;
  ds: TrangThaiMoPhong[];
  ct: ChiTietSoiCamera;
  coChu: boolean;
}) {
  const [xemKhoanh, datXemKhoanh] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-4">
      <ol className="grid gap-4" aria-label="Các vi phạm trong đoạn phim">
        {ct.vi_pham.map((v, i) => {
          const bat = v.diem_khoanh > 0;
          return (
            <li key={`${v.xe}-${v.loai}`} className="g-the space-y-2 p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[15px] font-semibold">
                  {i + 1}. {v.ten} · lúc {gioCamera(de.kich_ban.gio_bat_dau, khungDaiDien(v))}
                </span>
                <span className={cn("text-sm font-semibold", bat ? "text-ok" : "text-danger")}>
                  {bat ? "✓ Đã bắt" : "✗ Bỏ sót"} · {v.diem} điểm
                </span>
              </p>
              <PhatLaiViPham de={de} ds={ds} v={v} xemKhoanh={Boolean(xemKhoanh[i])} />
              {v.khoanh ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-sm text-primary underline"
                  onClick={() => datXemKhoanh((x) => ({ ...x, [i]: !x[i] }))}
                >
                  {xemKhoanh[i] ? "Xem lúc vi phạm" : "Xem khung bạn đã khoanh"}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {coChu ? <ChiTietRiengSoiCamera de={de} chiTiet={ct} /> : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một đoạn phim (GĐ17c): từng vi phạm, khoanh nhầm, biên bản (Đ12). */
export function ChiTietRiengSoiCamera({ de, chiTiet }: { de: DeSoiCamera; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietSoiCamera;
  return (
    <div className="space-y-4">
      {!ct.hop_le ? (
        <p
          className="rounded-lg border border-line bg-surface p-3 text-[15px]"
          style={{ color: "var(--danger)" }}
        >
          {ct.ly_do}
        </p>
      ) : null}
      {ct.vi_pham.length ? (
        <section className="g-the p-3" aria-label="Từng vi phạm">
          <h3 className="text-base font-semibold">Từng vi phạm</h3>
          <ol className="mt-2 grid gap-3">
            {ct.vi_pham.map((v, i) => (
              <li key={`${v.xe}-${v.loai}`}>
                <p className="text-[15px] font-semibold">
                  {i + 1}. {v.ten} · lúc {gioCamera(de.kich_ban.gio_bat_dau, khungDaiDien(v))}
                </p>
                <p className="text-[15px] leading-relaxed">{v.mo_ta}</p>
                <ul className="text-sm text-ink-2">
                  <li>
                    Dừng hình đúng lúc:{" "}
                    {v.diem_dung_luc ? "có (+5)" : v.khoanh ? "chưa, dừng ngoài lúc vi phạm" : "không"}
                  </li>
                  <li>
                    Khoanh đúng xe:{" "}
                    {v.diem_khoanh
                      ? "có (+5)"
                      : v.qua_rong
                        ? "khung trùm quá nhiều xe khác, không tính"
                        : "không"}
                  </li>
                  <li>
                    Thẻ lỗi:{" "}
                    {v.khoanh
                      ? `${TEN_VI_PHAM[v.khoanh.loi]}${v.diem_the ? " (đúng, +10)" : " (sai)"}`
                      : "không có"}
                  </li>
                </ul>
                <p className="text-sm text-ink-2">
                  Căn cứ:{" "}
                  {v.can_cu.length ? v.can_cu.map(nhanVienDan).join("; ") : "Căn cứ đang được cập nhật"}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {ct.khoanh_nham.length ? (
        <section className="g-the p-3" aria-label="Khoanh nhầm">
          <h3 className="text-base font-semibold">Khoanh nhầm (−5 mỗi lần)</h3>
          <ul className="mt-1 list-disc pl-5 text-[15px]">
            {ct.khoanh_nham.map((k) => (
              <li key={`${k.nhip_phim}-${k.hop.join(",")}`}>
                Lúc {gioCamera(de.kich_ban.gio_bat_dau, k.nhip_phim)}:{" "}
                {k.xe.length ? "xe không vi phạm" : "không trúng xe nào"}, thẻ "{TEN_VI_PHAM[k.loi]}".
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <BienBan dong={ct.bien_ban} />
    </div>
  );
}
