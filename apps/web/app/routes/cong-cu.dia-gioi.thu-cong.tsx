/**
 * Chuyển đổi thủ công: chọn tỉnh → huyện → xã cũ (huyện, xã không bắt buộc), nhập thêm thôn/xóm và
 * địa chỉ chi tiết, ra đơn vị hành chính hiện nay và địa chỉ đầy đủ theo địa giới mới. Thôn/xóm đổi
 * sang tên mới khi xã có dữ liệu sắp xếp thôn và tên nhập khớp đúng một thôn mới; không thì giữ tên đã
 * nhập kèm lý do.
 *
 * Biểu mẫu GET: đổi tỉnh hoặc huyện thì gửi lại ngay (không kèm `xem`) để nạp danh sách cấp dưới;
 * bấm "Chuyển đổi địa chỉ" mới kèm `xem=1` và ra kết quả. Không có JavaScript thì bấm nút để nạp.
 */
import { type ChangeEvent, type ReactNode, useEffect } from "react";
import { Form, Link, useNavigation, useSubmit } from "react-router";
import {
  BangDiaChi,
  DongDiaChi,
  GhiChuNguon,
  NutLichSuDiaGioi,
  OBieuTuong,
} from "../components/dia-gioi/ChungDiaGioi";
import { Notice } from "../components/ui/Field";
import { Icon, type IconName } from "../components/ui/Icon";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import {
  chuyenDoi,
  DUONG_DIA_GIOI,
  dsHuyenCu,
  dsTinhCu,
  dsXaCu,
  type KetQuaChuyenDoi,
  type KetQuaThon,
  layNguon,
  noiDiaChi,
} from "../lib/dia-gioi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.dia-gioi.thu-cong";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Chuyển đổi thủ công", { index: false });
}

export async function loader({ request }: Route.LoaderArgs) {
  const p = new URL(request.url).searchParams;
  const chon = <T extends { ma: string }>(ds: T[], v: string | null) =>
    ds.some((x) => x.ma === v) ? v! : "";

  const dsTinh = await dsTinhCu();
  const tinh = chon(dsTinh, p.get("tinh"));
  const dsHuyen = tinh ? await dsHuyenCu(tinh) : [];
  const huyen = chon(dsHuyen, p.get("huyen"));
  const dsXa = huyen ? await dsXaCu(huyen) : [];
  const xa = chon(dsXa, p.get("xa"));
  const form = {
    tinh,
    huyen,
    xa,
    thon: (p.get("thon") ?? "").trim().slice(0, 100),
    chiTiet: (p.get("chi_tiet") ?? "").trim().slice(0, 200),
  };
  const chung = { dsTinh, dsHuyen, dsXa, form, kq: null, nguon: null, loi: null };

  if (p.get("xem") !== "1") return chung;
  if (!tinh) return { ...chung, loi: "Chọn tỉnh/thành phố cũ." };
  const [kq, nguon] = await Promise.all([
    chuyenDoi({ tinh, huyen: huyen || undefined, xa: xa || undefined, thon: form.thon || undefined }),
    layNguon().catch(() => null),
  ]);
  return { ...chung, kq, nguon };
}

/** Một ô nhập đánh số: số thứ tự, biểu tượng, nhãn, rồi ô chọn hoặc ô gõ. */
function OTruong({
  so,
  icon,
  nhan,
  htmlFor,
  tuyChon,
  laChon,
  children,
}: {
  so: number;
  icon: IconName;
  nhan: string;
  htmlFor: string;
  tuyChon?: boolean;
  laChon?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary"
      >
        {so}
      </span>
      <div className="relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card focus-within:border-primary">
        <OBieuTuong icon={icon} className="size-11 sm:size-12" />
        <div className="min-w-0 flex-1">
          <label htmlFor={htmlFor} className="block text-base font-semibold leading-snug">
            {nhan}
            {tuyChon ? <span className="ml-1.5 text-sm font-normal text-ink-2">(không bắt buộc)</span> : null}
          </label>
          {children}
        </div>
        {laChon ? (
          <Icon
            name="chevronDown"
            kieu="net"
            className="pointer-events-none absolute right-4 size-5 text-primary"
          />
        ) : null}
      </div>
    </div>
  );
}

const oChon =
  "-mx-1 mt-0.5 block min-h-10 w-[calc(100%+0.5rem)] cursor-pointer appearance-none truncate rounded-md bg-transparent px-1 pr-8 text-base text-ink focus:outline-none disabled:cursor-not-allowed disabled:text-ink-3";
const oGo =
  "-mx-1 mt-0.5 block min-h-10 w-[calc(100%+0.5rem)] rounded-md bg-transparent px-1 text-base text-ink placeholder:text-ink-3 focus:outline-none";

export default function ChuyenDoiThuCong({ loaderData }: Route.ComponentProps) {
  const { dsTinh, dsHuyen, dsXa, form, kq, nguon, loi } = loaderData;
  const submit = useSubmit();
  const nav = useNavigation();
  const dangChuyen = nav.state !== "idle" && new URLSearchParams(nav.location?.search).get("xem") === "1";

  /** Đổi tỉnh/huyện: xóa các ô cấp dưới rồi gửi lại để nạp danh sách mới (chưa ra kết quả). */
  const doi = (e: ChangeEvent<HTMLSelectElement>, xoa: string[]) => {
    const f = e.currentTarget.form;
    if (!f) return;
    for (const ten of xoa) {
      const o = f.elements.namedItem(ten);
      if (o instanceof HTMLSelectElement) o.value = "";
    }
    submit(f, { preventScrollReset: true, replace: true });
  };

  useEffect(() => {
    if (kq) document.getElementById("ket-qua")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [kq]);

  const huyenDangChon = dsHuyen.find((h) => h.ma === form.huyen);
  const huyenKhongXa = !!huyenDangChon && dsXa.length === 0;

  return (
    <KhungTrang className="wrap max-w-2xl py-6 sm:py-10">
      <p className="hidden md:block">
        <Link
          to={DUONG_DIA_GIOI}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 underline"
        >
          <Icon name="arrowLeft" className="size-4" />
          Chuyển đổi địa giới hành chính
        </Link>
      </p>
      <div className="flex items-center gap-4">
        <OBieuTuong icon="map" className="size-16 sm:size-16" />
        <div className="min-w-0">
          <TieuDeTrang icon="map" className="">
            Chuyển đổi thủ công
          </TieuDeTrang>
          <p className="mt-1 text-base text-ink-2">
            Nhập thông tin hành chính cũ để chuyển sang địa giới mới.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Nhập địa chỉ cũ</h2>
        <NutLichSuDiaGioi them={kq ? lichSuCua(kq) : null} className="-mr-2" />
      </div>

      <Form
        method="get"
        action={`${DUONG_DIA_GIOI}/thu-cong`}
        replace
        className="mt-2 grid gap-3"
        preventScrollReset
      >
        <OTruong so={1} icon="toaNha" nhan="Tỉnh/thành phố" htmlFor="dg-tinh" laChon>
          <select
            id="dg-tinh"
            name="tinh"
            defaultValue={form.tinh}
            onChange={(e) => doi(e, ["huyen", "xa"])}
            className={oChon}
          >
            <option value="">Chọn tỉnh/thành phố</option>
            {dsTinh.map((t) => (
              <option key={t.ma} value={t.ma}>
                {t.ten}
              </option>
            ))}
          </select>
        </OTruong>

        <OTruong so={2} icon="road" nhan="Quận/huyện" htmlFor="dg-huyen" tuyChon laChon>
          <select
            key={form.tinh}
            id="dg-huyen"
            name="huyen"
            defaultValue={form.huyen}
            disabled={!dsHuyen.length}
            onChange={(e) => doi(e, ["xa"])}
            className={oChon}
          >
            <option value="">{form.tinh ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"}</option>
            {dsHuyen.map((h) => (
              <option key={h.ma} value={h.ma}>
                {h.ten}
              </option>
            ))}
          </select>
        </OTruong>

        <OTruong so={3} icon="ghim" nhan="Phường/xã" htmlFor="dg-xa" tuyChon laChon>
          <select
            key={form.huyen}
            id="dg-xa"
            name="xa"
            defaultValue={form.xa}
            disabled={!dsXa.length}
            className={oChon}
          >
            <option value="">
              {huyenKhongXa
                ? "Huyện không chia phường/xã"
                : form.huyen
                  ? "Chọn phường/xã"
                  : "Chọn quận/huyện trước"}
            </option>
            {dsXa.map((x) => (
              <option key={x.ma} value={x.ma}>
                {x.ten}
              </option>
            ))}
          </select>
        </OTruong>

        <OTruong so={4} icon="home" nhan="Thôn/xóm" htmlFor="dg-thon" tuyChon>
          <input
            id="dg-thon"
            name="thon"
            defaultValue={form.thon}
            maxLength={100}
            autoComplete="off"
            placeholder="Nhập thôn/xóm"
            className={oGo}
          />
        </OTruong>

        <OTruong so={5} icon="ghim" nhan="Địa chỉ chi tiết" htmlFor="dg-chi-tiet" tuyChon>
          <input
            id="dg-chi-tiet"
            name="chi_tiet"
            defaultValue={form.chiTiet}
            maxLength={200}
            autoComplete="off"
            placeholder="Số nhà, tên đường, tòa nhà…"
            className={oGo}
          />
        </OTruong>

        <button
          type="submit"
          name="xem"
          value="1"
          disabled={dangChuyen}
          className="lun mt-2 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-lg font-semibold text-on-primary shadow-card hover:bg-primary-hover disabled:opacity-70"
        >
          <Icon name="turn" kieu="net" className="size-6" />
          {dangChuyen ? "Đang chuyển đổi…" : "Chuyển đổi địa chỉ"}
        </button>
      </Form>

      <div id="ket-qua" className={cn("mt-6 scroll-mt-20", dangChuyen && "opacity-60")} aria-live="polite">
        {loi ? <Notice tone="danger">{loi}</Notice> : null}
        {kq ? <KetQua kq={kq} thon={form.thon} chiTiet={form.chiTiet} /> : null}
        {kq ? <GhiChuNguon nguon={nguon} /> : null}
      </div>
    </KhungTrang>
  );
}

/** Nhãn và dòng phụ ghi vào lịch sử cho một kết quả. */
function lichSuCua(kq: KetQuaChuyenDoi): { nhan: string; phu: string } {
  if (kq.muc === "xa")
    return {
      nhan: `${kq.xaCu.ten} → ${kq.moi.map((m) => m.xa.ten).join(", ")}`,
      phu: `${kq.huyenCu.ten}, ${kq.tinhCu.ten}`,
    };
  if (kq.muc === "huyen")
    return { nhan: `${kq.huyenCu.ten} → ${kq.tinhMoi.map((t) => t.ten).join(", ")}`, phu: kq.tinhCu.ten };
  return { nhan: `${kq.tinhCu.ten} → ${kq.tinhMoi.map((t) => t.ten).join(", ")}`, phu: "Tỉnh/thành phố" };
}

function KetQua({ kq, thon, chiTiet }: { kq: KetQuaChuyenDoi; thon: string; chiTiet: string }) {
  return (
    <>
      {kq.muc === "xa" ? <KetQuaXa kq={kq} thon={thon} chiTiet={chiTiet} /> : null}
      {kq.muc === "huyen" ? <KetQuaHuyen kq={kq} /> : null}
      {kq.muc === "tinh" ? <KetQuaTinh kq={kq} /> : null}
    </>
  );
}

// Xã chưa có dữ liệu sắp xếp thôn: thôn/xóm chép nguyên văn người dùng nhập.
const LUU_Y_THON =
  "Thôn/xóm ghi theo tên cũ bạn nhập, chưa đối chiếu; thôn, tổ dân phố có thể đã đổi tên sau sắp xếp.";

/** Tên thôn mới khi phương án sắp xếp thôn có đúng một dòng khớp tên đã nhập. */
const thonMoi = (t: KetQuaThon | null | undefined) => (t?.dong.length === 1 ? t.dong[0]!.moi : null);

/** Ghi dưới tên thôn: căn cứ và các thôn cũ của từng dòng khớp, hoặc vì sao chưa đổi được tên. */
function LuuYThon({ thon, t }: { thon: string; t: KetQuaThon | null | undefined }) {
  if (!t) return <>{LUU_Y_THON}</>;
  if (!t.dong.length)
    return (
      <>
        Không thấy “{thon}” trong danh sách thôn, tổ dân phố sắp xếp lại của phường/xã này: thôn có thể giữ
        nguyên tên, hoặc tên nhập khác với danh sách. Theo {t.canCu}.
      </>
    );
  return (
    <>
      {t.dong.length === 1
        ? `Tên cũ: ${thon}. Tên mới là tên dự kiến`
        : `“${thon}” khớp ${t.dong.length} thôn, tổ dân phố mới (tên dự kiến); xác định theo vị trí cụ thể`}
      , theo {t.canCu}.
      <ul className="mt-1 list-disc pl-5">
        {t.dong.map((d) => (
          <li key={`${d.moi}|${d.cu.join(";")}`}>
            <span className="font-semibold text-ink">{d.moi}</span>, sắp xếp từ: {d.cu.join("; ")}
          </li>
        ))}
      </ul>
    </>
  );
}

function KetQuaXa({
  kq,
  thon,
  chiTiet,
}: {
  kq: Extract<KetQuaChuyenDoi, { muc: "xa" }>;
  thon: string;
  chiTiet: string;
}) {
  const diaChiCu = noiDiaChi(chiTiet, thon, kq.xaCu.ten, kq.huyenCu.ten, kq.tinhCu.ten);
  const cacTinh = [...new Map(kq.moi.map((m) => [m.tinh.ma, m.tinh])).values()];

  if (!kq.biChia) {
    const m = kq.moi[0];
    if (!m) return <Notice tone="danger">Dữ liệu chưa có đơn vị mới của {kq.xaCu.ten}.</Notice>;
    return (
      <BangDiaChi tieuDe="Địa chỉ theo địa giới hành chính mới">
        {chiTiet ? (
          <DongDiaChi icon="ghim" nhan="Địa chỉ chi tiết">
            {chiTiet}
          </DongDiaChi>
        ) : null}
        {thon ? (
          <DongDiaChi
            icon="home"
            nhan={thonMoi(m.thon) ? "Thôn/tổ dân phố mới (dự kiến)" : "Thôn/xóm (tên cũ)"}
          >
            {thonMoi(m.thon) ?? thon}
            <div className="mt-1 text-base font-normal leading-relaxed text-ink-2">
              <LuuYThon thon={thon} t={m.thon} />
            </div>
          </DongDiaChi>
        ) : null}
        <DongDiaChi icon="map" nhan="Phường/xã mới">
          <LienKetXaMoi ma={m.xa.ma} ten={m.xa.ten} />
        </DongDiaChi>
        <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
          {m.tinh.ten}
        </DongDiaChi>
        <DongDiaChi icon="ghim" nhan="Địa chỉ đầy đủ">
          {noiDiaChi(chiTiet, thonMoi(m.thon) ?? thon, m.xa.ten, m.tinh.ten)}
        </DongDiaChi>
        <DiaChiCu diaChi={diaChiCu} />
      </BangDiaChi>
    );
  }

  return (
    <>
      <Notice className="mb-4 text-base">
        {kq.xaCu.ten} cũ được chia cho {kq.moi.length} đơn vị mới. Xác định đơn vị mới theo vị trí cụ thể của
        địa chỉ (thôn/xóm, số nhà, tên đường).
        {thon && !kq.moi.some((m) => m.thon?.dong.length) ? ` ${LUU_Y_THON}` : null}
      </Notice>
      <BangDiaChi tieuDe={`Các phường/xã mới nhận địa giới của ${kq.xaCu.ten}`}>
        {kq.moi.map((m) => (
          <DongDiaChi key={m.xa.ma} icon="map" nhan="Phường/xã mới">
            <LienKetXaMoi ma={m.xa.ma} ten={m.xa.ten} />
            <span className="mt-0.5 block text-base font-normal text-ink-2">
              {noiDiaChi(chiTiet, thonMoi(m.thon) ?? thon, m.xa.ten, m.tinh.ten)}
            </span>
            {thon && m.thon?.dong.length ? (
              <div className="mt-1 text-base font-normal leading-relaxed text-ink-2">
                <LuuYThon thon={thon} t={m.thon} />
              </div>
            ) : null}
          </DongDiaChi>
        ))}
        <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
          {cacTinh.map((t) => t.ten).join(", ")}
        </DongDiaChi>
        <DiaChiCu diaChi={diaChiCu} />
      </BangDiaChi>
    </>
  );
}

function KetQuaHuyen({ kq }: { kq: Extract<KetQuaChuyenDoi, { muc: "huyen" }> }) {
  return (
    <>
      <Notice className="mb-4 text-base">Chọn thêm phường/xã cũ để biết đơn vị mới cụ thể.</Notice>
      <BangDiaChi tieuDe={`${kq.huyenCu.ten}, ${kq.tinhCu.ten} (cũ)`}>
        <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
          {kq.tinhMoi.map((t) => t.ten).join(", ")}
        </DongDiaChi>
        <DongDiaChi icon="map" nhan={`Phường/xã mới có phần địa giới của huyện cũ (${kq.xaMoi.length})`}>
          <ul className="mt-1 flex flex-wrap gap-2 text-base font-normal">
            {kq.xaMoi.map((x) => (
              <li key={x.ma}>
                <Link
                  to={`${DUONG_DIA_GIOI}/tra-nguoc?xa=${x.ma}`}
                  className="lun inline-flex min-h-10 items-center rounded-lg border border-line-strong px-3 hover:border-primary hover:text-primary"
                >
                  {x.ten}
                </Link>
              </li>
            ))}
          </ul>
        </DongDiaChi>
      </BangDiaChi>
    </>
  );
}

function KetQuaTinh({ kq }: { kq: Extract<KetQuaChuyenDoi, { muc: "tinh" }> }) {
  return (
    <>
      <Notice className="mb-4 text-base">
        Chọn thêm quận/huyện, phường/xã cũ để biết đơn vị mới cụ thể.
      </Notice>
      <BangDiaChi tieuDe={`${kq.tinhCu.ten} (cũ)`}>
        <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
          {kq.tinhMoi.map((t) => t.ten).join(", ")}
        </DongDiaChi>
        {kq.hopNhatVoi.length ? (
          <DongDiaChi icon="layers" nhan="Hợp nhất cùng tỉnh/thành phố cũ">
            {kq.hopNhatVoi.map((t) => t.ten).join(", ")}
          </DongDiaChi>
        ) : (
          <DongDiaChi icon="layers" nhan="Hợp nhất">
            Không hợp nhất với tỉnh/thành phố khác
          </DongDiaChi>
        )}
      </BangDiaChi>
    </>
  );
}

function LienKetXaMoi({ ma, ten }: { ma: string; ten: string }) {
  return (
    <Link
      to={`${DUONG_DIA_GIOI}/tra-nguoc?xa=${ma}`}
      className="underline decoration-line-strong underline-offset-4 hover:text-primary"
    >
      {ten}
    </Link>
  );
}

function DiaChiCu({ diaChi }: { diaChi: string }) {
  return (
    <p className="py-3.5 text-base text-ink-2 [overflow-wrap:anywhere]">
      <span className="font-semibold text-ink">Địa chỉ cũ:</span> {diaChi}
    </p>
  );
}
