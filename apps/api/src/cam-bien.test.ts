/**
 * Kiểm thử API trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3) trên Postgres test thật: đề không
 * lộ biển đúng, chấm lại từ nhật ký trên máy chủ, điểm máy khách gửi bị bỏ qua, gian lận thời gian
 * được 0 điểm, chạy lại dưới 200 ms, sửa biển trong khay thì đoạn đường rút khỏi trò, đồng bộ offline.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import {
  type BuocCamBien,
  type DapAnDoanDuong,
  type PayloadDoanDuong,
  TRO_CHOI_CAM_BIEN,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-cb";
const MA = "cam_bien";
const URN = "vn:vbqppl:qcvn:41/2024/BGTVT";

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
  "dung",
  "chap_nhan",
  "ly_do",
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
  await sql`DELETE FROM content_reviews WHERE ref IN (SELECT id::text FROM game_content WHERE title LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM traffic_signs WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Biển thử: mã, phản ứng. */
const BIEN = {
  tre_em: [`${PREFIX}-s1`, "giam_toc"],
  do_xe: [`${PREFIX}-s2`, "di_tiep"],
  cam: [`${PREFIX}-s3`, "khong_vao"],
} as const;
const [S1, S2, S3] = [BIEN.tre_em[0], BIEN.do_xe[0], BIEN.cam[0]];

const DOAN_MAN1: PayloadDoanDuong = {
  muc: 1,
  so_o: 8,
  dac_diem: [{ o: 5, loai: "truong_hoc" }],
  vi_tri: [{ id: "v1", o: 3, ben: "phai", toi_da: 1 }],
  khay: [S1, S2, S3],
};
const DAP_AN_MAN1: DapAnDoanDuong = {
  vi_tri: { v1: { dung: [S1], chap_nhan: [], ly_do: "Trường học phía trước." } },
};

async function taoDoan(ten: string, duyet: boolean): Promise<string> {
  const nd = await taoNoiDungTroChoi(
    {
      game_code: MA,
      topic_id: null,
      level: "de",
      title: `${PREFIX} ${ten}`,
      payload: DOAN_MAN1 as unknown as Record<string, unknown>,
      answer: DAP_AN_MAN1 as unknown as Record<string, unknown>,
      explanation: null,
      citations: [],
      refs: DOAN_MAN1.khay.map((ma) => ({ loai: "traffic_sign" as const, ma })),
      offline_ok: true,
      status: "cho_duyet",
    },
    "test",
  );
  if (duyet) {
    const kq = await chuyenTrangThaiNoiDung({
      id: nd.id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "test",
    });
    expect(kq?.ok).toBe(true);
  }
  return nd.id;
}

async function buocCuaLuot(
  id: string,
): Promise<Array<{ ref_id: string; noi_dung: BuocCamBien; diem_toi_da: number }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}

const nhatKy = (ops: Array<[number, string, string?, string?]>, tong: number) => ({
  thao_tac: ops.map(([nhip, t, vi_tri, ma]) => ({
    nhip,
    thao_tac: t,
    tham_so: t === "chay_thu" ? null : { vi_tri, ma },
  })),
  tong_nhip: tong,
});

let A: { id: string; token: string };
let B: { id: string; token: string };
let idChoDuyet = "";
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  for (const [ma, phanUng] of Object.values(BIEN)) {
    await sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction, version)
      VALUES (${ma}, 'nguy_hiem', ${`Biển thử ${ma}`}, 'Ý nghĩa thử.', ${`/bien-bao/anh/${ma}.svg`}, ${URN}, 'da_duyet', ${phanUng}, 1)`;
  }
  await taoDoan("doan-1", true);
  await taoDoan("doan-2", true);
  idChoDuyet = await taoDoan("cho-duyet", false);
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  expect(g).toBeTruthy();
  enabledCu = Boolean(g.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

describe("Cắm biển: lượt online", () => {
  let idLuot = "";

  test("trò có 5 màn, người mới chỉ mở màn 1", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
  });

  test("bắt đầu: một đoạn đường, đề không lộ biển đúng, không dùng đoạn chờ duyệt", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.man.so).toBe(1);
    expect(r.body.so_buoc).toBe(1);
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.khay.map((k: any) => k.ma)).toEqual([S1, S2, S3]);
    expect(de.khay.map((k: any) => k.phan_ung)).toEqual(["giam_toc", "di_tiep", "khong_vao"]);
    expect(de.so_lan_chay).toBe(3);
    const items = await buocCuaLuot(idLuot);
    expect(items.some((b) => b.ref_id === idChoDuyet)).toBe(false);
  });

  test("người khác không đọc được lượt; nhật ký sai dạng hoặc quá dài nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    const dai = nhatKy(
      Array.from({ length: 2001 }, () => [0, "chay_thu"] as [number, string]),
      1,
    );
    expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: dai })).status).toBe(
      400,
    );
    const sai = nhatKy([[0, "xoa_het"]], 1);
    expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: sai })).status).toBe(
      400,
    );
  });

  test("chấm lại từ nhật ký: điểm máy khách gửi bị bỏ qua; kết quả có biển đúng, lý do, căn cứ", async () => {
    // Cố tình cắm biển sai rồi chạy thử, kèm điểm giả.
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: {
        ...nhatKy(
          [
            [0, "dat", "v1", S2],
            [1, "chay_thu"],
          ],
          1,
        ),
        diem: 10,
        dung: true,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.diem).toBe(0);
    expect(r.body.ket_qua.dung).toBe(false);
    const ct = r.body.ket_qua.chi_tiet;
    expect(ct.hop_le).toBe(true);
    expect(ct.vi_tri[0].dung).toEqual([S1]);
    expect(ct.vi_tri[0].ly_do).toBe("Trường học phía trước.");
    expect(ct.vi_tri[0].dat).toEqual([{ ma: S2, ket: "sai", diem: -5 }]);
    expect(ct.tinh_huong.map((t: any) => t.loai)).toContain("phanh_gap");
    expect(r.body.ket_qua.can_cu).toEqual([URN]);
    // Gửi lại bước đã chấm: 409.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: nhatKy([], 1) })).status,
    ).toBe(409);
  });

  test("lượt đúng: đủ điểm, không tình huống nguy hiểm, XP một lần, qua màn 1", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, { man: 1 });
    const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, A.token, {
      tra_loi: nhatKy(
        [
          [0, "dat", "v1", S3],
          [0, "go", "v1", S3],
          [0, "dat", "v1", S1],
          [1, "chay_thu"],
        ],
        1,
      ),
    });
    expect(tl.body.ket_qua.diem).toBe(10);
    expect(tl.body.ket_qua.chi_tiet.tinh_huong).toEqual([]);
    const kt = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(3);
    await goi("POST", `/v1/luot-choi/luot/${r.body.id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`} AND source_id = ${r.body.id}`) as any[];
    expect(xp).toHaveLength(1);
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(
      ds.body.tro_choi
        .find((x: any) => x.ma === MA)
        .man.filter((m: any) => m.da_mo)
        .map((m: any) => m.so),
    ).toEqual([1, 2]);
  });

  test("gian lận thời gian: nhật ký 100 giây gửi ngay sau khi mở đề thì 0 điểm", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, B.token, {
      tra_loi: nhatKy(
        [
          [0, "dat", "v1", S1],
          [1, "chay_thu"],
        ],
        2000,
      ),
    });
    expect(tl.status).toBe(200);
    expect(tl.body.ket_qua.diem).toBe(0);
    expect(tl.body.ket_qua.chi_tiet.hop_le).toBe(false);
    expect(tl.body.ket_qua.chi_tiet.ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("chạy lại một lượt ở máy chủ dưới 200 ms", async () => {
    const [b] = await buocCuaLuot(idLuot);
    const tl = TRO_CHOI_CAM_BIEN.docTraLoi(
      nhatKy(
        [
          [0, "dat", "v1", S1],
          [1, "chay_thu"],
          [2, "chay_thu"],
          [3, "chay_thu"],
        ],
        4,
      ),
    )!;
    const t = performance.now();
    TRO_CHOI_CAM_BIEN.chamBuoc(b as any, tl, { thoiGianMs: 60_000, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("Cắm biển: biển trong khay", () => {
  test("sửa một biển trong khay thì đoạn đường rút khỏi trò; trả lại phiên bản cũ thì chơi được", async () => {
    await sql`UPDATE traffic_signs SET version = version + 1 WHERE code = ${S2}`;
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    await sql`UPDATE traffic_signs SET version = version - 1 WHERE code = ${S2}`;
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {})).status).toBe(201);
  });

  test("biển trong khay thôi duyệt thì đoạn đường không vào lượt", async () => {
    await sql`UPDATE traffic_signs SET status = 'nhap' WHERE code = ${S3}`;
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {})).status).toBe(400);
    await sql`UPDATE traffic_signs SET status = 'da_duyet' WHERE code = ${S3}`;
  });
});

describe("Cắm biển: offline", () => {
  test("gói offline có đoạn đường; đồng bộ lượt được máy chủ chấm lại, gửi lại không sinh lượt mới", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-cb",
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          // Offline: máy chủ không so đồng hồ, nhật ký dài vẫn được chấm.
          tra_loi: {
            ...nhatKy(
              [
                [0, "dat", "v1", S1],
                [1, "chay_thu"],
              ],
              3000,
            ),
            diem: 99,
          },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].so_buoc_moi).toBe(1);
    const [s] = (await sql`
      SELECT points, correct FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    expect(Number(s.points)).toBe(10);
    const lai = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(lai.body.ket_qua[0].id).toBe(r.body.ket_qua[0].id);
    expect(lai.body.ket_qua[0].so_buoc_moi).toBe(0);
  });
});
