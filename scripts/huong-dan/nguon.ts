/**
 * Nguồn giao diện của từng bài hướng dẫn và chữ ký giao diện dùng cho bộ bảo vệ.
 *
 * Mục tiêu: khi một trang có thêm, bớt hoặc đổi chức năng, bộ bảo vệ biết đúng bài nào phải chụp
 * lại, không phải phát sinh lại toàn bộ hướng dẫn. Vì vậy chữ ký không băm nguyên văn mã nguồn —
 * sửa comment, đổi lớp CSS hay tách hàm không làm hình minh hoạ lỗi thời. Chữ ký chỉ gồm các
 * thành phần người dùng nhìn thấy và thao tác được: nút, liên kết, ô nhập, biểu mẫu, tiêu đề, thành
 * phần con được dùng, cùng nhãn tĩnh của chúng.
 *
 * Nguồn của một bài = tệp route + các route khung bao ngoài (layout) + các tệp trong components/
 * và routes/ mà chúng import (bắc cầu) + `nguon_them` khai trong bài. Tệp lib/ không tính: đó là
 * logic, không phải bề mặt giao diện.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { MetaBai } from "../../apps/web/app/lib/huong-dan.ts";

export const GOC = resolve(import.meta.dir, "../..");
export const THU_MUC_APP = join(GOC, "apps/web/app");

export function bam(noiDung: string | Uint8Array): string {
  return createHash("sha256").update(noiDung).digest("hex");
}

interface NutRoute {
  file: string;
  path?: string;
  index?: boolean;
  children?: NutRoute[];
}

export interface RouteTrang {
  /** Dạng `routes/search.tsx`, như khai trong apps/web/app/routes.ts. */
  file: string;
  duongDan: string;
  /** Các route khung bao ngoài, từ ngoài vào trong. */
  toTien: string[];
  laKhung: boolean;
  coGiaoDien: boolean;
}

export async function docCayRoute(): Promise<RouteTrang[]> {
  const mod = await import(join(THU_MUC_APP, "routes.ts"));
  const cay = (await mod.default) as NutRoute[];
  const ds: RouteTrang[] = [];
  const duyet = (nut: NutRoute[], toTien: string[], tienTo: string) => {
    for (const n of nut) {
      const duongDan = n.index ? tienTo || "/" : `${tienTo}/${n.path ?? ""}`.replace(/\/+/g, "/");
      const tep = join(THU_MUC_APP, n.file);
      const ma = existsSync(tep) ? readFileSync(tep, "utf8") : "";
      ds.push({
        file: n.file,
        duongDan,
        toTien,
        laKhung: Boolean(n.children?.length),
        coGiaoDien: /export\s+default\s/.test(ma),
      });
      if (n.children) duyet(n.children, [...toTien, n.file], duongDan);
    }
  };
  duyet(cay, [], "");
  return ds;
}

const IMPORT_RE = /\b(import|export)\s+(type\s+)?(?:[^"';]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g;

function giaiDuongDan(tuTep: string, dich: string): string | null {
  const goc = resolve(dirname(join(THU_MUC_APP, tuTep)), dich);
  for (const ung of [goc, `${goc}.tsx`, `${goc}.ts`, join(goc, "index.tsx"), join(goc, "index.ts")]) {
    if (existsSync(ung) && !ung.endsWith("/") && /\.(tsx?|jsx?)$/.test(ung))
      return relative(THU_MUC_APP, ung);
  }
  return null;
}

/** Tệp giao diện mà một bài mô tả, tính từ apps/web/app, đã sắp xếp. */
export function tepGiaoDienCuaBai(meta: MetaBai, cay: RouteTrang[]): string[] {
  const hat = new Set<string>(meta.nguon_them ?? []);
  for (const r of meta.routes) {
    hat.add(r);
    for (const cha of cay.find((x) => x.file === r)?.toTien ?? []) hat.add(cha);
  }
  const da = new Set<string>();
  const cho = [...hat];
  while (cho.length) {
    const tep = cho.pop()!;
    if (da.has(tep)) continue;
    const tuyetDoi = join(THU_MUC_APP, tep);
    if (!existsSync(tuyetDoi)) continue;
    da.add(tep);
    const ma = readFileSync(tuyetDoi, "utf8");
    for (const m of ma.matchAll(IMPORT_RE)) {
      if (m[2]) continue; // import type: không có gì hiển thị
      const dich = giaiDuongDan(tep, m[3]!);
      if (dich && /^(components|routes)\//.test(dich) && !dich.includes("+types")) cho.push(dich);
    }
  }
  return [...da].sort();
}

/* ------------------------------------------------------------------ */
/* Đặc điểm giao diện                                                  */
/* ------------------------------------------------------------------ */

const THE_GHI_NHAN = new Set([
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "form",
  "details",
  "summary",
  "dialog",
  "fieldset",
  "legend",
  "h1",
  "h2",
  "h3",
]);

/** Thành phần của react-router mang nghĩa giống thẻ HTML tương ứng. */
const THANH_PHAN_DIEU_HUONG: Record<string, string> = { Link: "a", NavLink: "a", Form: "form" };

const THUOC_TINH_GHI_NHAN = [
  "type",
  "name",
  "role",
  "aria-label",
  "placeholder",
  "title",
  "to",
  "href",
  "action",
  "method",
];

interface TheJsx {
  ten: string;
  thuocTinh: Map<string, string>;
  chu: string;
}

function boComment(ma: string): string {
  return ma
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function docThuocTinh(doan: string): Map<string, string> {
  const kq = new Map<string, string>();
  const re =
    /([A-Za-z_][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*`([^`$]*)`\s*\}|(\{))/g;
  for (const m of doan.matchAll(re)) {
    const giaTri = m[2] ?? m[3] ?? m[4] ?? m[5];
    if (!kq.has(m[1]!)) kq.set(m[1]!, giaTri !== undefined ? giaTri.replace(/\s+/g, " ").trim() : "*");
  }
  return kq;
}

/** Quét thẻ JSX mở trong mã TSX. Đủ chính xác cho mã đã qua Biome định dạng. */
export function quetTheJsx(maNguon: string): TheJsx[] {
  const ma = boComment(maNguon);
  const ds: TheJsx[] = [];
  const re = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  let m: RegExpExecArray | null = re.exec(ma);
  while (m) {
    const truoc = ma[m.index - 1] ?? "";
    // Ký tự liền trước là chữ/số/dấu đóng thì đây là generic TypeScript hoặc phép so sánh.
    if (/[\w$.)\]]/.test(truoc)) {
      m = re.exec(ma);
      continue;
    }
    let i = m.index + m[0].length;
    let sau = 0;
    let nhay: string | null = null;
    for (; i < ma.length; i++) {
      const c = ma[i]!;
      if (nhay) {
        if (c === "\\") i++;
        else if (c === nhay) nhay = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") nhay = c;
      else if (c === "{") sau++;
      else if (c === "}") sau--;
      else if (c === ">" && sau === 0) break;
    }
    const doanThuocTinh = ma.slice(m.index + m[0].length, i);
    const tuDong = doanThuocTinh.trimEnd().endsWith("/");
    let chu = "";
    if (!tuDong) {
      const sauThe = ma.slice(i + 1, i + 200);
      chu = (sauThe.split(/[<{]/, 1)[0] ?? "").replace(/\s+/g, " ").trim();
    }
    ds.push({ ten: m[1]!, thuocTinh: docThuocTinh(doanThuocTinh), chu });
    re.lastIndex = i + 1;
    m = re.exec(ma);
  }
  return ds;
}

/** Tập đặc điểm giao diện của một tệp, đã sắp xếp, mỗi đặc điểm một chuỗi đọc được. */
export function dacDiemGiaoDien(maNguon: string): string[] {
  const kq = new Set<string>();
  if (/export\s+(async\s+)?function\s+action\b/.test(maNguon)) kq.add("action (trang nhận biểu mẫu)");
  for (const the of quetTheJsx(maNguon)) {
    let ten = the.ten;
    if (/^[A-Z]/.test(ten)) {
      const tuongUng = THANH_PHAN_DIEU_HUONG[ten];
      if (!tuongUng) {
        if (!ten.includes(".") && ten !== "Fragment") kq.add(`<${ten}>`);
        continue;
      }
      ten = tuongUng;
    }
    if (!THE_GHI_NHAN.has(ten)) continue;
    const phan = [ten];
    for (const k of THUOC_TINH_GHI_NHAN) {
      const v = the.thuocTinh.get(k);
      if (v) phan.push(`${k}=${v}`);
    }
    if (the.chu) phan.push(`"${the.chu.slice(0, 80)}"`);
    kq.add(phan.join(" "));
  }
  return [...kq].sort();
}

export interface ChuKyGiaoDien {
  chu_ky: string;
  dac_diem: Record<string, string[]>;
}

export function chuKyGiaoDien(dsTep: string[]): ChuKyGiaoDien {
  const dac_diem: Record<string, string[]> = {};
  for (const tep of dsTep) {
    dac_diem[tep] = dacDiemGiaoDien(readFileSync(join(THU_MUC_APP, tep), "utf8"));
  }
  return { chu_ky: bam(JSON.stringify(dac_diem)), dac_diem };
}

/** Đặc điểm thêm / bớt giữa hai lần, dạng `tệp: đặc điểm`. */
export function soSanhDacDiem(
  cu: Record<string, string[]>,
  moi: Record<string, string[]>,
): { them: string[]; bot: string[] } {
  const phang = (d: Record<string, string[]>) =>
    new Set(Object.entries(d).flatMap(([tep, ds]) => ds.map((x) => `${tep}: ${x}`)));
  const a = phang(cu);
  const b = phang(moi);
  return { them: [...b].filter((x) => !a.has(x)), bot: [...a].filter((x) => !b.has(x)) };
}
