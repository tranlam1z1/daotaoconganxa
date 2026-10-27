import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createStaticHandler, createStaticRouter, Outlet, StaticRouterProvider } from "react-router";
import type { NguoiDung } from "../app/lib/types";
import Home from "../app/routes/home";

const taiKhoan: NguoiDung = {
  email: "kiemthu@example.invalid",
  ten: "Người học",
  vai_tro: "can_bo",
  mo_ta_vai_tro: "Người học",
  mien: null,
  la_quan_tri: false,
};
async function render(nguoiDung: NguoiDung | null) {
  const routes = [
    {
      id: "root",
      path: "/",
      loader: () => ({ nguoiDung }),
      Component: Outlet,
      children: [{ index: true, Component: Home }],
    },
  ];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request("http://test/"));
  if (context instanceof Response) throw Error("Unexpected redirect");
  return renderToStaticMarkup(
    <StaticRouterProvider
      router={createStaticRouter(handler.dataRoutes, context)}
      context={context}
      hydrate={false}
    />,
  );
}
describe("trang chủ ba nhóm", () => {
  test("khách có ô tìm văn bản và ba lối vào học theo nhóm", async () => {
    const html = await render(null);
    for (const nhom of ["cong_chuc", "vien_chuc", "dang_vien"])
      expect(html).toContain(`href="/hoc?nhom=${nhom}"`);
    expect(html).toContain('action="/tim-kiem"');
    expect(html).toContain('href="/dang-nhap"');
    expect(html).not.toContain('href="/dich-vu-cong"');
    expect(html).not.toContain("Tra cứu vi phạm");
  });
  test("tài khoản chờ xác minh có đường tới trạng thái thay vì nhiệm vụ không thể mở", async () => {
    const html = await render({ ...taiKhoan, cho_xac_minh: true });
    expect(html).toContain('href="/tai-khoan"');
    for (const url of ["/hoc", "/luyen-tap", "/thi", "/toi"]) expect(html).not.toContain(`href="${url}"`);
    expect(html).toContain("Xem trạng thái tài khoản");
    expect(html).toContain('action="/tim-kiem"');
  });
  test("người đã xác minh mở danh mục học thay vì nút tiếp tục giả", async () => {
    const html = await render(taiKhoan);
    expect(html).toContain("Xem bài học");
    expect(html).toContain('href="/hoc"');
    expect(html).toContain('href="/toi"');
    expect(html).not.toContain("Tiếp tục học tập");
  });
});
