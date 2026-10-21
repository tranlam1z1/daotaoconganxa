/**
 * Kiểm thử API trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4) trên Postgres test thật: quy trình
 * chưa duyệt thì không có nguồn; đề không có thứ tự quy trình, vị trí an toàn, hướng xử lý; máy chủ
 * chấm lại từ nhật ký, bỏ điểm máy khách gửi và thao tác lạ; người khác không đọc, ghi được lượt;
 * XP một lần; đồng bộ offline hai lần chỉ một lượt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import type { BuocDungXe, DapAnDungXe, PayloadDungXe, QuyTrinh } from "@qdpl/dao-tao";
import { type DongLuatGiayToTep, napLuatGiayTo, napTraCuuNhanh, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-dx";
const GOC = join(import.meta.dir, "..", "..", "..");
const MA_QT = "dung-xe-kiem-tra";

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

const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "explanation",
  "vi_tri_an_toan",
  "huong_xu_ly",
  "giay_to_dung",
  "quy_trinh",
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

async function taoTaiKhoan(ten: string, role = "can_bo"): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  const acc = sql`SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM game_runs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_packs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_level_progress WHERE account_id IN (${acc})`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const quyTrinhTep = (await Bun.file(join(GOC, "data/tra-cuu/quy-trinh.json")).json()) as {
  quy_trinh: QuyTrinh[];
};
const QT = quyTrinhTep.quy_trinh.find((q) => q.ma === MA_QT)!;
const luatTep = (await Bun.file(join(GOC, "data/tra-cuu/luat-giay-to.json")).json()) as {
  dong: DongLuatGiayToTep[];
};
const mauTep = (await Bun.file(join(GOC, "data/tro-choi/dung-xe.json")).json()) as {
  tinh_huong: Array<{ ma: string; tinh_huong: PayloadDungXe; dap_an: DapAnDungXe }>;
};

/** Nhật ký làm đúng quy trình cho một tình huống không có phản ứng, không đo cồn. */
function nhatKyDung(b: BuocDungXe) {
  const ds: any[] = [];
  let ms = 0;
  const them = (t: object) => {
    ms += 800;
    ds.push({ ms, ...t });
  };
  them({ loai: "vuot", huong: "len" });
  if (b.tinh_huong.vi_tri.length) them({ loai: "cham", muc_tieu: `vi_tri:${b.vi_tri_an_toan[0]}` });
  them({ loai: "cham", muc_tieu: "loi:thong_bao_ly_do" });
  them({ loai: "cham", muc_tieu: "loi:yeu_cau_xuat_trinh" });
  for (const g of ["gplx", "dang_ky", "bao_hiem"] as const)
    them({ loai: "keo", muc_tieu: `giay_to:${g}`, dich: b.giay_to_dung[g] });
  them({ loai: "keo", muc_tieu: "ket_qua", dich: b.huong_xu_ly });
  return { nhat_ky: ds, tong_ms: ms + 200 };
}

async function buocCuaLuot(id: string): Promise<BuocDungXe> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items[0].noi_dung;
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let phapChe: { id: string; token: string };
let trangThaiQtCu: string | null = null;
const tinhHuongId: Record<string, string> = {};

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  const [cu] = (await sql`SELECT status FROM procedures WHERE code = ${MA_QT}`) as any[];
  trangThaiQtCu = cu?.status ?? null;
  // Luật giấy tờ đã duyệt (bản sao có tiền tố, để không đổi dữ liệu dùng chung).
  await napLuatGiayTo(
    luatTep.dong.map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" })),
    { tienTo: PREFIX },
  );
  // Quy trình ở bản nháp: tình huống chưa duyệt được.
  await napTraCuuNhanh([], [{ ...QT, trang_thai: "nhap" }], { tienTo: MA_QT });
  for (const ma of ["DX-01", "DX-02"]) {
    const t = mauTep.tinh_huong.find((x) => x.ma === ma)!;
    const nd = await taoNoiDungTroChoi(
      {
        game_code: "dung_xe",
        topic_id: null,
        level: "de",
        title: `${PREFIX} ${ma}`,
        payload: t.tinh_huong as any,
        answer: t.dap_an as any,
        explanation: null,
        citations: [],
        refs: [{ loai: "procedure", ma: MA_QT }],
        offline_ok: true,
        status: "cho_duyet",
      },
      PREFIX,
    );
    tinhHuongId[ma] = nd.id;
  }
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = false WHERE code = 'dung_xe'`;
  if (trangThaiQtCu) await sql`UPDATE procedures SET status = ${trangThaiQtCu} WHERE code = ${MA_QT}`;
  else await sql`DELETE FROM procedures WHERE code = ${MA_QT}`;
  await donDep();
});

describe("đăng ký và nội dung", () => {
  test("trò đã đăng ký, tắt sẵn, có offline", async () => {
    const [g] = (await sql`SELECT offline_ok, engine, enabled FROM games WHERE code = 'dung_xe'`) as any[];
    expect(g).toMatchObject({ offline_ok: true, engine: "luot_choi" });
  });

  test("quy trình chưa duyệt thì tình huống không duyệt được; duyệt quy trình rồi duyệt tình huống", async () => {
    const r = await goi(
      "POST",
      `/v1/quan-tri/noi-dung-tro-choi/${tinhHuongId["DX-01"]}/duyet`,
      phapChe.token,
    );
    expect(r.status).not.toBe(200);
    await napTraCuuNhanh([], [{ ...QT, trang_thai: "da_duyet" }], { tienTo: MA_QT });
    for (const id of Object.values(tinhHuongId))
      expect((await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, phapChe.token)).status).toBe(
        200,
      );
    await sql`UPDATE games SET enabled = true WHERE code = 'dung_xe'`;
  });

  test("tra cứu nhanh không hiện phần thao tác của quy trình", async () => {
    const r = await goi("GET", `/v1/tra-cuu/quy-trinh/${MA_QT}`, A.token);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).toContain("Ra hiệu lệnh dừng xe");
    expect(JSON.stringify(r.body)).not.toContain("tro_choi");
    expect(JSON.stringify(r.body)).not.toContain("thao_tac");
  });
});

describe("một lượt màn 1", () => {
  let id = "";

  test("bắt đầu: một tình huống, đề không lộ đáp án; có gợi ý thứ tự ở màn 1", async () => {
    const r = await goi("POST", "/v1/luot-choi/dung_xe/bat-dau", A.token, { man: 1 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ma: "dung_xe", so_buoc: 1 });
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.goi_y_thu_tu[0]).toBe("hieu_lenh_dung");
    expect(de.giay_to.gplx).toBeTruthy();
    id = r.body.id;
    expect(((await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[])[0].items[0].ref_id).toBe(
      tinhHuongId["DX-01"],
    );
  });

  test("người khác không đọc, không ghi được lượt (403)", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${id}`, B.token)).status).toBe(403);
    const b = await buocCuaLuot(id);
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, B.token, { tra_loi: nhatKyDung(b) })).status,
    ).toBe(403);
  });

  test("sai dạng: 400; quá 2.000 thao tác: 400", async () => {
    expect(
      (
        await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
          tra_loi: { nhat_ky: "x", tong_ms: 1 },
        })
      ).status,
    ).toBe(400);
    const nhieu = Array.from({ length: 2001 }, (_, i) => ({ ms: i, loai: "vuot", huong: "len" }));
    expect(
      (
        await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
          tra_loi: { nhat_ky: nhieu, tong_ms: 3000 },
        })
      ).status,
    ).toBe(400);
  });

  test("máy chủ chấm lại: bỏ điểm máy khách gửi, bỏ qua thao tác lạ; đủ điểm; kết thúc hai lần một dòng XP", async () => {
    const b = await buocCuaLuot(id);
    const tl = nhatKyDung(b);
    tl.nhat_ky.splice(1, 0, { ms: tl.nhat_ky[0].ms, loai: "cham", muc_tieu: "loi:hack" });
    // Giả như người chơi đã chơi 30 giây (nhật ký dài 6 giây, khớp đồng hồ máy chủ).
    await sql`
      UPDATE game_runs SET step_opened_at = step_opened_at || jsonb_build_object('1', to_jsonb((now() - interval '30 seconds')::text))
      WHERE id = ${id}`;
    const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
      tra_loi: { ...tl, diem: 999, dung: true },
      diem: 999,
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua).toMatchObject({ diem: 50, dung: true });
    expect(r.body.ket_qua.chi_tiet.so_sanh.map((x: any) => x.ket)).toEqual(Array(5).fill("dung"));
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    const xp =
      (await sql`SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = 'game:dung_xe'`) as any[];
    expect(xp).toHaveLength(1);
  });

  test("qua màn 1 thì mở màn 2; màn 2 có vị trí dừng, không có gợi ý", async () => {
    const r = await goi("POST", "/v1/luot-choi/dung_xe/bat-dau", A.token, { man: 2 });
    expect(r.status).toBe(201);
    const de = r.body.buoc_hien_tai.de;
    expect(de.goi_y_thu_tu).toBeNull();
    expect(de.vi_tri.length).toBe(3);
    expect(coKhoaCam(r.body)).toBeNull();
    // Nhật ký dài hơn đồng hồ máy chủ: 0 điểm.
    const b = await buocCuaLuot(r.body.id);
    const tl = nhatKyDung(b);
    const s = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, A.token, {
      tra_loi: {
        nhat_ky: tl.nhat_ky.map((t: any) => ({
          ...t,
          ms: t.ms * 20,
          ...(t.tu_ms ? { tu_ms: t.tu_ms * 20 } : {}),
        })),
        tong_ms: tl.tong_ms * 20,
      },
    });
    expect(s.body.ket_qua.diem).toBe(0);
    expect(s.body.ket_qua.chi_tiet.hop_le).toBe(false);
  });
});

describe("offline", () => {
  test("gói có tình huống đã duyệt; đồng bộ một lượt hai lần chỉ sinh một lượt", async () => {
    const g = await goi("GET", "/v1/luot-choi/goi-offline/dung_xe", B.token);
    expect(g.status).toBe(200);
    expect(g.body.nguon.map((n: any) => n.id)).toContain(tinhHuongId["DX-01"]);
    const luot = {
      client_id: randomUUID(),
      ma: "dung_xe",
      goi_id: g.body.goi_id,
      seed: "offline-dung-xe-1",
      man: 1,
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: randomUUID(),
          thu_tu: 1,
          tra_loi: { nhat_ky: [{ ms: 500, loai: "vuot", huong: "len" }], tong_ms: 1000 },
        },
      ],
    };
    const r1 = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r1.status).toBe(200);
    expect(r1.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 1, da_ket_thuc: true });
    const r2 = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r2.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 0, so_buoc_trung: 1 });
    const runs =
      (await sql`SELECT score::float8 AS score FROM game_runs WHERE account_id = ${B.id} AND game_code = 'dung_xe'`) as any[];
    expect(runs).toHaveLength(1);
    // Chỉ ra hiệu lệnh: 10 điểm của bước đầu, máy chủ chấm lại.
    expect(runs[0].score).toBe(10);
  });
});

describe("sửa quy trình trong quản trị", () => {
  test("giữ phần thao tác của bước; bước sai dạng bị từ chối; tình huống rút khỏi trò tới khi duyệt lại", async () => {
    const bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
    const cu = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/quy-trinh/${MA_QT}`, bienTap.token);
    expect(cu.status).toBe(200);
    const sai = cu.body.steps.map((b: any, i: number) =>
      i === 0 ? { ...b, tro_choi: { ...b.tro_choi, nguon: "van_ban" } } : b,
    );
    const r400 = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/quy-trinh/${MA_QT}`, bienTap.token, {
      title: cu.body.title,
      summary: cu.body.summary,
      steps: sai,
      version: cu.body.version,
    });
    expect(r400.status).toBe(400);
    const r = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/quy-trinh/${MA_QT}`, bienTap.token, {
      title: cu.body.title,
      summary: cu.body.summary,
      steps: cu.body.steps,
      version: cu.body.version,
    });
    expect(r.status).toBe(200);
    const [q] = (await sql`SELECT steps FROM procedures WHERE code = ${MA_QT}`) as any[];
    expect(q.steps[0].tro_choi).toMatchObject({ ma: "hieu_lenh_dung", thao_tac: "vuot" });
    expect((await goi("POST", "/v1/luot-choi/dung_xe/bat-dau", A.token, { man: 1 })).status).not.toBe(201);
  });
});
