import { PageStub } from "../components/PageStub";
import { pageMeta } from "../lib/site";
import type { Route } from "./+types/huong-dan.bai";

export function meta(_: Route.MetaArgs) {
  return pageMeta("Bài hướng dẫn");
}

export default function HuongDanBai() {
  return (
    <PageStub
      eyebrow="Hướng dẫn"
      title="Bài hướng dẫn"
      icon="help"
      features={["Nội dung bài có hình minh hoạ đánh số và chú giải.", "Chuyển sang bài trước, bài sau."]}
    />
  );
}
