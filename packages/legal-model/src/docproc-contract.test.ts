/**
 * Hợp đồng của bước số hóa: Markdown do bước chuyển đổi sinh ra phải được
 * packages/legal-model parse đúng. Nếu hợp đồng vỡ, văn bản số hóa sẽ vào kho với
 * cấu trúc sai mà không có dấu hiệu nào báo lỗi.
 *
 * Tệp mẫu data/fixtures/docproc-output.md là đầu ra thật của bản Python cũ trên một PDF
 * 5 trang có: câu bị cắt qua trang, bảng cắt qua trang, công thức, header "CÔNG BÁO/Số"
 * lặp, số trang, khối "Nơi nhận". Bản Python đã ngưng dùng, nhưng tệp này được GIỮ NGUYÊN
 * làm mẫu chuẩn: Markdown do agent nộp qua công cụ MCP phải thỏa đúng những khẳng định
 * dưới đây (ke-hoach/05).
 */
import { describe, expect, test } from "bun:test";
import { nodeKey, parseDocument, serializeDocument, walk } from "./index.ts";

const md = await Bun.file(`${import.meta.dir}/../../../data/fixtures/docproc-output.md`).text();
const parsed = parseDocument(md);

describe("hợp đồng Markdown số hóa -> legal-model", () => {
  test("parse không sinh cảnh báo cấu trúc", () => {
    expect(parsed.warnings).toEqual([]);
  });

  test("điều, khoản, điểm liên tục", () => {
    const dieu: string[] = [];
    walk(parsed.root, (n) => {
      if (n.kind === "dieu") dieu.push(nodeKey(n));
    });
    expect(dieu).toEqual(["1", "2", "3", "4"]);

    let k2: any;
    walk(parsed.root, (n) => {
      if (n.path === "dieu-3.khoan-2") k2 = n;
    });
    // Điểm a→đ, trong đó điểm d bị cắt qua trang trong PDF gốc.
    expect(k2.children.filter((c: any) => c.kind === "diem").map(nodeKey)).toEqual(["a", "b", "c", "d", "đ"]);
  });

  test("điểm bị cắt qua trang là một nút liền, không bị tách đôi", () => {
    let d: any;
    walk(parsed.root, (n) => {
      if (n.path === "dieu-3.khoan-2.diem-d") d = n;
    });
    expect(d).toBeDefined();
    // Câu phải liền mạch, không có ký tự xuống dòng giữa chừng.
    expect(d.text).not.toContain("\n");
    expect(d.text.trim().endsWith(";") || d.text.trim().endsWith(".")).toBe(true);
  });

  test("bảng cắt qua trang được ghép thành một bảng, không lặp hàng tiêu đề", () => {
    const bang: any[] = [];
    walk(parsed.root, (n) => {
      if (n.kind === "bang") bang.push(n);
    });
    expect(bang.length).toBe(1);
    const lines = bang[0].text.split("\n").filter((l: string) => l.trim().startsWith("|"));
    // 1 hàng tiêu đề + 1 hàng phân cách + 7 hàng dữ liệu
    expect(lines.length).toBe(9);
    const headerCount = lines.filter((l: string) => l.includes("STT") && l.includes("Hạng mục")).length;
    expect(headerCount).toBe(1);
  });

  test("công thức được giữ dạng LaTeX", () => {
    let ct: any;
    walk(parsed.root, (n) => {
      if (n.kind === "cong_thuc") ct = n;
    });
    expect(ct).toBeDefined();
    expect(ct.text).toContain("$$");
    expect(ct.text).toContain("\\sum");
  });

  test("rác header và số trang bị loại, khối chữ ký được giữ", () => {
    expect(md).not.toContain("CÔNG BÁO/Số");
    let ky: any;
    walk(parsed.root, (n) => {
      if (n.kind === "chu_ky") ky = n;
    });
    expect(ky).toBeDefined();
    expect(ky.text).toContain("Nơi nhận");
  });

  test("khứ hồi parse -> serialize -> parse giữ nguyên cấu trúc", () => {
    const lai = parseDocument(serializeDocument(parsed.root));
    const a: string[] = [];
    const b: string[] = [];
    walk(parsed.root, (n) => {
      if (["dieu", "khoan", "diem"].includes(n.kind)) a.push(n.path);
    });
    walk(lai.root, (n) => {
      if (["dieu", "khoan", "diem"].includes(n.kind)) b.push(n.path);
    });
    expect(b).toEqual(a);
  });
});
