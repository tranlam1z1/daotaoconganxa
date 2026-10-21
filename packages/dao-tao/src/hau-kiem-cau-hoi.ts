/**
 * Hậu kiểm câu hỏi do AI sinh (docs/PLAN.md GĐ8).
 *
 * Mọi bước ở đây là TẤT ĐỊNH, không nhờ mô hình tự kiểm:
 *  1. đọc kết quả của mô hình thành câu hỏi theo schema của GĐ3;
 *  2. câu phải qua `kiemTraCauHoi`, đúng loại được yêu cầu;
 *  3. câu phải có căn cứ, căn cứ nằm trong các điều khoản đã đưa cho mô hình, tồn tại và còn
 *     hiệu lực tại ngày soạn (tình trạng căn cứ do lớp CSDL tra rồi truyền vào);
 *  4. câu gần giống câu đã có (trigram trên `stem`) thì được đánh dấu, không bị loại.
 *
 * Câu qua hậu kiểm vẫn chỉ vào ngân hàng ở trạng thái `cho_duyet`. Hậu kiểm lọc bớt câu hỏng,
 * không thay người duyệt.
 */

import {
  kiemTraCauHoi,
  LOAI_CAU_HOI,
  type LoaiCauHoi,
  type NoiDungCauHoi,
  RUBRIC_TU_LUAN_MAC_DINH,
} from "./cau-hoi.ts";
import { kiemTraRubric } from "./grading.ts";
import type { Rubric } from "./types.ts";

/* ------------------------------------------------------------------ */
/* Tình trạng căn cứ                                                   */
/* ------------------------------------------------------------------ */

/** Tình trạng một URN căn cứ tại ngày soạn, do lớp CSDL tra. */
export type TinhTrangCanCu =
  | "hieu_luc"
  | "khong_ton_tai"
  | "chua_hieu_luc"
  | "het_hieu_luc"
  | "bai_bo"
  | "ngung_hieu_luc";

export const LY_DO_CAN_CU_HONG: Record<Exclude<TinhTrangCanCu, "hieu_luc">, string> = {
  khong_ton_tai: "không có trong kho",
  chua_hieu_luc: "chưa có hiệu lực tại ngày soạn",
  het_hieu_luc: "đã hết hiệu lực tại ngày soạn",
  bai_bo: "đã bị bãi bỏ",
  ngung_hieu_luc: "đang bị ngưng hiệu lực",
};

/**
 * Căn cứ có nằm trong ngữ cảnh đã đưa cho mô hình không: trùng một URN được đưa, là một phần
 * con của nó (khoản, điểm của điều được đưa), hoặc là chính văn bản chứa nó.
 */
export function trongNguCanh(urn: string, urnNguCanh: readonly string[]): boolean {
  return urnNguCanh.some((u) => urn === u || urn.startsWith(`${u}.`) || u.split("#")[0] === urn);
}

/* ------------------------------------------------------------------ */
/* So trùng bằng trigram                                               */
/* ------------------------------------------------------------------ */

/** Ngưỡng tương đồng trigram từ đó coi hai câu là gần giống. */
export const NGUONG_TRUNG_CAU_HOI = 0.6;

function chuanHoa(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tập trigram theo cách của pg_trgm: mỗi từ đệm hai dấu cách đầu, một dấu cách cuối. */
export function trigram(s: string): Set<string> {
  const ra = new Set<string>();
  for (const tu of chuanHoa(s).split(" ")) {
    if (!tu) continue;
    const d = `  ${tu} `;
    for (let i = 0; i + 3 <= d.length; i++) ra.add(d.slice(i, i + 3));
  }
  return ra;
}

/** Độ tương đồng trigram 0–1 (số trigram chung / số trigram hợp), như `similarity()` của pg_trgm. */
export function doTuongDong(a: string, b: string): number {
  const ta = trigram(a);
  const tb = trigram(b);
  if (!ta.size || !tb.size) return 0;
  let chung = 0;
  for (const t of ta) if (tb.has(t)) chung++;
  return chung / (ta.size + tb.size - chung);
}

/* ------------------------------------------------------------------ */
/* Đọc kết quả của mô hình                                             */
/* ------------------------------------------------------------------ */

function chuoi(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function danhSachMuc(x: unknown): Array<{ id: string; text: string }> | undefined {
  if (!Array.isArray(x)) return undefined;
  return x.map((m) => ({ id: chuoi((m as any)?.id), text: chuoi((m as any)?.text) }));
}

function mangChuoi(x: unknown): string[] | undefined {
  return Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean) : undefined;
}

/**
 * Rubric câu tự luận mô hình đề xuất. Không đọc được hoặc không hợp lệ (thiếu tiêu chí căn cứ,
 * căn cứ không nặng nhất...) thì dùng rubric mặc định: câu tốt không bị loại chỉ vì rubric, và
 * người duyệt vẫn sửa được rubric trước khi duyệt.
 */
function docRubric(x: unknown): Rubric {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const tieuChi = Array.isArray(o.tieu_chi)
    ? (o.tieu_chi as Array<Record<string, unknown>>)
        .filter((tc) => tc && typeof tc === "object")
        .map((tc) => ({
          ma: chuoi(tc.ma),
          ten: chuoi(tc.ten),
          trong_so: Number(tc.trong_so) || 0,
          muc: (Array.isArray(tc.muc) ? (tc.muc as Array<Record<string, unknown>>) : [])
            .filter((m) => m && typeof m === "object" && Number.isFinite(Number(m.diem)))
            .map((m) => ({ diem: Number(m.diem), mo_ta: chuoi(m.mo_ta) })),
        }))
    : [];
  const nguong = Number(o.nguong_dat);
  const rubric: Rubric = {
    tieu_chi: tieuChi,
    nguong_dat: Number.isFinite(nguong) ? nguong : RUBRIC_TU_LUAN_MAC_DINH.nguong_dat,
  };
  return kiemTraRubric(rubric).length ? RUBRIC_TU_LUAN_MAC_DINH : rubric;
}

/**
 * Đọc JSON mô hình trả về (`{ cau_hoi: [...] }` hoặc một mảng) thành câu hỏi. Chỉ đổi dạng;
 * kiểm tra hợp lệ nằm ở `hauKiemCauHoiAi`. Phần tử không phải object bị bỏ, kèm lý do.
 */
export function docCauHoiAi(json: unknown): { cau: NoiDungCauHoi[]; loi: string[] } {
  const ds = Array.isArray(json) ? json : (json as { cau_hoi?: unknown } | null)?.cau_hoi;
  if (!Array.isArray(ds)) return { cau: [], loi: ["Kết quả của mô hình không có danh sách cau_hoi"] };
  const cau: NoiDungCauHoi[] = [];
  const loi: string[] = [];
  ds.forEach((x, i) => {
    if (!x || typeof x !== "object") {
      loi.push(`Phần tử thứ ${i + 1} không phải câu hỏi`);
      return;
    }
    const o = x as Record<string, any>;
    if (chuoi(o.kind) === "tu_luan") {
      // Câu tự luận không có phương án hay đáp án máy; `explanation` là đáp án gợi ý.
      cau.push({
        kind: "tu_luan",
        level: chuoi(o.level) as NoiDungCauHoi["level"],
        stem: chuoi(o.stem),
        options: {},
        answer: {},
        explanation: chuoi(o.explanation) || null,
        citations: mangChuoi(o.citations) ?? [],
        rubric: docRubric(o.rubric),
      });
      return;
    }
    const op = (o.options ?? {}) as Record<string, unknown>;
    const an = (o.answer ?? {}) as Record<string, unknown>;
    const oTrong =
      an.o_trong && typeof an.o_trong === "object"
        ? Object.fromEntries(
            Object.entries(an.o_trong as Record<string, unknown>).map(([k, v]) => [
              k,
              mangChuoi(Array.isArray(v) ? v : [v]) ?? [],
            ]),
          )
        : undefined;
    cau.push({
      kind: chuoi(o.kind) as LoaiCauHoi,
      level: chuoi(o.level) as NoiDungCauHoi["level"],
      stem: chuoi(o.stem),
      options: {
        ...(danhSachMuc(op.phuong_an) ? { phuong_an: danhSachMuc(op.phuong_an) } : {}),
        ...(danhSachMuc(op.trai) ? { trai: danhSachMuc(op.trai) } : {}),
        ...(danhSachMuc(op.phai) ? { phai: danhSachMuc(op.phai) } : {}),
      },
      answer: {
        ...(mangChuoi(an.dung) ? { dung: mangChuoi(an.dung) } : {}),
        ...(mangChuoi(an.thu_tu) ? { thu_tu: mangChuoi(an.thu_tu) } : {}),
        ...(an.cap && typeof an.cap === "object"
          ? {
              cap: Object.fromEntries(
                Object.entries(an.cap as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
              ),
            }
          : {}),
        ...(oTrong ? { o_trong: oTrong } : {}),
      },
      explanation: chuoi(o.explanation) || null,
      citations: mangChuoi(o.citations) ?? [],
    });
  });
  return { cau, loi };
}

/* ------------------------------------------------------------------ */
/* Hậu kiểm                                                            */
/* ------------------------------------------------------------------ */

export interface CauDaCo {
  id: string;
  code?: string;
  stem: string;
}

export interface NguCanhHauKiem {
  /** Loại câu được yêu cầu; câu khác loại bị loại. Rỗng là mọi loại. */
  loaiDuocPhep: readonly LoaiCauHoi[];
  /** URN các điều khoản đã đưa cho mô hình. */
  urnNguCanh: readonly string[];
  /** Tình trạng từng URN căn cứ tại ngày soạn. URN không có trong map coi như không tồn tại. */
  canCu: ReadonlyMap<string, TinhTrangCanCu>;
  /** Câu đã có trong ngân hàng, gần giống các câu đang kiểm (lớp CSDL lọc sơ bằng pg_trgm). */
  cauDaCo: readonly CauDaCo[];
  nguong?: number;
  /** Loại hẳn câu gần giống câu đã có, thay vì nhận kèm đánh dấu. */
  loaiCauTrung?: boolean;
}

export interface KetQuaHauKiem {
  cau: NoiDungCauHoi;
  nhan: boolean;
  /** Lý do loại, tiếng Việt. Rỗng khi câu được nhận. */
  lyDo: string[];
  /** Câu đã có trong ngân hàng mà câu này gần giống. */
  trungVoi?: CauDaCo & { doTuongDong: number };
  /** Chỉ số của câu được nhận TRƯỚC trong cùng lô mà câu này gần giống. */
  trungTrongLo?: number;
}

/**
 * Hậu kiểm từng câu. Câu bị loại khi không hợp lệ, sai loại, không có căn cứ, căn cứ ngoài
 * ngữ cảnh hoặc căn cứ không còn hiệu lực. Câu gần giống câu đã có (hoặc câu đứng trước trong
 * cùng lô) bị loại khi `loaiCauTrung`; không thì vẫn được nhận, kèm đánh dấu để người duyệt
 * quyết định.
 */
export function hauKiemCauHoiAi(ds: readonly NoiDungCauHoi[], ng: NguCanhHauKiem): KetQuaHauKiem[] {
  const nguong = ng.nguong ?? NGUONG_TRUNG_CAU_HOI;
  const ra: KetQuaHauKiem[] = [];
  for (const cau of ds) {
    const lyDo = [...kiemTraCauHoi(cau)];
    if (LOAI_CAU_HOI.includes(cau.kind) && ng.loaiDuocPhep.length && !ng.loaiDuocPhep.includes(cau.kind)) {
      lyDo.push(`Loại câu "${cau.kind}" không nằm trong các loại được yêu cầu`);
    }
    if (!cau.citations.length) lyDo.push("Câu không có căn cứ");
    for (const urn of new Set(cau.citations)) {
      if (!trongNguCanh(urn, ng.urnNguCanh)) {
        lyDo.push(`Căn cứ ${urn} nằm ngoài các điều khoản đã chọn`);
        continue;
      }
      const tt = ng.canCu.get(urn) ?? "khong_ton_tai";
      if (tt !== "hieu_luc") lyDo.push(`Căn cứ ${urn} ${LY_DO_CAN_CU_HONG[tt]}`);
    }

    const kq: KetQuaHauKiem = { cau, nhan: lyDo.length === 0, lyDo };
    if (kq.nhan) {
      let tot: (CauDaCo & { doTuongDong: number }) | undefined;
      for (const c of ng.cauDaCo) {
        const d = doTuongDong(cau.stem, c.stem);
        if (d >= nguong && (!tot || d > tot.doTuongDong))
          tot = { ...c, doTuongDong: Math.round(d * 1000) / 1000 };
      }
      if (tot) kq.trungVoi = tot;
      else {
        const i = ra.findIndex((r) => r.nhan && doTuongDong(cau.stem, r.cau.stem) >= nguong);
        if (i >= 0) kq.trungTrongLo = i;
      }
      if (ng.loaiCauTrung) {
        if (kq.trungVoi) lyDo.push(`Gần giống câu ${kq.trungVoi.code ?? "đã có"} trong ngân hàng`);
        else if (kq.trungTrongLo !== undefined) lyDo.push("Gần giống một câu khác trong cùng lượt sinh");
        kq.nhan = lyDo.length === 0;
      }
    }
    ra.push(kq);
  }
  return ra;
}
