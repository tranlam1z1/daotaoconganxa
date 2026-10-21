/**
 * Ứng dụng cài được và dùng khi mất mạng (docs/PLAN.md GĐ13):
 *  - đăng ký service worker (public/sw.js), chỉ ở bản build;
 *  - biểu ngữ "Đang không có mạng" ở đầu trang, kèm lối vào luyện tập không cần mạng;
 *  - có mạng lại thì gửi kết quả luyện tập offline đang chờ.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { batDongBoTuDong } from "../../lib/offline/dong-bo";

/** true khi trình duyệt báo mất mạng. Lúc render phía máy chủ luôn coi là có mạng. */
export function useMatMang(): boolean {
  const [matMang, datMatMang] = useState(false);
  useEffect(() => {
    datMatMang(!navigator.onLine);
    const bat = () => datMatMang(false);
    const tat = () => datMatMang(true);
    window.addEventListener("online", bat);
    window.addEventListener("offline", tat);
    return () => {
      window.removeEventListener("online", bat);
      window.removeEventListener("offline", tat);
    };
  }, []);
  return matMang;
}

export function TrangThaiMang({ daDangNhap }: { daDangNhap: boolean }) {
  const matMang = useMatMang();

  useEffect(() => {
    // Bản dev không đăng ký: service worker giữ tệp cũ, làm Vite HMR khó đoán.
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Không đăng ký được (trình duyệt chặn, chế độ riêng tư): ứng dụng vẫn chạy online bình thường.
    });
  }, []);

  useEffect(() => {
    if (daDangNhap) batDongBoTuDong();
  }, [daDangNhap]);

  if (!matMang) return null;
  return (
    <div role="status" className="border-b border-warn bg-warn-soft pl-[var(--cot-trai)]">
      <p className="wrap flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span>Đang không có mạng. Thi và hỏi đáp AI cần có mạng.</span>
        {/* reloadDocument: chuyển trang phía client cần tải /__manifest, mất mạng thì hỏng; tải cả trang thì service worker trả bản đã giữ. */}
        <Link
          to="/luyen-tap/offline"
          reloadDocument
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          Luyện tập không cần mạng
        </Link>
      </p>
    </div>
  );
}
