/**
 * Engine hợp nhất theo thời điểm: áp dụng các lệnh sửa đổi lên cây gốc.
 * Thuần hàm, không đột biến cây đầu vào. Xem ke-hoach/06 §3.
 */

import { docTypeByCode } from "./hierarchy.ts";
import { parseDocument } from "./parser.ts";
import type { AmendOp, AmendOpKind, LegalNode, NodeKind } from "./types.ts";
import { parseUrn } from "./urn.ts";

export interface ConsolidateResult {
  root: LegalNode;
  applied: AmendOp[];
  conflicts: { op: AmendOp; reason: string }[];
}

function clone(node: LegalNode): LegalNode {
  return { ...node, children: node.children.map(clone) };
}

function findByPath(root: LegalNode, path: string): { node: LegalNode; parent: LegalNode } | undefined {
  let found: { node: LegalNode; parent: LegalNode } | undefined;
  const rec = (n: LegalNode, parent: LegalNode) => {
    if (n.path === path) {
      found = { node: n, parent };
      return;
    }
    for (const c of n.children) rec(c, n);
  };
  for (const c of root.children) rec(c, root);
  return found;
}

/** Ngày dạng YYYY-MM-DD; so sánh chuỗi là đủ. */
function inForce(op: AmendOp, asOf: string): boolean {
  if (op.effectiveFrom > asOf) return false;
  if (op.effectiveTo && op.effectiveTo <= asOf) return false;
  return true;
}

/** Tên văn bản sửa đổi để đưa vào chú thích: "Nghị định số 150/2027/NĐ-CP". */
function amendingDocName(urn: string): string {
  const p = parseUrn(urn);
  if (!p) return urn;
  const name = docTypeByCode(p.docType)?.name ?? "Văn bản";
  return `${name} số ${p.soKyHieu}`;
}

function noteFor(op: AmendOp): string {
  const where = op.amendingLabel ? `${op.amendingLabel} của ` : "";
  const doc = amendingDocName(op.amendingDocUrn);
  const eff = op.effectiveFrom;
  switch (op.op) {
    case "replace":
      return `Nội dung này được sửa đổi, bổ sung theo quy định tại ${where}${doc}, có hiệu lực kể từ ngày ${fmt(eff)}.`;
    case "rename":
      return `Tên điều này được sửa đổi theo quy định tại ${where}${doc}, có hiệu lực kể từ ngày ${fmt(eff)}.`;
    case "insert_after":
    case "insert_before":
    case "append_child":
      return `Nội dung này được bổ sung theo quy định tại ${where}${doc}, có hiệu lực kể từ ngày ${fmt(eff)}.`;
    case "repeal":
    case "delete":
      return `Nội dung này được bãi bỏ theo quy định tại ${where}${doc}, có hiệu lực kể từ ngày ${fmt(eff)}.`;
    case "suspend":
      return `Nội dung này bị ngưng hiệu lực theo quy định tại ${where}${doc}, kể từ ngày ${fmt(eff)}${op.effectiveTo ? ` đến ngày ${fmt(op.effectiveTo)}` : ""}.`;
    case "replace_phrase":
      return `Cụm từ "${op.payload?.find}" được thay bằng "${op.payload?.replace}" theo quy định tại ${where}${doc}, có hiệu lực kể từ ngày ${fmt(eff)}.`;
    default:
      return `Được sửa đổi theo ${doc}.`;
  }
}

function fmt(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** Chuyển Markdown của nội dung mới thành nút con (dùng cho replace/insert). */
function parseFragment(
  text: string,
  fallbackKind: NodeKind,
  label: string,
  path: string,
  fullPath: string,
): LegalNode {
  const parsed = parseDocument(text);
  const first = parsed.root.children[0];
  if (first && first.kind === fallbackKind) {
    return reroot(first, path, fullPath);
  }
  return {
    path,
    fullPath,
    kind: fallbackKind,
    label,
    text: text.trim(),
    children: [],
    status: "active",
  };
}

function reroot(node: LegalNode, path: string, fullPath: string): LegalNode {
  const oldPrefix = node.path;
  const rec = (n: LegalNode): LegalNode => ({
    ...n,
    path: n.path === oldPrefix ? path : n.path.replace(new RegExp(`^${escapeRe(oldPrefix)}`), path),
    fullPath:
      n.fullPath === node.fullPath
        ? fullPath
        : n.fullPath.replace(new RegExp(`^${escapeRe(node.fullPath)}`), fullPath),
    children: n.children.map(rec),
  });
  return rec(node);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyPhrase(node: LegalNode, find: string, replace: string): LegalNode {
  const rec = (n: LegalNode): LegalNode => ({
    ...n,
    text: n.text.split(find).join(replace),
    heading: n.heading ? n.heading.split(find).join(replace) : n.heading,
    status: n.text.includes(find) || n.heading?.includes(find) ? "amended" : n.status,
    children: n.children.map(rec),
  });
  return rec(node);
}

export function consolidate(base: LegalNode, ops: AmendOp[], asOf: string): ConsolidateResult {
  const root = clone(base);
  const applied: AmendOp[] = [];
  const conflicts: { op: AmendOp; reason: string }[] = [];

  const active = ops
    .filter((o) => o.reviewStatus === "approved")
    .filter((o) => inForce(o, asOf))
    .sort((a, b) =>
      a.effectiveFrom === b.effectiveFrom
        ? a.ordinal - b.ordinal
        : a.effectiveFrom < b.effectiveFrom
          ? -1
          : 1,
    );

  for (const op of active) {
    if (op.op === "replace_phrase") {
      const find = op.payload?.find;
      const replace = op.payload?.replace ?? "";
      if (!find) {
        conflicts.push({ op, reason: "Thiếu cụm từ cần thay" });
        continue;
      }
      const scopes = op.payload?.scopePaths?.length ? op.payload.scopePaths : [""];
      let touched = 0;
      for (const sp of scopes) {
        if (!sp) {
          const next = applyPhrase(root, find, replace);
          root.children = next.children;
          touched += 1;
        } else {
          const hit = findByPath(root, sp);
          if (!hit) {
            conflicts.push({ op, reason: `Không tìm thấy nút ${sp}` });
            continue;
          }
          const replaced = applyPhrase(hit.node, find, replace);
          replaced.note = noteFor(op);
          const idx = hit.parent.children.indexOf(hit.node);
          hit.parent.children[idx] = replaced;
          touched += 1;
        }
      }
      if (touched) applied.push(op);
      continue;
    }

    if (!op.targetPath) {
      // Lệnh cấp văn bản (bãi bỏ toàn bộ, ngưng hiệu lực toàn bộ).
      if (op.op === "repeal" || op.op === "delete") {
        for (const c of root.children) markAll(c, "repealed", noteFor(op));
        applied.push(op);
      } else if (op.op === "suspend") {
        for (const c of root.children) markAll(c, "suspended", noteFor(op));
        applied.push(op);
      } else {
        conflicts.push({ op, reason: "Lệnh cấp văn bản không hợp lệ" });
      }
      continue;
    }

    const hit = findByPath(root, op.targetPath);
    if (!hit && op.op !== "append_child") {
      conflicts.push({ op, reason: `Không tìm thấy nút đích ${op.targetPath}` });
      continue;
    }

    // Lệnh thiếu dữ liệu phải bị chặn, không được âm thầm tạo nút rỗng.
    const needsText: AmendOpKind[] = ["replace", "insert_after", "insert_before", "append_child"];
    if (needsText.includes(op.op)) {
      if (typeof op.payload !== "object" || op.payload === null) {
        conflicts.push({ op, reason: `Lệnh ${op.op} thiếu payload (kiểu ${typeof op.payload})` });
        continue;
      }
      if (!op.payload.text?.trim()) {
        conflicts.push({ op, reason: `Lệnh ${op.op} thiếu nội dung mới (payload.text)` });
        continue;
      }
      if (op.op !== "replace" && !op.payload.newLabel?.trim()) {
        conflicts.push({ op, reason: `Lệnh ${op.op} thiếu nhãn nút mới (payload.newLabel)` });
        continue;
      }
    }

    switch (op.op) {
      case "replace": {
        const { node, parent } = hit!;
        const text = op.payload?.text ?? "";
        const fresh = parseFragment(text, node.kind, node.label, node.path, node.fullPath);
        fresh.status = "amended";
        fresh.note = noteFor(op);
        fresh.label = fresh.label || node.label;
        const idx = parent.children.indexOf(node);
        parent.children[idx] = fresh;
        applied.push(op);
        break;
      }
      case "rename": {
        const { node } = hit!;
        node.heading = op.payload?.heading ?? op.payload?.text ?? node.heading;
        node.status = "amended";
        node.note = noteFor(op);
        applied.push(op);
        break;
      }
      case "repeal":
      case "delete": {
        const { node } = hit!;
        markAll(node, "repealed", noteFor(op));
        applied.push(op);
        break;
      }
      case "suspend": {
        const { node } = hit!;
        markAll(node, "suspended", noteFor(op));
        applied.push(op);
        break;
      }
      case "insert_after":
      case "insert_before": {
        const { node, parent } = hit!;
        const newLabel = op.payload?.newLabel ?? "";
        const kind = op.payload?.newKind ?? node.kind;
        const key = keyFromLabel(newLabel, kind);
        const segPrefix = node.path.split(".").slice(0, -1).join(".");
        const seg = `${segOf(kind)}-${key}`;
        const path = segPrefix ? `${segPrefix}.${seg}` : seg;
        const fullPrefix = node.fullPath.split(".").slice(0, -1).join(".");
        const fullPath = fullPrefix ? `${fullPrefix}.${seg}` : seg;
        const fresh = parseFragment(op.payload?.text ?? "", kind, newLabel, path, fullPath);
        fresh.status = "added";
        fresh.note = noteFor(op);
        fresh.label = newLabel || fresh.label;
        const idx = parent.children.indexOf(node);
        parent.children.splice(op.op === "insert_after" ? idx + 1 : idx, 0, fresh);
        applied.push(op);
        break;
      }
      case "append_child": {
        const target = hit ?? findByPath(root, op.targetPath);
        if (!target) {
          conflicts.push({ op, reason: `Không tìm thấy nút cha ${op.targetPath}` });
          break;
        }
        const kind = op.payload?.newKind ?? "khoan";
        const newLabel = op.payload?.newLabel ?? "";
        const key = keyFromLabel(newLabel, kind);
        const seg = `${segOf(kind)}-${key}`;
        const path = `${target.node.path}.${seg}`;
        const fullPath = `${target.node.fullPath}.${seg}`;
        const fresh = parseFragment(op.payload?.text ?? "", kind, newLabel, path, fullPath);
        fresh.status = "added";
        fresh.note = noteFor(op);
        target.node.children.push(fresh);
        applied.push(op);
        break;
      }
      default:
        conflicts.push({ op, reason: `Chưa hỗ trợ lệnh ${op.op}` });
    }
  }

  return { root, applied, conflicts };
}

function markAll(node: LegalNode, status: LegalNode["status"], note: string) {
  node.status = status;
  node.note = note;
  for (const c of node.children) markAll(c, status, note);
}

function segOf(kind: NodeKind): string {
  return kind === "tieu_muc"
    ? "tieu-muc"
    : kind === "cong_thuc"
      ? "cong-thuc"
      : kind === "phu_luc"
        ? "phu-luc"
        : kind.replace(/_/g, "-");
}

function keyFromLabel(label: string, kind: NodeKind): string {
  const s = label.trim();
  if (kind === "dieu") return (/Điều\s+(\d+[a-zđ]?\d?)/i.exec(s)?.[1] ?? s).toLowerCase();
  if (kind === "khoan") return (/^(\d+[a-zđ]?)/.exec(s)?.[1] ?? s).toLowerCase();
  if (kind === "diem") return (/^([a-zđ]\d?)/.exec(s)?.[1] ?? s).toLowerCase();
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Các mốc thời gian mà nội dung văn bản thay đổi (để vật hóa phiên bản). */
export function changeDates(ops: AmendOp[]): string[] {
  const set = new Set<string>();
  for (const o of ops) {
    if (o.reviewStatus !== "approved") continue;
    set.add(o.effectiveFrom);
    if (o.effectiveTo) set.add(o.effectiveTo);
  }
  return [...set].sort();
}

/** Trạng thái văn bản suy ra từ trạng thái các nút. */
export function deriveDocStatus(
  root: LegalNode,
  meta: { effectiveFrom?: string; effectiveTo?: string },
  asOf: string,
):
  | "chua_hieu_luc"
  | "con_hieu_luc"
  | "het_hieu_luc_mot_phan"
  | "het_hieu_luc"
  | "ngung_hieu_luc"
  | "khong_xac_dinh" {
  if (meta.effectiveTo && meta.effectiveTo <= asOf) return "het_hieu_luc";
  if (meta.effectiveFrom && meta.effectiveFrom > asOf) return "chua_hieu_luc";
  let repealed = 0;
  let total = 0;
  let suspended = 0;
  const rec = (n: LegalNode) => {
    if (["dieu", "khoan", "diem"].includes(n.kind)) {
      total += 1;
      if (n.status === "repealed") repealed += 1;
      if (n.status === "suspended") suspended += 1;
    }
    for (const c of n.children) rec(c);
  };
  rec(root);
  if (total === 0) return "khong_xac_dinh";
  if (repealed === total) return "het_hieu_luc";
  if (suspended === total) return "ngung_hieu_luc";
  if (repealed > 0) return "het_hieu_luc_mot_phan";
  return "con_hieu_luc";
}
