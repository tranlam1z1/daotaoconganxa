/**
 * Thẻ giấy tờ (mô-đun M1, docs/GAME_DESIGN.md §4): giấy phép lái xe, giấy đăng ký xe, giấy bảo hiểm
 * bắt buộc. Trên bàn là thẻ thu nhỏ; chạm để phóng to và soi từng dòng. Khi đang chơi, mỗi dòng là
 * một nút bật tắt "đánh dấu chi tiết sai" (aria-pressed). Sau khi chấm, dòng có lỗi viền đỏ, dòng
 * đánh dấu nhầm viền vàng đứt nét, luôn kèm chữ.
 *
 * Hình giản lược có chữ chìm "MẪU TRÒ CHƠI", không theo mẫu phôi thật (docs/GAME_DESIGN.md §1.5).
 * Ảnh chân dung là hình khối chung. Danh sách hình cần bổ sung ở GAME_DESIGN §5.1.
 */
import "./giay-to.css";

import { useEffect, useRef } from "react";

import { cn } from "../../../lib/cn";
import {
  type DauHieu,
  type DeGiayTo,
  type LoaiGiayTo,
  ngayVn,
  TEN_DAU_HIEU,
  TEN_GIAY_TO,
} from "../../../lib/kiem-tra-giay-to";

type GiayToDe = NonNullable<DeGiayTo["giay_to"][LoaiGiayTo]>;
/** Kết quả của một chi tiết sau khi chấm: là chỗ sai, hoặc người chơi đánh dấu nhầm. */
export type KetQuaChiTiet = "loi" | "nham";

export interface DongGiayTo {
  ma: DauHieu;
  nhan: string;
  giaTri: string;
}

/** Các dòng của một giấy tờ, theo thứ tự hiển thị. */
export function dongCuaGiayTo(loai: LoaiGiayTo, du: GiayToDe): DongGiayTo[] {
  if (loai === "gplx") {
    const g = du as NonNullable<DeGiayTo["giay_to"]["gplx"]>;
    return [
      { ma: "gplx.so", nhan: "Số", giaTri: g.so },
      { ma: "gplx.ho_ten", nhan: "Họ và tên", giaTri: g.ho_ten },
      { ma: "gplx.ngay_sinh", nhan: "Ngày sinh", giaTri: ngayVn(g.ngay_sinh) },
      { ma: "gplx.hang", nhan: "Hạng", giaTri: g.hang.join(", ") },
      {
        ma: "gplx.co_gia_tri_den",
        nhan: "Có giá trị đến",
        giaTri: g.co_gia_tri_den ? ngayVn(g.co_gia_tri_den) : "Không thời hạn",
      },
    ];
  }
  if (loai === "dang_ky") {
    const d = du as NonNullable<DeGiayTo["giay_to"]["dang_ky"]>;
    return [
      { ma: "dang_ky.so", nhan: "Số đăng ký", giaTri: d.so },
      { ma: "dang_ky.chu_xe", nhan: "Chủ xe", giaTri: d.chu_xe },
      { ma: "dang_ky.bien_so", nhan: "Biển số", giaTri: d.bien_so },
      { ma: "dang_ky.nhan_hieu", nhan: "Nhãn hiệu", giaTri: d.nhan_hieu },
      { ma: "dang_ky.mau", nhan: "Màu sơn", giaTri: d.mau },
      d.dung_tich
        ? { ma: "dang_ky.dung_tich", nhan: "Dung tích xi-lanh", giaTri: `${d.dung_tich} cm³` }
        : { ma: "dang_ky.dung_tich", nhan: "Số chỗ ngồi", giaTri: String(d.so_cho ?? "") },
    ];
  }
  const b = du as NonNullable<DeGiayTo["giay_to"]["bao_hiem"]>;
  return [
    { ma: "bao_hiem.so", nhan: "Số giấy chứng nhận", giaTri: b.so },
    { ma: "bao_hiem.chu_xe", nhan: "Chủ xe", giaTri: b.chu_xe },
    { ma: "bao_hiem.bien_so", nhan: "Biển số", giaTri: b.bien_so },
    {
      ma: "bao_hiem.thoi_han",
      nhan: "Thời hạn bảo hiểm",
      giaTri: `Từ ${ngayVn(b.tu_ngay)} đến ${ngayVn(b.den_ngay)}`,
    },
  ];
}

/** Hai dòng chính hiện trên thẻ thu nhỏ. */
const DONG_CHINH: Record<LoaiGiayTo, readonly DauHieu[]> = {
  gplx: ["gplx.ho_ten", "gplx.hang"],
  dang_ky: ["dang_ky.bien_so", "dang_ky.nhan_hieu"],
  bao_hiem: ["bao_hiem.bien_so", "bao_hiem.thoi_han"],
};

const NHAN_KET_QUA: Record<KetQuaChiTiet, string> = { loi: "Chỗ sai", nham: "Đánh dấu nhầm" };

function AnhChanDung() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 50"
      className="h-16 w-12 shrink-0 rounded-md"
      style={{ background: "var(--surface-2)" }}
    >
      <circle cx="20" cy="18" r="8" fill="var(--ink-3)" opacity="0.55" />
      <path d="M6 48c1-10 7-15 14-15s13 5 14 15Z" fill="var(--ink-3)" opacity="0.55" />
    </svg>
  );
}

/** Thẻ thu nhỏ trên bàn: chạm để phóng to. Đếm số chi tiết đã đánh dấu trên thẻ. */
export function TheGiayToNho({
  loai,
  du,
  daChon,
  ketQua,
  onPhongTo,
}: {
  loai: LoaiGiayTo;
  du: GiayToDe;
  daChon: ReadonlySet<DauHieu>;
  ketQua?: ReadonlyMap<DauHieu, KetQuaChiTiet>;
  onPhongTo: () => void;
}) {
  const dong = dongCuaGiayTo(loai, du);
  const soDanhDau = dong.filter((d) => daChon.has(d.ma)).length;
  const soLoi = ketQua ? dong.filter((d) => ketQua.get(d.ma) === "loi").length : 0;
  return (
    <button
      type="button"
      onClick={onPhongTo}
      data-loai={loai}
      className="gt-the block w-full text-left"
      aria-label={`${TEN_GIAY_TO[loai]}. Chạm để phóng to và soi chi tiết.`}
    >
      <span className="gt-dai flex items-center justify-between gap-2 px-3 py-1.5 text-sm font-semibold">
        <span className="truncate">{TEN_GIAY_TO[loai]}</span>
        {soDanhDau ? (
          <span className="shrink-0 rounded-full bg-black/20 px-2 text-xs">{soDanhDau} đánh dấu</span>
        ) : null}
        {soLoi ? (
          <span className="shrink-0 rounded-full bg-black/20 px-2 text-xs">{soLoi} chỗ sai</span>
        ) : null}
      </span>
      <span className="relative flex items-center gap-3 px-3 py-2">
        {loai === "gplx" ? <AnhChanDung /> : null}
        <span className="min-w-0 flex-1 text-[15px] leading-snug">
          {dong
            .filter((d) => DONG_CHINH[loai].includes(d.ma))
            .map((d) => (
              <span key={d.ma} className="block truncate">
                <span className="text-ink-2">{d.nhan}: </span>
                <span className="font-semibold">{d.giaTri}</span>
              </span>
            ))}
          <span className="mt-0.5 block text-sm text-primary">Chạm để soi</span>
        </span>
        <span className="gt-chim" aria-hidden="true">
          MẪU TRÒ CHƠI
        </span>
      </span>
    </button>
  );
}

/** Giấy tờ người lái không xuất trình: khung đứt nét, có nút đánh dấu "không có giấy này". */
export function GiayToThieu({
  loai,
  daChon,
  onCham,
  ketQua,
  khoa,
}: {
  loai: LoaiGiayTo;
  daChon: ReadonlySet<DauHieu>;
  onCham: (d: DauHieu) => void;
  ketQua?: ReadonlyMap<DauHieu, KetQuaChiTiet>;
  khoa: boolean;
}) {
  const ma = `thieu.${loai}` as DauHieu;
  const kq = ketQua?.get(ma);
  return (
    <div className="rounded-[14px] border-2 border-dashed p-3" style={{ borderColor: "var(--line-strong)" }}>
      <p className="text-[15px]">
        Người lái <strong>không xuất trình</strong> {TEN_GIAY_TO[loai].toLowerCase()}.
      </p>
      <button
        type="button"
        disabled={khoa}
        aria-pressed={daChon.has(ma)}
        data-ket-qua={kq}
        onClick={() => onCham(ma)}
        className="gt-dong mt-2 justify-center font-semibold"
      >
        {daChon.has(ma) ? "Đã đánh dấu: không có giấy này" : "Đánh dấu: không có giấy này"}
        {kq ? <span className="text-sm">({NHAN_KET_QUA[kq]})</span> : null}
      </button>
    </div>
  );
}

/**
 * Giấy tờ phóng to để soi: mọi dòng, mỗi dòng chạm để đánh dấu hoặc bỏ đánh dấu. `khoa` khi đã chấm
 * (chỉ xem). Đóng bằng nút "Xong", phím Esc, hoặc chạm ra ngoài.
 */
export function PhongToGiayTo({
  loai,
  du,
  daChon,
  onCham,
  ketQua,
  khoa,
  dong,
}: {
  loai: LoaiGiayTo;
  du: GiayToDe;
  daChon: ReadonlySet<DauHieu>;
  onCham: (d: DauHieu) => void;
  ketQua?: ReadonlyMap<DauHieu, KetQuaChiTiet>;
  khoa: boolean;
  dong: () => void;
}) {
  const nutXong = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nutXong.current?.focus();
    const phim = (e: KeyboardEvent) => e.key === "Escape" && dong();
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  }, [dong]);
  const idTieuDe = `phong-to-${loai}`;
  return (
    // Hộp giữa màn hình (theo .hop-thoai trong app.css): lề 16px, rộng tối đa 400px, cao tối đa 85%
    // màn hình; giấy tờ dài thì cuộn bên trong, nút "Xong" luôn hiện.
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      {/* Nền mờ bấm được để đóng; bàn phím dùng Esc hoặc nút "Xong". */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="nen-hien-dan absolute inset-0 bg-black/50"
        onClick={dong}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTieuDe}
        className="g-a hop-vao relative flex max-h-[85dvh] w-full max-w-[25rem] flex-col"
      >
        <div data-loai={loai} className="gt-the min-h-0 overflow-y-auto overscroll-contain">
          <h2 id={idTieuDe} className="gt-dai px-4 py-2.5 text-base font-semibold">
            {TEN_GIAY_TO[loai]}
          </h2>
          <div className="relative px-2 py-3">
            {loai === "gplx" ? (
              <div className="mb-1 flex justify-end px-2">
                <AnhChanDung />
              </div>
            ) : null}
            {!khoa ? (
              <p className="px-2 pb-1 text-sm text-ink-2">
                Chạm vào dòng sai để đánh dấu; chạm lần nữa để bỏ.
              </p>
            ) : null}
            <ul className="grid gap-1">
              {dongCuaGiayTo(loai, du).map((d) => {
                const kq = ketQua?.get(d.ma);
                const chon = daChon.has(d.ma);
                return (
                  <li key={d.ma}>
                    <button
                      type="button"
                      className="gt-dong"
                      aria-pressed={khoa ? undefined : chon}
                      aria-label={`${TEN_DAU_HIEU[d.ma]}: ${d.giaTri}${chon ? ", đã đánh dấu" : ""}${kq ? `, ${NHAN_KET_QUA[kq]}` : ""}`}
                      data-ket-qua={kq}
                      disabled={khoa}
                      onClick={() => onCham(d.ma)}
                    >
                      <span className="text-sm text-ink-2">{d.nhan}</span>
                      <span className="text-right text-base font-semibold">
                        {d.giaTri}
                        {kq ? <span className="block text-xs font-semibold">{NHAN_KET_QUA[kq]}</span> : null}
                        {!kq && chon ? (
                          <span className="block text-xs font-semibold text-danger">Đã đánh dấu</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <span className="gt-chim" aria-hidden="true">
              MẪU TRÒ CHƠI
            </span>
          </div>
        </div>
        <button
          ref={nutXong}
          type="button"
          onClick={dong}
          className={cn("g-nut mt-3 min-h-12 w-full shrink-0 rounded-xl text-base font-semibold")}
          style={{ background: "var(--surface)", color: "var(--ink)" }}
        >
          Xong
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ giấy tờ dùng chung (GĐ-T12): phiếu cân, giấy kiểm định, giấy phép */
/* ------------------------------------------------------------------ */

/** Một dòng của thẻ dùng chung. `ma` có thì dòng chạm được; không có là dòng chỉ đọc. */
export interface DongTheChung {
  ma?: string;
  nhan: string;
  giaTri: string;
}

const MAU_THE_CHUNG = {
  do: ["var(--gt-gplx)", "var(--gt-gplx-nen)"],
  xanh: ["var(--gt-dang-ky)", "var(--gt-dang-ky-nen)"],
  vang: ["var(--gt-bao-hiem)", "var(--gt-bao-hiem-nen)"],
} as const;

/**
 * Thẻ giấy tờ dùng chung cho các trò dùng giấy tờ khác giấy tờ người lái (GĐ-T12 trở đi): dải màu có
 * tên giấy, các dòng nhãn và giá trị, chữ chìm "MẪU TRÒ CHƠI". Dòng có `ma` là nút chạm được, trạng
 * thái do trò quyết định (`dangChon`: đang chọn; `ketQua`: tô sau khi chấm).
 */
export function TheGiayToChung({
  tieuDe,
  mau,
  dong,
  dangChon,
  ketQua,
  khoa,
  onCham,
  nhanCham,
  kieuChon = "danh_dau",
}: {
  tieuDe: string;
  mau: keyof typeof MAU_THE_CHUNG;
  dong: readonly DongTheChung[];
  dangChon?: ReadonlySet<string>;
  ketQua?: ReadonlyMap<string, KetQuaChiTiet>;
  khoa?: boolean;
  onCham?: (ma: string) => void;
  /** Phần đuôi nhãn đọc được của dòng chạm được, ví dụ "chạm để ghim". */
  nhanCham?: string;
  /** "danh_dau": dòng đang chọn tô như chỗ sai (trò 1); "ghim": tô màu chính (chọn số để so). */
  kieuChon?: "danh_dau" | "ghim";
}) {
  const [chinh, nen] = MAU_THE_CHUNG[mau];
  return (
    <section
      className="gt-the"
      data-kieu-chon={kieuChon}
      aria-label={tieuDe}
      style={{ "--gt-mau": chinh, "--gt-nen": nen } as React.CSSProperties}
    >
      <h3 className="gt-dai px-3 py-1.5 text-sm font-semibold">{tieuDe}</h3>
      <div className="relative grid gap-0.5 p-1.5">
        {dong.map((d) =>
          d.ma && onCham ? (
            <button
              key={d.ma}
              type="button"
              className="gt-dong"
              disabled={khoa}
              aria-pressed={khoa ? undefined : Boolean(dangChon?.has(d.ma))}
              data-ket-qua={ketQua?.get(d.ma)}
              aria-label={`${d.nhan}: ${d.giaTri}${nhanCham ? `. ${nhanCham}` : ""}`}
              onClick={() => onCham(d.ma!)}
            >
              <span className="text-sm text-ink-2">{d.nhan}</span>
              <span className="g-so text-right text-base font-semibold">{d.giaTri}</span>
            </button>
          ) : (
            <p key={d.nhan} className="gt-dong">
              <span className="text-sm text-ink-2">{d.nhan}</span>
              <span className="text-right text-[15px]">{d.giaTri}</span>
            </p>
          ),
        )}
        <span className="gt-chim" aria-hidden="true">
          MẪU TRÒ CHƠI
        </span>
      </div>
    </section>
  );
}
