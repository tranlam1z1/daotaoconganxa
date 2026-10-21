/**
 * Kiểm thử API trò "Lập biên bản" (docs/PLAN.md GĐ-G3) trên Postgres test thật: chỉ tình huống đã
 * duyệt trỏ tới mức phạt đã duyệt vào lượt; biểu mẫu gửi người chơi không chứa mã mức phạt; chấm
 * từng ô trên máy chủ; không tính giờ; XP một lần; gói offline gọn.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import type { BuocBienBan, DongMucPhat } from "@qdpl/dao-tao";
import { napTraCuuNhanh, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-lbb";
const ND = "vn:vbqppl:nd:168/2024/NĐ-CP";

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
  "phat_tu",
  "phat_den",
  "tru_diem",
  "noi_dung",
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

async function taoTaiKhoan(ten: string, role = "can_bo"): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

async function donDep() {
  const acc = sql`SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM game_runs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_packs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

function dong(ma: string, o: Partial<DongMucPhat>): DongMucPhat {
  return {
    ma: `${PREFIX}-${ma}`,
    xe: "mo_to",
    nhom: "Nhóm thử",
    hanh_vi: `${PREFIX} hành vi ${ma}`,
    tu_khoa: [],
    phat_tu: 400_000,
    phat_den: 600_000,
    hinh_thuc_bo_sung: [],
    tru_diem: null,
    can_cu: `${ND}#dieu-7`,
    hieu_luc_tu: "2025-01-01",
    trang_thai: "da_duyet",
    ...o,
  };
}

const MUC_PHAT = [
  dong("mu", {
    nhom: "Mũ bảo hiểm",
    hanh_vi: `${PREFIX} không đội mũ bảo hiểm`,
    can_cu: `${ND}#dieu-7.khoan-2.diem-h`,
  }),
  dong("den", { nhom: "Đèn tín hiệu", phat_tu: 4_000_000, phat_den: 6_000_000, tru_diem: 4 }),
  dong("con", {
    nhom: "Nồng độ cồn",
    phat_tu: 8_000_000,
    phat_den: 10_000_000,
    hinh_thuc_bo_sung: ["Tước giấy phép (thử)"],
  }),
  dong("dt", { nhom: "Điện thoại", tru_diem: 2 }),
  dong("oto", { xe: "o_to", nhom: "Đèn tín hiệu", can_cu: `${ND}#dieu-6` }),
];

/** Đáp án đúng của từng bước, đọc từ ảnh chụp của lượt trong CSDL. */
async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocBienBan }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocBienBan) => ({
  dong: b.dap_an.dong.map((d) => ({ hanh_vi: d.hanh_vi, dieu_khoan: d.dieu_khoan, tien: d.phat_den })),
  bo_sung: b.dap_an.bo_sung,
});

let A: { id: string; token: string };
let bienTap: { id: string; token: string };
let phapChe: { id: string; token: string };
const tinhHuongId: Record<string, string> = {};

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  await napTraCuuNhanh(MUC_PHAT, [], { tienTo: PREFIX });
  const ds: Array<[string, string[]]> = [
    ["t-mu", ["mu"]],
    ["t-den", ["den"]],
    ["t-hai", ["mu", "den"]],
    ["t-con", ["con"]],
  ];
  for (const [ma, viPham] of ds) {
    const codes = viPham.map((v) => `${PREFIX}-${v}`);
    const nd = await taoNoiDungTroChoi(
      {
        game_code: "lap_bien_ban",
        topic_id: null,
        level: "de",
        title: `${PREFIX} ${ma}`,
        payload: {
          loi_ke: `Tình huống thử ${ma}: anh A điều khiển xe mô tô trên đường, tổ công tác dừng xe.`,
        },
        answer: { vi_pham: codes },
        explanation: null,
        citations: [],
        refs: codes.map((c) => ({ loai: "violation" as const, ma: c })),
        offline_ok: true,
        status: "cho_duyet",
      },
      PREFIX,
    );
    tinhHuongId[ma] = nd.id;
  }
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = false WHERE code = 'lap_bien_ban'`;
  await donDep();
});

describe("đăng ký và chuẩn bị nội dung", () => {
  test("trò đã đăng ký, không tính giờ, có offline; đang tắt thì không bắt đầu được", async () => {
    const [g] = (await sql`SELECT offline_ok, engine FROM games WHERE code = 'lap_bien_ban'`) as any[];
    expect(g).toMatchObject({ offline_ok: true, engine: "luot_choi" });
    await sql`UPDATE games SET enabled = false WHERE code = 'lap_bien_ban'`;
    expect((await goi("POST", "/v1/luot-choi/lap_bien_ban/bat-dau", A.token)).status).toBe(404);
  });

  test("duyệt 4 tình huống; đưa mức phạt nồng độ cồn về chờ duyệt bằng cách sửa", async () => {
    for (const id of Object.values(tinhHuongId)) {
      expect((await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, phapChe.token)).status).toBe(
        200,
      );
    }
    const ma = `${PREFIX}-con`;
    const cu = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${ma}`, bienTap.token);
    const s = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${ma}`, bienTap.token, {
      behavior: cu.body.behavior,
      group_name: cu.body.group_name,
      fine_min: 9_000_000,
      fine_max: 10_000_000,
      point_deduction: null,
      extra_penalties: cu.body.extra_penalties,
      citation_urn: cu.body.citation_urn,
      version: cu.body.version,
    });
    expect(s.body).toMatchObject({ trang_thai: "cho_duyet" });
    await sql`UPDATE games SET enabled = true WHERE code = 'lap_bien_ban'`;
  });
});

describe("một lượt", () => {
  let id = "";

  test("bắt đầu: 3 biên bản, không có tình huống trỏ tới mức phạt chờ duyệt, đề không lộ mã mức phạt", async () => {
    const r = await goi("POST", "/v1/luot-choi/lap_bien_ban/bat-dau", A.token);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ma: "lap_bien_ban", so_buoc: 3 });
    expect(r.body.buoc_hien_tai.thoi_gian_ms ?? null).toBeNull();
    expect(coKhoaCam(r.body)).toBeNull();
    const s = JSON.stringify(r.body);
    for (const d of MUC_PHAT) expect(s).not.toContain(d.ma);
    const de = r.body.buoc_hien_tai.de;
    expect(de.loi_ke).toContain("Tình huống thử");
    expect(de.lua_chon_hanh_vi.length).toBeGreaterThan(1);
    expect(de.dieu_khoan.length).toBeGreaterThan(0);

    id = r.body.id;
    const buoc = await buocCuaLuot(id);
    expect(buoc.map((b) => b.ref_id).sort()).toEqual(
      [tinhHuongId["t-mu"]!, tinhHuongId["t-den"]!, tinhHuongId["t-hai"]!].sort(),
    );
  });

  test("chấm trên máy chủ: đúng cả 4 ô được 100; sai tiền, thừa một mục bổ sung được 62,5", async () => {
    const buoc = await buocCuaLuot(id);
    const b1 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
      tra_loi: traLoiDung(buoc[0]!.noi_dung),
    });
    expect(b1.status).toBe(200);
    expect(b1.body.ket_qua).toMatchObject({ diem: 100, dung: true, thuong: 0, het_gio: false });
    expect(b1.body.ket_qua.chi_tiet.diem_o).toEqual({ hanh_vi: 25, dieu_khoan: 25, tien: 25, bo_sung: 25 });
    expect(b1.body.ket_qua.can_cu.length).toBeGreaterThan(0);

    await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    const b = buoc[1]!.noi_dung;
    const thua = b.lua_chon_bo_sung.find((o) => !b.dap_an.bo_sung.includes(o.id))!.id;
    const tl = traLoiDung(b);
    tl.dong = tl.dong.map((d, i) => (i === 0 ? { ...d, tien: 1 } : d));
    tl.bo_sung = [...tl.bo_sung, thua];
    const b2 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/2`, A.token, { tra_loi: tl });
    const n = b.dap_an.dong.length;
    expect(b2.body.ket_qua.chi_tiet.diem_o).toEqual({
      hanh_vi: 25,
      dieu_khoan: 25,
      tien: 25 - 25 / n,
      bo_sung: 12.5,
    });

    // Sai dạng: 400.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, { tra_loi: { dong: "x", bo_sung: [] } }))
        .status,
    ).toBe(400);
  });

  test("không tính giờ: trả lời sau 10 phút vẫn đủ điểm; kết thúc hai lần chỉ một dòng XP", async () => {
    const buoc = await buocCuaLuot(id);
    await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    await sql`
      UPDATE game_runs SET step_opened_at = step_opened_at || jsonb_build_object('3', to_jsonb((now() - interval '10 minutes')::text))
      WHERE id = ${id}`;
    const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, {
      tra_loi: traLoiDung(buoc[2]!.noi_dung),
    });
    expect(r.body.ket_qua).toMatchObject({ diem: 100, het_gio: false });
    expect(r.body.con_buoc).toBe(false);

    const kt = await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.diem_toi_da).toBe(300);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = 'game:lap_bien_ban'`) as any[];
    expect(xp).toHaveLength(1);
    expect(xp[0].xp).toBeGreaterThan(0);
  });
});

describe("gói offline", () => {
  test("chỉ tình huống dùng được, kèm mức phạt cùng loại xe, gọn", async () => {
    const r = await goi("GET", "/v1/luot-choi/goi-offline/lap_bien_ban", A.token);
    expect(r.status).toBe(200);
    const ids = r.body.nguon.map((n: any) => n.id);
    expect(ids).not.toContain(tinhHuongId["t-con"]);
    const n = r.body.nguon.find((x: any) => x.id === tinhHuongId["t-mu"]);
    expect(n.muc_phat.every((m: any) => m.xe === "mo_to")).toBe(true);
    expect(n.can_cu_khac).toContain(`${ND}#dieu-6`);
    // Mỗi tình huống mang theo các dòng mức phạt cùng loại xe; 3 tình huống thử vẫn dưới 20 KB.
    expect(JSON.stringify(r.body).length).toBeLessThan(20_000);
  });
});
