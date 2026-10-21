/**
 * Một tình huống của trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4, docs/GAME_DESIGN.md §5.4).
 *
 * Người chơi làm từng thao tác bằng cử chỉ: vuốt lên (ra hiệu lệnh), chạm vị trí dừng, chạm lời
 * thoại, kéo từng giấy tờ vào khay "Đạt"/"Không đạt", giữ nút máy đo, kéo thẻ kết quả vào hướng xử lý.
 * Mỗi thao tác ghi vào nhật ký kèm mốc thời gian; máy trạng thái dùng chung (`dienBien`) chạy lại nhật
 * ký để hiện diễn biến ngay (người lái bức xúc, xe đỗ giữa làn…). Kéo thẻ kết quả là nộp; máy chủ chấm
 * lại cả nhật ký theo quy trình đã duyệt và trả bảng so sánh từng bước. Sau khi chấm, bảng chơi thu về
 * cảnh và dải từng bước; bảng so sánh, căn cứ, biên bản nằm trong "Xem chi tiết" (GĐ17c).
 *
 * Hình vẽ là SVG giản lược, không phù hiệu, cấp hiệu (docs/GAME_DESIGN.md §1.5). Chỉ động transform và
 * opacity; giảm chuyển động thì xe đổi chỗ không trượt.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { nhanVienDan } from "../../lib/citation";
import { cn } from "../../lib/cn";
import {
  type ChiTietDungXe,
  type DeDungXe,
  dienBien,
  HUONG_XU_LY,
  type KieuBuocDungXe,
  type SuKienDienBien,
  TEN_BUOC_DUNG_XE,
  TEN_HUONG_XU_LY,
  type ThaoTacDungXe,
  type TraLoiDungXe,
} from "../../lib/dung-xe";
import { type LoaiGiayTo, ngayVn, TEN_GIAY_TO } from "../../lib/kiem-tra-giay-to";
import { BienBan } from "./chung/BienBan";
import { DanhSachLoi } from "./chung/DanhSachLoi";
import { PhongToGiayTo } from "./chung/GiayTo";
import { Giu } from "./chung/tuong-tac/Giu";
import { lopVungTha, useKeoTha } from "./chung/tuong-tac/KeoTha";
import { Vuot } from "./chung/tuong-tac/Vuot";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong, useGiamChuyenDong } from "./hieu-ung/cai-dat";
import { rung } from "./hieu-ung/rung";

export const TRA_LOI_RONG_DUNG_XE: TraLoiDungXe = { nhat_ky: [], tong_ms: 0 };

const GIAY_TO: readonly LoaiGiayTo[] = ["gplx", "dang_ky", "bao_hiem"];
const TRE_GUI_MS = 500;
const CAN_CU_CHO = "Căn cứ đang được cập nhật";

const MAU_SU_KIEN: Record<SuKienDienBien["muc"], { mau: string; dau: string }> = {
  tot: { mau: "var(--ok)", dau: "✓" },
  xau: { mau: "var(--danger)", dau: "!" },
  nhac: { mau: "var(--ink-2, var(--muted))", dau: "›" },
};

function DongSuKien({ s }: { s: SuKienDienBien }) {
  const m = MAU_SU_KIEN[s.muc];
  return (
    <li className="flex gap-2 text-[15px] leading-snug">
      <span aria-hidden="true" className="w-4 shrink-0 text-center font-bold" style={{ color: m.mau }}>
        {m.dau}
      </span>
      <span>
        {s.muc === "xau" ? <span className="sr-only">Diễn biến xấu: </span> : null}
        {s.noi_dung}
      </span>
    </li>
  );
}

/** Cảnh bên đường: đường, xe, người cán bộ (bóng dáng). */
function Canh({ xeDung, moTo, viTriTen }: { xeDung: boolean; moTo: boolean; viTriTen: string | null }) {
  const giam = useGiamChuyenDong();
  return (
    <div className="g-the relative overflow-hidden rounded-2xl" aria-hidden="true">
      <svg viewBox="0 0 320 120" className="block h-auto w-full" aria-hidden="true">
        <rect x="0" y="0" width="320" height="120" fill="var(--surface-2, var(--muted-soft))" />
        <rect x="0" y="40" width="320" height="56" fill="var(--line-strong)" opacity="0.55" />
        <path d="M0 68 H320" stroke="var(--surface)" strokeWidth="3" strokeDasharray="16 12" />
        {/* Người cán bộ: bóng dáng, không phù hiệu */}
        <g transform="translate(262 18)" fill="var(--ink)">
          <circle cx="10" cy="6" r="6" />
          <rect x="3" y="13" width="14" height="22" rx="5" />
          <rect x="15" y="10" width="4" height="16" rx="2" transform="rotate(-30 17 18)" />
        </g>
      </svg>
      <div
        className={cn("g-t absolute top-[42%] left-0", !giam && "transition-transform duration-700")}
        style={{ transform: `translateX(${xeDung ? 190 : 12}px)` }}
      >
        <span
          className="block rounded-md px-2 py-1 text-sm font-bold"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          {moTo ? "🛵" : "🚗"}
        </span>
      </div>
      <p className="absolute bottom-1 left-2 text-xs font-semibold text-ink-2">
        {xeDung ? (viTriTen ? `Xe dừng: ${viTriTen}` : "Xe đã dừng") : "Xe đang tới"}
      </p>
    </div>
  );
}

function TiepTheo({ hien }: { hien: boolean }) {
  return hien ? (
    <span
      className="ml-2 inline-block rounded-full px-2 text-xs font-bold"
      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
    >
      ↓ Tiếp theo
    </span>
  ) : null;
}

/**
 * Bảng chơi sau khi chấm (GĐ17c): cảnh lúc kết thúc và dải từng bước của quy trình chuẩn, đánh dấu
 * đúng/chưa đúng. Chữ (so sánh, căn cứ, biên bản) ở `ChiTietRiengDungXe`.
 */
function TomTatDungXe({ ct, canh }: { ct: ChiTietDungXe; canh: React.ReactNode }) {
  const tinh = ct.so_sanh.filter((b) => b.ket !== "khong_ap_dung");
  return (
    <div className="space-y-3">
      {canh}
      <p className="text-[15px]">
        Quy trình: <strong>{tinh.filter((b) => b.ket === "dung").length}</strong>/{tinh.length} bước đúng
      </p>
      <ol aria-label="Các bước của quy trình chuẩn" className="flex flex-wrap gap-2">
        {ct.so_sanh.map((b) => {
          const mau =
            b.ket === "dung"
              ? "var(--ok)"
              : b.ket === "khong_ap_dung"
                ? "var(--line-strong)"
                : "var(--danger)";
          return (
            <li
              key={b.kieu}
              className="grid h-12 min-w-12 place-items-center rounded-xl border-2 px-2 text-base font-bold"
              style={{ borderColor: mau, color: mau }}
            >
              <span aria-hidden="true">
                {b.thu_tu} {b.ket === "dung" ? "✓" : b.ket === "khong_ap_dung" ? "–" : "✗"}
              </span>
              <span className="sr-only">
                Bước {b.thu_tu}, {b.tieu_de}:{" "}
                {b.ket === "dung" ? "đúng" : b.ket === "khong_ap_dung" ? "không áp dụng" : "chưa đúng"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Phần "Xem chi tiết" của một tình huống (GĐ17c): so sánh với quy trình chuẩn, điểm trừ, lỗi, biên bản. */
export function ChiTietRiengDungXe({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietDungXe;
  return (
    <div className="space-y-4">
      {!ct.hop_le ? (
        <p className="rounded-xl p-3 text-[15px]" style={{ background: "var(--danger-soft)" }}>
          Không chấm được tình huống: {ct.ly_do}
        </p>
      ) : null}
      <section className="g-the rounded-2xl p-4" aria-label="So với quy trình chuẩn">
        <h3 className="text-base font-semibold">So với quy trình chuẩn</h3>
        <ol className="mt-2 grid gap-3">
          {ct.so_sanh.map((b) => (
            <li
              key={b.kieu}
              className="border-l-4 pl-3"
              style={{
                borderColor:
                  b.ket === "dung"
                    ? "var(--ok)"
                    : b.ket === "khong_ap_dung"
                      ? "var(--line)"
                      : "var(--danger)",
              }}
            >
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[15px] font-semibold">
                  {b.thu_tu}. {b.tieu_de}
                </span>
                <span className="text-sm font-semibold">{b.diem.toLocaleString("vi-VN")} điểm</span>
              </p>
              <p className="text-sm text-ink-2">
                Bạn làm: {b.thu_tu_nguoi_choi ? `thứ ${b.thu_tu_nguoi_choi}` : "không làm"} · {b.ghi_chu}
              </p>
              <p className="text-sm text-ink-2">{b.mo_ta}</p>
              <p className="text-sm text-ink-2">Căn cứ: {b.can_cu ? nhanVienDan(b.can_cu) : CAN_CU_CHO}</p>
            </li>
          ))}
        </ol>
      </section>
      {ct.tru.length ? (
        <section className="g-the rounded-2xl p-4" aria-label="Bị trừ điểm">
          <h3 className="text-base font-semibold">Bị trừ điểm</h3>
          <ul className="mt-1 grid gap-1 text-[15px]">
            {ct.tru.map((t) => (
              <li key={t.ly_do}>
                −{t.diem}: {t.ly_do}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="g-the rounded-2xl p-4" aria-label="Diễn biến">
        <h3 className="text-base font-semibold">Diễn biến</h3>
        <ul className="mt-2 grid gap-1.5">
          {ct.su_kien.map((s) => (
            <DongSuKien key={`${s.ms}|${s.noi_dung}`} s={s} />
          ))}
        </ul>
      </section>
      <section className="g-the rounded-2xl p-4" aria-label="Giấy tờ">
        <h3 className="text-base font-semibold">Giấy tờ</h3>
        <ul className="mt-1 grid gap-1 text-[15px]">
          {ct.giay_to.map((g) => (
            <li key={g.loai}>
              {g.ten}: đúng ra <strong>{g.dung === "dat" ? "Đạt" : "Không đạt"}</strong>
              {g.nguoi_choi === g.dung
                ? " ✓"
                : g.nguoi_choi
                  ? ` (bạn xếp: ${g.nguoi_choi === "dat" ? "Đạt" : "Không đạt"}) ✗`
                  : " (bạn chưa xếp) ✗"}
            </li>
          ))}
        </ul>
      </section>
      <DanhSachLoi
        tieuDe="Lỗi giấy tờ"
        loi={ct.loi_giay_to.map((l) => ({
          ten: l.ten,
          moTa: l.mo_ta,
          daChiRa: null,
          giaiThich: l.giai_thich,
          canCu: l.can_cu ? [l.can_cu] : [],
        }))}
      />
      <p className="text-[15px]">
        Hướng xử lý đúng: <strong>{TEN_HUONG_XU_LY[ct.huong_xu_ly_dung]}</strong>
        {ct.huong_xu_ly ? ` · bạn chọn: ${TEN_HUONG_XU_LY[ct.huong_xu_ly]}` : " · bạn chưa quyết định"}.{" "}
        {ct.ly_do_xu_ly}
      </p>
      <BienBan dong={ct.bien_ban} />
      <p className="text-xs text-ink-2">
        Quy trình trong trò là bản demo chưa đối chiếu văn bản; căn cứ đang được cập nhật.
      </p>
    </div>
  );
}

export function DungXe({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeDungXe;
  traLoi: TraLoiDungXe;
  datTraLoi: (t: TraLoiDungXe) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiDungXe) => void;
}) {
  const t0 = useRef(performance.now());
  const giuTu = useRef<number | null>(null);
  const daGui = useRef(false);
  const [phongTo, datPhongTo] = useState<LoaiGiayTo | null>(null);
  const [bayGio, datBayGio] = useState(0);
  const ms = () => Math.round(performance.now() - t0.current);
  const s = useMemo(() => dienBien(de, traLoi.nhat_ky), [de, traLoi.nhat_ky]);
  const soSuKienTruoc = useRef(0);

  // Phản hồi khi có diễn biến mới: rung khi xấu, tiếng khi tốt (âm thanh mặc định tắt).
  useEffect(() => {
    const moi = s.su_kien.slice(soSuKienTruoc.current);
    soSuKienTruoc.current = s.su_kien.length;
    if (moi.some((x) => x.muc === "xau")) rung("sai");
    else if (moi.some((x) => x.muc === "tot")) phatAm("tich");
  }, [s.su_kien]);

  // Đồng hồ cho mỗi thao tác (màn 5).
  useEffect(() => {
    if (!de.gioi_han_thao_tac_ms || daCham || s.ket_thuc) return;
    const id = setInterval(() => datBayGio(Math.round(performance.now() - t0.current)), 500);
    return () => clearInterval(id);
  }, [de.gioi_han_thao_tac_ms, daCham, s.ket_thuc]);

  const khoa = daCham || s.ket_thuc;
  const ghi = (tt: ThaoTacDungXe) => {
    if (khoa) return null;
    const t: TraLoiDungXe = { nhat_ky: [...traLoi.nhat_ky, tt], tong_ms: tt.ms };
    datTraLoi(t);
    return t;
  };
  const nop = (t: TraLoiDungXe) => {
    if (daGui.current) return;
    daGui.current = true;
    const xong = { ...t, tong_ms: ms() };
    datTraLoi(xong);
    setTimeout(() => gui?.(xong), dangGiamChuyenDong() ? 0 : TRE_GUI_MS);
  };

  const keo = useKeoTha((vat, vung) => {
    if (vat.startsWith("giay_to:")) ghi({ ms: ms(), loai: "keo", muc_tieu: vat, dich: vung });
    else if (vat === "ket_qua") {
      const t = ghi({ ms: ms(), loai: "keo", muc_tieu: "ket_qua", dich: vung });
      if (t) nop(t);
    }
  });

  const ct = daCham ? (chiTiet as ChiTietDungXe | undefined) : undefined;
  const viTri = de.vi_tri.find((v) => v.ma === s.vi_tri) ?? null;
  const canh = (
    <Canh xeDung={s.xe_dung} moTo={de.xe.phan_loai !== "o_to_con"} viTriTen={viTri?.ten ?? null} />
  );
  if (ct) return <TomTatDungXe ct={ct} canh={canh} />;

  const daXong = new Set(s.hoan_thanh.map((h) => h.kieu));
  const tiepTheo: KieuBuocDungXe | null = de.goi_y_thu_tu?.find((k) => !daXong.has(k)) ?? null;
  const coViTri = de.vi_tri.length >= 2;
  const loiThoai = de.loi_thoai.filter(
    (l) =>
      (l.kieu === "tu_choi_de_nghi" && s.xin_bo_qua === "dang_xin") ||
      (l.kieu === "yeu_cau_chap_hanh_do" && s.tu_choi_thoi === "dang_tu_choi") ||
      l.kieu === "thong_bao_ly_do" ||
      l.kieu === "yeu_cau_xuat_trinh",
  );
  const truocMs = traLoi.nhat_ky.at(-1)?.ms ?? 0;
  const conGiay =
    de.gioi_han_thao_tac_ms && !khoa
      ? Math.max(0, Math.ceil((de.gioi_han_thao_tac_ms - (bayGio - truocMs)) / 1000))
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[15px] leading-relaxed">{de.mo_ta}</p>
        <p className="text-sm text-ink-2">
          {de.xe.ten_phan_loai} · biển số <span className="g-so font-semibold">{de.xe.bien_so}</span> · ngày{" "}
          {ngayVn(de.ngay_kiem_tra)}
        </p>
      </div>

      {canh}

      <div className="flex items-center justify-between text-sm">
        <span>
          Căng thẳng:{" "}
          <strong style={{ color: s.cang_thang ? "var(--danger)" : undefined }}>{s.cang_thang}/3</strong>
        </span>
        {conGiay !== null ? (
          <span role="timer" aria-live="off" className={cn("font-semibold", conGiay <= 5 && "text-danger")}>
            Còn {conGiay} giây cho thao tác này
          </span>
        ) : null}
      </div>

      {s.su_kien.length ? (
        <section aria-label="Diễn biến" aria-live="polite" className="g-the rounded-2xl p-3">
          <ul className="grid gap-1.5">
            {s.su_kien.slice(-3).map((x) => (
              <DongSuKien key={`${x.ms}|${x.noi_dung}`} s={x} />
            ))}
          </ul>
        </section>
      ) : null}

      {!s.xe_dung ? (
        <section aria-label="Ra hiệu lệnh">
          <h3 className="mb-1 text-sm font-semibold">
            Ra hiệu lệnh <TiepTheo hien={tiepTheo === "hieu_lenh_dung"} />
          </h3>
          <Vuot
            nhan="Vuốt lên để giơ tay ra hiệu lệnh dừng xe"
            goiY={
              <span className="text-3xl" aria-hidden="true">
                ↑
              </span>
            }
            huongChinh="len"
            nhanThayThe="Không vuốt được? Chạm để ra hiệu lệnh"
            noiBat={tiepTheo === "hieu_lenh_dung"}
            khoa={khoa}
            onVuot={(huong) => ghi({ ms: ms(), loai: "vuot", huong })}
          />
        </section>
      ) : null}

      {coViTri && s.xe_dung ? (
        <section aria-label="Vị trí dừng">
          <h3 className="mb-1 text-sm font-semibold">
            Chạm chỗ cho xe dừng <TiepTheo hien={tiepTheo === "vi_tri_dung"} />
          </h3>
          <div className="grid gap-2">
            {de.vi_tri.map((v) => (
              <button
                key={v.ma}
                type="button"
                disabled={khoa}
                aria-pressed={s.vi_tri === v.ma}
                onClick={() => ghi({ ms: ms(), loai: "cham", muc_tieu: `vi_tri:${v.ma}` })}
                className="g-nut min-h-12 rounded-xl border-2 p-2 text-left"
                style={{ borderColor: s.vi_tri === v.ma ? "var(--primary)" : "var(--line)" }}
              >
                <span className="block text-[15px] font-semibold">{v.ten}</span>
                <span className="block text-sm text-ink-2">{v.mo_ta}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="Lời thoại">
        <h3 className="mb-1 text-sm font-semibold">
          Chạm để nói <TiepTheo hien={!!tiepTheo && loiThoai.some((l) => l.kieu === tiepTheo)} />
        </h3>
        <div className="grid gap-2">
          {loiThoai.map((l) => {
            const da = daXong.has(l.kieu);
            const loi = l.kieu === "thong_bao_ly_do" ? l.loi.replace("…", ` ${de.ly_do_dung}.`) : l.loi;
            return (
              <button
                key={l.kieu}
                type="button"
                disabled={khoa}
                onClick={() => ghi({ ms: ms(), loai: "cham", muc_tieu: `loi:${l.kieu}` })}
                className="g-nut min-h-12 rounded-2xl rounded-bl-sm border-2 p-3 text-left text-[15px]"
                style={{
                  borderColor: tiepTheo === l.kieu ? "var(--primary)" : "var(--line)",
                  opacity: da ? 0.6 : 1,
                }}
              >
                <span className="block text-xs font-semibold text-ink-2">
                  {TEN_BUOC_DUNG_XE[l.kieu]}
                  {da ? " · đã nói" : ""}
                </span>
                “{loi}”
              </button>
            );
          })}
        </div>
      </section>

      {s.giay_to_da_giao ? (
        <section aria-label="Kiểm tra giấy tờ">
          <h3 className="mb-1 text-sm font-semibold">
            Kéo từng giấy tờ vào khay <TiepTheo hien={tiepTheo === "kiem_giay_to"} />
          </h3>
          <p className="mb-2 text-sm text-ink-2">
            Chạm "Xem" để phóng to. Kéo (hoặc chạm giấy rồi chạm khay).
          </p>
          <div className="grid gap-2">
            {GIAY_TO.map((g) => {
              const du = de.giay_to[g];
              const xep = s.xep_giay_to[g];
              return (
                <div key={g} className="flex items-center gap-2">
                  <button
                    {...keo.vat(`giay_to:${g}`, khoa)}
                    className={cn(
                      keo.vat(`giay_to:${g}`).className,
                      "g-the min-h-12 flex-1 rounded-xl border-2 p-2 text-left",
                    )}
                    style={{
                      ...keo.vat(`giay_to:${g}`).style,
                      borderColor: keo.chon === `giay_to:${g}` ? "var(--primary)" : "var(--line)",
                    }}
                    aria-label={`${TEN_GIAY_TO[g]}${du ? "" : ": không xuất trình"}${xep ? `, đã xếp vào ${xep === "dat" ? "Đạt" : "Không đạt"}` : ""}`}
                  >
                    <span className="block text-[15px] font-semibold">{TEN_GIAY_TO[g]}</span>
                    <span className="block text-sm text-ink-2">
                      {du ? "Chạm giữ để kéo" : "Người lái không xuất trình"}
                      {xep ? ` · ${xep === "dat" ? "Đạt" : "Không đạt"}` : ""}
                    </span>
                  </button>
                  {du ? (
                    <button
                      type="button"
                      onClick={() => datPhongTo(g)}
                      className="min-h-12 min-w-12 rounded-xl border px-3 text-sm"
                    >
                      Xem
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["dat", "khong_dat"] as const).map((v) => {
              const p = keo.vung(v, khoa);
              return (
                <button
                  key={v}
                  {...p}
                  className={lopVungTha(!!p["data-san-sang"])}
                  style={{
                    borderColor: v === "dat" ? "var(--ok)" : "var(--danger)",
                    color: v === "dat" ? "var(--ok)" : "var(--danger)",
                  }}
                >
                  Khay {v === "dat" ? "Đạt" : "Không đạt"}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {de.do_con && s.xe_dung ? (
        <section aria-label="Máy đo nồng độ cồn">
          <h3 className="mb-1 text-sm font-semibold">
            Máy đo nồng độ cồn <TiepTheo hien={tiepTheo === "do_nong_do_con"} />
          </h3>
          {s.ket_qua_do !== null ? (
            <p className="g-the rounded-xl p-3 text-lg font-bold">
              Kết quả: {s.ket_qua_do.toLocaleString("vi-VN")} {de.do_con.don_vi}
            </p>
          ) : (
            <Giu
              giuMs={de.do_con.giu_ms}
              nhan={`Giữ để đo (${Math.round(de.do_con.giu_ms / 1000)} giây)`}
              khoa={khoa}
              noiBat={tiepTheo === "do_nong_do_con"}
              onBatDau={() => {
                giuTu.current = ms();
              }}
              onTha={() => {
                const tu = giuTu.current;
                giuTu.current = null;
                if (tu !== null) ghi({ ms: ms(), loai: "giu", muc_tieu: "may_do", tu_ms: tu });
              }}
            />
          )}
        </section>
      ) : null}

      {s.xe_dung ? (
        <section aria-label="Hướng xử lý">
          <h3 className="mb-1 text-sm font-semibold">
            Kéo thẻ kết quả vào hướng xử lý <TiepTheo hien={tiepTheo === "xu_ly"} />
          </h3>
          <p className="mb-2 text-sm text-ink-2">Đây là thao tác cuối: kéo xong là kết thúc tình huống.</p>
          <button
            {...keo.vat("ket_qua", khoa)}
            className={cn(
              keo.vat("ket_qua").className,
              "g-nut min-h-12 w-full rounded-xl border-2 p-2 text-[15px] font-semibold",
            )}
            style={{
              ...keo.vat("ket_qua").style,
              borderColor: keo.chon === "ket_qua" ? "var(--primary)" : "var(--line-strong)",
            }}
          >
            📋 Kết quả kiểm tra
          </button>
          <div className="mt-2 grid gap-2">
            {HUONG_XU_LY.map((h) => {
              const p = keo.vung(h, khoa);
              return (
                <button
                  key={h}
                  {...p}
                  className={lopVungTha(!!p["data-san-sang"])}
                  style={{ borderColor: "var(--line-strong)" }}
                >
                  {TEN_HUONG_XU_LY[h]}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {!khoa && traLoi.nhat_ky.length ? (
        <button
          type="button"
          onClick={() => nop(traLoi)}
          className="min-h-12 w-full text-sm text-ink-2 underline underline-offset-4"
        >
          Dừng tình huống và nộp (các bước chưa làm tính là bỏ)
        </button>
      ) : null}

      {phongTo && de.giay_to[phongTo] ? (
        <PhongToGiayTo
          loai={phongTo}
          du={de.giay_to[phongTo]!}
          daChon={new Set()}
          onCham={() => {}}
          khoa
          dong={() => datPhongTo(null)}
        />
      ) : null}
    </div>
  );
}
