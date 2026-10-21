/**
 * Giai đoạn 4b — SỐ HÓA: chuẩn bị việc cho agent đọc PDF (ke-hoach/05).
 *
 * Bước này KHÔNG gọi mô hình và KHÔNG chờ ai: nó chỉ làm phần máy làm tốt hơn —
 * đọc lớp văn bản, phân loại tuyến, chia cụm trang, dựng bản nháp cho PDF có lớp
 * văn bản — rồi ghi một việc vào `sohoa_tasks`. Agent nhận việc đó qua MCP
 * (nhan_viec_so_hoa) và chính agent đẩy tiếp job `parse` khi hoàn tất.
 *
 * Thiết kế này thay cho cầu nối cũ sang services/docproc (Python): không còn tiến trình
 * Python nào phải chạy, và cũng không còn worker nào phải ngồi chờ hàng chục phút.
 */
import { addReview, getDocumentByUrn, taoViecSoHoa } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import {
  danhGiaLopVanBan,
  docTrangPdf,
  lapKeHoachCuaSo,
  nhapTuLopVanBan,
  phatHienDongLap,
} from "@qdpl/sohoa";
import { getObject, putText } from "@qdpl/storage";
import { defineStage } from "../stage.ts";

/** Chỉ PDF mới số hóa được bằng cách đọc trang. */
export function laPdf(uri: string): boolean {
  return uri.toLowerCase().endsWith(".pdf");
}

export const sohoaStage = defineStage(QUEUES.sohoa, async (job, ctx) => {
  const { documentUrn, inputPath, sourceRecordId, windowSize, overlap, runId } = job.data;
  const doc = await getDocumentByUrn(documentUrn);
  if (!doc) throw new Error(`Không có văn bản ${documentUrn} trong CSDL`);

  if (!laPdf(inputPath)) {
    // .doc/.rtf nhị phân: không đọc được bằng TypeScript và cũng không đưa thẳng cho agent được.
    // Đưa vào hàng đợi biên tập để người vận hành lấy bản DOCX/PDF khác, thay vì chết lặng.
    const reviewId = await addReview({
      kind: "conversion",
      refId: doc.id,
      documentUrn,
      priority: 5,
      payload: { inputPath, reason: "định dạng không đọc được bằng đường số hóa PDF" },
    });
    return {
      documentId: doc.id,
      documentUrn,
      skipped: true,
      reason: `Định dạng của ${inputPath} không số hóa được (chỉ hỗ trợ PDF). Đã tạo việc biên tập ${reviewId}.`,
    };
  }

  const bytes = await getObject(inputPath);
  await ctx.progress(30, "đã tải tệp gốc");

  const trang = docTrangPdf(bytes);
  const danhGia = danhGiaLopVanBan(trang);
  const keHoach = lapKeHoachCuaSo(danhGia.soTrang, {
    ...(windowSize ? { kichThuoc: windowSize } : {}),
    ...(overlap !== undefined ? { chongLan: overlap } : {}),
  });
  await ctx.progress(60, `${danhGia.soTrang} trang, ${keHoach.length} cụm`);

  // PDF có lớp văn bản: dựng sẵn bản nháp nguyên văn để agent khỏi phải chép lại từ ảnh.
  let draftUri: string | undefined;
  if (danhGia.tuyen === "pdf_text") {
    const nhap = nhapTuLopVanBan(trang, { dongLap: phatHienDongLap(trang) });
    if (nhap.trim()) {
      draftUri = `derived/${doc.id}/so-hoa/nhap.md`;
      await putText(draftUri, nhap);
    }
  }

  const task = await taoViecSoHoa({
    documentId: doc.id,
    fileUri: inputPath,
    ...(sourceRecordId ? { sourceRecordId } : {}),
    route: danhGia.tuyen,
    pageCount: danhGia.soTrang,
    windowSize: keHoach[0] ? keHoach[0].denTrang - keHoach[0].tuTrang + 1 : (windowSize ?? 5),
    overlap: overlap ?? 1,
    windows: keHoach,
    ...(draftUri ? { draftUri } : {}),
    ...(runId ? { runId } : {}),
  });
  await ctx.progress(100, `việc số hóa ${task.id}`);

  ctx.log.info("Đã tạo việc số hóa cho agent", {
    viecId: task.id,
    documentUrn,
    tuyen: danhGia.tuyen,
    soTrang: danhGia.soTrang,
    soCum: keHoach.length,
  });

  return {
    documentId: doc.id,
    documentUrn,
    route: danhGia.tuyen,
    // Không đẩy job kế tiếp: bước `parse` do agent đẩy sau khi hoan_tat_so_hoa.
    next: 0,
    detail: {
      viecId: task.id,
      soTrang: danhGia.soTrang,
      soCum: keHoach.length,
      tyLeTrangCoChu: danhGia.tyLeTrangCoChu,
      lyDoTuyen: danhGia.lyDo,
      ...(draftUri ? { draftUri } : {}),
    },
  };
});
