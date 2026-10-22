/**
 * Báo cáo (docs/PLAN.md GĐ7) trên Postgres test thật. Dữ liệu gieo: Phòng > 3 đội, 10 cán bộ,
 * 1 đề giao cho cả phòng, 15 lượt đã nộp (5 người làm hai lần), vài phiên luyện tập. Số liệu
 * mong đợi tính tay trong test từ chính bảng gieo, không đọc lại từ CSDL.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { docOExcelTho, sql, taoDonVi } from "@qdpl/db";
import * as mupdf from "mupdf";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd7";
const PASS = 70;

async function goi(path: string, token?: string) {
  const res = await app.request(`http://test${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const ct = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    ct,
    body: ct.includes("json") ? ((await res.json()) as any) : new Uint8Array(await res.arrayBuffer()),
  };
}

const DOI = [
  { khoa: "A", ten: "Đội Cảnh sát giao thông" },
  { khoa: "B", ten: "Đội Cảnh sát trật tự" },
  { khoa: "C", ten: "Đội Cảnh sát cơ động" },
] as const;

/** Lượt đã nộp: [người, điểm, phút làm]. Người có hai lượt thì lượt tính là lượt điểm cao hơn. */
const LUOT: Array<[string, number, number]> = [
  ["A1", 60, 30],
  ["A1", 85, 25],
  ["A2", 90, 20],
  ["A2", 70, 28],
  ["A3", 50, 40],
  ["A4", 75, 33],
  ["B1", 40, 35],
  ["B1", 65, 30],
  ["B2", 80, 22],
  ["B3", 70, 26],
  ["C1", 55, 38],
  ["C1", 72, 31],
  ["C2", 30, 40],
  ["C2", 45, 39],
  ["C3", 95, 18],
];
const NGUOI = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "C1", "C2", "C3"];

/** Lượt tốt nhất mỗi người, tính tay. */
function totNhat(): Map<string, { diem: number; phut: number; soLan: number }> {
  const m = new Map<string, { diem: number; phut: number; soLan: number }>();
  for (const [ai, diem, phut] of LUOT) {
    const cu = m.get(ai);
    if (!cu) m.set(ai, { diem, phut, soLan: 1 });
    else {
      cu.soLan++;
      if (diem > cu.diem) Object.assign(cu, { diem, phut });
    }
  }
  return m;
}

const dv: Record<string, string> = {};
const acc: Record<string, string> = {};
const tk: Record<"quanTri" | "quanLyA" | "canBo", string> = { quanTri: "", quanLyA: "", canBo: "" };
let examId = "";
const cauHoi: string[] = [];

async function taoTaiKhoan(ten: string, role: string, unitId: string | null) {
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id)
    VALUES (${`${PREFIX}-${ten.toLowerCase()}`}, ${`Cán bộ ${ten}`}, ${role}, ${unitId})
    RETURNING id`) as any[];
  return row.id as string;
}

async function donDep() {
  await sql`DELETE FROM exams WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM questions WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`} OR target LIKE ${`${PREFIX}%`}`;
  const ids = ((await sql`SELECT id FROM accounts WHERE username LIKE ${`${PREFIX}%`}`) as any[]).map(
    (r) => r.id,
  );
  await sql`DELETE FROM access_log WHERE account_id = ANY(${ids}::uuid[])`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  for (const cap of [4, 3, 2, 1])
    await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) = ${cap}`;
}

beforeAll(async () => {
  await donDep();
  const a = `${PREFIX}-seed`;
  dv.phong = (await taoDonVi({ code: `${PREFIX}-P`, name: "Phòng thử GĐ7" }, a)).id;
  for (const [i, d] of DOI.entries()) {
    dv[d.khoa] = (
      await taoDonVi({ code: `${PREFIX}-${d.khoa}`, name: d.ten, parentId: dv.phong, ordinal: i }, a)
    ).id;
  }
  for (const n of NGUOI) acc[n] = await taoTaiKhoan(n, "can_bo", dv[n[0]!]!);
  const quanTri = await taoTaiKhoan("quan-tri", "quan_tri", null);
  const quanLyA = await taoTaiKhoan("quan-ly-a", "lanh_dao", dv.A!);
  tk.quanTri = (await createSession(quanTri, "test")).token;
  tk.quanLyA = (await createSession(quanLyA, "test")).token;
  tk.canBo = (await createSession(acc.A1!, "test")).token;

  const [de] = (await sql`
    INSERT INTO exams (title, matrix, question_count, duration_minutes, pass_score, status, published_at)
    VALUES (${`${PREFIX} Đề sát hạch tháng 9`}, '[]', 30, 45, ${PASS}, 'xuat_ban', now())
    RETURNING id`) as any[];
  examId = de.id;
  const [giao] = (await sql`
    INSERT INTO exam_assignments (exam_id, unit_id, include_subunits, opens_at, due_at, assigned_by)
    VALUES (${examId}, ${dv.phong!}, true, '2026-09-01', '2026-10-01', ${`${PREFIX}-seed`})
    RETURNING id`) as any[];

  // Ba câu hỏi: câu 1 ai cũng sai, câu 2 đúng một nửa, câu 3 ai cũng đúng.
  const [t] = (await sql`
    INSERT INTO question_topics (code, name) VALUES (${`${PREFIX}-td`}, 'Tốc độ (thử GĐ7)') RETURNING id`) as any[];
  for (let i = 1; i <= 3; i++) {
    const [q] = (await sql`
      INSERT INTO questions (code, topic_id, level, kind, stem, options, answer, explanation, status)
      VALUES (${`${PREFIX}-${i}`}, ${t.id}, 'de', 'dung_sai', ${`Câu thử GĐ7 số ${i}`}, '{}',
              ${sql.json({ dung: ["dung"] })}, 'Giải thích.', 'da_duyet')
      RETURNING id`) as any[];
    cauHoi.push(q.id);
  }

  const soLan = new Map<string, number>();
  for (const [k, [ai, diem, phut]] of LUOT.entries()) {
    const lan = (soLan.get(ai) ?? 0) + 1;
    soLan.set(ai, lan);
    const batDau = new Date(Date.UTC(2026, 8, 10, 2, k));
    const nop = new Date(batDau.getTime() + phut * 60_000);
    const [luot] = (await sql`
      INSERT INTO exam_attempts (exam_id, assignment_id, account_id, attempt_no, items, started_at, deadline_at,
                                 submitted_at, submit_kind, correct, total, score, passed, status)
      VALUES (${examId}, ${giao.id}, ${acc[ai]!}, ${lan}, '[]', ${batDau}, ${new Date(batDau.getTime() + 45 * 60_000)},
              ${nop}, 'nguoi_thi', ${Math.round((diem * 30) / 100)}, 30, ${diem}, ${diem >= PASS}, 'da_nop')
      RETURNING id`) as any[];
    for (const [o, qid] of cauHoi.entries()) {
      const dung = o === 0 ? false : o === 1 ? k % 2 === 0 : true;
      await sql`
        INSERT INTO exam_answers (attempt_id, ordinal, question_id, question_version, response, correct)
        VALUES (${luot.id}, ${o + 1}, ${qid}, 1, '{}', ${dung})`;
    }
  }

  // Luyện tập: A1 hai phiên (3 câu, 2 đúng), B2 một phiên (2 câu, 0 đúng).
  const phien = async (ai: string, dungSai: boolean[]) => {
    const [s] = (await sql`
      INSERT INTO practice_sessions (account_id, topic_id, total, started_at, finished_at)
      VALUES (${acc[ai]!}, ${t.id}, ${dungSai.length}, '2026-09-12T02:00:00Z', '2026-09-12T02:10:00Z')
      RETURNING id`) as any[];
    for (const [i, d] of dungSai.entries()) {
      await sql`
        INSERT INTO practice_answers (session_id, question_id, question_version, correct, created_at)
        VALUES (${s.id}, ${cauHoi[i]!}, 1, ${d}, '2026-09-12T02:05:00Z')`;
    }
  };
  await phien("A1", [true, false]);
  await phien("A1", [true]);
  await phien("B2", [false, false]);
});

afterAll(async () => {
  await donDep();
});

describe("quyền và phạm vi", () => {
  test("chưa đăng nhập 401, cán bộ 403", async () => {
    expect((await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${examId}`)).status).toBe(401);
    expect((await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${examId}`, tk.canBo)).status).toBe(403);
    expect((await goi("/v1/bao-cao/bo-loc", tk.canBo)).status).toBe(403);
  });

  test("quan_ly đội A chỉ thấy người đội A, kể cả khi không lọc đơn vị", async () => {
    const r = await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${examId}`, tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.dong.map((d: any) => d.don_vi)).toEqual(Array(4).fill(DOI[0].ten));
    expect(r.body.tong_hop.so_nguoi).toBe(4);
  });

  test("quan_ly đội A lọc đơn vị đội B nhận 403; bộ lọc chỉ có đơn vị của mình", async () => {
    expect((await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${examId}&don_vi=${dv.B}`, tk.quanLyA)).status).toBe(
      403,
    );
    const bl = await goi("/v1/bao-cao/bo-loc", tk.quanLyA);
    expect(bl.body.don_vi.map((d: any) => d.id)).toEqual([dv.A]);
    expect(bl.body.de_thi.some((d: any) => d.id === examId)).toBe(true);
  });

  test("báo cáo luyện tập và câu hỏi khó của quan_ly đội A không có người đội B", async () => {
    const lt = await goi("/v1/bao-cao/luyen-tap?theo=nguoi", tk.quanLyA);
    expect(lt.body.dong.map((d: any) => d.nhom)).toEqual(["Cán bộ A1"]);
    const kho = await goi(`/v1/bao-cao/cau-hoi-kho?de_thi=${examId}&toi_thieu=1`, tk.quanLyA);
    // Đội A có 6 lượt thi.
    expect(kho.body.dong.every((d: any) => d.so_luot === 6)).toBe(true);
  });
});

describe("số liệu khớp phép tính tay", () => {
  test("kết quả đề: số dòng, điểm trung bình, tỷ lệ đạt, lượt tốt nhất, số lần, xếp hạng", async () => {
    const r = await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${examId}&don_vi=${dv.phong}`, tk.quanTri);
    expect(r.status).toBe(200);
    const tay = totNhat();
    const diem = [...tay.values()].map((v) => v.diem);
    const soDat = diem.filter((d) => d >= PASS).length;
    expect(r.body.dong.length).toBe(10);
    expect(r.body.tong_hop.so_nguoi).toBe(10);
    expect(r.body.tong_hop.diem_trung_binh).toBe(
      Math.round((diem.reduce((s, d) => s + d, 0) / 10) * 100) / 100,
    );
    expect(r.body.tong_hop.so_dat).toBe(soDat);
    expect(r.body.tong_hop.ty_le_dat).toBe(Math.round((soDat / 10) * 1000) / 10);

    const a1 = r.body.dong.find((d: any) => d.ho_ten === "Cán bộ A1");
    expect(a1.diem).toBe(85);
    expect(a1.so_lan).toBe(2);
    expect(a1.giay_lam).toBe(25 * 60);
    expect(r.body.dong[0].ho_ten).toBe("Cán bộ C3");
    expect(r.body.dong[0].xep_hang).toBe(1);
    // Điểm đúng bằng ngưỡng vẫn đạt.
    expect(r.body.dong.find((d: any) => d.ho_ten === "Cán bộ B3").dat).toBe(true);
  });

  test("lọc khoảng ngày không có lượt nào thì rỗng", async () => {
    const r = await goi(
      `/v1/bao-cao/ket-qua-thi?de_thi=${examId}&don_vi=${dv.phong}&tu=2026-09-11`,
      tk.quanTri,
    );
    expect(r.body.dong.length).toBe(0);
    expect(r.body.tong_hop.ty_le_dat).toBeNull();
  });

  test("tổng hợp đơn vị: được giao, đã làm, tỷ lệ đạt, điểm trung bình, xếp hạng", async () => {
    const r = await goi(`/v1/bao-cao/don-vi?de_thi=${examId}&don_vi=${dv.phong}`, tk.quanTri);
    expect(r.status).toBe(200);
    const tay = totNhat();
    const theoDoi = DOI.map((d) => {
      const ds = NGUOI.filter((n) => n[0] === d.khoa).map((n) => tay.get(n)!.diem);
      const dat = ds.filter((x) => x >= PASS).length;
      return {
        don_vi: d.ten,
        so_da_lam: ds.length,
        so_dat: dat,
        ty_le_dat: Math.round((dat / ds.length) * 1000) / 10,
        diem_trung_binh: Math.round((ds.reduce((s, x) => s + x, 0) / ds.length) * 100) / 100,
      };
    });
    const dong = new Map(r.body.dong.map((d: any) => [d.don_vi, d]));
    for (const t of theoDoi) expect(dong.get(t.don_vi)).toMatchObject(t);
    // Đội A có thêm tài khoản quản lý nên được giao 5 người.
    expect((dong.get(DOI[0].ten) as any).so_duoc_giao).toBe(5);
    expect((dong.get(DOI[1].ten) as any).so_duoc_giao).toBe(3);
    const hang = [...theoDoi].sort(
      (a, b) => b.ty_le_dat - a.ty_le_dat || b.diem_trung_binh - a.diem_trung_binh,
    );
    expect(r.body.dong.map((d: any) => d.don_vi)).toEqual(hang.map((h) => h.don_vi));
    expect(r.body.dong[0].xep_hang).toBe(1);
  });

  test("luyện tập theo người, theo chủ đề", async () => {
    const r = await goi(`/v1/bao-cao/luyen-tap?theo=nguoi&don_vi=${dv.phong}`, tk.quanTri);
    expect(r.body.dong).toEqual([
      { nhom: "Cán bộ A1", don_vi: DOI[0].ten, so_phien: 2, so_cau: 3, so_dung: 2, ty_le_dung: 66.7 },
      { nhom: "Cán bộ B2", don_vi: DOI[1].ten, so_phien: 1, so_cau: 2, so_dung: 0, ty_le_dung: 0 },
    ]);
    const cd = await goi(`/v1/bao-cao/luyen-tap?theo=chu_de&don_vi=${dv.phong}`, tk.quanTri);
    expect(cd.body.dong).toEqual([
      { nhom: "Tốc độ (thử GĐ7)", don_vi: null, so_phien: 3, so_cau: 5, so_dung: 2, ty_le_dung: 40 },
    ]);
  });

  test("câu hỏi khó: câu ai cũng sai đứng đầu với tỷ lệ sai 100%", async () => {
    const r = await goi(
      `/v1/bao-cao/cau-hoi-kho?de_thi=${examId}&don_vi=${dv.phong}&toi_thieu=1`,
      tk.quanTri,
    );
    expect(r.body.dong.map((d: any) => d.ma_cau)).toEqual([`${PREFIX}-1`, `${PREFIX}-2`, `${PREFIX}-3`]);
    expect(r.body.dong[0].ty_le_sai).toBe(100);
    expect(r.body.dong[0].so_luot).toBe(15);
    expect(r.body.dong[2].ty_le_sai).toBe(0);
  });
});

describe("danh sách, hồ sơ cán bộ và tổng quan", () => {
  const hoSo = (ai: string, token: string, them = "") => goi(`/v1/bao-cao/can-bo/${acc[ai]}${them}`, token);

  test("danh sách có id để mở hồ sơ, tìm được theo tên đăng nhập", async () => {
    const r = await goi(`/v1/bao-cao/tien-do-hoc?don_vi=${dv.phong}&q=${PREFIX}-a1`, tk.quanTri);
    expect(r.status).toBe(200);
    expect(r.body.dong.map((d: any) => d.id)).toEqual([acc.A1]);
  });

  test("hồ sơ khớp dòng của người đó ở danh sách và khớp phép tính tay", async () => {
    const ds = await goi(`/v1/bao-cao/tien-do-hoc?don_vi=${dv.A}`, tk.quanLyA);
    const dong = ds.body.dong.find((d: any) => d.id === acc.A1);
    const r = await hoSo("A1", tk.quanLyA);
    expect(r.status).toBe(200);
    expect(r.body.nguoi).toMatchObject({ id: acc.A1, ho_ten: "Cán bộ A1", don_vi: DOI[0].ten });
    // Không lộ đường dẫn đơn vị ra ngoài.
    expect(r.body.nguoi.duong_dan).toBeUndefined();
    for (const k of Object.keys(r.body.tong_quan)) expect(r.body.tong_quan[k]).toEqual(dong[k]);

    // A1 làm hai lượt 60 và 85: lấy lượt 85, đạt.
    expect(r.body.bai_thi).toHaveLength(1);
    expect(r.body.bai_thi[0]).toMatchObject({
      de_thi_id: examId,
      duoc_giao: true,
      trang_thai: "dat",
      ket_qua: "Đạt",
      diem: 85,
      so_lan: 2,
      diem_tu_luan: null,
    });
    // Hai phiên, 3 câu, 2 đúng, cùng một chủ đề.
    expect(r.body.luyen_tap).toMatchObject({ so_phien: 2, so_cau: 3, so_dung: 2, ty_le_dung: 66.7 });
    expect(r.body.luyen_tap.chu_de).toEqual([
      { chu_de: "Tốc độ (thử GĐ7)", so_phien: 2, so_cau: 3, so_dung: 2, ty_le_dung: 66.7 },
    ]);
    expect(r.body.bai_hoc).toEqual([]);
  });

  test("người không đạt, và lọc ngày không còn lượt nào thì đề thành quá hạn", async () => {
    const a3 = await hoSo("A3", tk.quanTri);
    expect(a3.body.bai_thi[0]).toMatchObject({ trang_thai: "khong_dat", diem: 50, so_lan: 1 });
    expect(a3.body.tong_quan).toMatchObject({ bai_thi_duoc_giao: 1, bai_thi_da_nop: 1, bai_thi_dat: 0 });

    const sau = await hoSo("A1", tk.quanTri, "?tu=2027-01-01");
    expect(sau.body.bai_thi[0]).toMatchObject({
      trang_thai: "qua_han",
      diem: null,
      so_lan: 0,
      nop_luc: null,
    });
    expect(sau.body.tong_quan).toMatchObject({ bai_thi_duoc_giao: 1, bai_thi_da_nop: 0, so_phien: 0 });
    expect(sau.body.luyen_tap.chu_de).toEqual([]);
  });

  test("hồ sơ: chưa đăng nhập 401, cán bộ 403, ngoài phạm vi và id lạ cùng một lỗi 403", async () => {
    expect((await hoSo("A1", "")).status).toBe(401);
    expect((await hoSo("A1", tk.canBo)).status).toBe(403);
    const ngoai = await hoSo("B1", tk.quanLyA);
    expect(ngoai.status).toBe(403);
    expect(ngoai.body.error.code).toBe("ngoai_pham_vi");
    const la = await goi("/v1/bao-cao/can-bo/00000000-0000-4000-8000-000000000000", tk.quanLyA);
    expect(la.status).toBe(403);
    expect(la.body.error).toEqual(ngoai.body.error);
    expect((await goi("/v1/bao-cao/can-bo/khong-phai-uuid", tk.quanTri)).status).toBe(403);
  });

  test("hồ sơ xuất Excel nhiều trang tính và PDF nhiều bảng; có ghi nhật ký", async () => {
    const x = await hoSo("A1", tk.quanTri, "?dinh_dang=xlsx");
    expect(x.status).toBe(200);
    expect(x.ct).toContain("spreadsheetml");
    const o = await docOExcelTho(x.body as Uint8Array);
    expect(o[0]).toEqual(["Mục", "Giá trị"]);
    expect(o).toContainEqual(["Họ tên", "Cán bộ A1"]);
    expect(o).toContainEqual(["Đề thi đạt", 1]);

    const p = await hoSo("A1", tk.quanTri, "?dinh_dang=pdf");
    expect(p.ct).toBe("application/pdf");
    const doc = mupdf.Document.openDocument(p.body as Uint8Array, "application/pdf");
    const chu = Array.from({ length: doc.countPages() }, (_, i) =>
      doc.loadPage(i).toStructuredText().asText(),
    ).join("\n");
    for (const co of [
      "Hồ sơ học tập: Cán bộ A1",
      "Đơn vị: Đội Cảnh sát giao thông",
      "Bài thi",
      `${PREFIX} Đề sát hạch tháng 9`,
      "Chưa ghi danh chuyên đề nào.",
      "Tốc độ (thử GĐ7)",
    ]) {
      expect(chu).toContain(co);
    }

    const nk = (await sql`
      SELECT detail FROM audit_log WHERE action = 'bao_cao.xuat' AND target = 'ho-so-can-bo'
        AND actor = ${`${PREFIX}-quan-tri`}`) as any[];
    expect(nk.map((r) => r.detail.dinh_dang).sort()).toEqual(["pdf", "xlsx"]);
    expect(nk[0].detail.can_bo).toBe(acc.A1);
  });

  test("tổng quan: số cán bộ, bài thi, người cần chú ý theo phạm vi", async () => {
    const r = await goi(`/v1/bao-cao/tong-quan?don_vi=${dv.phong}`, tk.quanTri);
    expect(r.status).toBe(200);
    // 10 cán bộ và 1 cán bộ quản lý đội A; cả 11 được giao đề, 10 người đã nộp, 7 người đạt.
    expect(r.body).toMatchObject({
      don_vi: "Phòng thử GĐ7",
      so_can_bo: 11,
      hoc_7_ngay: 0,
      bai_thi: { duoc_giao: 11, da_nop: 10, dat: 7, ty_le_hoan_thanh: 90.9, ty_le_dat: 70 },
    });
    const { chua_hoc, chua_lam_bai, khong_dat } = r.body.can_chu_y;
    expect(chua_hoc.dong.map((d: any) => d.ho_ten)).toEqual(["Cán bộ quan-ly-a"]);
    expect(chua_lam_bai).toMatchObject({ tong: 1, dong: [{ ho_ten: "Cán bộ quan-ly-a", so: 1 }] });
    expect(khong_dat.tong).toBe(3);
    expect(khong_dat.dong.map((d: any) => d.ho_ten).sort()).toEqual(["Cán bộ A3", "Cán bộ B1", "Cán bộ C2"]);

    const a = await goi("/v1/bao-cao/tong-quan", tk.quanLyA);
    expect(a.body).toMatchObject({ don_vi: DOI[0].ten, so_can_bo: 5 });
    expect(a.body.can_chu_y.khong_dat.dong.map((d: any) => d.ho_ten)).toEqual(["Cán bộ A3"]);
    expect((await goi("/v1/bao-cao/tong-quan", tk.canBo)).status).toBe(403);
  });
});

describe("hiệu năng", () => {
  test("báo cáo trên 1.000 lượt thi trả về dưới 2 giây", async () => {
    const [de] = (await sql`
      INSERT INTO exams (title, matrix, question_count, duration_minutes, pass_score, status, published_at)
      VALUES (${`${PREFIX} Đề 1.000 lượt`}, '[]', 35, 45, ${PASS}, 'xuat_ban', now())
      RETURNING id`) as any[];
    const [bai] = (await sql`
      INSERT INTO exam_assignments (exam_id, unit_id, include_subunits, opens_at, due_at, assigned_by)
      VALUES (${de.id}, ${dv.phong!}, true, '2026-09-01', '2026-10-01', ${`${PREFIX}-seed`})
      RETURNING id`) as any[];
    // 1.000 lượt: mỗi người 100 lượt, mỗi lượt 35 câu trả lời.
    const ids = NGUOI.map((n) => acc[n]!);
    await sql`
      INSERT INTO exam_attempts (exam_id, assignment_id, account_id, attempt_no, items, started_at, deadline_at,
                                 submitted_at, submit_kind, correct, total, score, passed, status)
      SELECT ${de.id}, ${bai.id}, (${ids}::uuid[])[(i % 10) + 1], (i / 10) + 1, '[]',
             now() - interval '1 hour', now(), now() - interval '1 hour' + (i % 45) * interval '1 minute',
             'nguoi_thi', i % 36, 35, round((i % 36) * 100.0 / 35, 2), (i % 36) * 100.0 / 35 >= ${PASS}, 'da_nop'
      FROM generate_series(0, 999) i`;
    await sql`
      INSERT INTO exam_answers (attempt_id, ordinal, question_id, question_version, response, correct)
      SELECT t.id, o, (${cauHoi}::uuid[])[(o % 3) + 1], 1, '{}', (o + t.attempt_no) % 3 = 0
      FROM exam_attempts t, generate_series(1, 35) o
      WHERE t.exam_id = ${de.id}`;

    for (const duong of [
      `/v1/bao-cao/ket-qua-thi?de_thi=${de.id}`,
      `/v1/bao-cao/don-vi?de_thi=${de.id}&don_vi=${dv.phong}`,
      `/v1/bao-cao/cau-hoi-kho?de_thi=${de.id}`,
      `/v1/bao-cao/ket-qua-thi?de_thi=${de.id}&dinh_dang=xlsx`,
    ]) {
      const batDau = performance.now();
      const r = await goi(duong, tk.quanTri);
      const ms = performance.now() - batDau;
      expect(r.status).toBe(200);
      expect(ms).toBeLessThan(2000);
    }
    const r = await goi(`/v1/bao-cao/ket-qua-thi?de_thi=${de.id}`, tk.quanTri);
    expect(r.body.dong.length).toBe(10);
    expect(r.body.dong[0].so_lan).toBe(100);
  }, 30_000);
});

describe("xuất tệp", () => {
  test("Excel: đúng tiêu đề cột, đúng số dòng, số là kiểu số; có ghi nhật ký", async () => {
    const r = await goi(
      `/v1/bao-cao/ket-qua-thi?de_thi=${examId}&don_vi=${dv.phong}&dinh_dang=xlsx`,
      tk.quanTri,
    );
    expect(r.status).toBe(200);
    expect(r.ct).toContain("spreadsheetml");
    // docOExcelTho mở tệp bằng exceljs và giữ nguyên kiểu giá trị của từng ô.
    const [tieuDe, ...conLai] = await docOExcelTho(r.body as Uint8Array);
    expect(tieuDe).toEqual([
      "Hạng",
      "Họ tên",
      "Cấp bậc",
      "Đơn vị",
      "Điểm",
      "Kết quả",
      "Số câu đúng",
      "Tổng số câu",
      "Thời gian làm (phút)",
      "Số lần làm",
      "Nộp lúc",
    ]);
    // Dữ liệu dừng ở dòng trống đầu tiên; sau đó là phần ghi chú (tiêu đề, đơn vị, người xuất).
    const hetDuLieu = conLai.findIndex((d) => d.every((o) => o === null || o === undefined));
    const dong = hetDuLieu < 0 ? conLai : conLai.slice(0, hetDuLieu);
    expect(dong.length).toBe(10);
    for (const d of dong) {
      // Hạng, Điểm, Số câu đúng, Tổng số câu, Thời gian, Số lần (chỉ số cột từ 0).
      for (const cot of [0, 4, 6, 7, 8, 9]) expect(typeof d[cot]).toBe("number");
    }
    expect(conLai.flat()).toContain("Đơn vị: Phòng thử GĐ7");

    const [nk] = (await sql`
      SELECT detail FROM audit_log WHERE action = 'bao_cao.xuat' AND target = 'ket-qua-thi'
        AND actor = ${`${PREFIX}-quan-tri`} ORDER BY id DESC LIMIT 1`) as any[];
    expect(nk?.detail.dinh_dang).toBe("xlsx");
  });

  test("PDF: có trang, trích chữ còn đúng dấu tiếng Việt", async () => {
    const r = await goi(`/v1/bao-cao/don-vi?de_thi=${examId}&don_vi=${dv.phong}&dinh_dang=pdf`, tk.quanTri);
    expect(r.status).toBe(200);
    expect(r.ct).toBe("application/pdf");
    const doc = mupdf.Document.openDocument(r.body as Uint8Array, "application/pdf");
    expect(doc.countPages()).toBeGreaterThanOrEqual(1);
    const chu = doc.loadPage(0).toStructuredText().asText();
    expect(chu).toContain("Đội Cảnh sát giao thông");
    expect(chu).toContain("Tổng hợp theo đơn vị");
    expect(chu).toContain("Người xuất: Cán bộ quan-tri");
    expect(chu).toContain("Đơn vị: Phòng thử GĐ7");
  });

  test("PDF quản trị không lọc đơn vị vẫn xuất được", async () => {
    const r = await goi(`/v1/bao-cao/cau-hoi-kho?toi_thieu=1&dinh_dang=pdf`, tk.quanTri);
    expect(r.status).toBe(200);
    expect(
      mupdf.Document.openDocument(r.body as Uint8Array, "application/pdf").countPages(),
    ).toBeGreaterThanOrEqual(1);
  });
});
