const query = [
  ["q", "string"],
  ["category", "string"],
  ["vehicle", "string"],
  ["legal_document", "string"],
  ["as_of", "string"],
  ["page", "integer"],
  ["page_size", "integer"],
].map(([name, type]) => ({
  name,
  in: "query",
  schema: {
    type,
    ...(name === "as_of" ? { format: "date" } : {}),
    ...(name === "page" ? { minimum: 1, maximum: 10000, default: 1 } : {}),
    ...(name === "page_size" ? { minimum: 1, maximum: 100, default: 24 } : {}),
  },
}));
const responses = {
  "200": { description: "Dữ liệu đã duyệt, hiệu lực theo as_of." },
  "400": { description: "Tham số không hợp lệ" },
  "429": { description: "Vượt giới hạn tra cứu" },
};
const paths: Record<string, unknown> = {};
for (const kind of ["signs", "violations"]) {
  paths[`/${kind}`] = { get: { tags: [kind], parameters: query, responses } };
  paths[`/${kind}/categories`] = { get: { tags: [kind], responses } };
  paths[`/${kind}/{code}`] = {
    get: {
      tags: [kind],
      parameters: [
        { name: "code", in: "path", required: true, schema: { type: "string", maxLength: 80 } },
        ...query,
      ],
      responses: { ...responses, "404": { description: "Không có bản ghi đã duyệt tại ngày tra cứu" } },
    },
  };
}
paths["/history"] = Object.fromEntries(
  ["get", "post", "delete"].map((method) => [
    method,
    {
      security: [{ bearerAuth: [] }],
      responses: {
        "200": { description: "Lịch sử riêng của tài khoản" },
        "201": { description: "Đã lưu" },
        "204": { description: "Đã xóa" },
        "401": { description: "Cần đăng nhập" },
      },
      ...(method === "post"
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["kind", "query"],
                    properties: {
                      kind: { enum: ["signs", "violations"] },
                      query: { type: "string", maxLength: 200 },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
  ]),
);
export const trafficOpenApi = {
  openapi: "3.0.3",
  info: {
    title: "API tra cứu giao thông Việt Nam",
    version: "1.0.0",
    description:
      "Chỉ công khai nội dung và căn cứ đã duyệt. Khoảng hiệu lực [từ, đến). Khung phạt cần đối chiếu tình tiết.",
  },
  servers: [{ url: "/api/v1/traffic" }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "Token phiên của hệ thống hiện có" },
    },
  },
};
