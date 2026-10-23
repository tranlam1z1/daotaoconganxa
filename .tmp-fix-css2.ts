const duong = "apps/web/app/styles/app.css";
const raw = await Bun.file(duong).text();
const crlf = raw.includes("\r\n");
const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));

const iCmt = lines.findIndex((l) => l.includes("Hoạt ảnh biểu tượng, chỉ khi không bật giảm chuyển động"));
if (iCmt < 0) {
  console.log("MISS");
  process.exit(1);
}
// Từ dòng ghi chú đến trước "@keyframes ic-lac" là phần hỏng: thay bằng khối đúng.
const iKey = lines.findIndex((l) => l.startsWith("@keyframes ic-lac {"));
if (iKey < 0) {
  console.log("MISS key");
  process.exit(1);
}
const khoi = [
  "/*",
  " * Hoạt ảnh biểu tượng, chỉ khi không bật giảm chuyển động: .ic-lac chuông lắc một lần (thông báo mới).",
  " */",
  "@media (prefers-reduced-motion: no-preference) {",
  "  .ic-lac {",
  "    transform-origin: 50% 12%;",
  "    animation: ic-lac 0.9s ease-in-out 1;",
  "  }",
  "}",
  "",
];
lines.splice(iCmt, iKey - iCmt, ...khoi);
await Bun.write(duong, lines.join(crlf ? "\r\n" : "\n"));
console.log("ok");
