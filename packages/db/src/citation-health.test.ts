import { afterAll, describe, expect, test } from "bun:test";
import { buildUrn } from "@qdpl/legal-model";
import { checkCitations, hashNodeContent, lookupNode, recordCitation } from "./citation-health.ts";
import { sql } from "./client.ts";

const URN = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });
const OWNER = "00000000-0000-0000-0000-0000000000c1";

// Dữ liệu mẫu do packages/db/src/seed.ts nạp: điểm c khoản 2 Điều 1 bị bãi bỏ từ 2027-07-01,
// khoản 1 Điều 3 bị sửa nội dung từ 2027-07-01.
const NODE_BI_BAI_BO = `${URN}#dieu-1.khoan-2.diem-c`;
const NODE_BI_SUA = `${URN}#dieu-3.khoan-1`;
const NODE_ON_DINH = `${URN}#dieu-2.khoan-1`;

afterAll(async () => {
  // Chỉ dọn dữ liệu của chính file này. KHÔNG gọi sql.end(): Bun chạy mọi file test
  // trong cùng một tiến trình nên pool là dùng chung; đóng ở đây sẽ làm hỏng các file sau.
  await sql`DELETE FROM review_queue WHERE ref_id IN (SELECT id::text FROM citations WHERE owner_id = ${OWNER})`;
  await sql`DELETE FROM citations WHERE owner_id = ${OWNER}`;
});

describe("theo dõi sức khỏe viện dẫn", () => {
  test("hash bỏ qua khác biệt khoảng trắng", () => {
    expect(hashNodeContent("Tiêu đề", "Nội  dung\n  văn bản.")).toBe(
      hashNodeContent("Tiêu đề", "Nội dung văn bản."),
    );
    expect(hashNodeContent("Tiêu đề", "Nội dung A")).not.toBe(hashNodeContent("Tiêu đề", "Nội dung B"));
  });

  test("tra nút theo thời điểm trả về đúng phiên bản", async () => {
    const truoc = await lookupNode(NODE_BI_SUA, "2026-06-01");
    const sau = await lookupNode(NODE_BI_SUA, "2027-08-01");
    expect(truoc?.text_md).toBeTruthy();
    expect(sau?.text_md).toBeTruthy();
    expect(sau!.text_md).not.toBe(truoc!.text_md);
    expect(sau!.text_md).toContain("gửi lấy ý kiến");
  });

  test("ghi nhận viện dẫn tại thời điểm còn hiệu lực -> ok", async () => {
    await sql`DELETE FROM citations WHERE owner_id = ${OWNER}`;
    expect(
      await recordCitation({
        ownerKind: "use_case",
        ownerId: OWNER,
        nodeUrn: NODE_ON_DINH,
        asOf: "2026-06-01",
      }),
    ).toBe("ok");
    expect(
      await recordCitation({
        ownerKind: "use_case",
        ownerId: OWNER,
        nodeUrn: NODE_BI_SUA,
        asOf: "2026-06-01",
      }),
    ).toBe("ok");
    expect(
      await recordCitation({
        ownerKind: "use_case",
        ownerId: OWNER,
        nodeUrn: NODE_BI_BAI_BO,
        asOf: "2026-06-01",
      }),
    ).toBe("ok");
  });

  test("kiểm tra ở thời điểm sau: phát hiện đổi nội dung và bị bãi bỏ", async () => {
    const r = await checkCitations({ asOf: "2027-08-01" });
    const mine = r.issues.filter((i) => i.ownerId === OWNER);
    const byUrn = Object.fromEntries(mine.map((i) => [i.nodeUrn, i.health]));
    expect(byUrn[NODE_BI_SUA]).toBe("changed");
    expect(byUrn[NODE_BI_BAI_BO]).toBe("repealed");
    expect(byUrn[NODE_ON_DINH]).toBeUndefined(); // vẫn ok nên không nằm trong danh sách vấn đề
  });

  test("viện dẫn tới nút không tồn tại -> missing", async () => {
    await recordCitation({
      ownerKind: "use_case",
      ownerId: OWNER,
      nodeUrn: `${URN}#dieu-99.khoan-1`,
      asOf: "2026-06-01",
    });
    const r = await checkCitations({ asOf: "2026-06-01" });
    expect(r.issues.some((i) => i.ownerId === OWNER && i.health === "missing")).toBe(true);
  });

  test("tạo việc trong hàng đợi biên tập, không tạo trùng", async () => {
    await sql`DELETE FROM review_queue WHERE kind = 'citation'`;
    await checkCitations({ asOf: "2027-08-01", enqueueReview: true });
    const [a] =
      await sql`SELECT count(*)::int c FROM review_queue WHERE kind = 'citation' AND state = 'open'`;
    await checkCitations({ asOf: "2027-08-01", enqueueReview: true });
    const [b] =
      await sql`SELECT count(*)::int c FROM review_queue WHERE kind = 'citation' AND state = 'open'`;
    expect((a as any).c).toBeGreaterThan(0);
    expect((b as any).c).toBe((a as any).c);
  });

  test("việc bãi bỏ được ưu tiên cao hơn", async () => {
    const rows =
      await sql`SELECT priority, payload->>'health' AS h FROM review_queue WHERE kind = 'citation'`;
    const repealed = (rows as any[]).find((r) => r.h === "repealed");
    const changed = (rows as any[]).find((r) => r.h === "changed");
    expect(repealed?.priority).toBeGreaterThan(changed?.priority ?? 0);
  });
});
