/**
 * Kiểm thử API trò "Truy vết xe bỏ trốn" (docs/PLAN.md GĐ-T17) trên Postgres test thật: không phản hồi nào
 * trước khi chấm có lộ trình đầy đủ (quét khóa cấm), mở camera chưa được phép theo thời gian mô phỏng bị từ
 * chối, id xe khác nhau giữa hai đoạn cảnh, lượt của người khác nhận 403, máy chủ chỉ tin nhật ký của route
 * (thao tác mở camera máy khách gửi bị bỏ qua), vào lại lượt có sẵn đoạn cảnh đã mở, đồng bộ offline, chấm
 * lại dưới 200 ms.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import {
  type BuocTruyVet,
  dungVu,
  GIAY_CHAN_TRUOC,
  type PayloadVuTruyVet,
  TRO_CHOI_TRUY_VET,
  xeTrongDoan,
} from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-tv";
const MA = "truy_vet";

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

/** Khóa không được có trước khi chấm: đáp án chung và khóa của lộ trình. */
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
  "seed",
  "bi_mat",
  "xe_bo_chay",
  "vai",
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

const DU_LIEU = (await Bun.file(`${import.meta.dir}/../../../data/tro-choi/truy-vet.json`).json()) as {
  vu: Array<{ ma: string; payload: PayloadVuTruyVet }>;
};

async function taoVu(ma: string, duyet: boolean): Promise<string> {
  const p = DU_LIEU.vu.find((v) => v.ma === ma)!.payload;
  const nd = await taoNoiDungTroChoi(
    {
      game_code: MA,
      topic_id: null,
      level: "de",
      title: `${PREFIX} ${ma}${duyet ? "" : " chờ duyệt"}`,
      payload: p as unknown as Record<string, unknown>,
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

async function buocCuaLuot(
  id: string,
): Promise<{ ref_id: string; diem_toi_da: number; noi_dung: BuocTruyVet }> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items[0];
}

let A: { id: string; token: string };
let B: { id: string; token: string };
let idChoDuyet = "";
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  await taoVu("tv-01", true);
  await taoVu("tv-02", true);
  idChoDuyet = await taoVu("tv-03", false);
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  expect(g).toBeTruthy();
  enabledCu = Boolean(g.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

const batDau = async (token: string, man = 1) => {
  const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, token, { man });
  expect(r.status).toBe(201);
  return r.body;
};
const moCamera = (id: string, token: string, body: unknown) =>
  goi("POST", `/v1/truy-vet/luot/${id}/camera`, token, body);
const tra = (id: string, token: string, tra_loi: unknown) =>
  goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, token, { tra_loi });

/** Chơi đúng qua route: mở từng camera trên lộ trình (chờ khi cần), khóa xe bỏ chạy ở yêu cầu kế tiếp. */
async function choiDungOnline(id: string, token: string) {
  const b = await buocCuaLuot(id);
  const v = dungVu(b.noi_dung.vu, b.noi_dung.bi_mat);
  let khoa: { doan: number; xe: string } | null = null;
  const phanHoi: any[] = [];
  for (const c of b.noi_dung.lo_trinh.camera) {
    const r = await moCamera(id, token, { camera: c.id, cho: true, khoa });
    expect(r.status).toBe(200);
    phanHoi.push(r.body);
    const d = r.body.trang_thai.doan.at(-1);
    const xe = xeTrongDoan(v, d, b.noi_dung.lo_trinh).find((x) => x.vai === "bo_chay")!;
    khoa = { doan: d.so, xe: xe.id };
  }
  const T = phanHoi.at(-1).trang_thai.dong_ho;
  const lt = b.noi_dung.lo_trinh;
  const chan = lt.o[lt.t.findIndex((t) => t >= T + GIAY_CHAN_TRUOC)]!;
  return { b, khoa: khoa!, chan, phanHoi };
}

describe("Truy vết: lượt online", () => {
  test("trò có 5 màn; đề không có lộ trình, seed, xe cần tìm; không dùng vụ chờ duyệt", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(ds.body.tro_choi.find((x: any) => x.ma === MA).man).toHaveLength(5);
    const r = await batDau(A.token);
    expect(coKhoaCam(r)).toBeNull();
    const de = r.buoc_hien_tai.de;
    expect(de.camera.length).toBeGreaterThan(3);
    expect(de.da_mo).toEqual([]);
    expect(de.tin_bao.mo_ta.ky_tu.length).toBeGreaterThanOrEqual(2);
    const b = await buocCuaLuot(r.id);
    expect(JSON.stringify(r)).not.toContain(b.noi_dung.vu.xe_bo_chay.bien_so);
    expect(b.ref_id).not.toBe(idChoDuyet);
  });

  test("mở camera chưa được phép theo thời gian mô phỏng bị từ chối (409, kèm số giây phải chờ)", async () => {
    const r = await batDau(A.token);
    const b = await buocCuaLuot(r.id);
    const cuoi = b.noi_dung.lo_trinh.camera.at(-1)!;
    const kq = await moCamera(r.id, A.token, { camera: cuoi.id });
    expect(kq.status).toBe(409);
    expect(kq.body.error.details.ma).toBe("chua_toi_gio");
    expect(kq.body.error.details.cho_giay).toBeGreaterThan(0);
    // Bị từ chối thì không ghi gì vào ảnh chụp bước, không mất lượt xem.
    expect((await buocCuaLuot(r.id)).noi_dung.nhat_ky).toEqual([]);
    expect((await moCamera(r.id, A.token, { camera: "khong-co" })).status).toBe(400);
  });

  test("người khác không mở được camera, không đọc được lượt; mã lượt sai nhận 404", async () => {
    const r = await batDau(A.token);
    const c = (await buocCuaLuot(r.id)).noi_dung.lo_trinh.camera[0]!.id;
    expect((await moCamera(r.id, B.token, { camera: c, cho: true })).status).toBe(403);
    expect((await goi("GET", `/v1/luot-choi/luot/${r.id}`, B.token)).status).toBe(403);
    expect((await moCamera("khong-phai-uuid", A.token, { camera: c })).status).toBe(404);
    expect((await moCamera(crypto.randomUUID(), A.token, { camera: c })).status).toBe(404);
    expect((await goi("POST", `/v1/truy-vet/luot/${r.id}/camera`, undefined, { camera: c })).status).toBe(
      401,
    );
  });

  test("chơi đúng: phản hồi mở camera không có khóa cấm; id xe khác nhau giữa hai đoạn; đủ điểm; XP một lần", async () => {
    const r = await batDau(A.token);
    const { b, khoa, chan, phanHoi } = await choiDungOnline(r.id, A.token);
    for (const p of phanHoi) expect(coKhoaCam(p)).toBeNull();
    const ids: Array<Set<string>> = phanHoi.map((p) => new Set<string>(p.doan.xe.map((x: any) => x.id)));
    for (let i = 1; i < ids.length; i++) expect([...ids[i]!].filter((x) => ids[i - 1]!.has(x))).toEqual([]);
    // Vào lại lượt: đề có sẵn các đoạn đã mở, vẫn không có khóa cấm.
    const lai = await goi("GET", `/v1/luot-choi/luot/${r.id}`, A.token);
    expect(lai.body.buoc_hien_tai.de.da_mo).toHaveLength(b.noi_dung.lo_trinh.camera.length);
    expect(coKhoaCam(lai.body)).toBeNull();
    // Máy khách gửi kèm điểm, cờ đúng và thao tác mở camera giả: bị bỏ qua.
    const kq = await tra(r.id, A.token, {
      thao_tac: [
        { nhip: 0, thao_tac: "mo", tham_so: { camera: b.noi_dung.vu.camera[0]!.id, cho: true } },
        { nhip: 1, thao_tac: "khoa", tham_so: khoa },
        { nhip: 2, thao_tac: "chan", tham_so: chan },
      ],
      tong_nhip: 3,
      diem: 999,
      dung: false,
    });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.diem).toBe(b.diem_toi_da);
    expect(kq.body.ket_qua.dung).toBe(true);
    expect(kq.body.ket_qua.chi_tiet.lo_trinh.length).toBeGreaterThan(3);
    // Bước đã chấm: route không mở thêm camera; gửi lại nhận 409.
    expect((await moCamera(r.id, A.token, { camera: b.noi_dung.vu.camera[0]!.id, cho: true })).status).toBe(
      409,
    );
    expect(
      (await tra(r.id, A.token, { thao_tac: [{ nhip: 0, thao_tac: "chan", tham_so: chan }], tong_nhip: 1 }))
        .status,
    ).toBe(409);
    await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    await goi("POST", `/v1/luot-choi/luot/${r.id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`} AND source_id = ${r.id}`) as any[];
    expect(xp).toHaveLength(1);
  });

  test("máy khách tự gửi nhật ký mở camera (không qua route): không được điểm khóa nào", async () => {
    const r = await batDau(B.token);
    const b = await buocCuaLuot(r.id);
    const lt = b.noi_dung.lo_trinh;
    const ops = lt.camera.map((c, i) => ({ nhip: i, thao_tac: "mo", tham_so: { camera: c.id, cho: true } }));
    const kq = await tra(r.id, B.token, {
      thao_tac: [...ops, { nhip: ops.length, thao_tac: "chan", tham_so: lt.o.at(-1) }],
      tong_nhip: ops.length + 1,
    });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.chi_tiet.doan).toEqual([]);
    expect(kq.body.ket_qua.chi_tiet.diem_khoa).toBe(0);
    expect(kq.body.ket_qua.diem).toBeLessThan(b.diem_toi_da);
  });

  test("nhật ký sai dạng nhận 400; chấm lại một bước ở máy chủ dưới 200 ms", async () => {
    const r = await batDau(B.token);
    expect((await tra(r.id, B.token, { thao_tac: [], tong_nhip: 0 })).status).toBe(400);
    const { b, chan } = await choiDungOnline(r.id, B.token);
    const [row] = (await sql`SELECT items FROM game_runs WHERE id = ${r.id}`) as any[];
    const tl = TRO_CHOI_TRUY_VET.docTraLoi({
      thao_tac: [{ nhip: 0, thao_tac: "chan", tham_so: chan }],
      tong_nhip: 1,
    })!;
    const t = performance.now();
    TRO_CHOI_TRUY_VET.chamBuoc(row.items[0], tl, { thoiGianMs: 60_000, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
    expect(b.noi_dung.nhat_ky).toEqual([]);
  });
});

describe("Truy vết: offline", () => {
  test("gói offline mang vụ (câu D24); đồng bộ lượt được chấm lại từ nhật ký; gửi lại không sinh lượt mới", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const seed = "offline-seed-tv";
    const items = TRO_CHOI_TRUY_VET.taoLuot(goi1.body.nguon, (await import("@qdpl/dao-tao")).taoRng(seed), 1);
    const nd = items[0]!.noi_dung;
    const v = dungVu(nd.vu, nd.bi_mat);
    // Điện thoại tự chạy: mở, khóa, chặn bằng cùng hàm.
    const { apThaoTacTV, trangThaiDauTV } = await import("@qdpl/dao-tao");
    let tt = trangThaiDauTV(nd.vu);
    const ops: any[] = [];
    const ap = (op: any) => {
      const k = apThaoTacTV(v, tt, op, nd.lo_trinh);
      if ("loi" in k) throw new Error(k.loi.thong_bao);
      tt = k.tt;
      ops.push({ ...op, nhip: ops.length });
    };
    for (const c of nd.lo_trinh.camera) {
      ap({ thao_tac: "mo", tham_so: { camera: c.id, cho: true } });
      const d = tt.doan.at(-1)!;
      ap({
        thao_tac: "khoa",
        tham_so: { doan: d.so, xe: xeTrongDoan(v, d, nd.lo_trinh).find((x) => x.vai === "bo_chay")!.id },
      });
    }
    ap({
      thao_tac: "chan",
      tham_so: nd.lo_trinh.o[nd.lo_trinh.t.findIndex((t) => t >= tt.dong_ho + GIAY_CHAN_TRUOC)],
    });
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed,
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { thao_tac: ops, tong_nhip: ops.length, diem: 1 },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].so_buoc_moi).toBe(1);
    const [s] = (await sql`
      SELECT points, max_points FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    expect(Number(s.points)).toBe(Number(s.max_points));
    // Lượt offline: route mở camera không nhận.
    const mo = await moCamera(r.body.ket_qua[0].id, B.token, {
      camera: nd.lo_trinh.camera[0]!.id,
      cho: true,
    });
    expect(mo.status).toBe(409);
    const lai = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(lai.body.ket_qua[0].id).toBe(r.body.ket_qua[0].id);
    expect(lai.body.ket_qua[0].so_buoc_moi).toBe(0);
  });
});
