import { describe, expect, test } from "bun:test";
import { loadPenaltySource, textHash, validatePenaltySource } from "./penalty-source.ts";

describe("bộ mức phạt trích từ nguồn Chính phủ", () => {
  test("21 hành vi có căn cứ chính xác; điện thoại trừ 4 điểm, cồn mức cao tước GPLX", async () => {
    const { source } = await loadPenaltySource();
    expect(source.dong).toHaveLength(21);
    for (const code of ["oto-dien-thoai", "mt-dien-thoai"])
      expect(source.dong.find((x) => x.ma === code)!.tru_diem).toBe(4);
    expect(source.dong.find((x) => x.ma === "oto-con-muc-3")!.suspension_months).toEqual([22, 24]);
    expect(source.dong.find((x) => x.ma === "mt-den-do")!.can_cu).toEndWith("#dieu-7.khoan-7.diem-c");
  });
  test("đổi số tiền không được kế thừa duyệt; đổi danh sách cũng bị từ chối", async () => {
    const { source, review } = await loadPenaltySource();
    const text = JSON.stringify(source);
    expect(() => validatePenaltySource(text, review)).toThrow("đối chiếu lại");
    expect(() =>
      validatePenaltySource(text, {
        ...review,
        dataset_sha256: textHash(text),
        verified_codes: review.verified_codes.slice(1),
      }),
    ).toThrow("không khớp");
  });
  test("chặn căn cứ không tồn tại cả khi hash được cập nhật", async () => {
    const { source, review } = await loadPenaltySource();
    source.dong[0]!.can_cu = source.dong[0]!.can_cu.replace("diem-a", "diem-z");
    const text = JSON.stringify(source);
    expect(() => validatePenaltySource(text, { ...review, dataset_sha256: textHash(text) })).toThrow(
      "Căn cứ không khớp",
    );
  });
});
