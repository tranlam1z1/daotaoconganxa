/**
 * Kiểm thử học viên làm câu tự luận trong bài học (ke-hoach/09-a §4.3) trên Postgres test thật,
 * LLM_PROVIDER=mock: nộp → AI chấm theo rubric → hậu kiểm bằng chứng → kết quả hiện lại ở trang
 * bài → phúc khảo vào hàng chấm lại của giảng viên.
 *
 * Mock chấm: bài từ 200 ký tự được mức cao nhất mỗi tiêu chí; tiêu chí căn cứ chỉ có điểm khi bài
 * nhắc "Điều <số>".
 */
process.env.LLM_PROVIDER = "mock";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import { datTrangThaiBaiHoc, datTrangThaiChuyenDe, luuBaiHoc, luuChuyenDe, luuHoatDong, sql } from "@qdpl/db";
import { type LlmProvider, MockProvider, modelFor, setProvider } from "@qdpl/llm";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-cham-tu-luan";
const SLUG = `${PREFIX}-chuyen-de`;
const BAI = `${PREFIX}-bai`;
const NGAY = "2026-09-24";
const URN = "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-2";

const rubric = {
  tieu_chi: [
    {
      ma: "can_cu",
      ten: "Viện dẫn đúng và còn hiệu lực",
      trong_so: 50,
      muc: [
        { diem: 0, mo_ta: "Không viện dẫn hoặc dùng văn bản hết hiệu lực" },
        { diem: 50, mo_ta: "Viện dẫn đúng điều khoản còn hiệu lực" },
      ],
    },
    {
      ma: "lap_luan",
      ten: "Lập luận",
      trong_so: 30,
      muc: [
        { diem: 0, mo_ta: "Không" },
        { diem: 30, mo_ta: "Đúng" },
      ],
    },
    {
      ma: "trinh_bay",
      ten: "Trình bày",
      trong_so: 20,
      muc: [
        { diem: 0, mo_ta: "Khó hiểu" },
        { diem: 20, mo_ta: "Rõ" },
      ],
    },
  ],
  nguong_dat: 60,
};

const DAI =
  "Người điều khiển phương tiện cần nắm rõ quy định để áp dụng đúng trong lúc làm nhiệm vụ. ".repeat(3);
const BAI_TOT = `Theo Điều 2 Nghị định 100/2026/NĐ-CP, ${DAI}`;
const BAI_KHONG_CAN_CU = `Theo quy định hiện hành, ${DAI}`;

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

async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function donDep() {
  await sql`DELETE FROM courses WHERE slug LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Provider giả trả đúng một kết quả cho mọi lời gọi, hoặc ném lỗi. */
function giaMo(ketQua: unknown | Error): LlmProvider {
  return {
    name: "mock",
    complete: async () => {
      if (ketQua instanceof Error) throw ketQua;
      return {
        text: JSON.stringify(ketQua),
        json: ketQua,
        citations: [],
        model: modelFor("bulk"),
        tokensIn: 10,
        tokensOut: 10,
        cacheReadTokens: 0,
        costUsd: 0,
      };
    },
  };
}

let token = "";
let ghiDanhId = "";
let hdId = "";

const nop = (baiViet: string) =>
  goi("POST", `/v1/dao-tao/hoat-dong/${hdId}/nop`, {
    token,
    body: { ghiDanhId, traLoi: { bai_viet: baiViet } },
  });

beforeAll(async () => {
  await donDep();
  token = await taoTaiKhoan("hoc-vien", "can_bo");
  const course = await luuChuyenDe({ slug: SLUG, title: "Chuyên đề thử chấm tự luận", asOf: NGAY });
  await datTrangThaiChuyenDe(course.id, "xuat_ban");
  const bai = await luuBaiHoc({ courseId: course.id, slug: BAI, ordinal: 1, title: "Bài thử", asOf: NGAY });
  await datTrangThaiBaiHoc(bai.id, "xuat_ban");
  hdId = (
    await luuHoatDong({
      courseId: course.id,
      lessonId: bai.id,
      kind: "viet_co_can_cu",
      mode: "ai",
      title: "Giải thích Điều 2",
      prompt: { cau_hoi: "Giải thích nghĩa vụ mang giấy phép lái xe.", huong_dan: "Viết 150–300 từ." },
      answer: { giai_thich: "Đáp án mẫu chỉ người chấm thấy." },
      rubric,
      citations: [URN],
      points: 10,
      source: "ai",
    })
  ).id;
  const gd = await goi("POST", `/v1/dao-tao/chuyen-de/${SLUG}/ghi-danh`, { token, body: {} });
  ghiDanhId = gd.body.ghiDanh.id;
});

afterAll(async () => {
  setProvider(new MockProvider());
  await donDep();
});

describe("học viên làm câu tự luận", () => {
  test("trang bài trả câu tự luận không kèm đáp án mẫu hay rubric", async () => {
    const r = await goi("GET", `/v1/dao-tao/chuyen-de/${SLUG}/bai/${BAI}`, { token });
    expect(r.status).toBe(200);
    const hd = r.body.hoatDong.find((h: { id: string }) => h.id === hdId);
    expect(hd.kind).toBe("viet_co_can_cu");
    expect(hd.luotGanNhat).toBeNull();
    expect(JSON.stringify(hd)).not.toContain("Đáp án mẫu");
    expect(hd.rubric).toBeUndefined();
  });

  test("bài quá ngắn bị từ chối (400), không tốn lượt chấm", async () => {
    expect((await nop("Ngắn quá.")).status).toBe(400);
  });

  test("bài có viện dẫn được AI chấm đạt, kèm nhận xét và bằng chứng từng tiêu chí", async () => {
    const r = await nop(BAI_TOT);
    expect(r.status).toBe(200);
    const kq = r.body.ketQua;
    expect(kq.choCham).toBe(false);
    expect(kq.passed).toBe(true);
    expect(kq.score).toBe(10);
    expect(kq.feedback.tieu_chi.length).toBe(3);
    expect(
      kq.feedback.tieu_chi.every((t: { bang_chung?: string }) => BAI_TOT.includes(t.bang_chung ?? "∅")),
    ).toBe(true);
    const [luot] = await sql<Array<{ graded_by: string; model: string | null }>>`
      SELECT graded_by, model FROM attempts WHERE id = ${kq.attemptId}::uuid`;
    expect(luot!.graded_by).toBe("ai");
    expect(luot!.model).toBeTruthy();
  });

  test("bài không viện dẫn mất trọn tiêu chí căn cứ nên không đạt", async () => {
    const kq = (await nop(BAI_KHONG_CAN_CU)).body.ketQua;
    expect(kq.passed).toBe(false);
    expect(kq.score).toBe(5);
  });

  test("trang bài hiện lại bài vừa nộp và kết quả", async () => {
    const r = await goi("GET", `/v1/dao-tao/chuyen-de/${SLUG}/bai/${BAI}`, { token });
    const l = r.body.hoatDong.find((h: { id: string }) => h.id === hdId).luotGanNhat;
    expect(l.traLoi.bai_viet).toBe(BAI_KHONG_CAN_CU);
    expect(l.score).toBe(5);
    expect(l.attemptNo).toBe(2);
  });

  test("điểm AI cho mà không có bằng chứng trong bài thì bị gỡ về 0", async () => {
    setProvider(
      giaMo({
        tieu_chi: rubric.tieu_chi.map((t) => ({
          ma: t.ma,
          diem: Math.max(...t.muc.map((m) => m.diem)),
          bang_chung: "Một đoạn người học không hề viết ra trong bài",
        })),
        tom_tat: "Xuất sắc.",
      }),
    );
    try {
      const kq = (await nop(BAI_TOT)).body.ketQua;
      expect(kq.score).toBe(0);
      expect(kq.passed).toBe(false);
    } finally {
      setProvider(new MockProvider());
    }
  });

  test("AI lỗi thì bài sang giảng viên chấm, không bịa điểm", async () => {
    setProvider(giaMo(new Error("mất kết nối")));
    try {
      const kq = (await nop(BAI_TOT)).body.ketQua;
      expect(kq.choCham).toBe(true);
      expect(kq.score).toBe(0);
      const [luot] = await sql<Array<{ graded_by: string; review_state: string | null }>>`
        SELECT graded_by, review_state FROM attempts WHERE id = ${kq.attemptId}::uuid`;
      expect(luot!.graded_by).toBe("nguoi");
      expect(luot!.review_state).toBe("cho_doi_chieu");
    } finally {
      setProvider(new MockProvider());
    }
  });

  test("tối đa 5 lượt AI chấm trong 24 giờ (409)", async () => {
    // Đã có 3 lượt AI chấm; lượt AI lỗi ở trên do giảng viên chấm nên không tính.
    expect((await nop(BAI_TOT)).status).toBe(200);
    expect((await nop(BAI_TOT)).status).toBe(200);
    expect((await nop(BAI_TOT)).status).toBe(409);
  });

  test("phúc khảo đưa lượt AI chấm gần nhất vào hàng chấm lại, chỉ một lần", async () => {
    // Lượt AI chấm được lấy mẫu ngẫu nhiên vào hàng đối chiếu; xóa dấu để test tất định.
    await sql`
      UPDATE attempts SET review_state = NULL
      WHERE id = (SELECT id FROM attempts WHERE enrollment_id = ${ghiDanhId}::uuid ORDER BY created_at DESC LIMIT 1)`;
    const p = `/v1/dao-tao/hoat-dong/${hdId}/phuc-khao`;
    const r = await goi("POST", p, { token, body: { ghiDanhId, lyDo: "Tôi đã viện dẫn đúng Điều 2." } });
    expect(r.status).toBe(200);
    expect((await goi("POST", p, { token, body: { ghiDanhId, lyDo: "Gửi lại lần nữa." } })).status).toBe(409);

    const bai = await goi("GET", `/v1/dao-tao/chuyen-de/${SLUG}/bai/${BAI}`, { token });
    const l = bai.body.hoatDong.find((h: { id: string }) => h.id === hdId).luotGanNhat;
    expect(l.choGiangVien).toBe(true);
    expect(l.feedback.phuc_khao.ly_do).toContain("Điều 2");
  });

  test("người khác không phúc khảo được ghi danh không phải của mình (403)", async () => {
    const khac = await taoTaiKhoan("nguoi-khac", "can_bo");
    const r = await goi("POST", `/v1/dao-tao/hoat-dong/${hdId}/phuc-khao`, {
      token: khac,
      body: { ghiDanhId, lyDo: "Không phải bài của tôi." },
    });
    expect(r.status).toBe(403);
  });
});

describe("giảng viên chấm tự luận trong bài học", () => {
  const HANG = "/v1/quan-tri/dao-tao/cham-lai";
  const TOI_DA = { can_cu: 50, lap_luan: 30, trinh_bay: 20 };
  let gv = "";
  let cuaToi: Array<Record<string, any>> = [];

  beforeAll(async () => {
    gv = await taoTaiKhoan("giang-vien", "quan_ly");
  });

  test("học viên không vào được hàng chấm (403)", async () => {
    expect((await goi("GET", HANG, { token })).status).toBe(403);
  });

  test("hàng chấm kèm đề bài, bài làm, người làm; bài AI chưa chấm được đứng đầu", async () => {
    const r = await goi("GET", HANG, { token: gv });
    expect(r.status).toBe(200);
    cuaToi = r.body.items.filter((i: { enrollment_id: string }) => i.enrollment_id === ghiDanhId);
    const dau = cuaToi[0]!;
    expect(dau.graded_by).toBe("nguoi");
    expect(dau.prompt.cau_hoi).toContain("giấy phép lái xe");
    expect(dau.response.bai_viet).toBe(BAI_TOT);
    expect(dau.account_name).toContain(PREFIX);
    expect(cuaToi.some((i) => i.feedback.phuc_khao)).toBe(true);
  });

  test("chấm bài AI chưa chấm được: điểm theo tiêu chí, đạt, rời hàng chấm, giữ điểm AI", async () => {
    const id = cuaToi[0]!.id;
    const r = await goi("POST", `${HANG}/${id}`, { token: gv, body: { diem: TOI_DA, nhan_xet: "Bài tốt." } });
    expect(r.status).toBe(200);
    expect(Number(r.body.luot.reviewer_score)).toBe(10);
    expect(r.body.luot.passed).toBe(true);
    expect(Number(r.body.luot.score)).toBe(0);
    expect(r.body.luot.feedback.giang_vien.tom_tat).toBe("Bài tốt.");
    const sau = await goi("GET", HANG, { token: gv });
    expect(sau.body.items.some((i: { id: string }) => i.id === id)).toBe(false);
  });

  test("phúc khảo: điểm giảng viên là điểm cuối, học viên thấy ở trang bài", async () => {
    const luot = cuaToi.find((i) => i.feedback.phuc_khao)!;
    const r = await goi("POST", `${HANG}/${luot.id}`, {
      token: gv,
      body: { diem: { can_cu: 0, lap_luan: 30, trinh_bay: 20 } },
    });
    expect(Number(r.body.luot.reviewer_score)).toBe(5);
    expect(r.body.luot.passed).toBe(false);

    const bai = await goi("GET", `/v1/dao-tao/chuyen-de/${SLUG}/bai/${BAI}`, { token });
    const l = bai.body.hoatDong.find((h: { id: string }) => h.id === hdId).luotGanNhat;
    expect(l.diemGiangVien).toBe(5);
    expect(l.passed).toBe(false);
    expect(l.choGiangVien).toBe(false);
    expect(l.feedback.giang_vien.tieu_chi.find((t: { ma: string }) => t.ma === "can_cu").diem).toBe(0);
    // Nhận xét của AI còn nguyên để đối chiếu.
    expect(l.feedback.tieu_chi.length).toBe(3);
  });

  test("lượt không có thì 404", async () => {
    const r = await goi("POST", `${HANG}/00000000-0000-4000-8000-000000000000`, {
      token: gv,
      body: { diem: TOI_DA },
    });
    expect(r.status).toBe(404);
  });
});
