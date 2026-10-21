/**
 * Báo cáo chất lượng kho văn bản: dùng cho giám sát vận hành và cổng đánh giá trong CI.
 * Đo các chỉ số ở ke-hoach/12-chat-luong-kiem-thu.md §2 trên dữ liệu thực có trong CSDL.
 *
 * Dùng: bun run scripts/quality-report.ts [--json]
 */
import { sql } from "@qdpl/db";
import { DIEM_LETTERS } from "@qdpl/legal-model";

const asJson = process.argv.includes("--json");

interface Metric {
  ten: string;
  gia_tri: number | string;
  nguong?: string;
  dat?: boolean;
  ghi_chu?: string;
}
const metrics: Metric[] = [];

const [tong] = await sql`
  SELECT (SELECT count(*) FROM documents) AS van_ban,
         (SELECT count(*) FROM document_versions) AS phien_ban,
         (SELECT count(*) FROM nodes) AS nut,
         (SELECT count(*) FROM nodes WHERE kind = 'dieu') AS dieu,
         (SELECT count(*) FROM nodes WHERE kind = 'bang') AS bang,
         (SELECT count(*) FROM nodes WHERE kind = 'cong_thuc') AS cong_thuc,
         (SELECT count(*) FROM amendment_ops) AS lenh_sua_doi,
         (SELECT count(*) FROM relations) AS quan_he`;
const t = tong as any;
metrics.push({ ten: "Số văn bản", gia_tri: Number(t.van_ban) });
metrics.push({ ten: "Số phiên bản", gia_tri: Number(t.phien_ban) });
metrics.push({ ten: "Số nút", gia_tri: Number(t.nut) });
metrics.push({ ten: "Số điều", gia_tri: Number(t.dieu) });
metrics.push({ ten: "Số bảng giữ được", gia_tri: Number(t.bang) });
metrics.push({ ten: "Số công thức giữ được", gia_tri: Number(t.cong_thuc) });
metrics.push({ ten: "Số lệnh sửa đổi", gia_tri: Number(t.lenh_sua_doi) });
metrics.push({ ten: "Số quan hệ", gia_tri: Number(t.quan_he) });

// Phiên bản không có nút nào -> parse hỏng hoàn toàn
const [rong] = await sql`
  SELECT count(*)::int c FROM document_versions v
  WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.version_id = v.id)`;
metrics.push({
  ten: "Phiên bản không có nút (parse hỏng)",
  gia_tri: (rong as any).c,
  nguong: "= 0",
  dat: (rong as any).c === 0,
});

// Điều thiếu tiêu đề: dấu hiệu parser hoặc OCR hỏng
const [khongTieuDe] = await sql`
  SELECT count(*)::int c FROM nodes WHERE kind = 'dieu' AND (heading IS NULL OR heading = '')`;
const tyLeKhongTieuDe = Number(t.dieu) ? (khongTieuDe as any).c / Number(t.dieu) : 0;
metrics.push({
  ten: "Tỷ lệ điều thiếu tiêu đề",
  gia_tri: `${(tyLeKhongTieuDe * 100).toFixed(1)}%`,
  nguong: "≤ 5%",
  dat: tyLeKhongTieuDe <= 0.05,
});

// Tiêu đề điều nuốt nội dung: nhận theo DẤU HIỆU, không theo độ dài.
// Tiêu đề VBQPPL Việt Nam có thể dài thật (Điều 38 Nghị định 253/2026/NĐ-CP dài 375 ký tự
// mà vẫn là tiêu đề đúng), nên ngưỡng độ dài chỉ sinh báo động giả. Dấu hiệu nuốt nội dung
// là trong tiêu đề có nhãn khoản "1. " / điểm "a) " kèm nội dung, hoặc có xuống dòng.
const [tieuDeNuot] = await sql`
  SELECT count(*)::int c FROM nodes
  WHERE kind = 'dieu' AND heading IS NOT NULL AND (
        heading ~ '(^|[[:space:]])[0-9]+\\.[[:space:]]+[^[:space:]]'
     OR heading ~ '(^|[[:space:]])[a-zđ]\\)[[:space:]]+[^[:space:]]'
     OR position(chr(10) in heading) > 0)`;
metrics.push({
  ten: "Điều có tiêu đề nuốt nội dung",
  gia_tri: (tieuDeNuot as any).c,
  nguong: "= 0",
  dat: (tieuDeNuot as any).c === 0,
});

// Chỉ số tham khảo, KHÔNG chặn: tiêu đề rất dài đáng liếc mắt qua khi soát tay.
const [tieuDeDai] = await sql`
  SELECT count(*)::int c FROM nodes WHERE kind = 'dieu' AND length(heading) > 300`;
metrics.push({ ten: "Điều có tiêu đề > 300 ký tự", gia_tri: (tieuDeDai as any).c, ghi_chu: "tham khảo" });

// Nút không có nội dung lẫn con: nút rỗng vô nghĩa.
// Trừ phần PHỤ LỤC: biểu mẫu hay có dòng đánh số để trống ("1." rồi "2." không kèm chữ),
// parser sinh ra nút rỗng ở đó là do BẢN GỐC như vậy, không phải đường ống làm mất nội dung.
const [nutRong] = await sql`
  SELECT count(*)::int c FROM nodes n
  WHERE n.kind IN ('khoan','diem') AND coalesce(n.text_md,'') = ''
    AND n.full_path NOT LIKE 'phu-luc%'
    AND NOT EXISTS (SELECT 1 FROM nodes c WHERE c.version_id = n.version_id AND c.path LIKE n.path || '.%')`;
metrics.push({
  ten: "Khoản/điểm rỗng không có con",
  gia_tri: (nutRong as any).c,
  nguong: "= 0",
  dat: (nutRong as any).c === 0,
});

const [nutRongPhuLuc] = await sql`
  SELECT count(*)::int c FROM nodes n
  WHERE n.kind IN ('khoan','diem') AND coalesce(n.text_md,'') = ''
    AND n.full_path LIKE 'phu-luc%'
    AND NOT EXISTS (SELECT 1 FROM nodes c WHERE c.version_id = n.version_id AND c.path LIKE n.path || '.%')`;
metrics.push({
  ten: "Khoản/điểm rỗng trong phụ lục",
  gia_tri: (nutRongPhuLuc as any).c,
  ghi_chu: "tham khảo — thường là ô trống của biểu mẫu",
});

// Điểm dùng chữ cái không hợp lệ (f, j, w, z không dùng trong VBQPPL)
const invalid = await sql`
  SELECT n.label, count(*)::int c FROM nodes n WHERE n.kind = 'diem'
    AND left(regexp_replace(n.label, '[^a-zđ]', '', 'g'), 1) <> ALL(${DIEM_LETTERS})
  GROUP BY n.label ORDER BY 2 DESC LIMIT 5`;
metrics.push({
  ten: "Điểm dùng chữ cái không hợp lệ",
  gia_tri: (invalid as any[]).reduce((s, r) => s + r.c, 0),
  nguong: "= 0",
  dat: (invalid as any[]).length === 0,
  ghi_chu: (invalid as any[]).map((r) => `${r.label}×${r.c}`).join(", ") || undefined,
});

// payload lệnh sửa đổi sai kiểu (lỗi mã hóa JSON hai lần)
const [payloadSai] = await sql`
  SELECT count(*)::int c FROM amendment_ops WHERE payload IS NOT NULL AND jsonb_typeof(payload) <> 'object'`;
metrics.push({
  ten: "payload lệnh sửa đổi sai kiểu",
  gia_tri: (payloadSai as any).c,
  nguong: "= 0",
  dat: (payloadSai as any).c === 0,
});

// Lệnh sửa đổi chờ duyệt quá 7 ngày
const [choLau] = await sql`
  SELECT count(*)::int c FROM amendment_ops
  WHERE review_status = 'pending' AND created_at < now() - interval '7 days'`;
metrics.push({
  ten: "Lệnh sửa đổi chờ duyệt quá 7 ngày",
  gia_tri: (choLau as any).c,
  nguong: "= 0",
  dat: (choLau as any).c === 0,
});

// Sức khỏe viện dẫn
const health = await sql`SELECT health, count(*)::int c FROM citations GROUP BY 1`;
const hMap = Object.fromEntries((health as any[]).map((r) => [r.health, r.c]));
const tongVienDan = Object.values(hMap).reduce((a: number, b: any) => a + b, 0) as number;
metrics.push({
  ten: "Viện dẫn còn đúng",
  gia_tri: tongVienDan ? `${(((hMap.ok ?? 0) / tongVienDan) * 100).toFixed(1)}%` : "chưa có",
  nguong: "≥ 95%",
  dat: !tongVienDan || (hMap.ok ?? 0) / tongVienDan >= 0.95,
});

// Chi phí LLM 30 ngày
const [chiPhi] = await sql`
  SELECT coalesce(sum(cost_usd), 0)::numeric(12,2) AS usd, count(*)::int AS lan
  FROM pipeline_runs WHERE started_at > now() - interval '30 days'`;
metrics.push({
  ten: "Chi phí LLM 30 ngày (USD)",
  gia_tri: String((chiPhi as any).usd),
  ghi_chu: `${(chiPhi as any).lan} lượt chạy`,
});

if (asJson) {
  console.log(JSON.stringify({ thoi_diem: new Date().toISOString(), metrics }, null, 2));
} else {
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(`\nBÁO CÁO CHẤT LƯỢNG KHO VĂN BẢN\n${"=".repeat(80)}`);
  for (const m of metrics) {
    const flag = m.dat === undefined ? "     " : m.dat ? "[ĐẠT]" : "[LỖI]";
    console.log(
      `${flag} ${pad(m.ten, 46)} ${pad(String(m.gia_tri), 12)} ${m.nguong ?? ""} ${m.ghi_chu ? `(${m.ghi_chu})` : ""}`,
    );
  }
  console.log("=".repeat(80));
}

const failed = metrics.filter((m) => m.dat === false);
if (failed.length) {
  console.error(`\nCó ${failed.length} chỉ số không đạt ngưỡng: ${failed.map((f) => f.ten).join("; ")}`);
}
await sql.end();
process.exit(failed.length ? 1 : 0);
