/**
 * Tạo chuyên đề, đề thi, hoặc cả hai thẳng từ một tệp PDF văn bản: lưu văn bản vào kho (đã có thì
 * dùng lại), rồi cho AI soạn bài và sinh câu hỏi. Thay cho chuỗi thao tác tay: thêm văn bản, tạo
 * chuyên đề, thêm từng bài, thêm từng khối; hoặc thêm văn bản rồi khai ma trận đề.
 *
 * Hai đường theo loại tệp:
 *  - PDF có lớp chữ: đọc ngay trong yêu cầu, trả về khi việc soạn đã bắt đầu.
 *  - PDF bản quét: mô hình đọc từng cụm trang, mất vài phút, nên chạy nền trong API bằng một việc
 *    `doc_pdf`. Chuyên đề và đề nháp được tạo trước với tên tạm để người soạn theo dõi tiến độ.
 *
 * Không nới quy tắc nào của kho: thuộc tính đoán được vẫn qua đúng lược đồ của biểu mẫu "Thêm văn
 * bản", bài soạn ra vẫn là bản nháp tới khi được xuất bản, câu hỏi vẫn ở chờ duyệt tới khi được duyệt.
 */

import { randomUUID } from "node:crypto";
import type { Role } from "@qdpl/auth";
import type { LoaiCauHoi } from "@qdpl/dao-tao";
import {
  type AuthoringJobRow,
  BUOC_SOAN_TU_DONG,
  batDauViecSoanBai,
  chuDeTheoMa,
  chuyenDeTheoId,
  type DeThiRow,
  danhSachViecSoanBai,
  getDocumentByUrn,
  ketThucViecSoanBai,
  layDeThi,
  luuChuDeCauHoi,
  luuChuyenDe,
  sql,
  taoDeThi,
  taoViecSoanBai,
  vieCSoanBaiTheoId,
} from "@qdpl/db";
import { buildUrn, docTypeByCode, inferDocType, normalizeSoKyHieu, parseDocument } from "@qdpl/legal-model";
import { isMock } from "@qdpl/llm";
import { putObject } from "@qdpl/storage";
import { ghiNhatKy } from "./auth.ts";
import { chayNen, chayViecTrongApi } from "./chay-soan-bai.ts";
import { docHoacLayBanDaDoc } from "./doc-pdf-quet.ts";
import { asDate, badRequest, today } from "./http.ts";
import { luocDoVanBanMoi, nhapTuPdf, type ThuocTinhTuPdf, taoVanBanMoi } from "./routes/quan-tri-van-ban.ts";
import { cauHinhDe, type MauDe, sinhDeTuVanBan, yeuCauTheoMau } from "./sinh-de-tu-van-ban.ts";
import { slugChuyenDeMoi, taoLanSoanTuDong } from "./soan-tu-dong.ts";

/** Bước đọc PDF bản quét, đứng trước việc soạn chuyên đề và việc sinh câu hỏi cho đề. */
export const BUOC_DOC_PDF = "doc_pdf";

const LOAI_CAU_HOI_MAC_DINH: LoaiCauHoi[] = ["mot_dap_an", "dung_sai"];

/** Tùy chọn soạn chuyên đề. */
export interface TuyChonChuyenDe {
  linh_vuc_id?: string | undefined;
  /** Có soạn một câu tự luận cho mỗi bài. */
  tu_luan: boolean;
  /** Số câu trắc nghiệm vào ngân hàng cho mỗi bài; 0 là không sinh. */
  so_cau_hoi: number;
}

export interface TuyChonTuPdf {
  /** Người soạn nhập tay khi hệ thống không tự đọc được từ tệp. */
  so_ky_hieu?: string | undefined;
  loai?: string | undefined;
  /** Có thì tạo chuyên đề và cho AI soạn bài. */
  chuyen_de?: TuyChonChuyenDe | undefined;
  /** Có thì tạo đề thi theo mẫu cấu trúc và cho AI sinh câu hỏi. */
  de_thi?: { mau: MauDe } | undefined;
}

type Nguoi = { email: string; role: Role };

interface VanBanCuaChuyenDe {
  urn: string;
  moi: boolean;
  title: string;
  shortTitle: string;
  /** Ngày áp dụng cho bài soạn: hôm nay, hoặc ngày có hiệu lực nếu văn bản chưa có hiệu lực. */
  asOf: string;
  soCanhBao: number;
}

/** Lưu văn bản vào kho nếu chưa có. Đã có theo số ký hiệu thì dùng lại nguyên trạng, không ghi đè. */
async function damBaoVanBan(markdown: string, tt: ThuocTinhTuPdf, email: string): Promise<VanBanCuaChuyenDe> {
  const soKyHieuTho = tt.soKyHieu?.trim();
  if (!soKyHieuTho) {
    throw badRequest("Không đọc được số ký hiệu của văn bản từ tệp. Hãy nhập số ký hiệu rồi gửi lại.");
  }
  const docType = tt.docType || inferDocType(soKyHieuTho);
  const loai = docType ? docTypeByCode(docType) : undefined;
  if (!docType || !loai) {
    throw badRequest(
      `Không xác định được loại văn bản từ số ký hiệu "${soKyHieuTho}". Hãy chọn loại văn bản rồi gửi lại.`,
    );
  }
  const soKyHieu = normalizeSoKyHieu(soKyHieuTho);
  const urn = buildUrn({ docType, soKyHieu });
  const asOfCua = (hieuLuc: string | null) => (hieuLuc && hieuLuc > today() ? hieuLuc : today());

  const daCo = await getDocumentByUrn(urn);
  if (daCo) {
    return {
      urn,
      moi: false,
      title: daCo.title,
      shortTitle: daCo.short_title,
      asOf: asOfCua(asDate(daCo.effective_from)),
      soCanhBao: 0,
    };
  }

  if (!(parseDocument(markdown).counts.dieu ?? 0)) {
    throw badRequest(
      "Không tách được Điều nào từ tệp, nên chưa có căn cứ để soạn bài. Hãy thêm văn bản ở mục Văn bản để soát nội dung.",
    );
  }
  const shortTitle = `${loai.name} ${soKyHieu}`;
  const title = tt.title && tt.title.length >= 5 ? tt.title : shortTitle;
  const hopLe = luocDoVanBanMoi.safeParse({
    docType,
    soKyHieu,
    title,
    issuer: tt.issuer ?? null,
    signer: tt.signer ?? null,
    issuedDate: tt.issuedDate ?? null,
    effectiveFrom: tt.effectiveFrom ?? null,
    markdown,
  });
  if (!hopLe.success) {
    throw badRequest(`Thuộc tính đọc từ tệp chưa hợp lệ: ${hopLe.error.issues[0]?.message ?? "không rõ"}`);
  }
  const kq = await taoVanBanMoi(hopLe.data, email);
  return {
    urn: kq.urn,
    moi: true,
    title,
    shortTitle,
    asOf: asOfCua(hopLe.data.effectiveFrom ?? hopLe.data.issuedDate ?? null),
    soCanhBao: kq.tomTat.canhBao.length,
  };
}

/** Tên chuyên đề lấy theo văn bản: "Thông tư 12/2026/TT-BCA: quy định về…". */
function tenChuyenDe(vb: VanBanCuaChuyenDe): string {
  const ten = vb.title === vb.shortTitle ? vb.shortTitle : `${vb.shortTitle}: ${vb.title}`;
  return ten.length > 300 ? `${ten.slice(0, 297)}...` : ten;
}

/** Tên đề thi lấy theo văn bản. */
const tenDeThi = (vb: VanBanCuaChuyenDe) => `Kiểm tra ${vb.shortTitle}`;

function yeuCauSoan(vb: VanBanCuaChuyenDe, o: TuyChonChuyenDe) {
  return {
    urns: [vb.urn],
    so_cau_hoi: o.so_cau_hoi,
    tu_luan: o.tu_luan,
    loai_cau_hoi: LOAI_CAU_HOI_MAC_DINH,
    as_of: vb.asOf,
    batch: false,
    chay_thu: false,
  };
}

const yeuCauDe = (vb: VanBanCuaChuyenDe, mau: MauDe) =>
  yeuCauTheoMau(mau, { title: tenDeThi(vb), urn: vb.urn, asOf: vb.asOf });

const thuocTinhKemNhapTay = (
  tt: ThuocTinhTuPdf,
  o: { so_ky_hieu?: string | undefined; loai?: string | undefined },
) => ({
  ...tt,
  ...(o.so_ky_hieu ? { soKyHieu: o.so_ky_hieu } : {}),
  ...(o.loai ? { docType: o.loai } : {}),
});

/**
 * Nhận tệp PDF và bắt đầu tạo chuyên đề, đề thi, hoặc cả hai. Trả về những thứ đã tạo để giao
 * diện chuyển sang trang theo dõi.
 */
export async function taoTuPdf(nguoi: Nguoi, bytes: Uint8Array, tenTep: string, o: TuyChonTuPdf) {
  if (!o.chuyen_de && !o.de_thi) throw badRequest("Chưa chọn tạo chuyên đề hay đề thi.");
  const pdf = await nhapTuPdf(bytes);

  if (pdf.markdown !== null) {
    const vb = await damBaoVanBan(pdf.markdown, thuocTinhKemNhapTay(pdf.thuocTinh, o), nguoi.email);
    // Thử phần sinh đề trước khi tạo gì: lỗi chung (văn bản không còn điều khoản có hiệu lực) không
    // để lại một chuyên đề mà thiếu đề.
    if (o.de_thi) await sinhDeTuVanBan(nguoi, { ...yeuCauDe(vb, o.de_thi.mau), chay_thu: true });
    const lan = o.chuyen_de
      ? await taoLanSoanTuDong(nguoi, {
          ...yeuCauSoan(vb, o.chuyen_de),
          ten_chuyen_de: tenChuyenDe(vb),
          linh_vuc_id: o.chuyen_de.linh_vuc_id,
        })
      : null;
    const de = o.de_thi ? await sinhDeTuVanBan(nguoi, yeuCauDe(vb, o.de_thi.mau)) : null;
    return {
      chuyen_de:
        lan && !lan.chayThu ? { id: lan.course.id, slug: lan.course.slug, title: lan.course.title } : null,
      de_thi: de && !de.chayThu ? { id: de.item.id, code: de.item.code, title: de.item.title } : null,
      van_ban: { urn: vb.urn, moi: vb.moi, so_canh_bao: vb.soCanhBao },
      ban_quet: false,
      so_trang: pdf.soTrang,
    };
  }

  /* ---- Bản quét: mô hình đọc từng cụm trang, chạy nền ---- */
  if (isMock()) {
    throw badRequest(
      "Tệp là bản quét (không có lớp chữ). Đọc bản quét cần mô hình AI, mà hệ thống chưa cấu hình ANTHROPIC_API_KEY.",
    );
  }
  const fileUri = `uploads/chuyen-de-tu-pdf/${randomUUID()}.pdf`;
  await putObject(fileUri, bytes, { contentType: "application/pdf" });
  const tenTam = tenTep.replace(/\.pdf$/i, "").trim() || "Văn bản";
  const tieuDeTam = `Đang đọc tệp: ${tenTam}`.slice(0, 300);
  const moTaTam = "Hệ thống đang đọc bản quét. Tên sẽ đổi theo tên văn bản khi đọc xong.";

  const course = o.chuyen_de
    ? await luuChuyenDe({
        slug: await slugChuyenDeMoi(tenTam),
        title: tieuDeTam,
        summary: moTaTam,
        asOf: today(),
        fieldId: o.chuyen_de.linh_vuc_id ?? null,
      })
    : null;
  // Đề nháp và chủ đề nhận câu tạo trước, để người soạn có trang đề mà theo dõi việc đọc bản quét.
  let deTam: { id: string; code: string; title: string; chu_de: string } | null = null;
  if (o.de_thi) {
    const chuDe = await luuChuDeCauHoi({ code: `de-thi-${randomUUID().slice(0, 8)}`, name: tenTam });
    const yc = yeuCauTheoMau(o.de_thi.mau, { title: tieuDeTam, urn: "vn:dang-doc", asOf: today() });
    const de = await taoDeThi({ ...cauHinhDe(yc, chuDe.id, today()), description: moTaTam }, nguoi.email);
    deTam = { id: de.id, code: de.code, title: de.title, chu_de: chuDe.code };
  }

  const dauVao: DauVaoDocPdf = {
    file_uri: fileUri,
    ten_tep: tenTep,
    so_trang: pdf.soTrang,
    vai_tro: nguoi.role,
    so_ky_hieu: o.so_ky_hieu,
    loai: o.loai,
    chuyen_de: o.chuyen_de ?? null,
    de_thi: deTam && o.de_thi ? { id: deTam.id, chu_de: deTam.chu_de, mau: o.de_thi.mau } : null,
  };
  const viec = await taoViecSoanBai({
    courseId: course?.id ?? null,
    step: BUOC_DOC_PDF,
    input: dauVao,
    batch: false,
    requestedBy: nguoi.email,
  });
  if (deTam) {
    await sql`UPDATE exams SET authoring_job_ids = ${[viec.id]}::uuid[] WHERE id = ${deTam.id}`;
  }
  await ghiNhatKy(nguoi.email, "dao_tao.doc_pdf.tao", viec.id, {
    chuyen_de: course?.slug ?? null,
    de_thi: deTam?.code ?? null,
    so_trang: pdf.soTrang,
  });
  chayNen(viec.id, () => chayDocPdf(viec.id));
  return {
    chuyen_de: course ? { id: course.id, slug: course.slug, title: course.title } : null,
    de_thi: deTam ? { id: deTam.id, code: deTam.code, title: deTam.title } : null,
    van_ban: null,
    ban_quet: true,
    so_trang: pdf.soTrang,
  };
}

/** Đầu vào của việc `doc_pdf`, lưu ở `authoring_jobs.input`. */
interface DauVaoDocPdf {
  file_uri: string;
  ten_tep: string;
  so_trang: number;
  /** Vai trò của người gửi tệp, để các bước sau kiểm trần chi phí như khi họ tự bấm. */
  vai_tro: Role;
  so_ky_hieu?: string | undefined;
  loai?: string | undefined;
  /** Tùy chọn soạn chuyên đề; chuyên đề là `course_id` của việc. */
  chuyen_de: TuyChonChuyenDe | null;
  /** Đề nháp đã tạo sẵn, mã chủ đề nhận câu và mẫu cấu trúc đề. */
  de_thi: { id: string; chu_de: string; mau: MauDe } | null;
}

/**
 * Chạy việc `doc_pdf`: đọc bản quét, lưu văn bản, đổi tên chuyên đề và đề theo văn bản, rồi tạo
 * lần soạn tự động và các việc sinh câu hỏi. Luôn chạy trong API vì việc lưu văn bản là phần của
 * API. Chạy lại sau lỗi giữa chừng thì phần đã tạo việc không tạo lần nữa.
 */
export async function chayDocPdf(viecId: string): Promise<void> {
  const viec = await vieCSoanBaiTheoId(viecId);
  if (!viec || viec.step !== BUOC_DOC_PDF || viec.state === "xong") return;
  const inp = viec.input as unknown as DauVaoDocPdf;
  const nguoi: Nguoi = { email: viec.requested_by ?? "ai", role: inp.vai_tro };
  await batDauViecSoanBai(viec.id);
  try {
    const doc = await docHoacLayBanDaDoc(inp.file_uri, viec.id);
    const vb = await damBaoVanBan(doc.markdown, thuocTinhKemNhapTay(doc.thuocTinh, inp), nguoi.email);

    if (viec.course_id && inp.chuyen_de) {
      const daSoan = (await danhSachViecSoanBai({ courseId: viec.course_id, limit: 500 })).some(
        (v) => v.step === BUOC_SOAN_TU_DONG,
      );
      if (!daSoan) {
        await sql`
          UPDATE courses SET title = ${tenChuyenDe(vb)}, summary = ${`Soạn tự động từ ${vb.shortTitle}.`},
                             as_of = ${vb.asOf}::date, updated_at = now()
          WHERE id = ${viec.course_id}::uuid`;
        await taoLanSoanTuDong(nguoi, { ...yeuCauSoan(vb, inp.chuyen_de), course_id: viec.course_id });
      }
    }
    if (inp.de_thi) {
      const [de, chuDe] = await Promise.all([layDeThi(inp.de_thi.id), chuDeTheoMa(inp.de_thi.chu_de)]);
      // Đề mới chỉ mang việc đọc PDF thì chưa sinh câu; đã có việc sinh là lượt trước đã làm xong phần này.
      if (de && chuDe && (de.authoring_job_ids ?? []).length <= 1) {
        await sinhDeTuVanBan(nguoi, yeuCauDe(vb, inp.de_thi.mau), { de, chuDe });
      }
    }
    await ketThucViecSoanBai(viec.id, {
      output: {
        urn: vb.urn,
        van_ban_moi: vb.moi,
        so_cum: doc.soCum,
        so_cho_khong_doc: doc.soChoKhongDoc,
        so_canh_bao: doc.soCanhBao + vb.soCanhBao,
      },
      costUsd: doc.chiPhiUsd,
    });
  } catch (e) {
    await ketThucViecSoanBai(viec.id, { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

/** Trạng thái còn dang dở của một việc: chưa chạy hoặc đang chạy. */
const CHUA_XONG = new Set(["cho", "dang_chay"]);

/** Phần tiến độ của việc đọc bản quét, cho khung tiến độ ở trang chuyên đề và trang đề. */
function tienDoDocPdf(v: AuthoringJobRow) {
  const out = v.output as { cum_xong?: number; so_cum?: number; so_cho_khong_doc?: number };
  return {
    state: v.state,
    error: v.error,
    cum_xong: Number(out.cum_xong ?? 0),
    so_cum: Number(out.so_cum ?? 0),
    so_trang: Number((v.input as { so_trang?: number }).so_trang ?? 0),
    so_cho_khong_doc: Number(out.so_cho_khong_doc ?? 0),
  };
}

/**
 * Tiến độ soạn của một chuyên đề: việc đọc PDF (nếu là bản quét), lần soạn tự động gần nhất và
 * các việc con của nó. `null` khi chuyên đề chưa từng được soạn tự động.
 */
export async function tienDoSoanCuaChuyenDe(courseId: string) {
  const viec = await danhSachViecSoanBai({ courseId, limit: 500 });
  const docPdf = viec.find((v) => v.step === BUOC_DOC_PDF);
  const cha = viec.find((v) => v.step === BUOC_SOAN_TU_DONG);
  if (!docPdf && !cha) return null;
  const con = cha ? viec.filter((v) => v.parent_id === cha.id) : [];
  const dem = (s: string) => con.filter((v) => v.state === s).length;
  const dangChay =
    Boolean(docPdf && CHUA_XONG.has(docPdf.state)) ||
    Boolean(cha && CHUA_XONG.has(cha.state)) ||
    con.some((v) => CHUA_XONG.has(v.state));
  return {
    dang_chay: dangChay,
    doc_pdf: docPdf ? tienDoDocPdf(docPdf) : null,
    soan: cha
      ? {
          id: cha.id,
          state: cha.state,
          error: cha.error,
          so_viec: con.length,
          xong: dem("xong"),
          loi: dem("loi"),
          loi_dau: con.find((v) => v.state === "loi")?.error ?? null,
          chi_phi_usd:
            Math.round([cha, ...con].reduce((s, v) => s + Number(v.cost_usd ?? 0), 0) * 10_000) / 10_000,
        }
      : null,
    con_loi: Boolean(docPdf?.state === "loi" || cha?.state === "loi" || dem("loi") > 0),
  };
}

/** Điền số ký hiệu người soạn nhập tay vào việc đọc PDF rồi chạy lại việc đó. */
async function chayLaiDocPdf(
  docPdf: AuthoringJobRow,
  bo: { so_ky_hieu?: string | undefined; loai?: string | undefined },
): Promise<boolean> {
  const input = {
    ...docPdf.input,
    ...(bo.so_ky_hieu ? { so_ky_hieu: bo.so_ky_hieu } : {}),
    ...(bo.loai ? { loai: bo.loai } : {}),
  };
  await sql`UPDATE authoring_jobs SET input = ${sql.json(input as never)} WHERE id = ${docPdf.id}::uuid`;
  return chayNen(docPdf.id, () => chayDocPdf(docPdf.id));
}

/**
 * Chạy tiếp phần chưa xong của một chuyên đề: đọc lại bản quét nếu việc đọc lỗi (kèm số ký hiệu
 * người soạn nhập tay), không thì chạy tiếp các việc soạn còn dở. Trả `false` khi không còn gì để chạy.
 */
export async function soanTiepChuyenDe(
  courseId: string,
  bo: { so_ky_hieu?: string | undefined; loai?: string | undefined },
): Promise<boolean> {
  if (!(await chuyenDeTheoId(courseId))) return false;
  const viec = await danhSachViecSoanBai({ courseId, limit: 500 });
  const docPdf = viec.find((v) => v.step === BUOC_DOC_PDF);
  if (docPdf && docPdf.state !== "xong") return chayLaiDocPdf(docPdf, bo);
  const cha = viec.find((v) => v.step === BUOC_SOAN_TU_DONG);
  if (!cha) return false;
  return chayNen(cha.id, () => chayViecTrongApi(cha.id));
}

async function viecCuaDe(de: Pick<DeThiRow, "authoring_job_ids">): Promise<AuthoringJobRow[]> {
  const ids = de.authoring_job_ids ?? [];
  if (!ids.length) return [];
  return await sql<AuthoringJobRow[]>`
    SELECT * FROM authoring_jobs WHERE id = ANY(${ids}::uuid[]) ORDER BY created_at`;
}

/**
 * Tiến độ các việc AI của một đề: việc đọc PDF (nếu tạo từ bản quét) và các việc sinh câu hỏi.
 * `null` khi đề không do AI sinh.
 */
export async function tienDoSinhDe(de: Pick<DeThiRow, "authoring_job_ids">) {
  const viec = await viecCuaDe(de);
  if (!viec.length) return null;
  const docPdf = viec.find((v) => v.step === BUOC_DOC_PDF);
  const sinh = viec.filter((v) => v.step !== BUOC_DOC_PDF);
  const dem = (s: string) => sinh.filter((v) => v.state === s).length;
  return {
    dang_chay: viec.some((v) => CHUA_XONG.has(v.state)),
    con_loi: viec.some((v) => v.state === "loi"),
    doc_pdf: docPdf ? tienDoDocPdf(docPdf) : null,
    so_viec: sinh.length,
    xong: dem("xong"),
    loi: dem("loi"),
    loi_dau: (docPdf?.state === "loi" ? docPdf.error : sinh.find((v) => v.state === "loi")?.error) ?? null,
  };
}

/**
 * Chạy tiếp phần chưa xong của một đề: đọc lại bản quét nếu việc đọc lỗi, không thì chạy lại các
 * việc sinh câu hỏi còn chờ hoặc bị lỗi. Trả `false` khi không còn gì để chạy.
 */
export async function sinhTiepDeThi(
  de: Pick<DeThiRow, "authoring_job_ids">,
  bo: { so_ky_hieu?: string | undefined; loai?: string | undefined },
): Promise<boolean> {
  const viec = await viecCuaDe(de);
  const docPdf = viec.find((v) => v.step === BUOC_DOC_PDF);
  if (docPdf && docPdf.state !== "xong") return chayLaiDocPdf(docPdf, bo);
  // Việc đang chạy dưới 10 phút thì bỏ qua: có thể một lượt khác vẫn đang làm.
  const canChay = await sql<Array<{ id: string }>>`
    SELECT id FROM authoring_jobs
    WHERE id = ANY(${viec.map((v) => v.id)}::uuid[]) AND step <> ${BUOC_DOC_PDF}
      AND (state IN ('cho', 'loi')
           OR (state = 'dang_chay' AND started_at < now() - interval '10 minutes'))`;
  let daChay = false;
  for (const v of canChay) daChay = chayNen(v.id, () => chayViecTrongApi(v.id)) || daChay;
  return daChay;
}
