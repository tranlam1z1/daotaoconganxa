/**
 * Đồng hồ đếm ngược của một bước (docs/PLAN.md GĐ-G0; hiệu ứng 7 và 8 của docs/VISUAL_STYLE.md).
 * Thời gian còn lại lấy từ máy chủ lúc gửi đề; đồng hồ trên máy chỉ để hiển thị, máy chủ tự tính giờ
 * khi chấm.
 *
 * Vòng tròn rút dần theo thời gian. 5 giây cuối đổi sang màu nhấn, 3 giây cuối sang đỏ và số đập nhẹ
 * mỗi giây, kèm tiếng tích (khi bật âm thanh). Hết giờ: rung, âm báo, gọi `onHet` một lần.
 * Cập nhật bằng requestAnimationFrame, chỉ ghi DOM khi số giây đổi hoặc vòng tròn nhích (§6.2).
 * Trình đọc màn hình chỉ được báo ở các mốc 10 giây, 5 giây và hết giờ.
 */
import { useEffect, useRef, useState } from "react";

import { phatAm } from "./hieu-ung/am-thanh";
import { rung } from "./hieu-ung/rung";

const R = 18;
const CHU_VI = 2 * Math.PI * R;

export function DongHoBuoc({
  conLaiMs,
  tongMs,
  onHet,
  dung = false,
  phutGiay = false,
}: {
  conLaiMs: number;
  tongMs: number;
  onHet?: () => void;
  /** Dừng đồng hồ (đã trả lời). */
  dung?: boolean;
  /** Hiện dạng phút:giây, cho đồng hồ cả lượt (GĐ-T1). Mặc định: số giây. */
  phutGiay?: boolean;
}) {
  const [con, datCon] = useState(conLaiMs);
  const moc = useRef(Date.now() + conLaiMs);
  const daBao = useRef(false);
  const onHetRef = useRef(onHet);
  onHetRef.current = onHet;

  useEffect(() => {
    moc.current = Date.now() + conLaiMs;
    daBao.current = conLaiMs <= 0;
    datCon(conLaiMs);
  }, [conLaiMs]);

  useEffect(() => {
    if (dung) return;
    let raf = 0;
    let giayTruoc = -1;
    let buocVongTruoc = -1;
    const chay = () => {
      const c = Math.max(0, moc.current - Date.now());
      const giay = Math.ceil(c / 1000);
      // Vòng tròn nhích theo 1/200 chu vi: đủ mượt mà không vẽ lại mỗi khung hình.
      const buocVong = Math.round((c / Math.max(1, tongMs)) * 200);
      if (giay !== giayTruoc || buocVong !== buocVongTruoc) {
        if (giay !== giayTruoc && giay > 0 && giay <= 3 && giayTruoc !== -1) phatAm("tich");
        giayTruoc = giay;
        buocVongTruoc = buocVong;
        datCon(c);
      }
      if (c === 0) {
        if (!daBao.current) {
          daBao.current = true;
          phatAm("het_gio");
          rung("het_gio");
          onHetRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(chay);
    };
    raf = requestAnimationFrame(chay);
    return () => cancelAnimationFrame(raf);
  }, [dung, tongMs]);

  const giay = Math.ceil(con / 1000);
  const tyLe = tongMs > 0 ? Math.max(0, Math.min(1, con / tongMs)) : 0;
  const mau = giay <= 3 ? "var(--danger)" : giay <= 5 ? "var(--g-nhan)" : "var(--primary)";
  const baoDoc = giay === 10 || giay === 5 || giay === 0 || (phutGiay && (giay === 60 || giay === 30));
  const hien = phutGiay ? `${Math.floor(giay / 60)}:${String(giay % 60).padStart(2, "0")}` : String(giay);

  return (
    <div className="flex items-center gap-2">
      <span className="relative grid size-11 place-items-center">
        <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 size-11 -rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            stroke={mau}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CHU_VI}
            strokeDashoffset={CHU_VI * (1 - tyLe)}
          />
        </svg>
        <span
          key={giay <= 3 && !dung ? giay : "on-dinh"}
          className={`g-so relative font-bold ${phutGiay ? "text-sm" : "text-base"} ${giay <= 3 && giay > 0 && !dung ? "g-t g-dap" : ""}`}
          style={{ color: giay <= 5 ? mau : "var(--ink)" }}
        >
          {hien}
        </span>
      </span>
      <span className="sr-only">giây còn lại</span>
      <span className="sr-only" aria-live="polite">
        {baoDoc ? (giay === 0 ? "Hết giờ" : `Còn ${giay} giây`) : ""}
      </span>
    </div>
  );
}
