/**
 * Điểm vào máy chủ API (Hono trên Bun).
 *
 * Cổng lấy theo sơ đồ ở packages/config (dev 3031, thu 3061), có thể ép bằng PORT — trên
 * DigitalOcean App Platform biến PORT do nền tảng đặt, và địa chỉ lắng nghe là 0.0.0.0.
 * Nếu cổng đang bị chiếm bởi một tiến trình khác thì tự giải phóng rồi mở lại —
 * xem LENH.md mục "Cổng bị chiếm".
 */
import { bindHost, currentProfile, listenWithRetry, portFor } from "@qdpl/config";
import { createApp } from "./app.ts";

const profile = currentProfile();
const port = portFor("api", profile);
const app = createApp();

const server = await listenWithRetry(port, () =>
  Bun.serve({
    port,
    hostname: bindHost(),
    fetch: app.fetch,
    // Câu hỏi RAG có thể chạy lâu hơn mặc định.
    idleTimeout: 120,
  }),
);

console.log(
  `API Quy định Pháp luật đang chạy tại http://${server.hostname}:${server.port} (hồ sơ ${profile}, pid ${process.pid})`,
);

export { app, server };
