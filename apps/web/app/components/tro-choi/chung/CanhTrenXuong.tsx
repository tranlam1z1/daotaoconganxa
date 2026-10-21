/**
 * Khung vẽ cảnh từ trên xuống (mô-đun M6, docs/GAME_DESIGN.md §4, VISUAL_STYLE §6).
 *
 * Một lớp Canvas 2D. Logic chạy theo nhịp cố định NHIP_MS (bộ mô phỏng M5); hình vẽ nội suy giữa
 * hai nhịp để mượt 60 khung hình/giây. Giới hạn 2× điểm ảnh. Tab ẩn thì dừng vòng vẽ (và báo
 * `onTamDung`), hiện lại thì chạy tiếp. Không chạy thì chỉ vẽ lại khi `phienBan` hay cỡ khung đổi.
 *
 * Chế độ từng bước (giảm chuyển động): trò không bật `chay`, tự gọi bước mô phỏng rồi tăng
 * `phienBan`; khung vẽ đúng trạng thái đó, không hoạt ảnh.
 *
 * Lớp phủ (nút, nhãn chữ) đặt trong `lopPhu`, nhận phép biến đổi để đặt đúng chỗ trên bản đồ.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import { NHIP_MS } from "../../../../../../packages/dao-tao/src/mo-phong/mo-phong.ts";
import { type BienDoi, type KhungBanDo, taoBienDoi } from "../../../lib/ve-canh/bien-doi";

export interface PropsCanh {
  khung: KhungBanDo;
  /** Chiều cao khung vẽ, px CSS; chiều rộng theo khung chứa. */
  cao: number;
  /** GĐ-T5: chiều cao = chiều rộng × tỷ lệ này (giữ đúng tỷ lệ khung camera); có thì bỏ qua `cao`. */
  tyLeCao?: number;
  /** Vẽ một khung hình. `alpha`: vị trí giữa nhịp trước và nhịp sau (0–1). */
  ve: (ctx: CanvasRenderingContext2D, bd: BienDoi, alpha: number) => void;
  /** Đang chạy vòng mô phỏng. */
  chay: boolean;
  /** Tiến một nhịp; trả false khi mô phỏng xong. */
  tienNhip?: () => boolean;
  /** Số nhịp mỗi NHIP_MS thời gian thật (tua nhanh). */
  heSoTua?: number;
  onXong?: () => void;
  onTamDung?: (dung: boolean) => void;
  /** Đổi giá trị này để vẽ lại khi không chạy. */
  phienBan?: unknown;
  nhan: string;
  lopPhu?: (bd: BienDoi) => ReactNode;
  className?: string;
}

export function CanhTrenXuong({
  khung,
  cao: caoDat,
  tyLeCao,
  ve,
  chay,
  tienNhip,
  heSoTua = 1,
  onXong,
  onTamDung,
  phienBan,
  nhan,
  lopPhu,
  className,
}: PropsCanh) {
  const hop = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rong, datRong] = useState(0);
  const cao = tyLeCao ? Math.round((rong || 328) * tyLeCao) : caoDat;
  const bd = rong > 0 ? taoBienDoi(khung, rong, cao) : null;
  // Hàm mới nhất, để vòng vẽ không phải khởi động lại khi trang render lại.
  const moi = useRef({ ve, tienNhip, onXong, onTamDung, bd });
  moi.current = { ve, tienNhip, onXong, onTamDung, bd };

  // Theo dõi chiều rộng khung chứa.
  useEffect(() => {
    const el = hop.current;
    if (!el) return;
    const ro = new ResizeObserver(() => datRong(Math.floor(el.clientWidth)));
    ro.observe(el);
    datRong(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Cỡ điểm ảnh của canvas.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !rong) return;
    const tyLe = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(rong * tyLe);
    c.height = Math.round(cao * tyLe);
    c.getContext("2d")?.setTransform(tyLe, 0, 0, tyLe, 0, 0);
  }, [rong, cao]);

  const veMot = (alpha: number) => {
    const ctx = canvas.current?.getContext("2d");
    const { bd: b, ve: v } = moi.current;
    if (ctx && b) v(ctx, b, alpha);
  };

  // Không chạy: vẽ một lần khi dữ liệu hay cỡ khung đổi.
  // biome-ignore lint/correctness/useExhaustiveDependencies: vẽ lại theo phienBan, cỡ khung.
  useEffect(() => {
    if (!chay) veMot(1);
  }, [chay, phienBan, rong, cao]);

  // Vòng mô phỏng và vẽ. Chỉ khởi động lại khi bật/tắt, đổi cỡ khung hay đổi tốc độ tua; hàm vẽ và
  // hàm tiến nhịp đọc qua ref.
  // biome-ignore lint/correctness/useExhaustiveDependencies: xem chú thích trên.
  useEffect(() => {
    if (!chay || !rong) return;
    let raf = 0;
    let truoc = performance.now();
    let tichLuy = 0;
    let xong = false;
    const khungHinh = (now: number) => {
      tichLuy += Math.min(250, now - truoc) * heSoTua;
      truoc = now;
      while (tichLuy >= NHIP_MS && !xong) {
        tichLuy -= NHIP_MS;
        if (!moi.current.tienNhip?.()) xong = true;
      }
      veMot(xong ? 1 : tichLuy / NHIP_MS);
      if (xong) moi.current.onXong?.();
      else raf = requestAnimationFrame(khungHinh);
    };
    raf = requestAnimationFrame(khungHinh);
    const doiHienThi = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        moi.current.onTamDung?.(true);
      } else if (!xong) {
        truoc = performance.now();
        moi.current.onTamDung?.(false);
        raf = requestAnimationFrame(khungHinh);
      }
    };
    document.addEventListener("visibilitychange", doiHienThi);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", doiHienThi);
    };
  }, [chay, rong, cao, heSoTua]);

  return (
    <div ref={hop} className={className} style={{ position: "relative", height: cao }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={nhan}
        style={{ width: "100%", height: cao, display: "block" }}
      />
      {bd && lopPhu ? lopPhu(bd) : null}
    </div>
  );
}
