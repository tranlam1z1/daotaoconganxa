import { expect, test } from "bun:test";
import { thuocTinhCookie } from "../app/lib/auth.server";

test("cookie phiên có Secure khi proxy báo HTTPS, không có khi chạy http ở máy dev", () => {
  const yeuCau = (headers?: Record<string, string>) => new Request("http://web:3000/dang-nhap", { headers });
  expect(thuocTinhCookie(yeuCau({ "x-forwarded-proto": "https" }))).toContain("; Secure");
  expect(thuocTinhCookie(new Request("https://hocluat.example/dang-nhap"))).toContain("; Secure");
  expect(thuocTinhCookie(yeuCau())).not.toContain("Secure");
});
