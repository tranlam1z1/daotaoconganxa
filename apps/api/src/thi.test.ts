/**
 * Thi sát hạch qua API (docs/PLAN.md GĐ6, mục "Kiểm tra đã xong"). Postgres test thật; dữ liệu
 * mang tiền tố riêng: một chủ đề với 40 câu đã duyệt, cây đơn vị Phòng > Đội A > Tổ A1, Đội B.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql, taoDonVi, tuNopLuotQuaHan } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd6";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

/** Các khóa không bao giờ được xuất hiện trong phản hồi cho người thi trước khi nộp. */
const KHOA_CAM = new Set(["answer", "noi_dung", "dap_an", "giai_thich", "can_cu"]);
function timKhoaCam(v: unknown, duong = "$"): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => timKhoaCam(x, `${duong}[${i}]`));
  if (v && typeof v === "object") {
    return Object.entries(v).flatMap(([k, x]) => [
      ...(KHOA_CAM.has(k) ? [`${duong}.${k}`] : []),
      ...timKhoaCam(x, `${duong}.${k}`),
    ]);
  }
  return [];
}

const dv: Record<"phong" | "doiA" | "toA1" | "doiB", string> = { phong: "", doiA: "", toA1: "", doiB: "" };
const tk: Record<"quanTri" | "quanLyA" | "quanLyB" | "canBoA1" | "canBoB", string> = {
  quanTri: "",
  quanLyA: "",
  quanLyB: "",
  canBoA1: "",
  canBoB: "",
};
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
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`} OR target LIKE ${`${PREFIX}%`}`;
  const ids = ((await sql`SELECT id FROM accounts WHERE username LIKE ${`${PREFIX}%`}`) as any[]).map(
    (r) => r.id,
  );
  await sql`DELETE FROM access_log WHERE account_id = ANY(${ids}::uuid[])`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  for (const cap of [4, 3, 2, 1])
    await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) = ${cap}`;
}

beforeAll(async () => {
  await donDep();
  const a = `${PREFIX}-seed`;
  dv.phong = (await taoDonVi({ code: `${PREFIX}-P`, name: "Phòng thử GĐ6" }, a)).id;
  dv.doiA = (await taoDonVi({ code: `${PREFIX}-A`, name: "Đội A", parentId: dv.phong }, a)).id;
  dv.toA1 = (await taoDonVi({ code: `${PREFIX}-A1`, name: "Tổ A1", parentId: dv.doiA }, a)).id;
  dv.doiB = (await taoDonVi({ code: `${PREFIX}-B`, name: "Đội B", parentId: dv.phong }, a)).id;
  tk.quanTri = await taoTaiKhoan("quan-tri", "quan_tri", null);
  tk.quanLyA = await taoTaiKhoan("quan-ly-a", "lanh_dao", dv.doiA);
  tk.quanLyB = await taoTaiKhoan("quan-ly-b", "lanh_dao", dv.doiB);
  tk.canBoA1 = await taoTaiKhoan("can-bo-a1", "can_bo", dv.toA1);
  tk.canBoB = await taoTaiKhoan("can-bo-b", "can_bo", dv.doiB);

  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-toc-do`}, 'Tốc độ (thử)') RETURNING id`) as any[];
  chuDe = t.id;
  // 40 câu một đáp án đã duyệt, đáp án đúng luôn là "c".
  for (let i = 1; i <= 40; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${String(i).padStart(3, "0")}`}, ${chuDe}, 'de', 'mot_dap_an', ${`Câu thử số ${i}`},
              ${sql.json({ phuong_an: ["a", "b", "c", "d"].map((x) => ({ id: x, text: `Phương án ${x}` })) })},
              ${sql.json({ dung: ["c"] })}, 'Giải thích thử.', 'da_duyet')`;
  }
});

afterAll(donDep);

async function taoDeXuatBan(tieuDe: string, cauHinh: Record<string, unknown> = {}): Promise<string> {
  const tao = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
    title: `${PREFIX} ${tieuDe}`,
    matrix: [{ topic_id: chuDe, level: "de", so_cau: 35 }],
    duration_minutes: 30,
    pass_score: 70,
    max_attempts: 1,
    ...cauHinh,
  });
  expect(tao.status).toBe(201);
  expect(tao.body.canh_bao).toEqual([]);
  const xb = await goi("POST", `/v1/quan-tri/de-thi/${tao.body.item.id}/trang-thai`, tk.quanTri, {
    status: "xuat_ban",
  });
  expect(xb.status).toBe(200);
  return tao.body.item.id;
}

const ngayMai = () => new Date(Date.now() + 86_400_000).toISOString();

describe("đề thi", () => {
  test("ma trận thiếu câu: lưu nháp được kèm cảnh báo, không xuất bản được", async () => {
    const tao = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
      title: `${PREFIX} thiếu câu`,
      matrix: [
        { topic_id: chuDe, level: "de", so_cau: 30 },
        { topic_id: chuDe, level: "kho", so_cau: 5 },
      ],
      duration_minutes: 30,
    });
    expect(tao.status).toBe(201);
    expect(tao.body.canh_bao[0]).toContain("Tốc độ (thử), mức Khó: cần 5 câu, ngân hàng mới có 0 câu");
    const xb = await goi("POST", `/v1/quan-tri/de-thi/${tao.body.item.id}/trang-thai`, tk.quanTri, {
      status: "xuat_ban",
    });
    expect(xb.status).toBe(400);
  });

  test("ma trận rỗng hoặc quá 60 câu bị từ chối; cán bộ quản lý không tạo được đề", async () => {
    const rong = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
      title: `${PREFIX} không câu`,
      matrix: [{ topic_id: chuDe, level: "de", so_cau: 0 }],
      duration_minutes: 30,
    });
    expect(rong.status).toBe(400);
    const nhieu = await goi("POST", "/v1/quan-tri/de-thi", tk.quanTri, {
      title: `${PREFIX} nhiều câu`,
      matrix: [
        { topic_id: chuDe, level: "de", so_cau: 40 },
        { topic_id: chuDe, level: "kho", so_cau: 21 },
      ],
      duration_minutes: 30,
    });
    expect(nhieu.status).toBe(400);
    const ql = await goi("POST", "/v1/quan-tri/de-thi", tk.quanLyA, {
      title: `${PREFIX} x`,
      matrix: [{ topic_id: chuDe, level: "de", so_cau: 35 }],
      duration_minutes: 30,
    });
    expect(ql.status).toBe(403);
  });

  test("xem trước sinh đề 35 câu, có đáp án cho quản trị", async () => {
    const id = await taoDeXuatBan("xem trước");
    const r = await goi("POST", `/v1/quan-tri/de-thi/${id}/xem-truoc`, tk.quanTri);
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(35);
    expect(r.body.items[0].noi_dung.answer.dung).toEqual(["c"]);
  });
});

describe("giao bài và phạm vi đơn vị", () => {
  let deId = "";
  let giaoBaiA = "";

  beforeAll(async () => {
    deId = await taoDeXuatBan("giao đội A");
  });

  test("quản lý đội B giao đề cho đội A nhận 403", async () => {
    const r = await goi("POST", "/v1/giao-bai", tk.quanLyB, {
      exam_id: deId,
      unit_id: dv.doiA,
      due_at: ngayMai(),
    });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("ngoai_pham_vi");
  });

  test("quản lý đội A giao cho đội A (kèm đơn vị cấp dưới): cán bộ tổ A1 thấy, cán bộ đội B không thấy", async () => {
    const r = await goi("POST", "/v1/giao-bai", tk.quanLyA, {
      exam_id: deId,
      unit_id: dv.doiA,
      include_subunits: true,
      due_at: ngayMai(),
    });
    expect(r.status).toBe(201);
    giaoBaiA = r.body.item.id;
    const a1 = await goi("GET", "/v1/thi", tk.canBoA1);
    expect(a1.body.items.map((b: any) => b.assignment_id)).toContain(giaoBaiA);
    expect(a1.body.items.find((b: any) => b.assignment_id === giaoBaiA).trang_thai).toBe("chua_lam");
    const b = await goi("GET", "/v1/thi", tk.canBoB);
    expect(b.body.items.map((x: any) => x.assignment_id)).not.toContain(giaoBaiA);
    const batDauB = await goi("POST", `/v1/thi/${giaoBaiA}/bat-dau`, tk.canBoB);
    expect(batDauB.status).toBe(404);
  });

  test("giao không kèm đơn vị cấp dưới thì tổ A1 không thấy", async () => {
    const r = await goi("POST", "/v1/giao-bai", tk.quanLyA, {
      exam_id: deId,
      unit_id: dv.doiA,
      include_subunits: false,
      due_at: ngayMai(),
    });
    const a1 = await goi("GET", "/v1/thi", tk.canBoA1);
    expect(a1.body.items.map((b: any) => b.assignment_id)).not.toContain(r.body.item.id);
    await goi("POST", `/v1/giao-bai/${r.body.item.id}/huy`, tk.quanLyA);
  });

  test("danh sách giao bài của quản lý đội B không có bài của đội A", async () => {
    const r = await goi("GET", `/v1/giao-bai?exam_id=${deId}`, tk.quanLyB);
    expect(r.body.items.map((b: any) => b.id)).not.toContain(giaoBaiA);
    const huy = await goi("POST", `/v1/giao-bai/${giaoBaiA}/huy`, tk.quanLyB);
    expect(huy.status).toBe(403);
  });
});

describe("làm bài", () => {
  let giaoBai = "";
  let luot = "";

  beforeAll(async () => {
    const deId = await taoDeXuatBan("làm bài", { show_answers: "sau_nop" });
    const r = await goi("POST", "/v1/giao-bai", tk.quanTri, {
      exam_id: deId,
      account_id: await idCua("can-bo-b"),
      due_at: ngayMai(),
    });
    giaoBai = r.body.item.id;
  });

  test("bắt đầu: 201; bấm lại: 200 cùng lượt (làm tiếp)", async () => {
    const r1 = await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBoB);
    expect(r1.status).toBe(201);
    luot = r1.body.luot_id;
    const r2 = await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBoB);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual({ luot_id: luot, tiep_tuc: true });
  });

  test("đề của lượt: 35 câu, không có đáp án, người khác không mở được", async () => {
    const r = await goi("GET", `/v1/thi/luot/${luot}`, tk.canBoB);
    expect(r.status).toBe(200);
    expect(r.body.cau).toHaveLength(35);
    expect(timKhoaCam(r.body)).toEqual([]);
    expect(r.body.giay_con_lai).toBeGreaterThan(29 * 60);
    expect((await goi("GET", `/v1/thi/luot/${luot}`, tk.canBoA1)).status).toBe(404);
  });

  test("mở lại lượt đang làm: giữ câu đã chọn, thời gian còn lại giảm đúng", async () => {
    const luu = await goi("PUT", `/v1/thi/luot/${luot}/cau/1`, tk.canBoB, { tra_loi: { chon: ["c"] } });
    expect(luu.status).toBe(200);
    expect(timKhoaCam(luu.body)).toEqual([]);
    await goi("PUT", `/v1/thi/luot/${luot}/cau/2`, tk.canBoB, { tra_loi: { chon: ["a"] } });
    // Sửa lại câu 2 trước khi nộp.
    await goi("PUT", `/v1/thi/luot/${luot}/cau/2`, tk.canBoB, { tra_loi: { chon: ["c"] } });
    const truoc = (await goi("GET", `/v1/thi/luot/${luot}`, tk.canBoB)).body.giay_con_lai;
    // Giả lập 2 phút đã trôi qua.
    await sql`UPDATE exam_attempts SET deadline_at = deadline_at - interval '120 seconds' WHERE id = ${luot}`;
    const sau = await goi("GET", `/v1/thi/luot/${luot}`, tk.canBoB);
    expect(truoc - sau.body.giay_con_lai).toBeGreaterThanOrEqual(119);
    expect(truoc - sau.body.giay_con_lai).toBeLessThanOrEqual(122);
    expect(sau.body.cau[0].tra_loi).toEqual({ chon: ["c"] });
    expect(sau.body.cau[1].tra_loi).toEqual({ chon: ["c"] });
    expect(sau.body.cau[2].tra_loi).toBeNull();
  });

  test("câu số ngoài đề trả 400; trả lời sai định dạng trả 400", async () => {
    expect(
      (await goi("PUT", `/v1/thi/luot/${luot}/cau/99`, tk.canBoB, { tra_loi: { chon: ["c"] } })).status,
    ).toBe(400);
    expect((await goi("PUT", `/v1/thi/luot/${luot}/cau/3`, tk.canBoB, { tra_loi: { khac: 1 } })).status).toBe(
      400,
    );
  });

  test("nộp: chấm đúng 2/35 câu, không đạt; kết quả có đáp án theo cấu hình sau_nop", async () => {
    const r = await goi("POST", `/v1/thi/luot/${luot}/nop`, tk.canBoB);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      trang_thai: "da_nop",
      kieu_nop: "nguoi_thi",
      dung: 2,
      tong: 35,
      dat: false,
    });
    expect(r.body.diem).toBe(5.71);
    const kq = await goi("GET", `/v1/thi/luot/${luot}/ket-qua`, tk.canBoB);
    expect(kq.body.xem_dap_an).toBe(true);
    expect(kq.body.chi_tiet).toHaveLength(35);
    expect(kq.body.chi_tiet[0].ket_qua.dung).toBe(true);
    expect(kq.body.chi_tiet[5].ket_qua.dung).toBe(false);
  });

  test("sau khi nộp: không sửa được câu trả lời (409); max_attempts = 1 thì bắt đầu lần hai nhận 409", async () => {
    expect(
      (await goi("PUT", `/v1/thi/luot/${luot}/cau/3`, tk.canBoB, { tra_loi: { chon: ["c"] } })).status,
    ).toBe(409);
    const lai = await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBoB);
    expect(lai.status).toBe(409);
    expect(lai.body.error.message).toContain("hết số lần làm bài");
    const ds = await goi("GET", "/v1/thi", tk.canBoB);
    expect(ds.body.items.find((b: any) => b.assignment_id === giaoBai)).toMatchObject({
      trang_thai: "da_xong",
      duoc_bat_dau: false,
      so_luot_nop: 1,
    });
  });
});

describe("đồng hồ máy chủ", () => {
  let giaoBai = "";

  beforeAll(async () => {
    const deId = await taoDeXuatBan("đồng hồ", { max_attempts: 3, show_answers: "khong" });
    giaoBai = (
      await goi("POST", "/v1/giao-bai", tk.quanTri, { exam_id: deId, unit_id: dv.doiB, due_at: ngayMai() })
    ).body.item.id;
  });

  test("trả lời sau hạn + 30 giây nhận 409 và lượt được tự nộp với kiểu hết giờ", async () => {
    const luot = (await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBoB)).body.luot_id;
    await goi("PUT", `/v1/thi/luot/${luot}/cau/1`, tk.canBoB, { tra_loi: { chon: ["c"] } });
    // Trong khoảng bù 30 giây: vẫn nhận.
    await sql`UPDATE exam_attempts SET deadline_at = now() - interval '20 seconds' WHERE id = ${luot}`;
    expect(
      (await goi("PUT", `/v1/thi/luot/${luot}/cau/2`, tk.canBoB, { tra_loi: { chon: ["c"] } })).status,
    ).toBe(200);
    // Quá khoảng bù: từ chối.
    await sql`UPDATE exam_attempts SET deadline_at = now() - interval '31 seconds' WHERE id = ${luot}`;
    const r = await goi("PUT", `/v1/thi/luot/${luot}/cau/3`, tk.canBoB, { tra_loi: { chon: ["c"] } });
    expect(r.status).toBe(409);
    const [row] =
      (await sql`SELECT status, submit_kind, correct FROM exam_attempts WHERE id = ${luot}`) as any[];
    expect(row).toEqual({ status: "da_nop", submit_kind: "het_gio", correct: 2 });
    const kq = await goi("GET", `/v1/thi/luot/${luot}/ket-qua`, tk.canBoB);
    expect(kq.body.xem_dap_an).toBe(false);
    expect(kq.body.chi_tiet).toBeUndefined();
  });

  test("worker tự nộp lượt quá hạn (người thi đã đóng trình duyệt)", async () => {
    const luot = (await goi("POST", `/v1/thi/${giaoBai}/bat-dau`, tk.canBoB)).body.luot_id;
    await sql`UPDATE exam_attempts SET deadline_at = now() - interval '5 minutes' WHERE id = ${luot}`;
    expect(await tuNopLuotQuaHan(new Date())).toBeGreaterThanOrEqual(1);
    const [row] =
      (await sql`SELECT status, submit_kind, correct FROM exam_attempts WHERE id = ${luot}`) as any[];
    expect(row).toEqual({ status: "da_nop", submit_kind: "het_gio", correct: 0 });
    // Quét nộp muộn bao lâu thì giờ nộp vẫn là mốc hết giờ, không phải lúc quét.
    const [gio] = (await sql`
      SELECT submitted_at = deadline_at AS dung_moc FROM exam_attempts WHERE id = ${luot}`) as any[];
    expect(gio.dung_moc).toBe(true);
    // Chạy lại không chấm lại lượt đã nộp.
    const [truoc] = (await sql`SELECT submitted_at FROM exam_attempts WHERE id = ${luot}`) as any[];
    await tuNopLuotQuaHan(new Date());
    const [sau] = (await sql`SELECT submitted_at FROM exam_attempts WHERE id = ${luot}`) as any[];
    expect(sau.submitted_at).toEqual(truoc.submitted_at);
  });
});

async function idCua(ten: string): Promise<string> {
  const [r] = (await sql`SELECT id FROM accounts WHERE username = ${`${PREFIX}-${ten}`}`) as any[];
  return r.id;
}
