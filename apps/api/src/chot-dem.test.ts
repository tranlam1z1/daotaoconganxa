/**
 * Kiểm thử API trò "Dựng chốt an toàn ban đêm" (docs/PLAN.md GĐ-T15) trên Postgres test thật: đề không có
 * ngưỡng tiêu chí, máy chủ chạy lại nhật ký và chấm bố trí lúc nộp, điểm máy khách gửi bị bỏ qua, cùng bố
 * trí cùng băm trạng thái cuối ở máy khách và máy chủ, chạy thử lần thứ 3 / đặt vật ngoài phần đường / mốc
 * thời gian sai được 0 điểm, nhật ký sai dạng bị từ chối, bộ tiêu chí thôi duyệt thì đoạn rút khỏi trò,
 * đồng bộ offline, chạy lại dưới 200 ms.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import {
  type BoTriChot,
  type BuocChotDem,
  chayChot,
  type PayloadDoanChot,
  type PayloadTieuChiChot,
  TRO_CHOI_CHOT_DEM,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { bamTrangThai } from "../../../packages/dao-tao/src/tro-choi/chung/nhat-ky.ts";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-cd";
const MA = "chot_dem";
const MA_TC = `${PREFIX}-tc`;

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

/** Khóa không được có trong đề: đáp án, ngưỡng, bộ tiêu chí. */
const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "explanation",
  "noi_dung",
  "nguong",
  "tieu_chi",
  "ma_tieu_chi",
  "bien_dau_m_tu",
  "hang_cho_m",
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
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const TIEU_CHI: PayloadTieuChiChot = {
  kieu: "tieu_chi_chot",
  ma: MA_TC,
  ten: "Bộ tiêu chí thử",
  nguong: {
    bien_dau_m_tu: 60,
    bien_dau_m_den: 150,
    coc_toi_thieu: 5,
    coc_khoang_m: 6,
    tru_moi_doan_ho: 5,
    tru_moi_xe_phanh_gap: 5,
    hang_cho_m: 20,
    tam_nhin_bien_m: 40,
    tru_moi_bien_khuat: 5,
  },
  nguon: (["bien_dau", "coc", "chien_si", "phanh_gap", "hang_cho", "bien_khuat"] as const).map((t) => ({
    tieu_chi: t,
    urn: null,
    ghi_chu: "Số thử.",
  })),
};

const DOAN: PayloadDoanChot = {
  kieu: "doan_duong",
  muc: 1,
  hinh: "thang",
  dai_m: 200,
  rong_le_cm: 300,
  chot_m: 160,
  lan_dong: "lan_2",
  khuat: [],
  giao_lo: null,
  tui: { bien: 2, coc: 6, den: 1, xe: 0, cs: 2 },
  luong_xe: {
    seed: "api",
    so_xe: 10,
    nhip_giua: 110,
    ty_le: { o_to: 100, xe_may: 0, xe_tai: 0, xe_khach: 0 },
    qua_toc_do: 0,
    tu_giao_lo: 0,
  },
  ma_tieu_chi: MA_TC,
};

/** Bố trí tốt: đủ 100 điểm (xem packages/dao-tao/tests/chot-dem.test.ts). */
const TOT: BoTriChot = {
  "bien-1": { m: 60, cot: "le_phai", huong: 0 },
  "bien-2": { m: 110, cot: "le_phai", huong: 0 },
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `coc-${i + 1}`,
      { m: 130 + 5 * i, cot: "lan_2" as const, huong: 0 as const },
    ]),
  ),
  "den-1": { m: 128, cot: "le_phai", huong: 0 },
  "cs-1": { m: 162, cot: "lan_2", huong: 0 },
  "cs-2": { m: 166, cot: "lan_2", huong: 0 },
};

function nhatKy(bt: BoTriChot, soLan = 1, tong?: number) {
  const thao_tac: unknown[] = [];
  let nhip = 0;
  for (const [vat, p] of Object.entries(bt))
    thao_tac.push({ nhip: nhip++, thao_tac: "dat", tham_so: { vat, m: p.m, cot: p.cot } });
  for (let i = 0; i < soLan; i++) thao_tac.push({ nhip: nhip++, thao_tac: "chay_thu", tham_so: null });
  return { thao_tac, tong_nhip: tong ?? nhip };
}

async function taoNoiDung(ten: string, payload: object, duyet: boolean): Promise<string> {
  const nd = await taoNoiDungTroChoi(
    {
      game_code: MA,
      topic_id: null,
      level: "de",
      title: `${PREFIX} ${ten}`,
      payload: payload as Record<string, unknown>,
      answer: {},
      explanation: null,
      citations: [],
      refs: [],
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

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocChotDem }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let idTieuChi = "";
let idChoDuyet = "";
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  idTieuChi = await taoNoiDung("tieu-chi", TIEU_CHI, true);
  await taoNoiDung("doan-1", DOAN, true);
  idChoDuyet = await taoNoiDung("cho-duyet", { ...DOAN, luong_xe: { ...DOAN.luong_xe, seed: "cho" } }, false);
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

describe("Chốt đêm: lượt online", () => {
  test("trò có 5 màn; đề có túi đồ, dòng xe, không có ngưỡng; không dùng đoạn chờ duyệt", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(ds.body.tro_choi.find((x: any) => x.ma === MA).man).toHaveLength(5);
    const r = await batDau(A.token);
    expect(coKhoaCam(r)).toBeNull();
    const de = r.buoc_hien_tai.de;
    expect(de.tui).toHaveLength(11);
    expect(de.so_lan_chay).toBe(2);
    expect(de.luong_xe.seed).toBe("api");
    const items = await buocCuaLuot(r.id);
    expect(items.some((b) => b.ref_id === idChoDuyet)).toBe(false);
  });

  test("người khác không đọc được lượt; nhật ký sai dạng, quá dài nhận 400", async () => {
    const r = await batDau(A.token);
    expect((await goi("GET", `/v1/luot-choi/luot/${r.id}`, B.token)).status).toBe(403);
    const dai = {
      thao_tac: Array.from({ length: 2001 }, () => ({ nhip: 0, thao_tac: "chay_thu", tham_so: null })),
      tong_nhip: 1,
    };
    expect((await tra(r.id, A.token, dai)).status).toBe(400);
    const m = {
      thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { vat: "coc-1", m: 3.5, cot: "lan_2" } }],
      tong_nhip: 1,
    };
    expect((await tra(r.id, A.token, m)).status).toBe(400);
    const cot = {
      thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { vat: "coc-1", m: 3, cot: "via_he" } }],
      tong_nhip: 1,
    };
    expect((await tra(r.id, A.token, cot)).status).toBe(400);
  });

  test("chấm lại từ nhật ký: điểm máy khách bị bỏ qua; băm máy chủ khớp máy khách; XP một lần; mở màn 2", async () => {
    const r = await batDau(A.token);
    const [b] = await buocCuaLuot(r.id);
    // Máy khách chạy cùng bố trí bằng cùng mã.
    const may = chayChot(r.buoc_hien_tai.de, TOT);
    const bamMay = bamTrangThai({
      xe: may.trang_thai.xe,
      su_kien: may.trang_thai.su_kien,
      nhip: may.trang_thai.nhip,
    });
    const kq = await tra(r.id, A.token, { ...nhatKy(TOT), diem: 3, dung: false, bam: "gia" });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.diem).toBe(100);
    expect(kq.body.ket_qua.dung).toBe(true);
    const ct = kq.body.ket_qua.chi_tiet;
    expect(ct.bam).toBe(bamMay);
    expect(ct.tieu_chi).toHaveLength(6);
    expect(ct.tieu_chi[0].nguong).toContain("60");
    expect(b!.noi_dung.tieu_chi.ma).toBe(MA_TC);
    // Gửi lại bước đã chấm: 409.
    expect((await tra(r.id, A.token, nhatKy({}))).status).toBe(409);
    const kt = await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(3);
    await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`} AND source_id = ${r.id}`) as any[];
    expect(xp).toHaveLength(1);
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(
      ds.body.tro_choi
        .find((x: any) => x.ma === MA)
        .man.filter((m: any) => m.da_mo)
        .map((m: any) => m.so),
    ).toEqual([1, 2]);
  });

  test("chạy thử lần thứ 3: cả bước 0 điểm", async () => {
    const r = await batDau(B.token);
    const kq = await tra(r.id, B.token, nhatKy(TOT, 3));
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.diem).toBe(0);
    expect(kq.body.ket_qua.chi_tiet.ly_do).toContain("quá 2 lần");
  });

  test("đặt vật ngoài phần đường hợp lệ: cả bước 0 điểm", async () => {
    const r = await batDau(B.token);
    const kq = await tra(r.id, B.token, nhatKy({ ...TOT, "coc-1": { m: 201, cot: "lan_2", huong: 0 } }));
    expect(kq.body.ket_qua.diem).toBe(0);
    expect(kq.body.ket_qua.chi_tiet.hop_le).toBe(false);
    expect(kq.body.ket_qua.chi_tiet.ly_do).toContain("ngoài phần đường hợp lệ");
  });

  test("mốc thời gian sai: nhật ký 100 giây gửi ngay sau khi mở đề thì 0 điểm", async () => {
    const r = await batDau(B.token);
    const kq = await tra(r.id, B.token, nhatKy(TOT, 1, 2000));
    expect(kq.body.ket_qua.diem).toBe(0);
    expect(kq.body.ket_qua.chi_tiet.ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("chạy lại một bước ở máy chủ dưới 200 ms", async () => {
    const r = await batDau(B.token);
    const [b] = await buocCuaLuot(r.id);
    const tl = TRO_CHOI_CHOT_DEM.docTraLoi(nhatKy(TOT, 2))!;
    const t = performance.now();
    TRO_CHOI_CHOT_DEM.chamBuoc(b as any, tl, { thoiGianMs: 60_000, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("Chốt đêm: bộ tiêu chí", () => {
  test("bộ tiêu chí thôi duyệt thì đoạn đường rút khỏi trò; duyệt lại thì chơi được", async () => {
    await sql`UPDATE game_content SET status = 'cho_duyet' WHERE id = ${idTieuChi}`;
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, { man: 1 });
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    await sql`UPDATE game_content SET status = 'da_duyet' WHERE id = ${idTieuChi}`;
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, { man: 1 })).status).toBe(201);
  });
});

describe("Chốt đêm: offline", () => {
  test("gói offline có đoạn đường; đồng bộ lượt được máy chủ chấm lại, gửi lại không sinh lượt mới", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-cd",
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          // Offline: máy chủ không so đồng hồ, nhật ký dài vẫn được chấm.
          tra_loi: { ...nhatKy(TOT, 1, 3000), diem: 1 },
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
