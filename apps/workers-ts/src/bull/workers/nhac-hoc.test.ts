/**
 * Hàm gửi Web Push của worker nhắc học (docs/PLAN.md GĐ15).
 *
 * web-push luôn gửi qua HTTPS nên không bắn được vào máy chủ giả HTTP trong test. Thay vào đó:
 *  - dựng yêu cầu bằng chính `generateRequestDetails` của thư viện với tùy chọn của worker, rồi kiểm
 *    chữ ký VAPID, cách mã hóa aes128gcm và TTL;
 *  - truyền hàm gửi giả ném `WebPushError` để kiểm mã 410/500 được trả nguyên cho lớp CSDL.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import webpush from "web-push";
import { taoHamGui, tuyChonGui } from "./nhac-hoc.ts";

const b64url = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");

const khoa = webpush.generateVAPIDKeys();
const env = { VAPID_PUBLIC_KEY: khoa.publicKey, VAPID_PRIVATE_KEY: khoa.privateKey };
let dk = { id: "x", account_id: "a", endpoint: "https://push.example.test/abc", p256dh: "", auth: "" };

beforeAll(async () => {
  // Cặp khóa P-256 và bí mật auth như trình duyệt tạo khi đăng ký.
  const cap = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  dk = {
    ...dk,
    p256dh: b64url(await crypto.subtle.exportKey("raw", cap.publicKey)),
    auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
});

describe("hàm gửi Web Push", () => {
  test("chưa có khóa VAPID thì không tạo hàm gửi", () => {
    expect(taoHamGui({})).toBeNull();
    expect(taoHamGui({ VAPID_PUBLIC_KEY: "x" })).toBeNull();
    expect(tuyChonGui({})).toBeNull();
  });

  test("yêu cầu gửi có chữ ký VAPID, thân mã hóa aes128gcm, TTL 12 giờ", () => {
    const yc = webpush.generateRequestDetails(
      { endpoint: dk.endpoint, keys: { p256dh: dk.p256dh, auth: dk.auth } },
      JSON.stringify({ tieu_de: "Đến giờ học", url: "/luyen-tap" }),
      tuyChonGui(env)!,
    );
    expect(yc.method).toBe("POST");
    expect(yc.endpoint).toBe(dk.endpoint);
    expect(String(yc.headers.Authorization)).toMatch(/^vapid t=.+, k=/);
    expect(String(yc.headers.Authorization)).toContain(khoa.publicKey);
    expect(yc.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(Number(yc.headers.TTL)).toBe(12 * 3600);
    // Thân đã mã hóa: không chứa nguyên văn nội dung.
    expect(Buffer.from(yc.body as Buffer).toString("utf8")).not.toContain("luyen-tap");
  });

  test("gửi thành công trả ok; dịch vụ đẩy trả 410 hoặc 500 thì hàm gửi báo đúng mã", async () => {
    const guiGia = (status: number) =>
      (async () => {
        if (status >= 400) throw new webpush.WebPushError("lỗi", status, {}, "", dk.endpoint);
        return { statusCode: status, body: "", headers: {} };
      }) as unknown as typeof webpush.sendNotification;
    expect(await taoHamGui(env, guiGia(201))!(dk, "{}")).toEqual({ ok: true });
    expect(await taoHamGui(env, guiGia(410))!(dk, "{}")).toEqual({ ok: false, status: 410 });
    expect(await taoHamGui(env, guiGia(500))!(dk, "{}")).toEqual({ ok: false, status: 500 });
  });

  test("lỗi mạng không có mã HTTP thì báo mã 0, không bị coi là hết hạn", async () => {
    const guiLoiMang = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof webpush.sendNotification;
    expect(await taoHamGui(env, guiLoiMang)!(dk, "{}")).toEqual({ ok: false, status: 0 });
  });
});
