/**
 * Sách nói (docs/PLAN.md GĐ14): lời đọc của từng khối bài giảng.
 *
 * Mỗi khối đọc thành một tệp âm thanh riêng, để trình phát nhảy được tới khối và nhớ vị trí
 * theo khối. Chỉ đọc khối có nội dung đọc được thành lời; khối tương tác thuần (bảng tính, sơ
 * đồ kéo thả, video, ảnh) bỏ qua, người học xem trên màn hình.
 */
import type { KhoiNoiDung } from "./types.ts";

/** Giới hạn độ dài một lời gửi đọc. Khối dài hơn bị cắt ở ranh giới câu gần nhất. */
export const TOI_DA_KY_TU_SACH_NOI = 1500;

const chuoi = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const mang = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const doiTuong = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Bỏ ký hiệu Markdown để máy không đọc "dấu sao", "dấu thăng". */
export function boMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~|]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function cau(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /[.!?:;…]$/.test(t) ? t : `${t}.`;
}

function cat(s: string): string {
  if (s.length <= TOI_DA_KY_TU_SACH_NOI) return s;
  const dau = s.slice(0, TOI_DA_KY_TU_SACH_NOI);
  const cuoi = Math.max(dau.lastIndexOf(". "), dau.lastIndexOf("\n"));
  return (cuoi > TOI_DA_KY_TU_SACH_NOI / 2 ? dau.slice(0, cuoi + 1) : dau).trim();
}

/** Lời đọc của một khối; chuỗi rỗng nghĩa là khối này không có trong sách nói. */
export function loiDocCuaKhoi(khoi: Pick<KhoiNoiDung, "kind" | "data">): string {
  const d = khoi.data;
  let loi: string[] = [];
  switch (khoi.kind) {
    case "giang":
      loi = [boMarkdown(chuoi(d.md))];
      break;
    case "can_cu":
      loi = [cau(`Căn cứ: ${chuoi(d.nhan)}`), chuoi(d.nguyen_van)];
      break;
    case "tom_tat":
      loi = ["Ghi nhớ.", ...mang(d.y).map((y) => cau(boMarkdown(chuoi(y))))];
      break;
    case "canh_bao":
      loi = ["Lưu ý.", boMarkdown(chuoi(d.md))];
      break;
    case "so_do_trinh_tu":
      loi = mang(d.buoc).map((b, i) => {
        const buoc = doiTuong(b);
        return cau(`Bước ${i + 1}: ${chuoi(buoc.nhan)}${chuoi(buoc.mo_ta) ? `. ${chuoi(buoc.mo_ta)}` : ""}`);
      });
      break;
    case "kich_ban":
      loi = mang(d.luot).map((l) => {
        const luot = doiTuong(l);
        return cau(`${chuoi(luot.vai)}: ${chuoi(luot.loi)}`);
      });
      break;
    case "the_lat":
      loi = mang(d.the).map((t) => {
        const the = doiTuong(t);
        return `${cau(chuoi(the.truoc))} ${cau(chuoi(the.sau))}`;
      });
      break;
    case "hoi_nhanh":
      // Chỉ đọc câu hỏi và các phương án; đáp án để người học tự chọn trên màn hình.
      loi = [
        cau(`Tự kiểm tra: ${chuoi(d.cau_hoi)}`),
        ...mang(d.phuong_an).map((p, i) =>
          cau(`Phương án ${String.fromCharCode(65 + i)}: ${chuoi(doiTuong(p).text)}`),
        ),
      ];
      break;
    default:
      return "";
  }
  return cat(
    loi
      .map((s) => s.trim())
      .filter((s) => s && s !== ".")
      .join("\n"),
  );
}
