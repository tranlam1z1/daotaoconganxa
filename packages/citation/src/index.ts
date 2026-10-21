/**
 * Phân giải viện dẫn: chuỗi tiếng Việt <-> URN.
 * Ví dụ: "điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP" ->
 *        vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2.diem-a
 * Xem ke-hoach/01-nen-tang-phap-ly.md §6.
 *
 * Cách làm: quét các "mỏ neo văn bản" (tên loại + số ký hiệu), rồi bóc chuỗi
 * viện dẫn nằm NGAY TRƯỚC mỏ neo đó. Cách này xử lý được dạng liệt kê thường gặp
 * ("Điều 38 và Điều 89 Luật số 58/2024/QH15") mà một biểu thức chính quy đơn lẻ
 * chỉ bắt được phần tử cuối. Phần còn lại không gắn với mỏ neo nào thì coi là
 * viện dẫn nội bộ ("Điều 7 của Nghị định này").
 */
import { buildUrn, DIEM_LETTERS, inferDocType, normalizeSoKyHieu, parseUrn } from "@qdpl/legal-model";

export interface CitationRef {
  /** Chuỗi gốc trong văn bản. */
  raw: string;
  /** Vị trí trong chuỗi đầu vào. */
  start: number;
  end: number;
  soKyHieu?: string;
  docType?: string;
  /** Tên văn bản khi không có số ký hiệu ("Nghị định này", "Luật Đầu tư công"). */
  docName?: string;
  /** true khi viện dẫn nội bộ: "Nghị định này", "Điều 5 của Luật này". */
  selfRef: boolean;
  dieu?: string;
  khoan?: string;
  diem?: string;
  /** Path nút, ví dụ "dieu-15.khoan-2.diem-a". */
  path?: string;
  confidence: number;
}

/** Tên loại văn bản đầy đủ, dùng cho mỏ neo và cho viện dẫn theo tên. */
const DOC_WORDS = [
  "Hiến pháp",
  "Bộ luật",
  "Pháp lệnh",
  "Nghị quyết liên tịch",
  "Nghị quyết",
  "Nghị định",
  "Thông tư liên tịch",
  "Thông tư",
  "Quyết định",
  "Chỉ thị",
  "Công văn",
  "Văn bản hợp nhất",
  "Lệnh",
  "Luật",
];

/**
 * Viết tắt loại văn bản mà người dùng hay gõ vào ô tìm kiếm.
 * Dùng để suy loại khi số ký hiệu thiếu hậu tố ("nđ 45/2026").
 */
const DOC_ABBR: Record<string, string> = {
  nđ: "nd",
  nd: "nd",
  tt: "tt",
  ttlt: "ttlt",
  qđ: "qd-ttg",
  qd: "qd-ttg",
  nq: "nq-qh",
  pl: "pl",
  l: "l",
  bl: "bl",
  hp: "hp",
  vbhn: "vbhn",
};

const DOC_WORD_ALT = DOC_WORDS.join("|");

/** Từ chỉ vị trí trong văn bản; tên riêng của văn bản không bao giờ chứa chúng. */
const REF_WORDS = /\b(Điều|điều|khoản|Khoản|điểm|Điểm|theo|tại|của|và|hoặc|thì|quy định)\b/;

/**
 * Hậu tố chuẩn của số ký hiệu theo loại văn bản, dùng khi người dùng gõ thiếu
 * ("nđ 45/2026" -> "45/2026/NĐ-CP"). Chỉ áp dụng cho loại có hậu tố duy nhất;
 * thông tư phụ thuộc cơ quan ban hành nên không suy được.
 */
const CANONICAL_SUFFIX: Record<string, string> = {
  nd: "NĐ-CP",
  "nq-cp": "NQ-CP",
  "qd-ttg": "QĐ-TTg",
};

/** Bổ sung hậu tố chuẩn nếu số ký hiệu bị gõ thiếu. */
function canonicalSoKyHieu(so: string, docType?: string): string {
  if (!docType) return so;
  if (so.split("/").length >= 3) return so;
  const suffix = CANONICAL_SUFFIX[docType];
  return suffix ? `${so}/${suffix}` : so;
}
/** Số ký hiệu đầy đủ: 45/2026/NĐ-CP. */
const SO_DAY_DU = String.raw`\d+\s*\/\s*\d{4}\s*\/\s*[A-ZĐa-zđ][A-ZĐa-zđ0-9-]*(?:-[A-ZĐa-zđ0-9]+)*`;
/** Số ký hiệu rút gọn người dùng hay gõ: 45/2026 (thiếu hậu tố). */
const SO_RUT_GON = String.raw`\d+\s*\/\s*\d{4}`;

interface DocAnchor {
  start: number;
  end: number;
  soKyHieu?: string;
  docType?: string;
  docName?: string;
  selfRef: boolean;
}

/** Tìm mọi mỏ neo văn bản trong chuỗi, theo thứ tự xuất hiện. */
function findAnchors(text: string): DocAnchor[] {
  const out: DocAnchor[] = [];
  const push = (a: DocAnchor) => {
    // Không nhận mỏ neo lồng trong mỏ neo đã có.
    if (out.some((x) => a.start >= x.start && a.start < x.end)) return;
    out.push(a);
  };

  // 1a) Tên loại + số ký hiệu, KHÔNG chèn tên riêng ở giữa.
  //     Đây là dạng phổ biến nhất: "Luật số 58/2024/QH15", "Nghị định 45/2026/NĐ-CP".
  const reStrict = new RegExp(String.raw`(${DOC_WORD_ALT})\s*(?:số\s*)?(${SO_DAY_DU})`, "gi");
  for (const m of text.matchAll(reStrict)) {
    const sk = normalizeSoKyHieu(m[2]!);
    push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      soKyHieu: sk,
      docType: inferDocType(sk) ?? docTypeFromWord(m[1]!),
      selfRef: false,
    });
  }

  // 1b) Tên loại + TÊN RIÊNG + "số" + số ký hiệu: "Luật Chuyển đổi số số 148/2025/QH15".
  //     Bắt buộc có từ "số" và tên riêng viết hoa, nếu không mẫu này sẽ nuốt cả mệnh đề
  //     (ví dụ "quyết định đầu tư xác định theo Điều 38 Luật số 58/2024/QH15" từng bị
  //     hiểu thành một "Quyết định số 58/2024/QH15").
  const reNamed = new RegExp(
    String.raw`(${DOC_WORD_ALT})\s+([A-ZĐ][^,;.()\n]{2,60}?)\s+số\s*(${SO_DAY_DU})`,
    "g",
  );
  for (const m of text.matchAll(reNamed)) {
    if (REF_WORDS.test(m[2]!)) continue; // tên riêng không được chứa từ chỉ vị trí
    const sk = normalizeSoKyHieu(m[3]!);
    push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      soKyHieu: sk,
      docType: inferDocType(sk) ?? docTypeFromWord(m[1]!),
      selfRef: false,
    });
  }

  // 2) Viết tắt + số ký hiệu (đầy đủ hoặc rút gọn): "NĐ 45/2026/NĐ-CP", "nđ 45/2026".
  const reAbbr = new RegExp(
    String.raw`\b(${Object.keys(DOC_ABBR).join("|")})\.?\s*(?:số\s*)?(${SO_DAY_DU}|${SO_RUT_GON})`,
    "gi",
  );
  for (const m of text.matchAll(reAbbr)) {
    const raw = m[2]!;
    const abbr = m[1]!.toLowerCase();
    const hasSuffix = raw.split("/").length >= 3;
    const docType = hasSuffix ? (inferDocType(normalizeSoKyHieu(raw)) ?? DOC_ABBR[abbr]) : DOC_ABBR[abbr];
    const sk = canonicalSoKyHieu(normalizeSoKyHieu(raw), docType);
    push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      soKyHieu: sk,
      docType,
      selfRef: false,
    });
  }

  // 3) "Nghị định này", "Luật này" -> viện dẫn nội bộ.
  const reSelf = new RegExp(String.raw`(?:của\s+)?(${DOC_WORD_ALT})\s+này`, "gi");
  for (const m of text.matchAll(reSelf)) {
    push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, docName: `${m[1]} này`, selfRef: true });
  }

  // 4) Tên văn bản không có số: "Luật Đầu tư công".
  const reName = new RegExp(
    String.raw`(?:của\s+|theo\s+)(${DOC_WORD_ALT})\s+([A-ZĐ][^,;.()\n]{2,60}?)(?=\s*(?:,|;|\.|\)|$|\s(?:và|hoặc|thì|quy định)\s))`,
    "g",
  );
  for (const m of text.matchAll(reName)) {
    push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      docName: `${m[1]} ${m[2]}`.trim(),
      selfRef: false,
    });
  }

  return out.sort((a, b) => a.start - b.start);
}

function docTypeFromWord(word: string): string | undefined {
  const w = word.toLowerCase();
  if (w === "hiến pháp") return "hp";
  if (w === "bộ luật") return "bl";
  if (w === "luật") return "l";
  if (w === "pháp lệnh") return "pl";
  if (w === "nghị định") return "nd";
  if (w === "thông tư") return "tt";
  if (w === "thông tư liên tịch") return "ttlt";
  if (w === "nghị quyết") return "nq-qh";
  if (w === "quyết định") return "qd-ttg";
  if (w === "văn bản hợp nhất") return "vbhn";
  return undefined;
}

/** Một cụm chỉ vị trí trong văn bản: điểm/khoản/điều. */
interface NodeRef {
  start: number;
  end: number;
  raw: string;
  dieu?: string;
  khoan?: string;
  diem?: string;
}

const DIEU = String.raw`(?:Điều|điều|Đ\.|đ\.)\s*(\d+[a-zđ]?\d?)`;
const KHOAN = String.raw`(?:khoản|Khoản|k\.|K\.)\s*(\d+[a-zđ]?)`;
const DIEM = String.raw`(?:điểm|Điểm|đ\.)\s*([a-zđ]\d?)\s*\)?`;

/**
 * Bóc mọi cụm chỉ vị trí trong một đoạn văn bản.
 * Hỗ trợ ba trật tự: xuôi tiếng Việt (điểm → khoản → Điều), trật tự ngược
 * (Điều → khoản → điểm) mà người dùng hay gõ, và dạng khoảng ("từ Điều 5 đến Điều 8").
 */
function findNodeRefs(segment: string, offset: number): NodeRef[] {
  const out: NodeRef[] = [];
  const taken: Array<[number, number]> = [];
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);
  const claim = (s: number, e: number) => taken.push([s, e]);

  // a) Khoảng: "từ Điều 5 đến Điều 8"
  const reRange = new RegExp(String.raw`từ\s+${DIEU}\s+đến\s+${DIEU}`, "g");
  for (const m of segment.matchAll(reRange)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from > 50) continue;
    for (let n = from; n <= to; n++) {
      out.push({ start: offset + s, end: offset + e, raw: m[0], dieu: String(n) });
    }
    claim(s, e);
  }

  // b) Danh sách khoản của cùng một điều: "khoản 1, 2 và 3 Điều 16", "các khoản 1 và 2 Điều 5"
  const reKhoanList = new RegExp(
    String.raw`(?:các\s+)?(?:khoản|Khoản|k\.|K\.)\s*(\d+[a-zđ]?(?:\s*(?:,|và)\s*\d+[a-zđ]?)+)\s+${DIEU}`,
    "g",
  );
  for (const m of segment.matchAll(reKhoanList)) {
    const s0 = m.index ?? 0;
    const e0 = s0 + m[0].length;
    if (!free(s0, e0)) continue;
    const khoans = m[1]!
      .split(/\s*(?:,|và)\s*/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    for (const k of khoans) {
      out.push({
        start: offset + s0,
        end: offset + e0,
        raw: m[0].trim(),
        dieu: m[2]!.toLowerCase(),
        khoan: k,
      });
    }
    claim(s0, e0);
  }

  // c) Trật tự xuôi: [điểm] [khoản] Điều
  const reForward = new RegExp(String.raw`(?:${DIEM}\s+)?(?:${KHOAN}\s+)?${DIEU}`, "g");
  for (const m of segment.matchAll(reForward)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    if (!free(s, e)) continue;
    const [, diem, khoan, dieu] = m;
    if (!dieu) continue;
    out.push({
      start: offset + s,
      end: offset + e,
      raw: m[0].trim(),
      dieu: dieu.toLowerCase(),
      ...(khoan ? { khoan: khoan.toLowerCase() } : {}),
      ...(diem && DIEM_LETTERS.includes(diem[0]!) ? { diem: diem.toLowerCase() } : {}),
    });
    claim(s, e);
  }

  // d) Trật tự ngược: Điều N khoản M [điểm X]  -> gộp vào cụm đã bắt ở bước (b)
  const reBackward = new RegExp(String.raw`${DIEU}\s+${KHOAN}(?:\s+${DIEM})?`, "g");
  for (const m of segment.matchAll(reBackward)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    const [, dieu, khoan, diem] = m;
    const existing = out.find((r) => r.start === offset + s && r.dieu === dieu?.toLowerCase());
    if (existing) {
      if (!existing.khoan && khoan) existing.khoan = khoan.toLowerCase();
      if (!existing.diem && diem && DIEM_LETTERS.includes(diem[0]!)) existing.diem = diem.toLowerCase();
      existing.end = offset + e;
      existing.raw = m[0].trim();
    }
    claim(s, e);
  }

  // e) Khoản đứng riêng, không kèm Điều: "khoản 2a vào sau khoản 2 Điều 15" ->
  //    khoản 2a phải được gắn với Điều 15 của cụm phía sau.
  const reKhoanOnly = new RegExp(KHOAN, "g");
  for (const m of segment.matchAll(reKhoanOnly)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    if (!free(s, e)) continue;
    const after = out.find((r) => r.start >= offset + e && r.dieu);
    if (!after) continue;
    out.push({
      start: offset + s,
      end: offset + e,
      raw: m[0].trim(),
      dieu: after.dieu,
      khoan: m[1]!.toLowerCase(),
    });
    claim(s, e);
  }

  return out.sort((a, b) => a.start - b.start);
}

export function buildPath(dieu?: string, khoan?: string, diem?: string): string | undefined {
  if (!dieu) return undefined;
  let p = `dieu-${dieu.toLowerCase()}`;
  if (khoan) p += `.khoan-${khoan.toLowerCase()}`;
  if (diem) p += `.diem-${diem.toLowerCase()}`;
  return p;
}

/** Tìm mọi viện dẫn trong một đoạn văn bản. */
export function findCitations(text: string): CitationRef[] {
  const anchors = findAnchors(text);
  const out: CitationRef[] = [];
  const usedRanges: Array<[number, number]> = [];

  const makeRef = (n: NodeRef | undefined, a: DocAnchor | undefined): CitationRef | undefined => {
    if (!n && !a) return undefined;
    const start = n ? n.start : a!.start;
    const end = a ? a.end : n!.end;
    const path = n ? buildPath(n.dieu, n.khoan, n.diem) : undefined;
    const ref: CitationRef = {
      raw: text.slice(start, end).trim(),
      start,
      end,
      selfRef: a ? a.selfRef : true,
      confidence: a?.soKyHieu ? 0.95 : a?.docName ? 0.6 : 0.8,
    };
    if (a?.soKyHieu) ref.soKyHieu = a.soKyHieu;
    if (a?.docType) ref.docType = a.docType;
    if (a?.docName) ref.docName = a.docName;
    if (n?.dieu) ref.dieu = n.dieu;
    if (n?.khoan) ref.khoan = n.khoan;
    if (n?.diem) ref.diem = n.diem;
    if (path) ref.path = path;
    return ref;
  };

  // Với mỗi mỏ neo, lấy các cụm chỉ vị trí nằm giữa mỏ neo trước và mỏ neo này.
  let cursor = 0;
  for (const a of anchors) {
    const segment = text.slice(cursor, a.start);
    const refs = findNodeRefs(segment, cursor);
    if (refs.length) {
      for (const n of refs) {
        const r = makeRef(n, a);
        if (r) out.push(r);
      }
    } else if (!a.selfRef) {
      // "Nghị định này" đứng một mình chỉ là cách gọi văn bản đang đọc, không phải
      // viện dẫn tới một quy định cụ thể -> không sinh viện dẫn.
      const r = makeRef(undefined, a);
      if (r) out.push(r);
    }
    usedRanges.push([cursor, a.end]);
    cursor = a.end;
  }

  // Phần đuôi sau mỏ neo cuối: viện dẫn nội bộ không kèm tên văn bản.
  const tail = text.slice(cursor);
  for (const n of findNodeRefs(tail, cursor)) {
    const r = makeRef(n, undefined);
    if (r) out.push(r);
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Chuyển một viện dẫn thành URN. selfDocUrn dùng cho viện dẫn nội bộ ("Nghị định này"). */
export function toUrn(ref: CitationRef, selfDocUrn?: string, asOf?: string): string | undefined {
  let docUrn: string | undefined;
  if (ref.soKyHieu && ref.docType) {
    docUrn = buildUrn({ docType: ref.docType, soKyHieu: ref.soKyHieu });
  } else if (ref.selfRef && selfDocUrn) {
    docUrn = selfDocUrn;
  }
  if (!docUrn) return undefined;
  const p = parseUrn(docUrn);
  if (!p) return undefined;
  return buildUrn({
    docType: p.docType,
    soKyHieu: p.soKyHieu,
    locality: p.locality,
    path: ref.path,
    asOf,
    space: p.space,
  });
}

/** Định dạng viện dẫn chuẩn để hiển thị/sao chép. */
export function formatCitation(opts: {
  path?: string;
  docTypeName: string;
  soKyHieu: string;
  issuedDate?: string;
  issuer?: string;
  title?: string;
  short?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.path) {
    const m = /^dieu-([^.]+)(?:\.khoan-([^.]+))?(?:\.diem-([^.]+))?/.exec(opts.path);
    if (m) {
      if (m[3]) parts.push(`điểm ${m[3]}`);
      if (m[2]) parts.push(`khoản ${m[2]}`);
      parts.push(`Điều ${m[1]}`);
    }
  }
  const head = parts.join(" ");
  if (opts.short) {
    return `${head ? `${head} ` : ""}${opts.docTypeName} ${opts.soKyHieu}`.trim();
  }
  const date = opts.issuedDate ? ` ngày ${fmtDate(opts.issuedDate)}` : "";
  const issuer = opts.issuer ? ` của ${opts.issuer}` : "";
  const title = opts.title ? ` ${describeTitle(opts.title, opts.docTypeName)}` : "";
  return `${head ? `${head} ` : ""}${opts.docTypeName} số ${opts.soKyHieu}${date}${issuer}${title}`.trim();
}

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/**
 * Chuyển tên văn bản thành mệnh đề mô tả đứng sau số ký hiệu.
 * Tên văn bản trong CSDL thường đã mở đầu bằng chính loại văn bản
 * ("Nghị định quy định quản lý…"), nếu giữ nguyên sẽ thành
 * "Nghị định số 45/2026/NĐ-CP của Chính phủ nghị định quy định…" — lặp loại văn bản.
 */
function describeTitle(title: string, docTypeName: string): string {
  const t = title.trim();
  const prefix = docTypeName.trim();
  let rest = t;
  if (prefix && t.toLowerCase().startsWith(prefix.toLowerCase())) {
    rest = t.slice(prefix.length).trim();
    rest = rest.replace(/^[-–:]\s*/, "");
  }
  if (!rest) return "";
  return rest.charAt(0).toLowerCase() + rest.slice(1);
}
