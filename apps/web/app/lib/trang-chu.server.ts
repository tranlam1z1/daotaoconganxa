import { getDocuments } from "./api";
import { docPhienHienTai, layToken } from "./auth.server";
import { chuyenDeHoc, danhMucHoc } from "./bai-giang.server";
import { cauSaiCuaToi } from "./luyen-tap.server";
import { chiTietNhom, nhomCuaToi } from "./nhom.server";
import { goiApiQuanTri } from "./quan-tri.server";
import type { BaiThi } from "./thi";

export async function duLieuTrangChu(request: Request) {
  const vanBan = getDocuments({ status: "con_hieu_luc", sort: "hieu_luc_moi", limit: 5 }).catch(() => null);
  const { nguoiDung } = await docPhienHienTai(request);
  const token = layToken(request);
  if (!nguoiDung || nguoiDung.cho_xac_minh || !token) {
    return { now: Date.now(), vanBan: await vanBan, caNhan: null };
  }
  const [hoc, thi, sai, giao] = await Promise.all([
    danhMucHoc(request, nguoiDung.nhom_doi_tuong?.length ? "cua_toi" : "tat_ca")
      .then(async (ds) => {
        const cd = ds.flatMap((lv) => lv.chuyenDe).find((c) => c.phanTram !== null && !c.daHoanThanh);
        if (!cd) return null;
        const chiTiet = await chuyenDeHoc(request, cd.slug);
        const bai =
          chiTiet.loTrinh.find((b) => b.trangThai === "dang_hoc") ??
          chiTiet.loTrinh.find((b) => b.trangThai !== "xong");
        return bai ? { ten: bai.title, to: `/hoc/${cd.slug}/${bai.slug}`, phanTram: cd.phanTram } : null;
      })
      .catch(() => undefined),
    goiApiQuanTri<{ items: BaiThi[] }>(token, "/v1/thi")
      .then(
        ({ items }) =>
          items
            .filter((b) => ["chua_mo", "chua_lam", "dang_lam"].includes(b.trang_thai))
            .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))[0] ?? null,
      )
      .catch(() => undefined),
    cauSaiCuaToi(token)
      .then((r) => r.tong)
      .catch(() => null),
    nhomCuaToi(token)
      .then(async ({ items }) => {
        const nhom = await Promise.all(
          items.filter((n) => n.trang_thai === "hoat_dong").map((n) => chiTietNhom(token, n.id)),
        );
        return nhom
          .flatMap((n) =>
            n.muc
              .filter(
                (m) => m.loai === "bai_hoc" && m.trang_thai === "tinh" && (m.phan_tram_cua_toi ?? 0) < 100,
              )
              .map((m) => ({ ten: m.ten, han: m.han_goi_y, to: `/nhom/${n.id}` })),
          )
          .sort((a, b) => (a.han ?? "9999").localeCompare(b.han ?? "9999"));
      })
      .catch(() => null),
  ]);
  return { now: Date.now(), vanBan: await vanBan, caNhan: { hoc, thi, sai, giao } };
}
