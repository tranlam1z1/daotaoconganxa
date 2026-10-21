import { describe, expect, test } from "bun:test";
import { bacKhop, diemKhop, khopNut, khopTuTruyVan, tuCoDau, xepTheoDoKhop } from "./do-khop.ts";

const xep = (q: string, ds: string[][]) => xepTheoDoKhop(ds, q, (d) => d).map((d) => d[0]);

describe("xepTheoDoKhop", () => {
  test("nguyên cụm > đủ từ rời > chỉ vài từ", () => {
    expect(
      xep("mũ bảo hiểm", [
        ["Chở người không đội mũ"],
        ["Bảo đảm mũ không nguy hiểm"],
        ["Không đội mũ bảo hiểm khi đi xe"],
      ]),
    ).toEqual(["Không đội mũ bảo hiểm khi đi xe", "Bảo đảm mũ không nguy hiểm", "Chở người không đội mũ"]);
  });

  test("từ gõ có dấu không bị dòng chỉ trùng khi bỏ dấu chen lên trước", () => {
    // Cả hai dòng đều qua bộ lọc SQL: "den" có trong "đến", "do" có trong "độ".
    expect(
      xep("xe máy vượt đèn đỏ", [
        ["Chạy quá tốc độ quy định từ 05 km/h đến dưới 10 km/h", "vượt tốc độ", "xe máy"],
        ["Không chấp hành hiệu lệnh của đèn tín hiệu giao thông", "vượt đèn đỏ", "xe máy"],
      ]),
    ).toEqual([
      "Không chấp hành hiệu lệnh của đèn tín hiệu giao thông",
      "Chạy quá tốc độ quy định từ 05 km/h đến dưới 10 km/h",
    ]);
  });

  test("gõ không dấu vẫn tính là khớp nguyên cụm", () => {
    expect(diemKhop("nong do con", ["Có nồng độ cồn trong hơi thở"])).toBeGreaterThan(
      diemKhop("nong do con", ["Nồng nặc, độ cồn cao"]),
    );
  });

  test("bacKhop: trùng sau khi bỏ dấu không được tính là đủ từ", () => {
    const q = "phạt nồng độ cồn";
    expect(bacKhop(q, ["sự phát triển kinh tế, sản xuất nông nghiệp, mức độ, con đường"])).toBe(0);
    expect(bacKhop(q, ["Phạt tiền người điều khiển xe mà trong hơi thở có nồng độ cồn"])).toBe(1);
    expect(bacKhop(q, ["Mức phạt nồng độ cồn"])).toBe(2);
    expect(bacKhop("phat nong do con", ["Mức phạt nồng độ cồn"])).toBe(2);
    expect(tuCoDau("Phạt nong độ con")).toEqual(["phạt", "độ"]);
  });

  test("khopNut: ngữ cảnh bù từ thiếu lên bậc 1, không lên bậc 2; cụm liền dài hơn thì lien lớn hơn", () => {
    const q = "phạt nồng độ cồn";
    const khoan = ["Phạt tiền đối với một trong các hành vi sau"];
    const diem = khopNut(q, ["Điều khiển xe mà trong hơi thở có nồng độ cồn"], khoan);
    expect(diem.bac).toBe(1);
    expect(khopNut(q, ["Điều khiển xe mà trong hơi thở có nồng độ cồn"], []).bac).toBe(0);
    expect(khopNut(q, ["Không chấp hành hiệu lệnh"], ["Mức phạt nồng độ cồn"]).bac).toBe(1);
    expect(khopNut(q, ["Không chấp hành hiệu lệnh"], khoan).bac).toBe(0);
    expect(diem.lien).toBeGreaterThan(khopNut(q, ["Phạt người có nồng nặc mùi, độ cồn cao"], []).lien);
    expect(diem.lien).toBe(0.75);
    expect(khopNut(q, ["Mức phạt nồng độ cồn"], []).lien).toBe(1);
  });

  test("khopTuTruyVan: từ gõ có dấu phải đúng dấu, gõ không dấu thì khớp mọi dấu", () => {
    const khop = khopTuTruyVan("phạt nong độ cồn");
    expect(khop("Phạt")).toBe(true);
    expect(khop("Phát")).toBe(false);
    expect(khop("nồng")).toBe(true);
    expect(khop("con")).toBe(false);
  });

  test("cụm không khớp vắt qua hai đoạn", () => {
    expect(diemKhop("tốc độ", ["Chạy quá tốc", "độ cồn"])).toBeLessThan(diemKhop("tốc độ", ["Quá tốc độ"]));
  });

  test("ngang điểm giữ thứ tự sẵn có; truy vấn rỗng giữ nguyên", () => {
    const ds = [["b tốc độ"], ["a tốc độ"]];
    expect(xep("tốc độ", ds)).toEqual(["b tốc độ", "a tốc độ"]);
    expect(xepTheoDoKhop(ds, "  ", (d) => d)).toBe(ds);
  });
});
