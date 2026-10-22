/**
 * Báo cáo cho lãnh đạo và cán bộ quản lý (docs/PLAN.md GĐ7), gắn ở /v1/bao-cao.
 *
 *  - GET /bo-loc          đề thi và đơn vị để chọn trong bộ lọc
 *  - GET /ket-qua-thi     kết quả một đề theo người        (?de_thi=, bắt buộc)
 *  - GET /don-vi          tổng hợp, xếp hạng đơn vị cùng cấp (?de_thi=, bắt buộc)
 *  - GET /luyen-tap       luyện tập theo người, đơn vị, chủ đề (?theo=)
 *  - GET /cau-hoi-kho     câu có tỷ lệ sai cao nhất        (?de_thi= tùy chọn)
 *  - GET /tien-do-hoc     tiến độ học của từng người       (?nhom=, ?q= tùy chọn; GĐ16c)
 *  - GET /tong-quan       số liệu gọn và người cần chú ý cho trang Tổng quan
 *  - GET /can-bo/:id      hồ sơ một cán bộ: bài thi, bài học, luyện tập
 *
 * Bộ lọc chung: `don_vi` (id, cây con), `tu`, `den` (YYYY-MM-DD). `dinh_dang=xlsx|pdf` trả tệp
 * thay cho JSON; mọi lần xuất tệp ghi `audit_log`.
 *
 * Quyền: `quan_ly` trở lên. Phạm vi: quản trị xem toàn bộ; vai trò khác chỉ thấy cây đơn vị
 * của mình, áp trong câu truy vấn (packages/db/src/bao-cao.ts).
 */
import type { Principal } from "@qdpl/auth";
import {
  baoCaoLuyenTap,
  type CanBoBaoCao,
  type CotPdf,
  canBoTrongPhamVi,
  cauHoiKho,
  danhSachDonVi,
  deThiChoBaoCao,
  type HoSoCanBo,
  hoSoCanBo,
  ketQuaDeThi,
  type LocBaoCao,
  layDonVi,
  nhomTrongPhamVi,
  taoPdfBang,
  taoPdfNhieuBang,
  taoTepExcel,
  tienDoHocVien,
  tongHopDonVi,
  tongQuanCanBo,
} from "@qdpl/db";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { batBuocPhamViDonVi, batBuocVaiTro, ghiNhatKy, NgoaiPhamVi, phamViCua } from "../auth.ts";
import { badRequest, notFound, parseQuery } from "../http.ts";

export const baoCao = new Hono();

const ngay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD")
  .optional();

const locSchema = z.object({
  don_vi: z.string().uuid().optional(),
  tu: ngay,
  den: ngay,
  dinh_dang: z.enum(["json", "xlsx", "pdf"]).default("json"),
});

interface NguCanh {
  p: Principal;
  loc: LocBaoCao;
  /** Tên đơn vị in ở đầu tệp xuất. */
  tenDonVi: string;
  dinhDang: "json" | "xlsx" | "pdf";
}

/** Kiểm quyền, tính phạm vi và đơn vị lọc. */
async function chuanBi(c: Context, q: z.infer<typeof locSchema>): Promise<NguCanh> {
  const p = await batBuocVaiTro(c, "quan_ly");
  const phamVi = phamViCua(p);
  if (phamVi === "khong_co") {
    throw new NgoaiPhamVi("Tài khoản chưa gắn đơn vị nên không có dữ liệu báo cáo.");
  }
  if (q.tu && q.den && q.tu > q.den) throw badRequest("Ngày bắt đầu phải trước ngày kết thúc.");
  let donVi: string | null = null;
  let tenDonVi = "Toàn bộ đơn vị";
  if (q.don_vi) {
    donVi = (await batBuocPhamViDonVi(c, q.don_vi)).unitPath;
    tenDonVi = (await layDonVi(q.don_vi))?.name ?? tenDonVi;
  } else if (phamVi !== null && p.unitId) {
    tenDonVi = (await layDonVi(p.unitId))?.name ?? tenDonVi;
  }
  return { p, loc: { phamVi, donVi, tu: q.tu ?? null, den: q.den ?? null }, tenDonVi, dinhDang: q.dinh_dang };
}

/* ------------------------------------------------------------------ */
/* Xuất tệp                                                            */
/* ------------------------------------------------------------------ */

interface Bang {
  loai: string;
  tieuDe: string;
  cot: Array<CotPdf & { rong: number }>;
  dong: Array<Record<string, string | number | null>>;
  tongHop?: string[];
  /** Bộ lọc riêng của báo cáo, ghi thêm vào nhật ký xuất. */
  nhatKy?: Record<string, unknown>;
}

function ngayGio(d: Date | string): string {
  return new Date(d).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ngayVn(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function moTaLoc(n: NguCanh): string[] {
  const khoang =
    n.loc.tu || n.loc.den
      ? `Khoảng ngày: ${n.loc.tu ? ngayVn(n.loc.tu) : "…"} – ${n.loc.den ? ngayVn(n.loc.den) : "…"}`
      : "Khoảng ngày: tất cả";
  return [
    `Đơn vị: ${n.tenDonVi}`,
    khoang,
    `Ngày xuất: ${ngayGio(new Date())}`,
    `Người xuất: ${n.p.name ?? n.p.email}`,
  ];
}

/** Trả JSON, hoặc tệp Excel/PDF của bảng, kèm ghi nhật ký xuất. */
async function traVe(c: Context, n: NguCanh, json: unknown, bang: () => Bang): Promise<Response> {
  if (n.dinhDang === "json") return c.json(json);
  const b = bang();
  const moTa = moTaLoc(n);
  await ghiNhatKy(n.p.email, "bao_cao.xuat", b.loai, {
    dinh_dang: n.dinhDang,
    don_vi: n.tenDonVi,
    tu: n.loc.tu,
    den: n.loc.den,
    so_dong: b.dong.length,
    ...b.nhatKy,
  });
  const ten = `bao-cao-${b.loai}-${new Date().toISOString().slice(0, 10)}`;
  if (n.dinhDang === "xlsx") {
    const tep = await taoTepExcel([
      { ten: "Báo cáo", cot: b.cot, dong: b.dong, ghiChu: [b.tieuDe, ...moTa, ...(b.tongHop ?? [])] },
    ]);
    return new Response(tep as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${ten}.xlsx"`,
      },
    });
  }
  const tep = await taoPdfBang({ tieuDe: b.tieuDe, moTa, cot: b.cot, dong: b.dong, ghiChu: b.tongHop });
  return new Response(tep as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${ten}.pdf"`,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

baoCao.get("/bo-loc", async (c) => {
  const p = await batBuocVaiTro(c, "quan_ly");
  const phamVi = phamViCua(p);
  const [deThi, donVi] = await Promise.all([
    deThiChoBaoCao(),
    phamVi === "khong_co" ? Promise.resolve([]) : danhSachDonVi(phamVi),
  ]);
  return c.json({
    de_thi: deThi,
    don_vi: donVi.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      parent_id: d.parent_id,
      path: d.path,
    })),
  });
});

const coDeThi = locSchema.extend({ de_thi: z.string().uuid("Chọn đề thi") });

baoCao.get("/ket-qua-thi", async (c) => {
  const q = parseQuery(c, coDeThi);
  const n = await chuanBi(c, q);
  const kq = await ketQuaDeThi(q.de_thi, n.loc);
  if (!kq) throw notFound("Không có đề thi này");
  return traVe(c, n, kq, () => ({
    loai: "ket-qua-thi",
    tieuDe: `Kết quả đề thi ${kq.de.code}: ${kq.de.title}`,
    cot: [
      { khoa: "xep_hang", tieuDe: "Hạng", rong: 6, canPhai: true },
      { khoa: "ho_ten", tieuDe: "Họ tên", rong: 22 },
      { khoa: "cap_bac", tieuDe: "Cấp bậc", rong: 12 },
      { khoa: "don_vi", tieuDe: "Đơn vị", rong: 22 },
      { khoa: "diem", tieuDe: "Điểm", rong: 8, canPhai: true },
      { khoa: "ket_qua", tieuDe: "Kết quả", rong: 10 },
      { khoa: "so_cau_dung", tieuDe: "Số câu đúng", rong: 10, canPhai: true },
      { khoa: "so_cau", tieuDe: "Tổng số câu", rong: 10, canPhai: true },
      { khoa: "phut_lam", tieuDe: "Thời gian làm (phút)", rong: 12, canPhai: true },
      { khoa: "so_lan", tieuDe: "Số lần làm", rong: 9, canPhai: true },
      { khoa: "nop_luc", tieuDe: "Nộp lúc", rong: 16 },
    ],
    dong: kq.dong.map((d) => ({
      xep_hang: d.xep_hang,
      ho_ten: d.ho_ten,
      cap_bac: d.cap_bac,
      don_vi: d.don_vi,
      diem: d.diem,
      ket_qua: d.ket_qua,
      so_cau_dung: d.so_cau_dung,
      so_cau: d.so_cau,
      phut_lam: Math.round((d.giay_lam / 60) * 10) / 10,
      so_lan: d.so_lan,
      nop_luc: ngayGio(d.nop_luc),
    })),
    tongHop: [
      `Số người đã làm: ${kq.tong_hop.so_nguoi}`,
      `Điểm trung bình: ${kq.tong_hop.diem_trung_binh ?? "—"}`,
      `Đạt: ${kq.tong_hop.so_dat} (${kq.tong_hop.ty_le_dat ?? 0}%), ngưỡng đạt ${kq.de.pass_score} điểm`,
    ],
  }));
});

baoCao.get("/don-vi", async (c) => {
  const q = parseQuery(c, coDeThi);
  const n = await chuanBi(c, q);
  const de = (await deThiChoBaoCao()).find((d) => d.id === q.de_thi);
  if (!de) throw notFound("Không có đề thi này, hoặc đề chưa xuất bản");
  const dong = await tongHopDonVi(q.de_thi, n.loc);
  return traVe(c, n, { de, dong }, () => ({
    loai: "don-vi",
    tieuDe: `Tổng hợp theo đơn vị, đề thi ${de.code}: ${de.title}`,
    cot: [
      { khoa: "xep_hang", tieuDe: "Hạng", rong: 6, canPhai: true },
      { khoa: "don_vi", tieuDe: "Đơn vị", rong: 30 },
      { khoa: "so_duoc_giao", tieuDe: "Được giao", rong: 10, canPhai: true },
      { khoa: "so_da_lam", tieuDe: "Đã làm", rong: 10, canPhai: true },
      { khoa: "ty_le_hoan_thanh", tieuDe: "Hoàn thành (%)", rong: 12, canPhai: true },
      { khoa: "so_dat", tieuDe: "Đạt", rong: 8, canPhai: true },
      { khoa: "ty_le_dat", tieuDe: "Tỷ lệ đạt (%)", rong: 12, canPhai: true },
      { khoa: "diem_trung_binh", tieuDe: "Điểm trung bình", rong: 12, canPhai: true },
    ],
    dong: dong.map(({ don_vi_id: _, ...d }) => d),
  }));
});

const TEN_NHOM = { nguoi: "Người", don_vi: "Đơn vị", chu_de: "Chủ đề" } as const;

baoCao.get("/luyen-tap", async (c) => {
  const q = parseQuery(c, locSchema.extend({ theo: z.enum(["nguoi", "don_vi", "chu_de"]).default("nguoi") }));
  const n = await chuanBi(c, q);
  const dong = await baoCaoLuyenTap(q.theo, n.loc);
  return traVe(c, n, { theo: q.theo, dong }, () => ({
    loai: `luyen-tap-${q.theo.replace("_", "-")}`,
    tieuDe: `Luyện tập theo ${TEN_NHOM[q.theo].toLowerCase()}`,
    cot: [
      { khoa: "nhom", tieuDe: TEN_NHOM[q.theo], rong: 30 },
      ...(q.theo === "nguoi" ? [{ khoa: "don_vi", tieuDe: "Đơn vị", rong: 24 }] : []),
      { khoa: "so_phien", tieuDe: "Số phiên", rong: 10, canPhai: true },
      { khoa: "so_cau", tieuDe: "Số câu", rong: 10, canPhai: true },
      { khoa: "so_dung", tieuDe: "Số câu đúng", rong: 10, canPhai: true },
      { khoa: "ty_le_dung", tieuDe: "Tỷ lệ đúng (%)", rong: 12, canPhai: true },
    ],
    dong: dong.map((d) => ({ ...d })),
  }));
});

baoCao.get("/cau-hoi-kho", async (c) => {
  const q = parseQuery(
    c,
    locSchema.extend({
      de_thi: z.string().uuid().optional(),
      toi_thieu: z.coerce.number().int().min(1).max(1000).default(5),
    }),
  );
  const n = await chuanBi(c, q);
  const dong = await cauHoiKho(n.loc, { examId: q.de_thi ?? null, toiThieuLuot: q.toi_thieu });
  return traVe(c, n, { dong, toi_thieu: q.toi_thieu }, () => ({
    loai: "cau-hoi-kho",
    tieuDe: "Câu hỏi có tỷ lệ sai cao nhất",
    cot: [
      { khoa: "ma_cau", tieuDe: "Mã câu", rong: 10 },
      { khoa: "cau_hoi", tieuDe: "Câu hỏi", rong: 46 },
      { khoa: "chu_de", tieuDe: "Chủ đề", rong: 18 },
      { khoa: "muc_do", tieuDe: "Mức độ", rong: 10 },
      { khoa: "so_luot", tieuDe: "Số lượt", rong: 8, canPhai: true },
      { khoa: "ty_le_sai", tieuDe: "Tỷ lệ sai (%)", rong: 10, canPhai: true },
      { khoa: "nhan_xet", tieuDe: "Nhận xét", rong: 24 },
    ],
    dong: dong.map(({ cau_hoi_id: _, do_phan_biet: __, ...d }) => d),
    tongHop: [`Chỉ tính câu có từ ${q.toi_thieu} lượt trả lời trở lên.`],
  }));
});

/**
 * Tiến độ học (docs/PLAN.md GĐ16c, N13): mỗi người trong phạm vi một dòng. Lọc `nhom` thì chỉ lấy
 * thành viên đang ở trong nhóm đó; nhóm không có ai trong phạm vi trả 404 như nhóm không tồn tại.
 * Tiêu đề cột ngắn để bảng 13 cột vừa khổ A4 ngang của PDF; nghĩa từng cột ghi ở phần ghi chú.
 */
baoCao.get("/tien-do-hoc", async (c) => {
  const q = parseQuery(
    c,
    locSchema.extend({ nhom: z.string().uuid().optional(), q: z.string().trim().max(100).optional() }),
  );
  const n = await chuanBi(c, q);
  const nhom = q.nhom ? await nhomTrongPhamVi(q.nhom, n.loc.phamVi) : null;
  if (q.nhom && !nhom) throw notFound("Không tìm thấy nhóm học cùng này.");
  const dong = await tienDoHocVien({ ...n.loc, nhom: nhom?.id ?? null, q: q.q ?? null });
  return traVe(c, n, { nhom, dong }, () => ({
    loai: "tien-do-hoc",
    tieuDe: nhom ? `Tiến độ học, nhóm ${nhom.ten}` : "Tiến độ học",
    // `rong` là số ký tự của cột Excel; PDF chỉ dùng tỷ lệ giữa các cột. Tỷ lệ này đủ chỗ cho
    // mọi tiêu đề cột trên PDF (test kiểm tiêu đề không bị cắt).
    cot: [
      { khoa: "ho_ten", tieuDe: "Họ tên", rong: 22.5 },
      { khoa: "don_vi", tieuDe: "Đơn vị", rong: 18 },
      { khoa: "bai_xong", tieuDe: "Bài đã xong", rong: 15.5, canPhai: true },
      { khoa: "bai_ghi_danh", tieuDe: "Bài ghi danh", rong: 16.5, canPhai: true },
      { khoa: "phan_tram_bai_hoc", tieuDe: "Bài học (%)", rong: 15, canPhai: true },
      { khoa: "so_phien", tieuDe: "Số phiên", rong: 12.5, canPhai: true },
      { khoa: "ty_le_dung", tieuDe: "Đúng (%)", rong: 13, canPhai: true },
      { khoa: "bai_thi_duoc_giao", tieuDe: "Được giao", rong: 14, canPhai: true },
      { khoa: "bai_thi_da_nop", tieuDe: "Đã nộp", rong: 11, canPhai: true },
      { khoa: "bai_thi_dat", tieuDe: "Đạt", rong: 8, canPhai: true },
      { khoa: "so_nhom", tieuDe: "Số nhóm", rong: 12.5, canPhai: true },
      { khoa: "phan_tram_nhom", tieuDe: "TB nhóm (%)", rong: 17, canPhai: true },
      { khoa: "lan_hoc_gan_nhat", tieuDe: "Học gần nhất", rong: 21.5 },
    ],
    dong: dong.map(({ id: _id, cap_bac: _, so_cau: __, ...d }) => ({
      ...d,
      lan_hoc_gan_nhat: d.lan_hoc_gan_nhat ? ngayGio(d.lan_hoc_gan_nhat) : null,
    })),
    tongHop: [
      ...(nhom ? [`Nhóm học cùng: ${nhom.ten}`] : []),
      ...(q.q ? [`Tìm theo: ${q.q}`] : []),
      `Số người: ${dong.length}`,
      "Bài học: bài đã xong trên số bài đang xuất bản của các chuyên đề đã ghi danh.",
      "Số phiên, Đúng (%): luyện tập. Được giao, Đã nộp, Đạt: số đề thi.",
      "Số nhóm, TB nhóm (%): nhóm học cùng đang hoạt động và trung bình phần trăm trong các nhóm đó.",
      "Học gần nhất: lần đọc bài, trả lời câu luyện tập hoặc nộp bài thi gần nhất.",
    ],
    nhatKy: nhom ? { nhom: nhom.id } : undefined,
  }));
});

/* ------------------------------------------------------------------ */
/* Tổng quan và hồ sơ một cán bộ                                       */
/* ------------------------------------------------------------------ */

/**
 * Số liệu gọn cho trang đầu khu quản trị: số cán bộ, số người học trong 7 ngày, bài thi được giao,
 * tài khoản chờ xác minh và ba nhóm cán bộ cần chú ý. Tính trên báo cáo tiến độ học, không lọc ngày.
 */
baoCao.get("/tong-quan", async (c) => {
  const q = parseQuery(c, locSchema.pick({ don_vi: true }));
  const n = await chuanBi(c, { ...q, dinh_dang: "json" });
  return c.json({ don_vi: n.tenDonVi, ...(await tongQuanCanBo(n.loc)) });
});

const KHONG_THAY_CAN_BO = "Cán bộ này nằm ngoài phạm vi quản lý của tài khoản đang đăng nhập.";

/** Một bảng của hồ sơ, dùng chung cho trang tính Excel và phần của PDF. */
interface PhanHoSo {
  ten: string;
  cot: Array<CotPdf & { rong: number }>;
  dong: Array<Record<string, string | number | null>>;
  ghiChu?: string[];
  trong?: string;
}

function phanHoSo(nguoi: CanBoBaoCao, h: HoSoCanBo): PhanHoSo[] {
  const tq = h.tong_quan;
  const ngayHoacTrong = (d: Date | null) => (d ? ngayGio(d) : null);
  const chuDe = (ds: HoSoCanBo["luyen_tap"]["manh"]) =>
    ds.map((x) => `${x.ten} (${x.so_dung}/${x.so_luot} đúng)`).join("; ") || "chưa đủ dữ liệu";
  return [
    {
      ten: "Tổng quan",
      cot: [
        { khoa: "muc", tieuDe: "Mục", rong: 30 },
        { khoa: "gia_tri", tieuDe: "Giá trị", rong: 50 },
      ],
      dong: [
        { muc: "Họ tên", gia_tri: nguoi.ho_ten },
        { muc: "Cấp bậc, chức vụ", gia_tri: nguoi.cap_bac },
        { muc: "Số hiệu", gia_tri: nguoi.so_hieu },
        { muc: "Đơn vị", gia_tri: nguoi.don_vi },
        { muc: "Bài học đã xong", gia_tri: `${tq.bai_xong}/${tq.bai_ghi_danh}` },
        { muc: "Số phiên luyện tập", gia_tri: tq.so_phien },
        { muc: "Tỷ lệ đúng khi luyện tập (%)", gia_tri: tq.ty_le_dung },
        { muc: "Đề thi được giao", gia_tri: tq.bai_thi_duoc_giao },
        { muc: "Đề thi đã nộp", gia_tri: tq.bai_thi_da_nop },
        { muc: "Đề thi đạt", gia_tri: tq.bai_thi_dat },
        { muc: "Học gần nhất", gia_tri: ngayHoacTrong(tq.lan_hoc_gan_nhat) },
      ],
    },
    {
      ten: "Bài thi",
      cot: [
        { khoa: "ma_de", tieuDe: "Mã đề", rong: 9 },
        { khoa: "ten_de", tieuDe: "Đề thi", rong: 34 },
        { khoa: "han", tieuDe: "Hạn làm bài", rong: 16 },
        { khoa: "ket_qua", tieuDe: "Kết quả", rong: 16 },
        { khoa: "diem", tieuDe: "Điểm", rong: 8, canPhai: true },
        { khoa: "nguong_dat", tieuDe: "Ngưỡng đạt", rong: 11, canPhai: true },
        { khoa: "so_cau_dung", tieuDe: "Câu đúng", rong: 10, canPhai: true },
        { khoa: "so_cau", tieuDe: "Số câu", rong: 8, canPhai: true },
        { khoa: "tu_luan", tieuDe: "Tự luận", rong: 10, canPhai: true },
        { khoa: "so_lan", tieuDe: "Số lần", rong: 8, canPhai: true },
        { khoa: "nop_luc", tieuDe: "Nộp lúc", rong: 16 },
      ],
      dong: h.bai_thi.map((b) => ({
        ma_de: b.ma_de,
        ten_de: b.ten_de,
        han: b.duoc_giao ? ngayHoacTrong(b.han) : "Bài giao đã hủy",
        ket_qua: b.ket_qua,
        diem: b.diem,
        nguong_dat: b.nguong_dat,
        so_cau_dung: b.so_cau_dung,
        so_cau: b.so_cau,
        tu_luan: b.tu_luan_toi_da === null ? null : `${b.diem_tu_luan}/${b.tu_luan_toi_da}`,
        so_lan: b.so_lan,
        nop_luc: ngayHoacTrong(b.nop_luc),
      })),
      ghiChu: ["Điểm, câu đúng: lượt đã nộp có điểm cao nhất. Tự luận: điểm phần tự luận của lượt đó."],
      trong: "Chưa được giao đề thi nào.",
    },
    {
      ten: "Bài học",
      cot: [
        { khoa: "chuyen_de", tieuDe: "Chuyên đề", rong: 40 },
        { khoa: "bai_xong", tieuDe: "Bài đã xong", rong: 12, canPhai: true },
        { khoa: "tong_bai", tieuDe: "Tổng số bài", rong: 12, canPhai: true },
        { khoa: "phan_tram", tieuDe: "Tỷ lệ (%)", rong: 10, canPhai: true },
        { khoa: "so_bai_tap", tieuDe: "Bài tập đã làm", rong: 14, canPhai: true },
        { khoa: "so_tu_luan", tieuDe: "Trong đó tự luận", rong: 15, canPhai: true },
        { khoa: "diem_bai_tap", tieuDe: "Điểm bài tập (%)", rong: 15, canPhai: true },
        { khoa: "lan_hoc_gan_nhat", tieuDe: "Học gần nhất", rong: 16 },
      ],
      dong: h.bai_hoc.map(({ chuyen_de_id: _, ghi_danh_luc: __, ...b }) => ({
        ...b,
        lan_hoc_gan_nhat: ngayHoacTrong(b.lan_hoc_gan_nhat),
      })),
      ghiChu: ["Điểm bài tập: trung bình điểm tốt nhất của từng bài tập đã làm."],
      trong: "Chưa ghi danh chuyên đề nào.",
    },
    {
      ten: "Luyện tập",
      cot: [
        { khoa: "chu_de", tieuDe: "Chủ đề", rong: 40 },
        { khoa: "so_phien", tieuDe: "Số phiên", rong: 10, canPhai: true },
        { khoa: "so_cau", tieuDe: "Số câu", rong: 10, canPhai: true },
        { khoa: "so_dung", tieuDe: "Số câu đúng", rong: 12, canPhai: true },
        { khoa: "ty_le_dung", tieuDe: "Tỷ lệ đúng (%)", rong: 14, canPhai: true },
      ],
      dong: h.luyen_tap.chu_de.map((d) => ({ ...d })),
      ghiChu: [`Chủ đề mạnh: ${chuDe(h.luyen_tap.manh)}`, `Chủ đề yếu: ${chuDe(h.luyen_tap.yeu)}`],
      trong: "Chưa luyện tập.",
    },
  ];
}

/**
 * Hồ sơ học tập của một cán bộ trong phạm vi của người gọi. Không có, không phải cán bộ và ngoài
 * phạm vi trả cùng một lỗi 403, để không lộ tài khoản nào có thật. `tu`, `den` lọc như các báo
 * cáo khác; `dinh_dang=xlsx|pdf` trả tệp (Excel mỗi phần một trang tính, PDF các bảng nối nhau).
 */
baoCao.get("/can-bo/:id", async (c) => {
  const q = parseQuery(c, locSchema.omit({ don_vi: true }));
  const n = await chuanBi(c, q);
  const id = z.string().uuid().safeParse(c.req.param("id"));
  const nguoi = id.success ? await canBoTrongPhamVi(id.data, n.loc.phamVi) : null;
  if (!nguoi) throw new NgoaiPhamVi(KHONG_THAY_CAN_BO);
  const hoSo = await hoSoCanBo(nguoi, n.loc);
  const { duong_dan: _, don_vi_id: __, ...nguoiRa } = nguoi;
  if (n.dinhDang === "json") return c.json({ nguoi: nguoiRa, ...hoSo });

  const tieuDe = `Hồ sơ học tập: ${nguoi.ho_ten}`;
  const moTa = [
    [nguoi.cap_bac, nguoi.so_hieu ? `số hiệu ${nguoi.so_hieu}` : null, `Đơn vị: ${nguoi.don_vi}`]
      .filter(Boolean)
      .join(" · "),
    ...moTaLoc(n).slice(1),
  ];
  const phan = phanHoSo(nguoi, hoSo);
  await ghiNhatKy(n.p.email, "bao_cao.xuat", "ho-so-can-bo", {
    dinh_dang: n.dinhDang,
    can_bo: nguoi.id,
    ho_ten: nguoi.ho_ten,
    tu: n.loc.tu,
    den: n.loc.den,
  });
  const dinhDanh = (nguoi.ten_dang_nhap ?? nguoi.id).replace(/[^a-zA-Z0-9._-]/g, "");
  const ten = `ho-so-can-bo-${dinhDanh}-${new Date().toISOString().slice(0, 10)}`;
  if (n.dinhDang === "xlsx") {
    const tep = await taoTepExcel(
      phan.map((p, i) => ({
        ten: p.ten,
        cot: p.cot,
        dong: p.dong,
        ghiChu: [...(i === 0 ? [tieuDe, ...moTa] : []), ...(p.ghiChu ?? [])],
      })),
    );
    return new Response(tep as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${ten}.xlsx"`,
      },
    });
  }
  const tep = await taoPdfNhieuBang({
    tieuDe,
    moTa,
    phan: phan.map((p) => ({ tieuDe: p.ten, cot: p.cot, dong: p.dong, ghiChu: p.ghiChu, trong: p.trong })),
  });
  return new Response(tep as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${ten}.pdf"`,
    },
  });
});
