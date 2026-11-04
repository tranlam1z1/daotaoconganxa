/** Nhận dạng nhãn cấu trúc trong văn bản QPPL Việt Nam. Xem ke-hoach/06 §1.1. */
import type { NodeKind } from "./types.ts";

/** Bảng chữ cái dùng đánh số điểm trong VBQPPL (không có f, j, w, z). */
export const DIEM_LETTERS = [
  "a",
  "b",
  "c",
  "d",
  "đ",
  "e",
  "g",
  "h",
  "i",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "x",
  "y",
];

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function romanToInt(s: string): number {
  let total = 0;
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const cur = ROMAN[up[i]!] ?? 0;
    const next = ROMAN[up[i + 1]!] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

const VN_ORDINAL: Record<string, number> = {
  nhất: 1,
  hai: 2,
  ba: 3,
  tư: 4,
  bốn: 4,
  năm: 5,
  sáu: 6,
  bảy: 7,
  tám: 8,
  chín: 9,
  mười: 10,
};

export interface LabelMatch {
  kind: NodeKind;
  /** Khóa dùng trong path, ví dụ "15", "2a", "a". */
  key: string;
  label: string;
  heading?: string;
  /** Phần nội dung còn lại trên cùng dòng. */
  rest: string;
}

/** Nhận dạng nhãn ở đầu một dòng. Trả về undefined nếu không phải nhãn. */
export function matchLabel(line: string): LabelMatch | undefined {
  const s = line.normalize("NFC").replace(/^\s+/, "");
  if (!s) return undefined;

  let m: RegExpExecArray | null;

  // Phần thứ nhất / Phần I / Phần 1
  m = /^PHẦN\s+(?:THỨ\s+)?([A-ZĐÀ-Ỹa-zà-ỹ]+|[IVXLC]+|\d+)\b[.:]?\s*(.*)$/i.exec(s);
  if (m && /^phần/i.test(s)) {
    const raw = m[1]!;
    const num = VN_ORDINAL[raw.toLowerCase()] ?? (/^\d+$/.test(raw) ? Number(raw) : romanToInt(raw));
    if (num > 0) {
      return {
        kind: "phan",
        key: String(num),
        label: s.split(/\s{2,}|\.\s/)[0] ?? s,
        heading: m[2]?.trim() || undefined,
        rest: "",
      };
    }
  }

  // Chương I / Chương 1
  m = /^CHƯƠNG\s+([IVXLC]+|\d+)\b[.:]?\s*(.*)$/i.exec(s);
  if (m) {
    const raw = m[1]!;
    const num = /^\d+$/.test(raw) ? Number(raw) : romanToInt(raw);
    return {
      kind: "chuong",
      key: String(num),
      label: `Chương ${raw}`,
      heading: m[2]?.trim() || undefined,
      rest: "",
    };
  }

  // Mục 1 / MỤC 1  (phải trước Tiểu mục vì "Tiểu mục" chứa "mục")
  m = /^TIỂU\s*MỤC\s+(\d+)\b[.:]?\s*(.*)$/i.exec(s);
  if (m)
    return {
      kind: "tieu_muc",
      key: m[1]!,
      label: `Tiểu mục ${m[1]}`,
      heading: m[2]?.trim() || undefined,
      rest: "",
    };
  m = /^MỤC\s+(\d+)\b[.:]?\s*(.*)$/i.exec(s);
  if (m)
    return { kind: "muc", key: m[1]!, label: `Mục ${m[1]}`, heading: m[2]?.trim() || undefined, rest: "" };

  // Điều 15. Tiêu đề   |  Điều 12a. Tiêu đề
  m = /^ĐIỀU\s+(\d+[a-zđ]?\d?)\s*[.．]\s*(.*)$/i.exec(s);
  if (m)
    return {
      kind: "dieu",
      key: m[1]!.toLowerCase(),
      label: `Điều ${m[1]}`,
      heading: m[2]?.trim() || undefined,
      rest: "",
    };
  m = /^ĐIỀU\s+(\d+[a-zđ]?\d?)\s*$/i.exec(s);
  if (m) return { kind: "dieu", key: m[1]!.toLowerCase(), label: `Điều ${m[1]}`, rest: "" };

  // Phụ lục I / PHỤ LỤC 01
  m = /^PHỤ\s*LỤC\s*([IVXLC]+|\d+)?\b[.:]?\s*(.*)$/i.exec(s);
  if (m) {
    const raw = m[1] ?? "1";
    const num = /^\d+$/.test(raw) ? Number(raw) : romanToInt(raw);
    return {
      kind: "phu_luc",
      key: String(num),
      label: m[1] ? `Phụ lục ${m[1]}` : "Phụ lục",
      heading: m[2]?.trim() || undefined,
      rest: "",
    };
  }

  // Khoản: "2. nội dung"  |  "2a. nội dung"
  m = /^(\d{1,3}[a-zđ]?)\s*[.．]\s+(.+)$/.exec(s);
  if (m) {
    const key = m[1]!.toLowerCase();
    // Loại trừ ngày tháng dạng "01. 2026" và số thứ tự bảng
    return { kind: "khoan", key, label: `${m[1]}.`, rest: m[2]!.trim() };
  }
  // Khoản chỉ có số rồi xuống dòng
  m = /^(\d{1,3}[a-zđ]?)\s*[.．]\s*$/.exec(s);
  if (m) return { kind: "khoan", key: m[1]!.toLowerCase(), label: `${m[1]}.`, rest: "" };

  // Điểm: "a) nội dung"  |  "đ1) nội dung"
  m = /^([a-zđ]\d?)\s*\)\s*(.*)$/.exec(s);
  if (m && DIEM_LETTERS.includes(m[1]![0]!)) {
    return { kind: "diem", key: m[1]!, label: `${m[1]})`, rest: m[2]!.trim() };
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/* Văn bản đánh số mục, không chia Điều                                */
/* ------------------------------------------------------------------ */
/*
 * Quy định, hướng dẫn của Đảng (ví dụ Quy định 208-QĐ/TW thi hành Điều lệ Đảng) không có "Điều":
 * trong từng Chương, nội dung đánh số mục "1.", "1.1.", "1.1.1.". Mục cấp 1 đóng vai Điều để soạn
 * bài, sinh câu hỏi và viện dẫn; số mục bắt đầu lại ở mỗi Chương nên khóa của nó mang số Chương:
 * "c<chương>-<mục>", hoặc "m<mục>" khi văn bản không chia Chương. Mục 1.2 là khoản khóa "2",
 * mục 1.2.1 là điểm khóa "1"; ý "a)" dưới tiết 1.2.1 là điểm khóa "1a".
 */

/** Mục đánh số ở đầu dòng: "1." (cấp 1), "1.2." (cấp 2), "1.2.1." (cấp 3). */
export interface MucSo {
  so: number[];
  rest: string;
}

export function matchMucSo(line: string): MucSo | undefined {
  const m = /^(\d{1,3}(?:\.\d{1,3}){0,2})\.(?:\s+(.*))?$/.exec(line.normalize("NFC").trim());
  if (!m) return undefined;
  return { so: m[1]!.split(".").map(Number), rest: m[2]?.trim() ?? "" };
}

/** Khóa của mục cấp 1, tức "Điều" của văn bản đánh số mục. */
export function khoaMucSo(chuong: string | undefined, so: number): string {
  return chuong ? `c${chuong}-${so}` : `m${so}`;
}

/** Tách khóa mục cấp 1: "c2-3" -> { chuong: 2, so: 3 }. Không phải khóa mục thì undefined. */
export function tachKhoaMucSo(key: string): { chuong?: number; so: number } | undefined {
  const m = /^(?:c(\d+)-|m)(\d+)$/.exec(key);
  if (!m) return undefined;
  return m[1] ? { chuong: Number(m[1]), so: Number(m[2]) } : { so: Number(m[2]) };
}

function intToRoman(n: number): string {
  const bang: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let con = n;
  let ra = "";
  for (const [giaTri, ky] of bang) {
    while (con >= giaTri) {
      ra += ky;
      con -= giaTri;
    }
  }
  return ra;
}

/** Nhãn của nút Điều theo khóa: "15" -> "Điều 15", "c1-2" -> "Mục 2 Chương I". */
export function nhanDieuTheoKhoa(key: string): string {
  const muc = tachKhoaMucSo(key);
  if (!muc) return `Điều ${key}`;
  return muc.chuong ? `Mục ${muc.so} Chương ${intToRoman(muc.chuong)}` : `Mục ${muc.so}`;
}

/** Điểm của văn bản đánh số mục: "1" -> "tiết 3.1.1", "1a" -> "ý a tiết 3.1.1", "a" -> "ý a". */
function cumDiemMucSo(so: number, khoan: string | undefined, diem: string): string {
  const m = /^(\d+)?(.*)$/.exec(diem)!;
  const tiet = m[1] ? `tiết ${so}.${khoan}.${m[1]}` : "";
  return [m[2] ? `ý ${m[2]}` : "", tiet].filter(Boolean).join(" ");
}

/**
 * Đọc path nút thành cụm viện dẫn, từ cấp nhỏ lên: "dieu-15.khoan-2.diem-a" -> "điểm a khoản 2
 * Điều 15"; với văn bản đánh số mục: "dieu-c2-3.khoan-1.diem-2" -> "tiết 3.1.2 điểm 3.1 Mục 3
 * Chương II". Path không bắt đầu bằng Điều thì trả chuỗi rỗng.
 */
export function cumViDanTheoPath(path: string): string {
  const m = /^dieu-([^.]+)(?:\.khoan-([^.]+))?(?:\.diem-([^.]+))?/.exec(path);
  if (!m) return "";
  const [, dieu, khoan, diem] = m as unknown as [string, string, string | undefined, string | undefined];
  const muc = tachKhoaMucSo(dieu);
  const parts: string[] = [];
  if (!muc) {
    if (diem) parts.push(`điểm ${diem}`);
    if (khoan) parts.push(`khoản ${khoan}`);
  } else {
    if (diem) parts.push(cumDiemMucSo(muc.so, khoan, diem));
    if (khoan) parts.push(`điểm ${muc.so}.${khoan}`);
  }
  parts.push(nhanDieuTheoKhoa(dieu));
  return parts.join(" ");
}

/** Nhãn tiếp theo trong dãy (dùng để kiểm tra tính liên tục). */
export function nextKey(kind: NodeKind, key: string): string | undefined {
  if (kind === "diem") {
    const i = DIEM_LETTERS.indexOf(key);
    return i >= 0 && i + 1 < DIEM_LETTERS.length ? DIEM_LETTERS[i + 1] : undefined;
  }
  const m = /^(\d+)([a-zđ]?)$/.exec(key);
  if (!m) return undefined;
  if (m[2]) return undefined; // 2a -> không suy ra tiếp theo
  return String(Number(m[1]) + 1);
}
