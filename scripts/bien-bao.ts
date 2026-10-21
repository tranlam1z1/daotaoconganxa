/**
 * Nạp biển báo (docs/PLAN.md GĐ12) từ data/bien-bao/bien-bao.json và ảnh trong data/bien-bao/anh/.
 *
 * Bốn bước, dừng ở bước đầu tiên có lỗi chặn:
 *   1. Kiểm tra hợp lệ tệp (mã, nhóm, trùng mã, dạng URN).
 *   2. Kiểm ảnh: mỗi biển có tệp ảnh, mỗi ảnh ≤ 20 KB (lưới biển báo phải tải nhanh trên 4G).
 *   3. Kiểm URN căn cứ có trong kho và còn áp dụng.
 *      - Biển `da_duyet` có URN hỏng: LỖI, không nạp.
 *      - Biển `nhap` có URN hỏng: chỉ cảnh báo. `--nghiem` thì coi là lỗi.
 *   4. Tải ảnh lên kho đối tượng (assets/bien-bao/…, R2 hoặc thư mục cục bộ) và nạp CSDL.
 *
 * Dùng:
 *   bun run bien-bao:nap               kiểm tra rồi nạp
 *   bun run bien-bao:nap --kiem-tra    chỉ kiểm tra, không ghi gì (bước CI)
 *   bun run bien-bao:nap --nghiem      URN hỏng ở biển bản nháp cũng là lỗi
 *   bun run bien-bao:nap --chap-nhan-trang-thai  lấy trạng thái ghi trong tệp (chỉ CSDL phát triển);
 *                                      mặc định biển mới hoặc đổi nội dung vào chờ duyệt (GĐ-G0)
 */
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { type BienBao, chuoiTimBienBao, KICH_THUOC_ANH_TOI_DA, kiemTraBienBao } from "@qdpl/dao-tao";
import { kiemTraCanCuTraCuu, napBienBao, sql } from "@qdpl/db";
import { putFromFile, storageLabel } from "@qdpl/storage";

const THU_MUC = join(import.meta.dir, "..", "data", "bien-bao");
const THU_MUC_ANH = join(THU_MUC, "anh");

/** URI của ảnh biển trong kho đối tượng. */
export const uriAnhBienBao = (tep: string) => `assets/bien-bao/${tep}`;

export async function docBienBao(): Promise<BienBao[]> {
  const tep = (await Bun.file(join(THU_MUC, "bien-bao.json")).json()) as { bien: BienBao[] };
  return tep.bien ?? [];
}

/** Ảnh thiếu hoặc quá cỡ. */
export async function kiemTraAnh(ds: BienBao[]): Promise<Array<{ ma: string; loi: string }>> {
  const loi: Array<{ ma: string; loi: string }> = [];
  for (const b of ds) {
    try {
      const s = await stat(join(THU_MUC_ANH, b.anh));
      if (s.size > KICH_THUOC_ANH_TOI_DA) {
        loi.push({ ma: b.ma, loi: `Ảnh ${b.anh} nặng ${Math.round(s.size / 1024)} KB, quá 20 KB` });
      }
    } catch {
      loi.push({ ma: b.ma, loi: `Thiếu ảnh ${b.anh} trong data/bien-bao/anh/` });
    }
  }
  return loi;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const chiKiemTra = args.includes("--kiem-tra");
  const nghiem = args.includes("--nghiem");
  const ngay = new Date().toISOString().slice(0, 10);

  const ds = await docBienBao();
  const soDuyet = ds.filter((b) => b.trang_thai === "da_duyet").length;
  console.log(`Đọc ${ds.length} biển báo (${soDuyet} đã duyệt, ${ds.length - soDuyet} bản nháp hoặc ngừng).`);

  const dung = async (ma: number) => {
    await sql.end();
    process.exit(ma);
  };

  // 1. Hợp lệ tệp
  const loiTep = kiemTraBienBao(ds);
  if (loiTep.length) {
    console.log(`\nDữ liệu không hợp lệ (${loiTep.length} lỗi):`);
    for (const l of loiTep) console.log(`  [${l.ma}] ${l.loi}`);
    await dung(1);
  }
  console.log("Tệp dữ liệu hợp lệ.");

  // 2. Ảnh
  const loiAnh = await kiemTraAnh(ds);
  console.log(`Ảnh: ${loiAnh.length} ảnh thiếu hoặc quá cỡ.`);
  if (loiAnh.length) {
    for (const l of loiAnh) console.log(`  [${l.ma}] ${l.loi}`);
    await dung(1);
  }

  // 3. URN căn cứ
  const urnDaDuyet = new Set(ds.filter((b) => b.trang_thai === "da_duyet").map((b) => b.can_cu));
  const hong = await kiemTraCanCuTraCuu([...new Set(ds.map((b) => b.can_cu))], ngay);
  const hongChan = hong.filter((h) => nghiem || urnDaDuyet.has(h.urn));
  console.log(`URN căn cứ: ${hong.length} URN hỏng (${hongChan.length} chặn nạp).`);
  for (const h of hong) {
    const soBien = ds.filter((b) => b.can_cu === h.urn).length;
    console.log(`  ${hongChan.includes(h) ? "LỖI" : "cảnh báo"} ${h.urn} (${soBien} biển): ${h.lyDo}`);
  }
  if (hongChan.length) await dung(1);

  if (chiKiemTra) {
    console.log("Chỉ kiểm tra (--kiem-tra): không ghi gì.");
    await dung(0);
  }

  // 4. Ảnh lên kho, rồi nạp CSDL
  for (const b of ds) await putFromFile(uriAnhBienBao(b.anh), join(THU_MUC_ANH, b.anh));
  console.log(`Đã tải ${ds.length} ảnh lên ${storageLabel()}.`);
  const n = await napBienBao(
    ds.map((b, i) => ({
      code: b.ma,
      group_name: b.nhom,
      name: b.ten,
      meaning: b.y_nghia,
      search_text: chuoiTimBienBao(b),
      image_uri: uriAnhBienBao(b.anh),
      citation_urn: b.can_cu,
      ordinal: b.thu_tu ?? i + 1,
      status: b.trang_thai,
      note: b.ghi_chu ?? null,
      reaction: b.phan_ung ?? null,
      reaction_note: b.ghi_chu_phan_ung ?? null,
    })),
    // Tệp chỉ là nguồn nhập; duyệt trong ứng dụng (docs/PLAN.md GĐ-G0).
    { cheDo: args.includes("--chap-nhan-trang-thai") ? "theo_tep" : "cho_duyet" },
  );
  console.log(`Đã nạp ${n} biển báo.`);
  await dung(0);
}
