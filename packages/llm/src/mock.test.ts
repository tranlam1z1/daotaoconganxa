import { expect, test } from "bun:test";

import { khoiNguCanh } from "./mock";

test("khoiNguCanh bỏ câu lệnh chốt đứng sau ngữ cảnh", () => {
  const prompt = [
    "NGỮ CẢNH — nguyên văn các điều khoản:",
    "### vn:vbqppl:nd:45/2026/NĐ-CP#dieu-2\nĐiều 2 — Giải thích từ ngữ\nTrong Nghị định này, các từ ngữ dưới đây được hiểu như sau:",
    // Điều chỉ có tiêu đề, nội dung nằm ở các khoản: trước đây nuốt câu lệnh chốt làm nội dung.
    "### vn:vbqppl:nd:45/2026/NĐ-CP#dieu-4\nĐiều 4 — Chi phí đầu tư của dự án\n",
    "Soạn 8 câu hỏi, không câu nào trùng ý với mục CÂU ĐÃ CÓ.",
  ].join("\n\n");
  const khoi = khoiNguCanh(prompt);
  expect(khoi).toHaveLength(2);
  expect(khoi.join("\n")).not.toContain("Soạn 8 câu hỏi");
  expect(khoi[1]?.trim().split("\n")).toHaveLength(2);
});
