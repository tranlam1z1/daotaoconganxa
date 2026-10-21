import { describe, expect, test } from "bun:test";
import { changeDates, consolidate, deriveDocStatus } from "./consolidate.ts";
import { diffTrees } from "./diff.ts";
import { nodeKey, parseDocument, walk } from "./parser.ts";
import { serializeDocument } from "./serialize.ts";
import type { AmendOp } from "./types.ts";

const md = await Bun.file(`${import.meta.dir}/../../../data/fixtures/nd-mau-goc.md`).text();
const base = parseDocument(md).root;

const AMENDER = "vn:vbqppl:nd:150/2027/NĐ-CP";
const TARGET = "vn:vbqppl:nd:100/2026/NĐ-CP";

function op(o: Partial<AmendOp> & Pick<AmendOp, "op" | "targetPath" | "ordinal">): AmendOp {
  return {
    id: `op-${o.ordinal}`,
    amendingDocUrn: AMENDER,
    amendingLabel: `khoản ${o.ordinal} Điều 1`,
    targetDocUrn: TARGET,
    effectiveFrom: "2027-07-01",
    extraction: "rule",
    confidence: 1,
    reviewStatus: "approved",
    ...o,
  } as AmendOp;
}

const OPS: AmendOp[] = [
  op({
    op: "replace",
    targetPath: "dieu-3.khoan-1",
    ordinal: 1,
    payload: {
      text: "1. Cơ quan chủ trì lập kế hoạch thử nghiệm và gửi lấy ý kiến các cơ quan có liên quan.",
    },
  }),
  op({
    op: "insert_after",
    targetPath: "dieu-3.khoan-3",
    ordinal: 2,
    payload: {
      newLabel: "4.",
      newKind: "khoan",
      text: "4. Kế hoạch thử nghiệm được công khai trên cổng thông tin điện tử của cơ quan chủ trì.",
    },
  }),
  op({
    op: "insert_after",
    targetPath: "dieu-3",
    ordinal: 3,
    payload: {
      newLabel: "Điều 3a",
      newKind: "dieu",
      text: "Điều 3a. Điều chỉnh kế hoạch thử nghiệm\n1. Kế hoạch thử nghiệm được điều chỉnh khi có thay đổi về mục tiêu hoặc kinh phí.\n2. Trình tự điều chỉnh thực hiện như trình tự lập kế hoạch.",
    },
  }),
  op({ op: "repeal", targetPath: "dieu-1.khoan-2.diem-c", ordinal: 4 }),
  op({
    op: "replace_phrase",
    targetPath: "",
    ordinal: 5,
    payload: { find: "Bộ Khoa học và Công nghệ", replace: "Bộ Khoa học và Công nghệ (mới)" },
  }),
];

describe("hợp nhất theo thời điểm", () => {
  test("trước ngày hiệu lực: không áp dụng lệnh nào", () => {
    const r = consolidate(base, OPS, "2027-06-30");
    expect(r.applied.length).toBe(0);
    expect(r.conflicts.length).toBe(0);
  });

  test("từ ngày hiệu lực: áp dụng đủ 5 lệnh", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    expect(r.applied.length).toBe(5);
    expect(r.conflicts).toEqual([]);
  });

  test("replace đổi nội dung khoản và gắn chú thích", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    let k: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-3.khoan-1") k = n;
    });
    expect(k.text).toContain("gửi lấy ý kiến các cơ quan có liên quan");
    expect(k.status).toBe("amended");
    expect(k.note).toContain(
      "được sửa đổi, bổ sung theo quy định tại khoản 1 Điều 1 của Nghị định số 150/2027/NĐ-CP",
    );
    expect(k.note).toContain("có hiệu lực kể từ ngày 01/07/2027");
  });

  test("chèn khoản 4 đúng vị trí sau khoản 3", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    let d3: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-3") d3 = n;
    });
    const keys = d3.children.filter((c: any) => c.kind === "khoan").map(nodeKey);
    expect(keys).toEqual(["1", "2", "3", "4"]);
    const k4 = d3.children.find((c: any) => nodeKey(c) === "4");
    expect(k4.status).toBe("added");
    expect(k4.path).toBe("dieu-3.khoan-4");
  });

  test("chèn Điều 3a sau Điều 3, có khoản con", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    const dieu: string[] = [];
    walk(r.root, (n) => {
      if (n.kind === "dieu") dieu.push(nodeKey(n));
    });
    expect(dieu).toEqual(["1", "2", "3", "3a", "4", "5", "6"]);
    let d3a: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-3a") d3a = n;
    });
    expect(d3a.status).toBe("added");
    expect(d3a.heading).toBe("Điều chỉnh kế hoạch thử nghiệm");
    expect(d3a.children.filter((c: any) => c.kind === "khoan").map(nodeKey)).toEqual(["1", "2"]);
    expect(d3a.children[0].path).toBe("dieu-3a.khoan-1");
  });

  test("bãi bỏ điểm c: giữ nhãn, đánh dấu repealed", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    let c: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1.khoan-2.diem-c") c = n;
    });
    expect(c.status).toBe("repealed");
    const out = serializeDocument(r.root, { footnotes: true });
    expect(out).toContain("c) (được bãi bỏ)");
    expect(out).toContain("được bãi bỏ theo quy định tại khoản 4 Điều 1");
  });

  test("thay cụm từ áp dụng toàn văn bản", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    const out = serializeDocument(r.root);
    expect(out).toContain("Bộ Khoa học và Công nghệ (mới)");
  });

  test("cây gốc không bị đột biến", () => {
    const before = serializeDocument(base);
    consolidate(base, OPS, "2027-07-01");
    expect(serializeDocument(base)).toBe(before);
  });

  test("lệnh chưa duyệt thì không áp dụng", () => {
    const pending = OPS.map((o) => ({ ...o, reviewStatus: "pending" as const }));
    expect(consolidate(base, pending, "2027-07-01").applied.length).toBe(0);
  });

  test("nút đích không tồn tại -> xung đột, không im lặng bỏ qua", () => {
    const bad = [op({ op: "replace", targetPath: "dieu-99.khoan-1", ordinal: 9, payload: { text: "x" } })];
    const r = consolidate(base, bad, "2027-07-01");
    expect(r.applied.length).toBe(0);
    expect(r.conflicts[0]?.reason).toContain("dieu-99.khoan-1");
  });

  test("mốc thời gian thay đổi nội dung", () => {
    expect(changeDates(OPS)).toEqual(["2027-07-01"]);
  });

  test("trạng thái văn bản suy ra từ nút", () => {
    const meta = { effectiveFrom: "2026-03-01" };
    expect(deriveDocStatus(base, meta, "2026-01-01")).toBe("chua_hieu_luc");
    expect(deriveDocStatus(base, meta, "2026-06-01")).toBe("con_hieu_luc");
    const r = consolidate(base, OPS, "2027-07-01");
    expect(deriveDocStatus(r.root, meta, "2027-07-01")).toBe("het_hieu_luc_mot_phan");
    const repealAll = [op({ op: "repeal", targetPath: "", ordinal: 1 })];
    const r2 = consolidate(base, repealAll, "2027-07-01");
    expect(deriveDocStatus(r2.root, meta, "2027-07-01")).toBe("het_hieu_luc");
  });
});

describe("diff hai phiên bản", () => {
  test("phát hiện đúng thêm/sửa/bãi bỏ", () => {
    const r = consolidate(base, OPS, "2027-07-01");
    const d = diffTrees(base, r.root);
    const byPath = Object.fromEntries(d.map((x) => [x.path, x.change]));
    expect(byPath["dieu-3.khoan-1"]).toBe("modified");
    expect(byPath["dieu-3.khoan-4"]).toBe("added");
    expect(byPath["dieu-3a"]).toBe("added");
    // Bãi bỏ: câu chữ giữ nguyên nhưng trạng thái đổi -> vẫn phải hiện trong diff
    expect(byPath["dieu-1.khoan-2.diem-c"]).toBe("modified");
    const diemC = d.find((x) => x.path === "dieu-1.khoan-2.diem-c");
    expect(diemC?.statusBefore).toBe("active");
    expect(diemC?.statusAfter).toBe("repealed");
  });
  test("diff mức từ", () => {
    const d = diffTrees(base, consolidate(base, OPS, "2027-07-01").root);
    const k1 = d.find((x) => x.path === "dieu-3.khoan-1");
    const added = k1?.words
      ?.filter((w) => w.type === "add")
      .map((w) => w.text)
      .join("");
    expect(added).toContain("gửi lấy ý kiến");
  });
});

describe("chặn lệnh hỏng, không tạo nút rỗng", () => {
  test("payload là chuỗi (lỗi mã hóa JSON hai lần) -> xung đột", () => {
    const bad = [
      op({
        op: "insert_after",
        targetPath: "dieu-3",
        ordinal: 1,
        payload: '{"newLabel":"Điều 3a","text":"..."}' as any,
      }),
    ];
    const r = consolidate(base, bad, "2027-07-01");
    expect(r.applied.length).toBe(0);
    expect(r.conflicts[0]?.reason).toContain("thiếu payload");
  });
  test("thiếu nội dung mới -> xung đột", () => {
    const bad = [op({ op: "replace", targetPath: "dieu-3.khoan-1", ordinal: 1, payload: { text: "  " } })];
    const r = consolidate(base, bad, "2027-07-01");
    expect(r.applied.length).toBe(0);
    expect(r.conflicts[0]?.reason).toContain("thiếu nội dung mới");
  });
  test("chèn thiếu nhãn -> xung đột", () => {
    const bad = [
      op({ op: "insert_after", targetPath: "dieu-3.khoan-3", ordinal: 1, payload: { text: "nội dung" } }),
    ];
    const r = consolidate(base, bad, "2027-07-01");
    expect(r.applied.length).toBe(0);
    expect(r.conflicts[0]?.reason).toContain("thiếu nhãn");
  });
  test("số điều không tăng khi lệnh bị chặn", () => {
    const bad = [op({ op: "insert_after", targetPath: "dieu-3", ordinal: 1, payload: "hỏng" as any })];
    const r = consolidate(base, bad, "2027-07-01");
    const dieu: string[] = [];
    walk(r.root, (n) => {
      if (n.kind === "dieu") dieu.push(nodeKey(n));
    });
    expect(dieu).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
