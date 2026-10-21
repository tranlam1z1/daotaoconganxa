/**
 * Kiểm thử khung lượt chơi chung (docs/PLAN.md GĐ-G0) trên Postgres test thật, bằng trò mẫu
 * "Trắc nghiệm nhanh": trọn vòng vào chơi → chấm → cộng XP → lưu → xem lại, các chốt bảo mật
 * (người chơi lấy từ phiên, chấm lại ở máy chủ, không lộ đáp án), luật giờ, XP giảm dần, và đồng
 * bộ offline không cộng trùng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { type CauTrongDe, TRO_CHOI_THU_NGHIEM, taoRng } from "@qdpl/dao-tao";
import { luuChuDeCauHoi, sql, type TaoCauHoiInput, taoDonVi, taoNhieuCauHoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-luot-choi";

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

/** Khóa không bao giờ được có trong phản hồi TRƯỚC khi bước được chấm. */
/** GĐ-T17 thêm khóa của lộ trình trò Truy vết (`lo_trinh`, `xe_muc_tieu`, `diem_chan`, `seed_lo_trinh`). */
const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "explanation",
  "noi_dung",
  "lo_trinh",
  "xe_muc_tieu",
  "diem_chan",
  "seed_lo_trinh",
];
function coKhoaCam(v: unknown): string | null {
  if (Array.isArray(v)) {
    for (const x of v) {
      const k = coKhoaCam(x);
      if (k) return k;
    }
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (KHOA_CAM.includes(k)) return k;
      const con = coKhoaCam(x);
      if (con) return con;
    }
  }
  return null;
}

let unitId: string;
async function taoTaiKhoan(ten: string): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role, unit_id) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, 'can_bo', ${unitId})
    RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  const acc = sql`SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM game_runs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_packs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM questions WHERE created_by = ${PREFIX}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`}`;
}

/** Đáp án đúng của từng bước, đọc từ ảnh chụp của lượt trong CSDL. */
async function dapAnLuot(id: string): Promise<string[]> {
  const [r] = await sql<
    Array<{ items: Array<{ noi_dung: CauTrongDe }> }>
  >`SELECT items FROM game_runs WHERE id = ${id}`;
  return r!.items.map((b) => b.noi_dung.noi_dung.answer.dung![0]!);
}
const sai = (d: string) => (d === "dung" ? "sai" : d === "sai" ? "dung" : d === "a" ? "b" : "a");

async function xpLuot(accountId: string): Promise<number[]> {
  const rows = await sql<Array<{ xp: number }>>`
    SELECT xp FROM xp_ledger WHERE account_id = ${accountId} AND source_kind = 'game:thu_nghiem' ORDER BY id`;
  return rows.map((r) => r.xp);
}

/** Chơi hết một lượt online, đúng `soDung` bước đầu, rồi kết thúc. */
async function choiLuot(token: string, soDung: number) {
  const bd = await goi("POST", "/v1/luot-choi/thu_nghiem/bat-dau", token);
  expect(bd.status).toBe(201);
  const da = await dapAnLuot(bd.body.id);
  for (const [i, d] of da.entries()) {
    const r = await goi("POST", `/v1/luot-choi/luot/${bd.body.id}/buoc/${i + 1}`, token, {
      tra_loi: { chon: [i < soDung ? d : sai(d)] },
    });
    expect(r.status).toBe(200);
  }
  return await goi("POST", `/v1/luot-choi/luot/${bd.body.id}/ket-thuc`, token);
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let chuDeId: string;

beforeAll(async () => {
  await donDep();
  unitId = (await taoDonVi({ code: `${PREFIX}-DV`, name: "Đội thử khung trò chơi" }, PREFIX)).id;
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  chuDeId = (await luuChuDeCauHoi({ code: `${PREFIX}-chu-de`, name: "Chủ đề khung trò chơi" })).id;
  const cau = (i: number): TaoCauHoiInput => ({
    code: `${PREFIX}-${i}`,
    topicId: chuDeId,
    level: "de",
    kind: i % 2 ? "dung_sai" : "mot_dap_an",
    stem: `${PREFIX} câu ${i}?`,
    options:
      i % 2
        ? {}
        : {
            phuong_an: [
              { id: "a", text: "Một" },
              { id: "b", text: "Hai" },
            ],
          },
    answer: { dung: [i % 2 ? "dung" : "a"] },
    explanation: "Giải thích.",
    citations: [],
    status: "da_duyet",
  });
  await taoNhieuCauHoi(
    Array.from({ length: 6 }, (_, i) => cau(i)),
    PREFIX,
  );
});

afterAll(async () => {
  await donDep();
});

describe("vào chơi, chấm, cộng XP, xem lại", () => {
  test("danh mục đọc được khi chưa đăng nhập, chỉ có mã, tên, mô tả, có màn hay không", async () => {
    const r = await goi("GET", "/v1/luot-choi/danh-muc");
    expect(r.status).toBe(200);
    const g = r.body.tro_choi.find((x: any) => x.ma === "thu_nghiem");
    expect(Object.keys(g).sort()).toEqual(["ma", "man", "mo_ta", "ten"]);
    expect(Array.isArray(r.body.tro_choi_cu)).toBe(true);
  });

  test("chưa đăng nhập nhận 401 ở mọi route khác", async () => {
    expect((await goi("GET", "/v1/luot-choi")).status).toBe(401);
    expect((await goi("POST", "/v1/luot-choi/thu_nghiem/bat-dau")).status).toBe(401);
    expect((await goi("POST", "/v1/luot-choi/dong-bo", undefined, { luot: [] })).status).toBe(401);
    expect((await goi("GET", "/v1/toi/ho-so-chu-de")).status).toBe(401);
  });

  test("danh sách có trò mẫu; trò không có hoặc đang tắt trả 404", async () => {
    const r = await goi("GET", "/v1/luot-choi", A.token);
    expect(r.status).toBe(200);
    expect(r.body.tro_choi.map((g: any) => g.ma)).toContain("thu_nghiem");
    expect((await goi("POST", "/v1/luot-choi/khong_co/bat-dau", A.token)).status).toBe(404);
    // Trò cũ chạy trên API riêng, không bắt đầu được qua khung chung.
    expect((await goi("POST", "/v1/luot-choi/vuot_man/bat-dau", A.token)).status).toBe(404);
  });

  test("trọn vòng: bắt đầu → đề không lộ đáp án → chấm từng bước → kết thúc hai lần → một dòng XP", async () => {
    const bd = await goi("POST", "/v1/luot-choi/thu_nghiem/bat-dau", A.token);
    expect(bd.status).toBe(201);
    expect(bd.body).toMatchObject({ ma: "thu_nghiem", trang_thai: "dang_choi", so_buoc: 3 });
    expect(bd.body.buoc_hien_tai.thu_tu).toBe(1);
    expect(bd.body.buoc_hien_tai.con_lai_ms).toBeGreaterThan(19_000);
    expect(coKhoaCam(bd.body)).toBeNull();

    const id = bd.body.id as string;
    const lai = await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    expect(coKhoaCam(lai.body)).toBeNull();

    const da = await dapAnLuot(id);
    // Máy khách gửi kèm điểm và "đúng": máy chủ bỏ qua, chỉ đọc lựa chọn.
    const b1 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
      tra_loi: { chon: [da[0]!], diem: 999, dung: true },
      diem: 999,
    });
    expect(b1.status).toBe(200);
    expect(b1.body.ket_qua).toMatchObject({ diem: 10, dung: true, het_gio: false });
    expect(b1.body.ket_qua.thuong).toBeGreaterThan(0);
    expect(b1.body.ket_qua.chi_tiet.dap_an).toBeTruthy();
    expect(b1.body.con_buoc).toBe(true);

    // Trả lời lại bước đã chấm: 409, không chấm hai lần. Nhảy cóc bước: 409.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, { tra_loi: { chon: ["a"] } })).status,
    ).toBe(409);
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, { tra_loi: { chon: ["a"] } })).status,
    ).toBe(409);
    // Sai dạng: 400.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/2`, A.token, { tra_loi: { chon: "a" } })).status,
    ).toBe(400);

    // Mở bước 2 (GET) thì đề bước 2 vẫn không lộ đáp án, và bước 1 đã chấm hiện kết quả.
    const g2 = await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    expect(g2.body.buoc_hien_tai.thu_tu).toBe(2);
    expect(coKhoaCam(g2.body.buoc_hien_tai)).toBeNull();
    expect(g2.body.da_choi).toHaveLength(1);

    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/2`, A.token, { tra_loi: { chon: [sai(da[1]!)] } }))
        .body.ket_qua,
    ).toMatchObject({ diem: 0, dung: false, thuong: 0 });
    const b3 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, { tra_loi: { chon: [da[2]!] } });
    expect(b3.body.con_buoc).toBe(false);

    const kt = await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    expect(kt.status).toBe(200);
    expect(kt.body.trang_thai).toBe("xong");
    expect(kt.body.tong_ket).toMatchObject({
      diem: 20,
      diem_toi_da: 30,
      ty_le: 0.667,
      sao: 1,
      so_dung: 2,
      xp: 7,
    });
    const kt2 = await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    expect(kt2.body.tong_ket.xp).toBe(7);
    expect(await xpLuot(A.id)).toEqual([7]);

    // XP ghi kèm đơn vị lúc chơi (mùa giải đơn vị).
    const [x] = await sql<Array<{ unit_id: string }>>`
      SELECT unit_id FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = 'game:thu_nghiem'`;
    expect(x!.unit_id).toBe(unitId);

    // Lượt đã xong: không trả lời thêm được; xem lại có đủ 3 bước kèm kết quả.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, { tra_loi: { chon: ["a"] } })).status,
    ).toBe(409);
    const xem = await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    expect(xem.body.buoc_hien_tai).toBeNull();
    expect(xem.body.da_choi.map((b: any) => b.ket_qua.dung)).toEqual([true, false, true]);
    expect((await goi("GET", "/v1/luot-choi/lich-su", A.token)).body.items[0].id).toBe(id);
  });

  test("người B không đọc, không trả lời, không kết thúc được lượt của A (403)", async () => {
    const bd = await goi("POST", "/v1/luot-choi/thu_nghiem/bat-dau", A.token);
    const id = bd.body.id;
    expect((await goi("GET", `/v1/luot-choi/luot/${id}`, B.token)).status).toBe(403);
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, B.token, { tra_loi: { chon: ["a"] } })).status,
    ).toBe(403);
    expect((await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, B.token)).status).toBe(403);
    expect((await goi("GET", "/v1/luot-choi/luot/khong-phai-uuid", A.token)).status).toBe(404);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
  });

  test("hồ sơ chủ đề cập nhật theo câu trả lời của lượt chơi", async () => {
    // Trò mẫu rút câu từ mọi câu đã duyệt trong CSDL test, nên so tổng số lượt trong hồ sơ với số
    // bước đã chấm có chủ đề của chính người này.
    const [r] = (await sql`
      SELECT (SELECT COALESCE(sum(attempts), 0)::int FROM topic_stats WHERE account_id = ${A.id}) AS ho_so,
             (SELECT count(*)::int FROM game_run_steps st JOIN game_runs g ON g.id = st.run_id
              WHERE g.account_id = ${A.id} AND st.topic_id IS NOT NULL AND st.correct IS NOT NULL) AS buoc`) as any[];
    expect(r.buoc).toBeGreaterThan(0);
    expect(r.ho_so).toBe(r.buoc);
    const hs = await goi("GET", "/v1/toi/ho-so-chu-de", A.token);
    expect(hs.status).toBe(200);
    expect(hs.body).toHaveProperty("manh");
    expect(hs.body).toHaveProperty("yeu");
  });
});

describe("luật giờ từng bước", () => {
  test("trả lời sau 20 + 2 giây kể từ lúc máy chủ gửi đề: 0 điểm, lượt vẫn đi tiếp", async () => {
    const bd = await goi("POST", "/v1/luot-choi/thu_nghiem/bat-dau", B.token);
    const id = bd.body.id;
    const da = await dapAnLuot(id);
    // Lùi thời điểm mở bước 1 về 23 giây trước.
    await sql`
      UPDATE game_runs SET step_opened_at = jsonb_build_object('1', to_jsonb((now() - interval '23 seconds')::text))
      WHERE id = ${id}`;
    const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, B.token, { tra_loi: { chon: [da[0]!] } });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua).toMatchObject({ diem: 0, dung: false, het_gio: true, thuong: 0 });
    expect(r.body.con_buoc).toBe(true);

    // Tải lại trang không làm đồng hồ chạy lại: thời điểm mở bước 2 giữ lần mở đầu tiên.
    const g1 = await goi("GET", `/v1/luot-choi/luot/${id}`, B.token);
    await Bun.sleep(1_100);
    const g2 = await goi("GET", `/v1/luot-choi/luot/${id}`, B.token);
    expect(g2.body.buoc_hien_tai.con_lai_ms).toBeLessThan(g1.body.buoc_hien_tai.con_lai_ms);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, B.token);
  });
});

describe("XP giảm dần khi chơi lặp trong ngày", () => {
  test("lượt 1–3 đủ XP, lượt 4 một nửa (cùng ngày giờ Việt Nam)", async () => {
    const C = await taoTaiKhoan("c");
    for (let i = 0; i < 4; i++) {
      const kt = await choiLuot(C.token, 3);
      expect(kt.status).toBe(200);
    }
    expect(await xpLuot(C.id)).toEqual([10, 10, 10, 5]);

    // Sang ngày mới theo giờ Việt Nam thì đếm lại: dời 4 lượt cũ về hôm qua, lượt kế tiếp đủ XP.
    await sql`UPDATE game_runs SET played_at = played_at - interval '1 day' WHERE account_id = ${C.id}`;
    await choiLuot(C.token, 3);
    expect(await xpLuot(C.id)).toEqual([10, 10, 10, 5, 10]);
  });
});

describe("đồng bộ offline", () => {
  /** Dựng lượt trên "điện thoại" đúng như trang offline: cùng hàm sinh lượt của khung. */
  async function choiOffline(token: string, opts: { soDung: number; batDau?: Date } = { soDung: 3 }) {
    const goi_ = await goi("GET", "/v1/luot-choi/goi-offline/thu_nghiem", token);
    expect(goi_.status).toBe(200);
    expect(goi_.body.nguon.length).toBeGreaterThanOrEqual(3);
    const seed = crypto.randomUUID();
    const buoc = TRO_CHOI_THU_NGHIEM.taoLuot(goi_.body.nguon, taoRng(seed));
    const batDau = opts.batDau ?? new Date();
    return {
      goiId: goi_.body.goi_id as string,
      luot: {
        client_id: crypto.randomUUID(),
        ma: "thu_nghiem",
        goi_id: goi_.body.goi_id,
        seed,
        bat_dau: batDau.toISOString(),
        ket_thuc: new Date(batDau.getTime() + 30_000).toISOString(),
        buoc: buoc.map((b, i) => {
          const d = b.noi_dung.noi_dung.answer.dung![0]!;
          return {
            client_id: crypto.randomUUID(),
            thu_tu: b.thu_tu,
            tra_loi: { chon: [i < opts.soDung ? d : sai(d)] },
          };
        }),
      },
    };
  }

  test("gói offline chỉ có câu đã duyệt và được phép offline", async () => {
    const [q] = await sql<Array<{ id: string }>>`
      UPDATE questions SET offline_ok = false WHERE code = ${`${PREFIX}-0`} RETURNING id`;
    const g = await goi("GET", "/v1/luot-choi/goi-offline/thu_nghiem", A.token);
    expect(g.body.nguon.map((c: any) => c.id)).not.toContain(q!.id);
    await sql`UPDATE questions SET offline_ok = true WHERE id = ${q!.id}`;
  });

  test("gửi hai lần: một lượt, ba bước, XP cộng một lần; máy chủ chấm lại, không thưởng nhanh", async () => {
    const D = await taoTaiKhoan("d");
    const { luot } = await choiOffline(D.token, { soDung: 2 });
    const r1 = await goi("POST", "/v1/luot-choi/dong-bo", D.token, { luot: [luot] });
    expect(r1.status).toBe(200);
    expect(r1.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 3, so_buoc_trung: 0, da_ket_thuc: true, xp: 7 });
    const r2 = await goi("POST", "/v1/luot-choi/dong-bo", D.token, { luot: [luot] });
    expect(r2.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 0, so_buoc_trung: 3, da_ket_thuc: true, xp: 0 });

    const runs = await sql<
      Array<{ id: string; offline: boolean; score: number; bonus: number; stars: number }>
    >`
      SELECT id, offline, score::float8 AS score, bonus::float8 AS bonus, stars FROM game_runs WHERE account_id = ${D.id}`;
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ offline: true, score: 20, bonus: 0, stars: 1 });
    const [{ n }] =
      (await sql`SELECT count(*)::int AS n FROM game_run_steps WHERE run_id = ${runs[0]!.id}`) as any;
    expect(n).toBe(3);
    expect(await xpLuot(D.id)).toEqual([7]);
  });

  test("gửi phần đã làm trước, phần còn lại và kết thúc sau: không trùng bước, XP một lần", async () => {
    const E = await taoTaiKhoan("e");
    const { luot } = await choiOffline(E.token, { soDung: 3 });
    const dau = { ...luot, ket_thuc: null, buoc: luot.buoc.slice(0, 1) };
    expect(
      (await goi("POST", "/v1/luot-choi/dong-bo", E.token, { luot: [dau] })).body.ket_qua[0],
    ).toMatchObject({
      so_buoc_moi: 1,
      da_ket_thuc: false,
      xp: 0,
    });
    expect(
      (await goi("POST", "/v1/luot-choi/dong-bo", E.token, { luot: [luot] })).body.ket_qua[0],
    ).toMatchObject({
      so_buoc_moi: 2,
      so_buoc_trung: 1,
      da_ket_thuc: true,
      xp: 10,
    });
    expect(await xpLuot(E.id)).toEqual([10]);
  });

  test("dùng gói của người khác, hoặc client_id đã thuộc người khác: bị bỏ qua", async () => {
    const { luot } = await choiOffline(A.token);
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.body.ket_qua[0].loi).toContain("Gói nội dung không hợp lệ");
    const [{ n }] =
      (await sql`SELECT count(*)::int AS n FROM game_runs WHERE client_id = ${luot.client_id}`) as any;
    expect(n).toBe(0);

    await goi("POST", "/v1/luot-choi/dong-bo", A.token, { luot: [luot] });
    const cuaB = await choiOffline(B.token);
    const r2 = await goi("POST", "/v1/luot-choi/dong-bo", B.token, {
      luot: [{ ...cuaB.luot, client_id: luot.client_id }],
    });
    expect(r2.body.ket_qua[0].loi).toContain("tài khoản khác");
  });

  test("chơi quá 7 ngày trước khi gửi: lưu kết quả, không có XP", async () => {
    const F = await taoTaiKhoan("f");
    const muoi = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    const { luot, goiId } = await choiOffline(F.token, {
      soDung: 3,
      batDau: new Date(Date.now() - 8 * 24 * 3600 * 1000),
    });
    await sql`UPDATE game_packs SET issued_at = ${muoi} WHERE id = ${goiId}`;
    const r = await goi("POST", "/v1/luot-choi/dong-bo", F.token, { luot: [luot] });
    expect(r.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 3, da_ket_thuc: true, xp: 0 });
    expect(await xpLuot(F.id)).toEqual([]);
  });

  test("chơi trước khi tải gói hoặc sau khi gói hết hạn: bị bỏ qua", async () => {
    const { luot, goiId } = await choiOffline(A.token, {
      soDung: 3,
      batDau: new Date(Date.now() - 3600_000),
    });
    const r = await goi("POST", "/v1/luot-choi/dong-bo", A.token, { luot: [luot] });
    expect(r.body.ket_qua[0].loi).toContain("trước khi tải gói");
    await sql`UPDATE game_packs SET issued_at = now() - interval '20 days', expires_at = now() - interval '6 days'
              WHERE id = ${goiId}`;
    const r2 = await goi("POST", "/v1/luot-choi/dong-bo", A.token, {
      luot: [{ ...luot, client_id: crypto.randomUUID(), bat_dau: new Date().toISOString() }],
    });
    expect(r2.body.ket_qua[0].loi).toContain("hết hạn");
  });

  test("câu bị gỡ duyệt sau khi tải gói: bước vẫn lưu nhưng 0 điểm", async () => {
    const G = await taoTaiKhoan("g");
    const { luot } = await choiOffline(G.token, { soDung: 3 });
    const [r0] = await sql<Array<{ items: any[] }>>`SELECT items FROM game_packs WHERE id = ${luot.goi_id}`;
    const buoc = TRO_CHOI_THU_NGHIEM.taoLuot(r0!.items, taoRng(luot.seed));
    const idCau = buoc[0]!.ref_id!;
    await sql`UPDATE questions SET status = 'cho_duyet' WHERE id = ${idCau}`;
    try {
      await goi("POST", "/v1/luot-choi/dong-bo", G.token, { luot: [luot] });
      const [s] = await sql<Array<{ points: number; correct: boolean }>>`
        SELECT st.points::float8 AS points, st.correct FROM game_run_steps st
        JOIN game_runs r ON r.id = st.run_id WHERE r.client_id = ${luot.client_id} AND st.ordinal = 1`;
      expect(s).toMatchObject({ points: 0, correct: true });
    } finally {
      await sql`UPDATE questions SET status = 'da_duyet' WHERE id = ${idCau}`;
    }
  });
});
