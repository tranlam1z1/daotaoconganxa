import { describe, expect, test } from "bun:test";
import {
  type CorpusTargetRow,
  DEFAULT_TARGETS,
  MAX_PAGES_THEO_LINH_VUC,
  planDiscover,
} from "../src/bull/frame.ts";

const o = (phan: Partial<CorpusTargetRow>): CorpusTargetRow => ({
  id: "x",
  ma: "x",
  nhom: "x",
  uu_tien: 1,
  doc_type: "tt",
  co_quan: null,
  nam_tu: null,
  nam_den: null,
  chi_con_hieu_luc: false,
  nguon: "congbao",
  so_luong_ky_vong: null,
  ghi_chu: null,
  tu_khoa: [],
  loai_tru: [],
  ...phan,
});

describe("ô khung theo lĩnh vực", () => {
  test("ô không có từ khóa: job discover giữ nguyên hành vi cũ", () => {
    const { data } = planDiscover(o({}), { runId: "r", limit: 10 });
    expect(data.tuKhoa).toBeUndefined();
    expect(data.loaiTru).toBeUndefined();
    expect(data.toiDaTrang).toBeUndefined();
    expect(data.loai).toBe("thong-tu");
  });

  test("ô có từ khóa: job mang từ khóa, từ loại trừ và phải quét trọn danh mục", () => {
    const { data } = planDiscover(o({ tu_khoa: ["đường bộ"], loai_tru: ["hải quan"] }), { runId: "r" });
    expect(data.tuKhoa).toEqual(["đường bộ"]);
    expect(data.loaiTru).toEqual(["hải quan"]);
    expect(data.toiDaTrang).toBe(MAX_PAGES_THEO_LINH_VUC);
    expect(MAX_PAGES_THEO_LINH_VUC).toBeGreaterThanOrEqual(1000);
  });

  test("khung mặc định có đủ tám ô giao thông đường bộ theo thứ bậc văn bản", () => {
    const gtdb = DEFAULT_TARGETS.filter((t) => t.nhom === "gtdb");
    expect(gtdb.map((t) => t.docType)).toEqual(["l", "pl", "nd", "nq-cp", "qd-ttg", "tt", "ttlt", "vbhn"]);
    for (const t of gtdb) {
      expect(t.tuKhoa?.length ?? 0).toBeGreaterThan(5);
      expect(t.chiConHieuLuc).toBe(false);
    }
    // uu_tien tăng dần theo thứ bậc: luật trước, văn bản hợp nhất sau cùng.
    const uuTien = gtdb.map((t) => t.uuTien);
    expect([...uuTien].sort((a, b) => a - b)).toEqual(uuTien);
  });
});
