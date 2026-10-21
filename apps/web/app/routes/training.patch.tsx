import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/training.patch";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Bài vá lỗi", { index: false });
}

export default function TrainingPatch() {
  return (
    <PageStub
      eyebrow="Đào tạo"
      title="Bài vá lỗi"
      icon="cap"
      features={["Giải thích lỗi thường gặp và bài tập củng cố."]}
    />
  );
}
