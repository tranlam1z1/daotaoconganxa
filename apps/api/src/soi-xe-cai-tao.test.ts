/**
 * Kiểm thử API trò "Soi xe cải tạo" (docs/PLAN.md GĐ-T14) trên Postgres test thật: đề không có danh sách
 * biến thể, vùng đáp án, tên bộ phận; điểm, cờ đúng máy khách gửi bị bỏ qua; câu trả lời sai dạng nhận 400;
 * biến thể về chờ duyệt (sửa dòng mức phạt) thì xe dùng nó rời lượt; đồng bộ offline hai lần chỉ sinh một lượt.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createSession } from "@qdpl/auth";
import { type BuocSoiXe, type DongMucPhat, xeSoiDungDuocOMan } from "@qdpl/dao-tao";
import {
  type BienTheCaiTaoTep,
  chuyenTrangThaiNoiDung,
  napSoiXeCaiTao,
  napTraCuuNhanh,
  nguonSoiXeCaiTao,
  sql,
  type XeCaiTaoTep,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-sx";
const MA = "soi_xe_cai_tao";
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
  "bien_the",
  "vung",
  "cho_sai",
  "than",
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
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

async function buocCuaLuot(id: string): Promise<Array<{ ref_id: string; noi_dung: BuocSoiXe }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}
/** Trả lời đúng: vùng đáp án đầu tiên của từng chỗ sai; màu sơn thì khung nhỏ giữa phần sơn. */
const traLoiDung = (b: BuocSoiXe) => ({
  khung: b.cho_sai.map((c) => {
    if (c.bien_doi !== "doi_mau_son") return { goc: c.vung[0]!.goc, hop: c.vung[0]!.hop, dong: c.dong };
    const t = b.than.nghieng;
    const cx = Math.round((t[0] + t[2]) / 2);
    const cy = Math.round((t[1] + t[3]) / 2);
    return { goc: "nghieng", hop: [cx - 10, cy - 8, cx + 10, cy + 8], dong: c.dong };
  }),
  dau: b.dau,
});

let A: { id: string; token: string };
let B: { id: string; token: string };
let enabledCu = false;
const idXe = new Map<string, string>();

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
  const mp = (
    (await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: DongMucPhat[] }
  ).dong
    .filter((d) => d.ma.startsWith("oto-cai-tao-"))
    .map((d) => ({ ...d, ma: `${PREFIX}-${d.ma}`, trang_thai: "da_duyet" as const }));
  await napTraCuuNhanh(mp, [], { tienTo: PREFIX, cheDo: "theo_tep" });
  // Danh mục và 16 xe lấy từ chính tệp mẫu; mục danh mục trỏ tới dòng mức phạt có tiền tố.
  const danhMuc = (
    (await Bun.file(join(GOC, "data", "tro-choi", "bien-the-cai-tao.json")).json()) as {
      bien_the: BienTheCaiTaoTep[];
    }
  ).bien_the.map((b) => ({ ...b, ma_muc_phat: b.ma_muc_phat ? `${PREFIX}-${b.ma_muc_phat}` : null }));
  const xe = (
    (await Bun.file(join(GOC, "data", "tro-choi", "xe-cai-tao.json")).json()) as { xe: XeCaiTaoTep[] }
  ).xe;
  await napSoiXeCaiTao({ tienToTen: `${PREFIX} `, danhMuc, xe });
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

describe("Soi xe cải tạo: màn 1", () => {
  let idLuot = "";

  test("trò tắt sẵn trong migration, 5 màn, người mới chỉ mở màn 1", async () => {
    expect(enabledCu).toBe(false);
    const ds = await goi("GET", "/v1/luot-choi", A.token);
    const g = ds.body.tro_choi.find((x: any) => x.ma === MA);
    expect(g.man).toHaveLength(5);
    expect(g.man.filter((m: any) => m.da_mo).map((m: any) => m.so)).toEqual([1]);
  });

  test("bắt đầu: 5 xe; đề không có biến thể, vùng đáp án; nét hình không gắn tên bộ phận", async () => {
    const r = await goi("POST", `/v1/luot-choi/${MA}/bat-dau`, A.token, {});
    expect(r.status).toBe(201);
    idLuot = r.body.id;
    expect(r.body.so_buoc).toBe(5);
    expect(coKhoaCam(r.body)).toBeNull();
    const de = r.body.buoc_hien_tai.de;
    for (const g of ["nghieng", "sau"])
      for (const n of de.hinh[g].net) expect(Object.keys(n).sort()).toEqual(["d", "kieu"]);
    expect(de.giay.thong_so.co_lop).toBeTruthy();
  });

  test("người khác không đọc được lượt; câu trả lời sai dạng nhận 400", async () => {
    expect((await goi("GET", `/v1/luot-choi/luot/${idLuot}`, B.token)).status).toBe(403);
    const k = { goc: "nghieng", hop: [1, 1, 5, 5], dong: null };
    for (const tra_loi of [
      { khung: [], dau: "cho_qua" },
      { khung: Array(7).fill(k), dau: "dat" },
      { khung: [{ ...k, hop: [5, 5, 1, 1] }], dau: "dat" },
      { khung: [{ ...k, dong: "gplx" }], dau: "dat" },
    ])
      expect((await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, { tra_loi })).status).toBe(
        400,
      );
  });

  test("máy khách gửi điểm, cờ đúng, vùng tự khai: máy chủ bỏ qua; khung cả hình bị loại", async () => {
    const [b1] = await buocCuaLuot(idLuot);
    const de = (await goi("GET", `/v1/luot-choi/luot/${idLuot}`, A.token)).body.buoc_hien_tai.de;
    const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/1`, A.token, {
      tra_loi: {
        khung: [
          {
            goc: "nghieng",
            hop: [0, 0, de.hinh.nghieng.rong, de.hinh.nghieng.cao],
            dong: b1!.noi_dung.cho_sai[0]!.dong,
          },
        ],
        dau: b1!.noi_dung.dau,
        diem: 13,
        dung: true,
        vung: b1!.noi_dung.cho_sai[0]!.vung,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.chi_tiet.diem_khoanh).toBe(0);
    expect(r.body.ket_qua.chi_tiet.khung_qua_lon).toEqual([0]);
    expect(r.body.ket_qua.diem).toBe(5);
    expect(r.body.ket_qua.dung).toBe(false);
  });

  test("trả lời đúng các xe còn lại: đủ điểm, có biên bản; XP một lần", async () => {
    const items = await buocCuaLuot(idLuot);
    for (let i = 2; i <= items.length; i++) {
      const b = items[i - 1]!.noi_dung;
      const r = await goi("POST", `/v1/luot-choi/luot/${idLuot}/buoc/${i}`, A.token, {
        tra_loi: traLoiDung(b),
      });
      expect(r.status).toBe(200);
      expect(r.body.ket_qua.diem).toBe(r.body.ket_qua.diem_toi_da);
      expect(r.body.ket_qua.chi_tiet.bien_ban.length).toBeGreaterThan(0);
      expect(r.body.ket_qua.chi_tiet.bien_ban[0].muc_phat).not.toBeNull();
    }
    const kt = await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBeGreaterThanOrEqual(2);
    await goi("POST", `/v1/luot-choi/luot/${idLuot}/ket-thuc`, A.token);
    const xp = (await sql`
      SELECT xp FROM xp_ledger WHERE account_id = ${A.id} AND source_kind = ${`game:${MA}`}`) as any[];
    expect(xp).toHaveLength(1);
  });
});

describe("Soi xe cải tạo: danh mục có duyệt", () => {
  test("dòng mức phạt của biến thể về chờ duyệt thì biến thể rời danh mục, xe dùng nó không vào lượt", async () => {
    const xe02 = async () => (await nguonSoiXeCaiTao({ ngay: NGAY })).find((n) => n.id === idXe.get("SX-02"));
    expect(xeSoiDungDuocOMan((await xe02())!, 1)).toBe(true);
    await sql`UPDATE violations SET status = 'cho_duyet' WHERE code = ${`${PREFIX}-oto-cai-tao-den`}`;
    const n = await xe02();
    // Mục "đèn nóc" rút khỏi danh mục: xe không còn trong nguồn (không khớp danh mục) hoặc không dùng được.
    expect(!n || !xeSoiDungDuocOMan(n, 1)).toBe(true);
    const xe01 = (await nguonSoiXeCaiTao({ ngay: NGAY })).find((x) => x.id === idXe.get("SX-01"))!;
    expect(xeSoiDungDuocOMan(xe01, 1)).toBe(true);
    await sql`UPDATE violations SET status = 'da_duyet' WHERE code = ${`${PREFIX}-oto-cai-tao-den`}`;
  });
});

describe("Soi xe cải tạo: offline", () => {
  test("đồng bộ một lượt offline hai lần chỉ sinh một lượt; máy chủ chấm lại", async () => {
    const goi1 = await goi("GET", `/v1/luot-choi/goi-offline/${MA}`, B.token);
    expect(goi1.status).toBe(200);
    const luot = {
      ma: MA,
      goi_id: goi1.body.goi_id,
      seed: "offline-seed-sx",
      bat_dau: new Date().toISOString(),
      client_id: crypto.randomUUID(),
      man: 1,
      ket_thuc: new Date().toISOString(),
      buoc: [
        {
          client_id: crypto.randomUUID(),
          thu_tu: 1,
          tra_loi: { khung: [], dau: "khong_dat", diem: 13 },
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
    const [{ n }] = (await sql`
      SELECT count(*)::int AS n FROM game_runs WHERE account_id = ${B.id} AND offline AND game_code = ${MA}`) as any;
    expect(n).toBe(1);
    const [s] = (await sql`
      SELECT points::int AS diem FROM game_run_steps WHERE run_id = ${r.body.ket_qua[0].id} AND ordinal = 1`) as any[];
    // Màn 1: mọi xe có đúng một chỗ sai; không khoanh gì, đóng Không đạt: chỉ có điểm dấu.
    expect(s.diem).toBe(5);
  });
});
