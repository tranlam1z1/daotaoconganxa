/**
 * Một người lái trong trò "Kiểm tra giấy tờ" (docs/PLAN.md GĐ-T1, docs/GAME_DESIGN.md §5.1).
 *
 * Bàn kiểm tra: ngày kiểm tra, lời người lái, chiếc xe (biển số, nhãn hiệu chạm được), các giấy tờ
 * thu nhỏ (chạm để phóng to, chạm dòng để đánh dấu), rồi đóng dấu "Cho qua" hoặc "Giữ lại". Đóng dấu
 * là nộp: dấu đập xuống, giấy tờ trượt ra khỏi bàn, rồi mới gửi máy chủ chấm. Sau khi chấm, giấy tờ
 * trượt lại vào bàn để xem chỗ sai; danh sách lỗi có căn cứ và biên bản nằm trong "Xem chi tiết" của
 * hộp kết quả (`ChiTietRiengGiayTo`, GĐ17c).
 *
 * Trang chỉ hiển thị; đúng sai do máy chủ chấm (chi_tiet trong kết quả).
 */
import { useRef, useState } from "react";

import { cn } from "../../lib/cn";
import {
  type ChiTietGiayTo,
  type DauHieu,
  type DeGiayTo,
  type LoaiGiayTo,
  ngayVn,
  type QuyetDinh,
  TEN_DAU_HIEU,
  TEN_NGAN_GIAY_TO,
} from "../../lib/kiem-tra-giay-to";
import { BienBan } from "./chung/BienBan";
import { DanhSachLoi } from "./chung/DanhSachLoi";
import { GiayToThieu, type KetQuaChiTiet, PhongToGiayTo, TheGiayToNho } from "./chung/GiayTo";
import { DauMoc, NutDongDau } from "./chung/tuong-tac/DongDau";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";

export interface TraLoiGiayToWeb {
  quyet_dinh: QuyetDinh | null;
  dau_hieu: DauHieu[];
}

export const TRA_LOI_RONG_GIAY_TO: TraLoiGiayToWeb = { quyet_dinh: null, dau_hieu: [] };

/** Thời gian dấu đập và giấy tờ trượt ra trước khi gửi (giảm chuyển động: gửi ngay). */
const TRE_GUI_MS = 650;

function HinhXe({ moTo }: { moTo: boolean }) {
  return moTo ? (
    <svg viewBox="0 0 120 70" aria-hidden="true" className="h-12 w-20 shrink-0 text-ink">
      <circle cx="22" cy="52" r="13" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="98" cy="52" r="13" fill="none" stroke="currentColor" strokeWidth="5" />
      <path
        d="M22 52 L40 30 L84 30 L98 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <rect x="46" y="34" width="28" height="18" rx="4" fill="currentColor" />
      <path
        d="M84 30 L80 16 L92 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 120 70" aria-hidden="true" className="h-12 w-20 shrink-0 text-ink">
      <path
        d="M8 46 L14 30 L34 26 L48 12 L84 12 L100 28 L112 32 L112 46 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="50" r="10" fill="currentColor" />
      <circle cx="90" cy="50" r="10" fill="currentColor" />
    </svg>
  );
}

/** Kết quả từng chi tiết sau khi chấm: chỗ sai (mọi chi tiết chỉ ra được lỗi) và chỗ đánh dấu nhầm. */
function ketQuaTheoChiTiet(ct: ChiTietGiayTo | undefined): Map<DauHieu, KetQuaChiTiet> | undefined {
  if (!ct) return undefined;
  const m = new Map<DauHieu, KetQuaChiTiet>();
  for (const l of ct.loi) for (const d of l.dau_hieu) m.set(d, "loi");
  for (const d of ct.dau_hieu_sai) m.set(d.ma, "nham");
  return m;
}

function NutChiTiet({
  ma,
  children,
  daChon,
  ketQua,
  khoa,
  onCham,
  className,
}: {
  ma: DauHieu;
  children: React.ReactNode;
  daChon: boolean;
  ketQua?: KetQuaChiTiet;
  khoa: boolean;
  onCham: (d: DauHieu) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("gt-dong", className)}
      aria-pressed={khoa ? undefined : daChon}
      aria-label={`${TEN_DAU_HIEU[ma]}${daChon ? ", đã đánh dấu" : ""}${ketQua === "loi" ? ", chỗ sai" : ketQua === "nham" ? ", đánh dấu nhầm" : ""}`}
      data-ket-qua={ketQua}
      disabled={khoa}
      onClick={() => onCham(ma)}
    >
      {children}
    </button>
  );
}

export function KiemTraGiayTo({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DeGiayTo;
  traLoi: TraLoiGiayToWeb;
  datTraLoi: (t: TraLoiGiayToWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiGiayToWeb) => void;
}) {
  const [phongTo, datPhongTo] = useState<LoaiGiayTo | null>(null);
  const [daDong, datDaDong] = useState<QuyetDinh | null>(null);
  const daGui = useRef(false);
  const ct = daCham ? (chiTiet as ChiTietGiayTo | undefined) : undefined;
  const ketQua = ketQuaTheoChiTiet(ct);
  const chon = new Set(traLoi.dau_hieu);
  const khoa = daCham || daDong !== null;
  const dau = daDong ?? (daCham ? traLoi.quyet_dinh : null);
  const moTo = de.xe.phan_loai !== "o_to_con";

  const cham = (d: DauHieu) => {
    if (khoa) return;
    const moi = chon.has(d) ? traLoi.dau_hieu.filter((x) => x !== d) : [...traLoi.dau_hieu, d];
    datTraLoi({ ...traLoi, dau_hieu: moi });
  };

  const dongDau = (q: QuyetDinh) => {
    if (khoa || daGui.current) return;
    daGui.current = true;
    const t: TraLoiGiayToWeb = { quyet_dinh: q, dau_hieu: q === "giu_lai" ? traLoi.dau_hieu : [] };
    datDaDong(q);
    datTraLoi(t);
    phatAm("tich");
    setTimeout(() => gui?.(t), dangGiamChuyenDong() ? 0 : TRE_GUI_MS);
  };

  const giayTo = de.giay_to_kiem;
  const ra = daDong && !daCham ? (daDong === "cho_qua" ? "gt-ra-phai" : "gt-ra-duoi") : null;

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <span>
          Ngày kiểm tra: <strong className="text-ink">{ngayVn(de.ngay_kiem_tra)}</strong>
        </span>
        <span>Cần soi: {giayTo.map((g) => TEN_NGAN_GIAY_TO[g]).join(", ")}</span>
      </p>

      {/* Người lái và xe */}
      <div className="g-the rounded-2xl p-3">
        <NutChiTiet
          ma="nguoi_lai.loi_noi"
          daChon={chon.has("nguoi_lai.loi_noi")}
          ketQua={ketQua?.get("nguoi_lai.loi_noi")}
          khoa={khoa}
          onCham={cham}
          className="items-start"
        >
          <span className="text-[15px] leading-relaxed">
            <span className="block text-sm text-ink-2">Người lái nói</span>
            <q>{de.loi_noi}</q>
          </span>
        </NutChiTiet>
        <div className="mt-2 flex items-center gap-3 border-t pt-2" style={{ borderColor: "var(--line)" }}>
          <HinhXe moTo={moTo} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-2">{de.xe.ten_phan_loai}</p>
            <div className="mt-1 grid gap-1">
              <NutChiTiet
                ma="xe.bien_so"
                daChon={chon.has("xe.bien_so")}
                ketQua={ketQua?.get("xe.bien_so")}
                khoa={khoa}
                onCham={cham}
              >
                <span className="block">
                  <span className="block text-xs text-ink-2">Biển số</span>
                  <span
                    className="g-so whitespace-nowrap rounded border-2 px-1.5 text-base font-bold"
                    style={{ borderColor: "var(--ink)", background: "var(--surface)" }}
                  >
                    {de.xe.bien_so}
                  </span>
                </span>
              </NutChiTiet>
              <NutChiTiet
                ma="xe.nhan_hieu"
                daChon={chon.has("xe.nhan_hieu")}
                ketQua={ketQua?.get("xe.nhan_hieu")}
                khoa={khoa}
                onCham={cham}
              >
                <span className="block">
                  <span className="block text-xs text-ink-2">Nhãn hiệu</span>
                  <span className="text-[15px] font-semibold">{de.xe.nhan_hieu}</span>
                </span>
              </NutChiTiet>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              Màu {de.xe.mau.toLowerCase()}
              {de.xe.dung_tich ? ` · ${de.xe.dung_tich} cm³` : de.xe.so_cho ? ` · ${de.xe.so_cho} chỗ` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Bàn kiểm tra: giấy tờ trượt vào; đóng dấu thì trượt ra. */}
      <div className={cn("gt-ban relative", ra && "g-t gt-giat")}>
        <div key={daCham ? "xem" : "choi"} className={cn("grid gap-3", ra && `g-t ${ra}`)}>
          {giayTo.map((g, i) => {
            const du = de.giay_to[g];
            return (
              <div key={g} className="g-a gt-vao" style={{ "--tre": `${i * 90}ms` } as React.CSSProperties}>
                {du ? (
                  <TheGiayToNho
                    loai={g}
                    du={du}
                    daChon={chon}
                    ketQua={ketQua}
                    onPhongTo={() => datPhongTo(g)}
                  />
                ) : (
                  <GiayToThieu loai={g} daChon={chon} onCham={cham} ketQua={ketQua} khoa={khoa} />
                )}
              </div>
            );
          })}
        </div>
        {dau ? (
          <div
            className={cn(
              "pointer-events-none absolute",
              // Sau khi chấm, dấu thu về góc để không che chữ.
              daCham ? "-top-3 right-1 origin-top-right scale-75" : "inset-0 grid place-items-center",
            )}
          >
            <DauMoc chon={dau} hoatAnh={!daCham} />
          </div>
        ) : null}
      </div>

      {traLoi.dau_hieu.length && !daCham ? (
        <div>
          <p className="text-sm font-semibold">Đã đánh dấu ({traLoi.dau_hieu.length})</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {traLoi.dau_hieu.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  disabled={khoa}
                  onClick={() => cham(d)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm"
                  style={{
                    borderColor: "var(--danger)",
                    color: "var(--danger)",
                    background: "var(--danger-soft)",
                  }}
                  aria-label={`Bỏ đánh dấu: ${TEN_DAU_HIEU[d]}`}
                >
                  {TEN_DAU_HIEU[d]} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!daCham ? (
        <NutDongDau onChon={dongDau} choGiuLai={traLoi.dau_hieu.length > 0} khoa={khoa} />
      ) : ct ? (
        <p className="text-sm text-ink-2">Chạm vào giấy tờ để xem lại chỗ sai.</p>
      ) : null}

      {phongTo && de.giay_to[phongTo] ? (
        <PhongToGiayTo
          loai={phongTo}
          du={de.giay_to[phongTo]!}
          daChon={chon}
          onCham={cham}
          ketQua={ketQua}
          khoa={khoa}
          dong={() => datPhongTo(null)}
        />
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một người lái (GĐ17c): quyết định đúng, điểm, danh sách lỗi, biên bản. */
export function ChiTietRiengGiayTo({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietGiayTo;
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Đúng ra phải <strong>{ct.quyet_dinh_dung === "giu_lai" ? "giữ lại" : "cho qua"}</strong>. Quyết định:{" "}
        {ct.diem_quyet_dinh}/10 điểm · chỉ ra lỗi: {ct.diem_chi_ra.toLocaleString("vi-VN")}/10 điểm.
      </p>
      <DanhSachLoi
        loi={ct.loi.map((l) => ({
          ten: l.ten,
          moTa: l.mo_ta,
          daChiRa: ct.quyet_dinh === "giu_lai" ? l.da_chi_ra : null,
          giaiThich: l.giai_thich,
          canCu: l.can_cu ? [l.can_cu] : [],
        }))}
        nham={ct.dau_hieu_sai.map((d) => d.ten)}
      />
      <BienBan dong={ct.bien_ban} />
    </div>
  );
}
