/**
 * Bộ giấy tờ dùng chung (mô-đun M1, docs/PLAN.md GĐ-T1): bộ kiểm theo luật, hàm sinh hồ sơ, luật thiếu.
 * Luật trong test là luật giả định để thử cơ chế, không phải luật đã đối chiếu văn bản.
 */
import { describe, expect, test } from "bun:test";
import {
  congNgayLich,
  type HoSoGiayTo,
  kiemTraHoSo,
  kiemTraLuatGiayTo,
  luatConThieu,
  MA_LOI_GIAY_TO,
  type MaLoiGiayTo,
  maLoiCuaLuat,
  sinhHoSo,
  taoRng,
} from "../src/index.ts";
import { LUAT_THU } from "./luat-giay-to-thu.ts";

const NGAY = "2026-09-15";

function hoSoHopLe(): HoSoGiayTo {
  return {
    ngay_kiem_tra: NGAY,
    nguoi_lai: { ho_ten: "Nguyễn Văn An", ngay_sinh: "1990-03-12", loi_noi: "Tôi là Nguyễn Văn An." },
    xe: {
      phan_loai: "o_to_con",
      bien_so: "30A-123.45",
      nhan_hieu: "Toyota Vios",
      mau: "Trắng",
      dung_tich: null,
      so_cho: 5,
    },
    giay_to: {
      gplx: {
        so: "123456789012",
        ho_ten: "Nguyễn Văn An",
        ngay_sinh: "1990-03-12",
        hang: ["B"],
        co_gia_tri_den: "2030-01-01",
      },
      dang_ky: {
        so: "123456",
        chu_xe: "Nguyễn Văn An",
        bien_so: "30A-123.45",
        nhan_hieu: "Toyota Vios",
        mau: "Trắng",
        dung_tich: null,
        so_cho: 5,
      },
      bao_hiem: {
        so: "BH1",
        chu_xe: "Nguyễn Văn An",
        bien_so: "30A-123.45",
        tu_ngay: "2026-01-01",
        den_ngay: "2026-12-31",
      },
    },
  };
}

const maLoi = (h: HoSoGiayTo, bat?: Set<MaLoiGiayTo>) =>
  kiemTraHoSo(h, LUAT_THU, bat)
    .map((l) => l.ma_loi)
    .sort();

describe("bộ kiểm giấy tờ", () => {
  test("hồ sơ hợp lệ không có lỗi", () => {
    expect(maLoi(hoSoHopLe())).toEqual([]);
  });

  test("mỗi luật phát hiện đúng lỗi của nó, kèm mô tả và chi tiết chỉ ra được", () => {
    const h = hoSoHopLe();
    h.giay_to.gplx!.co_gia_tri_den = "2026-09-14";
    h.giay_to.dang_ky!.bien_so = "30A-123.46";
    const loi = kiemTraHoSo(h, LUAT_THU);
    expect(loi.map((l) => l.ma_loi).sort()).toEqual(["dang_ky_sai_bien_so", "gplx_ngoai_han"]);
    const han = loi.find((l) => l.ma_loi === "gplx_ngoai_han")!;
    expect(han.mo_ta).toContain("14/09/2026");
    expect(han.luat_ma).toBe("han-gplx");
    expect(loi.find((l) => l.ma_loi === "dang_ky_sai_bien_so")!.dau_hieu).toContain("xe.bien_so");
  });

  test("biên thời hạn: hết hạn đúng ngày kiểm tra vẫn còn giá trị; hôm trước là hết", () => {
    const h = hoSoHopLe();
    h.giay_to.gplx!.co_gia_tri_den = NGAY;
    h.giay_to.bao_hiem!.den_ngay = NGAY;
    expect(maLoi(h)).toEqual([]);
    h.giay_to.bao_hiem!.tu_ngay = congNgayLich(NGAY, 1);
    h.giay_to.bao_hiem!.den_ngay = congNgayLich(NGAY, 365);
    expect(maLoi(h)).toEqual(["bao_hiem_ngoai_han"]);
  });

  test("biển số so sánh bỏ dấu chấm, gạch, khoảng trắng; lệch một chữ số là sai", () => {
    const h = hoSoHopLe();
    h.giay_to.bao_hiem!.bien_so = "30a 12345";
    expect(maLoi(h)).toEqual([]);
    h.giay_to.bao_hiem!.bien_so = "30A-123.44";
    expect(maLoi(h)).toEqual(["bao_hiem_sai_bien_so"]);
  });

  test("không có giấy tờ thì chỉ báo thiếu, không kiểm các lỗi khác của giấy đó", () => {
    const h = hoSoHopLe();
    h.giay_to.gplx = null;
    expect(maLoi(h)).toEqual(["thieu_gplx"]);
  });

  test("hạng giấy phép theo loại xe; giấy phép của người khác theo họ tên hoặc ngày sinh", () => {
    const h = hoSoHopLe();
    h.giay_to.gplx!.hang = ["A"];
    expect(maLoi(h)).toEqual(["gplx_sai_hang"]);
    h.giay_to.gplx!.hang = ["B"];
    h.giay_to.gplx!.ngay_sinh = "1991-03-12";
    expect(maLoi(h)).toEqual(["gplx_nguoi_khac"]);
  });

  test("chỉ kiểm các lỗi được bật (màn chơi)", () => {
    const h = hoSoHopLe();
    h.giay_to.bao_hiem!.den_ngay = "2026-01-02";
    expect(maLoi(h, new Set(["thieu_gplx", "gplx_ngoai_han"]))).toEqual([]);
    expect(maLoi(h)).toEqual(["bao_hiem_ngoai_han"]);
  });

  test("thiếu luật đã duyệt cho một lỗi thì báo thiếu, theo loại xe", () => {
    const h = hoSoHopLe();
    const khongHangOto = LUAT_THU.filter((l) => l.ma !== "hang-oto");
    expect(luatConThieu(h, khongHangOto, new Set(["gplx_sai_hang"]))).toEqual(["gplx_sai_hang"]);
    expect(luatConThieu(h, LUAT_THU, new Set(MA_LOI_GIAY_TO))).toEqual([]);
  });

  test("kiểm dạng luật: luật không ứng với lỗi nào hoặc thiếu căn cứ bị báo", () => {
    expect(kiemTraLuatGiayTo(LUAT_THU[0])).toEqual([]);
    expect(maLoiCuaLuat({ kiem: "khop_xe", giay_to: "gplx", tham_so: { truong: "bien_so" } })).toBeNull();
    expect(kiemTraLuatGiayTo({ ...LUAT_THU[0]!, can_cu: "abc" }).length).toBeGreaterThan(0);
    expect(kiemTraLuatGiayTo({ ...LUAT_THU[9]!, phan_loai: [] }).length).toBeGreaterThan(0);
  });
});

describe("hàm sinh hồ sơ", () => {
  test("cùng seed thì cùng hồ sơ", () => {
    const a = sinhHoSo({ loi: ["dang_ky_sai_bien_so"], ngayKiemTra: NGAY, luat: LUAT_THU }, taoRng("x"));
    const b = sinhHoSo({ loi: ["dang_ky_sai_bien_so"], ngayKiemTra: NGAY, luat: LUAT_THU }, taoRng("x"));
    expect(a).toEqual(b);
  });

  test("mỗi lỗi, thường và tinh vi, sinh ra đúng lỗi đó, không thêm lỗi khác", () => {
    const rng = taoRng("moi-loi");
    for (const loi of MA_LOI_GIAY_TO) {
      for (const tinhVi of [false, true]) {
        for (let i = 0; i < 5; i++) {
          const h = sinhHoSo({ loi: [loi], ngayKiemTra: NGAY, luat: LUAT_THU, tinhVi }, rng);
          expect(maLoi(h)).toEqual([loi]);
        }
      }
    }
  });

  test("hồ sơ hợp lệ, kể cả tinh vi (hết hạn đúng ngày kiểm tra), không có lỗi", () => {
    const rng = taoRng("hop-le");
    for (let i = 0; i < 40; i++) {
      const h = sinhHoSo({ loi: [], ngayKiemTra: NGAY, luat: LUAT_THU, tinhVi: i % 2 === 0 }, rng);
      expect(maLoi(h)).toEqual([]);
    }
  });

  test("lỗi tinh vi: biển số lệch đúng một ký tự", () => {
    const h = sinhHoSo(
      { loi: ["dang_ky_sai_bien_so"], ngayKiemTra: NGAY, luat: LUAT_THU, tinhVi: true },
      taoRng("tv"),
    );
    const a = h.xe.bien_so;
    const b = h.giay_to.dang_ky!.bien_so;
    expect(a.length).toBe(b.length);
    expect([...a].filter((c, i) => c !== b[i]).length).toBe(1);
  });

  test("hai lỗi cùng lúc", () => {
    const h = sinhHoSo(
      { loi: ["gplx_sai_hang", "bao_hiem_ngoai_han"], ngayKiemTra: NGAY, luat: LUAT_THU },
      taoRng("hai"),
    );
    expect(maLoi(h)).toEqual(["bao_hiem_ngoai_han", "gplx_sai_hang"]);
  });

  test("thiếu luật cho lỗi yêu cầu thì báo lỗi rõ, không sinh bừa", () => {
    const khongHang = LUAT_THU.filter((l) => l.kiem !== "hang_gplx");
    expect(() =>
      sinhHoSo({ loi: ["gplx_sai_hang"], ngayKiemTra: NGAY, luat: khongHang }, taoRng("thieu")),
    ).toThrow(/Không sinh được/);
  });
});
