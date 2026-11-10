/**
 * Đơn vị, người dùng, đăng nhập mật khẩu và nhật ký truy cập qua API (docs/PLAN.md GĐ2,
 * mục "Kiểm tra đã xong"). Chạy trên Postgres test thật; mọi dữ liệu mang tiền tố riêng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { bamMatKhau, createSession, principalFromToken } from "@qdpl/auth";
import { layDonViTheoMa, sql, suaDonVi, taoDonVi, taoTepExcel } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-gd2";

async function goi(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; form?: FormData } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await app.request(`http://test${path}`, { method, headers, body });
  const ct = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: ct.includes("json") ? await res.json() : await res.arrayBuffer(),
    headers: res.headers,
  };
}

async function donDep() {
  const ids = (await sql`SELECT id FROM accounts WHERE username LIKE ${`${PREFIX}%`}`) as any[];
  const dsId = ids.map((r) => r.id);
  await sql`DELETE FROM access_log WHERE account_id = ANY(${dsId}::uuid[])`;
  await sql`DELETE FROM login_attempts WHERE username LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM audit_log WHERE actor LIKE ${`${PREFIX}%`} OR target LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE username LIKE ${`${PREFIX}%`}`;
  // Xóa đơn vị con trước đơn vị cha (khóa ngoại parent_id là RESTRICT).
  await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) >= 3`;
  await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`} AND nlevel(path) = 2`;
  await sql`DELETE FROM units WHERE code LIKE ${`${PREFIX}%`}`;
}

const donVi: Record<"phong" | "doiA" | "doiB", string> = { phong: "", doiA: "", doiB: "" };
const tk: Record<"quanTri" | "quanLyA", string> = { quanTri: "", quanLyA: "" };

async function taoTaiKhoan(ten: string, role: string, unitId: string | null): Promise<string> {
  const [row] = (await sql`
    INSERT INTO accounts (username, name, role, unit_id, password_hash)
    VALUES (${`${PREFIX}-${ten}`}, ${ten}, ${role}, ${unitId}, ${await bamMatKhau("KhongDung123")})
    RETURNING id`) as any[];
  return (await createSession(row.id, "test")).token;
}

beforeAll(async () => {
  await donDep();
  const actor = `${PREFIX}-seed`;
  donVi.phong = (
    await taoDonVi({ code: `${PREFIX}-PHONG`, name: "Phòng thử", levelLabel: "Phòng" }, actor)
  ).id;
  donVi.doiA = (
    await taoDonVi({ code: `${PREFIX}-DOI-A`, name: "Đội A thử", parentId: donVi.phong }, actor)
  ).id;
  donVi.doiB = (
    await taoDonVi({ code: `${PREFIX}-DOI-B`, name: "Đội B thử", parentId: donVi.phong }, actor)
  ).id;
  tk.quanTri = await taoTaiKhoan("quan-tri", "quan_tri", null);
  tk.quanLyA = await taoTaiKhoan("quan-ly-a", "lanh_dao", donVi.doiA);
  await taoTaiKhoan("can-bo-b", "can_bo", donVi.doiB);
});

afterAll(donDep);

/** Tệp 10 dòng: 8 dòng hợp lệ, dòng 5 thiếu mã đơn vị, dòng 9 trùng tên đăng nhập với dòng 2. */
async function tepMuoiDong(): Promise<File> {
  const dong = Array.from({ length: 10 }, (_, i) => ({
    hoTen: `Cán bộ số ${i + 1}`,
    tenDangNhap: `${PREFIX}-nhap-${i + 1}`,
    maDonVi: i % 2 === 0 ? `${PREFIX}-DOI-A` : `${PREFIX}-DOI-B`,
    vaiTro: i === 0 ? "Lãnh đạo UBND xã" : "Cán bộ",
    capBac: "Thiếu úy",
    email: "",
  }));
  dong[3]!.maDonVi = ""; // dòng Excel số 5
  dong[7]!.tenDangNhap = `${PREFIX}-nhap-1`; // dòng Excel số 9, trùng dòng 2
  const tep = await taoTepExcel([
    {
      ten: "Người dùng",
      cot: [
        { tieuDe: "Họ và tên", khoa: "hoTen" },
        { tieuDe: "Tên đăng nhập", khoa: "tenDangNhap" },
        { tieuDe: "Mã đơn vị", khoa: "maDonVi" },
        { tieuDe: "Vai trò", khoa: "vaiTro" },
        { tieuDe: "Cấp bậc, chức vụ", khoa: "capBac" },
        { tieuDe: "Email", khoa: "email" },
      ],
      dong,
    },
  ]);
  return new File([tep as Uint8Array<ArrayBuffer>], "nguoi-dung.xlsx");
}

function formNhap(tep: File, chayThu: boolean): FormData {
  const f = new FormData();
  f.set("tep", tep);
  if (chayThu) f.set("chay_thu", "1");
  return f;
}

const demTaiKhoanNhap = async () =>
  Number(
    (
      (await sql`SELECT count(*)::int AS n FROM accounts WHERE username LIKE ${`${PREFIX}-nhap-%`}`) as any[]
    )[0].n,
  );

describe("nhập người dùng từ Excel", () => {
  test("chỉ quản trị được nhập; quản lý nhận 403", async () => {
    const r = await goi("POST", "/v1/quan-tri/nguoi-dung/nhap", {
      token: tk.quanLyA,
      form: formNhap(await tepMuoiDong(), true),
    });
    expect(r.status).toBe(403);
  });

  test("chạy thử: báo 8 dòng hợp lệ, 2 lỗi có số dòng, không ghi gì vào CSDL", async () => {
    const truoc = await demTaiKhoanNhap();
    const r = await goi("POST", "/v1/quan-tri/nguoi-dung/nhap", {
      token: tk.quanTri,
      form: formNhap(await tepMuoiDong(), true),
    });
    expect(r.status).toBe(200);
    expect(r.body.chayThu).toBe(true);
    expect(r.body.tongDong).toBe(10);
    expect(r.body.taoMoi).toHaveLength(8);
    expect(r.body.loi.map((l: any) => l.dong)).toEqual([5, 9]);
    expect(r.body.loi[0].loi).toContain("mã đơn vị");
    expect(r.body.loi[1].loi).toContain("trùng");
    expect(r.body.taoMoi.every((t: any) => t.matKhauTam === undefined)).toBe(true);
    expect(await demTaiKhoanNhap()).toBe(truoc);
  });

  test("chạy thật: tạo đúng 8 tài khoản, mỗi người một mật khẩu tạm, bắt đổi mật khẩu", async () => {
    const r = await goi("POST", "/v1/quan-tri/nguoi-dung/nhap", {
      token: tk.quanTri,
      form: formNhap(await tepMuoiDong(), false),
    });
    expect(r.status).toBe(200);
    expect(r.body.taoMoi).toHaveLength(8);
    expect(r.body.loi).toHaveLength(2);
    expect(await demTaiKhoanNhap()).toBe(8);
    const matKhau = r.body.taoMoi.map((t: any) => t.matKhauTam);
    expect(new Set(matKhau).size).toBe(8);
    const rows = (await sql`
      SELECT username, role, must_change_password, password_hash FROM accounts
      WHERE username LIKE ${`${PREFIX}-nhap-%`}`) as any[];
    expect(rows.every((x) => x.must_change_password)).toBe(true);
    expect(rows.every((x) => String(x.password_hash).startsWith("$argon2id$"))).toBe(true);
    expect(rows.find((x) => x.username === `${PREFIX}-nhap-1`).role).toBe("lanh_dao");
    // Lưu mật khẩu tạm của người đầu tiên cho luồng đăng nhập bên dưới.
    matKhauNhap = r.body.taoMoi.find((t: any) => t.username === `${PREFIX}-nhap-3`).matKhauTam;
  });

  test("tải tệp mẫu: đúng định dạng xlsx", async () => {
    const r = await goi("GET", "/v1/quan-tri/nguoi-dung/mau", { token: tk.quanTri });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    // Tệp xlsx là tệp zip: bắt đầu bằng "PK".
    expect(new TextDecoder().decode(new Uint8Array(r.body).slice(0, 2))).toBe("PK");
  });
});

let matKhauNhap = "";

describe("đăng nhập tài khoản vừa nhập", () => {
  let token = "";

  test("đăng nhập được, nhận cờ phải đổi mật khẩu", async () => {
    const r = await goi("POST", "/v1/auth/mat-khau", {
      body: { ten_dang_nhap: `${PREFIX}-nhap-3`, mat_khau: matKhauNhap },
    });
    expect(r.status).toBe(200);
    expect(r.body.phai_doi_mat_khau).toBe(true);
    token = r.body.token;
  });

  test("chưa đổi mật khẩu thì endpoint cần đăng nhập trả 403 phai_doi_mat_khau", async () => {
    const r = await goi("GET", `/v1/dao-tao/ghi-danh/00000000-0000-4000-8000-000000000000/tien-do`, {
      token,
    });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("phai_doi_mat_khau");
    const me = await goi("GET", "/v1/auth/me", { token });
    expect(me.body.phai_doi_mat_khau).toBe(true);
    expect(me.body.don_vi.ma).toBe(`${PREFIX}-DOI-A`);
  });

  test("đổi mật khẩu xong thì hết bị chặn", async () => {
    const sai = await goi("POST", "/v1/auth/doi-mat-khau", {
      token,
      body: { mat_khau_cu: "khong-dung-1", mat_khau_moi: "MatKhauMoi2026" },
    });
    expect(sai.status).toBe(400);
    const r = await goi("POST", "/v1/auth/doi-mat-khau", {
      token,
      body: { mat_khau_cu: matKhauNhap, mat_khau_moi: "MatKhauMoi2026" },
    });
    expect(r.status).toBe(200);
    const me = await goi("GET", "/v1/auth/me", { token });
    expect(me.body.phai_doi_mat_khau).toBe(false);
  });

  test("đăng nhập sai sinh một dòng audit_log dang_nhap:that_bai", async () => {
    const r = await goi("POST", "/v1/auth/mat-khau", {
      body: { ten_dang_nhap: `${PREFIX}-nhap-3`, mat_khau: "SaiHoanToan1" },
    });
    expect(r.status).toBe(401);
    const [dem] = (await sql`
      SELECT count(*)::int AS n FROM audit_log
      WHERE actor = ${`${PREFIX}-nhap-3`} AND action = 'dang_nhap:that_bai'`) as any[];
    expect(dem.n).toBe(1);
  });
});

describe("loại đơn vị", () => {
  const ACTOR = `${PREFIX}-seed`;

  test("tạo đơn vị loại xã kèm mã hành chính", async () => {
    const d = await taoDonVi(
      { code: `${PREFIX}-xa1`, name: "Xã A", loai: "xa", maHanhChinh: "00008" },
      ACTOR,
    );
    expect(d.loai).toBe("xa");
    expect(d.ma_hanh_chinh).toBe("00008");
  });

  test("mặc định loại khác", async () => {
    const d = await taoDonVi({ code: `${PREFIX}-k1`, name: "Đơn vị K" }, ACTOR);
    expect(d.loai).toBe("khac");
    expect(d.ma_hanh_chinh).toBeNull();
  });

  test("mã hành chính trên đơn vị không phải xã bị từ chối", async () => {
    await expect(
      taoDonVi(
        { code: `${PREFIX}-cq1`, name: "CQ", loai: "co_quan_hanh_chinh", maHanhChinh: "00008" },
        ACTOR,
      ),
    ).rejects.toMatchObject({ loai: "khong_hop_le" });
  });

  test("mã hành chính trùng trả xung đột", async () => {
    await expect(
      taoDonVi({ code: `${PREFIX}-xa2`, name: "Xã B", loai: "xa", maHanhChinh: "00008" }, ACTOR),
    ).rejects.toMatchObject({ loai: "xung_dot" });
  });

  test("đổi loại xã sang loại khác thì xóa mã hành chính", async () => {
    const d = await layDonViTheoMa(`${PREFIX}-xa1`);
    const s = await suaDonVi(d!.id, { loai: "khac" }, ACTOR);
    expect(s.loai).toBe("khac");
    expect(s.ma_hanh_chinh).toBeNull();
  });

  test("sửa không nêu mã thì giữ mã cũ", async () => {
    const d = await taoDonVi(
      { code: `${PREFIX}-xa3`, name: "Xã C", loai: "xa", maHanhChinh: "00025" },
      ACTOR,
    );
    const s = await suaDonVi(d.id, { name: "Xã C mới" }, ACTOR);
    expect(s.ma_hanh_chinh).toBe("00025");
  });
});

describe("API đơn vị: loại và mã xã theo danh mục", () => {
  const tao = (body: unknown) => goi("POST", "/v1/quan-tri/don-vi", { token: tk.quanTri, body });

  test("mã xã không có trong danh mục trả 400", async () => {
    const r = await tao({ code: `${PREFIX}-api-xa0`, name: "Xã ma", loai: "xa", maHanhChinh: "99999" });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("Không có xã, phường mã 99999");
  });

  test("mã xã có thật thì tạo được, trùng thì 409", async () => {
    const r = await tao({
      code: `${PREFIX}-api-xa1`,
      name: "Phường Hoàn Kiếm",
      loai: "xa",
      maHanhChinh: "00070",
    });
    expect(r.status).toBe(201);
    expect(r.body.item.ma_hanh_chinh).toBe("00070");
    const trung = await tao({ code: `${PREFIX}-api-xa2`, name: "Trùng", loai: "xa", maHanhChinh: "00070" });
    expect(trung.status).toBe(409);
  });

  test("loại không hợp lệ trả 400", async () => {
    const r = await tao({ code: `${PREFIX}-api-x`, name: "X", loai: "abc" });
    expect(r.status).toBe(400);
  });

  test("sửa mã xã không có trong danh mục trả 400", async () => {
    const r = await goi("PATCH", `/v1/quan-tri/don-vi/${donVi.phong}`, {
      token: tk.quanTri,
      body: { loai: "xa", maHanhChinh: "99999" },
    });
    expect(r.status).toBe(400);
  });
});

describe("nơi sinh hoạt Đảng của người dùng", () => {
  test("quản trị gắn tổ chức Đảng; ngừng dùng tổ chức đó thì người dùng vẫn giữ", async () => {
    const dang = await taoDonVi(
      { code: `${PREFIX}-DANG`, name: "Chi bộ thử", loai: "to_chuc_dang" },
      `${PREFIX}-seed`,
    );
    const [nd] = (await sql`SELECT id FROM accounts WHERE username = ${`${PREFIX}-can-bo-b`}`) as any[];
    const gan = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${nd.id}`, {
      token: tk.quanTri,
      body: { partyUnitId: dang.id },
    });
    expect(gan.status).toBe(200);
    expect(gan.body.item.party_unit_id).toBe(dang.id);
    expect(gan.body.item.party_unit_name).toBe("Chi bộ thử");

    const ngung = await goi("PATCH", `/v1/quan-tri/don-vi/${dang.id}`, {
      token: tk.quanTri,
      body: { enabled: false },
    });
    expect(ngung.status).toBe(200);
    const ds = await goi("GET", `/v1/quan-tri/nguoi-dung?q=${PREFIX}-can-bo-b`, { token: tk.quanTri });
    expect(ds.body.items[0].party_unit_id).toBe(dang.id);

    // Lưu lại tài khoản với nơi sinh hoạt Đảng không đổi (ví dụ chỉ đổi vai trò) vẫn được.
    const luuLai = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${nd.id}`, {
      token: tk.quanTri,
      body: { partyUnitId: dang.id, rankTitle: "Chuyên viên" },
    });
    expect(luuLai.status).toBe(200);
    expect(luuLai.body.item.party_unit_id).toBe(dang.id);

    // Gắn mới một tổ chức Đảng đã ngừng dùng thì bị từ chối.
    const ngungKhac = await taoDonVi(
      { code: `${PREFIX}-DANG2`, name: "Chi bộ đã ngừng", loai: "to_chuc_dang" },
      `${PREFIX}-seed`,
    );
    await suaDonVi(ngungKhac.id, { enabled: false }, `${PREFIX}-seed`);
    const ganMoi = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${nd.id}`, {
      token: tk.quanTri,
      body: { partyUnitId: ngungKhac.id },
    });
    expect(ganMoi.status).toBe(400);
    await sql`UPDATE accounts SET party_unit_id = NULL WHERE id = ${nd.id}`;
  });

  test("gắn đơn vị không phải tổ chức Đảng trả 400", async () => {
    const [nd] = (await sql`SELECT id FROM accounts WHERE username = ${`${PREFIX}-can-bo-b`}`) as any[];
    const r = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${nd.id}`, {
      token: tk.quanTri,
      body: { partyUnitId: donVi.doiA },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toContain("tổ chức Đảng");
  });
});

describe("phạm vi đơn vị của cán bộ quản lý", () => {
  test("quản lý đội A lọc theo đội B nhận 403", async () => {
    const r = await goi("GET", `/v1/quan-tri/nguoi-dung?don_vi=${donVi.doiB}`, { token: tk.quanLyA });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("ngoai_pham_vi");
  });

  test("quản lý đội A không lọc thì chỉ thấy người đội A", async () => {
    const r = await goi("GET", "/v1/quan-tri/nguoi-dung?gioi_han=200", { token: tk.quanLyA });
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThan(0);
    expect(r.body.items.every((u: any) => u.unit_code === `${PREFIX}-DOI-A`)).toBe(true);
  });

  test("quản lý đội A xem cây đơn vị: chỉ có đội A", async () => {
    const r = await goi("GET", "/v1/quan-tri/don-vi", { token: tk.quanLyA });
    expect(r.body.items.map((d: any) => d.code)).toEqual([`${PREFIX}-DOI-A`]);
  });

  test("quản trị lọc theo phòng thì thấy người của cả hai đội", async () => {
    const r = await goi("GET", `/v1/quan-tri/nguoi-dung?don_vi=${donVi.phong}&gioi_han=200`, {
      token: tk.quanTri,
    });
    const doi = new Set(r.body.items.map((u: any) => u.unit_code));
    expect(doi).toEqual(new Set([`${PREFIX}-DOI-A`, `${PREFIX}-DOI-B`]));
  });

  test("quản lý không tạo được đơn vị; quản trị chuyển đội B vào đội A được, không tạo được vòng", async () => {
    expect(
      (
        await goi("POST", "/v1/quan-tri/don-vi", {
          token: tk.quanLyA,
          body: { code: `${PREFIX}-X`, name: "X" },
        })
      ).status,
    ).toBe(403);
    const vong = await goi("PATCH", `/v1/quan-tri/don-vi/${donVi.phong}`, {
      token: tk.quanTri,
      body: { parentId: donVi.doiA },
    });
    expect(vong.status).toBe(400);
    const chuyen = await goi("PATCH", `/v1/quan-tri/don-vi/${donVi.doiB}`, {
      token: tk.quanTri,
      body: { parentId: donVi.doiA },
    });
    expect(chuyen.status).toBe(200);
    expect(chuyen.body.item.cap).toBe(3);
    // Đội B giờ nằm dưới đội A nên quản lý đội A thấy.
    const r = await goi("GET", `/v1/quan-tri/nguoi-dung?don_vi=${donVi.doiB}`, { token: tk.quanLyA });
    expect(r.status).toBe(200);
  });
});

describe("nhật ký truy cập", () => {
  test("mỗi request API sinh đúng một dòng access_log, ghi đường dẫn mẫu", async () => {
    const [acc] = (await sql`SELECT id FROM accounts WHERE username = ${`${PREFIX}-quan-ly-a`}`) as any[];
    const dem = async () =>
      Number(
        ((await sql`SELECT count(*)::int AS n FROM access_log WHERE account_id = ${acc.id}`) as any[])[0].n,
      );
    const truoc = await dem();
    await goi("GET", `/v1/quan-tri/nguoi-dung/${acc.id}`, { token: tk.quanLyA });
    expect(await dem()).toBe(truoc + 1);
    const [dong] = (await sql`
      SELECT method, route, status FROM access_log WHERE account_id = ${acc.id} ORDER BY id DESC LIMIT 1`) as any[];
    expect(dong).toEqual({ method: "GET", route: "/v1/quan-tri/nguoi-dung/:id", status: 200 });
  });
});

describe("xác minh cán bộ tự đăng ký", () => {
  // Cây riêng: các test trên đã chuyển đội B vào dưới đội A.
  const dv: Record<"goc" | "doiC" | "doiD", string> = { goc: "", doiC: "", doiD: "" };
  let quanLyC = "";

  /** Tài khoản tự đăng ký đang chờ, khai đơn vị `donViKhai`; trả id và token phiên. */
  async function taoChoDuyet(ten: string, donViKhai: string): Promise<{ id: string; token: string }> {
    const [row] = (await sql`
      INSERT INTO accounts (username, name, role, self_registered, xac_minh, so_hieu, don_vi_khai, phone)
      VALUES (${`${PREFIX}-${ten}`}, ${ten}, 'khach', true, 'cho_duyet', '123456', ${donViKhai}, '0912345678')
      RETURNING id`) as any[];
    return { id: row.id, token: (await createSession(row.id, "test")).token };
  }

  beforeAll(async () => {
    const actor = `${PREFIX}-seed`;
    dv.goc = (await taoDonVi({ code: `${PREFIX}-XM-GOC`, name: "Phòng xác minh thử" }, actor)).id;
    dv.doiC = (await taoDonVi({ code: `${PREFIX}-XM-C`, name: "Đội C thử", parentId: dv.goc }, actor)).id;
    dv.doiD = (await taoDonVi({ code: `${PREFIX}-XM-D`, name: "Đội D thử", parentId: dv.goc }, actor)).id;
    quanLyC = await taoTaiKhoan("quan-ly-c", "lanh_dao", dv.doiC);
  });

  test("cán bộ quản lý thấy và duyệt người khai đơn vị mình; duyệt xong thành cán bộ", async () => {
    const choC = await taoChoDuyet("cho-c", dv.doiC);
    const choD = await taoChoDuyet("cho-d", dv.doiD);

    // Chưa duyệt: ngoài nhóm API tài khoản, mọi nhóm khác coi như chưa đăng nhập.
    expect((await goi("GET", "/v1/toi/lich-su", { token: choC.token })).status).toBe(401);

    const ds = await goi("GET", "/v1/quan-tri/nguoi-dung?xac_minh=cho_duyet", { token: quanLyC });
    expect(ds.status).toBe(200);
    const ten = ds.body.items.map((u: any) => u.username);
    expect(ten).toContain(`${PREFIX}-cho-c`);
    expect(ten).not.toContain(`${PREFIX}-cho-d`);
    expect(ds.body.so_cho_xac_minh).toBe(1);
    expect(ds.body.items[0]).toMatchObject({
      xac_minh: "cho_duyet",
      so_hieu: "123456",
      don_vi_khai: dv.doiC,
    });

    // Người khai đơn vị ngoài phạm vi: không duyệt được. Gắn vào đơn vị ngoài phạm vi: cũng không.
    expect(
      (
        await goi("POST", `/v1/quan-tri/nguoi-dung/${choD.id}/xac-minh`, {
          token: quanLyC,
          body: { duyet: true },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await goi("POST", `/v1/quan-tri/nguoi-dung/${choC.id}/xac-minh`, {
          token: quanLyC,
          body: { duyet: true, unitId: dv.doiD },
        })
      ).status,
    ).toBe(403);

    const duyet = await goi("POST", `/v1/quan-tri/nguoi-dung/${choC.id}/xac-minh`, {
      token: quanLyC,
      body: { duyet: true },
    });
    expect(duyet.status).toBe(200);
    expect(duyet.body.item).toMatchObject({
      xac_minh: "da_xac_minh",
      role: "can_bo",
      unit_id: dv.doiC,
      xac_minh_boi: `${PREFIX}-quan-ly-c`,
    });
    // Phiên đang mở có quyền cán bộ ngay, không phải đăng nhập lại.
    expect((await goi("GET", "/v1/toi/lich-su", { token: choC.token })).status).toBe(200);
    const lai = await goi("POST", `/v1/quan-tri/nguoi-dung/${choC.id}/xac-minh`, {
      token: quanLyC,
      body: { duyet: true },
    });
    expect(lai.status).toBe(409);
  });

  test("quản trị viên từ chối phải ghi lý do; người bị từ chối chỉ còn nhóm API tài khoản", async () => {
    const choD = await taoChoDuyet("tu-choi-d", dv.doiD);
    const thieu = await goi("POST", `/v1/quan-tri/nguoi-dung/${choD.id}/xac-minh`, {
      token: tk.quanTri,
      body: { duyet: false, ly_do: " " },
    });
    expect(thieu.status).toBe(400);

    const tuChoi = await goi("POST", `/v1/quan-tri/nguoi-dung/${choD.id}/xac-minh`, {
      token: tk.quanTri,
      body: { duyet: false, ly_do: "Số hiệu không khớp danh sách đội" },
    });
    expect(tuChoi.status).toBe(200);
    expect(tuChoi.body.item).toMatchObject({
      xac_minh: "tu_choi",
      role: "khach",
      xac_minh_ly_do: "Số hiệu không khớp danh sách đội",
    });

    const me = await goi("GET", "/v1/auth/me", { token: choD.token });
    expect(me.body.cho_xac_minh).toBe(true);
    expect(me.body.xac_minh.ly_do_tu_choi).toBe("Số hiệu không khớp danh sách đội");
    expect((await goi("GET", "/v1/toi/lich-su", { token: choD.token })).status).toBe(401);

    const ds = await goi("GET", "/v1/quan-tri/nguoi-dung?xac_minh=tu_choi", { token: tk.quanTri });
    expect(ds.body.items.map((u: any) => u.id)).toContain(choD.id);
  });

  test("cán bộ thường không duyệt được", async () => {
    const choC = await taoChoDuyet("cho-c-2", dv.doiC);
    const canBo = await taoTaiKhoan("can-bo-c", "can_bo", dv.doiC);
    const r = await goi("POST", `/v1/quan-tri/nguoi-dung/${choC.id}/xac-minh`, {
      token: canBo,
      body: { duyet: true },
    });
    expect(r.status).toBe(403);
  });
});

describe("Nhóm học tập độc lập với vai trò", () => {
  test("lưu nhiều nhóm, phiên đọc lại nhóm, sửa thường giữ nhóm và cho phép xóa hết", async () => {
    const tao = await goi("POST", "/v1/quan-tri/nguoi-dung", {
      token: tk.quanTri,
      body: {
        username: `${PREFIX}-nhom`,
        name: "Người học nhiều nhóm",
        role: "can_bo",
        unitId: donVi.doiA,
        nhomDoiTuong: ["cong_an_cap_xa", "dang_vien", "dang_vien"],
      },
    });
    expect(tao.status).toBe(201);
    const id = tao.body.item.id;
    expect(tao.body.item.nhom_doi_tuong).toEqual(["cong_an_cap_xa", "dang_vien"]);
    expect(tao.body.item.role).toBe("can_bo");
    const { token } = await createSession(id, "test");
    expect((await principalFromToken(token))?.nhomDoiTuong).toEqual(["cong_an_cap_xa", "dang_vien"]);
    const sua = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${id}`, {
      token: tk.quanTri,
      body: { name: "Tên mới" },
    });
    expect(sua.status).toBe(200);
    expect(sua.body.item.nhom_doi_tuong).toEqual(["cong_an_cap_xa", "dang_vien"]);
    const cam = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${id}`, {
      token: tk.quanLyA,
      body: { nhomDoiTuong: ["dang_vien"] },
    });
    expect(cam.status).toBe(403);
    const sai = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${id}`, {
      token: tk.quanTri,
      body: { nhomDoiTuong: ["quan_tri"] },
    });
    expect(sai.status).toBe(400);
    const xoa = await goi("PATCH", `/v1/quan-tri/nguoi-dung/${id}`, {
      token: tk.quanTri,
      body: { nhomDoiTuong: [] },
    });
    expect(xoa.status).toBe(200);
    expect(xoa.body.item.nhom_doi_tuong).toEqual([]);
    expect((await principalFromToken(token))?.nhomDoiTuong).toEqual([]);
    expect((await principalFromToken(token))?.role).toBe("can_bo");
  });
});
