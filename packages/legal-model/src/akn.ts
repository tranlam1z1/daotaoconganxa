/**
 * Xuất cây văn bản sang Akoma Ntoso (OASIS LegalDocML) rút gọn để liên thông dữ liệu.
 * Ánh xạ nút Việt Nam sang phần tử AKN:
 *   phan -> book, chuong -> chapter, muc -> section, tieu_muc -> subsection,
 *   dieu -> article, khoan -> paragraph, diem -> point, doan -> subparagraph,
 *   phu_luc -> attachment, bang -> table (trong content), can_cu -> preamble, chu_ky -> conclusions.
 * Xem ke-hoach/02-kien-truc-he-thong.md §5 (endpoint format=akn).
 */

import { docTypeByCode } from "./hierarchy.ts";
import type { DocumentMeta, LegalNode, NodeKind } from "./types.ts";

const AKN_NS = "http://docs.oasis-open.org/legaldocml/ns/akn/3.0";

const ELEMENT: Partial<Record<NodeKind, string>> = {
  phan: "book",
  chuong: "chapter",
  muc: "section",
  tieu_muc: "subsection",
  dieu: "article",
  khoan: "paragraph",
  diem: "point",
  doan: "subparagraph",
  phu_luc: "attachment",
};

/** Loại văn bản Việt Nam -> phần tử gốc AKN. */
function rootElement(docType: string): string {
  switch (docType) {
    case "hp":
      return "act";
    case "bl":
    case "l":
      return "act";
    case "pl":
      return "act";
    case "nq-qh":
    case "nq-ubtvqh":
    case "nq-cp":
    case "nq-hdnd-t":
    case "nq-hdnd-x":
      return "act";
    default:
      return "doc";
  }
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** FRBR Work URI theo quy ước AKN, dẫn xuất từ URN nội bộ. */
export function frbrUri(meta: DocumentMeta): string {
  const [num, year] = meta.soKyHieu.split("/");
  const type = meta.docType;
  return `/akn/vn/${rootElement(type) === "act" ? "act" : "doc"}/${type}/${year ?? "0000"}/${num ?? "0"}`;
}

export interface AknOptions {
  /** Ngày của bản thể hiện (expression), tức thời điểm hợp nhất. */
  asOf?: string;
  /** Ghi chú hợp nhất thành <authorialNote>. */
  notes?: boolean;
}

export function toAkomaNtoso(root: LegalNode, meta: DocumentMeta, opts: AknOptions = {}): string {
  const el = rootElement(meta.docType);
  const uri = frbrUri(meta);
  const asOf = opts.asOf ?? meta.effectiveFrom ?? meta.issuedDate;
  const typeName = docTypeByCode(meta.docType)?.name ?? meta.docType;

  const preamble = root.children.filter((c) => c.kind === "can_cu" || c.kind === "loi_noi_dau");
  const conclusions = root.children.filter((c) => c.kind === "chu_ky");
  const bodyNodes = root.children.filter((c) => !["can_cu", "loi_noi_dau", "chu_ky"].includes(c.kind));

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<akomaNtoso xmlns="${AKN_NS}">`);
  lines.push(`  <${el} name="${escapeXml(meta.docType)}">`);
  lines.push("    <meta>");
  lines.push('      <identification source="#quydinhphapluat">');
  lines.push("        <FRBRWork>");
  lines.push(`          <FRBRthis value="${uri}/!main"/>`);
  lines.push(`          <FRBRuri value="${uri}"/>`);
  lines.push(`          <FRBRdate date="${meta.issuedDate}" name="banHanh"/>`);
  lines.push(`          <FRBRauthor href="#${slug(meta.issuer)}"/>`);
  lines.push('          <FRBRcountry value="vn"/>');
  lines.push(`          <FRBRnumber value="${escapeXml(meta.soKyHieu)}"/>`);
  lines.push("        </FRBRWork>");
  lines.push("        <FRBRExpression>");
  lines.push(`          <FRBRthis value="${uri}/vie@${asOf}/!main"/>`);
  lines.push(`          <FRBRuri value="${uri}/vie@${asOf}"/>`);
  lines.push(`          <FRBRdate date="${asOf}" name="hopNhat"/>`);
  lines.push(`          <FRBRauthor href="#${slug(meta.issuer)}"/>`);
  lines.push('          <FRBRlanguage language="vie"/>');
  lines.push("        </FRBRExpression>");
  lines.push("        <FRBRManifestation>");
  lines.push(`          <FRBRthis value="${uri}/vie@${asOf}/!main.xml"/>`);
  lines.push(`          <FRBRuri value="${uri}/vie@${asOf}.akn"/>`);
  lines.push(`          <FRBRdate date="${asOf}" name="xuatBan"/>`);
  lines.push(`          <FRBRauthor href="#quydinhphapluat"/>`);
  lines.push("        </FRBRManifestation>");
  lines.push("      </identification>");
  lines.push('      <lifecycle source="#quydinhphapluat">');
  if (meta.effectiveFrom) {
    lines.push(`        <eventRef date="${meta.effectiveFrom}" type="generation" refersTo="#coHieuLuc"/>`);
  }
  if (meta.effectiveTo) {
    lines.push(`        <eventRef date="${meta.effectiveTo}" type="amendment" refersTo="#hetHieuLuc"/>`);
  }
  lines.push("      </lifecycle>");
  lines.push('      <references source="#quydinhphapluat">');
  lines.push(
    `        <TLCOrganization eId="quydinhphapluat" href="/ontology/organization/vn/quydinhphapluat" showAs="Quy định Pháp luật"/>`,
  );
  lines.push(
    `        <TLCOrganization eId="${slug(meta.issuer)}" href="/ontology/organization/vn/${slug(meta.issuer)}" showAs="${escapeXml(meta.issuer)}"/>`,
  );
  lines.push(
    `        <TLCConcept eId="urnNoiBo" href="/ontology/concept/urn" showAs="${escapeXml(meta.urn)}"/>`,
  );
  lines.push("      </references>");
  lines.push(`      <proprietary source="#quydinhphapluat">`);
  lines.push(
    `        <qdpl:urn xmlns:qdpl="https://quydinhphapluat.vn/ns">${escapeXml(meta.urn)}</qdpl:urn>`,
  );
  lines.push(
    `        <qdpl:loaiVanBan xmlns:qdpl="https://quydinhphapluat.vn/ns">${escapeXml(typeName)}</qdpl:loaiVanBan>`,
  );
  lines.push(`        <qdpl:thuBac xmlns:qdpl="https://quydinhphapluat.vn/ns">${meta.rank}</qdpl:thuBac>`);
  lines.push(
    `        <qdpl:trangThai xmlns:qdpl="https://quydinhphapluat.vn/ns">${meta.status}</qdpl:trangThai>`,
  );
  lines.push("      </proprietary>");
  lines.push("    </meta>");

  lines.push("    <preface>");
  lines.push(`      <longTitle><p>${escapeXml(meta.title)}</p></longTitle>`);
  lines.push(`      <docNumber>${escapeXml(meta.soKyHieu)}</docNumber>`);
  lines.push("    </preface>");

  if (preamble.length) {
    lines.push("    <preamble>");
    for (const n of preamble) {
      for (const line of n.text.split("\n").filter(Boolean)) {
        lines.push(`      <p>${escapeXml(line)}</p>`);
      }
    }
    lines.push("    </preamble>");
  }

  lines.push("    <body>");
  for (const n of bodyNodes) emit(n, lines, 3, opts);
  lines.push("    </body>");

  if (conclusions.length) {
    lines.push("    <conclusions>");
    for (const n of conclusions) {
      for (const line of n.text.split("\n").filter(Boolean)) {
        lines.push(`      <p>${escapeXml(line)}</p>`);
      }
    }
    lines.push("    </conclusions>");
  }

  lines.push(`  </${el}>`);
  lines.push("</akomaNtoso>");
  return lines.join("\n");
}

function emit(node: LegalNode, out: string[], depth: number, opts: AknOptions) {
  const pad = "  ".repeat(depth);
  const tag = ELEMENT[node.kind];

  if (!tag) {
    // Bảng, công thức, hình: đưa vào <content> của nút cha dưới dạng <foreign>/<p>.
    if (node.kind === "bang") {
      out.push(`${pad}<table eId="${eId(node)}">`);
      out.push(`${pad}  <caption>${escapeXml(node.label)}</caption>`);
      out.push(`${pad}  <tr><td><p>${escapeXml(node.text)}</p></td></tr>`);
      out.push(`${pad}</table>`);
    } else if (node.kind === "cong_thuc" || node.kind === "hinh") {
      out.push(`${pad}<block name="${node.kind}" eId="${eId(node)}"><p>${escapeXml(node.text)}</p></block>`);
    }
    return;
  }

  const status =
    node.status === "repealed" ? ' status="removed"' : node.status === "suspended" ? ' status="ignored"' : "";
  out.push(`${pad}<${tag} eId="${eId(node)}"${status}>`);
  out.push(`${pad}  <num>${escapeXml(node.label)}</num>`);
  if (node.heading) out.push(`${pad}  <heading>${escapeXml(node.heading)}</heading>`);
  if (opts.notes && node.note) {
    out.push(
      `${pad}  <authorialNote marker="*" placement="bottom"><p>${escapeXml(node.note)}</p></authorialNote>`,
    );
  }

  const structural = node.children.filter((c) => ELEMENT[c.kind]);
  const inline = node.children.filter((c) => !ELEMENT[c.kind]);

  if (node.text || inline.length) {
    out.push(`${pad}  <content>`);
    for (const line of node.text.split("\n").filter(Boolean)) {
      out.push(`${pad}    <p>${escapeXml(line)}</p>`);
    }
    for (const c of inline) emit(c, out, depth + 2, opts);
    out.push(`${pad}  </content>`);
  }
  for (const c of structural) emit(c, out, depth + 1, opts);
  out.push(`${pad}</${tag}>`);
}

/** eId theo quy ước AKN: art_15__para_2__point_a */
function eId(node: LegalNode): string {
  // Chương/Mục không có path rút gọn; dùng fullPath làm định danh.
  const source = node.path || node.fullPath;
  if (!source) return slug(node.label);
  return source
    .split(".")
    .map((seg) => {
      const [kind, ...rest] = seg.split("-");
      const key = rest.join("-");
      const map: Record<string, string> = {
        dieu: "art",
        khoan: "para",
        diem: "point",
        chuong: "chp",
        muc: "sec",
        tieu: "subsec",
        phan: "book",
        doan: "subpara",
        bang: "table",
        cong: "formula",
        hinh: "fig",
        phu: "att",
      };
      return `${map[kind ?? ""] ?? kind}_${key}`;
    })
    .join("__");
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
