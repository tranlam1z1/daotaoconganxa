import { describe, expect, test } from "bun:test";
import { BoHam, docCauHinhBoHam, thoiGianNghiMs } from "../src/bull/bo-ham.ts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("bộ hãm toàn tiến trình", () => {
  test("đọc cấu hình từ biến môi trường, mặc định 2 job và không nghỉ", () => {
    expect(docCauHinhBoHam({})).toEqual({ toiDa: 2, duty: 1 });
    expect(docCauHinhBoHam({ BULL_MAX_ACTIVE: "1", BULL_CPU_DUTY: "0.5" })).toEqual({ toiDa: 1, duty: 0.5 });
    // Giá trị vô nghĩa thì về mặc định; duty > 1 bị kẹp về 1.
    expect(docCauHinhBoHam({ BULL_MAX_ACTIVE: "0", BULL_CPU_DUTY: "9" })).toEqual({ toiDa: 2, duty: 1 });
  });

  test("thời gian nghỉ theo tỷ lệ chiếm CPU", () => {
    expect(thoiGianNghiMs(1000, 1)).toBe(0);
    expect(thoiGianNghiMs(1000, 0.5)).toBe(1000);
    expect(thoiGianNghiMs(300, 0.25)).toBe(900);
  });

  test("không bao giờ chạy quá toiDa job cùng lúc, dù nhiều hàng đợi cùng đẩy", async () => {
    const ham = new BoHam({ toiDa: 2, duty: 1 });
    let dangChay = 0;
    let dinh = 0;
    const job = async () => {
      dangChay += 1;
      dinh = Math.max(dinh, dangChay);
      await sleep(20);
      dangChay -= 1;
    };
    await Promise.all(Array.from({ length: 7 }, () => ham.chay(job)));
    expect(dinh).toBe(2);
    expect(ham.soDangChay).toBe(0);
    expect(ham.soDangCho).toBe(0);
  });

  test("giữ chỗ trong lúc nghỉ, và trả chỗ cả khi job ném lỗi", async () => {
    const ham = new BoHam({ toiDa: 1, duty: 0.5 });
    const t0 = Date.now();
    await ham.chay(async () => {
      await sleep(40);
    });
    // Job 40 ms với duty 0,5 -> nghỉ thêm ~40 ms trước khi trả chỗ.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(75);
    await expect(
      ham.chay(async () => {
        throw new Error("hỏng");
      }),
    ).rejects.toThrow("hỏng");
    expect(ham.soDangChay).toBe(0);
  });
});
