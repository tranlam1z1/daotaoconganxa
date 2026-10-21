/**
 * Tab "Mùa giải" của trang Bảng xếp hạng (docs/PLAN.md GĐ-G6, docs/GAME_DESIGN.md §5.10).
 *
 * Không có lượt chơi riêng: XP từ mọi hoạt động dồn về đơn vị. Màn gồm:
 *  - màn mở đầu (DauMan) và thẻ tuần hiện tại;
 *  - kết quả tuần trước: sao (lên 3, giữ 2, xuống 1), điểm chạy số, và hai hiệu ứng riêng đã duyệt:
 *    DẤU KẾT QUẢ đóng xuống, HÀNG ĐƠN VỊ TRƯỢT trên thang hạng từ hạng cũ sang hạng mới
 *    (docs/VISUAL_STYLE.md §3.4). Chỉ chạy lần đầu xem kết quả của tuần đó trên máy này;
 *  - nhóm của đơn vị tôi, vùng lên/xuống hạng có cả màu, chữ và biểu tượng;
 *  - VẠCH LÊN HẠNG chạy từ 0 tới điểm hiện tại so với mốc lên hạng (hiệu ứng riêng thứ ba).
 *
 * Hoạt ảnh chỉ động transform và opacity (§6.2), dùng Web Animations API cho phần cần đo vị trí.
 * Giảm chuyển động: không trượt, không đóng dấu, vạch hiện ngay; lớp .g-a chỉ còn hiện dần.
 *
 * Thuật ngữ hiển thị (routes/bang-xep-hang.tsx): nhóm thi đấu `bac` gọi là "Bậc" (lên/giữ/xuống bậc);
 * "hạng" chỉ dùng cho vị trí trong nhóm (`hang`); "cấp" dành cho cấp độ cá nhân. Tên biến và tên
 * hiệu ứng trong mã giữ nguyên.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/format";
import { Icon } from "../ui/Icon";
import { phatAm } from "./hieu-ung/am-thanh";
import { dangGiamChuyenDong } from "./hieu-ung/cai-dat";
import { DauMan } from "./hieu-ung/DauMan";
import { SaoTongKet } from "./hieu-ung/SaoTongKet";
import { SoChay } from "./hieu-ung/SoChay";
import { VungTroChoi } from "./hieu-ung/VungTroChoi";

type KetQua = "len" | "giu" | "xuong";

export interface DongMuaGiai {
  unit_id: string;
  ten: string;
  bac: number;
  nhom: number;
  quan_so: number;
  so_nguoi_choi: number;
  xp_tinh: number;
  diem: number;
  ty_le_tham_gia: number;
  xep_hang: boolean;
  hang: number | null;
  du_kien: KetQua | null;
  la_cua_toi: boolean;
}

export interface NhomMuaGiai {
  bac: number;
  nhom: number;
  items: DongMuaGiai[];
}

export interface DuLieuMuaGiai {
  mua: {
    id: string;
    code: string;
    name: string;
    starts_on: string;
    ends_on: string;
    status: "sap_dien_ra" | "dang_dien_ra" | "ket_thuc";
    unit_level_label: string;
    tuan_thu: number;
    config: {
      so_tuan: number;
      so_hang: number;
      so_len: number;
      so_xuong: number;
      tran_xp_tuan: number;
      toi_thieu_thanh_vien: number;
    };
  } | null;
  tuan: { bat_dau: string; ket_thuc: string; han_chot: string } | null;
  don_vi_cua_toi: { unit_id: string; ten: string } | null;
  nhom_cua_toi: NhomMuaGiai | null;
  can_de_len_hang: { diem_can: number; xp_can: number; diem_moc: number } | null;
  tuan_truoc: {
    tuan: string;
    bac: number;
    bac_tuan_sau: number;
    ket_qua: KetQua | null;
    hang: number | null;
    so_don_vi_xep_hang: number;
    diem: number;
    xp_tinh: number;
    quan_so: number;
    so_nguoi_choi: number;
  } | null;
  cac_nhom?: NhomMuaGiai[];
  ghi_chu?: string;
}

const so = (n: number, thapPhan = 0) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: thapPhan, minimumFractionDigits: 0 });

/** Đường cong "có nảy nhẹ" của bộ hoạt ảnh (--cong-bat); WAAPI không đọc được biến CSS. */
const CONG_BAT = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const CONG_CHUAN = "cubic-bezier(0.2, 0, 0, 1)";

// Đo vị trí trước khi vẽ để khung đầu không lóe ở vị trí mới (kỹ thuật FLIP); trên máy chủ dùng useEffect.
const useTruocKhiVe = typeof window === "undefined" ? useEffect : useLayoutEffect;

const NHAN_KET_QUA: Record<KetQua, string> = { len: "Lên bậc", giu: "Giữ bậc", xuong: "Xuống bậc" };

/* ------------------------------------------------------------------ */
/* Đã xem kết quả tuần này chưa (chỉ chạy hiệu ứng lần đầu)             */
/* ------------------------------------------------------------------ */

function useLanDauXem(khoa: string | null): boolean {
  // Máy chủ và lần vẽ đầu coi như đã xem (tĩnh); sau khi hydrate mới biết thật.
  const [lanDau, datLanDau] = useState(false);
  useTruocKhiVe(() => {
    if (!khoa) return;
    try {
      if (!localStorage.getItem(khoa)) {
        datLanDau(true);
        localStorage.setItem(khoa, "1");
      }
    } catch {
      // Chế độ riêng tư chặn localStorage: hiện tĩnh, không sao.
    }
  }, [khoa]);
  return lanDau;
}

/* ------------------------------------------------------------------ */
/* Hiệu ứng riêng 1: dấu kết quả tuần                                  */
/* ------------------------------------------------------------------ */

function DauKetQua({ kq, hoatAnh }: { kq: KetQua; hoatAnh: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!hoatAnh || !ref.current || dangGiamChuyenDong()) return;
    const a = ref.current.animate(
      [
        { opacity: 0, transform: "scale(1.9) rotate(-14deg)" },
        { opacity: 1, transform: "scale(0.94) rotate(-6deg)", offset: 0.72 },
        { opacity: 1, transform: "scale(1) rotate(-6deg)" },
      ],
      { duration: 420, delay: 850, easing: CONG_BAT, fill: "backwards" },
    );
    const t = setTimeout(() => phatAm(kq === "xuong" ? "sai" : "hoan_thanh"), 1150);
    return () => {
      a.cancel();
      clearTimeout(t);
    };
  }, [hoatAnh, kq]);
  const mau = kq === "len" ? "var(--ok)" : kq === "xuong" ? "var(--danger)" : "var(--ink-2)";
  return (
    <span
      ref={ref}
      className="g-tieu-de inline-block rounded-lg border-[3px] px-3 py-1 text-lg font-bold uppercase tracking-[0.08em]"
      style={{ color: mau, borderColor: mau, transform: "rotate(-6deg)" }}
    >
      {NHAN_KET_QUA[kq]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hiệu ứng riêng 2: hàng đơn vị trượt trên thang hạng                 */
/* ------------------------------------------------------------------ */

function ThangHang({
  soHang,
  tu,
  den,
  ten,
  hoatAnh,
}: {
  soHang: number;
  tu: number;
  den: number;
  ten: string;
  hoatAnh: boolean;
}) {
  const hang = useRef<Array<HTMLLIElement | null>>([]);
  const the = useRef<HTMLSpanElement>(null);
  useTruocKhiVe(() => {
    if (!hoatAnh || tu === den || !the.current || dangGiamChuyenDong()) return;
    const cu = hang.current[tu - 1];
    const moi = hang.current[den - 1];
    if (!cu || !moi) return;
    const dy = cu.offsetTop - moi.offsetTop;
    const a = the.current.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
      duration: 700,
      delay: 350,
      easing: CONG_CHUAN,
      fill: "backwards",
    });
    return () => a.cancel();
  }, [hoatAnh, tu, den]);

  return (
    <ol className="relative mt-4 space-y-1.5" aria-label={`Bậc ${tu} sang bậc ${den}`}>
      {Array.from({ length: soHang }, (_, i) => i + 1).map((bac) => (
        <li
          key={bac}
          ref={(el) => {
            hang.current[bac - 1] = el;
          }}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-xl border px-3",
            bac === den ? "border-primary bg-primary-soft" : "border-line bg-surface",
          )}
        >
          <span className="g-so w-16 shrink-0 text-sm font-semibold text-ink-2">Bậc {bac}</span>
          {bac === den ? (
            <span
              ref={the}
              className="min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-sm font-semibold"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              {ten}
            </span>
          ) : bac === tu ? (
            <span className="text-xs text-ink-3">Tuần trước</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Hiệu ứng riêng 3: vạch lên hạng chạy                                */
/* ------------------------------------------------------------------ */

/** Vạch chỉ minh họa cho câu chữ ngay trên nó, nên ẩn với trình đọc màn hình. `moc` null: đã vào vùng lên hạng. */
function VachLenHang({ diem, moc }: { diem: number; moc: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const tyLe = moc && moc > 0 ? Math.max(0, Math.min(1, diem / moc)) : 1;
  useEffect(() => {
    if (!ref.current || dangGiamChuyenDong()) return;
    const a = ref.current.animate([{ transform: "scaleX(0)" }, { transform: `scaleX(${tyLe})` }], {
      duration: 800,
      delay: 200,
      easing: CONG_CHUAN,
      fill: "backwards",
    });
    return () => a.cancel();
  }, [tyLe]);
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
        <span
          ref={ref}
          className="absolute inset-0 origin-left rounded-full"
          style={{ background: "var(--g-nhan)", transform: `scaleX(${tyLe})` }}
        />
      </div>
      {moc ? (
        <div className="mt-1 flex justify-between text-xs text-ink-3">
          <span>0</span>
          <span>Mốc lên bậc: {so(moc, 2)} XP/người</span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng một nhóm                                                        */
/* ------------------------------------------------------------------ */

function NhanVung({ kq }: { kq: KetQua | null }) {
  if (kq === "len")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok">
        <Icon name="arrowUp" className="size-3.5" />
        Vùng lên bậc
      </span>
    );
  if (kq === "xuong")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
        <Icon name="arrowUp" className="size-3.5 rotate-180" />
        Vùng xuống bậc
      </span>
    );
  return null;
}

function BangNhom({ nhom, soHang, hoatAnh }: { nhom: NhomMuaGiai; soHang: number; hoatAnh: boolean }) {
  const coHang = nhom.items.filter((d) => d.xep_hang);
  const khong = nhom.items.filter((d) => !d.xep_hang);
  return (
    <div>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {coHang.map((d, i) => (
          <li
            key={d.unit_id}
            aria-current={d.la_cua_toi ? "true" : undefined}
            className={cn(
              "flex min-h-14 items-center gap-3 px-3 py-2",
              hoatAnh && "g-a g-vao-len",
              d.du_kien === "len" && "bg-ok-soft",
              d.du_kien === "xuong" && "bg-danger-soft",
              d.la_cua_toi && "ring-2 ring-inset ring-primary",
            )}
            style={hoatAnh ? ({ "--tre": `${Math.min(i, 8) * 40}ms` } as React.CSSProperties) : undefined}
          >
            <span
              className={cn(
                "g-so grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                d.la_cua_toi ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-2",
              )}
            >
              {d.hang}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block break-words font-medium">
                {d.ten}
                {d.la_cua_toi ? (
                  <span className="text-sm font-normal text-ink-2"> (đơn vị của bạn)</span>
                ) : null}
              </span>
              <span className="block text-xs text-ink-3">
                {d.so_nguoi_choi}/{d.quan_so} người có XP · {so(d.xp_tinh)} XP
              </span>
              <NhanVung kq={soHang > 1 ? d.du_kien : null} />
            </span>
            <span className="shrink-0 text-right">
              <span className="g-so block font-semibold">{so(d.diem, 2)}</span>
              <span className="block text-xs text-ink-3">XP/người</span>
            </span>
          </li>
        ))}
      </ol>
      {khong.length ? (
        <p className="mt-2 text-sm text-ink-3">
          Chưa xếp hạng (chưa đủ quân số tối thiểu): {khong.map((d) => d.ten).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trang                                                                */
/* ------------------------------------------------------------------ */

export function BangMuaGiai({ du }: { du: DuLieuMuaGiai }) {
  const { mua, tuan, nhom_cua_toi: nhom, tuan_truoc: tr } = du;
  const lanDau = useLanDauXem(mua && tr ? `qdpl-mua-giai-da-xem:${mua.id}:${tr.tuan}` : null);

  if (!mua || !tuan) {
    return (
      <VungTroChoi className="min-h-0 rounded-2xl p-4">
        <p className="text-[15px] text-ink-2">{du.ghi_chu ?? "Chưa có mùa giải nào."}</p>
      </VungTroChoi>
    );
  }
  const cfg = mua.config;
  const toi = nhom?.items.find((d) => d.la_cua_toi);
  const kq = tr?.ket_qua ?? null;

  return (
    <VungTroChoi className="min-h-0 rounded-2xl p-3 sm:p-4">
      <div className="g-dau-trang">
        <DauMan
          ten="Mùa giải đơn vị"
          moTa={
            toi ? `Bậc ${toi.bac} · ${toi.hang ? `đang đứng thứ ${toi.hang}` : "chưa xếp hạng"}` : mua.name
          }
        />

        <section className="g-the g-the-nhan g-a g-vao-len p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
            {mua.status === "ket_thuc"
              ? "Mùa đã kết thúc"
              : mua.status === "sap_dien_ra"
                ? "Sắp diễn ra"
                : "Đang diễn ra"}
          </p>
          <h2 className="g-tieu-de mt-1 text-xl font-semibold">{mua.name}</h2>
          <p className="mt-1 text-sm text-ink-2">
            Tuần {mua.tuan_thu}/{cfg.so_tuan} · {formatDate(tuan.bat_dau)} – {formatDate(tuan.ket_thuc)} · thi
            đấu giữa các {mua.unit_level_label}
          </p>
          {toi ? (
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm text-ink-2">{du.don_vi_cua_toi?.ten}</p>
                <p className="g-tieu-de text-lg font-semibold">
                  Bậc {toi.bac}
                  {toi.hang
                    ? ` · thứ ${toi.hang}/${nhom!.items.filter((d) => d.xep_hang).length} trong nhóm`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <SoChay den={toi.diem} thapPhan={2} className="text-3xl font-bold" />
                <span className="block text-xs text-ink-3">XP/người tuần này</span>
              </div>
            </div>
          ) : null}

          {toi && mua.status === "dang_dien_ra" ? (
            du.can_de_len_hang ? (
              <>
                <p className="mt-3 text-sm">
                  Còn <strong className="g-so">{so(du.can_de_len_hang.diem_can, 2)}</strong> XP/người (khoảng{" "}
                  <strong className="g-so">{so(du.can_de_len_hang.xp_can)}</strong> XP cả đơn vị) để vào vùng
                  lên bậc.
                </p>
                <VachLenHang diem={toi.diem} moc={du.can_de_len_hang.diem_moc} />
              </>
            ) : toi.du_kien === "len" ? (
              <>
                <p className="mt-3 text-sm font-semibold text-ok">
                  Đang ở vùng lên bậc. Giữ vững tới Chủ nhật.
                </p>
                <VachLenHang diem={1} moc={null} />
              </>
            ) : toi.bac === 1 && toi.hang ? (
              <p className="mt-3 text-sm text-ink-2">
                Đơn vị đang ở bậc cao nhất. Giữ vị trí để không xuống bậc.
              </p>
            ) : null
          ) : null}
        </section>

        {tr && kq ? (
          <section
            className="g-the g-a g-vao-len mt-4 p-4"
            style={{ "--tre": "120ms" } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="g-tieu-de text-base font-semibold">Kết quả tuần {formatDate(tr.tuan)}</h3>
                <p className="mt-1 text-sm text-ink-2">
                  Thứ {tr.hang}/{tr.so_don_vi_xep_hang} ở bậc {tr.bac} · {tr.so_nguoi_choi}/{tr.quan_so} người
                  có XP
                </p>
              </div>
              <DauKetQua kq={kq} hoatAnh={lanDau} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <SaoTongKet so={kq === "len" ? 3 : kq === "giu" ? 2 : 1} hoatAnh={lanDau} />
              <div className="text-right">
                <SoChay den={tr.diem} thapPhan={2} ms={lanDau ? 800 : 0} className="text-2xl font-bold" />
                <span className="block text-xs text-ink-3">XP/người</span>
              </div>
            </div>
            {cfg.so_hang > 1 ? (
              <ThangHang
                soHang={cfg.so_hang}
                tu={tr.bac}
                den={tr.bac_tuan_sau}
                ten={du.don_vi_cua_toi?.ten ?? "Đơn vị của bạn"}
                hoatAnh={lanDau}
              />
            ) : null}
          </section>
        ) : null}

        {nhom ? (
          <section className="mt-5">
            <h3 className="g-tieu-de mb-2 text-base font-semibold">
              Nhóm của bạn · Bậc {nhom.bac}
              {mua.status === "dang_dien_ra" ? (
                <span className="font-normal text-ink-3"> (tính trực tiếp)</span>
              ) : null}
            </h3>
            <BangNhom nhom={nhom} soHang={cfg.so_hang} hoatAnh />
          </section>
        ) : du.ghi_chu ? (
          <p className="mt-4 rounded-xl bg-surface p-3 text-[15px] text-ink-2">{du.ghi_chu}</p>
        ) : null}

        {du.cac_nhom?.length ? (
          <section className="mt-6">
            <h3 className="g-tieu-de mb-2 text-base font-semibold">Các nhóm trong phạm vi của bạn</h3>
            <div className="space-y-2">
              {du.cac_nhom.map((n) => (
                <details key={`${n.bac}-${n.nhom}`} className="rounded-xl border border-line bg-surface">
                  <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">
                    Bậc {n.bac} · nhóm {n.nhom} ({n.items.length} đơn vị)
                  </summary>
                  <div className="p-2">
                    <BangNhom nhom={n} soHang={cfg.so_hang} hoatAnh={false} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <details className="mt-6 text-sm text-ink-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">
            Luật mùa giải
          </summary>
          <ul className="list-disc space-y-1 pl-5">
            <li>Điểm tuần = tổng XP của thành viên / quân số của đơn vị (mọi tài khoản đang hoạt động).</li>
            <li>Mỗi người tính tối đa {so(cfg.tran_xp_tuan)} XP mỗi tuần.</li>
            <li>
              Cuối tuần, trong mỗi nhóm: {cfg.so_len} đơn vị đầu lên bậc, {cfg.so_xuong} đơn vị cuối xuống
              bậc.
            </li>
            <li>
              Đơn vị dưới {cfg.toi_thieu_thanh_vien} người chưa xếp hạng. Bằng điểm thì đơn vị có nhiều người
              tham gia hơn đứng trên.
            </li>
            <li>
              Chốt tuần lúc 06:00 thứ Hai. Lượt chơi không mạng phải đồng bộ trước giờ này mới được tính.
            </li>
          </ul>
        </details>
      </div>
    </VungTroChoi>
  );
}
