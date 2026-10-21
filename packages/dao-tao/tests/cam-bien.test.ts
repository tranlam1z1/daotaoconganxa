/**
 * Trò "Cắm biển cho tuyến đường" (docs/PLAN.md GĐ-T3): chấm từng vị trí, chỉ lần chạy cuối được
 * chấm, gian lận qua nhật ký, kiểm bố cục chỉ đúng phần tử, đề không lộ đáp án, máy chủ và điện
 * thoại chạy thử ra cùng kết quả, và tệp đoạn đường mẫu hợp lệ.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { BienBao } from "../src/bien-bao.ts";
import { taoRng } from "../src/de-thi.ts";
import {
  apThaoTac,
  type BienKhay,
  type BoTri,
  type BuocCamBien,
  TRO_CHOI_CAM_BIEN as CB,
  type ChiTietCamBien,
  chamBoTri,
  chamViTri,
  chayThu,
  type DapAnDoanDuong,
  DIEM_BIEN_DUNG,
  DIEM_CHAP_NHAN,
  dungLaiBoTri,
  kiemTraDoanDuong,
  MAN_CAM_BIEN,
  type NguonCamBien,
  type PayloadDoanDuong,
  phanUngTheoMa,
  SO_LAN_CHAY_THU,
  THONG_SO_MAN_CAM_BIEN,
  TRU_BIEN_SAI,
  TRU_THUA_BIEN,
  type TraLoiCamBien,
} from "../src/tro-choi/cam-bien.ts";
import { bamTrangThai, LoiNhatKy, NHIP_MS } from "../src/tro-choi/chung/nhat-ky.ts";
import { type BuocLuot, chamBuocCoGio } from "../src/tro-choi/khung.ts";

const GOC = join(import.meta.dir, "..", "..", "..");

/* ------------------------------------------------------------------ */
/* Dữ liệu thử                                                         */
/* ------------------------------------------------------------------ */

const bien = (ma: string, phan_ung: BienKhay["phan_ung"]): BienKhay => ({
  ma,
  version: 1,
  nhom: "nguy_hiem",
  ten: `Biển ${ma}`,
  y_nghia: "",
  anh: `${ma}.svg`,
  can_cu: "vn:vbqppl:qcvn:41/2024/BGTVT",
  phan_ung,
});

/** Màn 2: 3 vị trí, 6 biển. */
const doan2: PayloadDoanDuong = {
  muc: 2,
  so_o: 10,
  dac_diem: [
    { o: 4, loai: "truong_hoc" },
    { o: 8, loai: "nguoi_di_bo" },
  ],
  vi_tri: [
    { id: "b", o: 6, ben: "phai", toi_da: 1 },
    { id: "a", o: 2, ben: "phai", toi_da: 1 },
    { id: "c", o: 9, ben: "phai", toi_da: 1 },
  ],
  khay: ["W.225", "W.224", "P.127", "I.408", "P.102", "I.423b"],
};
const dapAn2: DapAnDoanDuong = {
  vi_tri: {
    a: { dung: ["W.225"], chap_nhan: ["P.127"], ly_do: "Trường học." },
    b: { dung: ["W.224"], chap_nhan: [], ly_do: "Người đi bộ." },
    c: { dung: ["I.423b"], chap_nhan: [], ly_do: "Tại chỗ sang đường." },
  },
};
const bien2 = [
  bien("W.225", "giam_toc"),
  bien("W.224", "giam_toc"),
  bien("P.127", "giam_toc"),
  bien("I.408", "di_tiep"),
  bien("P.102", "khong_vao"),
  bien("I.423b", "giam_toc"),
];
const nguon2: NguonCamBien = {
  id: "n2",
  code: "CB-T2",
  version: 3,
  topic_id: null,
  doan: doan2,
  dap_an: dapAn2,
  bien: bien2,
};

const tl = (
  ops: Array<[number, "dat" | "go" | "chay_thu", string?, string?]>,
  tong = 2000,
): TraLoiCamBien => ({
  thao_tac: ops.map(([nhip, t, vi_tri, ma]) => ({
    nhip,
    thao_tac: t,
    tham_so: t === "chay_thu" ? null : { vi_tri: vi_tri!, ma: ma! },
  })),
  tong_nhip: tong,
});

function buoc2(): BuocLuot<BuocCamBien> {
  const [b] = CB.taoLuot([nguon2], taoRng("x"), 2);
  return b!;
}

/* ------------------------------------------------------------------ */
/* Chấm                                                                */
/* ------------------------------------------------------------------ */

describe("chấm từng vị trí", () => {
  const v = { id: "v", o: 1, ben: "phai" as const, toi_da: 2 };
  const d = { dung: ["A"], chap_nhan: ["B"], ly_do: "" };

  test("đúng +10, chấp nhận được +5, sai −5, để trống 0", () => {
    expect(chamViTri(v, 1, d, ["A"])).toMatchObject({ diem: DIEM_BIEN_DUNG, ket: "dung" });
    expect(chamViTri(v, 1, d, ["B"])).toMatchObject({ diem: DIEM_CHAP_NHAN, ket: "chap_nhan" });
    expect(chamViTri(v, 1, d, ["C"])).toMatchObject({ diem: -TRU_BIEN_SAI, ket: "sai" });
    expect(chamViTri(v, 1, d, [])).toMatchObject({ diem: 0, ket: "thieu" });
  });

  test("điểm một vị trí không vượt điểm tối đa; biển sai kèm biển đúng vẫn bị trừ", () => {
    expect(chamViTri(v, 1, d, ["A", "B"])).toMatchObject({
      diem: DIEM_BIEN_DUNG,
      diem_toi_da: DIEM_BIEN_DUNG,
      ket: "dung",
    });
    expect(chamViTri(v, 1, d, ["A", "C"])).toMatchObject({ diem: DIEM_BIEN_DUNG - TRU_BIEN_SAI, ket: "sai" });
  });

  test("hai biển đúng trên một cột: mỗi biển 10 điểm", () => {
    const hai = { dung: ["A", "B"], chap_nhan: [], ly_do: "" };
    expect(chamViTri(v, 1, hai, ["A", "B"])).toMatchObject({ diem: 20, diem_toi_da: 20, ket: "dung" });
    expect(chamViTri(v, 1, hai, ["B"])).toMatchObject({ diem: 10, ket: "chap_nhan" });
  });

  test("vị trí nên để trống: để trống 0, cắm biển −3 một lần", () => {
    const trong = { dung: [], chap_nhan: [], ly_do: "" };
    expect(chamViTri(v, 1, trong, [])).toMatchObject({ diem: 0, diem_toi_da: 0, ket: "de_trong_dung" });
    expect(chamViTri(v, 1, trong, ["A", "B"])).toMatchObject({ diem: -TRU_THUA_BIEN, ket: "thua" });
  });

  test("điểm cả đoạn không âm; số vị trí theo thứ tự dọc đường", () => {
    const sai: BoTri = { a: ["P.102"], b: ["P.102"], c: ["I.408"] };
    const kq = chamBoTri(doan2, dapAn2, sai);
    expect(kq.diem).toBe(0);
    expect(kq.diem_toi_da).toBe(30);
    expect(kq.vi_tri.map((x) => [x.id, x.so])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
  });
});

describe("dựng lại bố trí từ nhật ký", () => {
  const de = { vi_tri: doan2.vi_tri, khay: doan2.khay };

  test("chỉ lần chạy cuối được chấm", () => {
    const r = dungLaiBoTri(
      de,
      tl([
        [1, "dat", "a", "P.127"],
        [2, "chay_thu"],
        [3, "go", "a", "P.127"],
        [4, "dat", "a", "W.225"],
        [5, "chay_thu"],
      ]),
    );
    expect(r).toEqual({ cham: { a: ["W.225"], b: [], c: [] }, so_lan_chay: 2 });
  });

  test("đổi bố trí sau lần chạy (còn lượt chạy) mà không chạy lại: chấm bố trí lúc chạy", () => {
    const r = dungLaiBoTri(
      de,
      tl([
        [1, "dat", "a", "W.225"],
        [2, "chay_thu"],
        [3, "dat", "b", "W.224"],
      ]),
    );
    expect(r.cham).toEqual({ a: ["W.225"], b: [], c: [] });
  });

  test("chưa chạy thử lần nào: chấm bố trí lúc nộp", () => {
    expect(dungLaiBoTri(de, tl([[1, "dat", "a", "W.225"]])).cham.a).toEqual(["W.225"]);
  });

  test(`chạy quá ${SO_LAN_CHAY_THU} lần, đổi bố trí sau lần cuối: không hợp lệ`, () => {
    const bon = tl(
      Array.from({ length: SO_LAN_CHAY_THU + 1 }, (_, i) => [i, "chay_thu"] as [number, "chay_thu"]),
    );
    expect(() => dungLaiBoTri(de, bon)).toThrow(LoiNhatKy);
    const sauCuoi = tl([
      [1, "chay_thu"],
      [2, "chay_thu"],
      [3, "chay_thu"],
      [4, "dat", "a", "W.225"],
    ]);
    expect(() => dungLaiBoTri(de, sauCuoi)).toThrow(LoiNhatKy);
  });

  test("thao tác không hợp lệ với bố trí", () => {
    const bt = { a: [], b: [], c: [] };
    expect(() => apThaoTac(de, bt, "dat", { vi_tri: "z", ma: "W.225" })).toThrow(LoiNhatKy);
    expect(() => apThaoTac(de, bt, "dat", { vi_tri: "a", ma: "W.999" })).toThrow(LoiNhatKy);
    expect(() => apThaoTac(de, bt, "go", { vi_tri: "a", ma: "W.225" })).toThrow(LoiNhatKy);
    const mot = apThaoTac(de, bt, "dat", { vi_tri: "a", ma: "W.225" });
    expect(() => apThaoTac(de, mot, "dat", { vi_tri: "a", ma: "W.225" })).toThrow(LoiNhatKy);
    expect(() => apThaoTac(de, mot, "dat", { vi_tri: "a", ma: "W.224" })).toThrow(LoiNhatKy);
    expect(bt.a).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Kiểm bố cục                                                         */
/* ------------------------------------------------------------------ */

describe("kiểm bố cục", () => {
  const phanTu = (p: Partial<PayloadDoanDuong>, d: DapAnDoanDuong = dapAn2, duyet?: Set<string>) =>
    kiemTraDoanDuong({ ...doan2, ...p }, d, duyet).map((l) => l.phan_tu);

  test("bố cục mẫu hợp lệ", () => {
    expect(kiemTraDoanDuong(doan2, dapAn2, new Set(doan2.khay))).toEqual([]);
  });

  test("vị trí ngoài đường báo đúng vị trí", () => {
    expect(
      phanTu({ vi_tri: [...doan2.vi_tri.slice(0, 2), { id: "c", o: 10, ben: "phai", toi_da: 1 }] }),
    ).toEqual(["vi_tri:c"]);
  });

  test("biển đúng không có trong khay báo đúng vị trí", () => {
    const d = { vi_tri: { ...dapAn2.vi_tri, b: { dung: ["W.999"], chap_nhan: [], ly_do: "x" } } };
    expect(phanTu({}, d)).toEqual(["vi_tri:b"]);
  });

  test("biển chưa duyệt báo đúng biển trong khay", () => {
    expect(phanTu({}, dapAn2, new Set(doan2.khay.filter((m) => m !== "P.102")))).toEqual(["khay:P.102"]);
  });

  test("đặc điểm ngoài đường hoặc hai đặc điểm một ô báo đúng ô", () => {
    expect(phanTu({ dac_diem: [{ o: 12, loai: "truong_hoc" }] })).toEqual(["o:12"]);
    expect(
      phanTu({
        dac_diem: [
          { o: 3, loai: "truong_hoc" },
          { o: 3, loai: "giao_lo" },
        ],
      }),
    ).toEqual(["o:3"]);
  });

  test("số vị trí, số biển trong khay theo màn; nhiều biển một cột và để trống chỉ ở màn 5", () => {
    expect(phanTu({ muc: 3 })).toEqual(["doan", "doan"]);
    expect(phanTu({ vi_tri: doan2.vi_tri.map((v) => (v.id === "a" ? { ...v, toi_da: 2 } : v)) })).toEqual([
      "vi_tri:a",
    ]);
    const trong = { vi_tri: { ...dapAn2.vi_tri, c: { dung: [], chap_nhan: [], ly_do: "Để trống." } } };
    expect(phanTu({}, trong)).toEqual(["vi_tri:c"]);
  });

  test("thiếu đáp án, thiếu lý do", () => {
    const { c: _, ...thieu } = dapAn2.vi_tri;
    expect(phanTu({}, { vi_tri: thieu })).toEqual(["vi_tri:c"]);
    expect(phanTu({}, { vi_tri: { ...dapAn2.vi_tri, a: { ...dapAn2.vi_tri.a!, ly_do: "" } } })).toEqual([
      "vi_tri:a",
    ]);
  });

  test("bảng màn khớp thiết kế", () => {
    expect(MAN_CAM_BIEN.map((m) => m.so)).toEqual([1, 2, 3, 4, 5]);
    expect(MAN_CAM_BIEN.map((m) => m.xpCoBan)).toEqual([10, 12, 14, 16, 18]);
    expect(MAN_CAM_BIEN[0]!.caLuotMs ?? null).toBeNull();
    expect(Object.values(THONG_SO_MAN_CAM_BIEN).map((t) => [t.so_vi_tri, t.so_bien_khay])).toEqual([
      [1, 3],
      [3, 6],
      [4, 8],
      [5, 10],
      [6, 12],
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Định nghĩa trò trên khung chung                                     */
/* ------------------------------------------------------------------ */

const KHOA_CAM = ["answer", "dap_an", "giai_thich", "can_cu", "explanation", "dung", "chap_nhan", "ly_do"];
function khoaCo(v: unknown, kq = new Set<string>()): Set<string> {
  if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      kq.add(k);
      khoaCo(x, kq);
    }
  return kq;
}

describe("trò trên khung chung", () => {
  test("lượt chỉ lấy đoạn đường đúng màn; thiếu thì không bắt đầu", () => {
    expect(CB.taoLuot([nguon2], taoRng("x"), 1)).toEqual([]);
    const b = buoc2();
    expect(b.ref_id).toBe("n2");
    expect(b.ref_version).toBe(3);
    expect(b.diem_toi_da).toBe(30);
    expect(CB.taoLuot([nguon2, { ...nguon2, id: "n9" }], taoRng("s"), 2)[0]!.ref_id).toBe(
      CB.taoLuot([nguon2, { ...nguon2, id: "n9" }], taoRng("s"), 2)[0]!.ref_id,
    );
  });

  test("nguồn có biển trong khay chưa duyệt bị loại", () => {
    expect(CB.locNguon([{ ...nguon2, bien: bien2.filter((b) => b.ma !== "I.408") }])).toEqual([]);
  });

  test("đề không có khóa cấm và không có biển đúng", () => {
    const de = CB.deChoNguoiChoi(buoc2());
    const khoa = khoaCo(de);
    for (const k of KHOA_CAM) expect(khoa.has(k)).toBe(false);
    expect(de.vi_tri.map((v) => v.so)).toEqual([1, 2, 3]);
    expect(de.khay.map((k) => k.ma)).toEqual(doan2.khay);
  });

  test("đọc câu trả lời: nhật ký sai dạng bị từ chối", () => {
    expect(
      CB.docTraLoi(
        tl([
          [1, "dat", "a", "W.225"],
          [2, "chay_thu"],
        ]),
      ),
    ).not.toBeNull();
    expect(
      CB.docTraLoi({ thao_tac: [{ nhip: 1, thao_tac: "chay_thu", tham_so: { x: 1 } }], tong_nhip: 5 }),
    ).toBeNull();
    expect(
      CB.docTraLoi({ thao_tac: [{ nhip: 1, thao_tac: "dat", tham_so: { vi_tri: "a" } }], tong_nhip: 5 }),
    ).toBeNull();
    expect(
      CB.docTraLoi({ thao_tac: [{ nhip: 1, thao_tac: "xoa", tham_so: null }], tong_nhip: 5 }),
    ).toBeNull();
  });

  test("bố trí đúng được đủ điểm; máy khách gửi kèm điểm, cờ đúng bị bỏ qua", () => {
    const b = buoc2();
    const traLoi = CB.docTraLoi({
      ...tl(
        [
          [1, "dat", "a", "W.225"],
          [2, "dat", "b", "W.224"],
          [3, "dat", "c", "I.423b"],
          [4, "chay_thu"],
        ],
        400,
      ),
      diem: 999,
      dung: true,
    })!;
    const kq = chamBuocCoGio(CB, b, traLoi, { moLuc: new Date(0), luc: new Date(20_000), offline: false });
    expect(kq.diem).toBe(30);
    expect(kq.dung).toBe(true);
    const ct = kq.chiTiet as ChiTietCamBien;
    expect(ct.hop_le).toBe(true);
    expect(ct.so_lan_chay).toBe(1);
    expect(ct.tinh_huong).toEqual([]);
    expect(ct.bien["W.225"]!.ten).toBe("Biển W.225");
    expect(kq.canCu).toEqual(["vn:vbqppl:qcvn:41/2024/BGTVT"]);
  });

  test("không cắm biển: 0 điểm, chạy lại thấy phanh gấp; biển cấm làm xe bị chặn", () => {
    const b = buoc2();
    const khong = chamBuocCoGio(CB, b, tl([[1, "chay_thu"]], 400), {
      moLuc: new Date(0),
      luc: new Date(20_000),
      offline: false,
    });
    expect(khong.diem).toBe(0);
    expect((khong.chiTiet as ChiTietCamBien).tinh_huong.map((t) => t.loai)).toContain("phanh_gap");
    const cam = chamBuocCoGio(
      CB,
      b,
      tl(
        [
          [1, "dat", "a", "P.102"],
          [2, "chay_thu"],
        ],
        400,
      ),
      {
        moLuc: new Date(0),
        luc: new Date(20_000),
        offline: false,
      },
    );
    expect((cam.chiTiet as ChiTietCamBien).tinh_huong.map((t) => t.loai)).toContain("bi_chan");
  });

  test("gian lận thời gian: nhật ký dài hơn đồng hồ máy chủ thì 0 điểm", () => {
    const b = buoc2();
    const dung = tl(
      [
        [1, "dat", "a", "W.225"],
        [2, "dat", "b", "W.224"],
        [3, "dat", "c", "I.423b"],
        [4, "chay_thu"],
      ],
      2000,
    );
    // 2000 nhịp = 100 giây, máy chủ chỉ đo 10 giây.
    const kq = chamBuocCoGio(CB, b, dung, { moLuc: new Date(0), luc: new Date(10_000), offline: false });
    expect(kq.diem).toBe(0);
    expect((kq.chiTiet as ChiTietCamBien).hop_le).toBe(false);
    expect((kq.chiTiet as ChiTietCamBien).ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
    // Offline: không so đồng hồ, chấm bình thường.
    expect(chamBuocCoGio(CB, b, dung, { moLuc: null, luc: new Date(10_000), offline: true }).diem).toBe(30);
  });

  test("gian lận thao tác: chạy thử 4 lần thì 0 điểm", () => {
    const b = buoc2();
    const kq = chamBuocCoGio(
      CB,
      b,
      tl(
        [
          [1, "dat", "a", "W.225"],
          [2, "chay_thu"],
          [3, "chay_thu"],
          [4, "chay_thu"],
          [5, "chay_thu"],
        ],
        100,
      ),
      { moLuc: new Date(0), luc: new Date(20_000), offline: false },
    );
    expect(kq.diem).toBe(0);
    expect((kq.chiTiet as ChiTietCamBien).ly_do).toContain("quá 3 lần");
  });

  test("máy chủ và điện thoại chạy thử ra cùng băm trạng thái", () => {
    const b = buoc2();
    const de = CB.deChoNguoiChoi(b);
    const boTri: BoTri = { a: ["P.127"], b: [], c: ["W.225"] };
    // Điện thoại chỉ có đề: dựng cấu hình từ đề và phản ứng của biển trong khay.
    const mayKhach = chayThu(de, boTri, phanUngTheoMa(de.khay)).trang_thai;
    const kq = chamBuocCoGio(
      CB,
      b,
      tl(
        [
          [1, "dat", "a", "P.127"],
          [2, "dat", "c", "W.225"],
          [3, "chay_thu"],
        ],
        400,
      ),
      { moLuc: new Date(0), luc: new Date(400 * NHIP_MS), offline: false },
    );
    expect((kq.chiTiet as ChiTietCamBien).bam).toBe(
      bamTrangThai({ xe: mayKhach.xe, su_kien: mayKhach.su_kien, nhip: mayKhach.nhip }),
    );
  });
});

/* ------------------------------------------------------------------ */
/* Tệp dữ liệu mẫu                                                     */
/* ------------------------------------------------------------------ */

describe("data/tro-choi/cam-bien.json", async () => {
  const tep = (await Bun.file(join(GOC, "data", "tro-choi", "cam-bien.json")).json()) as {
    doan: Array<{ ma: string; tieu_de: string; payload: PayloadDoanDuong; answer: DapAnDoanDuong }>;
  };
  const bienTep = (
    (await Bun.file(join(GOC, "data", "bien-bao", "bien-bao.json")).json()) as { bien: BienBao[] }
  ).bien;
  const coPhanUng = new Set(bienTep.filter((b) => b.phan_ung && b.nhom !== "phu").map((b) => b.ma));

  test("mọi đoạn hợp lệ với biển có phản ứng trong tệp biển báo", () => {
    for (const d of tep.doan)
      expect({ ma: d.ma, loi: kiemTraDoanDuong(d.payload, d.answer, coPhanUng) }).toEqual({
        ma: d.ma,
        loi: [],
      });
  });

  test("đánh dấu demo, mỗi màn có ít nhất một đoạn, mã không trùng", () => {
    for (const d of tep.doan) expect(d.tieu_de.startsWith("[Demo]")).toBe(true);
    expect(new Set(tep.doan.map((d) => d.payload.muc))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(tep.doan.map((d) => d.ma)).size).toBe(tep.doan.length);
  });

  test("bố trí đúng của mọi đoạn: đủ điểm, xe qua hết không nguy hiểm", () => {
    const theoMa = new Map(bienTep.map((b) => [b.ma, b.phan_ung ?? null]));
    for (const d of tep.doan) {
      const dung: BoTri = Object.fromEntries(
        d.payload.vi_tri.map((v) => [v.id, d.answer.vi_tri[v.id]!.dung]),
      );
      const cham = chamBoTri(d.payload, d.answer, dung);
      expect({ ma: d.ma, diem: cham.diem }).toEqual({ ma: d.ma, diem: cham.diem_toi_da });
      const phanUng = Object.fromEntries(d.payload.khay.map((m) => [m, theoMa.get(m) ?? null]));
      const chay = chayThu(d.payload, dung, phanUng);
      expect({ ma: d.ma, tinh_huong: chay.tinh_huong.map((t) => t.mo_ta) }).toEqual({
        ma: d.ma,
        tinh_huong: [],
      });
      expect(chay.trang_thai.xe.every((x) => x.trang_thai === "da_qua")).toBe(true);
    }
  });
});

describe("giải thích khi chạy thử", () => {
  const bienThem = [...bien2, bien("R.122", "dung_lai")];
  const chay = (boTri: BoTri) => chayThu(doan2, boTri, phanUngTheoMa(bienThem), bienThem).tinh_huong;

  test("thiếu biển: nói chưa có biển báo trước chỗ nguy hiểm", () => {
    const th = chay({});
    const truong = th.find((t) => t.dac_diem === "truong_hoc")!;
    expect(truong.loai).toBe("phanh_gap");
    expect(truong.vi_sao).toContain("chưa có biển nào báo trước");
  });

  test("biển sai: nêu tên biển và vị trí, biển không báo giảm tốc", () => {
    const truong = chay({ a: ["I.408"] }).find((t) => t.dac_diem === "truong_hoc")!;
    expect(truong.vi_sao).toContain('"Biển I.408" ở vị trí 1 không báo cho người lái phải giảm tốc');
  });

  test("biển đặt sau chỗ nguy hiểm: người lái tới nơi rồi mới thấy", () => {
    const truong = chay({ b: ["W.225"] }).find((t) => t.dac_diem === "truong_hoc")!;
    expect(truong.vi_sao).toContain("người lái tới trường học rồi mới thấy biển");
  });

  test("biển cấm làm chặn đường; biển dừng lại đặt chỗ không cần dừng là dừng vô cớ", () => {
    const chan = chay({ a: ["P.102"] }).find((t) => t.loai === "bi_chan")!;
    expect(chan.vi_sao).toContain('"Biển P.102" bắt xe không được đi tiếp');
    const dung = chay({ a: ["W.225"], b: ["W.224"], c: ["R.122"] }).find((t) => t.loai === "dung_vo_co")!;
    expect(dung.vi_tri).toBe(3);
    expect(dung.vi_sao).toContain("phía trước không có chỗ nào cần dừng");
  });

  test("cắm đúng: không có tình huống nào", () => {
    expect(chay({ a: ["W.225"], b: ["W.224"], c: ["I.423b"] })).toEqual([]);
  });

  test("giải thích không lộ biển đúng: chỉ nhắc biển người chơi đã cắm", () => {
    const s = JSON.stringify(chay({ a: ["I.408"] }));
    expect(s).not.toContain("W.225");
    expect(s).not.toContain("W.224");
  });
});
