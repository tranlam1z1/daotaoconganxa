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
  server: {
    port,
    // Không tự nhảy sang cổng khác: scripts/serve.ts đã giải phóng cổng trước khi chạy,
    // nếu vẫn bận thì phải báo lỗi để biết, chứ không im lặng đổi cổng.
    strictPort: true,
    allowedHosts: ["resort-nail-deserving.ngrok-free.dev"],
  },
  preview: { port, strictPort: true },
});
