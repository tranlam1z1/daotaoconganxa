import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training.review";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Ôn tập", { index: false });
}

export default function TrainingReview() {
  return (
    <PageStub
      eyebrow="Đào tạo"
      title="Ôn tập"
      icon="cap"
      features={["Câu hỏi ôn tập theo lịch lặp lại ngắt quãng."]}
    />
  );
}
