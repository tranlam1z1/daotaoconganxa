import { beforeAll, describe, expect, test } from "bun:test";
import { AuthError, verifyGoogleIdToken } from "../src/google.ts";
import { installKeys, makeKey, signIdToken, type TestKey } from "./helpers.ts";

const CLIENT_ID = "123456789-abc.apps.googleusercontent.com";
let key: TestKey;
let otherKey: TestKey;

beforeAll(async () => {
  key = await makeKey("k1");
  otherKey = await makeKey("k2");
  installKeys(key); // chỉ nạp khóa k1: token ký bằng k2 phải bị từ chối
});

describe("kiểm chứng ID token của Google", () => {
  test("token hợp lệ được chấp nhận và trả đúng claim", async () => {
    const t = await signIdToken(key, { aud: CLIENT_ID, email: "a@vidu.vn", name: "Nguyễn A" });
    const claims = await verifyGoogleIdToken(t, { clientId: CLIENT_ID });
    expect(claims.email).toBe("a@vidu.vn");
    expect(claims.name).toBe("Nguyễn A");
    expect(claims.sub).toBeTruthy();
  });

  test("từ chối khi audience không khớp — token của ứng dụng khác", async () => {
    const t = await signIdToken(key, { aud: "ung-dung-khac.apps.googleusercontent.com", email: "a@vidu.vn" });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/aud không khớp/);
  });

  test("từ chối token đã hết hạn", async () => {
    const t = await signIdToken(key, {
      aud: CLIENT_ID,
      email: "a@vidu.vn",
      exp: Math.floor(Date.now() / 1000) - 7200,
    });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/hết hạn/);
  });

  test("từ chối token chưa tới hiệu lực (nbf)", async () => {
    const t = await signIdToken(key, {
      aud: CLIENT_ID,
      email: "a@vidu.vn",
      nbf: Math.floor(Date.now() / 1000) + 7200,
    });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/chưa có hiệu lực/);
  });

  test("từ chối chữ ký sai — ký bằng khóa không thuộc Google", async () => {
    // Giả mạo: dùng khóa k2 nhưng khai kid là k1
    const t = await signIdToken({ ...otherKey, kid: "k1" }, { aud: CLIENT_ID, email: "ke-gia-mao@vidu.vn" });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/Chữ ký .* không hợp lệ/);
  });

  test("từ chối khi kid không có trong bộ khóa của Google", async () => {
    const t = await signIdToken({ ...otherKey, kid: "kid-la" }, { aud: CLIENT_ID, email: "a@vidu.vn" });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(
      /không tìm thấy khóa|Không tìm thấy khóa/i,
    );
  });

  test("từ chối issuer giả", async () => {
    const t = await signIdToken(key, {
      aud: CLIENT_ID,
      email: "a@vidu.vn",
      iss: "https://ke-tan-cong.example",
    });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/Issuer không hợp lệ/);
  });

  test("từ chối thuật toán ký không phải RS256 (chống tấn công alg=none)", async () => {
    const t = await signIdToken(key, { aud: CLIENT_ID, email: "a@vidu.vn" }, { alg: "none" });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/Thuật toán ký/);
  });

  test("từ chối email chưa xác minh", async () => {
    const t = await signIdToken(key, { aud: CLIENT_ID, email: "a@vidu.vn", email_verified: false });
    await expect(verifyGoogleIdToken(t, { clientId: CLIENT_ID })).rejects.toThrow(/chưa được xác minh/);
  });

  test("từ chối khi chưa cấu hình clientId — không được bỏ qua kiểm tra audience", async () => {
    const t = await signIdToken(key, { aud: CLIENT_ID, email: "a@vidu.vn" });
    await expect(verifyGoogleIdToken(t, { clientId: "" })).rejects.toThrow(/GOOGLE_CLIENT_ID/);
  });

  test("giới hạn theo miền tổ chức", async () => {
    const trong = await signIdToken(key, { aud: CLIENT_ID, email: "a@coquan.gov.vn", hd: "coquan.gov.vn" });
    const ngoai = await signIdToken(key, { aud: CLIENT_ID, email: "b@gmail.com" });
    await expect(
      verifyGoogleIdToken(trong, { clientId: CLIENT_ID, allowedDomains: ["coquan.gov.vn"] }),
    ).resolves.toBeTruthy();
    const err = await verifyGoogleIdToken(ngoai, {
      clientId: CLIENT_ID,
      allowedDomains: ["coquan.gov.vn"],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe("forbidden");
  });

  test("token dị dạng bị từ chối, không làm sập server", async () => {
    for (const bad of ["", "abc", "a.b", "a.b.c.d", "...."]) {
      await expect(verifyGoogleIdToken(bad, { clientId: CLIENT_ID })).rejects.toThrow();
    }
  });
});
