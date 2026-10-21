import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training.progress";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Tiến độ học", { index: false });
}

export default function TrainingProgress() {
  return (
    <PageStub
      eyebrow="Đào tạo"
      title="Tiến độ học"
      icon="cap"
      features={["Tỷ lệ hoàn thành từng bài.", "Kết quả bài tập."]}
    />
  );
}
