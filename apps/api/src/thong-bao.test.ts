/**
 * Kiểm thử thông báo đẩy (docs/PLAN.md GĐ15) trên Postgres test thật: API đăng ký và cài đặt,
 * chống gửi trùng bằng khóa UNIQUE, xóa đăng ký khi dịch vụ đẩy trả 410, và một nhịp nhắc học
 * đầy đủ với hàm gửi giả (không gọi mạng).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import {
  chayNhacHoc,
  type DangKyDay,
  type GuiDay,
  luuCaiDatNhac,
  luuDangKyDay,
  phatThongBao,
  sql,
} from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-thong-bao";
const endpoint = (ten: string) => `https://push.example.test/${PREFIX}/${ten}`;
const KHOA = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

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

async function taoTaiKhoan(ten: string) {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, 'can_bo') RETURNING id`;
  return { id: acc!.id, token: (await createSession(acc!.id, "test")).token };
}

/** Hàm gửi giả: ghi lại mọi lần gửi, trả mã lỗi theo endpoint nếu có trong `loi`. */
function hamGuiGia(loi: Record<string, number> = {}) {
  const daGui: Array<{ endpoint: string; noiDung: any }> = [];
  const gui: GuiDay = async (dk: DangKyDay, noiDung: string) => {
    daGui.push({ endpoint: dk.endpoint, noiDung: JSON.parse(noiDung) });
    const status = loi[dk.endpoint];
    return status ? { ok: false, status } : { ok: true };
  };
  return { gui, daGui };
}

async function donDep() {
  await sql`DELETE FROM exams WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

let A: { id: string; token: string };
let B: { id: string; token: string };

beforeAll(async () => {
  await donDep();
  A = await taoTaiKhoan("a");
  B = await taoTaiKhoan("b");
});

afterAll(async () => {
  await donDep();
});

describe("API đăng ký và cài đặt", () => {
  test("chưa đăng nhập nhận 401", async () => {
    expect((await goi("GET", "/v1/thong-bao")).status).toBe(401);
    expect((await goi("POST", "/v1/thong-bao/dang-ky", undefined, {})).status).toBe(401);
  });

  test("cấu hình mặc định: chưa có thiết bị, chưa đặt giờ nhắc, yên lặng 22h–6h", async () => {
    const r = await goi("GET", "/v1/thong-bao", A.token);
    expect(r.status).toBe(200);
    expect(r.body.so_thiet_bi).toBe(0);
    expect(r.body.cai_dat).toMatchObject({
      remind_at: null,
      streak_warning: true,
      quiet_from: "22:00",
      quiet_to: "06:00",
    });
  });

  test("đăng ký một trình duyệt; endpoint không phải https bị từ chối", async () => {
    const r = await goi("POST", "/v1/thong-bao/dang-ky", A.token, { endpoint: endpoint("a1"), keys: KHOA });
    expect(r.status).toBe(201);
    expect(r.body.so_thiet_bi).toBe(1);
    const sai = await goi("POST", "/v1/thong-bao/dang-ky", A.token, {
      endpoint: "http://x.test/a",
      keys: KHOA,
    });
    expect(sai.status).toBe(400);
  });

  test("đặt giờ nhắc; giờ sai dạng bị từ chối; chỉ sửa trường gửi lên", async () => {
    const r = await goi("PUT", "/v1/thong-bao/cai-dat", A.token, { remind_at: "19:30" });
    expect(r.body).toMatchObject({ remind_at: "19:30", streak_warning: true });
    expect((await goi("PUT", "/v1/thong-bao/cai-dat", A.token, { remind_at: "25:00" })).status).toBe(400);
    const tat = await goi("PUT", "/v1/thong-bao/cai-dat", A.token, { streak_warning: false });
    expect(tat.body).toMatchObject({ remind_at: "19:30", streak_warning: false });
  });

  test("hủy đăng ký chỉ xóa được thiết bị của chính mình", async () => {
    await goi("POST", "/v1/thong-bao/dang-ky", A.token, { endpoint: endpoint("a2"), keys: KHOA });
    const cuaNguoiKhac = await goi("POST", "/v1/thong-bao/huy", B.token, { endpoint: endpoint("a2") });
    expect(cuaNguoiKhac.body.da_xoa).toBe(0);
    const r = await goi("POST", "/v1/thong-bao/huy", A.token, { endpoint: endpoint("a2") });
    expect(r.body).toMatchObject({ da_xoa: 1, so_thiet_bi: 1 });
  });
});

describe("phát thông báo", () => {
  const tb = {
    kind: "nhac_hoc" as const,
    ref: "2030-01-15",
    tieu_de: "Đến giờ học",
    noi_dung: "x",
    url: "/luyen-tap",
  };

  test("gửi hai lần cùng kind và ref thì chỉ một bản ghi notifications_sent và một lần gửi", async () => {
    const { gui, daGui } = hamGuiGia();
    const lan1 = await phatThongBao(A.id, tb, gui);
    const lan2 = await phatThongBao(A.id, tb, gui);
    expect(lan1).toMatchObject({ moi: true, thanh_cong: 1 });
    expect(lan2.moi).toBe(false);
    expect(daGui).toHaveLength(1);
    expect(daGui[0]!.noiDung).toMatchObject({ tieu_de: "Đến giờ học", url: "/luyen-tap" });
    const rows =
      await sql`SELECT delivered FROM notifications_sent WHERE account_id = ${A.id} AND kind = 'nhac_hoc' AND ref = ${tb.ref}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.delivered).toBe(1);
  });

  test("endpoint trả 410 thì đăng ký bị xóa; lỗi 500 chỉ tăng bộ đếm lỗi", async () => {
    await luuDangKyDay({ accountId: B.id, endpoint: endpoint("b-het-han"), ...KHOA });
    await luuDangKyDay({ accountId: B.id, endpoint: endpoint("b-loi-tam"), ...KHOA });
    const { gui } = hamGuiGia({ [endpoint("b-het-han")]: 410, [endpoint("b-loi-tam")]: 500 });
    const kq = await phatThongBao(B.id, { ...tb, ref: "2030-01-16" }, gui);
    expect(kq).toMatchObject({ moi: true, thanh_cong: 0, da_xoa: 1, that_bai: 1 });
    const con = await sql<Array<{ endpoint: string; failed_count: number }>>`
      SELECT endpoint, failed_count FROM push_subscriptions WHERE account_id = ${B.id}`;
    expect(con.map((r) => r.endpoint)).toEqual([endpoint("b-loi-tam")]);
    expect(con[0]!.failed_count).toBe(1);
  });
});

describe("một nhịp nhắc học", () => {
  test("đúng giờ nhắc thì gửi, nhịp sau trong cùng cửa sổ không gửi lại; giờ yên lặng không gửi", async () => {
    const C = await taoTaiKhoan("c");
    await luuDangKyDay({ accountId: C.id, endpoint: endpoint("c1"), ...KHOA });
    await luuCaiDatNhac(C.id, {
      remind_at: "19:30",
      streak_warning: true,
      new_exam: true,
      new_challenge: false,
      quiet_from: "22:00",
      quiet_to: "06:00",
    });
    const ngay = "2031-03-10";
    const luc = (gio: string) => new Date(`${ngay}T${gio}:00+07:00`);
    const cuaC = (ds: Array<{ endpoint: string; noiDung: any }>) =>
      ds.filter((d) => d.endpoint === endpoint("c1"));
    try {
      const n1 = hamGuiGia();
      await chayNhacHoc(luc("19:30"), n1.gui);
      expect(cuaC(n1.daGui).map((d) => d.noiDung.loai)).toEqual(["nhac_hoc"]);

      const n2 = hamGuiGia();
      await chayNhacHoc(luc("19:45"), n2.gui);
      expect(cuaC(n2.daGui)).toEqual([]);

      const khuya = hamGuiGia();
      await chayNhacHoc(luc("23:00"), khuya.gui);
      expect(cuaC(khuya.daGui)).toEqual([]);
    } finally {
      await sql`DELETE FROM daily_challenges WHERE day = ${ngay}::date`;
    }
  });

  test("có bài thi mới được giao thì báo một lần, bấm vào mở trang Thi", async () => {
    const D = await taoTaiKhoan("d");
    await luuDangKyDay({ accountId: D.id, endpoint: endpoint("d1"), ...KHOA });
    // Không giờ yên lặng, để test không phụ thuộc giờ chạy.
    await luuCaiDatNhac(D.id, {
      remind_at: null,
      streak_warning: false,
      new_exam: true,
      new_challenge: false,
      quiet_from: "00:00",
      quiet_to: "00:00",
    });
    const [de] = await sql<Array<{ id: string }>>`
      INSERT INTO exams (title, question_count, duration_minutes, status)
      VALUES (${`${PREFIX} đề thi`}, 30, 30, 'xuat_ban') RETURNING id`;
    const [giao] = await sql<Array<{ id: string }>>`
      INSERT INTO exam_assignments (exam_id, account_id, opens_at, due_at, assigned_by)
      VALUES (${de!.id}, ${D.id}, now() - interval '1 minute', now() + interval '3 days', ${PREFIX})
      RETURNING id`;
    const cuaD = (ds: Array<{ endpoint: string; noiDung: any }>) =>
      ds.filter((d) => d.endpoint === endpoint("d1"));

    const n1 = hamGuiGia();
    await chayNhacHoc(new Date(), n1.gui);
    expect(cuaD(n1.daGui).map((d) => d.noiDung)).toEqual([
      expect.objectContaining({ loai: "de_thi_moi", url: "/thi", noi_dung: `${PREFIX} đề thi` }),
    ]);
    const [ghi] =
      await sql`SELECT ref FROM notifications_sent WHERE account_id = ${D.id} AND kind = 'de_thi_moi'`;
    expect(ghi!.ref).toBe(giao!.id);

    const n2 = hamGuiGia();
    await chayNhacHoc(new Date(), n2.gui);
    expect(cuaD(n2.daGui)).toEqual([]);
  });
});
