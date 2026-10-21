/**
 * Trò "Cung đường biển báo" (docs/PLAN.md GĐ-G8): chấm nhật ký đường chạy, sinh chuỗi biển, câu
 * khởi động, và kiểm tệp dữ liệu biển báo thật (đủ biển có phản ứng).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { type BienBao, kiemTraBienBao, THAO_TAC_BIEN_BAO } from "../src/bien-bao.ts";
import { taoRng } from "../src/de-thi.ts";
import {
  type BienPhanUng,
  type BienTrenDuong,
  type BuocCungDuong,
  TRO_CHOI_CUNG_DUONG as CD,
  CUA_SO_THEO_CHANG_MS,
  chamNhatKy,
  DIEM_CAU_KHOI_DONG,
  DIEM_MOI_BIEN,
  nhipDuong,
  SO_BIEN_DUONG,
  SO_CAU_KHOI_DONG,
  SO_MANG,
  type SuKienDuong,
  sinhChuoiBien,
  THUONG_BIEN_TOI_DA,
  thuongBien,
} from "../src/tro-choi/cung-duong-bien-bao.ts";
import { type BuocLuot, chamBuocCoGio } from "../src/tro-choi/khung.ts";

const NHOM = ["cam", "nguy_hiem", "hieu_lenh", "chi_dan"] as const;
const PHAN_UNG = ["khong_vao", "giam_toc", "dung_lai", "di_tiep"] as const;

/** Nguồn giả: 8 biển, đủ 4 thao tác. */
const nguon: BienPhanUng[] = Array.from({ length: 8 }, (_, i) => ({
  ma: `P.1${String(i).padStart(2, "0")}`,
  version: 1,
  nhom: NHOM[i % 4]!,
  ten: `Biển ${i}`,
  y_nghia: `Ý nghĩa ${i}`,
  anh: `b${i}.svg`,
  can_cu: "vn:vbqppl:qcvn:41/2024/BGTVT",
  topic_id: null,
  phan_ung: PHAN_UNG[i % 4]!,
  ghi_chu_phan_ung: `Vì ${i}`,
}));

/** Đường chạy tay: biển i có phản ứng `pu[i]`, nhịp chuẩn. */
function duong(pu: BienTrenDuong["phan_ung"][]) {
  const nhip = nhipDuong(pu.length);
  const bien: BienTrenDuong[] = pu.map((p, i) => ({
    thu_tu: i + 1,
    ma: `X.${i}`,
    ten: `Biển ${i}`,
    anh: "x.svg",
    phan_ung: p,
    ghi_chu: null,
    can_cu: "vn:x",
    ...nhip[i]!,
  }));
  const cuoi = nhip.at(-1)!;
  return { bien, tong_ms: cuoi.hien_ms + cuoi.cua_so_ms + 2000 };
}

/** Bấm thao tác `tt` cho biển `i` (từ 1) sau khi biển hiện `sau` ms. */
const bam = (
  d: ReturnType<typeof duong>,
  i: number,
  tt: SuKienDuong["thao_tac"],
  sau = 500,
): SuKienDuong => ({
  bien: i,
  thao_tac: tt,
  ms: d.bien[i - 1]!.hien_ms + sau,
});

describe("chấm nhật ký đường chạy", () => {
  test("phản ứng đúng trong cửa sổ: +10 và thưởng nhanh theo thời gian", () => {
    const d = duong(["giam_toc", "dung_lai"]);
    const kq = chamNhatKy(
      d,
      { su_kien: [bam(d, 1, "giam_toc", 0), bam(d, 2, "dung_lai", 1500)], tong_ms: d.tong_ms },
      null,
    );
    expect(kq.chiTiet.bien.map((b) => b.ket)).toEqual(["dung", "dung"]);
    expect(kq.diem).toBe(2 * DIEM_MOI_BIEN);
    expect(kq.chiTiet.bien[0]!.thuong).toBe(THUONG_BIEN_TOI_DA);
    expect(kq.chiTiet.bien[1]!.thuong).toBe(thuongBien(1500, CUA_SO_THEO_CHANG_MS[0]));
    expect(kq.thuong).toBeCloseTo(5 + thuongBien(1500, 3000), 5);
    expect(kq.chiTiet.mang_con).toBe(SO_MANG);
  });

  test("ngoài cửa sổ hoặc sai thao tác: mất mạng, 0 điểm", () => {
    const d = duong(["giam_toc", "dung_lai", "khong_vao"]);
    const tre = { bien: 1, thao_tac: "giam_toc" as const, ms: d.bien[0]!.hien_ms + d.bien[0]!.cua_so_ms + 1 };
    const kq = chamNhatKy(d, { su_kien: [tre, bam(d, 2, "giam_toc")], tong_ms: d.tong_ms }, null);
    expect(kq.chiTiet.bien.map((b) => b.ket)).toEqual(["bo_lo", "sai", "bo_lo"]);
    expect(kq.diem).toBe(0);
    expect(kq.chiTiet.mang_con).toBe(0);
  });

  test("thao tác đầu tiên trong cửa sổ mới tính, bấm lại không sửa được", () => {
    const d = duong(["dung_lai"]);
    const kq = chamNhatKy(
      d,
      { su_kien: [bam(d, 1, "di_tiep", 300), bam(d, 1, "dung_lai", 600)], tong_ms: d.tong_ms },
      null,
    );
    expect(kq.chiTiet.bien[0]!.ket).toBe("sai");
  });

  test("biển không cần phản ứng: thận trọng hay bỏ qua không mất mạng; 'không vào' là sai", () => {
    const d = duong(["di_tiep", "di_tiep", "di_tiep", "di_tiep"]);
    const kq = chamNhatKy(
      d,
      { su_kien: [bam(d, 1, "di_tiep"), bam(d, 2, "giam_toc"), bam(d, 3, "khong_vao")], tong_ms: d.tong_ms },
      null,
    );
    expect(kq.chiTiet.bien.map((b) => b.ket)).toEqual(["dung", "than_trong", "sai", "bo_qua"]);
    expect(kq.chiTiet.bien.map((b) => b.diem)).toEqual([10, 0, 0, 0]);
    expect(kq.chiTiet.mang_con).toBe(SO_MANG - 1);
  });

  test("hết 3 mạng thì các biển sau không tính, kể cả khi bấm đúng", () => {
    const d = duong(["dung_lai", "dung_lai", "dung_lai", "dung_lai", "dung_lai"]);
    const sk = [
      bam(d, 1, "di_tiep"),
      bam(d, 2, "di_tiep"),
      bam(d, 3, "di_tiep"),
      bam(d, 4, "dung_lai"),
      bam(d, 5, "dung_lai"),
    ];
    const kq = chamNhatKy(d, { su_kien: sk, tong_ms: d.tong_ms }, null);
    expect(kq.chiTiet.bien.map((b) => b.ket)).toEqual(["sai", "sai", "sai", "khong_tinh", "khong_tinh"]);
    expect(kq.diem).toBe(0);
    expect(kq.chiTiet.mang_con).toBe(0);
  });

  test("mốc trước khi biển hiện bị loại, không được tính là phản ứng", () => {
    const d = duong(["giam_toc"]);
    const som = { bien: 1, thao_tac: "giam_toc" as const, ms: d.bien[0]!.hien_ms - 10 };
    const kq = chamNhatKy(d, { su_kien: [som], tong_ms: d.tong_ms }, null);
    expect(kq.chiTiet.moc_bi_loai).toBe(1);
    expect(kq.chiTiet.bien[0]!.ket).toBe("bo_lo");
  });

  test("đường chạy dừng giữa chừng: biển chưa tới không tính, không mất mạng", () => {
    const d = duong(["giam_toc", "giam_toc", "giam_toc"]);
    const dung = d.bien[1]!.hien_ms + 100;
    const kq = chamNhatKy(d, { su_kien: [bam(d, 1, "giam_toc", 0)], tong_ms: dung }, null);
    expect(kq.chiTiet.bien.map((b) => b.ket)).toEqual(["dung", "khong_tinh", "khong_tinh"]);
    expect(kq.chiTiet.mang_con).toBe(SO_MANG);
  });

  test("tổng thời gian lệch quá 10% so với đồng hồ máy chủ: cả bước 0 điểm", () => {
    // Đường đủ 12 biển (khoảng 64 giây) để 10% lớn hơn dung sai mạng 2 giây.
    const d = duong(Array(SO_BIEN_DUONG).fill("giam_toc"));
    const tl = { su_kien: d.bien.map((b) => bam(d, b.thu_tu, "giam_toc")), tong_ms: d.tong_ms };
    // Máy chủ đo được ít hơn 20%: nhật ký không thể dài như vậy.
    const lech = chamNhatKy(d, tl, Math.round(d.tong_ms * 0.8));
    expect(lech.chiTiet.hop_le).toBe(false);
    expect(lech.diem).toBe(0);
    // Máy chủ đo lâu hơn (người chơi chờ trước khi xuất phát): hợp lệ.
    expect(chamNhatKy(d, tl, d.tong_ms + 30_000).chiTiet.hop_le).toBe(true);
    // Lệch trong 10% cộng dung sai mạng: hợp lệ.
    expect(chamNhatKy(d, tl, Math.round(d.tong_ms * 0.93)).chiTiet.hop_le).toBe(true);
  });

  test("mốc sau lúc kết thúc, hoặc nhật ký dài hơn cả đường: không hợp lệ", () => {
    const d = duong(["giam_toc"]);
    expect(chamNhatKy(d, { su_kien: [bam(d, 1, "giam_toc")], tong_ms: 100 }, null).chiTiet.hop_le).toBe(
      false,
    );
    expect(chamNhatKy(d, { su_kien: [], tong_ms: d.tong_ms + 60_000 }, null).chiTiet.hop_le).toBe(false);
  });
});

describe("sinh lượt", () => {
  test("cùng seed cùng lượt; 3 câu khởi động rồi đường chạy 12 biển", () => {
    const a = CD.taoLuot(nguon, taoRng("s1"));
    const b = CD.taoLuot(nguon, taoRng("s1"));
    expect(a).toEqual(b);
    expect(a.length).toBe(SO_CAU_KHOI_DONG + 1);
    expect(
      a.slice(0, 3).every((x) => x.noi_dung.loai === "doan" && x.diem_toi_da === DIEM_CAU_KHOI_DONG),
    ).toBe(true);
    const d = a[3]!.noi_dung as Extract<BuocCungDuong, { loai: "duong" }>;
    expect(d.bien.length).toBe(SO_BIEN_DUONG);
    expect(a[3]!.diem_toi_da).toBe(SO_BIEN_DUONG * DIEM_MOI_BIEN);
    expect(CD.taoLuot(nguon, taoRng("s2"))).not.toEqual(a);
  });

  test("không hai biển giống nhau liền nhau, kể cả khi nguồn ít phải lặp", () => {
    for (const n of [2, 3, 8]) {
      for (let s = 0; s < 30; s++) {
        const ds = sinhChuoiBien(nguon.slice(0, n), SO_BIEN_DUONG, taoRng(`k${n}-${s}`));
        expect(ds.length).toBe(SO_BIEN_DUONG);
        for (let i = 1; i < ds.length; i++) expect(ds[i]!.ma).not.toBe(ds[i - 1]!.ma);
      }
    }
  });

  test("chỉ dùng biển có phản ứng hợp lệ, không dùng biển phụ", () => {
    const lan = [
      ...nguon,
      { ...nguon[0]!, ma: "S.501", nhom: "phu" as const },
      { ...nguon[0]!, ma: "P.199", phan_ung: "bay" as never },
    ];
    const loc = CD.locNguon(lan) as BienPhanUng[];
    expect(loc.map((b) => b.ma)).toEqual(nguon.map((b) => b.ma));
    const luot = CD.taoLuot(lan, taoRng("x"));
    const d = luot[3]!.noi_dung as Extract<BuocCungDuong, { loai: "duong" }>;
    expect(d.bien.some((b) => b.ma === "S.501" || b.ma === "P.199")).toBe(false);
  });

  test("cửa sổ ngắn dần qua 3 chặng; đề đường chạy không có tên biển, giải thích, căn cứ", () => {
    const luot = CD.taoLuot(nguon, taoRng("c"));
    const nhip = nhipDuong(SO_BIEN_DUONG).map((x) => x.cua_so_ms);
    expect(nhip.slice(0, 4).every((x) => x === 3000)).toBe(true);
    expect(nhip.slice(8).every((x) => x === 2200)).toBe(true);
    const s = JSON.stringify(CD.deChoNguoiChoi(luot[3]!));
    for (const b of nguon) {
      expect(s).not.toContain(b.ten);
      expect(s).not.toContain(b.ghi_chu_phan_ung!);
    }
    expect(s).not.toContain("vn:vbqppl");
    // Câu khởi động: 4 tên phương án, không lộ phương án đúng qua mã.
    const deDoan = CD.deChoNguoiChoi(luot[0]!) as { phuong_an: Array<{ id: string }> };
    expect(deDoan.phuong_an.map((p) => p.id)).toEqual(["0", "1", "2", "3"]);
  });
});

describe("câu khởi động và khung chung", () => {
  const luot = CD.taoLuot(nguon, taoRng("k"));
  const kd = luot[0] as BuocLuot<Extract<BuocCungDuong, { loai: "doan" }>>;
  const dapAn = String(kd.noi_dung.phuong_an.findIndex((p) => p.ma === kd.noi_dung.ma));

  test("chọn đúng tên biển được 5 điểm, sai 0 điểm; không có thưởng nhanh", () => {
    const now = new Date("2026-09-25T02:00:00Z");
    const moLuc = new Date(now.getTime() - 1000);
    const dung = chamBuocCoGio(CD, kd, CD.docTraLoi({ loai: "doan", chon: dapAn })!, {
      moLuc,
      luc: now,
      offline: false,
    });
    expect(dung.diem).toBe(DIEM_CAU_KHOI_DONG);
    expect(dung.thuong).toBe(0);
    const sai = chamBuocCoGio(CD, kd, CD.docTraLoi({ loai: "doan", chon: dapAn === "0" ? "1" : "0" })!, {
      moLuc,
      luc: now,
      offline: false,
    });
    expect(sai.diem).toBe(0);
    // Câu trả lời dạng đường chạy gửi cho bước khởi động: 0 điểm, không lỗi.
    expect(
      chamBuocCoGio(CD, kd, { loai: "duong", su_kien: [], tong_ms: 0 }, { moLuc, luc: now, offline: false })
        .diem,
    ).toBe(0);
  });

  test("thưởng từng biển đi qua khung chung khi online; offline không có thưởng", () => {
    const b = luot[3] as BuocLuot<Extract<BuocCungDuong, { loai: "duong" }>>;
    const sk = b.noi_dung.bien.map((x) => ({ bien: x.thu_tu, thao_tac: x.phan_ung, ms: x.hien_ms + 200 }));
    const tl = CD.docTraLoi({ loai: "duong", su_kien: sk, tong_ms: b.noi_dung.tong_ms })!;
    const now = new Date("2026-09-25T02:10:00Z");
    const moLuc = new Date(now.getTime() - b.noi_dung.tong_ms - 5000);
    const online = chamBuocCoGio(CD, b, tl, { moLuc, luc: now, offline: false });
    expect(online.diem).toBe(b.diem_toi_da);
    expect(online.dung).toBe(true);
    expect(online.thuong).toBeGreaterThan(0);
    const offline = chamBuocCoGio(CD, b, tl, { moLuc: null, luc: now, offline: true });
    expect(offline.diem).toBe(b.diem_toi_da);
    expect(offline.thuong).toBe(0);
    // Online nhưng máy chủ chỉ đo được một nửa thời gian: nhật ký giả, 0 điểm.
    const gia = chamBuocCoGio(CD, b, tl, {
      moLuc: new Date(now.getTime() - b.noi_dung.tong_ms / 2),
      luc: now,
      offline: false,
    });
    expect(gia.diem).toBe(0);
    expect(gia.thuong).toBe(0);
  });

  test("đọc câu trả lời: từ chối thao tác lạ, mốc âm, nhật ký quá dài", () => {
    expect(
      CD.docTraLoi({ loai: "duong", su_kien: [{ bien: 1, thao_tac: "bay", ms: 1 }], tong_ms: 5 }),
    ).toBeNull();
    expect(
      CD.docTraLoi({ loai: "duong", su_kien: [{ bien: 1, thao_tac: "di_tiep", ms: -1 }], tong_ms: 5 }),
    ).toBeNull();
    const nhieu = Array.from({ length: 201 }, () => ({ bien: 1, thao_tac: "di_tiep", ms: 1 }));
    expect(CD.docTraLoi({ loai: "duong", su_kien: nhieu, tong_ms: 5 })).toBeNull();
    expect(CD.docTraLoi({ loai: "khac" })).toBeNull();
  });
});

describe("tệp data/bien-bao/bien-bao.json", async () => {
  const GOC = join(import.meta.dir, "..", "..", "..");
  const ds = ((await Bun.file(join(GOC, "data/bien-bao/bien-bao.json")).json()) as { bien: BienBao[] }).bien;

  test("hợp lệ, ít nhất 30 biển, ít nhất 20 biển có phản ứng phủ 4 nhóm chơi được", () => {
    expect(kiemTraBienBao(ds)).toEqual([]);
    expect(ds.length).toBeGreaterThanOrEqual(30);
    const coPU = ds.filter((b) => b.phan_ung);
    expect(coPU.length).toBeGreaterThanOrEqual(20);
    expect(new Set(coPU.map((b) => b.nhom))).toEqual(new Set(NHOM));
    expect(new Set(coPU.map((b) => b.phan_ung))).toEqual(new Set(THAO_TAC_BIEN_BAO));
  });

  test("mọi biển có phản ứng vẫn là bản nháp, ghi rõ dữ liệu demo chưa duyệt", () => {
    for (const b of ds.filter((x) => x.phan_ung)) {
      expect(b.trang_thai).toBe("nhap");
      expect(b.ghi_chu ?? "").toContain("dữ liệu demo, chưa duyệt");
    }
  });
});
