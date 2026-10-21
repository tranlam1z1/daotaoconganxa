/** Đọc nội dung hướng dẫn và tệp khóa từ đĩa (phía script). Web nạp cùng dữ liệu qua Vite. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DUONG_DAN_ANH,
  DUONG_DAN_PDF,
  dungKho,
  type Khoa,
  type KhoHuongDan,
  type MetaBai,
  type MucLuc,
} from "../../apps/web/app/lib/huong-dan.ts";
import { GOC } from "./nguon.ts";

export const THU_MUC_NOI_DUNG = join(GOC, "content/huong-dan");
export const THU_MUC_BAI = join(THU_MUC_NOI_DUNG, "bai");
export const TEP_MUC_LUC = join(THU_MUC_NOI_DUNG, "muc-luc.json");
export const TEP_KHOA = join(THU_MUC_NOI_DUNG, "khoa.json");
export const THU_MUC_CONG_KHAI = join(GOC, "apps/web/public");
export const THU_MUC_ANH = join(THU_MUC_CONG_KHAI, DUONG_DAN_ANH.slice(1));
export const TEP_PDF = join(THU_MUC_CONG_KHAI, DUONG_DAN_PDF.slice(1));

export function docJson<T>(tep: string): T {
  return JSON.parse(readFileSync(tep, "utf8")) as T;
}

export function ghiJson(tep: string, duLieu: unknown): void {
  writeFileSync(tep, `${JSON.stringify(duLieu, null, 2)}\n`);
}

export interface KhoTrenDia {
  kho: KhoHuongDan;
  /** id của mọi bài có tệp trong content/huong-dan/bai, kể cả bài chưa đưa vào mục lục. */
  baiCoTep: string[];
}

export function docKho(): KhoTrenDia {
  const mucLuc = docJson<MucLuc>(TEP_MUC_LUC);
  const meta: Record<string, MetaBai> = {};
  const markdown: Record<string, string> = {};
  const baiCoTep = new Set<string>();
  for (const tep of existsSync(THU_MUC_BAI) ? readdirSync(THU_MUC_BAI) : []) {
    const m = /^(.+)\.(md|json)$/.exec(tep);
    if (!m) continue;
    baiCoTep.add(m[1]!);
    if (m[2] === "json") meta[m[1]!] = docJson<MetaBai>(join(THU_MUC_BAI, tep));
    else markdown[m[1]!] = readFileSync(join(THU_MUC_BAI, tep), "utf8");
  }
  return { kho: dungKho(mucLuc, meta, markdown), baiCoTep: [...baiCoTep].sort() };
}

export function docKhoa(): Khoa {
  return existsSync(TEP_KHOA) ? docJson<Khoa>(TEP_KHOA) : { phien_ban: 1, bai: {}, pdf: null };
}

export function ghiKhoa(khoa: Khoa): void {
  const bai = Object.fromEntries(Object.entries(khoa.bai).sort(([a], [b]) => a.localeCompare(b)));
  ghiJson(TEP_KHOA, { ...khoa, bai });
}
