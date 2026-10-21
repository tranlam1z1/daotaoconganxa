import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/usecases";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Trường hợp ứng dụng");
}

export default function Usecases() {
  return (
    <PageStub
      eyebrow="Thư viện"
      title="Trường hợp ứng dụng"
      description="Tình huống thực tế được phân tích theo từng bước, mỗi bước dẫn về quy định đang áp dụng."
      icon="scale"
      features={["Danh sách tình huống theo nhóm và thẻ.", "Tình trạng căn cứ của từng tình huống."]}
    />
  );
}
