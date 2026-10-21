/** Kho prompt có phiên bản, đọc từ thư mục prompts/ ở gốc repo. */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..", "prompts");
const cache = new Map<string, { version: string; system: string; user: string }>();

export interface PromptFile {
  version: string;
  system: string;
  user: string;
}

/** Đọc prompt dạng Markdown có frontmatter: version, và hai phần ## SYSTEM / ## USER. */
export function loadPrompt(name: string): PromptFile {
  const hit = cache.get(name);
  if (hit) return hit;
  // Git trên Windows có thể lấy tệp về với CRLF; chuẩn hóa để frontmatter và các dấu mốc dòng khớp.
  const raw = readFileSync(join(ROOT, `${name}.md`), "utf8").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  const version = fm ? (/version:\s*(\S+)/.exec(fm[1]!)?.[1] ?? "1") : "1";
  const body = fm ? raw.slice(fm[0].length) : raw;
  const sysIdx = body.indexOf("## SYSTEM");
  const usrIdx = body.indexOf("## USER");
  const system = sysIdx >= 0 ? body.slice(sysIdx + 9, usrIdx > 0 ? usrIdx : undefined).trim() : "";
  const user = usrIdx >= 0 ? body.slice(usrIdx + 7).trim() : body.trim();
  const out = { version, system, user };
  cache.set(name, out);
  return out;
}

/** Thay biến {{ten}} trong prompt. */
export function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
}
