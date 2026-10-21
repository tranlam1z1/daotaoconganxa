import { describe, expect, test } from "bun:test";
import { choPhepDoc, docKetQua } from "./giong-doc.ts";

describe("docKetQua", () => {
  test("xong khi có trạng thái SUCCESS và link âm thanh", () => {
    const json = {
      status: 1,
      result: {
        request_id: "440d84ff",
        status: "SUCCESS",
        progress: 100,
        audio_link: "https://vbee.vn/s/440d84ff/abc",
      },
    };
    expect(docKetQua(json)).toEqual({ trangThai: "xong", link: "https://vbee.vn/s/440d84ff/abc" });
  });

  test("đang xử lý thì chờ tiếp", () => {
    expect(docKetQua({ status: 1, result: { status: "IN_PROGRESS" } })).toEqual({ trangThai: "cho" });
    // Phản hồi hỏng hoặc rỗng không phải lý do bỏ cuộc: lần hỏi sau có thể trả đúng.
    expect(docKetQua(null)).toEqual({ trangThai: "cho" });
  });

  test("báo lỗi khi Vbee trả status 0 hoặc trạng thái thất bại", () => {
    expect(docKetQua({ status: 0, error_message: "Validation Failed" }).trangThai).toBe("loi");
    expect(docKetQua({ status: 1, result: { status: "FAILURE" } }).trangThai).toBe("loi");
  });
});

describe("choPhepDoc", () => {
  test("chặn khi vượt hạn mức trong cửa sổ, mở lại khi hết cửa sổ", () => {
    const ip = `kiem-thu-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 120; i++) expect(choPhepDoc(ip, t0)).toBe(true);
    expect(choPhepDoc(ip, t0)).toBe(false);
    expect(choPhepDoc(ip, t0 + 10 * 60_000)).toBe(true);
  });
});
