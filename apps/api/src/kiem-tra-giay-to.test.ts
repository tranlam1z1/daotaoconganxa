/**
 * Kiểm thử API trò "Kiểm tra giấy tờ" và màn chơi của khung (docs/PLAN.md GĐ-T1) trên Postgres test
 * thật: chỉ màn đã mở chơi được, đề không lộ đáp án, chấm trên máy chủ, XP và tiến độ màn ghi một
 * lần, giờ cả ca theo màn, sửa luật giấy tờ thì hồ sơ rút khỏi trò, đồng bộ offline theo màn.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { type BuocGiayTo, type LuatGiayTo, type MaLoiGiayTo, sinhHoSo, taoRng } from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  type DongLuatGiayToTep,
  napLuatGiayTo,
  sql,
  taoNoiDungTroChoi,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-ktgt";
const MA = "kiem_tra_giay_to";
const NGAY = "2026-09-15";

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
  "loi",
  "luat",
  "bien_ban",
  "loi_du_kien",
  "dap_an",
  "giai_thich",
  "can_cu",
  "answer",
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
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const URN = "vn:vbqppl:l:36/2024/QH15";
function dong(
  ma: string,
  kiem: DongLuatGiayToTep["kiem"],
  giay_to: DongLuatGiayToTep["giay_to"],
  p: Partial<DongLuatGiayToTep> = {},
): DongLuatGiayToTep {
  return {
    ma: `${PREFIX}-${ma}`,
    kiem,
    giay_to,
    phan_loai: [],
    tham_so: {},
    ten: `Luật thử ${ma}`,
    giai_thich: "Giải thích thử cho luật này.",
    can_cu: URN,
    ma_muc_phat: null,
    hieu_luc_tu: "2025-01-01",
    trang_thai: "da_duyet",
    ...p,
  };
}
const LUAT: DongLuatGiayToTep[] = [
  dong("co-gplx", "phai_co", "gplx"),
  dong("co-dk", "phai_co", "dang_ky"),
  dong("co-bh", "phai_co", "bao_hiem"),
  dong("han-gplx", "con_han", "gplx"),
  dong("han-bh", "con_han", "bao_hiem"),
  dong("dk-bien", "khop_xe", "dang_ky", { tham_so: { truong: "bien_so" } }),
  dong("dk-nhan", "khop_xe", "dang_ky", { tham_so: { truong: "nhan_hieu" } }),
  dong("bh-bien", "khop_xe", "bao_hiem", { tham_so: { truong: "bien_so" } }),
  dong("nguoi", "khop_nguoi", "gplx"),
  dong("hang-nho", "hang_gplx", "gplx", { phan_loai: ["mo_to_nho"], tham_so: { hang: ["A1", "A"] } }),
  dong("hang-lon", "hang_gplx", "gplx", { phan_loai: ["mo_to_lon"], tham_so: { hang: ["A"] } }),
  dong("hang-oto", "hang_gplx", "gplx", { phan_loai: ["o_to_con"], tham_so: { hang: ["B"] } }),
];
const luatThuan: LuatGiayTo[] = LUAT.map((d) => ({ ...d, version: 1 }));

/** Tạo một hồ sơ; `duyet` thì duyệt luôn. Trả id. */
async function taoHoSo(ten: string, muc: number, loi: MaLoiGiayTo[], duyet = true): Promise<string> {
  const h = sinhHoSo({ loi, ngayKiemTra: NGAY, luat: luatThuan }, taoRng(ten));
  const nd = await taoNoiDungTroChoi(
    {
      game_code: MA,
      topic_id: null,
      level: "de",
      title: `${PREFIX} ${ten}`,
      payload: { ...h, muc } as unknown as Record<string, unknown>,
      answer: { loi },
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

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocGiayTo }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocGiayTo) =>
  b.loi.length
    ? { quyet_dinh: "giu_lai", dau_hieu: b.loi.map((l) => l.dau_hieu[0]) }
    : { quyet_dinh: "cho_qua", dau_hieu: [] };

let A: { id: string; token: string };
let B: { id: string; token: string };
let bienTap: { id: string; token: string };
let phapChe: { id: string; token: string };
let idChoDuyet = "";
let enabledCu = false;

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  await napLuatGiayTo(LUAT, { tienTo: PREFIX, cheDo: "theo_tep" });
  // Màn 1: 4 hợp lệ, 2 thiếu giấy phép, 2 giấy phép hết hạn. Màn 2: 2 hợp lệ, 3 sai biển số.
  const ds: Array<[number, MaLoiGiayTo[]]> = [
    [1, []],
    [1, []],
    [1, []],
    [1, []],
    [1, ["thieu_gplx"]],
    [1, ["thieu_gplx"]],
    [1, ["gplx_ngoai_han"]],
    [1, ["gplx_ngoai_han"]],
    [2, []],
    [2, []],
    [2, ["dang_ky_sai_bien_so"]],
    [2, ["dang_ky_sai_bien_so"]],
    [2, ["dang_ky_sai_bien_so"]],
  ];
  for (const [i, [muc, loi]] of ds.entries()) await taoHoSo(`hs-${String(i).padStart(2, "0")}`, muc, loi);
  idChoDuyet = await taoHoSo("cho-duyet", 1, [], false);
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  enabledCu = Boolean(g?.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

describe("Kiểm tra giấy tờ: màn 1", () => {
  let idLuot = "";

  test("danh sách trò có 5 màn, người mới chỉ mở màn 1; chọn màn chưa mở nhận 409", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    expect(ds.status).toBe(200);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, { man: 2 })).status).toBe(409);
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, { man: 0 })).status).toBe(400);
  });

  test("bắt đầu không chọn màn: màn 1, 8 người, không tính giờ, đề không lộ đáp án, không dùng hồ sơ chờ duyệt", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.man.so).toBe(1);
    expect(r.body.man.so_man).toBe(5);
    expect(r.body.so_buoc).toBe(8);
    expect(r.body.ca_luot_ms).toBeNull();
    expect(r.body.con_lai_luot_ms).toBeNull();
    expect(coKhoaCam(r.body)).toBeNull();
    expect(Object.keys(r.body.buoc_hien_tai.de.giay_to)).toEqual(["gplx"]);
    const items = await buocCuaLuot(idLuot);
    expect(items.some((b) => b.ref_id === idChoDuyet)).toBe(false);
    const [l] = (await sql`SELECT level, deadline_at FROM game_runs WHERE id = ${idLuot}`) as any[];
    expect(l.level).toBe(1);
    expect(l.deadline_at).toBeNull();
  });

  test("người khác không đọc được lượt; giữ lại mà không chỉ ra chi tiết nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: { quyet_dinh: "giu_lai", dau_hieu: [] },
    });
    expect(r.status).toBe(400);
  });

  test("chấm trên máy chủ: điểm máy khách gửi bị bỏ qua; kết quả có lỗi, căn cứ, biên bản", async () => {
    const items = await buocCuaLuot(idLuot);
    const b1 = items[0]!.noi_dung;
    // Cố tình trả lời sai, kèm điểm giả.
    const sai = b1.loi.length ? { quyet_dinh: "cho_qua" } : { quyet_dinh: "giu_lai", dau_hieu: ["gplx.so"] };
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: { ...sai, diem: 20, dung: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.diem).toBe(0);
    expect(r.body.ket_qua.dung).toBe(false);
    expect(r.body.ket_qua.chi_tiet.quyet_dinh_dung).toBe(b1.loi.length ? "giu_lai" : "cho_qua");
    if (b1.loi.length) {
      expect(r.body.ket_qua.can_cu).toEqual([URN]);
      expect(r.body.ket_qua.chi_tiet.bien_ban[0].muc_phat).toBeNull();
    }
    expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: sai })).status).toBe(
      409,
    );
  });

  test("trả lời đúng các người còn lại, kết thúc hai lần: XP của màn 1 một lần, tiến độ màn ghi một lần", async () => {
    const items = await buocCuaLuot(idLuot);
    for (let i = 2; i <= 8; i++) {
      const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(items[i - 1]!.noi_dung),
      });
      expect(r.status).toBe(200);
      expect(r.body.ket_qua.diem).toBe(20);
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(2); // 140/160 = 87,5%
    expect(kt.body.tong_ket.xp).toBe(9); // XP cơ bản màn 1 là 10, nhân tỷ lệ
    await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`}`) as any[];
    expect(xp).toHaveLength(1);
    const [lv] = (await sql`
      SELECT best_stars, plays, cleared_at FROM game_level_progress WHERE account_id = ${A.id} AND game_code = ${MA} AND level = 1`) as any[];
    expect(lv.best_stars).toBe(2);
    expect(lv.plays).toBe(1);
    expect(lv.cleared_at).not.toBeNull();
  });
});

describe("Kiểm tra giấy tờ: màn 2, giờ cả ca", () => {
  test("qua màn 1 thì mở màn 2; màn 2 có giờ cả ca; quá giờ thì không trả lời thêm và lượt hết giờ", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1, 2]);
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, { man: 2 });
    expect(r.status).toBe(201);
    expect(r.body.man.so).toBe(2);
    expect(r.body.ca_luot_ms).toBe(240_000);
    expect(r.body.con_lai_luot_ms).toBeGreaterThan(230_000);
    expect(Object.keys(r.body.buoc_hien_tai.de.giay_to).sort()).toEqual(["dang_ky", "gplx"]);
    const items = await buocCuaLuot(r.body.id);
    expect(items.filter((b) => b.noi_dung.ho_so && b.noi_dung.man === 2)).toHaveLength(8);
    await sql`UPDATE game_runs SET deadline_at = now() - interval '5 seconds' WHERE id = ${r.body.id}`;
    const tl = await goi("POST", `/v1/luot-choi/luot/${r.body.id}/buoc/1`, A.token, {
      tra_loi: traLoiDung(items[0]!.noi_dung),
    });
    expect(tl.status).toBe(409);
    expect((await goi("GET", `/v1/luot-choi/luot/${r.body.id}`, A.token)).body.trang_thai).toBe("het_gio");
  });
});

describe("Kiểm tra giấy tờ: luật giấy tờ", () => {
  test("sửa một luật đã duyệt thì luật về chờ duyệt, hồ sơ cần luật đó rút khỏi trò; duyệt lại thì chơi được", async () => {
    const ma = `${PREFIX}-han-gplx`;
    const chiTiet = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}`, bienTap.token);
    expect(chiTiet.status).toBe(200);
    const sua = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}`, bienTap.token, {
      name: "Giấy phép lái xe phải còn giá trị (sửa)",
      explanation: chiTiet.body.explanation,
      citation_urn: URN,
      version: chiTiet.body.version,
    });
    expect(sua.status).toBe(200);
    expect(sua.body.trang_thai).toBe("cho_duyet");
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}/duyet`, bienTap.token)).status,
    ).toBe(403);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}/duyet`, phapChe.token)).status,
    ).toBe(200);
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {})).status).toBe(201);
  });
});

describe("Kiểm tra giấy tờ: offline", () => {
  test("gói có danh sách màn; lượt màn chưa mở bị từ chối; lượt màn đã mở được chấm lại, ghi màn", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    expect(goi1.body.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
    const chung = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-ktgt",
      bat_dau: new Date().toISOString(),
    };
    const luotMan1 = {
      ...chung,
      client_id: crypto.randomUUID(),
      man: 1,
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { quyet_dinh: "cho_qua" },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, {
      luot: [{ ...chung, client_id: crypto.randomUUID(), man: 2, buoc: [] }, luotMan1],
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].loi).toContain("chưa mở");
    expect(r.body.ket_qua[1].so_buoc_moi).toBe(1);
    const [l] =
      (await sql`SELECT level, offline, status FROM game_runs WHERE id = ${r.body.ket_qua[1].id}`) as any[];
    expect(l).toEqual({ level: 1, offline: true, status: "xong" });

    // Gửi lại đúng lượt đó: không sinh lượt mới, không trùng bước, không cộng XP lần hai.
    const lai = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luotMan1] });
    expect(lai.body.ket_qua[0].id).toBe(r.body.ket_qua[1].id);
    expect(lai.body.ket_qua[0].so_buoc_moi).toBe(0);
    expect(lai.body.ket_qua[0].xp).toBe(0);
    const [{ n }] = (await sql`
      SELECT count(*)::int AS n FROM game_runs WHERE account_id = ${B.id} AND offline`) as any;
    expect(n).toBe(1);
  });
});
