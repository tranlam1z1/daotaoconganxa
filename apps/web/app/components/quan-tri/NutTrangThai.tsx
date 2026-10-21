/**
 * Hàng nút chuyển trạng thái nội dung (chuyên đề, bài học). Loader tính sẵn những trạng thái người
 * dùng được đặt; API vẫn kiểm lại bước chuyển và quyền.
 */
import { Form } from "react-router";

import { NUT_CHUYEN, type TrangThaiNoiDung } from "../../lib/soan-bai-giang";
import { Button } from "../ui/Button";

export function NutTrangThai({
  datDuoc,
  ban,
  an = {},
}: {
  datDuoc: TrangThaiNoiDung[];
  ban: boolean;
  /** Trường ẩn gửi kèm, ví dụ id của nội dung. */
  an?: Record<string, string>;
}) {
  if (!datDuoc.length) return null;
  return (
    <Form method="post" className="flex flex-wrap gap-2">
      <input type="hidden" name="intent" value="trang_thai" />
      {Object.entries(an).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {datDuoc.map((t) => (
        <Button
          key={t}
          type="submit"
          name="trangThai"
          value={t}
          disabled={ban}
          variant={t === "xuat_ban" || t === "cho_phap_che" ? "primary" : "secondary"}
        >
          {NUT_CHUYEN[t]}
        </Button>
      ))}
    </Form>
  );
}
