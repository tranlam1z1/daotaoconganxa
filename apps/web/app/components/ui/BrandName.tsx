import { SITE_NAME, SITE_TAGLINE } from "../../lib/site";

/** Tên hệ thống hai dòng theo bộ nhận diện, dùng bản trắng trên nền đỏ. */
export function BrandName({ inverse = false }: { inverse?: boolean }) {
  const [title, subtitle] = SITE_NAME.split(" & ");
  return (
    <span className={`brand-name${inverse ? " brand-name-inverse" : ""}`}>
      <span className="brand-name-title">{title}</span>
      <span className="brand-name-subtitle">&amp; {subtitle}</span>
      <span className="brand-name-rule" aria-hidden="true" />
      <span className="brand-name-tagline">{SITE_TAGLINE}</span>
    </span>
  );
}
