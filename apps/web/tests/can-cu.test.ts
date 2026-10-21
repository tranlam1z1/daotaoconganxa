/// <reference types="bun" />
/** Mục lục cho ô chọn căn cứ (app/lib/can-cu.ts). */
import { describe, expect, test } from "bun:test";
import { rutMucLuc, tenKhoanDiem, tomTat } from "../app/lib/can-cu";
import type { LegalNode } from "../app/lib/types";

function nut(p: Partial<LegalNode> & Pick<LegalNode, "path" | "kind" | "label">): LegalNode {
  return { fullPath: p.path, text: "", children: [], status: "active", ...p };
}

const GOC = nut({
  path: "",
  kind: "van_ban",
  label: "",
  children: [
    nut({ path: "can-cu", kind: "can_cu", label: "Căn cứ" }),
    nut({
      path: "chuong-1",
      kind: "chuong",
      label: "Chương I",
      heading: "Quy định chung",
      children: [
        nut({
          path: "dieu-1",
          kind: "dieu",
          label: "Điều 1",
          heading: "Phạm vi điều chỉnh",
          children: [nut({ path: "dieu-1.khoan-1", kind: "khoan", label: "1.", implicit: true })],
        }),
        nut({
          path: "dieu-2",
          kind: "dieu",
          label: "Điều 2",
          status: "repealed",
          children: [
            nut({
              path: "dieu-2.khoan-1",
              kind: "khoan",
              label: "1.",
              text: "**Phạt tiền**  từ\n400.000 đồng",
              children: [
                nut({ path: "dieu-2.khoan-1.diem-a", kind: "diem", label: "a)", text: "Không đội mũ" }),
                nut({ path: "dieu-2.khoan-1.diem-b", kind: "diem", label: "b)" }),
              ],
            }),
            nut({ path: "dieu-2.khoan-2", kind: "khoan", label: "2." }),
          ],
        }),
      ],
    }),
    nut({
      path: "chuong-2",
      kind: "chuong",
      label: "Chương II",
      children: [
        nut({
          path: "chuong-2.muc-1",
          kind: "muc",
          label: "Mục 1",
          heading: "Xử phạt",
          children: [nut({ path: "dieu-3", kind: "dieu", label: "Điều 3" })],
        }),
      ],
    }),
  ],
});

describe("rutMucLuc", () => {
  const ml = rutMucLuc(GOC);

  test("lấy mọi điều theo thứ tự, kèm nhóm phần/chương/mục", () => {
    expect(ml.map((d) => d.path)).toEqual(["dieu-1", "dieu-2", "dieu-3"]);
    expect(ml[0]?.nhom).toBe("Chương I. Quy định chung");
    expect(ml[2]?.nhom).toBe("Chương II › Mục 1. Xử phạt");
    expect(ml[1]?.status).toBe("repealed");
  });

  test("bỏ khoản ẩn, tóm tắt nội dung khoản, kèm các điểm", () => {
    expect(ml[0]?.khoan).toEqual([]);
    expect(ml[1]?.khoan.map((k) => k.path)).toEqual(["dieu-2.khoan-1", "dieu-2.khoan-2"]);
    expect(ml[1]?.khoan[0]).toEqual({
      path: "dieu-2.khoan-1",
      label: "1.",
      tom: "Phạt tiền từ 400.000 đồng",
      status: "active",
      diem: [
        { path: "dieu-2.khoan-1.diem-a", label: "a)", tom: "Không đội mũ", status: "active" },
        { path: "dieu-2.khoan-1.diem-b", label: "b)", tom: "", status: "active" },
      ],
    });
    expect(ml[1]?.khoan[1]?.diem).toEqual([]);
  });
});

test("tomTat cắt ở độ dài tối đa", () => {
  expect(tomTat("a".repeat(200), 10)).toBe(`${"a".repeat(9)}…`);
});

test("tenKhoanDiem bỏ dấu sau nhãn", () => {
  expect(tenKhoanDiem("Khoản", "1.")).toBe("Khoản 1");
  expect(tenKhoanDiem("Điểm", "a)")).toBe("Điểm a");
});
