import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/huong-dan._index";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Hướng dẫn sử dụng");
}

export default function HuongDanIndex() {
  return (
    <PageStub
      eyebrow="Hướng dẫn"
      title="Hướng dẫn sử dụng"
      description="Cách dùng các chức năng tra cứu, hỏi đáp, đào tạo và quản trị."
      icon="help"
      features={["Mục lục bài hướng dẫn theo chương.", "Tải bản PDF đầy đủ."]}
    />
  );
}
