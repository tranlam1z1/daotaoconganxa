/**
 * HTML -> Markdown chuẩn nội bộ (dùng node-html-parser).
 * Giữ bảng dưới dạng GFM; bỏ điều hướng/script để parser cấu trúc không nhiễu.
 */
import { type HTMLElement, type Node, parse } from "node-html-parser";
import { normalizeText } from "../crawler/normalize.ts";

const DROP = new Set([
  "script",
  "style",
  "noscript",
  "svg",
  "nav",
  "header",
  "footer",
  "form",
  "button",
  "iframe",
  "aside",
  "template",
]);

const BLOCK = new Set([
  "p",
  "div",
  "section",
  "article",
  "li",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "ul",
  "ol",
  "table",
  "figure",
  "figcaption",
  "address",
  "main",
  "body",
]);

function isEl(n: Node): n is HTMLElement {
  return (n as HTMLElement).tagName !== undefined && (n as HTMLElement).tagName !== null;
}

/** Text thuần của một nút, gộp khoảng trắng, giữ <br> thành xuống dòng. */
function inlineText(el: HTMLElement): string {
  let out = "";
  const walk = (n: Node) => {
    if (!isEl(n)) {
      out += n.rawText ? decode(n.rawText) : "";
      return;
    }
    const tag = n.tagName.toLowerCase();
    if (DROP.has(tag)) return;
    if (tag === "br") {
      out += "\n";
      return;
    }
    for (const c of n.childNodes) walk(c);
  };
  walk(el);
  return out
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)));
}

function tableToMarkdown(table: HTMLElement): string {
  const rows: string[][] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const cells = tr
      .querySelectorAll("th, td")
      .map((td) => inlineText(td).replace(/\|/g, "\\|").replace(/\n/g, "<br>"));
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    const c = [...r];
    while (c.length < cols) c.push("");
    return c;
  };
  const line = (cells: string[]) => `| ${cells.map((c) => c || " ").join(" | ")} |`;
  const [head, ...body] = rows.map(pad);
  return [line(head!), line(new Array(cols).fill("---")), ...body.map(line)].join("\n");
}

export interface HtmlMdResult {
  markdown: string;
  warnings: string[];
  stats: { blocks: number; tables: number };
}

/**
 * Chuyển HTML sang Markdown. `selector` giới hạn vùng nội dung
 * (ví dụ ".content", "#noidung") để bỏ khung trang.
 */
export function htmlToMarkdown(html: string, selector?: string): HtmlMdResult {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const scope = (selector ? root.querySelector(selector) : null) ?? root.querySelector("body") ?? root;
  const warnings: string[] = [];
  const stats = { blocks: 0, tables: 0 };
  const blocks: string[] = [];

  const emit = (s: string) => {
    const t = s.trim();
    if (t) {
      blocks.push(t);
      stats.blocks += 1;
    }
  };

  const walk = (n: Node, listPrefix?: string) => {
    if (!isEl(n)) {
      const t = decode(n.rawText ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (t) emit(t);
      return;
    }
    const tag = n.tagName.toLowerCase();
    if (DROP.has(tag)) return;

    if (/^h[1-6]$/.test(tag)) {
      const t = inlineText(n);
      if (t) emit(`${"#".repeat(Number(tag[1]))} ${t}`);
      return;
    }
    if (tag === "table") {
      const md = tableToMarkdown(n);
      if (md) {
        blocks.push(md);
        stats.tables += 1;
      }
      return;
    }
    if (tag === "ul" || tag === "ol") {
      let i = 1;
      for (const li of n.querySelectorAll(":scope > li")) {
        const t = inlineText(li);
        if (t) emit(tag === "ol" ? `${i++}. ${t}` : `- ${t}`);
      }
      return;
    }
    if (tag === "pre") {
      emit(`\`\`\`\n${inlineText(n)}\n\`\`\``);
      return;
    }
    if (tag === "img") {
      const alt = n.getAttribute("alt") ?? "Hình";
      const src = n.getAttribute("src") ?? "#";
      emit(`![${alt}](${src})`);
      return;
    }

    // Phần tử khối chỉ chứa inline -> một đoạn; ngược lại đi tiếp xuống con.
    const hasBlockChild = n.childNodes.some((c) => isEl(c) && BLOCK.has(c.tagName.toLowerCase()));
    if (BLOCK.has(tag) && !hasBlockChild) {
      const t = inlineText(n);
      if (t) for (const line of t.split("\n")) emit(line);
      return;
    }
    for (const c of n.childNodes) walk(c, listPrefix);
  };

  walk(scope);
  if (!blocks.length) warnings.push("HTML không có nội dung văn bản sau khi lọc");
  return {
    markdown: `${blocks
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`,
    warnings,
    stats,
  };
}

/** Chuẩn hóa Markdown đầu ra chung cho mọi tuyến chuyển đổi. */
export function tidyMarkdown(md: string): string {
  return `${normalizeText(md)
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
