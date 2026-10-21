/**
 * Kiểm thử API trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10) trên Postgres test thật: trò tắt sẵn trong
 * migration; đề có dấu vết nhưng không có dựng cảnh gốc, lỗi đúng, mã mức phạt; máy chủ chạy lại nhật ký và
 * chấm dựng cảnh lúc nộp, điểm máy khách gửi bị bỏ qua, cùng dựng cảnh cùng băm ở máy khách và máy chủ; mô
 * phỏng lần thứ 21 trong một lượt bị từ chối (chống dò); người khác không đọc được lượt; biên bản có mức phạt
 * đã duyệt; sửa dòng mức phạt thì vụ rút khỏi trò; đồng bộ offline.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import {
  type BuocTaiDung,
  chayTaiDung,
  type DapAnTaiDung,
  type PayloadTaiDung,
  SO_LAN_MO_PHONG_TOI_DA,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-td";
const MA = "tai_dung_hien_truong";
const MA_PHAT = `${PREFIX}-khoang-cach`;
const URN = "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-1";

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

/** Khóa không được có trong phản hồi trước khi chấm: đáp án, dựng cảnh gốc, lỗi đúng, mã mức phạt. */
const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "explanation",
  "noi_dung",
  "dung_canh",
  "loi",
  "ma_muc_phat",
  "bien_ban",
  "hanh_dong",
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

async function taoTaiKhoan(ten: string): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, 'can_bo') RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  const acc = sql`SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM game_runs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_packs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_level_progress WHERE account_id IN (${acc})`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM content_reviews WHERE ref IN (SELECT id::text FROM game_content WHERE title LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** TD-01 (màn 1, một xe đâm rào) trỏ tới dòng mức phạt thử. */
const mau = (
  (await Bun.file(join(import.meta.dir, "..", "..", "..", "data", "tro-choi", "tai-dung.json")).json()) as {
    vu: Array<{ ma: string; payload: PayloadTaiDung; answer: DapAnTaiDung }>;
  }
).vu.find((v) => v.ma === "TD-01")!;
const answer: DapAnTaiDung = {
  ...mau.answer,
  loi: mau.answer.loi.map((l) => ({ ...l, ma_muc_phat: MA_PHAT })),
};

/** Nhật ký dựng đúng cảnh gốc, mô phỏng `soLan` lần, gắn thẻ lỗi đúng. */
function nhatKy(soLan = 1, tong?: number) {
  const thao_tac: unknown[] = [];
  let nhip = 0;
  for (const d of answer.dung_canh) {
    thao_tac.push({ nhip: nhip++, thao_tac: "dat", tham_so: { xe: d.xe, x: d.x, y: d.y } });
    thao_tac.push({ nhip: nhip++, thao_tac: "xoay", tham_so: { xe: d.xe, huong: d.huong } });
    thao_tac.push({ nhip: nhip++, thao_tac: "toc_do", tham_so: { xe: d.xe, muc: d.muc } });
    thao_tac.push({ nhip: nhip++, thao_tac: "hanh_dong", tham_so: { xe: d.xe, hd: d.hanh_dong } });
  }
  for (let i = 0; i < soLan; i++) thao_tac.push({ nhip: nhip++, thao_tac: "mo_phong", tham_so: null });
  for (const l of answer.loi)
    thao_tac.push({ nhip: nhip++, thao_tac: "gan_loi", tham_so: { xe: l.xe, loi: l.loi } });
  return { thao_tac, tong_nhip: tong ?? nhip };
}

async function buocCuaLuot(id: string): Promise<BuocTaiDung> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items[0].noi_dung;
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let idChoDuyet = "";
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  await sql`
    INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
    VALUES (${MA_PHAT}, 'o_to', 'Chạy quá tốc độ (dòng thử)', 1, 2, ${URN}, '2025-01-01', 'da_duyet')`;
  for (const ten of ["vu-1", "vu-cho-duyet"]) {
    const nd = await taoNoiDungTroChoi(
      {
        game_code: MA,
        topic_id: null,
        level: "de",
        title: `${PREFIX} ${ten}`,
        payload: mau.payload as never,
        answer: answer as never,
        explanation: null,
        citations: [],
        refs: [{ loai: "violation", ma: MA_PHAT }],
        offline_ok: true,
        status: "cho_duyet",
      },
      "test",
    );
    if (ten === "vu-1") {
      const kq = await chuyenTrangThaiNoiDung({
        id: nd.id,
        tu: ["cho_duyet"],
        den: "da_duyet",
        hanhDong: "duyet",
        actor: "test",
      });
      expect(kq?.ok).toBe(true);
    } else idChoDuyet = nd.id;
  }
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  expect(g).toBeTruthy();
  enabledCu = Boolean(g.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

const tra = (id: string, token: string, tra_loi: unknown) =>
  goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, token, { tra_loi });
const batDau = async (token: string, man = 1) => {
  const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, token, { man });
  expect(r.status).toBe(201);
  return r.body;
};

describe("Tái dựng hiện trường: đăng ký", () => {
  test("trò tắt sẵn trong migration, chơi offline được", async () => {
    // Đọc cấu hình gốc trước khi beforeAll bật: `enabledCu`.
    expect(enabledCu).toBe(false);
    const [g] = (await sql`SELECT offline_ok, engine FROM games WHERE code = ${MA}`) as any[];
    expect(g.offline_ok).toBe(true);
    expect(g.engine).toBe("luot_choi");
  });
});

describe("Tái dựng hiện trường: lượt online", () => {
  test("trò có 5 màn; đề có sơ đồ, dấu vết, thẻ lỗi; không có dựng cảnh gốc; không dùng vụ chờ duyệt", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(ds.body.tro_choi.find((x: any) => x.ma === MA).man).toHaveLength(5);
    const r = await batDau(A.token);
    const { bat_dau: _a, ket_thuc: _b, ...conLai } = r;
    expect(coKhoaCam(conLai)).toBeNull();
    const de = r.buoc_hien_tai.de;
    expect(de.so_lan_toi_da).toBe(SO_LAN_MO_PHONG_TOI_DA);
    expect(de.dau_vet.cuoi).toHaveLength(1);
    expect(de.dau_vet.vet.length).toBeGreaterThan(0);
    expect(de.ghi_chu).toContain("không phải phương pháp giám định");
    expect(JSON.stringify(de)).not.toContain('"muc":3,"hanh_dong"');
    const items = (await sql`SELECT items FROM game_runs WHERE id = ${r.id}`) as any[];
    expect(items[0].items.some((b: any) => b.ref_id === idChoDuyet)).toBe(false);
    expect((await goi("GET", `/v1/luot-choi/luot/${r.id}`, B.token)).status).toBe(403);
  });

  test("chấm lại từ nhật ký: điểm máy khách bị bỏ qua; băm khớp máy khách; biên bản có mức phạt; XP một lần", async () => {
    const r = await batDau(A.token);
    const b = await buocCuaLuot(r.id);
    const bamMay = chayTaiDung(r.buoc_hien_tai.de, {
      A: { x: 12, y: 64, huong: 0, muc: 3, hanh_dong: "phanh" },
    }).bam;
    const kq = await tra(r.id, A.token, { ...nhatKy(1), diem: 3, dung: false, khop: 0 });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.diem).toBe(100);
    expect(kq.body.ket_qua.dung).toBe(true);
    const ct = kq.body.ket_qua.chi_tiet;
    expect(ct.bam).toBe(bamMay);
    expect(ct.khop.diem).toBe(50);
    expect(ct.bien_ban[0].muc_phat.ma).toBe(MA_PHAT);
    expect(kq.body.ket_qua.can_cu).toEqual([URN]);
    expect(b.dap_an.dung_canh).toHaveLength(1);
    expect((await tra(r.id, A.token, nhatKy(1))).status).toBe(409);
    const kt = await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(3);
    await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`} AND source_id = ${r.id}`) as any[];
    expect(xp).toHaveLength(1);
  });

  test("mô phỏng thứ 21 trong một lượt bị từ chối (400); 20 lần vẫn chấm", async () => {
    const r = await batDau(B.token);
    expect((await tra(r.id, B.token, nhatKy(SO_LAN_MO_PHONG_TOI_DA + 1))).status).toBe(400);
    const kq = await tra(r.id, B.token, nhatKy(SO_LAN_MO_PHONG_TOI_DA));
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.chi_tiet.so_lan_mo_phong).toBe(20);
    expect(kq.body.ket_qua.diem).toBe(90);
  });

  test("nhật ký sai dạng 400; mốc thời gian sai 0 điểm", async () => {
    const r = await batDau(B.token);
    const sai = {
      thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { xe: "A", x: 1.5, y: 3 } }],
      tong_nhip: 1,
    };
    expect((await tra(r.id, B.token, sai)).status).toBe(400);
    const kq = await tra(r.id, B.token, nhatKy(1, 2000));
    expect(kq.body.ket_qua.diem).toBe(0);
    expect(kq.body.ket_qua.chi_tiet.ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("sửa dòng mức phạt vụ trỏ tới: vụ rút khỏi trò", async () => {
    await sql`UPDATE violations SET version = version + 1 WHERE code = ${MA_PHAT}`;
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, { man: 1 });
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    await sql`UPDATE violations SET version = version - 1 WHERE code = ${MA_PHAT}`;
  });
});

describe("Tái dựng hiện trường: offline", () => {
  test("gói offline có vụ; đồng bộ được máy chủ chấm lại, gửi lại không sinh lượt mới", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-td",
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { ...nhatKy(2, 3000), diem: 1 },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].so_buoc_moi).toBe(1);
    const [s] = (await sql`
      SELECT points FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    expect(Number(s.points)).toBe(100);
    const lai = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(lai.body.ket_qua[0].id).toBe(r.body.ket_qua[0].id);
    expect(lai.body.ket_qua[0].so_buoc_moi).toBe(0);
  });
});
