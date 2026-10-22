/**
 * Lộ trình dẫn dắt: đúng thứ tự, đủ bước, và — quan trọng nhất — KHÔNG diễn giải nội dung
 * pháp lý. Lời dẫn chỉ nói khối đó là gì và cần làm gì với nó.
 */
import { describe, expect, test } from "bun:test";
import { type KhoiDeDanDat, lapLoTrinhDanDat, soatChuMascot } from "../src/index.ts";

const khoi: KhoiDeDanDat[] = [
  { id: "k1", ordinal: 1, kind: "kich_ban" },
  { id: "k2", ordinal: 2, kind: "giang" },
  { id: "k3", ordinal: 3, kind: "can_cu" },
  { id: "k4", ordinal: 4, kind: "hoi_nhanh" },
  { id: "k5", ordinal: 5, kind: "tom_tat" },
];

const o = {
  tenNhanVat: "Mực Thước",
  vaiNhanVat: "Cố vấn trưởng",
  tieuDeBai: "Tổng quan và thứ bậc văn bản áp dụng",
  soPhut: 18,
  soBaiTap: 2,
};

describe("lộ trình dẫn dắt", () => {
  test("mở đầu, từng khối theo thứ tự, bài tập, kết thúc", () => {
    const lt = lapLoTrinhDanDat(khoi, o);
    expect(lt).toHaveLength(khoi.length + 3);
    expect(lt[0]?.nhan).toBe("Bắt đầu");
    expect(lt.at(-2)?.nhan).toBe("Bài tập");
    expect(lt.at(-1)?.nhan).toBe("Hết bài");
    // Các bước giữa trỏ đúng khối, đúng thứ tự.
    expect(lt.slice(1, 6).map((b) => b.blockId)).toEqual(["k1", "k2", "k3", "k4", "k5"]);
  });

  test("không có bài tập thì bỏ bước bài tập", () => {
    const lt = lapLoTrinhDanDat(khoi, { ...o, soBaiTap: 0 });
    expect(lt.some((b) => b.nhan === "Bài tập")).toBe(false);
  });

  test("căn cứ hỏng được cảnh báo NGAY trước khi người học đọc nội dung", () => {
    const lt = lapLoTrinhDanDat(khoi, { ...o, canCuHong: true });
    expect(lt[1]?.nhan).toBe("Cảnh báo hiệu lực");
    expect(lt[1]?.trangThai).toBe("canh_bao");
    // Và phải đứng trước mọi bước gắn với khối nội dung.
    expect(lt.findIndex((b) => b.blockId !== null)).toBeGreaterThan(1);
  });

  test("khối căn cứ được nêu là căn cứ, với nét mặt nghiêm túc", () => {
    const b = lapLoTrinhDanDat(khoi, o).find((x) => x.blockId === "k3");
    expect(b?.nhan).toContain("Căn cứ");
    expect(b?.trangThai).toBe("nghiem_tuc");
  });

  test("khối lạ vẫn có bước dẫn, không bị bỏ qua", () => {
    const lt = lapLoTrinhDanDat([{ id: "x", ordinal: 1, kind: "kieu_chua_co" }], o);
    expect(lt.find((b) => b.blockId === "x")).toBeTruthy();
  });

  test("bước được đánh số theo vị trí trong lộ trình, không theo ordinal trong kho", () => {
    // Khối bị xoá giữa chừng làm ordinal ngắt quãng; người học vẫn thấy "Phần 1, 2, 3".
    const thua = [
      { id: "a", ordinal: 3, kind: "giang" },
      { id: "b", ordinal: 9, kind: "can_cu" },
    ];
    const lt = lapLoTrinhDanDat(thua, o);
    expect(lt[1]?.nhan).toContain("Phần 1 trên 2");
    expect(lt[2]?.nhan).toContain("Phần 2 trên 2");
  });
});

describe("lời dẫn tuân thủ quy tắc hành văn", () => {
  test("không có dấu chấm than, tiểu từ tình thái hay khẩu ngữ", () => {
    const lt = lapLoTrinhDanDat(khoi, { ...o, canCuHong: true });
    for (const b of lt) {
      for (const chu of [b.nhan, b.loi, b.viec ?? ""]) {
        expect(soatChuMascot(chu)).toEqual([]);
      }
    }
  });

  test("lời dẫn không diễn giải nội dung pháp lý, chỉ điều hướng", () => {
    // Không câu nào viện dẫn điều khoản: diễn giải quy định là việc của khối đã qua duyệt
    // duyệt, nhân vật chỉ dẫn đường tới đó.
    for (const b of lapLoTrinhDanDat(khoi, o)) {
      expect(b.loi).not.toMatch(/Điều\s+\d|khoản\s+\d|điểm\s+[a-z]\)/);
    }
  });
});
