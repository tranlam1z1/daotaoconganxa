/**
 * Đề thi kết hợp trắc nghiệm + tự luận qua API, trên Postgres test thật, LLM_PROVIDER=mock.
 *
 * Mock chấm tự luận: bài từ 200 ký tự được mức cao nhất mỗi tiêu chí; tiêu chí `can_cu` chỉ có
 * điểm khi bài nhắc "Điều <số>". Ca mô hình lỗi dùng provider ném lỗi.
 *
 * Đề mẫu: 10 câu trắc nghiệm × 0,5 điểm + 2 câu tự luận × 5 điểm = 15 điểm.
 */
process.env.LLM_PROVIDER = "mock";

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { RUBRIC_TU_LUAN_MAC_DINH } from "@qdpl/dao-tao";
import {
  chamTuLuanConTon,
  chamTuLuanCuaLuot,
  layLuot,
  nguonTheoChuDe,
  nopLuot,
  sql,
  taoDonVi,
  tuNopLuotQuaHan,
} from "@qdpl/db";
import { goiMoHinhChamTuLuan, type LlmProvider, MockProvider, setProvider } from "@qdpl/llm";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-thi-tu-luan";

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

/** Provider đếm số lượt gọi chấm tự luận, chấm như mock. */
class DemCham implements LlmProvider {
  readonly name = "dem-cham";
  soLan = 0;
  private mock = new MockProvider();
  async complete(req: Parameters<LlmProvider["complete"]>[0]) {
    if (req.promptName === "dao-tao/cham-tu-luan") this.soLan += 1;
    // Chậm một chút để hai lời gọi đồng thời thật sự chồng lên nhau.
    await new Promise((r) => setTimeout(r, 30));
    return this.mock.complete(req);
  }
}

const moHinhLoi: LlmProvider = {
  name: "loi",
  async complete() {
    throw new Error("mô hình không trả lời");
  },
};

const BAI_TOT = `Theo Điều 5 Nghị định 168/2024/NĐ-CP, ${"tổ tuần tra lập biên bản, xác định hành vi và thẩm quyền xử phạt theo đúng trình tự. ".repeat(3)}`;

const tk = { quanTri: "", bienTap: "", canBo: "" };
let donVi = "";
let chuDe = "";

async function taoTaiKhoan(ten: string, role: string, unitId: string | null): Promise<string> {
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id) VALUES (${`${PREFIX}-${ten}`}, ${ten}, ${role}, ${unitId})
    RETURNING id`) as any[];
  return (await createSession(row.id, "test")).token;
}

async function donDep() {
  await sql`DELETE FROM exams WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  const ids = ((await sql`SELECT id FROM accounts WHERE username LIKE ${`${PREFIX}%`}`) as any[]).map(
    (r) => r.id,
  );
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM access_log WHERE account_id = ANY(${ids}::uuid[])`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await donDep();
  donVi = (await taoDonVi({ code: `${PREFIX}-dv`, name: "Đơn vị thử tự luận" }, `${PREFIX}-seed`)).id;
  tk.quanTri = await taoTaiKhoan("quan-tri", "quan_tri", null);
  tk.bienTap = await taoTaiKhoan("bien-tap", "bien_tap", null);
  tk.canBo = await taoTaiKhoan("can-bo", "can_bo", donVi);

  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-cd`}, 'Xử phạt (thử tự luận)') RETURNING id`) as any[];
  chuDe = t.id;
  for (let i = 1; i <= 10; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-tn-${i}`}, ${chuDe}, 'de', 'mot_dap_an', ${`Câu trắc nghiệm ${i}`},
              ${sql.json({ phuong_an: ["a", "b", "c"].map((x) => ({ id: x, text: `Phương án ${x}` })) })},
              ${sql.json({ dung: ["c"] })}, 'Giải thích.', 'da_duyet')`;
  }
  for (let i = 1; i <= 3; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, explanation, citations, rubric, status, offline_ok)
      VALUES (${`${PREFIX}-tl-${i}`}, ${chuDe}, 'kho', 'tu_luan', ${`Tình huống tự luận ${i}`},
              'Đáp án gợi ý: viện dẫn Điều 5.', ${["vn:vbqppl:nd:168/2024/NĐ-CP"]},
              ${sql.json(RUBRIC_TU_LUAN_MAC_DINH as never)}, 'da_duyet', false)`;
  }
});

afterAll(donDep);
afterEach(() => setProvider(new MockProvider()));

const MA_TRAN = () => [
  { topic_id: chuDe, level: "de", so_cau: 10, dang: "trac_nghiem", diem_moi_cau: 0.5 },
  { topic_id: chuDe, level: "kho", so_cau: 2, dang: "tu_luan", diem_moi_cau: 5 },
];

/** Tạo đề kết hợp, xuất bản, giao cho đơn vị của cán bộ; trả id bài giao. */
async function taoVaGiao(ten: string): Promise<string> {
  const tao = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
    title: `${PREFIX} ${ten}`,
    matrix: MA_TRAN(),
    duration_minutes: 30,
    pass_score: 60,
    max_attempts: 10,
    shuffle_questions: false,
  });
  expect(tao.status).toBe(201);
  expect(tao.body.canh_bao).toEqual([]);
  expect(tao.body.item.question_count).toBe(12);
  const xb = await goi("POST", `/v1/quan-tri/de-thi/${tao.body.item.id}/trang-thai`, tk.quanTri, {
    status: "xuat_ban",
  });
  expect(xb.status).toBe(200);
  const giao = await goi("POST", "/v1/giao-bai", tk.quanTri, {
    exam_id: tao.body.item.id,
    unit_id: donVi,
    due_at: new Date(Date.now() + 86_400_000).toISOString(),
  });
  expect(giao.status).toBe(201);
  return giao.body.item.id;
}

/** Bắt đầu lượt, làm đúng hết trắc nghiệm; câu tự luận đầu viết `baiViet`, câu sau bỏ trống. */
async function lamBai(giaoBai: string, baiViet: string): Promise<string> {
  const bd = await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBo);
  expect(bd.status).toBe(201);
  const luotId = bd.body.luot_id as string;
  const de = await goi("GET", `/v1/thi/luot/${luotId}`, tk.canBo);
  expect(de.status).toBe(200);
  // Trước khi nộp: không lộ rubric, đáp án gợi ý hay căn cứ của câu tự luận.
  const chu = JSON.stringify(de.body);
  expect(chu).not.toContain("tieu_chi");
  expect(chu).not.toContain("Đáp án gợi ý");
  let daViet = false;
  for (const c of de.body.cau) {
    let traLoi: Record<string, unknown> = { chon: ["c"] };
    if (c.de.kind === "tu_luan") {
      traLoi = { bai_viet: daViet ? "" : baiViet };
      daViet = true;
    }
    const r = await goi("PUT", `/v1/thi/luot/${luotId}/cau/${c.thu_tu}`, tk.canBo, { tra_loi: traLoi });
    expect(r.status).toBe(200);
  }
  return luotId;
}

describe("ma trận kết hợp", () => {
  test("form ma trận thấy số câu tự luận riêng với trắc nghiệm", async () => {
    const r = await goi("GET", "/v1/quan-tri/de-thi/kha-dung", tk.quanTri);
    const cd = r.body.chu_de.find((t: any) => t.id === chuDe);
    expect(cd.kha_dung).toEqual({ de: 10, trung_binh: 0, kho: 0 });
    expect(cd.kha_dung_tu_luan).toEqual({ de: 0, trung_binh: 0, kho: 3 });
  });

  test("ô tự luận đòi nhiều hơn số câu đã duyệt thì không xuất bản được", async () => {
    const tao = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
      title: `${PREFIX} thiếu tự luận`,
      matrix: [{ topic_id: chuDe, level: "kho", so_cau: 4, dang: "tu_luan", diem_moi_cau: 5 }],
      duration_minutes: 30,
    });
    expect(tao.status).toBe(201);
    expect(tao.body.canh_bao[0]).toContain("tự luận: cần 4 câu, ngân hàng mới có 3 câu");
  });

  test("luyện tập không bao giờ rút câu tự luận", async () => {
    const nguon = await nguonTheoChuDe(chuDe);
    expect(nguon.length).toBe(10);
    expect(nguon.every((c) => c.kind !== "tu_luan")).toBe(true);
  });
});

describe("nộp bài, AI chấm và công bố ngay", () => {
  test("điểm có ngay khi nộp, tính theo điểm từng câu", async () => {
    const giaoBai = await taoVaGiao("công bố ngay");
    const luotId = await lamBai(giaoBai, BAI_TOT);
    const nop = await goi("POST", `/v1/thi/luot/${luotId}/nop`, tk.canBo);
    expect(nop.status).toBe(200);
    // Trắc nghiệm 5 + tự luận 5 + tự luận bỏ trống 0 = 10 / 15 = 66,67.
    expect(nop.body).toMatchObject({
      trang_thai: "da_nop",
      diem: 66.67,
      dat: true,
      diem_tho: 10,
      tong_diem_tho: 15,
      so_cau_cho_cham: 0,
    });

    const kq = await goi("GET", `/v1/thi/luot/${luotId}/ket-qua`, tk.canBo);
    expect(kq.status).toBe(200);
    const tl = kq.body.chi_tiet.filter((c: any) => c.de.kind === "tu_luan");
    expect(tl[0]).toMatchObject({ diem: 5, diem_toi_da: 5, cham_boi: "ai", trang_thai_cham: "xong" });
    expect(tl[0].nhan_xet.tieu_chi.map((t: any) => t.ma)).toEqual(["can_cu", "noi_dung", "trinh_bay"]);
    expect(tl[0].ket_qua.giai_thich).toContain("Đáp án gợi ý");
    expect(tl[1]).toMatchObject({ diem: 0, tra_loi: { bai_viet: "" } });
  });

  test("hai lời chấm đồng thời chỉ gọi mô hình một lần cho mỗi câu", async () => {
    const giaoBai = await taoVaGiao("đồng thời");
    const luotId = await lamBai(giaoBai, BAI_TOT);
    expect(await nopLuot(luotId, "nguoi_thi")).toEqual({ choCham: true });
    const dem = new DemCham();
    setProvider(dem);
    await Promise.all([
      chamTuLuanCuaLuot(luotId, goiMoHinhChamTuLuan),
      chamTuLuanCuaLuot(luotId, goiMoHinhChamTuLuan),
    ]);
    expect(dem.soLan).toBe(1);
    expect((await layLuot(luotId))?.status).toBe("da_nop");
  });

  test("bài viết dài quá giới hạn bị từ chối khi lưu", async () => {
    const giaoBai = await taoVaGiao("bài quá dài");
    const bd = await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBo);
    const de = await goi("GET", `/v1/thi/luot/${bd.body.luot_id}`, tk.canBo);
    const tl = de.body.cau.find((c: any) => c.de.kind === "tu_luan");
    const r = await goi("PUT", `/v1/thi/luot/${bd.body.luot_id}/cau/${tl.thu_tu}`, tk.canBo, {
      tra_loi: { bai_viet: "x".repeat(6001) },
    });
    expect(r.status).toBe(400);
    await goi("POST", `/v1/thi/luot/${bd.body.luot_id}/nop`, tk.canBo);
  });
});

describe("mô hình lỗi: chờ giảng viên chấm", () => {
  let luotId = "";

  test("lượt ở trạng thái chờ chấm, chưa có điểm", async () => {
    const giaoBai = await taoVaGiao("mô hình lỗi");
    luotId = await lamBai(giaoBai, BAI_TOT);
    setProvider(moHinhLoi);
    const nop = await goi("POST", `/v1/thi/luot/${luotId}/nop`, tk.canBo);
    expect(nop.status).toBe(200);
    expect(nop.body).toMatchObject({ trang_thai: "cho_cham", diem: null, so_cau_cho_cham: 1 });
  });

  test("câu vào hàng chấm của giảng viên; cán bộ không vào được hàng chấm", async () => {
    const cb = await goi("GET", "/v1/quan-tri/de-thi/cham-tu-luan", tk.canBo);
    expect(cb.status).toBe(403);
    const hang = await goi("GET", "/v1/quan-tri/de-thi/cham-tu-luan", tk.bienTap);
    expect(hang.status).toBe(200);
    const cau = hang.body.items.find((x: any) => x.attempt_id === luotId);
    expect(cau).toBeTruthy();
    expect(cau.response.bai_viet).toBe(BAI_TOT);
    expect(cau.item.noi_dung.rubric.tieu_chi).toHaveLength(3);
  });

  test("giảng viên chấm xong thì lượt được chốt điểm", async () => {
    const hang = await goi("GET", "/v1/quan-tri/de-thi/cham-tu-luan", tk.bienTap);
    const cau = hang.body.items.find((x: any) => x.attempt_id === luotId);
    // can_cu 4/4, noi_dung 2/4, trinh_bay 4/4 → (40 + 20 + 20)% = 80% của 5 điểm = 4.
    const r = await goi("POST", `/v1/quan-tri/de-thi/cham-tu-luan/${luotId}/${cau.ordinal}`, tk.bienTap, {
      diem: { can_cu: 4, noi_dung: 2, trinh_bay: 4 },
      nhan_xet: "Thiếu bước tạm giữ giấy tờ.",
    });
    expect(r.status).toBe(200);
    expect(r.body.diem_cau).toBe(4);
    // Trắc nghiệm 5 + 4 + 0 = 9 / 15 = 60.
    expect(r.body.luot).toMatchObject({ trang_thai: "da_nop", diem: 60, dat: true });
    const kq = await goi("GET", `/v1/thi/luot/${luotId}/ket-qua`, tk.canBo);
    const tl = kq.body.chi_tiet.find((c: any) => c.de.kind === "tu_luan" && c.diem === 4);
    expect(tl).toMatchObject({ cham_boi: "nguoi" });
    expect(tl.nhan_xet.tom_tat).toBe("Thiếu bước tạm giữ giấy tờ.");
  });

  test("phúc khảo câu đã chấm thì tính lại điểm lượt", async () => {
    const hang = await goi("GET", "/v1/quan-tri/de-thi/cham-tu-luan", tk.bienTap);
    expect(hang.body.items.some((x: any) => x.attempt_id === luotId)).toBe(false);
    const [r] = (await sql`
      SELECT ordinal FROM exam_answers WHERE attempt_id = ${luotId} AND graded_by = 'nguoi'`) as any[];
    const pk = await goi("POST", `/v1/quan-tri/de-thi/cham-tu-luan/${luotId}/${r.ordinal}`, tk.bienTap, {
      diem: { can_cu: 0, noi_dung: 0, trinh_bay: 0 },
    });
    expect(pk.status).toBe(200);
    expect(pk.body.luot).toMatchObject({ trang_thai: "da_nop", diem: 33.33, dat: false });
  });
});

describe("hết giờ: worker tự nộp và chấm", () => {
  test("lượt quá hạn được tự nộp, câu tự luận được chấm ở nhịp worker", async () => {
    const giaoBai = await taoVaGiao("hết giờ");
    const luotId = await lamBai(giaoBai, BAI_TOT);
    await sql`UPDATE exam_attempts SET deadline_at = now() - interval '5 minutes' WHERE id = ${luotId}`;
    await tuNopLuotQuaHan(new Date());
    expect((await layLuot(luotId))?.status).toBe("cho_cham");
    expect(await chamTuLuanConTon(goiMoHinhChamTuLuan)).toBeGreaterThanOrEqual(1);
    const luot = await layLuot(luotId);
    expect(luot).toMatchObject({ status: "da_nop", submit_kind: "het_gio", score: 66.67 });
  });
});
