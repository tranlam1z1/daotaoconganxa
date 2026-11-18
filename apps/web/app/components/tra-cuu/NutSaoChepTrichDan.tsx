import { voiNgay } from "../../lib/bo-loc-van-ban";
import { dieuHrefFromUrn, formatCitationFull } from "../../lib/citation";
import type { DocumentMeta, VersionKind } from "../../lib/types";
import { Icon } from "../ui/Icon";
import { baoNhanh } from "../ui/ThongBaoNhanh";

async function saoChep(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Rơi xuống cách dự phòng bên dưới (trình duyệt cũ, trang không chạy HTTPS).
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Một nút duy nhất: sao chép trích dẫn dạng đầy đủ theo chuẩn Việt Nam
 * ("khoản 2 Điều 6 Nghị định số 168/2024/NĐ-CP ngày ... của Chính phủ ...").
 */
export function NutSaoChepTrichDan({
  meta,
  path,
  asOf,
  versionKind,
}: {
  meta: DocumentMeta;
  path?: string;
  asOf?: string;
  versionKind?: VersionKind;
}) {
  async function bam() {
    const text = formatCitationFull(meta, {
      ...(path ? { path } : {}),
      ...(asOf ? { asOf } : {}),
      ...(versionKind ? { versionKind } : {}),
    });
    const url = new URL(voiNgay(dieuHrefFromUrn(meta.urn, path), asOf), window.location.origin).href;
    const ok = await saoChep(`${text}\n${url}`);
    // Toast ở đáy màn hình (thay bong bóng cạnh nút, vốn tràn khỏi màn hình điện thoại).
    if (ok) baoNhanh("Đã sao chép trích dẫn");
    else baoNhanh("Chưa sao chép được. Hãy chọn đoạn văn và sao chép thủ công.", "loi");
  }

  return (
    <span className="no-print inline-flex">
      <button
        type="button"
        onClick={() => void bam()}
        title="Sao chép trích dẫn"
        className="lun inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-line px-3 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Icon name="copy" className="size-4" />
        <span>Sao chép trích dẫn</span>
      </button>
    </span>
  );
}
