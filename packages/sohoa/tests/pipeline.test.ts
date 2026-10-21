/** Kiểm thử phần logic thuần: chia cụm, nhiễu đầu trang, nối đoạn, ghép cụm, kiểm chứng. */
import { describe, expect, test } from "bun:test";
import { phatHienDongLap } from "../src/heads.ts";
import { demKyTuNoiDung, donDepMarkdown, nhapTuLopVanBan, noiDongThanhDoan } from "../src/postprocess.ts";
import { doTuongDong, ghepCacCuaSo, timChongLan } from "../src/stitch.ts";
import type { TrangText } from "../src/types.ts";
import { TRANG_THAI_MO_RONG } from "../src/types.ts";
import { demBang, kiemChung, trichDieu } from "../src/verify.ts";
import { lapKeHoachCuaSo, soTrangPhaiDoc } from "../src/windows.ts";

const trangMau = (trang: number, dong: string[]): TrangText => ({
  trang,
  text: dong.join("\n"),
  dong,
  soKyTu: dong.join("").replace(/\s/g, "").length,
  khoi: [],
  rong: 595,
  cao: 842,
});

describe("chia cụm trang", () => {
  test("cụm 5 trang chồng lấn 1 trang", () => {
    const kh = lapKeHoachCuaSo(13);
    expect(kh.map((c) => [c.tuTrang, c.denTrang])).toEqual([
      [1, 5],
      [5, 9],
      [9, 13],
    ]);
    expect(kh[1]?.trangChongLan).toBe(5);
    expect(kh[0]?.trangChongLan).toBeUndefined();
  });

  test("văn bản ngắn hơn một cụm thì chỉ có một cụm", () => {
    expect(lapKeHoachCuaSo(3)).toHaveLength(1);
    expect(lapKeHoachCuaSo(0)).toHaveLength(0);
  });

  test("cụm cuối quá ngắn được gộp vào cụm trước", () => {
    const kh = lapKeHoachCuaSo(10);
    expect(kh.at(-1)?.denTrang).toBe(10);
    expect(kh.some((c) => c.denTrang - c.tuTrang + 1 <= 1)).toBe(false);
    expect(soTrangPhaiDoc(kh)).toBeGreaterThanOrEqual(10);
  });
});

describe("nhiễu đầu/cuối trang", () => {
  test("nhận ra header lặp và số trang", () => {
    const trang = [1, 2, 3, 4].map((i) =>
      trangMau(i, [
        `CÔNG BÁO/Số 145 + 146 ngày 10/02/2026`,
        `Nội dung trang ${i} của văn bản mẫu.`,
        `Dòng thứ hai của trang ${i} nói về một nội dung khác hẳn.`,
        `- ${i} -`,
      ]),
    );
    const lap = phatHienDongLap(trang);
    expect(lap.some((l) => l.viDu.startsWith("CÔNG BÁO"))).toBe(true);
    const md = nhapTuLopVanBan(trang, { dongLap: lap });
    expect(md).not.toContain("CÔNG BÁO");
    expect(md).not.toMatch(/- 3 -/);
    expect(md).toContain("Nội dung trang 3");
  });

  test("không cắt phần cuối của trang có khối chữ ký", () => {
    const trang = [
      trangMau(1, ["CÔNG BÁO/Số 1 ngày 01/01/2026", "Điều 1. Phạm vi", "- 1 -"]),
      trangMau(2, ["CÔNG BÁO/Số 1 ngày 01/01/2026", "Nơi nhận:", "- Lưu: VT.", "Nguyễn Văn A"]),
      trangMau(3, ["CÔNG BÁO/Số 1 ngày 01/01/2026", "Phụ lục I", "- 3 -"]),
    ];
    const md = nhapTuLopVanBan(trang, { dongLap: phatHienDongLap(trang, 0.5) });
    expect(md).toContain("Nơi nhận:");
    expect(md).toContain("Nguyễn Văn A");
  });
});

describe("nối dòng thành đoạn", () => {
  test("dòng chưa kết thúc câu được nối bằng một dấu cách", () => {
    const ra = noiDongThanhDoan([
      "1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử",
      "dụng nguồn vốn ngân sách nhà nước.",
      "2. Nghị định này áp dụng đối với:",
      "a) Cơ quan nhà nước;",
    ]);
    expect(ra[0]).toBe(
      "1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn ngân sách nhà nước.",
    );
    expect(ra).toHaveLength(3);
  });

  test("gạch nối cuối dòng do ngắt từ được bỏ", () => {
    const ra = noiDongThanhDoan(["Chi phí quản lý dự án được xác định theo công ngh-", "ệ hiện hành."]);
    expect(ra[0]).toContain("công nghệ hiện hành.");
  });

  test("tiêu đề Điều không nuốt nội dung phía sau", () => {
    const ra = noiDongThanhDoan([
      "Điều 2. Đối tượng áp dụng",
      "Nghị định này áp dụng đối với cơ quan nhà nước.",
      "Điều 3. Giải thích từ ngữ và các nội dung",
      "liên quan đến hoạt động kiểm định",
      "1. Thiết bị kỹ thuật là thiết bị thuộc danh mục.",
    ]);
    expect(ra[0]).toBe("Điều 2. Đối tượng áp dụng");
    expect(ra[1]).toBe("Nghị định này áp dụng đối với cơ quan nhà nước.");
    // Tiêu đề dài bị ngắt dòng (dòng sau viết thường) thì vẫn nối vào tiêu đề.
    expect(ra[2]).toBe("Điều 3. Giải thích từ ngữ và các nội dung liên quan đến hoạt động kiểm định");
    expect(ra[3]).toStartWith("1. Thiết bị kỹ thuật");
  });

  test("nhãn cấu trúc luôn mở đoạn mới", () => {
    const ra = noiDongThanhDoan(["Điều 5. Nguyên tắc", "1. Bảo đảm công khai"]);
    expect(ra).toHaveLength(2);
  });
});

describe("ghép cụm trang", () => {
  const cuaSo = (idx: number, tuTrang: number, denTrang: number, chongLan?: number) => ({
    idx,
    tuTrang,
    denTrang,
    ...(chongLan ? { trangChongLan: chongLan } : {}),
  });

  test("bỏ phần chồng lấn, ưu tiên bản của cụm sau", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: {
          markdown: "### Điều 1. Phạm vi\n\n1. Nội dung khoản một.\n\n2. Nội dung khoản hai.",
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: {
          markdown: "2. Nội dung khoản hai.\n\n3. Nội dung khoản ba.",
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
    ]);
    expect(r.markdown.match(/Nội dung khoản hai/g)).toHaveLength(1);
    expect(r.markdown).toContain("khoản ba");
    expect(r.canhBao).toHaveLength(0);
  });

  test("câu dang dở qua cụm được nối liền, không ngắt đoạn", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: {
          markdown: "1. Thời hạn thẩm định không quá 20 ngày kể từ ngày nhận được hồ sơ hợp lệ và",
          open_state: { ...TRANG_THAI_MO_RONG, sentence_open: true },
        },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: {
          markdown: "<!-- cont -->\nkhông tính thời gian bổ sung hồ sơ.",
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
    ]);
    expect(r.markdown).toContain("hồ sơ hợp lệ và không tính thời gian bổ sung hồ sơ.");
  });

  test("nối câu dang dở giữ marker nút của khối cuối cụm trước trên dòng riêng", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: {
          markdown: "<!-- node: dieu-6.khoan-3 -->\n3. Bộ Giáo dục và Đào tạo chủ trì",
          open_state: { ...TRANG_THAI_MO_RONG, sentence_open: true },
        },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: {
          markdown: "<!-- cont -->\nxây dựng chương trình giáo dục.",
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
    ]);
    expect(r.markdown).toContain(
      "<!-- node: dieu-6.khoan-3 -->\n3. Bộ Giáo dục và Đào tạo chủ trì xây dựng chương trình giáo dục.",
    );
  });

  test("bảng qua cụm được nối hàng và bỏ header lặp", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: {
          markdown: "| STT | Loại | Định mức |\n|---|---|---|\n| 1 | Nhóm A | 1,85 |",
          open_state: { ...TRANG_THAI_MO_RONG, table_open: true, table_cols: 3 },
        },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: {
          markdown: "| STT | Loại | Định mức |\n|---|---|---|\n| 2 | Nhóm B | 2,15 |",
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
    ]);
    expect(r.markdown.match(/^\|[\s:|-]+\|$/gm)).toHaveLength(1);
    expect(r.markdown).toContain("Nhóm A");
    expect(r.markdown).toContain("| 2 | Nhóm B | 2,15 |");
  });

  test("bảng HTML gộp ô qua cụm được nối vào cùng một bảng", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: {
          markdown:
            '<table>\n  <thead>\n    <tr><th colspan="2">STT</th><th>Tên thiết bị</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>I</td><td colspan="2">Nhóm máy tính</td></tr>\n    <tr><td></td><td>01</td><td>Máy tính để bàn</td></tr>\n  </tbody>\n</table>',
          open_state: { ...TRANG_THAI_MO_RONG, table_open: true, table_cols: 3 },
        },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: {
          markdown:
            '<table>\n  <thead>\n    <tr><th colspan="2">STT</th><th>Tên thiết bị</th></tr>\n  </thead>\n  <tbody>\n    <tr><td></td><td>02</td><td>Máy in</td></tr>\n  </tbody>\n</table>',
          open_state: { ...TRANG_THAI_MO_RONG },
        },
      },
    ]);
    // Một bảng duy nhất, đủ ba hàng, header không lặp.
    expect(r.markdown.match(/<table/g)).toHaveLength(1);
    expect(r.markdown.match(/<\/table>/g)).toHaveLength(1);
    expect(r.markdown.match(/<thead/g)).toHaveLength(1);
    expect(r.markdown.match(/<tr>/g)).toHaveLength(4);
    expect(r.markdown.indexOf("Máy in")).toBeGreaterThan(r.markdown.indexOf("Máy tính để bàn"));
    expect(r.markdown.indexOf("Máy in")).toBeLessThan(r.markdown.indexOf("</tbody>"));
  });

  test("không thấy phần chồng lấn thì cảnh báo", () => {
    const r = ghepCacCuaSo([
      {
        cuaSo: cuaSo(1, 1, 5),
        ketQua: { markdown: "Đoạn A hoàn toàn khác.", open_state: { ...TRANG_THAI_MO_RONG } },
      },
      {
        cuaSo: cuaSo(2, 5, 9, 5),
        ketQua: { markdown: "Đoạn B chẳng liên quan gì.", open_state: { ...TRANG_THAI_MO_RONG } },
      },
    ]);
    expect(r.canhBao[0]?.message).toContain("chồng lấn");
  });

  test("độ tương đồng và dò khối chồng lấn", () => {
    expect(doTuongDong("Điều 15. Thẩm định", "Điều 15. Thẩm định")).toBe(1);
    expect(doTuongDong("Điều 15. Thẩm định", "Không liên quan")).toBeLessThan(0.4);
    expect(timChongLan(["A", "B", "C"], ["C", "D"])).toBe(1);
    expect(timChongLan(["A", "B"], ["X"])).toBe(0);
  });
});

describe("kiểm chứng", () => {
  const md = [
    "<!-- node: dieu-1 -->",
    "### Điều 1. Phạm vi điều chỉnh",
    "",
    "<!-- node: dieu-1.khoan-1 -->",
    "1. Nghị định này quy định về quản lý đầu tư.",
    "",
    "<!-- node: dieu-1.khoan-1.diem-a -->",
    "a) Cơ quan nhà nước;",
    "",
    "<!-- node: dieu-1.khoan-1.diem-b -->",
    "b) Đơn vị sự nghiệp công lập.",
    "",
    "<!-- node: dieu-2 -->",
    "### Điều 2. Giải thích từ ngữ",
    "",
    "<!-- node: dieu-2.khoan-1 -->",
    "1. Dự án đầu tư ứng dụng công nghệ thông tin là dự án sử dụng ngân sách nhà nước.",
  ].join("\n");

  test("bản sạch đạt điểm tuyệt đối", () => {
    const r = kiemChung({ markdown: md });
    expect(r.diem).toBe(1);
    expect(r.canDuyet).toBe(false);
    expect(trichDieu(md)).toHaveLength(2);
  });

  test("nhảy số điều là lỗi bắt buộc soát", () => {
    const r = kiemChung({ markdown: md.replace("### Điều 2.", "### Điều 4.") });
    expect(r.muc.find((m) => m.ma === "lien_tuc_dieu")?.dat).toBe(false);
    expect(r.canDuyet).toBe(true);
  });

  test("chữ cái không thuộc dãy điểm bị bắt", () => {
    const r = kiemChung({ markdown: md.replace("b) Đơn vị", "f) Đơn vị") });
    expect(r.muc.find((m) => m.ma === "khoan_diem")?.chiTiet).toContain("f)");
  });

  test("đối chiếu độ dài với lớp văn bản", () => {
    const trang = [trangMau(1, [md.replace(/<!--.*-->/g, "")])];
    const r = kiemChung({ markdown: md, trang });
    expect(r.muc.find((m) => m.ma === "do_dai")?.dat).toBe(true);
    const thieu = kiemChung({ markdown: "### Điều 1. Ngắn", trang });
    expect(thieu.muc.find((m) => m.ma === "do_dai")?.dat).toBe(false);
  });

  test("đếm bảng và đối chiếu khai báo", () => {
    const bangMd = `${md}\n\n| STT | Loại |\n|---|---|\n| 1 | A |\n| 2 | B |\n`;
    expect(demBang(bangMd).gfm).toBe(1);
    expect(demBang(bangMd).hang[0]).toBe(2);
    const r = kiemChung({ markdown: bangMd, bang: [{ rows: 2, cols: 2 }] });
    expect(r.muc.find((m) => m.ma === "bang")?.dat).toBe(true);
    const sai = kiemChung({ markdown: bangMd, bang: [{ rows: 9, cols: 2 }] });
    expect(sai.muc.find((m) => m.ma === "bang")?.dat).toBe(false);
  });

  test("phụ lục và biểu mẫu được đánh số lại, không báo nhảy khoản", () => {
    const md2 = [
      "### Điều 1. Phạm vi",
      "",
      "1. Nội dung khoản một.",
      "",
      "2. Nội dung khoản hai.",
      "",
      "## Phụ lục I",
      "",
      "**1. Chuẩn bị**",
      "",
      "a) Việc thứ nhất;",
      "",
      "b) Việc thứ hai.",
      "",
      "**2. Tiến hành**",
      "",
      "a) Bước thứ nhất;",
      "",
      "<!-- kind: bieu_mau -->",
      "*Mẫu số 01*",
      "",
      "1. Danh mục thiết bị;",
    ].join("\n");
    const r = kiemChung({ markdown: md2 });
    expect(r.muc.find((m) => m.ma === "khoan_diem")?.dat).toBe(true);
  });

  test("phần đánh số La Mã trong phụ lục đánh khoản lại từ 1", () => {
    const md = [
      "### Điều 1. A",
      "",
      "1. Nội dung.",
      "",
      "## PHỤ LỤC I",
      "",
      "**I. CẤU TRÚC BẢN TIN DỮ LIỆU GIÁM SÁT HÀNH TRÌNH**",
      "",
      "1. Mô tả các trường dữ liệu",
      "",
      "2. Nguyên tắc truyền dữ liệu",
      "",
      "**II. CẤU TRÚC BẢN TIN DỮ LIỆU HÌNH ẢNH**",
      "",
      "1. Mô tả các trường dữ liệu",
      "",
      "2. Nguyên tắc truyền dữ liệu hình ảnh",
      "",
      "III. THỜI GIAN DỪNG, ĐỖ XE",
      "",
      "1. Được bắt đầu tính khi…",
    ].join("\n");
    const r = kiemChung({ markdown: md });
    expect(r.muc.find((m) => m.ma === "khoan_diem")?.dat).toBe(true);
    // Nhảy khoản thật trong cùng một phần vẫn phải bị bắt.
    const loi = kiemChung({ markdown: md.replace("2. Nguyên tắc truyền dữ liệu hình ảnh", "3. Nguyên tắc") });
    expect(loi.muc.find((m) => m.ma === "khoan_diem")?.dat).toBe(false);
  });

  test("hàng để trống của biểu mẫu vẫn được đếm là hàng", () => {
    const bieuMau = "| Số TT | Tên |\n|---|---|\n| (1) | (2) |\n|  |  |\n|  |  |\n";
    expect(demBang(bieuMau).hang[0]).toBe(3);
    const r = kiemChung({ markdown: `### Điều 1. A\n\n${bieuMau}`, bang: [{ rows: 3, cols: 2 }] });
    expect(r.muc.find((m) => m.ma === "bang")?.dat).toBe(true);
  });

  test("bảng HTML khai theo định dạng riêng, gộp phần nối tiếp", () => {
    const md2 = [
      "### Điều 1. A",
      "",
      "<table><tbody><tr><td>I</td><td>Nhóm</td></tr><tr><td>01</td><td>Máy in</td></tr></tbody></table>",
    ].join("\n");
    const r = kiemChung({
      markdown: md2,
      bang: [
        { rows: 1, cols: 2, format: "html" },
        { rows: 1, cols: 2, format: "html", continued_from_previous: true },
      ],
    });
    expect(r.muc.find((m) => m.ma === "bang")?.dat).toBe(true);
  });

  test("khai báo bảng trùng ở trang chồng lấn và bảng tiêu ngữ 2 ô không làm lệch đối chiếu", () => {
    const md3 = [
      "### Điều 1. A",
      "",
      "| CƠ QUAN | QUỐC HIỆU |",
      "|---|---|",
      "",
      "<table><tbody><tr><td>1</td><td>Xe</td><td>Biển số</td></tr><tr><td>2</td><td>Xe</td><td>Biển số</td></tr></tbody></table>",
    ].join("\n");
    const r = kiemChung({
      markdown: md3,
      bang: [
        { rows: 0, cols: 2, format: "gfm", node_path: "phu-luc-1.tieu-ngu" },
        { rows: 2, cols: 3, format: "html", node_path: "phu-luc-1.bang-1" },
        // Cụm sau khai lại cùng bảng vì bảng nằm ở trang chồng lấn.
        { rows: 2, cols: 3, format: "html", node_path: "phu-luc-1.bang-1" },
      ],
    });
    expect(r.muc.find((m) => m.ma === "bang")?.dat).toBe(true);
  });

  test("thiếu khối chữ ký khi kiểm bản đầy đủ", () => {
    const r = kiemChung({ markdown: md, toanVanBan: true });
    expect(r.muc.find((m) => m.ma === "chu_ky")?.dat).toBe(false);
    expect(r.canDuyet).toBe(true);
  });

  test("luật kết bằng câu thông qua của Quốc hội và chức danh Chủ tịch Quốc hội được coi là có chữ ký", () => {
    const luat =
      `${md}\n\n<!-- node: chu-ky -->\nLuật này được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam khóa XV, ` +
      "Kỳ họp thứ 7 thông qua ngày 27 tháng 6 năm 2024./.\n\nCHỦ TỊCH QUỐC HỘI\n\nTrần Thanh Mẫn\n";
    const r = kiemChung({ markdown: luat, toanVanBan: true });
    expect(r.muc.find((m) => m.ma === "chu_ky")?.dat).toBe(true);
  });

  test("công thức thiếu chú thích alt bị bắt", () => {
    const r = kiemChung({ markdown: `${md}\n\n$$ G = \\sum_{i=1}^{n} E_i $$\n` });
    expect(r.muc.find((m) => m.ma === "cong_thuc")?.dat).toBe(false);
  });

  test("dọn Markdown bỏ số trang còn sót", () => {
    const sach = donDepMarkdown("Đoạn một.\n\n- 12 -\n\nĐoạn hai.");
    expect(sach).not.toContain("- 12 -");
    expect(demKyTuNoiDung("### Điều 1. A")).toBeGreaterThan(0);
  });
});
