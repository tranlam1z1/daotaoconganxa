import { describe, expect, test } from "bun:test";
import { docConcurrency, khoaEnvConcurrency, QUEUES } from "./index.ts";

describe("concurrency theo hàng đợi", () => {
  test("mặc định thận trọng cho các giai đoạn nặng", () => {
    const c = docConcurrency({});
    expect(c[QUEUES.sohoa]).toBe(1);
    expect(c[QUEUES.convert]).toBe(1);
    expect(c[QUEUES.index]).toBe(1);
  });

  test("BULL_CONCURRENCY ghi đè mọi hàng đợi, biến riêng ghi đè một hàng đợi", () => {
    expect(khoaEnvConcurrency(QUEUES.extractOps)).toBe("BULL_CONCURRENCY_EXTRACT_OPS");
    const c = docConcurrency({ BULL_CONCURRENCY: "3", BULL_CONCURRENCY_SOHOA: "1" });
    expect(c[QUEUES.parse]).toBe(3);
    expect(c[QUEUES.sohoa]).toBe(1);
  });
});

describe("giới hạn tốc độ theo hàng đợi", () => {
  test("mặc định có giới hạn cho các bước ghi CSDL nặng", async () => {
    const { docRateLimits, QUEUES } = await import("./index.ts");
    const r = docRateLimits({});
    expect(r[QUEUES.index]).toEqual({ max: 1, duration: 10_000 });
    expect(r[QUEUES.parse]).toEqual({ max: 1, duration: 5000 });
  });

  test("biến môi trường ghi đè hoặc bỏ giới hạn; giá trị sai thì giữ mặc định", async () => {
    const { docRateLimits, khoaEnvRate, QUEUES } = await import("./index.ts");
    expect(khoaEnvRate(QUEUES.extractOps)).toBe("BULL_RATE_EXTRACT_OPS");
    const r = docRateLimits({ BULL_RATE_INDEX: "2/30000", BULL_RATE_PARSE: "0", BULL_RATE_RELATIONS: "abc" });
    expect(r[QUEUES.index]).toEqual({ max: 2, duration: 30_000 });
    expect(r[QUEUES.parse]).toBeUndefined();
    expect(r[QUEUES.relations]).toEqual({ max: 1, duration: 3000 });
  });
});
