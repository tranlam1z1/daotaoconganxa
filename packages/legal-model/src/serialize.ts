/** Cây nút -> Markdown chuẩn nội bộ, kèm chú thích hợp nhất theo NĐ 250/2026. */
import { kindSeg, walk } from "./parser.ts";
import type { DocumentMeta, LegalNode } from "./types.ts";

export interface SerializeOptions {
  /** Chèn marker <!-- node: path --> để ánh xạ ngược. */
  markers?: boolean;
  /** Sinh footnote cho nút bị sửa đổi/bãi bỏ/bổ sung. */
  footnotes?: boolean;
  meta?: DocumentMeta;
  /** Ngày hiệu lực của bản render. */
  asOf?: string;
}

export function serializeDocument(root: LegalNode, opts: SerializeOptions = {}): string {
  const out: string[] = [];
  const notes: string[] = [];
  let noteNo = 0;

  if (opts.meta) {
    const m = opts.meta;
    out.push("---");
    out.push(`urn: ${m.urn}`);
    out.push(`so_ky_hieu: ${m.soKyHieu}`);
    out.push(`title: ${JSON.stringify(m.title)}`);
    if (opts.asOf) out.push(`as_of: ${opts.asOf}`);
    out.push("---", "");
  }

  const emit = (node: LegalNode, depth: number) => {
    if (node.kind === "van_ban") {
      for (const c of node.children) emit(c, depth);
      return;
    }
    if (opts.markers && node.path) out.push(`<!-- node: ${node.path} -->`);

    let noteRef = "";
    if (opts.footnotes && node.note) {
      noteNo += 1;
      noteRef = `[^${noteNo}]`;
      notes.push(`[^${noteNo}]: ${node.note}`);
    }

    switch (node.kind) {
      case "loi_noi_dau":
      case "can_cu":
        out.push(node.text, "");
        break;
      case "phan":
      case "chuong":
      case "muc":
      case "tieu_muc":
      case "phu_luc": {
        const hashes = node.kind === "phan" ? "##" : node.kind === "chuong" ? "##" : "###";
        out.push(`${hashes} ${node.label}${node.heading ? `. ${node.heading}` : ""}${noteRef}`, "");
        if (node.text) out.push(node.text, "");
        break;
      }
      case "dieu":
        out.push(`### ${node.label}${node.heading ? `. ${node.heading}` : ""}${noteRef}`, "");
        if (node.text) out.push(node.text, "");
        break;
      case "khoan":
        if (node.status === "repealed") {
          out.push(`${node.label} (được bãi bỏ)${noteRef}`, "");
        } else if (!node.implicit) {
          out.push(`${node.label}${noteRef} ${node.text}`.trim(), "");
        } else if (node.text) {
          out.push(node.text, "");
        }
        break;
      case "diem":
        if (node.status === "repealed") {
          out.push(`${node.label} (được bãi bỏ)${noteRef}`, "");
        } else {
          out.push(`${node.label}${noteRef} ${node.text}`.trim(), "");
        }
        break;
      case "bang":
      case "cong_thuc":
      case "hinh":
        out.push(node.text, "");
        break;
      case "chu_ky":
        out.push(node.text, "");
        break;
      default:
        if (node.text) out.push(node.text, "");
    }
    for (const c of node.children) emit(c, depth + 1);
  };

  emit(root, 0);
  if (notes.length) {
    out.push("", "---", "");
    out.push(...notes);
  }
  return `${out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

/** Văn bản thuần để index BM25 / embedding. */
export function plainText(node: LegalNode): string {
  const parts: string[] = [];
  walk(node, (n) => {
    if (n.text) parts.push(n.text);
    if (n.heading) parts.push(n.heading);
  });
  return (
    parts
      .join("\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      // Ký hiệu trích dẫn ("> ") đầu dòng và chuỗi "> >" dính giữa dòng, chữ đậm ("**"): không để
      // lọt vào đoạn trích kết quả tìm kiếm. Dấu ">" đơn giữa câu (so sánh) giữ nguyên.
      .replace(/^[ \t]*(?:>[ \t]*)+/gm, "")
      .replace(/(?:[ \t]+>){2,}[ \t]+/g, " ")
      .replace(/\*\*/g, "")
      .trim()
  );
}

/** Chuỗi ngữ cảnh cha để đưa vào chunk embedding: "Nghị định X > Chương II > Điều 15. Tiêu đề". */
export function contextPath(root: LegalNode, target: LegalNode, docTitle: string): string {
  const chain: string[] = [];
  const find = (n: LegalNode, acc: LegalNode[]): LegalNode[] | undefined => {
    if (n === target) return acc.concat(n);
    for (const c of n.children) {
      const r = find(c, acc.concat(n));
      if (r) return r;
    }
    return undefined;
  };
  const path = find(root, []) ?? [];
  for (const n of path) {
    if (n.kind === "van_ban") continue;
    if (["chuong", "muc", "tieu_muc", "phan", "phu_luc"].includes(n.kind)) {
      chain.push(`${n.label}${n.heading ? `. ${n.heading}` : ""}`);
    } else if (n.kind === "dieu") {
      chain.push(`${n.label}${n.heading ? `. ${n.heading}` : ""}`);
    } else if (n.kind === "khoan" || n.kind === "diem") {
      chain.push(n.label.replace(/[.)]$/, ""));
    }
  }
  return [docTitle, ...chain].join(" > ");
}

export { kindSeg };
