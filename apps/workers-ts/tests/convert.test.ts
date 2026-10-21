/**
 * Chuyển đổi DOCX / HTML sang Markdown ngay trong TypeScript.
 * DOCX được dựng bằng ZIP tự sinh trong test để không phụ thuộc file nhị phân.
 */
import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { docxToMarkdown, docxXmlToMarkdown, isDocx } from "../src/pipeline/docx.ts";
import { htmlToMarkdown, tidyMarkdown } from "../src/pipeline/html-md.ts";
import { findElement, parseXml, textOf } from "../src/pipeline/xml.ts";
import { listZipEntries, normalizeEntryName, readZipText } from "../src/pipeline/zip.ts";

/* ------------------------------------------------------------------ */
/* Tiện ích: dựng file ZIP tối thiểu                                    */
/* ------------------------------------------------------------------ */

function crc32(buf: Uint8Array): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Tạo ZIP với danh sách entry {name, data}; `sep` cho phép mô phỏng "\" như DOCX Công báo. */
function makeZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const comp = new Uint8Array(deflateRawSync(e.data));
    const crc = crc32(e.data);
    const lfh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, 8, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, comp.length, true);
    dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    lfh.set(nameBytes, 30);
    chunks.push(lfh, comp);

    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, comp.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);
    central.push(cdh);
    offset += lfh.length + comp.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...chunks, ...central, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const DOC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>NGHỊ ĐỊNH</w:t></w:r></w:p>
<w:p><w:r><w:t>Điều 1. Phạm vi điều chỉnh</w:t></w:r></w:p>
<w:p><w:r><w:t>1. Nghị định này quy định</w:t></w:r><w:r><w:t xml:space="preserve"> về thử nghiệm.</w:t></w:r></w:p>
<w:p><w:r><w:t>a) Dòng một</w:t></w:r><w:br/><w:r><w:t>tiếp theo</w:t></w:r></w:p>
<w:tbl>
  <w:tr><w:tc><w:p><w:r><w:t>STT</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Nội dung</w:t></w:r></w:p></w:tc></w:tr>
  <w:tr><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sự cần thiết</w:t></w:r></w:p></w:tc></w:tr>
  <w:tr><w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Có | ống dẫn</w:t></w:r></w:p></w:tc></w:tr>
</w:tbl>
<w:p><w:r><w:t/></w:r></w:p>
<w:p><w:r><w:t>Điều 2. Hiệu lực</w:t></w:r></w:p>
</w:body></w:document>`;

const CONTENT_TYPES = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const enc = (s: string) => new TextEncoder().encode(s);

describe("ZIP tối thiểu", () => {
  test("liệt kê và đọc entry", () => {
    const zip = makeZip([
      { name: "[Content_Types].xml", data: enc(CONTENT_TYPES) },
      { name: "word/document.xml", data: enc(DOC_XML) },
    ]);
    const entries = listZipEntries(zip);
    expect(entries.map((e) => e.name)).toEqual(["[Content_Types].xml", "word/document.xml"]);
    expect(readZipText(zip, "word/document.xml")).toBe(DOC_XML);
  });

  test("chấp nhận dấu phân cách '\\' (DOCX của Công báo dùng kiểu này)", () => {
    expect(normalizeEntryName("word\\document.xml")).toBe("word/document.xml");
    const zip = makeZip([
      { name: "[Content_Types].xml", data: enc(CONTENT_TYPES) },
      { name: "word\\document.xml", data: enc(DOC_XML) },
    ]);
    expect(readZipText(zip, "word/document.xml")).toBe(DOC_XML);
    expect(isDocx(zip)).toBe(true);
  });

  test("file không phải ZIP -> lỗi rõ ràng", () => {
    expect(() => listZipEntries(enc("khong phai zip"))).toThrow(/End of Central Directory/);
  });
});

describe("XML parser", () => {
  test("cây, thuộc tính và text", () => {
    const doc = parseXml('<a x="1"><b>hai &amp; ba</b><c/></a>');
    const a = findElement(doc, "a")!;
    expect(a.attrs.x).toBe("1");
    expect(textOf(a)).toBe("hai & ba");
    expect(findElement(doc, "c")).toBeDefined();
  });
});

describe("DOCX -> Markdown", () => {
  const r = docxXmlToMarkdown(DOC_XML);

  test("giữ nhãn cấu trúc và ghép các w:r trong một đoạn", () => {
    expect(r.markdown).toContain("# NGHỊ ĐỊNH");
    expect(r.markdown).toContain("Điều 1. Phạm vi điều chỉnh");
    expect(r.markdown).toContain("1. Nghị định này quy định về thử nghiệm.");
  });

  test("w:br thành xuống dòng trong cùng đoạn", () => {
    expect(r.markdown).toContain("a) Dòng một\ntiếp theo");
  });

  test("giữ bảng dưới dạng GFM, escape dấu |", () => {
    expect(r.markdown).toContain("| STT | Nội dung |");
    expect(r.markdown).toContain("| --- | --- |");
    expect(r.markdown).toContain("Có \\| ống dẫn");
    expect(r.stats.tables).toBe(1);
  });

  test("đếm đoạn, bỏ đoạn rỗng", () => {
    expect(r.stats.paragraphs).toBe(5); // đoạn rỗng <w:t/> bị bỏ
    expect(r.warnings).toEqual([]);
  });

  test("docxToMarkdown đọc từ file ZIP", () => {
    const zip = makeZip([
      { name: "[Content_Types].xml", data: enc(CONTENT_TYPES) },
      { name: "word\\document.xml", data: enc(DOC_XML) },
    ]);
    expect(docxToMarkdown(zip).markdown).toContain("Điều 2. Hiệu lực");
  });

  test("file không có word/document.xml -> lỗi rõ ràng, không nuốt", () => {
    const zip = makeZip([{ name: "a.txt", data: enc("x") }]);
    expect(() => docxToMarkdown(zip)).toThrow(/word\/document.xml/);
  });
});

describe("HTML -> Markdown", () => {
  test("tiêu đề, đoạn, danh sách, bảng; bỏ script/nav", () => {
    const html = `
      <html><body>
        <nav>Trang chủ</nav><script>var x=1;</script>
        <h2>Chương I</h2>
        <p>Điều 1. Phạm vi</p>
        <div><p>1. Nội dung một</p><p>2. Nội dung hai</p></div>
        <ul><li>ý a</li><li>ý b</li></ul>
        <table><tr><th>STT</th><th>Tên</th></tr><tr><td>1</td><td>A</td></tr></table>
      </body></html>`;
    const r = htmlToMarkdown(html);
    expect(r.markdown).toContain("## Chương I");
    expect(r.markdown).toContain("Điều 1. Phạm vi");
    expect(r.markdown).toContain("1. Nội dung một");
    expect(r.markdown).toContain("- ý a");
    expect(r.markdown).toContain("| STT | Tên |");
    expect(r.markdown).not.toContain("Trang chủ");
    expect(r.markdown).not.toContain("var x");
    expect(r.stats.tables).toBe(1);
  });

  test("selector giới hạn vùng nội dung", () => {
    const html = '<body><div class="side">rác</div><div class="content"><p>Điều 1.</p></div></body>';
    const r = htmlToMarkdown(html, ".content");
    expect(r.markdown).toContain("Điều 1.");
    expect(r.markdown).not.toContain("rác");
  });

  test("giải mã thực thể HTML", () => {
    expect(
      htmlToMarkdown("<body><p>Ngh&#x1ECB; &#x111;&#x1ECB;nh&nbsp;s&#x1ED1; 45</p></body>").markdown,
    ).toContain("Nghị định số 45");
  });

  test("tidyMarkdown gộp dòng trống và chuẩn hóa ngoặc kép", () => {
    expect(tidyMarkdown("a\n\n\n\nb  \n")).toBe("a\n\nb\n");
    expect(tidyMarkdown("“x”")).toBe('"x"\n');
  });
});
