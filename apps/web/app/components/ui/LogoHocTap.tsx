import { useId } from "react";
import { BRAND_COLORS, BRAND_DRUM_RINGS, BRAND_PATHS } from "../../lib/brand-mark";

export type LogoHocTapVariant = "mau" | "trang" | "den";

/** Cùng hình học với public/logo.svg, favicon và biểu tượng PWA. */
export function LogoHocTap({
  className,
  variant = "mau",
  title,
}: {
  className?: string;
  variant?: LogoHocTapVariant;
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {variant === "mau" ? (
        <defs>
          {Object.entries(BRAND_COLORS).map(([tone, colors]) => (
            <linearGradient key={tone} id={`${uid}-${tone}`} x2="0" y2="1">
              <stop stopColor={colors[0]} />
              <stop offset="1" stopColor={colors[1]} />
            </linearGradient>
          ))}
        </defs>
      ) : null}
      {variant === "mau" ? (
        <g fill="none" stroke="#D1AA36" strokeWidth="1.5" opacity=".2">
          {BRAND_DRUM_RINGS.map((r) => (
            <circle key={r} cx="160" cy="142" r={r} />
          ))}
        </g>
      ) : null}
      {BRAND_PATHS.map((shape) => (
        <path
          key={shape.d}
          d={shape.d}
          fill={
            variant === "mau" ? `url(#${uid}-${shape.tone})` : variant === "trang" ? "#FFFFFF" : "#000000"
          }
          fillRule={"fillRule" in shape ? shape.fillRule : undefined}
        />
      ))}
    </svg>
  );
}
export default LogoHocTap;
