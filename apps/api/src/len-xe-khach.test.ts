/**
 * Kiểm thử API trò "Lên xe khách" (docs/PLAN.md GĐ-T13) trên Postgres test thật: đề không có số chỗ quy
 * đổi, số người vượt, lỗi, luật; id người sinh theo lượt; điểm, cờ đúng máy khách gửi bị bỏ qua; câu trả
 * lời sai dạng nhận 400; luật vận tải có vòng đời duyệt (tab "Luật giấy tờ", nhóm van_tai_khach), ngưỡng
 * đổi và duyệt lại thì đáp án đổi theo; xe có trẻ em không vào lượt khi chưa có luật trẻ em; đồng bộ offline
 * hai lần chỉ sinh một lượt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { type BuocXeKhach, type DongMucPhat, laNguoi, xeKhachDungDuocOMan } from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  type DongLuatVanTaiTep,
  napLuatGiayTo,
  napTraCuuNhanh,
  napXeKhach,
  nguonLenXeKhach,
  sql,
  type XeKhachTep,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-xk";
const MA = "len_xe_khach";
const NGAY = new Date().toISOString().slice(0, 10);
const GOC = join(import.meta.dir, "..", "..", "..");

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
  "noi_dung",
  "loi",
  "luat",
  "so_vuot",
  "so_quy_doi",
  "phat_toi_da",
  "co_thu_tu",
  "dau",
  "bien_ban",
  "muc_phat",
  "muc",
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
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocXeKhach }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocXeKhach) => {
  const cham = b.loi.filter((l) => l.ma !== "cho_qua_nguoi").map((l) => l.cho[0]!);
  const thu_tu = [...b.loi]
    .sort((a, c) => (b.phat_toi_da[c.ma] ?? -1) - (b.phat_toi_da[a.ma] ?? -1))
    .map((l) => l.cho[0]!);
  return {
    dem: b.phan_tu.filter((p) => laNguoi(p.hinh)).map((p) => p.id),
    so_vuot: b.so_vuot,
    cham,
    dau: b.dau,
    thu_tu: b.dau === "lap_bien_ban" ? thu_tu : [],
  };
};

let A: { id: string; token: string };
let B: { id: string; token: string };
let bienTap: { id: string; token: string };
let phapChe: { id: string; token: string };
let enabledCu = false;
const idXe = new Map<string, string>();
let LUAT_TEP: DongLuatVanTaiTep[] = [];

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  // Luật, dòng mức phạt và 20 xe lấy từ chính tệp mẫu, gắn tiền tố để dọn; luật và mức phạt đã duyệt.
  LUAT_TEP = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "luat-van-tai-khach.json")).json()) as {
      dong: DongLuatVanTaiTep[];
    }
  ).dong.map((d) => ({
    ...d,
    ma: `${PREFIX}-${d.ma}`,
    ma_muc_phat: d.ma_muc_phat ? `${PREFIX}-${d.ma_muc_phat}` : null,
    trang_thai: "da_duyet",
  }));
  await napLuatGiayTo(LUAT_TEP, { tienTo: PREFIX, cheDo: "theo_tep", nhom: "van_tai_khach" });
  const mp = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: DongMucPhat[] }
  ).dong
    .filter((d) => d.ma.startsWith("oto-khach-"))
    .map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" as const }));
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  const xe = ((await Bun.file(join(GOC, "data", "tro-choi", "xe-khach.json")).json()) as { xe: XeKhachTep[] })
    .xe;
  await napXeKhach({ tienToTen: `${PREFIX} `, xe });
  const ds = (await sql`
    SELECT id, title FROM game_content WHERE game_code = ${MA} AND title LIKE ${`${PREFIX}%`}`) as any[];
  for (const { id, title } of ds) {
    idXe.set(String(title).split(" · ")[0]!.replace(`${PREFIX} [Demo] `, ""), id);
    const kq = await chuyenTrangThaiNoiDung({
      id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "test",
    });
    expect(kq).toEqual({ ok: true });
  }
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  enabledCu = Boolean(g?.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

describe("Lên xe khách: màn 1", () => {
  let idLuot = "";

  test("trò tắt sẵn trong migration, 5 màn, người mới chỉ mở màn 1", async () => {
    expect(enabledCu).toBe(false);
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
  });

  test("bắt đầu: 3 xe; đề không có số người vượt, lỗi, luật; màn 1 không có giấy tờ, giám sát; id theo lượt", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.so_buoc).toBe(3);
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.giay_to).toBeNull();
    expect(de.giam_sat).toBeNull();
    expect(de.lai_xe).toBeNull();
    for (const p of de.phan_tu) {
      expect(Object.keys(p).sort()).toEqual(["hinh", "id", "o"]);
      expect(p.id).toMatch(/^[a-z0-9]{8}$/);
    }
    // Id của lượt khác (cùng xe) khác nhau.
    const [b1] = await buocCuaLuot(idLuot);
    const khac = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    const cuaB = (await buocCuaLuot(khac.body.id)).find((b) => b.ref_id === b1!.ref_id);
    if (cuaB)
      expect(cuaB.noi_dung.phan_tu.map((p) => p.id)).not.toEqual(b1!.noi_dung.phan_tu.map((p) => p.id));
  });

  test("người khác không đọc được lượt; câu trả lời sai dạng nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    for (const tra_loi of [
      { dem: [], so_vuot: 0, dau: "giu_lai" },
      { dem: [], so_vuot: 61, dau: "cho_di" },
      { dem: ["NGUOI"], so_vuot: 0, dau: "cho_di" },
      { dem: [], so_vuot: 1, cham: ["lvc.ngay"], dau: "lap_bien_ban", thu_tu: ["ph.so"] },
    ])
      expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi })).status).toBe(
        400,
      );
  });

  test("máy khách gửi điểm, cờ đúng, số vượt đúng: máy chủ bỏ qua; đếm dư thì không có điểm đếm", async () => {
    const [b1] = await buocCuaLuot(idLuot);
    const n = b1!.noi_dung;
    const vat = n.phan_tu.find((p) => !laNguoi(p.hinh));
    const dung = traLoiDung(n);
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: {
        ...dung,
        dem: vat ? [...dung.dem, vat.id] : dung.dem.slice(1),
        diem: 99,
        dung: true,
        so_vuot_dung: dung.so_vuot,
        diem_dem: 10,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.chi_tiet.diem_dem).toBe(0);
    // Màn 1 không có lỗi giấy tờ, không có bước sắp (một lỗi): chỉ còn điểm dấu.
    expect(r.body.ket_qua.diem).toBe(5);
    expect(r.body.ket_qua.dung).toBe(false);
  });

  test("trả lời đúng các xe còn lại: đủ điểm; xe lập biên bản có biên bản; XP một lần", async () => {
    const items = await buocCuaLuot(idLuot);
    for (let i = 2; i <= items.length; i++) {
      const b = items[i - 1]!;
      const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(b.noi_dung),
      });
      expect(r.status).toBe(200);
      expect(r.body.ket_qua.diem).toBe(r.body.ket_qua.diem_toi_da);
      if (b.noi_dung.dau === "lap_bien_ban")
        expect(r.body.ket_qua.chi_tiet.bien_ban.length).toBeGreaterThan(0);
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBeGreaterThanOrEqual(1);
    await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`}`) as any[];
    expect(xp).toHaveLength(1);
  });
});

describe("Lên xe khách: luật vận tải có duyệt", () => {
  test("tab Luật giấy tờ lọc nhóm van_tai_khach; nhóm lạ nhận 400", async () => {
    const ds = await goi(
      "GET",
      "/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to?nhom=van_tai_khach",
      bienTap.token,
    );
    expect(ds.status).toBe(200);
    const cua = ds.body.items.filter((d: any) => String(d.code).startsWith(PREFIX));
    expect(cua).toHaveLength(10);
    expect(ds.body.items.every((d: any) => d.nhom === "van_tai_khach")).toBe(true);
    expect(
      (await goi("GET", "/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to?nhom=khac", bienTap.token)).status,
    ).toBe(400);
  });

  test("xe có trẻ em không vào lượt khi chưa có luật cách tính trẻ em đã duyệt", async () => {
    const nguon = await nguonLenXeKhach({ ngay: NGAY });
    for (const ma of ["XK-07", "XK-08", "XK-20"]) {
      const n = nguon.find((x) => x.id === idXe.get(ma))!;
      expect(n).toBeTruthy();
      expect(xeKhachDungDuocOMan(n, 5)).toBe(false);
    }
  });

  test("ngưỡng đổi: nạp lại vào chờ duyệt thì xe cần luật đó rời lượt; pháp chế duyệt thì đáp án đổi theo", async () => {
    const ma = `${PREFIX}-vt-lai-lien-tuc`;
    const xe13 = async () => (await nguonLenXeKhach({ ngay: NGAY })).find((n) => n.id === idXe.get("XK-13"))!;
    expect(xeKhachDungDuocOMan(await xe13(), 4)).toBe(true);
    const moi = LUAT_TEP.map((d) =>
      d.ma === ma ? { ...d, tham_so: { ...d.tham_so, toi_da_phut: 300 } } : d,
    );
    await napLuatGiayTo(moi, { tienTo: PREFIX, cheDo: "cho_duyet", nhom: "van_tai_khach" });
    const [dong] = (await sql`SELECT status FROM document_rules WHERE code = ${ma}`) as any[];
    expect(dong.status).toBe("cho_duyet");
    // Luật chưa duyệt: màn 4 thiếu luật lái liên tục; màn 3 không cần nên xe màn 3 vẫn vào được.
    expect(xeKhachDungDuocOMan(await xe13(), 4)).toBe(false);
    const xe11 = (await nguonLenXeKhach({ ngay: NGAY })).find((n) => n.id === idXe.get("XK-11"))!;
    expect([xeKhachDungDuocOMan(xe11, 3), xeKhachDungDuocOMan(xe11, 4)]).toEqual([true, false]);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}/duyet`, bienTap.token)).status,
    ).toBe(403);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}/duyet`, phapChe.token)).status,
    ).toBe(200);
    // Ngưỡng 300 phút: xe lái 270 phút không còn lỗi, khác dự kiến nên không vào lượt.
    const n = await xe13();
    expect(n.luat.find((l) => l.ma === ma)?.tham_so.toi_da_phut).toBe(300);
    expect(xeKhachDungDuocOMan(n, 4)).toBe(false);
    // Trả lại ngưỡng cũ cho các test sau.
    await napLuatGiayTo(LUAT_TEP, { tienTo: PREFIX, cheDo: "theo_tep", nhom: "van_tai_khach" });
  });
});

describe("Lên xe khách: offline", () => {
  test("đồng bộ một lượt offline hai lần chỉ sinh một lượt; máy chủ chấm lại", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-xk",
      bat_dau: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { dem: [], so_vuot: 0, cham: [], dau: "cho_di", thu_tu: [], diem: 99 },
          luc: new Date().toISOString(),
        },
      ],
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0].so_buoc_moi).toBe(1);
    const lai = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(lai.body.ket_qua[0].id).toBe(r.body.ket_qua[0].id);
    expect(lai.body.ket_qua[0].so_buoc_moi).toBe(0);
    expect(lai.body.ket_qua[0].xp).toBe(0);
    const [{ n }] = (await sql`
      SELECT count(*)::int AS n FROM game_runs WHERE account_id = ${B.id} AND offline AND game_code = ${MA}`) as any;
    expect(n).toBe(1);
    const [b1] = await buocCuaLuot(r.body.ket_qua[0].id);
    const [s] = (await sql`
      SELECT points::int AS diem FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    // Không đếm ai, báo 0, Cho đi: chỉ có điểm dấu khi xe đúng là Cho đi; không bao giờ có điểm đếm.
    expect(s.diem).toBe(b1!.noi_dung.dau === "cho_di" ? 5 : 0);
  });
});
