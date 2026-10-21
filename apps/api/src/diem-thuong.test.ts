/**
 * Trò chơi hóa qua API (docs/PLAN.md GĐ9, mục "Kiểm tra đã xong"). Postgres test thật; dữ liệu
 * mang tiền tố riêng. Bảng xếp hạng kiểm trên XP gieo thẳng vào daily_activity để so với phép
 * tính tay.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { dauKy, NGUONG_CAP, ngayVietNam, QUY_TAC_XP, thuHaiCuaTuan } from "@qdpl/dao-tao";
import { cauThuThachNgay, sql, taoDonVi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd9";

async function goi(method: string, path: string, token: string, body?: unknown) {
  const res = await app.request(`http://test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const tk: Record<string, { id: string; token: string }> = {};
const dv: Record<"p" | "a" | "b", string> = { p: "", a: "", b: "" };
let chuDe = "";
let ngayMaiDaCo = false;
const homNay = ngayVietNam();
const ngayMai = ngayVietNam(new Date(Date.now() + 86_400_000));

async function taoTk(ten: string, unitId: string | null) {
  const [r] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id) VALUES (${`${PREFIX}-${ten}`}, ${`Người ${ten}`}, 'can_bo', ${unitId})
    RETURNING id`) as any[];
  tk[ten] = { id: r.id, token: (await createSession(r.id, "test")).token };
}

async function donDep() {
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  for (const cap of [3, 2, 1])
    await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) = ${cap}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`}`;
}

beforeAll(async () => {
  await donDep();
  ngayMaiDaCo = Boolean(((await sql`SELECT 1 FROM daily_challenges WHERE day = ${ngayMai}`) as any[]).length);
  // Thử thách hôm nay trên CSDL test có thể đã chốt từ lần chạy trước, bằng câu của các tệp test
  // khác mà nay đã bị xóa. Xóa để test tự chốt lại từ ngân hàng hiện có (gồm 20 câu tạo dưới đây).
  await sql`DELETE FROM daily_challenges WHERE day = ${homNay}`;
  const a = `${PREFIX}-seed`;
  dv.p = (await taoDonVi({ code: `${PREFIX}-P`, name: "Phòng GĐ9" }, a)).id;
  dv.a = (await taoDonVi({ code: `${PREFIX}-A`, name: "Đội A GĐ9", parentId: dv.p }, a)).id;
  dv.b = (await taoDonVi({ code: `${PREFIX}-B`, name: "Đội B GĐ9", parentId: dv.p }, a)).id;
  for (const [ten, don] of [
    ["a1", dv.a],
    ["a2", dv.a],
    ["b1", dv.b],
    ["b2", dv.b],
    ["hoc", null],
    ["hoc2", null],
  ] as const) {
    await taoTk(ten, don);
  }
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-chu-de`}, 'Chủ đề GĐ9') RETURNING id`) as any[];
  chuDe = t.id;
  for (let i = 1; i <= 20; i++) {
    await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${String(i).padStart(3, "0")}`}, ${chuDe}, 'de', 'mot_dap_an', ${`Câu GĐ9 số ${i}`},
              ${sql.json({ phuong_an: ["a", "b", "c"].map((x) => ({ id: x, text: `Phương án ${x}` })) })},
              ${sql.json({ dung: ["a"] })}, 'Giải thích.', 'da_duyet')`;
  }
  // XP gieo cho bảng xếp hạng tuần này: đội A = 30 + 10 (TB 20), đội B = 50 + 0 (TB 25).
  // a1 còn 100 XP của Chủ nhật tuần trước, không được tính vào tuần này.
  const tuanTruoc = new Date(`${thuHaiCuaTuan(homNay)}T00:00:00Z`);
  tuanTruoc.setUTCDate(tuanTruoc.getUTCDate() - 1);
  for (const [ten, xp, ngay] of [
    ["a1", 30, homNay],
    ["a2", 10, homNay],
    ["b1", 50, homNay],
    ["a1", 100, tuanTruoc.toISOString().slice(0, 10)],
  ] as const) {
    await sql`INSERT INTO daily_activity (account_id, day, xp) VALUES (${tk[ten]!.id}, ${ngay}, ${xp})
              ON CONFLICT (account_id, day) DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp`;
  }
});

afterAll(async () => {
  if (!ngayMaiDaCo) await sql`DELETE FROM daily_challenges WHERE day = ${ngayMai}`;
  await donDep();
});

describe("XP của phiên luyện tập", () => {
  test("kết thúc cùng một phiên hai lần chỉ cộng XP một lần", async () => {
    const t = tk.hoc!.token;
    const tao = await goi("POST", "/v1/luyen-tap/phien", t, { nguon: "chu_de", chu_de: chuDe });
    expect(tao.status).toBe(201);
    const phien = await goi("GET", `/v1/luyen-tap/phien/${tao.body.id}`, t);
    // Trả lời 3 câu: 2 câu chọn "a" (đúng), 1 câu chọn "b" (sai).
    for (const [stt, chon] of [
      [1, "a"],
      [2, "a"],
      [3, "b"],
    ] as const) {
      expect(phien.body.cau[stt - 1]).toBeDefined();
      const r = await goi("POST", `/v1/luyen-tap/phien/${tao.body.id}/tra-loi`, t, {
        stt,
        tra_loi: { chon: [chon] },
      });
      expect(r.status).toBe(200);
    }
    expect((await goi("POST", `/v1/luyen-tap/phien/${tao.body.id}/ket-thuc`, t)).status).toBe(200);
    expect((await goi("POST", `/v1/luyen-tap/phien/${tao.body.id}/ket-thuc`, t)).status).toBe(200);

    const soDong = (await sql`SELECT xp FROM xp_ledger WHERE source_id = ${tao.body.id}`) as any[];
    expect(soDong).toHaveLength(1);
    const xpMongDoi = 2 * QUY_TAC_XP.cau_dung_luyen_tap + QUY_TAC_XP.hoan_thanh_phien;
    expect(soDong[0].xp).toBe(xpMongDoi);

    const tq = await goi("GET", "/v1/toi/tong-quan", t);
    expect(tq.status).toBe(200);
    expect(tq.body).toMatchObject({ xp_tong: xpMongDoi, xp_tuan: xpMongDoi });
    expect(tq.body.chuoi).toMatchObject({ hien_tai: 1, da_hoc_hom_nay: true });
    expect(tq.body.huy_hieu.find((h: any) => h.code === "buoc-dau").dat_luc).not.toBeNull();
    expect(tq.body.huy_hieu.find((h: any) => h.code === "chuoi-7").dat_luc).toBeNull();

    const me = await goi("GET", "/v1/auth/me", t);
    expect(me.body.diem).toMatchObject({ xp: xpMongDoi, cap: 1, chuoi: 1 });
  });
});

describe("thử thách hằng ngày", () => {
  test("hai tài khoản nhận cùng 5 câu theo cùng thứ tự; bắt đầu lại trả phiên cũ", async () => {
    const r1 = await goi("POST", "/v1/luyen-tap/phien", tk.hoc!.token, { nguon: "thu_thach" });
    const r2 = await goi("POST", "/v1/luyen-tap/phien", tk.hoc2!.token, { nguon: "thu_thach" });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const ids = async (id: string) =>
      (((await sql`SELECT items FROM practice_sessions WHERE id = ${id}`) as any[])[0].items as any[]).map(
        (c) => c.question_id,
      );
    const cau1 = await ids(r1.body.id);
    expect(cau1).toHaveLength(Math.min(5, cau1.length));
    expect(cau1.length).toBeGreaterThan(0);
    expect(await ids(r2.body.id)).toEqual(cau1);
    expect(cau1).toEqual((await cauThuThachNgay(homNay)).slice(0, cau1.length));

    const lai = await goi("POST", "/v1/luyen-tap/phien", tk.hoc!.token, { nguon: "thu_thach" });
    expect(lai.status).toBe(200);
    expect(lai.body.id).toBe(r1.body.id);

    const tq = await goi("GET", "/v1/toi/tong-quan", tk.hoc2!.token);
    expect(tq.body.thu_thach).toMatchObject({ ngay: homNay, phien_id: r2.body.id, da_xong: false });
  });

  test("hoàn thành thử thách được thưởng XP thử thách", async () => {
    const t = tk.hoc2!.token;
    const id = (await goi("POST", "/v1/luyen-tap/phien", t, { nguon: "thu_thach" })).body.id;
    await goi("POST", `/v1/luyen-tap/phien/${id}/tra-loi`, t, { stt: 1, tra_loi: { chon: ["zzz"] } });
    await goi("POST", `/v1/luyen-tap/phien/${id}/ket-thuc`, t);
    const [dong] = (await sql`SELECT source_kind, xp FROM xp_ledger WHERE source_id = ${id}`) as any[];
    expect(dong).toEqual({ source_kind: "thu_thach", xp: QUY_TAC_XP.hoan_thanh_thu_thach });
  });

  test("ngày mai là một bộ câu khác", async () => {
    expect(await cauThuThachNgay(ngayMai)).not.toEqual(await cauThuThachNgay(homNay));
  });
});

describe("bảng xếp hạng", () => {
  test("bảng cá nhân của đội A: khớp phép tính tay, không có tên người đội B", async () => {
    const r = await goi("GET", "/v1/bang-xep-hang?pham_vi=don_vi&ky=tuan", tk.a1!.token);
    expect(r.status).toBe(200);
    expect(r.body.tu_ngay).toBe(dauKy("tuan"));
    expect(r.body.items.map((x: any) => [x.ten, x.xp, x.hang, x.la_toi])).toEqual([
      ["Người a1", 30, 1, true],
      ["Người a2", 10, 2, false],
    ]);
    expect(JSON.stringify(r.body)).not.toContain("Người b1");
  });

  test("bảng cá nhân kèm cấp theo tổng XP (không theo XP trong kỳ), không lộ tổng XP", async () => {
    // a2 có 260 XP tích lũy (cấp 3: ngưỡng 250) nhưng chỉ 10 XP trong tuần; a1 chưa có XP tích lũy.
    await sql`INSERT INTO xp_ledger (account_id, source_kind, source_id, xp, day)
              VALUES (${tk.a2!.id}, 'test', ${`${PREFIX}-cap-a2`}, 260, '2020-01-01')`;
    const r = await goi("GET", "/v1/bang-xep-hang?pham_vi=don_vi&ky=tuan", tk.a1!.token);
    expect(r.body.items.map((x: any) => [x.ten, x.xp, x.cap])).toEqual([
      ["Người a1", 30, 1],
      ["Người a2", 10, 3],
    ]);
    expect(r.body.items[0]).not.toHaveProperty("xp_tong");
  });

  test("phản hồi kèm ngưỡng cấp; dòng đồng nghiệp chỉ có XP trong kỳ và cấp, không có tổng XP", async () => {
    const r = await goi("GET", "/v1/bang-xep-hang?pham_vi=don_vi&ky=tuan", tk.a1!.token);
    expect(r.body.nguong_cap).toEqual([...NGUONG_CAP]);
    // a2 có 260 XP tích lũy (test trên): con số này không được xuất hiện ở bất kỳ trường nào.
    for (const x of r.body.items) {
      expect(Object.keys(x).sort()).toEqual(["account_id", "cap", "hang", "la_toi", "ten", "xp"]);
      expect(Object.values(x)).not.toContain(260);
    }
    for (const [url, token] of [
      ["/v1/bang-xep-hang?pham_vi=cac_don_vi&ky=thang", tk.a2!.token],
      ["/v1/bang-xep-hang", tk.hoc!.token],
    ] as const) {
      expect((await goi("GET", url, token)).body.nguong_cap).toEqual([...NGUONG_CAP]);
    }
  });

  test("bảng đơn vị xếp theo XP trung bình mỗi người: đội B (25) trên đội A (20)", async () => {
    const r = await goi("GET", "/v1/bang-xep-hang?pham_vi=cac_don_vi&ky=tuan", tk.a2!.token);
    expect(r.body.items.map((x: any) => [x.ten, x.so_nguoi, x.tong_xp, x.xp_trung_binh, x.hang])).toEqual([
      ["Đội B GĐ9", 2, 50, 25, 1],
      ["Đội A GĐ9", 2, 40, 20, 2],
    ]);
    expect(r.body.items.find((x: any) => x.la_cua_toi).ten).toBe("Đội A GĐ9");
    expect(JSON.stringify(r.body)).not.toContain("Người ");
  });

  test("tài khoản chưa gắn đơn vị nhận bảng rỗng kèm ghi chú", async () => {
    const r = await goi("GET", "/v1/bang-xep-hang", tk.hoc!.token);
    expect(r.body.items).toEqual([]);
    expect(r.body.ghi_chu).toContain("chưa gắn đơn vị");
  });
});
