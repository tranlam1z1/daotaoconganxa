/// <reference types="bun" />
/** Gộp kết quả tìm kiếm theo văn bản cho trang /tim-kiem (app/lib/tra-cuu-van-ban.ts). */
import { describe, expect, test } from "bun:test";
import { gopTheoVanBan, tuVanBan } from "../app/lib/tra-cuu-van-ban";
import type { SearchHit } from "../app/lib/types";

const ND = "vn:vbqppl:nd:168/2024/NĐ-CP";
const LUAT = "vn:vbqppl:l:36/2024/QH15";

function hit(p: Partial<SearchHit> & Pick<SearchHit, "urn" | "path">): SearchHit {
  return {
    docTitle: "Tên ngắn",
    label: "Điều 1",
    contextPath: "",
    snippet: "",
    score: 0,
    status: "con_hieu_luc",
    ...p,
  };
}

describe("gopTheoVanBan", () => {
  test("mỗi văn bản một thẻ, theo thứ tự kết quả khớp nhất", () => {
    const ds = gopTheoVanBan([
      hit({ urn: `${ND}#dieu-6`, path: "dieu-6", docType: "nd", soKyHieu: "168/2024/NĐ-CP" }),
      hit({ urn: `${LUAT}#dieu-9`, path: "dieu-9", docType: "l", soKyHieu: "36/2024/QH15" }),
      hit({ urn: `${ND}#dieu-7.khoan-2`, path: "dieu-7.khoan-2" }),
    ]);
    expect(ds.map((v) => v.urn)).toEqual([ND, LUAT]);
    expect(ds[0]?.khop.map((k) => k.path)).toEqual(["dieu-6", "dieu-7.khoan-2"]);
    expect(ds[0]?.href).toBe("/van-ban/nd/168-2024-nd-cp");
    expect(ds[0]?.khop[1]?.href).toBe("/van-ban/nd/168-2024-nd-cp?dieu=dieu-7#dieu-7.khoan-2");
  });

  test("nhãn điều kèm tên điều, khoản đọc theo trật tự viện dẫn", () => {
    const [vb] = gopTheoVanBan([
      hit({
        urn: `${ND}#dieu-6`,
        path: "dieu-6",
        label: "Điều 6",
        heading: "Xử phạt người điều khiển xe ô tô",
      }),
      hit({ urn: `${ND}#dieu-6.khoan-3.diem-a`, path: "dieu-6.khoan-3.diem-a", label: "a)" }),
    ]);
    expect(vb?.khop.map((k) => k.nhan)).toEqual([
      "Điều 6. Xử phạt người điều khiển xe ô tô",
      "Điểm a khoản 3 Điều 6",
    ]);
  });

  test("kết quả cấp văn bản chỉ tạo thẻ; path trùng không lặp lại", () => {
    const [vb] = gopTheoVanBan([
      hit({ urn: ND, path: "", docFullTitle: "Nghị định quy định xử phạt", issuedDate: "2024-12-26" }),
      hit({ urn: `${ND}#dieu-6`, path: "dieu-6" }),
      hit({ urn: `${ND}#dieu-6`, path: "dieu-6" }),
    ]);
    expect(vb?.tieuDe).toBe("Nghị định quy định xử phạt");
    expect(vb?.ngayBanHanh).toBe("2024-12-26");
    // Thiếu docType, soKyHieu trong kết quả thì suy từ URN.
    expect(vb?.docType).toBe("nd");
    expect(vb?.soKyHieu).toBe("168/2024/NĐ-CP");
    expect(vb?.khop.length).toBe(1);
  });
});

describe("tuVanBan", () => {
  test("dùng tên đầy đủ và ngày ban hành của văn bản", () => {
    const vb = tuVanBan({
      urn: LUAT,
      docType: "l",
      soKyHieu: "36/2024/QH15",
      shortTitle: "Luật 36/2024/QH15",
      title: "Luật Trật tự, an toàn giao thông đường bộ",
      issuer: "Quốc hội",
      issuedDate: "2024-06-27",
      status: "con_hieu_luc",
      fields: [],
    });
    expect(vb.tieuDe).toBe("Luật Trật tự, an toàn giao thông đường bộ");
    expect(vb.href).toBe("/van-ban/l/36-2024-qh15");
    expect(vb.khop).toEqual([]);
  });
});
