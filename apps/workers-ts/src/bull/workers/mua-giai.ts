/**
 * Mùa giải đơn vị (docs/PLAN.md GĐ-G6). Chạy lặp mỗi giờ theo lịch do runner đăng ký
 * (`LICH_MUA_GIAI`). Mỗi lần chạy: bắt đầu mùa đã tới ngày, chốt mọi tuần đã qua 06:00 thứ Hai mà
 * chưa chốt (nhịp bị lỡ vẫn chốt bù được), kết thúc mùa khi chốt xong tuần cuối.
 *
 * Chỉ là lớp mỏng; luật và bước chốt idempotent ở packages/db/src/mua-giai.ts, dùng chung với API.
 */
import { chayMuaGiai } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { defineStage } from "../stage.ts";

/** Mã lịch lặp trong BullMQ; upsert mỗi lần worker khởi động không sinh lịch trùng. */
export const LICH_MUA_GIAI = { id: "mua-giai-moi-gio", everyMs: 60 * 60_000 } as const;

export const muaGiaiStage = defineStage(QUEUES.muaGiai, async () => {
  const kq = await chayMuaGiai(new Date());
  return { detail: { ...kq } };
});
