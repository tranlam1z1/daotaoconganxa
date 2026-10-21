import { describe, expect, test } from "bun:test";
import { alignDocuments, alignmentMap, foldVietnamese } from "./align.ts";
import { parseDocument } from "./parser.ts";

/** Văn bản cũ. */
const OLD = `Điều 1. Phạm vi điều chỉnh
1. Nghị định này quy định về quản lý hoạt động thử nghiệm sử dụng ngân sách nhà nước.

Điều 2. Giải thích từ ngữ
1. Hoạt động thử nghiệm là hoạt động triển khai có kiểm soát.

Điều 3. Lập kế hoạch thử nghiệm
1. Cơ quan chủ trì lập kế hoạch thử nghiệm.
2. Kế hoạch gồm mục tiêu, phạm vi, thời gian, kinh phí, tiêu chí đánh giá.

Điều 4. Thẩm định kế hoạch
1. Cơ quan chuyên môn thẩm định trong thời hạn 15 ngày.

Điều 5. Chế độ báo cáo cũ
1. Báo cáo gửi hằng quý bằng văn bản giấy.
`;

/** Văn bản thay thế: đảo thứ tự, đổi tên một điều, bỏ một điều, thêm một điều. */
const NEW = `Điều 1. Phạm vi điều chỉnh
1. Nghị định này quy định về quản lý hoạt động thử nghiệm sử dụng ngân sách nhà nước và nguồn hợp pháp khác.

Điều 2. Giải thích từ ngữ
1. Hoạt động thử nghiệm là hoạt động triển khai có kiểm soát.

Điều 3. Thẩm định kế hoạch thử nghiệm
1. Cơ quan chuyên môn thẩm định trong thời hạn 10 ngày.

Điều 4. Lập kế hoạch thử nghiệm
1. Cơ quan chủ trì lập kế hoạch thử nghiệm.
2. Kế hoạch gồm mục tiêu, phạm vi, thời gian, kinh phí, tiêu chí đánh giá.

Điều 5. Cơ chế thử nghiệm có kiểm soát đối với công nghệ mới
1. Tổ chức được đăng ký thử nghiệm công nghệ mới bằng kinh phí tự có.
`;

describe("đối chiếu văn bản cũ và văn bản thay thế", () => {
  const a = parseDocument(OLD).root;
  const b = parseDocument(NEW).root;
  const pairs = alignDocuments(a, b);
  const map = alignmentMap(pairs);

  test("bỏ dấu tiếng Việt", () => {
    expect(foldVietnamese("Thẩm định kế hoạch")).toBe("tham dinh ke hoach");
    expect(foldVietnamese("Đầu tư công nghệ")).toBe("dau tu cong nghe");
  });

  test("điều giữ nguyên tiêu đề được ghép đúng", () => {
    expect(map.get("dieu-1")).toBe("dieu-1");
    expect(map.get("dieu-2")).toBe("dieu-2");
  });

  test("điều bị đổi vị trí vẫn ghép đúng theo nội dung", () => {
    // Lập kế hoạch: Điều 3 cũ -> Điều 4 mới; Thẩm định: Điều 4 cũ -> Điều 3 mới
    expect(map.get("dieu-3")).toBe("dieu-4");
    expect(map.get("dieu-4")).toBe("dieu-3");
  });

  test("điều bị bỏ được đánh dấu 'bo'", () => {
    const p = pairs.find((x) => x.fromPath === "dieu-5");
    expect(p?.kind).toBe("bo");
    expect(p?.toPath).toBe("");
  });

  test("điều mới được đánh dấu 'moi'", () => {
    const p = pairs.find((x) => x.toPath === "dieu-5" && !x.fromPath);
    expect(p?.kind).toBe("moi");
    expect(p?.toHeading).toContain("Cơ chế thử nghiệm");
  });

  test("ghép một-một, không có điều nào bị dùng lại", () => {
    const froms = pairs.filter((p) => p.fromPath).map((p) => p.fromPath);
    const tos = pairs.filter((p) => p.toPath).map((p) => p.toPath);
    expect(new Set(froms).size).toBe(froms.length);
    expect(new Set(tos).size).toBe(tos.length);
  });

  test("mọi điều của cả hai văn bản đều xuất hiện đúng một lần", () => {
    expect(pairs.filter((p) => p.fromPath).length).toBe(5);
    expect(pairs.filter((p) => p.toPath).length).toBe(5);
  });

  test("điểm số nằm trong khoảng hợp lệ và cặp khớp có điểm cao hơn cặp nghi ngờ", () => {
    for (const p of pairs) expect(p.score).toBeGreaterThanOrEqual(0);
    const khop = pairs.filter((p) => p.kind === "khop");
    const nghi = pairs.filter((p) => p.kind === "nghi_ngo");
    expect(khop.length).toBeGreaterThan(0);
    for (const k of khop) for (const n of nghi) expect(k.score).toBeGreaterThan(n.score);
  });
});
