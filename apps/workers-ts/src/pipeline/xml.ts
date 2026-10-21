/** Parser XML tối thiểu (đủ cho OOXML): thẻ, thuộc tính, text, CDATA. */

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: (XmlNode | string)[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of src.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g)) {
    const k = m[1] ?? m[3]!;
    const v = m[2] ?? m[4] ?? "";
    attrs[k] = decodeXmlEntities(v);
  }
  return attrs;
}

/** Phân tích XML thành cây. Bỏ qua khai báo, comment, DOCTYPE. */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#root", attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  const re =
    /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let last = 0;
  for (const m of xml.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      const text = xml.slice(last, idx);
      if (text) stack[stack.length - 1]!.children.push(decodeXmlEntities(text));
    }
    last = idx + m[0].length;
    if (m[1] !== undefined) {
      stack[stack.length - 1]!.children.push(m[1]);
      continue;
    }
    if (m[2]) {
      // Thẻ đóng: bật ngăn xếp tới đúng thẻ (bỏ qua thẻ lệch).
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.name === m[2]) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (m[3]) {
      const node: XmlNode = { name: m[3], attrs: parseAttrs(m[4] ?? ""), children: [] };
      stack[stack.length - 1]!.children.push(node);
      if (m[5] !== "/") stack.push(node);
    }
  }
  if (xml.length > last) {
    const text = xml.slice(last);
    if (text.trim()) root.children.push(decodeXmlEntities(text));
  }
  return root;
}

export function isElement(n: XmlNode | string): n is XmlNode {
  return typeof n !== "string";
}

/** Tìm phần tử đầu tiên theo tên (duyệt sâu). */
export function findElement(node: XmlNode, name: string): XmlNode | undefined {
  for (const c of node.children) {
    if (!isElement(c)) continue;
    if (c.name === name) return c;
    const hit = findElement(c, name);
    if (hit) return hit;
  }
  return undefined;
}

/** Tất cả phần tử con TRỰC TIẾP theo tên. */
export function childElements(node: XmlNode, name?: string): XmlNode[] {
  return node.children.filter((c): c is XmlNode => isElement(c) && (!name || c.name === name));
}

/** Toàn bộ text bên trong (đệ quy). */
export function textOf(node: XmlNode): string {
  let out = "";
  for (const c of node.children) out += isElement(c) ? textOf(c) : c;
  return out;
}
