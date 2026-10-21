/**
 * Phần mở rộng M5 của GĐ-T15 (docs/PLAN.md): vật cản tạm làm xe sang làn hoặc dừng chờ, tầm nhìn
 * ban đêm theo đèn và đoạn khuất (bảng tra), xe thấy đèn cảnh báo thì giảm tốc sớm, vùng nguy hiểm
 * quanh người, đo hàng chờ. Cấu hình không có phần mở rộng thì chạy y như cũ (test của trò 3, 5, 9
 * vẫn đạt, xem mo-phong.test.ts và test từng trò); mã logic không gọi hàm lượng giác, số ngẫu nhiên,
 * đồng hồ.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BAN_KINH_VUNG_NGUY_HIEM_CM,
  buocMoPhong,
  type CauHinhMoPhong,
  chayDenHet,
  doHangCho,
  dungMoPhong,
  hopBao,
  KICH_THUOC_XE,
  lanThangDiLen,
  TAM_NHIN_BIEN_DEM_CM,
  TAM_NHIN_QUA_KHUAT_CM,
  TOC_DO_CHAM,
  TOC_DO_THUONG,
  type TrangThaiMoPhong,
  tamNhinToi,
  thayDuoc,
  trangThaiDau,
  trongVungNguyHiem,
} from "../src/mo-phong/index.ts";
import { bamTrangThai } from "../src/tro-choi/chung/nhat-ky.ts";

/** Hai làn song song đi lên, dài 30 ô (300 m); chạy đà 0. */
const HAI_LAN = [lanThangDiLen("L1", 30, 1100, -175), lanThangDiLen("L2", 30, 1100, 175)];
const xe = (id: string, lan: string, nhip_vao = 0, v_max = TOC_DO_THUONG) => ({
  id,
  loai: "o_to" as const,
  lan,
  nhip_vao,
  v_max,
});
const coc = (id: string, lan: string, s: number, lan_tranh: string | null = lan === "L1" ? "L2" : "L1") => ({
  id,
  loai: "coc" as const,
  lan,
  s_tu: s,
  s_den: s + 50,
  lan_tranh,
});

function chay(ch: CauHinhMoPhong, nhip = 1200): TrangThaiMoPhong {
  const mp = dungMoPhong(ch);
  let tt = trangThaiDau(mp);
  while (!tt.xong && tt.nhip < nhip) tt = buocMoPhong(mp, tt);
  return tt;
}

describe("tầm nhìn ban đêm (bảng tra)", () => {
  const canh = { khuat: [], sang: [] };
  test("biển phản quang thấy trong tầm đèn pha; đèn cảnh báo thấy xa hơn; biển được đèn chiếu thấy xa hơn", () => {
    expect(thayDuoc(canh, "bien", 10_000 - TAM_NHIN_BIEN_DEM_CM, 10_000)).toBe(true);
    expect(thayDuoc(canh, "bien", 10_000 - TAM_NHIN_BIEN_DEM_CM - 1, 10_000)).toBe(false);
    expect(thayDuoc(canh, "den", 0, 15_000)).toBe(true);
    expect(thayDuoc({ khuat: [], sang: [{ s: 10_500 }] }, "bien", 2000, 10_000)).toBe(true);
    // Vật sau lưng thì không thấy.
    expect(thayDuoc(canh, "den", 10_001, 10_000)).toBe(false);
  });

  test("đoạn cong làm tầm nhìn ngắn lại, cong gắt ngắn hơn cong thoải", () => {
    const cong = (muc: 1 | 2) => ({
      khuat: [{ id: "k", loai: "cong" as const, muc, s_tu: 8000, s_den: 12_000 }],
      sang: [],
    });
    expect(tamNhinToi(canh, "bien", 11_000)).toBe(TAM_NHIN_BIEN_DEM_CM);
    expect(tamNhinToi(cong(1), "bien", 11_000)).toBe(TAM_NHIN_BIEN_DEM_CM);
    expect(tamNhinToi(cong(2), "bien", 11_000)).toBe(TAM_NHIN_QUA_KHUAT_CM.cong[2]);
    // Đèn cảnh báo sau khúc cua gắt: chỉ thấy khi còn cách đầu khúc cua ít hơn mức tra bảng.
    expect(tamNhinToi(cong(2), "den", 11_000)).toBe(TAM_NHIN_QUA_KHUAT_CM.cong[2]);
    // Biển trước khúc cua không bị che.
    expect(tamNhinToi(cong(2), "bien", 7000)).toBe(TAM_NHIN_BIEN_DEM_CM);
  });

  test("tầm nhìn đơn điệu: đã thấy thì tiến gần vẫn thấy", () => {
    const k = {
      khuat: [{ id: "k", loai: "doc" as const, muc: 2 as const, s_tu: 5000, s_den: 6000 }],
      sang: [{ s: 9000 }],
    };
    let daThay = false;
    for (let s = 0; s <= 9000; s += 50) {
      const t = thayDuoc(k, "coc", s, 9000);
      if (daThay) expect(t).toBe(true);
      daThay ||= t;
    }
    expect(daThay).toBe(true);
  });
});

describe("vật cản tạm", () => {
  test("cọc chiếm làn: xe sang làn trống bên cạnh, phát chuyen_lan, không va chạm", () => {
    const tt = chayDenHet(
      dungMoPhong({
        lan: HAI_LAN,
        dac_diem: [],
        bien: [],
        xe: [xe("a", "L2")],
        vat_can: [coc("c1", "L2", 15_000)],
      }),
    );
    const sk = tt.su_kien.filter((s) => s.loai === "chuyen_lan");
    expect(sk).toHaveLength(1);
    expect(sk[0]!.vat).toBe("c1");
    expect(tt.xe[0]!.lan).toBe("L1");
    expect(tt.xe[0]!.trang_thai).toBe("da_qua");
    expect(tt.su_kien.some((s) => s.loai === "va_cham")).toBe(false);
  });

  test("không có làn tránh: xe dừng trước cọc chờ; làn tránh kín xe thì xe chờ tới khi có khoảng trống", () => {
    const dung = chay({
      lan: HAI_LAN,
      dac_diem: [],
      bien: [],
      xe: [xe("a", "L2")],
      vat_can: [coc("c1", "L2", 15_000, null)],
    });
    const a = dung.xe[0]!;
    expect(a.v).toBe(0);
    expect(a.lan).toBe("L2");
    expect(a.s).toBeLessThan(15_000 * 10);
    expect(a.s).toBeGreaterThan(14_000 * 10);

    // Dòng xe dày trên làn trái: xe làn phải phải chờ, sang được sau khi dòng xe qua.
    const tt = chay({
      lan: HAI_LAN,
      dac_diem: [],
      bien: [],
      xe: [xe("b", "L2"), ...Array.from({ length: 8 }, (_, i) => xe(`t${i}`, "L1", i * 12))],
      vat_can: [coc("c1", "L2", 6000)],
    });
    const b = tt.xe.find((x) => x.id === "b")!;
    const doi = tt.su_kien.find((s) => s.loai === "chuyen_lan" && s.xe === "b")!;
    expect(doi).toBeTruthy();
    expect(b.lan).toBe("L1");
    expect(tt.su_kien.some((s) => s.loai === "va_cham")).toBe(false);
  });

  test("xe đỗ chiếm làn ở giữa đường cũng làm xe sang làn; cấu hình trỏ làn tránh không có thì ném lỗi", () => {
    const tt = chayDenHet(
      dungMoPhong({
        lan: HAI_LAN,
        dac_diem: [],
        bien: [],
        xe: [xe("a", "L1")],
        vat_can: [{ id: "xtt", loai: "xe_do", lan: "L1", s_tu: 20_000, s_den: 20_500, lan_tranh: "L2" }],
      }),
    );
    expect(tt.xe[0]!.lan).toBe("L2");
    expect(() =>
      dungMoPhong({ lan: HAI_LAN, dac_diem: [], bien: [], xe: [], vat_can: [coc("c", "L1", 100, "L9")] }),
    ).toThrow("L9");
  });
});

describe("ban đêm: đèn cảnh báo, vùng chốt, phanh gấp", () => {
  /** Chốt ở 200 m trên làn phải; cọc từ 180 m. */
  const chot = (canh_bao: NonNullable<CauHinhMoPhong["dem"]>["canh_bao"]): CauHinhMoPhong => ({
    lan: HAI_LAN,
    dac_diem: [],
    bien: [],
    xe: [xe("a", "L1")],
    vat_can: [coc("c1", "L2", 18_000)],
    dem: { canh_bao, khuat: [], vung_chot: { s_tu: 18_000, s_den: 21_000 } },
  });
  const phanhGap = (ch: CauHinhMoPhong) => chay(ch).su_kien.filter((s) => s.loai === "phanh_gap");

  test("không có vật cảnh báo: xe chỉ thấy vùng chốt khi đã gần, phải phanh gấp", () => {
    const pg = phanhGap(chot([]));
    expect(pg).toHaveLength(1);
    expect(pg[0]!.vat).toBe("vung_chot");
  });

  test("xe thấy đèn cảnh báo trong tầm nhìn thì giảm tốc sớm, không phanh gấp, qua chốt không quá tốc độ chậm", () => {
    const ch = chot([{ id: "den", loai: "den", s: 17_900 }]);
    expect(phanhGap(ch)).toEqual([]);
    const mp = dungMoPhong(ch);
    let tt = trangThaiDau(mp);
    let vTrongChot = 0;
    while (!tt.xong && tt.nhip < 1200) {
      tt = buocMoPhong(mp, tt);
      const a = tt.xe[0]!;
      if (a.s >= 18_000 * 10 && a.s <= 21_000 * 10) vTrongChot = Math.max(vTrongChot, a.v);
    }
    expect(vTrongChot).toBeGreaterThan(0);
    // Lệch tối đa vài mm/nhịp do làm tròn ở nhịp vừa vào vùng chốt.
    expect(vTrongChot).toBeLessThanOrEqual(TOC_DO_CHAM + 5);
  });

  test("biển tạm đặt sát chốt không cứu được xe chạy quá tốc độ; biển xa thì được", () => {
    const nhanh = (s: number): CauHinhMoPhong => ({
      ...chot([{ id: "b", loai: "bien", s }]),
      xe: [xe("a", "L1", 0, 1000)],
    });
    expect(phanhGap(nhanh(17_000)).length).toBe(1);
    expect(phanhGap(nhanh(8000))).toEqual([]);
  });

  test("đèn cảnh báo sau khúc cua gắt bị che: xe vẫn phanh gấp", () => {
    const ch = chot([{ id: "den", loai: "den", s: 17_900 }]);
    const coCong: CauHinhMoPhong = {
      ...ch,
      dem: { ...ch.dem!, khuat: [{ id: "k", loai: "cong", muc: 2, s_tu: 12_000, s_den: 17_900 }] },
    };
    expect(phanhGap(coCong).length).toBe(1);
  });
});

describe("vùng nguy hiểm quanh người, hàng chờ", () => {
  test("xe đi sát người thì phát vao_vung_nguy_hiem một lần; người ở xa thì không", () => {
    const tt = chayDenHet(
      dungMoPhong({
        lan: HAI_LAN,
        dac_diem: [],
        bien: [],
        xe: [xe("a", "L2"), xe("b", "L1")],
        nguoi: [
          { id: "gan", x: 175 + 90 + BAN_KINH_VUNG_NGUY_HIEM_CM - 10, y: 10_000 },
          { id: "xa", x: 175 + 90 + BAN_KINH_VUNG_NGUY_HIEM_CM + 10, y: 10_000 },
        ],
      }),
    );
    const vv = tt.su_kien.filter((s) => s.loai === "vao_vung_nguy_hiem");
    expect(vv.map((s) => `${s.xe}>${s.nguoi}`)).toEqual(["a>gan"]);
  });

  test("hộp bao chạm vùng tính theo khoảng cách tới mép hộp", () => {
    const h = hopBao({ x: 0, y: 1000, huong: 0, loai: "o_to" });
    const mep = KICH_THUOC_XE.o_to.rong / 2;
    expect(trongVungNguyHiem(h, { x: mep + BAN_KINH_VUNG_NGUY_HIEM_CM - 1, y: 1200 })).toBe(true);
    expect(trongVungNguyHiem(h, { x: mep + BAN_KINH_VUNG_NGUY_HIEM_CM, y: 1200 })).toBe(false);
  });

  test("hàng chờ: xe chậm nối đuôi nhau trên một làn; xe chạy nhanh hoặc cách xa không tính", () => {
    const x = (lan: string, s: number, v = 0) => ({
      lan,
      s: s * 10,
      v,
      loai: "o_to" as const,
      trang_thai: "chay" as const,
    });
    // Ba xe đứng cách nhau 6 m (đuôi tới đầu 1,5 m): dài 450 + 600 + 600 cm.
    expect(doHangCho([x("L1", 10_000), x("L1", 9400), x("L1", 8800)])).toBe(1650);
    // Xe thứ ba cách quá 15 m: hàng tách đôi, lấy hàng dài nhất.
    expect(doHangCho([x("L1", 10_000), x("L1", 9400), x("L1", 5000)])).toBe(1050);
    expect(doHangCho([x("L1", 10_000, 700)])).toBe(0);
    expect(doHangCho([])).toBe(0);
  });
});

describe("tất định, không làm hỏng cấu hình cũ", () => {
  const ch: CauHinhMoPhong = {
    lan: HAI_LAN,
    dac_diem: [],
    bien: [],
    xe: [xe("a", "L2"), xe("b", "L2", 30), xe("c", "L1", 10, 1000), { ...xe("d", "L2", 40), s_vao: 12_000 }],
    vat_can: [coc("c1", "L2", 16_000), coc("c2", "L2", 16_500)],
    nguoi: [{ id: "cs", x: 175, y: 30 * 1000 - 17_500 }],
    dem: {
      canh_bao: [{ id: "den", loai: "den", s: 15_900 }],
      khuat: [{ id: "k", loai: "doc", muc: 1, s_tu: 10_000, s_den: 14_000 }],
      vung_chot: { s_tu: 16_000, s_den: 18_000 },
    },
  };

  test("cùng cấu hình, cùng băm trạng thái cuối", () => {
    const a = chayDenHet(dungMoPhong(ch));
    const b = chayDenHet(dungMoPhong(structuredClone(ch)));
    expect(bamTrangThai(a)).toBe(bamTrangThai(b));
    expect(a.su_kien.length).toBeGreaterThan(0);
  });

  test("xe vào giữa làn (từ đường ngang) bắt đầu ở s_vao, tốc độ chậm", () => {
    const mp = dungMoPhong(ch);
    let tt = trangThaiDau(mp);
    expect(tt.xe.find((x) => x.id === "d")!.s).toBe(120_000);
    while (tt.xe.find((x) => x.id === "d")!.trang_thai === "cho") tt = buocMoPhong(mp, tt);
    expect(tt.xe.find((x) => x.id === "d")!.v).toBeLessThanOrEqual(TOC_DO_CHAM);
  });

  test("cấu hình trống phần mở rộng thì trạng thái giống hệt cấu hình không có trường mới", () => {
    const cu: CauHinhMoPhong = {
      lan: HAI_LAN,
      dac_diem: [],
      bien: [],
      xe: [xe("a", "L2"), xe("b", "L1", 20)],
    };
    const moi: CauHinhMoPhong = { ...cu, vat_can: [], nguoi: [] };
    expect(bamTrangThai(chayDenHet(dungMoPhong(moi)))).toBe(bamTrangThai(chayDenHet(dungMoPhong(cu))));
  });

  test("tệp mở rộng không gọi Math.sin, Math.cos, Math.random, Date.now", () => {
    const goc = join(import.meta.dir, "..", "src");
    for (const f of ["mo-phong/tam-nhin.ts", "mo-phong/vat-can.ts", "tro-choi/chot-dem.ts"]) {
      const ma = readFileSync(join(goc, f), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect({
        f,
        cam: ma.match(/Math\.(sin|cos|tan|atan2?|random|hypot)\s*\(|Date\.now\s*\(|new Date\s*\(/g),
      }).toEqual({
        f,
        cam: null,
      });
    }
  });
});
