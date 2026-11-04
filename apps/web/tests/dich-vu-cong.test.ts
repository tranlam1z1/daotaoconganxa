import { describe, expect, test } from "bun:test";
import { CONG_DICH_VU, DICH_VU_CONG, timDichVuCong } from "../app/lib/dich-vu-cong";

describe("danh mục dịch vụ công", () => {
  test("mỗi mục trỏ tới trang thủ tục riêng, trừ mục còn phải tìm theo từ khóa", () => {
    for (const d of DICH_VU_CONG) {
      if (d.tuKhoa) expect(d.url).toBe(CONG_DICH_VU);
      else expect(d.url).toMatch(/^https:\/\/dichvucong\.gov\.vn\/p\/home\/[\w-]+\.html\?ma_thu_tuc=[\d.]+$/);
    }
  });

  test("vẫn tìm được theo các từ người dùng hay gõ", () => {
    for (const q of ["tuyển dụng", "chứng thực", "hưu trí", "lý lịch"]) {
      expect(timDichVuCong(q).length).toBeGreaterThan(0);
    }
  });
});
