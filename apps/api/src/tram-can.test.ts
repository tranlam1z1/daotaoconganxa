/**
 * Kiểm thử API trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12) trên Postgres test thật: đề không lộ ngưỡng
 * khung, dấu đúng, cặp quyết định; máy chủ tự tính phần trăm (phần trăm máy khách gửi bị bỏ qua); không có
 * cặp số căn cứ thì 400; giới hạn tải trọng có vòng đời duyệt (tab "Tải trọng"), sửa và duyệt lại thì đáp
 * án đổi theo; đồng bộ offline hai lần chỉ sinh một lượt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import {
  type BuocTramCan,
  type DongMucPhat,
  type DongTaiTrongTep,
  dapAnTramCan,
  xeDungDuocOMan,
} from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  napTaiTrong,
  napTraCuuNhanh,
  napXeTramCan,
  nguonTramCan,
  sql,
  type XeTramCanTep,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-tc";
const MA = "tram_can";
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
  "khung",
  "khung_ma",
  "dau",
  "quyet",
  "cap",
  "bien_ban",
  "muc_phat",
  "phan_tram",
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
  await sql`DELETE FROM load_limits WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocTramCan }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocTramCan) => {
  const q = b.cap[b.quyet]!;
  return {
    dau: b.dau,
    cap: { phieu: q.phieu, gioi_han: q.gioi_han },
    uoc: Math.round(Math.max(0, q.phan_tram)),
  };
};

let A: { id: string; token: string };
let B: { id: string; token: string };
let bienTap: { id: string; token: string };
let phapChe: { id: string; token: string };
let enabledCu = false;
const idXe = new Map<string, string>();

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  // Giới hạn, khung phần trăm và 30 xe lấy từ chính tệp mẫu, gắn tiền tố để dọn; trạng thái đã duyệt.
  const tt = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "tai-trong.json")).json()) as { dong: DongTaiTrongTep[] }
  ).dong.map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" }));
  await napTaiTrong(tt, { tienTo: PREFIX, cheDo: "theo_tep" });
  const mp = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: DongMucPhat[] }
  ).dong
    .filter((d) => d.qua_tai)
    .map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" as const }));
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  const xe = (
    (await Bun.file(join(GOC, "data", "tro-choi", "tram-can.json")).json()) as { xe: XeTramCanTep[] }
  ).xe;
  await napXeTramCan({ tienToTen: `${PREFIX} `, xe });
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

describe("Trạm cân: màn 1", () => {
  let idLuot = "";

  test("trò tắt sẵn trong migration, 5 màn, người mới chỉ mở màn 1", async () => {
    expect(enabledCu).toBe(false);
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
  });

  test("bắt đầu: 6 xe; đề không có khung, dấu đúng, cặp quyết định; màn 1 không có trục, bảng, giấy phép", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.so_buoc).toBe(6);
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(de.phieu_can.truc_kg).toEqual([]);
    expect(de.phieu_can.hang_kg).toBeNull();
    expect(de.bang).toEqual([]);
    expect(de.giay_phep_luu_hanh).toBeNull();
  });

  test("người khác không đọc được lượt; không có cặp số căn cứ hoặc ước ngoài 0–200 nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    for (const tra_loi of [
      { dau: "cho_di", uoc: 0 },
      { dau: "cho_di", cap: null, uoc: 0 },
      { dau: "cho_di", cap: { phieu: "phieu.tong", gioi_han: "kd.toan_bo" }, uoc: 250 },
    ])
      expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi })).status).toBe(
        400,
      );
  });

  test("máy khách gửi phần trăm tự tính và cờ đúng: máy chủ vẫn tính lại", async () => {
    const [b1] = await buocCuaLuot(idLuot);
    const q = b1!.noi_dung.cap[b1!.noi_dung.quyet]!;
    const vuot = Math.max(0, q.phan_tram);
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: {
        ...traLoiDung(b1!.noi_dung),
        uoc: Math.round(vuot) + 10,
        phan_tram: Math.round(vuot) + 10,
        phan_tram_vuot: Math.round(vuot) + 10,
        diem: 18,
        dung: true,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.diem).toBe(15);
    expect(r.body.ket_qua.dung).toBe(false);
    expect(r.body.ket_qua.chi_tiet.phan_tram_vuot).toBe(vuot);
    expect(r.body.ket_qua.chi_tiet.diem_uoc).toBe(0);
  });

  test("trả lời đúng các xe còn lại: 18 điểm mỗi xe; xe lập biên bản có biên bản; XP một lần", async () => {
    const items = await buocCuaLuot(idLuot);
    for (let i = 2; i <= items.length; i++) {
      const b = items[i - 1]!.noi_dung;
      const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(b),
      });
      expect(r.status).toBe(200);
      expect(r.body.ket_qua.diem).toBe(18);
      if (b.dau === "lap_bien_ban") expect(r.body.ket_qua.chi_tiet.bien_ban.length).toBeGreaterThan(0);
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBeGreaterThanOrEqual(2);
    await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`}`) as any[];
    expect(xp).toHaveLength(1);
  });
});

describe("Trạm cân: giới hạn tải trọng có duyệt", () => {
  test("tab Tải trọng; sửa giới hạn thì về chờ duyệt, xe cần nó không vào lượt; duyệt lại thì đáp án đổi theo", async () => {
    const ds = await goi("GET", "/v1/quan-tri/du-lieu-tra-cuu/tai-trong", bienTap.token);
    expect(ds.status).toBe(200);
    expect(ds.body.items.filter((d: any) => String(d.code).startsWith(PREFIX))).toHaveLength(10);
    const ma = `${PREFIX}-tt-cum2-tu-130`;
    const xe14 = async () => (await nguonTramCan({ ngay: NGAY })).find((n) => n.id === idXe.get("TC-14"))!;
    expect(dapAnTramCan((await xe14()).xe, (await xe14()).gioi_han, (await xe14()).khung, 3)?.dau).toBe(
      "lap_bien_ban",
    );
    const chiTiet = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/tai-trong/${ma}`, bienTap.token);
    const sua = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/tai-trong/${ma}`, bienTap.token, {
      limit_kg: 21_000,
      citation_urn: chiTiet.body.citation_urn,
      version: chiTiet.body.version,
    });
    expect(sua.status).toBe(200);
    expect(sua.body.trang_thai).toBe("cho_duyet");
    expect(xeDungDuocOMan(await xe14(), 3)).toBe(false);
    // Xe màn 2 cùng cụm trục: màn 2 chưa so tải trọng trục nên vẫn chơi được, màn 3 thì không.
    const xe11 = (await nguonTramCan({ ngay: NGAY })).find((n) => n.id === idXe.get("TC-11"))!;
    expect([xeDungDuocOMan(xe11, 2), xeDungDuocOMan(xe11, 3)]).toEqual([true, false]);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/tai-trong/${ma}/duyet`, bienTap.token)).status,
    ).toBe(403);
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/tai-trong/${ma}/duyet`, phapChe.token)).status,
    ).toBe(200);
    const n = await xe14();
    expect(dapAnTramCan(n.xe, n.gioi_han, n.khung, 3)?.dau).toBe("cho_di");
    const [lich] = (await sql`
      SELECT count(*)::int AS n FROM content_reviews WHERE kind = 'load_limit' AND ref = ${ma}`) as any[];
    expect(lich.n).toBeGreaterThanOrEqual(2);
  });
});

describe("Trạm cân: offline", () => {
  test("đồng bộ một ca offline hai lần chỉ sinh một lượt; máy chủ chấm lại", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-tc",
      bat_dau: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { dau: "cho_di", cap: { phieu: "phieu.tong", gioi_han: "kd.toan_bo" }, uoc: 0, diem: 18 },
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
    const q = b1!.noi_dung.cap[b1!.noi_dung.quyet]!;
    const dung = traLoiDung(b1!.noi_dung);
    const ky =
      (b1!.noi_dung.dau === "cho_di" ? 10 : 0) +
      (q.phieu === "phieu.tong" && q.gioi_han === "kd.toan_bo" ? 5 : 0) +
      (Math.abs(0 - Math.max(0, q.phan_tram)) <= 2 ? 3 : 0);
    expect(s.diem).toBe(ky);
    expect(dung.dau).toBe(b1!.noi_dung.dau);
  });
});
