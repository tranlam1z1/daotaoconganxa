/**
 * API quản trị ngân hàng câu hỏi (docs/PLAN.md GĐ3), gắn ở /v1/quan-tri/ngan-hang.
 *
 * Quyền:
 *  - Xem, tạo, sửa, gửi duyệt, lưu trữ, nhập và xuất Excel: `bien_tap` trở lên.
 *  - Duyệt và từ chối: `phap_che` trở lên. Đổi được bằng NGAN_HANG_VAI_TRO_DUYET khi khách
 *    hàng chốt ai được duyệt câu hỏi (câu hỏi GAP 4.3-12).
 *  - AI sinh câu hỏi (GĐ8): `bien_tap`; ước tính chi phí vượt NGAN_HANG_AI_TRAN_USD thì cần
 *    `phap_che`. Câu AI sinh luôn vào `cho_duyet`, không đi tắt qua bước duyệt.
 *
 * Luật nghiệp vụ lấy từ @qdpl/dao-tao; tệp này chỉ kiểm quyền, kiểm tham số và gọi CSDL.
 * Mọi phản hồi ở đây có `answer`, nên KHÔNG route người học nào được dùng lại các hàm này.
 */

import { ROLES, type Role } from "@qdpl/auth";
import {
  type CauHoiTuExcel,
  COT_EXCEL_CAU_HOI,
  cauHoiSangDongExcel,
  chamCauHoi,
  chuyenTrangThaiCauHoi,
  DONG_MAU_CAU_HOI,
  deChoNguoiHoc,
  dongExcelSangCauHoi,
  type HanhDongDuyet,
  HUONG_DAN_TEP_CAU_HOI,
  hauQuaSua,
  kiemTraCauHoi,
  LOAI_CAU_HOI,
  MUC_DO_CAU_HOI,
  NGUON_CAU_HOI,
  type NoiDungCauHoi,
  TRANG_THAI_CAU_HOI,
  type TrangThaiCauHoi,
} from "@qdpl/dao-tao";
import {
  BUOC_SINH_CAU_HOI,
  type CauHoiRow,
  cauHoiTheoId,
  chuDeTheoMa,
  chuyenTrangThaiCauHoiDb,
  danhSachCauHoi,
  danhSachChuDeCauHoi,
  danhSachViecSinhCauHoi,
  demCauHoiTheoTrangThai,
  docTepCauHoi,
  LoiTepExcel,
  lichSuDuyetCauHoi,
  luuChuDeCauHoi,
  maCauHoiDaCo,
  sql,
  suaCauHoi,
  type TaoCauHoiInput,
  taoCauHoi,
  taoNhieuCauHoi,
  taoTepCauHoi,
} from "@qdpl/db";
import { Hono } from "hono";
import { z } from "zod";
import { luuAnhBienBao } from "../anh-bien-bao.ts";
import { batBuocVaiTro } from "../auth.ts";
import { chayNen, chayViecTrongApi } from "../chay-soan-bai.ts";
import { badRequest, conflict, notFound, parseBody, parseQuery } from "../http.ts";
import { taoViecSinhCauHoi, tranChiPhiAi } from "../sinh-cau-hoi-ai.ts";

export const nganHang = new Hono();

/** Mục tiêu số câu đã duyệt, hiện ở bộ đếm màn hình quản trị. */
function mucTieu(): number {
  const n = Number(process.env.NGAN_HANG_MUC_TIEU ?? 1000);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

/** Vai trò tối thiểu được duyệt câu hỏi. */
export function vaiTroDuyet(): Role {
  const v = process.env.NGAN_HANG_VAI_TRO_DUYET as Role | undefined;
  return v && (ROLES as readonly string[]).includes(v) ? v : "phap_che";
}

const uuid = z.string().uuid();

/** Ảnh trong kho ảnh biển báo: ảnh của một biển trong danh mục, hoặc ảnh đã tải lên qua POST /cau-hoi/anh. */
const anhTrongKho = z
  .string()
  .regex(/^assets\/bien-bao\/[\w.-]+\.(svg|png|webp)$/i, "Ảnh minh họa không hợp lệ");

const mucLuaChon = z.object({
  id: z.string().trim().min(1).max(40),
  // Chữ được trống khi phương án là hình; `kiemTraCauHoi` kiểm mục nào bắt buộc có chữ.
  text: z.string().trim().max(2000),
  image_uri: anhTrongKho.nullish(),
});

/** Tiêu chí chấm câu tự luận (Rubric của @qdpl/dao-tao); luật hợp lệ do `kiemTraRubric` kiểm. */
export const rubricSchema = z.object({
  tieu_chi: z
    .array(
      z.object({
        ma: z
          .string()
          .trim()
          .regex(/^[a-z0-9_]{1,40}$/, "Mã tiêu chí chỉ gồm chữ thường không dấu, số và dấu gạch dưới"),
        ten: z.string().trim().min(1).max(200),
        trong_so: z.number().min(0).max(100),
        muc: z
          .array(z.object({ diem: z.number().min(0).max(100), mo_ta: z.string().trim().max(1000) }))
          .min(1)
          .max(10),
      }),
    )
    .max(10),
  nguong_dat: z.number().min(0).max(100),
});

const noiDungSchema = z.object({
  topic_code: z.string().trim().max(80).nullish(),
  level: z.enum(MUC_DO_CAU_HOI),
  kind: z.enum(LOAI_CAU_HOI),
  stem: z.string().trim().min(1).max(4000),
  options: z
    .object({
      phuong_an: z.array(mucLuaChon).max(12).optional(),
      trai: z.array(mucLuaChon).max(12).optional(),
      phai: z.array(mucLuaChon).max(12).optional(),
    })
    .default({}),
  answer: z
    .object({
      dung: z.array(z.string()).max(12).optional(),
      thu_tu: z.array(z.string()).max(12).optional(),
      cap: z.record(z.string(), z.string()).optional(),
      o_trong: z.record(z.string(), z.array(z.string().max(200)).max(10)).optional(),
    })
    .default({}),
  explanation: z.string().trim().max(4000).nullish(),
  citations: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  // Câu chấm máy đọc về có `rubric: {}`; gửi lại nguyên như vậy thì coi như không có rubric.
  rubric: z.preprocess(
    (v) => (v && typeof v === "object" && !Object.keys(v).length ? null : v),
    rubricSchema.nullish(),
  ),
  // Các ảnh minh họa của đề, theo thứ tự hiển thị.
  image_uris: z.array(anhTrongKho).max(8).default([]),
  offline_ok: z.boolean().default(true),
});

type NoiDungGui = z.infer<typeof noiDungSchema>;

function sangNoiDung(b: NoiDungGui): NoiDungCauHoi {
  const tuLuan = b.kind === "tu_luan";
  return {
    kind: b.kind,
    level: b.level,
    stem: b.stem,
    // Câu tự luận không có phương án/đáp án máy: bỏ phần form cũ còn sót khi đổi loại câu.
    options: tuLuan ? {} : b.options,
    answer: tuLuan ? {} : b.answer,
    explanation: b.explanation?.trim() || null,
    citations: b.citations,
    image_uris: b.image_uris,
    ...(tuLuan ? { rubric: b.rubric ?? {} } : {}),
  };
}

/** Kiểm tra hợp lệ và tra mã chủ đề; ném 400 kèm danh sách lỗi. */
async function chuanBi(b: NoiDungGui) {
  const nd = sangNoiDung(b);
  const loi = kiemTraCauHoi(nd);
  let topicId: string | null = null;
  if (b.topic_code) {
    const t = await chuDeTheoMa(b.topic_code);
    if (!t) loi.push(`Không có chủ đề mã "${b.topic_code}"`);
    else topicId = t.id;
  }
  if (loi.length) throw badRequest("Câu hỏi chưa hợp lệ", loi);
  return {
    topicId,
    level: nd.level,
    kind: nd.kind,
    stem: nd.stem,
    options: nd.options,
    answer: nd.answer,
    explanation: nd.explanation,
    citations: nd.citations,
    rubric: nd.rubric ?? {},
    imageUris: b.image_uris,
    offlineOk: b.offline_ok,
  };
}

function sangNoiDungTuRow(r: CauHoiRow): NoiDungCauHoi & { id: string } {
  return {
    id: r.id,
    kind: r.kind,
    level: r.level,
    stem: r.stem,
    options: r.options as NoiDungCauHoi["options"],
    answer: r.answer as NoiDungCauHoi["answer"],
    explanation: r.explanation,
    citations: r.citations,
    rubric: (r.rubric ?? {}) as NoiDungCauHoi["rubric"],
    image_uris: r.image_uris,
  };
}

async function layCauHoi(id: string): Promise<CauHoiRow> {
  if (!uuid.safeParse(id).success) throw notFound("Không có câu hỏi này");
  const row = await cauHoiTheoId(id);
  if (!row) throw notFound("Không có câu hỏi này");
  return row;
}

/* ------------------------------------------------------------------ */
/* Chủ đề                                                              */
/* ------------------------------------------------------------------ */

nganHang.get("/chu-de", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  return c.json({ items: await danhSachChuDeCauHoi() });
});

const MA_CHU_DE_RE = /^[a-z0-9-]{2,80}$/;

nganHang.post("/chu-de", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const b = await parseBody(
    c,
    z.object({
      code: z
        .string()
        .trim()
        .regex(MA_CHU_DE_RE, "Mã chủ đề chỉ gồm chữ thường không dấu, số và dấu gạch ngang"),
      name: z.string().trim().min(1).max(200),
      parent_code: z.string().trim().nullish(),
      field_id: uuid.nullish(),
      ordinal: z.number().int().default(0),
    }),
  );
  let parentId: string | null = null;
  let fieldId = b.field_id ?? null;
  if (b.parent_code) {
    const cha = await chuDeTheoMa(b.parent_code);
    if (!cha) throw badRequest(`Không có chủ đề cha mã "${b.parent_code}"`);
    if (cha.code === b.code) throw badRequest("Chủ đề không được làm cha của chính nó");
    parentId = cha.id;
    fieldId ??= cha.field_id;
  }
  const row = await luuChuDeCauHoi({ code: b.code, name: b.name, parentId, fieldId, ordinal: b.ordinal });
  return c.json(row, 201);
});

/* ------------------------------------------------------------------ */
/* Danh sách và bộ đếm                                                 */
/* ------------------------------------------------------------------ */

const locSchema = z.object({
  chu_de: z.string().trim().max(80).optional(),
  muc_do: z.enum(MUC_DO_CAU_HOI).optional(),
  loai: z.enum(LOAI_CAU_HOI).optional(),
  trang_thai: z.enum(TRANG_THAI_CAU_HOI).optional(),
  nguon: z.enum(NGUON_CAU_HOI).optional(),
  viec: uuid.optional(),
  q: z.string().trim().max(200).optional(),
});

nganHang.get("/cau-hoi", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const l = parseQuery(
    c,
    locSchema.extend({
      trang: z.coerce.number().int().min(1).default(1),
      co: z.coerce.number().int().min(1).max(200).default(50),
    }),
  );
  const [ds, dem] = await Promise.all([
    danhSachCauHoi({
      chuDe: l.chu_de,
      mucDo: l.muc_do,
      loai: l.loai,
      trangThai: l.trang_thai,
      nguon: l.nguon,
      viec: l.viec,
      q: l.q,
      limit: l.co,
      offset: (l.trang - 1) * l.co,
    }),
    demCauHoiTheoTrangThai(),
  ]);
  return c.json({
    items: ds.items,
    tong: ds.tong,
    trang: l.trang,
    co: l.co,
    dem,
    muc_tieu: mucTieu(),
    vai_tro_duyet: vaiTroDuyet(),
  });
});

/* ------------------------------------------------------------------ */
/* Excel: mẫu, nhập, xuất                                              */
/* ------------------------------------------------------------------ */

function tepXlsx(duLieu: Uint8Array, ten: string): Response {
  return new Response(duLieu as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${ten}"`,
    },
  });
}

nganHang.get("/mau", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  return tepXlsx(
    await taoTepCauHoi(COT_EXCEL_CAU_HOI, DONG_MAU_CAU_HOI, HUONG_DAN_TEP_CAU_HOI),
    "mau-nhap-cau-hoi.xlsx",
  );
});

nganHang.get("/xuat", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const l = parseQuery(c, locSchema);
  const { items } = await danhSachCauHoi({
    chuDe: l.chu_de,
    mucDo: l.muc_do,
    loai: l.loai,
    trangThai: l.trang_thai,
    nguon: l.nguon,
    q: l.q,
    limit: 20_000,
  });
  const dong = items.map((r) =>
    cauHoiSangDongExcel({ ...sangNoiDungTuRow(r), code: r.code, topic_code: r.topic_code }),
  );
  const ngay = new Date().toISOString().slice(0, 10);
  return tepXlsx(
    await taoTepCauHoi(COT_EXCEL_CAU_HOI, dong, HUONG_DAN_TEP_CAU_HOI),
    `ngan-hang-cau-hoi-${ngay}.xlsx`,
  );
});

/** Nhận tệp từ form multipart (trường `tep`) hoặc từ thân yêu cầu nhị phân. */
async function docTepGuiLen(req: Request): Promise<Uint8Array> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const tep = form.get("tep");
    if (!tep || typeof tep === "string") throw badRequest('Thiếu tệp trong trường "tep"');
    return new Uint8Array(await tep.arrayBuffer());
  }
  return new Uint8Array(await req.arrayBuffer());
}

/** 5 MB đủ cho vài nghìn câu; tệp lớn hơn gần như chắc chắn là nhầm tệp. */
const TEP_TOI_DA = 5 * 1024 * 1024;

nganHang.post("/nhap", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const coKhong = z.enum(["0", "1", "true", "false"]).optional();
  const { chay_thu, tao_chu_de } = parseQuery(c, z.object({ chay_thu: coKhong, tao_chu_de: coKhong }));
  const chayThu = chay_thu === "1" || chay_thu === "true";
  const taoChuDe = tao_chu_de === "1" || tao_chu_de === "true";

  const tep = await docTepGuiLen(c.req.raw);
  if (!tep.byteLength) throw badRequest("Tệp rỗng");
  if (tep.byteLength > TEP_TOI_DA) throw badRequest("Tệp lớn hơn 5 MB. Hãy chia thành nhiều tệp.");

  let dong: Array<{ dong: number; o: Record<string, string> }>;
  try {
    dong = await docTepCauHoi(tep, COT_EXCEL_CAU_HOI, ["chu_de", "muc_do", "loai", "cau_hoi", "dap_an"]);
  } catch (err) {
    if (err instanceof LoiTepExcel) throw badRequest(err.message);
    throw err;
  }

  const chuDe = new Map((await danhSachChuDeCauHoi()).map((t) => [t.code, t.id]));
  const maTrongTep = dong.map((d) => d.o.ma?.trim()).filter((m): m is string => Boolean(m));
  const maDaCo = await maCauHoiDaCo(maTrongTep);
  const daGap = new Set<string>();

  const loi: Array<{ dong: number; loi: string[] }> = [];
  const hopLe: Array<{ dong: number; cau: CauHoiTuExcel }> = [];
  /** Mã chủ đề chưa có trong hệ thống, kèm tên lấy ở cột "Tên chủ đề" và số câu dùng mã đó. */
  const chuDeMoi = new Map<string, { ten: string; so_cau: number }>();
  for (const d of dong) {
    const { cau, loi: loiDoc } = dongExcelSangCauHoi(d.o);
    const loiDong = [...loiDoc];
    if (cau) {
      loiDong.push(...kiemTraCauHoi(cau));
      if (cau.code) {
        if (maDaCo.has(cau.code)) loiDong.push(`Mã câu "${cau.code}" đã có trong ngân hàng`);
        else if (daGap.has(cau.code)) loiDong.push(`Mã câu "${cau.code}" bị lặp trong tệp`);
        daGap.add(cau.code);
      }
      const ma = cau.topic_code;
      if (!ma) loiDong.push("Thiếu mã chủ đề");
      else if (!chuDe.has(ma)) {
        if (!MA_CHU_DE_RE.test(ma)) {
          loiDong.push(
            `Không có chủ đề mã "${ma}". Mã này cũng không dùng để tạo chủ đề mới được: mã chỉ gồm chữ thường không dấu, số và dấu gạch ngang`,
          );
        } else {
          // Chỉ tính cho dòng không còn lỗi nào khác, để không tạo ra chủ đề rỗng.
          if (!loiDong.length) {
            const m = chuDeMoi.get(ma) ?? { ten: "", so_cau: 0 };
            m.ten ||= (d.o.ten_chu_de ?? "").trim().slice(0, 200);
            m.so_cau++;
            chuDeMoi.set(ma, m);
          }
          if (!taoChuDe) loiDong.push(`Không có chủ đề mã "${ma}"`);
        }
      }
    }
    if (loiDong.length || !cau) loi.push({ dong: d.dong, loi: loiDong });
    else hopLe.push({ dong: d.dong, cau });
  }

  let daTao = 0;
  if (!chayThu && hopLe.length) {
    if (taoChuDe) {
      for (const [ma, m] of chuDeMoi) {
        chuDe.set(ma, (await luuChuDeCauHoi({ code: ma, name: m.ten || ma })).id);
      }
    }
    const ds: TaoCauHoiInput[] = hopLe.map(({ cau }) => ({
      code: cau.code,
      topicId: chuDe.get(cau.topic_code!)!,
      level: cau.level,
      kind: cau.kind,
      stem: cau.stem,
      options: cau.options,
      answer: cau.answer,
      explanation: cau.explanation,
      citations: cau.citations,
      rubric: cau.rubric ?? {},
      status: "cho_duyet",
      source: "nhap_excel",
    }));
    daTao = (await taoNhieuCauHoi(ds, p.email)).length;
  }

  return c.json({
    chay_thu: chayThu,
    tao_chu_de: taoChuDe,
    tong_dong: dong.length,
    hop_le: hopLe.length,
    da_tao: daTao,
    chu_de_moi: [...chuDeMoi].map(([ma, m]) => ({ ma, ten: m.ten || ma, so_cau: m.so_cau })),
    loi,
  });
});

/* ------------------------------------------------------------------ */
/* Một câu                                                             */
/* ------------------------------------------------------------------ */

/**
 * POST /cau-hoi/anh: tải ảnh minh họa của một câu hỏi (form multipart, trường `tep`), trả `image_uri`
 * để gửi kèm lúc lưu câu. Ảnh cất cùng chỗ ảnh biển báo nên hiện qua cùng đường /bien-bao/anh/:tep.
 *
 * shortcut: ảnh tải lên rồi không lưu câu, hoặc bị thay, vẫn nằm lại trong kho (lượt thi cũ còn trỏ
 * tới ảnh cũ nên không xóa ngay được); cần dọn thì viết việc quét ảnh không còn câu, biển, lượt nào dùng.
 */
nganHang.post("/cau-hoi/anh", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const form = await c.req.raw.formData().catch(() => null);
  return c.json({ image_uri: await luuAnhBienBao("cau-hoi", form?.get("tep")) }, 201);
});

nganHang.post("/cau-hoi", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const b = await parseBody(c, noiDungSchema.extend({ gui_duyet: z.boolean().default(false) }));
  const nd = await chuanBi(b);
  const row = await taoCauHoi(
    { ...nd, status: b.gui_duyet ? "cho_duyet" : "nhap", source: "nguoi" },
    p.email,
  );
  return c.json(row, 201);
});

nganHang.get("/cau-hoi/:id", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const row = await layCauHoi(c.req.param("id"));
  return c.json({
    ...row,
    lich_su: await lichSuDuyetCauHoi(row.id),
    // Đề đúng như người học sẽ nhận, để màn hình xem trước dựng từ cùng một nguồn.
    de: deChoNguoiHoc(sangNoiDungTuRow(row)),
  });
});

nganHang.put("/cau-hoi/:id", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const cu = await layCauHoi(c.req.param("id"));
  const b = await parseBody(c, noiDungSchema.extend({ version: z.number().int().min(1) }));
  if (b.version !== cu.version) {
    throw conflict("Câu hỏi đã được người khác sửa. Hãy tải lại trang rồi sửa tiếp.");
  }
  const sau = hauQuaSua(cu.status, cu.version);
  if (!sau) throw conflict("Câu hỏi đã lưu trữ, không sửa được.");
  const nd = await chuanBi(b);
  const row = await suaCauHoi(cu.id, nd, cu.version, sau, p.email);
  if (!row) throw conflict("Câu hỏi đã được người khác sửa. Hãy tải lại trang rồi sửa tiếp.");
  return c.json(row);
});

/** Chấm thử một câu trả lời, cho màn hình xem trước của quản trị. */
nganHang.post("/cau-hoi/:id/cham", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const row = await layCauHoi(c.req.param("id"));
  const b = await parseBody(
    c,
    z.object({
      chon: z.array(z.string()).max(12).optional(),
      thu_tu: z.array(z.string()).max(12).optional(),
      cap: z.record(z.string(), z.string()).optional(),
      o_trong: z.record(z.string(), z.string().max(200)).optional(),
    }),
  );
  return c.json(chamCauHoi(sangNoiDungTuRow(row), b));
});

/* ------------------------------------------------------------------ */
/* Duyệt                                                               */
/* ------------------------------------------------------------------ */

/** Vai trò cần cho từng hành động. */
function vaiTroCho(hd: HanhDongDuyet): Role {
  return hd === "duyet" || hd === "tu_choi" ? vaiTroDuyet() : "bien_tap";
}

/** Các trạng thái mà hành động áp dụng được, suy từ luật chuyển trạng thái. */
function trangThaiTruoc(hd: HanhDongDuyet): TrangThaiCauHoi[] {
  return TRANG_THAI_CAU_HOI.filter((t) => chuyenTrangThaiCauHoi(t, hd) !== null);
}

const TEN_HANH_DONG: Record<HanhDongDuyet, string> = {
  gui_duyet: "gửi duyệt",
  duyet: "duyệt",
  tu_choi: "từ chối",
  luu_tru: "lưu trữ",
};

function routeMotCau(duongDan: string, hd: HanhDongDuyet) {
  nganHang.post(`/cau-hoi/:id/${duongDan}`, async (c) => {
    const p = await batBuocVaiTro(c, vaiTroCho(hd));
    const cu = await layCauHoi(c.req.param("id"));
    let ghiChu: string | null = null;
    if (hd === "tu_choi") {
      const b = await parseBody(c, z.object({ ly_do: z.string().trim().min(3).max(1000) }));
      ghiChu = b.ly_do;
    }
    const den = chuyenTrangThaiCauHoi(cu.status, hd);
    if (!den) throw conflict(`Không ${TEN_HANH_DONG[hd]} được câu đang ở trạng thái "${cu.status}".`);
    // Câu còn cảnh báo trùng chỉ được duyệt khi người duyệt xác nhận đã đối chiếu với câu gần giống.
    const canXacNhanTrung = hd === "duyet" && Boolean(cu.duplicate_of);
    if (canXacNhanTrung) {
      const b = (await c.req.json().catch(() => null)) as { xac_nhan_trung?: unknown } | null;
      if (b?.xac_nhan_trung !== true) {
        throw conflict(
          "Câu này đang có cảnh báo trùng. Hãy đối chiếu với câu gần giống rồi xác nhận trước khi duyệt; nếu trùng ý thì từ chối.",
        );
      }
    }
    // Câu gửi duyệt phải hợp lệ: câu nháp được lưu dở, còn câu chờ duyệt thì không.
    if (hd === "gui_duyet") {
      const loi = kiemTraCauHoi(sangNoiDungTuRow(cu));
      if (loi.length) throw badRequest("Câu hỏi chưa hợp lệ", loi);
    }
    const [kq] = await chuyenTrangThaiCauHoiDb([cu.id], [cu.status], den, hd, p.email, ghiChu);
    if (!kq) throw conflict("Trạng thái câu hỏi vừa thay đổi. Hãy tải lại trang.");
    // Đã xác nhận không trùng: gỡ cảnh báo để câu đã duyệt không còn mang nhãn "Có thể trùng".
    if (canXacNhanTrung) await sql`UPDATE questions SET duplicate_of = NULL WHERE id = ${cu.id}`;
    return c.json(await cauHoiTheoId(cu.id));
  });
}

routeMotCau("gui-duyet", "gui_duyet");
routeMotCau("duyet", "duyet");
routeMotCau("tu-choi", "tu_choi");
routeMotCau("luu-tru", "luu_tru");

/* ------------------------------------------------------------------ */
/* AI sinh câu hỏi (GĐ8)                                               */
/* ------------------------------------------------------------------ */

const sinhAiSchema = z.object({
  /** URN điều, khoản hoặc văn bản (lấy mọi điều của văn bản). */
  urns: z
    .array(
      z
        .string()
        .trim()
        .regex(/^vn:\S+$/, "Căn cứ phải là URN dạng vn:..."),
    )
    .min(1)
    .max(20),
  chu_de: z.string().trim().min(1).max(80),
  muc_do: z.enum(MUC_DO_CAU_HOI).nullish(),
  loai: z.array(z.enum(LOAI_CAU_HOI)).min(1).max(LOAI_CAU_HOI.length).default(["mot_dap_an", "dung_sai"]),
  so_cau: z.number().int().min(1).max(20).default(5),
  as_of: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  chay_thu: z.boolean().default(false),
});

nganHang.get("/sinh-ai", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  return c.json({ items: await danhSachViecSinhCauHoi(10), tran_chi_phi_usd: tranChiPhiAi() });
});

/**
 * POST /v1/quan-tri/ngan-hang/sinh-ai — tạo việc AI sinh câu hỏi. `chay_thu` chỉ trả điều
 * khoản sẽ đưa vào và ước tính chi phí, chưa tạo việc. Việc chạy ở worker `qdpl-soan-bai`;
 * câu sinh ra vào ngân hàng ở `cho_duyet`, `source = ai`.
 */
nganHang.post("/sinh-ai", async (c) => {
  const p = await batBuocVaiTro(c, "bien_tap");
  const b = await parseBody(c, sinhAiSchema);
  const asOf = b.as_of ?? new Date().toISOString().slice(0, 10);

  const chuDe = await chuDeTheoMa(b.chu_de);
  if (!chuDe) throw badRequest(`Không có chủ đề mã "${b.chu_de}"`);

  const kq = await taoViecSinhCauHoi(p, {
    urns: b.urns,
    layChuDe: async () => chuDe,
    loai: b.loai,
    mucDo: b.muc_do ?? null,
    soCau: b.so_cau,
    asOf,
    chayThu: b.chay_thu,
    // Biên tập viên xin thêm câu cho ngân hàng: câu trùng câu đã có thì bỏ, thiếu thì sinh tiếp.
    loaiTrung: true,
  });
  if (!kq.taoViec)
    return c.json({ chay_thu: true, as_of: asOf, uoc_tinh: kq.uocTinh, dieu_khoan: kq.dieuKhoan });
  return c.json(
    {
      viec: kq.viec,
      uoc_tinh: kq.uocTinh,
      dieu_khoan: kq.dieuKhoan,
      che_do: kq.cheDo,
      da_day_hang_doi: kq.daDayHangDoi,
    },
    202,
  );
});

/**
 * POST /v1/quan-tri/ngan-hang/sinh-ai/:id/chay-tiep — chạy lại một việc sinh câu hỏi còn chờ hoặc
 * bị lỗi, ngay trong API (như nút "Chạy tiếp" của trang đề thi). `da_chay: false` khi việc không
 * còn gì để chạy.
 */
nganHang.post("/sinh-ai/:id/chay-tiep", async (c) => {
  await batBuocVaiTro(c, "bien_tap");
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) throw notFound("Không có việc sinh câu hỏi này");
  // Việc đang chạy dưới 10 phút thì bỏ qua: có thể một lượt khác vẫn đang làm.
  const [viec] = await sql<Array<{ id: string }>>`
    SELECT id FROM authoring_jobs
    WHERE id = ${id}::uuid AND step = ${BUOC_SINH_CAU_HOI}
      AND (state IN ('cho', 'loi')
           OR (state = 'dang_chay' AND started_at < now() - interval '10 minutes'))`;
  return c.json({ da_chay: Boolean(viec) && chayNen(id, () => chayViecTrongApi(id)) });
});

/**
 * Duyệt hàng loạt: chỉ câu đang chờ duyệt được duyệt, câu khác bị bỏ qua và báo lại. Câu còn cảnh báo
 * trùng cũng bị bỏ qua: phải mở từng câu, đối chiếu rồi xác nhận mới duyệt được.
 */
nganHang.post("/duyet-hang-loat", async (c) => {
  const p = await batBuocVaiTro(c, vaiTroDuyet());
  const b = await parseBody(c, z.object({ ids: z.array(uuid).min(1).max(500) }));
  const ids = [...new Set(b.ids)];
  const trung = new Set(
    (
      await sql<Array<{ id: string }>>`
        SELECT id FROM questions WHERE id = ANY(${ids}::uuid[]) AND duplicate_of IS NOT NULL`
    ).map((r) => r.id),
  );
  const rows = await chuyenTrangThaiCauHoiDb(
    ids.filter((id) => !trung.has(id)),
    trangThaiTruoc("duyet"),
    "da_duyet",
    "duyet",
    p.email,
  );
  const daDuyet = new Set(rows.map((r) => r.id));
  return c.json({
    da_duyet: rows.length,
    bo_qua: ids.filter((id) => !daDuyet.has(id) && !trung.has(id)),
    canh_bao_trung: [...trung],
  });
});
