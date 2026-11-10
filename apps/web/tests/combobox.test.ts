import { describe, expect, test } from "bun:test";
import { phimCombobox, viTriKhiMo } from "../app/lib/combobox";

describe("viTriKhiMo", () => {
  test("mở danh sách đánh dấu dòng đang chọn, không mặc định dòng đầu", () => {
    expect(viTriKhiMo(["a", "b", "c"], "b")).toBe(1);
    expect(viTriKhiMo(["a", "b"], "")).toBe(-1);
    expect(viTriKhiMo(["a", "b"], "z")).toBe(-1);
  });
});

describe("phimCombobox", () => {
  test("Enter khi chưa có dòng nào được đánh dấu thì đóng, để biểu mẫu gửi đi", () => {
    expect(phimCombobox("Enter", -1, 3, true)).toEqual({ viTri: -1, hanhDong: "dong_gui" });
  });

  test("Enter trên dòng đã đánh dấu thì nhận dòng đó", () => {
    expect(phimCombobox("Enter", 2, 3, true)).toEqual({ viTri: 2, hanhDong: "nhan" });
  });

  test("Enter khi danh sách đóng không làm gì, để biểu mẫu gửi đi", () => {
    expect(phimCombobox("Enter", 0, 3, false)).toEqual({ viTri: 0, hanhDong: null });
  });

  test("mũi tên xuống, lên trong giới hạn; danh sách rỗng giữ -1", () => {
    expect(phimCombobox("ArrowDown", -1, 3, true)).toEqual({ viTri: 0, hanhDong: "giu" });
    expect(phimCombobox("ArrowDown", 2, 3, true)).toEqual({ viTri: 2, hanhDong: "giu" });
    expect(phimCombobox("ArrowUp", 0, 3, true)).toEqual({ viTri: 0, hanhDong: "giu" });
    expect(phimCombobox("ArrowDown", -1, 0, true)).toEqual({ viTri: -1, hanhDong: "giu" });
  });

  test("mũi tên xuống khi đóng thì mở; Esc khi mở thì đóng", () => {
    expect(phimCombobox("ArrowDown", -1, 3, false).hanhDong).toBe("mo");
    expect(phimCombobox("Escape", 1, 3, true)).toEqual({ viTri: 1, hanhDong: "dong" });
    expect(phimCombobox("a", 1, 3, true)).toEqual({ viTri: 1, hanhDong: null });
  });
});
