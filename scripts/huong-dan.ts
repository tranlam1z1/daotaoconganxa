/**
 * Tài liệu hướng dẫn sử dụng: bộ bảo vệ, chụp hình minh hoạ, dựng PDF.
 *
 *   bun run huong-dan:kiem-tra                        # bài nào cần cập nhật, trang nào chưa có hướng dẫn
 *   bun run huong-dan:cap-nhat                        # chỉ chụp lại bài có giao diện/kịch bản đổi, rồi dựng PDF nếu cần
 *   bun run huong-dan:cap-nhat -- --bai tim-kiem,hoi-dap
 *   bun run huong-dan:cap-nhat -- --tat-ca            # chụp lại toàn bộ
 *   bun run huong-dan:cap-nhat -- --khong-pdf         # chỉ chụp, chưa dựng PDF
 *   bun run huong-dan:pdf                             # dựng lại PDF từ lời văn và ảnh hiện có
 *   bun run scripts/huong-dan.ts xac-nhan <bai>       # đã rà soát lời văn sau khi giao diện đổi
 *   bun run scripts/huong-dan.ts tao-bai <bai> <routes/x.tsx> [--chuong <id>]
 *
 * Chụp hình cần web đang chạy; mặc định hồ sơ thu (`bun run thu`), đổi bằng --co-so hoặc
 * HUONG_DAN_CO_SO. Hình cần đăng nhập dùng tài khoản minh hoạ riêng (scripts/huong-dan/phien.ts),
 * hoặc phiên đặt trong HUONG_DAN_TOKEN.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { portFor } from "@qdpl/config";

import type { Khoa, KhoHuongDan, MetaBai, MucLuc } from "../apps/web/app/lib/huong-dan.ts";
import { type BaoCao, danhGia, NHAN_LY_DO, tepAnh, tinhChuKyPdf } from "./huong-dan/bao-ve.ts";
import { chupAnh, moTrinhDuyet } from "./huong-dan/chup.ts";
import {
  docJson,
  docKho,
  docKhoa,
  ghiJson,
  ghiKhoa,
  TEP_MUC_LUC,
  TEP_PDF,
  THU_MUC_ANH,
  THU_MUC_BAI,
} from "./huong-dan/kho.ts";
import { bam, dacDiemGiaoDien, docCayRoute, GOC, THU_MUC_APP } from "./huong-dan/nguon.ts";
import { dungPdf } from "./huong-dan/pdf.ts";
import { layPhien } from "./huong-dan/phien.ts";

const [lenh = "kiem-tra", ...thamSo] = process.argv.slice(2);
const laCo = (ten: string) => thamSo.includes(`--${ten}`);
const giaTri = (ten: string) => {
  const i = thamSo.indexOf(`--${ten}`);
  return i >= 0 ? thamSo[i + 1] : undefined;
};

function inBaoCao(bc: BaoCao, kho: KhoHuongDan): boolean {
  let coVanDe = false;
  const soHinh = kho.dsBai.reduce((n, b) => n + b.anh.length, 0);
  console.log(`Hướng dẫn sử dụng: ${kho.dsBai.length} bài, ${soHinh} hình minh hoạ.`);

  if (bc.routeChuaCo.length) {
    coVanDe = true;
    console.log("\nTrang có giao diện nhưng chưa có bài hướng dẫn:");
    for (const r of bc.routeChuaCo) {
      console.log(`  - ${r.file} (${r.duongDan})`);
      console.log(`      tạo khung bài: bun run scripts/huong-dan.ts tao-bai <id-bai> ${r.file}`);
    }
  }
  if (bc.loiNoiDung.length) {
    coVanDe = true;
    console.log("\nLỗi nội dung hướng dẫn:");
    for (const l of bc.loiNoiDung) console.log(`  - ${l}`);
  }
  const canChup = bc.bai.filter((d) => d.canChup.length);
  if (canChup.length) {
    coVanDe = true;
    console.log("\nBài cần chụp lại hình (chỉ các bài này được phát sinh lại):");
    for (const d of canChup) {
      console.log(`  - ${d.bai.so} ${d.bai.id}: ${d.canChup.map((l) => NHAN_LY_DO[l]).join("; ")}`);
      for (const x of d.them.slice(0, 12)) console.log(`      + ${x}`);
      for (const x of d.bot.slice(0, 12)) console.log(`      - ${x}`);
      const conLai = Math.max(0, d.them.length - 12) + Math.max(0, d.bot.length - 12);
      if (conLai) console.log(`      … và ${conLai} thay đổi khác`);
    }
  }
  const chiLoiVan = bc.bai.filter((d) => !d.canChup.length && d.noiDungDoi);
  if (chiLoiVan.length) {
    coVanDe = true;
    console.log("\nBài chỉ đổi lời văn (không chụp lại, chỉ dựng lại PDF):");
    for (const d of chiLoiVan) console.log(`  - ${d.bai.so} ${d.bai.id}`);
  }
  const choRaSoat = bc.bai.filter((d) => d.choRaSoat);
  if (choRaSoat.length) {
    console.log("\nCảnh báo: hình đã chụp lại theo giao diện mới, lời văn chưa được rà soát:");
    for (const d of choRaSoat) {
      console.log(
        `  - ${d.bai.so} ${d.bai.id} — sửa ${d.bai.id}.md, hoặc: bun run scripts/huong-dan.ts xac-nhan ${d.bai.id}`,
      );
    }
  }
  if (bc.pdfCu) {
    coVanDe = true;
    console.log("\nBản PDF chưa khớp nội dung hiện tại.");
  }
  if (!coVanDe) console.log("Tài liệu hướng dẫn khớp với giao diện hiện tại.");
  return coVanDe;
}

async function kiemTraCoSo(coSo: string): Promise<void> {
  try {
    const r = await fetch(coSo, { signal: AbortSignal.timeout(30_000) });
    if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new Error(
      `Không mở được ${coSo} (${e instanceof Error ? e.message : e}). Chạy web trước: bun run thu, hoặc chỉ định --co-so.`,
    );
  }
}

async function capNhatPdf(kho: KhoHuongDan, khoa: Khoa, epBuoc: boolean): Promise<boolean> {
  const chuKy = tinhChuKyPdf(kho);
  if (!epBuoc && khoa.pdf?.chu_ky === chuKy && existsSync(TEP_PDF)) {
    console.log("Bản PDF đã khớp nội dung, không dựng lại.");
    return true;
  }
  const thieuAnh = kho.dsBai.flatMap((b) =>
    b.anh.filter((kb) => !existsSync(tepAnh(kb.ten))).map((kb) => kb.ten),
  );
  if (thieuAnh.length) {
    // Vẫn dựng: hình thiếu hiện ô "đang được cập nhật", còn bộ bảo vệ tiếp tục báo các bài này cần chụp.
    console.warn(`Cảnh báo: ${thieuAnh.length} hình chưa chụp được, PDF hiện ô chờ: ${thieuAnh.join(", ")}.`);
  }
  console.log("Dựng bản PDF…");
  const browser = await moTrinhDuyet();
  try {
    const ngay = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
    const { bytes, soTrang } = await dungPdf(browser, kho, ngay);
    mkdirSync(dirname(TEP_PDF), { recursive: true });
    writeFileSync(TEP_PDF, bytes);
    khoa.pdf = { chu_ky: chuKy, tao_luc: new Date().toISOString(), so_trang: soTrang, sha: bam(bytes) };
    ghiKhoa(khoa);
    console.log(`Đã ghi ${TEP_PDF}: ${soTrang} trang, ${(bytes.length / 1024 / 1024).toFixed(1)} MB.`);
    return true;
  } finally {
    await browser.close();
  }
}

async function capNhat(): Promise<number> {
  const { kho, baiCoTep } = docKho();
  const khoa = docKhoa();
  const cay = await docCayRoute();
  const bc = danhGia(kho, baiCoTep, khoa, cay);
  inBaoCao(bc, kho);

  const chiDinh = giaTri("bai")?.split(",").filter(Boolean);
  const tatCa = laCo("tat-ca");
  for (const id of chiDinh ?? []) {
    if (!kho.dsBai.some((b) => b.id === id)) throw new Error(`Không có bài "${id}" trong mục lục.`);
  }
  const canChup = bc.bai.filter((d) =>
    tatCa ? true : chiDinh ? chiDinh.includes(d.bai.id) : d.canChup.length > 0,
  );

  let loi = 0;
  if (canChup.length) {
    const coSo =
      giaTri("co-so") ?? process.env.HUONG_DAN_CO_SO ?? `http://127.0.0.1:${portFor("web", "thu")}`;
    await kiemTraCoSo(coSo);
    mkdirSync(THU_MUC_ANH, { recursive: true });
    const phien = canChup.some((d) => d.bai.anh.some((kb) => kb.dang_nhap)) ? await layPhien() : null;
    const browser = await moTrinhDuyet();
    try {
      console.log(`\nChụp hình từ ${coSo}:`);
      for (const d of canChup) {
        console.log(`  ${d.bai.so} ${d.bai.id} (${d.bai.anh.length} hình)`);
        try {
          const anh: Record<string, string> = {};
          for (const kb of d.bai.anh) {
            await chupAnh(browser, { coSo, kb, tepRa: tepAnh(kb.ten), tokenPhien: phien?.token });
            anh[kb.ten] = bam(readFileSync(tepAnh(kb.ten)));
            console.log(`    đã chụp ${kb.ten}`);
          }
          const cu = khoa.bai[d.bai.id];
          const giaoDienDoi = Boolean(cu && cu.giao_dien !== d.hienTai.giao_dien);
          khoa.bai[d.bai.id] = {
            ...d.hienTai,
            anh,
            chup_luc: new Date().toISOString(),
            cho_ra_soat: giaoDienDoi
              ? { them: d.them, bot: d.bot, noi_dung_luc_chup: d.hienTai.noi_dung }
              : d.choRaSoat
                ? (cu?.cho_ra_soat ?? null)
                : null,
          };
          // Ghi sau từng bài: lần chạy bị ngắt giữa chừng không phải chụp lại phần đã xong.
          ghiKhoa(khoa);
        } catch (e) {
          loi++;
          console.error(`    LỖI: ${e instanceof Error ? e.message : e}`);
        }
      }
    } finally {
      await browser.close();
      await phien?.thuHoi();
    }
  }

  const idTrongMucLuc = new Set(kho.dsBai.map((b) => b.id));
  for (const d of bc.bai) {
    const k = khoa.bai[d.bai.id];
    if (!k || canChup.includes(d) || d.canChup.length) continue;
    if (d.noiDungDoi) {
      k.noi_dung = d.hienTai.noi_dung;
      if (k.cho_ra_soat && k.cho_ra_soat.noi_dung_luc_chup !== d.hienTai.noi_dung) k.cho_ra_soat = null;
    }
  }
  for (const id of Object.keys(khoa.bai)) if (!idTrongMucLuc.has(id)) delete khoa.bai[id];
  const tenAnh = new Set(kho.dsBai.flatMap((b) => b.anh.map((kb) => kb.ten)));
  for (const tep of existsSync(THU_MUC_ANH) ? readdirSync(THU_MUC_ANH) : []) {
    if (tep.endsWith(".png") && !tenAnh.has(tep.slice(0, -4))) {
      rmSync(join(THU_MUC_ANH, tep));
      console.log(`Đã xoá ảnh không còn dùng: ${tep}`);
    }
  }
  ghiKhoa(khoa);

  let pdfOk = true;
  if (!laCo("khong-pdf")) pdfOk = await capNhatPdf(kho, khoa, tatCa);
  return loi || bc.routeChuaCo.length || bc.loiNoiDung.length || !pdfOk ? 1 : 0;
}

function taoBai(): number {
  const [id, route] = thamSo.filter((x) => !x.startsWith("--"));
  if (!id || !route || !/^[a-z0-9-]+$/.test(id)) {
    console.error("Cú pháp: bun run scripts/huong-dan.ts tao-bai <id-bai> <routes/x.tsx> [--chuong <id>]");
    return 1;
  }
  const tepMeta = join(THU_MUC_BAI, `${id}.json`);
  const tepMd = join(THU_MUC_BAI, `${id}.md`);
  if (existsSync(tepMeta) || existsSync(tepMd)) {
    console.error(`Bài "${id}" đã có.`);
    return 1;
  }
  if (!existsSync(join(THU_MUC_APP, route))) {
    console.error(`Không có tệp apps/web/app/${route}.`);
    return 1;
  }
  const mucLuc = docJson<MucLuc>(TEP_MUC_LUC);
  const chuong = mucLuc.chuong.find((c) => c.id === (giaTri("chuong") ?? mucLuc.chuong.at(-1)?.id));
  if (!chuong) {
    console.error("Không tìm thấy chương để đưa bài vào.");
    return 1;
  }
  const meta: MetaBai = {
    tieu_de: "Tiêu đề bài",
    tom_tat: "Tóm tắt một câu về trang.",
    routes: [route],
    anh: [
      {
        ten: `${id}-tong-quan`,
        chu_thich: "Chú thích hình",
        url: "/",
        danh_dau: [{ o: "main h1", ghi_chu: "Ghi chú cho vùng được khoanh" }],
      },
    ],
  };
  const dacDiem = dacDiemGiaoDien(readFileSync(join(THU_MUC_APP, route), "utf8"));
  mkdirSync(THU_MUC_BAI, { recursive: true });
  ghiJson(tepMeta, meta);
  writeFileSync(
    tepMd,
    `Nội dung đang biên soạn.\n\n![Chú thích hình](anh:${id}-tong-quan)\n\n<!--\nThành phần giao diện của trang (cần được mô tả):\n${dacDiem.map((x) => `- ${x}`).join("\n")}\n-->\n`,
  );
  chuong.bai.push(id);
  ghiJson(TEP_MUC_LUC, mucLuc);
  console.log(`Đã tạo ${tepMeta} và ${tepMd}, thêm vào chương "${chuong.tieu_de}".`);
  return 0;
}

/** Chụp thử hình của một vài bài vào data/work, không ghi khoa.json và không đụng ảnh chính thức. */
async function xemTruoc(): Promise<number> {
  const ids = thamSo.filter((x, i) => !x.startsWith("--") && !thamSo[i - 1]?.startsWith("--"));
  const chiAnh = giaTri("anh")?.split(",").filter(Boolean);
  const { kho } = docKho();
  const dsBai = kho.dsBai.filter((b) => ids.includes(b.id));
  if (!dsBai.length) {
    console.error("Cú pháp: bun run scripts/huong-dan.ts xem-truoc <bai>[ <bai>…] [--anh ten1,ten2]");
    return 1;
  }
  const thuMuc = join(GOC, "data/work/huong-dan/xem-truoc");
  mkdirSync(thuMuc, { recursive: true });
  const coSo = giaTri("co-so") ?? process.env.HUONG_DAN_CO_SO ?? `http://127.0.0.1:${portFor("web", "thu")}`;
  await kiemTraCoSo(coSo);
  const dsKichBan = dsBai.flatMap((b) => b.anh).filter((kb) => !chiAnh || chiAnh.includes(kb.ten));
  const phien = dsKichBan.some((kb) => kb.dang_nhap) ? await layPhien() : null;
  const browser = await moTrinhDuyet();
  let loi = 0;
  try {
    for (const kb of dsKichBan) {
      const tep = join(thuMuc, `${kb.ten}.png`);
      try {
        await chupAnh(browser, { coSo, kb, tepRa: tep, tokenPhien: phien?.token });
        console.log(`Đã chụp: ${tep}`);
      } catch (e) {
        loi++;
        console.error(`LỖI ${kb.ten}: ${e instanceof Error ? e.message : e}`);
      }
    }
  } finally {
    await browser.close();
    await phien?.thuHoi();
  }
  return loi ? 1 : 0;
}

async function chay(): Promise<number> {
  switch (lenh) {
    case "xem-truoc":
      return await xemTruoc();
    case "kiem-tra": {
      const { kho, baiCoTep } = docKho();
      const bc = danhGia(kho, baiCoTep, docKhoa(), await docCayRoute());
      return inBaoCao(bc, kho) ? 1 : 0;
    }
    case "cap-nhat":
      return await capNhat();
    case "pdf": {
      const { kho } = docKho();
      return (await capNhatPdf(kho, docKhoa(), true)) ? 0 : 1;
    }
    case "xac-nhan": {
      const id = thamSo[0];
      const khoa = docKhoa();
      const k = id ? khoa.bai[id] : undefined;
      if (!k) {
        console.error(`Không có bài "${id}" trong khoa.json.`);
        return 1;
      }
      k.cho_ra_soat = null;
      ghiKhoa(khoa);
      console.log(`Đã xác nhận lời văn bài "${id}" khớp giao diện mới.`);
      return 0;
    }
    case "tao-bai":
      return taoBai();
    default:
      console.error(
        `Lệnh không hợp lệ: ${lenh}. Dùng: kiem-tra | cap-nhat | pdf | xem-truoc | xac-nhan | tao-bai`,
      );
      return 1;
  }
}

try {
  process.exit(await chay());
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
