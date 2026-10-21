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
