/**
 * Kiểm thử phần mở rộng M5 của GĐ-T10 (mo-phong/va-cham.ts): vết phanh theo tốc độ và mặt đường, va chạm
 * theo hộp bao, xoay sau va chạm, vị trí cuối, tất định (dựng cảnh gốc chạy lại luôn ra đúng dấu vết).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  buocVaCham,
  type CanhVaCham,
  chayVaCham,
  dauVetCua,
  doDaiVet,
  GIAM_TOC_MAT_DUONG,
  MAT_DUONG,
  type MatDuong,
  type MucTocDo,
  trangThaiDauVaCham,
  type XeDungCanh,
} from "../src/mo-phong/va-cham.ts";
import { bamTrangThai } from "../src/tro-choi/chung/nhat-ky.ts";
import {
  chayTaiDung,
  type DapAnTaiDung,
  dungCanhGoc,
  type PayloadTaiDung,
  TRO_CHOI_TAI_DUNG,
} from "../src/tro-choi/tai-dung.ts";

const xe = (id: string, sua: Partial<XeDungCanh> = {}): XeDungCanh => ({
  id,
  loai: "o_to",
  x: 1200,
  y: 6000,
  huong: 0,
  muc: 1,
  hanh_dong: "di_thang",
  ...sua,
});
const canh = (ds: XeDungCanh[], sua: Partial<CanhVaCham> = {}): CanhVaCham => ({
  rong: 2000,
  cao: 8000,
  mat_duong: "kho",
  vat: [],
  xe: ds,
  ...sua,
});
const vetPhanh = (c: CanhVaCham, id: string) =>
  chayVaCham(c)
    .vet.filter((v) => v.xe === id && v.loai === "phanh")
    .reduce((s, v) => s + doDaiVet(v), 0);

const DEMO = (
  (await Bun.file(join(import.meta.dir, "..", "..", "..", "data", "tro-choi", "tai-dung.json")).json()) as {
    vu: Array<{ ma: string; payload: PayloadTaiDung; answer: DapAnTaiDung }>;
  }
).vu;

describe("Vết phanh", () => {
  test("tốc độ cao hơn thì vết phanh dài hơn, trên mọi mặt đường", () => {
    for (const mat of MAT_DUONG) {
      const dai = ([0, 1, 2, 3] as MucTocDo[]).map((muc) =>
        vetPhanh(canh([xe("A", { muc, hanh_dong: "phanh", y: 7900 })], { mat_duong: mat }), "A"),
      );
      for (let i = 1; i < dai.length; i++) expect(dai[i]!).toBeGreaterThan(dai[i - 1]!);
    }
  });

  test("mặt đường trơn hơn thì vết phanh dài hơn; độ dài gần v²/(2a)", () => {
    const dai = (mat: MatDuong) =>
      vetPhanh(canh([xe("A", { muc: 3, hanh_dong: "phanh", y: 7900 })], { mat_duong: mat }), "A");
    expect(dai("uot")).toBeGreaterThan(dai("kho"));
    expect(dai("soi")).toBeGreaterThan(dai("uot"));
    // 80 km/h ≈ 1111 mm/nhịp; mặt khô 17 mm/nhịp²: v²/(2a) ≈ 36,3 m.
    const v = 1111;
    expect(Math.abs(dai("kho") - (v * v) / (2 * GIAM_TOC_MAT_DUONG.kho) / 10)).toBeLessThan(100);
  });

  test("đi thẳng không phanh thì không có vết, xe chạy ra khỏi sơ đồ", () => {
    const tt = chayVaCham(canh([xe("A", { muc: 2 })]));
    expect(tt.vet).toHaveLength(0);
    expect(tt.xe[0]!.pha).toBe("ra_ngoai");
  });
});

describe("Va chạm", () => {
  test("hai xe không chạm nhau thì không có va chạm", () => {
    // Hai làn song song cách 3,5 m, cùng tốc độ.
    const tt = chayVaCham(canh([xe("A", { x: 1025, muc: 2 }), xe("B", { x: 1375, muc: 2 })]));
    expect(tt.va_cham).toHaveLength(0);
    // Ngược chiều trên hai làn.
    const nguoc = chayVaCham(
      canh([xe("A", { x: 1025, y: 1000, huong: 4, muc: 3 }), xe("B", { x: 1375, y: 7000, muc: 3 })]),
    );
    expect(nguoc.va_cham).toHaveLength(0);
  });

  test("đâm từ phía sau: một va chạm, hai xe dính nhau trượt thêm rồi dừng, không xoay", () => {
    const tt = chayVaCham(
      canh([xe("A", { y: 6000, muc: 2 }), xe("B", { y: 4400, muc: 1, hanh_dong: "phanh" })]),
    );
    expect(tt.va_cham).toHaveLength(1);
    expect(tt.va_cham[0]).toMatchObject({ xe: "A", khac: "B", vat: false });
    for (const x of tt.xe) {
      expect(x.pha).toBe("dung");
      expect(x.huong).toBe(0);
    }
    expect(tt.vet.filter((v) => v.loai === "truot")).toHaveLength(2);
    // Mỗi cặp chỉ va chạm một lần dù hai xe vẫn chồng nhau khi trượt.
    expect(new Set(tt.va_cham.map((e) => `${e.xe}|${e.khac}`)).size).toBe(tt.va_cham.length);
  });

  test("đâm ngang: xe bị đâm xoay một bậc 45° theo chiều chuyển động của xe kia", () => {
    const tt = chayVaCham(
      canh(
        [xe("A", { x: 1800, y: 3175, huong: 2, muc: 1 }), xe("B", { x: 3200, y: 5200, huong: 0, muc: 2 })],
        { rong: 6000, cao: 6000 },
      ),
    );
    expect(tt.va_cham).toHaveLength(1);
    const a = tt.xe.find((x) => x.id === "A")!;
    const b = tt.xe.find((x) => x.id === "B")!;
    // A đi sang đông bị B (đi lên) đâm: xoay ngược chiều kim đồng hồ về 1 (đông bắc); B bị A đẩy sang đông: 1.
    expect(a.huong).toBe(1);
    expect(b.huong).toBe(1);
  });

  test("chạm vật cố định: xe dừng ngay, vết phanh kết thúc ở chỗ chạm", () => {
    const c = canh([xe("A", { y: 6400, muc: 3, hanh_dong: "phanh" })], {
      mat_duong: "uot",
      vat: [{ id: "R1", x1: 1050, y1: 2170, x2: 1350, y2: 2230 }],
    });
    const tt = chayVaCham(c);
    expect(tt.va_cham).toHaveLength(1);
    expect(tt.va_cham[0]).toMatchObject({ xe: "A", khac: "R1", vat: true });
    expect(tt.xe[0]!.pha).toBe("dung");
    const v = tt.vet.find((x) => x.loai === "phanh")!;
    expect(v.den.y).toBe(Math.trunc(tt.xe[0]!.y / 10));
    // Chậm hơn một mức thì dừng trước vật, không va chạm.
    expect(chayVaCham({ ...c, xe: [{ ...c.xe[0]!, muc: 2 }] }).va_cham).toHaveLength(0);
  });
});

describe("Hành động", () => {
  test("rẽ phải từ hướng lên thì kết thúc hướng đông; rẽ trái thì hướng tây", () => {
    const re = (hd: "re_phai" | "re_trai") => {
      const c = canh([xe("A", { x: 3000, y: 5000, muc: 1, hanh_dong: hd })], { rong: 6000, cao: 6000 });
      let tt = trangThaiDauVaCham(c);
      for (let i = 0; i < 60; i++) tt = buocVaCham(c, tt);
      return tt.xe[0]!.huong;
    };
    expect(re("re_phai")).toBe(2);
    expect(re("re_trai")).toBe(6);
  });

  test("chuyển làn phải: lệch ngang một làn rồi trở lại hướng cũ", () => {
    const c = canh([xe("A", { x: 1000, y: 7800, muc: 1, hanh_dong: "chuyen_lan_phai" })]);
    let tt = trangThaiDauVaCham(c);
    for (let i = 0; i < 40; i++) tt = buocVaCham(c, tt);
    const a = tt.xe[0]!;
    expect(a.huong).toBe(0);
    expect(Math.abs(a.x - 10_000 - 3500)).toBeLessThan(50);
  });
});

describe("Tất định", () => {
  test("dựng cảnh gốc của mọi vụ demo chạy lại luôn ra đúng dấu vết đã lưu trong lượt", () => {
    for (const v of DEMO) {
      const nguon = [
        { id: v.ma, code: v.ma, version: 1, topic_id: null, vu: v.payload, dap_an: v.answer, muc_phat: {} },
      ];
      const [b] = TRO_CHOI_TAI_DUNG.taoLuot(nguon, () => 0, v.payload.muc);
      expect(b).toBeTruthy();
      const lai = chayTaiDung(v.payload, dungCanhGoc(v.answer));
      expect(lai.dau_vet).toEqual(b!.noi_dung.dau_vet);
      expect(chayTaiDung(v.payload, dungCanhGoc(v.answer)).bam).toBe(lai.bam);
    }
  });

  test("chạy từng nhịp (như điện thoại) và chạy một lần (như máy chủ) cho cùng băm", () => {
    const c = canh([xe("A", { y: 6000, muc: 2 }), xe("B", { y: 4400, muc: 1, hanh_dong: "phanh" })]);
    const mot = chayVaCham(c);
    let tt = trangThaiDauVaCham(c);
    const ds = [tt];
    while (!tt.xong) {
      tt = buocVaCham(c, tt);
      ds.push(tt);
    }
    // Trạng thái cũ không bị sửa khi bước.
    expect(ds[0]!.xe[0]!.y).toBe(60_000);
    const bam = (s: typeof tt) => bamTrangThai({ xe: s.xe, vet: s.vet, va_cham: s.va_cham, nhip: s.nhip });
    expect(bam(tt)).toBe(bam(mot));
    expect(dauVetCua(tt)).toEqual(dauVetCua(mot));
  });
});
