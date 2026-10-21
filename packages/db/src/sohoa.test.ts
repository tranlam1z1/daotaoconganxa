/** Vòng đời một việc số hóa: tạo -> nhận -> nộp cụm -> chốt (ke-hoach/05). */
import { beforeAll, describe, expect, test } from "bun:test";
import { buildUrn } from "@qdpl/legal-model";
import { sql } from "./client.ts";
import { getDocumentByUrn } from "./repo.ts";
import {
  capNhatViecSoHoa,
  danhSachViecSoHoa,
  ghiCuaSo,
  layCacCuaSo,
  layViecSoHoa,
  nhanViecSoHoa,
  taoViecSoHoa,
  thongKeSoHoa,
} from "./sohoa.ts";

const URN = buildUrn({ docType: "nd", soKyHieu: "100/2026/NĐ-CP" });
const FILE = "raw/kiem-thu/2026/nghi-dinh/100-2026-nd-cp/abc.pdf";
let documentId = "";

beforeAll(async () => {
  const doc = await getDocumentByUrn(URN);
  documentId = doc!.id;
  await sql`DELETE FROM sohoa_tasks WHERE document_id = ${documentId}`;
});

describe("việc số hóa", () => {
  test("tạo việc là idempotent theo (văn bản, tệp)", async () => {
    const a = await taoViecSoHoa({
      documentId,
      fileUri: FILE,
      route: "pdf_anh",
      pageCount: 9,
      windows: [
        { idx: 1, tuTrang: 1, denTrang: 5 },
        { idx: 2, tuTrang: 5, denTrang: 9, trangChongLan: 5 },
      ],
    });
    const b = await taoViecSoHoa({ documentId, fileUri: FILE, route: "pdf_text", pageCount: 9 });
    expect(b.id).toBe(a.id);
    expect(b.route).toBe("pdf_text");
    expect(a.state).toBe("cho");
  });

  test("nhận việc: chỉ một phiên giữ được, phiên khác không lấy lại", async () => {
    const t1 = await nhanViecSoHoa({ nguoiNhan: "a@vd.vn", documentId });
    expect(t1?.state).toBe("dang_lam");
    expect(t1?.claimed_by).toBe("a@vd.vn");
    const t2 = await nhanViecSoHoa({ nguoiNhan: "b@vd.vn", documentId });
    expect(t2).toBeUndefined();
    // Chính người đang giữ thì nhận lại được (phiên MCP mất kết nối rồi vào lại).
    const t3 = await nhanViecSoHoa({ nguoiNhan: "a@vd.vn", documentId });
    expect(t3?.id).toBe(t1!.id);
  });

  test("việc quá hạn giữ thì người khác nhận được", async () => {
    const t = await nhanViecSoHoa({ nguoiNhan: "a@vd.vn", documentId });
    await sql`UPDATE sohoa_tasks SET lease_until = now() - interval '1 hour' WHERE id = ${t!.id}`;
    const khac = await nhanViecSoHoa({ nguoiNhan: "c@vd.vn", documentId });
    expect(khac?.claimed_by).toBe("c@vd.vn");
  });

  test("nộp cụm: ghi đè khi nộp lại cùng một cụm", async () => {
    const t = (await nhanViecSoHoa({ nguoiNhan: "c@vd.vn", documentId }))!;
    await ghiCuaSo({
      taskId: t.id,
      idx: 1,
      pageFrom: 1,
      pageTo: 5,
      markdown: "### Điều 1. A",
      openState: { sentence_open: true, table_open: false },
      tables: [{ rows: 2, cols: 3 }],
      submittedBy: "c@vd.vn",
    });
    await ghiCuaSo({
      taskId: t.id,
      idx: 1,
      pageFrom: 1,
      pageTo: 5,
      markdown: "### Điều 1. A (đã sửa)",
      openState: { sentence_open: false, table_open: false },
      submittedBy: "c@vd.vn",
    });
    await ghiCuaSo({ taskId: t.id, idx: 2, pageFrom: 5, pageTo: 9, markdown: "### Điều 2. B" });
    const ds = await layCacCuaSo(t.id);
    expect(ds).toHaveLength(2);
    expect(ds[0]?.markdown).toContain("đã sửa");
    expect((ds[0]!.open_state as { sentence_open: boolean }).sentence_open).toBe(false);
    expect(ds[1]?.idx).toBe(2);
  });

  test("chốt việc: ghi điểm chất lượng và đánh dấu đã xong", async () => {
    const t = (await nhanViecSoHoa({ nguoiNhan: "c@vd.vn", documentId }))!;
    await capNhatViecSoHoa(t.id, {
      state: "xong",
      markdownUri: `derived/${documentId}/so-hoa/document.md`,
      quality: { diem: 0.98 },
      parseQueued: true,
      finished: true,
    });
    const sau = await layViecSoHoa(t.id);
    expect(sau?.state).toBe("xong");
    expect(sau?.finished_at).not.toBeNull();
    expect((sau!.quality as { diem: number }).diem).toBe(0.98);
    expect(sau?.parse_queued).toBe(true);
  });

  test("thống kê và danh sách phản ánh đúng trạng thái", async () => {
    const tk = await thongKeSoHoa();
    expect(tk.theoTrangThai.xong).toBeGreaterThanOrEqual(1);
    expect(tk.soCuaSoDaNop).toBeGreaterThanOrEqual(2);
    const ds = await danhSachViecSoHoa({ state: "xong" });
    const cua = ds.find((x) => x.document_id === documentId);
    expect(cua?.so_ky_hieu).toBe("100/2026/NĐ-CP");
    expect(cua?.so_cua_so_da_nop).toBe(2);
  });
});
