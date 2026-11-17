/**
 * Kiểm thử AI soạn bài (ke-hoach/09-a §5, 09-c §4.3) trên Postgres test thật, LLM_PROVIDER=mock:
 * tạo việc → worker soạn và hậu kiểm → Admin quản lý nhận vào bản nháp → sinh câu hỏi cho bài
 * vào ngân hàng chung → duyệt → câu hiện ở kiểm tra cuối bài.
 *
 * Điều phải giữ: không có đường nào từ mô hình tới người học khi chưa qua duyệt.
 *
 * Dữ liệu văn bản là Nghị định 100/2026/NĐ-CP của seed, hiệu lực tại ngày soạn.
 */
process.env.LLM_PROVIDER = "mock";
// Việc soạn do test tự chạy từng bước; không để API chạy nền song song.
process.env.SOAN_BAI_TRONG_API = "0";
// Test chạy worker trực tiếp; không đẩy vào Redis để worker thật (nếu đang chạy) không nhận việc.
const REDIS_GOC = process.env.REDIS_URL;
delete process.env.REDIS_URL;

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import {
  baiHocTheoId,
  chuDeCuaBaiHoc,
  datTrangThaiBaiHoc,
  datTrangThaiChuyenDe,
  luuBaiHoc,
  luuChuyenDe,
  luuKhoi,
  sql,
  vieCSoanBaiTheoId,
} from "@qdpl/db";
import { type LlmProvider, MockProvider, modelFor, setProvider } from "@qdpl/llm";
import { chaySinhCauHoi } from "../../workers-ts/src/bull/workers/sinh-cau-hoi.ts";
import { soanBaiStage } from "../../workers-ts/src/bull/workers/soan-bai.ts";
import { chaySoanTuDong } from "../../workers-ts/src/bull/workers/soan-tu-dong.ts";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-soan-bai-ai";
const BASE = "/v1/quan-tri/dao-tao";
const VB = "vn:vbqppl:nd:100/2026/NĐ-CP";
const NGAY = "2026-09-24";
const DIEU = [1, 2, 3, 4, 5, 6].map((i) => `${VB}#dieu-${i}`);

async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function goi(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Bối cảnh giả cho worker: test gọi thẳng phần việc của giai đoạn, không qua BullMQ. */
const ctx = {
  progress: async () => {},
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
} as never;

/** Tạo việc qua API rồi chạy worker ngay (test không có Redis). */
async function taoVaChay(token: string, body: Record<string, unknown>) {
  const tao = await goi("POST", `${BASE}/soan-bai`, { token, body: { batch: false, ...body } });
  expect(tao.status).toBe(200);
  const jobId = tao.body.viec.id as string;
  await soanBaiStage.handle({ data: { jobId } } as never, ctx);
  const viec = await vieCSoanBaiTheoId(jobId);
  expect(viec?.state).toBe("xong");
  return { jobId, output: viec!.output as any };
}

async function khoiCua(lessonId: string) {
  return await sql<Array<{ kind: string; source: string; data: any }>>`
    SELECT kind, source, data FROM lesson_blocks WHERE lesson_id = ${lessonId}::uuid ORDER BY ordinal`;
}

/**
 * Câu hỏi để sót lại sẽ làm test khác (so trùng câu hỏi) nhận nhầm là câu đã có, nên dọn theo
 * cả việc AI lẫn chủ đề, và lấy chủ đề của bài trước khi xóa chuyên đề.
 */
async function donDep() {
  const chuDe = await sql<Array<{ id: string }>>`
    SELECT id FROM question_topics WHERE code LIKE ${`bai-${PREFIX}%`} OR code LIKE ${`cd-${PREFIX}%`}
    UNION SELECT l.topic_id FROM lessons l JOIN courses c ON c.id = l.course_id
    WHERE c.slug LIKE ${`${PREFIX}%`} AND l.topic_id IS NOT NULL`;
  const idChuDe = chuDe.map((c) => c.id);
  await sql`
    DELETE FROM questions
    WHERE topic_id = ANY(${idChuDe}::uuid[])
       OR authoring_job_id IN (SELECT id FROM authoring_jobs WHERE requested_by LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM authoring_jobs WHERE requested_by LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM courses WHERE slug LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE id = ANY(${idChuDe}::uuid[])`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const tk = { canBo: "", quanLy: "", lanhDao: "" };
const ids = { course: "", bai: "", baiTrong: "" };
const SLUG = `${PREFIX}-chuyen-de`;

beforeAll(async () => {
  await donDep();
  tk.canBo = await taoTaiKhoan("can-bo", "can_bo");
  tk.quanLy = await taoTaiKhoan("quan-ly", "quan_ly");
  tk.lanhDao = await taoTaiKhoan("lanh-dao", "lanh_dao");
  const course = await luuChuyenDe({ slug: SLUG, title: "Chuyên đề thử AI soạn bài", asOf: NGAY });
  ids.course = course.id;
  // Chuyên đề đã xuất bản: bài của nó chỉ tới người học khi chính bài được xuất bản.
  await datTrangThaiChuyenDe(course.id, "xuat_ban");
  ids.bai = (
    await luuBaiHoc({
      courseId: course.id,
      slug: `${PREFIX}-bai-1`,
      ordinal: 1,
      title: "Bài thử AI",
      asOf: NGAY,
    })
  ).id;
  ids.baiTrong = (
    await luuBaiHoc({
      courseId: course.id,
      slug: `${PREFIX}-bai-2`,
      ordinal: 2,
      title: "Bài chưa có khối",
      asOf: NGAY,
    })
  ).id;
});

afterAll(async () => {
  setProvider(new MockProvider());
  await donDep();
  if (REDIS_GOC !== undefined) process.env.REDIS_URL = REDIS_GOC;
});

describe("soạn khối nội dung và nhận vào bản nháp", () => {
  let jobDau = "";
  let soKhoi = 0;

  test("worker soạn khối, hậu kiểm, và lưu phần qua hậu kiểm vào kết quả của việc", async () => {
    const { jobId, output } = await taoVaChay(tk.quanLy, {
      courseId: ids.course,
      lessonId: ids.bai,
      step: "soan_bai",
      input: { urns: DIEU },
    });
    jobDau = jobId;
    soKhoi = output.khoi.length;
    expect(output.biLoai).toEqual([]);
    expect(output.khoi.map((k: { kind: string }) => k.kind)).toContain("can_cu");
    expect(output.khoi.at(-1).kind).toBe("tom_tat");
    expect(output.urnNguCanh.length).toBe(DIEU.length);
    // Chưa nhận thì bài chưa có gì.
    expect((await khoiCua(ids.bai)).length).toBe(0);
  });

  test("cán bộ không nhận được (403); việc không có trả 404", async () => {
    expect((await goi("POST", `${BASE}/soan-bai/${jobDau}/nhan`, { token: tk.canBo })).status).toBe(403);
    const r = await goi("POST", `${BASE}/soan-bai/00000000-0000-0000-0000-000000000000/nhan`, {
      token: tk.quanLy,
    });
    expect(r.status).toBe(404);
  });

  test("nhận vào nháp ghi khối nguồn AI, bài chuyển sang 'AI vừa soạn'; nhận lần hai bị từ chối", async () => {
    const r = await goi("POST", `${BASE}/soan-bai/${jobDau}/nhan`, { token: tk.quanLy });
    expect(r.status).toBe(200);
    expect(r.body.soKhoi).toBe(soKhoi);

    const khoi = await khoiCua(ids.bai);
    expect(khoi.length).toBe(soKhoi);
    expect(khoi.every((k) => k.source === "ai")).toBe(true);
    const bai = await baiHocTheoId(ids.bai);
    expect(bai!.status).toBe("ai_soan");

    expect((await goi("POST", `${BASE}/soan-bai/${jobDau}/nhan`, { token: tk.quanLy })).status).toBe(409);
  });

  test("nội dung AI đã nhận chưa tới người học khi bài chưa xuất bản", async () => {
    const r = await goi("GET", `/v1/dao-tao/chuyen-de/${SLUG}/bai/${PREFIX}-bai-1`, { token: tk.canBo });
    expect(r.status).toBe(404);
  });

  test("bài đã xuất bản không nhận nội dung AI; chuyển 'cần cập nhật' rồi thay thì chỉ phần AI bị thay", async () => {
    const { jobId } = await taoVaChay(tk.quanLy, {
      courseId: ids.course,
      lessonId: ids.bai,
      step: "soan_bai",
      // Điều 5 và 6 có nội dung riêng: bài cần hai viện dẫn có chữ để lượt sinh bài tập ra được trắc nghiệm.
      input: { urns: DIEU.slice(3, 6) },
    });
    await luuKhoi({ lessonId: ids.bai, ordinal: 99, kind: "giang", data: { md: "Người viết." } });
    await datTrangThaiBaiHoc(ids.bai, "xuat_ban");

    const bi = await goi("POST", `${BASE}/soan-bai/${jobId}/nhan?cheDo=thay`, { token: tk.quanLy });
    expect(bi.status).toBe(409);
    expect(JSON.stringify(bi.body)).toContain("Cần cập nhật");

    await datTrangThaiBaiHoc(ids.bai, "can_cap_nhat");
    const r = await goi("POST", `${BASE}/soan-bai/${jobId}/nhan?cheDo=thay`, { token: tk.quanLy });
    expect(r.status).toBe(200);
    const khoi = await khoiCua(ids.bai);
    expect(khoi.filter((k) => k.source === "nguoi").length).toBe(1);
    expect(khoi.filter((k) => k.source === "ai").length).toBe(r.body.soKhoi);
    // Bài không đổi trạng thái: vẫn phải qua quản trị nội dung và phê duyệt.
    expect((await baiHocTheoId(ids.bai))!.status).toBe("can_cap_nhat");
  });

  test("khối trích sai nguyên văn hoặc viện dẫn ngoài ngữ cảnh bị loại, không vào bài", async () => {
    const giaMo: LlmProvider = {
      name: "mock",
      complete: async () => {
        const json = {
          khoi: [
            { kind: "giang", data: { md: "Mở bài." }, citations: [] },
            {
              kind: "can_cu",
              data: { urn: DIEU[0], nhan: "Điều 1", nguyen_van: "Một câu mô hình tự viết lại cho gọn." },
              citations: [DIEU[0]],
            },
            { kind: "tom_tat", data: { y: ["Ý bịa."] }, citations: ["vn:vbqppl:luat:99/2099/QH99#dieu-1"] },
          ],
        };
        return {
          text: JSON.stringify(json),
          json,
          citations: [],
          model: modelFor("bulk"),
          tokensIn: 10,
          tokensOut: 10,
          cacheReadTokens: 0,
          costUsd: 0,
        };
      },
    };
    setProvider(giaMo);
    try {
      const { output } = await taoVaChay(tk.quanLy, {
        courseId: ids.course,
        lessonId: ids.baiTrong,
        step: "soan_bai",
        input: { urns: DIEU },
      });
      expect(output.khoi.map((k: { kind: string }) => k.kind)).toEqual(["giang"]);
      expect(output.biLoai.length).toBe(2);
      expect(JSON.stringify(output.biLoai)).toContain("nguyên văn");
      expect(JSON.stringify(output.biLoai)).toContain("ngoài các điều khoản");
      // Bài chỉ còn khối giảng: thiếu thẻ căn cứ là lỗi chặn xuất bản, được báo trước khi nhận.
      expect(output.nhip.some((l: { ma: string }) => l.ma === "khong_co_can_cu")).toBe(true);
    } finally {
      setProvider(new MockProvider());
    }
  });
});

describe("sinh bài tập tự luận cho bài", () => {
  test("không nêu URN thì dùng viện dẫn của bài; nhận vào nháp ghi bài tập nguồn AI kèm rubric", async () => {
    const { jobId, output } = await taoVaChay(tk.quanLy, {
      courseId: ids.course,
      lessonId: ids.bai,
      step: "sinh_bai_tap",
      input: { dang_bai: ["viet_co_can_cu", "trac_nghiem"] },
    });
    expect(output.urnNguCanh.length).toBeGreaterThan(0);
    expect(output.biLoai).toEqual([]);
    const kinds = output.baiTap.map((b: { kind: string }) => b.kind).sort();
    expect(kinds).toEqual(["trac_nghiem", "viet_co_can_cu"]);

    const r = await goi("POST", `${BASE}/soan-bai/${jobId}/nhan`, { token: tk.quanLy });
    expect(r.status).toBe(200);
    expect(r.body.soBaiTap).toBe(2);

    const hd = await sql<
      Array<{ kind: string; mode: string; source: string; prompt: any; answer: any; rubric: any }>
    >`
      SELECT kind, mode, source, prompt, answer, rubric FROM activities
      WHERE lesson_id = ${ids.bai}::uuid AND NOT retired ORDER BY ordinal`;
    const tuLuan = hd.find((h) => h.kind === "viet_co_can_cu")!;
    expect(tuLuan.mode).toBe("ai");
    expect(tuLuan.source).toBe("ai");
    expect(tuLuan.rubric.tieu_chi.some((t: { ma: string }) => t.ma === "can_cu")).toBe(true);
    // Đáp án của trắc nghiệm không nằm trong phần đề gửi người học.
    const tracNghiem = hd.find((h) => h.kind === "trac_nghiem")!;
    expect(JSON.stringify(tracNghiem.prompt)).not.toContain('"dung"');
    expect(tracNghiem.answer.dung.length).toBe(1);
  });
});

describe("sinh câu hỏi cho bài vào ngân hàng chung", () => {
  test("cán bộ nhận 403; bài chưa có viện dẫn và không nêu URN nhận 400", async () => {
    const p = `${BASE}/bai/${ids.bai}/sinh-cau-hoi`;
    expect((await goi("POST", p, { token: tk.canBo, body: {} })).status).toBe(403);
    const r = await goi("POST", `${BASE}/bai/${ids.baiTrong}/sinh-cau-hoi`, { token: tk.quanLy, body: {} });
    expect(r.status).toBe(400);
  });

  test("chạy thử trả ước tính, không tạo việc và không tạo chủ đề", async () => {
    const r = await goi("POST", `${BASE}/bai/${ids.bai}/sinh-cau-hoi`, {
      token: tk.quanLy,
      body: { chay_thu: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.uoc_tinh.chi_phi_usd).toBeGreaterThan(0);
    expect((await baiHocTheoId(ids.bai))!.topic_id).toBeNull();
  });

  test("tạo chủ đề cho bài, sinh câu chờ duyệt; duyệt xong thì bài có kiểm tra cuối bài", async () => {
    const r = await goi("POST", `${BASE}/bai/${ids.bai}/sinh-cau-hoi`, {
      token: tk.quanLy,
      body: { so_cau: 5 },
    });
    expect(r.status).toBe(202);
    expect(r.body.chu_de.code.startsWith("bai-")).toBe(true);

    const bai = await baiHocTheoId(ids.bai);
    expect(bai!.topic_id).toBe(r.body.chu_de.id);
    const [cha] = await sql<Array<{ code: string }>>`
      SELECT p.code FROM question_topics t JOIN question_topics p ON p.id = t.parent_id
      WHERE t.id = ${bai!.topic_id}::uuid`;
    expect(cha!.code).toBe(`cd-${SLUG}`);

    const viec = await vieCSoanBaiTheoId(r.body.viec.id);
    expect(viec!.lesson_id).toBe(ids.bai);
    const kq = await chaySinhCauHoi(viec!);
    expect(kq.so_nhan).toBe(5);

    // Chưa duyệt: không có kiểm tra cuối bài.
    expect((await chuDeCuaBaiHoc(bai!.topic_id))!.so_cau).toBe(0);

    const cau = await sql<Array<{ id: string; status: string }>>`
      SELECT id, status FROM questions WHERE authoring_job_id = ${viec!.id}::uuid`;
    expect(cau.every((c) => c.status === "cho_duyet")).toBe(true);
    const duyet = await goi("POST", "/v1/quan-tri/ngan-hang/duyet-hang-loat", {
      token: tk.quanLy,
      body: { ids: cau.map((c) => c.id) },
    });
    expect(duyet.status).toBe(200);
    // Câu bị đánh dấu gần giống câu khác không đi theo duyệt hàng loạt: xác nhận rồi duyệt từng câu.
    for (const id of duyet.body.canh_bao_trung) {
      const tung = await goi("POST", `/v1/quan-tri/ngan-hang/cau-hoi/${id}/duyet`, {
        token: tk.quanLy,
        body: { xac_nhan_trung: true },
      });
      expect(tung.status).toBe(200);
    }
    expect((await chuDeCuaBaiHoc(bai!.topic_id))!.so_cau).toBe(5);
  });

  test("bài thứ hai trong chuyên đề dùng chung chủ đề chuyên đề làm cha", async () => {
    await luuKhoi({
      lessonId: ids.baiTrong,
      ordinal: 1,
      kind: "can_cu",
      data: { urn: DIEU[1], nguyen_van: "x" },
      citations: [DIEU[1]!],
    });
    const r = await goi("POST", `${BASE}/bai/${ids.baiTrong}/sinh-cau-hoi`, { token: tk.quanLy, body: {} });
    expect(r.status).toBe(202);
    const [dem] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM question_topics WHERE code LIKE ${`cd-${PREFIX}%`}`;
    expect(dem!.n).toBe(1);
  });
});

describe("soạn tự động cả chuyên đề từ văn bản", () => {
  const TEN = `${PREFIX} tự động`;
  let parentId = "";

  test("cần đúng một trong hai: chuyên đề có sẵn hoặc tên chuyên đề mới (400)", async () => {
    const p = `${BASE}/soan-tu-dong`;
    expect((await goi("POST", p, { token: tk.quanLy, body: { urns: [VB] } })).status).toBe(400);
    const caHai = { urns: [VB], course_id: ids.course, ten_chuyen_de: TEN };
    expect((await goi("POST", p, { token: tk.quanLy, body: caHai })).status).toBe(400);
    expect((await goi("POST", p, { token: tk.canBo, body: { urns: [VB], ten_chuyen_de: TEN } })).status).toBe(
      403,
    );
  });

  test("chạy thử trả điều khoản và ước tính, không tạo chuyên đề", async () => {
    const r = await goi("POST", `${BASE}/soan-tu-dong`, {
      token: tk.quanLy,
      body: { urns: [VB], ten_chuyen_de: TEN, so_bai: 3, as_of: NGAY, chay_thu: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.dieu_khoan.length).toBeGreaterThanOrEqual(6);
    expect(r.body.uoc_tinh.so_viec).toBe(1 + 3 * 3);
    expect(r.body.uoc_tinh.chi_phi_usd).toBeGreaterThan(0);
    const [dem] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM courses WHERE title = ${TEN}`;
    expect(dem!.n).toBe(0);
  });

  test("tạo chuyên đề mới, lập dàn ý, tạo bài nháp và giao việc con cho từng bài", async () => {
    const r = await goi("POST", `${BASE}/soan-tu-dong`, {
      token: tk.quanLy,
      body: { urns: [VB], ten_chuyen_de: TEN, so_bai: 3, so_cau_hoi: 4, as_of: NGAY },
    });
    expect(r.status).toBe(202);
    parentId = r.body.viec.id;
    const courseId = r.body.chuyen_de.id as string;

    const kq = await chaySoanTuDong((await vieCSoanBaiTheoId(parentId))!);
    expect(kq.so_bai).toBe(3);
    expect(kq.so_viec_con).toBe(9);

    const bai = await sql<Array<{ id: string; status: string; topic_id: string | null; source: string }>>`
      SELECT id, status, topic_id, source FROM lessons WHERE course_id = ${courseId}::uuid ORDER BY ordinal`;
    expect(bai.length).toBe(3);
    expect(bai.every((b) => b.status === "nhap" && b.topic_id && b.source === "ai")).toBe(true);

    // Chạy lại việc cha không tạo thêm bài.
    const lai = await chaySoanTuDong((await vieCSoanBaiTheoId(parentId))!);
    expect(lai.so_viec_con).toBe(9);
    const [dem] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM lessons WHERE course_id = ${courseId}::uuid`;
    expect(dem!.n).toBe(3);

    // Worker chạy từng việc con (test không có Redis).
    for (const jobId of kq.viec_con) await soanBaiStage.handle({ data: { jobId } } as never, ctx);

    for (const b of bai) {
      const khoi = await khoiCua(b.id);
      expect(khoi.length).toBeGreaterThan(0);
      expect(khoi.every((k) => k.source === "ai")).toBe(true);
      const [hd] = await sql<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM activities
        WHERE lesson_id = ${b.id}::uuid AND kind = 'viet_co_can_cu' AND source = 'ai'`;
      expect(hd!.n).toBe(1);
      const [cau] = await sql<Array<{ cho: number; duyet: number }>>`
        SELECT count(*) FILTER (WHERE status = 'cho_duyet')::int AS cho,
               count(*) FILTER (WHERE status = 'da_duyet')::int AS duyet
        FROM questions WHERE topic_id = ${b.topic_id}::uuid`;
      expect(cau!.cho).toBe(4);
      expect(cau!.duyet).toBe(0);
      // Khối đã vào bản nháp; bài chỉ là "AI vừa soạn", chưa xuất bản.
      expect((await baiHocTheoId(b.id))!.status).toBe("ai_soan");
    }
  });

  test("màn hình tiến độ gom việc con theo bài, kèm số câu chờ duyệt", async () => {
    const r = await goi("GET", `${BASE}/soan-tu-dong`, { token: tk.quanLy });
    expect(r.status).toBe(200);
    const lan = r.body.items.find((x: { id: string }) => x.id === parentId);
    expect(lan.course.title).toBe(TEN);
    expect(lan.dem).toEqual({ xong: 9 });
    expect(lan.bai.length).toBe(3);
    for (const b of lan.bai) {
      expect(b.viec.length).toBe(3);
      expect(b.so_cau_cho_duyet).toBe(4);
      const tuNhan = b.viec.filter((v: { step: string }) => v.step !== "sinh_cau_hoi_ngan_hang");
      expect(tuNhan.every((v: { applied: boolean }) => v.applied)).toBe(true);
    }
  });

  test("lọc ngân hàng theo lần soạn lấy câu của mọi việc con", async () => {
    const r = await goi("GET", `/v1/quan-tri/ngan-hang/cau-hoi?viec=${parentId}&trang_thai=cho_duyet`, {
      token: tk.quanLy,
    });
    expect(r.status).toBe(200);
    expect(r.body.tong).toBe(3 * 4);
  });

  describe("gửi phê duyệt và xuất bản cả lô bài", () => {
    let courseId = "";
    let slug = "";
    let bai: Array<{ id: string; slug: string }> = [];
    let baiRong = "";
    const trangThai = async () =>
      (
        await sql<Array<{ status: string }>>`
          SELECT status FROM lessons WHERE id = ANY(${bai.map((b) => b.id)}::uuid[]) ORDER BY ordinal`
      ).map((b) => b.status);
    const dua = (token: string, body: unknown, id = courseId) =>
      goi("POST", `${BASE}/chuyen-de/${id}/bai/trang-thai`, { token, body });
    // Nội dung bài cần đăng nhập: đọc bằng tài khoản cán bộ, như người học.
    const docBai = (baiSlug: string) =>
      goi("GET", `/v1/dao-tao/chuyen-de/${slug}/bai/${baiSlug}`, { token: tk.canBo });

    beforeAll(async () => {
      const [c] = await sql<Array<{ id: string; slug: string }>>`
        SELECT id, slug FROM courses WHERE title = ${TEN}`;
      courseId = c!.id;
      slug = c!.slug;
      bai = await sql<Array<{ id: string; slug: string }>>`
        SELECT id, slug FROM lessons WHERE course_id = ${courseId}::uuid ORDER BY ordinal`;
      baiRong = (
        await luuBaiHoc({ courseId, slug: `${PREFIX}-rong`, ordinal: 99, title: "Bài chưa có nội dung" })
      ).id;
    });

    test("cán bộ nhận 403; lãnh đạo Công an xã không xuất bản được (403); chuyên đề không có trả 404", async () => {
      expect((await dua(tk.canBo, { den: "cho_phap_che" })).status).toBe(403);
      expect((await dua(tk.canBo, { den: "xuat_ban" })).status).toBe(403);
      expect((await dua(tk.lanhDao, { den: "xuat_ban" })).status).toBe(403);
      const r = await dua(tk.quanLy, { den: "xuat_ban" }, "00000000-0000-0000-0000-000000000000");
      expect(r.status).toBe(404);
      expect(await trangThai()).toEqual(["ai_soan", "ai_soan", "ai_soan"]);
    });

    test("Admin quản lý gửi phê duyệt cả lô; bài chưa đạt bảng kiểm bị bỏ qua kèm lý do", async () => {
      const r = await dua(tk.quanLy, { den: "cho_phap_che" });
      expect(r.status).toBe(200);
      expect(r.body.da_chuyen.length).toBe(3);
      expect(r.body.bo_qua.map((b: { id: string }) => b.id)).toEqual([baiRong]);
      expect(r.body.bo_qua[0].ly_do.join(" ")).toContain("chưa có khối");
      expect(await trangThai()).toEqual(["cho_phap_che", "cho_phap_che", "cho_phap_che"]);
      expect((await baiHocTheoId(baiRong))!.status).toBe("nhap");
      // Chuyên đề chưa xuất bản: chưa bài nào tới người học.
      expect(r.body.chuyen_de).toBe("nhap");
      expect((await docBai(bai[0]!.slug)).status).toBe(404);
    });

    test("Admin quản lý xuất bản các bài đã chọn; chuyên đề xuất bản theo, bài tới người học", async () => {
      const r = await dua(tk.quanLy, { den: "xuat_ban", bai: bai.slice(0, 2).map((b) => b.id) });
      expect(r.status).toBe(200);
      expect(r.body.da_chuyen.length).toBe(2);
      expect(r.body.chuyen_de).toBe("xuat_ban");
      expect(await trangThai()).toEqual(["xuat_ban", "xuat_ban", "cho_phap_che"]);
      expect((await docBai(bai[0]!.slug)).status).toBe(200);
      expect((await docBai(bai[2]!.slug)).status).toBe(404);

      // Mỗi chặng của mỗi bài có một dòng nhật ký riêng.
      const [nk] = await sql<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM audit_log
        WHERE target = ${bai[0]!.id} AND action LIKE 'dao_tao.bai.%'`;
      expect(nk!.n).toBe(3);
    });

    test("làm lại chỉ đụng tới bài còn dang dở", async () => {
      const r = await dua(tk.quanLy, { den: "xuat_ban" });
      expect(r.status).toBe(200);
      expect(r.body.da_chuyen.map((b: { id: string }) => b.id)).toEqual([bai[2]!.id]);
      expect(r.body.bo_qua.length).toBe(1);
      expect(await trangThai()).toEqual(["xuat_ban", "xuat_ban", "xuat_ban"]);
    });
  });
});
