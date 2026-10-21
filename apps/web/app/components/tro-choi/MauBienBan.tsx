/**
 * Biểu mẫu biên bản rút gọn của trò "Lập biên bản" (docs/PLAN.md GĐ-G3, GAME_DESIGN §5.3): lời kể ở
 * trên, 4 ô ở dưới (hành vi, điều khoản, mức phạt tiền, hình thức bổ sung). Tình huống 2 hành vi có
 * 2 dòng cho ô 1–3.
 *
 * Sau khi chấm, ba hiệu ứng riêng (VISUAL_STYLE §3.4, đã duyệt 27/9/2026) nối tiếp nhau, không chặn
 * thao tác: chữ ký tự vẽ trên dòng "Người lập biên bản" → kết quả từng ô hiện lần lượt → con dấu
 * "ĐẠT" (đúng cả 4 ô) hoặc "CHƯA ĐẠT" đóng xuống. Nghĩa luôn có cả chữ, không chỉ nằm ở màu. Màn
 * xem lại (đã chấm từ lúc mở) hiện tĩnh. Đáp án của các ô chưa đúng nằm trong "Xem chi tiết" của hộp
 * kết quả (`DapAnBienBan`, GĐ17c).
 */
import { type CSSProperties, useEffect, useId, useRef } from "react";

import { cn } from "../../lib/cn";
import {
  type ChiTietBienBan,
  type DeBienBan,
  type DongTraLoi,
  dinhDangNghin,
  docSoTien,
  type TraLoiBienBan,
} from "../../lib/lap-bien-ban";
import { inputClass } from "../ui/Field";
import { ChonDieuKhoan } from "./ChonDieuKhoan";
import { ChonHanhVi } from "./ChonHanhVi";
import { phatAm } from "./hieu-ung/am-thanh";
import "./lap-bien-ban.css";

const DONG_RONG: DongTraLoi = { hanh_vi: null, dieu_khoan: null, tien: null };

/** Mốc thời gian của chuỗi hiệu ứng sau khi ký (ms). */
const TRE_O = [200, 280, 360, 440];
const TRE_DAU = 820;

const tien = (n: number) => `${n.toLocaleString("vi-VN")} đồng`;
const soDiem = (n: number) => n.toLocaleString("vi-VN");

/** Đủ để ký: mọi dòng có hành vi, điều khoản, số tiền. Ô bổ sung được để trống (không có). */
export function daChonBienBan(t: TraLoiBienBan): boolean {
  return (
    t.dong.length > 0 && t.dong.every((d) => d.hanh_vi !== null && d.dieu_khoan !== null && d.tien !== null)
  );
}

/**
 * Kết quả một ô: dấu tích/chéo, chữ "Đúng"/"Chưa đúng", điểm. Đáp án của ô sai nằm trong "Xem chi tiết"
 * của hộp kết quả (`DapAnBienBan`, GĐ17c, H7).
 */
function KetQuaO({
  diem,
  toiDa,
  tre,
  hoatAnh,
  ghiChu,
}: {
  diem: number;
  toiDa: number;
  tre: number;
  hoatAnh: boolean;
  ghiChu?: string;
}) {
  const dung = diem >= toiDa;
  const motPhan = !dung && diem > 0;
  return (
    <div
      role="status"
      className={cn("mt-2 flex items-start gap-2 text-[15px]", hoatAnh && "g-a g-bat")}
      style={{ "--tre": `${tre}ms` } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
        style={{
          background: dung ? "var(--ok)" : motPhan ? "var(--warn)" : "var(--danger)",
          color: "var(--surface)",
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          {dung ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7 7 17" />}
        </svg>
      </span>
      <p className="min-w-0 leading-snug">
        <span className={cn("font-semibold", dung ? "text-ok" : motPhan ? "text-warn" : "text-danger")}>
          {dung ? "Đúng" : motPhan ? "Đúng một phần" : "Chưa đúng"}
        </span>
        <span className="g-so text-ink-3">
          {" "}
          · {soDiem(diem)}/{toiDa}
        </span>
        {ghiChu ? <span className="block text-ink-2">{ghiChu}</span> : null}
      </p>
    </div>
  );
}

/** Phần "Xem chi tiết" (GĐ17c): đáp án của từng ô chưa đúng, theo thứ tự ô trên biểu mẫu. */
export function DapAnBienBan({ de, chiTiet }: { de: DeBienBan; chiTiet: unknown }) {
  const ct = chiTiet as ChiTietBienBan;
  const muc: { o: string; dapAn: string }[] = [];
  ct.dong.forEach((c, i) => {
    const da = ct.dap_an.dong[c.dap_an];
    if (!da) return;
    const nhan = de.so_dong > 1 ? ` (hành vi ${i + 1})` : "";
    if (!c.hanh_vi) muc.push({ o: `1. Hành vi vi phạm${nhan}`, dapAn: da.hanh_vi_text });
    if (!c.dieu_khoan) muc.push({ o: `2. Điều khoản áp dụng${nhan}`, dapAn: da.dieu_khoan_text });
    if (!c.tien)
      muc.push({
        o: `3. Mức phạt tiền${nhan}`,
        dapAn: `trong khung ${tien(da.tien_tu)} đến ${tien(da.tien_den)}`,
      });
  });
  if (ct.diem_o.bo_sung < 25 && !ct.dap_an.bo_sung.length)
    muc.push({ o: "4. Hình thức xử phạt bổ sung", dapAn: "không có mục nào" });
  if (!muc.length) return null;
  return (
    <section className="g-the p-3" aria-label="Đáp án các ô chưa đúng">
      <h3 className="text-base font-semibold">Đáp án các ô chưa đúng</h3>
      <ul className="mt-2 grid gap-2 text-[15px]">
        {muc.map((m) => (
          <li key={m.o}>
            <span className="block font-semibold">{m.o}</span>
            <span className="block text-ink-2">Đáp án: {m.dapAn}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Hình minh họa; chưa có ảnh thì vẽ ô giữ chỗ theo loại xe (danh sách ảnh cần bổ sung: GAME_DESIGN §5.3). */
function HinhTinhHuong({ de }: { de: DeBienBan }) {
  if (de.hinh) {
    return <img src={de.hinh} alt="" className="h-28 w-full rounded-xl object-cover" loading="lazy" />;
  }
  return (
    <div className="flex h-20 items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface-2 px-3">
      <svg
        viewBox="0 0 120 70"
        aria-hidden="true"
        className="h-12 w-20 shrink-0 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        {de.loai_xe === "o_to" ? (
          <>
            <path d="M8 48V36l14-4 14-14h40l18 14 16 4v12H8Z" />
            <circle cx="32" cy="50" r="9" fill="var(--surface-2)" />
            <circle cx="90" cy="50" r="9" fill="var(--surface-2)" />
          </>
        ) : (
          <>
            <circle cx="24" cy="48" r="13" />
            <circle cx="96" cy="48" r="13" />
            <path d="M24 48 50 28h24l22 20M50 28l-6-10h-12M74 28l8-12h12" />
          </>
        )}
      </svg>
      <p className="text-sm text-ink-3">{de.ten_loai_xe}. Hình minh họa đang bổ sung.</p>
    </div>
  );
}

export function MauBienBan({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
}: {
  de: DeBienBan;
  traLoi: TraLoiBienBan;
  datTraLoi: (t: TraLoiBienBan) => void;
  chiTiet?: unknown;
  daCham: boolean;
}) {
  const id = useId();
  // Đã chấm ngay từ lúc mở (màn xem lại): hiện tĩnh, không chạy chuỗi hiệu ứng.
  const hoatAnh = !useRef(daCham).current;
  const ct = daCham ? ((chiTiet as ChiTietBienBan | null | undefined) ?? null) : null;
  const dat = ct
    ? ct.diem_o.hanh_vi + ct.diem_o.dieu_khoan + ct.diem_o.tien + ct.diem_o.bo_sung >= 100
    : false;

  // Tiếng tích nhỏ khi con dấu chạm giấy; am-thanh tự bỏ qua khi người chơi chưa bật âm thanh.
  useEffect(() => {
    if (!ct || !hoatAnh) return;
    const t = setTimeout(() => phatAm("tich"), TRE_DAU + 200);
    return () => clearTimeout(t);
  }, [ct, hoatAnh]);

  const dong = Array.from({ length: de.so_dong }, (_, i) => traLoi.dong[i] ?? DONG_RONG);
  const datDong = (i: number, sua: Partial<DongTraLoi>) =>
    datTraLoi({ ...traLoi, dong: dong.map((d, j) => (j === i ? { ...d, ...sua } : d)) });
  const boSung = new Set(traLoi.bo_sung);
  const khoa = daCham;

  return (
    <div className="space-y-4">
      <section aria-labelledby={`${id}-ke`} className="g-the p-4">
        <h2 id={`${id}-ke`} className="g-tieu-de text-sm font-semibold uppercase tracking-wide text-ink-3">
          Tình huống
        </h2>
        <p className="mt-2 text-[17px] leading-relaxed">{de.loi_ke}</p>
        <div className="mt-3">
          <HinhTinhHuong de={de} />
        </div>
      </section>

      <section aria-labelledby={`${id}-bb`} className="g-the relative p-4">
        <h2 id={`${id}-bb`} className="g-tieu-de text-center text-base font-bold uppercase tracking-wide">
          Biên bản vi phạm hành chính
        </h2>
        <p className="text-center text-sm text-ink-3">Bản rút gọn để luyện tập · {de.ten_loai_xe}</p>

        {dong.map((d, i) => {
          const c = ct?.dong[i];
          const da = c ? ct!.dap_an.dong[c.dap_an] : null;
          const nhanDong = de.so_dong > 1 ? ` (hành vi ${i + 1})` : "";
          const phan = ct ? 25 / de.so_dong : 25;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: số dòng cố định theo đề (1 hoặc 2), không đổi thứ tự
            <div key={i} className={cn("mt-4", de.so_dong > 1 && "rounded-xl border border-line p-3")}>
              {de.so_dong > 1 ? <p className="text-sm font-semibold text-ink-2">Hành vi {i + 1}</p> : null}

              <div className="lbb-o pb-3">
                <p className="text-[17px] font-medium">1. Hành vi vi phạm{nhanDong}</p>
                <div className="mt-2">
                  <ChonHanhVi
                    luaChon={de.lua_chon_hanh_vi}
                    chon={d.hanh_vi}
                    datChon={(v) => datDong(i, { hanh_vi: v })}
                    khoa={khoa}
                    nhan={`Hành vi vi phạm${nhanDong}`}
                  />
                </div>
                {c && da ? (
                  <KetQuaO diem={c.hanh_vi ? phan : 0} toiDa={phan} tre={TRE_O[0]!} hoatAnh={hoatAnh} />
                ) : null}
              </div>

              <div className="lbb-o py-3">
                <p className="text-[17px] font-medium">2. Điều khoản áp dụng{nhanDong}</p>
                <div className="mt-2">
                  <ChonDieuKhoan
                    cay={de.dieu_khoan}
                    chon={d.dieu_khoan}
                    datChon={(v) => datDong(i, { dieu_khoan: v })}
                    khoa={khoa}
                    nhan={`Điều khoản áp dụng${nhanDong}`}
                  />
                </div>
                {c && da ? (
                  <KetQuaO diem={c.dieu_khoan ? phan : 0} toiDa={phan} tre={TRE_O[1]!} hoatAnh={hoatAnh} />
                ) : null}
              </div>

              <div className={cn("py-3", de.so_dong > 1 ? "" : "lbb-o")}>
                <label htmlFor={`${id}-tien-${i}`} className="block text-[17px] font-medium">
                  3. Mức phạt tiền{nhanDong}
                </label>
                <div className="relative mt-2">
                  <input
                    id={`${id}-tien-${i}`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ví dụ 500.000"
                    className={cn(inputClass, "g-so min-h-12 pr-16 text-lg")}
                    value={dinhDangNghin(d.tien)}
                    disabled={khoa}
                    onChange={(e) => datDong(i, { tien: docSoTien(e.target.value) })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base text-ink-3">
                    đồng
                  </span>
                </div>
                {c && da ? (
                  <KetQuaO
                    diem={c.tien ? phan : 0}
                    toiDa={phan}
                    ghiChu={c.tien ? `Trong khung ${tien(da.tien_tu)} đến ${tien(da.tien_den)}.` : undefined}
                    tre={TRE_O[2]!}
                    hoatAnh={hoatAnh}
                  />
                ) : null}
              </div>
            </div>
          );
        })}

        <fieldset className="mt-4 py-1">
          <legend className="text-[17px] font-medium">
            4. Hình thức xử phạt bổ sung, trừ điểm giấy phép lái xe
          </legend>
          <p className="mt-1 text-sm text-ink-2">Đánh dấu mọi mục áp dụng. Không có mục nào thì để trống.</p>
          <div className="mt-2 grid gap-2">
            {de.lua_chon_bo_sung.map((o) => {
              const chon = boSung.has(o.id);
              const canChon = ct?.dap_an.bo_sung.includes(o.id) ?? false;
              const thua = ct?.bo_sung_thua.includes(o.id) ?? false;
              const thieu = ct?.bo_sung_thieu.includes(o.id) ?? false;
              return (
                <label
                  key={o.id}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-[15px]",
                    chon ? "border-primary bg-primary-soft font-semibold" : "border-line-strong bg-surface",
                    ct && canChon && chon && "border-ok bg-ok-soft",
                    thua && "border-danger bg-danger-soft",
                    thieu && "border-ok border-dashed",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[var(--primary)]"
                    checked={chon}
                    disabled={khoa}
                    onChange={(e) => {
                      const s = new Set(boSung);
                      if (e.target.checked) s.add(o.id);
                      else s.delete(o.id);
                      datTraLoi({
                        ...traLoi,
                        dong,
                        bo_sung: de.lua_chon_bo_sung.map((x) => x.id).filter((x) => s.has(x)),
                      });
                    }}
                  />
                  <span className="min-w-0 flex-1">{o.text}</span>
                  {thua ? <span className="shrink-0 text-sm font-semibold text-danger">Thừa</span> : null}
                  {thieu ? <span className="shrink-0 text-sm font-semibold text-ok">Cần chọn</span> : null}
                </label>
              );
            })}
          </div>
          {ct ? (
            <KetQuaO
              diem={ct.diem_o.bo_sung}
              toiDa={25}
              ghiChu={
                ct.bo_sung_thieu.length
                  ? `Còn thiếu ${ct.bo_sung_thieu.length} mục (đánh dấu "Cần chọn").`
                  : ct.bo_sung_thua.length === 1
                    ? "Đủ nhưng thừa một mục: được một nửa số điểm."
                    : ct.bo_sung_thua.length > 1
                      ? `Thừa ${ct.bo_sung_thua.length} mục.`
                      : undefined
              }
              tre={TRE_O[3]!}
              hoatAnh={hoatAnh}
            />
          ) : null}
        </fieldset>

        {/* Chữ ký và con dấu. */}
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-3">Người lập biên bản</p>
            <div className="mt-1 h-12 w-full max-w-40 border-b border-line-strong">
              {ct ? (
                <svg
                  viewBox="0 0 160 48"
                  aria-hidden="true"
                  className="h-12 w-full text-ink"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    pathLength={100}
                    className={cn(hoatAnh && "g-t g-ve-net")}
                    style={{ "--g-dai-net": 100 } as CSSProperties}
                    d="M8 34c6-14 12-22 16-20s-6 22-2 22 10-18 16-18-4 16 2 16 10-12 14-12 0 10 6 10 12-14 20-14 4 12 12 12 14-8 22-10 16-2 26-6"
                  />
                </svg>
              ) : (
                <p className="pt-5 text-sm text-ink-3">Ký khi chốt đáp án</p>
              )}
            </div>
            {ct ? <p className="sr-only">Đã ký biên bản.</p> : null}
          </div>
          {ct ? (
            <div
              className={cn(
                "lbb-dau relative shrink-0 px-3 py-1.5 text-center",
                hoatAnh && "g-a lbb-dong-dau",
              )}
              style={{ color: dat ? "var(--ok)" : "var(--danger)", "--tre": `${TRE_DAU}ms` } as CSSProperties}
              role="status"
            >
              {hoatAnh ? (
                <span
                  aria-hidden="true"
                  className="g-t g-loe g-an-khi-giam pointer-events-none absolute -inset-1.5 rounded-xl border-2"
                  // .g-loe không tự đọc --tre, nên đặt độ trễ thẳng ở đây.
                  style={{ borderColor: "currentColor", animationDelay: `${TRE_DAU + 200}ms` }}
                />
              ) : null}
              <span className="block text-lg font-bold leading-tight">{dat ? "ĐẠT" : "CHƯA ĐẠT"}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
