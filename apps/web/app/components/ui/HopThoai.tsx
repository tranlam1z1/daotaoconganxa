import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "../../lib/cn";
import { Icon } from "./Icon";

/**
 * Hộp nào đang mở trên trang, kèm dữ liệu đi theo (ví dụ thành viên đang xem). `lan` tăng mỗi lần
 * mở: đặt làm `key` cho phần nội dung để biểu mẫu và kết quả gửi của lần trước không còn.
 */
export function useHop<T extends string, D = undefined>() {
  const [dang, datDang] = useState<{ ten: T; duLieu: D } | null>(null);
  const [lan, datLan] = useState(0);
  return {
    lan,
    dang: dang?.ten ?? null,
    duLieu: dang?.duLieu,
    la: (ten: T) => dang?.ten === ten,
    mo: (ten: T, duLieu?: D) => {
      datLan((n) => n + 1);
      datDang({ ten, duLieu: duLieu as D });
    },
    dong: () => datDang(null),
  };
}

const O_NHAP =
  "input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=range]), textarea, select";

/**
 * Bàn phím ảo che mất phần dưới màn hình (visualViewport co lại): đặt vị trí, chiều cao của phần còn
 * nhìn thấy lên hộp (biến --vv-*, lớp .hop-thoai trong app.css) để hộp nằm gọn phía trên bàn phím,
 * rồi kéo ô đang nhập vào tầm nhìn.
 */
function useTranhBanPhim(ref: React.RefObject<HTMLDialogElement | null>, mo: boolean) {
  useEffect(() => {
    const d = ref.current;
    const vv = window.visualViewport;
    if (!mo || !d || !vv) return;
    const capNhat = () => {
      const bienMat = window.innerHeight - vv.height;
      if (bienMat > 100) {
        d.style.setProperty("--vv-tren", `${vv.offsetTop}px`);
        d.style.setProperty("--vv-duoi", `${Math.max(0, bienMat - vv.offsetTop)}px`);
        d.style.setProperty("--vv-cao", `${vv.height}px`);
      } else {
        for (const b of ["--vv-tren", "--vv-duoi", "--vv-cao"]) d.style.removeProperty(b);
      }
      const o = document.activeElement;
      if (o instanceof HTMLElement && d.contains(o) && o.matches(O_NHAP))
        o.scrollIntoView({ block: "nearest" });
    };
    capNhat();
    vv.addEventListener("resize", capNhat);
    vv.addEventListener("scroll", capNhat);
    return () => {
      vv.removeEventListener("resize", capNhat);
      vv.removeEventListener("scroll", capNhat);
    };
  }, [ref, mo]);
}

/**
 * Hộp thoại dùng chung (docs/PLAN.md GĐ16b), theo mẫu components/thi/HopXacNhanNop.tsx:
 * - thẻ <dialog> gốc mở bằng showModal(): trình duyệt giữ tiêu điểm bên trong, Esc để đóng;
 * - hộp giữa màn hình trên mọi cỡ màn (lớp .hop-thoai): rộng tối đa 400px trên điện thoại, cao tối
 *   đa 85% màn hình; tiêu đề và vùng nút luôn hiện, phần nội dung cuộn bên trong;
 * - mở: phóng từ 0,9 lên 1 kèm hiện dần (200ms); đóng thì ngược lại. Giảm chuyển động: chỉ hiện dần;
 * - bấm ra nền mờ hoặc nút X để đóng, trừ hộp `quanTrong` (xác nhận nộp bài, xóa…) chỉ đóng bằng
 *   nút trong hộp, nút X hoặc Esc;
 * - khóa cuộn nền khi mở; đóng thì trả tiêu điểm về phần tử đã mở hộp.
 *
 * `hanhDong` là vùng nút ở đáy hộp: điện thoại xếp dọc, nút chính đặt cuối (nằm dưới cùng); từ 640px
 * xếp ngang, nút chính bên phải. Hộp có biểu mẫu thì đặt nút gửi trong `VungNutHop` ở cuối biểu mẫu.
 */
export function HopThoai({
  mo,
  tieuDe,
  onDong,
  children,
  hanhDong,
  quanTrong = false,
  className,
}: {
  mo: boolean;
  tieuDe: string;
  onDong: () => void;
  children: ReactNode;
  hanhDong?: ReactNode;
  /** Hộp xác nhận quan trọng: bấm ra nền không đóng. */
  quanTrong?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const moTu = useRef<HTMLElement | null>(null);
  // true khi hộp đóng vì nơi gọi đặt `mo = false` (không phải người dùng bấm Esc hay "Đóng").
  const dongTheoProps = useRef(false);
  // Lần chạm bắt đầu trên nền mờ (chính thẻ dialog): kéo chọn chữ từ trong hộp ra nền không đóng hộp.
  const chamNen = useRef(false);
  const idTieuDe = useId();
  useTranhBanPhim(ref, mo);

  // Giữ nội dung lần mở gần nhất trong lúc hộp mờ dần khi đóng (nơi gọi thường bỏ nội dung ngay).
  const noiDung = useRef({ tieuDe, children, hanhDong });
  if (mo) noiDung.current = { tieuDe, children, hanhDong };
  const hien = noiDung.current;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (mo && !d.open) {
      moTu.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!mo && d.open) {
      dongTheoProps.current = true;
      d.close();
    }
  }, [mo]);

  // Gỡ khóa cuộn khi hộp bị gỡ khỏi trang lúc đang mở (chuyển trang).
  useEffect(
    () => () => {
      if (!document.querySelector("dialog[open]")) document.documentElement.style.overflow = "";
    },
    [],
  );

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: bàn phím đóng bằng Esc (hành vi gốc của dialog) và nút Đóng
    <dialog
      ref={ref}
      aria-labelledby={idTieuDe}
      data-hop-thoai=""
      onPointerDown={(e) => {
        chamNen.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Chạm vào nền mờ (chính thẻ dialog, ngoài khung nội dung) thì đóng.
        if (!quanTrong && chamNen.current && e.target === e.currentTarget) ref.current?.close();
        chamNen.current = false;
      }}
      onClose={() => {
        // Sự kiện close đến sau: lúc đó có thể một hộp khác đã mở thay hộp này.
        if (!document.querySelector("dialog[open]")) document.documentElement.style.overflow = "";
        if (dongTheoProps.current) {
          dongTheoProps.current = false;
          return;
        }
        moTu.current?.focus();
        onDong();
      }}
      className={cn("hop-thoai", className)}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 py-1 pr-1 pl-4 md:pl-6">
        <h2 id={idTieuDe} className="min-w-0 pt-3.5 font-sans text-lg font-semibold leading-snug">
          {hien.tieuDe}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Đóng"
          className="lun grid size-12 shrink-0 place-items-center rounded-btn text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="close" />
        </button>
      </div>
      {/* flex-auto (cơ sở auto), không dùng flex-1 (cơ sở 0%): Safari/iOS coi chiều cao hộp (fixed, có
          cả top lẫn bottom) là xác định nên tính 0% ra 0px, phần nội dung bẹp mất, hộp chỉ còn tiêu đề
          và vùng nút. Cơ sở auto lấy đúng chiều cao nội dung rồi co lại, cuộn khi chạm max-height. */}
      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-4 pt-1 pb-4 text-base leading-relaxed md:px-6 md:pb-6">
        {hien.children}
      </div>
      {hien.hanhDong ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end md:px-6 md:py-4">
          {hien.hanhDong}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Vùng nút cuối biểu mẫu trong hộp: dính đáy phần nội dung đang cuộn nên nút gửi luôn nhìn thấy.
 * Xếp như `hanhDong` của HopThoai: điện thoại xếp dọc, nút chính cuối; từ 640px nằm ngang bên phải.
 * `bottom` âm bằng đúng padding đáy của phần nội dung: trình duyệt tính điểm dính từ mép trong của
 * padding, để `bottom-0` thì vùng nút bị đẩy lên đè nội dung và hở một khoảng trắng bên dưới.
 */
export function VungNutHop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:justify-end md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6 md:py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
