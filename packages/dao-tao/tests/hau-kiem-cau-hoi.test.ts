/**
 * Hậu kiểm câu hỏi AI sinh (docs/PLAN.md GĐ8): câu có căn cứ hỏng bị loại kèm lý do, câu gần
 * giống câu đã có bị đánh dấu, và việc đọc kết quả của mô hình.
 */
import { describe, expect, test } from "bun:test";
import {
  docCauHoiAi,
  doTuongDong,
  hauKiemCauHoiAi,
  type NguCanhHauKiem,
  type NoiDungCauHoi,
  RUBRIC_TU_LUAN_MAC_DINH,
  type TinhTrangCanCu,
  trongNguCanh,
} from "../src/index.ts";

const VB = "vn:vbqppl:nd:168/2024/NĐ-CP";
const DIEU_6 = `${VB}#dieu-6`;
const DIEU_7 = `${VB}#dieu-7`;
const DIEU_8 = `${VB}#dieu-8`;

function cau(p: Partial<NoiDungCauHoi>): NoiDungCauHoi {
  return {
    kind: "dung_sai",
    level: "de",
    stem: "Người điều khiển xe mô tô không đội mũ bảo hiểm bị phạt tiền.",
    options: {},
    answer: { dung: ["dung"] },
    explanation: "Theo Điều 7, hành vi này bị phạt tiền.",
    citations: [DIEU_7],
    ...p,
  };
}

function nguCanh(p: Partial<NguCanhHauKiem> = {}): NguCanhHauKiem {
  return {
    loaiDuocPhep: ["dung_sai", "mot_dap_an"],
    urnNguCanh: [DIEU_6, DIEU_7, DIEU_8],
    canCu: new Map<string, TinhTrangCanCu>([
      [DIEU_6, "hieu_luc"],
      [DIEU_7, "hieu_luc"],
      [`${DIEU_7}.khoan-2`, "hieu_luc"],
      [DIEU_8, "bai_bo"],
    ]),
    cauDaCo: [],
    ...p,
  };
}

describe("căn cứ", () => {
  test("câu hợp lệ, căn cứ còn hiệu lực thì được nhận", () => {
    const [kq] = hauKiemCauHoiAi([cau({})], nguCanh());
    expect(kq!.nhan).toBe(true);
    expect(kq!.lyDo).toEqual([]);
  });

  test("căn cứ trỏ tới điều đã bãi bỏ thì câu bị loại, kèm lý do", () => {
    const [kq] = hauKiemCauHoiAi([cau({ citations: [DIEU_8] })], nguCanh());
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toEqual([`Căn cứ ${DIEU_8} đã bị bãi bỏ`]);
  });

  test("căn cứ chưa có hiệu lực, hết hiệu lực hoặc không có trong kho đều bị loại", () => {
    const canCu = new Map<string, TinhTrangCanCu>([
      [DIEU_6, "chua_hieu_luc"],
      [DIEU_7, "het_hieu_luc"],
    ]);
    const [kq] = hauKiemCauHoiAi(
      [cau({ citations: [DIEU_6, DIEU_7, `${DIEU_7}.khoan-9`] })],
      nguCanh({ canCu }),
    );
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toEqual([
      `Căn cứ ${DIEU_6} chưa có hiệu lực tại ngày soạn`,
      `Căn cứ ${DIEU_7} đã hết hiệu lực tại ngày soạn`,
      `Căn cứ ${DIEU_7}.khoan-9 không có trong kho`,
    ]);
  });

  test("câu không có căn cứ bị loại", () => {
    const [kq] = hauKiemCauHoiAi([cau({ citations: [] })], nguCanh());
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toContain("Câu không có căn cứ");
  });

  test("căn cứ ngoài các điều khoản đã chọn bị loại dù có trong kho", () => {
    const urn = "vn:vbqppl:l:36/2024/QH15#dieu-9";
    const canCu = new Map<string, TinhTrangCanCu>([[urn, "hieu_luc"]]);
    const [kq] = hauKiemCauHoiAi([cau({ citations: [urn] })], nguCanh({ canCu }));
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toEqual([`Căn cứ ${urn} nằm ngoài các điều khoản đã chọn`]);
  });

  test("khoản con của điều đã chọn và chính văn bản chứa nó thuộc ngữ cảnh", () => {
    expect(trongNguCanh(`${DIEU_7}.khoan-2`, [DIEU_7])).toBe(true);
    expect(trongNguCanh(VB, [DIEU_7])).toBe(true);
    expect(trongNguCanh(`${VB}#dieu-70`, [DIEU_7])).toBe(false);
  });
});

describe("hợp lệ theo loại", () => {
  test("câu không qua kiemTraCauHoi bị loại", () => {
    const [kq] = hauKiemCauHoiAi(
      [
        cau({
          kind: "mot_dap_an",
          options: { phuong_an: [{ id: "a", text: "Có" }] },
          answer: { dung: ["b"] },
        }),
      ],
      nguCanh(),
    );
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toContain("Cần ít nhất 2 phương án");
    expect(kq!.lyDo).toContain("Đáp án trỏ tới phương án không có");
  });

  test("câu khác loại được yêu cầu bị loại", () => {
    const [kq] = hauKiemCauHoiAi(
      [
        cau({
          kind: "sap_xep",
          options: {
            phuong_an: [
              { id: "a", text: "Lập biên bản" },
              { id: "b", text: "Ra quyết định" },
              { id: "c", text: "Thi hành" },
            ],
          },
          answer: { thu_tu: ["a", "b", "c"] },
        }),
      ],
      nguCanh(),
    );
    expect(kq!.nhan).toBe(false);
    expect(kq!.lyDo).toEqual(['Loại câu "sap_xep" không nằm trong các loại được yêu cầu']);
  });
});

describe("câu trùng", () => {
  test("trigram: cùng câu là 1, khác hẳn gần 0, không phân biệt dấu và hoa thường", () => {
    expect(doTuongDong("Mũ bảo hiểm", "mu bao hiem")).toBe(1);
    expect(doTuongDong("Mũ bảo hiểm", "Nồng độ cồn")).toBeLessThan(0.1);
  });

  test("câu gần giống câu đã có được nhận nhưng bị đánh dấu duplicate_of", () => {
    const daCo = {
      id: "11111111-1111-1111-1111-111111111111",
      code: "CH-00001",
      stem: "Người điều khiển xe mô tô không đội mũ bảo hiểm thì bị phạt tiền.",
    };
    const [kq] = hauKiemCauHoiAi([cau({})], nguCanh({ cauDaCo: [daCo, { id: "x", stem: "Nồng độ cồn" }] }));
    expect(kq!.nhan).toBe(true);
    expect(kq!.trungVoi?.id).toBe(daCo.id);
    expect(kq!.trungVoi!.doTuongDong).toBeGreaterThanOrEqual(0.6);
  });

  test("câu khác hẳn không bị đánh dấu", () => {
    const [kq] = hauKiemCauHoiAi(
      [cau({})],
      nguCanh({ cauDaCo: [{ id: "x", stem: "Tốc độ tối đa trong khu dân cư" }] }),
    );
    expect(kq!.trungVoi).toBeUndefined();
    expect(kq!.trungTrongLo).toBeUndefined();
  });

  test("hai câu gần giống nhau trong cùng lô: câu sau trỏ về câu trước", () => {
    const kq = hauKiemCauHoiAi(
      [cau({}), cau({ stem: "Người điều khiển xe mô tô không đội mũ bảo hiểm sẽ bị phạt tiền." })],
      nguCanh(),
    );
    expect(kq.map((k) => k.nhan)).toEqual([true, true]);
    expect(kq[0]!.trungTrongLo).toBeUndefined();
    expect(kq[1]!.trungTrongLo).toBe(0);
  });

  test("loaiCauTrung: câu gần giống câu đã có hoặc câu trước trong lô bị loại, kèm lý do", () => {
    const daCo = {
      id: "11111111-1111-1111-1111-111111111111",
      code: "CH-00001",
      stem: "Nồng độ cồn vượt mức",
    };
    const kq = hauKiemCauHoiAi(
      [
        cau({}),
        cau({ stem: "Người điều khiển xe mô tô không đội mũ bảo hiểm sẽ bị phạt tiền." }),
        cau({ stem: "Nồng độ cồn vượt mức." }),
        cau({ stem: "Tốc độ tối đa trong khu dân cư là bao nhiêu?" }),
      ],
      nguCanh({ cauDaCo: [daCo], loaiCauTrung: true }),
    );
    expect(kq.map((k) => k.nhan)).toEqual([true, false, false, true]);
    expect(kq[1]!.lyDo).toEqual(["Gần giống một câu khác trong cùng lượt sinh"]);
    expect(kq[2]!.lyDo).toEqual(["Gần giống câu CH-00001 trong ngân hàng"]);
  });

  test("câu bị loại không được dùng làm mốc so trùng trong lô", () => {
    const kq = hauKiemCauHoiAi([cau({ citations: [DIEU_8] }), cau({})], nguCanh());
    expect(kq[0]!.nhan).toBe(false);
    expect(kq[1]!.trungTrongLo).toBeUndefined();
  });
});

describe("đọc kết quả của mô hình", () => {
  test("đọc object { cau_hoi } về đúng dạng câu hỏi", () => {
    const { cau: ds, loi } = docCauHoiAi({
      cau_hoi: [
        {
          kind: "mot_dap_an",
          level: "trung_binh",
          stem: " Mức phạt là bao nhiêu? ",
          options: {
            phuong_an: [
              { id: "a", text: "Một" },
              { id: "b", text: "Hai" },
            ],
          },
          answer: { dung: ["b"] },
          explanation: "Vì Điều 7.",
          citations: [DIEU_7],
        },
        {
          kind: "dien_khuyet",
          level: "de",
          stem: "Phạt từ ___ đồng.",
          answer: { o_trong: { "1": "400.000" } },
          explanation: "Điều 7.",
          citations: [DIEU_7],
        },
        "rác",
      ],
    });
    expect(loi).toEqual(["Phần tử thứ 3 không phải câu hỏi"]);
    expect(ds[0]!.stem).toBe("Mức phạt là bao nhiêu?");
    expect(ds[0]!.answer).toEqual({ dung: ["b"] });
    expect(ds[1]!.answer.o_trong).toEqual({ "1": ["400.000"] });
    expect(hauKiemCauHoiAi(ds, nguCanh({ loaiDuocPhep: [] })).map((k) => k.nhan)).toEqual([true, true]);
  });

  test("kết quả không có danh sách câu thì báo lỗi, không ném", () => {
    expect(docCauHoiAi({ text: "xin lỗi" })).toEqual({
      cau: [],
      loi: ["Kết quả của mô hình không có danh sách cau_hoi"],
    });
    expect(docCauHoiAi(null).cau).toEqual([]);
  });
});

describe("câu tự luận AI sinh", () => {
  const RUBRIC_AI = {
    tieu_chi: [
      {
        ma: "can_cu",
        ten: "Căn cứ",
        trong_so: 50,
        muc: [
          { diem: 0, mo_ta: "Sai hoặc hết hiệu lực" },
          { diem: 4, mo_ta: "Đúng điều khoản" },
        ],
      },
      {
        ma: "ket_luan",
        ten: "Kết luận",
        trong_so: 50,
        muc: [
          { diem: 0, mo_ta: "" },
          { diem: 4, mo_ta: "" },
        ],
      },
    ],
    nguong_dat: 60,
  };
  const tuLuan = (rubric: unknown) => ({
    kind: "tu_luan",
    level: "kho",
    stem: "Tổ tuần tra phát hiện người điều khiển xe mô tô không đội mũ bảo hiểm. Xử lý thế nào?",
    options: { phuong_an: [{ id: "a", text: "rác" }] },
    answer: { dung: ["a"] },
    explanation: "Áp dụng Điều 7: lập biên bản, phạt tiền.",
    citations: [DIEU_7],
    rubric,
  });

  test("đọc rubric mô hình đề xuất; bỏ phương án, đáp án máy; câu được nhận", () => {
    const { cau: ds } = docCauHoiAi({ cau_hoi: [tuLuan(RUBRIC_AI)] });
    expect(ds[0]).toMatchObject({ kind: "tu_luan", options: {}, answer: {}, rubric: RUBRIC_AI });
    const [kq] = hauKiemCauHoiAi(ds, nguCanh({ loaiDuocPhep: ["tu_luan"] }));
    expect(kq).toMatchObject({ nhan: true, lyDo: [] });
  });

  test("rubric thiếu hoặc sai luật thì dùng rubric mặc định, câu vẫn được nhận", () => {
    const sai = { ...RUBRIC_AI, tieu_chi: RUBRIC_AI.tieu_chi.filter((t) => t.ma !== "can_cu") };
    for (const r of [undefined, "rubric", sai]) {
      const { cau: ds } = docCauHoiAi({ cau_hoi: [tuLuan(r)] });
      expect(ds[0]!.rubric).toEqual(RUBRIC_TU_LUAN_MAC_DINH);
      expect(hauKiemCauHoiAi(ds, nguCanh({ loaiDuocPhep: ["tu_luan"] }))[0]!.nhan).toBe(true);
    }
  });

  test("căn cứ đã bị bãi bỏ thì câu tự luận bị loại như câu trắc nghiệm", () => {
    const { cau: ds } = docCauHoiAi({ cau_hoi: [{ ...tuLuan(RUBRIC_AI), citations: [DIEU_8] }] });
    expect(hauKiemCauHoiAi(ds, nguCanh({ loaiDuocPhep: ["tu_luan"] }))[0]!.nhan).toBe(false);
  });
});
