/**
 * Kiểm thử API trò "Soi camera" (docs/PLAN.md GĐ-T5) trên Postgres test thật: đề không có cửa sổ vi
 * phạm, nhãn lỗi hay cờ vi phạm; máy chủ chạy lại mô phỏng và chấm từ nhật ký; điểm máy khách gửi bị
 * bỏ qua; tua lại lần thứ 4 bị bỏ qua; biên bản lấy mức phạt đã duyệt; sửa mức phạt thì kịch bản rút
 * khỏi trò; đồng bộ offline.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import {
  type BuocSoiCamera,
  chayKichBan,
  type DapAnKichBan,
  hopCacXe,
  type PayloadKichBan,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-sc";
const MA = "soi_camera";
const URN = "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-7";
const MA_PHAT = `${PREFIX}-mu`;

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
  "vi_pham",
  "bat_dau",
  "ket_thuc",
  "ma_muc_phat",
  "noi_dung",
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

/** SC-01 (màn 1, xe máy không mũ bảo hiểm), trỏ tới dòng mức phạt thử. */
const mau = (
  (await Bun.file(join(import.meta.dir, "..", "..", "..", "data", "tro-choi", "soi-camera.json")).json()) as {
    doan: Array<{ ma: string; payload: PayloadKichBan; answer: DapAnKichBan }>;
  }
).doan.find((d) => d.ma === "SC-01")!;
const answer: DapAnKichBan = { vi_pham: mau.answer.vi_pham.map((v) => ({ ...v, ma_muc_phat: MA_PHAT })) };

async function buocCuaLuot(id: string): Promise<BuocSoiCamera> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items[0].noi_dung;
}

/** Nhật ký bắt đúng mọi vi phạm của bước. */
function nhatKyDung(b: BuocSoiCamera, them: Array<Record<string, unknown>> = [], tong = 1) {
  const ds = chayKichBan(b.kich_ban);
  const ops: Array<Record<string, unknown>> = [...them];
  for (const v of b.vi_pham) {
    const n = v.bat_dau + 3;
    ops.push({ nhip: 0, thao_tac: "dung_hinh", tham_so: { nhip_phim: n } });
    ops.push({
      nhip: 0,
      thao_tac: "khoanh",
      tham_so: { nhip_phim: n, hop: hopCacXe(ds[n]!).get(v.xe), loi: v.loai },
    });
    ops.push({ nhip: 0, thao_tac: "tiep_tuc", tham_so: null });
  }
  return { thao_tac: ops, tong_nhip: tong };
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  await sql`
    INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
    VALUES (${MA_PHAT}, 'mo_to', 'Không đội mũ bảo hiểm (dòng thử)', 400000, 600000, ${URN}, '2025-01-01', 'da_duyet')`;
  for (const ten of ["kb-1", "kb-cho-duyet"]) {
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
    if (ten === "kb-1") {
      const kq = await chuyenTrangThaiNoiDung({
        id: nd.id,
        tu: ["cho_duyet"],
        den: "da_duyet",
        hanhDong: "duyet",
        actor: "test",
      });
      expect(kq?.ok).toBe(true);
    }
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

describe("Soi camera: lượt online", () => {
  let idLuot = "";

  test("bắt đầu màn 1: một đoạn phim; đề không có cửa sổ vi phạm, nhãn lỗi hay cờ vi phạm", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.so_buoc).toBe(1);
    // `bat_dau`, `ket_thuc` ở gốc là giờ bắt đầu, kết thúc lượt của khung chung; trong bước thì không được có.
    expect(coKhoaCam(r.body.buoc_hien_tai)).toBeNull();
    const { bat_dau: _a, ket_thuc: _b, ...conLai } = r.body;
    expect(coKhoaCam(conLai)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.toc_do_phat).toBe(0.75);
    expect(de.so_lan_tua).toBe(3);
    expect(de.kich_ban.xe).toHaveLength(mau.payload.xe.length);
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
  });

  test("chấm lại từ nhật ký: điểm giả bị bỏ qua; tua lần thứ 4 bị bỏ qua; biên bản có mức phạt đã duyệt", async () => {
    const b = await buocCuaLuot(idLuot);
    const tua = Array.from({ length: 4 }, () => ({ nhip: 0, thao_tac: "tua", tham_so: { nhip_phim: 0 } }));
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: { ...nhatKyDung(b, tua), diem: 999, dung: true },
    });
    expect(r.status).toBe(200);
    const kq = r.body.ket_qua;
    expect(kq.diem).toBe(20);
    expect(kq.chi_tiet.so_lan_tua).toBe(3);
    expect(kq.chi_tiet.bo_qua.tua).toBe(1);
    expect(kq.chi_tiet.vi_pham[0]).toMatchObject({ xe: "x2", loai: "khong_mu_bao_hiem", diem: 20 });
    expect(kq.chi_tiet.bien_ban[0].muc_phat.ma).toBe(MA_PHAT);
    expect(kq.can_cu).toEqual([URN]);
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(3);
  });

  test("khoanh nhầm và bỏ sót: 0 điểm, vi phạm bị liệt kê; nhật ký sai dạng 400", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    const bad = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, B.token, {
      tra_loi: {
        thao_tac: [{ nhip: 0, thao_tac: "khoanh", tham_so: { nhip_phim: 1, hop: [0, 0], loi: "sai_lan" } }],
        tong_nhip: 1,
      },
    });
    expect(bad.status).toBe(400);
    const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, B.token, {
      tra_loi: {
        thao_tac: [
          { nhip: 0, thao_tac: "dung_hinh", tham_so: { nhip_phim: 5 } },
          { nhip: 0, thao_tac: "khoanh", tham_so: { nhip_phim: 5, hop: [0, 0, 20, 20], loi: "sai_lan" } },
        ],
        tong_nhip: 1,
      },
    });
    expect(tl.body.ket_qua.diem).toBe(0);
    expect(tl.body.ket_qua.chi_tiet.khoanh_nham).toHaveLength(1);
    expect(tl.body.ket_qua.chi_tiet.vi_pham[0].khoanh).toBeNull();
  });

  test("sửa dòng mức phạt kịch bản trỏ tới: kịch bản rút khỏi trò", async () => {
    await sql`UPDATE violations SET version = version + 1 WHERE code = ${MA_PHAT}`;
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    await sql`UPDATE violations SET version = version - 1 WHERE code = ${MA_PHAT}`;
  });
});

describe("Soi camera: offline", () => {
  test("gói offline chơi được; máy chủ chấm lại khi đồng bộ, không so đồng hồ", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const [{ items }] = (await sql`
      SELECT items FROM game_packs WHERE id = ${goi1.body.goi_id}`) as any[];
    const b = (items as Array<{ kich_ban: PayloadKichBan }>)[0];
    expect(b).toBeTruthy();
    const ds = chayKichBan(mau.payload);
    const [v] = [{ xe: "x2", n: 100 }];
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-sc",
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: {
            thao_tac: [
              { nhip: 0, thao_tac: "dung_hinh", tham_so: { nhip_phim: v.n } },
              {
                nhip: 0,
                thao_tac: "khoanh",
                tham_so: { nhip_phim: v.n, hop: hopCacXe(ds[v.n]!).get(v.xe), loi: "khong_mu_bao_hiem" },
              },
            ],
            tong_nhip: 9000,
          },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].so_buoc_moi).toBe(1);
    const [s] = (await sql`
      SELECT points FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    expect(Number(s.points)).toBe(20);
  });
});
