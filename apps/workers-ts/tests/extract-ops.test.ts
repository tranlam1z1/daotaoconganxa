import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AmendOp, consolidate, parseDocument } from "@qdpl/legal-model";
import {
  type ExtractContext,
  extractOpsFromMarkdown,
  extractQuoted,
  findEffectiveDate,
  newLabelFor,
  parseNewUnit,
  parseScopePaths,
  parseTargetRef,
  parseTargetRefs,
  splitArticles,
} from "../src/pipeline/extract-ops.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const FIXTURE_AMEND = readFileSync(join(ROOT, "data", "fixtures", "nd-mau-sua-doi.md"), "utf8");
const FIXTURE_BASE = readFileSync(join(ROOT, "data", "fixtures", "nd-mau-goc.md"), "utf8");

const CTX: ExtractContext = {
  amendingUrn: "vn:vbqppl:nd:150/2027/NĐ-CP",
  soKyHieu: "150/2027/NĐ-CP",
  title:
    "Sửa đổi, bổ sung một số điều của Nghị định số 100/2026/NĐ-CP ngày 20 tháng 01 năm 2026 " +
    "của Chính phủ quy định mẫu về quản lý hoạt động thử nghiệm",
  issuedDate: "2027-01-05",
};

describe("tách Điều / khoản lệnh (nhận biết ngoặc kép nhiều dòng)", () => {
  const arts = splitArticles(FIXTURE_AMEND);

  test("tách đúng 2 Điều", () => {
    expect(arts.map((a) => a.label)).toEqual(["Điều 1", "Điều 2"]);
  });

  test("Điều 1 có đúng 5 khoản lệnh (nội dung trong ngoặc kép không bị tách nhầm)", () => {
    expect(arts[0]!.commands.map((c) => c.key)).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("khối trích dẫn nhiều dòng nằm trọn trong khoản 3", () => {
    const quoted = extractQuoted(arts[0]!.commands[2]!);
    expect(quoted).toContain("Điều 3a. Điều chỉnh kế hoạch thử nghiệm");
    expect(quoted).toContain("2. Trình tự điều chỉnh thực hiện như trình tự lập kế hoạch.");
    expect(quoted!.split("\n")).toHaveLength(3);
  });

  test("ngày hiệu lực lấy từ Điều hiệu lực thi hành", () => {
    expect(findEffectiveDate(FIXTURE_AMEND)).toBe("2027-07-01");
  });
});

describe("nhận diện nút đích", () => {
  test("thứ tự tiếng Việt điểm -> khoản -> Điều", () => {
    expect(parseTargetRef("Bãi bỏ điểm c khoản 2 Điều 1")?.path).toBe("dieu-1.khoan-2.diem-c");
    expect(parseTargetRef("khoản 2 Điều 15")?.path).toBe("dieu-15.khoan-2");
    expect(parseTargetRef("Điều 12a")?.path).toBe("dieu-12a");
  });

  test("nhiều nút đích trong một lệnh", () => {
    expect(parseTargetRefs("Bãi bỏ Điều 20, Điều 21 và Điều 22").map((r) => r.path)).toEqual([
      "dieu-20",
      "dieu-21",
      "dieu-22",
    ]);
    expect(parseTargetRefs("Bãi bỏ khoản 3 và khoản 4 Điều 5").map((r) => r.path)).toEqual([
      "dieu-5.khoan-3",
      "dieu-5.khoan-4",
    ]);
  });

  test("nhãn nút mới", () => {
    expect(parseNewUnit("khoản 2a")).toEqual({ kind: "khoan", key: "2a" });
    expect(parseNewUnit("Điều 12a")).toEqual({ kind: "dieu", key: "12a" });
    expect(parseNewUnit("điểm d")).toEqual({ kind: "diem", key: "d" });
    expect(newLabelFor("khoan", "2a")).toBe("2a.");
    expect(newLabelFor("diem", "d")).toBe("d)");
    expect(newLabelFor("dieu", "12a")).toBe("Điều 12a");
  });

  test("phạm vi thay cụm từ", () => {
    expect(parseScopePaths('Thay thế cụm từ "A" bằng "B" tại Nghị định số 100/2026/NĐ-CP')).toEqual([]);
    expect(parseScopePaths('Thay thế cụm từ "A" bằng "B" tại Điều 3, Điều 5')).toEqual(["dieu-3", "dieu-5"]);
  });
});

describe("trích lệnh sửa đổi rule-based trên fixture", () => {
  const res = extractOpsFromMarkdown(FIXTURE_AMEND, CTX);

  test("không có cảnh báo", () => {
    expect(res.warnings).toEqual([]);
  });

  test("trích đúng 5 lệnh, đúng thứ tự", () => {
    expect(res.ops).toHaveLength(5);
    expect(res.ops.map((o) => o.op)).toEqual([
      "replace",
      "insert_after",
      "insert_after",
      "repeal",
      "replace_phrase",
    ]);
    expect(res.ops.map((o) => o.ordinal)).toEqual([0, 1, 2, 3, 4]);
  });

  test("mọi lệnh trỏ đúng văn bản bị sửa đổi và ngày hiệu lực", () => {
    for (const o of res.ops) {
      expect(o.targetDocUrn).toBe("vn:vbqppl:nd:100/2026/NĐ-CP");
      expect(o.effectiveFrom).toBe("2027-07-01");
    }
  });

  test("1) replace khoản 1 Điều 3", () => {
    const o = res.ops[0]!;
    expect(o.targetPath).toBe("dieu-3.khoan-1");
    expect(o.amendingLabel).toBe("khoản 1 Điều 1");
    expect(o.payload?.text).toBe(
      "1. Cơ quan chủ trì lập kế hoạch thử nghiệm và gửi lấy ý kiến các cơ quan có liên quan.",
    );
  });

  test("2) insert khoản 4 sau khoản 3 Điều 3", () => {
    const o = res.ops[1]!;
    expect(o.targetPath).toBe("dieu-3.khoan-3");
    expect(o.payload?.newKind).toBe("khoan");
    expect(o.payload?.newLabel).toBe("4.");
    expect(o.payload?.text).toStartWith("4. Kế hoạch thử nghiệm được công khai");
  });

  test("3) insert Điều 3a sau Điều 3 (nội dung nhiều dòng)", () => {
    const o = res.ops[2]!;
    expect(o.targetPath).toBe("dieu-3");
    expect(o.payload?.newKind).toBe("dieu");
    expect(o.payload?.newLabel).toBe("Điều 3a");
    expect(o.payload?.text).toContain("Điều 3a. Điều chỉnh kế hoạch thử nghiệm");
    expect(o.payload?.text).toContain("1. Kế hoạch thử nghiệm được điều chỉnh");
    expect(o.payload?.text).toContain("2. Trình tự điều chỉnh");
  });

  test("4) repeal điểm c khoản 2 Điều 1", () => {
    const o = res.ops[3]!;
    expect(o.targetPath).toBe("dieu-1.khoan-2.diem-c");
    expect(o.payload).toBeUndefined();
  });

  test("5) replace_phrase áp dụng toàn văn bản", () => {
    const o = res.ops[4]!;
    expect(o.targetPath).toBe("");
    expect(o.payload?.find).toBe("Bộ Thông tin và Truyền thông");
    expect(o.payload?.replace).toBe("Bộ Khoa học và Công nghệ");
    expect(o.payload?.scopePaths).toBeUndefined();
  });

  test("payload là OBJECT (không phải chuỗi) — điều kiện để consolidate() chấp nhận", () => {
    for (const o of res.ops) {
      if (!o.payload) continue;
      expect(typeof o.payload).toBe("object");
    }
    // Lệnh chèn bắt buộc có cả text lẫn newLabel, nếu không consolidate() từ chối.
    for (const o of res.ops.filter((x) => x.op === "insert_after" || x.op === "insert_before")) {
      expect(typeof o.payload?.text).toBe("string");
      expect(o.payload!.text!.length).toBeGreaterThan(0);
      expect(typeof o.payload?.newLabel).toBe("string");
      expect(o.payload!.newLabel!.length).toBeGreaterThan(0);
    }
  });
});

describe("lệnh trích ra áp dụng được bằng consolidate()", () => {
  test("không có xung đột và cây kết quả đúng", () => {
    const base = parseDocument(FIXTURE_BASE).root;
    const extracted = extractOpsFromMarkdown(FIXTURE_AMEND, CTX);
    const ops: AmendOp[] = extracted.ops.map((o, i) => ({
      id: `op-${i}`,
      amendingDocUrn: CTX.amendingUrn,
      amendingLabel: o.amendingLabel,
      targetDocUrn: o.targetDocUrn,
      targetPath: o.targetPath,
      op: o.op,
      ...(o.payload ? { payload: o.payload } : {}),
      effectiveFrom: o.effectiveFrom,
      ordinal: o.ordinal,
      extraction: "rule",
      confidence: o.confidence,
      reviewStatus: "approved",
    }));

    const res = consolidate(base, ops, "2027-07-01");
    expect(res.conflicts).toEqual([]);
    expect(res.applied).toHaveLength(5);

    const find = (path: string) => {
      let hit: any;
      const rec = (n: any) => {
        if (n.path === path) hit = n;
        for (const c of n.children) rec(c);
      };
      rec(res.root);
      return hit;
    };

    expect(find("dieu-3.khoan-1").text).toContain("gửi lấy ý kiến các cơ quan có liên quan");
    expect(find("dieu-3.khoan-1").status).toBe("amended");
    expect(find("dieu-3.khoan-4")).toBeDefined();
    expect(find("dieu-3.khoan-4").status).toBe("added");
    expect(find("dieu-3a")).toBeDefined();
    expect(find("dieu-3a").heading).toBe("Điều chỉnh kế hoạch thử nghiệm");
    expect(find("dieu-3a.khoan-2")).toBeDefined();
    expect(find("dieu-1.khoan-2.diem-c").status).toBe("repealed");
  });
});

describe("các mẫu câu khác ở ke-hoach/06 §2.2", () => {
  const ctx: ExtractContext = {
    amendingUrn: "vn:vbqppl:nd:200/2027/NĐ-CP",
    soKyHieu: "200/2027/NĐ-CP",
    title: "Sửa đổi, bổ sung một số điều của Nghị định số 50/2020/NĐ-CP",
    effectiveFrom: "2027-01-01",
  };

  test("bổ sung khoản vào sau khoản (insert_after cấp khoản)", () => {
    const md = [
      "Điều 1. Sửa đổi, bổ sung một số điều của Nghị định số 50/2020/NĐ-CP",
      "1. Bổ sung khoản 2a vào sau khoản 2 Điều 15 như sau:",
      '"2a. Nội dung bổ sung."',
      "",
      "Điều 2. Hiệu lực thi hành",
      "Nghị định này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2027.",
    ].join("\n");
    const r = extractOpsFromMarkdown(md, ctx);
    expect(r.ops).toHaveLength(1);
    expect(r.ops[0]!.op).toBe("insert_after");
    expect(r.ops[0]!.targetPath).toBe("dieu-15.khoan-2");
    expect(r.ops[0]!.payload?.newLabel).toBe("2a.");
  });

  test("bãi bỏ cấp văn bản", () => {
    const md = [
      "Điều 2. Điều khoản thi hành",
      "1. Bãi bỏ Nghị định số 50/2020/NĐ-CP ngày 01 tháng 5 năm 2020 của Chính phủ.",
      "2. Nghị định này có hiệu lực thi hành từ ngày 01 tháng 01 năm 2027.",
    ].join("\n");
    const r = extractOpsFromMarkdown(md, ctx);
    expect(r.ops).toHaveLength(1);
    expect(r.ops[0]!.op).toBe("repeal");
    expect(r.ops[0]!.targetPath).toBe("");
    expect(r.ops[0]!.targetDocUrn).toBe("vn:vbqppl:nd:50/2020/NĐ-CP");
  });

  test("ngưng hiệu lực có khoảng thời gian", () => {
    const md = [
      "Điều 1. Sửa đổi, bổ sung một số điều của Nghị định số 50/2020/NĐ-CP",
      "1. Ngưng hiệu lực khoản 3 Điều 7 từ ngày 01 tháng 02 năm 2027 đến ngày 31 tháng 12 năm 2027.",
    ].join("\n");
    const r = extractOpsFromMarkdown(md, ctx);
    expect(r.ops[0]!.op).toBe("suspend");
    expect(r.ops[0]!.targetPath).toBe("dieu-7.khoan-3");
    expect(r.ops[0]!.effectiveFrom).toBe("2027-02-01");
    expect(r.ops[0]!.effectiveTo).toBe("2027-12-31");
  });

  test("sửa tên điều (rename)", () => {
    const md = [
      "Điều 1. Sửa đổi, bổ sung một số điều của Nghị định số 50/2020/NĐ-CP",
      "1. Sửa đổi tên Điều 5 như sau:",
      '"Điều 5. Trình tự, thủ tục phê duyệt"',
    ].join("\n");
    const r = extractOpsFromMarkdown(md, ctx);
    expect(r.ops[0]!.op).toBe("rename");
    expect(r.ops[0]!.targetPath).toBe("dieu-5");
    expect(r.ops[0]!.payload?.heading).toBe("Trình tự, thủ tục phê duyệt");
  });

  test("văn bản thường không sinh lệnh và không sinh cảnh báo rác", () => {
    const r = extractOpsFromMarkdown(FIXTURE_BASE, {
      amendingUrn: "vn:vbqppl:nd:100/2026/NĐ-CP",
      soKyHieu: "100/2026/NĐ-CP",
      title: "Quy định mẫu về quản lý hoạt động thử nghiệm",
    });
    expect(r.ops).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});
