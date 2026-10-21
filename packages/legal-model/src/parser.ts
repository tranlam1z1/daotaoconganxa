/**
 * Parser cấu trúc: Markdown chuẩn nội bộ -> cây nút.
 * Máy trạng thái đọc tuần tự, đẩy/bật ngăn xếp theo cấp. Xem ke-hoach/06 §1.
 */
import { matchLabel } from "./labels.ts";
import type { LegalNode, NodeKind } from "./types.ts";

const LEVEL: Record<NodeKind, number> = {
  van_ban: 0,
  loi_noi_dau: 1,
  can_cu: 1,
  phan: 1,
  chuong: 2,
  muc: 3,
  tieu_muc: 4,
  phu_luc: 1,
  dieu: 5,
  khoan: 6,
  diem: 7,
  doan: 8,
  bang: 8,
  cong_thuc: 8,
  hinh: 8,
  chu_ky: 1,
};

export interface ParseWarning {
  kind: "gap" | "duplicate" | "orphan" | "unparsed" | "table" | "formula";
  message: string;
  path?: string;
}

export interface ParseResult {
  root: LegalNode;
  warnings: ParseWarning[];
  /** Số nút theo loại, dùng cho kiểm định chất lượng. */
  counts: Record<string, number>;
}

function newNode(partial: Partial<LegalNode> & { kind: NodeKind; label: string }): LegalNode {
  return {
    path: "",
    fullPath: "",
    text: "",
    children: [],
    status: "active",
    ...partial,
  } as LegalNode;
}

/** Các dòng rác thường gặp sau OCR/Công báo cần bỏ. */
function isNoiseLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (/^-?\s*\d{1,4}\s*-?$/.test(s)) return true; // số trang
  if (/^CÔNG BÁO\/Số\s+/i.test(s)) return true;
  if (/^\d+\s+CÔNG BÁO/i.test(s)) return true;
  return false;
}

/**
 * Tách khối Markdown thành đơn vị: đoạn văn, bảng, công thức, hình.
 * Bảo toàn bảng nhiều dòng và công thức $$...$$.
 */
interface Block {
  type: "text" | "table" | "formula" | "image" | "html";
  content: string;
}

function splitBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      const c = buf.join("\n").trim();
      if (c) blocks.push({ type: "text", content: c });
      buf = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isNoiseLine(line)) continue;
    // Công thức khối
    if (/^\s*\$\$/.test(line)) {
      flush();
      const closesOnSameLine = (line.match(/\$\$/g)?.length ?? 0) >= 2;
      const acc = [line];
      if (!closesOnSameLine) {
        let j = i + 1;
        while (j < lines.length && !/\$\$/.test(lines[j]!)) acc.push(lines[j++]!);
        if (j < lines.length) acc.push(lines[j]!);
        i = j;
      }
      blocks.push({ type: "formula", content: acc.join("\n").trim() });
      continue;
    }
    // Bảng HTML
    if (/^\s*<table/i.test(line)) {
      flush();
      const acc = [line];
      if (!/<\/table>/i.test(line)) {
        let j = i + 1;
        while (j < lines.length && !/<\/table>/i.test(lines[j]!)) acc.push(lines[j++]!);
        if (j < lines.length) acc.push(lines[j]!);
        i = j;
      }
      blocks.push({ type: "table", content: acc.join("\n").trim() });
      continue;
    }
    // Bảng GFM: dòng chứa | và dòng kế là dòng phân cách
    if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]*-[-\s|:]*\|/.test(lines[i + 1]!)) {
      flush();
      const acc = [line, lines[i + 1]!];
      let j = i + 2;
      while (j < lines.length && /\|/.test(lines[j]!) && lines[j]!.trim() !== "") acc.push(lines[j++]!);
      i = j - 1;
      blocks.push({ type: "table", content: acc.join("\n").trim() });
      continue;
    }
    // Hình
    if (/^\s*!\[/.test(line)) {
      flush();
      blocks.push({ type: "image", content: line.trim() });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

/**
 * Cập nhật độ sâu ngoặc kép sau khi đọc một dòng.
 *
 * Dùng để nhận biết nội dung trích dẫn trong văn bản sửa đổi: phần nằm trong ngoặc kép
 * là NỘI DUNG MỚI của văn bản bị sửa đổi, không phải cấu trúc của chính văn bản sửa đổi.
 * Nếu không xử lý, "1." và "2." bên trong khối trích dẫn sẽ bị hiểu là khoản của văn bản
 * sửa đổi, sinh ra nút TRÙNG PATH và phá vỡ khả năng định danh nút.
 *
 * Ngoặc thẳng (") không phân biệt mở/đóng nên mỗi lần gặp là một lần đảo trạng thái;
 * ngoặc cong (“ ” „) thì cộng trừ theo đúng vai trò.
 */
export function nextQuoteDepth(line: string, depth: number): number {
  let d = depth;
  for (const ch of line) {
    if (ch === '"') d = d > 0 ? d - 1 : d + 1;
    else if (ch === "\u201C" || ch === "\u201E") d += 1;
    else if (ch === "\u201D") d = Math.max(0, d - 1);
  }
  return Math.max(0, d);
}

/** Các nhãn mang tiêu đề riêng: tiêu đề của chúng không được nuốt câu nội dung phía sau. */
const HEADING_KINDS: NodeKind[] = ["phan", "chuong", "muc", "tieu_muc", "dieu", "phu_luc"];

/**
 * Ghép các dòng trong một đoạn thành câu liền mạch (nối dòng bị ngắt do trình bày).
 *
 * Hai trường hợp phải phân biệt:
 * - "Chương II" xuống dòng rồi mới tới tên chương -> phải nối (nhãn chưa có tiêu đề).
 * - "Điều 5. Phê duyệt" xuống dòng rồi tới nội dung điều -> KHÔNG được nối, nếu không
 *   tiêu đề điều sẽ nuốt cả câu nội dung. Phân biệt bằng chữ cái đầu của dòng sau:
 *   tiêu đề bị ngắt giữa chừng thường tiếp tục bằng chữ thường, còn câu nội dung mới
 *   bắt đầu bằng chữ hoa.
 */
export function joinWrappedLines(text: string): string {
  const lines = text.split(/\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    if (prev === undefined) {
      out.push(line);
      continue;
    }
    const prevEndsSentence = /[.;:!?]["')\]]?$/.test(prev);
    const startsNewUnit = matchLabel(line) !== undefined || /^[-–•]/.test(line);
    const prevLabel = matchLabel(prev);
    let join = !prevEndsSentence && !startsNewUnit;

    if (prevLabel && HEADING_KINDS.includes(prevLabel.kind)) {
      const hasHeading = Boolean(prevLabel.heading?.trim());
      const continuesHeading = /^[a-zà-ỹđ(]/.test(line);
      // Nhãn chưa có tiêu đề -> dòng sau chính là tiêu đề, luôn nối.
      // Nhãn đã có tiêu đề -> chỉ nối khi dòng sau rõ ràng là phần đuôi của tiêu đề.
      join = !startsNewUnit && (!hasHeading || continuesHeading);
    }

    if (join) {
      // Bỏ gạch nối cuối dòng nếu OCR sinh ra giữa từ (tiếng Việt không gạch nối khi ngắt dòng).
      out[out.length - 1] = `${prev.replace(/-$/, "")} ${line}`.replace(/\s+/g, " ");
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

export function parseDocument(markdown: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const root = newNode({ kind: "van_ban", label: "", path: "", fullPath: "" });
  const stack: LegalNode[] = [root];
  const counts: Record<string, number> = {};

  const bump = (k: string) => {
    counts[k] = (counts[k] ?? 0) + 1;
  };

  // Bỏ frontmatter YAML nếu có.
  let body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  // Bỏ marker nút của pipeline (đã dùng ở bước ghép, không cần khi parse lại).
  body = body.replace(/<!--\s*node:[^>]*-->\s*/g, "");

  const blocks = splitBlocks(body);

  /** Các loại nút được địa chỉ hóa trong path rút gọn (dùng để viện dẫn). */
  const ADDRESSABLE: NodeKind[] = ["dieu", "khoan", "diem", "phu_luc", "doan", "bang", "cong_thuc", "hinh"];

  /** Path rút gọn của tổ tiên gần nhất được địa chỉ hóa; chương/mục không tham gia. */
  function shortAncestorPath(): string {
    for (let i = stack.length - 1; i >= 0; i--) {
      const n = stack[i]!;
      if (ADDRESSABLE.includes(n.kind)) return n.path;
    }
    return "";
  }

  const pathOf = (parent: LegalNode, key: string, kind: NodeKind): { path: string; fullPath: string } => {
    const seg = `${kindSeg(kind)}-${key}`;
    const parentShort = shortAncestorPath();
    const short = ADDRESSABLE.includes(kind) ? (parentShort ? `${parentShort}.${seg}` : seg) : "";
    const full = parent.fullPath ? `${parent.fullPath}.${seg}` : seg;
    return { path: short, fullPath: full };
  };

  function popTo(level: number) {
    while (stack.length > 1 && LEVEL[stack[stack.length - 1]!.kind] >= level) stack.pop();
  }

  function current(): LegalNode {
    return stack[stack.length - 1]!;
  }

  let seenDieu = false;
  const dieuKeys: string[] = [];
  /** Độ sâu ngoặc kép đang mở; > 0 nghĩa là đang ở trong nội dung trích dẫn. */
  let quoteDepth = 0;

  for (const block of blocks) {
    if (block.type === "table" || block.type === "formula" || block.type === "image") {
      const kind: NodeKind =
        block.type === "table" ? "bang" : block.type === "formula" ? "cong_thuc" : "hinh";
      const parent = current();
      const idx = parent.children.filter((c) => c.kind === kind).length + 1;
      const { path, fullPath } = pathOf(parent, String(idx), kind);
      const node = newNode({
        kind,
        label: kind === "bang" ? `Bảng ${idx}` : kind === "cong_thuc" ? `Công thức ${idx}` : `Hình ${idx}`,
        text: block.content,
        path,
        fullPath,
      });
      parent.children.push(node);
      bump(kind);
      continue;
    }

    const text = joinWrappedLines(block.content);
    const lines = text.split("\n");
    for (const line of lines) {
      // Tiêu đề Markdown: dùng làm tên văn bản/loại nếu ở đầu.
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      const content = heading ? heading[1]!.trim() : line;

      // Đang ở trong khối trích dẫn (nội dung mới của văn bản bị sửa đổi):
      // gộp nguyên văn vào nút hiện tại, không phân tích cấu trúc.
      if (quoteDepth > 0) {
        const cur = current();
        cur.text = cur.text ? `${cur.text}\n${content}` : content;
        quoteDepth = nextQuoteDepth(content, quoteDepth);
        continue;
      }

      const label = matchLabel(content);
      if (!label) {
        // Không phải nhãn: gắn vào nút hiện tại.
        const cur = current();
        if (/^Căn cứ /i.test(content) && !seenDieu) {
          const parent = root;
          let canCu = parent.children.find((c) => c.kind === "can_cu");
          if (!canCu) {
            canCu = newNode({ kind: "can_cu", label: "Căn cứ ban hành", path: "can-cu", fullPath: "can-cu" });
            parent.children.push(canCu);
          }
          canCu.text = canCu.text ? `${canCu.text}\n${content}` : content;
          quoteDepth = nextQuoteDepth(content, quoteDepth);
          continue;
        }
        if (/^Nơi nhận\s*:/i.test(content)) {
          const sig = newNode({
            kind: "chu_ky",
            label: "Nơi nhận / Chữ ký",
            path: "chu-ky",
            fullPath: "chu-ky",
            text: content,
          });
          root.children.push(sig);
          stack.length = 1;
          stack.push(sig);
          continue;
        }
        if (cur.kind === "chu_ky") {
          cur.text = `${cur.text}\n${content}`;
          continue;
        }
        if (!seenDieu && cur === root) {
          // Phần đầu văn bản: tên, cơ quan, quốc hiệu.
          let pre = root.children.find((c) => c.kind === "loi_noi_dau");
          if (!pre) {
            pre = newNode({ kind: "loi_noi_dau", label: "Phần mở đầu", path: "mo-dau", fullPath: "mo-dau" });
            root.children.unshift(pre);
          }
          pre.text = pre.text ? `${pre.text}\n${content}` : content;
          quoteDepth = nextQuoteDepth(content, quoteDepth);
          continue;
        }
        // Đoạn tiếp theo của nút hiện tại.
        if (cur.text) {
          const isBullet = /^[-–•]/.test(content);
          if (isBullet || cur.children.length === 0) {
            cur.text = `${cur.text}\n${content}`;
          } else {
            // Đoạn độc lập sau khi đã có con -> nút doan
            const idx = cur.children.filter((c) => c.kind === "doan").length + 1;
            const node = newNode({
              kind: "doan",
              label: `Đoạn ${idx}`,
              text: content,
              path: cur.path ? `${cur.path}.doan-${idx}` : `doan-${idx}`,
              fullPath: cur.fullPath ? `${cur.fullPath}.doan-${idx}` : `doan-${idx}`,
            });
            cur.children.push(node);
            bump("doan");
          }
        } else {
          cur.text = content;
        }
        quoteDepth = nextQuoteDepth(content, quoteDepth);
        continue;
      }

      // Có nhãn -> tạo nút mới ở đúng cấp.
      const level = LEVEL[label.kind];
      popTo(level);
      const parent = current();
      const { path, fullPath } = pathOf(parent, label.key, label.kind);
      const node = newNode({
        kind: label.kind,
        label: label.label,
        heading: label.heading,
        text: label.rest,
        // Chương/Mục/Tiểu mục/Phần không có path rút gọn (không dùng để viện dẫn);
        // định danh của chúng là fullPath.
        path,
        fullPath,
      });
      parent.children.push(node);
      stack.push(node);
      bump(label.kind);
      if (label.kind === "dieu") {
        seenDieu = true;
        dieuKeys.push(label.key);
      }
      quoteDepth = nextQuoteDepth(content, quoteDepth);
    }
  }

  // Kiểm tra tính liên tục của Điều.
  checkSequence(dieuKeys, "Điều", warnings);
  // Kiểm tra khoản/điểm trong từng điều.
  walk(root, (n) => {
    if (n.kind === "dieu") {
      const ks = n.children.filter((c) => c.kind === "khoan").map((c) => nodeKey(c));
      checkSequence(ks, `khoản trong ${n.label}`, warnings, n.path);
    }
    if (n.kind === "khoan") {
      const ks = n.children.filter((c) => c.kind === "diem").map((c) => nodeKey(c));
      checkSequenceLetters(ks, `điểm trong ${n.path}`, warnings, n.path);
    }
  });

  return { root, warnings, counts };
}

function kindSeg(kind: NodeKind): string {
  switch (kind) {
    case "phan":
      return "phan";
    case "chuong":
      return "chuong";
    case "muc":
      return "muc";
    case "tieu_muc":
      return "tieu-muc";
    case "dieu":
      return "dieu";
    case "khoan":
      return "khoan";
    case "diem":
      return "diem";
    case "doan":
      return "doan";
    case "bang":
      return "bang";
    case "cong_thuc":
      return "cong-thuc";
    case "hinh":
      return "hinh";
    case "phu_luc":
      return "phu-luc";
    default:
      return kind.replace(/_/g, "-");
  }
}

export { kindSeg };

/** Lấy khóa cuối của path, ví dụ "dieu-15.khoan-2" -> "2". */
export function nodeKey(node: LegalNode): string {
  const seg = node.path.split(".").pop() ?? "";
  const i = seg.indexOf("-");
  return i >= 0 ? seg.slice(i + 1) : seg;
}

export function walk(
  node: LegalNode,
  fn: (n: LegalNode, parent?: LegalNode) => void,
  parent?: LegalNode,
): void {
  fn(node, parent);
  for (const c of node.children) walk(c, fn, node);
}

function checkSequence(keys: string[], what: string, warnings: ParseWarning[], path?: string) {
  const seen = new Set<string>();
  let prev = 0;
  for (const k of keys) {
    if (seen.has(k)) warnings.push({ kind: "duplicate", message: `${what} ${k} bị lặp`, path });
    seen.add(k);
    const m = /^(\d+)([a-zđ]?)$/.exec(k);
    if (!m) continue;
    const n = Number(m[1]);
    if (m[2]) continue; // 2a nằm giữa 2 và 3
    if (prev && n !== prev + 1) {
      warnings.push({ kind: "gap", message: `${what}: nhảy từ ${prev} sang ${n}`, path });
    }
    prev = n;
  }
}

function checkSequenceLetters(keys: string[], what: string, warnings: ParseWarning[], path?: string) {
  const LETTERS = [
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
  let prevIdx = -1;
  for (const k of keys) {
    const base = k[0]!;
    const idx = LETTERS.indexOf(base);
    if (idx < 0) continue;
    if (prevIdx >= 0 && idx !== prevIdx + 1 && idx !== prevIdx) {
      warnings.push({ kind: "gap", message: `${what}: nhảy từ ${LETTERS[prevIdx]}) sang ${base})`, path });
    }
    prevIdx = idx;
  }
}
