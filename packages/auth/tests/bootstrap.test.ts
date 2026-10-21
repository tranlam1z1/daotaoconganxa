/**
 * Quy tắc "người đăng nhập đầu tiên làm quản trị".
 *
 * Test chạy trong một giao dịch rồi cuộn lại: phải xóa sạch bảng accounts mới dựng lại
 * được cảnh kho trống, mà xóa thật thì hỏng dữ liệu của các tệp test khác.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { sql, type Tx } from "@qdpl/db";
import { upsertAccount } from "../src/rbac.ts";

class CuonLai extends Error {}

/** Chạy fn trong giao dịch rồi cuộn lại; trả về giá trị fn tạo ra. */
async function khoTrong<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let ketQua: T | undefined;
  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM mcp_call_log`;
      await tx`DELETE FROM sessions`;
      await tx`DELETE FROM accounts`;
      ketQua = await fn(tx);
      throw new CuonLai();
    });
  } catch (e) {
    if (!(e instanceof CuonLai)) throw e;
  }
  return ketQua as T;
}

const BOOTSTRAP_CU = process.env.AUTH_BOOTSTRAP_ADMIN;
afterEach(() => {
  if (BOOTSTRAP_CU === undefined) delete process.env.AUTH_BOOTSTRAP_ADMIN;
  else process.env.AUTH_BOOTSTRAP_ADMIN = BOOTSTRAP_CU;
});

describe("người đăng nhập đầu tiên", () => {
  test("kho trống: người đầu tiên thành quản trị, người sau vẫn là khách", async () => {
    const { dau, sau } = await khoTrong(async (tx) => {
      const dau = await upsertAccount({ email: "dau-tien@vidu.vn", sub: "sub-dau" }, tx);
      const sau = await upsertAccount({ email: "thu-hai@vidu.vn", sub: "sub-hai" }, tx);
      return { dau, sau };
    });
    expect(dau.role).toBe("quan_tri");
    expect(dau.laQuanTriDauTien).toBe(true);
    expect(sau.role).toBe("khach");
    expect(sau.laQuanTriDauTien).toBe(false);
  });

  test("việc cấp quyền đầu tiên được ghi vào nhật ký kiểm toán", async () => {
    const nhatKy = await khoTrong(async (tx) => {
      await upsertAccount({ email: "dau-tien@vidu.vn", sub: "sub-dau" }, tx);
      return (await tx`SELECT actor, action, target FROM audit_log
                       WHERE action = 'account:bootstrap_admin'
                       ORDER BY id DESC LIMIT 1`) as any[];
    });
    expect(nhatKy[0]?.target).toBe("dau-tien@vidu.vn");
  });

  test("đăng nhập lại của người đầu tiên không cấp lại quyền và không tạo tài khoản mới", async () => {
    const lai = await khoTrong(async (tx) => {
      await upsertAccount({ email: "dau-tien@vidu.vn", sub: "sub-dau" }, tx);
      return await upsertAccount({ email: "dau-tien@vidu.vn", sub: "sub-dau" }, tx);
    });
    expect(lai.role).toBe("quan_tri");
    expect(lai.vuaTao).toBe(false);
    expect(lai.laQuanTriDauTien).toBe(false);
  });

  test("AUTH_BOOTSTRAP_ADMIN=0 thì kho trống cũng không cấp quyền quản trị", async () => {
    process.env.AUTH_BOOTSTRAP_ADMIN = "0";
    const dau = await khoTrong((tx) => upsertAccount({ email: "dau-tien@vidu.vn", sub: "s" }, tx));
    expect(dau.role).toBe("khach");
    expect(dau.laQuanTriDauTien).toBe(false);
  });
});
