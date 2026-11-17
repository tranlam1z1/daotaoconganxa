import { SITE_NAME_LINES } from "../../lib/site";

/** Tên hệ thống hai dòng cạnh logo; `inverse` cho nền xanh hoặc nền tối. */
export function BrandName({ inverse = false }: { inverse?: boolean }) {
  const [title, subtitle] = SITE_NAME_LINES;
  return (
    <span className={`brand-name${inverse ? " brand-name-inverse" : ""}`}>
      <span className="brand-name-title">{title}</span>
      <span className="brand-name-subtitle">{subtitle}</span>
    </span>
  );
}
