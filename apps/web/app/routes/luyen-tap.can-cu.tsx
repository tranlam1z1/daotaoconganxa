/**
 * Nội dung một điều khoản làm căn cứ, cho ngăn kéo "căn cứ" của trang luyện tập (resource
 * route, trả JSON). Đọc tại ngày hôm nay: người học cần quy định đang áp dụng.
 */
import { ApiKhongTimThay, getDocument, getDocumentContent } from "../lib/api";
import { dieuHrefFromUrn, nhanVienDan, parseUrn } from "../lib/citation";
import { todayIso } from "../lib/format";
import { findDieu } from "../lib/tree";
import type { Route } from "./+types/luyen-tap.can-cu";

export async function loader({ request }: Route.LoaderArgs) {
  const urn = (new URL(request.url).searchParams.get("urn") ?? "").trim();
  const p = parseUrn(urn);
  if (!p) return { loi: "Căn cứ không đúng định dạng.", nhan: urn, href: "/tim-kiem" };
  const docUrn = `vn:${p.scheme}:${p.docType}:${p.soKyHieu}`;
  const nhan = nhanVienDan(urn);
  const href = dieuHrefFromUrn(urn);
  const dieuPath = (p.path ?? "").split(".")[0] ?? "";
  try {
    if (!dieuPath.startsWith("dieu-")) {
      await getDocument(docUrn);
      return { loi: "Căn cứ dẫn tới cả văn bản. Mở trang đọc để xem toàn văn.", nhan, href };
    }
    const asOf = todayIso();
    const [chiTiet, noiDung] = await Promise.all([getDocument(docUrn), getDocumentContent(docUrn, asOf)]);
    const tim = findDieu(noiDung.root, dieuPath);
    if (!tim) return { loi: "Không tìm thấy điều này trong văn bản tại ngày hôm nay.", nhan, href };
    return {
      nhan,
      href,
      asOf,
      meta: chiTiet.meta,
      versionKind: noiDung.versionKind,
      nguCanh: tim.nguCanh,
      dieu: tim.node,
      neo: p.path ?? null,
    };
  } catch (e) {
    // Kho chưa có văn bản thì trang đọc cũng trả 404: không đưa liên kết chết.
    return {
      loi: "Kho dữ liệu chưa có văn bản này.",
      nhan,
      href: e instanceof ApiKhongTimThay ? null : href,
    };
  }
}
