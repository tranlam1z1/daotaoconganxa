#!/usr/bin/env bun
/**
 * Chạy bộ dữ liệu vàng `gold-citation` qua @qdpl/citation và in precision/recall/F1.
 *
 * Cách chạy (từ thư mục gốc repo):
 *   bun run evals/run-citation-eval.ts
 *   bun run evals/run-citation-eval.ts --verbose        # in chi tiết từng ca sai
 *   bun run evals/run-citation-eval.ts --write-failures # ghi evals/gold-citation/failures.md
 *   bun run evals/run-citation-eval.ts --threshold 0.98 # đặt ngưỡng chấp nhận
 *
 * Ngưỡng chấp nhận theo ke-hoach/12-chat-luong-kiem-thu.md §2: độ chính xác ≥ 0,98.
 * Script trả mã thoát khác 0 khi F1 dưới ngưỡng, để dùng làm eval gate trong CI.
 *
 * Chỉ số đo ở **cấp URN** (micro-average trên toàn bộ URN của mọi ca):
 *   TP = URN dự đoán đúng, FP = URN dự đoán thừa, FN = URN kỳ vọng nhưng bị bỏ sót.
 * Ca âm tính (expected rỗng) không đóng góp TP/FN, chỉ có thể sinh FP.
 */
import { findCitations, toUrn } from "@qdpl/citation";

interface GoldCase {
  id: string;
  text: string;
  self_doc_urn?: string;
  expected: string[];
  category: string;
  difficulty: "de" | "trung_binh" | "kho";
  note?: string;
}

interface CaseResult {
  gold: GoldCase;
  predicted: string[];
  tp: string[];
  fp: string[];
  fn: string[];
  exact: boolean;
}

const CASES_PATH = new URL("./gold-citation/cases.jsonl", import.meta.url).pathname;
const FAILURES_PATH = new URL("./gold-citation/failures.md", import.meta.url).pathname;

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const argOf = (f: string): string | undefined => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const VERBOSE = has("--verbose") || has("-v");
const WRITE_FAILURES = has("--write-failures");
const THRESHOLD = Number(argOf("--threshold") ?? "0.98");

/** Chuẩn hóa URN để so sánh: NFC, bỏ khoảng trắng thừa. Giữ nguyên chữ hoa/thường và dấu tiếng Việt. */
function normUrn(u: string): string {
  return u.normalize("NFC").trim();
}

function loadCases(path: string): GoldCase[] {
  const raw = require("node:fs").readFileSync(path, "utf8") as string;
  const out: GoldCase[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const s = line.trim();
    if (!s || s.startsWith("//")) return;
    try {
      const c = JSON.parse(s) as GoldCase;
      if (!c.id || typeof c.text !== "string" || !Array.isArray(c.expected)) {
        throw new Error("thiếu trường bắt buộc (id, text, expected)");
      }
      out.push(c);
    } catch (e) {
      throw new Error(`Lỗi đọc cases.jsonl dòng ${i + 1}: ${(e as Error).message}`);
    }
  });
  return out;
}

/** Chạy bộ phân giải trên một ca, trả về tập URN đã khử trùng. */
function predict(c: GoldCase): string[] {
  const refs = findCitations(c.text);
  const urns = new Set<string>();
  for (const r of refs) {
    const u = toUrn(r, c.self_doc_urn);
    if (u) urns.add(normUrn(u));
  }
  return [...urns];
}

function evaluateCase(c: GoldCase): CaseResult {
  const predicted = predict(c);
  const exp = new Set(c.expected.map(normUrn));
  const pred = new Set(predicted);
  const tp = [...pred].filter((u) => exp.has(u));
  const fp = [...pred].filter((u) => !exp.has(u));
  const fn = [...exp].filter((u) => !pred.has(u));
  return { gold: c, predicted, tp, fp, fn, exact: fp.length === 0 && fn.length === 0 };
}

interface Metrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  cases: number;
  exactCases: number;
  exactRate: number;
}

function metricsOf(results: CaseResult[]): Metrics {
  const tp = results.reduce((s, r) => s + r.tp.length, 0);
  const fp = results.reduce((s, r) => s + r.fp.length, 0);
  const fn = results.reduce((s, r) => s + r.fn.length, 0);
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const exactCases = results.filter((r) => r.exact).length;
  return {
    tp,
    fp,
    fn,
    precision,
    recall,
    f1,
    cases: results.length,
    exactCases,
    exactRate: results.length === 0 ? 1 : exactCases / results.length,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(2).replace(".", ",")}%`;
const num = (x: number) => x.toFixed(4).replace(".", ",");

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function printTable(title: string, rows: Array<[string, Metrics]>): void {
  console.log(`\n${title}`);
  console.log(
    "┌──────────────────────┬──────┬──────┬──────┬──────┬───────────┬───────────┬───────────┬──────────┐",
  );
  console.log(
    "│ Nhóm                 │  Ca  │  TP  │  FP  │  FN  │ Precision │  Recall   │    F1     │ Khớp hết │",
  );
  console.log(
    "├──────────────────────┼──────┼──────┼──────┼──────┼───────────┼───────────┼───────────┼──────────┤",
  );
  for (const [name, m] of rows) {
    console.log(
      `│ ${name.padEnd(20)} │ ${String(m.cases).padStart(4)} │ ${String(m.tp).padStart(4)} │ ${String(m.fp).padStart(4)} │ ${String(m.fn).padStart(4)} │ ${num(m.precision).padStart(9)} │ ${num(m.recall).padStart(9)} │ ${num(m.f1).padStart(9)} │ ${pct(m.exactRate).padStart(8)} │`,
    );
  }
  console.log(
    "└──────────────────────┴──────┴──────┴──────┴──────┴───────────┴───────────┴───────────┴──────────┘",
  );
}

function renderFailures(results: CaseResult[], overall: Metrics, threshold: number): string {
  const failed = results.filter((r) => !r.exact);
  const now = new Date().toISOString().slice(0, 10);
  const L: string[] = [];
  L.push("# Các ca sai của bộ `gold-citation`");
  L.push("");
  L.push(`> Tệp này do \`evals/run-citation-eval.ts\` sinh tự động. Không sửa tay.`);
  L.push(`> Lần chạy gần nhất: ${now}. Ngưỡng chấp nhận: F1 ≥ ${num(threshold)} (ke-hoach/12 §2).`);
  L.push("");
  L.push("## Kết quả tổng hợp");
  L.push("");
  L.push("| Chỉ số | Giá trị |");
  L.push("|--------|---------|");
  L.push(`| Số ca | ${overall.cases} |`);
  L.push(`| Số ca khớp hoàn toàn | ${overall.exactCases} (${pct(overall.exactRate)}) |`);
  L.push(`| TP / FP / FN | ${overall.tp} / ${overall.fp} / ${overall.fn} |`);
  L.push(`| Precision | ${num(overall.precision)} |`);
  L.push(`| Recall | ${num(overall.recall)} |`);
  L.push(`| F1 | ${num(overall.f1)} |`);
  L.push(`| Đạt ngưỡng ${num(threshold)} | ${overall.f1 >= threshold ? "ĐẠT" : "**KHÔNG ĐẠT**"} |`);
  L.push("");
  L.push("## Danh sách ca sai");
  L.push("");
  L.push(
    "Mỗi ca nêu: chuỗi đầu vào, tập URN kỳ vọng, tập URN bộ phân giải trả về, phần thiếu (FN) và phần thừa (FP).",
  );
  L.push("");

  const byCat = groupBy(failed, (r) => r.gold.category);
  for (const [cat, items] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    L.push(`### Nhóm \`${cat}\` — ${items.length} ca sai`);
    L.push("");
    for (const r of items) {
      L.push(`#### \`${r.gold.id}\` (độ khó: ${r.gold.difficulty})`);
      L.push("");
      L.push(`**Chuỗi đầu vào:**`);
      L.push("");
      L.push("```");
      L.push(r.gold.text);
      L.push("```");
      L.push("");
      if (r.gold.self_doc_urn) L.push(`**URN văn bản chứa viện dẫn:** \`${r.gold.self_doc_urn}\``);
      L.push(
        `**Kỳ vọng (${r.gold.expected.length}):** ${r.gold.expected.map((u) => `\`${u}\``).join(", ") || "_(rỗng)_"}`,
      );
      L.push(
        `**Trả về (${r.predicted.length}):** ${r.predicted.map((u) => `\`${u}\``).join(", ") || "_(rỗng)_"}`,
      );
      if (r.fn.length) L.push(`**Thiếu (FN):** ${r.fn.map((u) => `\`${u}\``).join(", ")}`);
      if (r.fp.length) L.push(`**Thừa (FP):** ${r.fp.map((u) => `\`${u}\``).join(", ")}`);
      if (r.gold.note) L.push(`**Ghi chú của bộ dữ liệu vàng:** ${r.gold.note}`);
      L.push("");
    }
  }

  L.push("## Ghi chú");
  L.push("");
  L.push(
    "Bộ dữ liệu vàng gán nhãn theo **cách hiểu pháp lý đúng**, không theo hành vi hiện tại của mã nguồn. Vì vậy một số ca sai phản ánh **giới hạn đã biết** của bộ phân giải chứ không phải lỗi hồi quy. Khi sửa `packages/citation`, chạy lại script này và so sánh với lần chạy trước để bảo đảm không giảm điểm ở các nhóm đang đạt.",
  );
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------- main

const cases = loadCases(CASES_PATH);
const results = cases.map(evaluateCase);
const overall = metricsOf(results);

console.log("Bộ đánh giá phân giải viện dẫn — gold-citation");
console.log(`Tệp dữ liệu: ${CASES_PATH}`);
console.log(`Số ca: ${cases.length}`);

printTable(
  "Theo nhóm ca",
  [...groupBy(results, (r) => r.gold.category).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([k, v]) => [k, metricsOf(v)] as [string, Metrics]),
);

printTable(
  "Theo độ khó",
  (["de", "trung_binh", "kho"] as const)
    .map((d) => [d, results.filter((r) => r.gold.difficulty === d)] as const)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => [k, metricsOf(v)] as [string, Metrics]),
);

printTable("Tổng hợp", [["TẤT CẢ", overall]]);

console.log("");
console.log(`Precision : ${num(overall.precision)}  (${overall.tp} / ${overall.tp + overall.fp})`);
console.log(`Recall    : ${num(overall.recall)}  (${overall.tp} / ${overall.tp + overall.fn})`);
console.log(`F1        : ${num(overall.f1)}`);
console.log(`Khớp hoàn toàn: ${overall.exactCases}/${overall.cases} ca (${pct(overall.exactRate)})`);
console.log(
  `Ngưỡng chấp nhận (ke-hoach/12 §2): F1 ≥ ${num(THRESHOLD)} → ${overall.f1 >= THRESHOLD ? "ĐẠT" : "KHÔNG ĐẠT"}`,
);

const failed = results.filter((r) => !r.exact);
if (VERBOSE && failed.length) {
  console.log(`\nChi tiết ${failed.length} ca sai:`);
  for (const r of failed) {
    console.log(`\n  [${r.gold.id}] ${r.gold.category} / ${r.gold.difficulty}`);
    console.log(`    Đầu vào : ${r.gold.text}`);
    if (r.gold.self_doc_urn) console.log(`    Văn bản  : ${r.gold.self_doc_urn}`);
    console.log(`    Kỳ vọng : ${JSON.stringify(r.gold.expected)}`);
    console.log(`    Trả về  : ${JSON.stringify(r.predicted)}`);
    if (r.fn.length) console.log(`    Thiếu   : ${JSON.stringify(r.fn)}`);
    if (r.fp.length) console.log(`    Thừa    : ${JSON.stringify(r.fp)}`);
  }
}

if (WRITE_FAILURES || overall.f1 < THRESHOLD) {
  if (failed.length) {
    await Bun.write(FAILURES_PATH, renderFailures(results, overall, THRESHOLD));
    console.log(`\nĐã ghi ${failed.length} ca sai vào ${FAILURES_PATH}`);
  } else {
    console.log("\nKhông có ca sai; không ghi tệp failures.md");
  }
}

process.exit(overall.f1 >= THRESHOLD ? 0 : 1);
