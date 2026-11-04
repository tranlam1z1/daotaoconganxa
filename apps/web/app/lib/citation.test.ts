import { describe, expect, test } from "bun:test";
import { pathToCitationPhrase } from "./citation";
import { dieuLabelFromPath } from "./tree";

describe("cụm viện dẫn theo path", () => {
  test("Điều thường giữ nguyên", () => {
    expect(pathToCitationPhrase("dieu-15.khoan-2.diem-a")).toBe("điểm a khoản 2 Điều 15");
    expect(dieuLabelFromPath("dieu-15")).toBe("Điều 15");
  });
  test("văn bản đánh số mục, không chia Điều", () => {
    expect(pathToCitationPhrase("dieu-c2-3.khoan-1.diem-2")).toBe("tiết 3.1.2 điểm 3.1 Mục 3 Chương II");
    expect(pathToCitationPhrase("dieu-m4.khoan-2")).toBe("điểm 4.2 Mục 4");
    expect(pathToCitationPhrase("dieu-c2-3.khoan-1.diem-2b")).toBe("ý b tiết 3.1.2 điểm 3.1 Mục 3 Chương II");
    expect(dieuLabelFromPath("dieu-c1-2")).toBe("Mục 2 Chương I");
  });
});
