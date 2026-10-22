/**
 * Kiểm thử API ngân hàng câu hỏi (docs/PLAN.md GĐ3) trên Postgres test thật. Chỉ tạo và xóa
 * dữ liệu mang tiền tố riêng, nên chạy song song với dữ liệu seed không ảnh hưởng nhau.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession, type Role } from "@qdpl/auth";
import { COT_EXCEL_CAU_HOI } from "@qdpl/dao-tao";
import { sql, taoTepCauHoi } from "@qdpl/db";
import { deleteObject } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();

const PREFIX = "test-qdpl-ngan-hang";
const CHU_DE = `${PREFIX}-toc-do`;
const BASE = "/v1/quan-tri/ngan-hang";

async function taoTaiKhoan(ten: string, role: Role): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function goi(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; raw?: Uint8Array } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.raw) {
    headers["content-type"] = "application/octet-stream";
    body = opts.raw as BodyInit;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await app.request(`http://test${path}`, { method, headers, body });
  const ct = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: ct.includes("json") ? await res.json() : new Uint8Array(await res.arrayBuffer()),
    headers: res.headers,
  };
}

async function donDep() {
  await sql`DELETE FROM questions WHERE topic_id IN (SELECT id FROM question_topics WHERE code LIKE ${`${PREFIX}%`})`;
  await sql`DELETE FROM questions WHERE created_by LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM question_topics WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

const tk = { khach: "", canBo: "", quanLy: "", lanhDao: "" };

/** Dòng Excel hợp lệ thứ i, xoay vòng qua ba loại câu. */
function dongHopLe(i: number): Record<string, string> {
  const chung = { chu_de: CHU_DE, muc_do: ["Dễ", "Trung bình", "Khó"][i % 3]!, giai_thich: "Giải thích." };
  if (i % 3 === 0) {
    return { ...chung, loai: "Một đáp án", cau_hoi: `${PREFIX} câu ${i}?`, A: "Có", B: "Không", dap_an: "A" };
  }
  if (i % 3 === 1) return { ...chung, loai: "Đúng/sai", cau_hoi: `${PREFIX} câu ${i}.`, dap_an: "Sai" };
  return {
    ...chung,
    loai: "Điền chỗ trống",
    cau_hoi: `${PREFIX} câu ${i}: ___ km/h`,
    dap_an: "50 | năm mươi",
  };
}

/** 50 dòng, trong đó dòng dữ liệu thứ 5, 20, 41 lỗi (mỗi dòng một kiểu lỗi). */
function tepNamMuoiCau(): Array<Record<string, string>> {
  const dong = Array.from({ length: 50 }, (_, i) => dongHopLe(i));
  dong[5] = { ...dong[5]!, muc_do: "Rất khó" };
  dong[20] = { ...dong[20]!, chu_de: `${PREFIX}-khong-co` };
  dong[41] = { ...dong[41]!, loai: "Một đáp án", A: "Có", B: "Không", dap_an: "E" };
  return dong;
}

async function demDaDuyetCuaChuDe(): Promise<number> {
  const [r] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM questions q JOIN question_topics t ON t.id = q.topic_id
    WHERE t.code = ${CHU_DE} AND q.status = 'da_duyet'`;
  return r?.n ?? 0;
}

beforeAll(async () => {
  await donDep();
  tk.khach = await taoTaiKhoan("khach", "khach");
  tk.canBo = await taoTaiKhoan("can-bo", "can_bo");
  tk.quanLy = await taoTaiKhoan("quan-ly", "quan_ly");
  tk.lanhDao = await taoTaiKhoan("lanh-dao", "lanh_dao");
});

afterAll(async () => {
  await donDep();
});

describe("phân quyền", () => {
  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("GET", `${BASE}/cau-hoi`)).status).toBe(401);
  });

  test("cán bộ và khách gọi API quản trị ngân hàng nhận 403", async () => {
    for (const token of [tk.canBo, tk.khach]) {
      expect((await goi("GET", `${BASE}/cau-hoi`, { token })).status).toBe(403);
      expect((await goi("GET", `${BASE}/mau`, { token })).status).toBe(403);
      expect((await goi("POST", `${BASE}/nhap`, { token, raw: new Uint8Array([1]) })).status).toBe(403);
    }
  });
});

describe("chủ đề và tạo câu", () => {
  test("Admin quản lý tạo chủ đề", async () => {
    const r = await goi("POST", `${BASE}/chu-de`, {
      token: tk.quanLy,
      body: { code: CHU_DE, name: "Tốc độ (test)" },
    });
    expect(r.status).toBe(201);
    expect(r.body.code).toBe(CHU_DE);
  });

  test("câu không hợp lệ bị từ chối kèm danh sách lỗi", async () => {
    const r = await goi("POST", `${BASE}/cau-hoi`, {
      token: tk.quanLy,
      body: {
        topic_code: CHU_DE,
        level: "de",
        kind: "mot_dap_an",
        stem: "Thiếu đáp án?",
        options: {
          phuong_an: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
          ],
        },
        answer: { dung: [] },
        explanation: "x",
      },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.details).toContain("Câu một đáp án phải có đúng một đáp án đúng");
  });
});

describe("nhập Excel", () => {
  let tep: Uint8Array;
  beforeAll(async () => {
    tep = await taoTepCauHoi(COT_EXCEL_CAU_HOI, tepNamMuoiCau());
  });

  test("chạy thử báo 47 câu hợp lệ, 3 lỗi có số dòng, và không ghi gì", async () => {
    const r = await goi("POST", `${BASE}/nhap?chay_thu=1`, { token: tk.quanLy, raw: tep });
    expect(r.status).toBe(200);
    expect(r.body.tong_dong).toBe(50);
    expect(r.body.hop_le).toBe(47);
    expect(r.body.da_tao).toBe(0);
    // Dòng 1 là tiêu đề, nên dòng dữ liệu thứ i (đếm từ 0) nằm ở dòng i + 2.
    expect(r.body.loi.map((l: { dong: number }) => l.dong)).toEqual([7, 22, 43]);
    expect(r.body.chu_de_moi).toEqual([{ ma: `${PREFIX}-khong-co`, ten: `${PREFIX}-khong-co`, so_cau: 1 }]);
    const [dem] = await sql<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM questions q JOIN question_topics t ON t.id = q.topic_id WHERE t.code = ${CHU_DE}`;
    expect(dem!.n).toBe(0);
  });

  test("nhập thật tạo 47 câu ở trạng thái chờ duyệt, nguồn nhập Excel", async () => {
    const r = await goi("POST", `${BASE}/nhap`, { token: tk.quanLy, raw: tep });
    expect(r.status).toBe(200);
    expect(r.body.da_tao).toBe(47);
    const ds = await goi("GET", `${BASE}/cau-hoi?chu_de=${CHU_DE}&trang_thai=cho_duyet&co=200`, {
      token: tk.quanLy,
    });
    expect(ds.body.tong).toBe(47);
    expect(ds.body.items.every((q: { source: string }) => q.source === "nhap_excel")).toBe(true);
  });

  test("tệp không phải Excel bị từ chối rõ ràng", async () => {
    const r = await goi("POST", `${BASE}/nhap`, { token: tk.quanLy, raw: new TextEncoder().encode("abc") });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("Không đọc được tệp");
  });

  test("tải tệp mẫu và xuất Excel được", async () => {
    const mau = await goi("GET", `${BASE}/mau`, { token: tk.quanLy });
    expect(mau.status).toBe(200);
    expect(mau.headers.get("content-disposition")).toContain("mau-nhap-cau-hoi.xlsx");
    const xuat = await goi("GET", `${BASE}/xuat?chu_de=${CHU_DE}`, { token: tk.quanLy });
    expect(xuat.status).toBe(200);
    // Nhập lại tệp vừa xuất: mọi dòng đều báo trùng mã, chứng tỏ đọc lại được đủ 47 câu.
    const lai = await goi("POST", `${BASE}/nhap?chay_thu=1`, { token: tk.quanLy, raw: xuat.body });
    expect(lai.body.tong_dong).toBe(47);
    expect(
      lai.body.loi.every((l: { loi: string[] }) => l.loi.some((x) => x.includes("đã có trong ngân hàng"))),
    ).toBe(true);
  });

  test("tao_chu_de: chạy thử tính dòng chủ đề mới là hợp lệ nhưng chưa tạo chủ đề", async () => {
    const r = await goi("POST", `${BASE}/nhap?chay_thu=1&tao_chu_de=1`, { token: tk.quanLy, raw: tep });
    expect(r.body.hop_le).toBe(48);
    expect(r.body.loi.map((l: { dong: number }) => l.dong)).toEqual([7, 43]);
    expect(r.body.chu_de_moi.map((t: { ma: string }) => t.ma)).toEqual([`${PREFIX}-khong-co`]);
    expect(await sql`SELECT 1 FROM question_topics WHERE code = ${`${PREFIX}-khong-co`}`).toHaveLength(0);
  });

  test("tao_chu_de: nhập thật tạo chủ đề theo cột Tên chủ đề, bỏ mã sai dạng và dòng lỗi", async () => {
    const ma = `${PREFIX}-moi`;
    const tepMoi = await taoTepCauHoi(COT_EXCEL_CAU_HOI, [
      { ...dongHopLe(100), chu_de: ma, ten_chu_de: "Chủ đề mới (test)" },
      { ...dongHopLe(101), chu_de: ma },
      { ...dongHopLe(102), chu_de: "Mã Sai Dạng" },
      // Dòng lỗi mức độ: không được kéo theo việc tạo chủ đề riêng của nó.
      { ...dongHopLe(103), chu_de: `${PREFIX}-chi-dong-loi`, muc_do: "Rất khó" },
    ]);
    const r = await goi("POST", `${BASE}/nhap?tao_chu_de=1`, { token: tk.quanLy, raw: tepMoi });
    expect(r.status).toBe(200);
    expect(r.body.da_tao).toBe(2);
    expect(r.body.chu_de_moi).toEqual([{ ma, ten: "Chủ đề mới (test)", so_cau: 2 }]);
    expect(r.body.loi.map((l: { dong: number }) => l.dong)).toEqual([4, 5]);
    const chuDe = await sql<Array<{ code: string; name: string }>>`
      SELECT code, name FROM question_topics WHERE code LIKE ${`${PREFIX}-%`} AND code <> ${CHU_DE}`;
    expect(chuDe.map((t) => ({ ...t }))).toEqual([{ code: ma, name: "Chủ đề mới (test)" }]);
    const ds = await goi("GET", `${BASE}/cau-hoi?chu_de=${ma}&trang_thai=cho_duyet`, { token: tk.quanLy });
    expect(ds.body.tong).toBe(2);
  });
});

describe("duyệt", () => {
  let choDuyet: string[] = [];

  beforeAll(async () => {
    const ds = await goi("GET", `${BASE}/cau-hoi?chu_de=${CHU_DE}&trang_thai=cho_duyet&co=200`, {
      token: tk.quanLy,
    });
    choDuyet = ds.body.items.map((q: { id: string }) => q.id);
  });

  test("cán bộ và lãnh đạo UBND xã đều không duyệt được (403)", async () => {
    expect((await goi("POST", `${BASE}/cau-hoi/${choDuyet[0]}/duyet`, { token: tk.canBo })).status).toBe(
      403,
    );
    const hl = await goi("POST", `${BASE}/duyet-hang-loat`, {
      token: tk.canBo,
      body: { ids: choDuyet.slice(0, 2) },
    });
    expect(hl.status).toBe(403);
    expect((await goi("POST", `${BASE}/cau-hoi/${choDuyet[0]}/duyet`, { token: tk.lanhDao })).status).toBe(
      403,
    );
  });

  test("duyệt hàng loạt 10 câu thì bộ đếm đã duyệt tăng 10", async () => {
    const truoc = await goi("GET", `${BASE}/cau-hoi`, { token: tk.quanLy });
    const r = await goi("POST", `${BASE}/duyet-hang-loat`, {
      token: tk.quanLy,
      body: { ids: choDuyet.slice(0, 10) },
    });
    expect(r.status).toBe(200);
    expect(r.body.da_duyet).toBe(10);
    const sau = await goi("GET", `${BASE}/cau-hoi`, { token: tk.quanLy });
    expect(sau.body.dem.da_duyet - truoc.body.dem.da_duyet).toBe(10);
    expect(sau.body.muc_tieu).toBe(1000);
    expect(await demDaDuyetCuaChuDe()).toBe(10);
  });

  test("duyệt lại câu đã duyệt bị bỏ qua, không đếm hai lần", async () => {
    const r = await goi("POST", `${BASE}/duyet-hang-loat`, {
      token: tk.quanLy,
      body: { ids: choDuyet.slice(0, 11) },
    });
    expect(r.body.da_duyet).toBe(1);
    expect(r.body.bo_qua).toHaveLength(10);
    expect((await goi("POST", `${BASE}/cau-hoi/${choDuyet[0]}/duyet`, { token: tk.quanLy })).status).toBe(
      409,
    );
  });

  test("câu có cảnh báo trùng: duyệt hàng loạt bỏ qua, duyệt từng câu phải xác nhận rồi gỡ cảnh báo", async () => {
    const [id, goc] = [choDuyet[30]!, choDuyet[31]!];
    await sql`UPDATE questions SET duplicate_of = ${goc} WHERE id = ${id}`;
    const hl = await goi("POST", `${BASE}/duyet-hang-loat`, { token: tk.quanLy, body: { ids: [id] } });
    expect(hl.body).toEqual({ da_duyet: 0, bo_qua: [], canh_bao_trung: [id] });
    expect((await goi("POST", `${BASE}/cau-hoi/${id}/duyet`, { token: tk.quanLy })).status).toBe(409);
    const r = await goi("POST", `${BASE}/cau-hoi/${id}/duyet`, {
      token: tk.quanLy,
      body: { xac_nhan_trung: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("da_duyet");
    expect(r.body.duplicate_of).toBeNull();
  });

  test("từ chối phải có lý do; câu bị từ chối gửi duyệt lại được", async () => {
    const id = choDuyet[20]!;
    expect((await goi("POST", `${BASE}/cau-hoi/${id}/tu-choi`, { token: tk.quanLy, body: {} })).status).toBe(
      400,
    );
    const r = await goi("POST", `${BASE}/cau-hoi/${id}/tu-choi`, {
      token: tk.quanLy,
      body: { ly_do: "Đáp án chưa khớp căn cứ" },
    });
    expect(r.body.status).toBe("tu_choi");
    expect(r.body.reject_reason).toBe("Đáp án chưa khớp căn cứ");
    const lai = await goi("POST", `${BASE}/cau-hoi/${id}/gui-duyet`, { token: tk.quanLy });
    expect(lai.body.status).toBe("cho_duyet");
    expect(lai.body.reject_reason).toBeNull();
  });

  test("sửa một câu đã duyệt thì câu về chờ duyệt và version = 2", async () => {
    const id = choDuyet[0]!;
    const cu = await goi("GET", `${BASE}/cau-hoi/${id}`, { token: tk.quanLy });
    expect(cu.body.status).toBe("da_duyet");
    expect(cu.body.de.kind).toBe(cu.body.kind);
    expect(JSON.stringify(cu.body.de)).not.toContain("answer");

    const r = await goi("PUT", `${BASE}/cau-hoi/${id}`, {
      token: tk.quanLy,
      body: {
        version: cu.body.version,
        topic_code: CHU_DE,
        level: cu.body.level,
        kind: cu.body.kind,
        stem: `${cu.body.stem} (đã sửa)`,
        options: cu.body.options,
        answer: cu.body.answer,
        explanation: cu.body.explanation,
        citations: cu.body.citations,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("cho_duyet");
    expect(r.body.version).toBe(2);
    expect(r.body.approved_by).toBeNull();

    // Gửi lại version cũ: đã có người sửa trước, trả 409 chứ không ghi đè.
    const cuQua = await goi("PUT", `${BASE}/cau-hoi/${id}`, {
      token: tk.quanLy,
      body: { ...cu.body, version: 1, topic_code: CHU_DE },
    });
    expect(cuQua.status).toBe(409);

    const ls = await goi("GET", `${BASE}/cau-hoi/${id}`, { token: tk.quanLy });
    expect(ls.body.lich_su.map((x: { action: string }) => x.action)).toEqual(["sua", "duyet", "nhap_excel"]);
  });

  test("chấm thử trả đúng/sai kèm đáp án cho màn hình xem trước", async () => {
    const id = choDuyet[3]!; // dòng 3 là câu một đáp án, đáp án A
    const dung = await goi("POST", `${BASE}/cau-hoi/${id}/cham`, {
      token: tk.quanLy,
      body: { chon: ["a"] },
    });
    expect(dung.body.dung).toBe(true);
    const sai = await goi("POST", `${BASE}/cau-hoi/${id}/cham`, { token: tk.quanLy, body: { chon: ["b"] } });
    expect(sai.body.dung).toBe(false);
    expect(sai.body.dap_an.dung).toEqual(["a"]);
  });

  test("lưu trữ câu đã duyệt; câu lưu trữ không sửa được", async () => {
    const id = choDuyet[5]!;
    await goi("POST", `${BASE}/cau-hoi/${id}/duyet`, { token: tk.quanLy });
    const r = await goi("POST", `${BASE}/cau-hoi/${id}/luu-tru`, { token: tk.quanLy });
    expect(r.body.status).toBe("luu_tru");
    const cu = await goi("GET", `${BASE}/cau-hoi/${id}`, { token: tk.quanLy });
    const sua = await goi("PUT", `${BASE}/cau-hoi/${id}`, {
      token: tk.quanLy,
      body: { ...cu.body, topic_code: CHU_DE },
    });
    expect(sua.status).toBe(409);
  });
});

describe("ảnh minh họa", () => {
  const cau = (image_uri: string) => ({
    topic_code: CHU_DE,
    level: "de",
    kind: "dung_sai",
    stem: `${PREFIX} biển trong hình là biển cấm.`,
    answer: { dung: ["dung"] },
    explanation: "x",
    image_uris: [image_uri],
  });

  test("tải ảnh lên, lưu câu kèm ảnh, đề gửi người học có ảnh", async () => {
    const form = new FormData();
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
    form.set("tep", new File([PNG as BlobPart], "bien.png"));
    const res = await app.request(`http://test${BASE}/cau-hoi/anh`, {
      method: "POST",
      headers: { authorization: `Bearer ${tk.quanLy}` },
      body: form,
    });
    expect(res.status).toBe(201);
    const { image_uri } = (await res.json()) as { image_uri: string };
    expect(image_uri).toMatch(/^assets\/bien-bao\/cau-hoi-[0-9a-f]{16}\.png$/);
    try {
      const tao = await goi("POST", `${BASE}/cau-hoi`, { token: tk.quanLy, body: cau(image_uri) });
      expect(tao.status).toBe(201);
      const ct = await goi("GET", `${BASE}/cau-hoi/${tao.body.id}`, { token: tk.quanLy });
      expect(ct.body.image_uris).toEqual([image_uri]);
      expect(ct.body.de.image_uris).toEqual([image_uri]);
    } finally {
      await deleteObject(image_uri);
    }
  });

  test("ảnh không nằm trong kho ảnh bị từ chối", async () => {
    const r = await goi("POST", `${BASE}/cau-hoi`, {
      token: tk.quanLy,
      body: cau("https://vidu.vn/bien.png"),
    });
    expect(r.status).toBe(400);
  });
});

describe("phương án là hình", () => {
  const cau = (kind: string, phuongAn: unknown[], answer: unknown) => ({
    topic_code: CHU_DE,
    level: "de",
    kind,
    stem: `${PREFIX} biển nào là biển cấm?`,
    options: { phuong_an: phuongAn },
    answer,
    explanation: "x",
  });
  const hinh = (id: string, ma: string) => ({ id, text: "", image_uri: `assets/bien-bao/${ma}.svg` });

  test("câu một đáp án nhận phương án chỉ có hình; đề gửi người học giữ hình", async () => {
    const tao = await goi("POST", `${BASE}/cau-hoi`, {
      token: tk.quanLy,
      body: cau("mot_dap_an", [hinh("a", "P.102"), hinh("b", "W.201a")], { dung: ["a"] }),
    });
    expect(tao.status).toBe(201);
    const ct = await goi("GET", `${BASE}/cau-hoi/${tao.body.id}`, { token: tk.quanLy });
    expect(ct.body.de.options.phuong_an).toEqual([
      { id: "a", text: "", image_uri: "assets/bien-bao/P.102.svg" },
      { id: "b", text: "", image_uri: "assets/bien-bao/W.201a.svg" },
    ]);
  });

  test("phương án không chữ không hình, và bước sắp xếp chỉ có hình, bị từ chối", async () => {
    const trong = await goi("POST", `${BASE}/cau-hoi`, {
      token: tk.quanLy,
      body: cau("mot_dap_an", [hinh("a", "P.102"), { id: "b", text: "" }], { dung: ["a"] }),
    });
    expect(trong.status).toBe(400);
    expect(trong.body.error.details).toContain("phương án thứ 2 chưa có nội dung");
    const sapXep = await goi("POST", `${BASE}/cau-hoi`, {
      token: tk.quanLy,
      body: cau("sap_xep", [hinh("a", "P.102"), hinh("b", "W.201a")], { thu_tu: ["a", "b"] }),
    });
    expect(sapXep.status).toBe(400);
  });
});
