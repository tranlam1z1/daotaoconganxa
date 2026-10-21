import { type ComponentProps, useState } from "react";

import { cn } from "../../lib/cn";
import { Input } from "./Field";
import { Icon, type IconName } from "./Icon";

/** Ô nhập có biểu tượng bên trái; ô mật khẩu thêm nút hiện/ẩn bên phải (trang đăng nhập, đăng ký). */
export function OCoIcon({ icon, type, className, ...props }: ComponentProps<"input"> & { icon: IconName }) {
  const [hien, setHien] = useState(false);
  const laMatKhau = type === "password";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-2">
        <Icon name={icon} kieu="net" className="size-5" />
      </span>
      <Input
        type={laMatKhau && hien ? "text" : type}
        className={cn("pl-10 text-base", laMatKhau && "pr-12", className)}
        {...props}
      />
      {laMatKhau ? (
        <button
          type="button"
          onClick={() => setHien((v) => !v)}
          aria-label={hien ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={hien}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-3 hover:text-ink"
        >
          <Icon name={hien ? "eye" : "eyeOff"} kieu="net" className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
