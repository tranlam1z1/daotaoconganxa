/** Kết nối Postgres dùng chung cho API, worker và script. */
import postgres, { type TransactionSql } from "postgres";

/**
 * Chọn CSDL theo môi trường.
 *
 * Test PHẢI chạy trên CSDL riêng: các nhánh phát triển song song từng ghi dữ liệu test
 * vào CSDL phát triển dùng chung (lệnh sửa đổi, job, việc biên tập rác), làm sai lệch
 * số liệu kiểm thử khói và báo cáo chất lượng. Bun đặt NODE_ENV=test khi chạy `bun test`.
 */
function resolveUrl(): string {
  if (process.env.NODE_ENV !== "test") {
    // Không còn giá trị mặc định: CSDL chính nằm trên Postgres của DigitalOcean, không phải
    // trên máy. Thiếu biến thì báo ngay, thay vì lặng lẽ nối vào một CSDL cục bộ không tồn tại.
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Chưa đặt DATABASE_URL. Chép .env.example thành .env rồi điền.");
    return url;
  }
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  // Test chạy trên Postgres cục bộ (bun run db:up); DATABASE_URL trỏ ra DigitalOcean,
  // nơi user qdpl không có quyền tạo CSDL <tên>_test.
  const base = process.env.DATABASE_URL ?? "postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat";
  // Suy ra tên CSDL test từ CSDL chính, giữ nguyên thông tin kết nối.
  // Phải idempotent: test-setup đặt lại DATABASE_URL thành URL test cho tiến trình con
  // kế thừa, nên hàm này có thể được gọi lại trên chính URL đã có hậu tố.
  const u = new URL(base);
  const name = u.pathname.replace(/^\//, "").replace(/\/$/, "");
  u.pathname = name.endsWith("_test") ? `/${name}` : `/${name}_test`;
  return u.toString();
}

const url = resolveUrl();

/** true khi đang chạy trên CSDL dành riêng cho test. */
export const isTestDatabase = process.env.NODE_ENV === "test";

/**
 * Cụm Postgres dùng chung chỉ có ~22 kết nối cho khoảng 20 CSDL, nên phải đi qua PgBouncer
 * (cổng 25061) như mọi dự án khác trên cụm. PgBouncer chế độ transaction KHÔNG giữ trạng
 * thái phiên giữa các câu lệnh, nên phải tắt prepared statement, nếu không sẽ gặp lỗi
 * "prepared statement ... does not exist" ngẫu nhiên khi tải cao.
 */
const isPooled = (() => {
  try {
    return new URL(url).port === "25061";
  } catch {
    return false;
  }
})();

export const sql = postgres(url, {
  // Mặc định nhỏ: nhiều tiến trình (api, worker, mcp, script) cùng chia phần kết nối ít ỏi.
  max: Number(process.env.PG_POOL_MAX ?? 3),
  prepare: !isPooled,
  onnotice: () => {},
  transform: { undefined: null },
});

export type Sql = typeof sql;

/**
 * Kết nối bên trong một giao dịch (`sql.begin`). Hàm ghi dữ liệu nhận thêm tham số kiểu này
 * để người gọi gộp được nhiều thao tác vào một giao dịch, và để test cuộn lại được.
 */
export type Tx = TransactionSql<any>;
export { url as databaseUrl };
