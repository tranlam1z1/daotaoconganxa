/**
 * Đường chạy của "Cung đường biển báo" (docs/PLAN.md GĐ-G8, GAME_DESIGN §5.5).
 *
 * Xe tự chạy; mỗi biển hiện ở xa, tiến lại gần trong cửa sổ phản ứng. Người chơi bấm một trong 4
 * thao tác (NutPhanUng). Điện thoại ghi nhật ký `{ bien, thao_tac, ms }` theo đồng hồ riêng của
 * đường chạy (không tính lúc tab ẩn), phản hồi ngay bằng CÙNG hàm chấm của máy chủ, tính mạng, và
 * khi về đích thì trao nhật ký cho trang để gửi chấm lại.
 *
 * Hoạt cảnh: một vòng requestAnimationFrame, chỉ đổi transform/opacity qua ref (không render React
 * mỗi khung), tối đa 12 biển + vạch kẻ + xe. Tab ẩn thì tạm dừng; ẩn quá 10 giây thì kết thúc.
 * Giảm chuyển động: chế độ từng bước (đường đứng yên, biển hiện tĩnh giữa màn, đếm giây).
 *
 * Ba hiệu ứng riêng đã duyệt (25/9/2026): đèn phanh và đường chậm lại khi bấm Giảm tốc/Dừng;
 * biển xử lý xong lướt về dải "biển đã qua" kèm dấu; mạng là 3 vô lăng, mất mạng thì vô lăng nứt.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import {
  type ChiTietDuong,
  type DeCungDuong,
  type KetBien,
  ketQuaMotBien,
  type SuKienDuong,
  TAM_DUNG_TOI_DA_MS,
  TEN_THAO_TAC_BIEN_BAO,
  type ThaoTacBienBao,
  type TraLoiCungDuong,
} from "../../lib/cung-duong";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong, useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { NhanCombo } from "./hieu-ung/NhanCombo";
import { rung } from "./hieu-ung/rung";
import { NutPhanUng } from "./NutPhanUng";

export type DeDuong = Extract<DeCungDuong, { loai: "duong" }>;
type BienDe = DeDuong["bien"][number];

export const urlAnhBien = (anh: string) => `/bien-bao/anh/${encodeURIComponent(anh)}`;

/** Tốc độ cuộn vạch kẻ (px mỗi ms) và mức chậm khi phanh. */
const TOC_DO_DUONG = 0.32;
const CHAM_KHI_PHANH: Partial<Record<ThaoTacBienBao, { he_so: number; ms: number }>> = {
  giam_toc: { he_so: 0.35, ms: 1000 },
  dung_lai: { he_so: 0.08, ms: 1300 },
};
const DEM_NGUOC_S = 3;

type TrangThai = "cho" | "dem" | "chay" | "xong";
type LyDoXong = "ve_dich" | "het_mang" | "tam_dung";

interface KetQuaTam {
  thu_tu: number;
  ket: Exclude<KetBien, "khong_tinh">;
  chon: ThaoTacBienBao | null;
}

const LA_DUNG = (k: KetBien) => k === "dung";

/* ------------------------------------------------------------------ */
/* Mảnh hình                                                           */
/* ------------------------------------------------------------------ */

function VoLang({ con, so }: { con: boolean; so: number }) {
  return (
    <span className={cn("relative inline-grid size-8 place-items-center", !con && "opacity-40")}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="size-8"
        style={{ color: con ? "var(--primary)" : "var(--ink-3)" }}
      >
        <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <circle cx="16" cy="16" r="3.5" fill="currentColor" />
        <path
          d="M4.5 14h8M19.5 14h8M16 19.5V28"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {!con ? (
          <path
            className="g-a g-ve-net"
            style={{ "--g-dai-net": 40 } as React.CSSProperties}
            d="M9 5l5 7-4 5 6 5-2 7"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
      <span className="sr-only">{con ? `Mạng ${so} còn` : `Mạng ${so} đã mất`}</span>
    </span>
  );
}

function XeCuaBan({ phanh }: { phanh: boolean }) {
  return (
    <svg viewBox="0 0 40 64" aria-hidden="true" className="h-16 w-10">
      <rect x="4" y="4" width="32" height="56" rx="9" fill="var(--primary)" />
      <rect x="9" y="12" width="22" height="12" rx="3" fill="var(--primary-soft)" />
      <rect x="9" y="40" width="22" height="9" rx="3" fill="var(--primary-soft)" opacity="0.7" />
      <rect x="6" y="55" width="8" height="4" rx="1.5" fill="var(--danger)" opacity={phanh ? 1 : 0.3} />
      <rect x="26" y="55" width="8" height="4" rx="1.5" fill="var(--danger)" opacity={phanh ? 1 : 0.3} />
      {phanh ? (
        <>
          <circle cx="10" cy="60" r="6" fill="var(--danger)" opacity="0.35" />
          <circle cx="30" cy="60" r="6" fill="var(--danger)" opacity="0.35" />
        </>
      ) : null}
    </svg>
  );
}

function DauNho({ ket }: { ket: KetBien }) {
  const dung = ket === "dung";
  const trung = ket === "than_trong" || ket === "bo_qua" || ket === "khong_tinh";
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full text-[10px] font-bold"
      style={{
        background: dung ? "var(--ok)" : trung ? "var(--ink-3)" : "var(--danger)",
        color: "var(--surface)",
      }}
    >
      {dung ? "✓" : trung ? "–" : "✕"}
    </span>
  );
}

const MO_TA_KET: Record<KetBien, string> = {
  dung: "Đúng",
  sai: "Sai",
  bo_lo: "Bỏ lỡ",
  than_trong: "Thận trọng, không điểm",
  bo_qua: "Không bấm, không điểm",
  khong_tinh: "Không tính",
};

/* ------------------------------------------------------------------ */
/* Đường chạy                                                          */
/* ------------------------------------------------------------------ */

export function DuongChay({ de, onXong }: { de: DeDuong; onXong: (tl: TraLoiCungDuong) => void }) {
  const giam = useGiamChuyenDong();
  const [trangThai, datTrangThai] = useState<TrangThai>("cho");
  const [dem, datDem] = useState(DEM_NGUOC_S);
  const [ketQua, datKetQua] = useState<KetQuaTam[]>([]);
  const [mang, datMang] = useState(de.so_mang);
  const [dangMo, datDangMo] = useState<number | null>(null);
  const [conGiay, datConGiay] = useState(0);
  const [phanh, datPhanh] = useState(false);
  const [thongBao, datThongBao] = useState("");
  const [lyDo, datLyDo] = useState<LyDoXong | null>(null);

  // Trạng thái của vòng lặp, giữ trong ref để không render lại mỗi khung.
  const t = useRef(0);
  const lan = useRef(0);
  const suKien = useRef<SuKienDuong[]>([]);
  const daXuLy = useRef(new Map<number, KetQuaTam>());
  const mangRef = useRef(de.so_mang);
  const heSo = useRef(1);
  const heSoDich = useRef(1);
  const phanhDen = useRef(0);
  const moRef = useRef<number | null>(null);
  const giayRef = useRef(0);
  const doiVach = useRef(0);
  const tamDungLuc = useRef<number | null>(null);
  const xongRef = useRef(false);
  const vachRef = useRef<HTMLDivElement>(null);
  const bienRef = useRef<Array<HTMLDivElement | null>>([]);
  const duongRef = useRef<HTMLDivElement>(null);
  const tuViTri = useRef(new Map<number, DOMRect>());

  // Tải trước ảnh biển (để chạy mượt, và để service worker giữ khi chơi offline).
  useEffect(() => {
    for (const a of new Set(de.bien.map((b) => b.anh))) {
      const img = new Image();
      img.src = urlAnhBien(a);
    }
  }, [de.bien]);

  const ketThuc = useCallback(
    (ly: LyDoXong) => {
      if (xongRef.current) return;
      xongRef.current = true;
      const tong = Math.round(Math.min(t.current, de.tong_ms));
      datLyDo(ly);
      datTrangThai("xong");
      datDangMo(null);
      phatAm(ly === "ve_dich" ? "hoan_thanh" : "het_gio");
      onXong({ loai: "duong", su_kien: [...suKien.current], tong_ms: tong });
    },
    [de.tong_ms, onXong],
  );

  const xuLy = useCallback(
    (b: BienDe, chon: { thao_tac: ThaoTacBienBao; ms: number } | null) => {
      if (daXuLy.current.has(b.thu_tu) || xongRef.current) return;
      const kq = ketQuaMotBien(b, chon);
      const tam: KetQuaTam = { thu_tu: b.thu_tu, ket: kq.ket, chon: chon?.thao_tac ?? null };
      daXuLy.current.set(b.thu_tu, tam);
      // Vị trí biển lúc xử lý, để biển "lướt" về dải biển đã qua.
      const el = bienRef.current[b.thu_tu - 1];
      if (el && !dangGiamChuyenDong()) {
        tuViTri.current.set(b.thu_tu, el.getBoundingClientRect());
        el.style.opacity = "0";
      }
      datKetQua((ds) => [...ds, tam]);
      if (kq.ket === "dung") {
        phatAm("dung");
        rung("dung");
        datThongBao(`Biển ${b.thu_tu}: đúng, ${TEN_THAO_TAC_BIEN_BAO[b.phan_ung].toLowerCase()}.`);
      } else if (kq.mat_mang) {
        phatAm("sai");
        rung("sai");
        // Rung ngang mặt đường (lớp .g-t, tự tắt khi giảm chuyển động): gỡ rồi gắn lại lớp để chạy lại.
        const d = duongRef.current;
        if (d) {
          d.classList.remove("g-rung-ngang");
          void d.offsetWidth;
          d.classList.add("g-rung-ngang");
        }
        mangRef.current -= 1;
        datMang(mangRef.current);
        datThongBao(
          `Biển ${b.thu_tu}: ${kq.ket === "bo_lo" ? "bỏ lỡ" : "sai"}, cần ${TEN_THAO_TAC_BIEN_BAO[b.phan_ung].toLowerCase()}. Mất một mạng.`,
        );
        if (mangRef.current <= 0) ketThuc("het_mang");
      } else {
        datThongBao(`Biển ${b.thu_tu}: không cần phản ứng, không mất mạng.`);
      }
    },
    [ketThuc],
  );

  const onBam = useCallback(
    (tt: ThaoTacBienBao) => {
      if (trangThai !== "chay" || xongRef.current) return;
      // Đẩy đồng hồ tới đúng lúc bấm, để mốc bấm không bao giờ sau lúc kết thúc (hết mạng ngay lần này).
      const now = performance.now();
      const bay = t.current + (now - lan.current);
      t.current = bay;
      lan.current = now;
      const b = de.bien.find(
        (x) => !daXuLy.current.has(x.thu_tu) && bay >= x.hien_ms && bay <= x.hien_ms + x.cua_so_ms,
      );
      if (!b) return;
      const ms = Math.round(bay);
      suKien.current.push({ bien: b.thu_tu, thao_tac: tt, ms });
      const cham = CHAM_KHI_PHANH[tt];
      if (cham) {
        heSoDich.current = cham.he_so;
        phanhDen.current = ms + cham.ms;
        datPhanh(true);
      }
      xuLy(b, { thao_tac: tt, ms });
    },
    [trangThai, de.bien, xuLy],
  );

  // Đếm ngược 3-2-1 rồi xuất phát.
  useEffect(() => {
    if (trangThai !== "dem") return;
    if (dem <= 0) {
      datTrangThai("chay");
      return;
    }
    phatAm("tich");
    const id = setTimeout(() => datDem((d) => d - 1), 1000);
    return () => clearTimeout(id);
  }, [trangThai, dem]);

  // Vòng chạy.
  useEffect(() => {
    if (trangThai !== "chay") return;
    let raf = 0;
    lan.current = performance.now();
    const H = () => duongRef.current?.clientHeight ?? 400;

    const buoc = (now: number) => {
      const dt = Math.min(100, now - lan.current);
      lan.current = now;
      t.current += dt;
      const tt = t.current;

      // Biển mở, hết cửa sổ.
      let mo: number | null = null;
      for (const b of de.bien) {
        const het = b.hien_ms + b.cua_so_ms;
        if (tt >= b.hien_ms && tt <= het && !daXuLy.current.has(b.thu_tu)) mo = b.thu_tu;
        if (tt > het && !daXuLy.current.has(b.thu_tu)) xuLy(b, null);
      }
      // Chỉ render lại khi biển đang mở hoặc số giây còn lại đổi.
      if (moRef.current !== mo) {
        moRef.current = mo;
        datDangMo(mo);
        if (mo !== null) datThongBao(`Biển ${mo} xuất hiện. Chọn thao tác.`);
      }
      if (mo !== null) {
        const b = de.bien[mo - 1]!;
        const s = Math.max(0, Math.ceil((b.hien_ms + b.cua_so_ms - tt) / 1000));
        if (giayRef.current !== s) {
          giayRef.current = s;
          datConGiay(s);
        }
      }

      // Phanh: đường chậm lại rồi trở lại.
      if (phanhDen.current && tt > phanhDen.current) {
        phanhDen.current = 0;
        datPhanh(false);
      }
      const dich = phanhDen.current ? heSoDich.current : 1;
      heSo.current += (dich - heSo.current) * Math.min(1, dt / 250);

      if (!dangGiamChuyenDong()) {
        doiVach.current = (doiVach.current + dt * TOC_DO_DUONG * heSo.current) % 80;
        if (vachRef.current) vachRef.current.style.transform = `translate3d(0, ${doiVach.current - 80}px, 0)`;
        const h = H();
        for (const b of de.bien) {
          const el = bienRef.current[b.thu_tu - 1];
          if (!el) continue;
          const p = (tt - b.hien_ms) / b.cua_so_ms;
          if (p < 0 || p > 1.25 || daXuLy.current.has(b.thu_tu)) {
            if (el.style.opacity !== "0") el.style.opacity = "0";
            continue;
          }
          const y = h * (0.04 + p * 0.62);
          const s = 0.45 + p * 0.75;
          el.style.opacity = "1";
          el.style.transform = `translate3d(0, ${y}px, 0) scale(${s})`;
        }
      }

      if (tt >= de.tong_ms) {
        ketThuc("ve_dich");
        return;
      }
      if (!xongRef.current) raf = requestAnimationFrame(buoc);
    };
    raf = requestAnimationFrame(buoc);

    // Tab ẩn: tạm dừng; ẩn quá 10 giây thì kết thúc đường chạy.
    const doiHienThi = () => {
      if (document.hidden) {
        tamDungLuc.current = performance.now();
        cancelAnimationFrame(raf);
      } else if (tamDungLuc.current !== null) {
        const nghi = performance.now() - tamDungLuc.current;
        tamDungLuc.current = null;
        if (nghi > TAM_DUNG_TOI_DA_MS) ketThuc("tam_dung");
        else {
          lan.current = performance.now();
          raf = requestAnimationFrame(buoc);
        }
      }
    };
    document.addEventListener("visibilitychange", doiHienThi);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", doiHienThi);
    };
  }, [trangThai, de, xuLy, ketThuc]);

  // Biển vừa xử lý lướt từ vị trí trên đường về ô của nó ở dải biển đã qua.
  useLayoutEffect(() => {
    const moi = ketQua.at(-1);
    if (!moi) return;
    const tu = tuViTri.current.get(moi.thu_tu);
    tuViTri.current.delete(moi.thu_tu);
    const o = document.getElementById(`bien-qua-${moi.thu_tu}`);
    if (!tu || !o || dangGiamChuyenDong() || typeof o.animate !== "function") return;
    const den = o.getBoundingClientRect();
    const dx = tu.left + tu.width / 2 - (den.left + den.width / 2);
    const dy = tu.top + tu.height / 2 - (den.top + den.height / 2);
    const s = tu.width / Math.max(1, den.width);
    o.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: "translate(0, 0) scale(1)" }],
      { duration: 450, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, [ketQua]);

  const chuoi = (() => {
    let n = 0;
    for (let i = ketQua.length - 1; i >= 0; i--) {
      const k = ketQua[i]!.ket;
      if (LA_DUNG(k)) n++;
      else if (k === "sai" || k === "bo_lo") break;
    }
    return n;
  })();
  const bienMo = dangMo !== null ? de.bien[dangMo - 1]! : null;
  const soDung = ketQua.filter((k) => LA_DUNG(k.ket)).length;

  return (
    <div className="space-y-3">
      {/* Đầu đường chạy: mạng, chuỗi, tiến độ */}
      <div className="flex min-h-9 items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {Array.from({ length: de.so_mang }, (_, i) => i + 1).map((so) => (
            <VoLang key={so} con={so <= mang} so={so} />
          ))}
        </div>
        <NhanCombo n={chuoi} />
        <p className="g-so text-sm text-ink-2">
          Biển {Math.min(ketQua.length + (bienMo ? 1 : 0), de.bien.length)}/{de.bien.length}
        </p>
      </div>

      {/* Dải biển đã qua */}
      <ol aria-label="Biển đã qua" className="flex min-h-9 flex-wrap items-center gap-1.5">
        {ketQua.map((k) => {
          const b = de.bien[k.thu_tu - 1]!;
          return (
            <li key={k.thu_tu} id={`bien-qua-${k.thu_tu}`} className="relative size-8">
              <img src={urlAnhBien(b.anh)} alt="" className="size-8" draggable={false} />
              <DauNho ket={k.ket} />
              <span className="sr-only">
                Biển {k.thu_tu}: {MO_TA_KET[k.ket]}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mặt đường */}
      <div
        ref={duongRef}
        className="g-t relative h-[min(52vh,420px)] overflow-hidden rounded-2xl border border-line"
        style={{ background: "var(--primary-soft)" }}
      >
        <div
          className="absolute inset-y-0 left-[14%] right-[14%] overflow-hidden"
          style={{ background: "var(--ink-2)" }}
        >
          <div
            ref={vachRef}
            aria-hidden="true"
            className="absolute left-1/2 -top-20 h-[calc(100%+160px)] w-1.5 -translate-x-1/2"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--surface) 0 40px, transparent 40px 80px)",
              willChange: "transform",
            }}
          />
        </div>

        {/* Biển trên đường (chế độ thường) */}
        {!giam
          ? de.bien.map((b, i) => (
              <div
                key={b.thu_tu}
                ref={(el) => {
                  bienRef.current[i] = el;
                }}
                aria-hidden="true"
                className="absolute top-0 right-[3%] size-20 origin-top"
                style={{ opacity: 0, willChange: "transform, opacity" }}
              >
                <img src={urlAnhBien(b.anh)} alt="" className="size-20 drop-shadow" draggable={false} />
              </div>
            ))
          : null}

        {/* Chế độ từng bước: biển hiện tĩnh giữa màn, đếm giây */}
        {giam && bienMo ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid justify-items-center gap-2 rounded-2xl bg-surface p-4 shadow">
              <img
                key={bienMo.thu_tu}
                src={urlAnhBien(bienMo.anh)}
                alt={`Biển thứ ${bienMo.thu_tu}`}
                className="size-32"
              />
              <p className="g-so text-2xl font-bold">{conGiay} giây</p>
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <XeCuaBan phanh={phanh} />
        </div>

        {/* Trước khi chạy và khi đếm ngược */}
        {trangThai === "cho" || trangThai === "dem" ? (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ background: "rgb(0 0 0 / 0.35)" }}
          >
            {trangThai === "cho" ? (
              <button
                type="button"
                onClick={() => {
                  datDem(DEM_NGUOC_S);
                  datTrangThai("dem");
                }}
                className="g-nut inline-flex items-center justify-center bg-primary px-8 text-lg text-on-primary"
              >
                Xuất phát
              </button>
            ) : (
              <span
                key={dem}
                className="g-a g-bat g-tieu-de grid size-24 place-items-center rounded-full text-5xl font-bold"
                style={{ background: "var(--g-nhan)", color: "var(--g-tren-nhan)" }}
              >
                {dem > 0 ? dem : "Đi!"}
              </span>
            )}
          </div>
        ) : null}

        {trangThai === "xong" ? (
          <div
            className="absolute inset-0 grid place-items-center p-4"
            style={{ background: "rgb(0 0 0 / 0.45)" }}
          >
            <div className="g-a g-bat g-the w-full max-w-xs p-4 text-center">
              <p className="g-tieu-de text-xl font-bold">
                {lyDo === "ve_dich" ? "Về đích" : lyDo === "het_mang" ? "Hết mạng" : "Đã dừng đường chạy"}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {lyDo === "tam_dung"
                  ? "Bạn rời trang quá 10 giây. Các biển chưa tới không tính."
                  : `Đúng ${soDung}/${de.bien.length} biển.`}{" "}
                Bấm "Chốt đáp án" để chấm.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-2">
        {trangThai === "chay" ? thongBao || "Xe đang chạy. Chờ biển xuất hiện." : ""}
      </p>

      <NutPhanUng onBam={onBam} khoa={trangThai !== "chay"} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kết quả sau khi chấm                                                */
/* ------------------------------------------------------------------ */

/**
 * Vùng chơi sau khi chấm đường chạy (GĐ17c, đề xuất Đ12): số biển xử lý đúng trên tổng và dải biển có
 * dấu đúng/sai. Bảng từng biển (hành động cần làm, lựa chọn, điểm) ở `KetQuaDuong`, trong "Xem chi tiết".
 */
export function TomTatDuong({ chiTiet }: { chiTiet: ChiTietDuong }) {
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Xử lý đúng{" "}
        <strong className="g-so">
          {chiTiet.bien.filter((b) => LA_DUNG(b.ket)).length}/{chiTiet.bien.length}
        </strong>{" "}
        biển
      </p>
      <ol aria-label="Các biển trên đường" className="flex flex-wrap items-center gap-1.5">
        {chiTiet.bien.map((b) => (
          <li key={b.thu_tu} className="relative size-10">
            <img
              src={urlAnhBien(b.anh)}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="size-10"
            />
            <DauNho ket={b.ket} />
            <span className="sr-only">
              Biển {b.thu_tu}, {b.ten}: {MO_TA_KET[b.ket]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Bảng từng biển của đường chạy, trong "Xem chi tiết" của hộp kết quả (GĐ17c). */
export function KetQuaDuong({ chiTiet }: { chiTiet: ChiTietDuong }) {
  return (
    <section className="space-y-3" aria-label="Từng biển trên đường">
      {!chiTiet.hop_le ? (
        <p
          className="rounded-lg border border-line bg-surface p-3 text-[15px]"
          style={{ color: "var(--danger)" }}
        >
          {chiTiet.ly_do}
        </p>
      ) : null}
      <ol className="space-y-2">
        {chiTiet.bien.map((b) => (
          <li key={b.thu_tu} className="g-the flex items-start gap-3 p-3">
            <span className="relative shrink-0">
              <img
                src={urlAnhBien(b.anh)}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="size-12"
              />
              <DauNho ket={b.ket} />
            </span>
            <span className="min-w-0 flex-1 text-[15px]">
              <span className="block font-semibold">
                {b.thu_tu}. {b.ten}
              </span>
              <span className="block text-sm text-ink-2">
                {MO_TA_KET[b.ket]}
                {b.diem ? ` · +${b.diem}` : ""}
                {b.thuong ? ` · thưởng nhanh +${b.thuong.toLocaleString("vi-VN")}` : ""}
              </span>
              <span className="block text-sm">
                Cần: <strong>{TEN_THAO_TAC_BIEN_BAO[b.phan_ung]}</strong>
                {b.chon && b.chon !== b.phan_ung ? ` · Bạn chọn: ${TEN_THAO_TAC_BIEN_BAO[b.chon]}` : ""}
              </span>
              {b.ghi_chu ? <span className="mt-1 block text-sm text-ink-2">{b.ghi_chu}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
