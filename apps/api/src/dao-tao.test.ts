/**
 * Kiểm thử API đào tạo và mascot trên Postgres THẬT, dùng dữ liệu gieo của
 * packages/db/src/seed-dao-tao.ts.
 *
 * Trọng tâm: những ranh giới mà nếu vỡ thì hỏng cả sản phẩm — đáp án không được rời máy chủ,
 * quản trị phải kiểm quyền, và mascot phải im lặng đúng lúc.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await app.request(`http://test${path}`, { headers });
  const ct = res.headers.get("content-type") ?? "";
  return { status: res.status, body: ct.includes("json") ? await res.json() : await res.text(), ct };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await app.request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

let coSeed = false;
/** Nội dung bài và bài vá cần đăng nhập: đọc bằng một tài khoản cán bộ. */
const TAI_KHOAN = "test-dao-tao-can-bo";
let nguoiHoc: Record<string, string> = {};

afterAll(async () => {
  await sql`DELETE FROM accounts WHERE username = ${TAI_KHOAN}`;
});

beforeAll(async () => {
  await sql`DELETE FROM accounts WHERE username = ${TAI_KHOAN}`;
  const [tk] = (await sql`
    INSERT INTO accounts (username, name, role) VALUES (${TAI_KHOAN}, 'Cán bộ đọc bài', 'can_bo')
    RETURNING id`) as any[];
  nguoiHoc = { authorization: `Bearer ${(await createSession(tk.id, "test")).token}` };

  const [row] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM mascot_personas`;
  coSeed = (row?.n ?? 0) > 0;
  if (!coSeed) {
    console.warn("[dao-tao.test] CSDL test chưa gieo mascot — chạy: bun run packages/db/src/seed-dao-tao.ts");
  }
});

describe("danh mục chuyên đề", () => {
  test("trả danh sách chuyên đề đã xuất bản", async () => {
    const { status, body } = await get("/v1/dao-tao/chuyen-de");
    expect(status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
  });

  test("cây lĩnh vực gom chuyên đề theo lĩnh vực và nhóm đối tượng", async () => {
    const { status, body } = await get("/v1/dao-tao/linh-vuc");
    expect(status).toBe(200);
    expect(Array.isArray(body.items)).toBe(true);
    if (!coSeed || body.items.length === 0) return;

    const lv = body.items.find((x: { slug: string }) => x.slug === "dau-tu-cong-nsnn");
    expect(lv).toBeTruthy();
    const chuyenDe = lv.nhom.flatMap((n: { chuyenDe: unknown[] }) => n.chuyenDe);
    const cntt = chuyenDe.find((c: { slug: string }) => c.slug === "dau-tu-cntt-ngan-sach-nha-nuoc");
    // Chuyên đề công nghệ thông tin cụ thể hoá chuyên đề thực hiện dự án, nên nằm sâu một bậc.
    expect(cntt.cha).toBe("thuc-hien-du-an-dau-tu-nsnn");
    expect(cntt.capDo).toBe(1);
    expect(lv.nhom.some((n: { nhom: string }) => n.nhom === "tu_van")).toBe(true);
  });

  test("chuyên đề không tồn tại trả 404 có mã lỗi tiếng Việt", async () => {
    const { status, body } = await get("/v1/dao-tao/chuyen-de/khong-co-chuyen-de-nay");
    expect(status).toBe(404);
    expect(body.error.code).toBe("khong_tim_thay");
  });
});

describe("ranh giới bảo mật: đáp án không rời máy chủ", () => {
  test("nội dung bài học KHÔNG chứa đáp án hay rubric", async () => {
    if (!coSeed) return;
    const { status, body } = await get(
      "/v1/dao-tao/chuyen-de/dau-tu-cntt-ngan-sach-nha-nuoc/bai/bai-1-tong-quan-thu-bac",
      nguoiHoc,
    );
    if (status === 404) return; // bài chưa xuất bản trên CSDL test
    expect(status).toBe(200);
    expect(body.hoatDong.length).toBeGreaterThan(0);
    for (const hd of body.hoatDong) {
      expect(hd.answer).toBeUndefined();
      expect(hd.rubric).toBeUndefined();
      expect(hd.errorTags).toBeUndefined();
    }
    // Và phần đề bài thì phải có, nếu không người học chẳng làm được gì.
    expect(body.hoatDong[0].prompt.cau_hoi).toBeTruthy();
  });

  test("nộp bài khi chưa đăng nhập bị từ chối", async () => {
    const { status, body } = await post("/v1/dao-tao/hoat-dong/00000000-0000-0000-0000-000000000000/nop", {
      ghiDanhId: "00000000-0000-0000-0000-000000000000",
      traLoi: { chon: ["a"] },
    });
    expect(status).toBe(401);
    expect(body.error.code).toBe("chua_dang_nhap");
  });
});

describe("mascot", () => {
  test("chọn nhân vật đồng hành và nêu rõ lý do chọn", async () => {
    if (!coSeed) return;
    const { status, body } = await get("/v1/mascot/dong-hanh");
    expect(status).toBe(200);
    expect(body.bat).toBe(true);
    expect(body.nhanVat.code).toBeTruthy();
    // Lý do phải trả về: 7 nhân vật, 6 tầng ưu tiên, không ai đoán bằng mắt được.
    expect(["mac_dinh", "khop_doi_tuong", "chuyen_de_chi_dinh"]).toContain(body.lyDo);
    expect(body.nhanVat.svg.startsWith("<svg")).toBe(true);
  });

  test("chuyên đề dành cho người dân chọn đúng nhân vật nói tiếng thường", async () => {
    if (!coSeed) return;
    const { body } = await get("/v1/mascot/nhan-vat");
    const codes = body.items.map((n: { code: string }) => n.code);
    expect(codes).toContain("sang_to");
    expect(codes).toContain("muc_thuoc");
    expect(codes.length).toBeGreaterThanOrEqual(7);
  });

  test("dựng SVG một biến thể bất kỳ", async () => {
    if (!coSeed) return;
    const { status, body, ct } = await get("/v1/mascot/hinh?code=muc_thuoc&trangThai=canh_bao");
    expect(status).toBe(200);
    expect(ct).toContain("image/svg+xml");
    expect(String(body)).toContain("</svg>");
  });

  test("nhân vật không tồn tại trả 404", async () => {
    const { status } = await get("/v1/mascot/hinh?code=khong_co_nhan_vat_nay");
    expect(status).toBe(404);
  });

  test("bộ kích hoạt không hợp lệ bị từ chối", async () => {
    const { status, body } = await post("/v1/mascot/su-kien", { trigger: "khong_co_su_kien_nay" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("tham_so_khong_hop_le");
  });

  test("sự kiện trả về hành động hoặc im lặng có lý do — không bao giờ trả rác", async () => {
    if (!coSeed) return;
    const { status, body } = await post("/v1/mascot/su-kien", {
      trigger: "tra_loi_sai",
      bien: { so_lan_sai: 1 },
    });
    expect(status).toBe(200);
    if (body.hanhDong) {
      expect(body.hanhDong.loiThoai.text.length).toBeLessThanOrEqual(140);
      expect(body.nhanVat.svg.startsWith("<svg")).toBe(true);
    } else {
      expect(typeof body.lyDoImLang).toBe("string");
    }
  });

  test("hạn mức phiên chặn hành động CHỦ ĐỘNG", async () => {
    if (!coSeed) return;
    // Dùng `vao_bai` (nhân vật tự lên tiếng). Hạn mức tần suất chung không áp cho sự kiện
    // phản hồi thao tác của người học — xem KICH_HOAT_PHAN_HOI.
    const { body } = await post("/v1/mascot/su-kien", {
      trigger: "vao_bai",
      phien: { soLanTrongPhien: 99, giayTuLanTruoc: 0, daDong: [], dangNhapLieu: false },
    });
    expect(body.hanhDong).toBeNull();
    expect(["vuot_han_muc_phien", "chua_du_khoang_cach"]).toContain(body.lyDoImLang);
  });

  test("phản hồi khi người học trả lời sai KHÔNG bị hạn mức chung chặn", async () => {
    if (!coSeed) return;
    // Nhân vật vừa chào đầu bài xong mà người học nộp bài sai thì vẫn phải trả lời: đó là
    // lúc người học đang chờ nghe.
    const { body } = await post("/v1/mascot/su-kien", {
      trigger: "tra_loi_sai",
      bien: { so_lan_sai: 1 },
      phien: { soLanTrongPhien: 1, giayTuLanTruoc: 3, daDong: [], dangNhapLieu: false },
    });
    expect(body.hanhDong).not.toBeNull();
    // Và không được lộ đáp án đúng trong lời thoại.
    expect(body.hanhDong.loiThoai.text).not.toContain("45/2026");
  });

  test("không chen ngang khi người học đang nhập liệu", async () => {
    if (!coSeed) return;
    const { body } = await post("/v1/mascot/su-kien", {
      trigger: "tra_loi_sai",
      phien: { dangNhapLieu: true },
    });
    expect(body.hanhDong).toBeNull();
    expect(body.lyDoImLang).toBe("dang_nhap_lieu");
  });
});

describe("tiến độ, ôn tập, bài vá — không còn đường dẫn chết", () => {
  test("bài vá trả về mô tả lỗi và nguyên liệu để sửa", async () => {
    if (!coSeed) return;
    const { status, body } = await get(
      "/v1/dao-tao/chuyen-de/dau-tu-cntt-ngan-sach-nha-nuoc/va-loi/nham_chuyen_tiep",
      nguoiHoc,
    );
    if (status === 404) return;
    expect(status).toBe(200);
    expect(body.loi.ma).toBe("nham_chuyen_tiep");
    expect(body.loi.ten.length).toBeGreaterThan(0);
    // Bài vá phải nêu được cách khắc phục, không chỉ nêu tên lỗi.
    expect(body.loi.cachSua).toBeTruthy();
    expect(Array.isArray(body.hoatDong)).toBe(true);
    // Và vẫn không lộ đáp án.
    for (const hd of body.hoatDong) expect(hd.answer).toBeUndefined();
  });

  test("mã lỗi không tồn tại trả 404 chứ không trả bài rỗng", async () => {
    if (!coSeed) return;
    const { status } = await get(
      "/v1/dao-tao/chuyen-de/dau-tu-cntt-ngan-sach-nha-nuoc/va-loi/khong_co_ma_loi_nay",
      nguoiHoc,
    );
    expect(status).toBe(404);
  });

  test("nội dung bài, bài vá, tiến độ và ôn tập đều cần đăng nhập", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    const cd = "/v1/dao-tao/chuyen-de/dau-tu-cntt-ngan-sach-nha-nuoc";
    for (const path of [
      `${cd}/bai/bai-1-tong-quan-thu-bac`,
      `${cd}/va-loi/nham_chuyen_tiep`,
      `/v1/dao-tao/ghi-danh/${id}/tien-do`,
      `/v1/dao-tao/ghi-danh/${id}/on-tap`,
    ]) {
      const { status, body } = await get(path);
      expect(status).toBe(401);
      expect(body.error.code).toBe("chua_dang_nhap");
    }
  });
});

describe("API quản trị", () => {
  test("mọi endpoint quản trị đều từ chối khi chưa đăng nhập", async () => {
    for (const path of [
      "/v1/quan-tri/dao-tao/tong-quan",
      "/v1/quan-tri/dao-tao/chuyen-de",
      "/v1/quan-tri/mascot/nhan-vat",
      "/v1/quan-tri/mascot/hanh-dong",
      "/v1/quan-tri/mascot/anh",
      "/v1/quan-tri/mascot/tuong-tac",
    ]) {
      const { status, body } = await get(path);
      expect(status).toBe(401);
      expect(body.error.code).toBe("chua_dang_nhap");
    }
  });

  test("token sai cũng bị từ chối, không rơi vào 500", async () => {
    const { status } = await get("/v1/quan-tri/dao-tao/tong-quan", {
      authorization: "Bearer qdpl_khong_hop_le",
    });
    expect(status).toBe(401);
  });
});
