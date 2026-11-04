/**
 * Khởi tạo ứng dụng Hono. Tách khỏi index.ts để test gọi trực tiếp app.request()
 * mà không cần mở cổng mạng.
 */

import { sql } from "@qdpl/db";
import { isMock } from "@qdpl/llm";
import { embeddingMode, embeddingModel } from "@qdpl/search";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { danhTinh, diaChiIp, gioiHanChoXacMinh, loiXacThuc } from "./auth.ts";
import { handleError, notFound, today } from "./http.ts";
import { ask } from "./routes/ask.ts";
import { auth } from "./routes/auth.ts";
import { baoCao } from "./routes/bao-cao.ts";
import { bienBao } from "./routes/bien-bao.ts";
import { citations } from "./routes/citations.ts";
import { daoTao } from "./routes/dao-tao.ts";
import { deThiRoute, giaoBaiRoute } from "./routes/de-thi.ts";
import { diaGioiRoute } from "./routes/dia-gioi.ts";
import { documents } from "./routes/documents.ts";
import { duLieuTraCuuRoute } from "./routes/du-lieu-tra-cuu.ts";
import { editorial } from "./routes/editorial.ts";
import { giongDoc } from "./routes/giong-doc.ts";
import { luyenTap } from "./routes/luyen-tap.ts";
import { mascot } from "./routes/mascot.ts";
import { nganHang } from "./routes/ngan-hang.ts";
import { donViRoute, nguoiDungRoute } from "./routes/nguoi-dung.ts";
import { nhomRoute, quanTriNhomRoute } from "./routes/nhom.ts";
import { nodes } from "./routes/nodes.ts";
import { quanTri } from "./routes/quan-tri.ts";
import { quanTriVanBanRoute } from "./routes/quan-tri-van-ban.ts";
import { searchRoute } from "./routes/search.ts";
import { searchDocuments } from "./routes/search-documents.ts";
import { thiRoute } from "./routes/thi.ts";
import { thongBao } from "./routes/thong-bao.ts";
import { toi } from "./routes/toi.ts";
import { traCuuNhanh } from "./routes/tra-cuu-nhanh.ts";
import { traffic, trafficGuard } from "./routes/traffic.ts";

export function createApp() {
  const app = new Hono();

  // CORS cho web app (React Router SSR gọi từ trình duyệt ở môi trường dev).
  // Danh sách origin đọc từ CORS_ORIGINS, phân tách bằng dấu phẩy (docs/PLAN.md GĐ0 S5). Thiếu
  // biến: máy phát triển cho mọi origin; máy chủ thật không cho origin nào, vì web gọi API từ
  // phía máy chủ (SSR) nên không cần CORS.
  const macDinh = process.env.NODE_ENV === "production" ? "" : "*";
  const origins = (process.env.CORS_ORIGINS?.trim() || macDinh)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    "*",
    cors({
      origin: origins.includes("*") ? "*" : origins,
      // Các API quản trị (đơn vị, người dùng, ngân hàng câu hỏi, đề thi) dùng PATCH, PUT, DELETE.
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "Accept-Version"],
      exposeHeaders: ["X-Api-Version"],
      maxAge: 86_400,
    }),
  );

  app.use("*", async (c, next) => {
    c.header("X-Api-Version", "v1");
    await next();
  });

  /**
   * Nhật ký truy cập (docs/PLAN.md GĐ2): mỗi request một dòng access_log, ghi đường dẫn MẪU
   * của route, không ghi body, query hay header. Bỏ qua preflight OPTIONS và /health (máy
   * giám sát gọi liên tục). Ghi lỗi thì chỉ in log, không làm hỏng câu trả lời.
   */
  app.use("*", async (c, next) => {
    const t0 = performance.now();
    await next();
    if (c.req.method === "OPTIONS" || c.req.path === "/health") return;
    try {
      // Hono đặt routePath theo handler chạy sau cùng; "*" nghĩa là không route nào khớp.
      const route =
        c.req.routePath === "*" || c.req.routePath === "/*" ? "(không có route)" : c.req.routePath;
      const nguoi = await danhTinh(c);
      await sql`
        INSERT INTO access_log (account_id, method, route, status, ms, ip)
        VALUES (${nguoi?.accountId ?? null}, ${c.req.method}, ${route}, ${c.res.status},
                ${Math.round(performance.now() - t0)}, ${diaChiIp(c)})`;
    } catch (err) {
      console.error("[api] không ghi được nhật ký truy cập:", err);
    }
  });

  // Tài khoản chưa được xác minh cán bộ chỉ mang danh tính vào nhóm API tài khoản (auth.ts).
  app.use("/v1/*", gioiHanChoXacMinh);
  app.use("/api/v1/*", gioiHanChoXacMinh);
  app.use("/api/v1/*", trafficGuard);

  app.onError((err, c) => loiXacThuc(err, c) ?? handleError(err, c));
  app.notFound((c) => {
    throw notFound(`Không có endpoint ${c.req.method} ${new URL(c.req.url).pathname}`);
  });

  app.get("/health", async (c) => {
    let db = "ok";
    let dbError: string | null = null;
    try {
      await sql`SELECT 1`;
    } catch (err) {
      db = "loi";
      dbError = err instanceof Error ? err.message : String(err);
    }
    return c.json(
      {
        status: db === "ok" ? "ok" : "suy_giam",
        today: today(),
        db,
        dbError,
        llm: isMock() ? "mock" : "anthropic",
        embedding: { mode: embeddingMode(), model: embeddingModel() },
        version: "v1",
      },
      db === "ok" ? 200 : 503,
    );
  });

  app.route("/v1/auth", auth);
  app.route("/api/v1/traffic", traffic);
  app.route("/api/v1/tra-cuu/bien-bao", bienBao);
  app.route("/api/v1/tra-cuu", traCuuNhanh);
  app.route("/api/v1/quan-tri/du-lieu-tra-cuu", duLieuTraCuuRoute);
  app.route("/v1/documents", documents);
  app.route("/v1/nodes", nodes);
  app.route("/v1/search/documents", searchDocuments);
  app.route("/v1/search", searchRoute);
  app.route("/v1/tra-cuu/bien-bao", bienBao);
  app.route("/v1/tra-cuu", traCuuNhanh);
  app.route("/v1/dia-gioi", diaGioiRoute);
  app.route("/v1/ask", ask);
  app.route("/v1/citations", citations);
  app.route("/v1/dao-tao", daoTao);
  app.route("/v1/mascot", mascot);
  app.route("/v1/giong-doc", giongDoc);
  app.route("/v1/quan-tri/don-vi", donViRoute);
  app.route("/v1/quan-tri/nguoi-dung", nguoiDungRoute);
  app.route("/v1/quan-tri/ngan-hang", nganHang);
  app.route("/v1/quan-tri/du-lieu-tra-cuu", duLieuTraCuuRoute);
  // Thêm, sửa, xóa văn bản trong kho (Markdown phiên bản gốc).
  app.route("/v1/quan-tri/van-ban", quanTriVanBanRoute);
  app.route("/v1/quan-tri/de-thi", deThiRoute);
  // Quản lý xem nhóm học cùng (docs/PLAN.md GĐ16c).
  app.route("/v1/quan-tri/nhom", quanTriNhomRoute);
  app.route("/v1/giao-bai", giaoBaiRoute);
  app.route("/v1/thi", thiRoute);
  app.route("/v1/luyen-tap", luyenTap);
  // Nhóm học cùng (docs/PLAN.md GĐ16a).
  app.route("/v1/nhom", nhomRoute);
  app.route("/v1/toi", toi);
  app.route("/v1/thong-bao", thongBao);
  app.route("/v1/bao-cao", baoCao);
  app.route("/v1/quan-tri", quanTri);
  app.route("/v1", editorial);

  return app;
}

export type App = ReturnType<typeof createApp>;
