import { BRAND_PATHS, brandFill, type BrandVariant } from "../../lib/brand-mark";

export type LogoHocTapVariant = BrandVariant;

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
  return (
    <svg
      viewBox="0 0 320 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {BRAND_PATHS.map((shape) => (
        <path key={shape.d} d={shape.d} fill={brandFill(shape.tone, variant)} />
      ))}
    </svg>
  );
}
export default LogoHocTap;
