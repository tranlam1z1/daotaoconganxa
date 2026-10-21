import { describe, expect, test } from "bun:test";
import { buildPath, findCitations, formatCitation, toUrn } from "./index.ts";

describe("nhận diện viện dẫn", () => {
  test("viện dẫn đầy đủ điểm-khoản-điều-văn bản", () => {
    const c = findCitations("Theo quy định tại điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP thì ...");
    expect(c.length).toBe(1);
    expect(c[0]!.diem).toBe("a");
    expect(c[0]!.khoan).toBe("2");
    expect(c[0]!.dieu).toBe("15");
    expect(c[0]!.soKyHieu).toBe("45/2026/NĐ-CP");
    expect(c[0]!.docType).toBe("nd");
    expect(c[0]!.path).toBe("dieu-15.khoan-2.diem-a");
  });

  test("chuyển thành URN", () => {
    const c = findCitations("khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP")[0]!;
    expect(toUrn(c)).toBe("vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2");
    expect(toUrn(c, undefined, "2026-03-01")).toBe("vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2@2026-03-01");
  });

  test("viện dẫn nội bộ 'Nghị định này'", () => {
    const c = findCitations("thực hiện theo quy định tại Điều 7 của Nghị định này");
    expect(c[0]!.selfRef).toBe(true);
    expect(c[0]!.dieu).toBe("7");
    expect(toUrn(c[0]!, "vn:vbqppl:nd:100/2026/NĐ-CP")).toBe("vn:vbqppl:nd:100/2026/NĐ-CP#dieu-7");
  });

  test("viện dẫn Điều đứng một mình là nội bộ", () => {
    const c = findCitations("Trình tự thực hiện theo Điều 12 và Điều 13.");
    expect(c.length).toBe(2);
    expect(c.every((x) => x.selfRef)).toBe(true);
    expect(c.map((x) => x.dieu)).toEqual(["12", "13"]);
  });

  test("viện dẫn theo tên văn bản không có số", () => {
    const c = findCitations("theo quy định của Luật Đầu tư công");
    expect(c[0]!.docName).toContain("Luật Đầu tư công");
    expect(c[0]!.soKyHieu).toBeUndefined();
  });

  test("nhiều viện dẫn trong một câu", () => {
    const c = findCitations(
      "Căn cứ khoản 1 Điều 3 Nghị định số 45/2026/NĐ-CP và Điều 8 Luật số 22/2023/QH15 để thực hiện.",
    );
    expect(c.length).toBe(2);
    expect(c[0]!.soKyHieu).toBe("45/2026/NĐ-CP");
    expect(c[1]!.soKyHieu).toBe("22/2023/QH15");
    expect(c[1]!.docType).toBe("l");
  });

  test("điểm đ và điểm bổ sung đ1", () => {
    expect(findCitations("điểm đ khoản 3 Điều 9 Nghị định 45/2026/NĐ-CP")[0]!.diem).toBe("đ");
    expect(findCitations("điểm đ1 khoản 3 Điều 9 Nghị định 45/2026/NĐ-CP")[0]!.diem).toBe("đ1");
  });

  test("không nhận nhầm số ký hiệu trong văn bản thường", () => {
    expect(findCitations("Số điện thoại 024/6273/9468 là của Bộ Tư pháp").length).toBe(0);
  });
});

describe("định dạng viện dẫn", () => {
  test("dạng đầy đủ", () => {
    expect(
      formatCitation({
        path: "dieu-15.khoan-2.diem-a",
        docTypeName: "Nghị định",
        soKyHieu: "45/2026/NĐ-CP",
        issuedDate: "2026-01-26",
        issuer: "Chính phủ",
        title: "Quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước",
      }),
    ).toBe(
      "điểm a khoản 2 Điều 15 Nghị định số 45/2026/NĐ-CP ngày 26/01/2026 của Chính phủ quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước",
    );
  });
  test("dạng ngắn", () => {
    expect(
      formatCitation({
        path: "dieu-15.khoan-2",
        docTypeName: "Nghị định",
        soKyHieu: "45/2026/NĐ-CP",
        short: true,
      }),
    ).toBe("khoản 2 Điều 15 Nghị định 45/2026/NĐ-CP");
  });
  test("buildPath", () => {
    expect(buildPath("15", "2", "a")).toBe("dieu-15.khoan-2.diem-a");
    expect(buildPath("15")).toBe("dieu-15");
    expect(buildPath(undefined, "2")).toBeUndefined();
  });
});

describe("không lặp loại văn bản trong viện dẫn", () => {
  test("tên văn bản đã mở đầu bằng loại văn bản thì cắt tiền tố", () => {
    // Lỗi từng gặp: "... của Chính phủ nghị định quy định mẫu ..."
    const out = formatCitation({
      path: "dieu-3.khoan-1",
      docTypeName: "Nghị định",
      soKyHieu: "100/2026/NĐ-CP",
      issuedDate: "2026-01-20",
      issuer: "Chính phủ",
      title: "Nghị định quy định mẫu về quản lý hoạt động thử nghiệm",
    });
    expect(out).toBe(
      "khoản 1 Điều 3 Nghị định số 100/2026/NĐ-CP ngày 20/01/2026 của Chính phủ quy định mẫu về quản lý hoạt động thử nghiệm",
    );
    expect(out).not.toContain("Chính phủ nghị định");
  });

  test("tên văn bản không có tiền tố thì giữ nguyên, chỉ viết thường chữ đầu", () => {
    expect(
      formatCitation({
        docTypeName: "Luật",
        soKyHieu: "64/2025/QH15",
        title: "Ban hành văn bản quy phạm pháp luật",
      }),
    ).toBe("Luật số 64/2025/QH15 ban hành văn bản quy phạm pháp luật");
  });

  test("tên văn bản chỉ có mỗi loại văn bản thì bỏ hẳn phần mô tả", () => {
    expect(formatCitation({ docTypeName: "Nghị định", soKyHieu: "1/2026/NĐ-CP", title: "Nghị định" })).toBe(
      "Nghị định số 1/2026/NĐ-CP",
    );
  });
});

describe("các dạng viện dẫn khó (hồi quy từ bộ đánh giá)", () => {
  const urns = (text: string, self?: string) =>
    findCitations(text)
      .map((c) => toUrn(c, self))
      .filter(Boolean)
      .sort();

  test("liệt kê nhiều điều trước một văn bản", () => {
    expect(
      urns(
        "Thẩm quyền theo Điều 38 và Điều 89 Luật số 58/2024/QH15; trình tự theo Điều 43 Luật số 58/2024/QH15.",
      ),
    ).toEqual([
      "vn:vbqppl:l:58/2024/QH15#dieu-38",
      "vn:vbqppl:l:58/2024/QH15#dieu-43",
      "vn:vbqppl:l:58/2024/QH15#dieu-89",
    ]);
  });

  test("liệt kê điều thuộc hai văn bản khác nhau", () => {
    expect(
      urns("Bãi bỏ Điều 6 Nghị định số 132/2025/NĐ-CP và Điều 34, Điều 35 Nghị định số 133/2025/NĐ-CP."),
    ).toEqual([
      "vn:vbqppl:nd:132/2025/NĐ-CP#dieu-6",
      "vn:vbqppl:nd:133/2025/NĐ-CP#dieu-34",
      "vn:vbqppl:nd:133/2025/NĐ-CP#dieu-35",
    ]);
  });

  test("danh sách khoản của cùng một điều", () => {
    expect(
      urns("Các khoản 1, 2 và 3 Điều 16 Nghị định số 45/2026/NĐ-CP quy định về tổng mức đầu tư."),
    ).toEqual([
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-1",
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-2",
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-16.khoan-3",
    ]);
  });

  test("khoảng điều: từ Điều 5 đến Điều 8", () => {
    expect(urns("Áp dụng từ Điều 5 đến Điều 8 của Nghị định này.", "vn:vbqppl:nd:45/2026/NĐ-CP")).toEqual([
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-5",
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-6",
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-7",
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-8",
    ]);
  });

  test("viết tắt và gõ thường như người dùng gõ ô tìm kiếm", () => {
    expect(urns("Xem k.2 Đ.9 NĐ 45/2026/NĐ-CP.")).toEqual(["vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2"]);
    // Thiếu hậu tố -> bổ sung hậu tố chuẩn của nghị định
    expect(urns("khoản 2 điều 15 nđ 45/2026")).toEqual(["vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2"]);
  });

  test("trật tự ngược: Điều rồi khoản rồi điểm", () => {
    expect(urns("Điều 9 khoản 2 điểm a Nghị định 45/2026/NĐ-CP quy định ngưỡng thiết kế một bước.")).toEqual([
      "vn:vbqppl:nd:45/2026/NĐ-CP#dieu-9.khoan-2.diem-a",
    ]);
  });

  test("tên văn bản có chữ 'số' bên trong", () => {
    // "Luật Chuyển đổi số số 148/2025/QH15" — chữ "số" vừa là một phần tên vừa là từ dẫn số hiệu
    expect(urns("Luật Chuyển đổi số số 148/2025/QH15 có hiệu lực từ ngày 01 tháng 7 năm 2026.")).toEqual([
      "vn:vbqppl:l:148/2025/QH15",
    ]);
  });

  test("không nhận nhầm cụm 'quyết định' trong câu thành loại văn bản", () => {
    // Lỗi từng gặp: "quyết định ... theo Điều 38 Luật số 58/2024/QH15" bị hiểu thành
    // một "Quyết định số 58/2024/QH15" và nuốt mất Điều 38.
    expect(urns("Thẩm quyền quyết định đầu tư xác định theo Điều 38 Luật số 58/2024/QH15.")).toEqual([
      "vn:vbqppl:l:58/2024/QH15#dieu-38",
    ]);
  });

  test("'Nghị định này' đứng một mình không phải viện dẫn quy định cụ thể", () => {
    expect(
      urns(
        "Mẫu biểu ban hành kèm theo Thông tư này được sử dụng thống nhất.",
        "vn:vbqppl:tt:39/2026/TT-BKHCN",
      ),
    ).toEqual([]);
    expect(
      urns(
        "Hồ sơ trình thực hiện theo Mẫu số 01 tại Phụ lục ban hành kèm theo Nghị định này.",
        "vn:vbqppl:nd:45/2026/NĐ-CP",
      ),
    ).toEqual([]);
  });

  test("bổ sung khoản mới: cả khoản mới và khoản mốc đều thuộc cùng điều", () => {
    expect(urns("Bổ sung khoản 2a vào sau khoản 2 Điều 15 Nghị định số 100/2026/NĐ-CP.")).toEqual([
      "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-15.khoan-2",
      "vn:vbqppl:nd:100/2026/NĐ-CP#dieu-15.khoan-2a",
    ]);
  });

  test("vẫn không sinh viện dẫn giả từ dãy số không phải số ký hiệu", () => {
    expect(urns("Số điện thoại 024/6273/9468 là của Bộ Tư pháp")).toEqual([]);
    expect(urns("Tỷ lệ 30/70 và mốc 2026 không phải viện dẫn.")).toEqual([]);
  });
});
