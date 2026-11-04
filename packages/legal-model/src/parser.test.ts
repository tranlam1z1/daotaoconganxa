import { describe, expect, test } from "bun:test";
import { compareAuthority, inferDocType, rankOf, refineDocTypeByTitle } from "./hierarchy.ts";
import { cumViDanTheoPath, matchLabel } from "./labels.ts";
import { nextQuoteDepth, nodeKey, parseDocument, walk } from "./parser.ts";
import { contextPath, plainText, serializeDocument } from "./serialize.ts";
import { buildUrn, normalizeSoKyHieu, parseUrn, soKyHieuSlug } from "./urn.ts";

const md = await Bun.file(`${import.meta.dir}/../../../data/fixtures/nd-mau-goc.md`).text();

describe("nhận dạng nhãn", () => {
  test("Điều có tiêu đề", () => {
    const m = matchLabel("Điều 15. Thẩm định thiết kế");
    expect(m?.kind).toBe("dieu");
    expect(m?.key).toBe("15");
    expect(m?.heading).toBe("Thẩm định thiết kế");
  });
  test("Điều bổ sung 12a", () => {
    expect(matchLabel("Điều 12a. Nội dung mới")?.key).toBe("12a");
  });
  test("khoản và điểm", () => {
    expect(matchLabel("2. Nội dung khoản")?.kind).toBe("khoan");
    expect(matchLabel("2a. Khoản bổ sung")?.key).toBe("2a");
    expect(matchLabel("đ) Điểm đ")?.kind).toBe("diem");
    expect(matchLabel("đ1) Điểm bổ sung")?.key).toBe("đ1");
  });
  test("chương, mục, tiểu mục", () => {
    expect(matchLabel("Chương II")?.key).toBe("2");
    expect(matchLabel("Mục 3")?.kind).toBe("muc");
    expect(matchLabel("Tiểu mục 1")?.kind).toBe("tieu_muc");
  });
  test("không nhầm ngày tháng thành khoản", () => {
    expect(matchLabel("Hà Nội, ngày 26 tháng 01 năm 2026")).toBeUndefined();
  });
});

describe("parser cấu trúc", () => {
  const r = parseDocument(md);
  test("đủ 6 điều", () => {
    const dieu: string[] = [];
    walk(r.root, (n) => {
      if (n.kind === "dieu") dieu.push(nodeKey(n));
    });
    expect(dieu).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
  test("không có cảnh báo nhảy số", () => {
    expect(r.warnings.filter((w) => w.kind === "gap")).toEqual([]);
  });
  test("khoản và điểm của Điều 1", () => {
    let dieu1: any;
    walk(r.root, (n) => {
      if (n.kind === "dieu" && nodeKey(n) === "1") dieu1 = n;
    });
    expect(dieu1.children.filter((c: any) => c.kind === "khoan").length).toBe(2);
    const k2 = dieu1.children.find((c: any) => nodeKey(c) === "2");
    expect(k2.children.filter((c: any) => c.kind === "diem").map(nodeKey)).toEqual(["a", "b", "c"]);
  });
  test("path rút gọn đúng", () => {
    const paths: string[] = [];
    walk(r.root, (n) => {
      if (n.kind === "diem") paths.push(n.path);
    });
    expect(paths).toContain("dieu-1.khoan-2.diem-a");
    expect(paths).toContain("dieu-3.khoan-2.diem-c");
  });
  test("fullPath giữ chương/mục", () => {
    let d3: any;
    walk(r.root, (n) => {
      if (n.kind === "dieu" && nodeKey(n) === "3") d3 = n;
    });
    expect(d3.fullPath).toBe("chuong-2.muc-1.dieu-3");
  });
  test("nối dòng bị ngắt trong cùng đoạn", () => {
    let k1: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1.khoan-1") k1 = n;
    });
    expect(k1.text).toBe(
      "Nghị định này quy định về quản lý hoạt động thử nghiệm sử dụng nguồn vốn ngân sách nhà nước.",
    );
  });
  test("giữ bảng và công thức thành nút riêng", () => {
    expect(r.counts.bang).toBe(1);
    expect(r.counts.cong_thuc).toBe(1);
    let bang: any;
    walk(r.root, (n) => {
      if (n.kind === "bang") bang = n;
    });
    expect(bang.text).toContain("| STT | Nội dung thẩm định | Trọng số |");
    expect(bang.text.split("\n").length).toBe(5);
  });
  test("căn cứ và chữ ký tách riêng", () => {
    const kinds = r.root.children.map((c) => c.kind);
    expect(kinds).toContain("can_cu");
    expect(kinds).toContain("chu_ky");
  });
  test("plainText không chứa marker", () => {
    expect(plainText(r.root)).not.toContain("<!--");
  });
  test("plainText bỏ ký hiệu trích dẫn và chữ đậm của Markdown, giữ dấu so sánh", () => {
    const text = 'Sửa đổi Điều 8 như sau:\n> **"Điều 8. Phân loại** > > 1. Đường bộ\n> > a) Tốc độ > 50 km/h';
    expect(plainText({ ...r.root, heading: undefined, children: [], text })).toBe(
      'Sửa đổi Điều 8 như sau:\n"Điều 8. Phân loại 1. Đường bộ\na) Tốc độ > 50 km/h',
    );
  });
  test("contextPath dựng chuỗi ngữ cảnh", () => {
    let k2: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-3.khoan-2") k2 = n;
    });
    expect(contextPath(r.root, k2, "Nghị định 100/2026/NĐ-CP")).toBe(
      "Nghị định 100/2026/NĐ-CP > Chương II. TRÌNH TỰ THỰC HIỆN > Mục 1. CHUẨN BỊ > Điều 3. Lập kế hoạch thử nghiệm > 2",
    );
  });
});

describe("serialize khứ hồi", () => {
  test("parse -> serialize -> parse giữ nguyên cấu trúc", () => {
    const a = parseDocument(md);
    const out = serializeDocument(a.root);
    const b = parseDocument(out);
    const keysA: string[] = [];
    const keysB: string[] = [];
    walk(a.root, (n) => {
      if (["dieu", "khoan", "diem"].includes(n.kind)) keysA.push(n.path);
    });
    walk(b.root, (n) => {
      if (["dieu", "khoan", "diem"].includes(n.kind)) keysB.push(n.path);
    });
    expect(keysB).toEqual(keysA);
  });
});

describe("URN và thứ bậc", () => {
  test("chuẩn hóa số ký hiệu", () => {
    expect(normalizeSoKyHieu("Số: 45/2026/NÐ-CP")).toBe("45/2026/NĐ-CP");
  });
  test("suy ra loại văn bản", () => {
    expect(inferDocType("45/2026/NĐ-CP")).toBe("nd");
    expect(inferDocType("64/2025/QH15")).toBe("l");
    expect(refineDocTypeByTitle(inferDocType("91/2015/QH13"), "Bộ luật Dân sự")).toBe("bl");
    expect(
      refineDocTypeByTitle(inferDocType("64/2025/QH15"), "Luật Ban hành văn bản quy phạm pháp luật"),
    ).toBe("l");
    expect(inferDocType("01/2026/UBTVQH16")).toBe("pl");
    expect(inferDocType("12/2026/QĐ-UBND")).toBe("qd-ubnd-t");
    expect(inferDocType("05/2026/TT-BKHCN")).toBe("tt");
  });
  test("build/parse URN", () => {
    const u = buildUrn({
      docType: "nd",
      soKyHieu: "45/2026/NĐ-CP",
      path: "dieu-15.khoan-2",
      asOf: "2026-03-01",
    });
    expect(u).toBe("vn:vbqppl:nd:45/2026/NĐ-CP#dieu-15.khoan-2@2026-03-01");
    const p = parseUrn(u);
    expect(p?.docType).toBe("nd");
    expect(p?.path).toBe("dieu-15.khoan-2");
    expect(p?.asOf).toBe("2026-03-01");
  });
  test("URN địa phương", () => {
    const u = buildUrn({ docType: "qd-ubnd-t", soKyHieu: "12/2026/QĐ-UBND", locality: "thanh-hoa" });
    expect(parseUrn(u)?.locality).toBe("thanh-hoa");
  });
  test("slug", () => {
    expect(soKyHieuSlug("45/2026/NĐ-CP")).toBe("45-2026-nd-cp");
  });
  test("thứ bậc hiệu lực", () => {
    expect(rankOf("hp")).toBeLessThan(rankOf("l"));
    expect(rankOf("l")).toBeLessThan(rankOf("nd"));
    expect(rankOf("nd")).toBeLessThan(rankOf("tt"));
    expect(compareAuthority({ docType: "l" }, { docType: "nd" })).toBeLessThan(0);
    // Cùng cấp: ban hành sau ưu tiên
    expect(
      compareAuthority(
        { docType: "nd", issuedDate: "2026-05-01" },
        { docType: "nd", issuedDate: "2024-01-01" },
      ),
    ).toBeLessThan(0);
  });
});

describe("nối dòng: tiêu đề và nội dung", () => {
  test("tiêu đề chương nằm ở dòng sau thì được nối", () => {
    const r = parseDocument("Chương II\nTRÌNH TỰ THỰC HIỆN\n\nĐiều 1. Tên điều\n1. Nội dung.");
    let ch: any;
    walk(r.root, (n) => {
      if (n.kind === "chuong") ch = n;
    });
    expect(ch.heading).toBe("TRÌNH TỰ THỰC HIỆN");
  });

  test("tiêu đề điều đã đủ thì không nuốt câu nội dung phía sau", () => {
    const r = parseDocument(
      "Điều 5. Phê duyệt\nNgười có thẩm quyền phê duyệt kế hoạch trong thời hạn 10 ngày.",
    );
    let d: any;
    walk(r.root, (n) => {
      if (n.kind === "dieu") d = n;
    });
    expect(d.heading).toBe("Phê duyệt");
    expect(d.text).toBe("Người có thẩm quyền phê duyệt kế hoạch trong thời hạn 10 ngày.");
  });

  test("tiêu đề điều bị ngắt giữa chừng vẫn được nối", () => {
    const r = parseDocument("Điều 15. Thẩm định thiết kế cơ sở và thiết kế\nchi tiết\n1. Nội dung.");
    let d: any;
    walk(r.root, (n) => {
      if (n.kind === "dieu") d = n;
    });
    expect(d.heading).toBe("Thẩm định thiết kế cơ sở và thiết kế chi tiết");
  });

  test("câu trong khoản bị ngắt dòng vẫn nối bình thường", () => {
    const r = parseDocument(
      "Điều 1. Phạm vi\n1. Nghị định này quy định về quản lý hoạt động thử nghiệm sử dụng\nnguồn vốn ngân sách nhà nước.",
    );
    let k: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1.khoan-1") k = n;
    });
    expect(k.text).toBe(
      "Nghị định này quy định về quản lý hoạt động thử nghiệm sử dụng nguồn vốn ngân sách nhà nước.",
    );
  });
});

const mdSuaDoi = await Bun.file(`${import.meta.dir}/../../../data/fixtures/nd-mau-sua-doi.md`).text();

describe("nội dung trích dẫn trong văn bản sửa đổi", () => {
  const r = parseDocument(mdSuaDoi);

  test("không sinh nút trùng path", () => {
    const paths: string[] = [];
    walk(r.root, (n) => {
      if (n.path) paths.push(n.path);
    });
    expect(paths.length).toBe(new Set(paths).size);
  });

  test("cấu trúc của chính văn bản sửa đổi được nhận đúng", () => {
    const dieu: string[] = [];
    walk(r.root, (n) => {
      if (n.kind === "dieu") dieu.push(nodeKey(n));
    });
    expect(dieu).toEqual(["1", "2"]);
    let d1: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1") d1 = n;
    });
    expect(d1.children.filter((c: any) => c.kind === "khoan").map(nodeKey)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  test("khoản bên trong khối trích dẫn không trở thành khoản của văn bản sửa đổi", () => {
    // "Điều 3a" và các khoản 1, 2 của nó nằm trong ngoặc kép -> là nội dung mới
    // của văn bản BỊ sửa đổi, phải nằm nguyên trong text của khoản 3.
    let k3: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1.khoan-3") k3 = n;
    });
    expect(k3.text).toContain("Điều 3a. Điều chỉnh kế hoạch thử nghiệm");
    expect(k3.text).toContain("1. Kế hoạch thử nghiệm được điều chỉnh");
    expect(k3.text).toContain("2. Trình tự điều chỉnh");
    expect(k3.children.length).toBe(0);
  });

  test("khối trích dẫn đóng đúng chỗ, khoản kế tiếp không bị nuốt", () => {
    let k4: any;
    walk(r.root, (n) => {
      if (n.path === "dieu-1.khoan-4") k4 = n;
    });
    expect(k4.text.trim()).toBe("Bãi bỏ điểm c khoản 2 Điều 1.");
  });

  test("không sinh cảnh báo giả về nhảy số hay lặp khoản", () => {
    expect(r.warnings).toEqual([]);
  });
});

describe("theo dõi trạng thái ngoặc kép", () => {
  test("ngoặc thẳng đảo trạng thái", () => {
    expect(nextQuoteDepth("Sửa đổi như sau:", 0)).toBe(0);
    expect(nextQuoteDepth('"Điều 3a. Tên điều', 0)).toBe(1);
    expect(nextQuoteDepth('2. Nội dung cuối."', 1)).toBe(0);
  });

  test("dòng có ngoặc cân bằng không đổi trạng thái", () => {
    // "Thay thế cụm từ A bằng cụm từ B" — bốn dấu ngoặc, cân bằng.
    expect(nextQuoteDepth('Thay thế cụm từ "Bộ A" bằng cụm từ "Bộ B" tại Nghị định.', 0)).toBe(0);
  });

  test("ngoặc cong", () => {
    expect(nextQuoteDepth("“Điều 5. Tên", 0)).toBe(1);
    expect(nextQuoteDepth("nội dung.”", 1)).toBe(0);
  });

  test("không âm", () => {
    expect(nextQuoteDepth("nội dung.”", 0)).toBe(0);
  });
});

describe("văn bản đánh số mục, không chia Điều (văn bản của Đảng)", () => {
  const vanBanDang = [
    "Số 208-QĐ/TW",
    "",
    "- Căn cứ Điều lệ Đảng;",
    "",
    "Chương I",
    "",
    "HỆ THỐNG TỔ CHỨC CỦA ĐẢNG",
    "",
    "1. Hệ thống tổ chức của Đảng (Khoản 1, Điều 10)",
    "",
    "1.1. Hệ thống tổ chức của Đảng được tổ chức theo đơn vị hành chính.",
    "",
    "1.2. Thí điểm thống nhất tên gọi các loại hình tổ chức đảng.",
    "",
    "1.2.1. Đảng bộ cơ sở.",
    "",
    "a) Điều hành công việc của đại hội.",
    "",
    "1.2.2. Chi bộ.",
    "",
    "a) Ý a của tiết thứ hai.",
    "",
    "2. Việc thành lập tổ chức đảng",
    "",
    "2.1. Ở cấp Trung ương.",
    "",
    "1. Liệt kê lặp lại số 1 không phải mục mới.",
    "",
    "Chương II",
    "",
    "NGUYÊN TẮC TẬP TRUNG DÂN CHỦ",
    "",
    "1. Một số quy định về thực hiện nguyên tắc tập trung dân chủ (Điều 9)",
    "",
    "1.1. Quy chế làm việc.",
  ].join("\n");
  const r = parseDocument(vanBanDang);
  const nut = (path: string) => {
    let found: ReturnType<typeof parseDocument>["root"] | undefined;
    walk(r.root, (n) => {
      if (n.path === path) found = n;
    });
    return found;
  };

  test("mục cấp 1 trong từng Chương thành Điều, khóa không trùng giữa các Chương", () => {
    expect(r.counts.dieu).toBe(3);
    expect(nut("dieu-c1-1")?.label).toBe("Mục 1 Chương I");
    expect(nut("dieu-c1-1")?.heading).toBe("Hệ thống tổ chức của Đảng (Khoản 1, Điều 10)");
    expect(nut("dieu-c1-2")?.label).toBe("Mục 2 Chương I");
    expect(nut("dieu-c2-1")?.label).toBe("Mục 1 Chương II");
  });
  test("mục 1.1 thành khoản, 1.1.1 và a) thành điểm", () => {
    expect(nut("dieu-c1-1.khoan-2")?.label).toBe("1.2.");
    expect(nut("dieu-c1-1.khoan-2")?.text).toBe("Thí điểm thống nhất tên gọi các loại hình tổ chức đảng.");
    expect(nut("dieu-c1-1.khoan-2.diem-1")?.label).toBe("1.2.1.");
    expect(nut("dieu-c1-1.khoan-2.diem-1a")?.text).toBe("Điều hành công việc của đại hội.");
    expect(nut("dieu-c1-1.khoan-2.diem-2a")?.text).toBe("Ý a của tiết thứ hai.");
    expect(nut("dieu-c2-1.khoan-1")?.text).toBe("Quy chế làm việc.");
  });
  test("số thứ tự không nối tiếp không mở mục mới", () => {
    expect(nut("dieu-c1-1.khoan-1")).toBeDefined();
    expect(JSON.stringify(nut("dieu-c1-2"))).toContain("Liệt kê lặp lại số 1");
  });
  test("văn bản có Điều giữ nguyên cách tách cũ", () => {
    const thuong = parseDocument("Điều 1. Phạm vi\n\n1. Khoản một.\n\n1.1. Không phải nhãn.");
    expect(r.counts.dieu).toBe(3);
    expect(thuong.counts.dieu).toBe(1);
    expect(thuong.counts.khoan).toBe(1);
  });
});

describe("cụm viện dẫn theo path", () => {
  test("Điều thường", () => {
    expect(cumViDanTheoPath("dieu-15.khoan-2.diem-a")).toBe("điểm a khoản 2 Điều 15");
  });
  test("mục đánh số trong Chương", () => {
    expect(cumViDanTheoPath("dieu-c1-1")).toBe("Mục 1 Chương I");
    expect(cumViDanTheoPath("dieu-c2-3.khoan-1")).toBe("điểm 3.1 Mục 3 Chương II");
    expect(cumViDanTheoPath("dieu-c2-3.khoan-1.diem-2")).toBe("tiết 3.1.2 điểm 3.1 Mục 3 Chương II");
    expect(cumViDanTheoPath("dieu-c2-3.khoan-1.diem-a")).toBe("ý a điểm 3.1 Mục 3 Chương II");
    expect(cumViDanTheoPath("dieu-c2-3.khoan-1.diem-2b")).toBe("ý b tiết 3.1.2 điểm 3.1 Mục 3 Chương II");
    expect(cumViDanTheoPath("dieu-m4.khoan-2")).toBe("điểm 4.2 Mục 4");
  });
});
