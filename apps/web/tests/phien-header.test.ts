import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { docPhienHienTai, nguoiDungHienTai } from "../app/lib/auth.server";
import { nguoiDungDauTrang } from "../app/lib/phien-hien-thi";
import { yeuCauDangNhap } from "../app/lib/session.server";
import type { NguoiDung } from "../app/lib/types";

const user: NguoiDung = {
  email: "header-test@example.invalid",
  ten: "Người kiểm thử",
  vai_tro: "can_bo",
  mo_ta_vai_tro: "Cán bộ",
  mien: null,
  la_quan_tri: false,
};
let api: ReturnType<typeof Bun.serve>;
const oldApiUrl = process.env.API_URL;
beforeAll(() => {
  api = Bun.serve({
    port: 0,
    fetch(request) {
      const token = request.headers.get("authorization")?.replace("Bearer ", "");
      if (token === "valid") return Response.json(user);
      if (token === "malformed") return Response.json(null);
      const status = token === "expired" ? 401 : token === "blocked" ? 403 : 503;
      return Response.json({ error: { message: "Kiểm thử phiên" } }, { status });
    },
  });
  process.env.API_URL = `http://127.0.0.1:${api.port}`;
});
afterAll(() => {
  api.stop(true);
  if (oldApiUrl === undefined) delete process.env.API_URL;
  else process.env.API_URL = oldApiUrl;
});
const request = (token?: string) =>
  new Request("http://web.test/dich-vu-cong", { headers: token ? { cookie: `qdpl_phien=${token}` } : {} });

describe("phiên tài khoản trên header", () => {
  test("không có cookie thì là khách và không giữ hồ sơ cũ", async () => {
    const result = await docPhienHienTai(request());
    expect(result.trangThaiPhien).toBe("khach");
    expect(nguoiDungDauTrang(user, result)).toBeNull();
  });
  test("phiên hợp lệ cập nhật đúng danh tính", async () => {
    const result = await docPhienHienTai(request("valid"));
    expect(result.trangThaiPhien).toBe("hop_le");
    expect(nguoiDungDauTrang(null, result)).toEqual(user);
  });
  for (const token of ["expired", "blocked"])
    test(`${token}: xóa hồ sơ khi API thực sự từ chối`, async () => {
      const result = await docPhienHienTai(request(token));
      expect(result.trangThaiPhien).toBe("khach");
      expect(nguoiDungDauTrang(user, result)).toBeNull();
    });
  test("API tạm lỗi không làm mất danh tính header đã xác nhận", async () => {
    const result = await docPhienHienTai(request("unavailable"));
    expect(result.trangThaiPhien).toBe("tam_loi");
    expect(nguoiDungDauTrang(user, result)).toEqual(user);
  });
  test("dữ liệu API sai định dạng cũng là lỗi kiểm tra phiên", async () => {
    expect((await docPhienHienTai(request("malformed"))).trangThaiPhien).toBe("tam_loi");
  });
  test("không tạo danh tính khi lỗi xảy ra mà chưa từng đăng nhập", async () => {
    expect(nguoiDungDauTrang(null, await docPhienHienTai(request("unavailable")))).toBeNull();
  });
  test("loader bảo vệ không dùng danh tính giữ lại trên header", async () => {
    expect(await nguoiDungHienTai(request("unavailable"))).toBeNull();
  });
});

test("API phiên gián đoạn trả 503 thay vì chuyển sang đăng nhập", async () => {
  try {
    await yeuCauDangNhap(request("unavailable"));
    throw Error("Expected response");
  } catch (e) {
    expect(e instanceof Response).toBe(true);
    expect((e as Response).status).toBe(503);
    expect((e as Response).headers.get("location")).toBeNull();
  }
});
test("khách được chuyển tới đăng nhập với đích quay lại không chứa .data/_routes", async () => {
  try {
    await yeuCauDangNhap(new Request("http://router.test/hoc.data?_routes=training&nhom=vien_chuc"));
    throw Error("Expected redirect");
  } catch (e) {
    expect((e as Response).status).toBe(302);
    expect((e as Response).headers.get("location")).toBe("/dang-nhap?tiep=%2Fhoc%3Fnhom%3Dvien_chuc");
  }
});
