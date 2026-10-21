/**
 * Duyệt nội dung trò chơi và dữ liệu tra cứu trong ứng dụng (docs/PLAN.md GĐ-G0): quyền soạn và
 * duyệt, tình huống chỉ dùng được khi mọi mục được trỏ tới vẫn đã duyệt đúng phiên bản, sửa dòng
 * đã duyệt thì về chờ duyệt, nạp tệp lần hai không đổi trạng thái dòng không đổi nội dung.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import type { DongMucPhat } from "@qdpl/dao-tao";
import { napTraCuuNhanh, noiDungDungDuoc, sql } from "@qdpl/db";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-noi-dung-tc";
const MA_MP = `${PREFIX}-oto-1`;
const URN = "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6";

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

async function taoTaiKhoan(ten: string, role: string): Promise<string> {
  const [acc] = await sql<Array<{ id: string }>>`
    INSERT INTO accounts (email, role) VALUES (${`${PREFIX}-${ten}@vidu.vn`}, ${role}) RETURNING id`;
  return (await createSession(acc!.id, "test")).token;
}

async function donDep() {
  await sql`DELETE FROM game_content WHERE title LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`} OR actor LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM procedures WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

function dongMucPhat(ma: string, phatTu: number, trangThai: DongMucPhat["trang_thai"]): DongMucPhat {
  return {
    ma,
    xe: "o_to",
    nhom: "Tốc độ",
    hanh_vi: `${PREFIX} chạy quá tốc độ`,
    tu_khoa: [],
    phat_tu: phatTu,
    phat_den: phatTu + 200_000,
    hinh_thuc_bo_sung: [],
    tru_diem: null,
    toc_do_vuot: null,
    can_cu: URN,
    hieu_luc_tu: "2025-01-01",
    trang_thai: trangThai,
  } as DongMucPhat;
}

let canBo: string;
let bienTap: string;
let phapChe: string;

beforeAll(async () => {
  await donDep();
  canBo = await taoTaiKhoan("can-bo", "can_bo");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
  await napTraCuuNhanh([dongMucPhat(MA_MP, 800_000, "da_duyet")], [], { tienTo: PREFIX });
});

afterAll(async () => {
  await donDep();
});

describe("nội dung trò chơi", () => {
  let id: string;

  test("cán bộ không vào được API quản trị (403); chưa đăng nhập 401", async () => {
    expect((await goi("GET", "/v1/quan-tri/noi-dung-tro-choi")).status).toBe(401);
    expect((await goi("GET", "/v1/quan-tri/noi-dung-tro-choi", canBo)).status).toBe(403);
    expect(
      (await goi("PATCH", "/v1/quan-tri/noi-dung-tro-choi/tro-choi/thu_nghiem", bienTap, { enabled: false }))
        .status,
    ).toBe(403);
  });

  test("biên tập viên tạo và gửi duyệt; tham chiếu nhập dạng dòng loai:ma", async () => {
    const r = await goi("POST", "/v1/quan-tri/noi-dung-tro-choi", bienTap, {
      game_code: "thu_nghiem",
      title: `${PREFIX} tình huống quá tốc độ`,
      payload: { loi_ke: "Xe ô tô chạy 70 km/h trong khu dân cư." },
      answer: { muc_phat: MA_MP },
      citations: [URN],
      refs: `violation:${MA_MP}`,
      gui_duyet: true,
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      status: "cho_duyet",
      version: 1,
      refs: [{ loai: "violation", ma: MA_MP }],
    });
    id = r.body.id;
    const sai = await goi("POST", "/v1/quan-tri/noi-dung-tro-choi", bienTap, {
      game_code: "thu_nghiem",
      title: `${PREFIX} sai tham chiếu`,
      refs: "khong-dung-dang",
    });
    expect(sai.status).toBe(400);
  });

  test("biên tập viên không duyệt được (403); tình huống chờ duyệt không dùng được cho trò chơi", async () => {
    expect((await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, bienTap)).status).toBe(403);
    expect((await noiDungDungDuoc("thu_nghiem")).map((c) => c.id)).not.toContain(id);
  });

  test("duyệt thì ghi phiên bản của mục được trỏ tới và dùng được cho trò chơi", async () => {
    const r = await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, phapChe);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      status: "da_duyet",
      refs: [{ loai: "violation", ma: MA_MP, version: 1 }],
    });
    expect((await noiDungDungDuoc("thu_nghiem")).map((c) => c.id)).toContain(id);
    const ls = await goi("GET", `/v1/quan-tri/noi-dung-tro-choi/${id}`, bienTap);
    expect(ls.body.lich_su.map((h: any) => h.action)).toEqual(["tao", "gui_duyet", "duyet"]);
  });

  test("mức phạt được trỏ tới bị sửa: tình huống rời trò chơi, hiện ở Cần xem lại; duyệt lại cả hai thì quay lại", async () => {
    const mp = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA_MP}`, bienTap);
    const sua = await goi("PUT", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA_MP}`, bienTap, {
      behavior: mp.body.behavior,
      group_name: mp.body.group_name,
      fine_min: 900_000,
      fine_max: 1_000_000,
      point_deduction: null,
      extra_penalties: [],
      citation_urn: URN,
      version: mp.body.version,
    });
    expect(sua.status).toBe(200);
    expect(sua.body).toMatchObject({ trang_thai: "cho_duyet", version: 2 });

    expect((await noiDungDungDuoc("thu_nghiem")).map((c) => c.id)).not.toContain(id);
    const xl = await goi("GET", "/v1/quan-tri/noi-dung-tro-choi?can_xem_lai=1", bienTap);
    const dong = xl.body.items.find((c: any) => c.id === id);
    expect(dong.needs_review_reason).toContain("không còn ở trạng thái đã duyệt");

    // Duyệt lại mức phạt: vẫn chưa dùng được, vì tình huống ghi phiên bản 1.
    expect((await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA_MP}/duyet`, phapChe)).status).toBe(
      200,
    );
    expect((await noiDungDungDuoc("thu_nghiem")).map((c) => c.id)).not.toContain(id);

    // Sửa tình huống (về chờ duyệt, phiên bản 2), duyệt lại: ghi phiên bản 2 của mức phạt.
    const nd = await goi("GET", `/v1/quan-tri/noi-dung-tro-choi/${id}`, bienTap);
    const s2 = await goi("PUT", `/v1/quan-tri/noi-dung-tro-choi/${id}`, bienTap, {
      game_code: "thu_nghiem",
      title: nd.body.title,
      payload: nd.body.payload,
      answer: nd.body.answer,
      citations: nd.body.citations,
      refs: [{ loai: "violation", ma: MA_MP }],
      version: nd.body.version,
    });
    expect(s2.body).toMatchObject({ status: "cho_duyet", version: 2 });
    // Gửi phiên bản cũ: 409.
    expect(
      (
        await goi("PUT", `/v1/quan-tri/noi-dung-tro-choi/${id}`, bienTap, {
          game_code: "thu_nghiem",
          title: nd.body.title,
          version: 1,
        })
      ).status,
    ).toBe(409);
    const d2 = await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${id}/duyet`, phapChe);
    expect(d2.body.refs).toEqual([{ loai: "violation", ma: MA_MP, version: 2 }]);
    expect((await noiDungDungDuoc("thu_nghiem")).map((c) => c.id)).toContain(id);
  });

  test("không duyệt được tình huống trỏ tới mục chưa duyệt", async () => {
    await napTraCuuNhanh(
      [dongMucPhat(MA_MP, 900_000, "da_duyet"), dongMucPhat(`${PREFIX}-nhap`, 1, "nhap")],
      [],
      {
        tienTo: PREFIX,
      },
    );
    const r = await goi("POST", "/v1/quan-tri/noi-dung-tro-choi", bienTap, {
      game_code: "thu_nghiem",
      title: `${PREFIX} trỏ tới bản nháp`,
      refs: [{ loai: "violation", ma: `${PREFIX}-nhap` }],
      gui_duyet: true,
    });
    const d = await goi("POST", `/v1/quan-tri/noi-dung-tro-choi/${r.body.id}/duyet`, phapChe);
    expect(d.status).toBe(409);
    expect(JSON.stringify(d.body)).toContain("chưa được duyệt");
  });
});

describe("dữ liệu tra cứu", () => {
  const MA = `${PREFIX}-oto-2`;

  test("cán bộ nhận 403; loại lạ 404", async () => {
    expect((await goi("GET", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", canBo)).status).toBe(403);
    expect((await goi("GET", "/v1/quan-tri/du-lieu-tra-cuu/khong-co", bienTap)).status).toBe(404);
  });

  test("nạp chế độ chờ duyệt: dòng mới vào chờ duyệt; nạp lại không đổi nội dung thì giữ trạng thái", async () => {
    await napTraCuuNhanh([dongMucPhat(MA, 500_000, "da_duyet")], [], { cheDo: "cho_duyet", tienTo: PREFIX });
    let r = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}`, bienTap);
    expect(r.body).toMatchObject({ trang_thai: "cho_duyet", version: 1 });

    expect((await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/duyet`, bienTap)).status).toBe(
      403,
    );
    expect((await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/duyet`, phapChe)).status).toBe(
      200,
    );

    await napTraCuuNhanh([dongMucPhat(MA, 500_000, "da_duyet")], [], { cheDo: "cho_duyet", tienTo: PREFIX });
    r = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}`, bienTap);
    expect(r.body).toMatchObject({ trang_thai: "da_duyet", version: 1 });

    // Tệp đổi mức tiền: dòng đã duyệt về chờ duyệt, tăng phiên bản.
    await napTraCuuNhanh([dongMucPhat(MA, 600_000, "da_duyet")], [], { cheDo: "cho_duyet", tienTo: PREFIX });
    r = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}`, bienTap);
    expect(r.body).toMatchObject({ trang_thai: "cho_duyet", version: 2 });
    expect(r.body.lich_su.map((h: any) => h.action)).toContain("duyet");
  });

  test("dòng chờ duyệt không hiện ở tra cứu nhanh của người học", async () => {
    const r = await goi("GET", `/v1/tra-cuu/muc-phat?q=${encodeURIComponent(PREFIX)}`, canBo);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(MA);
  });

  test("từ chối cần lý do; lưu trữ chuyển sang ngừng", async () => {
    expect(
      (await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/tu-choi`, phapChe, {})).status,
    ).toBe(400);
    const tc = await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/tu-choi`, phapChe, {
      ly_do: "Mức tiền chưa khớp nguyên văn.",
    });
    expect(tc.body).toMatchObject({ trang_thai: "tu_choi", reject_reason: "Mức tiền chưa khớp nguyên văn." });
    const lt = await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/luu-tru`, bienTap);
    expect(lt.body).toMatchObject({ trang_thai: "luu_tru", status: "ngung" });
  });
});

describe("soạn dữ liệu tra cứu trong ứng dụng", () => {
  const MA = `${PREFIX}-soan-1`;
  const MA_QT = `${PREFIX}-soan-qt`;
  const mucPhat = {
    code: MA,
    vehicle: "mo_to",
    group_name: "Thiết bị an toàn",
    behavior: `${PREFIX} không đội mũ bảo hiểm`,
    keywords: ["mũ bảo hiểm"],
    fine_min: 400_000,
    fine_max: 600_000,
    extra_penalties: [],
    citation_urn: URN,
    effective_from: "2025-01-01",
  };

  test("cán bộ 403; loại chưa soạn được 400; dữ liệu sai 400", async () => {
    expect((await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", canBo, mucPhat)).status).toBe(403);
    expect((await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/bien-bao", bienTap, mucPhat)).status).toBe(400);
    const sai = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", bienTap, {
      ...mucPhat,
      fine_min: 700_000,
    });
    expect(sai.status).toBe(400);
    const maSai = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", bienTap, {
      ...mucPhat,
      code: "Mã Có Dấu",
    });
    expect(maSai.status).toBe(400);
  });

  test("tạo mức phạt: vào chờ duyệt, ghi lịch sử; trùng mã 409; duyệt xong hiện ở tra cứu nhanh", async () => {
    const r = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", bienTap, {
      ...mucPhat,
      gui_duyet: true,
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ code: MA, trang_thai: "cho_duyet", version: 1, vehicle: "mo_to" });
    expect((await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", bienTap, mucPhat)).status).toBe(409);

    const ct = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}`, bienTap);
    expect(ct.body.lich_su.map((h: any) => h.action)).toEqual(expect.arrayContaining(["tao", "gui_duyet"]));

    expect((await goi("POST", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}/duyet`, phapChe)).status).toBe(
      200,
    );
    const tc = await goi(
      "GET",
      `/v1/tra-cuu/muc-phat?q=${encodeURIComponent("khong doi mu bao hiem")}`,
      canBo,
    );
    expect(JSON.stringify(tc.body)).toContain(MA);
  });

  test("nạp lại tệp không chuyển dòng soạn trong ứng dụng sang ngừng", async () => {
    await napTraCuuNhanh([], [], { cheDo: "cho_duyet", tienTo: PREFIX });
    const r = await goi("GET", `/v1/quan-tri/du-lieu-tra-cuu/muc-phat/${MA}`, bienTap);
    expect(r.body).toMatchObject({ trang_thai: "da_duyet" });
  });

  test("tạo quy trình ở bản nháp", async () => {
    const r = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/quy-trinh", bienTap, {
      code: MA_QT,
      kind: "vi_pham",
      title: `${PREFIX} quy trình thử`,
      steps: [{ tieu_de: "Dừng xe", mo_ta: "Ra hiệu lệnh dừng xe.", can_cu: null }],
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ code: MA_QT, trang_thai: "nhap", kind: "vi_pham" });
    const rong = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/quy-trinh", bienTap, {
      code: `${MA_QT}-2`,
      kind: "vi_pham",
      title: "Không có bước",
      steps: [],
    });
    expect(rong.status).toBe(400);
  });

  test("danh sách báo số chờ duyệt của từng loại; duyệt nhiều dòng một lần bỏ qua dòng không chờ duyệt", async () => {
    const ma = [`${MA}-hl-1`, `${MA}-hl-2`];
    for (const code of ma) {
      const r = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat", bienTap, {
        ...mucPhat,
        code,
        gui_duyet: true,
      });
      expect(r.status).toBe(201);
    }
    const duong = `/v1/quan-tri/du-lieu-tra-cuu/muc-phat?q=${encodeURIComponent(`${MA}-hl`)}`;
    const truoc = await goi("GET", duong, bienTap);
    expect(truoc.body.tong).toBe(2);
    expect(Object.keys(truoc.body.dem_cho_duyet).sort()).toEqual(
      ["bien-bao", "bieu-mau", "luat-giay-to", "muc-phat", "quy-trinh", "tai-trong", "toc-do-toi-da"].sort(),
    );
    const choTruoc = truoc.body.dem_cho_duyet["muc-phat"];
    expect(choTruoc).toBeGreaterThanOrEqual(2);

    const than = { ma: [...ma, MA] };
    expect(
      (await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat/duyet-hang-loat", bienTap, than)).status,
    ).toBe(403);
    const hl = await goi("POST", "/v1/quan-tri/du-lieu-tra-cuu/muc-phat/duyet-hang-loat", phapChe, than);
    expect(hl.status).toBe(200);
    // MA đã duyệt từ trước nên không còn chờ duyệt.
    expect(hl.body).toEqual({ da_duyet: 2, bo_qua: [MA] });

    const sau = await goi("GET", duong, bienTap);
    expect(sau.body.items.map((d: any) => d.trang_thai)).toEqual(["da_duyet", "da_duyet"]);
    expect(sau.body.dem_cho_duyet["muc-phat"]).toBe(choTruoc - 2);
  });
});
