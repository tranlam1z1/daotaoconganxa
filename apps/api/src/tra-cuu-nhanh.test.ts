/**
 * Kiểm thử /v1/tra-cuu/* (docs/PLAN.md GĐ5) trên Postgres test thật.
 *
 * Dữ liệu mẫu trỏ căn cứ vào văn bản mẫu Nghị định số 100/2026/NĐ-CP có sẵn trong CSDL test,
 * vì kho test không có Nghị định số 168/2024/NĐ-CP. Mức tiền là số giả để thử luồng, không
 * phải mức phạt thật.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { DongMucPhat, QuyTrinh } from "@qdpl/dao-tao";
import { kiemTraCanCuTraCuu, napTraCuuNhanh, sql } from "@qdpl/db";
import { AS_OF_SAU, AS_OF_TRUOC, URN_GOC } from "../../../packages/search/src/testing.ts";
import { createApp } from "./app.ts";

const app = createApp();
const E = encodeURIComponent;
const CAN_CU = `${URN_GOC}#dieu-3.khoan-2`;

// Mọi mã mẫu bắt đầu bằng "t-": nạp chỉ quét trong phạm vi này, và các kiểm tra chỉ xét các
// dòng mẫu, để test không đụng hay bị nhiễu bởi dữ liệu thật khi CSDL test cũng là CSDL phát triển.
const TIEN_TO = { tienTo: "t-" };
const cuaTest = (items: any[]) => items.filter((i) => String(i.ma).startsWith("t-"));

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(`http://test${path}`);
  return { status: res.status, body: await res.json() };
}

function dong(p: Partial<DongMucPhat> & Pick<DongMucPhat, "ma">): DongMucPhat {
  return {
    xe: "mo_to",
    nhom: "Nồng độ cồn",
    hanh_vi: "Hành vi mẫu",
    tu_khoa: [],
    phat_tu: 1_000_000,
    phat_den: 2_000_000,
    hinh_thuc_bo_sung: [],
    can_cu: CAN_CU,
    hieu_luc_tu: "2026-01-01",
    trang_thai: "da_duyet",
    ...p,
  };
}

const MUC_PHAT: DongMucPhat[] = [
  dong({ ma: "t-con-1", hanh_vi: "Có nồng độ cồn mức thứ nhất", tu_khoa: ["rượu bia"], tru_diem: 4 }),
  dong({
    ma: "t-con-2",
    hanh_vi: "Có nồng độ cồn mức thứ hai",
    phat_tu: 6_000_000,
    phat_den: 8_000_000,
    tru_diem: 10,
  }),
  dong({
    ma: "t-con-3",
    hanh_vi: "Có nồng độ cồn mức thứ ba",
    phat_tu: 8_000_000,
    phat_den: 10_000_000,
    hinh_thuc_bo_sung: ["Tước quyền sử dụng giấy phép lái xe từ 22 tháng đến 24 tháng"],
  }),
  dong({
    ma: "t-con-oto",
    xe: "o_to",
    hanh_vi: "Ô tô có nồng độ cồn",
    phat_tu: 6_000_000,
    phat_den: 8_000_000,
  }),
  dong({ ma: "t-con-nhap", hanh_vi: "Có nồng độ cồn, dòng đang biên tập", trang_thai: "nhap" }),
  // Hai dòng cùng hành vi, nối tiếp nhau theo hiệu lực: tra theo ngày phải ra đúng một dòng.
  dong({
    ma: "t-mu-cu",
    nhom: "Mũ bảo hiểm",
    hanh_vi: "Không đội mũ bảo hiểm",
    phat_tu: 100_000,
    phat_den: 200_000,
    hieu_luc_den: "2027-07-01",
  }),
  dong({
    ma: "t-mu-moi",
    nhom: "Mũ bảo hiểm",
    hanh_vi: "Không đội mũ bảo hiểm",
    phat_tu: 400_000,
    phat_den: 600_000,
    hieu_luc_tu: "2027-07-01",
  }),
  dong({
    ma: "t-td-5",
    nhom: "Tốc độ",
    hanh_vi: "Quá tốc độ từ 5 đến dưới 10",
    toc_do_vuot: { tu: 5, den: 10, bien: "[)" },
  }),
  dong({
    ma: "t-td-10",
    nhom: "Tốc độ",
    hanh_vi: "Quá tốc độ từ 10 đến 20",
    toc_do_vuot: { tu: 10, den: 20, bien: "[]" },
  }),
  dong({
    ma: "t-td-20",
    nhom: "Tốc độ",
    hanh_vi: "Quá tốc độ trên 20",
    tru_diem: 4,
    toc_do_vuot: { tu: 20, den: null, bien: "()" },
  }),
  // Căn cứ trỏ tới văn bản chưa nạp vào kho: vẫn trả về, nhưng giao diện không được dẫn tới trang đọc.
  dong({
    ma: "t-chua-co",
    nhom: "Kiểm thử căn cứ",
    hanh_vi: "Hành vi có căn cứ chưa nạp",
    can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-chua-xac-dinh",
  }),
];

const QUY_TRINH: QuyTrinh[] = [
  {
    ma: "t-quy-trinh",
    loai: "vi_pham",
    tieu_de: "Quy trình mẫu",
    tom_tat: "Dùng để kiểm thử",
    cac_buoc: [
      { tieu_de: "Bước một", mo_ta: "Làm việc thứ nhất", can_cu: CAN_CU },
      { tieu_de: "Bước hai", mo_ta: "Làm việc thứ hai" },
    ],
    trang_thai: "da_duyet",
  },
  {
    ma: "t-quy-trinh-nhap",
    loai: "tai_nan",
    tieu_de: "Quy trình đang biên tập",
    cac_buoc: [{ tieu_de: "Bước một", mo_ta: "" }],
    trang_thai: "nhap",
  },
];

beforeAll(async () => {
  delete process.env.TRA_CUU_NHANH_BAN_NHAP;
  await napTraCuuNhanh(MUC_PHAT, QUY_TRINH, TIEN_TO);
});

afterAll(async () => {
  await sql`DELETE FROM violations WHERE code LIKE 't-%'`;
  await sql`DELETE FROM procedures WHERE code LIKE 't-%'`;
});

describe("GET /v1/tra-cuu/muc-phat", () => {
  test("tra 'nồng độ cồn' với xe mô tô ra đủ các bậc, kèm số điểm bị trừ", async () => {
    const { status, body } = await get(
      `/v1/tra-cuu/muc-phat?q=${E("nồng độ cồn")}&xe=mo_to&ngay=${AS_OF_TRUOC}`,
    );
    expect(status).toBe(200);
    const ma = cuaTest(body.items)
      .map((i: any) => i.ma)
      .sort();
    expect(ma).toEqual(["t-con-1", "t-con-2", "t-con-3"]);
    const bac1 = body.items.find((i: any) => i.ma === "t-con-1");
    expect(bac1.truDiem).toBe(4);
    expect(bac1.canCu).toBe(CAN_CU);
    expect(bac1.canCuMoDuoc).toBe(true);
    expect(bac1.banNhap).toBe(false);
    const bac3 = body.items.find((i: any) => i.ma === "t-con-3");
    expect(bac3.hinhThucBoSung[0]).toContain("Tước quyền sử dụng giấy phép lái xe");
  });

  test("tìm không dấu và theo từ khóa đồng nghĩa", async () => {
    const khongDau = await get(`/v1/tra-cuu/muc-phat?q=${E("nong do con")}&xe=mo_to&ngay=${AS_OF_TRUOC}`);
    expect(cuaTest(khongDau.body.items).length).toBe(3);
    const dongNghia = await get(`/v1/tra-cuu/muc-phat?q=${E("rượu bia")}&ngay=${AS_OF_TRUOC}`);
    expect(cuaTest(dongNghia.body.items).map((i: any) => i.ma)).toEqual(["t-con-1"]);
  });

  test("không chọn loại xe thì ra cả ô tô", async () => {
    const { body } = await get(`/v1/tra-cuu/muc-phat?q=${E("nồng độ cồn")}&ngay=${AS_OF_TRUOC}`);
    expect(body.items.some((i: any) => i.xe === "o_to" && i.tenXe === "Ô tô")).toBe(true);
  });

  test("dòng bản nháp không hiện cho người học", async () => {
    const { body } = await get(`/v1/tra-cuu/muc-phat?q=${E("đang biên tập")}&ngay=${AS_OF_TRUOC}`);
    expect(cuaTest(body.items).length).toBe(0);
  });

  test("TRA_CUU_NHANH_BAN_NHAP=1 hiện bản nháp, có đánh dấu", async () => {
    process.env.TRA_CUU_NHANH_BAN_NHAP = "1";
    try {
      const { body } = await get(`/v1/tra-cuu/muc-phat?q=${E("đang biên tập")}&ngay=${AS_OF_TRUOC}`);
      expect(cuaTest(body.items).map((i: any) => [i.ma, i.banNhap])).toEqual([["t-con-nhap", true]]);
    } finally {
      delete process.env.TRA_CUU_NHANH_BAN_NHAP;
    }
  });

  test("tra theo ngày ra đúng dòng đang áp dụng", async () => {
    const truoc = await get(`/v1/tra-cuu/muc-phat?q=${E("mũ bảo hiểm")}&ngay=${AS_OF_TRUOC}`);
    expect(cuaTest(truoc.body.items).map((i: any) => i.ma)).toEqual(["t-mu-cu"]);
    const sau = await get(`/v1/tra-cuu/muc-phat?q=${E("mũ bảo hiểm")}&ngay=${AS_OF_SAU}`);
    expect(cuaTest(sau.body.items).map((i: any) => i.ma)).toEqual(["t-mu-moi"]);
  });

  test("căn cứ trỏ tới văn bản chưa có trong kho thì đánh dấu không mở được", async () => {
    const { body } = await get(`/v1/tra-cuu/muc-phat?q=${E("căn cứ chưa nạp")}&ngay=${AS_OF_TRUOC}`);
    expect(cuaTest(body.items).map((i: any) => [i.ma, i.canCuMoDuoc])).toEqual([["t-chua-co", false]]);
  });

  test("loại xe sai trả 400", async () => {
    const { status, body } = await get(`/v1/tra-cuu/muc-phat?xe=tau_bay`);
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });
});

describe("GET /v1/tra-cuu/toc-do", () => {
  const tra = (choPhep: number, doDuoc: number) =>
    get(`/v1/tra-cuu/toc-do?xe=mo_to&cho_phep=${choPhep}&do_duoc=${doDuoc}&ngay=${AS_OF_TRUOC}`);

  test("vượt 7, 10, 20, 25 km/h rơi đúng bậc", async () => {
    expect((await tra(50, 57)).body.ketQua.ma).toBe("t-td-5");
    expect((await tra(50, 60)).body.ketQua.ma).toBe("t-td-10");
    expect((await tra(50, 70)).body.ketQua.ma).toBe("t-td-10");
    const tren = await tra(50, 75);
    expect(tren.body.vuot).toBe(25);
    expect(tren.body.ketQua.ma).toBe("t-td-20");
    expect(tren.body.ketQua.moTaTocDo).toBe("trên 20 km/h");
    expect(tren.body.ketQua.truDiem).toBe(4);
    expect(tren.body.ketQua.canCuMoDuoc).toBe(true);
  });

  test("không vượt hoặc vượt dưới 5 km/h thì không có mức phạt", async () => {
    const khong = await tra(60, 55);
    expect(khong.body.vuot).toBe(0);
    expect(khong.body.ketQua).toBeNull();
    expect((await tra(60, 64)).body.ketQua).toBeNull();
  });

  test("thiếu tham số trả 400", async () => {
    expect((await get(`/v1/tra-cuu/toc-do?xe=mo_to&cho_phep=50`)).status).toBe(400);
  });
});

describe("GET /v1/tra-cuu/quy-trinh", () => {
  test("danh sách chỉ có quy trình đã duyệt, không kèm các bước", async () => {
    const { status, body } = await get("/v1/tra-cuu/quy-trinh");
    expect(status).toBe(200);
    expect(cuaTest(body.items).map((i: any) => i.ma)).toEqual(["t-quy-trinh"]);
    expect(body.items[0].soBuoc).toBe(2);
    expect(body.items[0].cacBuoc).toBeUndefined();
  });

  test("chi tiết có các bước theo thứ tự, kèm căn cứ", async () => {
    const { status, body } = await get("/v1/tra-cuu/quy-trinh/t-quy-trinh");
    expect(status).toBe(200);
    expect(body.cacBuoc.map((b: any) => b.tieuDe)).toEqual(["Bước một", "Bước hai"]);
    expect(body.cacBuoc[0].canCu).toBe(CAN_CU);
    expect(body.cacBuoc[1].canCu).toBeNull();
  });

  test("quy trình bản nháp hoặc không tồn tại trả 404", async () => {
    expect((await get("/v1/tra-cuu/quy-trinh/t-quy-trinh-nhap")).status).toBe(404);
    expect((await get("/v1/tra-cuu/quy-trinh/khong-co")).status).toBe(404);
  });
});

describe("nạp và kiểm căn cứ", () => {
  test("nạp lại là cập nhật theo mã; mục không còn trong tệp chuyển sang ngừng", async () => {
    const r = await napTraCuuNhanh(
      MUC_PHAT.filter((d) => d.ma !== "t-con-oto"),
      QUY_TRINH,
      TIEN_TO,
    );
    expect(r.ngung).toBe(1);
    const [row] = await sql`SELECT status FROM violations WHERE code = 't-con-oto'`;
    expect(row?.status).toBe("ngung");
    const [{ n }] = (await sql`SELECT count(*)::int n FROM violations WHERE code LIKE 't-%'`) as any;
    expect(n).toBe(MUC_PHAT.length);
    await napTraCuuNhanh(MUC_PHAT, QUY_TRINH, TIEN_TO);
  });

  test("URN có trong kho thì đạt; URN không có hoặc đã bãi bỏ thì báo hỏng", async () => {
    const hong = await kiemTraCanCuTraCuu(
      [
        CAN_CU,
        `${URN_GOC}#dieu-99`,
        "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-7",
        `${URN_GOC}#dieu-1.khoan-2.diem-c`,
      ],
      AS_OF_SAU,
    );
    const urns = hong.map((h) => h.urn);
    expect(urns).not.toContain(CAN_CU);
    expect(urns).toContain(`${URN_GOC}#dieu-99`);
    expect(urns).toContain("vn:vbqppl:nd:168/2024/NĐ-CP#dieu-7");
    expect(urns).toContain(`${URN_GOC}#dieu-1.khoan-2.diem-c`);
  });
});
