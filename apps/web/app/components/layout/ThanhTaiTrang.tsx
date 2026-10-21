import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/** Chuyển trang nhanh hơn chừng này thì không hiện thanh, tránh nháy. */
const TRE_MS = 150;

/**
 * Vạch chạy mảnh ở mép trên màn hình khi đang chuyển trang (loader của trang mới chưa xong): trang
 * cũ vẫn hiện nên người dùng cần biết thao tác đã được nhận. Giảm chuyển động: vạch đứng yên.
 */
export function ThanhTaiTrang() {
  const dangChuyen = useNavigation().state !== "idle";
  const [hien, datHien] = useState(false);

  useEffect(() => {
    if (!dangChuyen) {
      datHien(false);
      return;
    }
    const t = window.setTimeout(() => datHien(true), TRE_MS);
    return () => window.clearTimeout(t);
  }, [dangChuyen]);

  return (
    <div role="status" className="no-print pointer-events-none fixed inset-x-0 top-0 z-50">
      {hien ? (
        <>
          <span className="sr-only">Đang tải trang</span>
          <span aria-hidden="true" className="block h-[3px] overflow-hidden bg-primary-soft">
            <span className="thanh-tai-chay block h-full w-1/3 bg-primary" />
          </span>
        </>
      ) : null}
    </div>
  );
}
