/**
 * Công cụ SỐ HÓA — điều phối việc chuyển PDF thành Markdown qua chính agent.
 *
 * Vì sao làm thế này (thay cho service Python `services/docproc`):
 * bước khó nhất của số hóa VBQPPL không phải là nhận dạng ký tự mà là **hiểu bố cục**
 * (bảng qua trang, công thức, câu bị cắt giữa trang, khối chữ ký). Mô hình đọc thẳng
 * trang PDF làm việc đó tốt hơn chuỗi OCR + luật ghép, nên ở đây máy chủ chỉ lo phần
 * máy làm giỏi hơn người và mô hình: cắt cụm trang, trích lớp văn bản, ghép cụm, kiểm
 * chứng bằng luật, lưu trữ. Phần đọc hiểu trang thì giao cho agent.
 *
 * Vòng làm việc:
 *   nhan_viec_so_hoa -> (lay_cua_so_trang -> nop_cua_so) x N -> hoan_tat_so_hoa
 */
import {
  capNhatViecSoHoa,
  danhSachViecSoHoa,
  ghiCuaSo,
  layCacCuaSo,
  layViecSoHoa,
  NHAN_TRANG_THAI_VIEC,
  nhanViecSoHoa,
  type SoHoaTaskRow,
  sql,
  thongKeSoHoa,
} from "@qdpl/db";
import {
  type CuaSo,
  catCuaSoPdf,
  docTrangPdf,
  hoanTatSoHoa,
  lapKeHoachCuaSo,
  nhapTuLopVanBan,
  phatHienDongLap,
  renderTrangPng,
  TRANG_THAI_MO_RONG,
  tachKhoi,
} from "@qdpl/sohoa";
import { getObject, localWorkDir, storageLabel, writeWorkFile } from "@qdpl/storage";
import { z } from "zod";
import { errorResult, mustResolve, result, ToolError } from "../context.ts";
import type { ToolRegistrar } from "../registrar.ts";
import { writeEnabled } from "./van-hanh.ts";

function requireWrite(): void {
  if (!writeEnabled()) {
    throw new ToolError(
      "Server đang chạy ở chế độ CHỈ ĐỌC nên không nhận việc số hóa được. " +
        "Người vận hành cần đặt QDPL_MCP_ALLOW_WRITE=1 rồi khởi động lại server.",
    );
  }
}

/** Thời hạn giữ một việc số hóa (phút). Hết hạn thì phiên khác nhận lại được. */
const HAN_GIU_VIEC_PHUT = Number(process.env.SOHOA_LEASE_MINUTES ?? 180);
/** Số trang tối đa được nhúng ảnh trong một lần trả kết quả — giữ cho kết quả không quá lớn. */
const MAX_ANH_MOI_LAN = 6;

interface VanBanRow {
  id: string;
  urn: string;
  so_ky_hieu: string;
  title: string;
  doc_type: string;
}

async function vanBanCua(task: SoHoaTaskRow): Promise<VanBanRow> {
  const [row] =
    await sql`SELECT id, urn, so_ky_hieu, title, doc_type FROM documents WHERE id = ${task.document_id}`;
  if (!row) throw new ToolError(`Việc số hóa ${task.id} trỏ tới văn bản không còn trong CSDL`);
  return row as unknown as VanBanRow;
}

function keHoachCua(task: SoHoaTaskRow): CuaSo[] {
  const kh = (task.windows ?? []) as CuaSo[];
  if (kh.length) return kh;
  return lapKeHoachCuaSo(task.page_count ?? 0, { kichThuoc: task.window_size, chongLan: task.overlap });
}

/** Ba khối Markdown cuối của cụm liền trước — ngữ cảnh để agent nối đoạn cho đúng. */
function duoiNguCanh(md: string, soKhoi = 3): string {
  return tachKhoi(md).slice(-soKhoi).join("\n\n");
}

function tomTatViec(task: SoHoaTaskRow, doc: VanBanRow, daNop: number[]): string {
  const kh = keHoachCua(task);
  const conLai = kh.filter((c) => !daNop.includes(c.idx));
  return [
    `Việc số hóa ${task.id}`,
    `  Văn bản : ${doc.so_ky_hieu} — ${doc.title}`,
    `  URN     : ${doc.urn}`,
    `  Tệp gốc : ${task.file_uri} (kho: ${storageLabel()})`,
    `  Tuyến   : ${task.route}${task.route === "pdf_text" ? " (có lớp văn bản — đã có bản nháp)" : " (bản quét — phải đọc ảnh trang)"}`,
    `  Số trang: ${task.page_count ?? "?"} | cụm: ${kh.length} (mỗi cụm ${task.window_size} trang, chồng lấn ${task.overlap})`,
    `  Đã nộp  : ${daNop.length}/${kh.length} cụm`,
    conLai.length
      ? `  Cụm kế tiếp: ${conLai[0]?.idx} (trang ${conLai[0]?.tuTrang}–${conLai[0]?.denTrang})`
      : `  Đã nộp đủ cụm — gọi hoan_tat_so_hoa để ghép và kiểm chứng.`,
  ].join("\n");
}

const QUY_TAC_NGAN = [
  "Quy tắc bắt buộc khi chuyển trang thành Markdown (đầy đủ ở prompts/convert/page-window.md):",
  "1. Sao chép NGUYÊN VĂN. Không tóm tắt, không sửa văn phong, không sửa chính tả của bản gốc.",
  "2. Bản in xuống dòng vì hết dòng: gộp các dòng cùng một đoạn thành MỘT dòng Markdown.",
  "   Câu bị cắt giữa trang thì nối liền, không chèn ngắt đoạn, không tạo nút mới.",
  "3. Bỏ số trang, header cơ quan lặp, dòng 'CÔNG BÁO/Số…'. NHƯNG giữ nguyên khối 'Nơi nhận:',",
  "   chức danh và tên người ký ở cuối văn bản.",
  "4. Bảng: đơn giản -> bảng GFM; có gộp ô -> <table> với rowspan/colspan; bảng qua trang thì nối hàng,",
  "   bỏ header lặp, và khai table_open=true nếu bảng còn tiếp sang cụm sau.",
  "5. Công thức: LaTeX trong $…$ / $$…$$, kèm '<!-- alt: diễn giải bằng lời -->' và khối 'Trong đó:'.",
  "6. Marker nút: '<!-- node: dieu-15.khoan-2.diem-a -->' đặt trên dòng nội dung của nút.",
  "7. Chỗ không đọc được: '[[không đọc được: mô tả]]'. TUYỆT ĐỐI không đoán nội dung.",
  "8. Điểm chỉ dùng dãy a,b,c,d,đ,e,g,h,i,k,l,m,n,o,p,q,r,s,t,u,v,x,y — không có f, j, w, z.",
  "9. Mọi lần sửa lỗi OCR hiển nhiên phải ghi vào sua_loi[] khi nộp.",
].join("\n");

export function registerSoHoaTools(reg: ToolRegistrar): void {
  const nguoiDung = reg.principal.email;

  reg.add(
    "nhan_viec_so_hoa",
    {
      title: "Nhận việc số hóa",
      description:
        "Nhận một văn bản PDF cần số hóa và giữ việc đó cho phiên này. Trả về thông tin văn bản, " +
        "kế hoạch chia cụm trang và cụm cần làm tiếp theo. Không có tham số thì lấy việc ưu tiên cao nhất " +
        "đang chờ. Đây là bước ĐẦU TIÊN của vòng số hóa: nhan_viec_so_hoa -> lay_cua_so_trang -> nop_cua_so -> hoan_tat_so_hoa.",
      inputSchema: {
        van_ban: z
          .string()
          .optional()
          .describe("Số ký hiệu hoặc URN của văn bản muốn số hóa. Bỏ trống là lấy việc đang chờ."),
        viec_id: z
          .string()
          .uuid()
          .optional()
          .describe("Nhận đúng việc số hóa này (lấy từ trang_thai_so_hoa)."),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ van_ban, viec_id }: { van_ban?: string; viec_id?: string }) => {
      try {
        requireWrite();
        let documentId: string | undefined;
        if (van_ban) documentId = (await mustResolve(van_ban)).id;
        const task = await nhanViecSoHoa({
          nguoiNhan: nguoiDung,
          hanPhut: HAN_GIU_VIEC_PHUT,
          ...(viec_id ? { viecId: viec_id } : {}),
          ...(documentId ? { documentId } : {}),
        });
        if (!task) {
          const tk = await thongKeSoHoa();
          return result(
            van_ban || viec_id
              ? `Không có việc số hóa nào đang chờ cho ${van_ban ?? viec_id}. Có thể việc đã xong, hoặc phiên khác đang giữ và chưa hết hạn.`
              : `Không còn việc số hóa nào đang chờ. Hiện có: ${JSON.stringify(tk.theoTrangThai)}.`,
            { nhan_duoc: false, thong_ke: tk },
          );
        }
        const doc = await vanBanCua(task);
        const daNop = (await layCacCuaSo(task.id)).map((w) => w.idx);
        return result(
          `${tomTatViec(task, doc, daNop)}\n\n${QUY_TAC_NGAN}\n\n` +
            `Bước tiếp theo: gọi lay_cua_so_trang với viec_id="${task.id}" và cua_so=${keHoachCua(task).find((c) => !daNop.includes(c.idx))?.idx ?? 1}.`,
          {
            nhan_duoc: true,
            viec_id: task.id,
            van_ban: { urn: doc.urn, so_ky_hieu: doc.so_ky_hieu, title: doc.title, doc_type: doc.doc_type },
            tuyen: task.route,
            so_trang: task.page_count,
            cua_so: keHoachCua(task),
            da_nop: daNop,
            han_giu_den: task.lease_until,
          },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "lay_cua_so_trang",
    {
      title: "Lấy một cụm trang để đọc",
      description:
        "Chuẩn bị một cụm trang của việc số hóa: cắt PDF con để đọc trực tiếp (trả về đường dẫn tệp), " +
        "trích lớp văn bản của từng trang, chỉ ra các dòng header/số trang lặp cần bỏ, và đưa ngữ cảnh nối " +
        "từ cụm trước (đoạn cuối + trạng thái mở). Đặt kem_anh=true để nhận thêm ảnh trang trong kết quả " +
        "khi không đọc được tệp trên đĩa.",
      inputSchema: {
        viec_id: z.string().uuid().describe("Việc số hóa, lấy từ nhan_viec_so_hoa."),
        cua_so: z.number().int().min(1).describe("Số thứ tự cụm trang cần lấy."),
        kem_anh: z
          .boolean()
          .optional()
          .describe("Nhúng ảnh PNG các trang vào kết quả (mặc định false — đọc tệp PDF con nhẹ hơn)."),
        dpi: z.number().int().min(72).max(400).optional().describe("Độ phân giải ảnh trang, mặc định 200."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({
      viec_id,
      cua_so,
      kem_anh,
      dpi,
    }: {
      viec_id: string;
      cua_so: number;
      kem_anh?: boolean;
      dpi?: number;
    }) => {
      try {
        const task = await layViecSoHoa(viec_id);
        if (!task) throw new ToolError(`Không có việc số hóa ${viec_id}`);
        const kh = keHoachCua(task);
        const cs = kh.find((c) => c.idx === cua_so);
        if (!cs) {
          throw new ToolError(`Việc này chỉ có ${kh.length} cụm; không có cụm ${cua_so}.`);
        }
        const doc = await vanBanCua(task);
        const bytes = await getObject(task.file_uri);

        // PDF con của cụm: agent đọc thẳng bản gốc, giữ nguyên độ nét, không cần OCR.
        const conPdf = await catCuaSoPdf(bytes, cs.tuTrang, cs.denTrang);
        const duongDanPdf = await writeWorkFile(
          task.id,
          `cum-${String(cs.idx).padStart(3, "0")}.pdf`,
          conPdf,
        );

        const trang = docTrangPdf(bytes, cs.tuTrang, cs.denTrang);
        const toanBoTrang = docTrangPdf(bytes);
        const dongLap = phatHienDongLap(toanBoTrang);

        // Ngữ cảnh nối: đoạn cuối và trạng thái mở của cụm liền trước.
        const daNop = await layCacCuaSo(task.id);
        const truoc = daNop.find((w) => w.idx === cs.idx - 1);
        const trangThaiMo = truoc?.open_state ?? { ...TRANG_THAI_MO_RONG };
        const duoi = truoc ? duoiNguCanh(truoc.markdown) : "";

        const nhap = task.route === "pdf_text" ? nhapTuLopVanBan(trang, { dongLap }) : "";

        const phanText = [
          `Cụm ${cs.idx}/${kh.length} của việc ${task.id} — ${doc.so_ky_hieu}`,
          `Trang ${cs.tuTrang}–${cs.denTrang}${cs.trangChongLan ? ` (trang ${cs.trangChongLan} chồng lấn với cụm trước — hãy xuất lại đầy đủ, bộ ghép sẽ ưu tiên bản của bạn)` : ""}`,
          `Tệp PDF của riêng cụm này: ${duongDanPdf}`,
          task.route === "pdf_anh"
            ? "Tuyến pdf_anh: PDF không có lớp văn bản dùng được. Hãy ĐỌC TỆP PDF trên (hoặc ảnh kèm theo) và chép nguyên văn."
            : "Tuyến pdf_text: đã trích được lớp văn bản. Dùng bản nháp dưới đây làm nguyên văn, việc của bạn là dựng cấu trúc, bảng, marker nút và nối đoạn — vẫn nên mở tệp PDF để đối chiếu bảng và bố cục.",
          "",
          dongLap.length
            ? `Dòng lặp đã phát hiện (là header/số trang, phải BỎ, trừ trang có khối chữ ký):\n${dongLap.map((d) => `  - [${d.viTri}] "${d.viDu}" (${d.soTrang} trang)`).join("\n")}`
            : "Không phát hiện dòng header/footer lặp.",
          "",
          `Trạng thái mở từ cụm trước:\n${JSON.stringify(trangThaiMo, null, 2)}`,
          "",
          duoi
            ? `Đuôi Markdown đã chấp nhận của cụm trước (nối tiếp vào đây):\n\n${duoi}`
            : "Đây là cụm đầu tiên.",
          "",
          nhap
            ? `Bản nháp trích từ lớp văn bản (nguyên văn, chưa có cấu trúc):\n\n${nhap}`
            : trang
                .map(
                  (t) =>
                    `--- Trang ${t.trang} (${t.soKyTu} ký tự trích được) ---\n${t.text || "(không có lớp văn bản)"}`,
                )
                .join("\n\n"),
          "",
          QUY_TAC_NGAN,
          "",
          `Nộp kết quả bằng nop_cua_so với viec_id="${task.id}", cua_so=${cs.idx}.`,
        ].join("\n");

        const content: Array<Record<string, unknown>> = [{ type: "text", text: phanText }];
        if (kem_anh) {
          const soAnh = Math.min(MAX_ANH_MOI_LAN, cs.denTrang - cs.tuTrang + 1);
          for (let i = 0; i < soAnh; i++) {
            const png = renderTrangPng(bytes, cs.tuTrang + i, dpi ?? 200);
            await writeWorkFile(task.id, `trang-${String(cs.tuTrang + i).padStart(4, "0")}.png`, png);
            content.push({ type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" });
          }
        }

        return {
          content,
          structuredContent: {
            viec_id: task.id,
            cua_so: cs,
            tong_cua_so: kh.length,
            duong_dan_pdf: duongDanPdf,
            thu_muc_lam_viec: localWorkDir(task.id),
            tuyen: task.route,
            trang: trang.map((t) => ({ trang: t.trang, so_ky_tu: t.soKyTu })),
            dong_lap: dongLap,
            trang_thai_mo_truoc: trangThaiMo,
          },
        } as never;
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "nop_cua_so",
    {
      title: "Nộp Markdown của một cụm trang",
      description:
        "Nộp kết quả chuyển đổi của một cụm trang: Markdown nguyên văn, trạng thái mở ở cuối cụm " +
        "(để nối với cụm sau), khai báo bảng, các lỗi OCR đã sửa và cảnh báo. Nộp lại cùng một cụm thì ghi đè.",
      inputSchema: {
        viec_id: z.string().uuid(),
        cua_so: z.number().int().min(1),
        markdown: z
          .string()
          .min(1)
          .describe("Markdown của cụm, theo chuẩn nội bộ (marker nút, bảng, công thức)."),
        trang_thai_mo: z
          .object({
            sentence_open: z.boolean().describe("Cuối cụm còn câu chưa kết thúc."),
            last_node_path: z
              .string()
              .nullable()
              .optional()
              .describe("Nút đang mở, ví dụ dieu-15.khoan-2.diem-c."),
            last_node_kind: z.string().nullable().optional(),
            table_open: z.boolean().describe("Bảng còn tiếp sang cụm sau."),
            table_cols: z.number().nullable().optional(),
            last_text_tail: z.string().optional().describe("80–160 ký tự cuối, để bộ ghép so khớp."),
          })
          .describe("Trạng thái dang dở ở cuối cụm. Sai trường này là ghép sai văn bản."),
        bang: z
          .array(
            z.object({
              page: z.number().optional(),
              node_path: z.string().optional(),
              rows: z.number().int().describe("Số hàng dữ liệu, KHÔNG tính hàng header."),
              cols: z.number().int(),
              format: z.enum(["gfm", "html"]).optional(),
              continued_from_previous: z.boolean().optional(),
            }),
          )
          .optional()
          .describe("Khai báo từng bảng để hậu kiểm đối chiếu."),
        cong_thuc: z
          .array(
            z.object({ page: z.number().optional(), node_path: z.string().optional(), latex: z.string() }),
          )
          .optional(),
        hinh: z
          .array(
            z.object({
              page: z.number().optional(),
              node_path: z.string().optional(),
              caption: z.string().optional(),
            }),
          )
          .optional(),
        sua_loi: z
          .array(
            z.object({
              page: z.number().optional(),
              before: z.string(),
              after: z.string(),
              reason: z.string(),
            }),
          )
          .optional()
          .describe("Mọi lỗi OCR đã sửa. Bắt buộc ghi, không được sửa im lặng."),
        canh_bao: z
          .array(z.object({ kind: z.string(), page: z.number().optional(), message: z.string() }))
          .optional(),
        khong_doc_duoc: z.number().int().optional().describe("Số chỗ đánh dấu [[không đọc được: …]]."),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, any>) => {
      try {
        requireWrite();
        const task = await layViecSoHoa(args.viec_id);
        if (!task) throw new ToolError(`Không có việc số hóa ${args.viec_id}`);
        const kh = keHoachCua(task);
        const cs = kh.find((c) => c.idx === args.cua_so);
        if (!cs) throw new ToolError(`Việc này chỉ có ${kh.length} cụm; không có cụm ${args.cua_so}.`);

        const md = String(args.markdown ?? "");
        if (!md.trim()) throw new ToolError("Markdown rỗng — không nộp được.");
        // Lưới an toàn: bắt lỗi thấy ngay ở mức cụm, để agent sửa liền thay vì phát hiện lúc hoàn tất.
        const soBang = (md.match(/^\s*\|/gm) ?? []).length;
        const canhBaoNgay: string[] = [];
        if (args.bang?.length && !soBang && !/<table/i.test(md)) {
          canhBaoNgay.push("Có khai báo bảng nhưng Markdown không chứa bảng nào.");
        }
        if (/\[\[không đọc được/.test(md) && !args.khong_doc_duoc) {
          canhBaoNgay.push("Markdown có chỗ [[không đọc được]] nhưng khong_doc_duoc = 0.");
        }

        await ghiCuaSo({
          taskId: task.id,
          idx: cs.idx,
          pageFrom: cs.tuTrang,
          pageTo: cs.denTrang,
          markdown: md,
          openState: args.trang_thai_mo ?? {},
          tables: args.bang ?? [],
          formulas: args.cong_thuc ?? [],
          figures: args.hinh ?? [],
          corrections: args.sua_loi ?? [],
          warnings: args.canh_bao ?? [],
          unreadableCount: args.khong_doc_duoc ?? 0,
          submittedBy: nguoiDung,
        });
        await capNhatViecSoHoa(task.id, { leaseUntil: new Date(Date.now() + HAN_GIU_VIEC_PHUT * 60_000) });

        const daNop = (await layCacCuaSo(task.id)).map((w) => w.idx);
        const conLai = kh.filter((c) => !daNop.includes(c.idx));
        const buocSau = conLai.length
          ? `Cụm kế tiếp: gọi lay_cua_so_trang với cua_so=${conLai[0]?.idx} (trang ${conLai[0]?.tuTrang}–${conLai[0]?.denTrang}).`
          : `Đã nộp đủ ${kh.length}/${kh.length} cụm. Gọi hoan_tat_so_hoa với viec_id="${task.id}" để ghép, kiểm chứng và chốt.`;
        return result(
          [
            `Đã nhận cụm ${cs.idx} (trang ${cs.tuTrang}–${cs.denTrang}), ${md.length} ký tự.`,
            ...canhBaoNgay.map((c) => `Lưu ý: ${c}`),
            `Tiến độ: ${daNop.length}/${kh.length} cụm.`,
            buocSau,
          ].join("\n"),
          { viec_id: task.id, da_nop: daNop, con_lai: conLai.map((c) => c.idx), luu_y: canhBaoNgay },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "hoan_tat_so_hoa",
    {
      title: "Ghép, kiểm chứng và chốt bản số hóa",
      description:
        "Ghép các cụm đã nộp thành một bản Markdown liền mạch (xử lý trang chồng lấn, câu và bảng dang dở), " +
        "chạy bộ kiểm chứng tự động (liên tục số điều, khoản/điểm, độ dài so với lớp văn bản, bảng, công thức, " +
        "khối chữ ký), lưu bản Markdown vào kho và đẩy tiếp bước phân tích cấu trúc. " +
        "Điểm chất lượng thấp thì việc chuyển sang trạng thái chờ biên tập duyệt thay vì chốt.",
      inputSchema: {
        viec_id: z.string().uuid(),
        bo_qua_canh_bao: z
          .boolean()
          .optional()
          .describe("Vẫn chốt dù kiểm chứng không đạt (dùng khi biên tập viên đã xem và chấp nhận)."),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ viec_id, bo_qua_canh_bao }: { viec_id: string; bo_qua_canh_bao?: boolean }) => {
      try {
        requireWrite();
        const r = await hoanTatSoHoa({
          viecId: viec_id,
          ...(bo_qua_canh_bao === undefined ? {} : { boQuaCanhBao: bo_qua_canh_bao }),
        });
        const dat = r.trangThai === "xong";
        const bangKiemTra = r.kiemTra
          .map((m) => `  ${m.dat ? "đạt " : "KHÔNG"} ${m.ten}: ${m.chiTiet}`)
          .join("\n");
        return result(
          [
            `${dat ? "Đã chốt" : "CHƯA chốt (cần biên tập soát)"} bản số hóa ${r.soKyHieu}.`,
            `  Điểm chất lượng: ${r.diem} (ngưỡng 0,95)`,
            `  Markdown: ${r.markdown.length} ký tự, ${r.soLieu.dieu} điều, ${r.soLieu.bang} bảng`,
            `  Lưu tại: ${r.markdownUri} (${storageLabel()})`,
            dat
              ? `  Đã đẩy job phân tích cấu trúc qua ${r.cachDay}. Bản Markdown chính thức sẽ nằm ở document_versions sau bước parse.`
              : `  Việc chuyển sang trạng thái "chờ biên tập duyệt". Sửa lại cụm sai rồi gọi lại hoan_tat_so_hoa, hoặc gọi với bo_qua_canh_bao=true nếu đã xem và chấp nhận.`,
            "",
            "Kiểm chứng tự động:",
            bangKiemTra,
            r.canhBao.length ? `\nCảnh báo:\n${r.canhBao.map((c) => `  - ${c.message}`).join("\n")}` : "",
          ].join("\n"),
          {
            viec_id: r.viecId,
            trang_thai: r.trangThai,
            diem: r.diem,
            markdown_uri: r.markdownUri,
            kiem_tra: r.kiemTra,
            canh_bao: r.canhBao,
            so_lieu: r.soLieu,
            so_khoi_trung: r.soKhoiTrung,
          },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "bo_qua_viec_so_hoa",
    {
      title: "Bỏ qua một việc số hóa",
      description:
        "Đánh dấu việc số hóa là không làm được (tệp hỏng, không phải văn bản QPPL, thiếu trang) kèm lý do, " +
        "để nó không chiếm chỗ trong hàng đợi và biên tập viên biết mà xử lý.",
      inputSchema: {
        viec_id: z.string().uuid(),
        ly_do: z.string().min(5).describe("Vì sao không số hóa được. Ghi cụ thể để người sau xử lý được."),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ viec_id, ly_do }: { viec_id: string; ly_do: string }) => {
      try {
        requireWrite();
        const task = await layViecSoHoa(viec_id);
        if (!task) throw new ToolError(`Không có việc số hóa ${viec_id}`);
        await capNhatViecSoHoa(task.id, { state: "bo_qua", error: ly_do, finished: true });
        return result(`Đã bỏ qua việc số hóa ${viec_id}: ${ly_do}`, { viec_id, trang_thai: "bo_qua" });
      } catch (e) {
        return errorResult(e);
      }
    },
  );

  reg.add(
    "trang_thai_so_hoa",
    {
      title: "Tình hình số hóa",
      description:
        "Thống kê việc số hóa theo trạng thái và theo tuyến, kèm danh sách việc đang chờ hoặc đang làm dở. " +
        "Dùng để biết còn bao nhiêu văn bản phải số hóa và việc nào đang treo.",
      inputSchema: {
        trang_thai: z.enum(["cho", "dang_lam", "cho_duyet", "xong", "loi", "bo_qua"]).optional(),
        gioi_han: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ trang_thai, gioi_han }: { trang_thai?: string; gioi_han?: number }) => {
      try {
        const tk = await thongKeSoHoa();
        const ds = await danhSachViecSoHoa({
          ...(trang_thai ? { state: trang_thai as never } : {}),
          limit: gioi_han ?? 20,
        });
        const dong = ds.map(
          (t) =>
            `  ${t.so_ky_hieu} — ${NHAN_TRANG_THAI_VIEC[t.state] ?? t.state} | tuyến ${t.route} | ` +
            `${t.so_cua_so_da_nop}/${(t.windows ?? []).length} cụm | việc ${t.id}`,
        );
        return result(
          [
            `Số hóa — theo trạng thái: ${JSON.stringify(tk.theoTrangThai)}`,
            `           theo tuyến   : ${JSON.stringify(tk.theoTuyen)}`,
            `           cụm đã nộp   : ${tk.soCuaSoDaNop}${tk.choDayParse ? ` | chờ đẩy parse: ${tk.choDayParse}` : ""}`,
            "",
            dong.length ? dong.join("\n") : "  (không có việc nào khớp)",
          ].join("\n"),
          { thong_ke: tk, danh_sach: ds },
        );
      } catch (e) {
        return errorResult(e);
      }
    },
  );
}
