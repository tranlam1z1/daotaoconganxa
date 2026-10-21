/**
 * Đọc số lẻ người dùng gõ ở các công cụ đo theo mét, mg/l... Dấu phẩy và dấu chấm đều là dấu thập
 * phân ("0,25" và "0.25" là một), không nhận dấu phân cách hàng nghìn. Trả null khi không phải số
 * hoặc phần nguyên quá 9 chữ số (gõ nhầm, và số lớn hơn nữa mất chính xác khi tính).
 *
 * Số nguyên lớn theo kg, mm (có dấu chấm hàng nghìn) thì dùng docSoKg của lib/tinh-qua-tai.ts.
 */
export function docSoLe(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!/^\d{1,9}(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
