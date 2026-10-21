/**
 * Tự nộp lượt thi quá hạn (docs/PLAN.md GĐ6). Chạy lặp mỗi phút theo lịch do runner đăng ký
 * (`LICH_THI_HET_GIO`), để lượt của người đã đóng trình duyệt vẫn được chấm đúng giờ.
 *
 * Cùng nhịp đó, gửi mô hình chấm các câu tự luận còn chờ: lượt vừa tự nộp, hoặc lượt mà API
 * dừng giữa chừng khi chấm. Câu mô hình không chấm được chuyển cho giảng viên.
 *
 * Không thuộc đường ống nạp kho: job không mang runId nên vỏ bọc không ghi sổ cái. Đây chỉ là
 * lớp mỏng; cách chấm nằm ở packages/db/src/de-thi.ts, dùng chung với API.
 */
import { chamTuLuanConTon, tuNopLuotQuaHan } from "@qdpl/db";
import { goiMoHinhChamTuLuan } from "@qdpl/llm";
import { QUEUES } from "@qdpl/queue";
import { defineStage } from "../stage.ts";

/** Mã lịch lặp trong BullMQ; đăng ký lại (upsert) mỗi lần worker khởi động không sinh lịch trùng. */
export const LICH_THI_HET_GIO = { id: "thi-het-gio-moi-phut", everyMs: 60_000 } as const;

/** Số lượt có câu tự luận chờ chấm xử lý mỗi phút, để một nhịp không kéo dài quá lịch kế tiếp. */
const SO_LUOT_CHAM_MOI_NHIP = 20;

export const thiHetGioStage = defineStage(QUEUES.thiHetGio, async () => {
  const now = new Date();
  const soLuot = await tuNopLuotQuaHan(now);
  const soLuotChamTuLuan = await chamTuLuanConTon(goiMoHinhChamTuLuan, SO_LUOT_CHAM_MOI_NHIP, now);
  return { detail: { so_luot_tu_nop: soLuot, so_luot_cham_tu_luan: soLuotChamTuLuan } };
});
