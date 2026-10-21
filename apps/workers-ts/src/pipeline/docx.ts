/**
 * DOCX -> Markdown chuẩn nội bộ, thuần TypeScript (không cần service Python).
 * Đọc `word/document.xml` trong ZIP rồi chuyển w:p / w:tbl sang Markdown,
 * GIỮ NGUYÊN BẢNG dưới dạng bảng GFM (parser cấu trúc nhận diện được).
 */
import { childElements, findElement, isElement, parseXml, textOf, type XmlNode } from "./xml.ts";
import { readZipText } from "./zip.ts";

export interface DocxResult {
  markdown: string;
  warnings: string[];
  stats: { paragraphs: number; tables: number; images: number };
}

/** Nội dung một đoạn w:p, giữ xuống dòng mềm (w:br) và tab. */
function paragraphText(p: XmlNode): string {
  let out = "";
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (!isElement(c)) continue;
      switch (c.name) {
        case "w:t":
          out += textOf(c);
          break;
        case "w:tab":
          out += " ";
          break;
        case "w:br":
        case "w:cr":
          out += "\n";
          break;
        case "w:noBreakHyphen":
          out += "-";
          break;
        case "w:instrText":
        case "w:delText":
          // Text của trường/nội dung đã xóa: bỏ qua.
          break;
        default:
          walk(c);
      }
    }
  };
  walk(p);
  return out
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Mức tiêu đề từ w:pStyle (Heading1..9) hoặc w:outlineLvl. */
function headingLevel(p: XmlNode): number | undefined {
  const pPr = childElements(p, "w:pPr")[0];
  if (!pPr) return undefined;
  const style = childElements(pPr, "w:pStyle")[0]?.attrs["w:val"] ?? "";
  const m = /^Heading\s*(\d)$/i.exec(style) ?? /^Tiêu đề\s*(\d)$/i.exec(style);
  if (m) return Math.min(6, Number(m[1]));
  const lvl = childElements(pPr, "w:outlineLvl")[0]?.attrs["w:val"];
  if (lvl !== undefined && /^\d+$/.test(lvl)) return Math.min(6, Number(lvl) + 1);
  return undefined;
}

function cellText(tc: XmlNode): string {
  const parts: string[] = [];
  for (const p of childElements(tc, "w:p")) {
    const t = paragraphText(p);
    if (t) parts.push(t);
  }
  // Bảng lồng trong ô: dẹp thành text để không phá cấu trúc bảng ngoài.
  for (const tbl of childElements(tc, "w:tbl")) {
    for (const tr of childElements(tbl, "w:tr")) {
      const inner = childElements(tr, "w:tc").map(cellText).join(" / ");
      if (inner.trim()) parts.push(inner);
    }
  }
  return parts.join("<br>").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

/** w:tbl -> bảng GFM. */
function tableToMarkdown(tbl: XmlNode): string {
  const rows: string[][] = [];
  for (const tr of childElements(tbl, "w:tr")) {
    rows.push(childElements(tr, "w:tc").map(cellText));
  }
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => {
    const c = [...r];
    while (c.length < cols) c.push("");
    return c;
  });
  const header = norm[0]!;
  const sep = new Array(cols).fill("---");
  const body = norm.slice(1);
  const line = (cells: string[]) => `| ${cells.map((c) => c || " ").join(" | ")} |`;
  return [line(header), line(sep), ...body.map(line)].join("\n");
}

export function docxXmlToMarkdown(documentXml: string): DocxResult {
  const doc = parseXml(documentXml);
  const body = findElement(doc, "w:body");
  const warnings: string[] = [];
  const stats = { paragraphs: 0, tables: 0, images: 0 };
  if (!body) {
    return { markdown: "", warnings: ["Không tìm thấy <w:body> trong word/document.xml"], stats };
  }

  const blocks: string[] = [];
  for (const child of childElements(body)) {
    if (child.name === "w:p") {
      const text = paragraphText(child);
      if (findElement(child, "w:drawing") || findElement(child, "w:pict")) {
        stats.images += 1;
        // Ảnh chưa được trích xuất ở bước này; đánh dấu để reviewer bổ sung.
        blocks.push("![Hình trong văn bản gốc](#)");
      }
      if (!text) continue;
      stats.paragraphs += 1;
      const lvl = headingLevel(child);
      blocks.push(lvl ? `${"#".repeat(lvl)} ${text}` : text);
      continue;
    }
    if (child.name === "w:tbl") {
      const md = tableToMarkdown(child);
      if (md) {
        stats.tables += 1;
        blocks.push(md);
      }
      continue;
    }
    if (child.name === "w:sectPr" || child.name === "w:bookmarkStart" || child.name === "w:bookmarkEnd")
      continue;
  }

  if (!blocks.length) warnings.push("DOCX không có nội dung văn bản (có thể là bản scan nhúng ảnh)");
  return {
    markdown: `${blocks
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()}\n`,
    warnings,
    stats,
  };
}

/** Chuyển toàn bộ file .docx (bytes) sang Markdown. */
export function docxToMarkdown(bytes: Uint8Array): DocxResult {
  const xml = readZipText(bytes, "word/document.xml");
  if (!xml) {
    throw new Error("Không tìm thấy word/document.xml — file không phải DOCX (có thể là .doc nhị phân cũ)");
  }
  return docxXmlToMarkdown(xml);
}

/** Nhận diện nhanh: 'PK' + có entry word/document.xml. */
export function isDocx(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try {
    return readZipText(bytes, "[Content_Types].xml")?.includes("wordprocessingml") ?? false;
  } catch {
    return false;
  }
}
