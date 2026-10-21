/**
 * Dựng data/dia-gioi/dia-gioi.json cho công cụ Chuyển đổi địa giới hành chính
 * (packages/dao-tao/src/dia-gioi.ts) từ hai nguồn công khai, ghim theo commit:
 *
 *  - Bảng đối chiếu xã cũ → xã mới (63 tỉnh → 34 tỉnh): tranngocminhhieu/vietnamadminunits.
 *  - Danh mục tỉnh, xã hiện nay: thanglequoc/vietnamese-provinces-database (cập nhật cả các nghị quyết
 *    điều chỉnh sau ngày 01/7/2025). Tên xã, tỉnh mới lấy theo nguồn này, ghép theo mã đơn vị.
 *
 *   bun run dia-gioi:dung              # tải nguồn, dựng tệp, in các chỗ hai nguồn khác tên
 *   bun run dia-gioi:dung -- --kiem-tra  # chỉ đối chiếu, không ghi tệp
 *
 * Đổi commit nguồn thì sửa NGUON bên dưới, chạy lại, rồi cập nhật data/dia-gioi/README.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { diaGioi } from "@qdpl/dao-tao";

type DuLieu = diaGioi.DuLieuDiaGioi;

const GOC = join(import.meta.dir, "..");
const TEP_RA = join(GOC, "data", "dia-gioi", "dia-gioi.json");

const NGUON = {
  doiChieu: {
    ten: "vietnamadminunits (Trần Ngọc Minh Hiếu)",
    url: "https://github.com/tranngocminhhieu/vietnamadminunits",
    commit: "7fac8c45805aad9916b17237c54baf4502303b93",
    tep: "data/processed/convert_legacy_2025_with_location_and_default_ward.csv",
    giayPhep: "MIT",
    ghiChu:
      "Bảng đối chiếu tỉnh, huyện, xã trước ngày 01/7/2025 với tỉnh, xã sau sắp xếp; dựng từ danhmuchanhchinh.gso.gov.vn và sapnhap.bando.com.vn.",
  },
  danhMucMoi: {
    ten: "vietnamese-provinces-database (Lê Quốc Thắng)",
    url: "https://github.com/thanglequoc/vietnamese-provinces-database",
    commit: "8b78ba5118715e1fa81769286724db79346abf52",
    tep: "json/full_json_generated_data_vn_units.json",
    giayPhep: "MIT",
    ghiChu:
      "Danh mục tỉnh, xã hiện nay theo danhmuchanhchinh.gso.gov.vn, gồm các nghị quyết điều chỉnh sau ngày 01/7/2025.",
  },
};

const urlTho = (n: { url: string; commit: string; tep: string }) =>
  `${n.url.replace("https://github.com/", "https://raw.githubusercontent.com/")}/${n.commit}/${n.tep}`;

async function tai(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Không tải được ${url}: HTTP ${res.status}`);
  return res.text();
}

/** CSV theo RFC 4180 (trường có ngoặc kép, dấu phẩy, xuống dòng trong ngoặc). */
function docCsv(t: string): Record<string, string>[] {
  const dong: string[][] = [];
  let r: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      r.push(f);
      f = "";
    } else if (c === "\n") {
      r.push(f.replace(/\r$/, ""));
      dong.push(r);
      r = [];
      f = "";
    } else f += c;
  }
  if (f || r.length) {
    r.push(f);
    dong.push(r);
  }
  const [dau, ...than] = dong;
  if (!dau) return [];
  return than
    .filter((d) => d.length === dau.length)
    .map((d) => Object.fromEntries(dau.map((k, i) => [k, d[i] ?? ""])));
}

/** Mã đơn vị theo số chữ số chuẩn: "1.0" → "00001". */
const ma = (v: string, n: number) => (v ? String(Math.trunc(Number(v))).padStart(n, "0") : "");

/** Tọa độ làm tròn 5 chữ số (≈ 1 m), như ranh-gioi.json; ô trống thành NaN. */
const lamTron = (v: string) => (v ? Math.round(Number(v) * 1e5) / 1e5 : Number.NaN);

interface DonViNguon {
  Code: string;
  FullName: string;
  Wards?: DonViNguon[];
}

async function dung(): Promise<{ duLieu: DuLieu; khacTen: string[] }> {
  console.log("Tải danh mục hiện nay…");
  const danhMuc = JSON.parse(await tai(urlTho(NGUON.danhMucMoi))) as DonViNguon[];
  console.log("Tải bảng đối chiếu…");
  const doiChieu = docCsv(await tai(urlTho(NGUON.doiChieu)));

  const tinhMoi: diaGioi.TinhMoi[] = danhMuc.map((t) => ({ ma: t.Code, ten: diaGioi.dauKieuCu(t.FullName) }));
  const xaMoi: diaGioi.XaMoi[] = danhMuc.flatMap((t) =>
    (t.Wards ?? []).map((x) => ({ ma: x.Code, ten: diaGioi.dauKieuCu(x.FullName), tinh: t.Code })),
  );
  const mXaMoi = new Map(xaMoi.map((x) => [x.ma, x]));
  const mTinhMoi = new Map(tinhMoi.map((t) => [t.ma, t]));

  const tinhCu = new Map<string, diaGioi.TinhCu>();
  const huyenCu = new Map<string, diaGioi.HuyenCu>();
  const xaCu = new Map<string, diaGioi.XaCu & { macDinh?: string }>();
  const khacTen = new Set<string>();
  const loi: string[] = [];

  for (const d of doiChieu) {
    const maTinh = ma(d.provinceCode!, 2);
    const maHuyen = ma(d.districtCode!, 3);
    const maXa = ma(d.wardCode!, 5);
    const maMoi = ma(d.newWardCode!, 5);
    const moi = mXaMoi.get(maMoi);
    if (!moi) {
      loi.push(`Xã mới mã ${maMoi} (${d.newWard}) không có trong danh mục hiện nay.`);
      continue;
    }
    // Tên khác nhau ngoài cách đặt dấu: ghi lại để rà (đơn vị đổi loại hoặc tên sau 01/7/2025).
    const tinhMoiCuaXa = mTinhMoi.get(moi.tinh)!;
    if (diaGioi.khoaTim(moi.ten) !== diaGioi.khoaTim(d.newWard!))
      khacTen.add(`Xã ${maMoi}: "${d.newWard}" → "${moi.ten}" (${tinhMoiCuaXa.ten})`);
    if (diaGioi.khoaTim(tinhMoiCuaXa.ten) !== diaGioi.khoaTim(d.newProvince!))
      khacTen.add(`Tỉnh: "${d.newProvince}" → "${tinhMoiCuaXa.ten}"`);

    if (!tinhCu.has(maTinh)) tinhCu.set(maTinh, { ma: maTinh, ten: diaGioi.dauKieuCu(d.province!) });
    if (!huyenCu.has(maHuyen))
      huyenCu.set(maHuyen, { ma: maHuyen, ten: diaGioi.dauKieuCu(d.district!), tinh: maTinh });

    if (!maXa) {
      // Huyện đảo không chia xã: cả huyện nhập vào một đặc khu.
      const h = huyenCu.get(maHuyen)!;
      h.moi = [...new Set([...(h.moi ?? []), maMoi])];
      continue;
    }
    const x = xaCu.get(maXa) ?? { ma: maXa, ten: diaGioi.dauKieuCu(d.ward!), huyen: maHuyen, moi: [] };
    if (!x.moi.includes(maMoi)) x.moi.push(maMoi);
    const tam = [lamTron(d.wardLon!), lamTron(d.wardLat!)] as [number, number];
    if (tam.every(Number.isFinite)) x.tam = tam;
    if (d.isDefaultNewWard === "True") x.macDinh = maMoi;
    xaCu.set(maXa, x);
  }
  if (loi.length) throw new Error(loi.join("\n"));

  // Hai xã cũ cùng một tọa độ tâm là nguồn định vị nhầm (tên giống nhau khi bỏ dấu): bỏ tâm của cả hai.
  const soXaTheoTam = new Map<string, number>();
  for (const x of xaCu.values())
    if (x.tam) soXaTheoTam.set(`${x.tam}`, (soXaTheoTam.get(`${x.tam}`) ?? 0) + 1);

  // Xã mới chứa trung tâm xã cũ (theo nguồn) đứng đầu danh sách.
  const dsXaCu = [...xaCu.values()].map(({ macDinh, tam, ...x }) => ({
    ...x,
    moi: macDinh ? [macDinh, ...x.moi.filter((m) => m !== macDinh)] : x.moi,
    ...(tam && soXaTheoTam.get(`${tam}`) === 1 ? { tam } : {}),
  }));

  const duLieu: DuLieu = {
    phienBan: new Date().toISOString().slice(0, 10),
    nguon: Object.values(NGUON).map((n) => ({
      ten: n.ten,
      url: `${n.url}/tree/${n.commit}`,
      giayPhep: n.giayPhep,
      ghiChu: n.ghiChu,
    })),
    tinhMoi,
    xaMoi,
    tinhCu: [...tinhCu.values()],
    huyenCu: [...huyenCu.values()],
    xaCu: dsXaCu,
  };
  return { duLieu, khacTen: [...khacTen] };
}

function kiemTra(d: DuLieu): string[] {
  const loi: string[] = [];
  const bo = diaGioi.taoBoTra(d);
  const daDung = new Set([...d.xaCu.flatMap((x) => x.moi), ...d.huyenCu.flatMap((h) => h.moi ?? [])]);
  const thieu = d.xaMoi.filter((x) => !daDung.has(x.ma));
  if (thieu.length)
    loi.push(`${thieu.length} xã mới không có xã cũ nào: ${thieu.map((x) => x.ma).join(", ")}`);
  for (const t of d.tinhCu) {
    const kq = bo.chuyenTinh(t.ma);
    if (kq?.tinhMoi.length !== 1) loi.push(`Tỉnh cũ ${t.ten} ứng với ${kq?.tinhMoi.length ?? 0} tỉnh mới.`);
  }
  for (const h of d.huyenCu)
    if (!bo.dsXaCu(h.ma).length && !h.moi?.length)
      loi.push(`Huyện ${h.ma} ${h.ten} không có xã và không có đơn vị mới.`);
  return loi;
}

const chiKiemTra = process.argv.includes("--kiem-tra");
const { duLieu, khacTen } = await dung();
const loi = kiemTra(duLieu);

console.log(
  `Tỉnh cũ ${duLieu.tinhCu.length}, huyện cũ ${duLieu.huyenCu.length}, xã cũ ${duLieu.xaCu.length} ` +
    `(${duLieu.xaCu.filter((x) => x.moi.length > 1).length} xã bị chia, ` +
    `${duLieu.xaCu.filter((x) => x.tam).length} xã có tâm); ` +
    `tỉnh mới ${duLieu.tinhMoi.length}, xã mới ${duLieu.xaMoi.length}.`,
);
if (khacTen.length) {
  console.log(`\nHai nguồn khác tên ở ${khacTen.length} đơn vị (đã dùng tên của danh mục hiện nay):`);
  for (const k of khacTen.sort()) console.log(`  ${k}`);
}
if (loi.length) {
  console.error(`\nDữ liệu chưa đạt:\n  ${loi.join("\n  ")}`);
  process.exit(1);
}
if (!chiKiemTra) {
  mkdirSync(join(GOC, "data", "dia-gioi"), { recursive: true });
  // Mỗi đơn vị một dòng: tệp vẫn gọn mà lần dựng sau xem được khác biệt theo từng đơn vị.
  const khoi = Object.entries(duLieu).map(([k, v]) =>
    Array.isArray(v)
      ? `${JSON.stringify(k)}: [\n${v.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n]`
      : `${JSON.stringify(k)}: ${JSON.stringify(v)}`,
  );
  writeFileSync(TEP_RA, `{\n${khoi.join(",\n")}\n}\n`);
  console.log(`\nĐã ghi ${TEP_RA}.`);
}
