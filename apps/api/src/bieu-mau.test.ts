/**
 * Trang "Quy trình, Biểu mẫu": tải biểu mẫu lên ở khu quản trị, vòng đời duyệt, tra chung với quy
 * trình theo từ khóa, loại tài liệu, phương tiện, loại vi phạm, xếp mục phổ biến (ghim trước, rồi
 * lượt mở), và trả tệp cho cán bộ.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { deleteObject, objectExists } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-bieu-mau";
const QT = "/v1/quan-tri/du-lieu-tra-cuu";
const E = encodeURIComponent;

const PDF = new TextEncoder().encode("%PDF-1.4\n% tệp mẫu để kiểm thử\n%%EOF\n");
// Tệp .docx là gói ZIP: bốn byte đầu "PK\x03\x04".
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

async function guiForm(
  path: string,
  token: string,
  truong: Record<string, string>,
  tep?: { ten: string; du: Uint8Array },
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(truong)) form.set(k, v);
  if (tep) form.set("tep", new File([tep.du as BlobPart], tep.ten));
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function taoTaiKhoan(ten: string, role: string): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function donDep() {
  const tep = await sql<Array<{ file_uri: string }>>`
    SELECT file_uri FROM form_templates WHERE code LIKE ${`${PREFIX}%`}`;
  for (const t of tep) await deleteObject(t.file_uri).catch(() => {});
  await sql`DELETE FROM form_templates WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM procedures WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`} OR actor LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

/** Chỉ xét các mục của test: CSDL test cũng có thể là CSDL phát triển. */
const cuaTest = (items: any[]) => items.filter((i) => String(i.ma).startsWith(PREFIX));
const traCuu = async (qs: string) => cuaTest((await goi("GET", `/v1/tra-cuu/tai-lieu?${qs}`)).body.items);

/** Tải lên rồi duyệt một tệp, trả mã. */
async function taoDaDuyet(duoi: string, truong: Record<string, string>) {
  const code = `${PREFIX}-${duoi}`;
  const r = await guiForm(
    `${QT}/bieu-mau`,
    quanLy,
    { code, kind: "huong_dan", gui_duyet: "1", ...truong },
    { ten: `${duoi}.pdf`, du: PDF },
  );
  expect(r.status).toBe(201);
  expect((await goi("POST", `${QT}/bieu-mau/${code}/duyet`, quanLy, {})).status).toBe(200);
  return code;
}

let canBo: string;
let quanLy: string;
let lanhDao: string;
const MA = `${PREFIX}-bien-ban`;
const MA_QT = `${PREFIX}-quy-trinh`;

beforeAll(async () => {
  delete process.env.TRA_CUU_NHANH_BAN_NHAP;
  await donDep();
  canBo = await taoTaiKhoan("can-bo", "can_bo");
  quanLy = await taoTaiKhoan("quan-ly", "quan_ly");
  lanhDao = await taoTaiKhoan("lanh-dao", "lanh_dao");
});

afterAll(donDep);

describe("tải biểu mẫu lên", () => {
  const truong = { code: MA, kind: "bieu_mau", title: `${PREFIX} Mẫu biên bản vi phạm hành chính` };

  test("cán bộ không tải lên được; chưa đăng nhập thì 401", async () => {
    const tep = { ten: "bien-ban.pdf", du: PDF };
    expect((await guiForm(`${QT}/bieu-mau`, canBo, truong, tep)).status).toBe(403);
    expect((await guiForm(`${QT}/bieu-mau`, "sai-token", truong, tep)).status).toBe(401);
  });

  test("thiếu tệp, đuôi lạ, hoặc nội dung không khớp đuôi thì 400", async () => {
    expect((await guiForm(`${QT}/bieu-mau`, quanLy, truong)).status).toBe(400);
    const exe = await guiForm(`${QT}/bieu-mau`, quanLy, truong, { ten: "ma-doc.exe", du: PDF });
    expect(exe.status).toBe(400);
    const gia = await guiForm(`${QT}/bieu-mau`, quanLy, truong, { ten: "anh.pdf", du: PNG });
    expect(gia.status).toBe(400);
    expect(gia.body.error.message).toContain("không phải định dạng .pdf");
    const [{ n }] = (await sql`SELECT count(*)::int n FROM form_templates WHERE code = ${MA}`) as any;
    expect(n).toBe(0);
  });

  test("Admin quản lý tải PDF lên và gửi duyệt: dòng vào chờ duyệt, tệp nằm trong kho", async () => {
    const r = await guiForm(
      `${QT}/bieu-mau`,
      quanLy,
      { ...truong, summary: "Lập khi phát hiện vi phạm", gui_duyet: "1" },
      { ten: "C:\\tai-lieu\\Mẫu biên bản VPHC.pdf", du: PDF },
    );
    expect(r.status).toBe(201);
    expect(r.body.trang_thai).toBe("cho_duyet");
    expect(r.body.file_name).toBe("Mẫu biên bản VPHC.pdf");
    expect(r.body.file_ext).toBe("pdf");
    expect(r.body.file_size).toBe(PDF.byteLength);
    expect(await objectExists(r.body.file_uri)).toBe(true);
  });

  test("mã đã có thì 409", async () => {
    const r = await guiForm(`${QT}/bieu-mau`, quanLy, truong, { ten: "khac.pdf", du: PDF });
    expect(r.status).toBe(409);
  });

  test("chưa duyệt: cán bộ không thấy và không lấy được tệp; người soạn xem được tệp", async () => {
    expect(await traCuu(`q=${E(PREFIX)}`)).toEqual([]);
    expect((await goi("GET", `/v1/tra-cuu/bieu-mau/${MA}`)).status).toBe(404);
    expect((await goi("GET", `/v1/tra-cuu/bieu-mau/${MA}/tep`)).status).toBe(404);

    expect((await goi("GET", `${QT}/bieu-mau/${MA}/tep`, canBo)).status).toBe(403);
    const res = await app.request(`http://test${QT}/bieu-mau/${MA}/tep`, {
      headers: { authorization: `Bearer ${quanLy}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});

describe("tra cứu sau khi duyệt", () => {
  test("Admin quản lý duyệt thì biểu mẫu hiện ra, không lộ đường dẫn kho", async () => {
    expect((await goi("POST", `${QT}/bieu-mau/${MA}/duyet`, lanhDao, {})).status).toBe(403);
    expect((await goi("POST", `${QT}/bieu-mau/${MA}/duyet`, quanLy, {})).status).toBe(200);

    const [m] = await traCuu(`q=${E(PREFIX)}`);
    expect(m.ma).toBe(MA);
    expect(m.loai).toBe("bieu_mau");
    expect(m.tep).toEqual({ ten: "Mẫu biên bản VPHC.pdf", duoi: "pdf", kichThuoc: PDF.byteLength });
    expect(m.soBuoc).toBeNull();
    expect(m.banNhap).toBe(false);
    expect(JSON.stringify(m)).not.toContain("bieu-mau/");
  });

  test("tìm không dấu, mọi từ đều phải khớp", async () => {
    expect((await traCuu(`q=${E("bien ban hanh chinh")}`)).map((i: any) => i.ma)).toEqual([MA]);
    expect(await traCuu(`q=${E(`${PREFIX} tai nạn`)}`)).toEqual([]);
  });

  test("tệp PDF mở trong trình duyệt, ?tai=1 thì tải về với tên lúc tải lên", async () => {
    const xem = await app.request(`http://test/v1/tra-cuu/bieu-mau/${MA}/tep`);
    expect(xem.status).toBe(200);
    expect(xem.headers.get("content-type")).toBe("application/pdf");
    expect(xem.headers.get("content-disposition")).toStartWith("inline;");
    expect(new Uint8Array(await xem.arrayBuffer())).toEqual(PDF);

    const tai = await app.request(`http://test/v1/tra-cuu/bieu-mau/${MA}/tep?tai=1`);
    const cd = tai.headers.get("content-disposition")!;
    expect(cd).toStartWith('attachment; filename="mau-bien-ban-vphc.pdf"');
    expect(cd).toContain(`filename*=UTF-8''${E("Mẫu biên bản VPHC.pdf")}`);
  });

  test("lọc theo loại tài liệu, phương tiện, loại vi phạm", async () => {
    const tao = await goi("POST", `${QT}/quy-trinh`, quanLy, {
      code: MA_QT,
      kind: "vi_pham",
      title: `${PREFIX} Xử lý xe mô tô quá tốc độ`,
      steps: [{ tieu_de: "Dừng xe", mo_ta: "Ra hiệu lệnh dừng phương tiện" }],
      vehicle: "mo_to",
      group_name: "Tốc độ",
      gui_duyet: true,
    });
    expect(tao.status).toBe(201);
    expect((await goi("POST", `${QT}/quy-trinh/${MA_QT}/duyet`, quanLy, {})).status).toBe(200);

    const ma = async (qs: string) => (await traCuu(`q=${E(PREFIX)}&${qs}`)).map((i: any) => i.ma).sort();
    expect(await ma("")).toEqual([MA, MA_QT]);
    expect(await ma("loai=quy_trinh")).toEqual([MA_QT]);
    expect(await ma("loai=bieu_mau")).toEqual([MA]);
    expect(await ma("loai=huong_dan")).toEqual([]);
    // Biểu mẫu không gắn phương tiện là mục dùng chung nên vẫn hiện khi lọc ô tô.
    expect(await ma("xe=o_to")).toEqual([MA]);
    expect(await ma("xe=mo_to")).toEqual([MA, MA_QT]);
    expect(await ma(`nhom=${E("Tốc độ")}`)).toEqual([MA_QT]);

    const [qt] = await traCuu(`q=${E(PREFIX)}&loai=quy_trinh`);
    expect(qt.soBuoc).toBe(1);
    expect(qt.tep).toBeNull();
    expect(qt.tenXe).toBe("Xe mô tô, xe gắn máy");

    expect((await goi("GET", "/v1/tra-cuu/tai-lieu?loai=khac")).status).toBe(400);
    expect((await goi("GET", `/v1/tra-cuu/tai-lieu?nhom=${E("Nhóm lạ")}`)).status).toBe(400);
  });
});

describe("phổ biến: ghim trước, rồi theo lượt mở", () => {
  test("mở trang chi tiết thì tăng lượt xem; ghim không đổi trạng thái duyệt", async () => {
    const a = await taoDaDuyet("a", { title: `${PREFIX} Hướng dẫn A` });
    const b = await taoDaDuyet("b", { title: `${PREFIX} Hướng dẫn B` });
    const thuTu = async () => (await traCuu("loai=huong_dan")).map((i: any) => i.ma);

    // Lượt xem ghi sau khi trả lời: đợi tới khi CSDL có đủ rồi mới so thứ tự.
    await goi("GET", `/v1/tra-cuu/bieu-mau/${b}`);
    await goi("GET", `/v1/tra-cuu/bieu-mau/${b}`);
    for (let i = 0; i < 50; i++) {
      const [r] = (await sql`SELECT view_count FROM form_templates WHERE code = ${b}`) as any;
      if (r.view_count >= 2) break;
      await Bun.sleep(20);
    }
    expect((await goi("GET", `/v1/tra-cuu/bieu-mau/${b}`)).body.luotXem).toBe(2);
    expect(await thuTu()).toEqual([b, a]);

    expect((await goi("PUT", `${QT}/bieu-mau/${a}/phan-loai`, canBo, { pinned: true })).status).toBe(403);
    const ghim = await goi("PUT", `${QT}/bieu-mau/${a}/phan-loai`, quanLy, {
      vehicle: "o_to",
      group_name: "Giấy tờ",
      pinned: true,
    });
    expect(ghim.status).toBe(200);
    expect(ghim.body.trang_thai).toBe("da_duyet");
    expect(ghim.body.version).toBe(1);
    expect(ghim.body.pinned).toBe(true);
    expect(await thuTu()).toEqual([a, b]);
    expect((await traCuu(`loai=huong_dan&nhom=${E("Giấy tờ")}`)).map((i: any) => i.ma)).toEqual([a]);

    // Loại không có phân loại thì từ chối.
    expect((await goi("PUT", `${QT}/muc-phat/khong-co/phan-loai`, quanLy, {})).status).toBe(400);
  });

  test("mở quy trình cũng tăng lượt xem", async () => {
    await goi("GET", `/v1/tra-cuu/quy-trinh/${MA_QT}`);
    let n = 0;
    for (let i = 0; i < 50 && n < 1; i++) {
      const [r] = (await sql`SELECT view_count FROM procedures WHERE code = ${MA_QT}`) as any;
      n = r.view_count;
      if (n < 1) await Bun.sleep(20);
    }
    expect(n).toBe(1);
  });
});

describe("sửa và thay tệp", () => {
  test("thay tệp của biểu mẫu đã duyệt: về chờ duyệt, tăng phiên bản, gỡ tệp cũ khỏi kho", async () => {
    const cu = (await goi("GET", `${QT}/bieu-mau/${MA}`, quanLy)).body;
    const lech = await guiForm(
      `${QT}/bieu-mau/${MA}/tep`,
      quanLy,
      { version: String(cu.version + 1) },
      { ten: "moi.docx", du: DOCX },
    );
    expect(lech.status).toBe(409);

    const r = await guiForm(
      `${QT}/bieu-mau/${MA}/tep`,
      quanLy,
      { version: String(cu.version) },
      { ten: "Mẫu biên bản (sửa).docx", du: DOCX },
    );
    expect(r.status).toBe(200);
    expect(r.body.trang_thai).toBe("cho_duyet");
    expect(r.body.version).toBe(cu.version + 1);
    expect(r.body.file_ext).toBe("docx");
    expect(await objectExists(cu.file_uri)).toBe(false);
    expect(await objectExists(r.body.file_uri)).toBe(true);
    expect((await goi("GET", `/v1/tra-cuu/bieu-mau/${MA}/tep`)).status).toBe(404);

    // Duyệt lại: tệp Word luôn tải về, không mở trong trình duyệt.
    expect((await goi("POST", `${QT}/bieu-mau/${MA}/duyet`, quanLy, {})).status).toBe(200);
    const tep = await app.request(`http://test/v1/tra-cuu/bieu-mau/${MA}/tep`);
    expect(tep.headers.get("content-disposition")).toStartWith("attachment;");
  });

  test("sửa tên, loại của biểu mẫu đã duyệt cũng đưa về chờ duyệt", async () => {
    const cu = (await goi("GET", `${QT}/bieu-mau/${MA}`, quanLy)).body;
    const r = await goi("PUT", `${QT}/bieu-mau/${MA}`, quanLy, {
      version: cu.version,
      title: `${PREFIX} Mẫu biên bản đã đổi tên`,
      kind: "huong_dan",
    });
    expect(r.status).toBe(200);
    expect(r.body.trang_thai).toBe("cho_duyet");
    expect(r.body.kind).toBe("huong_dan");
    expect(r.body.lich_su ?? null).toBeNull();
    const ct = (await goi("GET", `${QT}/bieu-mau/${MA}`, quanLy)).body;
    expect(ct.lich_su.map((h: any) => h.action)).toEqual(
      expect.arrayContaining(["tao", "gui_duyet", "duyet", "thay_tep", "sua"]),
    );
  });
});
