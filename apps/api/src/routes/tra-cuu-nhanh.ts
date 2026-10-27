/**
 * Tra cứu nhanh (docs/PLAN.md GĐ5): mức phạt theo hành vi, theo tốc độ, quy trình xử lý, và biểu mẫu,
 * hướng dẫn dạng tệp tra chung với quy trình ở trang "Quy trình, Biểu mẫu".
 * Công khai như tìm kiếm văn bản; không cần đăng nhập.
 *
 * Mặc định chỉ trả dữ liệu đã duyệt. Đặt TRA_CUU_NHANH_BAN_NHAP=1 (chỉ ở môi trường phát
 * triển) để xem trước dữ liệu đang biên tập; mỗi mục khi đó mang `banNhap: true` để giao
 * diện ghi rõ là chưa đối chiếu.
 */
import { CHU_DE_MUC_PHAT, LOAI_XE, moTaKhoang, TEN_LOAI_XE, timTheoTocDo, tocDoVuot } from "@qdpl/dao-tao";
import {
  bieuMauTheoMa,
  danhSachQuyTrinh,
  LOAI_TAI_LIEU,
  type MucPhatRow,
  mucPhatTheoTocDo,
  type QuyTrinhRow,
  quyTrinhTheoMa,
  sql,
  type TaiLieuRow,
  tangLuotXem,
  timMucPhat,
  timTaiLieuPage,
  tocDoToiDa,
  trafficPenaltyFrames,
} from "@qdpl/db";
import { docUrnOf } from "@qdpl/legal-model";
import { Hono } from "hono";
import { z } from "zod";
import { badRequest, notFound, parseQuery, today } from "../http.ts";
import { traTepTaiLieu } from "../tep-tai-lieu.ts";

const gomBanNhap = () => process.env.NODE_ENV !== "production" && process.env.TRA_CUU_NHANH_BAN_NHAP === "1";

const ngaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD")
  .optional();
const xeSchema = z.enum(LOAI_XE, { message: `Loại xe phải là một trong: ${LOAI_XE.join(", ")}` });

/**
 * Văn bản (bỏ phần nút) trong số `urns` đã có trong kho. Căn cứ trỏ tới văn bản chưa nạp thì
 * giao diện chỉ ghi viện dẫn, không dẫn tới trang đọc (trang đó sẽ báo không tìm thấy).
 */
export async function vanBanCoTrongKho(urns: string[]): Promise<Set<string>> {
  const docUrns = [...new Set(urns.map(docUrnOf))];
  if (!docUrns.length) return new Set();
  const rows = await sql<Array<{ urn: string }>>`
    SELECT urn FROM documents WHERE urn = ANY(${docUrns}::text[])`;
  return new Set(rows.map((r) => r.urn));
}

function shapeMucPhat(r: MucPhatRow, coTrongKho: Set<string>) {
  return {
    ma: r.ma,
    xe: r.xe,
    tenXe: TEN_LOAI_XE[r.xe],
    nhom: r.nhom,
    hanhVi: r.hanhVi,
    phatTu: r.phatTu,
    phatDen: r.phatDen,
    hinhThucBoSung: r.hinhThucBoSung,
    truDiem: r.truDiem,
    tocDoVuot: r.tocDoVuot,
    moTaTocDo: r.tocDoVuot ? moTaKhoang(r.tocDoVuot) : null,
    canCu: r.canCu,
    canCuMoDuoc: coTrongKho.has(docUrnOf(r.canCu)),
    hieuLucTu: r.hieuLucTu,
    hieuLucDen: r.hieuLucDen,
    banNhap: r.trangThai !== "da_duyet",
  };
}

function shapeQuyTrinh(r: QuyTrinhRow, coBuoc: boolean) {
  return {
    ma: r.ma,
    loai: r.loai,
    tieuDe: r.tieuDe,
    tomTat: r.tomTat,
    soBuoc: r.cacBuoc.length,
    ...(coBuoc
      ? { cacBuoc: r.cacBuoc.map((b) => ({ tieuDe: b.tieu_de, moTa: b.mo_ta, canCu: b.can_cu ?? null })) }
      : {}),
    banNhap: r.trangThai !== "da_duyet",
  };
}

/** Một mục của trang "Quy trình, Biểu mẫu". Không lộ URI kho: tệp lấy qua /bieu-mau/:ma/tep. */
function shapeTaiLieu(r: TaiLieuRow) {
  return {
    loai: r.loai,
    ma: r.ma,
    tieuDe: r.tieuDe,
    tomTat: r.tomTat,
    xe: r.xe,
    tenXe: r.xe ? TEN_LOAI_XE[r.xe] : null,
    nhom: r.nhom,
    soBuoc: r.soBuoc,
    tep: r.tep ? { ten: r.tep.ten, duoi: r.tep.duoi, kichThuoc: r.tep.kichThuoc } : null,
    ghim: r.ghim,
    luotXem: r.luotXem,
    banNhap: r.trangThai !== "da_duyet",
  };
}

/** Đếm lượt mở; lỗi ghi không làm hỏng trang đang xem. */
function demLuotXem(loai: "quy-trinh" | "bieu-mau", ma: string) {
  tangLuotXem(loai, ma).catch((e) => console.warn("[tra-cuu] không ghi được lượt xem:", loai, ma, e));
}

export const traCuuNhanh = new Hono();
traCuuNhanh.get("/chu-de-muc-phat", async (c) =>
  c.json({
    items:
      await sql`SELECT DISTINCT group_name AS name FROM violations WHERE status='da_duyet' AND deleted_at IS NULL AND group_name IS NOT NULL ORDER BY name`,
  }),
);

traCuuNhanh.get("/muc-phat", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      q: z.string().trim().max(200, "Từ khóa quá dài (tối đa 200 ký tự)").optional(),
      nhom: z.string().trim().max(200).optional(),
      xe: xeSchema.optional(),
      ngay: ngaySchema,
      page: z.coerce.number().int().min(1).max(10000).optional(),
    }),
  );
  const ngay = p.ngay ?? today();
  // Trang Tra cứu đếm mức phạt theo chủ đề trên cả kho (vài trăm dòng), nên không cắt ở 50 dòng mặc định.
  const rows = await timMucPhat({
    q: p.q,
    nhom: p.nhom,
    xe: p.xe,
    ngay,
    gomBanNhap: gomBanNhap(),
    limit: 1000,
  });
  const coTrongKho = await vanBanCoTrongKho(rows.map((r) => r.canCu));
  const frames = await trafficPenaltyFrames(
    rows.map((r) => r.ma),
    ngay,
  );
  return c.json({
    q: p.q ?? "",
    xe: p.xe ?? null,
    ngay,
    total: rows.length,
    page: p.page ?? 1,
    page_size: p.page ? 24 : rows.length,
    items: (p.page ? rows.slice((p.page - 1) * 24, p.page * 24) : rows).map((r) => ({
      ...shapeMucPhat(r, coTrongKho),
      khungPhat: frames.filter((f) => f.violation_code === r.ma),
    })),
  });
});

/**
 * GET /v1/tra-cuu/toc-do-toi-da?xe=: tốc độ tối đa theo loại đường đã duyệt, áp dụng tại `ngay`
 * (docs/PLAN.md GĐ-G2). Rỗng khi chưa có dòng nào được duyệt.
 */
traCuuNhanh.get("/toc-do-toi-da", async (c) => {
  const p = parseQuery(c, z.object({ xe: xeSchema.optional(), ngay: ngaySchema }));
  const ngay = p.ngay ?? today();
  return c.json({ ngay, items: await tocDoToiDa({ xe: p.xe, ngay, gomBanNhap: gomBanNhap() }) });
});

traCuuNhanh.get("/toc-do", async (c) => {
  const p = parseQuery(
    c,
    z
      .object({
        xe: xeSchema,
        cho_phep: z.coerce.number().min(5, "Tốc độ cho phép tối thiểu 5 km/h").max(200).optional(),
        // Loại đường (GĐ-G2): lấy tốc độ cho phép từ bảng tốc độ tối đa đã duyệt thay cho `cho_phep`.
        duong: z.string().trim().min(2).max(60).optional(),
        do_duoc: z.coerce.number().min(0).max(400),
        ngay: ngaySchema,
      })
      .refine(
        (v) => v.cho_phep !== undefined || v.duong !== undefined,
        "Nhập tốc độ cho phép hoặc chọn loại đường.",
      ),
  );
  const ngay = p.ngay ?? today();
  let choPhep = p.cho_phep;
  let tocDoTheoDuong: Awaited<ReturnType<typeof tocDoToiDa>>[number] | null = null;
  if (choPhep === undefined) {
    const [td] = await tocDoToiDa({ xe: p.xe, loaiDuong: p.duong, ngay, gomBanNhap: gomBanNhap() });
    if (!td) throw badRequest("Chưa có tốc độ tối đa đã duyệt cho loại xe và loại đường này.");
    tocDoTheoDuong = td;
    choPhep = td.tocDoToiDa;
  }
  const vuot = tocDoVuot(choPhep, p.do_duoc);
  const rows = vuot > 0 ? await mucPhatTheoTocDo({ xe: p.xe, ngay, gomBanNhap: gomBanNhap() }) : [];
  const khop = timTheoTocDo(
    rows.map((r) => ({ ...r, toc_do_vuot: r.tocDoVuot })),
    vuot,
  );
  return c.json({
    xe: p.xe,
    tenXe: TEN_LOAI_XE[p.xe],
    choPhep,
    tocDoTheoDuong,
    doDuoc: p.do_duoc,
    vuot,
    ngay,
    // Dữ liệu hợp lệ có tối đa một khoảng khớp (script nạp chặn khoảng chồng nhau).
    ketQua: khop[0] ? shapeMucPhat(khop[0], await vanBanCoTrongKho([khop[0].canCu])) : null,
  });
});

traCuuNhanh.get("/quy-trinh", async (c) => {
  const rows = await danhSachQuyTrinh({ gomBanNhap: gomBanNhap() });
  return c.json({ items: rows.map((r) => shapeQuyTrinh(r, false)) });
});

traCuuNhanh.get("/quy-trinh/:ma", async (c) => {
  const ma = c.req.param("ma");
  const r = await quyTrinhTheoMa(ma, { gomBanNhap: gomBanNhap() });
  if (!r) throw notFound(`Không có quy trình ${ma}`);
  demLuotXem("quy-trinh", ma);
  return c.json(shapeQuyTrinh(r, true));
});

/**
 * GET /v1/tra-cuu/tai-lieu: tra chung quy trình và biểu mẫu theo từ khóa, loại tài liệu, phương tiện,
 * loại vi phạm. Không có bộ lọc nào thì là danh sách "phổ biến": mục ghim trước, rồi theo lượt mở.
 */
traCuuNhanh.get("/tai-lieu", async (c) => {
  const p = parseQuery(
    c,
    z.object({
      q: z.string().trim().max(200, "Từ khóa quá dài (tối đa 200 ký tự)").optional(),
      loai: z.enum(LOAI_TAI_LIEU, { message: "Loại tài liệu không hợp lệ." }).optional(),
      xe: xeSchema.optional(),
      nhom: z.enum(CHU_DE_MUC_PHAT, { message: "Loại vi phạm không có trong danh sách." }).optional(),
      gioi_han: z.coerce.number().int().min(1).max(200).default(200),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    }),
  );
  const result = await timTaiLieuPage({
    q: p.q,
    loai: p.loai,
    xe: p.xe,
    nhom: p.nhom,
    limit: p.gioi_han,
    offset: (p.page - 1) * p.gioi_han,
    gomBanNhap: gomBanNhap(),
  });
  return c.json({
    total: result.total,
    page: p.page,
    pages: Math.max(1, Math.ceil(result.total / p.gioi_han)),
    items: result.items.map(shapeTaiLieu),
  });
});

traCuuNhanh.get("/bieu-mau/:ma", async (c) => {
  const ma = c.req.param("ma");
  const r = await bieuMauTheoMa(ma, { gomBanNhap: gomBanNhap() });
  if (!r) throw notFound(`Không có biểu mẫu ${ma}`);
  demLuotXem("bieu-mau", ma);
  return c.json(shapeTaiLieu(r));
});

/** Tệp của biểu mẫu đã duyệt: PDF mở trong trình duyệt, Word và Excel tải về; `?tai=1` luôn tải về. */
traCuuNhanh.get("/bieu-mau/:ma/tep", async (c) => {
  const ma = c.req.param("ma");
  const r = await bieuMauTheoMa(ma, { gomBanNhap: gomBanNhap() });
  if (!r?.tep) throw notFound(`Không có biểu mẫu ${ma}`);
  return traTepTaiLieu(r.tep, c.req.query("tai") === "1");
});
