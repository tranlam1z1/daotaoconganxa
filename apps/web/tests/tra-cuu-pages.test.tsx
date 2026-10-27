import { afterEach, expect, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  Outlet,
  StaticRouterProvider,
  useLoaderData,
} from "react-router";
import { getDiff } from "../app/lib/api";
import Properties from "../app/routes/document.properties";
import Versions from "../app/routes/document.versions";
import SearchPage, { loader as searchLoader } from "../app/routes/search";

function SearchHarness() {
  const loaderData = useLoaderData<typeof searchLoader>();
  return (
    <SearchPage
      {...({ loaderData, params: {}, matches: [] } as unknown as Parameters<typeof SearchPage>[0])}
    />
  );
}
let fetchSpy: ReturnType<typeof spyOn> | undefined;
afterEach(() => fetchSpy?.mockRestore());
function mock(data: unknown) {
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(async () => Response.json(data), { preconnect: globalThis.fetch.preconnect }),
  );
}
async function render(routes: Parameters<typeof createStaticHandler>[0], url = "http://test/") {
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(url));
  if (context instanceof Response) throw Error("redirect");
  return renderToStaticMarkup(
    <StaticRouterProvider
      router={createStaticRouter(handler.dataRoutes, context)}
      context={context}
      hydrate={false}
    />,
  );
}
test("kết quả có nút sang trang giữ từ khóa và mốc; điều khoản giữ ngày", async () => {
  mock({
    total: 125,
    asOf: "2026-10-27",
    facets: {},
    items: [
      {
        urn: "vn:vbqppl:nd:1/2020/NĐ-CP",
        docType: "nd",
        soKyHieu: "1/2020/NĐ-CP",
        title: "Văn bản kiểm thử",
        issuer: "Cơ quan thử",
        statusAsOf: "con_hieu_luc",
        matchCount: 150,
        matches: [
          { path: "dieu-2.khoan-1", label: "Khoản 1", snippet: "Nội dung kiểm thử", nodeStatus: "active" },
        ],
      },
    ],
  });
  const html = await render(
    [{ path: "/tim-kiem", Component: SearchHarness, loader: searchLoader }],
    "http://test/tim-kiem?q=kiemthu&field=hanh-chinh&asOf=2026-10-27",
  );
  expect(html).toContain("125 văn bản");
  expect(html).toContain("page=2");
  expect(html).toContain("field=hanh-chinh");
  expect(html).toContain("asOf=2026-10-27#dieu-2.khoan-1");
  expect(html).toContain("150");
});
test("ngày sai hiện lỗi có ích mà không gửi yêu cầu API", async () => {
  mock({});
  const html = await render(
    [{ path: "/tim-kiem", Component: SearchHarness, loader: searchLoader }],
    "http://test/tim-kiem?asOf=2026-02-30",
  );
  expect(html).toContain("Ngày tra cứu không tồn tại");
  expect(fetchSpy).not.toHaveBeenCalled();
});
test("bộ chuyển đổi so sánh dùng đúng hợp đồng diffs/summary của API", async () => {
  mock({
    from: "2020-01-01",
    to: "2021-01-01",
    summary: { added: 1, removed: 0, modified: 1 },
    diffs: [
      {
        path: "dieu-1",
        label: "Điều 1",
        change: "modified",
        words: [
          { type: "del", text: "cũ" },
          { type: "add", text: "mới" },
        ],
        statusBefore: "active",
        statusAfter: "amended",
      },
      { path: "dieu-2", label: "Điều 2", change: "added", after: "Điều thêm" },
    ],
  });
  const d = await getDiff("vn:vbqppl:nd:1/2020/NĐ-CP", "2020-01-01", "2021-01-01");
  expect(d.stats.changed).toBe(1);
  expect(d.nodes[0]!.tokens).toEqual([
    { kind: "del", text: "cũ" },
    { kind: "add", text: "mới" },
  ]);
  expect(d.nodes[1]!.tokens[0]!.text).toBe("Điều thêm");
});
test("thuộc tính không tạo liên kết nguồn nguy hiểm và phiên bản có lối đọc/so sánh thật", async () => {
  const data = {
    basePath: "/van-ban/nd/1-2020-nd-cp",
    urn: "vn:vbqppl:nd:1/2020/NĐ-CP",
    asOf: "2021-01-01",
    detail: {
      status: "con_hieu_luc",
      coTepGoc: false,
      meta: {
        urn: "vn:vbqppl:nd:1/2020/NĐ-CP",
        docType: "nd",
        soKyHieu: "1/2020/NĐ-CP",
        title: "Kiểm thử",
        issuer: "Cơ quan thử",
        issuedDate: "2020-01-01",
        fields: [],
        status: "con_hieu_luc",
        primarySource: "javascript:alert(1)",
      },
      versions: [
        { versionNo: 1, kind: "original", validFrom: "2020-01-01" },
        { versionNo: 2, kind: "consolidated_auto", validFrom: "2021-01-01" },
      ],
    },
  };
  const routes = [
    {
      id: "routes/document",
      path: "/",
      Component: Outlet,
      loader: () => data,
      children: [{ index: true, Component: Properties }],
    },
  ];
  const html = await render(routes);
  expect(html).toContain("Thuộc tính văn bản");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("Kho chưa có tệp PDF gốc");
  const versions = await render([{ ...routes[0], children: [{ index: true, Component: Versions }] }]);
  expect(versions).toContain("/so-sanh?");
  expect(versions).toContain("asOf=2020-01-01");
});
