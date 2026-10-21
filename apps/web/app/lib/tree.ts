/** Tiện ích xử lý cây cấu trúc: đếm nút, dựng mục lục, cắt cửa sổ hiển thị. */
import type { LegalNode, NodeKind } from "./types";

/** Ngưỡng bật chế độ render theo cửa sổ (ke-hoach/10 §7). */
export const WINDOW_THRESHOLD = 400;
/** Số điều hiển thị mỗi cửa sổ. */
export const WINDOW_SIZE = 30;

export function countNodes(node: LegalNode): number {
  let n = 1;
  for (const child of node.children) n += countNodes(child);
  return n;
}

const TOC_KINDS: NodeKind[] = ["phan", "chuong", "muc", "tieu_muc", "dieu", "phu_luc"];

export interface TocEntry {
  path: string;
  label: string;
  heading?: string;
  kind: NodeKind;
}

/** Dựng mục lục tới cấp Điều (và Phụ lục). */
export function buildToc(root: LegalNode): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (node: LegalNode) => {
    if (TOC_KINDS.includes(node.kind) && node.path) {
      out.push({
        path: node.path,
        label: node.label,
        ...(node.heading ? { heading: node.heading } : {}),
        kind: node.kind,
      });
    }
    // Không đi sâu quá cấp Điều để mục lục gọn.
    if (node.kind === "dieu") return;
    for (const child of node.children) walk(child);
  };
  for (const child of root.children) walk(child);
  return out;
}

/** Danh sách path của mọi Điều theo thứ tự xuất hiện. */
export function listDieuPaths(root: LegalNode): string[] {
  const out: string[] = [];
  const walk = (node: LegalNode) => {
    if (node.kind === "dieu") {
      out.push(node.path);
      return;
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

export interface WindowInfo {
  windowed: boolean;
  /** Chỉ số Điều đầu và cuối (0-based, nửa mở) của cửa sổ hiện tại. */
  from: number;
  to: number;
  totalDieu: number;
  totalNodes: number;
  firstLabel?: string;
  lastLabel?: string;
  prevPath?: string;
  nextPath?: string;
}

/**
 * Cắt cây theo cửa sổ: chỉ giữ các Điều trong khoảng [from, to).
 * Chương/Mục không còn Điều nào sẽ bị loại; Căn cứ giữ ở cửa sổ đầu,
 * Phụ lục giữ ở cửa sổ cuối. Anchor của các Điều trong cửa sổ vẫn nhảy đúng
 * vì chúng được kết xuất đầy đủ phía máy chủ.
 */
export function sliceWindow(root: LegalNode, from: number, to: number): LegalNode {
  let index = 0;
  const prune = (node: LegalNode, isTop: boolean): LegalNode | null => {
    if (node.kind === "dieu") {
      const keep = index >= from && index < to;
      index += 1;
      return keep ? node : null;
    }
    if (node.kind === "can_cu" || node.kind === "loi_noi_dau") {
      return from === 0 ? node : null;
    }
    if (node.kind === "phu_luc") {
      return null; // Phụ lục xử lý riêng ở dưới.
    }
    const children = node.children
      .map((child) => prune(child, false))
      .filter((child): child is LegalNode => child !== null);
    if (!children.length && !isTop) return null;
    return { ...node, children };
  };

  const children = root.children
    .map((child) => prune(child, false))
    .filter((child): child is LegalNode => child !== null);

  // Phụ lục chỉ hiện ở cửa sổ cuối.
  const total = listDieuPaths(root).length;
  if (to >= total) {
    for (const child of root.children) {
      if (child.kind === "phu_luc") children.push(child);
    }
  }
  return { ...root, children };
}

/** Tính cửa sổ chứa Điều mục tiêu (theo path anchor). */
export function computeWindow(root: LegalNode, targetPath: string | null): WindowInfo {
  const totalNodes = countNodes(root);
  const dieuPaths = listDieuPaths(root);
  const totalDieu = dieuPaths.length;
  if (totalNodes <= WINDOW_THRESHOLD) {
    return { windowed: false, from: 0, to: totalDieu, totalDieu, totalNodes };
  }
  const rootPath = targetPath ? (targetPath.split(".")[0] ?? "") : "";
  const targetIndex = rootPath ? dieuPaths.indexOf(rootPath) : -1;
  const anchor = targetIndex >= 0 ? targetIndex : 0;
  const from = Math.max(0, Math.floor(anchor / WINDOW_SIZE) * WINDOW_SIZE);
  const to = Math.min(totalDieu, from + WINDOW_SIZE);
  return {
    windowed: true,
    from,
    to,
    totalDieu,
    totalNodes,
    ...(dieuPaths[from] ? { firstLabel: dieuPaths[from] } : {}),
    ...(dieuPaths[to - 1] ? { lastLabel: dieuPaths[to - 1] } : {}),
    ...(from > 0 && dieuPaths[from - 1] ? { prevPath: dieuPaths[from - 1] } : {}),
    ...(to < totalDieu && dieuPaths[to] ? { nextPath: dieuPaths[to] } : {}),
  };
}

/** Nhãn hiển thị của một path Điều: "dieu-15" -> "Điều 15". */
export function dieuLabelFromPath(path: string | undefined): string {
  if (!path) return "";
  const m = /^dieu-(.+)$/.exec(path);
  return m?.[1] ? `Điều ${m[1]}` : path;
}

/* ------------------------------------------------------------------ */
/* Đọc từng điều (docs/PLAN.md GĐ1)                                    */
/* ------------------------------------------------------------------ */

/** Nút Điều có path gốc cho trước ("dieu-15"), kèm tên Chương/Mục bao ngoài để làm ngữ cảnh. */
export interface DieuTimThay {
  node: LegalNode;
  /** "Chương II. Quy tắc giao thông" — rỗng khi Điều nằm thẳng dưới văn bản. */
  nguCanh: string[];
}

export function findDieu(root: LegalNode, dieuPath: string): DieuTimThay | null {
  const walk = (node: LegalNode, trail: string[]): DieuTimThay | null => {
    if (node.kind === "dieu") return node.path === dieuPath ? { node, nguCanh: trail } : null;
    const here =
      node.kind === "phan" || node.kind === "chuong" || node.kind === "muc" || node.kind === "tieu_muc"
        ? [...trail, node.heading ? `${node.label}. ${node.heading}` : node.label]
        : trail;
    for (const child of node.children) {
      const found = walk(child, here);
      if (found) return found;
    }
    return null;
  };
  return walk(root, []);
}

/** Path gốc của Điều chứa một path bất kỳ: "dieu-15.khoan-2.diem-a" -> "dieu-15". */
export function dieuPathOf(path: string): string | null {
  const first = path.split(".")[0] ?? "";
  return first.startsWith("dieu-") ? first : null;
}
