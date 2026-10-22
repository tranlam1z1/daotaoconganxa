/**
 * Tạo chuyên đề (POST /v1/quan-tri/dao-tao/chuyen-de-tu-pdf) và đề thi (POST
 * /v1/quan-tri/de-thi/tu-pdf) thẳng từ tệp PDF trên Postgres test thật, không có Redis: việc soạn
 * và việc sinh câu hỏi chạy ngay trong API.
 *
 * Điều phải giữ: một lần gửi tệp là đủ để có văn bản trong kho, chuyên đề với bài nháp, đề nháp
 * với câu chờ duyệt; bài vẫn là bản nháp tới khi được duyệt để xuất bản, câu hỏi vẫn chờ duyệt tới khi
 * người có quyền duyệt bấm duyệt.
 */
process.env.LLM_PROVIDER = "mock";
const REDIS_GOC = process.env.REDIS_URL;
delete process.env.REDIS_URL;
delete process.env.SOAN_BAI_TRONG_API;

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession, type Role } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { type LlmProvider, type LlmRequest, type LlmResponse, MockProvider, setProvider } from "@qdpl/llm";
import { PDFDocument } from "pdf-lib";
import { createApp } from "./app.ts";

setDefaultTimeout(60_000);

const app = createApp();
const PREFIX = "test-qdpl-tu-pdf";
const BASE = "/v1/quan-tri/dao-tao";
const URN_ND = "vn:vbqppl:nd:45/2026/NĐ-CP";
const URN_TT = "vn:vbqppl:tt:902/2099/TT-BCA";

const envCu = { backend: process.env.STORAGE_BACKEND, dir: process.env.STORAGE_DIR };
const khoDir = mkdtempSync(join(tmpdir(), "qdpl-tu-pdf-"));

const PDF_CO_CHU = new Uint8Array(
  readFileSync(join(import.meta.dir, "../../../services/docproc/tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf")),
);

const MD_QUET = `# THÔNG TƯ

## Quy định thử về việc đọc bản quét

### Điều 1. Phạm vi điều chỉnh

Thông tư này quy định thử việc đọc bản quét để soạn bài giảng.

### Điều 2. Đối tượng áp dụng

1. Cán bộ, chiến sĩ làm công tác đào tạo.

2. Tổ chức, cá nhân có liên quan.
`;

/** Giả mô hình đọc bản quét: trả Markdown và thuộc tính cố định, việc soạn bài vẫn do provider mock lo. */
class GiaDocQuet implements LlmProvider {
  readonly name = "gia-doc-quet";
  readonly daGoi: string[] = [];
  private readonly mock = new MockProvider();

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.daGoi.push(req.promptName);
    const tra = (json: unknown): LlmResponse => ({
      text: JSON.stringify(json),
      json,
      citations: [],
      model: "gia",
      tokensIn: 1,
      tokensOut: 1,
      cacheReadTokens: 0,
      costUsd: 0.01,
    });
    if (req.promptName === "convert/page-window") {
      return tra({
        markdown: MD_QUET,
        open_state: { sentence_open: false, table_open: false },
        warnings: [],
        unreadable_count: 0,
      });
    }
    if (req.promptName === "extract/metadata") {
      return tra({
        soKyHieu: "902/2099/TT-BCA",
        docType: "tt",
        title: "Quy định thử về việc đọc bản quét",
        issuer: "Bộ Công an",
        issuedDate: "2026-01-05",
        effectiveFrom: null,
        signer: { name: null },
      });
    }
    return this.mock.complete(req);
  }
}

async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function goi(method: string, path: string, token: string, body?: unknown) {
  const res = await app.request(`http://test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function guiPdf(token: string, bytes: Uint8Array, ten: string, o: Record<string, string> = {}) {
  const form = new FormData();
  form.set("tep", new File([bytes as Uint8Array<ArrayBuffer>], ten, { type: "application/pdf" }));
  for (const [k, v] of Object.entries(o)) form.set(k, v);
  const res = await app.request(`http://test${BASE}/chuyen-de-tu-pdf`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** Gửi tệp tới một đường nhận PDF, kèm các ô của biểu mẫu. */
async function guiPdfToi(path: string, token: string, bytes: Uint8Array, o: Record<string, string> = {}) {
  const form = new FormData();
  form.set("tep", new File([bytes as Uint8Array<ArrayBuffer>], "van-ban.pdf", { type: "application/pdf" }));
  for (const [k, v] of Object.entries(o)) form.set(k, v);
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** Chờ các việc AI của đề chạy nền trong API xong rồi trả chi tiết đề. */
async function choDeXong(token: string, id: string) {
  for (let i = 0; i < 300; i++) {
    const r = await goi("GET", `/v1/quan-tri/de-thi/${id}`, token);
    if (r.body?.tien_do && !r.body.tien_do.dang_chay) return r.body;
    await new Promise((x) => setTimeout(x, 100));
  }
  throw new Error("Việc sinh câu hỏi không xong trong 30 giây");
}

/** Chờ việc soạn chạy nền trong API xong rồi trả tiến độ cuối. */
async function choXong(token: string, courseId: string) {
  for (let i = 0; i < 300; i++) {
    const r = await goi("GET", `${BASE}/chuyen-de/${courseId}/soan`, token);
    if (r.body?.tien_do && !r.body.tien_do.dang_chay) return r.body.tien_do;
    await new Promise((x) => setTimeout(x, 100));
  }
  throw new Error("Việc soạn không xong trong 30 giây");
}

async function baiCua(courseId: string) {
  return await sql<Array<{ id: string; status: string; so_khoi: number }>>`
    SELECT l.id, l.status,
           (SELECT count(*)::int FROM lesson_blocks b WHERE b.lesson_id = l.id) AS so_khoi
    FROM lessons l WHERE l.course_id = ${courseId}::uuid ORDER BY l.ordinal`;
}

async function donDep() {
  const nguoi = `${PREFIX}%`;
  const khoa = await sql<Array<{ id: string }>>`
    SELECT DISTINCT course_id AS id FROM authoring_jobs
    WHERE requested_by LIKE ${nguoi} AND course_id IS NOT NULL`;
  const idKhoa = khoa.map((k) => k.id);
  const chuDe = await sql<Array<{ id: string }>>`
    SELECT topic_id AS id FROM lessons WHERE course_id = ANY(${idKhoa}::uuid[]) AND topic_id IS NOT NULL`;
  const idChuDe = chuDe.map((c) => c.id);
  await sql`
    DELETE FROM questions
    WHERE topic_id = ANY(${idChuDe}::uuid[])
       OR authoring_job_id IN (SELECT id FROM authoring_jobs WHERE requested_by LIKE ${nguoi})`;
  // Đề thi của test và chủ đề nhận câu mà mỗi đề tự tạo.
  const chuDeDe = await sql<Array<{ id: string }>>`
    SELECT DISTINCT (o->>'topic_id')::uuid AS id
    FROM exams e, jsonb_array_elements(e.matrix) AS o WHERE e.created_by LIKE ${nguoi}`;
  const idChuDeDe = chuDeDe.map((c) => c.id);
  await sql`DELETE FROM questions WHERE topic_id = ANY(${idChuDeDe}::uuid[])`;
  await sql`DELETE FROM exams WHERE created_by LIKE ${nguoi}`;
  await sql`DELETE FROM authoring_jobs WHERE requested_by LIKE ${nguoi}`;
  await sql`DELETE FROM courses WHERE id = ANY(${idKhoa}::uuid[])`;
  await sql`DELETE FROM question_topics WHERE id = ANY(${[...idChuDe, ...idChuDeDe]}::uuid[])`;
  for (const urn of [URN_ND, URN_TT]) {
    await sql`DELETE FROM citations WHERE node_urn LIKE ${`${urn}%`}`;
    await sql`DELETE FROM documents WHERE urn = ${urn}`;
  }
  await sql`DELETE FROM accounts WHERE email LIKE ${nguoi}`;
}

const tk = { canBo: "", quanLy: "", lanhDao: "", quanTri: "" };

beforeAll(async () => {
  process.env.STORAGE_BACKEND = "local";
  process.env.STORAGE_DIR = khoDir;
  await donDep();
  tk.canBo = await taoTaiKhoan("can-bo", "can_bo");
  tk.quanLy = await taoTaiKhoan("quan-ly", "quan_ly");
  tk.lanhDao = await taoTaiKhoan("lanh-dao", "lanh_dao");
  tk.quanTri = await taoTaiKhoan("quan-tri", "quan_tri");
});

afterAll(async () => {
  setProvider(new MockProvider());
  await donDep();
  rmSync(khoDir, { recursive: true, force: true });
  if (REDIS_GOC) process.env.REDIS_URL = REDIS_GOC;
  if (envCu.backend) process.env.STORAGE_BACKEND = envCu.backend;
  else delete process.env.STORAGE_BACKEND;
  if (envCu.dir) process.env.STORAGE_DIR = envCu.dir;
  else delete process.env.STORAGE_DIR;
});

describe("PDF có lớp chữ", () => {
  let courseId = "";

  test("cán bộ không được tạo (403), thiếu tệp trả 400", async () => {
    expect((await guiPdf(tk.canBo, PDF_CO_CHU, "nd-45.pdf")).status).toBe(403);
    const res = await app.request(`http://test${BASE}/chuyen-de-tu-pdf`, {
      method: "POST",
      headers: { authorization: `Bearer ${tk.quanLy}` },
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  test("một lần gửi tệp: lưu văn bản, tạo chuyên đề mang tên văn bản, AI soạn bài nháp", async () => {
    const r = await guiPdf(tk.quanLy, PDF_CO_CHU, "nd-45.pdf", { tu_luan: "1", trac_nghiem: "1" });
    expect(r.status).toBe(202);
    expect(r.body.ban_quet).toBe(false);
    expect(r.body.van_ban).toMatchObject({ urn: URN_ND, moi: true });
    expect(r.body.chuyen_de.title).toContain("45/2026/NĐ-CP");
    courseId = r.body.chuyen_de.id;

    const [vb] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM nodes n JOIN document_versions v ON v.id = n.version_id
      JOIN documents d ON d.id = v.document_id WHERE d.urn = ${URN_ND} AND n.kind = 'dieu'`;
    expect(vb!.n).toBe(4);

    const td = await choXong(tk.quanLy, courseId);
    expect(td.doc_pdf).toBeNull();
    expect(td.soan.state).toBe("xong");
    expect(td.con_loi).toBe(false);
    // Bốn Điều thành một bài; mỗi bài ba việc: khối nội dung, tự luận, trắc nghiệm.
    expect(td.soan.so_viec).toBe(3);
    expect(td.soan.xong).toBe(3);

    const bai = await baiCua(courseId);
    expect(bai.length).toBe(1);
    expect(bai[0]!.status).toBe("ai_soan");
    expect(bai[0]!.so_khoi).toBeGreaterThan(0);
    const [hd] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM activities WHERE lesson_id = ${bai[0]!.id}::uuid`;
    expect(hd!.n).toBe(1);
  });

  test("gửi lại cùng văn bản, tắt tự luận và trắc nghiệm: dùng lại văn bản, chỉ soạn khối nội dung", async () => {
    const r = await guiPdf(tk.quanLy, PDF_CO_CHU, "nd-45.pdf");
    expect(r.status).toBe(202);
    expect(r.body.van_ban).toMatchObject({ urn: URN_ND, moi: false });
    expect(r.body.chuyen_de.id).not.toBe(courseId);
    const td = await choXong(tk.quanLy, r.body.chuyen_de.id);
    expect(td.soan.so_viec).toBe(1);
    const bai = await baiCua(r.body.chuyen_de.id);
    const [hd] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM activities WHERE lesson_id = ${bai[0]!.id}::uuid`;
    expect(hd!.n).toBe(0);
  });

  test("xuất bản cả chuyên đề bằng một lần gọi vẫn cần vai trò Admin quản lý trở lên", async () => {
    const p = `${BASE}/chuyen-de/${courseId}/bai/trang-thai`;
    expect((await goi("POST", p, tk.canBo, { den: "xuat_ban" })).status).toBe(403);
    expect((await goi("POST", p, tk.lanhDao, { den: "xuat_ban" })).status).toBe(403);
    const r = await goi("POST", p, tk.quanLy, { den: "xuat_ban" });
    expect(r.status).toBe(200);
    expect(r.body.da_chuyen.length + r.body.bo_qua.length).toBe(1);
  });

  test("không còn gì dang dở thì chạy tiếp không làm gì thêm", async () => {
    const r = await goi("POST", `${BASE}/chuyen-de/${courseId}/soan-tiep`, tk.quanLy, {});
    expect(r.status).toBe(200);
    const td = await choXong(tk.quanLy, courseId);
    expect(td.soan.so_viec).toBe(3);
    expect((await baiCua(courseId)).length).toBe(1);
  });
});

describe("PDF bản quét", () => {
  let pdfQuet: Uint8Array;

  beforeAll(async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    pdfQuet = await doc.save();
  });

  test("chưa cấu hình mô hình thì báo rõ, không tạo chuyên đề", async () => {
    const [truoc] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM courses`;
    const r = await guiPdf(tk.quanLy, pdfQuet, "thong-tu-quet.pdf");
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("bản quét");
    const [sau] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM courses`;
    expect(sau!.n).toBe(truoc!.n);
  });

  test("mô hình đọc từng cụm trang, lưu văn bản, đổi tên chuyên đề rồi soạn bài", async () => {
    const gia = new GiaDocQuet();
    setProvider(gia);
    const r = await guiPdf(tk.quanLy, pdfQuet, "thong-tu-quet.pdf", { tu_luan: "1" });
    expect(r.status).toBe(202);
    expect(r.body.ban_quet).toBe(true);
    expect(r.body.chuyen_de.title).toContain("thong-tu-quet");

    const td = await choXong(tk.quanLy, r.body.chuyen_de.id);
    expect(td.doc_pdf).toMatchObject({ state: "xong", so_trang: 2, so_cum: 1 });
    expect(td.soan.state).toBe("xong");
    expect(td.con_loi).toBe(false);
    expect(gia.daGoi.filter((p) => p === "convert/page-window").length).toBe(1);
    expect(gia.daGoi).toContain("extract/metadata");

    const [cd] = await sql<Array<{ title: string }>>`
      SELECT title FROM courses WHERE id = ${r.body.chuyen_de.id}::uuid`;
    expect(cd!.title).toBe("Thông tư 902/2099/TT-BCA: Quy định thử về việc đọc bản quét");
    const [vb] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM documents WHERE urn = ${URN_TT}`;
    expect(vb!.n).toBe(1);
    const bai = await baiCua(r.body.chuyen_de.id);
    expect(bai.length).toBe(1);
    expect(bai[0]!.so_khoi).toBeGreaterThan(0);
  });
});

describe("đề thi từ PDF", () => {
  const DE = "/v1/quan-tri/de-thi";
  let deId = "";

  test("chỉ quản trị viên tạo được đề (403), mẫu cấu trúc lạ trả 400", async () => {
    expect((await guiPdfToi(`${DE}/tu-pdf`, tk.lanhDao, PDF_CO_CHU, { mau: "15" })).status).toBe(403);
    expect((await guiPdfToi(`${DE}/tu-pdf`, tk.quanTri, PDF_CO_CHU, { mau: "7" })).status).toBe(400);
  });

  test("một lần gửi tệp: đề nháp mang tên văn bản, ma trận theo mẫu, AI sinh câu chờ duyệt", async () => {
    setProvider(new MockProvider());
    const r = await guiPdfToi(`${DE}/tu-pdf`, tk.quanTri, PDF_CO_CHU, { mau: "15" });
    expect(r.status).toBe(202);
    expect(r.body.chuyen_de).toBeNull();
    expect(r.body.de_thi.title).toBe("Kiểm tra Nghị định 45/2026/NĐ-CP");
    deId = r.body.de_thi.id;

    const de = await choDeXong(tk.quanTri, deId);
    expect(de.item.status).toBe("nhap");
    expect(de.item.question_count).toBe(10);
    expect(de.item.duration_minutes).toBe(15);
    expect(de.tien_do).toMatchObject({ doc_pdf: null, con_loi: false, so_viec: 3, xong: 3 });
    // Chưa câu nào được duyệt nên đề chưa xuất bản được bằng nút xuất bản thường.
    expect((await goi("POST", `${DE}/${deId}/trang-thai`, tk.quanTri, { status: "xuat_ban" })).status).toBe(
      400,
    );

    const cho = await goi("GET", `${DE}/${deId}/cau-cho-duyet`, tk.quanTri);
    expect(cho.status).toBe(200);
    expect(cho.body.items.length).toBeGreaterThan(0);
    expect(cho.body.items[0].de.stem.length).toBeGreaterThan(0);
    expect(cho.body.items[0].noi_dung.answer).toBeDefined();
  });

  test("một nút duyệt hết câu AI của đề; đề chỉ xuất bản khi ma trận đủ câu đã duyệt", async () => {
    const [truoc] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM questions q JOIN exams e ON q.authoring_job_id = ANY(e.authoring_job_ids)
      WHERE e.id = ${deId} AND q.status = 'cho_duyet'`;
    const r = await goi("POST", `${DE}/${deId}/duyet-xuat-ban`, tk.quanTri, {});
    const [sau] = await sql<Array<{ cho: number; duyet: number }>>`
      SELECT count(*) FILTER (WHERE q.status = 'cho_duyet')::int AS cho,
             count(*) FILTER (WHERE q.status = 'da_duyet')::int AS duyet
      FROM questions q JOIN exams e ON q.authoring_job_id = ANY(e.authoring_job_ids) WHERE e.id = ${deId}`;
    expect(sau!.cho).toBe(0);
    expect(sau!.duyet).toBe(truoc!.n);
    const de = await goi("GET", `${DE}/${deId}`, tk.quanTri);
    expect(r.status).toBe(200);
    expect(r.body.da_duyet).toBe(truoc!.n);
    expect(de.body.canh_bao).toEqual([]);
    expect(de.body.item.status).toBe("xuat_ban");
    // Đề đã xuất bản thì không duyệt và xuất bản lần nữa.
    expect((await goi("POST", `${DE}/${deId}/duyet-xuat-ban`, tk.quanTri, {})).status).toBe(409);
  });

  test("câu bị từ chối làm ma trận thiếu câu: duyệt phần còn lại nhưng đề ở lại bản nháp", async () => {
    const r = await guiPdfToi(`${DE}/tu-pdf`, tk.quanTri, PDF_CO_CHU, { mau: "15" });
    const id = r.body.de_thi.id as string;
    await choDeXong(tk.quanTri, id);
    await sql`
      UPDATE questions q SET status = 'tu_choi' FROM exams e
      WHERE e.id = ${id} AND q.authoring_job_id = ANY(e.authoring_job_ids) AND q.level = 'kho'`;
    const kq = await goi("POST", `${DE}/${id}/duyet-xuat-ban`, tk.quanTri, {});
    expect(kq.status).toBe(400);
    expect(kq.body.error.message).toContain("chưa xuất bản được");
    const de = await goi("GET", `${DE}/${id}`, tk.quanTri);
    expect(de.body.item.status).toBe("nhap");
    expect(de.body.canh_bao.length).toBeGreaterThan(0);
    expect((await goi("GET", `${DE}/${id}/cau-cho-duyet`, tk.quanTri)).body.items).toEqual([]);
  });

  test("ô tích ở trang chuyên đề: một tệp tạo cả chuyên đề lẫn đề thi, chỉ quản trị viên", async () => {
    const p = "/v1/quan-tri/dao-tao/chuyen-de-tu-pdf";
    expect((await guiPdfToi(p, tk.quanLy, PDF_CO_CHU, { tao_de_thi: "1", mau_de: "15" })).status).toBe(403);
    const r = await guiPdfToi(p, tk.quanTri, PDF_CO_CHU, { tao_de_thi: "1", mau_de: "15" });
    expect(r.status).toBe(202);
    expect(r.body.chuyen_de.title).toContain("45/2026/NĐ-CP");
    expect(r.body.de_thi.title).toBe("Kiểm tra Nghị định 45/2026/NĐ-CP");
    await choXong(tk.quanTri, r.body.chuyen_de.id);
    const de = await choDeXong(tk.quanTri, r.body.de_thi.id);
    expect(de.tien_do.con_loi).toBe(false);
    expect((await baiCua(r.body.chuyen_de.id)).length).toBe(1);
  });

  test("bản quét: đề nháp có ngay để theo dõi, đọc xong thì đổi tên theo văn bản và sinh câu", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    setProvider(new GiaDocQuet());
    const r = await guiPdfToi(`${DE}/tu-pdf`, tk.quanTri, await doc.save(), { mau: "15" });
    expect(r.status).toBe(202);
    expect(r.body.ban_quet).toBe(true);
    expect(r.body.de_thi.title).toContain("Đang đọc tệp");

    const de = await choDeXong(tk.quanTri, r.body.de_thi.id);
    expect(de.item.title).toBe("Kiểm tra Thông tư 902/2099/TT-BCA");
    expect(de.item.question_count).toBe(10);
    expect(de.tien_do.doc_pdf).toMatchObject({ state: "xong", so_trang: 2 });
    expect(de.tien_do).toMatchObject({ con_loi: false, so_viec: 3, xong: 3 });
    // Không còn gì dang dở thì chạy tiếp không làm gì thêm.
    const tiep = await goi("POST", `${DE}/${r.body.de_thi.id}/sinh-tiep`, tk.quanTri, {});
    expect(tiep.body.da_chay).toBe(false);
  });
});
