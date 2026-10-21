/**
 * Kiểm tra nội dung đào tạo trước khi xuất bản (ke-hoach/09-a §2, §11; QUY-TAC-HANH-VAN.md).
 *
 * Kiểm hai thứ trên cùng một lượt, vì cả hai đều chặn xuất bản:
 *  1. **Cấu trúc**: bài có thẻ căn cứ không, nhịp bài có quá dài không, rubric có tiêu chí
 *     `can_cu` nặng nhất không.
 *  2. **Hành văn**: tiểu từ tình thái, khẩu ngữ, số hiệu văn bản viết tắt, emoji, dấu chấm than.
 *
 * Soi cả lời thoại nhân vật đồng hành: nhân vật là một phần giao diện nên chịu cùng bộ quy tắc.
 *
 * Chạy:
 *   bun run scripts/kiem-tra-bai-hoc.ts                 # toàn bộ nội dung đã xuất bản
 *   bun run scripts/kiem-tra-bai-hoc.ts --tat-ca        # cả bản nháp
 *   bun run scripts/kiem-tra-bai-hoc.ts <slug-chuyen-de>
 *
 * Mã thoát 1 khi còn lỗi mức chặn — dùng được trong CI.
 */

import {
  KHOI_CHO_PHEP_VIET_TAT,
  type KhoiNoiDung,
  kiemTraBaiHoc,
  kiemTraRubric,
  type LoiHanhVan,
  soatCauTruc,
  soatChu,
} from "@qdpl/dao-tao";
import {
  baiHocCuaChuyenDe,
  chuyenDeTheoSlug,
  danhSachChuyenDe,
  danhSachHanhDong,
  hoatDongCuaBai,
  khoiCuaBai,
  sql,
} from "@qdpl/db";

const args = process.argv.slice(2);
const tatCa = args.includes("--tat-ca");
const slugLoc = args.find((a) => !a.startsWith("--"));

interface VanDe {
  o: string;
  muc: "loi" | "canh_bao";
  ma: string;
  thong_diep: string;
}

const vanDe: VanDe[] = [];
const them = (o: string, muc: "loi" | "canh_bao", ma: string, thong_diep: string) =>
  vanDe.push({ o, muc, ma, thong_diep });

const themHanhVan = (ds: LoiHanhVan[]) => {
  for (const l of ds) {
    them(l.o ?? "?", l.muc, `hanh_van.${l.ma}`, `§${l.muc_quy_tac} — "${l.trich}" · ${l.goi_y}`);
  }
};

/* ------------------------------------------------------------------ */
/* Nội dung đào tạo                                                    */
/* ------------------------------------------------------------------ */

const dsChuyenDe = slugLoc
  ? [await chuyenDeTheoSlug(slugLoc)].filter((c) => c !== undefined)
  : await danhSachChuyenDe({ chiXuatBan: !tatCa, limit: 500 });

if (slugLoc && dsChuyenDe.length === 0) {
  console.error(`Không có chuyên đề "${slugLoc}".`);
  process.exit(2);
}

let soBai = 0;
for (const cd of dsChuyenDe) {
  themHanhVan(soatChu(cd.title, `${cd.slug} › tiêu đề`));
  themHanhVan(soatChu(cd.summary ?? "", `${cd.slug} › tóm tắt`));

  const bai = await baiHocCuaChuyenDe(cd.id, !tatCa);
  for (const b of bai) {
    soBai++;
    const o = `${cd.slug} › ${b.slug}`;
    themHanhVan(soatChu(b.title, `${o} › tiêu đề`));
    themHanhVan(soatChu(b.summary ?? "", `${o} › tóm tắt`));

    const khoiRows = await khoiCuaBai(b.id);
    const khoi: KhoiNoiDung[] = khoiRows.map((k) => ({
      id: k.id,
      lessonId: k.lesson_id,
      ordinal: k.ordinal,
      kind: k.kind as KhoiNoiDung["kind"],
      data: k.data,
      citations: k.citations,
      citationHealth: k.citation_health as KhoiNoiDung["citationHealth"],
      source: k.source as KhoiNoiDung["source"],
      status: k.status as KhoiNoiDung["status"],
      modes: k.modes as KhoiNoiDung["modes"],
      note: k.note,
    }));

    // Cấu trúc và nhịp bài.
    for (const l of kiemTraBaiHoc(khoi).loi) {
      them(l.ordinal ? `${o} › khối ${l.ordinal}` : o, l.muc, `cau_truc.${l.ma}`, l.thong_diep);
    }
    // Hành văn của từng khối.
    for (const k of khoi) {
      themHanhVan(
        soatCauTruc(k.data, `${o} › khối ${k.ordinal} (${k.kind})`, {
          choPhepVietTat: KHOI_CHO_PHEP_VIET_TAT.has(k.kind),
        }),
      );
    }

    // Bài tập: đề bài và phản hồi đều là chữ người học đọc.
    for (const hd of await hoatDongCuaBai(b.id)) {
      const oHd = `${o} › bài tập ${hd.ordinal} (${hd.kind})`;
      themHanhVan(soatCauTruc(hd.prompt, oHd));
      // Đáp án không hiện ra, nhưng `giai_thich` trong đó thì có.
      themHanhVan(soatCauTruc((hd.answer as { giai_thich?: unknown }).giai_thich, `${oHd} › giải thích`));
      themHanhVan(
        soatCauTruc(
          (hd.answer as { phuong_an?: unknown[] }).phuong_an?.map((p) => ({
            giai_thich: (p as { giai_thich?: string }).giai_thich,
          })),
          `${oHd} › giải thích phương án`,
        ),
      );
      if (hd.mode === "ai" || hd.mode === "nguoi") {
        for (const l of kiemTraRubric(hd.rubric)) them(oHd, "loi", "rubric", l);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lời thoại nhân vật đồng hành                                        */
/* ------------------------------------------------------------------ */

const hanhDong = await danhSachHanhDong();
for (const hd of hanhDong) {
  const o = `mascot › ${hd.code}`;
  for (const [i, s] of (
    hd.speech as Array<{ text?: string; loai?: string; citations?: string[] }>
  ).entries()) {
    themHanhVan(soatChu(s.text ?? "", `${o} › lời ${i + 1}`));
    if (s.text && s.text.length > 140) {
      them(`${o} › lời ${i + 1}`, "loi", "loi_thoai_dai", `Lời thoại ${s.text.length} ký tự, vượt 140.`);
    }
    // §8.1 — nội dung pháp lý phải đi vào thẻ căn cứ kèm viện dẫn.
    if (s.loai === "loi_phap_ly" && !(s.citations?.length ?? 0)) {
      them(`${o} › lời ${i + 1}`, "loi", "loi_phap_ly_khong_can_cu", "Lời pháp lý nhưng chưa gắn viện dẫn.");
    }
  }
  themHanhVan(soatChu((hd.cta as { nhan?: string } | null)?.nhan ?? "", `${o} › nhãn nút`));
}

/* ------------------------------------------------------------------ */
/* Báo cáo                                                             */
/* ------------------------------------------------------------------ */

const loi = vanDe.filter((v) => v.muc === "loi");
const canhBao = vanDe.filter((v) => v.muc === "canh_bao");

console.log(
  `Đã soát ${dsChuyenDe.length} chuyên đề, ${soBai} bài học, ${hanhDong.length} hành động mascot` +
    `${tatCa ? " (gồm cả bản nháp)" : " (chỉ nội dung đã xuất bản)"}.`,
);

for (const nhom of [
  { ten: "LỖI (chặn xuất bản)", ds: loi },
  { ten: "Cảnh báo", ds: canhBao },
]) {
  if (!nhom.ds.length) continue;
  console.log(`\n${nhom.ten} — ${nhom.ds.length}`);
  for (const v of nhom.ds) console.log(`  ${v.o}\n    [${v.ma}] ${v.thong_diep}`);
}

if (!vanDe.length) console.log("\nKhông có vấn đề nào.");

await sql.end();
process.exit(loi.length ? 1 : 0);
