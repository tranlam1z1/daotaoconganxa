/**
 * Trò "Trạm cân tải trọng" (docs/PLAN.md GĐ-T12): cặp số, phần trăm, dấu đúng suy từ ngưỡng đã duyệt,
 * chấm, đọc câu trả lời, đề không lộ đáp án. Chạy trên chính 30 xe mẫu, tệp tải trọng và các dòng mức phạt
 * quá tải trong data/.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BuocLuot,
  type BuocTramCan,
  type ChiTietTramCan,
  DIEM_MOI_XE_TAI,
  dapAnTramCan,
  dinhNghiaTheoMan,
  type GioiHanTaiTrong,
  type KhungQuaTai,
  kiemTraGiayToXeTai,
  kiemTraMucPhat,
  kiemTraTaiTrong,
  kiemTraXeTramCan,
  type MucPhatDaDuyet,
  type NguonTramCan,
  SO_XE_THEO_MAN,
  TRO_CHOI_TRAM_CAN as TC,
  taoRng,
  type XeTramCan,
  xeDungDuocOMan,
} from "../src/index.ts";

const GOC = join(import.meta.dir, "..", "..", "..");
const TT = ((await Bun.file(join(GOC, "data", "tra-cuu", "tai-trong.json")).json()) as { dong: any[] }).dong;
const MP = ((await Bun.file(join(GOC, "data", "tra-cuu", "muc-phat.json")).json()) as { dong: any[] }).dong;
const MAU = (
  (await Bun.file(join(GOC, "data", "tro-choi", "tram-can.json")).json()) as {
    xe: Array<{ ma: string; muc: number; xe: XeTramCan }>;
  }
).xe;

const GIOI_HAN: GioiHanTaiTrong[] = TT.map((d) => ({
  ma: d.ma,
  version: 1,
  loai: d.loai,
  loai_xe: d.loai_xe ?? null,
  so_truc_cum: d.so_truc_cum ?? null,
  cach_tu_cm: d.cach_tu_cm ?? null,
  cach_den_cm: d.cach_den_cm ?? null,
  gioi_han_kg: d.gioi_han_kg,
  ten: d.ten,
  can_cu: d.can_cu,
}));
const QT = MP.filter((d) => d.qua_tai);
const KHUNG: KhungQuaTai[] = QT.map((d) => ({
  ma: d.ma,
  loai: d.qua_tai.loai,
  khoang: { tu: d.qua_tai.tu, den: d.qua_tai.den, bien: d.qua_tai.bien },
}));
const MUC_PHAT: Record<string, MucPhatDaDuyet> = Object.fromEntries(
  QT.map((d) => [
    d.ma,
    {
      ma: d.ma,
      version: 1,
      hanh_vi: d.hanh_vi,
      phat_tu: d.phat_tu,
      phat_den: d.phat_den,
      tru_diem: null,
      hinh_thuc_bo_sung: d.hinh_thuc_bo_sung,
      can_cu: d.can_cu,
    },
  ]),
);

const nguonTu = (h: (typeof MAU)[number], gh = GIOI_HAN, khung = KHUNG): NguonTramCan => ({
  id: h.ma,
  code: h.ma,
  version: 1,
  topic_id: null,
  muc: h.muc,
  xe: h.xe,
  gioi_han: gh,
  khung,
  muc_phat: MUC_PHAT,
});
const NGUON = MAU.map((h) => nguonTu(h));
const mau = (ma: string) => MAU.find((h) => h.ma === ma)!;

function buoc(ma: string, man = mau(ma).muc, n = nguonTu(mau(ma))): BuocLuot<BuocTramCan> {
  const [b] = TC.taoLuot([n], taoRng("x"), man);
  if (!b) throw new Error(`Xe ${ma} không vào được màn ${man}`);
  return b;
}
const cham = (b: BuocLuot<BuocTramCan>, raw: unknown) => {
  const tl = TC.docTraLoi(raw);
  if (!tl) throw new Error("Câu trả lời không hợp lệ");
  return TC.chamBuoc(b, tl);
};
/** Trả lời đúng hoàn toàn: dấu đúng, cặp quyết định, phần trăm làm tròn. */
const dungHet = (b: BuocLuot<BuocTramCan>) => {
  const q = b.noi_dung.cap[b.noi_dung.quyet]!;
  return {
    dau: b.noi_dung.dau,
    cap: { phieu: q.phieu, gioi_han: q.gioi_han },
    uoc: Math.round(Math.max(0, q.phan_tram)),
  };
};

describe("dữ liệu mẫu", () => {
  test("tệp tải trọng, khung quá tải, 30 xe hợp lệ; mỗi xe chấm được từ màn của nó tới màn 5", () => {
    expect(kiemTraTaiTrong(TT)).toEqual([]);
    expect(kiemTraMucPhat(MP)).toEqual([]);
    expect(MAU).toHaveLength(30);
    for (const h of MAU) {
      expect(kiemTraXeTramCan({ ...h.xe, muc: h.muc })).toEqual([]);
      for (let man = h.muc; man <= 5; man++) expect(xeDungDuocOMan(nguonTu(h), man)).toBe(true);
      if (h.muc > 1) expect(xeDungDuocOMan(nguonTu(h), h.muc - 1)).toBe(false);
    }
  });

  test("M1 mở rộng: giấy tờ xe tải sai dạng bị báo lỗi", () => {
    const x = mau("TC-01").xe;
    expect(kiemTraGiayToXeTai(x, 2)).toEqual([]);
    expect(kiemTraGiayToXeTai(x, 3).length).toBeGreaterThan(0);
    expect(
      kiemTraGiayToXeTai({ ...x, giay_kiem_dinh: { ...x.giay_kiem_dinh, toan_bo_cho_phep_kg: 100 } }, 2)
        .length,
    ).toBeGreaterThan(0);
    expect(
      kiemTraXeTramCan({ ...x, muc: 1, phieu_can: { ...x.phieu_can, tong_kg: 1 } }).length,
    ).toBeGreaterThan(0);
  });
});

describe("ca biên và dấu đúng", () => {
  test("đúng bằng giới hạn là không vượt; vượt đúng 10% còn hạ tải; vượt 10,1% lập biên bản", () => {
    const b2 = buoc("TC-02");
    expect(b2.noi_dung.cap[b2.noi_dung.quyet]!.phan_tram).toBe(0);
    expect(b2.noi_dung.dau).toBe("cho_di");
    const b4 = buoc("TC-04");
    expect(b4.noi_dung.cap[b4.noi_dung.quyet]!.phan_tram).toBe(10);
    expect(b4.noi_dung.dau).toBe("ha_tai");
    const b7 = buoc("TC-07");
    expect(b7.noi_dung.cap[b7.noi_dung.quyet]!.phan_tram).toBe(10.1);
    expect(b7.noi_dung.dau).toBe("lap_bien_ban");
  });

  test("khung phần trăm chọn đúng dòng mức phạt; biên bản lấy mức phạt của dòng đó", () => {
    const b = buoc("TC-05"); // 25% theo giấy kiểm định
    expect(b.noi_dung.bien_ban).toHaveLength(1);
    expect(b.noi_dung.bien_ban[0]!.muc_phat?.ma).toBe("oto-qua-tai-kd-10");
    // Cụm trục vượt 30% và tổng vượt 21,3% cầu đường cùng khung (20, 50]: một dòng; tổng vượt 13,2%
    // theo giấy kiểm định: thêm một dòng.
    const b19 = buoc("TC-19");
    expect(b19.noi_dung.bien_ban.map((d) => d.muc_phat?.ma).sort()).toEqual([
      "oto-qua-tai-cd-20",
      "oto-qua-tai-kd-10",
    ]);
    expect(b19.noi_dung.bien_ban.find((d) => d.muc_phat?.ma === "oto-qua-tai-cd-20")!.chi_tiet).toContain(
      "30%",
    );
  });

  test("màn 2 so thêm khối lượng hàng; màn 3 dùng đúng dòng cụm trục theo khoảng cách", () => {
    expect(buoc("TC-08").noi_dung.cap[buoc("TC-08").noi_dung.quyet]!.phieu).toBe("phieu.hang");
    expect(dapAnTramCan(mau("TC-08").xe, GIOI_HAN, KHUNG, 1)!.dau).toBe("ha_tai"); // màn 1 chỉ so tổng
    const b15 = buoc("TC-15");
    expect(b15.noi_dung.cap[b15.noi_dung.quyet]!.gioi_han).toBe("bang.tt-cum2-100-130");
  });

  test("giấy phép còn hạn, đúng tuyến thay bảng tại trạm; hết hạn hoặc sai tuyến thì không", () => {
    const hop = buoc("TC-20").noi_dung.cap.map((c) => c.gioi_han);
    expect(hop).toContain("gp.cum_truc");
    expect(hop.some((g) => g.startsWith("bang."))).toBe(false);
    for (const ma of ["TC-21", "TC-22"]) {
      const g = buoc(ma).noi_dung.cap.map((c) => c.gioi_han);
      expect(g.some((x) => x.startsWith("gp."))).toBe(false);
      expect(buoc(ma).noi_dung.dau).toBe("lap_bien_ban");
    }
  });
});

describe("chấm điểm", () => {
  test("xe không vượt, cho đi đúng cặp gần nhất và ước 0%: đủ 18 điểm", () => {
    const b = buoc("TC-01");
    const kq = cham(b, dungHet(b));
    expect([kq.diem, kq.dung, b.diem_toi_da]).toEqual([18, true, DIEM_MOI_XE_TAI]);
  });

  test("phần trăm ước lệch 2 điểm được 3 điểm, lệch 2,1 điểm thì không", () => {
    const b = buoc("TC-07"); // 10,1%
    const d = dungHet(b);
    expect((cham(b, { ...d, uoc: 12 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(3); // lệch 1,9
    expect((cham(b, { ...d, uoc: 8 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(0); // lệch 2,1
  });

  test("lệch đúng 2 và 2,1 điểm phần trăm (phần trăm nguyên và lẻ)", () => {
    const b9 = buoc("TC-09"); // 8%
    expect((cham(b9, { ...dungHet(b9), uoc: 10 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(3);
    expect((cham(b9, { ...dungHet(b9), uoc: 6 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(3);
    const b7 = buoc("TC-07"); // 10,1%
    expect((cham(b7, { ...dungHet(b7), uoc: 13 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(0); // lệch 2,9
    const b24 = buoc("TC-24"); // 20%
    expect((cham(b24, { ...dungHet(b24), uoc: 22 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(3);
    expect((cham(b24, { ...dungHet(b24), uoc: 23 }).chiTiet as ChiTietTramCan).diem_uoc).toBe(0);
  });

  test("cặp đúng loại nhưng không phải cặp quyết định, hoặc cặp không hợp lệ: 0 điểm cặp", () => {
    const b = buoc("TC-08"); // quyết định là hàng
    const kq = cham(b, { ...dungHet(b), cap: { phieu: "phieu.tong", gioi_han: "kd.toan_bo" } });
    expect((kq.chiTiet as ChiTietTramCan).diem_cap).toBe(0);
    expect(kq.diem).toBe(13);
    const b20 = buoc("TC-20"); // giấy phép còn hạn: cặp với bảng tại trạm không hợp lệ
    const sai = cham(b20, {
      ...dungHet(b20),
      cap: { phieu: "phieu.truc.1", gioi_han: "bang.tt-cum2-tu-130" },
    });
    expect((sai.chiTiet as ChiTietTramCan).cap_chon).toBeNull();
  });

  test("điểm không âm: sai hết được 0", () => {
    const b = buoc("TC-05");
    const kq = cham(b, { dau: "cho_di", cap: { phieu: "phieu.tong", gioi_han: "kd.hang" }, uoc: 200 });
    expect(kq.diem).toBe(0);
  });
});

describe("đáp án theo ngưỡng đã duyệt", () => {
  test("ngưỡng đổi sau khi duyệt lại thì đáp án đổi theo", () => {
    // Khung phạt theo kiểm định bắt đầu từ trên 5% thay cho trên 10%: xe vượt 6% thành lập biên bản.
    const khungMoi = KHUNG.map((k) =>
      k.ma === "oto-qua-tai-kd-10" ? { ...k, khoang: { ...k.khoang, tu: 5 } } : k,
    );
    expect(buoc("TC-03").noi_dung.dau).toBe("ha_tai");
    expect(buoc("TC-03", 1, nguonTu(mau("TC-03"), GIOI_HAN, khungMoi)).noi_dung.dau).toBe("lap_bien_ban");
    // Giới hạn cụm 2 trục từ 1,3 m nâng lên 21.000 kg: xe cụm trục 20.000 kg không còn vượt.
    const ghMoi = GIOI_HAN.map((g) => (g.ma === "tt-cum2-tu-130" ? { ...g, gioi_han_kg: 21_000 } : g));
    expect(buoc("TC-14").noi_dung.dau).toBe("lap_bien_ban");
    expect(buoc("TC-14", 3, nguonTu(mau("TC-14"), ghMoi)).noi_dung.dau).toBe("cho_di");
  });

  test("ngưỡng chưa duyệt (vắng khỏi nguồn) thì xe cần ngưỡng đó không vào lượt", () => {
    const thieu = GIOI_HAN.filter((g) => g.ma !== "tt-cum2-tu-130");
    const n = nguonTu(mau("TC-14"), thieu);
    expect(xeDungDuocOMan(n, 3)).toBe(false);
    expect(TC.taoLuot([n], taoRng("a"), 3)).toEqual([]);
    // Màn 1, 2 chỉ cần giấy kiểm định và khung phần trăm: xe hai trục vẫn chơi được.
    expect(xeDungDuocOMan(nguonTu(mau("TC-01"), []), 2)).toBe(true);
    // Chưa có khung phần trăm nào của loại quá tải đang xét: không chấm được.
    expect(
      xeDungDuocOMan(
        nguonTu(
          mau("TC-01"),
          GIOI_HAN,
          KHUNG.filter((k) => k.loai !== "kiem_dinh"),
        ),
        1,
      ),
    ).toBe(false);
  });
});

describe("đọc câu trả lời, lượt và đề", () => {
  test("không có cặp số căn cứ, dấu lạ, ước ngoài 0–200: không nhận; phần trăm máy khách tự tính bị bỏ qua", () => {
    const d = { dau: "cho_di", cap: { phieu: "phieu.tong", gioi_han: "kd.toan_bo" }, uoc: 0 };
    expect(TC.docTraLoi({ ...d, cap: null })).toBeNull();
    expect(TC.docTraLoi({ ...d, dau: "giu_lai" })).toBeNull();
    expect(TC.docTraLoi({ ...d, uoc: 201 })).toBeNull();
    expect(TC.docTraLoi({ ...d, uoc: 3.5 })).toBeNull();
    expect(TC.docTraLoi({ ...d, cap: { phieu: "kd.hang", gioi_han: "phieu.tong" } })).toBeNull();
    const b = buoc("TC-05");
    const gian = cham(b, { ...dungHet(b), uoc: 0, phan_tram: 25, phan_tram_vuot: 0, diem: 18, dung: true });
    expect((gian.chiTiet as ChiTietTramCan).diem_uoc).toBe(0);
    expect((gian.chiTiet as ChiTietTramCan).phan_tram_vuot).toBe(25);
  });

  test("số xe theo màn, mỗi dấu có mặt, tất định theo seed; giờ theo màn", () => {
    for (const man of [1, 2, 3, 4, 5]) {
      const l = TC.taoLuot(NGUON, taoRng(`s${man}`), man);
      expect(l).toHaveLength(SO_XE_THEO_MAN[man]!);
      expect(new Set(l.map((b) => b.noi_dung.dau))).toEqual(new Set(["cho_di", "ha_tai", "lap_bien_ban"]));
      expect(l.every((b) => mau(b.ref_id!).muc <= man)).toBe(true);
    }
    expect(TC.taoLuot(NGUON, taoRng("q"), 4)).toEqual(TC.taoLuot(NGUON, taoRng("q"), 4));
    expect(dinhNghiaTheoMan(TC, 1).thoiGian).toBeNull();
    expect(dinhNghiaTheoMan(TC, 5).thoiGian).toEqual({ caLuotMs: 210_000 });
  });

  test("đề không có khung, dấu đúng, cặp quyết định, căn cứ; phần theo màn", () => {
    const CAM =
      /"(answer|dap_an|giai_thich|can_cu|khung|khung_ma|dau|quyet|cap|bien_ban|muc|muc_phat|phan_tram|noi_dung|loai_qua_tai)"/;
    for (const man of [1, 3, 5])
      for (const b of TC.taoLuot(NGUON, taoRng("de"), man))
        expect(JSON.stringify(TC.deChoNguoiChoi(b))).not.toMatch(CAM);
    const de1 = TC.deChoNguoiChoi(buoc("TC-01"));
    expect([de1.phieu_can.truc_kg, de1.phieu_can.hang_kg, de1.bang, de1.giay_phep_luu_hanh]).toEqual([
      [],
      null,
      [],
      null,
    ]);
    const de3 = TC.deChoNguoiChoi(buoc("TC-14"));
    expect(de3.phieu_can.truc_kg).toHaveLength(2);
    expect(de3.bang.map((g) => g.ma)).toContain("bang.tt-cum2-tu-130");
    expect(de3.bang.map((g) => g.ma)).not.toContain("bang.tt-tong-2-truc");
    expect(TC.deChoNguoiChoi(buoc("TC-20")).giay_phep_luu_hanh?.tuyen).toBeTruthy();
  });

  test("cùng xe cùng đáp án ở máy khách (gói offline) và máy chủ", () => {
    const l = TC.taoLuot(NGUON, taoRng("off"), 5);
    const goi = JSON.parse(JSON.stringify(l)) as typeof l;
    for (const [i, b] of l.entries()) {
      for (const tl of [
        dungHet(b),
        { dau: "cho_di", cap: { phieu: "phieu.tong", gioi_han: "kd.toan_bo" }, uoc: 7 },
      ])
        expect(cham(goi[i]!, tl)).toEqual(cham(b, tl));
      expect(TC.deChoNguoiChoi(goi[i]!)).toEqual(TC.deChoNguoiChoi(b));
    }
  });
});
