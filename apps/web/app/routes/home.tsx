import { Form, redirect, useNavigation, useRouteLoaderData } from "react-router";

import { AppHeader } from "../components/trang-chu/AppHeader";
import { CategoryCarousel } from "../components/trang-chu/CategoryCarousel";
import { LuoiLoiTat } from "../components/trang-chu/LuoiLoiTat";
import { OTraCuuViPham } from "../components/trang-chu/OTraCuuViPham";
import { TheThuThach } from "../components/tro-choi/TheThuThach";
import { Button, ButtonLink } from "../components/ui/Button";
import { Notice } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { layToken, nguoiDungHienTai } from "../lib/auth.server";
import { NGHIEP_VU_NHANH, O_CONG_CU } from "../lib/cong-cu";
import type { TongQuanDiem } from "../lib/diem-thuong";
import type { TongQuanLuotChoi } from "../lib/luot-choi";
import { danhMucTroChoi } from "../lib/luot-choi.server";
import { goiApiQuanTri, LoiApi } from "../lib/quan-tri.server";
import { yeuCauDangNhap } from "../lib/session.server";
import { pageMeta } from "../lib/site";
import { danhSachTroChoi, danhSachTroChoiCongKhai } from "../lib/trang-chu";
import type { loader as rootLoader } from "../root";
import type { Route } from "./+types/home";

/** Mỗi khung lối tắt ở trang chủ hiện tối đa bấy nhiêu ô; đủ danh sách xem ở /cong-cu (Xem tất cả). */
const SO_O_TRANG_CHU = 4;

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tra cứu quy định", {
    description:
      "Tìm quy định đến từng điều, khoản; đọc nguyên văn điều khoản đang áp dụng; hỏi trợ lý AI và nhận câu trả lời kèm căn cứ.",
  });
}

/**
 * Lỗi ở bất kỳ API nào không được làm hỏng trang chủ: trang tra cứu là dịch vụ công, phần nào
 * lỗi thì bỏ hoặc hiện trạng thái rỗng phần đó.
 *
 * - Danh mục trò chơi đọc được khi chưa đăng nhập. Người chưa đăng nhập, và tài khoản chưa được xác
 *   minh cán bộ, thấy các trò; bấm vào trò nào thì trang trò đó đòi đăng nhập (hoặc chuyển về trang
 *   Tài khoản xem trạng thái xác minh).
 * - "Thử thách hôm nay" (docs/PLAN.md GĐ9) và "Chơi ngay" (GĐ-G0) chờ đủ rồi mới trả trang.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const token = layToken(request);
  const nguoiDung = token ? await nguoiDungHienTai(request) : null;
  if (!token || !nguoiDung || nguoiDung.cho_xac_minh) {
    const danhMuc = await danhMucTroChoi().catch(() => null);
    return {
      tongQuan: null,
      troChoi: null,
      dsTroChoi: danhMuc ? danhSachTroChoiCongKhai(danhMuc) : null,
    };
  }
  const [tongQuan, troChoi] = await Promise.all([
    goiApiQuanTri<TongQuanDiem>(token, "/v1/toi/tong-quan").catch(() => null),
    goiApiQuanTri<TongQuanLuotChoi>(token, "/v1/luot-choi").catch(() => null),
  ]);
  // Carousel: mọi trò đang bật. Chơi nhanh (docs/PLAN.md GĐ-G0): trò đầu tiên, một chạm là vào chơi.
  return {
    tongQuan,
    troChoi: troChoi?.tro_choi[0] ?? null,
    dsTroChoi: troChoi ? danhSachTroChoi(troChoi) : [],
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { token } = await yeuCauDangNhap(request);
  try {
    const { id } = await goiApiQuanTri<{ id: string }>(token, "/v1/luyen-tap/phien", {
      body: { nguon: "thu_thach" },
    });
    return redirect(`/luyen-tap/${id}`);
  } catch (err) {
    if (err instanceof LoiApi) return { loi: err.message };
    throw err;
  }
}

/**
 * Trang chủ, từ trên xuống: lời chào, ô tra cứu vi phạm, bộ công cụ nghiệp vụ, nghiệp vụ nhanh,
 * carousel trò chơi, rồi phần việc hôm nay (thử thách, chơi nhanh) khi đã đăng nhập.
 */
export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { tongQuan, troChoi, dsTroChoi } = loaderData;
  const nguoiDung = useRouteLoaderData<typeof rootLoader>("root")?.nguoiDung ?? null;
  const busy = useNavigation().state !== "idle";
  // Học và chơi cần tài khoản đã được xác minh cán bộ; chưa đủ thì nêu lý do và lối đi tiếp.
  const loiVaoChoi = !nguoiDung
    ? {
        to: "/dang-nhap?tiep=%2Ftro-choi",
        nhan: "Đăng nhập",
        loi: "Trò chơi cần tài khoản cán bộ đã được xác minh.",
      }
    : nguoiDung.cho_xac_minh
      ? {
          to: "/tai-khoan",
          nhan: "Xem trạng thái xác minh",
          loi: "Trò chơi mở sau khi tài khoản được xác minh cán bộ.",
        }
      : { to: "/tro-choi", nhan: "Mở trang Trò chơi", loi: "Chưa tải được danh sách trò chơi." };

  return (
    <div className="wrap max-w-3xl py-6 sm:py-10 lg:max-w-7xl">
      <AppHeader nguoiDung={nguoiDung} />

      <div className="mt-6">
        <OTraCuuViPham />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <LuoiLoiTat
          id="cong-cu-tieu-de"
          tieuDe="Bộ công cụ nghiệp vụ"
          icon="shield"
          items={O_CONG_CU.slice(0, SO_O_TRANG_CHU)}
          xemTatCa="/cong-cu"
        />
        <LuoiLoiTat
          id="nghiep-vu-nhanh-tieu-de"
          tieuDe="Nghiệp vụ nhanh"
          icon="bolt"
          items={NGHIEP_VU_NHANH.slice(0, SO_O_TRANG_CHU)}
          xemTatCa="/cong-cu"
        />
      </div>

      <div className="mt-4">
        {/* Người chưa đăng nhập cũng thấy các trò; thẻ dẫn tới trang của trò, trang đó đòi đăng
            nhập. Không tải được danh mục thì thấy lối vào ở dưới. Như các khung lối tắt, chỉ hiện
            SO_O_TRANG_CHU trò; đủ danh sách xem ở /tro-choi. */}
        <CategoryCarousel
          id="tro-choi-tieu-de"
          tieuDe="Học tập qua trò chơi"
          icon="trophy"
          xemTatCa={dsTroChoi?.length ? { to: "/tro-choi", nhan: "Xem tất cả" } : undefined}
          items={(dsTroChoi ?? []).slice(0, SO_O_TRANG_CHU)}
          busy={busy}
        >
          <div className="flex flex-col gap-3 rounded-card border border-dashed border-line-strong p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-ink-2">{loiVaoChoi.loi}</p>
            <ButtonLink to={loiVaoChoi.to} variant="secondary" className="shrink-0">
              {loiVaoChoi.nhan}
            </ButtonLink>
          </div>
        </CategoryCarousel>
      </div>

      {tongQuan || troChoi ? (
        <section aria-labelledby="hom-nay-tieu-de" className="mt-6">
          <h2 id="hom-nay-tieu-de" className="text-lg font-semibold">
            Việc hôm nay
          </h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:items-start">
            {actionData?.loi ? (
              <Notice tone="danger" className="lg:col-span-2">
                {actionData.loi}
              </Notice>
            ) : null}
            {tongQuan ? (
              <TheThuThach thuThach={tongQuan.thu_thach} chuoi={tongQuan.chuoi} busy={busy} />
            ) : null}
            {troChoi ? (
              <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
                <h3 className="flex items-center gap-2 font-sans text-base font-semibold">
                  <Icon name="trophy" className="size-5 text-primary" />
                  Chơi nhanh: {troChoi.ten}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{troChoi.mo_ta}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Form method="post" action="/tro-choi?index">
                    <input type="hidden" name="ma" value={troChoi.ma} />
                    <Button type="submit" className="min-h-12 w-full text-base" disabled={busy}>
                      Chơi ngay
                    </Button>
                  </Form>
                  <ButtonLink to="/tro-choi" variant="secondary" className="min-h-12 w-full text-base">
                    Các trò chơi khác
                  </ButtonLink>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
