/**
 * Mục "Tra cứu": hai tab Tra cứu biển báo · Tra cứu hành vi (mức phạt), mỗi tab có ô tìm (gõ hoặc
 * nói), chip lọc và danh sách thẻ. Tab biển báo hiện hết biển ngay khi mở, chưa cần nhập; tab hành vi
 * chỉ hiện danh sách sau khi tra hoặc chọn chủ đề (xem `daTra` trong loader). Bấm một thẻ thì thẻ mở
 * rộng ngay tại chỗ (`?ma=`).
 * Tab hành vi có thêm lưới "Tra cứu theo chủ đề" (`?cd=`), hiện khi ô tìm trống và chưa chọn chủ đề:
 * xóa hết chữ trong ô là lưới hiện ngay, không chờ bấm Tra cứu.
 * Tốc độ, quy trình, văn bản và trợ lý AI là liên kết ở cuối trang.
 */
import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigation, useSearchParams } from "react-router";
import { CanCuBienBao } from "../components/tra-cuu/CanCuBienBao";
import { OTimTraCuu } from "../components/tra-cuu/OTimTraCuu";
import { ChiTietMucPhat } from "../components/tra-cuu/TheMucPhat";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon, type IconName } from "../components/ui/Icon";
import { type BienBao, laNhomBienBao, type NhomBienBao, timBienBao } from "../lib/bien-bao";
import { cn } from "../lib/cn";
import { todayIso } from "../lib/format";
import { pageMeta } from "../lib/site";
import {
  CHU_DE_MUC_PHAT,
  khoangTien,
  LOAI_XE,
  laLoaiXe,
  type MucPhat,
  timMucPhat,
} from "../lib/tra-cuu-nhanh";
import type { Route } from "./+types/tra-cuu";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra cứu", {
    description: "Tra biển báo đường bộ và mức xử phạt theo hành vi; kèm căn cứ để đối chiếu.",
  });
}

type Tab = "bien-bao" | "hanh-vi";

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim().slice(0, 100);
  const ma = p.get("ma");
  if (p.get("tab") === "hanh-vi") {
    const xeRaw = p.get("xe");
    const xe = laLoaiXe(xeRaw) ? xeRaw : "";
    const cdRaw = p.get("cd");
    const chuDe = CHU_DE_MUC_PHAT.find((c) => c.ma === cdRaw) ?? null;
    // Lưới chủ đề cần số đếm nên luôn gọi API, kể cả khi chưa tra.
    const { items: moiXe } = await timMucPhat({ q: q || undefined, ngay: todayIso() });
    // Kho mức phạt chỉ vài trăm dòng: lấy cả rồi đếm, lọc loại xe và chủ đề ở đây, khỏi thêm tham số
    // cho API. Giữ dòng của loại xe khác để phân biệt "bộ lọc không ra dòng nào" với "chưa có dữ liệu".
    const items = xe ? moiXe.filter((m) => m.xe === xe) : moiXe;
    const thuocChuDe = (m: MucPhat) => !chuDe || chuDeCua(m) === chuDe.ten;
    const demChuDe: Record<string, number> = {};
    for (const m of items) demChuDe[chuDeCua(m)] = (demChuDe[chuDeCua(m)] ?? 0) + 1;
    // Tab hành vi: ô trống thì hiện lưới chủ đề thay cho danh sách tất cả mức phạt.
    const daTra = q !== "" || chuDe !== null;
    return {
      tab: "hanh-vi" as const,
      q,
      daTra,
      loc: xe,
      chuDe,
      demChuDe,
      mucPhat: !daTra ? [] : items.filter(thuocChuDe),
      coXeKhac: daTra && xe !== "" && !items.some(thuocChuDe) && moiXe.some(thuocChuDe),
      bienBao: [],
      nhomCoBien: [],
      khongThay: cdRaw && !chuDe ? `Không tìm thấy chủ đề “${cdRaw.slice(0, 50)}”.` : null,
      ma,
      xemBanNhap: false,
    };
  }

  const nhomRaw = p.get("nhom");
  const nhom = laNhomBienBao(nhomRaw) ? nhomRaw : "";
  // Tab biển báo: chưa nhập gì vẫn hiện hết biển (theo nhóm đang chọn), không chờ bấm Tra cứu.
  // Lấy cả kho (vài trăm biển) rồi lọc nhóm ở đây: chip chỉ hiện nhóm đã có biển, và biết được mã,
  // nhóm trên đường dẫn có thật hay không.
  const [tatCa, theoTu] = await Promise.all([timBienBao({}), q ? timBienBao({ q }) : null]);
  const items = (theoTu ?? tatCa).items.filter((b) => !nhom || b.nhom === nhom);
  return {
    tab: "bien-bao" as const,
    q,
    daTra: true,
    loc: nhom,
    chuDe: null,
    demChuDe: {},
    mucPhat: [],
    coXeKhac: false,
    bienBao: items,
    nhomCoBien: [...new Set(tatCa.items.map((b) => b.nhom))],
    khongThay:
      nhomRaw && !nhom
        ? `Không tìm thấy nhóm biển báo “${nhomRaw.slice(0, 50)}”.`
        : ma && !tatCa.items.some((b) => b.ma === ma)
          ? `Không tìm thấy biển báo “${ma.slice(0, 50)}”.`
          : null,
    ma,
    xemBanNhap: tatCa.ban_nhap,
  };
}

/** Chủ đề của một dòng; nhóm lạ (chưa đổi theo danh sách) tính vào "Khác". */
function chuDeCua(m: MucPhat): string {
  return CHU_DE_MUC_PHAT.some((c) => c.ten === m.nhom) ? m.nhom! : "Khác";
}

const TAB: Array<{ value: Tab; label: string; icon: IconName }> = [
  { value: "bien-bao", label: "Tra cứu biển báo", icon: "sign" },
  { value: "hanh-vi", label: "Tra cứu hành vi", icon: "moto" },
];

/** Tên nhóm đầy đủ theo QCVN 41:2024/BGTVT cho chip lọc. */
const TEN_NHOM: Record<NhomBienBao, string> = {
  cam: "Biển báo cấm",
  nguy_hiem: "Biển báo nguy hiểm và cảnh báo",
  hieu_lenh: "Biển hiệu lệnh",
  chi_dan: "Biển chỉ dẫn",
  phu: "Biển phụ",
};

export default function TraCuu({ loaderData }: Route.ComponentProps) {
  const {
    tab,
    q,
    daTra,
    loc,
    chuDe,
    demChuDe,
    mucPhat,
    coXeKhac,
    bienBao,
    nhomCoBien,
    khongThay,
    ma,
    xemBanNhap,
  } = loaderData;
  const [params] = useSearchParams();
  const busy = useNavigation().state === "loading";
  // Ô tìm đang trống (theo chữ đang gõ, không chờ bấm Tra cứu); tra xong thì lấy lại theo `q`.
  const [oTrong, setOTrong] = useState(!q);
  useEffect(() => setOTrong(!q), [q]);

  const hrefVoi = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return s ? `?${s}` : "?";
  };

  const laBienBao = tab === "bien-bao";
  const khoaLoc = laBienBao ? "nhom" : "xe";
  const chip = laBienBao
    ? [
        { value: "", label: "Tất cả" },
        // Nhóm chưa có biển nào trong kho thì không hiện chip.
        ...Object.entries(TEN_NHOM)
          .filter(([value]) => nhomCoBien.includes(value as NhomBienBao))
          .map(([value, label]) => ({ value, label })),
      ]
    : [{ value: "", label: "Tất cả" }, ...LOAI_XE];
  const soKetQua = laBienBao ? bienBao.length : mucPhat.length;
  const tenXeDangLoc = LOAI_XE.find((x) => x.value === loc)?.label.toLowerCase() ?? "loại xe này";
  // Tab hành vi, ô trống, chưa chọn chủ đề: hiện lưới chủ đề, ẩn kết quả của từ khóa vừa xóa.
  const hienLuoi = !laBienBao && !chuDe && oTrong;

  return (
    <div className="wrap max-w-3xl py-6 sm:py-10">
      <h1 className="sr-only">Tra cứu</h1>

      <nav aria-label="Loại tra cứu" className="rounded-2xl border border-line bg-surface p-1 shadow-card">
        <ul className="grid grid-cols-2 gap-1">
          {TAB.map((t) => {
            const chon = t.value === tab;
            return (
              <li key={t.value}>
                <Link
                  to={t.value === "bien-bao" ? "/tra-cuu" : "/tra-cuu?tab=hanh-vi"}
                  aria-current={chon ? "page" : undefined}
                  className={cn(
                    "lun flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-1 text-[15px] font-semibold whitespace-nowrap sm:gap-2 sm:text-base",
                    chon ? "bg-primary text-on-primary shadow-card" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {/* Kiểu nét vẽ bằng currentColor: trắng trên tab đang chọn, xám ở tab còn lại. */}
                  <Icon name={t.icon} kieu="net" className="size-5 sm:size-6" />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4">
        <OTimTraCuu
          q={q}
          loai={tab}
          nhan={laBienBao ? "Tên hoặc mã biển báo" : "Hành vi vi phạm"}
          placeholder={laBienBao ? "Nhập thông tin biển báo" : "Nhập hành vi vi phạm"}
          giu={{ tab: laBienBao ? "" : "hanh-vi", [khoaLoc]: loc, cd: chuDe?.ma ?? "" }}
          onDoiTrong={setOTrong}
        />
      </div>

      {/* Chip tự xuống dòng khi không đủ chiều rộng, để tên nhóm dài không bị cắt ở mép phải. */}
      <nav aria-label={laBienBao ? "Nhóm biển báo" : "Loại xe"} className="mt-2">
        <ul className="flex flex-wrap gap-2 py-1">
          {chip.map((c) => {
            const chon = c.value === loc;
            return (
              <li key={c.value}>
                <Link
                  to={hrefVoi({ [khoaLoc]: c.value || null, ma: null })}
                  aria-current={chon ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-2xl border px-4 text-base",
                    chon
                      ? "border-2 border-primary bg-primary-soft font-semibold text-primary"
                      : "border-line-strong bg-surface text-ink-2 dong-bam",
                  )}
                >
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {khongThay ? (
        <p role="status" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {khongThay} Dưới đây là danh sách chung.
        </p>
      ) : null}

      {xemBanNhap ? (
        <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          Đang xem cả biển bản nháp, chưa được đối chiếu với QCVN 41:2024/BGTVT.
        </p>
      ) : null}

      {chuDe ? (
        <p className="mt-2 flex">
          <Link
            to={hrefVoi({ cd: null, ma: null })}
            aria-label={`Bỏ lọc chủ đề ${chuDe.ten}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border-2 border-primary bg-primary-soft pr-3 pl-4 text-base font-semibold text-primary"
          >
            <Icon name={chuDe.icon} kieu="net" className="size-5" />
            {chuDe.ten}
            <Icon name="close" kieu="net" className="size-5" />
          </Link>
        </p>
      ) : hienLuoi ? (
        // Bỏ `q` cũ trên URL: ô đã trống thì chủ đề không lọc thêm theo từ khóa vừa xóa.
        <LuoiChuDe dem={demChuDe} href={(cd) => hrefVoi({ cd, ma: null, q: null })} />
      ) : null}

      <div className={cn("mt-4", busy && "opacity-60")} aria-busy={busy}>
        {!daTra || hienLuoi ? null : soKetQua === 0 ? (
          <EmptyState
            icon="search"
            title={
              q
                ? `Không có kết quả khớp “${q}”`
                : laBienBao
                  ? "Chưa có biển báo nào"
                  : coXeKhac
                    ? `Không có mức phạt cho ${tenXeDangLoc} ${chuDe ? "trong chủ đề này" : "trong kho"}`
                    : chuDe
                      ? `Chưa có mức phạt cho chủ đề “${chuDe.ten}”`
                      : "Chưa có mức phạt nào"
            }
          >
            {laBienBao ? (
              !q ? (
                <p>Biển báo hiện ra sau khi biên tập viên đối chiếu với QCVN 41:2024/BGTVT và duyệt.</p>
              ) : null
            ) : coXeKhac ? (
              // Bộ lọc loại xe làm rỗng kết quả, không phải chủ đề thiếu dữ liệu.
              <p>
                {chuDe ? "Chủ đề này" : "Từ khóa này"} có mức phạt cho loại xe khác.{" "}
                <Link to={hrefVoi({ xe: null, ma: null })} className="text-primary underline">
                  Bỏ lọc loại xe
                </Link>
                .
              </p>
            ) : (
              <p>
                {chuDe && !q ? "Chủ đề này đang được biên tập." : "Thử từ khóa ngắn hơn hoặc chọn “Tất cả”."}{" "}
                {chuDe?.ma === CHU_DE_CO_CONG_CU.ma ? (
                  <>
                    Trong lúc này, hãy dùng{" "}
                    <Link to={CHU_DE_CO_CONG_CU.to} className="text-primary underline">
                      công cụ tính mức xử phạt nồng độ cồn
                    </Link>
                    .{" "}
                  </>
                ) : null}
                Bạn cũng có thể{" "}
                <Link
                  to={`/tim-kiem?q=${encodeURIComponent(q || chuDe?.ten || "")}`}
                  className="text-primary underline"
                >
                  tra nguyên văn trong văn bản
                </Link>
                .
              </p>
            )}
          </EmptyState>
        ) : (
          <>
            <p className="text-base text-ink-2" aria-live="polite">
              Có{" "}
              <strong className="font-semibold text-primary">
                {soKetQua.toLocaleString("vi-VN")} kết quả
              </strong>{" "}
              được tìm thấy
            </p>
            <ul className="mt-3 grid gap-3">
              {laBienBao
                ? bienBao.map((b) => (
                    <TheBienBao
                      key={b.ma}
                      b={b}
                      mo={b.ma === ma}
                      href={hrefVoi({ ma: b.ma === ma ? null : b.ma })}
                    />
                  ))
                : mucPhat.map((m) => (
                    <TheHanhVi
                      key={m.ma}
                      m={m}
                      mo={m.ma === ma}
                      href={hrefVoi({ ma: m.ma === ma ? null : m.ma })}
                    />
                  ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Chủ đề đã có công cụ tính riêng: khi chưa có mức phạt được duyệt thì ô chủ đề dẫn sang công cụ. */
const CHU_DE_CO_CONG_CU = { ma: "nong-do-con", to: "/cong-cu/nong-do-con" };

/**
 * Lưới chủ đề mức phạt, mỗi ô ghi số mức phạt. Chủ đề chưa có mức phạt nào được duyệt thì ẩn, trừ
 * chủ đề đã có công cụ tính (dẫn sang công cụ).
 */
function LuoiChuDe({ dem, href }: { dem: Record<string, number>; href: (cd: string) => string }) {
  const o = CHU_DE_MUC_PHAT.map((c) => ({ c, n: dem[c.ten] ?? 0 })).filter(
    ({ c, n }) => n > 0 || c.ma === CHU_DE_CO_CONG_CU.ma,
  );
  return (
    <section aria-labelledby="tc-chu-de" className="mt-4">
      <h2 id="tc-chu-de" className="font-sans text-lg font-semibold">
        Tra cứu theo chủ đề
      </h2>
      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {o.map(({ c, n }) => {
          return (
            <li key={c.ma}>
              <Link
                to={n ? href(c.ma) : CHU_DE_CO_CONG_CU.to}
                className="flex h-full min-h-28 flex-col items-center rounded-2xl border border-line bg-surface px-1.5 py-3 text-center shadow-card the-bam"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary-soft">
                  <Icon name={c.icon} className="size-6" />
                </span>
                <span className="mt-2 text-sm leading-snug font-semibold">{c.ten}</span>
                <span className="mt-auto pt-1 text-xs text-ink-3">
                  {n ? `${n} mức phạt` : "Công cụ tính"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Khung thẻ chung: ô ảnh bên trái, chữ bên phải; phần mở rộng nằm dưới, ngoài liên kết. */
function KhungThe({
  mo,
  href,
  hinh,
  tieuDe,
  children,
  moRong,
}: {
  mo: boolean;
  href: string;
  hinh: ReactNode;
  tieuDe: ReactNode;
  children: ReactNode;
  moRong: ReactNode;
}) {
  return (
    <li
      className={cn(
        "rounded-2xl border bg-surface shadow-card",
        mo ? "border-primary ring-2 ring-primary" : "border-line",
      )}
    >
      <Link
        to={href}
        preventScrollReset
        aria-expanded={mo}
        className="flex gap-4 rounded-2xl p-3 sm:p-4 dong-bam"
      >
        <span className="grid size-22 shrink-0 place-items-center self-center rounded-xl border border-line bg-surface-2">
          {hinh}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold leading-snug">{tieuDe}</span>
          {children}
        </span>
      </Link>
      {mo ? <div className="border-t border-line px-4 pt-1 pb-4">{moRong}</div> : null}
    </li>
  );
}

function TheBienBao({ b, mo, href }: { b: BienBao; mo: boolean; href: string }) {
  return (
    <KhungThe
      mo={mo}
      href={href}
      hinh={
        <img
          src={`/bien-bao/anh/${encodeURIComponent(b.anh)}`}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="size-16"
        />
      }
      tieuDe={
        <>
          Biển số {b.ma} “{b.ten}”
        </>
      }
      moRong={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CanCuBienBao b={b} />
          {b.ban_nhap ? <Badge tone="warn">Bản nháp</Badge> : null}
        </div>
      }
    >
      <span className={cn("mt-1 block text-base leading-relaxed text-ink-2", !mo && "line-clamp-4")}>
        {b.y_nghia}
      </span>
    </KhungThe>
  );
}

function TheHanhVi({ m, mo, href }: { m: MucPhat; mo: boolean; href: string }) {
  return (
    <KhungThe
      mo={mo}
      href={href}
      hinh={<Icon name={m.xe === "o_to" ? "car" : "moto"} className="size-12" />}
      tieuDe={<span className={cn(!mo && "line-clamp-3")}>{m.hanhVi}</span>}
      moRong={<ChiTietMucPhat muc={m} />}
    >
      <span className="mt-1 block text-sm text-ink-3">
        {m.tenXe}
        {m.nhom ? ` · ${m.nhom}` : null}
      </span>
      {mo ? null : (
        <span className="mt-1 block text-base font-semibold text-danger">
          {khoangTien(m.phatTu, m.phatDen)}
        </span>
      )}
      {m.banNhap ? <Badge tone="warn">Bản nháp</Badge> : null}
    </KhungThe>
  );
}
