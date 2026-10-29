import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  matchRoutes,
  Outlet,
  StaticRouterProvider,
  useRouteError,
} from "react-router";
import { NGHIEP_VU_NHANH, O_CONG_CU } from "../app/lib/cong-cu";
import { urlTrang } from "../app/lib/session.server";
import { BOTTOM_NAV, MAIN_NAV, MORE_NAV } from "../app/lib/site";
import { ErrorBoundary } from "../app/root";
import config from "../app/routes";
import { loader as daoTao } from "../app/routes/dao-tao.chuyen-huong";
import { loader as chamTuLuan } from "../app/routes/quan-tri.de-thi.cham-tu-luan";

type Entry = { path?: string; index?: boolean; file: string; children?: Entry[]; id?: string };
let counter = 0;
function convert(entries: Entry[]): any[] {
  return entries.map((r) => ({
    id: String(counter++),
    path: r.path,
    index: r.index,
    handle: { file: r.file },
    children: r.children ? convert(r.children) : undefined,
  }));
}
const entries = config as Entry[];
const routes = convert(entries);
function matchedFile(path: string) {
  return matchRoutes(routes, path)?.at(-1)?.route.handle?.file;
}

describe("bản đồ router và liên kết điều hướng", () => {
  test("mọi route đều có tệp nguồn", () => {
    const visit = (rs: Entry[]) => {
      for (const r of rs) {
        expect(existsSync(new URL(`../app/${r.file}`, import.meta.url))).toBe(true);
        if (r.children) visit(r.children);
      }
    };
    visit(entries);
  });
  test("menu và lối tắt không rơi vào trang 404", () => {
    for (const item of [...MAIN_NAV, ...BOTTOM_NAV, ...MORE_NAV, ...NGHIEP_VU_NHANH, ...O_CONG_CU]) {
      const file = matchedFile(new URL(item.to, "http://router.test").pathname);
      expect(file).toBeDefined();
      expect(file).not.toBe("routes/not-found.tsx");
    }
  });
  for (const [path, file] of [
    ["/luyen-tap/offline", "routes/luyen-tap.offline.tsx"],
    ["/luyen-tap/can-cu", "routes/luyen-tap.can-cu.tsx"],
    ["/dao-tao/chuyen-de/tien-do", "routes/training.progress.tsx"],
    ["/dao-tao/chuyen-de/on-tap", "routes/training.review.tsx"],
    ["/cong-cu/dia-gioi-hanh-chinh/tra-nguoc", "routes/cong-cu.dia-gioi.tra-nguoc.tsx"],
    ["/quan-tri/de-thi/cham-tu-luan", "routes/quan-tri.de-thi.cham-tu-luan.tsx"],
    ["/quan-tri/de-thi/moi/ma-tran", "routes/quan-tri.de-thi.ma-tran.tsx"],
    ["/quan-tri/van-ban/sua", "routes/quan-tri.van-ban.sua.tsx"],
    ["/van-ban/nd/1-2020/thuoc-tinh", "routes/document.properties.tsx"],
  ])
    test(`không nhầm route tĩnh với tham số: ${path}`, () => {
      expect(matchedFile(path!)).toBe(file);
    });
  test("đường không tồn tại vào đúng trang 404", () => {
    expect(matchedFile("/duong-khong-ton-tai")).toBe("routes/not-found.tsx");
  });
});

describe("chuyển hướng cũ khi điều hướng phía client", () => {
  test("đào tạo giữ bộ lọc và loại tham số Single Fetch", () => {
    const result = daoTao({
      request: new Request("http://router.test/dao-tao/chuyen-de/bai.data?_routes=old&nhom=vien_chuc&index="),
      params: { course: "chuyen-de", lesson: "bai" },
    });
    expect(result.status).toBe(301);
    expect(result.headers.get("location")).toBe("/hoc/chuyen-de/bai?nhom=vien_chuc");
  });
  test("chấm tự luận giữ bộ lọc và bỏ _routes", () => {
    const result = chamTuLuan({
      request: new Request(
        "http://router.test/quan-tri/de-thi/cham-tu-luan.data?_routes=old&che_do=da_cham_ai",
      ),
    });
    expect(result.headers.get("location")).toBe("/quan-tri/cham-tu-luan/de-thi?che_do=da_cham_ai");
  });
  test("URL dữ liệu của trang chủ được chuẩn hóa", () => {
    expect(urlTrang(new Request("http://router.test/_.data?_routes=root")).pathname).toBe("/");
  });
});

function ErrorHarness() {
  const error = useRouteError();
  return <ErrorBoundary {...({ error } as Parameters<typeof ErrorBoundary>[0])} />;
}
test("sau lỗi route vẫn có header để chuyển sang trang khác", async () => {
  const handler = createStaticHandler([
    {
      id: "root",
      path: "/",
      loader: () => ({ nguoiDung: null, trangThaiPhien: "khach" }),
      Component: Outlet,
      ErrorBoundary: ErrorHarness,
      children: [
        {
          path: "route-loi",
          loader: () => {
            throw new Response("Không có", { status: 404 });
          },
          Component: () => null,
        },
      ],
    },
  ]);
  const context = await handler.query(new Request("http://router.test/route-loi"));
  if (context instanceof Response) throw Error("Unexpected redirect");
  const html = renderToStaticMarkup(
    <StaticRouterProvider
      router={createStaticRouter(handler.dataRoutes, context)}
      context={context}
      hydrate={false}
    />,
  );
  expect(html).toContain('class="site-header');
  expect(html).toContain('href="/tra-cuu"');
  expect(html).toContain('class="site-footer');
  expect(html).toContain("Không tìm thấy trang");
});
