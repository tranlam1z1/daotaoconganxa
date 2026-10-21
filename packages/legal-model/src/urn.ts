/**
 * Định danh bền vững (URN) cho văn bản và nút cấu trúc.
 * Dạng: vn:vbqppl:{docType}:{soKyHieu}[:{locality}][#{path}][@{YYYY-MM-DD}]
 * Xem ke-hoach/03-mo-hinh-du-lieu.md §1.
 */
import { docTypeByCode } from "./hierarchy.ts";

export interface ParsedUrn {
  scheme: "vn";
  space: "vbqppl" | "vbhn" | "doc";
  docType: string;
  soKyHieu: string;
  locality?: string;
  path?: string;
  asOf?: string;
}

export function normalizeSoKyHieu(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/Ð/g, "Đ")
    .replace(/^\s*S[ốô]\s*:?\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

export function buildUrn(opts: {
  docType: string;
  soKyHieu: string;
  locality?: string;
  path?: string;
  asOf?: string;
  space?: ParsedUrn["space"];
}): string {
  const def = docTypeByCode(opts.docType);
  const space = opts.space ?? (def?.isNormative ? "vbqppl" : opts.docType === "vbhn" ? "vbhn" : "doc");
  let urn = `vn:${space}:${opts.docType}:${normalizeSoKyHieu(opts.soKyHieu)}`;
  if (opts.locality) urn += `:${opts.locality}`;
  if (opts.path) urn += `#${opts.path}`;
  if (opts.asOf) urn += `@${opts.asOf}`;
  return urn;
}

export function parseUrn(urn: string): ParsedUrn | undefined {
  const m = /^vn:(vbqppl|vbhn|doc):([a-z0-9-]+):([^#@]+)(?:#([^@]+))?(?:@(\d{4}-\d{2}-\d{2}))?$/.exec(
    urn.normalize("NFC"),
  );
  if (!m) return undefined;
  const [, space, docType, rest, path, asOf] = m;
  // rest có thể là "45/2026/NĐ-CP" hoặc "12/2026/QĐ-UBND:thanh-hoa"
  const parts = rest!.split(":");
  const soKyHieu = parts[0]!;
  const locality = parts[1];
  return {
    scheme: "vn",
    space: space as ParsedUrn["space"],
    docType: docType!,
    soKyHieu,
    ...(locality ? { locality } : {}),
    ...(path ? { path } : {}),
    ...(asOf ? { asOf } : {}),
  };
}

/** URN của văn bản (bỏ path và asOf). */
export function docUrnOf(urn: string): string {
  const p = parseUrn(urn);
  if (!p) return urn;
  return buildUrn({ docType: p.docType, soKyHieu: p.soKyHieu, locality: p.locality, space: p.space });
}

/** Slug an toàn cho URL từ số ký hiệu: "45/2026/NĐ-CP" -> "45-2026-nd-cp". */
export function soKyHieuSlug(soKyHieu: string): string {
  return normalizeSoKyHieu(soKyHieu)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
