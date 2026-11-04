import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type NguCanhDoc, NoiDungDieu } from "../app/components/tra-cuu/NoiDungDieu";
import type { DocumentMeta, LegalNode } from "../app/lib/types";

const ctx: NguCanhDoc = { meta: {} as DocumentMeta, asOf: "2026-10-23", versionKind: "original" };

describe("nội dung của nút cấu trúc văn bản", () => {
  for (const kind of ["phan", "chuong", "muc", "tieu_muc"] as const) {
    test(`${kind}: hiển thị nội dung chữ bên dưới tiêu đề, trước nút con`, () => {
      const node: LegalNode = {
        kind,
        path: "phu-luc-b.muc-3",
        fullPath: "phu-luc-b.muc-3",
        label: "Mục B.3",
        heading: "Biển báo",
        text: "Nội dung **cần hiển thị**.",
        status: "active",
        children: [
          {
            kind: "doan",
            path: "doan-1",
            fullPath: "doan-1",
            label: "",
            text: "Nội dung con",
            status: "active",
            children: [],
          },
        ],
      };
      const html = renderToStaticMarkup(<NoiDungDieu node={node} ctx={ctx} />);
      expect(html).toContain('id="phu-luc-b.muc-3"');
      expect(html).toContain("<strong>cần hiển thị</strong>");
      expect(html.indexOf("cần hiển thị")).toBeLessThan(html.indexOf("Nội dung con"));
    });
  }
});
