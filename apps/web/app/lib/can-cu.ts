/**
 * Ô chọn căn cứ (components/quan-tri/OCanCu.tsx): rút cây cấu trúc văn bản thành mục lục gọn
 * Điều, khoản, điểm để người soạn bấm chọn, không phải gõ URN.
 */
import type { DocStatus, LegalNode, NodeStatus } from "./types";

/** Đường dẫn route tài nguyên: `?q=` tìm văn bản, `?urn=` lấy mục lục. */
export const DUONG_CAN_CU = "/quan-tri/can-cu";

export interface VanBanTimThay {
  urn: string;
  soKyHieu: string;
  title: string;
  status: DocStatus;
  coNoiDung: boolean;
}

export interface NutCanCu {
  path: string;
  label: string;
  /** Đầu nội dung, để nhận ra khoản, điểm vốn không có tiêu đề. */
  tom: string;
  status: NodeStatus;
}

export interface KhoanCanCu extends NutCanCu {
  diem: NutCanCu[];
}

export interface DieuCanCu {
  path: string;
  label: string;
  heading: string | null;
  status: NodeStatus;
  /** Phần, chương, mục chứa điều, ví dụ "Chương II. Vi phạm quy tắc giao thông". */
  nhom: string | null;
  khoan: KhoanCanCu[];
}

const NHOM: LegalNode["kind"][] = ["phan", "chuong", "muc", "tieu_muc"];

function tenNut(n: LegalNode): string {
  return n.heading ? `${n.label}. ${n.heading}` : n.label;
}

/** Bỏ ký hiệu Markdown, gộp khoảng trắng, cắt còn `toiDa` ký tự. */
export function tomTat(md: string, toiDa = 100): string {
  const s = md
    .replace(/[*_`#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > toiDa ? `${s.slice(0, toiDa - 1).trimEnd()}…` : s;
}

const nutCanCu = (n: LegalNode): NutCanCu => ({
  path: n.path,
  label: n.label,
  tom: tomTat(n.text),
  status: n.status,
});

/** Mọi điều của văn bản theo thứ tự, mỗi điều kèm các khoản có đánh số, mỗi khoản kèm các điểm. */
export function rutMucLuc(root: LegalNode): DieuCanCu[] {
  const ra: DieuCanCu[] = [];
  const duyet = (n: LegalNode, nhom: string[]) => {
    if (n.kind === "dieu") {
      ra.push({
        path: n.path,
        label: n.label,
        heading: n.heading ?? null,
        status: n.status,
        nhom: nhom.length ? nhom.join(" › ") : null,
        khoan: n.children
          .filter((k) => k.kind === "khoan" && !k.implicit && k.path)
          .map((k) => ({
            ...nutCanCu(k),
            diem: k.children.filter((d) => d.kind === "diem" && d.path).map(nutCanCu),
          })),
      });
      return;
    }
    const nhomCon = NHOM.includes(n.kind) ? [...nhom, tenNut(n)] : nhom;
    for (const c of n.children) duyet(c, nhomCon);
  };
  for (const c of root.children) duyet(c, []);
  return ra;
}

/** "1." → "Khoản 1", "a)" → "Điểm a". */
export function tenKhoanDiem(loai: "Khoản" | "Điểm", label: string): string {
  return `${loai} ${label.replace(/[.)]\s*$/, "")}`;
}
