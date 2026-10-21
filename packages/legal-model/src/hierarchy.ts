/**
 * Thứ bậc hiệu lực pháp lý theo Điều 4 Luật Ban hành VBQPPL 2025 (64/2025/QH15),
 * sửa đổi bởi Luật 87/2025/QH15. Số nhỏ = hiệu lực cao hơn.
 * Xem ke-hoach/01-nen-tang-phap-ly.md §2.
 */
export interface DocTypeDef {
  code: string;
  name: string;
  rank: number;
  issuerKind: string;
  /** Hậu tố ký hiệu thường gặp, dùng để suy ra loại từ số ký hiệu. */
  suffixes: string[];
  isNormative: boolean;
}

export const DOC_TYPES: DocTypeDef[] = [
  { code: "hp", name: "Hiến pháp", rank: 10, issuerKind: "Quốc hội", suffixes: [], isNormative: true },
  { code: "bl", name: "Bộ luật", rank: 20, issuerKind: "Quốc hội", suffixes: [], isNormative: true },
  {
    code: "l",
    name: "Luật",
    rank: 20,
    issuerKind: "Quốc hội",
    suffixes: ["QH13", "QH14", "QH15", "QH16"],
    isNormative: true,
  },
  {
    code: "nq-qh",
    name: "Nghị quyết của Quốc hội",
    rank: 20,
    issuerKind: "Quốc hội",
    suffixes: ["QH15", "QH16"],
    isNormative: true,
  },
  {
    code: "pl",
    name: "Pháp lệnh",
    rank: 30,
    issuerKind: "Ủy ban Thường vụ Quốc hội",
    suffixes: ["UBTVQH13", "UBTVQH14", "UBTVQH15", "UBTVQH16"],
    isNormative: true,
  },
  {
    code: "nq-ubtvqh",
    name: "Nghị quyết của Ủy ban Thường vụ Quốc hội",
    rank: 30,
    issuerKind: "Ủy ban Thường vụ Quốc hội",
    suffixes: ["UBTVQH15", "UBTVQH16"],
    isNormative: true,
  },
  {
    code: "nqlt",
    name: "Nghị quyết liên tịch",
    rank: 30,
    issuerKind: "Liên tịch",
    suffixes: ["NQLT"],
    isNormative: true,
  },
  {
    code: "lenh",
    name: "Lệnh của Chủ tịch nước",
    rank: 40,
    issuerKind: "Chủ tịch nước",
    suffixes: ["L-CTN"],
    isNormative: true,
  },
  {
    code: "qd-ctn",
    name: "Quyết định của Chủ tịch nước",
    rank: 40,
    issuerKind: "Chủ tịch nước",
    suffixes: ["QĐ-CTN"],
    isNormative: true,
  },
  {
    code: "nd",
    name: "Nghị định",
    rank: 50,
    issuerKind: "Chính phủ",
    suffixes: ["NĐ-CP"],
    isNormative: true,
  },
  {
    code: "nq-cp",
    name: "Nghị quyết của Chính phủ",
    rank: 50,
    issuerKind: "Chính phủ",
    suffixes: ["NQ-CP"],
    isNormative: true,
  },
  {
    code: "qd-ttg",
    name: "Quyết định của Thủ tướng Chính phủ",
    rank: 60,
    issuerKind: "Thủ tướng Chính phủ",
    suffixes: ["QĐ-TTg"],
    isNormative: true,
  },
  {
    code: "nq-hdtp",
    name: "Nghị quyết của Hội đồng Thẩm phán TANDTC",
    rank: 70,
    issuerKind: "Hội đồng Thẩm phán TANDTC",
    suffixes: ["NQ-HĐTP"],
    isNormative: true,
  },
  {
    code: "tt",
    name: "Thông tư",
    rank: 80,
    issuerKind: "Bộ trưởng, Thủ trưởng cơ quan ngang bộ",
    suffixes: [
      "TT-BKHCN",
      "TT-BTC",
      "TT-BTTTT",
      "TT-BTP",
      "TT-BXD",
      "TT-BCT",
      "TT-BYT",
      "TT-BGDĐT",
      "TT-NHNN",
      "TT-BNV",
      "TT-BCA",
      "TT-BQP",
      "TT-KTNN",
    ],
    isNormative: true,
  },
  {
    code: "ttlt",
    name: "Thông tư liên tịch",
    rank: 80,
    issuerKind: "Liên tịch",
    suffixes: ["TTLT"],
    isNormative: true,
  },
  {
    code: "nq-hdnd-t",
    name: "Nghị quyết của HĐND cấp tỉnh",
    rank: 90,
    issuerKind: "HĐND cấp tỉnh",
    suffixes: ["NQ-HĐND"],
    isNormative: true,
  },
  {
    code: "qd-ubnd-t",
    name: "Quyết định của UBND cấp tỉnh",
    rank: 90,
    issuerKind: "UBND cấp tỉnh",
    suffixes: ["QĐ-UBND"],
    isNormative: true,
  },
  {
    code: "qd-ctubnd-t",
    name: "Quyết định của Chủ tịch UBND cấp tỉnh",
    rank: 90,
    issuerKind: "Chủ tịch UBND cấp tỉnh",
    suffixes: ["QĐ-CTUBND"],
    isNormative: true,
  },
  {
    code: "nq-hdnd-x",
    name: "Nghị quyết của HĐND cấp xã",
    rank: 100,
    issuerKind: "HĐND cấp xã",
    suffixes: [],
    isNormative: true,
  },
  {
    code: "qd-ubnd-x",
    name: "Quyết định của UBND cấp xã",
    rank: 100,
    issuerKind: "UBND cấp xã",
    suffixes: [],
    isNormative: true,
  },
  {
    code: "vbhn",
    name: "Văn bản hợp nhất",
    rank: 999,
    issuerKind: "Cơ quan hợp nhất",
    suffixes: ["VBHN-BKHCN", "VBHN-BTC", "VBHN-VPQH", "VBHN-BTP"],
    isNormative: false,
  },
  {
    code: "cv",
    name: "Công văn",
    rank: 999,
    issuerKind: "Cơ quan nhà nước",
    suffixes: [],
    isNormative: false,
  },
  {
    code: "qcvn",
    name: "Quy chuẩn kỹ thuật quốc gia",
    rank: 999,
    issuerKind: "Bộ",
    suffixes: ["QCVN"],
    isNormative: false,
  },
  {
    code: "tcvn",
    name: "Tiêu chuẩn quốc gia",
    rank: 999,
    issuerKind: "Bộ KH&CN",
    suffixes: ["TCVN"],
    isNormative: false,
  },
  { code: "al", name: "Án lệ", rank: 999, issuerKind: "TANDTC", suffixes: [], isNormative: false },
];

const BY_CODE = new Map(DOC_TYPES.map((d) => [d.code, d]));

export function docTypeByCode(code: string): DocTypeDef | undefined {
  return BY_CODE.get(code);
}

/** Suy ra mã loại văn bản từ số ký hiệu, ví dụ "45/2026/NĐ-CP" -> "nd". */
export function inferDocType(soKyHieu: string): string | undefined {
  const s = soKyHieu.normalize("NFC").trim().toUpperCase().replace(/Ð/g, "Đ");
  const parts = s.split("/");
  const suffix = parts[parts.length - 1] ?? "";
  if (/^\d{4}$/.test(suffix)) return undefined;
  // Khớp chính xác trước, rồi khớp theo tiền tố cơ quan.
  for (const t of DOC_TYPES) {
    if (t.suffixes.some((x) => x.toUpperCase() === suffix)) return t.code;
  }
  if (/^TTLT/.test(suffix)) return "ttlt";
  if (/^TT-/.test(suffix)) return "tt";
  if (/^VBHN-/.test(suffix)) return "vbhn";
  if (/^NĐ-CP$/.test(suffix)) return "nd";
  if (/^QĐ-TTG$/i.test(suffix)) return "qd-ttg";
  if (/^QĐ-UBND$/.test(suffix)) return "qd-ubnd-t";
  if (/^NQ-HĐND$/.test(suffix)) return "nq-hdnd-t";
  if (/^UBTVQH\d*$/.test(suffix)) return "pl";
  if (/^QH\d*$/.test(suffix)) return "l";
  return undefined;
}

export function rankOf(docType: string): number {
  return BY_CODE.get(docType)?.rank ?? 999;
}

/**
 * So sánh thứ bậc hiệu lực giữa hai văn bản.
 * Trả về số âm nếu a có hiệu lực cao hơn b.
 */
export function compareAuthority(
  a: { docType: string; issuedDate?: string },
  b: { docType: string; issuedDate?: string },
): number {
  const ra = rankOf(a.docType);
  const rb = rankOf(b.docType);
  if (ra !== rb) return ra - rb;
  // Cùng thứ bậc: văn bản ban hành sau được ưu tiên (Luật 64/2025).
  const da = a.issuedDate ?? "";
  const db = b.issuedDate ?? "";
  if (da === db) return 0;
  return da > db ? -1 : 1;
}

/**
 * Phân biệt Luật / Bộ luật / Nghị quyết của Quốc hội: số ký hiệu giống nhau (…/QH15),
 * chỉ tên văn bản mới cho biết loại.
 */
export function refineDocTypeByTitle(docType: string | undefined, title: string): string | undefined {
  const t = title.normalize("NFC").trim().toLowerCase();
  if (docType === "l" || docType === undefined) {
    if (/^bộ luật\b/.test(t)) return "bl";
    if (/^nghị quyết\b/.test(t)) return "nq-qh";
    if (/^luật\b/.test(t)) return "l";
    if (/^pháp lệnh\b/.test(t)) return "pl";
    if (/^hiến pháp\b/.test(t)) return "hp";
  }
  if (docType === "pl" && /^nghị quyết\b/.test(t)) return "nq-ubtvqh";
  return docType;
}
