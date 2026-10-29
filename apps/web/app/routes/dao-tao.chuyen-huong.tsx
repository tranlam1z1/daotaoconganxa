/**
 * Đường cũ /dao-tao, /dao-tao/:course, /dao-tao/:course/:lesson chuyển vĩnh viễn sang /hoc
 * (docs/PLAN.md GĐ11), để liên kết đã chia sẻ vẫn mở được. Resource route, không có giao diện.
 */
import { redirect } from "react-router";
import { urlTrang } from "../lib/session.server";

export function loader({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | undefined>;
}) {
  const url = urlTrang(request);
  const duong = ["/hoc", params.course, params.lesson]
    .filter(Boolean)
    .map((p, i) => (i ? encodeURIComponent(p!) : p))
    .join("/");
  return redirect(`${duong}${url.search}`, 301);
}
