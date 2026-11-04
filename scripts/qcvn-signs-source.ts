import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const QCVN_SOURCE_URL = "https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/11/51-bgtvt-kem.pdf";
export const QCVN_URN = "vn:doc:qcvn:41/2024/BGTVT";
export const hashSource = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.object({
  source_url: z.literal(QCVN_SOURCE_URL),
  source_sha256: sha,
  effective_from: z.literal("2025-01-01"),
  bien: z
    .array(
      z.object({
        ma: z.string().regex(/^[PWRIS]\.\d{3}[a-z]?$/),
        nhom: z.enum(["cam", "nguy_hiem", "hieu_lenh", "chi_dan", "phu"]),
        ten: z.string().min(2).max(300),
        y_nghia: z.string().min(20).max(15000),
        anh: z.string().regex(/^[PWRIS]\.\d{3}[a-z]?\.qcvn-2024\.png$/),
        muc: z.string().regex(/^[BCDEF]\.\d+[a-z]?$/),
        trang_anh: z.number().int().positive(),
        xref_anh: z.number().int().positive(),
        sha256_anh: sha,
        nguyen_van_muc: z.string().min(20),
        can_cu: z.string(),
        trang_thai: z.literal("cho_duyet"),
      }),
    )
    .min(1),
});
const reviewSchema = z.object({
  status: z.literal("source_verified"),
  reviewed_by: z.string().min(3).max(150),
  reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_sha256: sha,
  dataset_sha256: sha,
  verified_codes: z.array(z.string()).min(1),
  scope: z.string().min(10),
  evidence: z.array(z.string()).min(1),
});

/** A changed dataset cannot inherit the approval of the previous file. */
export function validateSourceReview(bytes: Uint8Array, reviewInput: unknown) {
  const review = reviewSchema.parse(reviewInput);
  const source = sourceSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  if (hashSource(bytes) !== review.dataset_sha256 || source.source_sha256 !== review.source_sha256)
    throw new Error("Dữ liệu hoặc PDF nguồn đã đổi; phải đối chiếu và duyệt lại.");
  const codes = new Set(source.bien.map((b) => b.ma));
  if (
    codes.size !== source.bien.length ||
    new Set(review.verified_codes).size !== review.verified_codes.length ||
    codes.size !== review.verified_codes.length ||
    review.verified_codes.some((c) => !codes.has(c))
  )
    throw new Error("Danh sách mã đã đối chiếu không khớp bộ dữ liệu.");
  for (const b of source.bien) {
    const expected = `${QCVN_URN}#phu-luc-${b.muc[0]!.toLowerCase()}.muc-${b.muc.slice(2)}`;
    if (b.can_cu !== expected || b.anh !== `${b.ma}.qcvn-2024.png` || !b.nguyen_van_muc.startsWith(b.muc))
      throw new Error(`Căn cứ/ảnh không khớp: ${b.ma}`);
  }
  return { source, review };
}

export async function loadReviewedSigns() {
  const dir = join(import.meta.dir, "..", "data", "bien-bao");
  const bytes = await readFile(join(dir, "qcvn-41-2024-source.json"));
  const result = validateSourceReview(
    bytes,
    JSON.parse(await readFile(join(dir, "qcvn-41-2024-review.json"), "utf8")),
  );
  for (const b of result.source.bien) {
    const image = await readFile(join(dir, "anh-qcvn-2024", b.anh));
    if (
      hashSource(image) !== b.sha256_anh ||
      image.length > 20480 ||
      !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error(`Ảnh nguồn hỏng, bị thay hoặc quá 20 KB: ${b.ma}`);
  }
  return { ...result, dir };
}
