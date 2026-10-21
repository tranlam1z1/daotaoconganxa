/**
 * Một màn trong trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15, GAME_DESIGN §5.15).
 *
 * Đoạn đường ban đêm nhìn từ trên xuống (M6, lib/ve-canh/ve-chot.ts), xe chạy từ dưới lên. Người chơi
 * kéo vật từ túi đồ vào ô 10 m × cột (lề trái, làn trái, làn phải, lề phải), hoặc chạm vật rồi chạm ô,
 * hoặc dùng bàn phím (M2 `useKeoTha`); vật đang chọn chỉnh từng mét, đổi cột, xoay biển, gỡ bằng nút hay
 * phím mũi tên. "Chạy thử" chạy M5 ngay trên điện thoại 60 giây mô phỏng, tối đa 2 lần; sau đó vẫn sửa
 * được. Mọi thao tác ghi nhật ký (M7); máy chủ dựng lại bố trí lúc nộp và chấm.
 *
 * Giảm chuyển động: chạy thử tính xong ngay, hiện ảnh tĩnh ở các mốc 10 giây, có nút tới, lùi; đèn cảnh
 * báo sáng tĩnh. Chấm y hệt.
 */
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apThaoTacChot,
  BoGhiNhatKy,
  type BoTriChot,
  bamTrangThai,
  buocMoPhong,
  type ChiTietChotDem,
  COT_CHOT,
  type CotChot,
  cauHinhChot,
  type DeChotDem,
  type DoDacChay,
  doDacRong,
  doSauNhip,
  dungMoPhong,
  type KetQuaChayChot,
  ketQuaChay,
  lyDoKhongDatDuoc,
  type MoPhong,
  NHIP_CHAY_CHOT,
  TEN_COT,
  TEN_HUONG_BIEN,
  TEN_TIEU_CHI_CHOT,
  TEN_VAT_CHOT,
  TEN_XE_CHOT,
  type ThamSoChot,
  type ThaoTacChot,
  type TraLoiChotDem,
  type TrangThaiMoPhong,
  trangThaiDau,
} from "../../lib/chot-dem";
import { cn } from "../../lib/cn";
import type { BienDoi } from "../../lib/ve-canh/bien-doi";
import { raY } from "../../lib/ve-canh/bien-doi";
import {
  CHI_SO_COT,
  rongCot,
  traiCot,
  veDauSuCo,
  veDuongDem,
  veVatChot,
  veXeDem,
  xPx,
  yM,
} from "../../lib/ve-canh/ve-chot";
import { Button } from "../ui/Button";
import { ThanhDinhDay } from "../ui/ThanhDinhDay";
import { CanhTrenXuong } from "./chung/CanhTrenXuong";
import { useKeoTha } from "./chung/tuong-tac/KeoTha";
import { phatAm } from "./hieu-ung/am-thanh";
import { useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export type TraLoiChotDemWeb = TraLoiChotDem | null;

/** Cao 10 m khi đặt vật: ô chạm cao 48 px. */
const O_PX = 48;
/** Tua nhanh khi chạy thử: 60 giây mô phỏng trong 15 giây. */
const TUA = 4;
/** Mốc ảnh tĩnh khi giảm chuyển động: 10 giây. */
const NHIP_MOC = 200;

type CheDo = "dat" | "chay" | "sau_chay";

const khungCua = (dai: number) => ({ x0: 0, x1: 1, y0: -200, y1: dai * 100 + 200 });
const tenVat = (id: string) => {
  const [loai, so] = id.split("-");
  return `${TEN_VAT_CHOT[loai as keyof typeof TEN_VAT_CHOT] ?? loai} ${so}`;
};
const giay = (nhip: number) => Math.round(nhip / 20);

export function ChotDem({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeChotDem;
  traLoi: TraLoiChotDemWeb;
  datTraLoi: (t: TraLoiChotDemWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiChotDemWeb) => void;
}) {
  const giam = useGiamChuyenDong();
  const [bt, datBt] = useState<BoTriChot>({});
  const [sua, datSua] = useState<string | null>(null);
  const [cheDo, datCheDo] = useState<CheDo>("dat");
  const [lanChay, datLanChay] = useState(0);
  const [kq, datKq] = useState<KetQuaChayChot | null>(null);
  const [phien, datPhien] = useState(0);
  const [thongBao, datThongBao] = useState("");
  const [bam, datBam] = useState("");
  const [moc, datMoc] = useState(0);
  const [oPxChay, datOPxChay] = useState(O_PX);

  const ghi = useRef<BoGhiNhatKy<ThaoTacChot, ThamSoChot> | null>(null);
  const mp = useRef<MoPhong | null>(null);
  const tt = useRef<TrangThaiMoPhong | null>(null);
  const ttTruoc = useRef<TrangThaiMoPhong | null>(null);
  const dd = useRef<DoDacChay>(doDacRong());
  const anhMoc = useRef<TrangThaiMoPhong[]>([]);
  const daGui = useRef(false);

  const khoa = daCham || traLoi !== null;
  const conLan = de.so_lan_chay - lanChay;
  const loaiCua = useMemo(() => new Map(de.tui.map((v) => [v.id, v.loai])), [de.tui]);
  const soBang = de.dai_m / 10;

  useEffect(() => {
    ghi.current = new BoGhiNhatKy(() => performance.now());
    const doi = () => (document.hidden ? ghi.current?.tamDung() : ghi.current?.tiepTuc());
    document.addEventListener("visibilitychange", doi);
    return () => document.removeEventListener("visibilitychange", doi);
  }, []);

  /* ------------------------------ Đặt vật ------------------------------ */

  const lam = (thaoTac: "dat" | "xoay" | "go", tham: NonNullable<ThamSoChot>) => {
    const moi = apThaoTacChot(de, bt, thaoTac, tham);
    ghi.current?.ghi(thaoTac, tham);
    datBt(moi);
    return moi;
  };

  /** Đặt hoặc dời vật tới (m, cột). Trả false và báo lý do khi chỗ đó không đặt được. */
  const datVao = (vat: string, m: number, cot: CotChot) => {
    if (khoa || cheDo !== "dat") return false;
    const lyDo = lyDoKhongDatDuoc(de, bt, vat, m, cot);
    if (lyDo) {
      datThongBao(`Không đặt được ${tenVat(vat)} ở mét ${m}, ${TEN_COT[cot]}: ${lyDo}`);
      rung("sai");
      return false;
    }
    lam("dat", { vat, m, cot });
    datSua(vat);
    phatAm("tich");
    datThongBao(`${tenVat(vat)}: mét ${m}, ${TEN_COT[cot]}.`);
    return true;
  };

  /** Thả vào ô 10 m: chọn mét gần giữa ô nhất còn đặt được. */
  const thaVaoO = (vat: string, o: string) => {
    const [bang, cot] = o.split(":") as [string, CotChot];
    const goc = Number(bang) * 10;
    for (const lech of [5, 4, 6, 3, 7, 2, 8, 1, 9, 0]) {
      const m = Math.min(de.dai_m, goc + lech);
      if (!lyDoKhongDatDuoc(de, bt, vat, m, cot)) return datVao(vat, m, cot);
    }
    datVao(vat, goc + 5, cot);
  };

  const keo = useKeoTha(thaVaoO);

  const dich = (id: string, dm: number, dc: number) => {
    const p = bt[id];
    if (!p) return;
    const c = COT_CHOT[Math.max(0, Math.min(3, CHI_SO_COT[p.cot]! + dc))]!;
    datVao(id, Math.max(0, Math.min(de.dai_m, p.m + dm)), c);
  };

  const phim = (e: KeyboardEvent) => {
    if (!sua || !bt[sua]) return;
    const k: Record<string, [number, number]> = {
      ArrowUp: [e.shiftKey ? 10 : 1, 0],
      ArrowDown: [e.shiftKey ? -10 : -1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (k[e.key]) {
      e.preventDefault();
      dich(sua, ...k[e.key]!);
    }
  };

  /* ------------------------------ Chạy thử ------------------------------ */

  const tienNhip = useCallback(() => {
    if (!mp.current || !tt.current) return false;
    ttTruoc.current = tt.current;
    tt.current = buocMoPhong(mp.current, tt.current);
    dd.current = doSauNhip(dd.current, tt.current);
    return !tt.current.xong && tt.current.nhip < NHIP_CHAY_CHOT;
  }, []);

  const ketThucChay = useCallback(() => {
    const s = tt.current;
    if (!s) return;
    const k = ketQuaChay(de, bt, s.su_kien, s.xe, dd.current);
    datKq(k);
    datBam(bamTrangThai({ xe: s.xe, su_kien: s.su_kien, nhip: s.nhip }));
    datCheDo("sau_chay");
    datPhien((p) => p + 1);
    const loi = k.phanh_gap.length + k.vao_vung.length;
    phatAm(loi ? "sai" : "dung");
    if (loi) rung("sai");
    datThongBao(
      `Chạy thử xong: ${k.phanh_gap.length} xe phanh gấp, ${k.vao_vung.length} lần xe vào vùng nguy hiểm, hàng chờ dài nhất ${k.hang_cho_m} m.`,
    );
  }, [de, bt]);

  const chayThu = () => {
    if (khoa || conLan <= 0 || cheDo !== "dat") return;
    ghi.current?.ghi("chay_thu", null);
    datLanChay((n) => n + 1);
    mp.current = dungMoPhong(cauHinhChot(de, bt));
    tt.current = trangThaiDau(mp.current);
    ttTruoc.current = tt.current;
    dd.current = doDacRong();
    datKq(null);
    datSua(null);
    datOPxChay(Math.max(16, Math.min(O_PX, Math.floor((window.innerHeight - 200) / (soBang + 0.4)))));
    if (giam) {
      // Tính hết ngay, giữ ảnh tĩnh ở từng mốc 10 giây.
      anhMoc.current = [tt.current];
      while (tienNhip()) if (tt.current!.nhip % NHIP_MOC === 0) anhMoc.current.push(tt.current!);
      if (anhMoc.current.at(-1) !== tt.current) anhMoc.current.push(tt.current);
      datMoc(anhMoc.current.length - 1);
      ttTruoc.current = tt.current;
      ketThucChay();
      return;
    }
    datCheDo("chay");
    datThongBao("Xe đang chạy thử.");
  };

  const boQua = () => {
    while (tienNhip());
    ttTruoc.current = tt.current;
    ketThucChay();
  };

  const nop = () => {
    if (khoa || daGui.current || !ghi.current) return;
    daGui.current = true;
    const nk = ghi.current.ketThuc();
    datTraLoi(nk);
    gui?.(nk);
  };

  /* --------------------------------- Vẽ --------------------------------- */

  /** Trạng thái đang vẽ: đọc ref mỗi khung hình (vòng vẽ không render lại component). */
  const trangThaiVe = () => (giam && cheDo === "sau_chay" ? (anhMoc.current[moc] ?? tt.current) : tt.current);
  const nguy = useMemo(() => new Set(kq?.vao_vung.map((x) => x.chien_si)), [kq]);

  const ve = (ctx: CanvasRenderingContext2D, bd: BienDoi, alpha: number) => {
    veDuongDem(ctx, bd, de);
    const s = cheDo === "dat" ? null : trangThaiVe();
    veVatChot(
      ctx,
      bd,
      de,
      bt,
      giam || !s || Math.floor(s.nhip / 10) % 2 === 0,
      nguy,
      cheDo === "dat" ? sua : null,
    );
    if (!s) return;
    veXeDem(ctx, bd, de, (giam ? s : (ttTruoc.current ?? s)).xe, s.xe, giam ? 1 : alpha);
    for (const e of s.su_kien)
      if (e.loai === "phanh_gap") veDauSuCo(ctx, xPx(bd, de, e.x) + 14, raY(bd, e.y));
  };

  const lopPhu = (bd: BienDoi) =>
    cheDo === "dat" && !khoa
      ? Array.from({ length: soBang }, (_, b) =>
          COT_CHOT.map((cot, c) => {
            const o = `${b}:${cot}`;
            return (
              <button
                key={o}
                {...keo.vung(o)}
                // Chạm-chạm theo vật đang chọn (`sua`), không theo lựa chọn riêng của KeoTha.
                onClick={() => sua && thaVaoO(sua, o)}
                aria-label={`${TEN_COT[cot]}, mét ${b * 10} đến ${b * 10 + 9}`}
                className={cn(
                  "absolute border border-transparent",
                  (sua || keo.dangKeo) && "border-dashed border-[color:var(--line-strong)]",
                )}
                style={{
                  left: traiCot(bd, c),
                  width: rongCot(bd),
                  top: yM(bd, de, b * 10 + 10),
                  height: yM(bd, de, b * 10) - yM(bd, de, b * 10 + 10),
                }}
              />
            );
          }),
        )
      : null;

  if (daCham && chiTiet) return <KetQuaChot de={de} ct={chiTiet as ChiTietChotDem} bamMay={bam} />;

  const pSua = sua ? bt[sua] : undefined;
  const oPx = cheDo === "dat" ? O_PX : oPxChay;

  return (
    <div className="space-y-3" data-bam={bam || undefined}>
      <p className="flex items-center justify-between gap-2 text-sm text-ink-2">
        <span>
          {de.dai_m} m đường · chốt ở mét {de.chot_m}, {TEN_COT[de.lan_dong]}
        </span>
        <span className="g-so">
          Chạy thử còn <strong className="text-ink">{conLan}</strong>/{de.so_lan_chay}
        </span>
      </p>

      <CanhTrenXuong
        khung={khungCua(de.dai_m)}
        cao={Math.round((soBang + 0.4) * oPx)}
        ve={ve}
        chay={cheDo === "chay" && !giam}
        tienNhip={tienNhip}
        heSoTua={TUA}
        onXong={ketThucChay}
        onTamDung={(d) => (d ? ghi.current?.tamDung() : ghi.current?.tiepTuc())}
        phienBan={`${phien}|${cheDo}|${moc}|${sua}|${JSON.stringify(bt)}`}
        nhan={`Đoạn đường ${de.dai_m} m ban đêm nhìn từ trên xuống, xe chạy từ dưới lên, hai làn cùng chiều. Chốt ở mét ${de.chot_m}, ${TEN_COT[de.lan_dong]}.${de.khuat.map((k) => ` ${k.loai === "cong" ? "Khúc cua" : "Đỉnh dốc"} từ mét ${k.m_tu} đến ${k.m_den}.`).join("")}${de.giao_lo ? ` Giao lộ ở mét ${de.giao_lo.m}.` : ""}`}
        lopPhu={lopPhu}
        className="overflow-hidden rounded-2xl border border-line"
      />

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {thongBao}
      </p>

      {giam && cheDo === "sau_chay" && anhMoc.current.length > 1 ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="min-h-12"
            disabled={moc <= 0}
            onClick={() => datMoc((m) => m - 1)}
          >
            Lùi 10 giây
          </Button>
          <Button
            variant="secondary"
            className="min-h-12"
            disabled={moc >= anhMoc.current.length - 1}
            onClick={() => datMoc((m) => m + 1)}
          >
            Tới 10 giây
          </Button>
          <p className="col-span-2 text-center text-sm text-ink-2">Giây {giay(trangThaiVe()?.nhip ?? 0)}</p>
        </div>
      ) : null}

      {cheDo === "chay" ? (
        <Button variant="secondary" className="min-h-12 w-full" onClick={boQua}>
          Bỏ qua hoạt cảnh
        </Button>
      ) : null}

      {cheDo === "sau_chay" && kq && !khoa ? <KetQuaChayThu de={de} kq={kq} /> : null}

      {cheDo !== "chay" && !khoa ? (
        <ThanhDinhDay className="-mx-1 space-y-2 border-t border-line bg-surface px-1 pt-2">
          {cheDo === "dat" && sua ? (
            <section className="space-y-1" aria-label={`Chỉnh ${tenVat(sua)}`} onKeyDown={phim}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  <strong>{tenVat(sua)}</strong>:{" "}
                  {pSua
                    ? `mét ${pSua.m}, ${TEN_COT[pSua.cot]}${loaiCua.get(sua) === "bien" ? `, ${TEN_HUONG_BIEN[pSua.huong]}` : ""}`
                    : "chạm một ô trên đường để đặt."}
                </p>
                <Button className="min-h-12 shrink-0" onClick={() => datSua(null)}>
                  Xong
                </Button>
              </div>
              {pSua ? (
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      ["−10 m", -10, 0],
                      ["−1 m", -1, 0],
                      ["+1 m", 1, 0],
                      ["+10 m", 10, 0],
                      ["◀ Cột", 0, -1],
                      ["Cột ▶", 0, 1],
                    ] as const
                  ).map(([nhan, dm, dc]) => (
                    <Button
                      key={nhan}
                      variant="secondary"
                      className="min-h-12 px-1"
                      onClick={() => dich(sua, dm, dc)}
                    >
                      {nhan}
                    </Button>
                  ))}
                  {loaiCua.get(sua) === "bien" ? (
                    <Button
                      variant="secondary"
                      className="min-h-12 px-1"
                      onClick={() => lam("xoay", { vat: sua })}
                    >
                      Xoay
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    className="min-h-12 px-1"
                    onClick={() => {
                      lam("go", { vat: sua });
                      datThongBao(`Đã gỡ ${tenVat(sua)}.`);
                    }}
                  >
                    Gỡ
                  </Button>
                </div>
              ) : null}
            </section>
          ) : (
            <>
              {cheDo === "dat" ? (
                <>
                  <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Túi đồ">
                    {de.tui.map((v) => {
                      const p = keo.vat(v.id);
                      const o = bt[v.id];
                      return (
                        <li key={v.id} className="shrink-0">
                          <button
                            {...p}
                            // Chạm chọn vật để đặt hoặc chỉnh (kéo vẫn do KeoTha lo).
                            onClick={() => datSua(v.id)}
                            aria-label={`${tenVat(v.id)}: ${o ? `mét ${o.m}, ${TEN_COT[o.cot]}` : "chưa đặt"}`}
                            className={cn(
                              p.className,
                              "min-h-12 w-[5.5rem] rounded-xl border-2 bg-surface px-1 text-xs leading-tight",
                            )}
                            style={{ ...p.style, borderColor: o ? "var(--primary)" : "var(--line)" }}
                          >
                            <span className="block font-semibold">{tenVat(v.id)}</span>
                            <span className="text-ink-2">{o ? `${o.m} m` : "chưa đặt"}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-ink-2">
                    Kéo vật vào đường, hoặc chạm vật rồi chạm ô. Bố trí lúc bấm "Nộp" được chấm; hết lượt chạy
                    thử vẫn sửa được.
                  </p>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {cheDo === "dat" ? (
                  <Button variant="secondary" className="min-h-12" onClick={chayThu} disabled={conLan <= 0}>
                    Chạy thử (còn {conLan})
                  </Button>
                ) : (
                  <Button variant="secondary" className="min-h-12" onClick={() => datCheDo("dat")}>
                    Sửa bố trí
                  </Button>
                )}
                <Button className="g-nut min-h-12" onClick={nop}>
                  Nộp bố trí
                </Button>
              </div>
            </>
          )}
        </ThanhDinhDay>
      ) : null}
    </div>
  );
}

/** Kết quả một lần chạy: xe phanh gấp, xe vào vùng nguy hiểm, hàng chờ, biển có vấn đề. Không có ngưỡng. */
function KetQuaChayThu({ de, kq }: { de: DeChotDem; kq: KetQuaChayChot }) {
  const tenXe = (x: KetQuaChayChot["phanh_gap"][number]) =>
    `${TEN_XE_CHOT[x.loai]} ${x.xe.slice(3)}${x.qua_toc_do ? " (chạy quá tốc độ)" : ""}`;
  const bien = kq.bien.filter((b) => b.quay_sai || b.bi_che || b.qua_gan || b.sau_chot);
  return (
    <section className="g-the space-y-2 rounded-2xl p-3 text-[15px]" aria-label="Kết quả chạy thử">
      <h3 className="text-base font-semibold">Kết quả chạy thử</h3>
      <p>
        {kq.so_xe_da_qua}/{kq.so_xe} xe đã qua đoạn đường. Hàng chờ dài nhất{" "}
        <strong>{kq.hang_cho_m} m</strong>
        {kq.hang_cho_m ? ` (giây ${giay(kq.nhip_hang_cho)})` : ""}.
      </p>
      <p className={kq.phanh_gap.length ? "text-danger" : "text-ok"}>
        {kq.phanh_gap.length
          ? `Xe phanh gấp: ${kq.phanh_gap.map((x) => `${tenXe(x)} ở mét ${x.m}, giây ${giay(x.nhip)}`).join("; ")}.`
          : "Không xe nào phải phanh gấp."}
      </p>
      <p className={kq.vao_vung.length ? "text-danger" : "text-ok"}>
        {kq.vao_vung.length
          ? `Xe vào vùng nguy hiểm: ${kq.vao_vung.map((x) => `${tenXe(x)} sát ${tenVat(x.chien_si)}`).join("; ")}.`
          : "Không xe nào đi vào vùng nguy hiểm của chiến sĩ."}
      </p>
      {bien.length ? (
        <ul className="list-disc pl-5">
          {bien.map((b) => (
            <li key={b.vat}>
              {tenVat(b.vat)} ở mét {b.m}:{" "}
              {[
                b.quay_sai && "quay sai hướng, xe tới không thấy",
                b.sau_chot && "đặt từ vùng chốt trở đi",
                b.qua_gan && `quá gần chốt (chốt ở mét ${de.chot_m})`,
                b.bi_che && `bị khuất, người lái chỉ thấy từ ${b.tam_nhin_m} m`,
              ]
                .filter(Boolean)
                .join("; ")}
              .
            </li>
          ))}
        </ul>
      ) : kq.bien.length ? (
        <p className="text-ok">Biển không bị khuất, không quá gần chốt.</p>
      ) : (
        <p className="text-danger">Chưa đặt biển nào.</p>
      )}
    </section>
  );
}

/**
 * Màn kết quả (bảng chơi sau khi chấm): điểm sáu tiêu chí, ảnh lúc xe đầu tiên phanh gấp. Đo được,
 * ngưỡng, căn cứ và kết quả chạy ở `ChiTietRiengChotDem` (GĐ17c).
 */
function KetQuaChot({ de, ct, bamMay }: { de: DeChotDem; ct: ChiTietChotDem; bamMay: string }) {
  // Dựng lại cảnh lúc xe đầu tiên phanh gấp (hoặc lúc cuối) bằng cùng bộ mô phỏng: ảnh tĩnh.
  const anh = useMemo(() => {
    const mo = dungMoPhong(cauHinhChot(de, ct.bo_tri));
    let s = trangThaiDau(mo);
    const toi = ct.chay.phanh_gap[0]?.nhip ?? NHIP_CHAY_CHOT;
    while (!s.xong && s.nhip < toi) s = buocMoPhong(mo, s);
    return s;
  }, [de, ct]);
  const nguy = new Set(ct.chay.vao_vung.map((x) => x.chien_si));
  const pg = ct.chay.phanh_gap[0];
  return (
    <div className="space-y-3" data-bam={ct.bam} data-bam-may={bamMay || undefined}>
      <ol className="grid gap-2" aria-label="Điểm từng tiêu chí">
        {ct.tieu_chi.map((t) => (
          <li key={t.ma} className="g-the flex flex-wrap items-baseline justify-between gap-x-3 p-3">
            <span className="text-[15px] font-semibold">{TEN_TIEU_CHI_CHOT[t.ma]}</span>
            <span className={cn("text-sm font-semibold", t.diem >= t.toi_da ? "text-ok" : "text-danger")}>
              {t.diem >= t.toi_da ? "✓" : "✗"} {t.diem}/{t.toi_da} điểm
            </span>
          </li>
        ))}
      </ol>
      {ct.hop_le ? (
        <>
          <p className="text-sm text-ink-2">
            {pg
              ? `Ảnh lúc ${TEN_XE_CHOT[pg.loai]} ${pg.xe.slice(3)} phanh gấp (giây ${giay(pg.nhip)}).`
              : "Ảnh lúc hết 60 giây."}
          </p>
          <CanhTrenXuong
            khung={khungCua(de.dai_m)}
            cao={Math.round((de.dai_m / 10 + 0.4) * 24)}
            ve={(ctx, bd) => {
              veDuongDem(ctx, bd, de);
              veVatChot(ctx, bd, de, ct.bo_tri, true, nguy, null);
              veXeDem(ctx, bd, de, anh.xe, anh.xe, 1);
              for (const e of anh.su_kien)
                if (e.loai === "phanh_gap") veDauSuCo(ctx, xPx(bd, de, e.x) + 14, raY(bd, e.y));
            }}
            chay={false}
            phienBan={ct.bam}
            nhan="Bố trí đã nộp và vị trí các xe lúc xe đầu tiên phanh gấp."
            className="overflow-hidden rounded-2xl border border-line"
          />
        </>
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một đoạn (GĐ17c): đo được, ngưỡng, căn cứ từng tiêu chí; kết quả chạy. */
export function ChiTietRiengChotDem({ de, chiTiet }: { de: DeChotDem; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietChotDem;
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
      <section className="g-the p-3" aria-label="Sáu tiêu chí">
        <h3 className="text-base font-semibold">Sáu tiêu chí</h3>
        <ol className="mt-2 grid gap-3">
          {ct.tieu_chi.map((t) => (
            <li key={t.ma}>
              <p className="text-[15px] font-semibold">
                {TEN_TIEU_CHI_CHOT[t.ma]}: {t.diem}/{t.toi_da} điểm
              </p>
              <p className="mt-1 text-sm">{t.do_duoc}</p>
              <p className="mt-1 text-sm text-ink-2">Ngưỡng: {t.nguong}</p>
              <p className="mt-1 text-sm text-ink-2">Căn cứ: {t.nguon || "Căn cứ đang được cập nhật"}</p>
            </li>
          ))}
        </ol>
      </section>
      {ct.hop_le ? <KetQuaChayThu de={de} kq={ct.chay} /> : null}
      <p className="text-sm text-ink-2">
        Đã chạy thử {ct.so_lan_chay}/{de.so_lan_chay} lần; bố trí được chấm là bố trí lúc nộp.
      </p>
    </div>
  );
}
