/**
 * Sinh khóa (URI) trong kho. Tập trung một chỗ để mọi thành phần đặt tên giống nhau,
 * và để đổi cách bố trí kho về sau chỉ phải sửa ở đây.
 */

/** Bỏ dấu tiếng Việt và ký tự lạ để làm một mảnh đường dẫn an toàn. */
export function slugKey(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Ảnh trang gốc: `pages/{documentId}/{trang}.png` (trang đánh số từ 1). */
export function pageKey(documentId: string, trang: number): string {
  return `pages/${documentId}/${String(trang).padStart(4, "0")}.png`;
}

/** Ảnh cắt của bảng/hình/công thức. */
export function assetKey(documentId: string, ten: string): string {
  return `assets/${documentId}/${slugKey(ten)}`;
}

/** Markdown đã chốt của một phiên bản văn bản: bản sao để xuất bản và khôi phục. */
export function derivedMarkdownKey(documentId: string, versionNo: number): string {
  return `derived/${documentId}/v${versionNo}/document.md`;
}

/** Cây JSON đã chốt của một phiên bản. */
export function derivedTreeKey(documentId: string, versionNo: number): string {
  return `derived/${documentId}/v${versionNo}/tree.json`;
}

/** Tệp tạm của một việc số hóa (cửa sổ trang, bản nháp). Xóa được sau khi xong. */
export function workKey(taskId: string, ten: string): string {
  return `work/${taskId}/${ten}`;
}
