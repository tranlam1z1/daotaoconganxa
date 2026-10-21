import { Link } from "react-router";

import type { BienBao } from "../../lib/bien-bao";
import { dieuHrefFromUrn, nhanVienDan } from "../../lib/citation";

/**
 * Dòng căn cứ của một biển báo: dẫn tới điều khoản khi văn bản đã có trong kho; chưa có thì chỉ ghi
 * viện dẫn, vì trang đọc của văn bản đó sẽ báo không tìm thấy.
 */
export function CanCuBienBao({ b }: { b: BienBao }) {
  return b.can_cu_mo_duoc ? (
    <Link
      to={dieuHrefFromUrn(b.can_cu)}
      className="inline-flex min-h-11 items-center text-sm text-primary underline"
    >
      Căn cứ: {nhanVienDan(b.can_cu)}
    </Link>
  ) : (
    <span className="inline-flex min-h-11 items-center text-sm text-ink-3">
      Căn cứ: {nhanVienDan(b.can_cu)} (văn bản chưa có trong kho)
    </span>
  );
}
