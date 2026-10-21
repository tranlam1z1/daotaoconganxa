/**
 * Công báo CHUYỂN HƯỚNG số trang vượt quá tổng về trang 1 (kiểm chứng 08/9/2026, danh mục
 * quyết định 627 trang: trang 628+ trả về nội dung trang 1). Worker phát hiện chạy mỗi trang
 * một job nên adapter phải tự dừng — nếu không, chuỗi phân trang chạy tới chặn trên 2000 trang.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CongbaoAdapter, listUrl } from "../src/crawler/adapters/congbao.ts";
import type { FetchResult } from "../src/crawler/fetcher.ts";

const HTML_TRANG_1 = readFileSync(
  join(import.meta.dir, "..", "test-fixtures", "congbao-list-nghi-dinh.html"),
  "utf8",
);

/** HTTP giả: mọi trang > 268 chuyển hướng về trang 1 (URL trả về là URL trang 1). */
function httpGia() {
  const yeuCau: string[] = [];
  return {
    yeuCau,
    async fetch(url: string): Promise<FetchResult> {
      yeuCau.push(url);
      const trang = Number(/trang-(\d+)\.htm/.exec(url)?.[1] ?? 1);
      const urlThat = trang > 268 ? listUrl("nghi-dinh", 1) : url;
      const bytes = new TextEncoder().encode(HTML_TRANG_1);
      return {
        url: urlThat,
        status: 200,
        ok: true,
        bytes,
        text: () => HTML_TRANG_1,
      } as unknown as FetchResult;
    },
  };
}

describe("phân trang danh mục Công báo", () => {
  test("trang trong tổng thì đọc bình thường", async () => {
    const http = httpGia();
    const adapter = new CongbaoAdapter(http as never);
    // Fixture là một trang danh mục có 3 mục; trang 268 là trang cuối nên không đọc sang trang 269.
    const ds = await adapter.discover({ type: "nghi-dinh", limit: 10, page: 268 });
    expect(ds.length).toBe(3);
    expect(http.yeuCau).toHaveLength(1);
  });

  test("trang vượt tổng (bị chuyển hướng về trang 1) thì trả về rỗng, không đọc thêm trang nào", async () => {
    const http = httpGia();
    const adapter = new CongbaoAdapter(http as never);
    const ds = await adapter.discover({ type: "nghi-dinh", limit: 10, page: 1455 });
    expect(ds).toEqual([]);
    expect(http.yeuCau).toHaveLength(1);
  });
});
