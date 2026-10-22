/** Mức thành thạo, lịch ôn, kiểm tra bài học và lộ trình. */
import { describe, expect, test } from "bun:test";
import {
  boTreo,
  buocKeTiep,
  capNhatThanhThao,
  chiSoCauHoi,
  chonPhienOn,
  denHan,
  type KhoiNoiDung,
  kiemTraBaiHoc,
  kyNangDaMo,
  locTheoCheDo,
  mucThanhThao,
  onThe,
  thamSoCho,
  theMoi,
  timChuTrinh,
  treoThe,
} from "../src/index.ts";

function khoi(p: Partial<KhoiNoiDung>): KhoiNoiDung {
  return {
    id: crypto.randomUUID(),
    lessonId: "l1",
    ordinal: 1,
    kind: "giang",
    data: { md: "nội dung" },
    citations: [],
    citationHealth: "ok",
    source: "nguoi",
    status: "xuat_ban",
    modes: [],
    ...p,
  } as KhoiNoiDung;
}

describe("kiểm tra bài học", () => {
  test("bài không có thẻ căn cứ nào thì bị chặn xuất bản", () => {
    const kq = kiemTraBaiHoc([khoi({ ordinal: 1 })]);
    expect(kq.dat).toBe(false);
    expect(kq.loi.some((l) => l.ma === "khong_co_can_cu")).toBe(true);
  });

  test("khối căn cứ thiếu viện dẫn là lỗi chặn", () => {
    const kq = kiemTraBaiHoc([
      khoi({ ordinal: 1, kind: "can_cu", data: { urn: "vn:nd:224-2026#dieu-91", nguyen_van: "..." } }),
    ]);
    expect(kq.loi.some((l) => l.ma === "thieu_can_cu")).toBe(true);
  });

  test("bài đủ căn cứ và có chốt lại thì đạt", () => {
    const kq = kiemTraBaiHoc([
      khoi({ ordinal: 1 }),
      khoi({
        ordinal: 2,
        kind: "can_cu",
        data: { urn: "vn:nd:224-2026#dieu-91", nguyen_van: "Điều 91..." },
        citations: ["vn:nd:224-2026#dieu-91"],
      }),
      khoi({ ordinal: 3, kind: "tom_tat", data: { y: ["Ý một", "Ý hai"] } }),
    ]);
    expect(kq.dat).toBe(true);
  });

  test("viện dẫn hỏng chặn xuất bản", () => {
    const kq = kiemTraBaiHoc([
      khoi({
        ordinal: 1,
        kind: "can_cu",
        data: { urn: "x", nguyen_van: "y" },
        citations: ["x"],
        citationHealth: "broken",
      }),
    ]);
    expect(kq.loi.some((l) => l.ma === "can_cu_hong" && l.muc === "loi")).toBe(true);
  });
});

describe("lọc theo chế độ học", () => {
  const ds = [
    khoi({ ordinal: 1, kind: "giang" }),
    khoi({ ordinal: 2, kind: "can_cu" }),
    khoi({ ordinal: 3, kind: "bang_tra" }),
    khoi({ ordinal: 4, kind: "canh_bao" }),
    khoi({ ordinal: 5, kind: "the_lat" }),
  ];

  test("chế độ nhanh bỏ đoạn giảng nhưng giữ nguyên căn cứ và cảnh báo", () => {
    const ra = locTheoCheDo(ds, "nhanh").map((k) => k.kind);
    expect(ra).not.toContain("giang");
    expect(ra).toContain("can_cu");
    expect(ra).toContain("canh_bao");
  });

  test("chế độ ôn thi chỉ giữ thẻ lật, căn cứ và cảnh báo", () => {
    const ra = locTheoCheDo(ds, "on_thi").map((k) => k.kind);
    expect(ra.sort()).toEqual(["can_cu", "canh_bao", "the_lat"]);
  });
});

describe("mức thành thạo (BKT)", () => {
  test("trả lời đúng liên tiếp thì đạt mức vững", () => {
    let t = { pKnown: 0.1, attempts: 0, correct: 0 };
    for (let i = 0; i < 5; i++) t = capNhatThanhThao(t, true, thamSoCho("dien_khuyet"));
    expect(mucThanhThao(t)).toBe("vung");
  });

  test("câu đúng/sai đoán trúng 50% nên tiến chậm hơn hẳn câu điền khuyết", () => {
    let a = { pKnown: 0.1, attempts: 0, correct: 0 };
    let b = { pKnown: 0.1, attempts: 0, correct: 0 };
    for (let i = 0; i < 3; i++) {
      a = capNhatThanhThao(a, true, thamSoCho("dung_sai"));
      b = capNhatThanhThao(b, true, thamSoCho("dien_khuyet"));
    }
    expect(a.pKnown).toBeLessThan(b.pKnown);
  });

  test("sai nhiều lần thì kết luận là hổng", () => {
    let t = { pKnown: 0.5, attempts: 0, correct: 0 };
    for (let i = 0; i < 4; i++) t = capNhatThanhThao(t, false, thamSoCho("trac_nghiem"));
    expect(mucThanhThao(t)).toBe("hong");
  });
});

describe("bản đồ năng lực", () => {
  const kyNang = [
    { id: "k1", code: "can_bo", name: "Tra cứu", prerequisites: [] },
    { id: "k2", code: "phan_loai", name: "Phân loại", prerequisites: ["can_bo"] },
    { id: "k3", code: "tong_muc", name: "Tổng mức", prerequisites: ["phan_loai"] },
  ];

  test("chưa vững kỹ năng nền thì kỹ năng sau chưa mở", () => {
    const mo = kyNangDaMo(kyNang, new Map([["k1", { pKnown: 0.4, attempts: 3, correct: 1 }]]));
    expect(mo.has("can_bo")).toBe(true);
    expect(mo.has("phan_loai")).toBe(false);
  });

  test("vững kỹ năng nền thì mở kỹ năng kế tiếp", () => {
    const mo = kyNangDaMo(kyNang, new Map([["k1", { pKnown: 0.9, attempts: 5, correct: 5 }]]));
    expect(mo.has("phan_loai")).toBe(true);
    expect(mo.has("tong_muc")).toBe(false);
  });

  test("phát hiện chu trình tiên quyết", () => {
    const vong = timChuTrinh([
      { id: "a", code: "a", name: "A", prerequisites: ["b"] },
      { id: "b", code: "b", name: "B", prerequisites: ["a"] },
    ]);
    expect(vong.sort()).toEqual(["a", "b"]);
    expect(timChuTrinh(kyNang)).toEqual([]);
  });
});

describe("ôn tập giãn cách", () => {
  test("nhớ tốt thì khoảng cách nới theo 1, 3, 7 ngày", () => {
    let t = theMoi("2026-09-01");
    t = onThe(t, 5, "2026-09-01");
    expect(t.dueOn).toBe("2026-09-02");
    t = onThe(t, 5, "2026-09-02");
    expect(t.dueOn).toBe("2026-09-05");
    t = onThe(t, 5, "2026-09-05");
    expect(t.dueOn).toBe("2026-09-12");
  });

  test("quên thì quay về một ngày và đếm thêm một lần sa sút", () => {
    let t = { intervalDays: 16, ease: 2.2, reps: 4, lapses: 0, dueOn: "2026-09-01", suspended: false };
    t = onThe(t, 1, "2026-09-01");
    expect(t.intervalDays).toBe(1);
    expect(t.lapses).toBe(1);
  });

  test("thẻ bị treo vì văn bản đổi thì không bao giờ đến hạn", () => {
    const t = treoThe({ ...theMoi("2026-09-01"), dueOn: "2026-08-01" });
    expect(denHan(t, "2026-09-07")).toBe(false);
    // Bỏ treo thì gặp lại ngay, vì nội dung đã khác.
    expect(denHan(boTreo(t, "2026-09-07"), "2026-09-07")).toBe(true);
  });

  test("phiên ôn ưu tiên thẻ quá hạn lâu nhất", () => {
    const ds = [
      { ...theMoi(), dueOn: "2026-09-05", lapses: 0 },
      { ...theMoi(), dueOn: "2026-09-01", lapses: 3 },
      { ...theMoi(), dueOn: "2026-12-01", lapses: 0 },
    ];
    const chon = chonPhienOn(ds, 10, "2026-09-07");
    expect(chon).toHaveLength(2);
    expect(chon[0]?.dueOn).toBe("2026-09-01");
  });
});

describe("bước kế tiếp", () => {
  const bai = [
    {
      id: "b1",
      slug: "bai-1",
      ordinal: 1,
      title: "Tổng quan",
      estimatedMinutes: 15,
      skills: [],
      status: "xuat_ban",
    },
    {
      id: "b2",
      slug: "bai-2",
      ordinal: 2,
      title: "Phân loại",
      estimatedMinutes: 18,
      skills: [],
      status: "xuat_ban",
    },
  ];

  test("lỗi lặp lại được vá trước mọi việc khác", () => {
    const b = buocKeTiep({
      courseSlug: "dau-tu-cntt",
      bai,
      tienDo: new Map(),
      theOn: [],
      maLoiLapLai: ["nham_chuyen_tiep"],
      thanhThao: new Map(),
    });
    expect(b.loai).toBe("va_loi");
  });

  test("không có gì đặc biệt thì học bài kế tiếp", () => {
    const b = buocKeTiep({
      courseSlug: "dau-tu-cntt",
      bai,
      tienDo: new Map([["b1", { lessonId: "b1", state: "xong", lastBlockOrdinal: 9, secondsSpent: 600 }]]),
      theOn: [],
      maLoiLapLai: [],
      thanhThao: new Map(),
    });
    expect(b.loai).toBe("hoc_bai");
    expect(b.duong_dan).toContain("bai-2");
  });

  test("hết bài, hết thẻ vẫn có việc để làm — không bao giờ trả màn hình trống", () => {
    const b = buocKeTiep({
      courseSlug: "x",
      bai: [],
      tienDo: new Map(),
      theOn: [],
      maLoiLapLai: [],
      thanhThao: new Map(),
    });
    expect(b.loai).toBe("xem_ho_so");
    expect(b.nhan.length).toBeGreaterThan(0);
  });
});

describe("chỉ số câu hỏi", () => {
  test("câu ai cũng đúng bị đánh dấu quá dễ", () => {
    const luot = Array.from({ length: 25 }, (_, i) => ({
      activityId: "a1",
      enrollmentId: `e${i}`,
      attemptNo: 1,
      score: 1,
      maxScore: 1,
      passed: true,
      secondsSpent: 20,
      errorTags: [],
    }));
    expect(chiSoCauHoi(luot)[0]?.ketLuan).toBe("qua_de");
  });

  test("dưới 20 lượt thì không kết luận", () => {
    const luot = Array.from({ length: 5 }, (_, i) => ({
      activityId: "a1",
      enrollmentId: `e${i}`,
      attemptNo: 1,
      score: 0,
      maxScore: 1,
      passed: false,
      secondsSpent: 10,
      errorTags: [],
    }));
    expect(chiSoCauHoi(luot)[0]?.ketLuan).toBe("chua_du_du_lieu");
  });
});
