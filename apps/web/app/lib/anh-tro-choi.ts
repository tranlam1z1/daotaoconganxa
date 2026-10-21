/**
 * Ảnh biểu tượng của từng trò: SVG màu 128 × 128 có sẵn nền ô bo góc, trong
 * app/assets/tro-choi/, tên tệp là mã trò (`games.code`). Vite gắn mã băm vào tên tệp (hoặc
 * nhúng thẳng tệp nhỏ), nên service worker giữ được khi offline như các tệp /assets/ khác.
 *
 * Trò chưa có ảnh thì trả null: nơi gọi dùng biểu tượng nét của bộ Icon.
 */
const ANH = import.meta.glob<string>("../assets/tro-choi/*.svg", { eager: true, import: "default" });

export function anhTroChoi(ma: string): string | null {
  return ANH[`../assets/tro-choi/${ma}.svg`] ?? null;
}
