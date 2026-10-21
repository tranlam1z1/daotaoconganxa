/// <reference types="bun" />
/** Sổ ghi số đo kèm ảnh (app/lib/so-do.ts), phần không cần trình duyệt. */
import { describe, expect, test } from "bun:test";
import { dongSoDo, ngatDong, tenTepSoDo, thoiGianChu } from "../app/lib/so-do";

describe("dongSoDo", () => {
  test("đủ tên, số đo, đơn vị", () => {
    expect(dongSoDo({ ten: " Chiều cao thành thùng ", giaTri: "2.350", donVi: "mm" }, 1)).toBe(
      "1. Chiều cao thành thùng: 2.350 mm",
    );
  });
  test("thiếu tên hoặc thiếu số đo vẫn ra dòng đọc được", () => {
    expect(dongSoDo({ ten: "", giaTri: "4,2", donVi: "m" }, 2)).toBe("2. Số đo: 4,2 m");
    expect(dongSoDo({ ten: "Vết phanh", giaTri: " ", donVi: "m" }, 3)).toBe("3. Vết phanh: chưa nhập");
  });
});

test("thời gian và tên tệp theo giờ của máy", () => {
  const d = new Date(2026, 9, 10, 14, 5);
  expect(thoiGianChu(d)).toBe("14:05 ngày 10/10/2026");
  expect(tenTepSoDo(d)).toBe("so-do-20261010-1405.jpg");
});

describe("ngatDong", () => {
  const doRong = (s: string) => s.length;
  test("ngắt ở khoảng trắng khi vượt bề rộng", () => {
    expect(ngatDong("mot hai ba bon nam", doRong, 8)).toEqual(["mot hai", "ba bon", "nam"]);
  });
  test("từ dài hơn cả dòng thì cắt giữa từ để không dòng nào tràn", () => {
    expect(ngatDong("ab abcdefghijkl cd", doRong, 5)).toEqual(["ab", "abcde", "fghij", "kl cd"]);
  });
  test("chuỗi rỗng không ra dòng nào", () => {
    expect(ngatDong("   ", doRong, 5)).toEqual([]);
  });
});
