/**
 * Trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9, GAME_DESIGN §5.9).
 *
 * Người chơi chọn ô tô con hoặc xe mô tô, lái từ điểm xuất phát tới cờ đích bằng nút ga, phanh, trái,
 * phải, xi nhan (NutLai.tsx). Khu phố nhìn từ trên xuống, camera bám xe và xoay theo hướng
 * đường (M6): đường phía trước luôn hướng lên trên màn, nút Trái, Phải khớp trái, phải. Điện thoại chạy cùng bộ
 * mô phỏng khu phố với máy chủ; mỗi lần bấm nút ghi một thao tác vào nhật ký theo SỐ NHỊP mô phỏng
 * (M7), rồi áp ngay trước nhịp kế, đúng như máy chủ chạy lại. Lỗi được ghi âm thầm, chỉ hiện sau khi
 * chấm: bảng chơi có bản đồ và danh sách lỗi gọn, chạm "Xem lại lúc…" để tua lại 3 giây trước lỗi đó;
 * biên bản đầy đủ nằm trong "Xem chi tiết" của hộp kết quả (`ChiTietRiengTuLai`, GĐ17c).
 *
 * Giảm chuyển động: khung nhìn cố định theo đoạn (không bám xe từng khung hình), góc xoay đổi ngay
 * không có hoạt ảnh, tốc độ tối đa còn
 * 70% và không tính giờ (luật ở máy chủ, theo thao tác chọn xe). Tua lại hiện ảnh tĩnh, lùi/tới từng
 * giây.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import { moTaMucPhatBienBan } from "../../lib/kiem-tra-giay-to";
import {
  apThaoTacLai,
  bamTuLai,
  buocPho,
  type ChiTietTuLai,
  chayLaiTuLai,
  type DeTuLai,
  dungTheGioi,
  giaoPhiaTruoc,
  kmh,
  type LoaiXeNguoiLai,
  laDuong,
  SO_THAO_TAC_TOI_DA,
  type ThamSoTuLai,
  type ThaoTacLai,
  type ThaoTacTuLai,
  type TheGioi,
  type TraLoiTuLai,
  type TrangThaiPho,
  thoiDiem,
  trangThaiDauPho,
} from "../../lib/tu-lai";
import { type BienDoi, raX, raY, taoBienDoi } from "../../lib/ve-canh/bien-doi";
import { type BangMau, docBangMau } from "../../lib/ve-canh/mau";
import { veCanhPho, veNenPho, veVetVaLoi, veXeNguoiChoi } from "../../lib/ve-canh/ve-pho";
import { Button } from "../ui/Button";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";
import { type HuongLaiNut, NutLai } from "./NutLai";

export type TraLoiTuLaiWeb = TraLoiTuLai | null;

/** Tỷ lệ khi lái: 8 px mỗi mét (màn 360 px thấy chừng 45 m). */
const TY_LE_LAI = 0.08;
const TEN_XE: Record<LoaiXeNguoiLai, string> = { o_to: "Ô tô con", xe_may: "Xe mô tô" };
const urlAnhBien = (anh: string) => `/bien-bao/anh/${encodeURIComponent(anh)}`;

function useAnhBien(bien: DeTuLai["bien"]) {
  const anh = useRef(new Map<string, HTMLImageElement>());
  const [, datPhien] = useState(0);
  useEffect(() => {
    for (const b of bien) {
      if (anh.current.has(b.ma)) continue;
      const img = new Image();
      img.onload = () => datPhien((p) => p + 1);
      img.src = urlAnhBien(b.anh);
      anh.current.set(b.ma, img);
    }
  }, [bien]);
  return anh.current;
}

/** Xe đứng ở 68% chiều cao khung khi lái, để thấy nhiều đường phía trước. */
const TAM_Y = 0.68;
/** Góc (radian) của hướng rời rạc, 0 là lên. */
const gocHuong = (h: number) => (h * Math.PI) / 4;
/** Đưa góc về khoảng [−π, π]. */
const veKhoang = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/**
 * Hướng camera nhắm tới: đang rẽ, quay đầu thì theo hướng xe (xoay cùng xe); còn lại theo hướng
 * đường, để chuyển làn không làm khung nhìn lắc chéo.
 */
const gocDichCamera = (n: TrangThaiPho["nguoi"]) =>
  gocHuong(n.thao_tac === "re" || n.thao_tac === "quay_dau" ? n.xe.huong : n.h_duong);

/**
 * Góc camera: xoay êm dần về hướng đường đang đi (đường phía trước luôn hướng lên trên, nút Trái,
 * Phải khớp trái, phải trên màn). `tuc` (giảm chuyển động) thì nhảy thẳng tới góc đích.
 */
function useGocCamera() {
  const goc = useRef<number | null>(null);
  const luc = useRef(0);
  const lay = useCallback((dich: number, tuc: boolean) => {
    const now = performance.now();
    const dt = Math.min(250, now - luc.current);
    luc.current = now;
    goc.current =
      goc.current === null || tuc
        ? dich
        : veKhoang(goc.current + veKhoang(dich - goc.current) * (1 - Math.exp(-dt / 200)));
    return goc.current;
  }, []);
  const datLai = useCallback(() => {
    goc.current = null;
  }, []);
  return { lay, datLai };
}

/**
 * Vẽ cảnh quanh xe người chơi, xoay ngược góc camera. Khung bản đồ là hình vuông đủ phủ cả màn khi
 * xoay. Giảm chuyển động: tâm khung đứng yên theo từng ô lưới, xe ở giữa khung.
 */
function veTheoXe(
  ctx: CanvasRenderingContext2D,
  bd0: BienDoi,
  x: number,
  y: number,
  goc: number,
  giam: boolean,
  veCanh: (bd: BienDoi) => void,
) {
  const { rong: w, cao: h } = bd0;
  const tamY = giam ? 0.5 : TAM_Y;
  const D = Math.ceil(2 * Math.hypot(w / 2, h * Math.max(tamY, 1 - tamY)));
  const n = D / TY_LE_LAI;
  let cx = x;
  let cy = y;
  if (giam) {
    const o = Math.min(w, h) / 2 / TY_LE_LAI;
    cx = (Math.floor(x / o) + 0.5) * o;
    cy = (Math.floor(y / o) + 0.5) * o;
  }
  const bd = taoBienDoi({ x0: cx - n / 2, y0: cy - n / 2, x1: cx + n / 2, y1: cy + n / 2 }, D, D);
  ctx.save();
  ctx.translate(w / 2, h * tamY);
  ctx.rotate(-goc);
  ctx.translate(-D / 2, -D / 2);
  veCanh(bd);
  ctx.restore();
}

const khungToanCanh = (the: Pick<TheGioi, "hang" | "cot">) => ({
  x0: 0,
  y0: 0,
  x1: the.cot * 1000,
  y1: the.hang * 1000,
});

/** Chiều cao khung vẽ toàn cảnh theo tỷ lệ bản đồ và bề rộng màn. */
function useCaoToanCanh(hang: number, cot: number) {
  const [cao, datCao] = useState(300);
  useEffect(() => {
    const rong = Math.min(640, window.innerWidth - 32);
    datCao(Math.max(200, Math.min(520, Math.round((rong * hang) / cot))));
  }, [hang, cot]);
  return cao;
}

export function TuLai({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeTuLai;
  traLoi: TraLoiTuLaiWeb;
  datTraLoi: (t: TraLoiTuLaiWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiTuLaiWeb) => void;
}) {
  if (daCham && chiTiet) return <KetQuaTuLai de={de} ct={chiTiet as ChiTietTuLai} nhatKy={traLoi} />;
  if (traLoi)
    return (
      <p role="status" className="rounded-xl border border-line p-4 text-[15px]">
        Đã nộp lượt lái. Đang lập biên bản…
      </p>
    );
  return <LaiXe de={de} datTraLoi={datTraLoi} gui={gui} />;
}

/* ------------------------------------------------------------------ */
/* Lái                                                                 */
/* ------------------------------------------------------------------ */

interface Hud {
  kmh: number;
  gioiHan: number | null;
  conGiay: number | null;
  gocDich: number;
  cachDich: number;
  nhanTrai: string;
  nhanPhai: string;
  goiY: string;
  ga: boolean;
  phanh: boolean;
  xiNhan: HuongLaiNut | null;
  yDinh: HuongLaiNut | null;
}

function tinhHud(the: TheGioi, tt: TrangThaiPho): Hud {
  const n = tt.nguoi;
  const [r, c] = n.o;
  const ch = the.luoi[r]?.[c] ?? ".";
  const truoc = giaoPhiaTruoc(the, n);
  let nhanTrai = "Trái";
  let nhanPhai = "Phải";
  let goiY = "Đang qua nơi giao nhau.";
  if (truoc) {
    nhanTrai = "Rẽ trái";
    nhanPhai = "Rẽ phải";
    goiY = n.y_dinh
      ? `Sẽ rẽ ${n.y_dinh === "trai" ? "trái" : "phải"} ở nơi giao nhau tới. Chạm lại để đi thẳng.`
      : "Nơi giao nhau phía trước: chạm Rẽ trái hoặc Rẽ phải để chọn hướng, không chạm thì đi thẳng.";
  } else if (!n.giao && !n.thao_tac && laDuong(ch) && ch !== "+") {
    const haiChieu = ch === "-" || ch === "|";
    nhanTrai = n.xe.v === 0 && haiChieu ? "Quay đầu" : "Sang làn trái";
    nhanPhai = "Sang làn phải";
    goiY =
      n.xe.v === 0 && haiChieu
        ? "Đang đứng yên: chạm Quay đầu để quay xe (nhớ xi nhan trái)."
        : "Giữa phố: chạm Trái, Phải để chuyển làn.";
  } else if (n.thao_tac)
    goiY =
      n.thao_tac === "re" ? "Đang rẽ." : n.thao_tac === "quay_dau" ? "Đang quay đầu." : "Đang chuyển làn.";
  const vung = the.toc_do.get(`${r},${c},${n.h_duong}`);
  const [dr, dc] = the.bd.dich.o;
  const dx = dc * 1000 + 500 - n.xe.x / 10;
  const dy = dr * 1000 + 500 - n.xe.y / 10;
  return {
    kmh: kmh(n.xe.v),
    gioiHan: vung?.kmh ?? null,
    conGiay: the.giam || !the.bd.gio_giay ? null : Math.max(0, Math.ceil((the.nhip_toi_da - tt.nhip) / 20)),
    // Khung nhìn xoay theo hướng đường nên mũi tên tính so với hướng đó.
    gocDich: Math.atan2(dx, -dy) - gocHuong(n.h_duong),
    cachDich: Math.round(Math.sqrt(dx * dx + dy * dy) / 100),
    nhanTrai,
    nhanPhai,
    goiY,
    ga: n.ga,
    phanh: n.phanh,
    xiNhan: n.xi_nhan,
    yDinh: n.y_dinh,
  };
}

type OpNhatKy = { nhip: number; thao_tac: ThaoTacTuLai; tham_so: ThamSoTuLai };

function LaiXe({
  de,
  datTraLoi,
  gui,
}: {
  de: DeTuLai;
  datTraLoi: (t: TraLoiTuLaiWeb) => void;
  gui?: (t: TraLoiTuLaiWeb) => void;
}) {
  const giam = useGiamChuyenDong();
  const anh = useAnhBien(de.bien);
  const [xe, datXe] = useState<LoaiXeNguoiLai>("o_to");
  const [dangLai, datDangLai] = useState(false);
  const [tamDung, datTamDung] = useState(false);
  const [hud, datHud] = useState<Hud | null>(null);
  const [cao, datCao] = useState(420);
  const the = useRef<TheGioi | null>(null);
  const tt = useRef<TrangThaiPho | null>(null);
  const ttTruoc = useRef<TrangThaiPho | null>(null);
  const ops = useRef<OpNhatKy[]>([]);
  const daGui = useRef(false);
  const mau = useRef<BangMau>(docBangMau());
  const giamLuc = useRef(false);
  const camera = useGocCamera();

  // Thế giới xem trước (màn chọn xe): cùng bản đồ, xe đứng ở điểm xuất phát.
  const xemTruoc = useMemo(() => {
    const t = dungTheGioi(de.ban_do, "o_to", false);
    return { the: t, tt: trangThaiDauPho(t) };
  }, [de.ban_do]);
  const caoToanCanh = useCaoToanCanh(xemTruoc.the.hang, xemTruoc.the.cot);

  // Khi lái, cả khung nhìn và nút phải nằm gọn trong màn (360×740: khung nhìn chừng 360 px), không cuộn.
  const khungLai = useRef<HTMLDivElement>(null);
  useEffect(() => {
    datCao(Math.max(220, Math.min(520, window.innerHeight - 390)));
  }, []);
  useEffect(() => {
    if (dangLai) khungLai.current?.scrollIntoView({ block: "start" });
  }, [dangLai]);

  const capNhatHud = useCallback(() => {
    if (the.current && tt.current) datHud(tinhHud(the.current, tt.current));
  }, []);

  const batDau = () => {
    giamLuc.current = giam;
    const t = dungTheGioi(de.ban_do, xe, giam);
    the.current = t;
    tt.current = trangThaiDauPho(t);
    ttTruoc.current = tt.current;
    ops.current = [{ nhip: 0, thao_tac: "bat_dau", tham_so: { xe, giam } }];
    mau.current = docBangMau();
    camera.datLai();
    datDangLai(true);
    capNhatHud();
    phatAm("khoi_dong");
  };

  const nop = useCallback(() => {
    if (daGui.current || !tt.current) return;
    daGui.current = true;
    const nk: TraLoiTuLai = {
      thao_tac: [...ops.current] as TraLoiTuLai["thao_tac"],
      tong_nhip: tt.current.nhip,
    };
    datTraLoi(nk);
    gui?.(nk);
  }, [datTraLoi, gui]);

  /** Ghi thao tác ở nhịp hiện tại và áp ngay (trước nhịp kế), như máy chủ chạy lại. */
  const nhap = useCallback(
    (t: ThaoTacLai) => {
      const s = tt.current;
      if (!the.current || !s || s.ket_thuc || daGui.current || tamDung) return;
      if (ops.current.length >= SO_THAO_TAC_TOI_DA) return;
      if (
        (t.thao_tac === "ga" && s.nguoi.ga === t.tham_so) ||
        (t.thao_tac === "phanh" && s.nguoi.phanh === t.tham_so)
      )
        return;
      ops.current.push({ nhip: s.nhip, thao_tac: t.thao_tac, tham_so: t.tham_so });
      tt.current = apThaoTacLai(the.current, s, t);
      if (t.thao_tac === "lai" || t.thao_tac === "xi_nhan") phatAm("tich");
      capNhatHud();
    },
    [capNhatHud, tamDung],
  );

  const tienNhip = useCallback(() => {
    const t = the.current;
    const s = tt.current;
    if (!t || !s) return false;
    ttTruoc.current = s;
    const moi = buocPho(t, s);
    tt.current = moi;
    if (moi.da_va.length > s.da_va.length) rung("sai");
    if (moi.nhip % 4 === 0 || moi.ket_thuc) capNhatHud();
    return !moi.ket_thuc;
  }, [capNhatHud]);

  const ketThuc = useCallback(() => {
    const s = tt.current;
    if (!s) return;
    if (s.ket_thuc === "den_dich") {
      phatAm("hoan_thanh");
      rung("len_cap");
    } else phatAm("het_gio");
    nop();
  }, [nop]);

  // Bàn phím: ↑ giữ ga, ↓ giữ phanh, ← → trái phải, Q E xi nhan, P tạm dừng.
  useEffect(() => {
    if (!dangLai) return;
    const xuong = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = tt.current?.nguoi;
      if (e.key === "ArrowUp") nhap({ thao_tac: "ga", tham_so: true });
      else if (e.key === "ArrowDown") nhap({ thao_tac: "phanh", tham_so: true });
      else if (e.key === "ArrowLeft" && !e.repeat) nhap({ thao_tac: "lai", tham_so: "trai" });
      else if (e.key === "ArrowRight" && !e.repeat) nhap({ thao_tac: "lai", tham_so: "phai" });
      else if ((e.key === "q" || e.key === "Q") && !e.repeat)
        nhap({ thao_tac: "xi_nhan", tham_so: n?.xi_nhan === "trai" ? null : "trai" });
      else if ((e.key === "e" || e.key === "E") && !e.repeat)
        nhap({ thao_tac: "xi_nhan", tham_so: n?.xi_nhan === "phai" ? null : "phai" });
      else if ((e.key === "p" || e.key === "P") && !e.repeat) datTamDung((d) => !d);
      else return;
      e.preventDefault();
    };
    const len = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") nhap({ thao_tac: "ga", tham_so: false });
      else if (e.key === "ArrowDown") nhap({ thao_tac: "phanh", tham_so: false });
    };
    window.addEventListener("keydown", xuong);
    window.addEventListener("keyup", len);
    return () => {
      window.removeEventListener("keydown", xuong);
      window.removeEventListener("keyup", len);
    };
  }, [dangLai, nhap]);

  const ve = (ctx: CanvasRenderingContext2D, bd0: BienDoi, alpha: number) => {
    const t = the.current;
    const s = tt.current;
    const s0 = ttTruoc.current ?? s;
    if (!t || !s || !s0) return;
    const x = (s0.nguoi.xe.x + (s.nguoi.xe.x - s0.nguoi.xe.x) * alpha) / 10;
    const y = (s0.nguoi.xe.y + (s.nguoi.xe.y - s0.nguoi.xe.y) * alpha) / 10;
    const goc = camera.lay(gocDichCamera(s.nguoi), giamLuc.current);
    const nhay = Math.floor(performance.now() / 400) % 2 === 0;
    veTheoXe(ctx, bd0, x, y, goc, giamLuc.current, (bd) =>
      veCanhPho(ctx, bd, mau.current, t, s0, s, alpha, anh, nhay, goc),
    );
  };

  if (!dangLai) {
    const t = xemTruoc.the;
    return (
      <div className="space-y-3">
        <p className="text-[15px]">
          <strong>{de.ban_do.ten_pho ?? "Khu phố"}</strong>: lái từ chỗ xe xanh tới cờ đích.{" "}
          {giam
            ? "Đang bật giảm hiệu ứng: khung nhìn đứng yên theo đoạn, tốc độ tối đa thấp hơn, không tính giờ."
            : de.ban_do.gio_giay
              ? `Có ${de.ban_do.gio_giay} giây.`
              : "Không tính giờ."}
        </p>
        <CanhTrenXuong
          khung={khungToanCanh(t)}
          cao={caoToanCanh}
          ve={(ctx, bd) => {
            const m = docBangMau();
            veNenPho(ctx, bd, m, t);
            veXeNguoiChoi(ctx, bd, m, xemTruoc.tt, xemTruoc.tt, 1, false);
          }}
          chay={false}
          nhan={`Bản đồ ${de.ban_do.ten_pho ?? "khu phố"}: xe xuất phát và cờ đích.`}
          className="overflow-hidden rounded-2xl border border-line"
        />
        <fieldset>
          <legend className="text-sm font-semibold">Chọn xe</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {de.xe.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={xe === x}
                onClick={() => datXe(x)}
                className={cn(
                  "min-h-14 rounded-2xl border-2 text-base font-semibold",
                  xe === x ? "bg-primary-soft" : "bg-surface",
                )}
                style={{ borderColor: xe === x ? "var(--primary)" : "var(--line)" }}
              >
                {TEN_XE[x]}
              </button>
            ))}
          </div>
        </fieldset>
        <Button className="g-nut min-h-12 w-full" onClick={batDau}>
          Bắt đầu lái
        </Button>
      </div>
    );
  }

  const n = tt.current?.nguoi;
  return (
    <div ref={khungLai} className="space-y-2" style={{ scrollMarginTop: 64 }}>
      {hud ? (
        <div className="flex items-center justify-between gap-2 text-sm" aria-live="off">
          <span className="g-so text-2xl font-bold tabular-nums">
            <span className="sr-only">Tốc độ </span>
            {hud.kmh}
            <span className="text-sm font-normal text-ink-2"> km/h</span>
          </span>
          {hud.gioiHan ? (
            <span
              className="grid size-10 place-items-center rounded-full border-4 bg-surface text-sm font-bold"
              style={{ borderColor: "var(--danger)" }}
            >
              <span className="sr-only">Giới hạn </span>
              {hud.gioiHan}
              <span className="sr-only"> km/h</span>
            </span>
          ) : (
            <span className="size-10" />
          )}
          <span className="flex items-center gap-1">
            <span className="sr-only">Đích cách chừng</span>
            <span
              aria-hidden
              className="inline-block text-lg"
              style={{ transform: `rotate(${hud.gocDich}rad)`, color: "var(--ok)" }}
            >
              ▲
            </span>
            <span className="tabular-nums">{hud.cachDich} m</span>
          </span>
          <span className="tabular-nums text-ink-2">
            {hud.conGiay !== null ? `Còn ${hud.conGiay} giây` : ""}
          </span>
        </div>
      ) : null}

      <CanhTrenXuong
        khung={khungToanCanh(the.current!)}
        cao={cao}
        ve={ve}
        chay={!tamDung && !daGui.current}
        tienNhip={tienNhip}
        onXong={ketThuc}
        nhan="Khu phố nhìn từ trên xuống, xoay theo hướng xe chạy: đường phía trước luôn hướng lên, xe của bạn màu xanh ở phía dưới khung."
        className="overflow-hidden rounded-2xl border border-line"
      />

      <p className="min-h-10 text-sm leading-snug text-ink-2" role="status" aria-live="polite">
        {tamDung ? "Đang tạm dừng." : hud?.goiY}
      </p>

      {hud && n ? (
        <NutLai
          ga={hud.ga}
          phanh={hud.phanh}
          xiNhan={hud.xiNhan}
          yDinh={hud.yDinh}
          nhanTrai={hud.nhanTrai}
          nhanPhai={hud.nhanPhai}
          khoa={tamDung}
          onGa={(b) => nhap({ thao_tac: "ga", tham_so: b })}
          onPhanh={(b) => nhap({ thao_tac: "phanh", tham_so: b })}
          onLai={(h) => nhap({ thao_tac: "lai", tham_so: h })}
          onXiNhan={(h) => nhap({ thao_tac: "xi_nhan", tham_so: h })}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" className="min-h-12" onClick={() => datTamDung((d) => !d)}>
          {tamDung ? "Lái tiếp" : "Tạm dừng"}
        </Button>
        <Button variant="secondary" size="sm" className="min-h-12" onClick={nop}>
          Dừng lượt, nộp
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kết quả                                                             */
/* ------------------------------------------------------------------ */

/** Tua lại 3 giây trước lỗi, chạy tới 1 giây sau lỗi. */
const TUA_TRUOC = 60;
const TUA_SAU = 20;

function KetQuaTuLai({ de, ct, nhatKy }: { de: DeTuLai; ct: ChiTietTuLai; nhatKy: TraLoiTuLaiWeb }) {
  const giam = useGiamChuyenDong();
  const anh = useAnhBien(de.bien);
  const the = useMemo(() => dungTheGioi(de.ban_do, ct.xe ?? "o_to", ct.giam), [de.ban_do, ct.xe, ct.giam]);
  const cao = useCaoToanCanh(the.hang, the.cot);
  const [caoTua, datCaoTua] = useState(360);
  const [chon, datChon] = useState<number | null>(null);
  const [dangTua, datDangTua] = useState(false);
  const [phien, datPhien] = useState(0);
  const tt = useRef<TrangThaiPho | null>(null);
  const ttTruoc = useRef<TrangThaiPho | null>(null);
  const denNhip = useRef(0);
  const mau = useRef<BangMau>(docBangMau());
  const camera = useGocCamera();
  const coTua = Boolean(nhatKy && ct.hop_le && nhatKy.thao_tac[0]?.thao_tac === "bat_dau");

  // Băm của lần chạy lại trên điện thoại, để so với máy chủ (E2E).
  const bamMay = useMemo(() => {
    if (!coTua || !nhatKy) return "";
    try {
      return bamTuLai(chayLaiTuLai(de.ban_do, nhatKy).tt);
    } catch {
      return "";
    }
  }, [coTua, nhatKy, de.ban_do]);

  useEffect(() => {
    datCaoTua(Math.max(260, Math.min(460, window.innerHeight - 300)));
  }, []);

  /** Chạy lại tới nhịp `n` (dừng ở đó). */
  const toi = (n: number) => {
    if (!nhatKy) return;
    const s = chayLaiTuLai(de.ban_do, nhatKy, Math.max(0, n)).tt;
    tt.current = s;
    ttTruoc.current = s;
  };

  const xemLai = (stt: number) => {
    const l = ct.loi.find((x) => x.stt === stt);
    if (!l || !nhatKy) return;
    datChon(stt);
    mau.current = docBangMau();
    camera.datLai();
    if (giam) {
      toi(l.nhip);
      denNhip.current = l.nhip;
      datDangTua(false);
    } else {
      toi(l.nhip - TUA_TRUOC);
      denNhip.current = l.nhip + TUA_SAU;
      datDangTua(true);
    }
    datPhien((p) => p + 1);
  };

  const buocGiay = (giay: number) => {
    const moi = Math.max(0, Math.min(ct.nhip, (tt.current?.nhip ?? 0) + giay * 20));
    toi(moi);
    datPhien((p) => p + 1);
  };

  const tienNhip = () => {
    const s = tt.current;
    if (!s || !nhatKy) return false;
    const t = the;
    let moi = s;
    for (const op of nhatKy.thao_tac)
      if (op.nhip === moi.nhip && op.thao_tac !== "bat_dau")
        moi = apThaoTacLai(t, moi, { thao_tac: op.thao_tac, tham_so: op.tham_so } as ThaoTacLai);
    ttTruoc.current = moi;
    tt.current = buocPho(t, moi);
    return !tt.current.ket_thuc && tt.current.nhip < denNhip.current;
  };

  const loiChon = ct.loi.find((l) => l.stt === chon);
  const tongTru = ct.loi.reduce((s, l) => s + l.tru, 0);

  return (
    <div className="space-y-3" data-bam={ct.bam} data-bam-may={bamMay || undefined}>
      {!ct.hop_le ? (
        <p
          className="rounded-lg border border-line bg-surface p-3 text-[15px]"
          style={{ color: "var(--danger)" }}
        >
          {ct.ly_do}
        </p>
      ) : (
        <p className="text-[15px]">
          {ct.den_dich ? (
            <strong className="text-ok">✓ Tới đích</strong>
          ) : (
            <strong className="text-danger">
              ✗ {ct.ket_thuc === "het_gio" ? "Hết giờ, chưa tới đích" : "Chưa tới đích"}
            </strong>
          )}{" "}
          lúc {thoiDiem(ct.nhip)}.{" "}
          {ct.loi.length ? `${ct.loi.length} lỗi, trừ ${tongTru} điểm.` : "Không mắc lỗi nào."}
          {ct.den_dich && ct.thuong_den_dich ? ` Tới đích trong giờ: +${ct.thuong_den_dich}.` : ""}
          {!ct.den_dich ? " Không tới đích thì tối đa 50 điểm." : ""}
        </p>
      )}

      {chon !== null && loiChon && tt.current ? (
        <section aria-label={`Xem lại lỗi ${chon}`} className="space-y-2">
          <p className="text-sm font-semibold">
            Xem lại lỗi {chon}: {loiChon.ten} (lúc {thoiDiem(loiChon.nhip)})
          </p>
          <CanhTrenXuong
            khung={khungToanCanh(the)}
            cao={caoTua}
            ve={(ctx, bd0, alpha) => {
              const s = tt.current;
              const s0 = ttTruoc.current ?? s;
              if (!s || !s0) return;
              const x = (s0.nguoi.xe.x + (s.nguoi.xe.x - s0.nguoi.xe.x) * alpha) / 10;
              const y = (s0.nguoi.xe.y + (s.nguoi.xe.y - s0.nguoi.xe.y) * alpha) / 10;
              const goc = camera.lay(gocDichCamera(s.nguoi), giam || !dangTua);
              veTheoXe(ctx, bd0, x, y, goc, giam, (bd) => {
                veCanhPho(ctx, bd, mau.current, the, s0, s, alpha, anh, true, goc);
                veVetVaLoi(ctx, bd, mau.current, [], [loiChon], loiChon.stt, goc);
              });
            }}
            chay={dangTua}
            tienNhip={tienNhip}
            onXong={() => datDangTua(false)}
            phienBan={phien}
            nhan={`Cảnh lúc ${thoiDiem(tt.current.nhip)}, chỗ có số ${chon} là chỗ mắc lỗi.`}
            className="overflow-hidden rounded-2xl border border-line"
          />
          <div className={cn("grid gap-2", giam ? "grid-cols-3" : "grid-cols-2")}>
            {giam ? (
              <>
                <Button variant="secondary" className="min-h-12" onClick={() => buocGiay(-1)}>
                  Lùi 1 giây
                </Button>
                <Button variant="secondary" className="min-h-12" onClick={() => buocGiay(1)}>
                  Tới 1 giây
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="min-h-12" onClick={() => xemLai(chon)}>
                Xem lại lần nữa
              </Button>
            )}
            <Button variant="secondary" className="min-h-12" onClick={() => datChon(null)}>
              Xem bản đồ
            </Button>
          </div>
        </section>
      ) : (
        <CanhTrenXuong
          khung={khungToanCanh(the)}
          cao={cao}
          ve={(ctx, bd) => {
            const m = docBangMau();
            veNenPho(ctx, bd, m, the);
            veVetVaLoi(ctx, bd, m, ct.vet, ct.loi, chon);
          }}
          chay={false}
          phienBan={`${ct.bam}|${chon}`}
          nhan={`Bản đồ đường đã đi, ${ct.loi.length} chỗ mắc lỗi đánh số.`}
          lopPhu={(bd) =>
            coTua
              ? ct.loi.map((l) => (
                  <button
                    key={l.stt}
                    type="button"
                    onClick={() => xemLai(l.stt)}
                    aria-label={`Xem lại lỗi ${l.stt}: ${l.ten}, lúc ${thoiDiem(l.nhip)}`}
                    className="absolute size-12 rounded-full"
                    style={{ left: raX(bd, l.x) - 24, top: raY(bd, l.y) - 24 }}
                  />
                ))
              : null
          }
          className="overflow-hidden rounded-2xl border border-line"
        />
      )}

      {ct.loi.length ? (
        <ol aria-label="Lỗi đã ghi" className="grid gap-2">
          {ct.loi.map((l) => (
            <li
              key={l.stt}
              className="flex flex-wrap items-center justify-between gap-2 border-l-4 pl-3 text-[15px]"
              style={{ borderColor: "var(--danger)" }}
            >
              <span>
                <span className="font-semibold">
                  {l.stt}. {l.ten}
                </span>{" "}
                <span className="text-sm font-semibold text-danger">−{l.tru} điểm</span>
              </span>
              {coTua ? (
                <Button variant="secondary" size="sm" className="min-h-12" onClick={() => xemLai(l.stt)}>
                  Xem lại lúc {thoiDiem(l.nhip)}
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một lượt lái (GĐ17c): biên bản từng lỗi, hoặc biên bản trắng. */
export function ChiTietRiengTuLai({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietTuLai;
  return ct.loi.length ? (
    <section
      aria-label="Biên bản (mô phỏng)"
      className="rounded-2xl border-2 border-dashed p-4"
      style={{ borderColor: "var(--line-strong)", background: "var(--surface)" }}
    >
      <h3 className="g-tieu-de text-base font-semibold uppercase tracking-wide">Biên bản (mô phỏng)</h3>
      <p className="text-xs text-ink-2">
        Phần mô phỏng trong trò chơi, không phải biểu mẫu biên bản thật. Đóng hộp kết quả để xem lại lúc xảy
        ra từng lỗi.
      </p>
      <ol className="mt-3 grid gap-3">
        {ct.loi.map((l) => (
          <li
            key={l.stt}
            className="border-l-4 pl-3 text-[15px] leading-relaxed"
            style={{ borderColor: "var(--danger)" }}
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">
                {l.stt}. {l.bien_ban.hanh_vi}
              </span>
              <span className="text-sm font-semibold text-danger">−{l.tru} điểm</span>
            </p>
            <p>{l.bien_ban.chi_tiet}</p>
            <p className="text-sm">
              <span className="text-ink-2">Đúng ra: </span>
              {l.dung_ra}
            </p>
            {l.giai_thich ? <p className="text-sm text-ink-2">{l.giai_thich}</p> : null}
            <p className={cn("text-sm", !l.bien_ban.muc_phat && "text-ink-2")}>
              Mức phạt: {moTaMucPhatBienBan(l.bien_ban.muc_phat)}
            </p>
            <p className="text-sm text-ink-2">
              Căn cứ:{" "}
              {l.bien_ban.can_cu.length
                ? l.bien_ban.can_cu.map(nhanVienDan).join("; ")
                : "Căn cứ đang được cập nhật"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  ) : ct.hop_le ? (
    <p className="rounded-xl border border-line p-3 text-[15px]" style={{ background: "var(--ok-soft)" }}>
      Biên bản trắng: không ghi nhận lỗi nào trong lượt lái.
    </p>
  ) : null;
}
