/**
 * Dựng data/dia-gioi/thon.json (thôn, tổ dân phố cũ → tên mới theo từng xã mới) cho ô Thôn/xóm của
 * Chuyển đổi thủ công, từ các phụ lục phương án sắp xếp thôn đặt ở data/dia-gioi/nguon/.
 *
 *   bun run thon:dung
 *
 * Thêm tỉnh: đặt phụ lục (Markdown, mỗi xã một mục "## <tên xã mới>" kèm bảng TT | thôn cũ | tên mới)
 * vào data/dia-gioi/nguon/, thêm vào NGUON bên dưới, chạy lại, rồi cập nhật data/dia-gioi/README.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { diaGioi } from "@qdpl/dao-tao";

const THU_MUC = join(import.meta.dir, "..", "data", "dia-gioi");

const NGUON = [
  {
    tep: "thon-thanh-hoa.md",
    tinh: "38",
    // Ghi dưới kết quả; tên gọi mới trong phụ lục là tên dự kiến.
    canCu:
      "Phụ lục số 01 Phương án sắp xếp thôn, tổ dân phố kèm Quyết định 1717/QĐ-UBND ngày 09/6/2026 của UBND tỉnh Thanh Hóa",
  },
];

const duLieu = JSON.parse(readFileSync(join(THU_MUC, "dia-gioi.json"), "utf8")) as diaGioi.DuLieuDiaGioi;

// Nguồn có chỗ viết liền "ThônXuân Lai".
const sach = (s: string) =>
  s
    .replace(/\bThôn(?=\p{Lu})/gu, "Thôn ")
    .replace(/\s+/g, " ")
    .trim();

const tinh: diaGioi.DuLieuThon["tinh"] = {};
const khongKhop: string[] = [];
for (const n of NGUON) {
  const xa: Record<string, diaGioi.DongThon[]> = {};
  tinh[n.tinh] = { canCu: n.canCu, xa };
  const maTheoTen = new Map(
    duLieu.xaMoi.filter((x) => x.tinh === n.tinh).map((x) => [diaGioi.khoaTim(x.ten), x.ma]),
  );
  let ma: string | undefined;
  for (const dong of readFileSync(join(THU_MUC, "nguon", n.tep), "utf8").split(/\r?\n/)) {
    const muc = /^## (.+)$/.exec(dong);
    if (muc) {
      const ten = muc[1]!.trim();
      ma = ten === "Mục lục" ? undefined : maTheoTen.get(diaGioi.khoaTim(ten));
      if (!ma && ten !== "Mục lục") khongKhop.push(`${n.tep}: ${ten}`);
      continue;
    }
    const o = dong.split("|").map((x) => x.trim());
    // Dòng bảng: "", TT, thôn cũ, tên mới, số hộ, diện tích, "". Bỏ dòng tiêu đề và dòng kẻ.
    if (!ma || o.length < 5 || !/^\d+$/.test(o[1]!)) continue;
    const cu = o[2]!
      .split(";")
      .map((x) => sach(x).replace(/[.,;]+$/, ""))
      .filter(Boolean);
    const moi = sach(o[3]!).replace(/\s*\.$/, "");
    if (!cu.length || !moi) continue;
    xa[ma] ??= [];
    xa[ma].push({ cu, moi });
  }
}

if (khongKhop.length) {
  console.error(`Không khớp tên xã mới với dia-gioi.json:\n  ${khongKhop.join("\n  ")}`);
  process.exit(1);
}

// Mỗi dòng sắp xếp nằm trên một dòng tệp để dễ xem khác biệt giữa hai lần dựng.
const khoi = Object.entries(tinh).map(([ma, t]) => {
  const xa = Object.entries(t.xa).map(
    ([maXa, ds]) => `${JSON.stringify(maXa)}: [\n${ds.map((d) => `  ${JSON.stringify(d)}`).join(",\n")}\n]`,
  );
  return `${JSON.stringify(ma)}: {\n"canCu": ${JSON.stringify(t.canCu)},\n"xa": {\n${xa.join(",\n")}\n}\n}`;
});
const phienBan = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(THU_MUC, "thon.json"),
  `{\n"phienBan": ${JSON.stringify(phienBan)},\n"tinh": {\n${khoi.join(",\n")}\n}\n}\n`,
);
const dsXa = Object.values(tinh).flatMap((t) => Object.values(t.xa));
console.log(`Đã ghi thon.json: ${dsXa.length} xã, ${dsXa.flat().length} thôn mới.`);
