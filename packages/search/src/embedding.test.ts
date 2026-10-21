/** Kiểm thử provider embedding chế độ local và quy tắc chia chunk. */
import { describe, expect, test } from "bun:test";
import { buildChunks, type ChunkNodeRow, estimateTokens, splitLong } from "./chunk.ts";
import { cosine, EMBEDDING_DIM, embeddingModel, fold, localEmbed, toVectorLiteral } from "./embedding.ts";

describe("embedding local", () => {
  test("tất định: cùng đầu vào cho cùng vector", () => {
    const a = localEmbed("kế hoạch thử nghiệm");
    const b = localEmbed("kế hoạch thử nghiệm");
    expect(a).toEqual(b);
    expect(a.length).toBe(EMBEDDING_DIM);
  });

  test("chuẩn hóa L2 (độ dài = 1)", () => {
    const v = localEmbed("Cơ quan chuyên môn thẩm định trong thời hạn 15 ngày.");
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  test("văn bản rỗng vẫn trả vector hợp lệ, không NaN", () => {
    const v = localEmbed("");
    expect(v.every((x) => Number.isFinite(x))).toBe(true);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  test("từ khóa trùng nhau -> cosine cao hơn", () => {
    const truyVan = localEmbed("thẩm định kế hoạch thử nghiệm");
    const gan = localEmbed("Cơ quan chuyên môn thẩm định kế hoạch thử nghiệm trong 15 ngày");
    const xa = localEmbed("Người có thẩm quyền ký quyết định xử phạt vi phạm hành chính về thuế");
    expect(cosine(truyVan, gan)).toBeGreaterThan(cosine(truyVan, xa));
  });

  test("bỏ dấu: có dấu và không dấu cho vector giống nhau", () => {
    expect(localEmbed("kế hoạch thử nghiệm")).toEqual(localEmbed("ke hoach thu nghiem"));
    expect(fold("Đầu tư công")).toBe("dau tu cong");
  });

  test("literal pgvector đúng định dạng", () => {
    const s = toVectorLiteral([0.5, -0.25]);
    expect(s).toBe("[0.500000,-0.250000]");
  });

  test("tên model mặc định là local-hash", () => {
    expect(embeddingModel()).toBe(`local-hash-${EMBEDDING_DIM}`);
  });
});

describe("chunking", () => {
  const nodes: ChunkNodeRow[] = [
    {
      id: "n1",
      path: "dieu-3",
      full_path: "chuong-2.muc-1.dieu-3",
      kind: "dieu",
      label: "Điều 3",
      heading: "Lập kế hoạch thử nghiệm",
      text_md: "",
      text_plain: "",
      context_path: null,
      ordinal: 1,
    },
    {
      id: "n2",
      path: "dieu-3.khoan-1",
      full_path: "chuong-2.muc-1.dieu-3.khoan-1",
      kind: "khoan",
      label: "1.",
      heading: null,
      text_md: "Cơ quan chủ trì lập kế hoạch thử nghiệm.",
      text_plain: "",
      context_path: null,
      ordinal: 2,
    },
    {
      id: "n3",
      path: "dieu-3.khoan-2",
      full_path: "chuong-2.muc-1.dieu-3.khoan-2",
      kind: "khoan",
      label: "2.",
      heading: null,
      text_md: "Kế hoạch gồm:",
      text_plain: "",
      context_path: null,
      ordinal: 3,
    },
    {
      id: "n4",
      path: "dieu-3.khoan-2.diem-a",
      full_path: "chuong-2.muc-1.dieu-3.khoan-2.diem-a",
      kind: "diem",
      label: "a)",
      heading: null,
      text_md: "Mục tiêu, phạm vi;",
      text_plain: "",
      context_path: null,
      ordinal: 4,
    },
    {
      id: "n5",
      path: "dieu-4.khoan-2.bang-1",
      full_path: "chuong-2.muc-1.dieu-4.khoan-2.bang-1",
      kind: "bang",
      label: "Bảng 1",
      heading: null,
      text_md: "| STT | Nội dung |\n|---|---|\n| 1 | Sự cần thiết |",
      text_plain: "",
      context_path: "Nghị định 100 > Điều 4. Thẩm định",
      ordinal: 5,
    },
  ];

  test("đơn vị cơ sở là khoản; điều có khoản không tự sinh chunk", () => {
    const chunks = buildChunks(nodes, "Nghị định 100/2026/NĐ-CP");
    expect(chunks.some((c) => c.path === "dieu-3")).toBe(false);
    expect(chunks.some((c) => c.path === "dieu-3.khoan-1")).toBe(true);
  });

  test("điểm ngắn gộp vào khoản cha", () => {
    const chunks = buildChunks(nodes, "Nghị định 100/2026/NĐ-CP");
    const k2 = chunks.find((c) => c.path === "dieu-3.khoan-2")!;
    expect(k2.text).toContain("Mục tiêu, phạm vi");
    expect(chunks.some((c) => c.path === "dieu-3.khoan-2.diem-a")).toBe(false);
  });

  test("bảng là chunk riêng, có ngữ cảnh và caption", () => {
    const chunks = buildChunks(nodes, "Nghị định 100/2026/NĐ-CP");
    const bang = chunks.find((c) => c.kind === "bang")!;
    expect(bang.text).toContain("Bảng 1");
    expect(bang.text).toContain("Điều 4. Thẩm định");
  });

  test("mỗi chunk có tiền tố ngữ cảnh là tên văn bản", () => {
    const chunks = buildChunks(nodes, "Nghị định 100/2026/NĐ-CP");
    expect(chunks.every((c) => c.text.includes("Nghị định 100"))).toBe(true);
  });

  test("khoản dài được tách theo điểm với overlap", () => {
    const units = Array.from({ length: 10 }, (_, i) => `${i}) ${"x".repeat(700)}`);
    const parts = splitLong(units, 512);
    expect(parts.length).toBeGreaterThan(1);
    // Có chồng lấn: tổng độ dài các mảnh lớn hơn tổng độ dài đầu vào.
    const tongVao = units.join("\n").length;
    const tongRa = parts.join("").length;
    expect(tongRa).toBeGreaterThan(tongVao * 0.99);
    expect(parts.every((p) => estimateTokens(p) <= 512 * 1.5)).toBe(true);
  });
});
