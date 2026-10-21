/**
 * Sơ đồ khoang xe nhìn từ trên (trò "Lên xe khách", docs/PLAN.md GĐ-T13): lưới ghế hoặc giường, lối đi,
 * sàn; mỗi phần tử (người lớn, trẻ em, hành lý, áo treo, túi) là một nút chạm được, vẽ bằng SVG có màu:
 * người có mặt, tóc, áo (trẻ em nhỏ hơn, áo vàng), người nằm có chăn; ghế, giường trống vẽ mờ; đầu xe có lái xe.
 * Người đã chạm hiện số thứ tự (tĩnh, không hoạt ảnh). Sau khi chấm: đếm đúng tô xanh, đếm dư tô đỏ, bỏ sót
 * viền vàng đứt nét.
 */
import type { ReactNode } from "react";

import {
  type DeXeKhach,
  type HinhPhanTu,
  type OKhoang,
  type PhanTuCoId,
  soDoKhoang,
} from "../../lib/len-xe-khach";

const TEN_HINH: Record<HinhPhanTu, string> = {
  nguoi_lon: "Người lớn",
  tre_em: "Trẻ em",
  hanh_ly: "Hành lý",
  ao_treo: "Áo treo",
  tui: "Túi",
};
const TEN_O: Record<OKhoang["loai"], string> = { ghe: "ghế", giuong: "giường", loi_di: "lối đi", san: "sàn" };

const DA = "#e8b48a";
const TOC = "#2b1d14";
const AO_NGUOI_LON = "#3b82c4";
const AO_TRE_EM = "#f59f00";

/** Nền chỗ: ghế (lưng tựa, đệm) hoặc giường (đệm, gối); lối đi và sàn để trống. */
function NenCho({ loai, goi = true }: { loai: OKhoang["loai"]; goi?: boolean }) {
  if (loai === "ghe")
    return (
      <>
        <rect x={4} y={2.5} width={16} height={12} rx={3} fill="var(--line-strong)" opacity={0.55} />
        <rect x={3.5} y={13} width={17} height={9} rx={2.5} fill="var(--line-strong)" opacity={0.8} />
      </>
    );
  if (loai === "giuong")
    return (
      <>
        <rect x={0.5} y={4.5} width={23} height={15} rx={2.5} fill="var(--line-strong)" opacity={0.55} />
        {goi ? <rect x={1.5} y={6.5} width={5} height={11} rx={2} fill="var(--surface)" /> : null}
      </>
    );
  return null;
}

/** Người ngồi, nhìn từ trước: đầu (mặt, tóc), cổ, vai áo. Trẻ em nhỏ hơn, tóc buộc hai bên, áo vàng. */
function NguoiNgoi({ tre }: { tre: boolean }) {
  if (tre)
    return (
      <>
        <path d="M6.5 23 Q6.5 17.5 12 17 Q17.5 17.5 17.5 23 Z" fill={AO_TRE_EM} />
        <rect x={10.8} y={14.5} width={2.4} height={3} fill={DA} />
        <circle cx={7.6} cy={10.5} r={1.7} fill={TOC} />
        <circle cx={16.4} cy={10.5} r={1.7} fill={TOC} />
        <circle cx={12} cy={12} r={3.9} fill={DA} />
        <path d="M8.1 11.6 Q8.3 8 12 8 Q15.7 8 15.9 11.6 Q14 9.9 12 10.1 Q10 9.9 8.1 11.6 Z" fill={TOC} />
        <circle cx={10.6} cy={12.6} r={0.55} fill={TOC} />
        <circle cx={13.4} cy={12.6} r={0.55} fill={TOC} />
      </>
    );
  return (
    <>
      <path d="M3.5 23 Q3.5 14.8 12 14.3 Q20.5 14.8 20.5 23 Z" fill={AO_NGUOI_LON} />
      <path d="M10 14.6 L12 17 L14 14.6" fill="none" stroke="#fff" strokeWidth={0.9} opacity={0.7} />
      <rect x={10.5} y={11.5} width={3} height={3.2} fill={DA} />
      <circle cx={12} cy={8.4} r={4.6} fill={DA} />
      <path d="M7.4 8.4 Q7.5 3.4 12 3.4 Q16.5 3.4 16.6 8.4 Q14.6 5.9 12 6.1 Q9.4 5.9 7.4 8.4 Z" fill={TOC} />
      <circle cx={10.3} cy={9} r={0.6} fill={TOC} />
      <circle cx={13.7} cy={9} r={0.6} fill={TOC} />
    </>
  );
}

/** Người nằm (giường, sàn), nhìn từ trên: đầu ở trái, chăn đắp tới vai. */
function NguoiNam({ tre }: { tre: boolean }) {
  const r = tre ? 3.2 : 3.9;
  return (
    <>
      <rect
        x={8.5}
        y={tre ? 7.5 : 6}
        width={tre ? 10 : 14.5}
        height={tre ? 9 : 12}
        rx={3}
        fill={tre ? AO_TRE_EM : AO_NGUOI_LON}
      />
      <line
        x1={10.5}
        y1={tre ? 9.5 : 8}
        x2={10.5}
        y2={tre ? 14.5 : 16}
        stroke="#fff"
        strokeWidth={0.9}
        opacity={0.6}
      />
      <circle cx={5} cy={12} r={r} fill={DA} />
      <path
        d={`M${5 - r} 12 A${r} ${r} 0 0 1 ${5 + r * 0.2} ${12 - r} L${5 + r * 0.2} ${12 + r} A${r} ${r} 0 0 1 ${5 - r} 12 Z`}
        fill={TOC}
      />
    </>
  );
}

/** Hình phần tử (khung 24×24) đặt trên nền chỗ. Người nằm trên giường, sàn vẽ nhìn từ trên. */
function Hinh({ hinh, o }: { hinh: HinhPhanTu; o: OKhoang["loai"] }) {
  const nam = o === "giuong" || o === "san";
  let v: ReactNode;
  if (hinh === "nguoi_lon" || hinh === "tre_em")
    v = nam ? <NguoiNam tre={hinh === "tre_em"} /> : <NguoiNgoi tre={hinh === "tre_em"} />;
  else if (hinh === "hanh_ly")
    // Va li: thân nâu, tay xách, hai đai, bánh xe.
    v = (
      <>
        <path d="M9 7.5V4.5h6v3" fill="none" stroke="#5a3a1a" strokeWidth={1.8} />
        <rect x={5} y={7} width={14} height={14} rx={2.5} fill="#8d5a2b" />
        <line x1={9} y1={7.5} x2={9} y2={20.5} stroke="#c08a4f" strokeWidth={1.4} />
        <line x1={15} y1={7.5} x2={15} y2={20.5} stroke="#c08a4f" strokeWidth={1.4} />
        <circle cx={7.5} cy={22} r={1.3} fill="#212529" />
        <circle cx={16.5} cy={22} r={1.3} fill="#212529" />
      </>
    );
  else if (hinh === "ao_treo")
    // Áo khoác treo trên móc: móc, mắc, thân áo có cổ, hàng cúc.
    v = (
      <>
        <path d="M12 6V4.6Q14 4.4 14 3.2Q14 2 12.6 2" fill="none" stroke="#868e96" strokeWidth={1.3} />
        <path d="M4.5 9.2 L12 6 L19.5 9.2" fill="none" stroke="#868e96" strokeWidth={1.4} />
        <path
          d="M6.2 9 L9.5 7.8 Q12 10 14.5 7.8 L17.8 9 L19.6 14 L17.2 14.6 L17 21.5 H7 L6.8 14.6 L4.4 14 Z"
          fill="#c92a2a"
        />
        <line x1={12} y1={10} x2={12} y2={21.5} stroke="#7d1a1a" strokeWidth={0.9} />
        {[12.5, 15.5, 18.5].map((y) => (
          <circle key={y} cx={13.2} cy={y} r={0.6} fill="#fff" />
        ))}
      </>
    );
  // Túi xách: quai, thân tím, nắp gập, khóa.
  else
    v = (
      <>
        <path d="M8.5 10.5a3.5 3.8 0 0 1 7 0" fill="none" stroke="#4c2fa8" strokeWidth={1.8} />
        <path d="M5 10h14l-1.4 10.6Q17.5 21.5 16.5 21.5h-9Q6.5 21.5 6.4 20.6Z" fill="#7048e8" />
        <path d="M5 10h14v3.2Q12 15.4 5 13.2Z" fill="#4c2fa8" />
        <rect x={11} y={13.2} width={2} height={2} rx={0.5} fill="#f2c230" />
      </>
    );
  return (
    <svg viewBox="0 0 24 24" width={34} height={34} aria-hidden="true">
      <NenCho loai={o} goi={o === "giuong"} />
      {v}
    </svg>
  );
}

/** Đầu xe nhìn từ trên: kính lái, vô lăng, lái xe (bên trái), cửa lên xuống (bên phải). */
function DauXe() {
  return (
    <svg viewBox="0 0 320 58" className="block h-auto w-full" aria-hidden="true">
      <path
        d="M2 58 V26 Q2 4 30 3 H290 Q318 4 318 26 V58 Z"
        fill="var(--surface-2)"
        stroke="var(--line-strong)"
        strokeWidth={2}
      />
      <path d="M12 24 Q14 11 34 10 H286 Q306 11 308 24 L300 26 H20 Z" fill="#25313d" opacity={0.85} />
      <path d="M40 13 L28 23 M60 13 L48 23" stroke="#fff" strokeWidth={2} opacity={0.25} />
      <circle cx={56} cy={34} r={8} fill="none" stroke="#343a40" strokeWidth={3} />
      <path d="M48 34 H64 M56 34 V42" stroke="#343a40" strokeWidth={1.5} />
      <path d="M45 50 L49 36 M67 50 L63 36" stroke="#1f6f8b" strokeWidth={3.5} strokeLinecap="round" />
      <ellipse cx={56} cy={52} rx={13} ry={6} fill="#1f6f8b" />
      <circle cx={56} cy={48} r={6} fill={TOC} />
      <text x={76} y={50} fontSize={12} fill="var(--ink-2)">
        Lái xe
      </text>
      <rect
        x={270}
        y={30}
        width={40}
        height={28}
        rx={3}
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
      <text x={290} y={48} fontSize={11} textAnchor="middle" fill="var(--ink-2)">
        Cửa
      </text>
    </svg>
  );
}

export interface KetQuaDem {
  dung: ReadonlySet<string>;
  du: ReadonlySet<string>;
  sot: ReadonlySet<string>;
}

export function SoDoKhoangXe({
  de,
  dem,
  onCham,
  khoa,
  ketQua,
}: {
  de: Pick<DeXeKhach, "loai_xe" | "phan_tu">;
  dem: readonly string[];
  onCham: (id: string) => void;
  khoa: boolean;
  ketQua?: KetQuaDem;
}) {
  const s = soDoKhoang(de.loai_xe);
  const theoO = new Map<string, PhanTuCoId>(de.phan_tu.map((p) => [p.o, p]));
  const tang = s.so_tang === 2 ? [1, 2] : [1];
  return (
    <div className="grid gap-3">
      {tang.map((t) => (
        <section key={t} aria-label={s.so_tang === 2 ? `Tầng ${t === 1 ? "dưới" : "trên"}` : "Khoang xe"}>
          <p className="mb-1 flex justify-between text-sm text-ink-2">
            <span>{s.so_tang === 2 ? `Tầng ${t === 1 ? "dưới" : "trên"}` : "Khoang xe"}</span>
            <span>▲ Đầu xe{t === 1 ? " · Lái xe" : ""}</span>
          </p>
          {t === 1 ? <DauXe /> : null}
          <div
            className={`grid gap-1 border-2 border-line-strong bg-surface-2 p-1.5 ${t === 1 ? "rounded-b-2xl border-t-0" : "rounded-2xl"}`}
            style={{ gridTemplateColumns: `repeat(${s.so_cot}, minmax(0, 1fr))` }}
          >
            {s.o
              .filter((o) => o.tang === t)
              .map((o) => {
                const p = theoO.get(o.ma);
                const vt = { gridColumn: o.cot + 1, gridRow: o.hang + 1 };
                const choNgoi = o.loai === "ghe" || o.loai === "giuong";
                if (!p)
                  return (
                    <div
                      key={o.ma}
                      aria-hidden="true"
                      className="grid min-h-12 place-items-center rounded-lg"
                      style={{
                        ...vt,
                        border: choNgoi ? "1.5px solid var(--line)" : undefined,
                        background: choNgoi ? "var(--surface)" : undefined,
                      }}
                    >
                      {choNgoi ? (
                        <svg viewBox="0 0 24 24" width={34} height={34} opacity={0.6} aria-hidden="true">
                          <NenCho loai={o.loai} />
                        </svg>
                      ) : null}
                    </div>
                  );
                const so = dem.indexOf(p.id) + 1;
                const kq = ketQua?.dung.has(p.id)
                  ? "ok"
                  : ketQua?.du.has(p.id)
                    ? "danger"
                    : ketQua?.sot.has(p.id)
                      ? "warn"
                      : null;
                return (
                  <button
                    key={o.ma}
                    type="button"
                    disabled={khoa}
                    aria-pressed={khoa ? undefined : so > 0}
                    aria-label={`${TEN_HINH[p.hinh]}, ${TEN_O[o.loai]} hàng ${o.hang + 1}${so ? `, đã đếm thứ ${so}` : ""}`}
                    data-id={p.id}
                    onClick={() => onCham(p.id)}
                    className="relative grid min-h-12 place-items-center rounded-lg disabled:cursor-default"
                    style={{
                      ...vt,
                      color: "var(--ink-2)",
                      border: `2px ${kq === "warn" ? "dashed" : "solid"} ${kq ? `var(--${kq})` : so ? "var(--primary)" : choNgoi ? "var(--line)" : "transparent"}`,
                      background: kq ? `var(--${kq}-soft)` : so ? "var(--primary-soft)" : "var(--surface)",
                    }}
                  >
                    <Hinh hinh={p.hinh} o={o.loai} />
                    {so ? (
                      <span
                        className="g-so absolute top-0.5 right-1 text-xs font-bold"
                        style={{ color: "var(--primary)" }}
                      >
                        {so}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
