import { expect, test } from "bun:test";

import { buttonClass } from "../app/components/ui/Button";

test("nút mặc định không xuống dòng; nơi gọi xin whitespace-normal thì bỏ nowrap", () => {
  expect(buttonClass()).toContain("whitespace-nowrap");
  // cn chỉ nối lớp: còn cả hai lớp thì nowrap thắng theo thứ tự CSS, nhãn dài tràn khỏi khung.
  expect(buttonClass({ className: "whitespace-normal text-left" })).not.toContain("whitespace-nowrap");
});
