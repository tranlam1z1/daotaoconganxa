/** Đăng ký adapter nguồn. Thứ tự primary_source: Công báo > vbpl.vn > cổng bộ. */
import { congbao } from "./congbao.ts";
import { fixture } from "./fixture.ts";
import type { SourceAdapter } from "./types.ts";
import { vanbanChinhPhu } from "./vanban-chinhphu.ts";
import { vbpl } from "./vbpl.ts";

export { CongbaoAdapter, congbao } from "./congbao.ts";
export { FixtureAdapter, fixture, fixtureDir, parseFixtureMeta } from "./fixture.ts";
export * from "./types.ts";
export { VanBanChinhPhuAdapter, vanbanChinhPhu } from "./vanban-chinhphu.ts";
export { VbplAdapter, vbpl } from "./vbpl.ts";

export const ADAPTERS: SourceAdapter[] = [congbao, vbpl, vanbanChinhPhu, fixture];

export function getAdapter(id: string): SourceAdapter {
  const a = ADAPTERS.find((x) => x.id === id);
  if (!a) {
    throw new Error(`Không có adapter "${id}". Hỗ trợ: ${ADAPTERS.map((x) => x.id).join(", ")}`);
  }
  return a;
}

/** Chọn nguồn chính khi một văn bản có mặt ở nhiều nguồn (ke-hoach/04 §3). */
export function pickPrimarySource(sources: string[]): string | undefined {
  const ranked = sources
    .map((s) => ({ s, p: ADAPTERS.find((a) => a.id === s)?.priority ?? 99 }))
    .sort((a, b) => a.p - b.p);
  return ranked[0]?.s;
}
