import type { Config } from "@react-router/dev/config";

// Bật SSR toàn bộ: trang văn bản phải render phía máy chủ cho SEO (ADR-01, ke-hoach/10 §1).
export default {
  ssr: true,
  // Chọn trước hành vi của React Router v8 để lần nâng cấp không phải sửa gấp, và để
  // dev/build không còn spam cảnh báo che mất lỗi thật.
  // Áp được vì app không dùng `context` trong loader/action, chạy react-router-serve
  // chuẩn (không có máy chủ tùy biến) và đã ở Vite 6.
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
  // Chặn CSRF của React Router so `Origin` với URL của request. Trên DigitalOcean, proxy đã giải
  // HTTPS và react-router-serve không bật `trust proxy`, nên URL request là http:// còn trình duyệt
  // gửi Origin https:// — mọi action (ghi danh, đăng nhập, quản trị…) bị trả 400. Khai đích danh
  // tên miền của app; không dùng *.ondigitalocean.app vì như vậy app khác cũng gửi action vào được.
  // Tên miền ngrok cố định dùng khi mở bản demo trên máy ra Internet (ngrok http 3080 --url=…).
  // hocluat.senow.tech, hocluat.dmst.vn: bản demo trên VPS sau Traefik (infra/vps-demo), cùng lý do như trên.
  // daotaonghiepvu.click: bản demo trên VPS sau Caddy (infra/vps-demo/Caddyfile.snippet), cùng lý do.
  allowedActionOrigins: [
    "daotaonghiepvu.click",
    "www.daotaonghiepvu.click",
    "qdpl-wyo3f.ondigitalocean.app",
    "quydinhphapluat.vn",
    "www.quydinhphapluat.vn",
    "resort-nail-deserving.ngrok-free.dev",
    "hocluat.senow.tech",
    "hocluat.dmst.vn",
  ],
} satisfies Config;
