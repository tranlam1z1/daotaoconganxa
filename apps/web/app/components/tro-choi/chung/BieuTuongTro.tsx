import { anhTroChoi } from "../../../lib/anh-tro-choi";
import { Icon } from "../../ui/Icon";

/**
 * Biểu tượng ứng dụng của một trò: ảnh SVG màu có sẵn nền ô bo góc ở app/assets/tro-choi/
 * (lib/anh-tro-choi.ts). Trò mới chưa có ảnh thì dựng ô bo góc cùng cỡ, màu chính, với mảnh ghép
 * của bộ Icon, để lưới trò chơi vẫn đều.
 *
 * Luôn là hình trang trí: tên trò nằm ngay cạnh, nên ảnh có alt rỗng.
 */
export function BieuTuongTro({ ma, co }: { ma: string; co: number }) {
  const anh = anhTroChoi(ma);
  if (anh) {
    return (
      <img
        src={anh}
        alt=""
        width={co}
        height={co}
        loading="lazy"
        decoding="async"
        className="hinh-noi shrink-0"
        // Ô hẹp hơn cỡ đặt (máy 320px, lưới 2 cột) thì thu theo ô, vẫn giữ vuông.
        style={{ width: co, maxWidth: "100%", height: "auto", aspectRatio: "1 / 1" }}
      />
    );
  }
  // Phần nền trong ảnh SVG: cạnh 112/128, bo góc 28/128 của khung (theo % để thu được như ảnh).
  return (
    <span
      aria-hidden="true"
      className="hinh-noi grid shrink-0 place-items-center"
      style={{ width: co, maxWidth: "100%", aspectRatio: "1 / 1" }}
    >
      <span
        className="grid place-items-center bg-primary text-on-primary"
        style={{ width: "87.5%", height: "87.5%", borderRadius: "21.875%" }}
      >
        <Icon name="puzzle" kieu="net" className="size-1/2" />
      </span>
    </span>
  );
}
