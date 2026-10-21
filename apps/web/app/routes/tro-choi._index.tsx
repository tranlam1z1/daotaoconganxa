/**
 * Trò chơi, hai bố cục:
 *  - điện thoại (dưới 768px): như màn hình ứng dụng, mỗi trò là một biểu tượng trong lưới (3 cột ở
 *    360px), băng "Đang chơi dở" phía trên, danh sách "Lượt chơi gần đây" phía dưới;
 *  - web (từ 768px): lưới thẻ trò (3 cột, 4 cột từ 1024px), mỗi thẻ có biểu tượng, tên, mô tả ngắn và
 *    một nút hành động (Tiếp tục chơi / Bắt đầu ngay / Chơi lại); dưới lưới là bảng "Tiến độ & Lịch sử
 *    chơi".
 * Chạm một trò thì mở ngăn chi tiết: tấm trượt từ đáy trên điện thoại, hộp giữa màn hình từ 768px
 * (components/ui/HopThoai.tsx).
 *
 * Ngăn chi tiết:
 *  - trò trên khung lượt chơi chung (docs/PLAN.md GĐ-G0): mô tả, số liệu của tôi, nút "Chơi" tạo lượt
 *    rồi chuyển thẳng tới câu đầu tiên; trò có màn (GĐ-T1) hiện danh sách màn thay cho nút "Chơi";
 *  - "Vượt màn": danh sách chủ đề;
 *  - trò cũ có trang riêng (GĐ10–GĐ14): mô tả, kỷ lục, nút mở trang của trò. Trò cũ hiện theo cờ bật
 *    tắt trong bảng `games`.
 *
 * Ngăn đi theo tham số `?tro=<mã>`, nên nút Quay lại của điện thoại đóng ngăn, và trang chủ dẫn thẳng
 * tới ngăn của một trò. Đường cũ `#tro-choi-<mã>`, `#vuot-man` được đổi sang tham số này. Mở, đóng
 * ngăn không tải lại dữ liệu (shouldRevalidate).
 */
import { type ReactNode, useEffect, useState } from "react";
import {
  Form,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  type To,
  useLocation,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "react-router";

import { BieuTuongTro } from "../components/tro-choi/chung/BieuTuongTro";
import { ChonMan } from "../components/tro-choi/chung/ChonMan";
import { giaoDienCua } from "../components/tro-choi/giao-dien";
import { Sao } from "../components/tro-choi/KhungGame";
import { Button, ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Field";
import { HopThoai } from "../components/ui/HopThoai";
import { Icon } from "../components/ui/Icon";
import { cn } from "../lib/cn";
import { type LuotTomTat, moTaDiem, TEN_TRANG_THAI_LUOT, type TroChoiTrenKhung } from "../lib/luot-choi";
import { batDauLuot, tongQuanLuotChoi } from "../lib/luot-choi.server";
import { LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { tongQuanTroChoi } from "../lib/tro-choi.server";
import type { Route } from "./+types/tro-choi._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Trò chơi", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token } = await yeuCauDangNhap(request);
  const [cu, khung] = await Promise.all([tongQuanTroChoi(token), tongQuanLuotChoi(token)]);
  return { ...cu, khung };
}

/** Mở hoặc đóng ngăn chi tiết (chỉ đổi `?tro=`) không cần tải lại danh sách trò. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) {
    const truoc = new URLSearchParams(currentUrl.search);
    const sau = new URLSearchParams(nextUrl.search);
    truoc.delete("tro");
    sau.delete("tro");
    if (truoc.toString() === sau.toString()) return false;
  }
  return defaultShouldRevalidate;
}

/** Một chạm để vào chơi: tạo lượt rồi chuyển tới câu đầu tiên. Trang chủ cũng gửi về đây. */
export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  const f = await request.formData();
  const ma = String(f.get("ma") ?? "");
  const man = Number(f.get("man")) || null;
  try {
    const l = await batDauLuot(token, ma, man);
    return redirect(`/tro-choi/luot/${l.id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Danh sách ứng dụng                                                  */
/* ------------------------------------------------------------------ */

type UngDung =
  | { loai: "khung"; ma: string; ten: string; tro: TroChoiTrenKhung }
  | { loai: "vuot_man"; ma: "vuot_man"; ten: string }
  | { loai: "trang"; ma: string; ten: string; to: string; moTa: string; ngan: string; phu: string | null };

type DuLieu = Route.ComponentProps["loaderData"];

/** Thứ tự như carousel trang chủ (lib/trang-chu.ts): trò trên khung chung trước, trò cũ sau. */
function danhSachUngDung(d: DuLieu): UngDung[] {
  const hien = (ma: string) => d.bat?.[ma] !== false;
  const ds = d.khung.tro_choi.map((g): UngDung => ({ loai: "khung", ma: g.ma, ten: g.ten, tro: g }));
  if (hien("vuot_man")) ds.push({ loai: "vuot_man", ma: "vuot_man", ten: "Vượt màn" });
  const cu: Array<[string, Omit<Extract<UngDung, { loai: "trang" }>, "loai" | "ma">]> = [
    [
      "dua_thoi_gian",
      {
        ten: "Đua thời gian 60 giây",
        to: "/tro-choi/dua-thoi-gian",
        moTa: "Trả lời đúng nhiều câu nhất trong 60 giây.",
        ngan: "60 giây • nhiều câu nhất",
        phu: d.dua_thoi_gian.ky_luc !== null ? `Kỷ lục của bạn: ${d.dua_thoi_gian.ky_luc} câu` : null,
      },
    ],
    [
      "ghep_cap",
      {
        ten: "Ghép lỗi với mức phạt",
        to: "/tro-choi/ghep-cap",
        moTa: "Ghép 5 hành vi vi phạm với đúng mức tiền phạt.",
        ngan: "5 cặp mỗi lượt",
        phu: d.ghep_cap.ky_luc !== null ? `Tốt nhất: ${d.ghep_cap.ky_luc}/5 cặp` : null,
      },
    ],
    [
      "doan_bien_bao",
      {
        ten: "Đoán biển báo",
        to: "/tro-choi/doan-bien-bao",
        moTa: "Nhìn biển, chọn đúng tên trong 4 phương án cùng nhóm.",
        ngan: "4 phương án mỗi câu",
        phu: null,
      },
    ],
    [
      "hoi_nhanh_giong_noi",
      {
        ten: "Hỏi nhanh bằng giọng nói",
        to: "/tro-choi/hoi-nhanh-giong-noi",
        moTa: "Nghe câu hỏi, nói đáp án. Mỗi lượt 10 câu, không tính giờ.",
        ngan: "10 câu • không tính giờ",
        phu: null,
      },
    ],
  ];
  for (const [ma, u] of cu) if (hien(ma)) ds.push({ loai: "trang", ma, ...u });
  return ds;
}

/** Đường cũ `#tro-choi-<mã>` (thẻ trò có màn trên trang chủ) và `#vuot-man`. */
function maTuNeo(neo: string): string | null {
  const h = decodeURIComponent(neo.replace(/^#/, ""));
  if (h === "vuot-man") return "vuot_man";
  return h.startsWith("tro-choi-") ? h.slice("tro-choi-".length) : null;
}

/* ------------------------------------------------------------------ */
/* Trang                                                               */
/* ------------------------------------------------------------------ */

export default function TroChoi({ loaderData, actionData }: Route.ComponentProps) {
  const { khung } = loaderData;
  const ungDung = danhSachUngDung(loaderData);
  const busy = useNavigation().state !== "idle";
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const chon = ungDung.find((u) => u.ma === params.get("tro")) ?? null;
  const coOffline = khung.tro_choi.some((g) => g.offline);
  // API tách lượt đang chơi dở khỏi `gan_day`; bảng lịch sử gộp lại, lượt dở lên đầu.
  const lichSu = khung.dang_choi ? [khung.dang_choi, ...khung.gan_day] : khung.gan_day;

  // Liên kết cũ theo neo: đổi sang tham số `?tro=` để mở ngăn chi tiết.
  useEffect(() => {
    const ma = maTuNeo(location.hash);
    if (!ma) return;
    const coTro = ma === "vuot_man" || khung.tro_choi.some((g) => g.ma === ma);
    if (coTro)
      navigate({ search: `?tro=${encodeURIComponent(ma)}` }, { replace: true, preventScrollReset: true });
  }, [location.hash, khung.tro_choi, navigate]);

  // Mở từ lưới thì lùi một bước lịch sử (Quay lại và "Đóng" cùng một kết quả); mở thẳng từ liên
  // kết thì bỏ tham số.
  const dong = () => {
    if ((location.state as { tuLuoi?: boolean } | null)?.tuLuoi) navigate(-1);
    else navigate({ search: "" }, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="wrap max-w-3xl py-6 md:py-8 lg:max-w-7xl">
      <p className="hidden text-sm md:block">
        <Link to="/luyen-tap" className="inline-flex min-h-11 items-center text-primary hover:underline">
          Học & luyện tập
        </Link>
      </p>
      <h1 className="text-3xl font-semibold md:mt-2 lg:text-4xl">Trò chơi</h1>

      {actionData?.loi && !chon ? (
        <Notice tone="danger" className="mt-4">
          {actionData.loi}
        </Notice>
      ) : null}

      {/* Điện thoại (dưới 768px): băng "Đang chơi dở" và lưới biểu tượng kiểu màn hình ứng dụng. */}
      {khung.dang_choi ? (
        <Link
          to={`/tro-choi/luot/${khung.dang_choi.id}`}
          className="mt-5 flex min-h-16 items-center gap-3 rounded-2xl border border-primary bg-primary-soft p-3 md:hidden"
        >
          <BieuTuongTro ma={khung.dang_choi.game_code} co={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink-2">Đang chơi dở</span>
            <span className="line-clamp-2 text-base font-semibold leading-snug">
              {khung.dang_choi.ten_tro_choi}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
            Chơi tiếp
          </span>
        </Link>
      ) : null}

      <section aria-label="Danh sách trò chơi" className="mt-6">
        {ungDung.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="puzzle" title="Chưa có trò chơi nào đang mở" />
          </div>
        ) : (
          <>
            {/* Điện thoại: biểu tượng 100px, 3 cột; đủ chỗ thì 4–5 cột. */}
            <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3 min-[460px]:grid-cols-4 sm:grid-cols-5 md:hidden">
              {ungDung.map((u) => (
                <OUngDung key={u.ma} u={u} />
              ))}
            </ul>
            {/* Từ 768px: lưới thẻ có nút hành động. */}
            <ul className="hidden gap-4 md:grid md:grid-cols-3 lg:grid-cols-4">
              {ungDung.map((u) => (
                <TheTroChoi key={u.ma} u={u} d={loaderData} busy={busy} />
              ))}
            </ul>
          </>
        )}
        {coOffline ? (
          <p className="mt-3 text-center text-sm lg:text-left">
            <Link to="/tro-choi/offline" className="inline-flex min-h-11 items-center text-primary underline">
              Chơi khi không có mạng
            </Link>
          </p>
        ) : null}
      </section>

      {khung.gan_day.length ? (
        <section aria-labelledby="gan-day" className="mt-8 md:hidden">
          <h2 id="gan-day" className="font-sans text-lg font-semibold">
            Lượt chơi gần đây
          </h2>
          <ul className="mt-3 grid gap-2">
            {khung.gan_day.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/tro-choi/luot/${l.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 dong-bam"
                >
                  <BieuTuongTro ma={l.game_code} co={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{l.ten_tro_choi}</span>
                    <span className="block text-sm text-ink-2">
                      {/* thoiGian() cố định múi giờ: toLocaleString() in theo múi giờ của máy nên máy chủ và
                          trình duyệt ra hai chuỗi khác nhau (lỗi hydrate React #418). */}
                      {thoiGian(l.played_at)}
                      {l.offline ? " · chơi offline" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {l.status === "bo_do" ? (
                      <span className="text-ink-2">{TEN_TRANG_THAI_LUOT[l.status]}</span>
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {moTaDiem(l.score ?? 0, l.max_score ?? 0)}
                        {l.xp ? <span className="block font-normal text-primary">+{l.xp} XP</span> : null}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lichSu.length ? <LichSu ds={lichSu} coTro={(ma) => ungDung.some((u) => u.ma === ma)} /> : null}

      <HopThoai mo={Boolean(chon)} tieuDe={chon?.ten ?? ""} onDong={dong}>
        {chon ? (
          <NganChiTiet key={chon.ma} u={chon} d={loaderData} busy={busy} loi={actionData?.loi ?? null} />
        ) : null}
      </HopThoai>
    </div>
  );
}

/** Điện thoại: một biểu tượng trong lưới. Tên liên kết đúng bằng tên trò (ảnh có alt rỗng). */
function OUngDung({ u }: { u: UngDung }) {
  return (
    // id: đích của liên kết cũ theo neo (/tro-choi#tro-choi-<mã>).
    <li id={`tro-choi-${u.ma}`} className="flex scroll-mt-20">
      <Link
        to={{ search: `?tro=${encodeURIComponent(u.ma)}` }}
        state={{ tuLuoi: true }}
        preventScrollReset
        className="dong-bam [--lun:0.95] flex w-full flex-col items-center gap-2 rounded-2xl px-1 pt-2 pb-2.5 text-center"
      >
        <BieuTuongTro ma={u.ma} co={100} />
        <span className="line-clamp-2 text-sm font-medium leading-snug">{u.ten}</span>
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Thẻ trò chơi (từ 768px)                                             */
/* ------------------------------------------------------------------ */

/** Nút nền xám của thẻ (Bắt đầu ngay / Chơi lại); viết riêng vì cn không gộp được lớp màu trùng. */
const NUT_XAM =
  "inline-flex min-h-11 w-full items-center justify-center rounded-btn bg-surface-2 px-3 text-sm font-semibold text-ink lun hover:bg-line disabled:opacity-50";

/** Dòng mô tả ngắn dưới tên trò, kiểu "10 câu • 3 màn". */
function moTaNgan(u: UngDung, d: DuLieu): string {
  if (u.loai === "trang") return u.ngan;
  if (u.loai === "vuot_man") return `${d.vuot_man.length} chủ đề • 10 câu mỗi màn`;
  const g = u.tro;
  const tenBuoc = (giaoDienCua(g.ma)?.tenBuoc ?? "Câu").toLowerCase();
  const phan = [`${g.so_buoc} ${tenBuoc}`];
  if (g.man) phan.push(`${g.man.length} màn`);
  else if (g.giay_moi_buoc) phan.push(`${g.giay_moi_buoc} giây mỗi ${tenBuoc}`);
  return phan.join(" • ");
}

/**
 * Thẻ một trò. Tên trò mở ngăn chi tiết. Nút: "Tiếp tục chơi" khi trò đang có lượt dở; trò không có
 * màn thì bấm là vào chơi luôn; trò có màn, "Vượt màn" mở ngăn để chọn; trò cũ mở trang riêng.
 */
function TheTroChoi({ u, d, busy }: { u: UngDung; d: DuLieu; busy: boolean }) {
  const dangChoi = d.khung.dang_choi?.game_code === u.ma ? d.khung.dang_choi : null;
  const daChoi =
    u.loai === "khung" ? u.tro.hom_nay > 0 || u.tro.tot_nhat !== null : u.loai === "trang" && u.phu !== null;
  const nhan = daChoi ? "Chơi lại" : "Bắt đầu ngay";
  const moNgan = { search: `?tro=${encodeURIComponent(u.ma)}` };
  const tenDoc = <span className="sr-only">: {u.ten}</span>;

  let nut: ReactNode;
  if (dangChoi)
    nut = (
      <ButtonLink to={`/tro-choi/luot/${dangChoi.id}`} className="w-full">
        Tiếp tục chơi
        {tenDoc}
      </ButtonLink>
    );
  else if (u.loai === "khung" && !u.tro.man)
    nut = (
      <Form method="post">
        <input type="hidden" name="ma" value={u.ma} />
        <button type="submit" className={NUT_XAM} disabled={busy}>
          {nhan}
          {tenDoc}
        </button>
      </Form>
    );
  else if (u.loai === "trang")
    nut = (
      <Link to={u.to} className={NUT_XAM}>
        {nhan}
        {tenDoc}
      </Link>
    );
  else
    nut = (
      <Link to={moNgan} state={{ tuLuoi: true }} preventScrollReset className={NUT_XAM}>
        {u.loai === "vuot_man" ? "Chọn chủ đề" : "Chọn màn"}
        {tenDoc}
      </Link>
    );

  return (
    // Không mang id neo: id `tro-choi-<mã>` đã nằm ở ô biểu tượng của lưới điện thoại.
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <Link to={moNgan} state={{ tuLuoi: true }} preventScrollReset className="group flex flex-col gap-3">
        <BieuTuongTro ma={u.ma} co={48} />
        <span className="min-w-0">
          <span className="block text-base font-semibold leading-snug break-words group-hover:text-primary">
            {u.ten}
          </span>
          <span className="mt-1 block text-sm text-ink-2">{moTaNgan(u, d)}</span>
        </span>
      </Link>
      <div className="mt-auto">{nut}</div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Tiến độ & lịch sử chơi                                              */
/* ------------------------------------------------------------------ */

/** Số dòng hiện trước khi bấm "Xem tất cả" (API trả tối đa 10 lượt gần nhất). */
const XEM_TRUOC = 5;

const TRANG_THAI: Record<LuotTomTat["status"], { ten: string; sac: string }> = {
  dang_choi: { ten: "Đang dở dang", sac: "bg-muted-soft text-muted" },
  bo_do: { ten: "Bỏ dở", sac: "bg-muted-soft text-muted" },
  het_gio: { ten: "Hết giờ", sac: "bg-warn-soft text-warn" },
  xong: { ten: "Hoàn thành", sac: "bg-ok-soft text-ok" },
};

// Cố định múi giờ để máy chủ và trình duyệt in cùng một chuỗi.
const GIO = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});
const NGAY = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** "09:50 - 05/10/2026". */
function thoiGian(iso: string): string {
  const t = new Date(iso);
  return `${GIO.format(t)} - ${NGAY.format(t)}`;
}

function NhanTrangThai({ s }: { s: LuotTomTat["status"] }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        TRANG_THAI[s].sac,
      )}
    >
      {TRANG_THAI[s].ten}
    </span>
  );
}

function KetQua({ l }: { l: LuotTomTat }) {
  if (l.status === "bo_do" || l.max_score == null) return <span className="text-ink-3">--</span>;
  const diem = `${moTaDiem(l.score ?? 0, l.max_score)} điểm`;
  if (l.status === "dang_choi") return <span className="tabular-nums">{diem}</span>;
  return (
    <span className="font-semibold tabular-nums text-ok">
      {diem}
      {l.xp ? ` (+${l.xp} XP)` : ""}
    </span>
  );
}

interface ThaoTac {
  nhan: string;
  to: To;
  /** Mở ngăn chi tiết từ trang này (Quay lại đóng ngăn). */
  moNgan: boolean;
  chinh: boolean;
}

/** Lượt dở: chơi tiếp; lượt bỏ dở: mở ngăn trò để chơi lượt mới; lượt đã kết thúc: xem lại. */
function thaoTacCua(l: LuotTomTat, coTro: (ma: string) => boolean): ThaoTac | null {
  if (l.status === "dang_choi")
    return { nhan: "Chơi tiếp", to: `/tro-choi/luot/${l.id}`, moNgan: false, chinh: true };
  if (l.status === "bo_do")
    return coTro(l.game_code)
      ? {
          nhan: "Chơi lại",
          to: { search: `?tro=${encodeURIComponent(l.game_code)}` },
          moNgan: true,
          chinh: true,
        }
      : null;
  return { nhan: "Xem lại", to: `/tro-choi/luot/${l.id}`, moNgan: false, chinh: false };
}

function LienKetThaoTac({ l, coTro }: { l: LuotTomTat; coTro: (ma: string) => boolean }) {
  const t = thaoTacCua(l, coTro);
  if (!t) return null;
  return (
    <Link
      to={t.to}
      state={t.moNgan ? { tuLuoi: true } : undefined}
      preventScrollReset={t.moNgan}
      className={cn(
        "inline-flex min-h-11 items-center font-medium hover:underline",
        t.chinh ? "text-info" : "text-ink-2",
      )}
    >
      {t.nhan}
      <span className="sr-only">: {l.ten_tro_choi}</span>
    </Link>
  );
}

/** Chỉ hiện từ 768px; điện thoại giữ danh sách "Lượt chơi gần đây". */
function LichSu({ ds, coTro }: { ds: LuotTomTat[]; coTro: (ma: string) => boolean }) {
  const [tatCa, setTatCa] = useState(false);
  const hien = tatCa ? ds : ds.slice(0, XEM_TRUOC);
  const o = "px-3 py-3.5";
  return (
    <section
      aria-labelledby="lich-su"
      className="mt-8 hidden rounded-card border border-line bg-surface p-6 shadow-card md:block"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="lich-su" className="font-sans text-lg font-semibold">
          Tiến độ & Lịch sử chơi
        </h2>
        {ds.length > XEM_TRUOC ? (
          <button
            type="button"
            onClick={() => setTatCa((v) => !v)}
            aria-expanded={tatCa}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {tatCa ? "Thu gọn" : "Xem tất cả"}
            <Icon name={tatCa ? "chevronDown" : "chevronRight"} kieu="net" className="size-4" />
          </button>
        ) : null}
      </div>

      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line-strong text-ink-2">
            <th scope="col" className="px-3 py-3 font-medium">
              Tên trò chơi
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Thời gian
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Kết quả
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Trạng thái
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          {hien.map((l) => (
            <tr key={l.id} className="border-b border-line last:border-0">
              <th scope="row" className={cn(o, "font-semibold")}>
                {l.ten_tro_choi}
              </th>
              <td className={cn(o, "tabular-nums whitespace-nowrap")}>
                {thoiGian(l.played_at)}
                {l.offline ? <span className="text-ink-3"> · offline</span> : null}
              </td>
              <td className={o}>
                <KetQua l={l} />
              </td>
              <td className={o}>
                <NhanTrangThai s={l.status} />
              </td>
              <td className="px-3 py-1">
                <LienKetThaoTac l={l} coTro={coTro} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ngăn chi tiết                                                       */
/* ------------------------------------------------------------------ */

function DauNgan({ u, moTa }: { u: UngDung; moTa: string }) {
  return (
    <div className="flex items-start gap-4">
      <BieuTuongTro ma={u.ma} co={64} />
      <p className="min-w-0 pt-1 text-[15px] leading-relaxed text-ink-2">{moTa}</p>
    </div>
  );
}

function SoLieu({ muc }: { muc: Array<[string, ReactNode]> }) {
  if (!muc.length) return null;
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2">
      {muc.map(([nhan, giaTri]) => (
        <div key={nhan} className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-sm text-ink-2">{nhan}</dt>
          <dd className="mt-0.5 font-semibold">{giaTri}</dd>
        </div>
      ))}
    </dl>
  );
}

function NganChiTiet({ u, d, busy, loi }: { u: UngDung; d: DuLieu; busy: boolean; loi: string | null }) {
  const thongBao = loi ? (
    <Notice tone="danger" className="mt-4">
      {loi}
    </Notice>
  ) : null;

  if (u.loai === "khung") {
    const g = u.tro;
    const tenBuoc = (giaoDienCua(g.ma)?.tenBuoc ?? "Câu").toLowerCase();
    const muc: Array<[string, ReactNode]> = [["Mỗi lượt", `${g.so_buoc} ${tenBuoc}`]];
    if (g.man) muc.push(["Số màn", `${g.man.filter((m) => m.da_mo).length}/${g.man.length} đã mở`]);
    if (g.giay_moi_buoc) muc.push(["Thời gian", `${g.giay_moi_buoc} giây mỗi ${tenBuoc}`]);
    muc.push(["Hôm nay", `${g.hom_nay} lượt`]);
    if (g.sao_tot_nhat) muc.push(["Tốt nhất", <Sao key="sao" so={g.sao_tot_nhat} />]);
    return (
      <>
        <DauNgan u={u} moTa={g.mo_ta} />
        <SoLieu muc={muc} />
        {thongBao}
        {g.man ? (
          <>
            <h3 className="mt-5 font-sans text-base font-semibold">Chọn màn</h3>
            <ChonMan ma={g.ma} man={g.man} busy={busy} />
          </>
        ) : (
          <Form method="post" className="mt-5">
            <input type="hidden" name="ma" value={g.ma} />
            <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>
              Chơi
            </Button>
          </Form>
        )}
        {g.offline ? (
          <p className="mt-3 text-center text-sm">
            <Link to="/tro-choi/offline" className="inline-flex min-h-11 items-center text-primary underline">
              Tải về để chơi khi không có mạng
            </Link>
          </p>
        ) : null}
      </>
    );
  }

  if (u.loai === "vuot_man") {
    const coId = new Set(d.vuot_man.map((t) => t.id));
    return (
      <>
        <DauNgan u={u} moTa="Mỗi màn 10 câu, từ dễ tới khó. Đúng từ 8 câu trở lên thì mở màn tiếp theo." />
        <h3 className="mt-5 font-sans text-base font-semibold">Chọn chủ đề</h3>
        {d.vuot_man.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="trophy" title="Chưa có chủ đề nào đủ câu hỏi để chơi" />
          </div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {d.vuot_man.map((t) => (
              <li key={t.id} className={cn(t.parent_id && coId.has(t.parent_id) && "ml-4 sm:ml-6")}>
                <Link
                  to={`/tro-choi/vuot-man/${t.code}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2 dong-bam"
                >
                  <span className="min-w-0 text-base font-medium">{t.name}</span>
                  <span className="shrink-0 text-sm text-ink-2">{t.so_man} màn</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <DauNgan u={u} moTa={u.moTa} />
      {u.phu ? <p className="mt-3 text-base font-medium text-primary">{u.phu}</p> : null}
      <ButtonLink to={u.to} className="mt-5 min-h-12 w-full text-base">
        Mở trò chơi
      </ButtonLink>
    </>
  );
}
