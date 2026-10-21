/**
 * Kiểm tra một URN (văn bản hoặc nút) có tồn tại trong CSDL và có hiệu lực tại `asOf` hay không.
 * Dùng cho hậu kiểm trích dẫn của /v1/ask và cho /v1/citations/resolve.
 */
import { sql } from "@qdpl/db";
import { docUrnOf, parseUrn } from "@qdpl/legal-model";
import { asDate } from "./http.ts";

export interface ResolvedUrn {
  urn: string;
  docUrn: string;
  path: string | null;
  documentFound: boolean;
  nodeFound: boolean;
  /** Có phiên bản chứa nút này (hoặc văn bản này) hiệu lực tại asOf hay không. */
  effective: boolean;
  nodeStatus: string | null;
  docStatus: string | null;
  title: string | null;
  shortTitle: string | null;
  soKyHieu: string | null;
  issuer: string | null;
  issuedDate: string | null;
  label: string | null;
  heading: string | null;
  text: string | null;
  versionKind: string | null;
  validFrom: string | null;
  validTo: string | null;
}

const EMPTY = (urn: string, docUrn: string, path: string | null): ResolvedUrn => ({
  urn,
  docUrn,
  path,
  documentFound: false,
  nodeFound: false,
  effective: false,
  nodeStatus: null,
  docStatus: null,
  title: null,
  shortTitle: null,
  soKyHieu: null,
  issuer: null,
  issuedDate: null,
  label: null,
  heading: null,
  text: null,
  versionKind: null,
  validFrom: null,
  validTo: null,
});

/** Phân giải một URN nút hoặc URN văn bản tại thời điểm asOf. */
export async function resolveNodeUrn(urn: string, asOf: string): Promise<ResolvedUrn> {
  const parsed = parseUrn(urn);
  const docUrn = docUrnOf(urn);
  const path = parsed?.path ?? null;
  if (!parsed) return EMPTY(urn, docUrn, path);

  const [doc] = await sql<
    Array<{
      id: string;
      title: string;
      short_title: string;
      so_ky_hieu: string;
      issuer_name: string | null;
      issued_date: Date | string | null;
      status: string;
      effective_from: Date | string | null;
      effective_to: Date | string | null;
    }>
  >`SELECT id, title, short_title, so_ky_hieu, issuer_name, issued_date, status, effective_from, effective_to
    FROM documents WHERE urn = ${docUrn}`;
  if (!doc) return EMPTY(urn, docUrn, path);

  const base = {
    ...EMPTY(urn, docUrn, path),
    documentFound: true,
    docStatus: doc.status,
    title: doc.title,
    shortTitle: doc.short_title,
    soKyHieu: doc.so_ky_hieu,
    issuer: doc.issuer_name,
    issuedDate: asDate(doc.issued_date),
  };

  const docEffective =
    (!doc.effective_from || asDate(doc.effective_from)! <= asOf) &&
    (!doc.effective_to || asDate(doc.effective_to)! > asOf);

  if (!path) {
    return { ...base, nodeFound: true, effective: docEffective };
  }

  const [row] = await sql<
    Array<{
      label: string;
      heading: string | null;
      text_md: string;
      node_status: string;
      version_kind: string;
      valid_from: Date | string | null;
      valid_to: Date | string | null;
    }>
  >`SELECT n.label, n.heading, n.text_md, n.node_status,
           v.kind AS version_kind, v.valid_from, v.valid_to
    FROM nodes n
    JOIN document_versions v ON v.id = n.version_id
    WHERE n.document_id = ${doc.id}::uuid AND n.path = ${path}
      AND v.valid_from <= ${asOf}::date AND (v.valid_to IS NULL OR v.valid_to > ${asOf}::date)
    ORDER BY v.version_no DESC
    LIMIT 1`;

  if (!row) {
    // Nút có thể tồn tại ở phiên bản khác — phân biệt "không có nút" với "không hiệu lực tại asOf".
    const [any] = await sql<Array<{ node_status: string }>>`
      SELECT n.node_status FROM nodes n
      WHERE n.document_id = ${doc.id}::uuid AND n.path = ${path}
      ORDER BY n.ordinal LIMIT 1`;
    return { ...base, nodeFound: Boolean(any), effective: false, nodeStatus: any?.node_status ?? null };
  }

  return {
    ...base,
    nodeFound: true,
    effective: docEffective && row.node_status !== "repealed",
    nodeStatus: row.node_status,
    label: row.label,
    heading: row.heading,
    text: row.text_md,
    versionKind: row.version_kind,
    validFrom: asDate(row.valid_from),
    validTo: asDate(row.valid_to),
  };
}
