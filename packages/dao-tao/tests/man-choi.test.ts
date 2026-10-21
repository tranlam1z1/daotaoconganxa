/**
 * Màn chơi (mô-đun M8) và biên bản cuối lượt (mô-đun M4), docs/PLAN.md GĐ-T1.
 */
import { describe, expect, test } from "bun:test";
import {
  CHUA_CO_MUC_PHAT,
  dongBienBan,
  manCaoNhatDaQua,
  manDangMo,
  manMacDinh,
  moDuocMan,
  moTaMucPhatBienBan,
} from "../src/index.ts";

describe("màn chơi", () => {
  test("màn 1 luôn mở; qua màn (từ 1 sao) mở màn kế tiếp; không nhảy cóc", () => {
    expect(manDangMo(5, new Map())).toEqual([1]);
    expect(manDangMo(5, new Map([[1, 1]]))).toEqual([1, 2]);
    expect(manDangMo(5, new Map([[1, 0]]))).toEqual([1]);
    // Màn 3 có sao nhưng màn 2 chưa qua: chỉ tính tới màn 1.
    expect(
      manCaoNhatDaQua(
        new Map([
          [1, 2],
          [3, 3],
        ]),
      ),
    ).toBe(1);
    expect(
      manDangMo(
        3,
        new Map([
          [1, 3],
          [2, 3],
          [3, 3],
        ]),
      ),
    ).toEqual([1, 2, 3]);
  });

  test("mở được màn nào, màn mặc định là màn cao nhất đang mở", () => {
    const sao = new Map([[1, 1]]);
    expect(moDuocMan(2, 5, sao)).toBe(true);
    expect(moDuocMan(3, 5, sao)).toBe(false);
    expect(moDuocMan(0, 5, sao)).toBe(false);
    expect(moDuocMan(1.5, 5, sao)).toBe(false);
    expect(manMacDinh(5, sao)).toBe(2);
  });
});

describe("biên bản cuối lượt", () => {
  const MP = {
    "mp-1": {
      ma: "mp-1",
      version: 1,
      hanh_vi: "Hành vi thử",
      phat_tu: 800_000,
      phat_den: 1_000_000,
      tru_diem: 2,
      hinh_thuc_bo_sung: [],
      can_cu: "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6",
    },
  };

  test("lỗi có mức phạt đã duyệt: ghi khung tiền, trừ điểm, gộp căn cứ không trùng", () => {
    const d = dongBienBan({
      hanhVi: "A",
      chiTiet: "B",
      canCu: ["vn:x", "vn:x"],
      maMucPhat: "mp-1",
      mucPhat: MP,
    });
    expect(d.muc_phat?.ma).toBe("mp-1");
    expect(d.can_cu).toEqual(["vn:x", "vn:vbqppl:nd:168/2024/NĐ-CP#dieu-6"]);
    expect(moTaMucPhatBienBan(d.muc_phat)).toBe(
      "Phạt tiền từ 800.000 đồng đến 1.000.000 đồng; trừ 2 điểm giấy phép lái xe",
    );
  });

  test("chưa có mức phạt đã duyệt (mã null hoặc không có trong bảng): ghi rõ, không tự đặt số", () => {
    expect(
      dongBienBan({ hanhVi: "A", chiTiet: "B", canCu: [], maMucPhat: null, mucPhat: MP }).muc_phat,
    ).toBeNull();
    expect(
      dongBienBan({ hanhVi: "A", chiTiet: "B", canCu: [], maMucPhat: "khong-co", mucPhat: MP }).muc_phat,
    ).toBeNull();
    expect(moTaMucPhatBienBan(null)).toBe(CHUA_CO_MUC_PHAT);
  });
});
