/**
 * Kiểm thử API trò "Tự lái qua phố" (docs/PLAN.md GĐ-T9) trên Postgres test thật: đề không lộ bảng lỗi,
 * máy chủ chạy lại nhật ký lái và bỏ qua điểm máy khách gửi, biên bản lấy mức phạt đã duyệt, gian lận
 * thời gian được 0 điểm, bảng lỗi rút khỏi trò khi mức phạt bị sửa, đồng bộ offline.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { type PayloadAnhXaLoi, type PayloadBanDo, TRO_CHOI_TU_LAI } from "@qdpl/dao-tao";
import { chuyenTrangThaiNoiDung, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-tl";
const MA = "tu_lai";
const MA_PHAT = `${PREFIX}-den-do`;
const URN = "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-3";

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
  "noi_dung",
  "anh_xa",
  "muc_phat",
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

/** Phố ngang cắt phố dọc ở cột 4, có đèn; hướng Đông–Tây đỏ 4 giây đầu. Xe xuất phát cách vạch 5 m. */
const BAN_DO: PayloadBanDo = {
  kieu: "ban_do",
  man: 1,
  o: ["....|.......", "....|.......", "----+-------", "....|.......", "....|.......", "....|......."],
  xuat_phat: { o: [2, 3], huong: "dong" },
  dich: { o: [2, 8] },
  gio_giay: null,
  den: [{ o: [2, 4], xanh: 3, vang: 1, do_chung: 0, truc_dau: "doc" }],
  bien: [],
  vach_di_bo: [],
  nguoi_di_bo: [],
  xe_khac: [],
};

const ANH_XA: PayloadAnhXaLoi = {
  kieu: "anh_xa_loi",
  loi: {
    vuot_den_do: {
      ten: "Không chấp hành hiệu lệnh của đèn tín hiệu (dòng thử)",
      giai_thich: "Giải thích thử.",
      can_cu: null,
      muc_phat: { o_to: MA_PHAT, xe_may: null },
    },
  },
};

async function taoNoiDung(
  ten: string,
  payload: object,
  refs: Array<{ loai: "violation"; ma: string }>,
  duyet: boolean,
) {
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
      refs,
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

const nhatKy = (ops: Array<[number, string, unknown]>, tong: number) => ({
  thao_tac: [
    { nhip: 0, thao_tac: "bat_dau", tham_so: { xe: "o_to", giam: false } },
    ...ops.map(([nhip, thao_tac, tham_so]) => ({ nhip, thao_tac, tham_so })),
  ],
  tong_nhip: tong,
});
/** Giữ ga từ đầu: đầu xe qua vạch dừng quá 0,5 m (đèn đỏ) ở nhịp 43. */
const VUOT_DO = nhatKy([[0, "ga", true]], 45);

let A: { id: string; token: string };
let B: { id: string; token: string };
let enabledCu = false;
let idAnhXa = "";

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  await sql`
    INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
    VALUES (${MA_PHAT}, 'o_to', 'Không chấp hành hiệu lệnh của đèn tín hiệu (dòng thử)', 18000000, 20000000, ${URN},
            '2025-01-01', 'da_duyet')`;
  await taoNoiDung("kp-1", BAN_DO, [], true);
  await taoNoiDung("kp-cho-duyet", { ...BAN_DO, dich: { o: [2, 9] } }, [], false);
  idAnhXa = await taoNoiDung("bang-loi", ANH_XA, [{ loai: "violation", ma: MA_PHAT }], true);
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  expect(g).toBeTruthy();
  enabledCu = Boolean(g.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

describe("Tự lái: lượt online", () => {
  let idLuot = "";

  test("trò có 3 màn, người mới chỉ mở màn 1", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(3);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
  });

  test("bắt đầu: một khu phố đã duyệt; đề có bản đồ, không có bảng lỗi, mức phạt, căn cứ", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.so_buoc).toBe(1);
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.ban_do.dich.o).toEqual([2, 8]);
    expect(de.xe).toEqual(["o_to", "xe_may"]);
  });

  test("người khác không đọc được lượt; nhật ký sai dạng hoặc quá dài nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    const dai = nhatKy(
      Array.from({ length: 2001 }, (_, i) => [i, "ga", true] as [number, string, unknown]),
      2001,
    );
    expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: dai })).status).toBe(
      400,
    );
    const sai = nhatKy([[1, "bay", true]], 5);
    expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: sai })).status).toBe(
      400,
    );
  });

  test("máy chủ chạy lại nhật ký, bỏ qua điểm máy khách; biên bản có mức phạt đã duyệt và căn cứ", async () => {
    await Bun.sleep(700);
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: { ...VUOT_DO, diem: 100, loi: [] },
    });
    expect(r.status).toBe(200);
    const ct = r.body.ket_qua.chi_tiet;
    expect(ct.hop_le).toBe(true);
    expect(ct.den_dich).toBe(false);
    // Không tới đích: tối đa 50; vượt đèn đỏ trừ 20 (vẫn trên 50).
    expect(r.body.ket_qua.diem).toBe(50);
    expect(ct.loi.map((l: any) => l.loai)).toEqual(["vuot_den_do"]);
    expect(ct.loi[0].bien_ban.muc_phat.ma).toBe(MA_PHAT);
    expect(ct.loi[0].bien_ban.hanh_vi).toBe("Không chấp hành hiệu lệnh của đèn tín hiệu (dòng thử)");
    expect(ct.loi[0].nhip).toBe(43);
    expect(r.body.ket_qua.can_cu).toEqual([URN]);
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: VUOT_DO })).status,
    ).toBe(409);
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(1);
  });

  test("gian lận thời gian: nhật ký 100 giây gửi ngay sau khi mở đề thì 0 điểm", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, B.token, {
      tra_loi: nhatKy([[0, "ga", true]], 2000),
    });
    expect(tl.status).toBe(200);
    expect(tl.body.ket_qua.diem).toBe(0);
    expect(tl.body.ket_qua.chi_tiet.hop_le).toBe(false);
    expect(tl.body.ket_qua.chi_tiet.ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("chạy lại một lượt 5 phút ở máy chủ dưới 200 ms", async () => {
    const [run] = (await sql`SELECT items FROM game_runs WHERE id = ${idLuot}`) as any[];
    const b = run.items[0];
    const tl = TRO_CHOI_TU_LAI.docTraLoi({
      thao_tac: [{ nhip: 0, thao_tac: "bat_dau", tham_so: { xe: "o_to", giam: true } }],
      tong_nhip: 6000,
    })!;
    TRO_CHOI_TU_LAI.chamBuoc(b, tl, { thoiGianMs: null, offline: false });
    const t = performance.now();
    TRO_CHOI_TU_LAI.chamBuoc(b, tl, { thoiGianMs: null, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe("Tự lái: bảng lỗi → mức phạt", () => {
  test("bảng lỗi trỏ tới mức phạt chưa duyệt thì không duyệt được", async () => {
    await sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${`${PREFIX}-nhap`}, 'o_to', 'Dòng nháp', 1, 2, ${URN}, '2025-01-01', 'nhap')`;
    const id = await taoNoiDung(
      "bang-loi-nhap",
      ANH_XA,
      [{ loai: "violation", ma: `${PREFIX}-nhap` }],
      false,
    );
    const kq = await chuyenTrangThaiNoiDung({
      id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "test",
    });
    expect(kq?.ok).toBe(false);
  });

  test("sửa dòng mức phạt thì bảng lỗi rút khỏi trò: vẫn chơi được, biên bản ghi chưa có mức phạt", async () => {
    await sql`UPDATE violations SET version = version + 1 WHERE code = ${MA_PHAT}`;
    try {
      const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
      expect(r.status).toBe(201);
      await Bun.sleep(700);
      const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, B.token, { tra_loi: VUOT_DO });
      const l = tl.body.ket_qua.chi_tiet.loi[0];
      expect(l.loai).toBe("vuot_den_do");
      expect(l.bien_ban.muc_phat).toBeNull();
      expect(tl.body.ket_qua.can_cu).toEqual([]);
      const [nd] = (await sql`SELECT needs_review_reason FROM game_content WHERE id = ${idAnhXa}`) as any[];
      expect(nd.needs_review_reason).toBeTruthy();
    } finally {
      await sql`UPDATE violations SET version = version - 1 WHERE code = ${MA_PHAT}`;
    }
  });
});

describe("Tự lái: offline", () => {
  test("gói offline có khu phố; đồng bộ được máy chủ chạy lại, gửi lại không sinh lượt mới", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    // Chờ đèn xanh (từ nhịp 80) rồi đi tới đích: không lỗi.
    const tlOffline = { ...nhatKy([[80, "ga", true]], 400), diem: 7 };
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-tl",
      bat_dau: new Date().toISOString(),
      ket_thuc: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      buoc: [
        { client_id: crypto.randomUUID(), thu_tu: 1, tra_loi: tlOffline, luc: new Date().toISOString() },
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
