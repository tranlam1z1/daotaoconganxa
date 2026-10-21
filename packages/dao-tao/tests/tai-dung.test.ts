/**
 * Kiểm thử trò "Tái dựng hiện trường" (docs/PLAN.md GĐ-T10): kiểm vụ, dựng lại bản dựng từ nhật ký, độ khớp
 * dấu vết, kết luận, số lần mô phỏng, chống dò, ca gian lận, đề không có đáp án.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type BuocTaiDung,
  type ChiTietTaiDung,
  chamKetLuan,
  chayTaiDung,
  type DapAnTaiDung,
  DIEM_KET_LUAN,
  DIEM_KHOP_TOI_DA,
  DIEM_TOI_DA_TAI_DUNG,
  diemSoLanMoPhong,
  doKhopDauVet,
  kiemTraVuTaiDung,
  NGUONG_VI_TRI_CM,
  type NguonTaiDung,
  type PayloadTaiDung,
  SO_LAN_MO_PHONG_TOI_DA,
  TRO_CHOI_TAI_DUNG,
} from "../src/index.ts";
import type { DauVet } from "../src/mo-phong/va-cham.ts";

const DEMO = (
  (await Bun.file(join(import.meta.dir, "..", "..", "..", "data", "tro-choi", "tai-dung.json")).json()) as {
    vu: Array<{ ma: string; payload: PayloadTaiDung; answer: DapAnTaiDung }>;
  }
).vu;

const nguon = (v: (typeof DEMO)[number]): NguonTaiDung => ({
  id: v.ma,
  code: v.ma,
  version: 1,
  topic_id: null,
  vu: v.payload,
  dap_an: v.answer,
  muc_phat: {},
});
const buocCua = (v: (typeof DEMO)[number]) =>
  TRO_CHOI_TAI_DUNG.taoLuot([nguon(v)], () => 0, v.payload.muc)[0]!;

/** Nhật ký dựng đúng dựng cảnh gốc, mô phỏng `soLan` lần, gắn các thẻ `the`. */
function nhatKy(
  da: DapAnTaiDung,
  soLan = 1,
  the = da.loi.map((l) => ({ xe: l.xe, loi: l.loi })),
  tong?: number,
) {
  const thao_tac: unknown[] = [];
  let nhip = 0;
  for (const d of da.dung_canh) {
    thao_tac.push({ nhip: nhip++, thao_tac: "dat", tham_so: { xe: d.xe, x: d.x, y: d.y } });
    thao_tac.push({ nhip: nhip++, thao_tac: "xoay", tham_so: { xe: d.xe, huong: d.huong } });
    thao_tac.push({ nhip: nhip++, thao_tac: "toc_do", tham_so: { xe: d.xe, muc: d.muc } });
    thao_tac.push({ nhip: nhip++, thao_tac: "hanh_dong", tham_so: { xe: d.xe, hd: d.hanh_dong } });
  }
  for (let i = 0; i < soLan; i++) thao_tac.push({ nhip: nhip++, thao_tac: "mo_phong", tham_so: null });
  for (const t of the) thao_tac.push({ nhip: nhip++, thao_tac: "gan_loi", tham_so: t });
  return { thao_tac, tong_nhip: tong ?? nhip };
}

function cham(b: ReturnType<typeof buocCua>, raw: unknown, thoiGianMs: number | null = null) {
  const tl = TRO_CHOI_TAI_DUNG.docTraLoi(raw);
  expect(tl).not.toBeNull();
  const kq = TRO_CHOI_TAI_DUNG.chamBuoc(b, tl!, { thoiGianMs, offline: thoiGianMs === null });
  return { ...kq, ct: kq.chiTiet as ChiTietTaiDung };
}

describe("Vụ demo", () => {
  test("có đủ 5 vụ, mỗi màn một vụ, mọi vụ hợp lệ", () => {
    expect(DEMO.length).toBeGreaterThanOrEqual(5);
    expect(new Set(DEMO.map((v) => v.payload.muc))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const v of DEMO) expect(kiemTraVuTaiDung(v.payload, v.answer)).toEqual([]);
    for (const v of DEMO) expect(v.payload.xe.length).toBeGreaterThan(0);
  });
});

describe("Kiểm vụ", () => {
  const goc = DEMO.find((v) => v.payload.muc === 2)!;
  const loiCua = (p: PayloadTaiDung, da: DapAnTaiDung) =>
    kiemTraVuTaiDung(p, da)
      .map((l) => l.loi)
      .join(" | ");

  test("dựng cảnh gốc không sinh va chạm thì bị báo lỗi", () => {
    const da = structuredClone(goc.answer);
    // Xe sau đi chậm, phanh: không bao giờ tới xe trước. Xe trước cũng phanh.
    da.dung_canh = da.dung_canh.map((d) => ({ ...d, muc: 0, hanh_dong: "phanh" }));
    expect(loiCua(goc.payload, da)).toContain("không sinh va chạm");
  });

  test("lỗi đúng không có mã mức phạt thì bị báo lỗi", () => {
    const da = structuredClone(goc.answer);
    (da.loi[0] as any).ma_muc_phat = null;
    expect(loiCua(goc.payload, da)).toContain("thiếu mã mức phạt");
    da.loi[0]!.ma_muc_phat = "";
    expect(loiCua(goc.payload, da)).toContain("thiếu mã mức phạt");
  });

  test("xe chồng nhau lúc đầu, xe chạy ra khỏi sơ đồ, thiếu vị trí, lỗi trỏ xe không có: báo đúng phần tử", () => {
    const da = structuredClone(goc.answer);
    da.dung_canh[1] = { ...da.dung_canh[0]!, xe: da.dung_canh[1]!.xe, y: da.dung_canh[0]!.y - 2 };
    expect(kiemTraVuTaiDung(goc.payload, da).some((l) => l.loi.includes("chồng lên nhau"))).toBe(true);

    const ra = structuredClone(goc.answer);
    ra.dung_canh = ra.dung_canh.map((d) => ({
      ...d,
      x: d.xe === "A" ? 4 : 16,
      muc: 3,
      hanh_dong: "di_thang",
    }));
    expect(loiCua(goc.payload, ra)).toMatch(/không sinh va chạm|ra khỏi sơ đồ/);

    const thieu = structuredClone(goc.answer);
    thieu.dung_canh.pop();
    expect(kiemTraVuTaiDung(goc.payload, thieu).some((l) => l.phan_tu.startsWith("xe:"))).toBe(true);

    const loiXe = structuredClone(goc.answer);
    loiXe.loi[0]!.xe = "Z";
    expect(kiemTraVuTaiDung(goc.payload, loiXe).map((l) => l.phan_tu)).toContain("loi:0");
  });

  test("đặc trưng màn: màn 1 một xe đâm vật; màn 3 cần đèn; màn 5 cần hai lời kể", () => {
    const m1 = DEMO.find((v) => v.payload.muc === 1)!;
    expect(
      loiCua({ ...m1.payload, xe: [...m1.payload.xe, { id: "B", loai: "o_to", nhan: "Xe B" }] }, m1.answer),
    ).toContain("Màn 1 chỉ có một xe");
    const m3 = DEMO.find((v) => v.payload.muc === 3)!;
    expect(loiCua({ ...m3.payload, so_do: { ...m3.payload.so_do, den: [] } }, m3.answer)).toContain(
      "đèn tín hiệu",
    );
    const m5 = DEMO.find((v) => v.payload.muc === 5)!;
    expect(loiCua({ ...m5.payload, loi_ke: m5.payload.loi_ke.slice(0, 1) }, m5.answer)).toContain("hai bên");
  });
});

describe("Chấm", () => {
  test("dựng đúng cảnh gốc, kết luận đúng, mô phỏng 1 lần: đủ 100 điểm, đủ 50 điểm khớp", () => {
    for (const v of DEMO) {
      const b = buocCua(v);
      const kq = cham(b, nhatKy(v.answer));
      expect(kq.ct.khop.diem).toBe(DIEM_KHOP_TOI_DA);
      expect(kq.ct.ket_luan.diem).toBe(DIEM_KET_LUAN);
      expect(kq.diem).toBe(DIEM_TOI_DA_TAI_DUNG);
      expect(kq.dung).toBe(true);
      expect(kq.ct.bam).toBe(chayTaiDung(v.payload, kq.ct.dung_canh_goc).bam);
    }
  });

  test("lệch vị trí cuối tăng dần thì điểm khớp giảm đơn điệu, tới 0 ở ngưỡng", () => {
    const v = DEMO.find((x) => x.payload.muc === 2)!;
    const goc = buocCua(v).noi_dung.dau_vet;
    const lech = (d: number): DauVet => ({
      ...goc,
      cuoi: goc.cuoi.map((c, i) => (i === 0 ? { ...c, x: c.x + d } : c)),
    });
    let truoc = doKhopDauVet(goc, goc).diem;
    expect(truoc).toBe(DIEM_KHOP_TOI_DA);
    for (let d = 100; d <= NGUONG_VI_TRI_CM + 200; d += 100) {
      const k = doKhopDauVet(goc, lech(d));
      if (d <= NGUONG_VI_TRI_CM) expect(k.diem).toBeLessThan(truoc);
      else expect(k.diem).toBe(truoc);
      truoc = k.diem;
    }
    expect(doKhopDauVet(goc, lech(NGUONG_VI_TRI_CM)).theo_xe[0]!.vi_tri).toBe(0);
  });

  test("dựng sai tốc độ thì dấu vết lệch, điểm khớp thấp hơn", () => {
    const v = DEMO.find((x) => x.payload.muc === 1)!;
    const b = buocCua(v);
    const da = structuredClone(v.answer);
    da.dung_canh[0]!.muc = 1;
    const kq = cham(b, nhatKy(da));
    expect(kq.ct.khop.diem).toBeLessThan(DIEM_KHOP_TOI_DA / 2);
    expect(kq.dung).toBe(false);
  });

  test("số lần mô phỏng: 1–3 lần 10, 4–6 lần 5, 0 hoặc hơn 6 lần 0; tính đúng từ nhật ký", () => {
    expect([0, 1, 3, 4, 6, 7, 20].map(diemSoLanMoPhong)).toEqual([0, 10, 10, 5, 5, 0, 0]);
    const v = DEMO[0]!;
    const b = buocCua(v);
    for (const [n, d] of [
      [0, 90],
      [3, 100],
      [5, 95],
      [SO_LAN_MO_PHONG_TOI_DA, 90],
    ] as const) {
      const kq = cham(b, nhatKy(v.answer, n));
      expect(kq.ct.so_lan_mo_phong).toBe(n);
      expect(kq.diem).toBe(d);
    }
  });

  test("mô phỏng lần thứ 21 trong nhật ký: từ chối cả nhật ký (chống dò)", () => {
    const v = DEMO[0]!;
    expect(TRO_CHOI_TAI_DUNG.docTraLoi(nhatKy(v.answer, SO_LAN_MO_PHONG_TOI_DA + 1))).toBeNull();
    expect(TRO_CHOI_TAI_DUNG.docTraLoi(nhatKy(v.answer, SO_LAN_MO_PHONG_TOI_DA))).not.toBeNull();
  });

  test("kết luận: đúng xe sai lỗi được nửa trừ thẻ sai; sai xe 0; hai lỗi chia đều; điểm không âm", () => {
    expect(chamKetLuan([{ xe: "A", loi: "qua_toc_do" }], [{ xe: "A", loi: "qua_toc_do" }]).diem).toBe(40);
    expect(chamKetLuan([{ xe: "A", loi: "qua_toc_do" }], [{ xe: "A", loi: "vuot_den_do" }]).diem).toBe(10);
    expect(chamKetLuan([{ xe: "A", loi: "qua_toc_do" }], [{ xe: "B", loi: "qua_toc_do" }]).diem).toBe(0);
    expect(chamKetLuan([{ xe: "A", loi: "qua_toc_do" }], []).diem).toBe(0);
    const hai = [
      { xe: "A", loi: "khong_nhuong_duong" },
      { xe: "B", loi: "qua_toc_do" },
    ] as const;
    expect(chamKetLuan(hai, [hai[1]]).diem).toBe(20);
    expect(chamKetLuan(hai, [...hai, { xe: "A", loi: "vuot_den_do" }]).diem).toBe(30);
  });

  test("gian lận: điểm, cờ đúng máy khách gửi bị bỏ qua; thao tác sai: cả bước 0 điểm", () => {
    const v = DEMO[1]!;
    const b = buocCua(v);
    const sai = structuredClone(v.answer);
    sai.dung_canh[0]!.y -= 8;
    const kq = cham(b, { ...nhatKy(sai, 1, []), diem: 100, dung: true, khop: 50 });
    expect(kq.diem).toBeLessThan(60);
    expect(kq.ct.ket_luan.diem).toBe(0);

    // Đặt xe ngoài sơ đồ.
    const ngoai = nhatKy(v.answer);
    (ngoai.thao_tac[0] as any).tham_so.x = v.payload.so_do.rong_m + 1;
    const k1 = cham(b, ngoai);
    expect(k1.diem).toBe(0);
    expect(k1.ct.ly_do).toContain("ngoài sơ đồ");

    // Gắn quá 3 thẻ.
    const nhieu = nhatKy(v.answer, 1, [
      { xe: "A", loi: "qua_toc_do" },
      { xe: "A", loi: "vuot_den_do" },
      { xe: "B", loi: "qua_toc_do" },
      { xe: "B", loi: "vuot_den_do" },
    ]);
    expect(cham(b, nhieu).diem).toBe(0);

    // Xe không có trong vụ; gỡ thẻ chưa gắn.
    const la = nhatKy(v.answer);
    la.thao_tac.push({ nhip: la.tong_nhip, thao_tac: "xoay", tham_so: { xe: "Z", huong: 1 } });
    expect(cham(b, la).diem).toBe(0);
    const go = nhatKy(v.answer, 1, []);
    go.thao_tac.push({ nhip: go.tong_nhip, thao_tac: "go_loi", tham_so: { xe: "A", loi: "qua_toc_do" } });
    expect(cham(b, go).diem).toBe(0);
  });

  test("mốc thời gian sai: nhật ký dài hơn đồng hồ máy chủ thì 0 điểm", () => {
    const v = DEMO[0]!;
    const kq = cham(buocCua(v), nhatKy(v.answer, 1, undefined, 2000), 1000);
    expect(kq.diem).toBe(0);
    expect(kq.ct.ly_do).toBe("Nhật ký không khớp đồng hồ máy chủ.");
  });

  test("xe chưa đặt không vào mô phỏng và được 0 ở phần khớp của xe đó", () => {
    const v = DEMO[1]!;
    const da = structuredClone(v.answer);
    da.dung_canh = da.dung_canh.slice(0, 1);
    const kq = cham(buocCua(v), nhatKy(da));
    expect(Object.keys(kq.ct.dung_canh)).toHaveLength(1);
    expect(kq.ct.khop.theo_xe.find((x) => x.xe === v.answer.dung_canh[1]!.xe)!.lech_vi_tri_cm).toBeNull();
  });

  test("nhật ký sai dạng bị từ chối", () => {
    const doc = TRO_CHOI_TAI_DUNG.docTraLoi;
    expect(
      doc({ thao_tac: [{ nhip: 0, thao_tac: "dat", tham_so: { xe: "A", x: 1.5, y: 2 } }], tong_nhip: 1 }),
    ).toBeNull();
    expect(
      doc({ thao_tac: [{ nhip: 0, thao_tac: "xoay", tham_so: { xe: "A", huong: 8 } }], tong_nhip: 1 }),
    ).toBeNull();
    expect(
      doc({
        thao_tac: [{ nhip: 0, thao_tac: "gan_loi", tham_so: { xe: "A", loi: "say_ruou" } }],
        tong_nhip: 1,
      }),
    ).toBeNull();
    expect(
      doc({ thao_tac: [{ nhip: 0, thao_tac: "mo_phong", tham_so: { xe: "A" } }], tong_nhip: 1 }),
    ).toBeNull();
  });
});

describe("Đề", () => {
  test("đề có sơ đồ, dấu vết, thẻ lỗi; không có dựng cảnh gốc, lỗi đúng, mã mức phạt", () => {
    const CAM = ["dung_canh", "loi", "ma_muc_phat", "dap_an", "giai_thich", "bien_ban", "answer"];
    const coKhoa = (v: unknown): string | null => {
      if (Array.isArray(v)) return v.map(coKhoa).find(Boolean) ?? null;
      if (v && typeof v === "object")
        for (const [k, x] of Object.entries(v)) {
          if (CAM.includes(k)) return k;
          const c = coKhoa(x);
          if (c) return c;
        }
      return null;
    };
    for (const v of DEMO) {
      const b = buocCua(v) as { noi_dung: BuocTaiDung };
      const de = TRO_CHOI_TAI_DUNG.deChoNguoiChoi(b as any);
      expect(coKhoa(de)).toBeNull();
      expect(de.dau_vet.cuoi).toHaveLength(v.payload.xe.length);
      expect(de.the_loi.length).toBe(6);
      expect(de.ghi_chu).toContain("không phải phương pháp giám định");
      expect(JSON.stringify(de)).not.toContain('"hanh_dong"');
    }
  });

  test("chấm một bước dưới 200 ms", () => {
    const v = DEMO[4]!;
    const b = buocCua(v);
    const tl = TRO_CHOI_TAI_DUNG.docTraLoi(nhatKy(v.answer, 3))!;
    const t = performance.now();
    TRO_CHOI_TAI_DUNG.chamBuoc(b, tl, { thoiGianMs: 60_000, offline: false });
    expect(performance.now() - t).toBeLessThan(200);
  });
});
