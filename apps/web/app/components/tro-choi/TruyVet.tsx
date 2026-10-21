/**
 * Trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17, GAME_DESIGN §5.17).
 *
 * Tin báo (nút nghe dùng giọng đọc có sẵn, cần mạng) → bản đồ khu phố (M9) có camera → chọn camera: trò báo đoạn
 * cảnh sẽ ở giờ nào (tính theo quãng đường từ lần khóa gần nhất) và có phải chờ không → xem đoạn cảnh 10 giây
 * (M5 chạy trên điện thoại, vẽ bằng M6) → chạm xe khớp mô tả để khóa (M2 `KhoanhVung` `onCham`, hoặc danh sách
 * xe trong khung hình) → camera tiếp theo → đặt điểm chặn trên bản đồ.
 *
 * Lượt online: mỗi lần mở camera gọi route riêng của trò (câu D23) qua cầu nối /api; lần khóa xe gửi kèm lần mở
 * camera kế tiếp, hoặc kèm điểm chặn. Lượt offline (câu D24): trang offline truyền ảnh chụp bước (`buocOffline`),
 * điện thoại tự mở camera bằng cùng hàm với máy chủ và nộp cả nhật ký.
 *
 * Giảm chuyển động: đoạn cảnh hiện theo khung tĩnh mỗi giây, có nút tới, lùi; bản đồ không cuộn tự động. Chấm
 * giống hệt. Kết quả, lộ trình thật, căn cứ nằm trong "Xem chi tiết" của hộp kết quả (`ChiTietRiengTruyVet`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import {
  apThaoTacTV,
  BoGhiNhatKy,
  type BuocTruyVet,
  buocMoPhong,
  type ChiTietTruyVet,
  cauHinhDoanCanh,
  type DeTruyVet,
  type DoanCanh,
  dungDoanCanh,
  dungLuoi,
  dungMoPhong,
  dungVu,
  gioTrongTro,
  type HuongO,
  laDuong,
  NHIP_DAN,
  NHIP_DOAN,
  NUA_KHUNG_CM,
  TEN_HUONG_O,
  TEN_LOAI_XE_TV,
  TEN_MAU_XE,
  type ThamSoTruyVet,
  type ThaoTacTruyVet,
  type ToaDoO,
  type TraLoiTruyVet,
  type TrangThaiMoPhong,
  type TrangThaiTruyVet,
  thoiDiemCamera,
  trangThaiDau,
} from "../../lib/truy-vet";
import type { BienDoi } from "../../lib/ve-canh/bien-doi";
import { type BangMau, docBangMau } from "../../lib/ve-canh/mau";
import { MAU_THAN_XE, tamXePx, veDoanCanh } from "../../lib/ve-canh/ve-truy-vet";
import { useDocThanhTieng } from "../giong-noi/useDocThanhTieng";
import { Button } from "../ui/Button";
import { BanDoO, DON_VI_O } from "./chung/BanDoO";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { KhoanhVung } from "./chung/tuong-tac/KhoanhVung";
import type { PropsChiTiet } from "./giao-dien";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export type TraLoiTruyVetWeb = TraLoiTruyVet | null;
type Op = { thao_tac: ThaoTacTruyVet; tham_so: ThamSoTruyVet };

const KHUNG = { x0: -NUA_KHUNG_CM, y0: -NUA_KHUNG_CM, x1: NUA_KHUNG_CM, y1: NUA_KHUNG_CM };
const NHIP_GIAY = 20;
const NHIP_CUOI = NHIP_DAN + NHIP_DOAN;
const BAN_KINH_CHAM_PX = 26;

const phia = (h: HuongO) => `phía ${TEN_HUONG_O[h]}`;
const tamO = (o: ToaDoO) => [o.x * DON_VI_O + DON_VI_O / 2, o.y * DON_VI_O + DON_VI_O / 2] as const;

/** Hình quạt góc nhìn của camera theo 4 hướng (không cần lượng giác). */
const QUAT: Record<HuongO, string> = {
  0: "M0,0 L-4,-7 L4,-7 Z",
  2: "M0,0 L7,-4 L7,4 Z",
  4: "M0,0 L-4,7 L4,7 Z",
  6: "M0,0 L-7,-4 L-7,4 Z",
};

/* ------------------------------------------------------------------ */
/* Đoạn cảnh camera                                                    */
/* ------------------------------------------------------------------ */

function DoanCamera({
  doan,
  ten,
  gioXayRa,
  chon,
  khoa,
  choChon,
  onChon,
}: {
  doan: DoanCanh;
  ten: string;
  gioXayRa: string;
  chon: string | null;
  khoa: string | null;
  /** Được chọn xe (đoạn mới nhất, chưa khóa, chưa chấm). */
  choChon: boolean;
  onChon: (id: string | null) => void;
}) {
  const giam = useGiamChuyenDong();
  const ds = useMemo<TrangThaiMoPhong[]>(() => {
    const mp = dungMoPhong(cauHinhDoanCanh(doan));
    const kq = [trangThaiDau(mp)];
    for (let i = 0; i < NHIP_CUOI; i++) kq.push(buocMoPhong(mp, kq[i]!));
    return kq;
  }, [doan]);
  const f = useRef(NHIP_DAN);
  const fTruoc = useRef(NHIP_DAN);
  const bdRef = useRef<BienDoi | null>(null);
  const mau = useRef<BangMau>(docBangMau());
  const [chay, datChay] = useState(false);
  const [nhip, datNhip] = useState(NHIP_DAN);
  const [phien, datPhien] = useState(0);

  const tienNhip = useCallback(() => {
    fTruoc.current = f.current;
    f.current = Math.min(NHIP_CUOI, f.current + 1);
    if (Math.floor(f.current / NHIP_GIAY) !== Math.floor(fTruoc.current / NHIP_GIAY)) datNhip(f.current);
    return f.current < NHIP_CUOI;
  }, []);

  const denNhip = (n: number) => {
    f.current = Math.max(NHIP_DAN, Math.min(NHIP_CUOI, n));
    fTruoc.current = f.current;
    datNhip(f.current);
    datPhien((p) => p + 1);
  };

  const phat = () => {
    mau.current = docBangMau();
    if (f.current >= NHIP_CUOI) denNhip(NHIP_DAN);
    datChay(true);
    phatAm("khoi_dong");
  };

  const ve = (ctx: CanvasRenderingContext2D, bd: BienDoi, alpha: number) => {
    bdRef.current = bd;
    veDoanCanh(ctx, bd, {
      doan,
      truoc: ds[fTruoc.current]!.xe,
      sau: ds[f.current]!.xe,
      alpha: chay && !giam ? alpha : 1,
      m: mau.current,
      chon,
      khoa,
    });
  };

  const xeHien = () => {
    const bd = bdRef.current;
    if (!bd) return [];
    const tt = ds[f.current]!;
    return tt.xe
      .map((x) => ({ x, tam: tamXePx(bd, undefined, x, 1) }))
      .filter((v): v is { x: (typeof tt.xe)[number]; tam: [number, number] } => v.tam !== null)
      .filter((v) => v.tam[0] >= 0 && v.tam[1] >= 0 && v.tam[0] <= bd.rong && v.tam[1] <= bd.cao);
  };

  const cham = (px: number, py: number) => {
    if (!choChon) return;
    datChay(false);
    denNhip(f.current);
    let tot: { id: string; d: number } | null = null;
    for (const { x, tam } of xeHien()) {
      const d = Math.hypot(tam[0] - px, tam[1] - py);
      if (d <= BAN_KINH_CHAM_PX && (!tot || d < tot.d)) tot = { id: x.id, d };
    }
    onChon(tot?.id ?? null);
    if (tot) rung("dung");
  };

  const dangChay = chay && !giam;
  const giay = Math.max(0, Math.floor((nhip - NHIP_DAN) / NHIP_GIAY));
  const tren = !dangChay ? xeHien() : [];

  return (
    <div className="space-y-2" data-doan={doan.so} data-giay={giay}>
      <div className="relative overflow-hidden rounded-xl border-2 border-black/70 bg-black">
        <CanhTrenXuong
          khung={KHUNG}
          cao={328}
          tyLeCao={1}
          ve={ve}
          chay={dangChay}
          tienNhip={tienNhip}
          onXong={() => {
            datChay(false);
            datNhip(f.current);
          }}
          phienBan={`${phien}|${chon}|${khoa}|${nhip}`}
          nhan={`Đoạn cảnh camera ${ten}, giây ${giay} trên ${NHIP_DOAN / NHIP_GIAY}`}
          lopPhu={() => (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-2 py-1 font-mono text-[11px] text-white">
                <span className="flex min-w-0 items-center gap-1 truncate rounded bg-black/60 px-1.5 py-0.5">
                  <span
                    className={cn(
                      "inline-block size-2 shrink-0 rounded-full bg-red-500",
                      dangChay && "motion-safe:animate-pulse",
                    )}
                  />
                  <span className="truncate">{ten}</span>
                </span>
                <span className="g-so shrink-0 rounded bg-black/60 px-1.5 py-0.5">
                  {gioTrongTro(gioXayRa, doan.bat_dau + giay)}
                </span>
              </div>
              <KhoanhVung
                bat={choChon}
                onKhoanh={(h) => cham((h[0] + h[2]) / 2, (h[1] + h[3]) / 2)}
                onCham={cham}
                nhan="Khung hình camera: chạm vào xe để chọn"
              />
            </>
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {giam ? (
          <>
            <Button
              variant="secondary"
              className="min-h-12 min-w-12"
              aria-label="Lùi 1 giây"
              onClick={() => denNhip(f.current - NHIP_GIAY)}
            >
              ◀
            </Button>
            <Button
              variant="secondary"
              className="min-h-12 min-w-12"
              aria-label="Tới 1 giây"
              onClick={() => denNhip(f.current + NHIP_GIAY)}
            >
              ▶
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="min-h-12" onClick={() => (chay ? datChay(false) : phat())}>
            {chay
              ? "Tạm dừng"
              : f.current >= NHIP_CUOI
                ? "Xem lại"
                : f.current > NHIP_DAN
                  ? "Chạy tiếp"
                  : "Phát"}
          </Button>
        )}
        <span className="g-so text-sm text-ink-2">
          Giây {giay}/{NHIP_DOAN / NHIP_GIAY}
        </span>
      </div>
      {choChon && !dangChay && tren.length ? (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Xe trong khung hình</legend>
          {tren.map(({ x }, i) => {
            const t = doan.xe.find((d) => d.id === x.id);
            if (!t) return null;
            return (
              <button
                key={x.id}
                type="button"
                data-xe={x.id}
                aria-pressed={chon === x.id}
                onClick={() => onChon(chon === x.id ? null : x.id)}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm",
                  chon === x.id ? "border-[var(--warn)] ring-2 ring-[var(--warn)]" : "border-line",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-3 rounded-sm border border-black/40"
                  style={{ background: MAU_THAN_XE[t.mau] }}
                />
                Xe {i + 1}
              </button>
            );
          })}
        </fieldset>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trò                                                                 */
/* ------------------------------------------------------------------ */

async function moCameraOnline(
  luotId: string,
  body: { camera: string; cho: boolean; khoa: { doan: number; xe: string } | null },
): Promise<{ doan: DoanCanh; trang_thai: TrangThaiTruyVet } | { loi: string }> {
  try {
    const r = await fetch(`/api/truy-vet/luot/${luotId}/camera`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => null)) as any;
    if (r.ok && j?.doan) return j;
    return { loi: j?.error?.message ?? "Không mở được camera. Hãy thử lại." };
  } catch {
    return { loi: "Mất kết nối. Hãy thử lại khi có mạng." };
  }
}

export function TruyVet({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
  buocOffline,
}: {
  de: DeTruyVet;
  traLoi: TraLoiTruyVetWeb;
  datTraLoi: (t: TraLoiTruyVetWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiTruyVetWeb) => void;
  buocOffline?: BuocTruyVet;
}) {
  const giam = useGiamChuyenDong();
  const { id: luotId } = useParams();
  const luoi = useMemo(() => dungLuoi(de.ban_do), [de.ban_do]);
  const vOff = useMemo(
    () => (buocOffline ? dungVu(buocOffline.vu, buocOffline.bi_mat) : null),
    [buocOffline],
  );
  const [tt, datTt] = useState<TrangThaiTruyVet>(de.trang_thai);
  const [ds, datDs] = useState<DoanCanh[]>(de.da_mo);
  const [xem, datXem] = useState(de.da_mo.length - 1);
  const [chonXe, datChonXe] = useState<string | null>(null);
  const [camChon, datCamChon] = useState<string | null>(null);
  const [cheDoChan, datCheDoChan] = useState(false);
  const [oChan, datOChan] = useState<ToaDoO | null>(null);
  const [dangMo, datDangMo] = useState(false);
  const [thongBao, datThongBao] = useState("");
  const ghi = useRef<BoGhiNhatKy<ThaoTacTruyVet, ThamSoTruyVet> | null>(null);
  const doanRef = useRef<HTMLDivElement>(null);
  const daGui = useRef(false);
  const docTin = useDocThanhTieng();
  const khoaXong = daCham || traLoi !== null;

  useEffect(() => {
    ghi.current = new BoGhiNhatKy(() => performance.now());
  }, []);

  if (daCham && chiTiet) return <KetQuaTruyVet de={de} ct={chiTiet as ChiTietTruyVet} />;

  const cuoi = ds.at(-1);
  const khoaCuoi = cuoi ? (tt.doan[cuoi.so]?.khoa ?? null) : null;
  const tenCam = (id: string) => de.camera.find((c) => c.id === id)?.ten ?? id;
  const gio = (giay: number) => gioTrongTro(de.gio_xay_ra, giay);
  const cam = camChon ? de.camera.find((c) => c.id === camChon) : undefined;
  const tCam = cam ? thoiDiemCamera({ luoi, gmo: de.giay_moi_o }, tt, cam) : null;
  const choGiay = tCam !== null ? Math.max(0, tCam + 5 - tt.dong_ho) : 0;
  const daXem = cam && tCam !== null && tt.doan.some((d) => d.camera === cam.id && d.t === tCam);
  const khoaGui = cuoi && khoaCuoi === null && chonXe ? { doan: cuoi.so, xe: chonXe } : null;

  const moCamera = async () => {
    if (!cam || dangMo || khoaXong) return;
    const cho = choGiay > 0;
    datDangMo(true);
    datThongBao("");
    let kq: { doan: DoanCanh; trang_thai: TrangThaiTruyVet } | { loi: string };
    if (buocOffline && vOff) {
      const moi: Op[] = [];
      if (khoaGui) moi.push({ thao_tac: "khoa", tham_so: khoaGui });
      moi.push({ thao_tac: "mo", tham_so: { camera: cam.id, cho } });
      let t = tt;
      let loi: string | null = null;
      for (const op of moi) {
        const r = apThaoTacTV(vOff, t, op, buocOffline.lo_trinh);
        if ("loi" in r) {
          loi = r.loi.thong_bao;
          break;
        }
        t = r.tt;
      }
      if (loi) kq = { loi };
      else {
        for (const op of moi) {
          ghi.current?.ghi(op.thao_tac, op.tham_so);
        }
        kq = { doan: dungDoanCanh(vOff, t.doan.at(-1)!, buocOffline.lo_trinh), trang_thai: t };
      }
    } else kq = await moCameraOnline(luotId ?? "", { camera: cam.id, cho, khoa: khoaGui });
    datDangMo(false);
    if ("loi" in kq) {
      datThongBao(kq.loi);
      rung("sai");
      return;
    }
    datTt(kq.trang_thai);
    datDs((d) => [...d, kq.doan]);
    datXem(kq.trang_thai.doan.length - 1);
    datChonXe(null);
    datCamChon(null);
    phatAm("tich");
    datThongBao(`Đã mở ${tenCam(kq.doan.camera)}. Xem đoạn cảnh, chạm xe khớp mô tả để chọn rồi khóa.`);
    doanRef.current?.scrollIntoView({ block: "start", behavior: giam ? "auto" : "smooth" });
  };

  const chamBanDo = (o: ToaDoO) => {
    if (khoaXong) return;
    if (cheDoChan) {
      // Chạm lệch một ô thì bắt vào ô đường gần nhất.
      const gan = [
        o,
        ...[-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: o.x + dx, y: o.y + dy }))),
      ].find((p) => laDuong(luoi, p));
      if (gan) {
        datOChan(gan);
        datThongBao(`Điểm chặn: ô cột ${gan.x + 1}, dòng ${gan.y + 1}.`);
      } else datThongBao("Điểm chặn phải nằm trên đường.");
      return;
    }
    const c = de.camera
      .map((c) => ({ c, d: Math.max(Math.abs(c.x - o.x), Math.abs(c.y - o.y)) }))
      .filter((x) => x.d <= 1)
      .sort((a, b) => a.d - b.d)[0];
    if (c) datCamChon(c.c.id);
  };

  const dichChan = (dx: number, dy: number) => {
    const p = oChan ?? { x: de.noi_xay_ra.x, y: de.noi_xay_ra.y };
    for (let k = 1; k < Math.max(de.ban_do.rong, de.ban_do.cao); k++) {
      const q = { x: p.x + dx * k, y: p.y + dy * k };
      if (q.x < 0 || q.y < 0 || q.x >= de.ban_do.rong || q.y >= de.ban_do.cao) return;
      if (laDuong(luoi, q)) {
        datOChan(q);
        return;
      }
    }
  };

  const chotChan = () => {
    if (!oChan || khoaXong || daGui.current || !ghi.current) return;
    daGui.current = true;
    const cuoiOps: Op[] = [];
    if (khoaGui) cuoiOps.push({ thao_tac: "khoa", tham_so: khoaGui });
    cuoiOps.push({ thao_tac: "chan", tham_so: { x: oChan.x, y: oChan.y } });
    for (const op of cuoiOps) ghi.current.ghi(op.thao_tac, op.tham_so);
    const nk = ghi.current.ketThuc();
    // Online: máy chủ chỉ nhận thao tác khóa, chặn cuối (lần mở camera đã ghi ở route). Offline: nộp cả nhật ký.
    const tl: TraLoiTruyVet = buocOffline
      ? nk
      : { thao_tac: nk.thao_tac.slice(-cuoiOps.length), tong_nhip: nk.tong_nhip };
    datTraLoi(tl);
    gui?.(tl);
  };

  const dangXem = ds[xem];
  const moTa = de.tin_bao.mo_ta;
  const xeChon = cuoi && chonXe ? cuoi.xe.find((x) => x.id === chonXe) : undefined;
  const moc = tt.moc.camera ? tenCam(tt.moc.camera) : de.noi_xay_ra.ten;

  const lop = (
    <g>
      {(() => {
        const [ax, ay] = tamO(de.noi_xay_ra);
        return (
          <g>
            <path
              d={`M${ax - 3},${ay - 3} L${ax + 3},${ay + 3} M${ax + 3},${ay - 3} L${ax - 3},${ay + 3}`}
              stroke="var(--danger)"
              strokeWidth="1.8"
            />
          </g>
        );
      })()}
      {de.camera.map((c) => {
        const [x, y] = tamO(c);
        const daMo = tt.doan.some((d) => d.camera === c.id);
        const la = tt.moc.camera === c.id;
        return (
          <g key={c.id} transform={`translate(${x},${y})`}>
            <path d={QUAT[c.huong]} fill="var(--primary)" opacity="0.35" />
            <circle
              r="3.3"
              fill={daMo ? "var(--primary)" : "var(--surface)"}
              stroke="var(--primary)"
              strokeWidth="1.2"
            />
            {la ? <circle r="5.2" fill="none" stroke="var(--danger)" strokeWidth="1.2" /> : null}
            {camChon === c.id ? (
              <circle r="6.4" fill="none" stroke="var(--warn)" strokeWidth="1.4" strokeDasharray="2 1.4" />
            ) : null}
          </g>
        );
      })}
      {oChan ? (
        <g transform={`translate(${tamO(oChan)[0]},${tamO(oChan)[1]})`}>
          <rect
            x="-4"
            y="-4"
            width="8"
            height="8"
            transform="rotate(45)"
            fill="var(--ok)"
            stroke="var(--surface)"
            strokeWidth="1"
          />
        </g>
      ) : null}
    </g>
  );

  return (
    <div className="space-y-4" data-dong-ho={tt.dong_ho} data-con-luot={tt.con_luot}>
      <section className="g-the rounded-2xl p-4" aria-labelledby="tin-bao">
        <div className="flex items-start justify-between gap-3">
          <h3 id="tin-bao" className="text-base font-semibold">
            Tin báo lúc {de.gio_xay_ra.slice(0, 5)}
          </h3>
          {docTin.hoTro ? (
            <Button
              variant="secondary"
              className="min-h-12 shrink-0"
              onClick={() =>
                docTin.dangDoc || docTin.dangTai
                  ? docTin.dung()
                  : void docTin.doc(de.tin_bao.loi.replace(/^\[Demo\]\s*/, ""))
              }
            >
              {docTin.dangTai ? "Đang tải…" : docTin.dangDoc ? "Dừng đọc" : "Nghe tin báo"}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed">{de.tin_bao.loi}</p>
        {docTin.loi ? <p className="mt-1 text-sm text-ink-2">{docTin.loi}</p> : null}
        <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Mô tả xe">
          <li className="rounded-full border border-line px-3 py-1">{TEN_LOAI_XE_TV[moTa.loai]}</li>
          <li className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-sm border border-black/40"
              style={{ background: MAU_THAN_XE[moTa.mau] }}
            />
            màu {TEN_MAU_XE[moTa.mau]}
          </li>
          <li className="rounded-full border border-line px-3 py-1">
            biển có <strong className="g-so">{moTa.ky_tu}</strong>
          </li>
          <li className="rounded-full border border-line px-3 py-1">
            chạy về hướng {TEN_HUONG_O[de.tin_bao.huong]}
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span>
          Giờ trong trò <strong className="g-so">{gio(tt.dong_ho)}</strong>
        </span>
        <span>
          Lượt xem còn <strong className="g-so">{tt.con_luot}</strong>/{de.luot_xem}
        </span>
        <span className="w-full text-ink-2">
          Mốc gần nhất: {moc} lúc {gio(tt.moc.t)}
        </span>
      </div>

      <BanDoO
        banDo={de.ban_do}
        nhan={
          cheDoChan ? "Bản đồ khu phố: chạm ô đường để đặt điểm chặn" : "Bản đồ khu phố: chạm camera để chọn"
        }
        onChamO={khoaXong ? undefined : chamBanDo}
        oTro={cheDoChan ? oChan : null}
        lop={lop}
      />

      {!khoaXong && !cheDoChan ? (
        <div className="space-y-3">
          <label className="block text-sm font-semibold" htmlFor="chon-camera">
            Chọn camera
          </label>
          <select
            id="chon-camera"
            className="min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-base"
            value={camChon ?? ""}
            onChange={(e) => datCamChon(e.target.value || null)}
          >
            <option value="">Chạm camera trên bản đồ, hoặc chọn ở đây</option>
            {de.camera.map((c, i) => (
              <option key={c.id} value={c.id}>
                {i + 1}. {c.ten}
                {tt.doan.some((d) => d.camera === c.id) ? " (đã xem)" : ""}
              </option>
            ))}
          </select>
          {cam ? (
            <div className="g-the rounded-2xl p-4" aria-live="polite">
              <p className="font-semibold">{cam.ten}</p>
              {tCam === null ? (
                <p className="mt-1 text-sm">Không có đường tới camera này.</p>
              ) : (
                <>
                  <p className="mt-1 text-[15px]">
                    Tính theo quãng đường từ mốc gần nhất, xe tới đây sớm nhất lúc{" "}
                    <strong className="g-so">{gio(tCam)}</strong>.
                  </p>
                  {choGiay > 0 ? (
                    <p className="mt-1 text-sm text-ink-2">
                      Cảnh lúc đó chưa ghi xong: phải chờ thêm {choGiay} giây trong trò.
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-ink-2">
                    Xem tốn một lượt và {de.giay_xem} giây; camera không thấy xe tốn thêm {de.giay_sai_huong}{" "}
                    giây.
                  </p>
                </>
              )}
              {khoaGui ? (
                <p className="mt-2 text-sm">
                  Xe đang chọn ở đoạn cảnh vừa xem sẽ được khóa trước khi mở camera này.
                </p>
              ) : null}
              <Button
                className="g-nut mt-3 w-full"
                disabled={dangMo || tCam === null || Boolean(daXem) || tt.con_luot <= 0}
                onClick={() => void moCamera()}
              >
                {dangMo
                  ? "Đang mở…"
                  : daXem
                    ? "Đã xem đoạn này"
                    : tt.con_luot <= 0
                      ? "Hết lượt xem"
                      : choGiay > 0
                        ? `Chờ ${choGiay} giây rồi xem`
                        : "Xem camera"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {thongBao ? (
        <p role="status" className="text-sm">
          {thongBao}
        </p>
      ) : null}

      {ds.length ? (
        <section ref={doanRef} className="scroll-mt-16 space-y-3" aria-label="Đoạn cảnh đã mở">
          {ds.length > 1 ? (
            <div role="tablist" aria-label="Chọn đoạn cảnh" className="flex flex-wrap gap-2">
              {ds.map((d, i) => (
                <button
                  key={d.so}
                  type="button"
                  role="tab"
                  aria-selected={xem === i}
                  onClick={() => datXem(i)}
                  className={cn(
                    "min-h-12 rounded-lg border px-3 text-sm",
                    xem === i ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-line",
                  )}
                >
                  Đoạn {i + 1}
                  {tt.doan[d.so]?.khoa ? " · đã khóa" : ""}
                </button>
              ))}
            </div>
          ) : null}
          {dangXem ? (
            <DoanCamera
              key={dangXem.so}
              doan={dangXem}
              ten={tenCam(dangXem.camera)}
              gioXayRa={de.gio_xay_ra}
              chon={dangXem === cuoi ? chonXe : null}
              khoa={tt.doan[dangXem.so]?.khoa ?? null}
              choChon={!khoaXong && dangXem === cuoi && khoaCuoi === null}
              onChon={datChonXe}
            />
          ) : null}
          {xeChon ? (
            <div className="g-the rounded-2xl p-4" aria-live="polite">
              <p className="flex items-center gap-2 font-semibold">
                <span
                  aria-hidden="true"
                  className="inline-block size-3.5 rounded-sm border border-black/40"
                  style={{ background: MAU_THAN_XE[xeChon.mau] }}
                />
                {TEN_LOAI_XE_TV[xeChon.loai]} màu {TEN_MAU_XE[xeChon.mau]}
              </p>
              <p className="mt-1 text-[15px]">
                Biển số <strong className="g-so">{xeChon.bien_so}</strong>
              </p>
              <p className="mt-1 text-sm text-ink-2">
                Vào từ {phia(xeChon.vao)}, ra {phia(xeChon.ra)}.
              </p>
              <p className="mt-2 text-sm">
                Xe đang chọn sẽ được khóa khi bạn mở camera tiếp theo hoặc chốt điểm chặn.
              </p>
            </div>
          ) : cuoi && khoaCuoi ? (
            <p className="text-sm">
              Đã khóa một xe ở {tenCam(cuoi.camera)}
              {(() => {
                const x = cuoi.xe.find((v) => v.id === khoaCuoi);
                return x ? `; xe ra ${phia(x.ra)}.` : ".";
              })()}
            </p>
          ) : null}
        </section>
      ) : null}

      {!khoaXong ? (
        <section className="space-y-3" aria-label="Điểm chặn">
          {!cheDoChan ? (
            <Button variant="secondary" className="min-h-12 w-full" onClick={() => datCheDoChan(true)}>
              Đặt điểm chặn trên bản đồ
            </Button>
          ) : (
            <>
              <p className="text-[15px]">
                Chạm ô đường phía trước xe để đặt điểm chặn. Xe phải tới đó muộn hơn giờ hiện tại ít nhất{" "}
                {de.giay_chan_truoc} giây.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["Lên", 0, -1],
                    ["Xuống", 0, 1],
                    ["Trái", -1, 0],
                    ["Phải", 1, 0],
                  ] as const
                ).map(([t, dx, dy]) => (
                  <Button
                    key={t}
                    variant="secondary"
                    className="min-h-12"
                    aria-label={`Dời điểm chặn sang ô đường phía ${t.toLowerCase()}`}
                    onClick={() => dichChan(dx, dy)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="min-h-12" onClick={() => datCheDoChan(false)}>
                  Quay lại xem camera
                </Button>
                <Button className="g-nut" disabled={!oChan} onClick={chotChan}>
                  Chốt điểm chặn
                </Button>
              </div>
            </>
          )}
        </section>
      ) : (
        <p role="status" className="text-center text-sm text-ink-2">
          Đang chấm…
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kết quả                                                             */
/* ------------------------------------------------------------------ */

function KetQuaTruyVet({ de, ct }: { de: DeTruyVet; ct: ChiTietTruyVet }) {
  const tren = new Set(ct.camera_tren_duong);
  const duong = ct.lo_trinh.map((o) => tamO(o).join(",")).join(" ");
  return (
    <div className="space-y-3">
      <BanDoO
        banDo={de.ban_do}
        nhan="Bản đồ kết quả: đường xe chạy thật, camera, điểm chặn"
        lop={
          <g>
            <polyline
              points={duong}
              fill="none"
              stroke="var(--danger)"
              strokeWidth="2.2"
              strokeLinejoin="round"
              opacity="0.85"
            />
            {de.camera.map((c) => {
              const [x, y] = tamO(c);
              const mo = ct.doan.find((d) => d.camera === c.id);
              return (
                <circle
                  key={c.id}
                  cx={x}
                  cy={y}
                  r="3.3"
                  fill={mo ? (mo.co_xe ? "var(--ok)" : "var(--warn)") : "var(--surface)"}
                  stroke={tren.has(c.id) ? "var(--danger)" : "var(--primary)"}
                  strokeWidth="1.2"
                />
              );
            })}
            {ct.chan ? (
              <rect
                x={tamO(ct.chan)[0] - 4}
                y={tamO(ct.chan)[1] - 4}
                width="8"
                height="8"
                transform={`rotate(45 ${tamO(ct.chan)[0]} ${tamO(ct.chan)[1]})`}
                fill={ct.chan.dung ? "var(--ok)" : "var(--danger)"}
                stroke="var(--surface)"
              />
            ) : null}
          </g>
        }
      />
      <p className="text-sm text-ink-2">
        Đường đỏ: đường xe bỏ chạy đi thật. Vòng viền đỏ: camera trên đường xe chạy. Chấm xanh: camera bạn mở
        thấy xe; chấm vàng: camera bạn mở không thấy xe. Hình thoi: điểm chặn.
      </p>
      <p className="text-[15px]">
        Khóa đúng <strong>{ct.so_khoa_dung}</strong>/{ct.camera_tren_duong.length} camera
        {ct.so_khoa_nham ? `, khóa nhầm ${ct.so_khoa_nham}` : ""}; điểm chặn{" "}
        {ct.chan?.dung ? "đúng" : "chưa đúng"}.
      </p>
    </div>
  );
}

/** Chi tiết riêng trong "Xem chi tiết" của hộp kết quả (GĐ17c). */
export function ChiTietRiengTruyVet({ de, chiTiet, ketQua }: PropsChiTiet<DeTruyVet>) {
  const ct = chiTiet as ChiTietTruyVet;
  const gio = (g: number) => gioTrongTro(ct.gio_xay_ra, g);
  const ten = (id: string) => de.camera.find((c) => c.id === id)?.ten ?? id;
  return (
    <div className="space-y-3 text-[15px]">
      {!ct.hop_le ? <p className="text-danger">Không chấm được: {ct.ly_do}</p> : null}
      <section aria-label="Từng đoạn cảnh đã xem">
        <ul className="grid gap-2">
          {ct.doan.map((d, i) => (
            <li
              key={d.so}
              className="border-l-4 pl-3"
              style={{
                borderColor: d.khoa_dung === false ? "var(--danger)" : d.co_xe ? "var(--ok)" : "var(--warn)",
              }}
            >
              <p className="font-semibold">
                Đoạn {i + 1}: {ten(d.camera)} lúc {gio(d.bat_dau)}
              </p>
              <p>
                {d.co_xe
                  ? "Xe bỏ chạy có đi qua trong đoạn này."
                  : "Xe bỏ chạy không qua camera này lúc đó (tốn thêm thời gian)."}
              </p>
              {d.xe_khoa ? (
                <p className={d.khoa_dung ? "text-ok" : "text-danger"}>
                  {d.khoa_dung ? "✓ Khóa đúng" : "✗ Khóa nhầm"}: {TEN_LOAI_XE_TV[d.xe_khoa.loai]} màu{" "}
                  {TEN_MAU_XE[d.xe_khoa.mau]}, biển {d.xe_khoa.bien_so}
                  {d.khoa_dung
                    ? "."
                    : ` (xe cần tìm: ${TEN_LOAI_XE_TV[de.tin_bao.mo_ta.loai]} màu ${TEN_MAU_XE[de.tin_bao.mo_ta.mau]}, biển có ${de.tin_bao.mo_ta.ky_tu}).`}
                </p>
              ) : d.co_xe ? (
                <p className="text-ink-2">Chưa khóa xe nào ở đoạn này.</p>
              ) : null}
            </li>
          ))}
        </ul>
        {!ct.doan.length ? <p className="text-ink-2">Chưa mở camera nào.</p> : null}
      </section>
      <section aria-label="Điểm chặn và điểm số" className="space-y-2">
        {ct.chan ? (
          <p>
            Điểm chặn {ct.chan.dung ? "đúng" : "chưa đúng"}: đặt lúc {gio(ct.dong_ho)};{" "}
            {ct.chan.xe_toi === null
              ? "ô này không nằm trên đường xe chạy."
              : `xe tới ô này lúc ${gio(ct.chan.xe_toi)}; cần muộn hơn lúc đặt ít nhất ${de.giay_chan_truoc} giây.`}
          </p>
        ) : null}
        <p>
          Điểm: khóa {ct.diem_khoa}, chặn {ct.diem_chan}, lượt xem còn dư {ct.diem_thuong} (còn {ct.con_luot}{" "}
          lượt; chỉ tính khi chặn đúng).
        </p>
      </section>
      <p className="text-sm text-ink-2">
        {ketQua.can_cu.length
          ? `Căn cứ: ${ketQua.can_cu.map(nhanVienDan).join("; ")}.`
          : "Căn cứ đang được cập nhật: quy định về hành vi bỏ chạy sau tai nạn và trách nhiệm của người điều khiển phương tiện liên quan tới vụ tai nạn chưa có trong kho văn bản."}
      </p>
      <p className="text-sm text-ink-2">Vụ việc, bản đồ, biển số là mô phỏng minh họa.</p>
    </div>
  );
}
