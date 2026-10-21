/**
 * Kết xuất Markdown mở rộng (ke-hoach/03 §4) thành HTML an toàn.
 *
 * Luồng: tách công thức LaTeX -> marked (GFM) -> lọc HTML theo danh sách trắng
 * -> bọc bảng trong khung cuộn ngang -> chèn lại HTML KaTeX (nguồn tin cậy).
 * Bắt buộc lọc vì nội dung có thể do OCR/AI sinh ra: chỉ cho phép thẻ trình bày
 * và thẻ bảng, tuyệt đối không cho script, iframe, thuộc tính on*, javascript:.
 */
import katex from "katex";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/* ------------------------------------------------------------------ */
/* Danh sách trắng                                                     */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "sup",
  "sub",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "abbr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "img",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
]);

/** Thẻ bị xoá cùng toàn bộ nội dung bên trong. */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "form",
  "input",
  "button",
  "select",
  "option",
  "textarea",
  "link",
  "meta",
  "base",
  "title",
  "head",
  "html",
  "body",
  "frame",
  "frameset",
  "applet",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "col"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan", "scope", "align", "headers", "id"]),
  td: new Set(["colspan", "rowspan", "align", "headers"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  table: new Set(["summary"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

/* ------------------------------------------------------------------ */
/* Tiện ích escape                                                     */
/* ------------------------------------------------------------------ */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Văn bản giữa các thẻ: chỉ cần khử "<" lạc, giữ nguyên thực thể có sẵn. */
function escapeStray(text: string): string {
  return text.replace(/</g, "&lt;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Chỉ chấp nhận URL vô hại. Loại bỏ ký tự điều khiển và khoảng trắng chèn giữa. */
function safeUrl(raw: string): string | null {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: cố ý loại ký tự điều khiển khỏi HTML để chặn né bộ lọc
  const value = raw.replace(/[\u0000-\u0020\u007f-\u00a0]/g, "");
  if (!value) return null;
  if (/^(https?:|mailto:|tel:|asset:|#|\/|\.{1,2}\/)/i.test(value)) return value;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // giao thức lạ: javascript:, vbscript:, data:text/html…
  return value; // đường dẫn tương đối
}

/* ------------------------------------------------------------------ */
/* Bộ lọc HTML                                                         */
/* ------------------------------------------------------------------ */

/** Tìm vị trí ">" kết thúc thẻ, bỏ qua ">" nằm trong dấu nháy. */
function findTagEnd(html: string, start: number): number {
  let quote: string | null = null;
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return i;
    }
  }
  return -1;
}

const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;

function filterAttrs(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const parts: string[] = [];
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null = ATTR_RE.exec(rawAttrs);
  while (m) {
    const name = (m[1] ?? m[5] ?? "").toLowerCase();
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    m = ATTR_RE.exec(rawAttrs);
    if (!name || name.startsWith("on") || !allowed.has(name)) continue;
    if (name === "href" || name === "src") {
      const url = safeUrl(value);
      if (!url) continue;
      parts.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }
    if (name === "class") {
      // Chỉ giữ lớp tô sáng cú pháp do marked sinh.
      const kept = value.split(/\s+/).filter((c) => /^language-[a-z0-9-]+$/i.test(c));
      if (!kept.length) continue;
      parts.push(`class="${escapeAttr(kept.join(" "))}"`);
      continue;
    }
    parts.push(`${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a" && parts.some((p) => p.startsWith("href="))) {
    parts.push('rel="noopener nofollow ugc"');
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** Lọc HTML theo danh sách trắng. */
export function sanitizeHtml(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += escapeStray(html.slice(i));
      break;
    }
    out += escapeStray(html.slice(i, lt));

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const gt = findTagEnd(html, lt);
    if (gt === -1) {
      out += escapeStray(html.slice(lt));
      break;
    }
    const inner = html.slice(lt + 1, gt);
    const closing = inner.startsWith("/");
    const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(inner);
    if (!nameMatch?.[1]) {
      i = gt + 1;
      continue; // "<" không tạo thành thẻ hợp lệ -> bỏ
    }
    const tag = nameMatch[1].toLowerCase();

    if (DROP_WITH_CONTENT.has(tag)) {
      if (closing) {
        i = gt + 1;
        continue;
      }
      const closeRe = new RegExp(`</\\s*${tag}\\s*>`, "i");
      const rest = html.slice(gt + 1);
      const found = closeRe.exec(rest);
      i = found ? gt + 1 + found.index + found[0].length : html.length;
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      i = gt + 1;
      continue; // bỏ thẻ, giữ nội dung
    }

    if (closing) {
      if (!VOID_TAGS.has(tag)) out += `</${tag}>`;
    } else {
      const rawAttrs = inner.slice(nameMatch[0].length).replace(/\/\s*$/, "");
      const attrs = filterAttrs(tag, rawAttrs);
      out += VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
    }
    i = gt + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Bảng: thêm scope cho th, bọc khung cuộn ngang                        */
/* ------------------------------------------------------------------ */

function addThScope(html: string): string {
  return html
    .replace(
      /<thead>([\s\S]*?)<\/thead>/gi,
      (_all, body: string) =>
        `<thead>${body.replace(/<th(?![a-z])(?![^>]*\bscope=)/gi, '<th scope="col"')}</thead>`,
    )
    .replace(/<th(?![a-z])(?![^>]*\bscope=)/gi, '<th scope="row"');
}

/**
 * Bọc mỗi bảng trong khung cuộn ngang có thể focus bằng bàn phím
 * (WCAG 2.1: vùng cuộn phải tới được bằng bàn phím). Thân trang không cuộn ngang.
 */
function wrapTables(html: string): string {
  let out = "";
  let i = 0;
  const openRe = /<table\b/gi;
  while (i < html.length) {
    openRe.lastIndex = i;
    const open = openRe.exec(html);
    if (!open) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open.index);
    let depth = 0;
    const scan = /<\/?table\b/gi;
    scan.lastIndex = open.index;
    let end = -1;
    let t: RegExpExecArray | null = scan.exec(html);
    while (t) {
      if (t[0].toLowerCase().startsWith("</")) {
        depth--;
        if (depth === 0) {
          end = html.indexOf(">", t.index);
          break;
        }
      } else {
        depth++;
      }
      t = scan.exec(html);
    }
    if (end === -1) {
      out += html.slice(open.index);
      break;
    }
    const table = html.slice(open.index, end + 1);
    out += `<div class="table-scroll" role="region" tabindex="0" aria-label="Bảng trong văn bản, cuộn ngang để xem đầy đủ">${table}</div>`;
    i = end + 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Công thức KaTeX                                                     */
/* ------------------------------------------------------------------ */

const MATH_PLACEHOLDER_PREFIX = "qdplmath";

function renderMath(tex: string, display: boolean): string {
  let body: string;
  try {
    body = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: "ignore",
      trust: false,
    });
  } catch {
    body = `<code>${escapeHtml(tex)}</code>`;
  }
  // aria-label đóng vai trò "alt" của công thức theo yêu cầu WCAG.
  const label = escapeAttr(`Công thức: ${tex.replace(/\s+/g, " ").trim()}`);
  const cls = display ? "math-block" : "math-inline";
  return `<span class="${cls}" role="math" aria-label="${label}" title="${label}">${body}</span>`;
}

interface MathSlot {
  key: string;
  html: string;
}

/** Thay công thức bằng chuỗi giữ chỗ để marked không phá cú pháp LaTeX. */
function extractMath(md: string): { text: string; slots: MathSlot[] } {
  const slots: MathSlot[] = [];
  let n = 0;
  const push = (tex: string, display: boolean): string => {
    const key = `${MATH_PLACEHOLDER_PREFIX}${n++}zz`;
    slots.push({ key, html: renderMath(tex, display) });
    return key;
  };
  let text = md.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => push(tex, true));
  text = text.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_m, pre: string, tex: string) => pre + push(tex, false));
  return { text, slots };
}

/* ------------------------------------------------------------------ */
/* API công khai                                                       */
/* ------------------------------------------------------------------ */

/** Kết xuất Markdown của một nút thành HTML đã lọc, sẵn sàng cho dangerouslySetInnerHTML. */
export function renderMarkdown(md: string | undefined | null): string {
  if (!md) return "";
  // Bỏ marker mapping nút dạng <!-- node: ... --> trước khi render.
  const cleaned = md.replace(/<!--\s*node:[\s\S]*?-->/g, "");
  const { text, slots } = extractMath(cleaned);
  const parsed = marked.parse(text, { async: false }) as string;
  let html = wrapTables(addThScope(sanitizeHtml(parsed)));
  for (const slot of slots) html = html.split(slot.key).join(slot.html);
  return html;
}

/** Kết xuất Markdown một dòng (không bọc thẻ p). */
export function renderMarkdownInline(md: string | undefined | null): string {
  if (!md) return "";
  const { text, slots } = extractMath(md);
  const parsed = marked.parseInline(text, { async: false }) as string;
  let html = sanitizeHtml(parsed);
  for (const slot of slots) html = html.split(slot.key).join(slot.html);
  return html;
}

/**
 * Cắt đoạn trích và tô sáng từ khoá. Nhận chuỗi thô (không phải HTML),
 * trả HTML đã escape, chỉ chèn thẻ mark.
 */
export function highlightSnippet(snippet: string, query: string): string {
  const escaped = escapeHtml(snippet);
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return escaped;
  try {
    const re = new RegExp(`(${terms.join("|")})`, "gi");
    return escaped.replace(re, "<mark>$1</mark>");
  } catch {
    return escaped;
  }
}
