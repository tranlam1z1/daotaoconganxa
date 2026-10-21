/**
 * Soạn mới, sửa mọi trường, xóa và khôi phục dữ liệu tra cứu trong ứng dụng: tốc độ tối đa, tải trọng,
 * mức phạt, quy trình, biển báo (kèm ảnh), luật giấy tờ. Dòng soạn trong ứng dụng không bị lệnh nạp tệp
 * chuyển sang ngừng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSession } from "@qdpl/auth";
import { napTocDoToiDa, sql } from "@qdpl/db";
import { deleteObject, objectExists } from "@qdpl/storage";
import { createApp } from "./app.ts";

const app = createApp();
const PREFIX = "test-qdpl-crud";
const QT = "/v1/quan-tri/du-lieu-tra-cuu";
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
  await sql`DELETE FROM speed_limits WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM load_limits WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM violations WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM document_rules WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM procedures WHERE code LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM content_reviews WHERE ref LIKE ${`${PREFIX}%`} OR actor LIKE ${`${PREFIX}%`}`;
  await sql`DELETE FROM accounts WHERE email LIKE ${`${PREFIX}%`}`;
}

let canBo: string;
let bienTap: string;
let phapChe: string;

beforeAll(async () => {
  await donDep();
  canBo = await taoTaiKhoan("can-bo", "can_bo");
  bienTap = await taoTaiKhoan("bien-tap", "bien_tap");
  phapChe = await taoTaiKhoan("phap-che", "phap_che");
});

afterAll(donDep);

const tocDo = (duoi: string, them: Record<string, unknown> = {}) => ({
  code: `${PREFIX}-${duoi}`,
  vehicle_class: `${PREFIX} xe ô tô con`,
  violation_vehicle: "o_to",
  road_type: `${PREFIX}-${duoi}`,
  road_type_name: "Đường thử",
  max_speed: 60,
  citation_urn: URN,
  effective_from: "2025-01-01",
  ...them,
});

describe("tốc độ tối đa", () => {
  const MA = `${PREFIX}-sl`;

  test("biên tập viên soạn được, cán bộ thì không; dòng vào bản nháp", async () => {
    expect((await goi("POST", `${QT}/toc-do-toi-da`, canBo, tocDo("sl"))).status).toBe(403);
    const r = await goi("POST", `${QT}/toc-do-toi-da`, bienTap, tocDo("sl"));
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      code: MA,
      trang_thai: "nhap",
      version: 1,
      name: `${PREFIX} xe ô tô con — Đường thử`,
      effective_to: null,
    });
  });

  test("trùng mã, trùng loại xe và loại đường, hoặc hiệu lực ngược thì từ chối", async () => {
    expect((await goi("POST", `${QT}/toc-do-toi-da`, bienTap, tocDo("sl"))).status).toBe(409);
    const trung = await goi("POST", `${QT}/toc-do-toi-da`, bienTap, {
      ...tocDo("sl"),
      code: `${PREFIX}-sl-khac`,
    });
    expect(trung.status).toBe(409);
    expect(trung.body.error.message).toContain("cùng loại xe");
    const nguoc = await goi(
      "POST",
      `${QT}/toc-do-toi-da`,
      bienTap,
      tocDo("sl2", { effective_to: "2024-01-01" }),
    );
    expect(nguoc.status).toBe(400);
  });

  test("sửa được mọi trường; yêu cầu chỉ gửi con số thì các trường khác giữ nguyên", async () => {
    const s = await goi("PUT", `${QT}/toc-do-toi-da/${MA}`, bienTap, {
      vehicle_class: `${PREFIX} xe mô tô`,
      violation_vehicle: "mo_to",
      road_type_name: "Đường thử sửa",
      max_speed: 50,
      citation_urn: URN,
      effective_to: "2030-01-01",
      version: 1,
    });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({
      violation_vehicle: "mo_to",
      name: `${PREFIX} xe mô tô — Đường thử sửa`,
      max_speed: 50,
      road_type: `${PREFIX}-sl`,
    });
    const s2 = await goi("PUT", `${QT}/toc-do-toi-da/${MA}`, bienTap, {
      max_speed: 40,
      citation_urn: URN,
      version: 1,
    });
    expect(s2.body).toMatchObject({ max_speed: 40, violation_vehicle: "mo_to" });
    expect(String(s2.body.effective_to)).toStartWith("2030-01-01");
    expect(String(s2.body.effective_from)).toStartWith("2025-01-01");
  });

  test("lệnh nạp tệp không chuyển dòng soạn trong ứng dụng sang ngừng", async () => {
    await napTocDoToiDa([], { tienTo: PREFIX, cheDo: "cho_duyet" });
    expect((await goi("GET", `${QT}/toc-do-toi-da/${MA}`, bienTap)).body.trang_thai).toBe("nhap");
  });

  test("xóa hẳn dòng nháp; dòng đã từng duyệt chỉ ngừng dùng và khôi phục được", async () => {
    expect((await goi("DELETE", `${QT}/toc-do-toi-da/${MA}`, canBo)).status).toBe(403);
    expect((await goi("DELETE", `${QT}/toc-do-toi-da/${MA}`, bienTap)).status).toBe(200);
    expect((await goi("GET", `${QT}/toc-do-toi-da/${MA}`, bienTap)).status).toBe(404);

    const ma = `${PREFIX}-duyet`;
    await goi("POST", `${QT}/toc-do-toi-da`, bienTap, tocDo("duyet", { gui_duyet: true }));
    expect((await goi("POST", `${QT}/toc-do-toi-da/${ma}/duyet`, phapChe, {})).status).toBe(200);
    expect((await goi("POST", `${QT}/toc-do-toi-da/${ma}/khoi-phuc`, bienTap, {})).status).toBe(409);
    expect((await goi("POST", `${QT}/toc-do-toi-da/${ma}/luu-tru`, bienTap, {})).status).toBe(200);
    const kp = await goi("POST", `${QT}/toc-do-toi-da/${ma}/khoi-phuc`, bienTap, {});
    expect(kp.body.trang_thai).toBe("nhap");
    expect((await goi("DELETE", `${QT}/toc-do-toi-da/${ma}`, bienTap)).status).toBe(409);
  });
});

describe("tải trọng", () => {
  const dong = (duoi: string, them: Record<string, unknown>) => ({
    code: `${PREFIX}-${duoi}`,
    limit_kg: 10_000,
    name: `${PREFIX} giới hạn ${duoi}`,
    citation_urn: URN,
    effective_from: "2025-01-01",
    ...them,
  });

  test("tổng trọng lượng cần loại xe, cụm trục cần số trục và khoảng cách", async () => {
    expect((await goi("POST", `${QT}/tai-trong`, bienTap, dong("tong", { kind: "tong" }))).status).toBe(400);
    expect((await goi("POST", `${QT}/tai-trong`, bienTap, dong("cum", { kind: "cum_truc" }))).status).toBe(
      400,
    );
    const cum = await goi(
      "POST",
      `${QT}/tai-trong`,
      bienTap,
      dong("cum", { kind: "cum_truc", group_axles: 2, spacing_from_cm: 100, spacing_to_cm: 130 }),
    );
    expect(cum.status).toBe(201);
    expect(cum.body).toMatchObject({ group_axles: 2, spacing_from_cm: 100, spacing_to_cm: 130 });
  });

  test("đổi cụm trục thành trục đơn thì bỏ số trục và khoảng cách", async () => {
    const s = await goi("PUT", `${QT}/tai-trong/${PREFIX}-cum`, bienTap, {
      kind: "truc_don",
      limit_kg: 10_000,
      citation_urn: URN,
      version: 1,
    });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ kind: "truc_don", group_axles: null, spacing_from_cm: null });
  });
});

describe("mức phạt và quy trình: sửa đủ trường", () => {
  const MA = `${PREFIX}-mp`;
  const coBan = {
    behavior: `${PREFIX} chở hàng vượt tải trọng`,
    fine_min: 800_000,
    fine_max: 1_000_000,
    extra_penalties: [],
    citation_urn: URN,
  };

  test("sửa loại xe, từ khóa, khung quá tải, hiệu lực; yêu cầu cũ giữ các trường đó", async () => {
    const tao = await goi("POST", `${QT}/muc-phat`, bienTap, {
      ...coBan,
      code: MA,
      vehicle: "mo_to",
      effective_from: "2025-01-01",
    });
    expect(tao.status).toBe(201);
    const s = await goi("PUT", `${QT}/muc-phat/${MA}`, bienTap, {
      ...coBan,
      vehicle: "o_to",
      keywords: ["quá tải"],
      qua_tai_loai: "kiem_dinh",
      qua_tai_tu: 10,
      qua_tai_den: 30,
      effective_to: "2031-01-01",
      version: 1,
    });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ vehicle: "o_to", keywords: ["quá tải"], qua_tai_loai: "kiem_dinh" });
    expect(Number(s.body.qua_tai_den)).toBe(30);
    expect(s.body.search_text).toContain("qua tai");

    const cu = await goi("PUT", `${QT}/muc-phat/${MA}`, bienTap, {
      ...coBan,
      fine_max: 1_200_000,
      version: 1,
    });
    expect(cu.status).toBe(200);
    expect(cu.body).toMatchObject({ vehicle: "o_to", keywords: ["quá tải"], qua_tai_loai: "kiem_dinh" });
    expect(Number(cu.body.qua_tai_tu)).toBe(10);
    expect(String(cu.body.effective_to)).toStartWith("2031-01-01");
  });

  test("khung quá tải ngược, khoảng tốc độ thiếu cận dưới thì 400", async () => {
    const sai = (them: Record<string, unknown>) =>
      goi("PUT", `${QT}/muc-phat/${MA}`, bienTap, { ...coBan, ...them, version: 1 });
    expect((await sai({ qua_tai_tu: 50, qua_tai_den: 20 })).status).toBe(400);
    expect((await sai({ speed_over_max: 20 })).status).toBe(400);
  });

  test("đổi loại quy trình", async () => {
    const ma = `${PREFIX}-qt`;
    const buoc = [{ tieu_de: "Bước một", mo_ta: "Dừng phương tiện" }];
    const tao = await goi("POST", `${QT}/quy-trinh`, bienTap, {
      code: ma,
      kind: "vi_pham",
      title: `${PREFIX} quy trình thử`,
      steps: buoc,
    });
    expect(tao.status).toBe(201);
    const giu = await goi("PUT", `${QT}/quy-trinh/${ma}`, bienTap, {
      title: `${PREFIX} quy trình thử`,
      steps: buoc,
      version: 1,
    });
    expect(giu.body.kind).toBe("vi_pham");
    const doi = await goi("PUT", `${QT}/quy-trinh/${ma}`, bienTap, {
      kind: "tai_nan",
      title: `${PREFIX} quy trình thử`,
      steps: buoc,
      version: 1,
    });
    expect(doi.body.kind).toBe("tai_nan");
  });
});

describe("biển báo", () => {
  // Mã biển theo quy chuẩn không mang tiền tố test: dùng số không có trong QCVN và tự dọn.
  const MA = "P.999z";
  const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"/>');
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

  async function guiForm(
    path: string,
    truong: Record<string, string>,
    tep?: { ten: string; du: Uint8Array },
  ) {
    const form = new FormData();
    for (const [k, v] of Object.entries(truong)) form.set(k, v);
    if (tep) form.set("tep", new File([tep.du as BlobPart], tep.ten));
    const res = await app.request(`http://test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${bienTap}` },
      body: form,
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  }
  const anhCua = async () =>
    ((await sql`SELECT image_uri FROM traffic_signs WHERE code = ${MA}`) as any[])[0]?.image_uri as string;
  const donBien = async () => {
    const uri = await anhCua();
    await sql`DELETE FROM traffic_signs WHERE code = ${MA}`;
    await sql`DELETE FROM content_reviews WHERE kind = 'traffic_sign' AND ref = ${MA}`;
    if (uri) await deleteObject(uri).catch(() => {});
  };
  beforeAll(donBien);
  afterAll(donBien);

  const truong = {
    code: MA,
    group_name: "cam",
    name: `${PREFIX} biển thử`,
    meaning: "Cấm thử nghiệm",
    citation_urn: URN,
  };

  test("mã sai dạng, mã không thuộc nhóm, thiếu ảnh hoặc ảnh giả thì 400", async () => {
    const anh = { ten: "bien.svg", du: SVG };
    expect((await guiForm(`${QT}/bien-bao`, { ...truong, code: "bien-thu" }, anh)).status).toBe(400);
    const saiNhom = await guiForm(`${QT}/bien-bao`, { ...truong, group_name: "nguy_hiem" }, anh);
    expect(saiNhom.status).toBe(400);
    expect(saiNhom.body.error.message).toContain("không thuộc nhóm");
    expect((await guiForm(`${QT}/bien-bao`, truong)).status).toBe(400);
    expect((await guiForm(`${QT}/bien-bao`, truong, { ten: "bien.png", du: SVG })).status).toBe(400);
    expect(await anhCua()).toBeUndefined();
  });

  test("soạn biển kèm ảnh, đổi nhóm sai mã thì từ chối, thay ảnh gỡ ảnh cũ, xóa gỡ ảnh", async () => {
    const tao = await guiForm(`${QT}/bien-bao`, truong, { ten: "bien.svg", du: SVG });
    expect(tao.status).toBe(201);
    expect(tao.body).toMatchObject({ code: MA, trang_thai: "nhap", group_name: "cam" });
    const anhDau = await anhCua();
    expect(await objectExists(anhDau)).toBe(true);
    const tep = anhDau.replace("assets/bien-bao/", "");
    expect((await goi("GET", `/v1/tra-cuu/bien-bao/anh/${encodeURIComponent(tep)}`)).status).toBe(200);

    const sua = { name: truong.name, meaning: truong.meaning, citation_urn: URN, version: 1 };
    expect((await goi("PUT", `${QT}/bien-bao/${MA}`, bienTap, { ...sua, group_name: "phu" })).status).toBe(
      400,
    );
    expect((await goi("PUT", `${QT}/bien-bao/${MA}`, bienTap, sua)).body.group_name).toBe("cam");

    const thay = await guiForm(`${QT}/bien-bao/${MA}/anh`, { version: "1" }, { ten: "moi.png", du: PNG });
    expect(thay.status).toBe(200);
    const anhMoi = await anhCua();
    expect(anhMoi).toEndWith(".png");
    expect(await objectExists(anhDau)).toBe(false);

    expect((await goi("DELETE", `${QT}/bien-bao/${MA}`, bienTap)).status).toBe(200);
    expect(await objectExists(anhMoi)).toBe(false);
  });
});

describe("luật giấy tờ", () => {
  const MA = `${PREFIX}-luat`;
  const luat = (them: Record<string, unknown> = {}) => ({
    code: MA,
    nhom: "giay_to_nguoi_lai",
    check_kind: "phai_co",
    doc_kind: "gplx",
    vehicle_classes: [],
    params: {},
    name: `${PREFIX} phải mang giấy phép lái xe`,
    explanation: "Người lái xe phải mang theo giấy phép lái xe.",
    citation_urn: URN,
    effective_from: "2025-01-01",
    ...them,
  });

  test("kiểu kiểm không hợp nhóm, hoặc thiếu tham số bắt buộc thì 400", async () => {
    const saiNhom = await goi("POST", `${QT}/luat-giay-to`, bienTap, luat({ check_kind: "so_nguoi" }));
    expect(saiNhom.status).toBe(400);
    const thieu = await goi(
      "POST",
      `${QT}/luat-giay-to`,
      bienTap,
      luat({ nhom: "van_tai_khach", check_kind: "lai_lien_tuc", doc_kind: "giam_sat_hanh_trinh" }),
    );
    expect(thieu.status).toBe(400);
    expect(thieu.body.error.message).toContain("toi_da_phut");
  });

  test("soạn luật, đổi sang nhóm vận tải kèm tham số, yêu cầu cũ giữ kiểu kiểm và tham số", async () => {
    const tao = await goi("POST", `${QT}/luat-giay-to`, bienTap, luat());
    expect(tao.status).toBe(201);
    expect(tao.body).toMatchObject({ nhom: "giay_to_nguoi_lai", check_kind: "phai_co", doc_kind: "gplx" });

    const doi = await goi("PUT", `${QT}/luat-giay-to/${MA}`, bienTap, {
      ...luat({
        nhom: "van_tai_khach",
        check_kind: "lai_lien_tuc",
        doc_kind: "giam_sat_hanh_trinh",
        params: { toi_da_phut: 240, nghi_toi_thieu_phut: 15, la: "bỏ" },
      }),
      version: 1,
    });
    expect(doi.status).toBe(200);
    expect(doi.body.params).toEqual({ toi_da_phut: 240, nghi_toi_thieu_phut: 15 });

    const cu = await goi("PUT", `${QT}/luat-giay-to/${MA}`, bienTap, {
      name: `${PREFIX} lái liên tục quá bốn giờ`,
      explanation: "Không lái xe liên tục quá bốn giờ.",
      citation_urn: URN,
      version: 1,
    });
    expect(cu.status).toBe(200);
    expect(cu.body).toMatchObject({ nhom: "van_tai_khach", check_kind: "lai_lien_tuc" });
    expect(cu.body.params).toEqual({ toi_da_phut: 240, nghi_toi_thieu_phut: 15 });
  });
});
