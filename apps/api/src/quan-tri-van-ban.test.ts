/**
 * Thêm, sửa, xóa văn bản trong trang quản trị (/v1/quan-tri/van-ban) trên Postgres test thật.
 * Văn bản thử dùng năm 2099 để không đụng dữ liệu mẫu; dọn trước và sau khi chạy.
 * Bản sao Markdown ghi vào thư mục tạm, không lên R2; Redis tắt để không đẩy việc lên hàng đợi chung.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { putText } from "@qdpl/storage";
import { createApp } from "./app.ts";

// Không gọi mô hình thật: bản quét chưa đọc sẵn thì API từ chối.
process.env.LLM_PROVIDER = "mock";

const app = createApp();
const PREFIX = "test-van-ban-qt";
const URN = "vn:vbqppl:nd:901/2099/NĐ-CP";
const URN_QUET = "vn:vbqppl:nd:902/2099/NĐ-CP";
const URN_PDF_CHU = "vn:vbqppl:nd:903/2099/NĐ-CP";
const URN_PDF_QUET = "vn:vbqppl:nd:904/2099/NĐ-CP";
const URN_THU = [URN, URN_QUET, URN_PDF_CHU, URN_PDF_QUET];
const E = encodeURIComponent;

const envCu = {
  redis: process.env.REDIS_URL,
  backend: process.env.STORAGE_BACKEND,
  dir: process.env.STORAGE_DIR,
};
const khoDir = mkdtempSync(join(tmpdir(), "qdpl-van-ban-qt-"));

const MD_1 = `CHÍNH PHỦ

NGHỊ ĐỊNH
Quy định thử về quản lý văn bản trong trang quản trị

Điều 1. Phạm vi điều chỉnh
Nghị định này quy định thử.

Điều 2. Đối tượng áp dụng
1. Cơ quan nhà nước.
2. Tổ chức, cá nhân có liên quan.
`;

const MD_2 = `${MD_1}
Điều 3. Hiệu lực thi hành
Nghị định này có hiệu lực từ ngày ký.
`;

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const tk = { canBo: "", bienTap: "", quanTri: "" };

async function donDep() {
  await sql`DELETE FROM citations WHERE node_urn LIKE ${`${URN}%`}`;
  await sql`DELETE FROM documents WHERE urn = ANY(${URN_THU})`;
  await sql`DELETE FROM authoring_jobs WHERE step = 'doc_tep_goc' AND input->>'urn' = ANY(${URN_THU})`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  delete process.env.REDIS_URL;
  process.env.STORAGE_BACKEND = "local";
  process.env.STORAGE_DIR = khoDir;
  await donDep();
  for (const [k, role] of [
    ["canBo", "can_bo"],
    ["bienTap", "quan_ly"],
    ["quanTri", "quan_tri"],
  ] as const) {
    const [r] = (await sql`
      INSERT INTO accounts (username, name, role) VALUES (${`${PREFIX}-${k}`}, ${k}, ${role})
      RETURNING id`) as any[];
    tk[k] = (await createSession(r.id, "test")).token;
  }
});

afterAll(async () => {
  await donDep();
  rmSync(khoDir, { recursive: true, force: true });
  for (const [k, v] of [
    ["REDIS_URL", envCu.redis],
    ["STORAGE_BACKEND", envCu.backend],
    ["STORAGE_DIR", envCu.dir],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const TAO = {
  docType: "nd",
  soKyHieu: "901/2099/NĐ-CP",
  title: "Nghị định quy định thử về quản lý văn bản trong trang quản trị",
  issuer: "Chính phủ",
  issuedDate: "2099-01-10",
  effectiveFrom: "2099-03-01",
  markdown: MD_1,
};

describe("quyền", () => {
  test("chưa đăng nhập 401, cán bộ 403", async () => {
    expect((await goi("GET", "/v1/quan-tri/van-ban")).status).toBe(401);
    expect((await goi("GET", "/v1/quan-tri/van-ban", tk.canBo)).status).toBe(403);
    expect((await goi("POST", "/v1/quan-tri/van-ban", tk.canBo, TAO)).status).toBe(403);
  });
});

describe("xem trước", () => {
  test("tách Markdown thành Điều, khoản mà không ghi gì", async () => {
    const { status, body } = await goi("POST", "/v1/quan-tri/van-ban/xem-truoc", tk.bienTap, {
      markdown: MD_1,
    });
    expect(status).toBe(200);
    expect(body.dem.dieu).toBe(2);
    expect(body.mucLuc.filter((m: any) => m.kind === "dieu").map((m: any) => m.label)).toEqual([
      "Điều 1",
      "Điều 2",
    ]);
    expect(body.mucLuc.find((m: any) => m.label === "Điều 2").soKhoan).toBe(2);
    const [d] = (await sql`SELECT count(*)::int AS n FROM documents WHERE urn = ${URN}`) as any[];
    expect(d.n).toBe(0);
  });

  test("nội dung trống trả 400", async () => {
    const { status } = await goi("POST", "/v1/quan-tri/van-ban/xem-truoc", tk.bienTap, { markdown: "  " });
    expect(status).toBe(400);
  });
});

async function guiTep(token: string, bytes: Uint8Array<ArrayBuffer>, ten: string) {
  const form = new FormData();
  form.set("tep", new File([bytes], ten, { type: "application/pdf" }));
  const res = await app.request("http://test/v1/quan-tri/van-ban/tu-pdf", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** PDF một trang trắng, không có lớp văn bản: như bản quét. */
const PDF_TRANG = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

describe("nạp từ PDF", () => {
  const PDF_MAU = readFileSync(
    join(import.meta.dir, "../../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf"),
  );

  test("PDF có lớp văn bản: trả thuộc tính đoán được và tệp gốc đã cất, chưa ghi văn bản nào", async () => {
    const [truoc] = (await sql`SELECT count(*)::int AS n FROM documents`) as any[];
    const { status, body } = await guiTep(tk.bienTap, new Uint8Array(PDF_MAU), "nd-45.pdf");
    expect(status).toBe(200);
    expect(body.tuyen).toBe("pdf_text");
    expect(body.soTrang).toBe(5);
    // Nội dung chữ không còn điền vào biểu mẫu: văn bản lưu kèm tệp gốc, đọc thành chữ sau.
    expect(body.markdown).toBeUndefined();
    expect(body.tepGoc).toMatch(/^van-ban-goc\/[0-9a-f]{16}\.pdf$/);
    expect(body.thuocTinh).toMatchObject({
      soKyHieu: "45/2026/NĐ-CP",
      docType: "nd",
      issuer: "CHÍNH PHỦ",
      signer: "Nguyễn Văn A",
    });
    expect(body.daCo).toBeNull();
    const [sau] = (await sql`SELECT count(*)::int AS n FROM documents`) as any[];
    expect(sau.n).toBe(truoc.n);
  });

  test("bản quét không có lớp văn bản: báo tuyến pdf_anh, vẫn cất tệp gốc", async () => {
    const { status, body } = await guiTep(tk.bienTap, PDF_TRANG, "ban-quet.pdf");
    expect(status).toBe(200);
    expect(body.tuyen).toBe("pdf_anh");
    expect(body.thuocTinh).toEqual({});
    expect(body.tepGoc).toMatch(/^van-ban-goc\/[0-9a-f]{16}\.pdf$/);
  });

  test("tệp không phải PDF trả 400; cán bộ 403", async () => {
    const word = new TextEncoder().encode("PK\u0003\u0004 không phải PDF");
    expect((await guiTep(tk.bienTap, word, "van-ban.docx")).status).toBe(400);
    expect((await guiTep(tk.canBo, new Uint8Array(PDF_MAU), "nd-45.pdf")).status).toBe(403);
  });
});

// Lần ghi đầu dựng bảng nodes và bản sao Markdown, chậm hơn mức 5 giây mặc định trên máy chậm.
setDefaultTimeout(30_000);

describe("thêm, sửa, xóa", () => {
  test("thêm văn bản: có trên trang đọc ngay, trạng thái tự tính theo ngày", async () => {
    const { status, body } = await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, TAO);
    expect(status).toBe(201);
    expect(body.urn).toBe(URN);
    expect(body.hangDoi).toBe("khong_co_redis");

    const ct = await goi("GET", `/v1/documents/${E(URN)}/content?format=json&asOf=2099-06-01`);
    expect(ct.status).toBe(200);
    const dieu = ct.body.tree.children.filter((n: any) => n.kind === "dieu");
    expect(dieu.map((n: any) => n.label)).toEqual(["Điều 1", "Điều 2"]);
    expect(ct.body.document.shortTitle).toBe("Nghị định 901/2099/NĐ-CP");
    expect(ct.body.document.status).toBe("chua_hieu_luc");

    const [n] = (await sql`
      SELECT count(*)::int AS n FROM nodes n JOIN documents d ON d.id = n.document_id
      WHERE d.urn = ${URN} AND n.kind = 'dieu'`) as any[];
    expect(n.n).toBe(2);
  });

  test("thêm trùng số ký hiệu trả 409", async () => {
    const { status, body } = await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, TAO);
    expect(status).toBe(409);
    expect(body.error.details.urn).toBe(URN);
  });

  test("sửa nội dung: phân tích lại, ghi đè phiên bản gốc", async () => {
    const { status, body } = await goi("PUT", `/v1/quan-tri/van-ban/${E(URN)}`, tk.bienTap, {
      ...TAO,
      markdown: MD_2,
      status: "con_hieu_luc",
    });
    expect(status).toBe(200);
    expect(body.doiNoiDung).toBe(true);
    expect(body.tomTat.dem.dieu).toBe(3);

    const ct = await goi("GET", `/v1/quan-tri/van-ban/${E(URN)}`, tk.bienTap);
    expect(ct.body.markdown).toBe(MD_2);
    expect(ct.body.document.status).toBe("con_hieu_luc");
    expect(ct.body.soPhienBan).toBe(1);
    expect(ct.body.phienBanGoc.nguon).toBe("quan-tri");

    const [n] = (await sql`
      SELECT count(*)::int AS n FROM nodes n JOIN documents d ON d.id = n.document_id
      WHERE d.urn = ${URN} AND n.kind = 'dieu'`) as any[];
    expect(n.n).toBe(3);
  });

  test("lưu lại không đổi nội dung thì không phân tích lại", async () => {
    const { body } = await goi("PUT", `/v1/quan-tri/van-ban/${E(URN)}`, tk.bienTap, {
      ...TAO,
      markdown: MD_2,
      status: "con_hieu_luc",
      summary: "Trích yếu mới",
    });
    expect(body.doiNoiDung).toBe(false);
    expect(body.tomTat).toBeNull();
  });

  test("xóa: Admin quản lý không được xóa; còn nơi trỏ tới thì 409 cho tới khi xác nhận", async () => {
    await sql`
      INSERT INTO citations (owner_kind, owner_id, node_urn, as_of)
      VALUES ('lesson', uuid_generate_v4(), ${`${URN}#dieu-1`}, '2099-06-01')`;

    expect((await goi("DELETE", `/v1/quan-tri/van-ban/${E(URN)}`, tk.bienTap)).status).toBe(403);

    const chan = await goi("DELETE", `/v1/quan-tri/van-ban/${E(URN)}`, tk.quanTri);
    expect(chan.status).toBe(409);
    expect(chan.body.error.details.thamChieu).toEqual([
      { loai: "vien_dan", nhan: "Viện dẫn trong nội dung biên tập", so: 1 },
    ]);

    const xoa = await goi("DELETE", `/v1/quan-tri/van-ban/${E(URN)}?epBuoc=1`, tk.quanTri);
    expect(xoa.status).toBe(200);
    const [d] = (await sql`SELECT count(*)::int AS n FROM documents WHERE urn = ${URN}`) as any[];
    expect(d.n).toBe(0);
    expect((await goi("GET", `/v1/documents/${E(URN)}`)).status).toBe(404);

    const [log] = (await sql`
      SELECT count(*)::int AS n FROM audit_log WHERE action = 'van_ban.xoa' AND target = ${URN}`) as any[];
    expect(log.n).toBeGreaterThanOrEqual(1);
  });
});

describe("văn bản bản quét: lưu tệp PDF gốc thay cho nội dung chữ", () => {
  const QUET = { ...TAO, soKyHieu: "902/2099/NĐ-CP", markdown: "" };
  const E_QUET = E(URN_QUET);

  test("không nội dung, không tệp gốc: 400; tệp gốc không có trong kho: 400", async () => {
    expect((await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, QUET)).status).toBe(400);
    const la = { ...QUET, tepGoc: "van-ban-goc/0123456789abcdef.pdf" };
    expect((await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, la)).status).toBe(400);
    expect((await goi("GET", `/v1/documents/${E_QUET}`)).status).toBe(404);
  });

  test("lưu bản quét: trang đọc có tệp gốc, chưa có nội dung chữ", async () => {
    const { tepGoc } = (await guiTep(tk.bienTap, PDF_TRANG, "ban-quet.pdf")).body;
    const tao = await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, { ...QUET, tepGoc });
    expect(tao.status).toBe(201);
    expect(tao.body.urn).toBe(URN_QUET);

    const ct = await goi("GET", `/v1/documents/${E_QUET}`);
    expect(ct.status).toBe(200);
    expect(ct.body.coTepGoc).toBe(true);
    expect((await goi("GET", `/v1/documents/${E_QUET}/content?format=json`)).status).toBe(404);

    const tep = await app.request(`http://test/v1/documents/${E_QUET}/tep-goc`);
    expect(tep.status).toBe(200);
    expect(tep.headers.get("content-type")).toBe("application/pdf");
    expect(tep.headers.get("content-disposition")).toStartWith("inline");
    expect(new Uint8Array(await tep.arrayBuffer())).toEqual(PDF_TRANG);

    // Điện thoại không hiện PDF trong khung: từng trang trả về dưới dạng ảnh JPEG.
    expect(ct.body.soTrangTepGoc).toBe(1);
    const anh = await app.request(`http://test/v1/documents/${E_QUET}/tep-goc/trang/1`);
    expect(anh.status).toBe(200);
    expect(anh.headers.get("content-type")).toBe("image/jpeg");
    expect([...new Uint8Array(await anh.arrayBuffer()).slice(0, 2)]).toEqual([0xff, 0xd8]);
    for (const trang of ["2", "0", "x"]) {
      const res = await app.request(`http://test/v1/documents/${E_QUET}/tep-goc/trang/${trang}`);
      expect(res.status).toBe(404);
    }
  });

  test("bản quét lưu trước khi có cột số trang: lượt xem đầu tự đếm rồi ghi lại", async () => {
    await sql`UPDATE documents SET original_file_pages = NULL WHERE urn = ${URN_QUET}`;
    const anh = await app.request(`http://test/v1/documents/${E_QUET}/tep-goc/trang/1`);
    expect(anh.status).toBe(200);

    await sql`UPDATE documents SET original_file_pages = NULL WHERE urn = ${URN_QUET}`;
    expect((await goi("GET", `/v1/documents/${E_QUET}`)).body.soTrangTepGoc).toBe(1);
    const [d] = await sql`SELECT original_file_pages FROM documents WHERE urn = ${URN_QUET}`;
    expect(d?.original_file_pages).toBe(1);
  });

  test("sửa thuộc tính bản quét không sinh phiên bản rỗng; dán nội dung chữ thì đọc được như thường", async () => {
    const sua = await goi("PUT", `/v1/quan-tri/van-ban/${E_QUET}`, tk.bienTap, {
      ...QUET,
      title: "Tên mới của văn bản bản quét",
    });
    expect(sua.status).toBe(200);
    const [v] = (await sql`
      SELECT count(*)::int AS n FROM document_versions v JOIN documents d ON d.id = v.document_id
      WHERE d.urn = ${URN_QUET}`) as any[];
    expect(v.n).toBe(0);
    const qt = await goi("GET", `/v1/quan-tri/van-ban/${E_QUET}`, tk.bienTap);
    expect(qt.body.document.title).toBe("Tên mới của văn bản bản quét");
    expect(qt.body.coTepGoc).toBe(true);

    expect(
      (await goi("PUT", `/v1/quan-tri/van-ban/${E_QUET}`, tk.bienTap, { ...QUET, markdown: MD_1 })).status,
    ).toBe(200);
    const nd = await goi("GET", `/v1/documents/${E_QUET}/content?format=json&asOf=2099-06-01`);
    expect(nd.status).toBe(200);
    // Đã có nội dung chữ thì không xóa trắng được nữa, và tệp gốc vẫn còn để đối chiếu.
    expect((await goi("PUT", `/v1/quan-tri/van-ban/${E_QUET}`, tk.bienTap, QUET)).status).toBe(400);
    expect((await goi("GET", `/v1/documents/${E_QUET}`)).body.coTepGoc).toBe(true);
  });

  test("đọc tệp gốc có lớp chữ: lấy chữ sẵn có, trang đọc có nội dung ngay", async () => {
    const PDF_MAU = readFileSync(
      join(import.meta.dir, "../../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf"),
    );
    const { tepGoc } = (await guiTep(tk.bienTap, new Uint8Array(PDF_MAU), "nd-45.pdf")).body;
    const vb = { ...QUET, soKyHieu: "903/2099/NĐ-CP", tepGoc };
    expect((await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, vb)).status).toBe(201);
    const duong = `/v1/quan-tri/van-ban/${E(URN_PDF_CHU)}/doc-tep-goc`;

    expect((await goi("POST", duong, tk.canBo)).status).toBe(403);
    const doc = await goi("POST", duong, tk.bienTap);
    expect(doc.status).toBe(200);
    expect(doc.body.dangDoc).toBe(false);
    const nd = await goi("GET", `/v1/documents/${E(URN_PDF_CHU)}/content?format=json&asOf=2099-06-01`);
    expect(nd.status).toBe(200);
    const [n] = (await sql`
      SELECT count(*)::int AS n FROM nodes n JOIN documents d ON d.id = n.document_id
      WHERE d.urn = ${URN_PDF_CHU} AND n.kind = 'dieu'`) as any[];
    expect(n.n).toBe(4);
    // Đã có nội dung chữ thì không đọc lại.
    expect((await goi("POST", duong, tk.bienTap)).status).toBe(409);
  });

  test("đọc tệp gốc bản quét: chưa có mô hình thì 400; có bản đã đọc thì chạy nền rồi ghi nội dung", async () => {
    // Tệp khác PDF_TRANG một dòng chú thích, để không dùng chung bản đã đọc với văn bản 902.
    const pdf = new Uint8Array([...PDF_TRANG, ...new TextEncoder().encode("% 904\n")]);
    const { tepGoc } = (await guiTep(tk.bienTap, pdf, "ban-quet-904.pdf")).body;
    const vb = { ...QUET, soKyHieu: "904/2099/NĐ-CP", tepGoc };
    expect((await goi("POST", "/v1/quan-tri/van-ban", tk.bienTap, vb)).status).toBe(201);
    const duong = `/v1/quan-tri/van-ban/${E(URN_PDF_QUET)}/doc-tep-goc`;
    expect((await goi("GET", duong, tk.bienTap)).body.state).toBeNull();

    const chuaCoAi = await goi("POST", duong, tk.bienTap);
    expect(chuaCoAi.status).toBe(400);
    expect(chuaCoAi.body.error.message).toContain("ANTHROPIC_API_KEY");

    // Bản mô hình đã đọc nằm cạnh tệp gốc (như khi chạy lại sau lỗi): không gọi mô hình nữa.
    await putText(`${tepGoc}.md`, MD_1);
    await putText(
      `${tepGoc}.json`,
      JSON.stringify({ thuocTinh: {}, soCum: 1, soChoKhongDoc: 0, soCanhBao: 0 }),
    );
    const doc = await goi("POST", duong, tk.bienTap);
    expect(doc.status).toBe(202);
    expect(doc.body.dangDoc).toBe(true);

    let tienDo: any;
    for (let i = 0; i < 100; i++) {
      tienDo = (await goi("GET", duong, tk.bienTap)).body;
      if (tienDo.state === "xong" || tienDo.state === "loi") break;
      await Bun.sleep(100);
    }
    expect(tienDo).toMatchObject({ state: "xong", error: null });
    const nd = await goi("GET", `/v1/documents/${E(URN_PDF_QUET)}/content?format=json&asOf=2099-06-01`);
    expect(nd.body.tree.children.filter((n: any) => n.kind === "dieu").length).toBe(2);
  });

  test("văn bản không có tệp gốc: /tep-goc trả 404", async () => {
    const tep = await app.request(`http://test/v1/documents/${E("vn:vbqppl:nd:100/2026/NĐ-CP")}/tep-goc`);
    expect(tep.status).toBe(404);
  });
});
