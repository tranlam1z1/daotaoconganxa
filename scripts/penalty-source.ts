import { createHash } from "node:crypto";
import { join } from "node:path";
import { type DongMucPhat, kiemTraMucPhat } from "@qdpl/dao-tao";
import { z } from "zod";

export const PENALTY_URN = "vn:vbqppl:nd:168/2024/NĐ-CP";
export const textHash = (text: string) =>
  createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const datasetSchema = z.object({
  source_url: z.literal(
    "https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-168-2024-nd-cp-quy-dinh-xu-phat-vi-pham-hanh-chinh-ve-trat-tu-atgt-duong-bo-119241231164556785.htm",
  ),
  source_sha256: sha,
  signed_pdf_url: z.literal("https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/01/168-nd-cp.signed.pdf"),
  signed_pdf_sha256: sha,
  amendment_url: z.literal("https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-238-2026-nd-cp-469913.htm"),
  amendment_sha256: sha,
  amendment_check: z.string().min(30),
  provisions: z.record(z.string(), z.string().min(10)),
  dong: z
    .array(
      z.object({
        ma: z.string().min(3),
        xe: z.enum(["o_to", "mo_to"]),
        nhom: z.string(),
        hanh_vi: z.string().min(10),
        tu_khoa: z.array(z.string()),
        phat_tu: z.number().int().nonnegative(),
        phat_den: z.number().int().nonnegative(),
        tru_diem: z.number().int().min(0).max(12).nullable(),
        hinh_thuc_bo_sung: z.array(z.string()),
        can_cu: z.string(),
        hieu_luc_tu: z.literal("2025-01-01"),
        trang_thai: z.literal("cho_duyet"),
        toc_do_vuot: z
          .object({ tu: z.number(), den: z.number().nullable(), bien: z.enum(["[)", "[]", "(]", "()"]) })
          .optional(),
        suspension_months: z.tuple([z.number().int(), z.number().int()]).nullable(),
        conditions: z.array(z.string()).min(1),
        required_facts: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});
const reviewSchema = z.object({
  dataset_sha256: sha,
  source_sha256: sha,
  amendment_sha256: sha,
  reviewed_by: z.literal("codex:source-verification"),
  reviewed_on: z.string(),
  verified_codes: z.array(z.string()),
  scope: z.string().min(30),
});
export function validatePenaltySource(text: string, input: unknown) {
  const review = reviewSchema.parse(input);
  if (textHash(text) !== review.dataset_sha256) throw new Error("Dữ liệu đổi; phải đối chiếu lại.");
  const source = datasetSchema.parse(JSON.parse(text));
  if (source.source_sha256 !== review.source_sha256 || source.amendment_sha256 !== review.amendment_sha256)
    throw new Error("Nguồn đối chiếu không khớp.");
  const codes = source.dong.map((x) => x.ma);
  if (
    new Set(codes).size !== codes.length ||
    new Set(review.verified_codes).size !== codes.length ||
    review.verified_codes.length !== codes.length ||
    review.verified_codes.some((c) => !codes.includes(c))
  )
    throw new Error("Danh sách đã duyệt không khớp.");
  const errors = kiemTraMucPhat(source.dong.map((x) => ({ ...x, trang_thai: "da_duyet" })) as DongMucPhat[]);
  if (errors.length) throw new Error(JSON.stringify(errors));
  for (const row of source.dong) {
    const path = row.can_cu.slice(PENALTY_URN.length + 1);
    if (
      !row.can_cu.startsWith(`${PENALTY_URN}#`) ||
      !/^dieu-[67]\.khoan-\d+\.diem-[a-zđ]$/.test(path) ||
      !source.provisions[path] ||
      source.provisions[path].replace(/[;.\s]+$/g, "") !== row.hanh_vi.replace(/[;.\s]+$/g, "")
    )
      throw new Error(`Căn cứ không khớp: ${row.ma}`);
  }
  return { source, review };
}
export async function loadPenaltySource() {
  const dir = join(import.meta.dir, "../data/tra-cuu");
  return validatePenaltySource(
    await Bun.file(join(dir, "muc-phat-reviewed-source.json")).text(),
    await Bun.file(join(dir, "muc-phat-review.json")).json(),
  );
}
