import { chuanHoaMaNhom, NHOM_HOC_TAP } from "@qdpl/dao-tao";
import { z } from "zod";

export const maNhomHocTapSchema = z.preprocess(
  (ma) => (typeof ma === "string" ? chuanHoaMaNhom(ma) : ma),
  z.enum(NHOM_HOC_TAP),
);
/** Giới hạn đầu vào; loại trùng sau khi chuẩn hóa mã cũ. */
export const danhSachNhomHocTapSchema = z
  .array(maNhomHocTapSchema)
  .max(12)
  .transform((nhom) => [...new Set(nhom)]);
