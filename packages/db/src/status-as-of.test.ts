import { describe, expect, test } from "bun:test";
import { buildUrn } from "@qdpl/legal-model";
import { sql } from "./client.ts";
import { getDocumentByUrn, getStatusAsOf } from "./repo.ts";

const URN = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });

describe("trạng thái hiệu lực theo thời điểm", () => {
  test("khác nhau ở từng mốc thời gian", async () => {
    const doc = await getDocumentByUrn(URN);
    expect(doc).toBeDefined();
    // Văn bản ban hành 20/01/2026, hiệu lực 01/3/2026, bị sửa đổi từ 01/7/2027.
    expect(await getStatusAsOf(doc!.id, "2026-01-01")).toBe("chua_hieu_luc");
    expect(await getStatusAsOf(doc!.id, "2026-06-01")).toBe("con_hieu_luc");
    expect(await getStatusAsOf(doc!.id, "2027-08-01")).toBe("het_hieu_luc_mot_phan");
  });

  test("khác với ảnh chụp trạng thái hiện tại trên documents.status", async () => {
    const doc = await getDocumentByUrn(URN);
    // documents.status là trạng thái mới nhất; tra cứu quá khứ phải không phụ thuộc nó.
    expect(doc!.status).toBe("het_hieu_luc_mot_phan");
    expect(await getStatusAsOf(doc!.id, "2026-06-01")).not.toBe(doc!.status);
  });

  test("mỗi phiên bản lưu trạng thái riêng", async () => {
    const doc = await getDocumentByUrn(URN);
    const rows = await sql`
      SELECT kind, status FROM document_versions WHERE document_id = ${doc!.id} ORDER BY version_no`;
    const map = Object.fromEntries((rows as any[]).map((r) => [r.kind, r.status]));
    expect(map.original).toBe("con_hieu_luc");
    expect(map.consolidated_auto).toBe("het_hieu_luc_mot_phan");
  });
});

describe("chọn CSDL test", () => {
  test("suy ra tên CSDL test là idempotent", async () => {
    const { databaseUrl } = await import("./client.ts");
    const name = new URL(databaseUrl).pathname.slice(1);
    expect(name.endsWith("_test")).toBe(true);
    // Không được nối đuôi nhiều lần khi DATABASE_URL đã trỏ CSDL test.
    expect(name.endsWith("_test_test")).toBe(false);
  });
});
