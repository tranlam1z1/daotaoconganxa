/**
 * Một hồ sơ trong trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11, docs/GAME_DESIGN.md §5.11).
 *
 * Thẻ hồ sơ gồm ảnh vi phạm (SVG dựng từ tham số), ảnh phóng to biển số, dải thông tin. Mỗi phần là một
 * chỗ chạm được để đánh dấu chỗ thiếu; chạm lần hai thì bỏ đánh dấu. Quyết định bằng ô vuốt (M2 `Vuot`):
 * vuốt trái là gửi thông báo, vuốt phải là trả lại (phải chỉ chỗ thiếu trước). Ô vuốt chia hai nửa đúng
 * theo chiều vuốt (trái: gửi, màu xanh; phải: trả lại, màu đỏ), nửa đang kéo về sáng lên. Hai nút "Gửi
 * thông báo", "Trả lại" bên dưới đặt cùng phía, thay cho vuốt; phím mũi tên trái, phải trên ô vuốt.
 *
 * Thẻ nghiêng theo ngón tay trong lúc vuốt và bay ra sau khi quyết định: hiệu ứng riêng của trò, đọc độ
 * dời từ sự kiện con trỏ nổi lên từ ô vuốt. Giảm chuyển động: thẻ đứng yên, gửi ngay.
 *
 * Trang chỉ hiển thị; đúng sai do máy chủ chấm (chi_tiet trong kết quả).
 */
import { useId, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import {
  type AnhViPham,
  type ChiTietPhatNguoi,
  type ChoCham,
  type DePhatNguoi,
  KY_TU_MO,
  ngayVn,
  type QuyetDinhPhatNguoi,
  TEN_CHO_CHAM,
  thoiDiemVn,
} from "../../lib/duyet-phat-nguoi";
import { BienBan } from "./chung/BienBan";
import { DanhSachLoi } from "./chung/DanhSachLoi";
import "./chung/giay-to.css";
import { Vuot } from "./chung/tuong-tac/Vuot";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";

export interface TraLoiPhatNguoiWeb {
  quyet_dinh: QuyetDinhPhatNguoi | null;
  cho: ChoCham[];
}

export const TRA_LOI_RONG_PHAT_NGUOI: TraLoiPhatNguoiWeb = { quyet_dinh: null, cho: [] };

const TRE_GUI_MS = 380;
const MO = [0, 0.8, 2.2, 4.5];

/* ------------------------------------------------------------------ */
/* Ảnh vi phạm                                                         */
/* ------------------------------------------------------------------ */

const LOP = "#16191d";
const DA = "#e0a87a";

/** Biển số sau xe trên ảnh: nền trắng, ký tự là vệt đậm (không đọc được ở cỡ ảnh toàn cảnh). */
const BienSau = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx={1} fill="#f1f3f5" stroke="#343a40" strokeWidth={0.8} />
    <line
      x1={x + 2}
      y1={y + h / 2}
      x2={x + w - 2}
      y2={y + h / 2}
      stroke="#495057"
      strokeWidth={h * 0.4}
      strokeDasharray="2 1.2"
    />
  </>
);

/**
 * Xe trên ảnh camera, nhìn từ phía sau (camera đặt sau xe, chụp biển số sau). Ô tô: thân, ca-bin, kính
 * hậu, đèn hậu, biển số, cản, bánh. Mô tô: bánh sau, người lái (áo, tay, chân), đầu đội mũ bảo hiểm hoặc
 * đầu trần (tóc đen, tai), để người duyệt nhìn ra ngay. Xe ở xa (trên ảnh) vẽ nhỏ hơn theo phối cảnh.
 */
function Xe({
  x,
  y,
  moTo,
  mu,
  mau = "#2a6fb0",
}: {
  x: number;
  y: number;
  moTo: boolean;
  mu?: boolean;
  mau?: string;
}) {
  const s = 0.55 + y / 330;
  if (!moTo)
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx={0} cy={25} rx={33} ry={5} fill="#000" opacity={0.3} />
        <rect x={-27} y={13} width={10} height={13} rx={2} fill={LOP} />
        <rect x={17} y={13} width={10} height={13} rx={2} fill={LOP} />
        <path d="M-22 -6 L-17 -30 Q-16 -33 -12 -33 L12 -33 Q16 -33 17 -30 L22 -6 Z" fill={mau} />
        <path
          d="M-22 -6 L-17 -30 Q-16 -33 -12 -33 L12 -33 Q16 -33 17 -30 L22 -6 Z"
          fill="#000"
          opacity={0.18}
        />
        <path d="M-18 -8 L-14 -28 L14 -28 L18 -8 Z" fill="#2b3a4a" />
        <path d="M-12 -26 L-15 -11" stroke="#fff" strokeWidth={2} opacity={0.35} />
        <rect x={-30} y={-7} width={60} height={26} rx={6} fill={mau} />
        <line x1={-26} y1={-1} x2={26} y2={-1} stroke="#000" strokeWidth={0.8} opacity={0.35} />
        <rect x={-28} y={-4} width={12} height={7} rx={2} fill="#e03131" />
        <rect x={16} y={-4} width={12} height={7} rx={2} fill="#e03131" />
        <BienSau x={-10} y={5} w={20} h={8} />
        <rect x={-30} y={15} width={60} height={6} rx={2} fill="#2b2f33" />
      </g>
    );
  const ao = "#e9ecef";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={26} rx={15} ry={4} fill="#000" opacity={0.3} />
      <rect x={-4.5} y={8} width={9} height={18} rx={4} fill={LOP} />
      {/* Chân người lái hai bên xe. */}
      <path d="M-9 -4 L-13 15 L-8 16 L-4 0 Z" fill="#343a40" />
      <path d="M9 -4 L13 15 L8 16 L4 0 Z" fill="#343a40" />
      <path d="M-10 -6 h20 l-2 12 h-16 Z" fill={mau} />
      <rect x={-5} y={4} width={10} height={4} rx={1} fill="#e03131" />
      <BienSau x={-6} y={9} w={12} h={7} />
      {/* Tay lái, gương. */}
      <line x1={-18} y1={-20} x2={18} y2={-20} stroke={LOP} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M-15 -20 L-17 -29 M15 -20 L17 -29" stroke={LOP} strokeWidth={1.5} />
      <circle cx={-17} cy={-30} r={2.5} fill={LOP} />
      <circle cx={17} cy={-30} r={2.5} fill={LOP} />
      {/* Người lái: thân áo, tay vươn tới tay lái. */}
      <path d="M-11 -30 Q-13 -12 -9 -4 L9 -4 Q13 -12 11 -30 Q0 -34 -11 -30 Z" fill={ao} />
      <path d="M-10 -28 L-16 -20 M10 -28 L16 -20" stroke={ao} strokeWidth={4} strokeLinecap="round" />
      <rect x={-3} y={-34} width={6} height={5} fill={DA} />
      {mu ? (
        <>
          <circle cx={0} cy={-39} r={8.5} fill="#f2c230" stroke="#8a6d00" strokeWidth={1.5} />
          <path d="M-8.3 -36 Q0 -32 8.3 -36" fill="none" stroke="#8a6d00" strokeWidth={1.5} />
          <ellipse cx={-3} cy={-43} rx={2.6} ry={1.6} fill="#fff" opacity={0.6} />
        </>
      ) : (
        <>
          <circle cx={-7.2} cy={-39} r={2} fill={DA} />
          <circle cx={7.2} cy={-39} r={2} fill={DA} />
          <circle cx={0} cy={-40} r={7.3} fill="#2b1d14" />
        </>
      )}
    </g>
  );
}

/** Xe tải che khuất xe vi phạm: đuôi thùng hàng, hai cánh cửa, cản, đèn hậu, bánh. */
function XeTaiChe({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={72} rx={56} ry={6} fill="#000" opacity={0.3} />
      <rect x={-46} y={62} width={16} height={10} rx={2} fill={LOP} />
      <rect x={30} y={62} width={16} height={10} rx={2} fill={LOP} />
      <rect
        x={-50}
        y={-20}
        width={100}
        height={78}
        rx={4}
        fill="#d8cfae"
        stroke="#6b6247"
        strokeWidth={1.5}
      />
      <line x1={0} y1={-16} x2={0} y2={54} stroke="#6b6247" strokeWidth={1.5} />
      {[-8, 8].map((k) => (
        <line key={k} x1={k} y1={-14} x2={k} y2={52} stroke="#6b6247" strokeWidth={2} opacity={0.6} />
      ))}
      {[4, 30].map((k) => (
        <line key={k} x1={-46} y1={k} x2={46} y2={k} stroke="#6b6247" strokeWidth={1} opacity={0.35} />
      ))}
      <rect x={-50} y={56} width={100} height={8} rx={2} fill="#2b2f33" />
      <rect x={-48} y={50} width={10} height={5} rx={1} fill="#e03131" />
      <rect x={38} y={50} width={10} height={5} rx={1} fill="#e03131" />
    </g>
  );
}

function AnhCanh({ de, idLoc }: { de: DePhatNguoi; idLoc: string }) {
  const a: AnhViPham = de.anh;
  const moTo = de.loai_xe === "mo_to";
  // Vị trí xe theo cảnh: qua vạch thì ở xa (trên ảnh), chưa qua thì ở gần.
  let xe = { x: 180, y: 150 };
  if (a.canh === "giao_lo") xe = { x: 170, y: a.qua_vach ? 88 : 158 };
  if (a.canh === "duong_lan") xe = { x: a.lan === "o_to" ? 130 : 238, y: 140 };
  if (a.canh === "loi_vao_cam") xe = a.vao_duong_cam ? { x: 262, y: 84 } : { x: 190, y: 160 };
  const den = { do: "#e0322d", vang: "#f2c230", xanh: "#22a35a" };
  return (
    <svg
      viewBox="0 0 360 220"
      className="block h-auto w-full"
      role="img"
      aria-label="Ảnh vi phạm do camera ghi"
    >
      <defs>
        <filter id={idLoc}>
          <feGaussianBlur stdDeviation={MO[a.do_mo] ?? 0} />
        </filter>
      </defs>
      <g filter={a.do_mo ? `url(#${idLoc})` : undefined}>
        <rect width={360} height={220} fill="#9fb58f" />
        <polygon points="110,0 250,0 360,220 0,220" fill="#6d7075" />
        {a.canh === "duong_lan" ? (
          <>
            <line x1={180} y1={0} x2={180} y2={220} stroke="#fff" strokeWidth={4} />
            <text x={112} y={206} fontSize={15} fontWeight={700} fill="#fff">
              Ô TÔ
            </text>
            <text x={206} y={206} fontSize={15} fontWeight={700} fill="#fff">
              XE MÁY
            </text>
          </>
        ) : (
          <line x1={180} y1={0} x2={180} y2={220} stroke="#fff" strokeWidth={3} strokeDasharray="14 12" />
        )}
        {a.canh === "giao_lo" ? (
          <>
            <line x1={52} y1={120} x2={308} y2={120} stroke="#fff" strokeWidth={6} />
            <rect x={318} y={20} width={20} height={56} rx={5} fill="#222" />
            {(["do", "vang", "xanh"] as const).map((m, i) => (
              <circle key={m} cx={328} cy={32 + i * 16} r={6} fill={a.den === m ? den[m] : "#444"} />
            ))}
            <line x1={328} y1={76} x2={328} y2={130} stroke="#222" strokeWidth={4} />
          </>
        ) : null}
        {a.canh === "loi_vao_cam" ? (
          <>
            <polygon points="250,0 360,0 360,120 290,120" fill="#6d7075" />
            <line x1={300} y1={112} x2={300} y2={176} stroke="#222" strokeWidth={4} />
            <circle cx={300} cy={100} r={17} fill="#fff" stroke="#e0322d" strokeWidth={6} />
            <rect x={270} y={122} width={60} height={20} rx={3} fill="#fff" stroke="#222" />
            <text x={300} y={136} fontSize={11} textAnchor="middle" fill="#111">
              {a.khung_gio ? `${a.khung_gio.tu}–${a.khung_gio.den}` : ""}
            </text>
          </>
        ) : null}
        {a.canh === "duong_thang" && de.do_toc_do ? (
          <>
            <circle cx={30} cy={60} r={17} fill="#fff" stroke="#e0322d" strokeWidth={5} />
            <text x={30} y={65} fontSize={13} fontWeight={700} textAnchor="middle" fill="#111">
              {de.do_toc_do.gioi_han}
            </text>
          </>
        ) : null}
        <Xe x={xe.x} y={xe.y} moTo={moTo} mu={a.mu} />
        {a.che === "chong_xe" ? <Xe x={xe.x + 12} y={xe.y + 6} moTo={moTo} mu={a.mu} mau="#8a5e05" /> : null}
        {a.che === "xe_khac" ? <XeTaiChe x={xe.x} y={xe.y} /> : null}
        {a.toi ? <rect width={360} height={220} fill="#050a18" opacity={0.55} /> : null}
      </g>
      {/* Dấu giờ và mã thiết bị do camera in lên ảnh: không bị mờ theo ảnh. */}
      <rect width={360} height={20} fill="#000" opacity={0.55} />
      <text x={6} y={14} fontSize={11} fill="#fff" fontFamily="monospace">
        {de.thoi_diem ? de.thoi_diem.replace("T", " ") : "----------  --:--:--"}
      </text>
      <text x={354} y={14} fontSize={11} fill="#fff" fontFamily="monospace" textAnchor="end">
        {de.thiet_bi.ma}
        {de.do_toc_do ? ` · ${de.do_toc_do.do_duoc} km/h` : ""}
      </text>
      <text
        x={180}
        y={130}
        fontSize={24}
        fontWeight={700}
        textAnchor="middle"
        fill="#fff"
        opacity={0.18}
        transform="rotate(-14 180 120)"
      >
        MẪU TRÒ CHƠI
      </text>
    </svg>
  );
}

function BienSo({ bien }: { bien: string }) {
  return (
    <span
      className="g-so inline-block whitespace-nowrap rounded-md border-2 px-2 py-0.5 text-2xl font-bold tracking-wider"
      style={{ borderColor: "var(--ink)", background: "#fff", color: "#111" }}
    >
      {/* Vị trí ký tự trên biển số cố định trong một hồ sơ, nên dùng chỉ số làm khóa. */}
      {[...bien].map((c, i) =>
        c === KY_TU_MO ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: vị trí ký tự cố định
            key={i}
            role="img"
            aria-label="ký tự không đọc được"
            className="inline-block h-[0.9em] w-[0.6em] translate-y-[0.1em] rounded-sm align-baseline"
            style={{ background: "#555", filter: "blur(3px)" }}
          />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: vị trí ký tự cố định
          <span key={i}>{c}</span>
        ),
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ hồ sơ                                                           */
/* ------------------------------------------------------------------ */

type KetQuaCho = "loi" | "nham";

function Cho({
  ma,
  chon,
  ketQua,
  khoa,
  onCham,
  children,
  nhan,
}: {
  ma: ChoCham;
  chon: boolean;
  ketQua?: KetQuaCho;
  khoa: boolean;
  onCham: (c: ChoCham) => void;
  children: React.ReactNode;
  nhan?: string;
}) {
  return (
    <button
      type="button"
      className="gt-dong"
      style={{ flexDirection: "column", alignItems: "stretch", gap: 2 }}
      aria-pressed={khoa ? undefined : chon}
      aria-label={`${TEN_CHO_CHAM[ma]}${nhan ? `: ${nhan}` : ""}${chon ? ", đã đánh dấu thiếu" : ""}${ketQua === "loi" ? ", chỗ thiếu" : ketQua === "nham" ? ", đánh dấu nhầm" : ""}`}
      data-ket-qua={ketQua}
      disabled={khoa}
      onClick={() => onCham(ma)}
    >
      {children}
    </button>
  );
}

const Nhan = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-xs text-ink-2">{children}</span>
);

/** Một nửa ô vuốt: mũi tên, việc làm, khi nào làm. Nửa đang kéo về sáng lên, nửa kia mờ đi. */
function NuaVuot({
  ben,
  tieuDe,
  moTa,
  mau,
  nen,
  trangThai,
}: {
  ben: "trai" | "phai";
  tieuDe: string;
  moTa: string;
  mau: string;
  nen: string;
  trangThai: "sang" | "mo" | "thuong";
}) {
  const trai = ben === "trai";
  const chuyen = "var(--td-vua) var(--cong-chuan)";
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-xl border-2 px-3 py-2.5",
        trai ? "items-start text-left" : "items-end text-right",
      )}
      style={{
        background: nen,
        color: mau,
        borderColor: trangThai === "sang" ? mau : "transparent",
        opacity: trangThai === "mo" ? 0.4 : 1,
        transform: trangThai === "sang" ? "scale(1.04)" : undefined,
        transition: `opacity ${chuyen}, transform ${chuyen}, border-color ${chuyen}`,
      }}
    >
      <span className="text-3xl font-bold leading-none">{trai ? "←" : "→"}</span>
      <span className="text-base font-bold leading-tight">{tieuDe}</span>
      <span className="text-xs text-ink-2">{moTa}</span>
    </span>
  );
}

export function DuyetPhatNguoi({
  de,
  traLoi,
  datTraLoi,
  chiTiet,
  daCham,
  gui,
}: {
  de: DePhatNguoi;
  traLoi: TraLoiPhatNguoiWeb;
  datTraLoi: (t: TraLoiPhatNguoiWeb) => void;
  chiTiet?: unknown;
  daCham: boolean;
  gui?: (t: TraLoiPhatNguoiWeb) => void;
}) {
  const idLoc = useId().replace(/:/g, "");
  const [daQuyet, datDaQuyet] = useState<QuyetDinhPhatNguoi | null>(null);
  const [doi, datDoi] = useState(0);
  const [nhac, datNhac] = useState(false);
  const keo = useRef<{ x: number; id: number } | null>(null);
  const daGui = useRef(false);
  const ct = daCham ? (chiTiet as ChiTietPhatNguoi | undefined) : undefined;
  const khoa = daCham || daQuyet !== null;
  const chon = new Set(traLoi.cho);

  const ketQua = new Map<ChoCham, KetQuaCho>();
  for (const c of ct?.cho_thieu ?? []) for (const x of c.cho) ketQua.set(x, "loi");
  for (const c of ct?.cho_nham ?? []) ketQua.set(c.ma, "nham");

  const cham = (c: ChoCham) => {
    if (khoa) return;
    datNhac(false);
    datTraLoi({ ...traLoi, cho: chon.has(c) ? traLoi.cho.filter((x) => x !== c) : [...traLoi.cho, c] });
  };

  const quyet = (q: QuyetDinhPhatNguoi) => {
    if (khoa || daGui.current) return;
    if (q === "tra_lai" && !traLoi.cho.length) {
      datNhac(true);
      datDoi(0);
      return;
    }
    daGui.current = true;
    const t: TraLoiPhatNguoiWeb = { quyet_dinh: q, cho: q === "tra_lai" ? traLoi.cho : [] };
    datDaQuyet(q);
    datTraLoi(t);
    phatAm("tich");
    setTimeout(() => gui?.(t), dangGiamChuyenDong() ? 0 : TRE_GUI_MS);
  };

  const giam = dangGiamChuyenDong();
  const bay = daQuyet && !daCham && !giam ? (daQuyet === "gui" ? -1 : 1) : 0;
  const huongKeo: QuyetDinhPhatNguoi | null = doi < -30 ? "gui" : doi > 30 ? "tra_lai" : null;
  const theStyle: React.CSSProperties = giam
    ? {}
    : bay
      ? {
          transform: `translateX(${bay * 115}%) rotate(${bay * 10}deg)`,
          opacity: 0,
          transition: "transform 360ms var(--cong-ra), opacity 360ms var(--cong-ra)",
        }
      : doi
        ? { transform: `translateX(${doi}px) rotate(${doi / 24}deg)` }
        : { transition: "transform var(--td-vua) var(--cong-chuan)" };

  return (
    <div className="space-y-4">
      {/* Lớp ngoài: hoạt ảnh vào (giữ transform); lớp trong: nghiêng theo ngón tay, bay ra. */}
      <div key={daCham ? "xem" : "choi"} className="g-a gt-vao">
        <div
          className="gt-the relative p-2"
          style={{ ...theStyle, "--gt-mau": "var(--primary)" } as React.CSSProperties}
        >
          {huongKeo ? (
            <span
              aria-hidden="true"
              className="gt-dau absolute top-10 z-10 text-base"
              data-quyet-dinh={huongKeo === "gui" ? "cho_qua" : "giu_lai"}
              style={{ [huongKeo === "gui" ? "right" : "left"]: 16 }}
            >
              {huongKeo === "gui" ? "Gửi" : "Trả lại"}
            </span>
          ) : null}
          <Cho ma="anh" chon={chon.has("anh")} ketQua={ketQua.get("anh")} khoa={khoa} onCham={cham}>
            <span className="block overflow-hidden rounded-lg">
              <AnhCanh de={de} idLoc={idLoc} />
            </span>
          </Cho>
          <Cho
            ma="bien_so"
            chon={chon.has("bien_so")}
            ketQua={ketQua.get("bien_so")}
            khoa={khoa}
            onCham={cham}
            nhan={de.bien_so_he_thong}
          >
            <Nhan>Ảnh phóng to biển số</Nhan>
            <span className="mt-1 block text-center">
              <BienSo bien={de.bien_so_anh} />
            </span>
            <span className="mt-1 block text-sm">
              Hệ thống đọc: <strong className="g-so">{de.bien_so_he_thong}</strong>
            </span>
          </Cho>
          <div className="mt-1 grid gap-1 border-t pt-1" style={{ borderColor: "var(--line)" }}>
            <Cho
              ma="thoi_diem"
              chon={chon.has("thoi_diem")}
              ketQua={ketQua.get("thoi_diem")}
              khoa={khoa}
              onCham={cham}
            >
              <Nhan>Thời điểm</Nhan>
              <span className="text-[15px] font-semibold">
                {de.thoi_diem ? thoiDiemVn(de.thoi_diem) : "Không có dữ liệu"}
              </span>
            </Cho>
            <Cho
              ma="vi_tri"
              chon={chon.has("vi_tri")}
              ketQua={ketQua.get("vi_tri")}
              khoa={khoa}
              onCham={cham}
            >
              <Nhan>Vị trí</Nhan>
              <span className="text-[15px]">{de.vi_tri}</span>
            </Cho>
            <Cho
              ma="thiet_bi"
              chon={chon.has("thiet_bi")}
              ketQua={ketQua.get("thiet_bi")}
              khoa={khoa}
              onCham={cham}
            >
              <Nhan>Thiết bị ghi hình</Nhan>
              <span className="text-[15px]">
                {de.thiet_bi.ten_loai} {de.thiet_bi.ma}
                <span className="block">
                  Hạn kiểm định đến <strong>{ngayVn(de.thiet_bi.han_kiem_dinh)}</strong>
                </span>
              </span>
            </Cho>
            <Cho
              ma="hanh_vi"
              chon={chon.has("hanh_vi")}
              ketQua={ketQua.get("hanh_vi")}
              khoa={khoa}
              onCham={cham}
            >
              <Nhan>Hành vi hệ thống đề xuất</Nhan>
              <span className="text-[15px] font-semibold">{de.de_xuat.ten}</span>
              {de.do_toc_do ? (
                <span className="block text-sm">
                  Đo được {de.do_toc_do.do_duoc} km/h · tốc độ tối đa {de.do_toc_do.gioi_han} km/h
                </span>
              ) : null}
            </Cho>
          </div>
        </div>
      </div>

      {!daCham ? (
        <div
          className="space-y-2"
          onPointerDown={(e) => {
            if (!khoa) keo.current = { x: e.clientX, id: e.pointerId };
          }}
          onPointerMove={(e) => {
            const k = keo.current;
            if (k && k.id === e.pointerId && !giam) datDoi(Math.max(-140, Math.min(140, e.clientX - k.x)));
          }}
          onPointerUp={() => {
            keo.current = null;
            datDoi(0);
          }}
          onPointerCancel={() => {
            keo.current = null;
            datDoi(0);
          }}
        >
          <p className="text-sm" aria-live="polite">
            {nhac ? (
              <strong style={{ color: "var(--danger)" }}>
                Chạm vào chỗ thiếu trên thẻ trước khi trả lại.
              </strong>
            ) : traLoi.cho.length ? (
              <>Đã đánh dấu thiếu: {traLoi.cho.map((c) => TEN_CHO_CHAM[c]).join(", ")}.</>
            ) : (
              <span className="text-ink-2">
                Đủ căn cứ thì vuốt trái. Thiếu căn cứ thì chạm vào chỗ thiếu rồi vuốt phải.
              </span>
            )}
          </p>
          <Vuot
            onVuot={(h) => (h === "trai" ? quyet("gui") : h === "phai" ? quyet("tra_lai") : undefined)}
            nhan="Vuốt trái: gửi thông báo · Vuốt phải: trả lại"
            goiY={
              <span aria-hidden="true" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <NuaVuot
                  ben="trai"
                  tieuDe="Gửi thông báo"
                  moTa="Hồ sơ đủ căn cứ"
                  mau="var(--ok)"
                  nen="var(--ok-soft)"
                  trangThai={huongKeo === "gui" ? "sang" : huongKeo ? "mo" : "thuong"}
                />
                <span className="flex flex-col items-center gap-1 text-ink-2">
                  <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden="true">
                    <path
                      d="M5 12h30M11 6l-6 6 6 6M29 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-xs font-semibold">Vuốt</span>
                </span>
                <NuaVuot
                  ben="phai"
                  tieuDe="Trả lại"
                  moTa={traLoi.cho.length ? "Hồ sơ thiếu căn cứ" : "Chạm chỗ thiếu trên thẻ trước"}
                  mau="var(--danger)"
                  nen="var(--danger-soft)"
                  trangThai={huongKeo === "tra_lai" ? "sang" : huongKeo ? "mo" : "thuong"}
                />
              </span>
            }
            anNhan
            anThayThe
            huongChinh="trai"
            nhanThayThe="Gửi thông báo (không vuốt)"
            khoa={khoa}
          />
          {/* Nút thay cho vuốt, đặt cùng phía với nửa ô vuốt tương ứng. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={khoa}
              onClick={() => quyet("gui")}
              aria-label="Gửi thông báo (không vuốt)"
              className="min-h-12 rounded-xl border-2 px-3 text-[15px] font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--ok)", color: "var(--ok)" }}
            >
              <span aria-hidden="true">←</span> Gửi thông báo
            </button>
            <button
              type="button"
              disabled={khoa || !traLoi.cho.length}
              onClick={() => quyet("tra_lai")}
              aria-label="Trả lại (không vuốt)"
              className="min-h-12 rounded-xl border-2 px-3 text-[15px] font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
            >
              Trả lại <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Phần "Xem chi tiết" của một hồ sơ (GĐ17c): quyết định đúng, điểm, chỗ thiếu, thông báo vi phạm. */
export function ChiTietRiengPhatNguoi({ chiTiet }: { chiTiet: unknown }) {
  const ct = chiTiet as ChiTietPhatNguoi;
  return (
    <div className="space-y-3">
      <p className="text-[15px]">
        Đúng ra phải <strong>{ct.quyet_dinh_dung === "gui" ? "gửi thông báo" : "trả lại"}</strong>. Quyết
        định: {ct.diem_quyet_dinh}/10 điểm
        {ct.diem_chi_ra_toi_da ? ` · chỉ chỗ thiếu: ${ct.diem_chi_ra}/${ct.diem_chi_ra_toi_da} điểm` : ""}.
      </p>
      <DanhSachLoi
        tieuDe="Chỗ thiếu của hồ sơ"
        loi={ct.cho_thieu.map((c) => ({
          ten: c.ten,
          moTa: c.mo_ta,
          daChiRa: ct.quyet_dinh === "tra_lai" ? c.da_chi_ra : null,
          giaiThich: c.giai_thich,
          canCu: c.can_cu ? [c.can_cu] : [],
        }))}
        nham={ct.cho_nham.map((c) => c.ten)}
      />
      {ct.quyet_dinh === "gui" ? <BienBan dong={ct.thong_bao} tieuDe="Thông báo vi phạm (mô phỏng)" /> : null}
    </div>
  );
}
