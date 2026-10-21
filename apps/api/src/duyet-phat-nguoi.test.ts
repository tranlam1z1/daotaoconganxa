/**
 * Kiểm thử API trò "Duyệt hồ sơ phạt nguội" (docs/PLAN.md GĐ-T11) trên Postgres test thật: đề không lộ
 * hồ sơ đủ hay thiếu căn cứ, chấm trên máy chủ (cờ "đúng" máy khách gửi bị bỏ qua), trả lại mà không chỉ
 * chỗ thiếu nhận 400, luật kiểm hồ sơ nằm ở document_rules nhóm ho_so_phat_nguoi (sửa luật thì hồ sơ rút
 * khỏi trò), đồng bộ offline hai lần chỉ sinh một lượt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { type BuocPhatNguoi, CHO_CUA_THIEU } from "@qdpl/dao-tao";
import {
  chuyenTrangThaiNoiDung,
  type DongLuatPhatNguoiTep,
  type HoSoPhatNguoiTep,
  napHoSoPhatNguoi,
  napLuatGiayTo,
  sql,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-dpn";
const MA = "duyet_phat_nguoi";
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

/** Khóa cấm chung (GĐ-G0, GĐ-T1) và các khóa riêng của trò: độ rõ biển số, chỗ thiếu, màn của hồ sơ. */
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
  "ky_tu_mo",
  "cho_thieu",
  "cho_thieu_du_kien",
  "thong_bao",
  "ma_muc_phat",
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

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocPhatNguoi }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
const traLoiDung = (b: BuocPhatNguoi) =>
  b.cho_thieu.length
    ? { quyet_dinh: "tra_lai", cho: b.cho_thieu.map((c) => CHO_CUA_THIEU[c.ma][0]) }
    : { quyet_dinh: "gui" };

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
  // Luật và 30 hồ sơ lấy từ chính tệp mẫu, gắn tiền tố để dọn.
  const luat = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "luat-ho-so-phat-nguoi.json")).json()) as {
      dong: DongLuatPhatNguoiTep[];
    }
  ).dong.map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" }));
  await napLuatGiayTo(luat, { tienTo: PREFIX, cheDo: "theo_tep", nhom: "ho_so_phat_nguoi" });
  // Mã mức phạt của hồ sơ trỏ sang dòng mức phạt thử đã duyệt (duyệt hồ sơ cần mục được trỏ tới đã duyệt).
  const hoSo = (
    (await Bun.file(join(GOC, "data", "tro-choi", "phat-nguoi.json")).json()) as { ho_so: HoSoPhatNguoiTep[] }
  ).ho_so.map((h) => {
    const ma = h.ho_so.de_xuat.ma_muc_phat;
    return {
      ...h,
      ho_so: { ...h.ho_so, de_xuat: { ...h.ho_so.de_xuat, ma_muc_phat: ma ? `${PREFIX}-${ma}` : null } },
    };
  });
  for (const ma of new Set(hoSo.map((h) => h.ho_so.de_xuat.ma_muc_phat).filter((m): m is string => !!m))) {
    await sql`
      INSERT INTO violations (code, vehicle, behavior, fine_min, fine_max, citation_urn, effective_from, status)
      VALUES (${ma}, 'o_to', 'Hành vi thử', 400000, 600000, 'vn:vbqppl:nd:168/2024/NĐ-CP', '2025-01-01', 'da_duyet')`;
  }
  await napHoSoPhatNguoi({ tienToTen: `${PREFIX} `, hoSo });
  const ds = (await sql`
    SELECT id FROM game_content WHERE game_code = ${MA} AND title LIKE ${`${PREFIX}%`}`) as any[];
  for (const { id } of ds) {
    const kq = await chuyenTrangThaiNoiDung({
      id,
      tu: ["cho_duyet"],
      den: "da_duyet",
      hanhDong: "duyet",
      actor: "test",
    });
    expect(kq).toEqual({ ok: true });
  }
  // Một hồ sơ để ở chờ duyệt: không được vào lượt.
  await napHoSoPhatNguoi({ tienToTen: `${PREFIX} cho-duyet `, hoSo: [hoSo[0]!] });
  const [cd] = (await sql`
    SELECT id FROM game_content WHERE title LIKE ${`${PREFIX} cho-duyet%`}`) as any[];
  idChoDuyet = cd.id;
  const [g] = (await sql`SELECT enabled FROM games WHERE code = ${MA}`) as any[];
  enabledCu = Boolean(g?.enabled);
  await sql`UPDATE games SET enabled = true WHERE code = ${MA}`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = ${enabledCu} WHERE code = ${MA}`;
  await donDep();
});

describe("Duyệt hồ sơ phạt nguội: màn 1", () => {
  let idLuot = "";

  test("trò tắt sẵn trong migration, có 5 màn; người mới chỉ mở màn 1; chọn màn 5 nhận 409", async () => {
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, { man: 5 })).status).toBe(409);
    expect(enabledCu).toBe(false);
  });

  test("bắt đầu: 10 hồ sơ, không tính giờ; đề không có khóa cấm, không có độ rõ biển số; không dùng hồ sơ chờ duyệt", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.man.so).toBe(1);
    expect(r.body.so_buoc).toBe(10);
    expect(r.body.ca_luot_ms).toBeNull();
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    expect(Object.keys(de).sort()).toEqual(
      [
        "anh",
        "bien_so_anh",
        "bien_so_he_thong",
        "de_xuat",
        "do_toc_do",
        "loai_xe",
        "man",
        "thiet_bi",
        "thoi_diem",
        "vi_tri",
      ].sort(),
    );
    expect(Object.keys(de.de_xuat).sort()).toEqual(["hanh_vi", "ten"]);
    const items = await buocCuaLuot(idLuot);
    expect(items.some((b) => b.ref_id === idChoDuyet)).toBe(false);
    expect(items.filter((b) => b.noi_dung.cho_thieu.length === 0).length).toBeGreaterThanOrEqual(3);
  });

  test("người khác không đọc được lượt; trả lại mà không chỉ chỗ thiếu nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    for (const tra_loi of [{ quyet_dinh: "tra_lai", cho: [] }, { quyet_dinh: "tra_lai" }]) {
      expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi })).status).toBe(
        400,
      );
    }
  });

  test("gửi thông báo kèm cờ đúng từ máy khách: cờ bị bỏ qua, máy chủ tự chấm", async () => {
    const items = await buocCuaLuot(idLuot);
    const b1 = items[0]!.noi_dung;
    // Hồ sơ thiếu: gửi là sai dù kèm cờ đúng. Hồ sơ đủ: trả lại là sai dù kèm điểm.
    const sai = b1.cho_thieu.length
      ? { quyet_dinh: "gui", dung: true, diem: 15 }
      : { quyet_dinh: "tra_lai", cho: ["vi_tri"], dung: true, diem: 10 };
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi: sai });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.diem).toBe(0);
    expect(r.body.ket_qua.dung).toBe(false);
    expect(r.body.ket_qua.chi_tiet.quyet_dinh_dung).toBe(b1.cho_thieu.length ? "tra_lai" : "gui");
    expect(r.body.ket_qua.diem_toi_da).toBe(10 + 5 * b1.cho_thieu.length);
  });

  test("trả lời đúng các hồ sơ còn lại: hồ sơ đủ có thông báo vi phạm; XP một lần", async () => {
    const items = await buocCuaLuot(idLuot);
    for (let i = 2; i <= 10; i++) {
      const b = items[i - 1]!.noi_dung;
      const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(b),
      });
      expect(r.status).toBe(200);
      expect(r.body.ket_qua.dung).toBe(true);
      expect(r.body.ket_qua.chi_tiet.thong_bao).toHaveLength(b.cho_thieu.length ? 0 : 1);
      // Thông báo lấy mức phạt từ dòng mức phạt đã duyệt (M4); hành vi chưa có mã thì ghi chưa có.
      if (!b.cho_thieu.length)
        expect(r.body.ket_qua.chi_tiet.thong_bao[0].muc_phat?.ma ?? null).toBe(b.ho_so.de_xuat.ma_muc_phat);
      if (b.cho_thieu.length) expect(r.body.ket_qua.can_cu.length).toBeGreaterThan(0);
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.status).toBe(200);
    expect(kt.body.tong_ket.sao).toBeGreaterThanOrEqual(1);
    await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`}`) as any[];
    expect(xp).toHaveLength(1);
  });
});

describe("Duyệt hồ sơ phạt nguội: luật kiểm hồ sơ", () => {
  test("tab luật lọc theo nhóm; sửa luật đã duyệt thì hồ sơ rút khỏi trò; duyệt lại thì chơi được", async () => {
    const ds = await goi(
      "GET",
      "/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to?nhom=ho_so_phat_nguoi",
      bienTap.token,
    );
    expect(ds.status).toBe(200);
    expect(ds.body.items.length).toBeGreaterThanOrEqual(6);
    expect(ds.body.items.every((d: any) => d.nhom === "ho_so_phat_nguoi")).toBe(true);
    expect(
      (await goi("GET", "/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to?nhom=khac", bienTap.token)).status,
    ).toBe(400);

    const ma = `${PREFIX}-pn-thay-hanh-vi`;
    const chiTiet = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}`, bienTap.token);
    const sua = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}`, bienTap.token, {
      name: `${chiTiet.body.name} (sửa)`,
      explanation: chiTiet.body.explanation,
      citation_urn: chiTiet.body.citation_urn,
      version: chiTiet.body.version,
    });
    expect(sua.status).toBe(200);
    expect(sua.body.trang_thai).toBe("cho_duyet");
    const bd = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {});
    expect(bd.status).toBe(400);
    expect(JSON.stringify(bd.body)).toContain("Chưa đủ nội dung");
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/luat-giay-to/${ma}/duyet`, phapChe.token)).status,
    ).toBe(200);
    expect((await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, B.token, {})).status).toBe(201);
  });
});

describe("Duyệt hồ sơ phạt nguội: offline", () => {
  test("đồng bộ một ca offline hai lần chỉ sinh một lượt; máy chủ chấm lại", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-dpn",
      bat_dau: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { quyet_dinh: "gui", dung: true },
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
    // Điểm do máy chủ chấm lại từ seed: bước 1 gửi thông báo, đúng khi và chỉ khi hồ sơ đủ căn cứ.
    const items = await buocCuaLuot(r.body.ket_qua[0].id);
    const [s] = (await sql`
      SELECT points::int AS diem FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    expect(s.diem).toBe(items[0]!.noi_dung.cho_thieu.length ? 0 : 10);
  });
});
