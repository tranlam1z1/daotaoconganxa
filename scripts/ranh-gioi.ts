/**
 * Dựng data/dia-gioi/ranh-gioi.json: ranh giới (đa giác) xã, phường hiện nay của các tỉnh trong TINH,
 * dùng để xác định tọa độ GPS thuộc xã nào (packages/dao-tao/src/ranh-gioi.ts).
 *
 * Nguồn: thanglequoc/vietnamese-provinces-database, thư mục json/geojson/<mã tỉnh>_<tên>/wards (mỗi
 * xã một tệp, `id` là mã xã), ghim cùng commit với danh mục xã mới trong scripts/dia-gioi.ts để mã
 * khớp với data/dia-gioi/dia-gioi.json. Tọa độ làm tròn 5 chữ số (≈ 1 m) và làm gọn ranh lệch tối đa
 * 0,00001° (≈ 1 m).
 *
 *   bun run ranh-gioi:dung              # tải, đối chiếu mã với dia-gioi.json, ghi tệp
 *   bun run ranh-gioi:dung -- --kiem-tra  # chỉ đối chiếu, không ghi tệp
 *
 * Thêm tỉnh thì thêm mã vào TINH; đổi commit thì đổi cả scripts/dia-gioi.ts rồi dựng lại cả hai tệp.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type diaGioi, ranhGioi } from "@qdpl/dao-tao";

const GOC = join(import.meta.dir, "..");
const TEP_DIA_GIOI = join(GOC, "data", "dia-gioi", "dia-gioi.json");
const TEP_RA = join(GOC, "data", "dia-gioi", "ranh-gioi.json");

/** Mã tỉnh hiện nay có ranh giới: 38 = Thanh Hóa. */
const TINH = ["38"];

const NGUON = {
  ten: "vietnamese-provinces-database (Lê Quốc Thắng), bộ GIS",
  url: "https://github.com/thanglequoc/vietnamese-provinces-database",
  repo: "thanglequoc/vietnamese-provinces-database",
  commit: "8b78ba5118715e1fa81769286724db79346abf52",
  giayPhep: "MIT",
  ghiChu:
    "Ranh giới xã, phường hiện nay; dựng từ Bản đồ đơn vị hành chính tham khảo (sapnhap.bando.com.vn) của Nhà xuất bản Tài nguyên – Môi trường và Bản đồ Việt Nam.",
};

const LAM_TRON = 5;
const LAM_GON = 0.00001;

async function tai(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Không tải được ${url}: HTTP ${res.status}`);
  return res.text();
}

/** Đường dẫn các tệp ranh giới xã của từng tỉnh, lấy từ cây thư mục của commit. */
async function dsTep(): Promise<Map<string, string[]>> {
  const cay = JSON.parse(
    await tai(`https://api.github.com/repos/${NGUON.repo}/git/trees/${NGUON.commit}?recursive=1`),
  ) as { truncated: boolean; tree: Array<{ path: string }> };
  if (cay.truncated) throw new Error("Cây thư mục nguồn bị cắt bớt, không đủ danh sách tệp.");
  const m = new Map<string, string[]>(TINH.map((t) => [t, []]));
  for (const { path } of cay.tree) {
    const k = /^json\/geojson\/(\d{2})_[^/]+\/wards\/[^/]+\.geojson$/.exec(path);
    if (k && m.has(k[1]!)) m.get(k[1]!)!.push(path);
  }
  return m;
}

interface TepXa {
  features: Array<{
    id: string;
    geometry:
      | { type: "MultiPolygon"; coordinates: number[][][][] }
      | { type: "Polygon"; coordinates: number[][][] };
  }>;
}

function sangRanhGioi(f: TepXa["features"][number]): ranhGioi.RanhGioiXa {
  const g = f.geometry;
  const nhieuPhan = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  const vung = ranhGioi.lamGonDaGiac(
    nhieuPhan.map((phan) =>
      phan.map((vong) =>
        vong.map(([x, y]) => [Number(x!.toFixed(LAM_TRON)), Number(y!.toFixed(LAM_TRON))] as ranhGioi.Diem),
      ),
    ),
    LAM_GON,
  );
  const diem = vung.flat(2);
  const bbox: ranhGioi.RanhGioiXa["bbox"] = [
    Math.min(...diem.map((p) => p[0])),
    Math.min(...diem.map((p) => p[1])),
    Math.max(...diem.map((p) => p[0])),
    Math.max(...diem.map((p) => p[1])),
  ];
  return { ma: String(f.id), bbox, vung };
}

async function dung(): Promise<{ duLieu: ranhGioi.DuLieuRanhGioi; loi: string[] }> {
  const dg = JSON.parse(readFileSync(TEP_DIA_GIOI, "utf8")) as diaGioi.DuLieuDiaGioi;
  const loi: string[] = [];
  const xa: ranhGioi.RanhGioiXa[] = [];
  console.log("Tải danh sách tệp ranh giới…");
  const tep = await dsTep();

  for (const t of TINH) {
    const can = new Set(dg.xaMoi.filter((x) => x.tinh === t).map((x) => x.ma));
    const ds = tep.get(t)!;
    console.log(`Tỉnh ${t}: tải ${ds.length} tệp…`);
    const raw = `https://raw.githubusercontent.com/${NGUON.repo}/${NGUON.commit}`;
    const kq: ranhGioi.RanhGioiXa[] = [];
    for (let i = 0; i < ds.length; i += 16) {
      const lo = await Promise.all(
        ds.slice(i, i + 16).map(async (p) => JSON.parse(await tai(`${raw}/${p}`)) as TepXa),
      );
      for (const f of lo.flatMap((g) => g.features)) kq.push(sangRanhGioi(f));
    }
    const co = new Set(kq.map((x) => x.ma));
    const thieu = [...can].filter((m) => !co.has(m));
    const thua = [...co].filter((m) => !can.has(m));
    if (thieu.length) loi.push(`Tỉnh ${t}: thiếu ranh giới ${thieu.length} xã: ${thieu.join(", ")}`);
    if (thua.length) loi.push(`Tỉnh ${t}: ranh giới có mã không thuộc danh mục: ${thua.join(", ")}`);
    if (co.size !== kq.length) loi.push(`Tỉnh ${t}: trùng mã xã trong nguồn ranh giới.`);
    xa.push(...kq.sort((a, b) => a.ma.localeCompare(b.ma)));
  }

  const duLieu: ranhGioi.DuLieuRanhGioi = {
    phienBan: new Date().toISOString().slice(0, 10),
    nguon: [
      {
        ten: NGUON.ten,
        url: `${NGUON.url}/tree/${NGUON.commit}`,
        giayPhep: NGUON.giayPhep,
        ghiChu: NGUON.ghiChu,
      },
    ],
    tinh: TINH,
    xa,
  };
  return { duLieu, loi };
}

const chiKiemTra = process.argv.includes("--kiem-tra");
const { duLieu, loi } = await dung();
const soDiem = duLieu.xa.reduce((s, x) => s + x.vung.flat(2).length, 0);
console.log(`${duLieu.xa.length} xã, ${soDiem.toLocaleString("vi-VN")} điểm ranh giới.`);
if (loi.length) {
  console.error(`\nDữ liệu chưa đạt:\n  ${loi.join("\n  ")}`);
  process.exit(1);
}
if (!chiKiemTra) {
  // Mỗi xã một dòng, như dia-gioi.json: lần dựng sau xem được khác biệt theo từng xã.
  const { xa, ...dau } = duLieu;
  const khoi = Object.entries(dau).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  khoi.push(`"xa": [\n${xa.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n]`);
  writeFileSync(TEP_RA, `{\n${khoi.join(",\n")}\n}\n`);
  console.log(`Đã ghi ${TEP_RA}.`);
}
