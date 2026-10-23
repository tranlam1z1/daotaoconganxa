/**
 * Tra cứu theo địa chỉ cụ thể: gõ địa chỉ tự do, ra các địa chỉ khớp theo địa giới hành chính mới, kèm
 * địa chỉ theo đơn vị cũ (xã cũ theo tên nêu trong địa chỉ gõ hoặc tên OpenStreetMap ghi tại vị trí,
 * không có thì ước lượng theo tâm xã cũ gần nhất).
 *
 * Địa chỉ gửi bằng POST qua action (không nằm trên URL) và không được lưu. Địa chỉ tìm qua OpenStreetMap,
 * phường/xã, tỉnh xác định theo ranh giới của hệ thống (hiện có tỉnh Thanh Hóa). Dịch vụ bản đồ chưa
 * kết nối (501) hoặc không phản hồi (503) thì trang báo rõ và dẫn sang Chuyển đổi thủ công.
 */
import { useRef } from "react";
import { Link, useFetcher } from "react-router";
import { BangDiaChi, DongDiaChi, DongDiaChiCu } from "../components/dia-gioi/ChungDiaGioi";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { KhungTrang, TieuDeTrang } from "../components/ui/KhungTrang";
import { cn } from "../lib/cn";
import { type DiaChiBanDo, DUONG_DIA_GIOI, diaChiRaViTri, LoiDiaGioi } from "../lib/dia-gioi";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu.dia-gioi.dia-chi";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra cứu theo địa chỉ cụ thể", { index: false });
}

type KetQuaAction =
  | { q: string; ds: DiaChiBanDo[]; loi: null }
  | { q: string; ds: null; loi: { code: string; message: string } };

export async function action({ request }: Route.ActionArgs): Promise<KetQuaAction> {
  const q = String((await request.formData()).get("q") ?? "")
    .trim()
    .slice(0, 200);
  if (q.length < 3)
    return { q, ds: null, loi: { code: "tham_so_khong_hop_le", message: "Nhập địa chỉ cụ thể." } };
  try {
    return { q, ds: await diaChiRaViTri(q), loi: null };
  } catch (e) {
    // Lỗi có chủ đích (địa chỉ không hợp lệ, chưa kết nối dịch vụ) hiện thành thông báo.
    if (e instanceof LoiDiaGioi && (e.status < 500 || e.status === 501 || e.status === 503))
      return { q, ds: null, loi: { code: e.code, message: e.message } };
    throw e;
  }
}

const VI_DU = [
  "Trần Phú, Hạc Thành, Thanh Hóa",
  "Quang Trung, Hạc Thành, Thanh Hóa",
  "Đại lộ Lê Lợi, Thanh Hóa",
  "Lê Hoàn, Thanh Hóa",
  "Bà Triệu, Thanh Hóa",
  "Lê Lai, Thanh Hóa",
];

export default function TraTheoDiaChi() {
  const fetcher = useFetcher<typeof action>();
  const oNhap = useRef<HTMLInputElement>(null);
  const dangTra = fetcher.state !== "idle";
  const kq = fetcher.data;

  const thu = (q: string) => {
    if (oNhap.current) oNhap.current.value = q;
    fetcher.submit({ q }, { method: "post" });
  };

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
      <TieuDeTrang icon="map" className="">
        Tra cứu theo địa chỉ cụ thể
      </TieuDeTrang>

      <section className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <Icon name="file" className="size-6" />
          Hướng dẫn nhập
        </h2>
        <p className="mt-2 text-base leading-relaxed">
          Nhập địa chỉ cụ thể (số nhà, tên đường, phường/xã, tỉnh/thành phố). Hiện xác định được phường/xã
          trong tỉnh Thanh Hóa.
        </p>
        <ul className="mt-2 grid gap-2 text-base leading-relaxed">
          <li className="flex gap-2.5">
            <Icon name="check" sac="luc" className="mt-0.5 size-5 shrink-0" />
            Tối thiểu: tên đường kèm phường/xã hoặc tỉnh (ví dụ: Trần Phú, Hạc Thành, Thanh Hóa).
          </li>
          <li className="flex gap-2.5">
            <Icon name="check" sac="luc" className="mt-0.5 size-5 shrink-0" />
            Một con đường chạy qua nhiều phường/xã thì mỗi đoạn hiện một kết quả; thêm số nhà, tên phường/xã
            cũ hoặc mới để thu hẹp.
          </li>
        </ul>
      </section>

      <fetcher.Form method="post" action={`${DUONG_DIA_GIOI}/dia-chi`} className="mt-6" role="search">
        <label htmlFor="dc-q" className="mb-2 block text-lg font-semibold">
          Nhập địa chỉ
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-3">
            <Icon name="search" sac="trung" className="size-6" />
          </span>
          <input
            ref={oNhap}
            id="dc-q"
            name="q"
            type="search"
            required
            minLength={3}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Nhập địa chỉ chi tiết"
            className="min-h-14 w-full rounded-2xl border border-line-strong bg-surface pr-14 pl-13 text-base text-ink shadow-card placeholder:text-ink-3 focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={dangTra}
            aria-label="Tra cứu"
            className="lun absolute inset-y-1.5 right-1.5 grid w-11 place-items-center rounded-xl text-primary hover:bg-surface-2 disabled:opacity-60"
          >
            <Icon name="arrowRight" kieu="net" className="size-6" />
          </button>
        </div>
      </fetcher.Form>

      <div className={cn("mt-5", dangTra && "opacity-60")} aria-live="polite">
        {dangTra ? <p className="text-base text-ink-2">Đang tra…</p> : null}
        {kq?.loi ? (
          <Notice
            tone={["chua_ho_tro", "dich_vu_loi"].includes(kq.loi.code) ? "info" : "danger"}
            className="text-base"
          >
            {kq.loi.message}{" "}
            {["chua_ho_tro", "dich_vu_loi"].includes(kq.loi.code) ? (
              <Link to={`${DUONG_DIA_GIOI}/thu-cong`} className="inline-flex min-h-11 items-center underline">
                Tra theo tên đơn vị cũ: Chuyển đổi thủ công
              </Link>
            ) : null}
          </Notice>
        ) : null}
        {kq?.ds?.length === 0 ? (
          <Notice className="text-base">
            Không tìm thấy địa chỉ khớp với “{kq.q}”. Thêm tên phường/xã hoặc tỉnh/thành phố rồi thử lại.
          </Notice>
        ) : null}
        {kq?.ds?.length ? (
          <div className="grid gap-4">
            {kq.ds.map((d) => (
              <BangDiaChi key={`${d.lat},${d.lon}`} tieuDe={d.diaChiDayDu ?? kq.q}>
                {d.tenDuong ? (
                  <DongDiaChi icon="road" nhan="Tên đường">
                    {d.tenDuong}
                  </DongDiaChi>
                ) : null}
                {d.soNha ? (
                  <DongDiaChi icon="home" nhan="Số nhà">
                    {d.soNha}
                  </DongDiaChi>
                ) : null}
                <DongDiaChi icon="map" nhan="Phường/xã mới">
                  {d.xa ? (
                    <Link
                      to={`${DUONG_DIA_GIOI}/tra-nguoc?xa=${d.xa.ma}`}
                      className="underline decoration-line-strong underline-offset-4 hover:text-primary"
                    >
                      {d.xa.ten}
                    </Link>
                  ) : (
                    <span className="font-normal text-ink-3">Không xác định được</span>
                  )}
                </DongDiaChi>
                <DongDiaChi icon="toaNha" nhan="Tỉnh/thành phố mới">
                  {d.tinh?.ten ?? <span className="font-normal text-ink-3">Không xác định được</span>}
                </DongDiaChi>
                {d.cu ? <DongDiaChiCu cu={d.cu} /> : null}
              </BangDiaChi>
            ))}
          </div>
        ) : null}
        {/* Không ra kết quả, hoặc ra địa chỉ mà không xác định được phường/xã: thường là địa chỉ ngoài phạm vi dữ liệu. */}
        {kq?.ds && (kq.ds.length === 0 || kq.ds.some((d) => !d.xa)) ? (
          <Notice tone="info" className="mt-4 text-base">
            Cách tra này hiện chỉ xác định được phường/xã trong tỉnh Thanh Hóa. Với địa chỉ ở tỉnh, thành phố
            khác, hãy dùng{" "}
            <Link to={`${DUONG_DIA_GIOI}/thu-cong`} className="inline-flex min-h-11 items-center underline">
              Chuyển đổi thủ công
            </Link>
            .
          </Notice>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3 text-base text-ink-2">
        <span className="h-px flex-1 bg-line-strong" />
        Bạn có thể thử
        <span className="h-px flex-1 bg-line-strong" />
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {VI_DU.map((v) => (
          <li key={v}>
            <button
              type="button"
              onClick={() => thu(v)}
              disabled={dangTra}
              className="lun flex min-h-12 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left text-base shadow-card hover:border-primary disabled:opacity-60"
            >
              <Icon name="ghim" kieu="net" className="size-5 shrink-0 text-vang" />
              <span className="truncate">{v}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-center text-sm text-ink-2">Địa chỉ tra cứu không được lưu trên hệ thống.</p>
    </KhungTrang>
  );
}
