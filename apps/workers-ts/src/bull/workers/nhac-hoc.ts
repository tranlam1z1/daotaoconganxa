/**
 * Nhắc học và thông báo đẩy (docs/PLAN.md GĐ15). Chạy lặp mỗi 15 phút theo lịch do runner đăng ký
 * (`LICH_NHAC_HOC`): giờ học tự chọn, đề thi mới
 * được giao. Tôn trọng giờ yên lặng 22h–6h (mỗi người đổi được).
 *
 * Lớp mỏng: quyết định gửi gì nằm ở packages/dao-tao/src/lich-nhac.ts, việc chống gửi trùng và
 * dọn đăng ký hết hạn nằm ở packages/db/src/thong-bao.ts. Tệp này chỉ lo phần Web Push (VAPID).
 */
import { chayNhacHoc, type GuiDay } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import webpush from "web-push";
import { log } from "../../log.ts";
import { defineStage } from "../stage.ts";

/** Mã lịch lặp trong BullMQ; đăng ký lại (upsert) mỗi lần worker khởi động không sinh lịch trùng. */
export const LICH_NHAC_HOC = { id: "nhac-hoc-15-phut", everyMs: 15 * 60_000 } as const;

/** Thông báo cũ hơn 12 giờ thì dịch vụ đẩy bỏ đi: nhắc học muộn nửa ngày không còn ích gì. */
const THOI_GIAN_SONG_GIAY = 12 * 3600;

/** Tùy chọn gửi Web Push theo khóa VAPID trong biến môi trường; null khi chưa cấu hình. */
export function tuyChonGui(env: NodeJS.ProcessEnv = process.env): webpush.RequestOptions | null {
  const pub = env.VAPID_PUBLIC_KEY?.trim();
  const priv = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim() || "mailto:hotro@quydinhphapluat.vn";
  if (!pub || !priv) return null;
  return {
    vapidDetails: { subject, publicKey: pub, privateKey: priv },
    TTL: THOI_GIAN_SONG_GIAY,
    urgency: "normal",
  };
}

/**
 * Hàm gửi Web Push; null khi chưa cấu hình. `guiThat` mặc định là thư viện web-push, test truyền
 * hàm giả để kiểm cách xử lý lỗi của dịch vụ đẩy.
 */
export function taoHamGui(
  env: NodeJS.ProcessEnv = process.env,
  guiThat: typeof webpush.sendNotification = webpush.sendNotification,
): GuiDay | null {
  const tuyChon = tuyChonGui(env);
  if (!tuyChon) return null;
  return async (dk, noiDung) => {
    try {
      await guiThat({ endpoint: dk.endpoint, keys: { p256dh: dk.p256dh, auth: dk.auth } }, noiDung, tuyChon);
      return { ok: true };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      return { ok: false, status };
    }
  };
}

export const nhacHocStage = defineStage(QUEUES.nhacHoc, async () => {
  const gui = taoHamGui();
  if (!gui) {
    // Chưa có khóa VAPID thì không gửi được: không ghi notifications_sent, để khi cấu hình xong
    // các thông báo còn trong cửa sổ vẫn được gửi.
    log.warn("Chưa đặt VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: bỏ qua nhịp nhắc học");
    return { detail: { bo_qua: "chua_cau_hinh_vapid" } };
  }
  const kq = await chayNhacHoc(new Date(), gui);
  return { detail: { ...kq } };
});
