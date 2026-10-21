import { useState } from "react";

import { cn } from "../../lib/cn";
import { chuCaiDaiDien } from "../../lib/format";
import type { NguoiDung } from "../../lib/types";

/** Đường dẫn ảnh đại diện trên máy chủ web (chuyển tiếp từ API, xem routes/anh-dai-dien.tsx). */
export function duongAnhDaiDien(tep: string): string {
  return `/anh-dai-dien/${encodeURIComponent(tep)}`;
}

/**
 * Ảnh đại diện tròn: ảnh người dùng tự tải lên, hoặc chữ cái đầu của tên trên nền primary khi chưa
 * có ảnh (hay ảnh tải lỗi). Kích thước, cỡ chữ truyền qua className.
 */
export function AnhDaiDien({
  nguoiDung,
  src,
  className,
}: {
  nguoiDung: Pick<NguoiDung, "ten" | "email" | "ten_dang_nhap" | "anh_dai_dien">;
  /** Ảnh xem trước (blob:) thay cho ảnh đã lưu. */
  src?: string | null;
  className?: string;
}) {
  const [loi, setLoi] = useState<string | null>(null);
  const anh = src ?? (nguoiDung.anh_dai_dien ? duongAnhDaiDien(nguoiDung.anh_dai_dien) : null);
  const coAnh = anh && loi !== anh;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-bold text-on-primary",
        className,
      )}
    >
      {coAnh ? (
        <img src={anh} alt="" className="size-full object-cover" onError={() => setLoi(anh)} />
      ) : (
        chuCaiDaiDien(nguoiDung.ten ?? nguoiDung.ten_dang_nhap ?? nguoiDung.email)
      )}
    </span>
  );
}
