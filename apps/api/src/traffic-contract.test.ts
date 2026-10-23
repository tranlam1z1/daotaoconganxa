import { describe, expect, test } from "bun:test";
import { penaltyInput, trafficDate, trafficLimiter, trafficQuery } from "./traffic-contract.ts";

describe("traffic input contracts", () => {
  test("rejects impossible calendar dates and unsafe pagination", () => {
    expect(trafficDate.safeParse("2026-02-29").success).toBe(false);
    expect(trafficDate.safeParse("2024-02-29").success).toBe(true);
    for (const page_size of ["0", "101", "1.5", "Infinity"])
      expect(trafficQuery.safeParse({ page_size }).success).toBe(false);
    expect(trafficQuery.parse({}).page_size).toBe(24);
  });
  test("requires explicit facts and coherent sanction ranges", () => {
    const p = {
      violation_code: "test",
      conditions: [],
      required_facts: ["vehicle"],
      fine_min: 100,
      fine_max: 200,
      point_deduction: null,
      suspension_months_min: null,
      suspension_months_max: null,
      additional_penalties: [],
      remedies: [],
      citation_urn: "vn:vbqppl:nd:168/2024/ND-CP#dieu-1",
      effective_from: "2026-01-01",
      effective_to: null,
    };
    expect(penaltyInput.safeParse(p).success).toBe(true);
    expect(penaltyInput.safeParse({ ...p, fine_max: 50 }).success).toBe(false);
    expect(penaltyInput.safeParse({ ...p, suspension_months_min: 3 }).success).toBe(false);
    expect(penaltyInput.safeParse({ ...p, effective_to: "2025-01-01" }).success).toBe(false);
  });
  test("limits independently and expires windows", () => {
    const allow = trafficLimiter(2, 100);
    expect(allow("a", 1)).toBe(true);
    expect(allow("a", 2)).toBe(true);
    expect(allow("a", 3)).toBe(false);
    expect(allow("b", 3)).toBe(true);
    expect(allow("a", 101)).toBe(true);
  });
});
