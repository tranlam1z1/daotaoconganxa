/**
 * Kiểm thử API trò "Súng bắn tốc độ" (docs/PLAN.md GĐ-G2) trên Postgres test thật: chỉ tình huống
 * đã duyệt và khung phạt đã duyệt vào lượt, đề không lộ đáp án, chấm ba câu nhỏ trên máy chủ, luật
 * 12 giây mỗi xe, XP một lần, sửa khung phạt thì tình huống rút khỏi trò chơi, gói offline gọn, tra
 * tốc độ theo loại đường và duyệt tốc độ tối đa.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import type { BuocSungBan, DongMucPhat } from "@qdpl/dao-tao";
import { khungPhatTocDoDaDuyet, napTraCuuNhanh, sql, taoNoiDungTroChoi } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-sbtd";
const BIEN = `${PREFIX}-P127`;
const URN = "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6";

async function goi(method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.request(`http://test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any, text: "" };
}

const KHOA_CAM = [
  "answer",
  "dap_an",
  "giai_thich",
  "can_cu",
  "phat_tu",
  "phat_den",
  "tru_diem",
  "khung_ma",
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
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM traffic_signs WHERE code = ${BIEN}`;
  await sql`DELETE FROM speed_limits WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

function khung(
  ma: string,
  xe: "o_to" | "mo_to",
  tu: number,
  den: number | null,
  bien: "[)" | "[]" | "(]" | "()",
  truDiem: number | null,
): DongMucPhat {
  return {
    ma: `${PREFIX}-${ma}`,
    xe,
    nhom: "Tốc độ",
    hanh_vi: `${PREFIX} chạy quá tốc độ`,
    tu_khoa: [],
    phat_tu: 1_000_000,
    phat_den: 2_000_000,
    hinh_thuc_bo_sung: [],
    tru_diem: truDiem,
    toc_do_vuot: { tu, den, bien },
    can_cu: URN,
    hieu_luc_tu: "2025-01-01",
    trang_thai: "da_duyet",
  };
}

const KHUNG = [
  khung("oto-1", "o_to", 5, 10, "[)", null),
  khung("oto-2", "o_to", 10, 20, "[]", 2),
  khung("oto-3", "o_to", 20, null, "()", 4),
  khung("mt-1", "mo_to", 5, 10, "[)", null),
  khung("mt-2", "mo_to", 10, null, "[)", 2),
];

/** Đáp án đúng của từng bước, đọc từ ảnh chụp của lượt trong CSDL. */
async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocSungBan }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocSungBan) =>
  b.dap_an.vi_pham
    ? { vi_pham: true, khung: b.dap_an.khung_ma, bo_sung: b.dap_an.bo_sung_ma }
    : { vi_pham: false };

let A: { id: string; token: string };
let bienTap: { id: string; token: string };
let phapChe: { id: string; token: string };
const tinhHuongId: Record<string, string> = {};
let idChoDuyet = "";

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  await napTraCuuNhanh(KHUNG, [], { tienTo: PREFIX });
  await sql`
    INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status)
    VALUES (${BIEN}, 'cam', 'Tốc độ tối đa cho phép (test)', 'Biển thử', 'assets/bien-bao/P.127.svg',
            'vn:vbqppl:qcvn:41/2024/BGTVT#dieu-1', 'da_duyet')`;

  // 12 tình huống: 7 ô tô, 5 mô tô (2 xe không bị phạt). Tình huống thứ 13 để chờ duyệt.
  const ds: Array<[string, "o_to" | "mo_to", number, number]> = [
    ["o1", "o_to", 50, 48],
    ["o2", "o_to", 50, 57],
    ["o3", "o_to", 60, 70],
    ["o4", "o_to", 60, 80],
    ["o5", "o_to", 80, 101],
    ["o6", "o_to", 90, 130],
    ["o7", "o_to", 70, 73],
    ["m1", "mo_to", 40, 46],
    ["m2", "mo_to", 40, 52],
    ["m3", "mo_to", 50, 75],
    ["m4", "mo_to", 60, 66],
    ["m5", "mo_to", 50, 58],
    ["cho", "o_to", 50, 99],
  ];
  for (const [ma, xe, bien, doDuoc] of ds) {
    const nd = await taoNoiDungTroChoi(
      {
        game_code: "sung_ban_toc_do",
        topic_id: null,
        level: "de",
        title: `${PREFIX} ${ma}`,
        payload: {
          loai_xe: xe,
          mo_ta_xe: `Xe ${ma}`,
          boi_canh: "Đoạn thử",
          bien_toc_do: bien,
          toc_do_do: doDuoc,
        },
        answer: {},
        explanation: null,
        citations: [],
        refs: [
          ...KHUNG.filter((k) => k.xe === xe).map((k) => ({ loai: "violation" as const, ma: k.ma })),
          { loai: "traffic_sign" as const, ma: BIEN },
        ],
        offline_ok: true,
        status: "cho_duyet",
      },
      PREFIX,
    );
    tinhHuongId[ma] = nd.id;
  }
  idChoDuyet = tinhHuongId.cho!;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = false WHERE code = 'sung_ban_toc_do'`;
  await donDep();
});

describe("chuẩn bị nội dung", () => {
  test("trò đang tắt thì không bắt đầu được (404)", async () => {
    await sql`UPDATE games SET enabled = false WHERE code = 'sung_ban_toc_do'`;
    expect((await goi("POST", "/v1/luot-choi/sung_ban_toc_do/bat-dau", A.token)).status).toBe(404);
  });

  test("người duyệt duyệt 12 tình huống; tình huống thứ 13 để chờ duyệt", async () => {
    for (const [ma, id] of Object.entries(tinhHuongId)) {
      if (ma === "cho") continue;
      const r = await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, phapChe.token);
      expect(r.status).toBe(200);
    }
    await sql`UPDATE games SET enabled = true WHERE code = 'sung_ban_toc_do'`;
  });
});

describe("một lượt", () => {
  let id = "";

  test("bắt đầu: 10 xe, chỉ tình huống đã duyệt, đề không lộ đáp án hay mức tiền", async () => {
    const r = await goi("POST", "/v1/luot-choi/sung_ban_toc_do/bat-dau", A.token);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ma: "sung_ban_toc_do", so_buoc: 10 });
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de).toHaveProperty("toc_do_do");
    expect(de).toHaveProperty("bien_toc_do");
    expect(de.lua_chon_khung.length).toBeGreaterThan(1);
    expect(r.body.buoc_hien_tai.thoi_gian_ms).toBe(12_000);
    id = r.body.id;
    const buoc = await buocCuaLuot(id);
    expect(buoc.map((b) => b.ref_id)).not.toContain(idChoDuyet);
    expect(buoc.filter((b) => !b.noi_dung.dap_an.vi_pham).length).toBeGreaterThanOrEqual(2);
  });

  test("chấm trên máy chủ: đúng cả ba câu 10 điểm có thưởng nhanh; sai câu 1 được 0", async () => {
    const buoc = await buocCuaLuot(id);
    const b1 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/1`, A.token, {
      tra_loi: traLoiDung(buoc[0]!.noi_dung),
    });
    expect(b1.status).toBe(200);
    expect(b1.body.ket_qua).toMatchObject({ diem: 10, dung: true, het_gio: false });
    expect(b1.body.ket_qua.thuong).toBeGreaterThan(0);
    expect(b1.body.ket_qua.giai_thich).toContain("Biển giới hạn");

    await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    const sai = { vi_pham: !buoc[1]!.noi_dung.dap_an.vi_pham, khung: null, bo_sung: null };
    const b2 = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/2`, A.token, { tra_loi: sai });
    expect(b2.body.ket_qua).toMatchObject({ diem: 0, dung: false });

    // Sai dạng: 400.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, { tra_loi: { vi_pham: "co" } })).status,
    ).toBe(400);
  });

  test("trả lời xe sau 12 + 2 giây: 0 điểm, lượt đi tiếp", async () => {
    const buoc = await buocCuaLuot(id);
    await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    await sql`
      UPDATE game_runs SET step_opened_at = step_opened_at || jsonb_build_object('3', to_jsonb((now() - interval '15 seconds')::text))
      WHERE id = ${id}`;
    const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/3`, A.token, {
      tra_loi: traLoiDung(buoc[2]!.noi_dung),
    });
    expect(r.body.ket_qua).toMatchObject({ diem: 0, het_gio: true });
    expect(r.body.con_buoc).toBe(true);
  });

  test("chơi hết, kết thúc hai lần: một dòng XP", async () => {
    const buoc = await buocCuaLuot(id);
    for (let i = 4; i <= 10; i++) {
      await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
      const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(buoc[i - 1]!.noi_dung),
      });
      expect(r.status).toBe(200);
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket).toMatchObject({ diem: 80, diem_toi_da: 100, ty_le: 0.8, sao: 2 });
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = 'game:sung_ban_toc_do'`) as any[];
    expect(xp).toHaveLength(1);
    expect(xp[0].xp).toBe(16);
  });
});

describe("hiệu lực theo ngày chơi", () => {
  test("khung phạt chỉ lấy dòng còn hiệu lực tại ngày chơi", async () => {
    const ma = (m: Map<string, Array<{ ma: string }>>) =>
      [...m.values()]
        .flat()
        .map((k) => k.ma)
        .filter((x) => x.startsWith(PREFIX));
    // Các khung thử có hiệu lực từ 2025-01-01.
    expect(ma(await khungPhatTocDoDaDuyet("2024-12-31"))).toEqual([]);
    expect(ma(await khungPhatTocDoDaDuyet("2025-01-01")).length).toBeGreaterThan(0);
  });
});

describe("gói offline", () => {
  test("gói chỉ có tình huống đã duyệt kèm khung phạt đã duyệt, dưới 20 KB", async () => {
    const r = await goi("GET", "/v1/luot-choi/goi-offline/sung_ban_toc_do", A.token);
    expect(r.status).toBe(200);
    const ids = r.body.nguon.map((n: any) => n.id);
    expect(ids).not.toContain(idChoDuyet);
    expect(r.body.nguon.every((n: any) => n.khung.length > 0)).toBe(true);
    expect(JSON.stringify(r.body).length).toBeLessThan(20_000);
  });
});

describe("sửa khung phạt", () => {
  test("sửa một khung mô tô đã duyệt: khung về chờ duyệt, tình huống mô tô rút khỏi trò, không đủ 10 xe", async () => {
    const ma = `${PREFIX}-mt-2`;
    const cu = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${ma}`, bienTap.token);
    const s = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${ma}`, bienTap.token, {
      behavior: cu.body.behavior,
      group_name: cu.body.group_name,
      fine_min: 1_500_000,
      fine_max: 2_000_000,
      point_deduction: 2,
      extra_penalties: [],
      citation_urn: URN,
      version: cu.body.version,
    });
    expect(s.body).toMatchObject({ trang_thai: "cho_duyet", version: 2 });
    const r = await goi("POST", "/v1/luot-choi/sung_ban_toc_do/bat-dau", A.token);
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("Chưa đủ nội dung đã duyệt");
  });
});

describe("tốc độ tối đa theo loại đường", () => {
  test("chưa có dòng nào được duyệt: danh sách rỗng, tra theo loại đường báo rõ", async () => {
    const ds = await goi("GET", "/v1/tra-cuu/toc-do-toi-da?xe=o_to");
    expect(ds.body.items.filter((d: any) => d.ma.startsWith(PREFIX))).toEqual([]);
    const r = await goi("GET", `/v1/tra-cuu/toc-do?xe=o_to&duong=${PREFIX}-duong&do_duoc=70`);
    expect(r.status).toBe(400);
  });

  test("duyệt một dòng: tra theo loại đường dùng tốc độ của dòng đó; sửa thì về chờ duyệt", async () => {
    await sql`
      INSERT INTO speed_limits (code, vehicle_class, violation_vehicle, road_type, road_type_name, name, max_speed,
        citation_urn, effective_from, status)
      VALUES (${`${PREFIX}-sl`}, 'xe thử', 'o_to', ${`${PREFIX}-duong`}, 'Đường thử', 'xe thử — Đường thử', 60,
        ${URN}, '2025-01-01', 'cho_duyet')`;
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/toc-do-toi-da/${PREFIX}-sl/duyet`, bienTap.token))
        .status,
    ).toBe(403);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/toc-do-toi-da/${PREFIX}-sl/duyet`, phapChe.token))
        .status,
    ).toBe(200);
    const r = await goi("GET", `/v1/tra-cuu/toc-do?xe=o_to&duong=${PREFIX}-duong&do_duoc=75`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ choPhep: 60, vuot: 15 });
    expect(r.body.tocDoTheoDuong.tenLoaiDuong).toBe("Đường thử");

    const s = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/toc-do-toi-da/${PREFIX}-sl`, bienTap.token, {
      max_speed: 50,
      citation_urn: URN,
      version: 1,
    });
    expect(s.body).toMatchObject({ trang_thai: "cho_duyet", version: 2 });
    expect((await goi("GET", `/v1/tra-cuu/toc-do?xe=o_to&duong=${PREFIX}-duong&do_duoc=75`)).status).toBe(
      400,
    );
  });
});
