/**
 * Kiểm thử khói toàn hệ thống: chạy sau khi đã có dữ liệu mẫu và API đang chạy.
 * Bỏ qua (không báo lỗi) những phần chưa sẵn sàng, để dùng được trong lúc còn đang phát triển.
 *
 * Chạy: bun run scripts/smoke.ts
 */

import { getAmendOpsFor, getDocumentByUrn, getVersionAsOf, sql } from "@qdpl/db";
import { buildUrn, consolidate, parseDocument, toAkomaNtoso } from "@qdpl/legal-model";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";
const WEB = `http://127.0.0.1:${process.env.WEB_PORT ?? 3000}`;
const URN = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });

interface Check {
  name: string;
  status: "đạt" | "hỏng" | "bỏ qua";
  detail: string;
}
const results: Check[] = [];

async function check(name: string, fn: () => Promise<string>) {
  try {
    results.push({ name, status: "đạt", detail: await fn() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, status: msg.startsWith("BỎ QUA:") ? "bỏ qua" : "hỏng", detail: msg });
  }
}

async function fetchJson(url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(`BỎ QUA: không kết nối được ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} tại ${url}`);
  return res.json() as Promise<any>;
}

// --- Tầng dữ liệu ---
await check("CSDL: có văn bản mẫu", async () => {
  const doc = await getDocumentByUrn(URN);
  if (!doc) throw new Error("Chưa nạp dữ liệu mẫu; chạy bun run packages/db/src/seed.ts");
  return `${doc.so_ky_hieu} — ${doc.status}`;
});

await check("Hợp nhất theo thời điểm cho kết quả khác nhau", async () => {
  const doc = await getDocumentByUrn(URN);
  if (!doc) throw new Error("BỎ QUA: chưa có dữ liệu");
  const a: any = await getVersionAsOf(doc.id, "2026-06-01");
  const b: any = await getVersionAsOf(doc.id, "2027-08-01");
  if (a.id === b.id) throw new Error("Hai thời điểm trả về cùng một phiên bản");
  const [ca] = await sql`SELECT count(*)::int c FROM nodes WHERE version_id=${a.id} AND kind='dieu'`;
  const [cb] = await sql`SELECT count(*)::int c FROM nodes WHERE version_id=${b.id} AND kind='dieu'`;
  return `2026-06-01: ${(ca as any).c} điều (${a.kind}); 2027-08-01: ${(cb as any).c} điều (${b.kind})`;
});

await check("Lệnh sửa đổi áp dụng không xung đột", async () => {
  const doc = await getDocumentByUrn(URN);
  if (!doc) throw new Error("BỎ QUA: chưa có dữ liệu");
  const v: any =
    await sql`SELECT tree FROM document_versions WHERE document_id=${doc.id} AND kind='original'`;
  const ops = await getAmendOpsFor(URN);
  const r = consolidate((v[0] as any).tree, ops, "2027-08-01");
  if (r.conflicts.length) throw new Error(`Có ${r.conflicts.length} xung đột: ${r.conflicts[0]?.reason}`);
  return `áp dụng ${r.applied.length}/${ops.length} lệnh, 0 xung đột`;
});

await check("Xuất Akoma Ntoso", async () => {
  const md = await Bun.file("data/fixtures/nd-mau-goc.md").text();
  const root = parseDocument(md).root;
  const doc = await getDocumentByUrn(URN);
  if (!doc) throw new Error("BỎ QUA: chưa có dữ liệu");
  const xml = toAkomaNtoso(root, {
    urn: URN,
    docType: doc.doc_type,
    rank: doc.rank,
    isNormative: true,
    soKyHieu: doc.so_ky_hieu,
    title: doc.title,
    shortTitle: doc.short_title,
    issuer: doc.issuer_name ?? "",
    issuedDate: doc.issued_date ?? "",
    fields: doc.fields,
    status: doc.status as any,
  });
  if (!xml.includes("<article")) throw new Error("Không sinh được phần tử article");
  return `${xml.length} ký tự, ${(xml.match(/<article/g) ?? []).length} điều`;
});

// --- Tầng API ---
/** Đếm số điều bằng cách duyệt cây, không đếm chuỗi trong JSON (dễ đếm nhầm ở chú thích). */
function countArticles(payload: any): number {
  const root = payload?.root ?? payload?.tree ?? payload;
  let n = 0;
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.kind === "dieu") n += 1;
    for (const c of node.children ?? []) visit(c);
  };
  visit(root);
  return n;
}

await check("API /health", async () => {
  const j = await fetchJson(`${API}/health`);
  return JSON.stringify(j).slice(0, 80);
});

await check("API lấy nội dung theo thời điểm", async () => {
  const a = await fetchJson(
    `${API}/v1/documents/${encodeURIComponent(URN)}/content?asOf=2026-06-01&format=json`,
  );
  const b = await fetchJson(
    `${API}/v1/documents/${encodeURIComponent(URN)}/content?asOf=2027-08-01&format=json`,
  );
  const na = countArticles(a);
  const nb = countArticles(b);
  if (!na || !nb) throw new Error("Không đọc được cây nội dung từ API");
  if (na === nb) throw new Error("Hai thời điểm cho cùng số điều");
  // Đối chiếu với số liệu tính trực tiếp từ CSDL để bắt lệch giữa hai đường đi.
  const doc = await getDocumentByUrn(URN);
  const v: any = await getVersionAsOf(doc!.id, "2027-08-01");
  const [dbCount] = await sql`SELECT count(*)::int c FROM nodes WHERE version_id = ${v.id} AND kind = 'dieu'`;
  if ((dbCount as any).c !== nb) {
    throw new Error(`API cho ${nb} điều nhưng CSDL cho ${(dbCount as any).c} điều tại cùng thời điểm`);
  }
  return `${na} điều -> ${nb} điều (khớp CSDL)`;
});

await check("API tìm kiếm", async () => {
  const j = await fetchJson(`${API}/v1/search?q=${encodeURIComponent("kế hoạch thử nghiệm")}`);
  const hits = j.hits ?? j.results ?? [];
  if (!hits.length) throw new Error("Không có kết quả");
  return `${hits.length} kết quả, đầu tiên: ${hits[0].path ?? hits[0].urn}`;
});

/**
 * Thời gian phản hồi tra cứu (docs/PLAN.md GĐ1): p95 của 20 lần gọi mỗi loại phải dưới 1 giây
 * trên máy dev. PRD yêu cầu dưới 3 giây; phần chênh để dành cho mạng và kết xuất trang.
 */
const NGUONG_P95_MS = 1000;
async function p95(url: string, soLan = 20): Promise<number> {
  const ms: number[] = [];
  for (let i = 0; i < soLan; i++) {
    const t0 = performance.now();
    await fetchJson(url);
    ms.push(performance.now() - t0);
  }
  ms.sort((a, b) => a - b);
  return ms[Math.min(ms.length - 1, Math.ceil(ms.length * 0.95) - 1)] ?? 0;
}

await check("API thời gian phản hồi tra cứu (p95)", async () => {
  const tim = await p95(`${API}/v1/search?q=${encodeURIComponent("kế hoạch thử nghiệm")}`);
  const doc = await p95(`${API}/v1/documents/${encodeURIComponent(URN)}/content?format=json`);
  const moTa = `tìm kiếm ${tim.toFixed(0)} ms, đọc văn bản ${doc.toFixed(0)} ms`;
  if (tim >= NGUONG_P95_MS || doc >= NGUONG_P95_MS) throw new Error(`Vượt ${NGUONG_P95_MS} ms: ${moTa}`);
  return moTa;
});

/** Tra cứu nhanh (docs/PLAN.md GĐ5): p95 mỗi endpoint dưới 300 ms trên máy dev. */
const NGUONG_P95_TRA_CUU_MS = 300;
await check("API tra cứu nhanh (p95)", async () => {
  const cacUrl = {
    "mức phạt": `${API}/v1/tra-cuu/muc-phat?q=${encodeURIComponent("nồng độ cồn")}&xe=mo_to`,
    "tốc độ": `${API}/v1/tra-cuu/toc-do?xe=o_to&cho_phep=60&do_duoc=75`,
    "quy trình": `${API}/v1/tra-cuu/quy-trinh`,
  };
  const ketQua: string[] = [];
  let vuot = false;
  for (const [ten, url] of Object.entries(cacUrl)) {
    const ms = await p95(url);
    ketQua.push(`${ten} ${ms.toFixed(0)} ms`);
    if (ms >= NGUONG_P95_TRA_CUU_MS) vuot = true;
  }
  if (vuot) throw new Error(`Vượt ${NGUONG_P95_TRA_CUU_MS} ms: ${ketQua.join(", ")}`);
  return ketQua.join(", ");
});

await check("API hỏi đáp bắt đăng nhập", async () => {
  // Kiểm tra khói chạy không có phiên đăng nhập: /v1/ask phải trả 401 (docs/PLAN.md GĐ0 S2).
  // Bất biến "không kết luận khi thiếu căn cứ" nằm ở apps/api/src/ask.test.ts, chạy có đăng nhập.
  let res: Response;
  try {
    res = await fetch(`${API}/v1/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Kế hoạch thử nghiệm gồm những nội dung gì?", asOf: "2026-06-01" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`BỎ QUA: không kết nối được ${API}/v1/ask`);
  }
  if (res.status !== 401) throw new Error(`Gọi không đăng nhập mà nhận ${res.status}, cần 401`);
  return "401 khi chưa đăng nhập (đúng)";
});

// --- Tầng web ---
await check("Web SSR trang văn bản", async () => {
  let res: Response;
  try {
    res = await fetch(`${WEB}/van-ban/nd/100-2026-nd-cp`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(`BỎ QUA: web chưa chạy tại ${WEB}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes("Điều 1")) throw new Error("HTML không chứa nội dung văn bản (SSR hỏng?)");
  return `${html.length} byte, có nội dung điều`;
});

// --- Báo cáo ---
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
console.log(`\nKẾT QUẢ KIỂM THỬ KHÓI\n${"=".repeat(78)}`);
for (const r of results) {
  const icon = r.status === "đạt" ? "[ĐẠT]" : r.status === "bỏ qua" ? "[BỎ ]" : "[HỎNG]";
  console.log(`${icon} ${pad(r.name, 46)} ${r.detail.replace(/^BỎ QUA:\s*/, "")}`);
}
const failed = results.filter((r) => r.status === "hỏng").length;
const skipped = results.filter((r) => r.status === "bỏ qua").length;
console.log("=".repeat(78));
console.log(`Đạt ${results.length - failed - skipped}/${results.length}, hỏng ${failed}, bỏ qua ${skipped}`);
await sql.end();
process.exit(failed ? 1 : 0);
