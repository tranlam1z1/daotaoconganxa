/**
 * Đánh giá parser cấu trúc trên bộ dữ liệu vàng evals/gold-structure/.
 * Chỉ số theo ke-hoach/12-chat-luong-kiem-thu.md §2: F1 cho nút Điều và nút Khoản/Điểm.
 *
 * Dùng: bun run evals/run-structure-eval.ts [--json] [--verbose]
 * Thoát mã 1 nếu không đạt ngưỡng (Điều ≥ 0,99; Khoản/Điểm ≥ 0,97).
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument, walk } from "@qdpl/legal-model";

const DIR = join(import.meta.dir, "gold-structure");
const asJson = process.argv.includes("--json");
const verbose = process.argv.includes("--verbose");

interface GoldNode {
  path: string;
  fullPath?: string;
  kind: string;
  label: string;
  heading?: string;
  children?: GoldNode[];
}

interface Gold {
  doc: string;
  urn?: string;
  title?: string;
  counts?: Record<string, number>;
  expected_warnings?: unknown[];
  tree: GoldNode[];
}

/** Làm phẳng cây vàng thành tập "path|kind" để so khớp. */
function flattenGold(nodes: GoldNode[], acc = new Map<string, GoldNode>()): Map<string, GoldNode> {
  for (const n of nodes) {
    if (n.path) acc.set(`${n.path}|${n.kind}`, n);
    if (n.children?.length) flattenGold(n.children, acc);
  }
  return acc;
}

interface Score {
  tp: number;
  fp: number;
  fn: number;
}

function f1({ tp, fp, fn }: Score): { p: number; r: number; f1: number } {
  const p = tp + fp ? tp / (tp + fp) : 1;
  const r = tp + fn ? tp / (tp + fn) : 1;
  return { p, r, f1: p + r ? (2 * p * r) / (p + r) : 0 };
}

const files = (await readdir(DIR)).filter((f) => f.endsWith(".tree.json")).sort();
const perFile: Array<{
  doc: string;
  dieu: Score;
  khoanDiem: Score;
  headingMismatch: string[];
  warningsExtra: string[];
  warningsMissing: number;
}> = [];

const total = { dieu: { tp: 0, fp: 0, fn: 0 } as Score, khoanDiem: { tp: 0, fp: 0, fn: 0 } as Score };

for (const f of files) {
  const gold = JSON.parse(await readFile(join(DIR, f), "utf8")) as Gold;
  const md = await readFile(join(DIR, gold.doc), "utf8");
  const parsed = parseDocument(md);

  const actual = new Map<string, { kind: string; heading?: string; label: string }>();
  walk(parsed.root, (n) => {
    if (n.path) actual.set(`${n.path}|${n.kind}`, { kind: n.kind, heading: n.heading, label: n.label });
  });
  const expected = flattenGold(gold.tree);

  const dieu: Score = { tp: 0, fp: 0, fn: 0 };
  const khoanDiem: Score = { tp: 0, fp: 0, fn: 0 };
  const headingMismatch: string[] = [];

  const bucket = (kind: string) =>
    kind === "dieu" ? dieu : kind === "khoan" || kind === "diem" ? khoanDiem : undefined;

  for (const [key, g] of expected) {
    const b = bucket(g.kind);
    if (!b) continue;
    if (actual.has(key)) {
      b.tp += 1;
      const a = actual.get(key)!;
      const gh = (g.heading ?? "").trim();
      const ah = (a.heading ?? "").trim();
      if (gh !== ah) headingMismatch.push(`${key}: chuẩn "${gh}" ≠ thực tế "${ah}"`);
    } else {
      b.fn += 1;
    }
  }
  for (const [key, a] of actual) {
    const b = bucket(a.kind);
    if (!b) continue;
    if (!expected.has(key)) b.fp += 1;
  }

  const expectedWarnings = gold.expected_warnings ?? [];
  const warningsExtra = parsed.warnings.map((w) => `${w.kind}: ${w.message}`);
  const warningsMissing = Math.max(0, expectedWarnings.length - parsed.warnings.length);

  perFile.push({
    doc: gold.doc,
    dieu,
    khoanDiem,
    headingMismatch,
    warningsExtra: expectedWarnings.length ? [] : warningsExtra,
    warningsMissing,
  });
  for (const k of ["dieu", "khoanDiem"] as const) {
    const src = k === "dieu" ? dieu : khoanDiem;
    total[k].tp += src.tp;
    total[k].fp += src.fp;
    total[k].fn += src.fn;
  }
}

const dieuScore = f1(total.dieu);
const kdScore = f1(total.khoanDiem);
const NGUONG_DIEU = 0.99;
const NGUONG_KD = 0.97;
const dat = dieuScore.f1 >= NGUONG_DIEU && kdScore.f1 >= NGUONG_KD;

if (asJson) {
  console.log(JSON.stringify({ perFile, total: { dieu: dieuScore, khoanDiem: kdScore }, dat }, null, 2));
} else {
  console.log(`\nĐÁNH GIÁ PARSER CẤU TRÚC (evals/gold-structure)\n${"=".repeat(78)}`);
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
  console.log(`${pad("Văn bản", 34)} ${pad("Điều (tp/fp/fn)", 18)} ${pad("Khoản+Điểm", 18)} Ghi chú`);
  for (const r of perFile) {
    const note = [
      r.headingMismatch.length ? `${r.headingMismatch.length} tiêu đề lệch` : "",
      r.warningsExtra.length ? `${r.warningsExtra.length} cảnh báo thừa` : "",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `${pad(r.doc, 34)} ${pad(`${r.dieu.tp}/${r.dieu.fp}/${r.dieu.fn}`, 18)} ${pad(`${r.khoanDiem.tp}/${r.khoanDiem.fp}/${r.khoanDiem.fn}`, 18)} ${note}`,
    );
    if (verbose) {
      for (const h of r.headingMismatch) console.log(`    ${h}`);
      for (const w of r.warningsExtra) console.log(`    cảnh báo: ${w}`);
    }
  }
  console.log("-".repeat(78));
  const fmt = (x: { p: number; r: number; f1: number }) =>
    `P=${x.p.toFixed(4)} R=${x.r.toFixed(4)} F1=${x.f1.toFixed(4)}`;
  console.log(
    `Điều       : ${fmt(dieuScore)}   ngưỡng F1 ≥ ${NGUONG_DIEU}  ${dieuScore.f1 >= NGUONG_DIEU ? "ĐẠT" : "KHÔNG ĐẠT"}`,
  );
  console.log(
    `Khoản/Điểm : ${fmt(kdScore)}   ngưỡng F1 ≥ ${NGUONG_KD}  ${kdScore.f1 >= NGUONG_KD ? "ĐẠT" : "KHÔNG ĐẠT"}`,
  );
  console.log("=".repeat(78));
}

process.exit(dat ? 0 : 1);
