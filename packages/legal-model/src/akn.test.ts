import { describe, expect, test } from "bun:test";
import { frbrUri, toAkomaNtoso } from "./akn.ts";
import { consolidate } from "./consolidate.ts";
import { parseDocument } from "./parser.ts";
import type { AmendOp, DocumentMeta } from "./types.ts";

/** Kiểm tra cân bằng thẻ XML (Bun không có DOMParser). */
function xmlErrors(xml: string): string[] {
  const errs: string[] = [];
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
  for (const m of xml.matchAll(re)) {
    const [, closing, name, attrs, selfClose] = m;
    if (attrs?.startsWith("?") || name === "?xml") continue;
    if (selfClose) continue;
    if (closing) {
      const top = stack.pop();
      if (top !== name) errs.push(`Thẻ đóng </${name}> không khớp với <${top ?? "rỗng"}>`);
    } else {
      stack.push(name!);
    }
  }
  if (stack.length) errs.push(`Thẻ chưa đóng: ${stack.join(", ")}`);
  // Ký tự < & chưa thoát trong phần văn bản
  for (const text of xml.split(/<[^>]*>/)) {
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(text))
      errs.push(`Ký tự & chưa thoát: ${text.slice(0, 40)}`);
  }
  return errs;
}

const md = await Bun.file(`${import.meta.dir}/../../../data/fixtures/nd-mau-goc.md`).text();
const root = parseDocument(md).root;

const META: DocumentMeta = {
  urn: "vn:vbqppl:nd:100/2026/NĐ-CP",
  docType: "nd",
  rank: 50,
  isNormative: true,
  soKyHieu: "100/2026/NĐ-CP",
  title: "Nghị định quy định mẫu về quản lý hoạt động thử nghiệm",
  shortTitle: "Nghị định 100/2026/NĐ-CP",
  issuer: "Chính phủ",
  issuedDate: "2026-01-20",
  effectiveFrom: "2026-03-01",
  fields: [],
  status: "con_hieu_luc",
};

describe("xuất Akoma Ntoso", () => {
  const xml = toAkomaNtoso(root, META, { asOf: "2026-03-01" });

  test("XML hợp lệ về mặt cú pháp (thẻ đóng mở khớp)", () => {
    expect(xmlErrors(xml)).toEqual([]);
  });

  test("có namespace và phần tử gốc đúng loại", () => {
    expect(xml).toContain('xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"');
    expect(xml).toContain('<doc name="nd">');
  });

  test("FRBR URI theo quy ước", () => {
    expect(frbrUri(META)).toBe("/akn/vn/doc/nd/2026/100");
    expect(xml).toContain('<FRBRuri value="/akn/vn/doc/nd/2026/100"/>');
    expect(xml).toContain('<FRBRlanguage language="vie"/>');
  });

  test("giữ URN nội bộ trong proprietary", () => {
    expect(xml).toContain("vn:vbqppl:nd:100/2026/NĐ-CP");
  });

  test("tiêu đề Điều không nuốt câu nội dung phía sau", () => {
    // Lỗi từng gặp: "Điều 5. Phê duyệt" nuốt luôn câu "Người có thẩm quyền phê duyệt..."
    expect(xml).toContain("<heading>Phê duyệt</heading>");
    expect(xml).toContain("<p>Người có thẩm quyền phê duyệt kế hoạch thử nghiệm trong thời hạn 10 ngày.</p>");
    expect(xml).toContain("<heading>Giải thích từ ngữ</heading>");
    expect(xml).toContain("<heading>Hiệu lực thi hành</heading>");
  });

  test("ánh xạ điều/khoản/điểm sang article/paragraph/point với eId", () => {
    expect(xml).toContain('<article eId="art_1">');
    expect(xml).toContain('<paragraph eId="art_1__para_2">');
    expect(xml).toContain('<point eId="art_1__para_2__point_a">');
    expect(xml).toContain("<heading>Phạm vi điều chỉnh</heading>");
  });

  test("chương và mục ánh xạ sang chapter/section", () => {
    expect(xml).toContain('<chapter eId="chp_1">');
    expect(xml).toContain('<section eId="chp_2__sec_1">');
  });

  test("căn cứ vào preamble, chữ ký vào conclusions", () => {
    expect(xml).toContain("<preamble>");
    expect(xml).toContain("Căn cứ Luật Tổ chức Chính phủ");
    expect(xml).toContain("<conclusions>");
    expect(xml).toContain("Nơi nhận");
  });

  test("thoát ký tự XML", () => {
    const dirty = parseDocument('Điều 1. Quy định &amp; <thử> "nghiệm"\n1. Nội dung a < b & c.').root;
    const out = toAkomaNtoso(dirty, META);
    expect(out).not.toContain("<thử>");
    expect(out).toContain("&lt;thử&gt;");
    expect(xmlErrors(out)).toEqual([]);
  });

  test("nút bị bãi bỏ có status=removed và ghi chú hợp nhất", () => {
    const ops: AmendOp[] = [
      {
        id: "1",
        amendingDocUrn: "vn:vbqppl:nd:150/2027/NĐ-CP",
        amendingLabel: "khoản 4 Điều 1",
        targetDocUrn: META.urn,
        targetPath: "dieu-1.khoan-2.diem-c",
        op: "repeal",
        ordinal: 1,
        effectiveFrom: "2027-07-01",
        extraction: "rule",
        confidence: 1,
        reviewStatus: "approved",
      },
    ];
    const r = consolidate(root, ops, "2027-07-01");
    const out = toAkomaNtoso(r.root, META, { asOf: "2027-07-01", notes: true });
    expect(out).toContain('<point eId="art_1__para_2__point_c" status="removed">');
    expect(out).toContain("<authorialNote");
    expect(out).toContain("được bãi bỏ theo quy định tại khoản 4 Điều 1");
  });
});
