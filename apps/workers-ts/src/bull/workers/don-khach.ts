/**
 * Dọn tài khoản khách (migration 0062). Chạy lặp 6 giờ một lần theo lịch do runner đăng ký
 * (`LICH_DON_KHACH`): xóa khách bỏ không quá 30 ngày cùng mọi tiến độ.
 *
 * Chỉ là lớp mỏng; điều kiện xóa ở packages/db/src/tai-khoan-khach.ts.
 */
import { donTaiKhoanKhach } from "@qdpl/db";
import { QUEUES } from "@qdpl/queue";
import { defineStage } from "../stage.ts";

/** Mã lịch lặp trong BullMQ; upsert mỗi lần worker khởi động không sinh lịch trùng. */
export const LICH_DON_KHACH = { id: "don-khach-6-gio", everyMs: 6 * 3600_000 } as const;

export const donKhachStage = defineStage(QUEUES.donKhach, async () => {
  const daXoa = await donTaiKhoanKhach(new Date());
  return { detail: { da_xoa: daXoa } };
});
