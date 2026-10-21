/**
 * Đọc và áp dụng robots.txt theo REP (RFC 9309, bản rút gọn đủ dùng).
 * Quy tắc: chọn nhóm User-agent khớp cụ thể nhất; trong nhóm, luật có
 * pattern DÀI NHẤT thắng; hòa thì Allow thắng Disallow.
 */

export interface RobotsRule {
  allow: boolean;
  /** Pattern gốc, hỗ trợ ký tự đại diện `*` và neo cuối `$`. */
  pattern: string;
  re: RegExp;
  length: number;
}

export interface RobotsTxt {
  /** Nhóm luật theo user-agent (đã hạ chữ thường). */
  groups: Map<string, RobotsRule[]>;
  crawlDelay: Map<string, number>;
  sitemaps: string[];
  /** true khi không tải được robots.txt (mặc định cho phép, theo REP). */
  missing: boolean;
}

function patternToRegExp(pattern: string): RegExp {
  let src = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      src += ".*";
    } else if (c === "$" && i === pattern.length - 1) {
      src += "$";
    } else {
      src += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${src}`);
}

export function parseRobots(text: string): RobotsTxt {
  const groups = new Map<string, RobotsRule[]>();
  const crawlDelay = new Map<string, number>();
  const sitemaps: string[] = [];
  // Nhiều dòng User-agent liên tiếp tạo thành cùng một nhóm.
  let currentAgents: string[] = [];
  let expectingAgent = true;

  // Bỏ BOM (congbao.chinhphu.vn có BOM ở đầu robots.txt).
  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!expectingAgent) {
        currentAgents = [];
        expectingAgent = true;
      }
      currentAgents.push(value.toLowerCase());
      if (!groups.has(value.toLowerCase())) groups.set(value.toLowerCase(), []);
      continue;
    }
    if (key === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n)) for (const a of currentAgents) crawlDelay.set(a, n);
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    expectingAgent = false;
    if (!currentAgents.length) currentAgents = ["*"];
    // "Disallow:" rỗng nghĩa là cho phép tất cả -> bỏ qua luật.
    if (key === "disallow" && value === "") continue;
    const rule: RobotsRule = {
      allow: key === "allow",
      pattern: value,
      re: patternToRegExp(value),
      length: value.length,
    };
    for (const a of currentAgents) {
      const list = groups.get(a) ?? [];
      list.push(rule);
      groups.set(a, list);
    }
  }
  return { groups, crawlDelay, sitemaps, missing: false };
}

/** Chọn nhóm luật khớp user-agent: khớp token cụ thể trước, rồi "*". */
function rulesFor(robots: RobotsTxt, userAgent: string): RobotsRule[] {
  const ua = userAgent.toLowerCase();
  let best: { name: string; rules: RobotsRule[] } | undefined;
  for (const [name, rules] of robots.groups) {
    if (name === "*") continue;
    if (ua.includes(name) && (!best || name.length > best.name.length)) best = { name, rules };
  }
  if (best) return best.rules;
  return robots.groups.get("*") ?? [];
}

export function isAllowed(robots: RobotsTxt, userAgent: string, url: string): boolean {
  if (robots.missing) return true;
  const rules = rulesFor(robots, userAgent);
  if (!rules.length) return true;
  const u = new URL(url);
  const path = `${u.pathname}${u.search}`;
  let winner: RobotsRule | undefined;
  for (const r of rules) {
    if (!r.re.test(path)) continue;
    if (!winner || r.length > winner.length || (r.length === winner.length && r.allow)) winner = r;
  }
  return winner ? winner.allow : true;
}

export function crawlDelayFor(robots: RobotsTxt, userAgent: string): number | undefined {
  const ua = userAgent.toLowerCase();
  for (const [name, delay] of robots.crawlDelay) {
    if (name !== "*" && ua.includes(name)) return delay;
  }
  return robots.crawlDelay.get("*");
}

export const EMPTY_ROBOTS: RobotsTxt = {
  groups: new Map(),
  crawlDelay: new Map(),
  sitemaps: [],
  missing: true,
};
