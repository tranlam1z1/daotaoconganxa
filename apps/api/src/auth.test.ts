/**
 * Kiểm thử điểm cuối xác thực: đổi ID token của Google lấy token phiên, tra danh tính,
 * thu hồi. Token được ký bằng cặp khóa tự sinh, không gọi mạng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { clearJwksCache } from "@qdpl/auth";
import { sql, taoDonVi } from "@qdpl/db";
import { installKeys, makeKey, signIdToken, type TestKey } from "../../../packages/auth/tests/helpers.ts";
import { createApp } from "./app.ts";

const app = createApp();
const CLIENT_ID = "test-api-client.apps.googleusercontent.com";
const EMAIL = "test-api-auth@vidu.vn";

let key: TestKey;
const CLIENT_ID_CU = process.env.GOOGLE_CLIENT_ID;
const BOOTSTRAP_CU = process.env.AUTH_BOOTSTRAP_ADMIN;

beforeAll(async () => {
  clearJwksCache();
  key = await makeKey("api-k1");
  installKeys(key);
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  // Tệp này kiểm tra luồng thường; quy tắc "người đầu tiên làm quản trị" test ở @qdpl/auth.
  process.env.AUTH_BOOTSTRAP_ADMIN = "0";
});

afterAll(async () => {
  if (CLIENT_ID_CU === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = CLIENT_ID_CU;
  if (BOOTSTRAP_CU === undefined) delete process.env.AUTH_BOOTSTRAP_ADMIN;
  else process.env.AUTH_BOOTSTRAP_ADMIN = BOOTSTRAP_CU;
  await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ${EMAIL})`;
  await sql`DELETE FROM accounts WHERE email = ${EMAIL}`;
});

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe("xác thực qua API", () => {
  test("cấu hình đăng nhập lộ Client ID để dựng nút GIS", async () => {
    const res = await app.request("http://test/v1/auth/config");
    const body = (await res.json()) as any;
    expect(body.da_cau_hinh).toBe(true);
    expect(body.google_client_id).toBe(CLIENT_ID);
  });

  test("ID token hợp lệ đổi được token phiên và tra được danh tính", async () => {
    const idToken = await signIdToken(key, { aud: CLIENT_ID, email: EMAIL, name: "Người thử API" });
    const dangNhap = await post("/v1/auth/google", { credential: idToken, client: "test" });
    expect(dangNhap.status).toBe(200);
    expect(dangNhap.body.token).toStartWith("qdpl_");
    expect(dangNhap.body.vai_tro).toBe("khach");
    expect(dangNhap.body.la_quan_tri_dau_tien).toBe(false);

    const token = dangNhap.body.token as string;
    const me = await app.request("http://test/v1/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).email).toBe(EMAIL);

    // Token cấp cho MCP là token khác, không phải token đang giữ trong cookie.
    const mcp = await post("/v1/auth/mcp-token", {}, { authorization: `Bearer ${token}` });
    expect(mcp.status).toBe(200);
    expect(mcp.body.token).not.toBe(token);

    const thoat = await post("/v1/auth/logout", {}, { authorization: `Bearer ${token}` });
    expect(thoat.body.da_thu_hoi).toBe(true);
    const sauKhiThoat = await app.request("http://test/v1/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sauKhiThoat.status).toBe(401);
  });

  test("token do ứng dụng khác cấp bị từ chối", async () => {
    const idToken = await signIdToken(key, { aud: "ung-dung-khac", email: EMAIL });
    const res = await post("/v1/auth/google", { credential: idToken });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain("ứng dụng khác");
  });

  test("chưa đăng nhập thì /me trả 401", async () => {
    const res = await app.request("http://test/v1/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("đăng nhập tài khoản demo", () => {
  const MAT_KHAU_CU = process.env.AUTH_DEMO_PASSWORD;
  const EMAIL_DEMO = ["hoc-vien@demo.quydinhphapluat.vn", "quan-tri@demo.quydinhphapluat.vn"];

  afterAll(async () => {
    if (MAT_KHAU_CU === undefined) delete process.env.AUTH_DEMO_PASSWORD;
    else process.env.AUTH_DEMO_PASSWORD = MAT_KHAU_CU;
    await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ANY(${EMAIL_DEMO}))`;
    await sql`DELETE FROM accounts WHERE email = ANY(${EMAIL_DEMO})`;
  });

  test("không đặt AUTH_DEMO_PASSWORD thì demo tắt hẳn", async () => {
    delete process.env.AUTH_DEMO_PASSWORD;
    const cfg = (await (await app.request("http://test/v1/auth/config")).json()) as any;
    expect(cfg.demo).toBe(false);
    const res = await post("/v1/auth/demo", { mat_khau: "bat-ky", vai_tro: "hoc_vien" });
    expect(res.status).toBe(404);
  });

  test("sai mật khẩu bị từ chối", async () => {
    process.env.AUTH_DEMO_PASSWORD = "mat-khau-thu";
    const res = await post("/v1/auth/demo", { mat_khau: "sai", vai_tro: "hoc_vien" });
    expect(res.status).toBe(401);
  });

  test("đúng mật khẩu cấp phiên theo vai trò đã chọn", async () => {
    process.env.AUTH_DEMO_PASSWORD = "mat-khau-thu";
    const cfg = (await (await app.request("http://test/v1/auth/config")).json()) as any;
    expect(cfg.demo).toBe(true);

    const hocVien = await post("/v1/auth/demo", { mat_khau: "mat-khau-thu", vai_tro: "hoc_vien" });
    expect(hocVien.status).toBe(200);
    expect(hocVien.body.vai_tro).toBe("khach");
    const me = await app.request("http://test/v1/auth/me", {
      headers: { authorization: `Bearer ${hocVien.body.token}` },
    });
    expect(((await me.json()) as any).email).toBe("hoc-vien@demo.quydinhphapluat.vn");

    const quanTri = await post("/v1/auth/demo", { mat_khau: "mat-khau-thu", vai_tro: "quan_tri" });
    expect(quanTri.body.la_quan_tri).toBe(true);
  });

  test("tài khoản demo bị khóa thì không đăng nhập được", async () => {
    process.env.AUTH_DEMO_PASSWORD = "mat-khau-thu";
    await post("/v1/auth/demo", { mat_khau: "mat-khau-thu", vai_tro: "hoc_vien" });
    await sql`UPDATE accounts SET enabled = false WHERE email = 'hoc-vien@demo.quydinhphapluat.vn'`;
    const res = await post("/v1/auth/demo", { mat_khau: "mat-khau-thu", vai_tro: "hoc_vien" });
    expect(res.status).toBe(403);
  });
});

describe("tự đăng ký tài khoản", () => {
  const EMAIL_DK = "test-api-dang-ky@vidu.vn";
  const MA_DV = "test-api-dang-ky-dv";
  let donVi = "";
  const dangKy = () =>
    post("/v1/auth/dang-ky", {
      ten: "Người đăng ký thử",
      email: EMAIL_DK,
      so_dien_thoai: "0912345678",
      mat_khau: "MatKhau2026",
      so_hieu: "123-456",
      don_vi_id: donVi,
      cap_bac_chuc_vu: "Thượng úy",
    });
  const goi = async (method: string, path: string, token: string, body?: unknown) => {
    const res = await app.request(`http://test${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };

  beforeAll(async () => {
    await sql`DELETE FROM units WHERE code = ${MA_DV}`;
    donVi = (await taoDonVi({ code: MA_DV, name: "Đội đăng ký thử API" }, "test-api-dang-ky")).id;
  });

  afterAll(async () => {
    await sql`DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE email = ${EMAIL_DK})`;
    await sql`DELETE FROM audit_log WHERE actor = ${EMAIL_DK} OR target = ${EMAIL_DK} OR actor = 'test-api-dang-ky'`;
    await sql`DELETE FROM accounts WHERE email = ${EMAIL_DK}`;
    await sql`DELETE FROM units WHERE code = ${MA_DV}`;
  });

  test("danh sách đơn vị công khai để chọn khi đăng ký, không lộ số người", async () => {
    const res = await app.request("http://test/v1/auth/don-vi");
    const items = ((await res.json()) as any).items as any[];
    const dv = items.find((d) => d.id === donVi);
    expect(dv).toEqual({ id: donVi, ten: "Đội đăng ký thử API", cap: 1 });
  });

  test("đăng ký cấp phiên ngay, tài khoản chờ xác minh chỉ dùng nhóm API tài khoản; đăng ký lại trả 409", async () => {
    const res = await dangKy();
    expect(res.status).toBe(200);
    expect(res.body.token).toStartWith("qdpl_");
    expect(res.body.vai_tro).toBe("khach");
    expect(res.body.cho_xac_minh).toBe(true);
    expect(res.body.ten_dang_nhap).toBe(EMAIL_DK);
    const token = res.body.token as string;

    const me = await goi("GET", "/v1/auth/me", token);
    expect(me.body.don_vi).toBeNull();
    expect(me.body.cho_xac_minh).toBe(true);
    expect(me.body.xac_minh).toMatchObject({
      trang_thai: "cho_duyet",
      so_hieu: "123456",
      don_vi: { id: donVi, ten: "Đội đăng ký thử API" },
      cap_bac_chuc_vu: "Thượng úy",
    });

    // Chưa duyệt: học, luyện tập, trò chơi và mọi nhóm API khác coi như chưa đăng nhập.
    for (const duong of [
      "/v1/toi/tong-quan",
      "/v1/luyen-tap/chu-de",
      "/v1/luot-choi",
      "/v1/tro-choi",
      "/v1/giong-doc",
      "/v1/thi",
      "/v1/bang-xep-hang?pham_vi=don_vi&ky=tuan",
    ]) {
      expect((await goi("GET", duong, token)).status).toBe(401);
    }
    // Ảnh đại diện thuộc trang Tài khoản: xóa ảnh (chưa có ảnh nào) vẫn được nhận.
    expect((await goi("DELETE", "/v1/toi/anh-dai-dien", token)).status).toBe(200);

    // Sửa thông tin đã khai thì vẫn chờ duyệt.
    const khai = await goi("PUT", "/v1/auth/xac-minh", token, {
      so_hieu: "654321",
      don_vi_id: donVi,
      so_dien_thoai: "0987654321",
    });
    expect(khai.status).toBe(200);
    expect(khai.body.xac_minh).toMatchObject({
      trang_thai: "cho_duyet",
      so_hieu: "654321",
      cap_bac_chuc_vu: null,
    });

    const lai = await dangKy();
    expect(lai.status).toBe(409);
    expect(lai.body.error.code).toBe("da_ton_tai");
  });

  test("dữ liệu không hợp lệ trả 400 kèm thông báo", async () => {
    const res = await post("/v1/auth/dang-ky", {
      ten: "Người thử",
      email: "test-api-sai@vidu.vn",
      so_dien_thoai: "123",
      mat_khau: "MatKhau2026",
      so_hieu: "123456",
      don_vi_id: donVi,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Số điện thoại không hợp lệ.");
  });
});
