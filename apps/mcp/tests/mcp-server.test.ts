/**
 * Test đầu-cuối qua giao thức MCP thật: dựng server, nối bằng transport trong bộ nhớ,
 * rồi gọi như một client thật. Kiểm tra cả việc LỌC công cụ theo vai trò.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Principal, Role } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { buildServer } from "../src/server.ts";

const EMAIL = "test-mcp@vidu.vn";

async function connect(role: Role, write = false): Promise<Client> {
  process.env.QDPL_MCP_ALLOW_WRITE = write ? "1" : "0";
  const principal: Principal = { email: EMAIL, role, source: "google" };
  const server = buildServer(principal);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

beforeAll(async () => {
  // Dữ liệu mẫu do test-setup nạp sẵn.
  const [d] = (await sql`SELECT count(*)::int c FROM documents`) as any[];
  expect(d.c).toBeGreaterThan(0);
});

afterAll(async () => {
  await sql`DELETE FROM mcp_call_log WHERE email = ${EMAIL}`;
});

describe("danh sách công cụ lọc theo vai trò", () => {
  test("khách chỉ thấy công cụ tra cứu", async () => {
    const c = await connect("khach");
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).toContain("tim_kiem_quy_dinh");
    expect(names).toContain("doc_van_ban");
    expect(names).not.toContain("hang_doi_bien_tap");
    expect(names).not.toContain("duyet_lenh_sua_doi");
    await c.close();
  });

  test("cán bộ thấy công cụ chẩn đoán kho nhưng không thấy công cụ vận hành", async () => {
    const c = await connect("can_bo", true);
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).toContain("thong_ke_kho");
    expect(names).not.toContain("hang_doi_bien_tap");
    expect(names).not.toContain("duyet_lenh_sua_doi");
    expect(names).not.toContain("quan_ly_tai_khoan");
    await c.close();
  });

  test("Admin quản lý thấy công cụ vận hành nhưng không quản lý tài khoản", async () => {
    const c = await connect("quan_ly", true);
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).toContain("hang_doi_bien_tap");
    expect(names).toContain("thu_hop_nhat");
    expect(names).toContain("duyet_lenh_sua_doi");
    expect(names).not.toContain("quan_ly_tai_khoan");
    await c.close();
  });

  test("lãnh đạo UBND xã không thấy công cụ quản trị nội dung", async () => {
    const c = await connect("lanh_dao", true);
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("hang_doi_bien_tap");
    expect(names).not.toContain("duyet_lenh_sua_doi");
    expect(names).not.toContain("quan_ly_tai_khoan");
    await c.close();
  });

  test("chế độ chỉ đọc: công cụ ghi bị gỡ khỏi danh sách", async () => {
    const c = await connect("quan_tri", false);
    const names = (await c.listTools()).tools.map((t) => t.name);
    expect(names).not.toContain("duyet_lenh_sua_doi");
    expect(names).not.toContain("quan_ly_tai_khoan");
    expect(names).toContain("tim_kiem_quy_dinh");
    await c.close();
  });

  test("gọi công cụ ngoài quyền thì bị từ chối và hành động KHÔNG xảy ra", async () => {
    // Lấy một lệnh sửa đổi đang có để chắc chắn nếu bị thực thi thì dữ liệu sẽ đổi.
    const [op] = (await sql`SELECT id, review_status FROM amendment_ops LIMIT 1`) as any[];
    expect(op).toBeDefined();

    const c = await connect("khach");
    const out: any = await c
      .callTool({
        name: "duyet_lenh_sua_doi",
        arguments: { id_lenh: op.id, quyet_dinh: "tu_choi", nguoi_duyet: "ke-mao-danh" },
      })
      .catch((e) => ({ isError: true, content: [{ text: String(e) }] }));
    expect(out.isError).toBe(true);

    // Điều quan trọng nhất: trạng thái duyệt không hề thay đổi.
    const [after] = (await sql`SELECT review_status FROM amendment_ops WHERE id = ${op.id}`) as any[];
    expect(after.review_status).toBe(op.review_status);
    await c.close();
  });
});

describe("công cụ tra cứu hoạt động trên dữ liệu thật", () => {
  test("tìm kiếm trả về kết quả kèm URN", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "tim_kiem_quy_dinh",
      arguments: { cau_hoi: "kế hoạch thử nghiệm", as_of: "2026-06-01" },
    });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("vn:vbqppl:nd:");
    await c.close();
  });

  test("đọc văn bản theo hai thời điểm cho nội dung khác nhau", async () => {
    const c = await connect("can_bo");
    const a: any = await c.callTool({
      name: "doc_van_ban",
      arguments: { van_ban: "100/2026/NĐ-CP", as_of: "2026-06-01" },
    });
    const b: any = await c.callTool({
      name: "doc_van_ban",
      arguments: { van_ban: "100/2026/NĐ-CP", as_of: "2027-08-01" },
    });
    expect(a.content[0].text).not.toContain("Điều 3a");
    expect(b.content[0].text).toContain("Điều 3a");
    expect(b.content[0].text).toContain("Hết hiệu lực một phần");
    await c.close();
  });

  test("kiểm tra căn cứ phát hiện nút đã bị bãi bỏ", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "kiem_tra_can_cu",
      arguments: {
        can_cu: ["vn:vbqppl:nd:100/2026/NĐ-CP#dieu-1.khoan-2.diem-c"],
        as_of: "2027-08-01",
      },
    });
    expect(r.content[0].text).toContain("KHÔNG ĐƯỢC DÙNG");
    expect(r.structuredContent.khong_hop_le).toBe(1);
    await c.close();
  });

  test("kiểm tra căn cứ chấp nhận nút còn hiệu lực", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "kiem_tra_can_cu",
      arguments: { can_cu: ["khoản 1 Điều 3 Nghị định 100/2026/NĐ-CP"], as_of: "2026-06-01" },
    });
    expect(r.structuredContent.khong_hop_le).toBe(0);
    await c.close();
  });

  test("phát hiện căn cứ trỏ tới văn bản chưa có trong kho", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "kiem_tra_can_cu",
      arguments: { can_cu: ["Điều 9 Nghị định số 999/2099/NĐ-CP"] },
    });
    expect(r.content[0].text).toContain("KHÔNG CÓ TRONG KHO");
    await c.close();
  });

  test("so sánh hai thời điểm chỉ ra đúng thay đổi", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "so_sanh_thoi_diem",
      arguments: { van_ban: "100/2026/NĐ-CP", tu_ngay: "2026-06-01", den_ngay: "2027-08-01" },
    });
    expect(r.content[0].text).toContain("dieu-3a");
    expect(r.structuredContent.so_thay_doi).toBeGreaterThan(0);
    await c.close();
  });

  test("đối chiếu thứ bậc theo Điều 4 Luật Ban hành VBQPPL", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({
      name: "doi_chieu_thu_bac",
      arguments: { van_ban_a: "100/2026/NĐ-CP", van_ban_b: "150/2027/NĐ-CP" },
    });
    // Cùng thứ bậc nghị định -> văn bản ban hành sau được ưu tiên
    expect(r.structuredContent.uu_tien).toContain("150/2027");
    await c.close();
  });

  test("văn bản không tồn tại thì báo lỗi rõ ràng, không đoán bừa", async () => {
    const c = await connect("can_bo");
    const r: any = await c.callTool({ name: "doc_van_ban", arguments: { van_ban: "999/1999/XYZ" } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Không tìm thấy");
    await c.close();
  });
});

describe("nhật ký gọi công cụ", () => {
  test("mọi lần gọi đều được ghi kèm danh tính", async () => {
    await sql`DELETE FROM mcp_call_log WHERE email = ${EMAIL}`;
    const c = await connect("can_bo");
    await c.callTool({ name: "thong_ke_kho", arguments: {} });
    await c.close();
    await new Promise((r) => setTimeout(r, 150));
    const rows =
      (await sql`SELECT tool, email, role, allowed FROM mcp_call_log WHERE email = ${EMAIL}`) as any[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].tool).toBe("thong_ke_kho");
    expect(rows[0].role).toBe("can_bo");
    expect(rows[0].allowed).toBe(true);
  });
});

describe("tài nguyên và mẫu nhắc việc", () => {
  test("liệt kê tài nguyên và đọc được văn bản theo URN", async () => {
    const c = await connect("can_bo");
    const res = await c.listResources();
    expect(res.resources.some((r) => r.uri.startsWith("vbqppl://"))).toBe(true);
    const doc = await c.readResource({
      uri: `vbqppl://van-ban/${encodeURIComponent("vn:vbqppl:nd:100/2026/NĐ-CP@2027-08-01")}`,
    });
    expect(String(doc.contents[0]?.text)).toContain("Điều 3a");
    await c.close();
  });

  test("mẫu nhắc việc trả về quy trình bắt buộc", async () => {
    const c = await connect("can_bo");
    const list = await c.listPrompts();
    expect(list.prompts.map((p) => p.name)).toContain("tra-loi-co-can-cu");
    const p = await c.getPrompt({
      name: "tra-loi-co-can-cu",
      arguments: { cau_hoi: "Thời hạn thẩm định là bao lâu?" },
    });
    const first = p.messages[0];
    expect(first).toBeDefined();
    const text = String((first!.content as { text: string }).text);
    expect(text).toContain("kiem_tra_can_cu");
    expect(text).toContain("không trả lời theo trí nhớ");
    await c.close();
  });
});
