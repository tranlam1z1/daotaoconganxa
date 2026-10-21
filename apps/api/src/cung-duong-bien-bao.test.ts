/**
 * Kiểm thử API trò "Cung đường biển báo" (docs/PLAN.md GĐ-G8) trên Postgres test thật: chỉ biển đã
 * duyệt có phản ứng vào lượt; đề không lộ tên biển, giải thích, căn cứ; đường chạy chấm lại từ nhật ký
 * trên máy chủ; nhật ký có tổng thời gian lệch 20% so với đồng hồ máy chủ bị chấm 0; lượt offline được
 * chấm, không có thưởng nhanh; sửa phản ứng của biển thì biển về chờ duyệt, rút khỏi trò.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { type BuocCungDuong, TRO_CHOI_CUNG_DUONG, taoRng } from "@qdpl/dao-tao";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-cdbb";

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

async function taoTaiKhoan(ten: string, role = "can_bo"): Promise<{ id: string; token: string }> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

/** 8 biển thử: đủ 4 thao tác, 4 nhóm. Thêm một biển bản nháp và một biển phụ không được dùng. */
const BIEN: Array<[string, string, string, string]> = [
  ["P1", "cam", "khong_vao", "Biển thử cấm vào"],
  ["P2", "cam", "di_tiep", "Biển thử cấm đỗ"],
  ["W1", "nguy_hiem", "giam_toc", "Biển thử nguy hiểm một"],
  ["W2", "nguy_hiem", "giam_toc", "Biển thử nguy hiểm hai"],
  ["R1", "hieu_lenh", "dung_lai", "Biển thử dừng lại"],
  ["R2", "hieu_lenh", "di_tiep", "Biển thử đi thẳng"],
  ["I1", "chi_dan", "di_tiep", "Biển thử chỉ dẫn"],
  ["I2", "chi_dan", "giam_toc", "Biển thử người đi bộ"],
];
const ma = (m: string) => `${PREFIX}-${m}`;

async function donDep() {
  const acc = sql`SELECT id FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM game_runs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM game_packs WHERE account_id IN (${acc})`;
  await sql`DELETE FROM xp_ledger WHERE account_id IN (${acc})`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM traffic_signs WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Nội dung các bước của lượt (có đáp án), đọc từ CSDL. */
async function buocCuaLuot(id: string): Promise<Array<{ noi_dung: BuocCungDuong }>> {
  const [r] = (await sql`SELECT items FROM game_runs WHERE id = ${id}`) as any[];
  return r.items;
}

/** Nhật ký phản ứng đúng mọi biển, 200 ms sau khi biển hiện. */
function nhatKyDung(d: Extract<BuocCungDuong, { loai: "duong" }>, tongMs = d.tong_ms) {
  return {
    loai: "duong",
    su_kien: d.bien.map((b) => ({ bien: b.thu_tu, thao_tac: b.phan_ung, ms: b.hien_ms + 200 })),
    tong_ms: tongMs,
  };
}

/** Lùi mốc mở bước của máy chủ, như thể người chơi đã chạy `ms` mili giây. */
async function lui(runId: string, thuTu: number, ms: number) {
  const luc = new Date(Date.now() - ms).toISOString();
  await sql`
    UPDATE game_runs SET step_opened_at = jsonb_set(step_opened_at, ARRAY[${String(thuTu)}]::text[], to_jsonb(${luc}::text))
    WHERE id = ${runId}`;
}

/** Trả lời 3 câu khởi động đúng, rồi mở đường chạy (GET) và trả về nội dung đường chạy. */
async function quaKhoiDong(id: string, token: string) {
  const items = await buocCuaLuot(id);
  for (let i = 1; i <= 3; i++) {
    const n = items[i - 1]!.noi_dung as Extract<BuocCungDuong, { loai: "doan" }>;
    const chon = String(n.phuong_an.findIndex((p) => p.ma === n.ma));
    await goi("GET", `/v1/luot-choi/luot/${id}`, token);
    const r = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/${i}`, token, {
      tra_loi: { loai: "doan", chon },
    });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua.diem).toBe(5);
  }
  const mo = await goi("GET", `/v1/luot-choi/luot/${id}`, token);
  expect(mo.body.buoc_hien_tai.thu_tu).toBe(4);
  return {
    de: mo.body.buoc_hien_tai.de,
    duong: items[3]!.noi_dung as Extract<BuocCungDuong, { loai: "duong" }>,
  };
}

let A: { id: string; token: string };
let bienTap: { id: string; token: string };

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  for (const [m, nhom, pu, ten] of BIEN) {
    await sql`
      INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction, reaction_note)
      VALUES (${ma(m)}, ${nhom}, ${ten}, ${`Ý nghĩa ${ten}`}, ${`assets/bien-bao/${m}.svg`},
              'vn:vbqppl:qcvn:41/2024/BGTVT', 'da_duyet', ${pu}, ${`Giải thích ${ten}`})`;
  }
  await sql`
    INSERT INTO traffic_signs (code, group_name, name, meaning, image_uri, citation_urn, status, reaction, reaction_note)
    VALUES (${ma("NHAP")}, 'cam', 'Biển nháp', 'Nháp', 'assets/bien-bao/n.svg', 'vn:x', 'nhap', 'khong_vao', 'x'),
           (${ma("PHU")}, 'phu', 'Biển phụ', 'Phụ', 'assets/bien-bao/s.svg', 'vn:x', 'da_duyet', 'di_tiep', 'x')`;
  await sql`UPDATE games SET enabled = true WHERE code = 'cung_duong_bien_bao'`;
});

afterAll(async () => {
  await sql`UPDATE games SET enabled = false WHERE code = 'cung_duong_bien_bao'`;
  await donDep();
});

describe("Cung đường biển báo", () => {
  test("migration: trò đã đăng ký, chơi offline được; Đoán biển báo cũ đã tắt", async () => {
    const [g] = (await sql`SELECT offline_ok, engine FROM games WHERE code = 'cung_duong_bien_bao'`) as any[];
    expect(g).toMatchObject({ offline_ok: true, engine: "luot_choi" });
    const [d] = (await sql`SELECT enabled FROM games WHERE code = 'doan_bien_bao'`) as any[];
    expect(d.enabled).toBe(false);
    // CHECK của cột reaction chỉ nhận 4 thao tác.
    let loi: unknown = null;
    try {
      await sql`UPDATE traffic_signs SET reaction = 'bay_qua' WHERE code = ${ma("P1")}`;
    } catch (e) {
      loi = e;
    }
    expect(String(loi)).toContain("traffic_signs_reaction_check");
  });

  test("bắt đầu: 3 câu khởi động rồi đường chạy; chỉ biển đã duyệt có phản ứng; đề không lộ tên, giải thích, căn cứ", async () => {
    const r = await goi("POST", "/v1/luot-choi/cung_duong_bien_bao/bat-dau", A.token);
    expect(r.status).toBe(201);
    expect(r.body.so_buoc).toBe(4);
    const de = JSON.stringify(r.body);
    expect(de).not.toContain("vn:vbqppl");
    expect(de).not.toContain("Giải thích");
    const items = await buocCuaLuot(r.body.id);
    const d = items[3]!.noi_dung as Extract<BuocCungDuong, { loai: "duong" }>;
    const dung = new Set(d.bien.map((b) => b.ma));
    expect(dung.has(ma("NHAP"))).toBe(false);
    expect(dung.has(ma("PHU"))).toBe(false);
    for (const m of dung) expect(m.startsWith(PREFIX)).toBe(true);

    const { de: deDuong } = await quaKhoiDong(r.body.id, A.token);
    const s = JSON.stringify(deDuong);
    for (const [, , , ten] of BIEN) expect(s).not.toContain(ten);
    expect(deDuong.bien).toHaveLength(12);
    await goi("POST", `/v1/luot-choi/luot/${r.body.id}/ket-thuc`, A.token);
  });

  test("nhật ký khớp đồng hồ: chấm lại trên máy chủ, đủ điểm, có thưởng nhanh; XP một lần", async () => {
    const r = await goi("POST", "/v1/luot-choi/cung_duong_bien_bao/bat-dau", A.token);
    const id = r.body.id as string;
    const { duong } = await quaKhoiDong(id, A.token);
    await lui(id, 4, duong.tong_ms + 4000);
    const kq = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/4`, A.token, { tra_loi: nhatKyDung(duong) });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua.diem).toBe(120);
    expect(kq.body.ket_qua.thuong).toBeGreaterThan(40);
    expect(kq.body.ket_qua.chi_tiet.hop_le).toBe(true);
    expect(kq.body.ket_qua.chi_tiet.bien[0].ghi_chu).toContain("Giải thích");
    const kt = await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    expect(kt.body.tong_ket.sao).toBe(3);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
    const [{ n }] = (await sql`
      SELECT count(*)::int AS n FROM xp_ledger WHERE account_id = ${A.id} AND source_id = ${id}`) as any;
    expect(n).toBe(1);
    // Xem lại lượt: kết quả dựng lại khớp kết quả đã ghi.
    const xem = await goi("GET", `/v1/luot-choi/luot/${id}`, A.token);
    expect(xem.body.da_choi[3].ket_qua.chi_tiet.hop_le).toBe(true);
  });

  test("nhật ký có tổng thời gian lệch 20% so với đồng hồ máy chủ: bước đường chạy 0 điểm", async () => {
    const r = await goi("POST", "/v1/luot-choi/cung_duong_bien_bao/bat-dau", A.token);
    const id = r.body.id as string;
    const { duong } = await quaKhoiDong(id, A.token);
    // Máy chủ chỉ thấy 80% thời gian mà nhật ký khai.
    await lui(id, 4, Math.round(duong.tong_ms * 0.8));
    const kq = await goi("POST", `/v1/luot-choi/luot/${id}/buoc/4`, A.token, { tra_loi: nhatKyDung(duong) });
    expect(kq.status).toBe(200);
    expect(kq.body.ket_qua).toMatchObject({ diem: 0, thuong: 0 });
    expect(kq.body.ket_qua.chi_tiet).toMatchObject({
      hop_le: false,
      ly_do: "Nhật ký không khớp đồng hồ máy chủ.",
    });
    // Không gửi lại được nhật ký đã sửa.
    expect(
      (await goi("POST", `/v1/luot-choi/luot/${id}/buoc/4`, A.token, { tra_loi: nhatKyDung(duong) })).status,
    ).toBe(409);
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
  });

  test("nhật ký sai dạng bị từ chối 400", async () => {
    const r = await goi("POST", "/v1/luot-choi/cung_duong_bien_bao/bat-dau", A.token);
    const id = r.body.id as string;
    await quaKhoiDong(id, A.token);
    const sai = { loai: "duong", su_kien: [{ bien: 1, thao_tac: "bay", ms: 10 }], tong_ms: 100 };
    expect((await goi("POST", `/v1/luot-choi/luot/${id}/buoc/4`, A.token, { tra_loi: sai })).status).toBe(
      400,
    );
    await goi("POST", `/v1/luot-choi/luot/${id}/ket-thuc`, A.token);
  });

  test("lượt offline: gói chỉ có biển đã duyệt; đồng bộ được chấm lại, không có thưởng nhanh", async () => {
    const B = await taoTaiKhoan("b");
    const g = await goi("GET", "/v1/luot-choi/goi-offline/cung_duong_bien_bao", B.token);
    expect(g.status).toBe(200);
    const maGoi = (g.body.nguon as Array<{ ma: string }>).map((x) => x.ma);
    expect(maGoi).not.toContain(ma("NHAP"));
    expect(maGoi).not.toContain(ma("PHU"));
    const seed = crypto.randomUUID();
    const buoc = TRO_CHOI_CUNG_DUONG.taoLuot(g.body.nguon, taoRng(seed));
    const batDau = new Date(Date.now() - 120_000);
    const luot = {
      client_id: crypto.randomUUID(),
      ma: "cung_duong_bien_bao",
      goi_id: g.body.goi_id,
      seed,
      bat_dau: batDau.toISOString(),
      ket_thuc: new Date(batDau.getTime() + 100_000).toISOString(),
      buoc: buoc.map((b) => {
        const n = b.noi_dung;
        return {
          client_id: crypto.randomUUID(),
          thu_tu: b.thu_tu,
          tra_loi:
            n.loai === "doan"
              ? { loai: "doan", chon: String(n.phuong_an.findIndex((p) => p.ma === n.ma)) }
              : nhatKyDung(n),
        };
      }),
    };
    const r = await goi("POST", "/v1/luot-choi/dong-bo", B.token, { luot: [luot] });
    expect(r.status).toBe(200);
    expect(r.body.ket_qua[0]).toMatchObject({ so_buoc_moi: 4, da_ket_thuc: true });
    const [run] = (await sql`
      SELECT score::float8 AS score, bonus::float8 AS bonus, stars FROM game_runs WHERE account_id = ${B.id}`) as any[];
    expect(run).toMatchObject({ score: 135, bonus: 0, stars: 3 });
  });

  test("sửa phản ứng của biển đã duyệt: biển về chờ duyệt, không còn trong nguồn của trò", async () => {
    const m = ma("W2");
    const cu = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/bien-bao/${m}`, bienTap.token);
    expect(cu.status).toBe(200);
    const s = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/bien-bao/${m}`, bienTap.token, {
      name: cu.body.name,
      meaning: cu.body.meaning,
      citation_urn: cu.body.citation_urn,
      reaction: "dung_lai",
      reaction_note: "Sửa thử phản ứng",
      version: cu.body.version,
    });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ trang_thai: "cho_duyet", reaction: "dung_lai" });
    const g = await goi("GET", "/v1/luot-choi/goi-offline/cung_duong_bien_bao", A.token);
    expect((g.body.nguon as Array<{ ma: string }>).map((x) => x.ma)).not.toContain(m);
    // Có phản ứng mà không có giải thích: 400.
    const loi = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/bien-bao/${m}`, bienTap.token, {
      name: cu.body.name,
      meaning: cu.body.meaning,
      citation_urn: cu.body.citation_urn,
      reaction: "giam_toc",
      reaction_note: "",
      version: s.body.version,
    });
    expect(loi.status).toBe(400);
  });
});
