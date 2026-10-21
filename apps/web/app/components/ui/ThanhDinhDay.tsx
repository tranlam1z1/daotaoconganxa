import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";

import { cn } from "../../lib/cn";

/**
 * Thanh nút dính đáy màn hình (khay trò chơi, nút chuyển trang slide): lớp .thanh-dinh-day trong
 * app.css đặt thanh ngay trên thanh điều hướng dưới cùng, hoặc trên vùng thanh home của iPhone ở trang
 * không có thanh đó. Khi thanh đang dính đáy, chiều cao của nó được khai vào biến --thanh-hanh-dong
 * trên <html> để nút nổi "Lên đầu trang" và thông báo nhanh (toast) nằm phía trên, không che nút chính.
 *
 * `chiDienThoai`: chỉ dính đáy dưới 768px; từ 768px thanh nằm yên cuối nội dung như trước.
 */
export function ThanhDinhDay({
  as: The = "div",
  chiDienThoai = false,
  className,
  ...props
}: { as?: "div" | "nav"; chiDienThoai?: boolean } & ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const goc = document.documentElement;
    const capNhat = () => {
      const dinh = getComputedStyle(el).position === "sticky";
      goc.style.setProperty("--thanh-hanh-dong", `${dinh ? el.offsetHeight : 0}px`);
    };
    const quanSat = new ResizeObserver(capNhat);
    quanSat.observe(el);
    window.addEventListener("resize", capNhat);
    return () => {
      quanSat.disconnect();
      window.removeEventListener("resize", capNhat);
      goc.style.removeProperty("--thanh-hanh-dong");
    };
  }, []);

  return (
    <The
      ref={ref}
      className={cn("thanh-dinh-day", chiDienThoai && "thanh-dinh-day-dt", className)}
      {...props}
    />
  );
}

/**
 * Vùng nút gửi của biểu mẫu dài (trang quản trị): điện thoại dính đáy màn hình nên nút Lưu luôn trong
 * tầm ngón cái, kèm dòng báo lỗi hoặc "đã lưu" ngay trên nút (bản sao của thông báo đầu trang, trình
 * đọc màn hình đã đọc thông báo đó nên dòng này ẩn với nó). Từ 768px: nằm cuối biểu mẫu như cũ.
 */
export function ThanhLuuBieuMau({
  children,
  loi,
  ok,
  className,
}: {
  children: ReactNode;
  loi?: string | null;
  ok?: string | null;
  className?: string;
}) {
  const thongBao = loi || ok;
  return (
    <ThanhDinhDay
      chiDienThoai
      className={cn(
        "-mx-4 border-t border-line bg-canvas px-4 pt-3 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pt-0",
        className,
      )}
    >
      {thongBao ? (
        <p
          aria-hidden="true"
          className={cn("mb-2 line-clamp-2 text-sm md:hidden", loi ? "text-danger" : "text-ok")}
        >
          {thongBao}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">{children}</div>
    </ThanhDinhDay>
  );
}
