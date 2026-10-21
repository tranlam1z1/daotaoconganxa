/**
 * Nhật ký hoạt động học theo ngày (`daily_activity`).
 *
 * Một dòng cho mỗi ngày người học có hoạt động. Dùng để biết hôm nay đã học chưa (không nhắc
 * học lần nữa) và để gộp nhật ký của tài khoản khách vào tài khoản thật.
 */
import { ngayVietNam } from "@qdpl/dao-tao";
import { type Tx } from "./client.ts";

/** Ghi một dòng hoạt động cho ngày `ngay` (YYYY-MM-DD). Đã có dòng thì giữ nguyên. */
export async function ghiHoatDong(tx: Tx, accountId: string, ngay: string): Promise<void> {
  await tx`
    INSERT INTO daily_activity (account_id, day, xp) VALUES (${accountId}, ${ngay}::date, 0)
    ON CONFLICT (account_id, day) DO NOTHING`;
}

/** Ghi hoạt động cho hôm nay, theo giờ Việt Nam. */
export async function ghiHoatDongHomNay(tx: Tx, accountId: string, now: Date = new Date()): Promise<void> {
  await ghiHoatDong(tx, accountId, ngayVietNam(now));
}
