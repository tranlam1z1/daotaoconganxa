/**
 * Kiểm thử API luyện tập (docs/PLAN.md GĐ4) trên Postgres test thật: luồng đầy đủ, quyền trên
 * phiên, câu chờ duyệt không lọt vào phiên, không chấm hai lần, và phép quét khóa `answer`
 * trên mọi phản hồi của route người học (mục còn lại của GĐ3).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import { luuChuDeCauHoi, sql, type TaoCauHoiInput, taoNhieuCauHoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-luyen-tap";
const CHU_DE = `${PREFIX}-chu-de`;

/** Mọi phản hồi JSON của route người học đi qua đây để quét khóa `answer`. */
const phanHoiNguoiHoc: unknown[] = [];

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (path.startsWith("/v1/luyen-tap") || path.startsWith("/v1/toi")) phanHoiNguoiHoc.push(json);
  return { status: res.status, body: json as any };
}

async function taoTaiKhoan(ten: string, role: Role): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  await sql`DELETE FROM questions WHERE created_by = ${PREFIX}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  // practice_sessions, practice_answers, wrong_questions xóa dây chuyền theo accounts.
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Id câu và đáp án đúng của từng câu trong phiên, đọc thẳng từ ảnh chụp trong CSDL. */
async function dapAnCuaPhien(id: string): Promise<Array<{ question_id: string; dung: string; sai: string }>> {
  const [p] = await sql<Array<{ items: any[] }>>`SELECT items FROM practice_sessions WHERE id = ${id}`;
  return p!.items.map((c) => ({
    question_id: c.question_id,
    dung: c.noi_dung.answer.dung[0],
    sai: c.noi_dung.options.phuong_an.find((x: { id: string }) => x.id !== c.noi_dung.answer.dung[0]).id,
  }));
}

let A: { id: string; token: string };
let B: { id: string; token: string };
const choDuyet = new Set<string>();

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a", "can_bo");
  B = await taoTaiKhoan("b", "can_bo");
  const t = await luuChuDeCauHoi({ code: CHU_DE, name: "Chủ đề luyện tập (test)" });
  const cau = (i: number, status: "da_duyet" | "cho_duyet"): TaoCauHoiInput => ({
    code: `${PREFIX}-${status}-${i}`,
    topicId: t.id,
    level: (["de", "trung_binh", "kho"] as const)[i % 3]!,
    kind: "mot_dap_an",
    stem: `${PREFIX} câu ${status} ${i}?`,
    options: {
      phuong_an: [
        { id: "a", text: "Một" },
        { id: "b", text: "Hai" },
        { id: "c", text: "Ba" },
      ],
    },
    answer: { dung: [["a", "b", "c"][i % 3]] },
    explanation: "Giải thích.",
    citations: [],
    status,
  });
  await taoNhieuCauHoi([...Array.from({ length: 12 }, (_, i) => cau(i, "da_duyet"))], PREFIX);
  const cd = await taoNhieuCauHoi(
    Array.from({ length: 6 }, (_, i) => cau(i, "cho_duyet")),
    PREFIX,
  );
  for (const q of cd) choDuyet.add(q.id);
});

afterAll(async () => {
  await donDep();
});

describe("luồng luyện tập đầy đủ", () => {
  let phien = "";
  let dapAn: Awaited<ReturnType<typeof dapAnCuaPhien>> = [];

  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("GET", "/v1/luyen-tap/chu-de")).status).toBe(401);
    expect((await goi("POST", "/v1/luyen-tap/phien", undefined, { chu_de: CHU_DE })).status).toBe(401);
  });

  test("danh sách chủ đề có số câu đã duyệt (không tính câu chờ duyệt)", async () => {
    const r = await goi("GET", "/v1/luyen-tap/chu-de", A.token);
    expect(r.status).toBe(200);
    const t = r.body.items.find((x: { code: string }) => x.code === CHU_DE);
    expect(t.so_cau).toBe(12);
    expect(t.da_lam_dung).toBe(0);
  });

  test("chủ đề bị ẩn và chủ đề con của nó không hiện cho người học", async () => {
    const [cha] = await sql`
      INSERT INTO question_topics (code, name, hidden) VALUES (${`${PREFIX}-an`}, 'Ẩn', true) RETURNING id`;
    await sql`INSERT INTO question_topics (code, name, parent_id) VALUES (${`${PREFIX}-an-con`}, 'Con', ${cha!.id})`;
    const r = await goi("GET", "/v1/luyen-tap/chu-de", A.token);
    const ma = r.body.items.map((x: { code: string }) => x.code);
    expect(ma).not.toContain(`${PREFIX}-an`);
    expect(ma).not.toContain(`${PREFIX}-an-con`);
    expect(ma).toContain(CHU_DE);
  });

  test("tạo phiên 10 câu; không câu chờ duyệt nào lọt vào", async () => {
    const r = await goi("POST", "/v1/luyen-tap/phien", A.token, { chu_de: CHU_DE });
    expect(r.status).toBe(201);
    expect(r.body.tong).toBe(10);
    phien = r.body.id;
    dapAn = await dapAnCuaPhien(phien);
    expect(dapAn.some((d) => choDuyet.has(d.question_id))).toBe(false);
  });

  test("GET phiên không chứa đáp án", async () => {
    const r = await goi("GET", `/v1/luyen-tap/phien/${phien}`, A.token);
    expect(r.status).toBe(200);
    expect(r.body.cau).toHaveLength(10);
    const json = JSON.stringify(r.body);
    expect(json).not.toContain('"answer"');
    expect(json).not.toContain('"dap_an"');
    expect(json).not.toContain("Giải thích.");
  });

  test("người B đọc hoặc trả lời phiên của A nhận 403", async () => {
    expect((await goi("GET", `/v1/luyen-tap/phien/${phien}`, B.token)).status).toBe(403);
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/tra-loi`, B.token, {
      stt: 1,
      tra_loi: { chon: ["a"] },
    });
    expect(r.status).toBe(403);
    expect((await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, B.token)).status).toBe(403);
  });

  test("trả lời 10 câu, sai 3 câu; mỗi câu có đúng/sai, đáp án, giải thích", async () => {
    for (const [i, d] of dapAn.entries()) {
      const sai = i < 3;
      const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/tra-loi`, A.token, {
        stt: i + 1,
        tra_loi: { chon: [sai ? d.sai : d.dung] },
        giay: 5,
      });
      expect(r.status).toBe(200);
      expect(r.body.dung).toBe(!sai);
      expect(r.body.dap_an.dung).toEqual([d.dung]);
      expect(r.body.giai_thich).toBe("Giải thích.");
    }
  });

  test("trả lời lại cùng câu nhận 409, không chấm hai lần", async () => {
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/tra-loi`, A.token, {
      stt: 1,
      tra_loi: { chon: [dapAn[0]!.dung] },
    });
    expect(r.status).toBe(409);
    const [n] = await sql<
      Array<{ n: number }>
    >`SELECT count(*)::int AS n FROM practice_answers WHERE session_id = ${phien}`;
    expect(n!.n).toBe(10);
  });

  test("mở lại phiên thấy câu trả lời và phản hồi đã chấm", async () => {
    const r = await goi("GET", `/v1/luyen-tap/phien/${phien}`, A.token);
    expect(r.body.da_tra_loi).toBe(10);
    expect(r.body.cau[0].ket_qua.dung).toBe(false);
  });

  test("kết thúc được correct = 7; gọi lại vẫn 7", async () => {
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, A.token);
    expect(r.body).toMatchObject({ dung: 7, tong: 10, giay: 50 });
    const lai = await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, A.token);
    expect(lai.body.dung).toBe(7);
    const traLoiThem = await goi("POST", `/v1/luyen-tap/phien/${phien}/tra-loi`, A.token, {
      stt: 2,
      tra_loi: { chon: ["a"] },
    });
    expect(traLoiThem.status).toBe(409);
  });

  test("câu sai của tôi có đúng 3 câu; lịch sử có phiên vừa làm", async () => {
    const cs = await goi("GET", "/v1/toi/cau-sai", A.token);
    expect(cs.body.tong).toBe(3);
    expect(new Set(cs.body.items.map((x: { question_id: string }) => x.question_id))).toEqual(
      new Set(dapAn.slice(0, 3).map((d) => d.question_id)),
    );
    const ls = await goi("GET", "/v1/toi/lich-su", A.token);
    expect(ls.body.items[0]).toMatchObject({ id: phien, correct: 7, total: 10, da_tra_loi: 10 });
    // Người B không thấy gì của A.
    expect((await goi("GET", "/v1/toi/cau-sai", B.token)).body.tong).toBe(0);
    expect((await goi("GET", "/v1/toi/lich-su", B.token)).body.items).toEqual([]);
  });

  test("phiên nguồn câu sai rút đúng 3 câu đó; làm đúng 2 lần thì câu rời danh sách", async () => {
    const saiIds = new Set(dapAn.slice(0, 3).map((d) => d.question_id));
    for (let lan = 1; lan <= 2; lan++) {
      const r = await goi("POST", "/v1/luyen-tap/phien", A.token, { nguon: "cau_sai" });
      expect(r.status).toBe(201);
      expect(r.body.tong).toBe(3);
      const da = await dapAnCuaPhien(r.body.id);
      expect(new Set(da.map((d) => d.question_id))).toEqual(saiIds);
      for (const [i, d] of da.entries()) {
        await goi("POST", `/v1/luyen-tap/phien/${r.body.id}/tra-loi`, A.token, {
          stt: i + 1,
          tra_loi: { chon: [d.dung] },
        });
      }
      const conLai = (await goi("GET", "/v1/toi/cau-sai", A.token)).body.tong;
      expect(conLai).toBe(lan === 1 ? 3 : 0);
    }
    const r = await goi("POST", "/v1/luyen-tap/phien", A.token, { nguon: "cau_sai" });
    expect(r.status).toBe(400);
  });

  test("tiến độ chủ đề tăng theo số câu đã làm đúng", async () => {
    const r = await goi("GET", "/v1/luyen-tap/chu-de", A.token);
    const t = r.body.items.find((x: { code: string }) => x.code === CHU_DE);
    expect(t.da_lam_dung).toBe(10);
  });
});

describe("lưu tạm, sửa được, chấm khi kết thúc", () => {
  let phien = "";
  let dapAn: Awaited<ReturnType<typeof dapAnCuaPhien>> = [];

  test("lưu tạm không trả đúng/sai và chưa ghi câu trả lời chính thức", async () => {
    const r = await goi("POST", "/v1/luyen-tap/phien", A.token, { chu_de: CHU_DE });
    phien = r.body.id;
    dapAn = await dapAnCuaPhien(phien);
    const luu = (stt: number, chon: string, giay?: number) =>
      goi("POST", `/v1/luyen-tap/phien/${phien}/luu-tam`, A.token, { stt, tra_loi: { chon: [chon] }, giay });
    const lan1 = await luu(1, dapAn[0]!.sai, 4);
    expect(lan1.status).toBe(200);
    expect(lan1.body).toEqual({ stt: 1, da_luu: true });
    // Đổi ý ở câu 1, câu 2 chọn sai.
    expect((await luu(1, dapAn[0]!.dung, 3)).status).toBe(200);
    expect((await luu(2, dapAn[1]!.sai, 5)).status).toBe(200);
    const [n] = await sql<
      Array<{ n: number }>
    >`SELECT count(*)::int AS n FROM practice_answers WHERE session_id = ${phien}`;
    expect(n!.n).toBe(0);
  });

  test("người B không lưu tạm được vào phiên của A", async () => {
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/luu-tam`, B.token, {
      stt: 1,
      tra_loi: { chon: ["a"] },
    });
    expect(r.status).toBe(403);
  });

  test("mở lại phiên thấy đáp án đã chọn, không có kết quả chấm", async () => {
    const r = await goi("GET", `/v1/luyen-tap/phien/${phien}`, A.token);
    expect(r.body.da_tra_loi).toBe(2);
    expect(r.body.cau[0].tra_loi).toEqual({ chon: [dapAn[0]!.dung] });
    expect(r.body.cau[0].ket_qua).toBeUndefined();
    const json = JSON.stringify(r.body);
    expect(json).not.toContain('"dap_an"');
    expect(json).not.toContain("Giải thích.");
  });

  test("kết thúc thì chấm bản lưu cuối; sau đó không sửa được", async () => {
    const r = await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, A.token);
    expect(r.body).toMatchObject({ dung: 1, tong: 10, giay: 12 });
    const xem = await goi("GET", `/v1/luyen-tap/phien/${phien}`, A.token);
    expect(xem.body.cau[0].ket_qua.dung).toBe(true);
    expect(xem.body.cau[1].ket_qua.dung).toBe(false);
    expect(xem.body.cau[2].ket_qua).toBeUndefined();
    const sua = await goi("POST", `/v1/luyen-tap/phien/${phien}/luu-tam`, A.token, {
      stt: 3,
      tra_loi: { chon: ["a"] },
    });
    expect(sua.status).toBe(409);
    expect((await goi("POST", `/v1/luyen-tap/phien/${phien}/ket-thuc`, A.token)).body.dung).toBe(1);
  });
});

describe("tham số sai", () => {
  test("phiên không tồn tại nhận 404; chủ đề không có câu nhận 400", async () => {
    expect(
      (await goi("GET", "/v1/luyen-tap/phien/00000000-0000-0000-0000-000000000000", A.token)).status,
    ).toBe(404);
    expect((await goi("GET", "/v1/luyen-tap/phien/khong-phai-uuid", A.token)).status).toBe(404);
    expect((await goi("POST", "/v1/luyen-tap/phien", A.token, { chu_de: `${PREFIX}-khong-co` })).status).toBe(
      404,
    );
    expect((await goi("POST", "/v1/luyen-tap/phien", A.token, {})).status).toBe(400);
  });
});

describe("ranh giới đáp án (GĐ3)", () => {
  /** Mọi đường dẫn khóa `answer` trong một giá trị JSON. */
  function timKhoaAnswer(v: unknown, duong = "$"): string[] {
    if (Array.isArray(v)) return v.flatMap((x, i) => timKhoaAnswer(x, `${duong}[${i}]`));
    if (v && typeof v === "object") {
      return Object.entries(v).flatMap(([k, x]) => [
        ...(k === "answer" ? [`${duong}.${k}`] : []),
        ...timKhoaAnswer(x, `${duong}.${k}`),
      ]);
    }
    return [];
  }

  test("không phản hồi nào của route người học có khóa answer", () => {
    expect(phanHoiNguoiHoc.length).toBeGreaterThan(20);
    expect(phanHoiNguoiHoc.flatMap((r) => timKhoaAnswer(r))).toEqual([]);
  });
});
