/**
 * Chuẩn hóa dữ liệu thô từ các nguồn: số ký hiệu, ngày tháng tiếng Việt,
 * tên cơ quan (kèm sáp nhập 2025) và loại văn bản.
 * Xem ke-hoach/04 §3.
 */
import {
  inferDocType,
  normalizeSoKyHieu as normalizeSoKyHieuBase,
  rankOf,
  refineDocTypeByTitle,
} from "@qdpl/legal-model";

/* ------------------------------------------------------------------ */
/* Văn bản / chuỗi                                                     */
/* ------------------------------------------------------------------ */

/** Chuẩn hóa chuỗi chung: NFC, Ð Latin -> Đ, gộp khoảng trắng, bỏ ký tự vô hình. */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[­​-‍﻿]/g, "")
    .replace(/ /g, " ")
    .replace(/Ð/g, "Đ")
    .replace(/ð/g, "đ")
    .replace(/[‐-―]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Chuẩn hóa số ký hiệu văn bản.
 * "Số: 45/2026/NÐ-CP" (Ð Latin) -> "45/2026/NĐ-CP"; hậu tố luôn viết HOA.
 */
export function normalizeSoKyHieu(raw: string): string {
  const cleaned = normalizeText(raw)
    .replace(/^\s*S[ốôo]\s*[:.]?\s*/i, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-");
  const base = normalizeSoKyHieuBase(cleaned);
  const parts = base.split("/");
  if (parts.length >= 3) {
    // Phần cuối là mã loại + cơ quan: luôn viết hoa ("nđ-cp" -> "NĐ-CP").
    parts[parts.length - 1] = parts[parts.length - 1]!.toUpperCase();
  } else if (parts.length === 2 && /[A-Za-zĐđ]/.test(parts[1]!)) {
    parts[1] = parts[1]!.toUpperCase();
  }
  return parts.join("/");
}

/** true khi chuỗi trông như số ký hiệu VBQPPL hợp lệ. */
export function isValidSoKyHieu(s: string): boolean {
  return /^\d+[A-ZĐ]?\/\d{4}\/[A-ZĐ0-9]+(?:-[A-ZĐ0-9]+)*$/.test(normalizeSoKyHieu(s));
}

/* ------------------------------------------------------------------ */
/* Ngày tháng                                                          */
/* ------------------------------------------------------------------ */

const MONTH_WORDS: Record<string, number> = {
  một: 1,
  hai: 2,
  ba: 3,
  tư: 4,
  bốn: 4,
  năm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
  mười: 10,
  "mười một": 11,
  "mười hai": 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function iso(y: number, m: number, d: number): string | undefined {
  if (!(y >= 1900 && y <= 2200)) return undefined;
  if (!(m >= 1 && m <= 12)) return undefined;
  if (!(d >= 1 && d <= 31)) return undefined;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Nhận mọi định dạng ngày gặp trong nguồn Việt Nam, trả về YYYY-MM-DD.
 * - "ngày 26 tháng 01 năm 2026"
 * - "ngày 26 tháng 3 năm 2026" / "ngày 05 tháng mười hai năm 2026"
 * - "26/01/2026", "26-01-2026", "26.01.2026"
 * - "2026-01-26", "2026/01/26"
 * - ISO đầy đủ "2018-05-15T00:00:00"
 */
export function parseVietnameseDate(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = normalizeText(String(raw));
  if (!s) return undefined;

  let m = /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i.exec(s);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));

  m = /ngày\s+(\d{1,2})\s+tháng\s+([\p{L}\s]+?)\s+năm\s+(\d{4})/iu.exec(s);
  if (m) {
    const word = m[2]!.trim().toLowerCase();
    const mon = MONTH_WORDS[word];
    if (mon) return iso(Number(m[3]), mon, Number(m[1]));
  }

  // ISO trước (tránh nhầm "2026-01-26" thành ngày 2026).
  m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));

  return undefined;
}

/** Định dạng ngược lại để hiển thị/ghi chú. */
export function formatVietnameseDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `ngày ${m[3]} tháng ${m[2]} năm ${m[1]}` : isoDate;
}

/* ------------------------------------------------------------------ */
/* Cơ quan ban hành                                                    */
/* ------------------------------------------------------------------ */

export interface AgencyDef {
  code: string;
  /** Tên hiện hành. */
  name: string;
  kind: "quoc_hoi" | "chu_tich_nuoc" | "chinh_phu" | "bo" | "co_quan_khac" | "toa_an" | "vks" | "dia_phuong";
  /** Bí danh, gồm cả tên cũ trước sáp nhập. */
  aliases: string[];
  /** Cơ quan cũ đã nhập vào cơ quan này (kèm mốc thời gian). */
  mergedFrom?: { name: string; until: string }[];
}

/**
 * Bảng cơ quan + bí danh. Phần sáp nhập theo đợt sắp xếp bộ máy 2025
 * (ke-hoach/04 §3): Bộ TT&TT -> Bộ KH&CN; Bộ KH&ĐT -> Bộ Tài chính; ...
 * `until` là ngày cuối cùng tên cũ còn được dùng để ký ban hành.
 */
export const AGENCIES: AgencyDef[] = [
  {
    code: "qh",
    name: "Quốc hội",
    kind: "quoc_hoi",
    aliases: ["quốc hội", "quốc hội nước cộng hòa xã hội chủ nghĩa việt nam"],
  },
  {
    code: "ubtvqh",
    name: "Ủy ban Thường vụ Quốc hội",
    kind: "quoc_hoi",
    aliases: ["uỷ ban thường vụ quốc hội", "ubtvqh"],
  },
  { code: "ctn", name: "Chủ tịch nước", kind: "chu_tich_nuoc", aliases: ["chủ tịch nước"] },
  { code: "cp", name: "Chính phủ", kind: "chinh_phu", aliases: ["chính phủ"] },
  {
    code: "ttg",
    name: "Thủ tướng Chính phủ",
    kind: "chinh_phu",
    aliases: ["thủ tướng chính phủ", "thủ tướng"],
  },
  { code: "vpcp", name: "Văn phòng Chính phủ", kind: "co_quan_khac", aliases: ["văn phòng chính phủ"] },
  {
    code: "bkhcn",
    name: "Bộ Khoa học và Công nghệ",
    kind: "bo",
    aliases: [
      "bộ khoa học và công nghệ",
      "bộ kh&cn",
      "bộ khcn",
      "bộ thông tin và truyền thông",
      "bộ tt&tt",
      "bộ tttt",
    ],
    mergedFrom: [{ name: "Bộ Thông tin và Truyền thông", until: "2025-02-28" }],
  },
  {
    code: "btc",
    name: "Bộ Tài chính",
    kind: "bo",
    aliases: ["bộ tài chính", "bộ kế hoạch và đầu tư", "bộ kh&đt", "bộ khđt", "bảo hiểm xã hội việt nam"],
    mergedFrom: [{ name: "Bộ Kế hoạch và Đầu tư", until: "2025-02-28" }],
  },
  {
    code: "bxd",
    name: "Bộ Xây dựng",
    kind: "bo",
    aliases: ["bộ xây dựng", "bộ giao thông vận tải", "bộ gtvt"],
    mergedFrom: [{ name: "Bộ Giao thông vận tải", until: "2025-02-28" }],
  },
  {
    code: "bnnmt",
    name: "Bộ Nông nghiệp và Môi trường",
    kind: "bo",
    aliases: [
      "bộ nông nghiệp và môi trường",
      "bộ nông nghiệp và phát triển nông thôn",
      "bộ nn&ptnt",
      "bộ tài nguyên và môi trường",
      "bộ tn&mt",
    ],
    mergedFrom: [
      { name: "Bộ Nông nghiệp và Phát triển nông thôn", until: "2025-02-28" },
      { name: "Bộ Tài nguyên và Môi trường", until: "2025-02-28" },
    ],
  },
  {
    code: "bnv",
    name: "Bộ Nội vụ",
    kind: "bo",
    aliases: [
      "bộ nội vụ",
      "bộ lao động - thương binh và xã hội",
      "bộ lao động thương binh và xã hội",
      "bộ lđtbxh",
    ],
    mergedFrom: [{ name: "Bộ Lao động - Thương binh và Xã hội", until: "2025-02-28" }],
  },
  {
    code: "bdttg",
    name: "Bộ Dân tộc và Tôn giáo",
    kind: "bo",
    aliases: ["bộ dân tộc và tôn giáo", "ủy ban dân tộc", "uỷ ban dân tộc"],
  },
  { code: "btp", name: "Bộ Tư pháp", kind: "bo", aliases: ["bộ tư pháp"] },
  { code: "bct", name: "Bộ Công Thương", kind: "bo", aliases: ["bộ công thương"] },
  { code: "bca", name: "Bộ Công an", kind: "bo", aliases: ["bộ công an"] },
  { code: "bqp", name: "Bộ Quốc phòng", kind: "bo", aliases: ["bộ quốc phòng"] },
  { code: "byt", name: "Bộ Y tế", kind: "bo", aliases: ["bộ y tế"] },
  {
    code: "bgddt",
    name: "Bộ Giáo dục và Đào tạo",
    kind: "bo",
    aliases: ["bộ giáo dục và đào tạo", "bộ gd&đt"],
  },
  {
    code: "bvhttdl",
    name: "Bộ Văn hóa, Thể thao và Du lịch",
    kind: "bo",
    aliases: ["bộ văn hóa, thể thao và du lịch", "bộ văn hoá, thể thao và du lịch"],
  },
  { code: "bng", name: "Bộ Ngoại giao", kind: "bo", aliases: ["bộ ngoại giao"] },
  {
    code: "nhnn",
    name: "Ngân hàng Nhà nước Việt Nam",
    kind: "co_quan_khac",
    aliases: ["ngân hàng nhà nước việt nam", "ngân hàng nhà nước", "nhnn"],
  },
  { code: "ttcp", name: "Thanh tra Chính phủ", kind: "co_quan_khac", aliases: ["thanh tra chính phủ"] },
  {
    code: "ktnn",
    name: "Kiểm toán nhà nước",
    kind: "co_quan_khac",
    aliases: ["kiểm toán nhà nước", "tổng kiểm toán nhà nước"],
  },
  {
    code: "tandtc",
    name: "Tòa án nhân dân tối cao",
    kind: "toa_an",
    aliases: ["tòa án nhân dân tối cao", "toà án nhân dân tối cao", "chánh án tòa án nhân dân tối cao"],
  },
  {
    code: "vksndtc",
    name: "Viện kiểm sát nhân dân tối cao",
    kind: "vks",
    aliases: ["viện kiểm sát nhân dân tối cao", "viện trưởng viện kiểm sát nhân dân tối cao"],
  },
];

const ALIAS_INDEX = new Map<string, AgencyDef>();
for (const a of AGENCIES) {
  ALIAS_INDEX.set(a.name.toLowerCase(), a);
  for (const alias of a.aliases) ALIAS_INDEX.set(alias, a);
}

export interface NormalizedAgency {
  /** Tên đã chuẩn hóa để lưu (tên tại thời điểm ban hành nếu biết, nếu không thì tên hiện hành). */
  name: string;
  /** Mã cơ quan hiện hành sau sáp nhập. */
  code?: string;
  /** Tên hiện hành (sau sáp nhập) — dùng để gom nhóm/tra cứu. */
  currentName?: string;
  /** true nếu tên đầu vào là tên cũ đã bị sáp nhập trước ngày ban hành. */
  merged: boolean;
}

/**
 * Chuẩn hóa tên cơ quan. `issuedDate` (YYYY-MM-DD) dùng để giữ đúng tên
 * lịch sử: văn bản 2018 của "Bộ Thông tin và Truyền thông" vẫn ghi tên cũ,
 * nhưng `currentName` trỏ về "Bộ Khoa học và Công nghệ".
 */
export function normalizeAgency(raw: string | null | undefined, issuedDate?: string): NormalizedAgency {
  const cleaned = normalizeText(raw ?? "").replace(/[.,;]+$/, "");
  if (!cleaned) return { name: "", merged: false };
  const key = cleaned.toLowerCase();
  const def = ALIAS_INDEX.get(key);
  if (!def) {
    // Không có trong bảng: chuẩn hóa hoa/thường tối thiểu (nguồn hay viết IN HOA).
    return { name: titleCaseIfAllCaps(cleaned), merged: false };
  }
  const isOldName = def.name.toLowerCase() !== key;
  const merge = def.mergedFrom?.find((m) => m.name.toLowerCase() === key);
  // Tên cũ + văn bản ban hành trước ngày sáp nhập -> giữ nguyên tên lịch sử.
  const keepHistoric = Boolean(merge && issuedDate && issuedDate <= merge.until);
  return {
    name: keepHistoric ? merge!.name : def.name,
    code: def.code,
    currentName: def.name,
    merged: isOldName,
  };
}

/** "CHÍNH PHỦ" -> "Chính phủ" (chỉ khi toàn chữ hoa, tránh phá tên riêng). */
function titleCaseIfAllCaps(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLocaleLowerCase("vi").replace(/(^|[\s(-])(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase("vi"));
}

/* ------------------------------------------------------------------ */
/* Loại văn bản                                                        */
/* ------------------------------------------------------------------ */

/** Tên loại tiếng Việt (từ nguồn) -> mã loại nội bộ, dùng khi số ký hiệu không đủ. */
const TYPE_NAME_TO_CODE: Record<string, string> = {
  "hiến pháp": "hp",
  "bộ luật": "bl",
  luật: "l",
  "pháp lệnh": "pl",
  lệnh: "lenh",
  "nghị định": "nd",
  "nghị quyết": "nq-qh",
  "nghị quyết liên tịch": "nqlt",
  "quyết định": "qd-ttg",
  "thông tư": "tt",
  "thông tư liên tịch": "ttlt",
  "văn bản hợp nhất": "vbhn",
  "công văn": "cv",
  "án lệ": "al",
};

export interface NormalizedDocType {
  docType: string;
  rank: number;
  isNormative: boolean;
  /** Nguồn suy ra loại: từ số ký hiệu, tên loại của nguồn, hay tiêu đề. */
  from: "so_ky_hieu" | "type_name" | "title" | "fallback";
}

/**
 * Suy ra loại văn bản. Ưu tiên số ký hiệu (chính xác nhất), sau đó tinh chỉnh
 * theo tiêu đề (phân biệt Luật / Bộ luật / Nghị quyết của Quốc hội).
 */
export function normalizeDocType(opts: {
  soKyHieu?: string;
  typeName?: string;
  title?: string;
}): NormalizedDocType {
  const title = normalizeText(opts.title ?? "");
  let from: NormalizedDocType["from"] = "fallback";
  let code = opts.soKyHieu ? inferDocType(normalizeSoKyHieu(opts.soKyHieu)) : undefined;
  if (code) from = "so_ky_hieu";
  if (!code && opts.typeName) {
    code = TYPE_NAME_TO_CODE[normalizeText(opts.typeName).toLowerCase()];
    if (code) from = "type_name";
  }
  const refined = refineDocTypeByTitle(code, title);
  if (refined && refined !== code) {
    code = refined;
    if (from === "fallback") from = "title";
  }
  if (!code && title) {
    for (const [name, c] of Object.entries(TYPE_NAME_TO_CODE)) {
      if (title.toLowerCase().startsWith(name)) {
        code = c;
        from = "title";
        break;
      }
    }
  }
  const docType = code ?? "cv";
  return {
    docType,
    rank: rankOf(docType),
    isNormative: rankOf(docType) < 999,
    from,
  };
}

/** Tiêu đề ngắn để hiển thị: "Nghị định 100/2026/NĐ-CP". */
export function shortTitleOf(typeName: string, soKyHieu: string): string {
  return `${normalizeText(typeName)} ${normalizeSoKyHieu(soKyHieu)}`.trim();
}
