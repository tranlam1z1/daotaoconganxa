/**
 * Kiểm thử API chuyển đổi địa giới hành chính: danh mục cũ/mới, chuyển đổi theo cấp đã chọn, kiểm tra
 * đơn vị cấp dưới thuộc cấp trên, tra ngược, và vị trí GPS → xã theo ranh giới. Nominatim tắt
 * (NOMINATIM_URL=off) để kiểm thử không gọi mạng.
 */
import { describe, expect, test } from "bun:test";
import { createApp } from "./app.ts";

process.env.NOMINATIM_URL = "off";

const app = createApp();

async function goi(path: string, body?: unknown) {
  const res = await app.request(`http://test/v1/dia-gioi${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

/** Mã tỉnh, huyện, xã cũ của phường Trường Thi, TP Thanh Hóa. */
async function maTruongThi() {
  const tinh = (await goi("/cu/tinh")).body.items.find((t: any) => t.ten === "Tỉnh Thanh Hóa").ma;
  const huyen = (await goi(`/cu/tinh/${tinh}/huyen`)).body.items.find(
    (h: any) => h.ten === "Thành phố Thanh Hóa",
  ).ma;
  const xa = (await goi(`/cu/huyen/${huyen}/xa`)).body.items.find(
    (x: any) => x.ten === "Phường Trường Thi",
  ).ma;
  return { tinh, huyen, xa };
}

describe("API địa giới hành chính", () => {
  test("danh mục và nguồn dữ liệu", async () => {
    expect((await goi("/cu/tinh")).body.items).toHaveLength(63);
    expect((await goi("/moi/tinh")).body.items).toHaveLength(34);
    const nguon = await goi("/nguon");
    expect(nguon.body.phienBan).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nguon.body.nguon).toHaveLength(2);
    expect((await goi("/cu/tinh/99/huyen")).status).toBe(404);
  });

  test("chuyển đổi theo cấp chi tiết nhất đã chọn", async () => {
    const { tinh, huyen, xa } = await maTruongThi();
    const kqXa = await goi(`/chuyen-doi?tinh=${tinh}&huyen=${huyen}&xa=${xa}`);
    expect(kqXa.status).toBe(200);
    expect(kqXa.body.muc).toBe("xa");
    expect(kqXa.body.moi[0].xa.ten).toBe("Phường Hạc Thành");

    const kqHuyen = await goi(`/chuyen-doi?tinh=${tinh}&huyen=${huyen}`);
    expect(kqHuyen.body.muc).toBe("huyen");
    expect(kqHuyen.body.xaMoi.map((x: any) => x.ten)).toContain("Phường Hạc Thành");

    const kqTinh = await goi(`/chuyen-doi?tinh=${tinh}`);
    expect(kqTinh.body.muc).toBe("tinh");
    expect(kqTinh.body.tinhMoi.map((t: any) => t.ten)).toEqual(["Tỉnh Thanh Hóa"]);
  });

  test("xã không thuộc huyện, tỉnh đã chọn thì 404; mã sai định dạng thì 400", async () => {
    const { huyen, xa } = await maTruongThi();
    expect((await goi(`/chuyen-doi?tinh=01&huyen=${huyen}&xa=${xa}`)).status).toBe(404);
    expect((await goi("/chuyen-doi?tinh=1")).status).toBe(400);
    expect((await goi("/chuyen-doi")).status).toBe(400);
  });

  test("chuyển đổi kèm thôn: mỗi xã mới kèm các dòng sắp xếp thôn khớp tên và căn cứ", async () => {
    const tinh = (await goi("/cu/tinh")).body.items.find((t: any) => t.ten === "Tỉnh Thanh Hóa").ma;
    const huyen = (await goi(`/cu/tinh/${tinh}/huyen`)).body.items.find(
      (h: any) => h.ten === "Huyện Vĩnh Lộc",
    ).ma;
    const xa = (await goi(`/cu/huyen/${huyen}/xa`)).body.items.find((x: any) => x.ten === "Xã Minh Tân").ma;
    const kq = await goi(
      `/chuyen-doi?tinh=${tinh}&huyen=${huyen}&xa=${xa}&thon=${encodeURIComponent("Thôn 5")}`,
    );
    expect(kq.body.moi[0].xa.ten).toBe("Xã Biện Thượng");
    expect(kq.body.moi[0].thon.dong.map((d: any) => d.moi)).toEqual(["Thôn Bồng Hạ"]);
    expect(kq.body.moi[0].thon.canCu).toContain("1717/QĐ-UBND");
    // Không gửi thôn thì kết quả như cũ, không kèm trường thôn.
    expect((await goi(`/chuyen-doi?tinh=${tinh}&xa=${xa}`)).body.moi[0].thon).toBeUndefined();
  });

  test("tìm và tra ngược xã mới", async () => {
    const tim = await goi(`/moi/tim?q=${encodeURIComponent("hạc thành")}`);
    const hac = tim.body.items[0];
    expect(hac.xa.ten).toBe("Phường Hạc Thành");
    const kq = await goi(`/moi/xa/${hac.xa.ma}`);
    expect(kq.body.tinhMoi.ten).toBe("Tỉnh Thanh Hóa");
    expect(kq.body.xaCu.map((x: any) => x.xa.ten)).toContain("Phường Trường Thi");
    expect((await goi("/moi/xa/99999")).status).toBe(404);
    expect((await goi("/moi/tim?q=")).status).toBe(400);
  });

  test("vị trí GPS: xã, tỉnh theo ranh giới, kèm ranh xã để vẽ bản đồ", async () => {
    const kq = await goi("/vi-tri", { lat: 19.8075, lon: 105.7765 });
    expect(kq.status).toBe(200);
    expect(kq.body.xa.ten).toBe("Phường Hạc Thành");
    expect(kq.body.tinh.ten).toBe("Tỉnh Thanh Hóa");
    expect(kq.body.ganRanh).toBe(false);
    expect(kq.body.ranhGioi.length).toBeGreaterThan(0);
    // Dịch vụ tên đường tắt: không có tên đường, địa chỉ đầy đủ chỉ gồm xã, tỉnh.
    expect(kq.body.tenDuong).toBeNull();
    expect(kq.body.diaChiDayDu).toBe("Phường Hạc Thành, Tỉnh Thanh Hóa");
    // Không có tên đơn vị từ bản đồ: chưa rõ phường cũ, trả các phường cũ có thể kèm huyện, tỉnh chung.
    expect(kq.body.cu.xa).toBeNull();
    expect(kq.body.cu.huyen.ten).toBe("Thành phố Thanh Hóa");
    expect(kq.body.cu.tinh.ten).toBe("Tỉnh Thanh Hóa");
    expect(kq.body.cu.coThe.map((c: any) => c.xa.ten)).toContain("Phường Lam Sơn");
    // Ước lượng theo tâm phường cũ gần nhất; địa chỉ cũ ghép theo ước lượng đó.
    expect(kq.body.cu.ganNhat.xa.ten).toBe("Phường Điện Biên");
    expect(kq.body.cu.ganNhat.tinh.ten).toBe("Tỉnh Thanh Hóa");
    expect(kq.body.cu.diaChiDayDu).toBe("Phường Điện Biên, Thành phố Thanh Hóa, Tỉnh Thanh Hóa");
  });

  test("vị trí GPS: xã mới có xã cũ thiếu tâm dùng được thì không ước lượng, không ghép địa chỉ cũ", async () => {
    // Xã Hoằng Giang: xã Hoằng Quỳ cũ không có tâm (nguồn cho trùng tọa độ với xã Hoằng Quý).
    const kq = await goi("/vi-tri", { lat: 19.9107, lon: 105.7791 });
    expect(kq.body.xa.ten).toBe("Xã Hoằng Giang");
    expect(kq.body.cu.xa).toBeNull();
    expect(kq.body.cu.coThe.length).toBeGreaterThan(1);
    expect(kq.body.cu.ganNhat).toBeNull();
    expect(kq.body.cu.diaChiDayDu).toBeNull();
  });

  test("vị trí ngoài vùng có ranh giới thì 404 kèm lý do; ngoài lãnh thổ thì 400", async () => {
    const kq = await goi("/vi-tri", { lat: 21.0285, lon: 105.8542 });
    expect(kq.status).toBe(404);
    expect(kq.body.error.message).toContain("Tỉnh Thanh Hóa");
    expect((await goi("/vi-tri", { lat: 48.8, lon: 2.3 })).status).toBe(400);
  });

  test("địa chỉ tự do: 501 khi tắt dịch vụ bản đồ", async () => {
    const kq = await goi("/dia-chi", { q: "Đại lộ Lê Lợi, Thanh Hóa" });
    expect(kq.status).toBe(501);
    expect(kq.body.error.code).toBe("chua_ho_tro");
  });
});
