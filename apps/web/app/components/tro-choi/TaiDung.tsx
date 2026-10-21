/**
 * Một vụ trong trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10, GAME_DESIGN §5.10).
 *
 * Sơ đồ hiện trường nhìn từ trên xuống (M6, lib/ve-canh/ve-tai-dung.ts), đúng tỷ lệ, có dấu vết do máy chủ
 * tính từ dựng cảnh gốc. Người chơi đặt từng xe: kéo xe trên sơ đồ, hoặc chọn xe rồi chạm chỗ đặt, hoặc
 * nút và phím mũi tên từng mét; xoay theo 8 hướng; chọn mức tốc độ và hành động. "Mô phỏng" chạy M5 ngay
 * trên điện thoại (tối đa 20 lần) và phủ kết quả lên dấu vết. Tab "Kết luận": kéo thẻ lỗi vào xe (hoặc
 * chạm thẻ rồi chạm xe), rồi "Chốt kết luận". Mọi thao tác ghi nhật ký (M7); máy chủ chấm dựng cảnh lúc nộp.
 *
 * Giảm chuyển động: mô phỏng tính xong ngay, hiện luôn vị trí cuối. Chấm y hệt.
 */
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import {
  apThaoTacTaiDung,
  type BanDungTaiDung,
  BoGhiNhatKy,
  banDungRong,
  buocVaCham,
  type CanhVaCham,
  type ChiTietTaiDung,
  canhTaiDung,
  chayTaiDung,
  type DauVet,
  type DeTaiDung,
  type DungCanhTaiDung,
  doDaiVet,
  dungCanhCua,
  HANH_DONG_XE,
  type LoaiLoiTaiDung,
  MUC_TOC_DO_KMH,
  MUI_TEN_HUONG,
  TEN_HANH_DONG_XE,
  TEN_HUONG,
  TEN_LOI_TAI_DUNG,
  TEN_MAT_DUONG,
  TEN_MUC_TOC_DO,
  type ThamSoTaiDung,
  type ThaoTacTaiDung,
  type TraLoiTaiDung,
  type TrangThaiVaCham,
  trangThaiDauVaCham,
} from "../../lib/tai-dung";
import type { BienDoi } from "../../lib/ve-canh/bien-doi";
import { type BangMau, docBangMau } from "../../lib/ve-canh/mau";
import { mauSonXe, veDauVet, veSoDo, veXe, type XeVe } from "../../lib/ve-canh/ve-tai-dung";
import { Button } from "../ui/Button";
import { ThanhDinhDay } from "../ui/ThanhDinhDay";
import { BienBan } from "./chung/BienBan";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { useKeoTha } from "./chung/tuong-tac/KeoTha";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export type TraLoiTaiDungWeb = TraLoiTaiDung | null;

type CheDo = "dung" | "chay" | "xem";
type LoaiXe = XeVe["loai"];

const m1 = (cm: number) => (Math.round(cm / 10) / 10).toLocaleString("vi-VN");

/** Chiều rộng khung vẽ để cả sơ đồ nằm gọn trong màn hình. */
function useRongKhung(tyLe: number) {
  const hop = useRef<HTMLDivElement>(null);
  const [rong, datRong] = useState(320);
  useEffect(() => {
    const el = hop.current;
    if (!el) return;
    const tinh = () =>
      datRong(Math.floor(Math.min(el.clientWidth, Math.max(300, window.innerHeight - 280) / tyLe)));
    const ro = new ResizeObserver(tinh);
    ro.observe(el);
    tinh();
    return () => ro.disconnect();
  }, [tyLe]);
  return { hop, rong };
}

/** Khung vẽ sơ đồ dùng chung cho lúc chơi và màn kết quả. */
function SoDo({
  de,
  ve,
  chay = false,
  tienNhip,
  onXong,
  phienBan,
  lopPhu,
}: {
  de: DeTaiDung;
  ve: (ctx: CanvasRenderingContext2D, bd: BienDoi, m: BangMau, alpha: number) => void;
  chay?: boolean;
  tienNhip?: () => boolean;
  onXong?: () => void;
  phienBan: unknown;
  lopPhu?: (bd: BienDoi) => React.ReactNode;
}) {
  const sd = de.so_do;
  const tyLe = sd.cao_m / sd.rong_m;
  const { hop, rong } = useRongKhung(tyLe);
  const mau = useRef<BangMau | null>(null);
  return (
    <div ref={hop} className="w-full">
      <div style={{ width: rong }} className="mx-auto">
        <CanhTrenXuong
          khung={{ x0: 0, y0: 0, x1: sd.rong_m * 100, y1: sd.cao_m * 100 }}
          cao={0}
          tyLeCao={tyLe}
          ve={(ctx, bd, a) => {
            mau.current ??= docBangMau(ctx.canvas);
            ve(ctx, bd, mau.current, a);
          }}
          chay={chay}
          tienNhip={tienNhip}
          heSoTua={1}
          onXong={onXong}
          phienBan={phienBan}
          nhan={`Sơ đồ hiện trường ${sd.rong_m} × ${sd.cao_m} m nhìn từ trên xuống, phía trên là hướng bắc. ${sd.kieu === "nga_tu" ? "Ngã tư" : "Đoạn đường thẳng"}, ${sd.so_lan} làn mỗi chiều. Dấu vết: ${de.dau_vet.vet.length} đoạn vết bánh, ${de.dau_vet.va_cham.length} điểm va chạm.`}
          lopPhu={lopPhu}
          className="overflow-hidden rounded-2xl border border-line"
        />
      </div>
    </div>
  );
}

/** Chấm màu sơn của xe, khớp màu xe trên sơ đồ. */
const ChamMau = ({ id }: { id: string }) => (
  <span
    aria-hidden="true"
    className="mr-1.5 inline-block size-3 rounded-full align-[-1px]"
    style={{
      background: mauSonXe(id),
      boxShadow: "0 0 0 1.5px var(--surface), 0 0 0 2.5px var(--line-strong)",
    }}
  />
);

const loaiCua = (de: DeTaiDung) => new Map(de.xe.map((x) => [x.id, x.loai as LoaiXe]));

/** Xe của một dựng cảnh (vị trí ban đầu) để vẽ. */
const xeDungCanh = (de: DeTaiDung, dc: DungCanhTaiDung): XeVe[] =>
  de.xe
    .filter((x) => dc[x.id])
    .map((x) => ({
      id: x.id,
      loai: x.loai,
      x: dc[x.id]!.x * 100,
      y: dc[x.id]!.y * 100,
      huong: dc[x.id]!.huong,
    }));

/** Xe đang chạy trong mô phỏng, nội suy giữa hai nhịp. */
function xeDangChay(tt: TrangThaiVaCham, truoc: TrangThaiVaCham | null, alpha: number): XeVe[] {
  const cu = new Map((truoc?.xe ?? []).map((x) => [x.id, x]));
  return tt.xe
    .filter((x) => x.pha !== "ra_ngoai")
    .map((x) => {
      const a = cu.get(x.id) ?? x;
      return {
        id: x.id,
        loai: x.loai,
        x: (a.x + (x.x - a.x) * alpha) / 10,
        y: (a.y + (x.y - a.y) * alpha) / 10,
        huong: x.huong,
      };
    });
}

/** Dấu vết đang hình thành trong lúc chạy (vết đã khép và vết đang để lại). */
const dauVetDangChay = (tt: TrangThaiVaCham): DauVet => ({
  cuoi: [],
  vet: [
    ...tt.vet,
    ...tt.xe
      .filter((x) => x.vet)
      .map((x) => ({
        xe: x.id,
        loai: x.vet!.loai,
        tu: x.vet!.tu,
        den: { x: Math.trunc(x.x / 10), y: Math.trunc(x.y / 10) },
      })),
  ],
  va_cham: tt.va_cham,
});

export function TaiDung({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeTaiDung;
  traLoi: TraLoiTaiDungWeb;
  datTraLoi: (t: TraLoiTaiDungWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiTaiDungWeb) => void;
}) {
  const giam = useGiamChuyenDong();
  const [ban, datBan] = useState<BanDungTaiDung>(() => banDungRong(de));
  const [chon, datChon] = useState<string | null>(de.xe[0]?.id ?? null);
  const [tab, datTab] = useState<"dung" | "ket_luan">("dung");
  const [cheDo, datCheDo] = useState<CheDo>("dung");
  const [ket, datKet] = useState<{ dau_vet: DauVet; bam: string } | null>(null);
  const [keo, datKeo] = useState<{ xe: string; x: number; y: number } | null>(null);
  const [phien, datPhien] = useState(0);
  const [thongBao, datThongBao] = useState("");

  const ghi = useRef<BoGhiNhatKy<ThaoTacTaiDung, ThamSoTaiDung> | null>(null);
  const canh = useRef<CanhVaCham | null>(null);
  const tt = useRef<TrangThaiVaCham | null>(null);
  const ttTruoc = useRef<TrangThaiVaCham | null>(null);
  const dauKeo = useRef<{ xe: string; da: boolean; cx: number; cy: number } | null>(null);
  const daGui = useRef(false);

  const khoa = daCham || traLoi !== null;
  const loaiXe = useMemo(() => loaiCua(de), [de]);
  const tenXe = (id: string) => de.xe.find((x) => x.id === id)?.nhan ?? id;
  const conLan = de.so_lan_toi_da - ban.so_lan;
  const duXe = de.xe.every((x) => ban.xe[x.id]?.vi_tri);

  useEffect(() => {
    ghi.current = new BoGhiNhatKy(() => performance.now());
    const doi = () => (document.hidden ? ghi.current?.tamDung() : ghi.current?.tiepTuc());
    document.addEventListener("visibilitychange", doi);
    return () => document.removeEventListener("visibilitychange", doi);
  }, []);

  /** Áp một thao tác, ghi nhật ký. Trả false khi thao tác không hợp lệ. */
  const lam = (thaoTac: ThaoTacTaiDung, tham: ThamSoTaiDung) => {
    if (khoa) return false;
    try {
      const moi = apThaoTacTaiDung(de, ban, thaoTac, tham);
      ghi.current?.ghi(thaoTac, tham);
      datBan(moi);
      return true;
    } catch (e) {
      datThongBao((e as Error).message.replace("Nhật ký ", "Không làm được: "));
      rung("sai");
      return false;
    }
  };

  const sua = (f: () => void) => {
    if (cheDo === "chay") return;
    f();
    if (cheDo === "xem") datCheDo("dung");
  };

  const datXe = (xe: string, x: number, y: number) => {
    const X = Math.max(0, Math.min(de.so_do.rong_m, x));
    const Y = Math.max(0, Math.min(de.so_do.cao_m, y));
    sua(() => {
      if (lam("dat", { xe, x: X, y: Y })) {
        phatAm("tich");
        datThongBao(`${tenXe(xe)}: tâm xe ở x ${X} m, y ${Y} m.`);
      }
    });
  };

  const x0 = chon ? ban.xe[chon] : undefined;
  const dich = (dx: number, dy: number) => {
    if (!chon || !x0?.vi_tri) return;
    datXe(chon, x0.vi_tri.x + dx, x0.vi_tri.y + dy);
  };
  const xoay = (d: number) =>
    chon && x0 && sua(() => lam("xoay", { xe: chon, huong: ((x0.huong + d + 8) % 8) as never }));

  const phim = (e: KeyboardEvent) => {
    const k: Record<string, () => void> = {
      ArrowUp: () => dich(0, -1),
      ArrowDown: () => dich(0, 1),
      ArrowLeft: () => dich(-1, 0),
      ArrowRight: () => dich(1, 0),
      "[": () => xoay(-1),
      "]": () => xoay(1),
    };
    if (k[e.key]) {
      e.preventDefault();
      k[e.key]!();
    }
  };

  /* ------------------------------ Mô phỏng ------------------------------ */

  const ketThucChay = () => {
    const k = chayTaiDung(de, dungCanhCua(ban));
    datKet(k);
    datCheDo("xem");
    datPhien((p) => p + 1);
    const khop = k.dau_vet.cuoi.every((c) => {
      const g = de.dau_vet.cuoi.find((x) => x.xe === c.xe);
      return g && Math.hypot(g.x - c.x, g.y - c.y) < 100 && g.huong === c.huong;
    });
    phatAm(khop ? "dung" : "tich");
    datThongBao(
      `Mô phỏng xong: ${k.dau_vet.va_cham.length} va chạm. ${khop ? "Vị trí cuối khớp dấu vết." : "Vị trí cuối chưa khớp dấu vết."}`,
    );
  };

  const moPhong = () => {
    if (khoa || cheDo === "chay" || conLan <= 0) return;
    if (!duXe) {
      datThongBao("Đặt đủ các xe lên sơ đồ trước khi mô phỏng.");
      return;
    }
    if (!lam("mo_phong", null)) return;
    canh.current = canhTaiDung(de, dungCanhCua(ban));
    tt.current = trangThaiDauVaCham(canh.current);
    ttTruoc.current = tt.current;
    datKet(null);
    if (giam) {
      ketThucChay();
      return;
    }
    datCheDo("chay");
    datThongBao("Đang mô phỏng.");
  };

  const tienNhip = () => {
    if (!canh.current || !tt.current) return false;
    ttTruoc.current = tt.current;
    tt.current = buocVaCham(canh.current, tt.current);
    return !tt.current.xong;
  };

  /* ------------------------------ Kết luận ------------------------------ */

  const keoThe = useKeoTha((loi, xe) => {
    if (ban.the.length >= 3 && !ban.the.some((t) => t.xe === xe && t.loi === loi)) {
      datThongBao("Gắn tối đa 3 thẻ lỗi. Gỡ bớt thẻ trước khi gắn thẻ khác.");
      rung("sai");
      return;
    }
    if (lam("gan_loi", { xe, loi: loi as LoaiLoiTaiDung })) {
      phatAm("tich");
      datThongBao(`Đã gắn thẻ "${TEN_LOI_TAI_DUNG[loi as LoaiLoiTaiDung]}" vào ${tenXe(xe)}.`);
    }
  });

  const nop = () => {
    if (khoa || daGui.current || !ghi.current) return;
    daGui.current = true;
    const nk = ghi.current.ketThuc();
    datTraLoi(nk);
    gui?.(nk);
  };

  /* --------------------------------- Vẽ --------------------------------- */

  const ve = (ctx: CanvasRenderingContext2D, bd: BienDoi, m: BangMau, alpha: number) => {
    veSoDo(ctx, bd, m, de.so_do);
    veDauVet(ctx, bd, m, de.dau_vet, loaiXe, m.chu);
    if (cheDo === "chay" && tt.current) {
      veDauVet(ctx, bd, m, dauVetDangChay(tt.current), loaiXe, m.chinh, true);
      for (const x of xeDangChay(tt.current, ttTruoc.current, alpha)) veXe(ctx, bd, m, x, "dac", m.chinh);
      return;
    }
    if (cheDo === "xem" && ket) {
      veDauVet(ctx, bd, m, ket.dau_vet, loaiXe, m.chinh, true);
      for (const c of ket.dau_vet.cuoi)
        if (!c.ra_ngoai)
          veXe(ctx, bd, m, { ...c, id: c.xe, loai: loaiXe.get(c.xe) ?? "o_to" }, "dac", m.chinh);
      return;
    }
    const dc = dungCanhCua(ban);
    const vk = keo && ban.xe[keo.xe];
    if (keo && vk) dc[keo.xe] = { x: keo.x, y: keo.y, huong: vk.huong, muc: vk.muc, hanh_dong: vk.hanh_dong };
    for (const x of xeDungCanh(de, dc)) veXe(ctx, bd, m, x, "dac", m.chinh, x.id === chon);
  };

  /** Lớp chạm trên sơ đồ: kéo xe đã đặt, chạm xe để chọn, chạm chỗ trống để đặt xe đang chọn. */
  const lopPhu = (bd: BienDoi) => {
    if (khoa || tab !== "dung" || cheDo === "chay") return null;
    const doiRa = (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      return {
        x: Math.round((e.clientX - r.left) / bd.tx / 100),
        y: Math.round((e.clientY - r.top) / bd.ty / 100),
      };
    };
    const xeTai = (x: number, y: number) =>
      de.xe.find((v) => {
        const p = ban.xe[v.id]?.vi_tri;
        return p && Math.hypot(p.x - x, p.y - y) * 100 * bd.tx < Math.max(22, 250 * bd.tx);
      })?.id;
    return (
      <div
        className="absolute inset-0 touch-none"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = doiRa(e);
          const xe = xeTai(p.x, p.y);
          dauKeo.current = xe ? { xe, da: false, cx: e.clientX, cy: e.clientY } : null;
          if (xe) e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dauKeo.current;
          if (!d) return;
          if (!d.da && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 8) return;
          d.da = true;
          datKeo({ xe: d.xe, ...doiRa(e) });
          datPhien((n) => n + 1);
        }}
        onPointerUp={(e) => {
          const d = dauKeo.current;
          dauKeo.current = null;
          const p = doiRa(e);
          datKeo(null);
          if (d?.da) {
            datChon(d.xe);
            datXe(d.xe, p.x, p.y);
          } else if (d) datChon(d.xe);
          else if (chon) datXe(chon, p.x, p.y);
          datPhien((n) => n + 1);
        }}
        onPointerCancel={() => {
          dauKeo.current = null;
          datKeo(null);
        }}
      />
    );
  };

  if (daCham && chiTiet)
    return <KetQuaTaiDung de={de} ct={chiTiet as ChiTietTaiDung} bamMay={ket?.bam ?? ""} />;

  const sd = de.so_do;
  return (
    <div className="space-y-3" data-bam={ket?.bam || undefined}>
      <p className="text-[15px]">{de.tin_bao}</p>
      <p className="text-sm text-ink-2">
        {TEN_MAT_DUONG[sd.mat_duong]}
        {sd.toc_do_toi_da_kmh ? ` · biển tốc độ tối đa ${sd.toc_do_toi_da_kmh} km/h` : ""}
        {sd.den.length
          ? ` · đèn lúc xảy ra: ${sd.den.map((d) => `hướng đi ${TEN_HUONG[d.huong]} ${d.mau === "do" ? "đỏ" : d.mau === "vang" ? "vàng" : "xanh"}`).join(", ")}`
          : ""}
      </p>
      <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">{de.ghi_chu}</p>
      {de.loi_ke.length ? (
        <details className="g-the rounded-2xl px-3 py-2 text-[15px]">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">
            Lời kể ({de.loi_ke.length})
          </summary>
          <ul className="grid gap-2 pb-2">
            {de.loi_ke.map((k) => (
              <li key={k.nguoi}>
                <strong>{k.nguoi}:</strong> “{k.ke}”
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <SoDo
        de={de}
        ve={ve}
        chay={cheDo === "chay" && !giam}
        tienNhip={tienNhip}
        onXong={ketThucChay}
        phienBan={`${phien}|${cheDo}|${chon}|${tab}|${JSON.stringify(ban.xe)}`}
        lopPhu={lopPhu}
      />
      <p className="flex flex-wrap gap-x-4 text-xs text-ink-2">
        <span>━ vết phanh</span>
        <span>┅ vết trượt sau va chạm</span>
        <span>▪ mảnh vỡ</span>
        <span>▭ viền đứt: vị trí cuối</span>
        <span className="text-primary">■ dựng cảnh của bạn</span>
      </p>

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {thongBao}
      </p>

      {cheDo === "chay" ? (
        <Button
          variant="secondary"
          className="min-h-12 w-full"
          onClick={() => {
            while (tienNhip());
            ketThucChay();
          }}
        >
          Bỏ qua hoạt cảnh
        </Button>
      ) : null}

      {cheDo === "xem" && ket && !khoa ? <SoSanh de={de} dv={ket.dau_vet} /> : null}

      {!khoa && cheDo !== "chay" ? (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1" role="tablist">
            {(["dung", "ket_luan"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => datTab(t)}
                className={cn(
                  "min-h-12 rounded-lg text-[15px] font-semibold",
                  tab === t && "bg-primary text-on-primary",
                )}
              >
                {t === "dung" ? "Dựng xe" : `Kết luận (${ban.the.length})`}
              </button>
            ))}
          </div>

          {tab === "dung" ? (
            <section className="space-y-2" aria-label="Dựng xe" onKeyDown={phim}>
              <ul className="flex flex-wrap gap-1" aria-label="Các xe">
                {de.xe.map((x) => {
                  const v = ban.xe[x.id];
                  return (
                    <li key={x.id}>
                      <button
                        type="button"
                        aria-pressed={chon === x.id}
                        onClick={() => datChon(x.id)}
                        className={cn(
                          "min-h-12 rounded-xl border-2 px-3 text-left text-sm",
                          chon === x.id ? "border-primary" : "border-line",
                        )}
                      >
                        <span className="block font-semibold">
                          <ChamMau id={x.id} />
                          {x.nhan}
                        </span>
                        <span className="text-ink-2">
                          {v?.vi_tri
                            ? `${MUI_TEN_HUONG[v.huong]} ${TEN_MUC_TOC_DO[v.muc]}, ${TEN_HANH_DONG_XE[v.hanh_dong]}`
                            : "chưa đặt"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {chon && x0 ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>{tenXe(chon)}</strong>:{" "}
                    {x0.vi_tri
                      ? `tâm xe x ${x0.vi_tri.x} m, y ${x0.vi_tri.y} m, hướng ${TEN_HUONG[x0.huong]}.`
                      : "chạm lên sơ đồ để đặt xe (hoặc kéo xe đã đặt)."}
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {(
                      [
                        ["◀", "Sang trái 1 mét", () => dich(-1, 0)],
                        ["▲", "Lên 1 mét", () => dich(0, -1)],
                        ["▼", "Xuống 1 mét", () => dich(0, 1)],
                        ["▶", "Sang phải 1 mét", () => dich(1, 0)],
                        ["⟲", "Xoay trái 45 độ", () => xoay(-1)],
                        ["⟳", "Xoay phải 45 độ", () => xoay(1)],
                      ] as const
                    ).map(([k, nhan, f]) => (
                      <Button
                        key={nhan}
                        variant="secondary"
                        className="min-h-12 px-0 text-lg"
                        aria-label={nhan}
                        disabled={!x0.vi_tri && k !== "⟲" && k !== "⟳"}
                        onClick={f}
                      >
                        {k}
                      </Button>
                    ))}
                  </div>
                  <fieldset className="grid grid-cols-4 gap-1">
                    <legend className="mb-1 text-sm font-semibold">Tốc độ</legend>
                    {TEN_MUC_TOC_DO.map((t, muc) => (
                      <Button
                        key={t}
                        variant={x0.muc === muc ? "primary" : "secondary"}
                        aria-pressed={x0.muc === muc}
                        className="min-h-12 flex-col gap-0 whitespace-normal px-1 text-sm leading-tight"
                        onClick={() => sua(() => lam("toc_do", { xe: chon, muc: muc as never }))}
                      >
                        {t}
                        <span className="block text-xs font-normal">~{MUC_TOC_DO_KMH[muc]} km/h</span>
                      </Button>
                    ))}
                  </fieldset>
                  <fieldset className="grid grid-cols-3 gap-1">
                    <legend className="mb-1 text-sm font-semibold">Hành động</legend>
                    {HANH_DONG_XE.map((hd) => (
                      <Button
                        key={hd}
                        variant={x0.hanh_dong === hd ? "primary" : "secondary"}
                        aria-pressed={x0.hanh_dong === hd}
                        className="min-h-12 flex-col gap-0 whitespace-normal px-1 text-sm leading-tight"
                        onClick={() => sua(() => lam("hanh_dong", { xe: chon, hd }))}
                      >
                        {TEN_HANH_DONG_XE[hd]}
                      </Button>
                    ))}
                  </fieldset>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="space-y-2" aria-label="Kết luận">
              <p className="text-sm text-ink-2">
                Kéo thẻ lỗi vào xe có lỗi, hoặc chạm thẻ rồi chạm xe. Tối đa 3 thẻ; thẻ gắn sai bị trừ điểm.
              </p>
              <ul className="flex flex-wrap gap-1" aria-label="Thẻ lỗi">
                {de.the_loi.map((t) => {
                  const p = keoThe.vat(t.ma);
                  return (
                    <li key={t.ma}>
                      <button
                        {...p}
                        className={cn(
                          p.className,
                          "min-h-12 rounded-xl border-2 border-line bg-surface px-3 text-sm",
                        )}
                        style={{
                          ...p.style,
                          borderColor: keoThe.chon === t.ma ? "var(--primary)" : undefined,
                        }}
                      >
                        {t.ten}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <ul className="grid gap-2" aria-label="Xe">
                {de.xe.map((x) => (
                  <li key={x.id} className="rounded-2xl border border-line p-2">
                    <button
                      {...keoThe.vung(x.id)}
                      className={cn(
                        "min-h-12 w-full rounded-xl border-2 border-dashed px-3 text-left text-[15px] font-semibold",
                        keoThe.chon || keoThe.dangKeo ? "border-primary" : "border-line",
                      )}
                    >
                      <ChamMau id={x.id} />
                      {x.nhan}
                    </button>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {ban.the
                        .filter((t) => t.xe === x.id)
                        .map((t) => (
                          <li key={t.loi}>
                            <Button
                              variant="secondary"
                              className="min-h-12 text-sm"
                              aria-label={`Gỡ thẻ ${TEN_LOI_TAI_DUNG[t.loi]} khỏi ${x.nhan}`}
                              onClick={() => lam("go_loi", { xe: x.id, loi: t.loi })}
                            >
                              {TEN_LOI_TAI_DUNG[t.loi]} ✕
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ThanhDinhDay className="-mx-1 grid grid-cols-2 gap-2 border-t border-line bg-surface px-1 pt-2">
            <Button variant="secondary" className="min-h-12" onClick={moPhong} disabled={conLan <= 0}>
              Mô phỏng (còn {conLan})
            </Button>
            <Button
              className="g-nut min-h-12"
              onClick={nop}
              disabled={ban.so_lan < 1 || !ban.the.length}
              title={
                ban.so_lan < 1
                  ? "Mô phỏng ít nhất một lần"
                  : !ban.the.length
                    ? "Gắn ít nhất một thẻ lỗi"
                    : undefined
              }
            >
              Chốt kết luận
            </Button>
          </ThanhDinhDay>
        </>
      ) : null}
    </div>
  );
}

/** So kết quả mô phỏng với dấu vết: vị trí cuối lệch bao nhiêu, vết dài bao nhiêu. */
function SoSanh({ de, dv }: { de: DeTaiDung; dv: DauVet }) {
  const dai = (d: DauVet, xe: string) =>
    d.vet.filter((v) => v.xe === xe).reduce((s, v) => s + doDaiVet(v), 0);
  return (
    <section className="g-the space-y-1 rounded-2xl p-3 text-[15px]" aria-label="So với dấu vết">
      <h3 className="text-base font-semibold">So với dấu vết</h3>
      {de.xe.map((x) => {
        const g = de.dau_vet.cuoi.find((c) => c.xe === x.id);
        const c = dv.cuoi.find((k) => k.xe === x.id);
        if (!g || !c) return null;
        const lech = Math.hypot(g.x - c.x, g.y - c.y);
        return (
          <p key={x.id}>
            <strong>{x.nhan}</strong>:{" "}
            {c.ra_ngoai
              ? "chạy ra khỏi sơ đồ"
              : `vị trí cuối lệch ${m1(lech)} m${g.huong === c.huong ? "" : ", hướng cuối khác"}`}
            ; vết bánh {m1(dai(dv, x.id))} m (dấu vết {m1(dai(de.dau_vet, x.id))} m).
          </p>
        );
      })}
      <p className="text-sm text-ink-2">
        Va chạm: {dv.va_cham.length} (dấu vết {de.dau_vet.va_cham.length}).
      </p>
    </section>
  );
}

/** Màn kết quả trên bảng chơi: dựng cảnh gốc và dựng cảnh của người chơi, phát lại được. */
function KetQuaTaiDung({ de, ct, bamMay }: { de: DeTaiDung; ct: ChiTietTaiDung; bamMay: string }) {
  const giam = useGiamChuyenDong();
  const [xemGoc, datXemGoc] = useState(true);
  const [chay, datChay] = useState(false);
  const loaiXe = useMemo(() => loaiCua(de), [de]);
  const dc = xemGoc ? ct.dung_canh_goc : ct.dung_canh;
  const dv = useMemo(() => chayTaiDung(de, dc).dau_vet, [de, dc]);
  const canh = useRef<CanhVaCham | null>(null);
  const tt = useRef<TrangThaiVaCham | null>(null);
  const truoc = useRef<TrangThaiVaCham | null>(null);
  const batDau = () => {
    canh.current = canhTaiDung(de, dc);
    tt.current = trangThaiDauVaCham(canh.current);
    truoc.current = tt.current;
    datChay(true);
  };
  return (
    <div className="space-y-3" data-bam={ct.bam} data-bam-may={bamMay || undefined}>
      <ol className="grid gap-2" aria-label="Điểm từng phần">
        {(
          [
            ["Khớp dấu vết", ct.khop.diem, 50],
            ["Kết luận", ct.ket_luan.diem, 40],
            [`Số lần mô phỏng (${ct.so_lan_mo_phong})`, ct.diem_so_lan, 10],
          ] as const
        ).map(([ten, d, toi]) => (
          <li key={ten} className="g-the flex items-baseline justify-between gap-3 p-3">
            <span className="text-[15px] font-semibold">{ten}</span>
            <span className={cn("text-sm font-semibold", d >= toi ? "text-ok" : "text-danger")}>
              {d}/{toi} điểm
            </span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1" role="tablist">
        {[true, false].map((g) => (
          <button
            key={String(g)}
            type="button"
            role="tab"
            aria-selected={xemGoc === g}
            onClick={() => {
              datXemGoc(g);
              datChay(false);
            }}
            className={cn(
              "min-h-12 rounded-lg text-[15px] font-semibold",
              xemGoc === g && "bg-primary text-on-primary",
            )}
          >
            {g ? "Dựng cảnh gốc" : "Dựng cảnh của bạn"}
          </button>
        ))}
      </div>
      <SoDo
        de={de}
        chay={chay && !giam}
        tienNhip={() => {
          if (!canh.current || !tt.current) return false;
          truoc.current = tt.current;
          tt.current = buocVaCham(canh.current, tt.current);
          return !tt.current.xong;
        }}
        onXong={() => datChay(false)}
        phienBan={`${xemGoc}|${chay}`}
        ve={(ctx, bd, m, a) => {
          veSoDo(ctx, bd, m, de.so_do);
          veDauVet(ctx, bd, m, de.dau_vet, loaiXe, m.chu);
          if (chay && tt.current) {
            veDauVet(ctx, bd, m, dauVetDangChay(tt.current), loaiXe, m.chinh, true);
            for (const x of xeDangChay(tt.current, truoc.current, a)) veXe(ctx, bd, m, x, "dac", m.chinh);
            return;
          }
          veDauVet(ctx, bd, m, dv, loaiXe, m.chinh, true);
          for (const x of xeDungCanh(de, dc)) veXe(ctx, bd, m, x, "dac", m.chinh);
        }}
      />
      <p className="text-sm text-ink-2">
        {xemGoc ? "Vị trí ban đầu theo dựng cảnh gốc" : "Vị trí ban đầu bạn dựng"}; vết màu xanh là kết quả mô
        phỏng.
      </p>
      {!giam ? (
        <Button variant="secondary" className="min-h-12 w-full" onClick={batDau} disabled={chay}>
          Phát lại
        </Button>
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" (GĐ17c): khớp từng xe, kết luận của bạn và lỗi đúng, diễn biến, biên bản. */
export function ChiTietRiengTaiDung({ de, chiTiet }: { de: DeTaiDung; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietTaiDung;
  const tenXe = (id: string) => de.xe.find((x) => x.id === id)?.nhan ?? id;
  return (
    <div className="space-y-3">
      {!ct.hop_le ? (
        <p
          className="rounded-lg border border-line bg-surface p-3 text-[15px]"
          style={{ color: "var(--danger)" }}
        >
          {ct.ly_do}
        </p>
      ) : null}
      <section className="g-the p-3" aria-label="Khớp dấu vết">
        <h3 className="text-base font-semibold">Khớp dấu vết: {ct.khop.diem}/50 điểm</h3>
        <ul className="mt-2 grid gap-2 text-sm">
          {ct.khop.theo_xe.map((x) => (
            <li key={x.xe}>
              <strong>{tenXe(x.xe)}</strong>:{" "}
              {x.lech_vi_tri_cm === null
                ? "chưa đặt xe."
                : `vị trí cuối lệch ${m1(x.lech_vi_tri_cm)} m (${x.vi_tri} điểm); vết bánh ${m1(x.vet_cua_ban_cm ?? 0)} m so với ${m1(x.vet_goc_cm)} m (${x.vet} điểm); hướng cuối lệch ${(x.lech_huong ?? 0) * 45}° (${x.huong} điểm).`}
            </li>
          ))}
        </ul>
      </section>
      <section className="g-the p-3" aria-label="Kết luận">
        <h3 className="text-base font-semibold">Kết luận: {ct.ket_luan.diem}/40 điểm</h3>
        <p className="mt-1 text-sm">
          Bạn kết luận:{" "}
          {ct.ket_luan.the.length
            ? ct.ket_luan.the
                .map((t) => `${tenXe(t.xe)}, ${TEN_LOI_TAI_DUNG[t.loi].toLowerCase()}`)
                .join("; ")
            : "chưa gắn thẻ nào"}
          .
        </p>
        <p className="mt-1 text-sm">
          Đúng ra:{" "}
          {ct.ket_luan.dung.map((l) => `${tenXe(l.xe)}, ${TEN_LOI_TAI_DUNG[l.loi].toLowerCase()}`).join("; ")}
          .
        </p>
        {ct.ket_luan.the_sai.length ? (
          <p className="mt-1 text-sm text-danger">
            Thẻ gắn sai: {ct.ket_luan.the_sai.length}, mỗi thẻ trừ 10 điểm.
          </p>
        ) : null}
        <p className="mt-2 text-[15px]">{ct.giai_thich}</p>
      </section>
      <BienBan dong={ct.bien_ban} />
      <p className="text-sm text-ink-2">
        Mô phỏng {ct.so_lan_mo_phong} lần ({ct.diem_so_lan}/10 điểm: 1–3 lần đủ điểm, 4–6 lần nửa điểm).{" "}
        {de.ghi_chu} Căn cứ về xử lý tai nạn đang được cập nhật.
      </p>
    </div>
  );
}
