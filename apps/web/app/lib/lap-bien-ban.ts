/**
 * Luật trò "Lập biên bản" dùng trên điện thoại (docs/PLAN.md GĐ-G3): kiểu phần đề, câu trả lời, kết
 * quả chấm từng ô, và tìm hành vi không dấu bằng CÙNG hàm máy chủ dùng (chạy được khi offline).
 * Import thẳng mã nguồn packages/dao-tao như lib/offline/tro-choi.ts.
 */
export {
  type ChiTietBienBan,
  type DeBienBan,
  type DongTraLoi,
  type LuaChonHanhVi,
  type NutDieuKhoan,
  type TraLoiBienBan,
  timHanhVi,
} from "../../../../packages/dao-tao/src/tro-choi/lap-bien-ban.ts";

/** "1500000" → "1.500.000". Chuỗi rỗng khi chưa nhập. */
export function dinhDangNghin(n: number | null): string {
  return n === null ? "" : n.toLocaleString("vi-VN");
}

/** Đọc ô tiền: bỏ mọi ký tự không phải số (dấu chấm nghìn, khoảng trắng, "đ"). Tối đa 12 chữ số. */
export function docSoTien(s: string): number | null {
  const so = s.replace(/\D/g, "").slice(0, 12);
  return so ? Number(so) : null;
}
