/**
 * Mùa giải đơn vị qua API (docs/PLAN.md GĐ-G6, mục "Kiểm tra đã xong"). Postgres test thật; dữ liệu
 * mang tiền tố riêng và một cấp đơn vị riêng ("Đội G6 test") để không lẫn đơn vị của test khác.
 *
 * XP gieo thẳng vào xp_ledger với `created_at` tự đặt, để thử mốc chốt 06:00 thứ Hai. Mùa 3 tuần
 * bắt đầu 03/8/2026; chốt bằng chayMuaGiai(now) với `now` cố định.
 *
 * Phép tính tay (cấu hình: 2 hạng, cỡ nhóm 3, lên 1, xuống 1, trần 700, tối thiểu 3 người):
 *  - Trước mùa (20/7): D1 400, D2 300, D3 200, D4 100, D5 50 → hạng 1 = D1, D2, D3; hạng 2 = D4, D5, D6.
 *  - Tuần 1: D1 = (2000→700 + 100 của người ở Tổ con) / 4 = 200, tham gia 50%; D2 = 600 / 3 = 200,
 *    tham gia 67% → D2 đứng trên D1. D3 = 300 / 4 = 75 → xuống. D5 = 150 / 3 = 50 (lượt đồng bộ
 *    05:59 được tính, lượt 06:01 thì không) → lên. D4 = 90 / 4 = 22,5 (3 cán bộ và 1 quản lý), hạng
 *    thấp nhất nên giữ. D6 có 2 người, không xếp hạng.
 *  - Tuần 2: d3a có 300 XP ở D3 rồi chuyển sang D4 và có thêm 90 XP → D3 tính 300 / 3 = 100, D4
 *    tính 90 / 5 = 18.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { chayMuaGiai, sql, taoDonVi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-g6";
const CAP = "Đội G6 test";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const res = await app.request(`http://test${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const dv: Record<string, string> = {};
const tk: Record<string, { id: string; token: string }> = {};
let muaId = "";
let soNguon = 0;

async function taoTk(ten: string, unitId: string | null, role = "can_bo") {
  const [r] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id)
    VALUES (${`${PREFIX}-${ten}`}, ${`Người ${ten}`}, ${role}, ${unitId}) RETURNING id`) as any[];
  tk[ten] = { id: r.id, token: (await createSession(r.id, "test")).token };
}

/** Một dòng XP: ngày chơi `ngay`, ghi lúc `ghi` (UTC), đơn vị = đơn vị hiện tại của người đó. */
async function xp(ten: string, so: number, ngay: string, ghi = `${ngay}T05:00:00Z`) {
  await sql`
    INSERT INTO xp_ledger (account_id, source_kind, source_id, xp, day, unit_id, created_at)
    VALUES (${tk[ten]!.id}, ${`${PREFIX}`}, ${`${PREFIX}-${++soNguon}`}, ${so}, ${ngay},
            (SELECT unit_id FROM accounts WHERE id = ${tk[ten]!.id}), ${ghi})`;
}

async function donDep() {
  await sql`DELETE FROM seasons WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM xp_ledger WHERE source_kind = ${PREFIX}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  for (const cap of [4, 3, 2, 1])
    await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) = ${cap}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`}`;
}

const bangTuan = async (tuan: string) =>
  (await sql`
    SELECT u.code, s.tier, s.group_no, s.members, s.active_members, s.xp_counted, s.score::float AS score,
           s.rank_in_group, s.outcome, s.closed_at
    FROM season_standings s JOIN units u ON u.id = s.unit_id
    WHERE s.season_id = ${muaId} AND s.week_start = ${tuan}
    ORDER BY u.code`) as any[];

const dong = (rows: any[], so: number) => rows.find((r) => r.code === `${PREFIX}-D${so}`);

beforeAll(async () => {
  await donDep();
  const a = `${PREFIX}-seed`;
  dv.P = (await taoDonVi({ code: `${PREFIX}-P`, name: "Phòng G6", levelLabel: "Phòng" }, a)).id;
  for (let i = 1; i <= 6; i++) {
    dv[`D${i}`] = (
      await taoDonVi({ code: `${PREFIX}-D${i}`, name: `Đội G6 số ${i}`, parentId: dv.P, levelLabel: CAP }, a)
    ).id;
  }
  dv.T1 = (
    await taoDonVi({ code: `${PREFIX}-T1`, name: "Tổ con của D1", parentId: dv.D1, levelLabel: "Tổ" }, a)
  ).id;

  const thanhVien: Record<string, number> = { D1: 3, D2: 3, D3: 4, D4: 3, D5: 3, D6: 2 };
  for (const [d, n] of Object.entries(thanhVien)) {
    for (let k = 0; k < n; k++) await taoTk(`${d.toLowerCase()}${"abcd"[k]}`, dv[d]!);
  }
  await taoTk("t1a", dv.T1!);
  await taoTk("quantri", null, "quan_tri");
  await taoTk("quanly-p", dv.P!, "quan_ly");
  await taoTk("quanly-d4", dv.D4!, "quan_ly");

  // Trước mùa: xếp hạng ban đầu.
  for (const [ten, so] of [
    ["d1a", 400],
    ["d2a", 300],
    ["d3a", 200],
    ["d4a", 100],
    ["d5a", 50],
  ] as const)
    await xp(ten, so, "2026-07-20");

  // Tuần 1 (03/8 – 09/8).
  await xp("d1a", 2000, "2026-08-04");
  await xp("t1a", 100, "2026-08-05");
  await xp("d2a", 300, "2026-08-05");
  await xp("d2b", 300, "2026-08-06");
  for (const t of ["d3a", "d3b", "d3c"]) await xp(t, 100, "2026-08-06");
  await xp("d4a", 90, "2026-08-07");
  // Chơi Chủ nhật 09/8, đồng bộ 05:59 và 06:01 thứ Hai 10/8 (giờ Việt Nam).
  await xp("d5a", 150, "2026-08-09", "2026-08-09T22:59:00Z");
  await xp("d5b", 300, "2026-08-09", "2026-08-09T23:01:00Z");
  await xp("d6a", 700, "2026-08-05");
});

afterAll(async () => {
  await donDep();
});

describe("tạo mùa và phân quyền quản trị", () => {
  test("cán bộ không tạo được mùa; ngày bắt đầu không phải thứ Hai bị từ chối", async () => {
    const than = {
      code: `${PREFIX}-x`,
      name: "Mùa thử",
      starts_on: "2026-08-03",
      unit_level_label: CAP,
    };
    expect((await goi("POST", "/v1/quan-tri/mua-giai", tk.d1a!.token, than)).status).toBe(403);
    const sai = await goi("POST", "/v1/quan-tri/mua-giai", tk.quantri!.token, {
      ...than,
      starts_on: "2026-08-04",
    });
    expect(sai.status).toBe(400);
    const cfgSai = await goi("POST", "/v1/quan-tri/mua-giai", tk.quantri!.token, {
      ...than,
      config: { co_nhom: 2, so_len: 1, so_xuong: 1 },
    });
    expect(cfgSai.status).toBe(400);
  });

  test("tạo mùa 3 tuần; sửa cấu hình được khi chưa bắt đầu", async () => {
    const r = await goi("POST", "/v1/quan-tri/mua-giai", tk.quantri!.token, {
      code: `${PREFIX}-mua`,
      name: "Mùa thử G6",
      starts_on: "2026-08-03",
      unit_level_label: CAP,
      config: { so_tuan: 4, so_hang: 2, co_nhom: 3, so_len: 1, so_xuong: 1 },
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("sap_dien_ra");
    muaId = r.body.id;
    const s = await goi("PATCH", `/v1/quan-tri/mua-giai/${muaId}`, tk.quantri!.token, {
      config: { so_tuan: 3 },
    });
    expect(s.status).toBe(200);
    expect(s.body.ends_on).toBe("2026-08-23");
    expect(s.body.config).toMatchObject({
      so_tuan: 3,
      so_hang: 2,
      tran_xp_tuan: 700,
      toi_thieu_thanh_vien: 3,
    });
  });
});

describe("chốt tuần", () => {
  test("bắt đầu mùa: hạng ban đầu theo XP 4 tuần trước mùa", async () => {
    const kq = await chayMuaGiai(new Date("2026-08-03T01:00:00Z"));
    expect(kq.bat_dau).toContain(`${PREFIX}-mua`);
    expect(kq.tuan_da_chot).toHaveLength(0);
    const t1 = await bangTuan("2026-08-03");
    expect(t1.map((r) => [r.code.slice(-2), r.tier])).toEqual([
      ["D1", 1],
      ["D2", 1],
      ["D3", 1],
      ["D4", 2],
      ["D5", 2],
      ["D6", 2],
    ]);
    // Chưa qua 06:00 thứ Hai tuần sau thì chưa chốt.
    expect((await chayMuaGiai(new Date("2026-08-09T22:59:00Z"))).tuan_da_chot).toHaveLength(0);
  });

  test("tuần 1 khớp phép tính tay: trần XP, chia quân số, Tổ con, bằng điểm, mốc 06:00, dưới 3 người", async () => {
    const kq = await chayMuaGiai(new Date("2026-08-09T23:30:00Z"));
    expect(kq.tuan_da_chot).toEqual([{ mua: `${PREFIX}-mua`, tuan: "2026-08-03" }]);
    const t = await bangTuan("2026-08-03");
    expect(dong(t, 1)).toMatchObject({
      xp_counted: 800,
      active_members: 4,
      score: 200,
      rank_in_group: 2,
      outcome: "giu",
    });
    expect(dong(t, 2)).toMatchObject({
      xp_counted: 600,
      active_members: 3,
      score: 200,
      rank_in_group: 1,
      outcome: "giu",
    });
    expect(dong(t, 3)).toMatchObject({ score: 75, rank_in_group: 3, outcome: "xuong" });
    expect(dong(t, 5)).toMatchObject({
      xp_counted: 150,
      members: 1,
      score: 50,
      rank_in_group: 1,
      outcome: "len",
    });
    expect(dong(t, 4)).toMatchObject({ active_members: 4, score: 22.5, rank_in_group: 2, outcome: "giu" });
    expect(dong(t, 6)).toMatchObject({ rank_in_group: null, outcome: null, active_members: 2 });

    // Tuần 2 đã được phân hạng mới.
    const t2 = await bangTuan("2026-08-10");
    expect(t2.filter((r) => r.tier === 1).map((r) => r.code.slice(-2))).toEqual(["D1", "D2", "D5"]);
    expect(t2.every((r) => r.closed_at === null)).toBe(true);
  });

  test("lượt đồng bộ sau 06:00 không vào mùa giải nhưng vẫn là XP cá nhân", async () => {
    const [r] = (await sql`
      SELECT COALESCE(sum(xp), 0)::int AS n FROM xp_ledger WHERE account_id = ${tk.d5b!.id}`) as any[];
    expect(r.n).toBe(300);
  });

  test("huy hiệu lên hạng chỉ trao cho người có XP được tính trong tuần đơn vị lên hạng", async () => {
    const co = (await sql`
      SELECT a.username FROM account_badges b JOIN accounts a ON a.id = b.account_id
      WHERE b.badge_code = 'len_hang_mua_giai' AND a.username LIKE ${`${PREFIX}%`}`) as any[];
    expect(co.map((r) => r.username)).toEqual([`${PREFIX}-d5a`]);
  });

  test("người chuyển đơn vị giữa tuần: XP trước khi chuyển tính cho đơn vị cũ", async () => {
    await xp("d3a", 300, "2026-08-11");
    await sql`UPDATE accounts SET unit_id = ${dv.D4!} WHERE id = ${tk.d3a!.id}`;
    await xp("d3a", 90, "2026-08-13");
    await chayMuaGiai(new Date("2026-08-16T23:30:00Z"));
    const t = await bangTuan("2026-08-10");
    expect(dong(t, 3)).toMatchObject({ xp_counted: 300, active_members: 3, score: 100 });
    expect(dong(t, 4)).toMatchObject({ xp_counted: 90, active_members: 5, score: 18 });
  });

  test("chốt tuần chạy lại cho cùng kết quả, kể cả khi có XP đồng bộ muộn", async () => {
    const truoc = [await bangTuan("2026-08-03"), await bangTuan("2026-08-10")];
    await xp("d4b", 500, "2026-08-12", "2026-08-17T02:00:00Z"); // đồng bộ sau mốc chốt tuần 2
    const lai = await chayMuaGiai(new Date("2026-08-16T23:45:00Z"));
    expect(lai.tuan_da_chot).toHaveLength(0);
    expect([await bangTuan("2026-08-03"), await bangTuan("2026-08-10")]).toEqual(truoc);
  });
});

describe("GET /v1/mua-giai", () => {
  test("cần đăng nhập", async () => {
    expect((await goi("GET", "/v1/mua-giai")).status).toBe(401);
  });

  test("cán bộ chỉ thấy nhóm của đơn vị mình, kèm kết quả tuần trước", async () => {
    // Giờ thật đã qua mùa: lần gọi này chốt bù tuần 3 và kết thúc mùa.
    const r = await goi("GET", `/v1/mua-giai?mua=${muaId}`, tk.d1a!.token);
    expect(r.status).toBe(200);
    expect(r.body.mua.status).toBe("ket_thuc");
    expect(r.body.tuan.bat_dau).toBe("2026-08-17");
    expect(r.body.don_vi_cua_toi.unit_id).toBe(dv.D1);
    expect(r.body.cac_nhom).toBeUndefined();
    const ma = r.body.nhom_cua_toi.items.map((d: any) => d.unit_id);
    expect(ma).toContain(dv.D1);
    expect(ma).toHaveLength(3);
    expect(r.body.nhom_cua_toi.items.filter((d: any) => d.la_cua_toi)).toHaveLength(1);
    expect(r.body.tuan_truoc).toMatchObject({ tuan: "2026-08-10", bac: 1 });
    // Không trả danh sách người, chỉ số liệu đơn vị.
    expect(JSON.stringify(r.body)).not.toContain(`${PREFIX}-d1a`);
  });

  test("người ở Tổ con thấy mùa giải của Đội chứa mình", async () => {
    const r = await goi("GET", `/v1/mua-giai?mua=${muaId}`, tk.t1a!.token);
    expect(r.body.don_vi_cua_toi.unit_id).toBe(dv.D1);
  });

  test("quản trị thấy mọi nhóm; quản lý thấy các nhóm trong phạm vi của mình", async () => {
    const qt = await goi("GET", `/v1/mua-giai?mua=${muaId}`, tk.quantri!.token);
    expect(qt.body.cac_nhom).toHaveLength(2);
    expect(qt.body.don_vi_cua_toi).toBeNull();
    const p = await goi("GET", `/v1/mua-giai?mua=${muaId}`, tk["quanly-p"]!.token);
    expect(p.body.cac_nhom).toHaveLength(2);
    const d4 = await goi("GET", `/v1/mua-giai?mua=${muaId}`, tk["quanly-d4"]!.token);
    expect(d4.body.cac_nhom).toHaveLength(1);
    expect(d4.body.cac_nhom[0].items.map((d: any) => d.unit_id)).toContain(dv.D4);
  });

  test("mùa đã bắt đầu thì không sửa cấu hình được nữa", async () => {
    const r = await goi("PATCH", `/v1/quan-tri/mua-giai/${muaId}`, tk.quantri!.token, {
      config: { so_len: 2 },
    });
    expect(r.status).toBe(409);
  });
});
