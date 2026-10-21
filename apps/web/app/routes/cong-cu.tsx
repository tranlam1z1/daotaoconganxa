/**
 * Trang của một công cụ trong Bộ công cụ nghiệp vụ (lib/cong-cu.ts). Công cụ chưa dựng nên tạm
 * hiện khung liệt kê chức năng sẽ có; mã lạ thì 404.
 */
import { PageStub } from "../components/PageStub";
import { ButtonLink } from "../components/ui/Button";
import { CONG_CU } from "../lib/cong-cu";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/cong-cu";

export function loader({ params }: Route.LoaderArgs) {
  const congCu = CONG_CU.find((c) => c.ma === params.ma);
  // statusText phải là ASCII (ByteString), xem routes/not-found.tsx.
  if (!congCu) throw new Response("Khong tim thay cong cu", { status: 404, statusText: "Not Found" });
  return { congCu };
}

export function meta({ data }: Route.MetaArgs) {
  return pageMeta(data?.congCu.ten ?? "Công cụ", { index: false });
}

export default function CongCu({ loaderData }: Route.ComponentProps) {
  const { congCu } = loaderData;
  return (
    <PageStub
      eyebrow="Bộ công cụ nghiệp vụ"
      title={congCu.ten}
      description={congCu.moTa}
      icon={congCu.icon}
      thongBao="Công cụ đang được xây dựng"
      features={congCu.chucNang}
      actions={
        <ButtonLink to="/cong-cu" variant="secondary">
          Các công cụ khác
        </ButtonLink>
      }
    />
  );
}
