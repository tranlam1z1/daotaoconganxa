import { z } from "zod";

export const trafficDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  }, "Ngày không tồn tại");
export const trafficQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).max(200).optional(),
  vehicle: z.enum(["o_to", "mo_to"]).optional(),
  legal_document: z
    .string()
    .regex(/^vn:[^#\s]+$/)
    .max(200)
    .optional(),
  as_of: trafficDate.default(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
  ),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(24),
});
const texts = z.array(z.string().trim().min(1).max(1000)).max(30);
export const penaltyInput = z
  .object({
    violation_code: z.string().trim().min(1).max(80),
    conditions: texts,
    required_facts: texts,
    fine_min: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    fine_max: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    point_deduction: z.number().int().min(0).max(12).nullable(),
    suspension_months_min: z.number().int().min(0).max(120).nullable(),
    suspension_months_max: z.number().int().min(0).max(120).nullable(),
    additional_penalties: texts,
    remedies: texts,
    citation_urn: z
      .string()
      .regex(/^vn:[^\s#]+#\S+$/)
      .max(500),
    effective_from: trafficDate,
    effective_to: trafficDate.nullable(),
  })
  .refine((p) => p.fine_min <= p.fine_max, "Khoảng tiền phạt không hợp lệ")
  .refine((p) => !p.effective_to || p.effective_to > p.effective_from, "Khoảng hiệu lực không hợp lệ")
  .refine(
    (p) =>
      (p.suspension_months_min === null && p.suspension_months_max === null) ||
      (p.suspension_months_min !== null &&
        p.suspension_months_max !== null &&
        p.suspension_months_min <= p.suspension_months_max),
    "Khoảng tước GPLX không hợp lệ",
  );

/** Bounded process-local limiter. Deploy a shared proxy limiter for multiple API replicas. */
export function trafficLimiter(limit = 120, windowMs = 60000) {
  const buckets = new Map<string, { count: number; end: number }>();
  return (key: string, now = Date.now()) => {
    for (const [k, v] of buckets) if (v.end <= now) buckets.delete(k);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 10000) return false;
      bucket = { count: 0, end: now + windowMs };
      buckets.set(key, bucket);
    }
    return ++bucket.count <= limit;
  };
}
