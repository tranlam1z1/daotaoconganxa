/**
 * Hậu kiểm bài học và bài tập AI soạn (ke-hoach/09-a §5): đọc kết quả mô hình, giữ khối và bài
 * tập dùng được, loại phần sai căn cứ, trích sai nguyên văn hoặc để lộ đáp án.
 */
import { describe, expect, test } from "bun:test";
import {
  type BaiTapAi,
  chuanHoaNguyenVan,
  docBaiTapAi,
  docKhoiAi,
  dungNguyenVan,
  hauKiemBaiTapAi,
  hauKiemKhoiAi,
  type KhoiAi,
  type TinhTrangCanCu,
} from "../src/index.ts";

const VB = "vn:vbqppl:nd:1/2026/NĐ-CP";
const D2 = `${VB}#dieu-2`;
const D3 = `${VB}#dieu-3`;
const NGUYEN_VAN_D2 =
  "1. Người điều khiển xe phải **mang theo** giấy phép lái xe phù hợp với loại xe đang điều khiển.\n2. Không được giao xe cho người không đủ điều kiện.";

function nguCanh(canCu: Record<string, TinhTrangCanCu> = {}) {
  return {
    urnNguCanh: [D2, D3],
    canCu: new Map<string, TinhTrangCanCu>(
      Object.entries({ [D2]: "hieu_luc", [`${D2}.khoan-1`]: "hieu_luc", [D3]: "hieu_luc", ...canCu }),
    ),
    nguyenVan: new Map([
      [D2, NGUYEN_VAN_D2],
      [D3, "Điều 3 quy định về thời hạn."],
    ]),
  };
}

const canCuDung: KhoiAi = {
  kind: "can_cu",
  data: {
    urn: `${D2}.khoan-1`,
    nhan: "Khoản 1 Điều 2",
    nguyen_van: "Người điều khiển xe phải mang theo giấy phép lái xe phù hợp với loại xe đang điều khiển.",
  },
  citations: [`${D2}.khoan-1`],
};

describe("đọc khối nội dung", () => {
  test("khối viết phẳng vẫn đọc được; thẻ căn cứ tự viện dẫn URN của nó", () => {
    const { khoi, loi } = docKhoiAi({
      khoi: [{ kind: "can_cu", urn: D2, nhan: "Điều 2", nguyen_van: "abc" }, "rác"],
    });
    expect(loi.length).toBe(1);
    expect(khoi[0]!.data.urn).toBe(D2);
    expect(khoi[0]!.citations).toEqual([D2]);
  });

  test("không có danh sách khoi thì báo lỗi, không ném", () => {
    expect(docKhoiAi("[MOCK]").loi.length).toBe(1);
    expect(docKhoiAi(null).khoi).toEqual([]);
  });
});

describe("nguyên văn", () => {
  test("bỏ qua định dạng Markdown, ngoặc kép, dấu lửng và khoảng trắng", () => {
    expect(chuanHoaNguyenVan('  "phải **mang**\n theo…"  ')).toBe("phải mang theo");
    expect(
      dungNguyenVan(`${D2}.khoan-1`, "“Người điều khiển xe phải mang theo giấy phép”", nguCanh().nguyenVan),
    ).toBe(true);
  });

  test("diễn đạt lại, trích quá ngắn, hoặc trích sang điều khác đều không đạt", () => {
    const nv = nguCanh().nguyenVan;
    expect(dungNguyenVan(D2, "Người lái xe phải mang giấy phép lái xe", nv)).toBe(false);
    expect(dungNguyenVan(D2, "1.", nv)).toBe(false);
    expect(dungNguyenVan(D3, "Người điều khiển xe phải mang theo giấy phép", nv)).toBe(false);
  });
});

describe("hậu kiểm khối", () => {
  test("giữ khối hợp lệ theo đúng thứ tự", () => {
    const ds: KhoiAi[] = [
      { kind: "giang", data: { md: "Mở bài." }, citations: [] },
      canCuDung,
      {
        kind: "hoi_nhanh",
        data: {
          cau_hoi: "Phải mang theo gì?",
          phuong_an: [
            { id: "a", text: "Giấy phép lái xe" },
            { id: "b", text: "Hộ chiếu" },
          ],
          dap_an: "a",
        },
        citations: [D2],
      },
      { kind: "tom_tat", data: { y: ["Mang theo giấy phép lái xe."] }, citations: [] },
    ];
    const kq = hauKiemKhoiAi(ds, nguCanh());
    expect(kq.biLoai).toEqual([]);
    expect(kq.khoi.map((k) => k.kind)).toEqual(["giang", "can_cu", "hoi_nhanh", "tom_tat"]);
  });

  test("loại thẻ căn cứ diễn đạt lại nguyên văn", () => {
    const sai: KhoiAi = {
      ...canCuDung,
      data: { ...canCuDung.data, nguyen_van: "Lái xe thì phải có bằng lái." },
    };
    const kq = hauKiemKhoiAi([sai], nguCanh());
    expect(kq.khoi).toEqual([]);
    expect(kq.biLoai[0]!.lyDo.join(" ")).toContain("nguyên văn");
  });

  test("loại viện dẫn ngoài ngữ cảnh và viện dẫn hết hiệu lực", () => {
    const ngoai: KhoiAi = {
      kind: "giang",
      data: { md: "x" },
      citations: ["vn:vbqppl:luat:9/2020/QH14#dieu-1"],
    };
    const hetHan: KhoiAi = { kind: "giang", data: { md: "y" }, citations: [D3] };
    const kq = hauKiemKhoiAi([ngoai, hetHan], nguCanh({ [D3]: "het_hieu_luc" }));
    expect(kq.khoi).toEqual([]);
    expect(kq.biLoai[0]!.lyDo.join(" ")).toContain("ngoài các điều khoản");
    expect(kq.biLoai[1]!.lyDo.join(" ")).toContain("hết hiệu lực");
  });

  test("loại khối trang bài giảng chưa dựng, khối thiếu căn cứ bắt buộc, câu hỏi nhanh sai đáp án", () => {
    const kq = hauKiemKhoiAi(
      [
        { kind: "video", data: { nguon: "x" }, citations: [] },
        { kind: "bang_tra", data: { cot: ["A"], dong: [["1"]] }, citations: [] },
        {
          kind: "hoi_nhanh",
          data: {
            cau_hoi: "?",
            phuong_an: [
              { id: "a", text: "1" },
              { id: "b", text: "2" },
            ],
            dap_an: "c",
          },
          citations: [],
        },
      ],
      nguCanh(),
    );
    expect(kq.khoi).toEqual([]);
    expect(kq.biLoai.map((b) => b.viTri)).toEqual([1, 2, 3]);
    expect(kq.biLoai[0]!.lyDo[0]).toContain("chưa dựng");
    expect(kq.biLoai[1]!.lyDo.join(" ")).toContain("viện dẫn");
    expect(kq.biLoai[2]!.lyDo.join(" ")).toContain("Đáp án");
  });
});

const rubricDung = {
  tieu_chi: [
    {
      ma: "can_cu",
      ten: "Căn cứ",
      trong_so: 50,
      muc: [
        { diem: 0, mo_ta: "Sai hoặc hết hiệu lực" },
        { diem: 50, mo_ta: "Đúng" },
      ],
    },
    { ma: "lap_luan", ten: "Lập luận", trong_so: 30, muc: [{ diem: 30, mo_ta: "Tốt" }] },
  ],
  nguong_dat: 60,
};

function baiTap(p: Partial<BaiTapAi>): BaiTapAi {
  return {
    kind: "viet_co_can_cu",
    mode: "ai",
    title: null,
    prompt: { cau_hoi: "Giải thích Điều 2." },
    answer: {},
    rubric: rubricDung,
    citations: [D2],
    errorTags: [],
    level: 1,
    points: 10,
    ...p,
  };
}

describe("đọc bài tập", () => {
  test("tách đáp án khỏi phương án của đề; suy ra answer.dung", () => {
    const { baiTap: ds } = docBaiTapAi({
      bai_tap: [
        {
          kind: "trac_nghiem",
          prompt: {
            cau_hoi: "Chọn đúng",
            phuong_an: [
              { id: "a", text: "Một", dung: true, giai_thich: "vì…" },
              { id: "b", text: "Hai", dung: false, ma_loi: "nham_khoan" },
            ],
          },
          citations: [D2],
        },
      ],
    });
    const b = ds[0]!;
    expect(b.prompt.phuong_an).toEqual([
      { id: "a", text: "Một" },
      { id: "b", text: "Hai" },
    ]);
    expect(JSON.stringify(b.prompt)).not.toContain("dung");
    expect(b.answer.dung).toEqual(["a"]);
    expect((b.answer.phuong_an as unknown[]).length).toBe(2);
    expect(b.mode).toBe("may");
  });

  test("cách chấm theo thư viện dạng bài; điểm mặc định theo cách chấm", () => {
    const { baiTap: ds } = docBaiTapAi([{ kind: "viet_co_can_cu", mode: "may", points: -3 }]);
    expect(ds[0]!.mode).toBe("ai");
    expect(ds[0]!.points).toBe(10);
  });
});

describe("hậu kiểm bài tập", () => {
  test("nhận bài viết có rubric đúng; bỏ mã lỗi ngoài danh mục", () => {
    const kq = hauKiemBaiTapAi([baiTap({ errorTags: ["nham_khoan", "bia"] })], {
      ...nguCanh(),
      maLoi: new Set(["nham_khoan"]),
    });
    expect(kq.biLoai).toEqual([]);
    expect(kq.baiTap[0]!.errorTags).toEqual(["nham_khoan"]);
  });

  test("loại rubric thiếu tiêu chí căn cứ, và rubric sai dạng thì loại chứ không ném", () => {
    const thieuCanCu = baiTap({ rubric: { tieu_chi: [rubricDung.tieu_chi[1]], nguong_dat: 60 } });
    const saiDang = baiTap({ rubric: { tieu_chi: [{ ma: "can_cu", trong_so: 50 }], nguong_dat: 60 } });
    const kq = hauKiemBaiTapAi([thieuCanCu, saiDang], nguCanh());
    expect(kq.baiTap).toEqual([]);
    expect(kq.biLoai[0]!.lyDo.join(" ")).toContain("can_cu");
    expect(kq.biLoai[1]!.lyDo.join(" ")).toContain("sai dạng");
  });

  test("loại trắc nghiệm không có đáp án, bài không căn cứ, và dạng bài lạ", () => {
    const kq = hauKiemBaiTapAi(
      [
        baiTap({
          kind: "trac_nghiem",
          mode: "may",
          rubric: {},
          prompt: {
            cau_hoi: "?",
            phuong_an: [
              { id: "a", text: "1" },
              { id: "b", text: "2" },
            ],
          },
        }),
        baiTap({ citations: [] }),
        baiTap({ kind: "doan_chu" }),
      ],
      nguCanh(),
    );
    expect(kq.baiTap).toEqual([]);
    expect(kq.biLoai[0]!.lyDo.join(" ")).toContain("đáp án");
    expect(kq.biLoai[1]!.lyDo.join(" ")).toContain("không có căn cứ");
    expect(kq.biLoai[2]!.lyDo[0]).toContain("Không có dạng bài");
  });
});
