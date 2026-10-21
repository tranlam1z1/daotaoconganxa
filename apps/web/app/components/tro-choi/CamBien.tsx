/**
 * Một đoạn đường trong trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3, GAME_DESIGN §5.3).
 *
 * Đoạn đường nhìn từ trên xuống (M6), xe chạy từ dưới lên. Người chơi kéo biển từ khay vào vị trí
 * (hoặc chạm biển rồi chạm vị trí, hoặc dùng bàn phím; M2 `useKeoTha`); chạm vị trí đã cắm để gỡ.
 * "Cho xe chạy thử" chạy bộ mô phỏng M5 ngay trên điện thoại, tối đa 3 lần; lần chạy cuối là lần
 * chấm. Mọi thao tác ghi vào nhật ký (M7) và gửi máy chủ khi nộp; máy chủ chấm lại từ nhật ký.
 *
 * Giảm chuyển động: chạy thử theo bước, mỗi lần bấm tiến 1 giây, hoặc xem ngay kết quả; chấm y hệt.
 *
 * Sau khi chấm, bảng chơi còn biển đã cắm và biển đúng từng vị trí; lý do, căn cứ, tình huống nằm
 * trong "Xem chi tiết" của hộp kết quả (`ChiTietRiengCamBien`, GĐ17c).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apThaoTac,
  BoGhiNhatKy,
  type BoTri,
  bamTrangThai,
  boTriRong,
  buocMoPhong,
  type ChiTietCamBien,
  cauHinhChayThu,
  type DeCamBien,
  dungMoPhong,
  type KetViTri,
  type MoPhong,
  O_CM,
  phanUngTheoMa,
  TEN_NGAN_DAC_DIEM,
  TEN_THAO_TAC_BIEN_BAO,
  type ThamSoCamBien,
  type ThaoTacCamBien,
  type TinhHuongNguyHiem,
  type TraLoiCamBien,
  type TrangThaiMoPhong,
  tinhHuongNguyHiem,
  trangThaiDau,
  urlAnhBien,
} from "../../lib/cam-bien";
import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import type { BienDoi } from "../../lib/ve-canh/bien-doi";
import { raX, raY } from "../../lib/ve-canh/bien-doi";
import { type BangMau, docBangMau } from "../../lib/ve-canh/mau";
import { veCotBien, veDauNguyHiem, veDoanDuong } from "../../lib/ve-canh/ve-duong";
import { veXe } from "../../lib/ve-canh/ve-xe";
import { Button } from "../ui/Button";
import { ThanhDinhDay } from "../ui/ThanhDinhDay";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { useKeoTha } from "./chung/tuong-tac/KeoTha";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export type TraLoiCamBienWeb = TraLoiCamBien | null;

/** Cao một ô khi cắm biển (vị trí cắm cao 48 px, không chồng nhau ở hai ô liền). */
const O_PX_CAM = 52;
/** Khung bản đồ ngang: 20 m, đường ở giữa. Vị trí biển cách tim đường 5,6 m. */
const X_BIEN = 560;
/** Tua nhanh khi chạy thử: 2 nhịp mô phỏng mỗi 50 ms. */
const TUA = 2;
/** Chế độ từng bước: mỗi lần bấm tiến 1 giây mô phỏng. */
const NHIP_MOI_BUOC = 20;

type CheDo = "cam" | "chay" | "sau_chay";

const MO_TA_KET: Record<KetViTri, string> = {
  dung: "Đúng",
  chap_nhan: "Chấp nhận được",
  thieu: "Để trống, cần biển",
  sai: "Có biển sai",
  thua: "Thừa biển",
  de_trong_dung: "Để trống đúng",
};

const khungBanDo = (soO: number) => ({ x0: -1000, x1: 1000, y0: -0.8 * O_CM, y1: (soO + 0.2) * O_CM });
const yGiuaO = (soO: number, o: number) => (soO - o - 0.5) * O_CM;

export function CamBien({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
  chiTietTrongHop = false,
}: {
  de: DeCamBien;
  traLoi: TraLoiCamBienWeb;
  datTraLoi: (t: TraLoiCamBienWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiCamBienWeb) => void;
  /** Phần chữ của kết quả nằm trong hộp kết quả (khung chơi, GĐ17c); bảng chơi chỉ giữ phần tóm tắt. */
  chiTietTrongHop?: boolean;
}) {
  const giam = useGiamChuyenDong();
  const [boTri, datBoTri] = useState<BoTri>(() => boTriRong(de.vi_tri));
  const [cheDo, datCheDo] = useState<CheDo>("cam");
  const [lanChay, datLanChay] = useState(0);
  const [boTriDaChay, datBoTriDaChay] = useState<string | null>(null);
  const [tinhHuong, datTinhHuong] = useState<TinhHuongNguyHiem[]>([]);
  const [phien, datPhien] = useState(0);
  const [thongBao, datThongBao] = useState("");
  const [oPxChay, datOPxChay] = useState(O_PX_CAM);
  const [bam, datBam] = useState("");

  const ghi = useRef<BoGhiNhatKy<ThaoTacCamBien, ThamSoCamBien> | null>(null);
  const mp = useRef<MoPhong | null>(null);
  const tt = useRef<TrangThaiMoPhong | null>(null);
  const ttTruoc = useRef<TrangThaiMoPhong | null>(null);
  const mau = useRef<BangMau>(docBangMau());
  const anh = useRef(new Map<string, HTMLImageElement>());
  const daGui = useRef(false);

  const khoa = daCham || traLoi !== null;
  const theoMa = useMemo(() => new Map(de.khay.map((k) => [k.ma, k])), [de.khay]);
  const conLan = de.so_lan_chay - lanChay;
  const doiSauChay = boTriDaChay !== null && boTriDaChay !== JSON.stringify(boTri);

  // Nhật ký bắt đầu khi đề hiện trên máy; tab ẩn thì tạm dừng đồng hồ nhật ký.
  useEffect(() => {
    ghi.current = new BoGhiNhatKy(() => performance.now());
    const doi = () => (document.hidden ? ghi.current?.tamDung() : ghi.current?.tiepTuc());
    document.addEventListener("visibilitychange", doi);
    return () => document.removeEventListener("visibilitychange", doi);
  }, []);

  // Tải ảnh biển để vẽ lên canvas khi chạy thử (service worker giữ để chơi offline).
  useEffect(() => {
    for (const k of de.khay) {
      if (anh.current.has(k.ma)) continue;
      const img = new Image();
      img.onload = () => datPhien((p) => p + 1);
      img.src = urlAnhBien(k.anh);
      anh.current.set(k.ma, img);
    }
  }, [de.khay]);

  const oPx = cheDo === "cam" ? O_PX_CAM : oPxChay;
  const cao = (de.so_o + 1) * oPx;

  /* ---------------------------- Cắm, gỡ biển ---------------------------- */

  const lam = (thaoTac: "dat" | "go", viTri: string, ma: string, bt: BoTri): BoTri => {
    const moi = apThaoTac(de, bt, thaoTac, { vi_tri: viTri, ma });
    ghi.current?.ghi(thaoTac, { vi_tri: viTri, ma });
    return moi;
  };

  const cam = (ma: string, viTri: string) => {
    if (khoa || cheDo !== "cam" || conLan <= 0) return;
    const v = de.vi_tri.find((x) => x.id === viTri);
    if (!v || !theoMa.has(ma)) return;
    let bt = boTri;
    if ((bt[viTri] ?? []).includes(ma)) return;
    // Cột đầy thì thay biển cắm trước nhất.
    if ((bt[viTri] ?? []).length >= v.toi_da) bt = lam("go", viTri, bt[viTri]![0]!, bt);
    bt = lam("dat", viTri, ma, bt);
    datBoTri(bt);
    phatAm("tich");
    rung("dung");
    datThongBao(`Đã cắm ${theoMa.get(ma)!.ten} ở vị trí ${v.so}.`);
  };

  const go = (viTri: string) => {
    if (khoa || cheDo !== "cam" || conLan <= 0) return;
    const cot = boTri[viTri] ?? [];
    const ma = cot.at(-1);
    if (!ma) return;
    datBoTri(lam("go", viTri, ma, boTri));
    datThongBao(`Đã gỡ ${theoMa.get(ma)?.ten ?? ma} ở vị trí ${de.vi_tri.find((x) => x.id === viTri)?.so}.`);
  };

  const keo = useKeoTha((vat, vung) => cam(vat, vung));

  /* ------------------------------- Chạy thử ------------------------------ */

  const tienNhip = useCallback(() => {
    if (!mp.current || !tt.current) return false;
    ttTruoc.current = tt.current;
    tt.current = buocMoPhong(mp.current, tt.current);
    return !tt.current.xong;
  }, []);

  const ketThucChay = useCallback(() => {
    const s = tt.current;
    if (!s) return;
    const th = tinhHuongNguyHiem(de, s.su_kien, { boTri, bien: de.khay });
    datTinhHuong(th);
    datBam(bamTrangThai({ xe: s.xe, su_kien: s.su_kien, nhip: s.nhip }));
    datCheDo("sau_chay");
    datPhien((p) => p + 1);
    if (th.length) {
      phatAm("sai");
      rung("sai");
      datThongBao(`Chạy thử xong: xe xử lý sai ở ${th.length} chỗ.`);
    } else {
      phatAm("dung");
      datThongBao("Chạy thử xong: xe qua an toàn.");
    }
  }, [de, boTri]);

  const chayThu = () => {
    if (khoa || conLan <= 0 || cheDo !== "cam") return;
    ghi.current?.ghi("chay_thu", null);
    datLanChay((n) => n + 1);
    datBoTriDaChay(JSON.stringify(boTri));
    mp.current = dungMoPhong(cauHinhChayThu(de, boTri, phanUngTheoMa(de.khay)));
    tt.current = trangThaiDau(mp.current);
    ttTruoc.current = tt.current;
    mau.current = docBangMau();
    datOPxChay(Math.max(22, Math.min(O_PX_CAM, Math.floor((window.innerHeight - 240) / (de.so_o + 1)))));
    datTinhHuong([]);
    datCheDo("chay");
    datThongBao("Xe đang chạy thử.");
  };

  /** Chế độ từng bước, hoặc bỏ qua hoạt cảnh: tiến `n` nhịp ngay. */
  const tienNgay = (n: number) => {
    for (let i = 0; i < n; i++) if (!tienNhip()) break;
    ttTruoc.current = tt.current;
    if (tt.current?.xong) ketThucChay();
    else datPhien((p) => p + 1);
  };

  const nop = () => {
    if (khoa || daGui.current || !ghi.current) return;
    daGui.current = true;
    const nk = ghi.current.ketThuc();
    datTraLoi(nk);
    gui?.(nk);
  };

  /* --------------------------------- Vẽ ---------------------------------- */

  const ve = (ctx: CanvasRenderingContext2D, bd: BienDoi, alpha: number) => {
    const m = mau.current;
    veDoanDuong(ctx, bd, m, { soO: de.so_o, oCm: O_CM, dacDiem: de.dac_diem });
    if (cheDo === "cam") return;
    for (const v of de.vi_tri) {
      const cot = boTri[v.id] ?? [];
      if (!cot.length) continue;
      const x = raX(bd, v.ben === "phai" ? X_BIEN : -X_BIEN);
      veCotBien(
        ctx,
        m,
        x,
        raY(bd, yGiuaO(de.so_o, v.o)),
        cot.map((ma) => anh.current.get(ma)),
      );
    }
    if (tt.current && ttTruoc.current) veXe(ctx, bd, m, ttTruoc.current.xe, tt.current.xe, alpha);
    for (const s of tt.current?.su_kien ?? [])
      if (s.loai === "phanh_gap" || s.loai === "nguy_hiem" || s.loai === "bi_chan")
        veDauNguyHiem(ctx, m, raX(bd, s.x) + 20, raY(bd, s.y));
  };

  const lopPhu = (bd: BienDoi) => (
    <>
      {de.dac_diem.map((d) => (
        <span
          key={d.o}
          className="pointer-events-none absolute left-1 w-[4.5rem] text-xs leading-tight font-semibold text-ink"
          style={{ top: raY(bd, yGiuaO(de.so_o, d.o)) - 14 }}
          title={d.ten}
        >
          {TEN_NGAN_DAC_DIEM[d.loai] ?? d.ten}
        </span>
      ))}
      {cheDo === "cam"
        ? de.vi_tri.map((v) => {
            const cot = boTri[v.id] ?? [];
            const p = keo.vung(v.id, khoa || conLan <= 0);
            const rongNut = v.toi_da > 1 ? 76 : 52;
            return (
              <button
                key={v.id}
                {...p}
                onClick={() => (keo.chon ? p.onClick() : go(v.id))}
                aria-label={`Vị trí ${v.so}${v.toi_da > 1 ? `, cắm được ${v.toi_da} biển` : ""}: ${
                  cot.length
                    ? `đã cắm ${cot.map((m) => theoMa.get(m)?.ten ?? m).join(", ")}. Chạm để gỡ`
                    : "trống"
                }`}
                className={cn(
                  "absolute grid grid-flow-col place-items-center gap-0.5 rounded-xl border-2 bg-surface/90",
                  cot.length ? "border-solid" : "border-dashed",
                  p["data-san-sang"] && "ring-2 ring-offset-1",
                )}
                style={{
                  left: raX(bd, v.ben === "phai" ? X_BIEN : -X_BIEN) - rongNut / 2,
                  top: raY(bd, yGiuaO(de.so_o, v.o)) - 26,
                  width: rongNut,
                  height: 52,
                  borderColor: cot.length ? "var(--primary)" : "var(--line-strong)",
                }}
              >
                {cot.length ? (
                  cot.map((m) => (
                    <img
                      key={m}
                      src={urlAnhBien(theoMa.get(m)?.anh ?? "")}
                      alt=""
                      className="size-8"
                      draggable={false}
                    />
                  ))
                ) : (
                  <span className="text-sm font-bold text-ink-2">{v.so}</span>
                )}
              </button>
            );
          })
        : null}
    </>
  );

  /* ------------------------------ Giao diện ------------------------------ */

  if (daCham && chiTiet)
    return <KetQuaCamBien de={de} ct={chiTiet as ChiTietCamBien} bamMay={bam} coChu={!chiTietTrongHop} />;

  const bienChon = keo.chon ? theoMa.get(keo.chon) : undefined;

  return (
    <div className="space-y-3" data-bam={bam || undefined}>
      <p className="flex items-center justify-between gap-2 text-sm text-ink-2">
        <span>
          {de.vi_tri.length} vị trí · {de.so_o * 10} m đường
        </span>
        <span className="g-so">
          Chạy thử còn <strong className="text-ink">{conLan}</strong>/{de.so_lan_chay}
        </span>
      </p>

      <CanhTrenXuong
        khung={khungBanDo(de.so_o)}
        cao={cao}
        ve={ve}
        chay={cheDo === "chay" && !giam}
        tienNhip={tienNhip}
        heSoTua={TUA}
        onXong={ketThucChay}
        onTamDung={(d) => (d ? ghi.current?.tamDung() : ghi.current?.tiepTuc())}
        phienBan={`${phien}|${cheDo}|${JSON.stringify(boTri)}`}
        nhan={`Đoạn đường ${de.so_o * 10} m nhìn từ trên xuống, xe chạy từ dưới lên. Đặc điểm: ${de.dac_diem
          .map((d) => `${d.ten} ở ô ${d.o + 1}`)
          .join(", ")}.`}
        lopPhu={lopPhu}
        className="overflow-hidden rounded-2xl border border-line"
      />

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {thongBao}
      </p>

      {cheDo === "cam" && !khoa ? (
        <ThanhDinhDay className="-mx-1 space-y-2 border-t border-line bg-surface px-1 pt-2">
          <p className="min-h-5 text-sm">
            {bienChon ? (
              <>
                Đã chọn <strong>{bienChon.ten}</strong>: chạm một vị trí để cắm.
              </>
            ) : (
              <span className="text-ink-2">
                Kéo biển vào vị trí, hoặc chạm biển rồi chạm vị trí. Chạm vị trí đã cắm để gỡ.
              </span>
            )}
          </p>
          <ul className="grid grid-cols-6 gap-1" aria-label="Khay biển">
            {de.khay.map((k) => {
              const p = keo.vat(k.ma, conLan <= 0);
              return (
                <li key={k.ma}>
                  <button
                    {...p}
                    aria-label={`${k.ten}${k.phan_ung ? `, xe sẽ ${TEN_THAO_TAC_BIEN_BAO[k.phan_ung].toLowerCase()}` : ""}`}
                    className={cn(
                      p.className,
                      "grid h-14 w-full place-items-center rounded-xl border-2 bg-surface",
                    )}
                    style={{ ...p.style, borderColor: keo.chon === k.ma ? "var(--primary)" : "var(--line)" }}
                  >
                    <img src={urlAnhBien(k.anh)} alt="" className="size-10" draggable={false} />
                  </button>
                </li>
              );
            })}
          </ul>
          {doiSauChay && conLan <= 0 ? null : doiSauChay || lanChay === 0 ? (
            <Button className="g-nut min-h-12 w-full" onClick={chayThu} disabled={conLan <= 0}>
              Cho xe chạy thử (còn {conLan} lần)
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="min-h-12" onClick={chayThu} disabled={conLan <= 0}>
                Chạy thử lại
              </Button>
              <Button className="g-nut min-h-12" onClick={nop}>
                Nộp bố trí này
              </Button>
            </div>
          )}
        </ThanhDinhDay>
      ) : null}

      {cheDo === "chay" ? (
        <div className="grid grid-cols-2 gap-2">
          {giam ? (
            <Button variant="secondary" className="min-h-12" onClick={() => tienNgay(NHIP_MOI_BUOC)}>
              Bước tiếp (1 giây)
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" className="min-h-12" onClick={() => tienNgay(1_000_000)}>
            {giam ? "Xem kết quả" : "Bỏ qua hoạt cảnh"}
          </Button>
        </div>
      ) : null}

      {cheDo === "sau_chay" && !khoa ? (
        <div className="space-y-3">
          <DanhSachTinhHuong ds={tinhHuong} />
          <p className="text-sm text-ink-2">
            Lần chạy cuối là lần được chấm.{" "}
            {conLan > 0 ? `Còn ${conLan} lần chạy thử.` : "Đã hết lượt chạy thử."}
          </p>
          <div className={cn("grid gap-2", conLan > 0 && "grid-cols-2")}>
            {conLan > 0 ? (
              <Button variant="secondary" className="min-h-12" onClick={() => datCheDo("cam")}>
                Chỉnh lại biển
              </Button>
            ) : null}
            <Button className="g-nut min-h-12" onClick={nop}>
              Nộp bố trí này
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DanhSachTinhHuong({ ds }: { ds: readonly TinhHuongNguyHiem[] }) {
  if (!ds.length)
    return (
      <p className="rounded-xl border border-line p-3 text-[15px]" style={{ background: "var(--ok-soft)" }}>
        Xe qua cả đoạn đường an toàn, không phải phanh gấp.
      </p>
    );
  return (
    <section className="g-the rounded-2xl p-3" aria-label="Xe xử lý sai">
      <h3 className="text-base font-semibold">Xe xử lý sai khi chạy thử</h3>
      <ul className="mt-2 grid gap-2">
        {ds.map((t) => (
          <li
            key={`${t.loai}-${t.nhip}-${t.o}`}
            className="border-l-4 pl-3 text-[15px]"
            style={{ borderColor: "var(--danger)" }}
          >
            {t.mo_ta}
            {t.so_xe > 1 ? <span className="text-ink-2"> ({t.so_xe} xe)</span> : null}
            <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">Vì sao: {t.vi_sao}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Màn kết quả của một đoạn: từng vị trí, biển đã cắm và biển đúng (bảng chơi sau khi chấm). Phần chữ (lý
 * do, căn cứ, tình huống của lần chạy cuối) ở `ChiTietRiengCamBien`; `coChu` gộp cả phần chữ vào đây
 * (trang soạn đoạn đường của quản trị, không có hộp kết quả).
 */
function KetQuaCamBien({
  de,
  ct,
  bamMay,
  coChu,
}: {
  de: DeCamBien;
  ct: ChiTietCamBien;
  bamMay: string;
  coChu: boolean;
}) {
  const tenBien = (m: string) => ct.bien[m]?.ten ?? m;
  const anhBien = (m: string) => ct.bien[m]?.anh ?? de.khay.find((k) => k.ma === m)?.anh ?? "";
  return (
    <div className="space-y-3" data-bam={ct.bam} data-bam-may={bamMay || undefined}>
      <ol className="grid gap-2" aria-label="Kết quả từng vị trí">
        {ct.vi_tri.map((v) => {
          const tot = v.ket === "dung" || v.ket === "de_trong_dung";
          return (
            <li key={v.id} className="g-the p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[15px] font-semibold">Vị trí {v.so}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    tot ? "text-ok" : v.ket === "chap_nhan" ? "text-ink-2" : "text-danger",
                  )}
                >
                  {tot ? "✓ " : v.ket === "chap_nhan" ? "– " : "✗ "}
                  {MO_TA_KET[v.ket]} · {v.diem > 0 ? `+${v.diem}` : v.diem} điểm
                </span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-ink-2">Bạn cắm:</span>
                {v.dat.length ? (
                  v.dat.map((d) => (
                    <span key={d.ma} className="inline-flex items-center gap-1">
                      <img
                        src={urlAnhBien(anhBien(d.ma))}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        decoding="async"
                        className="size-8"
                      />
                      {tenBien(d.ma)}
                    </span>
                  ))
                ) : (
                  <span>không cắm</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-ink-2">Đúng ra:</span>
                {v.dung.length ? (
                  v.dung.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 font-semibold">
                      <img
                        src={urlAnhBien(anhBien(m))}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        decoding="async"
                        className="size-8"
                      />
                      {tenBien(m)}
                    </span>
                  ))
                ) : (
                  <span className="font-semibold">để trống</span>
                )}
                {v.chap_nhan.length ? (
                  <span className="text-ink-2">(chấp nhận được: {v.chap_nhan.map(tenBien).join(", ")})</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {coChu ? <ChiTietRiengCamBien de={de} chiTiet={ct} /> : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một đoạn (GĐ17c): lý do và căn cứ từng vị trí, tình huống của lần chạy cuối. */
export function ChiTietRiengCamBien({ de, chiTiet }: { de: DeCamBien; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietCamBien;
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
      <section className="g-the p-3" aria-label="Lý do từng vị trí">
        <h3 className="text-base font-semibold">Lý do từng vị trí</h3>
        <ol className="mt-2 grid gap-3">
          {ct.vi_tri.map((v) => {
            const canCu = [...new Set(v.dung.map((m) => ct.bien[m]?.can_cu).filter(Boolean))] as string[];
            return (
              <li key={v.id}>
                <p className="text-[15px] font-semibold">
                  Vị trí {v.so}: {MO_TA_KET[v.ket]}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{v.ly_do}</p>
                <p className="mt-1 text-sm text-ink-2">
                  Căn cứ: {canCu.length ? canCu.map(nhanVienDan).join("; ") : "Căn cứ đang được cập nhật"}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
      {ct.hop_le ? <DanhSachTinhHuong ds={ct.tinh_huong} /> : null}
      <p className="text-sm text-ink-2">
        Đã chạy thử {ct.so_lan_chay}/{de.so_lan_chay} lần; bố trí được chấm là bố trí của lần chạy cuối.
      </p>
    </div>
  );
}
