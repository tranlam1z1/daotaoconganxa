/**
 * Logo "Khiên tri thức": khiên đỏ viền vàng, ngôi sao và cuốn sách mở. Bản gốc ở public/logo.svg
 * (favicon, trang offline, scripts/pwa-icons.ts); sửa hình thì sửa cả hai nơi.
 */
export function LogoKhien({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path d="M60 8 L104 22 V58 C104 86 84 104 60 114 C36 104 16 86 16 58 V22 Z" fill="#DA251D" />
      <path
        d="M60 15 L97 27 V58 C97 82 80 98 60 107 C40 98 23 82 23 58 V27 Z"
        fill="none"
        stroke="#FFFF00"
        strokeWidth="2.5"
      />
      <polygon
        points="60,27 63.06,35.79 72.36,35.98 64.95,41.61 67.64,50.52 60,45.2 52.36,50.52 55.05,41.61 47.64,35.98 56.94,35.79"
        fill="#FFFF00"
      />
      <path d="M32 62 Q46 56 58 63 V91 Q46 85 32 90 Z" fill="#FFFFFF" />
      <path d="M62 63 Q74 56 88 62 V90 Q74 85 62 91 Z" fill="#FFFFFF" />
      <path
        d="M38 69 Q46 66 53 70 M38 76 Q46 73 53 77 M67 70 Q74 66 82 69 M67 77 Q74 73 82 76"
        stroke="#DA251D"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
