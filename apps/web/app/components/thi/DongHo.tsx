import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { dinhDangDemNguoc } from "../../lib/thi";
import { Icon } from "../ui/Icon";

/**
 * Đồng hồ đếm ngược. Số giây gốc do máy chủ tính lúc tải trang (`giayConLai`); đồng hồ chỉ
 * trừ dần theo thời gian thực của máy người thi, nên chỉnh giờ máy không kéo dài được bài.
 * Máy chủ vẫn là bên quyết định: câu trả lời gửi quá hạn bị từ chối.
 *
 * Đọc cho trình đọc màn hình mỗi mốc 5 phút và 1 phút cuối, không đọc từng giây.
 */
export function DongHo({ giayConLai, onHetGio }: { giayConLai: number; onHetGio: () => void }) {
  const [con, setCon] = useState(giayConLai);
  const moc = useRef({ luc: performance.now(), giay: giayConLai });
  const daBao = useRef(false);

  useEffect(() => {
    moc.current = { luc: performance.now(), giay: giayConLai };
    daBao.current = false;
    setCon(giayConLai);
  }, [giayConLai]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const troi = (performance.now() - moc.current.luc) / 1000;
      const moi = Math.max(0, Math.round(moc.current.giay - troi));
      setCon(moi);
      if (moi === 0 && !daBao.current) {
        daBao.current = true;
        onHetGio();
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [onHetGio]);

  const sapHet = con <= 300;
  const thongBao =
    con === 0
      ? "Đã hết giờ làm bài."
      : con <= 60
        ? "Còn dưới 1 phút."
        : con % 300 === 0
          ? `Còn ${con / 60} phút.`
          : "";

  // Hướng "Công văn": chữ số đều bề rộng của Public Sans, viền mảnh; 5 phút cuối chuyển đỏ son.
  return (
    <div
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-btn border px-3 text-base font-bold tabular-nums sm:text-lg",
        sapHet ? "border-danger bg-danger-soft text-danger" : "border-line-strong bg-surface text-ink",
      )}
    >
      <Icon name="clock" kieu="net" className="size-5 shrink-0" />
      <span className="sr-only">Thời gian còn lại</span>
      <span aria-hidden="true">{dinhDangDemNguoc(con)}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {thongBao}
      </span>
    </div>
  );
}
