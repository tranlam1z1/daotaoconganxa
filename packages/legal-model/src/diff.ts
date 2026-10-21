/** So sánh hai cây văn bản theo nút (stable path) và diff từ trong nút. */

import { walk } from "./parser.ts";
import type { LegalNode } from "./types.ts";

export interface NodeDiff {
  path: string;
  label: string;
  change: "added" | "removed" | "modified" | "unchanged";
  before?: string;
  after?: string;
  words?: WordDiff[];
  /** Trạng thái nút ở hai phiên bản; khác nhau nghĩa là bị bãi bỏ/ngưng hiệu lực. */
  statusBefore?: LegalNode["status"];
  statusAfter?: LegalNode["status"];
}

export interface WordDiff {
  type: "same" | "add" | "del";
  text: string;
}

function index(root: LegalNode): Map<string, LegalNode> {
  const m = new Map<string, LegalNode>();
  walk(root, (n) => {
    if (
      n.path &&
      ["dieu", "khoan", "diem", "chuong", "muc", "phu_luc", "bang", "cong_thuc"].includes(n.kind)
    ) {
      m.set(n.path, n);
    }
  });
  return m;
}

export function diffTrees(a: LegalNode, b: LegalNode, opts: { includeUnchanged?: boolean } = {}): NodeDiff[] {
  const ia = index(a);
  const ib = index(b);
  const paths = [...new Set([...ia.keys(), ...ib.keys()])].sort(comparePath);
  const out: NodeDiff[] = [];
  for (const p of paths) {
    const na = ia.get(p);
    const nb = ib.get(p);
    if (na && !nb) {
      out.push({ path: p, label: na.label, change: "removed", before: na.text });
    } else if (!na && nb) {
      out.push({ path: p, label: nb.label, change: "added", after: nb.text });
    } else if (na && nb) {
      const ta = normalize(na);
      const tb = normalize(nb);
      // Với văn bản pháp luật, thay đổi trạng thái (bãi bỏ, ngưng hiệu lực) cũng là một thay đổi,
      // kể cả khi câu chữ giữ nguyên.
      const statusChanged = na.status !== nb.status;
      if (ta !== tb || statusChanged) {
        out.push({
          path: p,
          label: nb.label,
          change: "modified",
          before: na.text,
          after: nb.text,
          words: ta === tb ? [] : diffWords(ta, tb),
          statusBefore: na.status,
          statusAfter: nb.status,
        });
      } else if (opts.includeUnchanged) {
        out.push({
          path: p,
          label: nb.label,
          change: "unchanged",
          statusBefore: na.status,
          statusAfter: nb.status,
        });
      }
    }
  }
  return out;
}

function normalize(n: LegalNode): string {
  return `${n.heading ?? ""}\n${n.text}`.replace(/\s+/g, " ").trim();
}

function comparePath(a: string, b: string): number {
  const sa = a.split(".");
  const sb = b.split(".");
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const xa = sa[i] ?? "";
    const xb = sb[i] ?? "";
    if (xa === xb) continue;
    const na = Number(/-(\d+)/.exec(xa)?.[1] ?? Number.NaN);
    const nb = Number(/-(\d+)/.exec(xb)?.[1] ?? Number.NaN);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return xa < xb ? -1 : 1;
  }
  return 0;
}

/** Diff mức từ theo thuật toán LCS. */
export function diffWords(a: string, b: string): WordDiff[] {
  const wa = a.split(/(\s+)/).filter((x) => x !== "");
  const wb = b.split(/(\s+)/).filter((x) => x !== "");
  const n = wa.length;
  const m = wb.length;
  // Giới hạn kích thước để tránh O(n*m) quá lớn.
  if (n * m > 4_000_000) {
    return [
      { type: "del", text: a },
      { type: "add", text: b },
    ];
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = wa[i] === wb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const out: WordDiff[] = [];
  let i = 0;
  let j = 0;
  const push = (type: WordDiff["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  while (i < n && j < m) {
    if (wa[i] === wb[j]) {
      push("same", wa[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push("del", wa[i]!);
      i++;
    } else {
      push("add", wb[j]!);
      j++;
    }
  }
  while (i < n) push("del", wa[i++]!);
  while (j < m) push("add", wb[j++]!);
  return out;
}
