import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Cổng lấy từ WEB_PORT do scripts/serve.ts đặt theo hồ sơ (dev 3030, thu 3060).
 * Không import @qdpl/config ở đây: vite.config được Node nạp trực tiếp nên không
 * đọc được TypeScript nguồn của workspace.
 */
const port = Number(process.env.WEB_PORT ?? 3030);

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  // React và router phải dùng chung một bản trong workspace, kể cả sau khi Vite tối ưu lại module.
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "react-router"],
  },
  server: {
    // Khớp với isPortFree và URL của launcher; localhost có thể trỏ tới ::1.
    host: "127.0.0.1",
    port,
    // Không tự nhảy sang cổng khác: scripts/serve.ts đã giải phóng cổng trước khi chạy,
    // nếu vẫn bận thì phải báo lỗi để biết, chứ không im lặng đổi cổng.
    strictPort: true,
    allowedHosts: ["resort-nail-deserving.ngrok-free.dev", "66d0-113-160-183-253.ngrok-free.app"],
  },
  preview: { host: "127.0.0.1", port, strictPort: true },
});
