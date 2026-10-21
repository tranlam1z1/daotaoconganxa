import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/compare";

export function meta(_: Route.MetaArgs) {
  return pageMeta("So sánh văn bản", { index: false });
}

export default function Compare() {
  return (
    <PageStub
      eyebrow="Công cụ"
      title="So sánh văn bản"
      description="Đối chiếu nội dung một văn bản giữa hai thời điểm hiệu lực."
      icon="layers"
      features={[
        "Đánh dấu phần thêm, phần bỏ và phần thay đổi theo từng điều, khoản.",
        "Thống kê số nút được thêm, bị bỏ và bị thay đổi.",
      ]}
    />
  );
}
