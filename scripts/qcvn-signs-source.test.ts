import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { hashSource, loadReviewedSigns, validateSourceReview } from "./qcvn-signs-source.ts";

describe("bộ biển báo đối chiếu QCVN chính thức", () => {
  test("31 biển đủ năm nhóm, mọi ảnh PNG khớp SHA-256 và dưới 20KB", async () => {
    const { source } = await loadReviewedSigns();
    expect(source.bien).toHaveLength(31);
    expect(new Set(source.bien.map((b) => b.nhom)).size).toBe(5);
    expect(source.bien.some((b) => b.ma === "W.211")).toBe(true);
    expect(source.bien.some((b) => b.ma === "W.211a")).toBe(false);
    expect(source.bien.find((b) => b.ma === "S.501")!.y_nghia).toContain("chiều dài");
  });
  test("từ chối dùng phiếu duyệt cũ khi nội dung đổi", async () => {
    const { source, review } = await loadReviewedSigns();
    const bytes = new TextEncoder().encode(JSON.stringify({ ...source, effective_from: "2025-01-01" }));
    expect(() => validateSourceReview(bytes, review)).toThrow("duyệt lại");
  });
  test("từ chối phiếu thiếu mã dù dấu dữ liệu đúng", async () => {
    const { review, dir } = await loadReviewedSigns();
    const bytes = await Bun.file(join(dir, "qcvn-41-2024-source.json")).bytes();
    expect(hashSource(bytes)).toBe(review.dataset_sha256);
    expect(() =>
      validateSourceReview(bytes, { ...review, verified_codes: review.verified_codes.slice(1) }),
    ).toThrow("không khớp");
  });
});
