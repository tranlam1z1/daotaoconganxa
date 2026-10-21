/**
 * Trò "Dừng xe đúng quy trình" (docs/PLAN.md GĐ-T4): máy trạng thái tình huống, chấm theo quy trình,
 * đo nồng độ cồn, rẽ nhánh theo phản ứng người lái, kiểm gian lận, và kiểm tệp dữ liệu mẫu.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { taoRng } from "../src/de-thi.ts";
import type { QuyTrinh } from "../src/tra-cuu-nhanh.ts";
import type { LuatGiayTo } from "../src/tro-choi/chung/giay-to.ts";
import {
  type BuocDungXe,
  canhCongKhai,
  chamDungXe,
  type DapAnDungXe,
  TRO_CHOI_DUNG_XE as DX,
  dienBien,
  dungDuocTinhHuong,
  type KieuBuocDungXe,
  kiemTraQuyTrinhDungXe,
  kiemTraTinhHuongDungXe,
  type NguonDungXe,
  type PayloadDungXe,
  THAO_TAC_TOI_DA,
  type ThaoTacDungXe,
} from "../src/tro-choi/dung-xe.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const quyTrinhTep = (await Bun.file(join(GOC, "data/tra-cuu/quy-trinh.json")).json()) as {
  quy_trinh: QuyTrinh[];
};
const QT = { ...quyTrinhTep.quy_trinh.find((q) => q.ma === "dung-xe-kiem-tra")!, version: 1 };
const luatTep = (await Bun.file(join(GOC, "data/tra-cuu/luat-giay-to.json")).json()) as { dong: any[] };
const LUAT: LuatGiayTo[] = luatTep.dong.map((d) => ({
  ma: d.ma,
  version: 1,
  kiem: d.kiem,
  giay_to: d.giay_to,
  phan_loai: d.phan_loai,
  tham_so: d.tham_so,
  ten: d.ten,
  giai_thich: d.giai_thich,
  can_cu: d.can_cu,
  ma_muc_phat: d.ma_muc_phat,
}));
const mauTep = (await Bun.file(join(GOC, "data/tro-choi/dung-xe.json")).json()) as {
  tinh_huong: Array<{ ma: string; tinh_huong: PayloadDungXe; dap_an: DapAnDungXe }>;
};

function nguon(ma: string): NguonDungXe {
  const t = mauTep.tinh_huong.find((x) => x.ma === ma)!;
  return {
    id: `id-${ma}`,
    code: ma,
    version: 1,
    topic_id: null,
    tinh_huong: t.tinh_huong,
    dap_an: t.dap_an,
    quy_trinh: QT,
    luat: LUAT,
    muc_phat: {},
  };
}
const NGUON = mauTep.tinh_huong.map((t) => nguon(t.ma));

function buoc(ma: string): { b: BuocDungXe; diemToiDa: number } {
  const n = nguon(ma);
  const [l] = DX.taoLuot([n], taoRng("x"), n.tinh_huong.muc);
  return { b: l!.noi_dung, diemToiDa: l!.diem_toi_da };
}

/** Bộ dựng nhật ký: mỗi thao tác cách nhau 1 giây. */
function nk() {
  const ds: ThaoTacDungXe[] = [];
  let ms = 0;
  const tang = (d: number) => {
    ms += d;
    return ms;
  };
  const api = {
    vuot(huong: "len" | "xuong" = "len") {
      ds.push({ ms: tang(1000), loai: "vuot", huong });
      return api;
    },
    viTri(ma: string) {
      ds.push({ ms: tang(1000), loai: "cham", muc_tieu: `vi_tri:${ma}` });
      return api;
    },
    noi(k: KieuBuocDungXe) {
      ds.push({ ms: tang(1000), loai: "cham", muc_tieu: `loi:${k}` });
      return api;
    },
    xep(b: BuocDungXe, sai = false) {
      for (const g of ["gplx", "dang_ky", "bao_hiem"] as const) {
        const d = b.giay_to_dung[g];
        ds.push({
          ms: tang(1000),
          loai: "keo",
          muc_tieu: `giay_to:${g}`,
          dich: sai ? (d === "dat" ? "khong_dat" : "dat") : d,
        });
      }
      return api;
    },
    giu(giuMs: number) {
      const tu = ms + 100;
      ds.push({ ms: tang(tu + giuMs - ms), loai: "giu", muc_tieu: "may_do", tu_ms: tu });
      return api;
    },
    ketQua(dich: string) {
      ds.push({ ms: tang(1000), loai: "keo", muc_tieu: "ket_qua", dich });
      return api;
    },
    cho(them: number) {
      ms += them;
      return api;
    },
    xong: () => ({ nhat_ky: ds, tong_ms: ms + 500 }),
  };
  return api;
}

describe("dữ liệu mẫu", () => {
  test("quy trình dừng xe dùng được cho trò; mọi bước chưa có căn cứ được ghi rõ", () => {
    expect(kiemTraQuyTrinhDungXe(QT)).toEqual([]);
    for (const b of QT.cac_buoc) {
      expect(b.can_cu).toBeNull();
      expect(b.tro_choi?.nguon).toBe("chua_co_can_cu");
    }
  });

  test("5 tình huống hợp lệ, mỗi màn một, có hợp tác và không hợp tác, luật cho đúng lỗi dự kiến", () => {
    expect(NGUON).toHaveLength(5);
    expect(NGUON.map((n) => n.tinh_huong.muc).sort()).toEqual([1, 2, 3, 4, 5]);
    for (const n of NGUON) {
      expect(kiemTraTinhHuongDungXe(n.tinh_huong, n.dap_an)).toEqual([]);
      expect(dungDuocTinhHuong(n)).toBe(true);
    }
    expect(NGUON.filter((n) => n.tinh_huong.phan_ung.length === 0).length).toBeGreaterThanOrEqual(2);
    expect(NGUON.filter((n) => n.tinh_huong.phan_ung.length > 0).length).toBeGreaterThanOrEqual(2);
  });

  test("lỗi giấy tờ dự kiến sai với luật thì tình huống không dùng được", () => {
    const n = nguon("DX-02");
    expect(dungDuocTinhHuong({ ...n, dap_an: { ...n.dap_an, loi_giay_to: [] } })).toBe(false);
  });

  test("kiểm tình huống bắt lỗi: có vi phạm mà cho đi; vị trí an toàn không có trong danh sách", () => {
    const n = nguon("DX-02");
    expect(kiemTraTinhHuongDungXe(n.tinh_huong, { ...n.dap_an, huong_xu_ly: "cho_di" }).join(" ")).toContain(
      "không thể cho đi",
    );
    expect(
      kiemTraTinhHuongDungXe(n.tinh_huong, { ...n.dap_an, vi_tri_an_toan: ["khong-co"] }).join(" "),
    ).toContain("Vị trí an toàn");
  });
});

describe("chấm theo quy trình", () => {
  test("làm đúng quy trình được đủ điểm", () => {
    const { b, diemToiDa } = buoc("DX-01");
    const tl = nk().vuot().noi("thong_bao_ly_do").noi("yeu_cau_xuat_trinh").xep(b).ketQua("cho_di").xong();
    const kq = chamDungXe(b, tl, 60_000);
    expect(diemToiDa).toBe(50);
    expect(kq.diem).toBe(50);
    expect(kq.chiTiet.so_sanh.every((x) => x.ket === "dung")).toBe(true);
  });

  test("sai thứ tự −3 và tình huống xấu đi (người lái bức xúc)", () => {
    const { b } = buoc("DX-01");
    const tl = nk().vuot().noi("yeu_cau_xuat_trinh").noi("thong_bao_ly_do").xep(b).ketQua("cho_di").xong();
    const kq = chamDungXe(b, tl, 60_000);
    const yc = kq.chiTiet.so_sanh.find((x) => x.kieu === "yeu_cau_xuat_trinh")!;
    expect(yc.ket).toBe("sai_thu_tu");
    expect(yc.diem).toBe(7);
    expect(kq.diem).toBe(47);
    expect(kq.chiTiet.cang_thang).toBe(1);
    expect(kq.chiTiet.su_kien.some((s) => s.muc === "xau" && s.noi_dung.includes("khó chịu"))).toBe(true);
  });

  test("thiếu bước bắt buộc: 0 điểm, ghi đúng bước, bước sau không bị tính thêm sai thứ tự", () => {
    const { b } = buoc("DX-01");
    const tl = nk().vuot().noi("yeu_cau_xuat_trinh").xep(b).ketQua("cho_di").xong();
    const kq = chamDungXe(b, tl, 60_000);
    const tb = kq.chiTiet.so_sanh.find((x) => x.kieu === "thong_bao_ly_do")!;
    expect(tb.ket).toBe("thieu");
    expect(tb.diem).toBe(0);
    expect(kq.chiTiet.so_sanh.find((x) => x.kieu === "yeu_cau_xuat_trinh")!.ket).toBe("dung");
    expect(kq.diem).toBe(40);
  });

  test("người lái đòi biết lý do: đề nghị xuất trình trước thì không nhận được giấy tờ", () => {
    const { b } = buoc("DX-03");
    const s = dienBien(
      canhCongKhai(b),
      nk().vuot().viTri("le-phai").noi("yeu_cau_xuat_trinh").xong().nhat_ky,
    );
    expect(s.giay_to_da_giao).toBe(false);
    const s2 = dienBien(
      canhCongKhai(b),
      nk().vuot().viTri("le-phai").noi("yeu_cau_xuat_trinh").noi("thong_bao_ly_do").xong().nhat_ky,
    );
    expect(s2.giay_to_da_giao).toBe(true);
  });

  test("thao tác khi xe chưa dừng: không có tác dụng, tính sai thứ tự", () => {
    const { b } = buoc("DX-01");
    const tl = nk()
      .noi("thong_bao_ly_do")
      .vuot()
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .xep(b)
      .ketQua("cho_di")
      .xong();
    const kq = chamDungXe(b, tl, 60_000);
    expect(kq.chiTiet.so_sanh.find((x) => x.kieu === "thong_bao_ly_do")!.ket).toBe("sai_thu_tu");
    expect(kq.chiTiet.su_kien[0]!.noi_dung).toContain("Xe vẫn đang chạy");
  });

  test("vị trí nguy hiểm −10; tiếp xúc khi xe còn giữa làn −10", () => {
    const { b, diemToiDa } = buoc("DX-02");
    const dung = nk()
      .vuot()
      .viTri("le-phai")
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .xep(b)
      .ketQua("lap_bien_ban")
      .xong();
    expect(chamDungXe(b, dung, 60_000).diem).toBe(diemToiDa);
    const nguy = nk()
      .vuot()
      .viTri("sau-cua")
      .viTri("le-phai")
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .xep(b)
      .ketQua("lap_bien_ban")
      .xong();
    const k1 = chamDungXe(b, nguy, 60_000);
    expect(k1.diem).toBe(diemToiDa - 10);
    expect(k1.chiTiet.tru).toHaveLength(1);
    const giuaLan = nk()
      .vuot()
      .noi("thong_bao_ly_do")
      .viTri("le-phai")
      .noi("yeu_cau_xuat_trinh")
      .xep(b)
      .ketQua("lap_bien_ban")
      .xong();
    const k2 = chamDungXe(b, giuaLan, 60_000);
    expect(k2.chiTiet.tru[0]!.ly_do).toContain("giữa làn");
    // Chọn vị trí sau khi đã thông báo lý do: bước thông báo đúng chỗ? Không — vị trí đứng trước nên thông báo sai thứ tự.
    expect(k2.chiTiet.so_sanh.find((x) => x.kieu === "thong_bao_ly_do")!.ket).toBe("sai_thu_tu");
  });

  test("điện thoại không biết vị trí nào nguy hiểm: không báo trước khi chấm", () => {
    const { b } = buoc("DX-02");
    const s = dienBien(canhCongKhai(b), nk().vuot().viTri("sau-cua").xong().nhat_ky);
    expect(s.khong_an_toan).toHaveLength(0);
  });

  test("hướng xử lý sai: bước quyết định 0 điểm; xếp giấy tờ sai được điểm theo tỷ lệ", () => {
    const { b } = buoc("DX-02");
    const tl = nk()
      .vuot()
      .viTri("le-phai")
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .xep(b, true)
      .ketQua("cho_di")
      .xong();
    const kq = chamDungXe(b, tl, 60_000);
    expect(kq.chiTiet.so_sanh.find((x) => x.kieu === "xu_ly")!.diem).toBe(0);
    expect(kq.chiTiet.so_sanh.find((x) => x.kieu === "kiem_giay_to")!.diem).toBe(0);
    expect(kq.chiTiet.giay_to.find((g) => g.loai === "bao_hiem")!.dung).toBe("khong_dat");
  });

  test("kết luận khi chưa làm hết: các bước còn lại thiếu, diễn biến nói rõ hậu quả", () => {
    const { b } = buoc("DX-04");
    const kq = chamDungXe(b, nk().vuot().viTri("bai-do").ketQua("cho_di").xong(), 60_000);
    expect(kq.chiTiet.so_sanh.filter((x) => x.ket === "thieu").map((x) => x.kieu)).toEqual([
      "thong_bao_ly_do",
      "yeu_cau_xuat_trinh",
      "kiem_giay_to",
      "do_nong_do_con",
    ]);
    expect(kq.chiTiet.su_kien.some((s) => s.noi_dung.includes("chưa đo nồng độ cồn"))).toBe(true);
  });

  test("thao tác sau khi đã kết luận bị bỏ qua", () => {
    const { b } = buoc("DX-01");
    const s = dienBien(canhCongKhai(b), nk().vuot().ketQua("cho_di").noi("thong_bao_ly_do").xong().nhat_ky);
    expect(s.da_thong_bao).toBe(false);
    expect(s.bo_qua).toBe(1);
  });
});

describe("đo nồng độ cồn", () => {
  const dau = (b: BuocDungXe) =>
    nk().vuot().viTri("bai-do").noi("thong_bao_ly_do").noi("yeu_cau_xuat_trinh").xep(b);

  test("giữ đủ thời gian thì có kết quả; rẽ nhánh theo kết quả đo", () => {
    const { b, diemToiDa } = buoc("DX-04");
    const kq = chamDungXe(b, dau(b).giu(5000).ketQua("lap_bien_ban_tam_giu").xong(), 60_000);
    expect(kq.chiTiet.ket_qua_do).toBe(0.3);
    expect(kq.diem).toBe(diemToiDa);
    expect(chamDungXe(b, dau(b).giu(5000).ketQua("cho_di").xong(), 60_000).diem).toBe(diemToiDa - 10);
  });

  test("thả sớm lần đầu không trừ, từ lần hai −2", () => {
    const { b, diemToiDa } = buoc("DX-04");
    const mot = chamDungXe(b, dau(b).giu(2000).giu(5000).ketQua("lap_bien_ban_tam_giu").xong(), 60_000);
    expect(mot.diem).toBe(diemToiDa);
    const ba = chamDungXe(
      b,
      dau(b).giu(1000).giu(2000).giu(3000).giu(5000).ketQua("lap_bien_ban_tam_giu").xong(),
      60_000,
    );
    expect(ba.diem).toBe(diemToiDa - 4);
    expect(ba.chiTiet.ket_qua_do).toBe(0.3);
  });
});

describe("người lái không hợp tác (màn 5)", () => {
  const dung = (b: BuocDungXe) =>
    nk()
      .vuot()
      .vuot()
      .viTri("le-phai")
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .noi("tu_choi_de_nghi")
      .xep(b)
      .giu(5000)
      .noi("yeu_cau_chap_hanh_do")
      .giu(5000)
      .ketQua("lap_bien_ban_tam_giu");

  test("bước phản ứng được tính; xử lý đủ thì đủ điểm", () => {
    const { b, diemToiDa } = buoc("DX-05");
    expect(diemToiDa).toBe(90);
    const kq = chamDungXe(b, dung(b).xong(), 120_000);
    expect(kq.chiTiet.so_sanh.map((x) => x.ket)).toEqual(Array(9).fill("dung"));
    expect(kq.diem).toBe(90);
  });

  test("hiệu lệnh đầu người lái không dừng; không từ chối lời xin thì người lái nài nỉ và bước bị thiếu", () => {
    const { b } = buoc("DX-05");
    const s = dienBien(canhCongKhai(b), nk().vuot().xong().nhat_ky);
    expect(s.xe_dung).toBe(false);
    const tl = nk()
      .vuot()
      .vuot()
      .viTri("le-phai")
      .noi("thong_bao_ly_do")
      .noi("yeu_cau_xuat_trinh")
      .xep(b)
      .ketQua("lap_bien_ban_tam_giu")
      .xong();
    const kq = chamDungXe(b, tl, 120_000);
    expect(kq.chiTiet.so_sanh.find((x) => x.kieu === "tu_choi_de_nghi")!.ket).toBe("thieu");
    expect(kq.chiTiet.su_kien.filter((x) => x.noi_dung.includes("nài nỉ")).length).toBeGreaterThanOrEqual(3);
  });

  test("không chịu thổi: giữ máy đo không có kết quả cho tới khi yêu cầu chấp hành", () => {
    const { b } = buoc("DX-05");
    const s = dienBien(
      canhCongKhai(b),
      nk().vuot().vuot().viTri("le-phai").noi("thong_bao_ly_do").giu(6000).giu(6000).xong().nhat_ky,
    );
    expect(s.ket_qua_do).toBeNull();
    expect(s.lan_tha_som).toBe(0);
  });

  test("mỗi thao tác quá 15 giây −2", () => {
    const { b } = buoc("DX-05");
    expect(chamDungXe(b, dung(b).xong(), 120_000).chiTiet.tru).toHaveLength(0);
    const cham = chamDungXe(b, nk().vuot().cho(20_000).vuot().xong(), 120_000);
    expect(cham.chiTiet.tru).toEqual([{ ly_do: "1 thao tác quá giờ.", diem: 2 }]);
  });
});

describe("gian lận và nhật ký", () => {
  test("mốc không tăng dần, hoặc dài hơn đồng hồ máy chủ quá 10% + 2 giây: 0 điểm", () => {
    const { b } = buoc("DX-01");
    const tl = nk().vuot().noi("thong_bao_ly_do").noi("yeu_cau_xuat_trinh").xep(b).ketQua("cho_di").xong();
    const dao = { ...tl, nhat_ky: [tl.nhat_ky[1]!, tl.nhat_ky[0]!, ...tl.nhat_ky.slice(2)] };
    expect(chamDungXe(b, dao, 60_000).diem).toBe(0);
    expect(chamDungXe(b, tl, 1_000).chiTiet.hop_le).toBe(false);
    // Offline: không có đồng hồ máy chủ thì không kiểm lệch giờ.
    expect(chamDungXe(b, tl, null).diem).toBe(50);
  });

  test("máy khách gửi kèm điểm, cờ đúng bị bỏ qua; thao tác sai dạng hoặc lạ bị bỏ, không hỏng nhật ký", () => {
    const tl = DX.docTraLoi({
      tong_ms: 5000,
      diem: 999,
      dung: true,
      nhat_ky: [
        { ms: 1000, loai: "vuot", huong: "len" },
        { ms: 1500, loai: "bay", muc_tieu: "x" },
        { ms: "x", loai: "cham", muc_tieu: "loi:thong_bao_ly_do" },
        { ms: 2000, loai: "cham", muc_tieu: "loi:khong_co" },
      ],
    });
    expect(tl).toEqual({
      tong_ms: 5000,
      nhat_ky: [
        { ms: 1000, loai: "vuot", huong: "len" },
        { ms: 2000, loai: "cham", muc_tieu: "loi:khong_co" },
      ],
    });
    const { b } = buoc("DX-01");
    expect(dienBien(canhCongKhai(b), tl!.nhat_ky).bo_qua).toBe(1);
  });

  test("nhật ký quá 2.000 thao tác bị từ chối", () => {
    const ds = Array.from({ length: THAO_TAC_TOI_DA + 1 }, (_, i) => ({ ms: i, loai: "vuot", huong: "len" }));
    expect(DX.docTraLoi({ tong_ms: 10_000, nhat_ky: ds })).toBeNull();
  });

  test("máy chủ và điện thoại chạy cùng diễn biến công khai", () => {
    const { b } = buoc("DX-05");
    const tl = nk()
      .vuot()
      .vuot()
      .viTri("le-phai")
      .noi("yeu_cau_xuat_trinh")
      .noi("thong_bao_ly_do")
      .giu(3000)
      .xong();
    const may = dienBien(canhCongKhai(b), tl.nhat_ky, { vi_tri_an_toan: b.vi_tri_an_toan });
    const dt = dienBien(canhCongKhai(b), tl.nhat_ky);
    expect(JSON.stringify(dt)).toBe(JSON.stringify(may));
  });
});

describe("đề và lượt", () => {
  const KHOA_CAM = [
    "answer",
    "dap_an",
    "giai_thich",
    "can_cu",
    "explanation",
    "vi_tri_an_toan",
    "huong_xu_ly",
    "giay_to_dung",
    "quy_trinh",
  ];
  const coKhoa = (v: unknown): string | null => {
    if (Array.isArray(v))
      for (const x of v) {
        const k = coKhoa(x);
        if (k) return k;
      }
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (KHOA_CAM.includes(k)) return k;
        const c = coKhoa(x);
        if (c) return c;
      }
    return null;
  };

  test("đề không có đáp án, không có thứ tự quy trình (trừ gợi ý màn 1)", () => {
    for (const n of NGUON) {
      const [l] = DX.taoLuot([n], taoRng("d"), n.tinh_huong.muc);
      const de = DX.deChoNguoiChoi(l!);
      expect(coKhoa(de)).toBeNull();
      expect(de.goi_y_thu_tu === null).toBe(n.tinh_huong.muc !== 1);
    }
  });

  test("lượt tất định, ưu tiên tình huống đúng màn; màn cao dùng được tình huống màn thấp khi thiếu", () => {
    const a = DX.taoLuot(NGUON, taoRng("s"), 3);
    const b = DX.taoLuot([...NGUON].reverse(), taoRng("s"), 3);
    expect(a[0]!.ref_id).toBe("id-DX-03");
    expect(b[0]!.ref_id).toBe(a[0]!.ref_id);
    expect(DX.taoLuot([nguon("DX-01")], taoRng("s"), 4)[0]!.ref_id).toBe("id-DX-01");
    expect(DX.taoLuot([nguon("DX-04")], taoRng("s"), 1)).toHaveLength(0);
  });

  test("quy trình thiếu bước quyết định hoặc sai cử chỉ thì không dùng được", () => {
    const bo = { ...QT, cac_buoc: QT.cac_buoc.filter((x) => x.tro_choi?.ma !== "xu_ly") };
    expect(kiemTraQuyTrinhDungXe(bo).join(" ")).toContain("Quyết định hướng xử lý");
    const sai = {
      ...QT,
      cac_buoc: QT.cac_buoc.map((x) =>
        x.tro_choi?.ma === "do_nong_do_con"
          ? { ...x, tro_choi: { ...x.tro_choi, thao_tac: "cham" as const } }
          : x,
      ),
    };
    expect(kiemTraQuyTrinhDungXe(sai).join(" ")).toContain("giu");
    expect(DX.locNguon([{ ...nguon("DX-01"), quy_trinh: bo }])).toHaveLength(0);
  });
});
