/**
 * Hậu kiểm bài học và bài tập do AI soạn (ke-hoach/09-a §5), trước khi quản trị viên nội dung nhận vào
 * bản nháp.
 *
 * Cùng tinh thần với hau-kiem-cau-hoi.ts: mọi bước là TẤT ĐỊNH, không nhờ mô hình tự kiểm.
 *  1. đọc kết quả của mô hình thành khối nội dung / bài tập;
 *  2. khối phải là loại trang bài giảng dựng được và đủ trường (`kiemTraKhoi`);
 *  3. viện dẫn phải nằm trong ngữ cảnh đã đưa cho mô hình và còn hiệu lực tại ngày soạn;
 *  4. khối `can_cu` phải trích ĐÚNG NGUYÊN VĂN điều khoản: đối chiếu chuỗi, không đối chiếu ý;
 *  5. bài tập không được để lộ đáp án trong phần đề gửi cho người học.
 *
 * Khối và bài tập qua hậu kiểm vẫn chỉ vào bản nháp; bài chỉ tới người học khi duyệt xuất bản.
 */

import { KHOI_BAI_GIANG, kiemTraKhoi } from "./blocks.ts";
import { kiemTraRubric } from "./grading.ts";
import { LY_DO_CAN_CU_HONG, type TinhTrangCanCu, trongNguCanh } from "./hau-kiem-cau-hoi.ts";
import { BAI_TAP_THEO_KIND, type LoaiBaiTap, type LoaiKhoi } from "./types.ts";

/* ------------------------------------------------------------------ */
/* Dùng chung                                                          */
/* ------------------------------------------------------------------ */

export interface NguCanhBaiHoc {
  /** URN các điều khoản đã đưa cho mô hình. */
  urnNguCanh: readonly string[];
  /** Tình trạng từng URN viện dẫn tại ngày soạn. URN không có trong map coi như không tồn tại. */
  canCu: ReadonlyMap<string, TinhTrangCanCu>;
}

export interface BiLoai {
  /** Vị trí (từ 1) trong kết quả của mô hình. */
  viTri: number;
  kind: string;
  lyDo: string[];
}

function chuoi(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function mangChuoi(x: unknown): string[] {
  return Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean) : [];
}

function laObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** Lý do loại vì viện dẫn: thiếu, ngoài ngữ cảnh, hoặc không còn hiệu lực. */
function loiVienDan(citations: readonly string[], ng: NguCanhBaiHoc): string[] {
  const loi: string[] = [];
  for (const urn of new Set(citations)) {
    if (!trongNguCanh(urn, ng.urnNguCanh)) {
      loi.push(`Viện dẫn ${urn} nằm ngoài các điều khoản đã chọn`);
      continue;
    }
    const tt = ng.canCu.get(urn) ?? "khong_ton_tai";
    if (tt !== "hieu_luc") loi.push(`Viện dẫn ${urn} ${LY_DO_CAN_CU_HONG[tt]}`);
  }
  return loi;
}

/* ------------------------------------------------------------------ */
/* Khối nội dung                                                       */
/* ------------------------------------------------------------------ */

export interface KhoiAi {
  kind: string;
  data: Record<string, unknown>;
  citations: string[];
}

/**
 * Đọc JSON mô hình trả về (`{ khoi: [...] }` hoặc một mảng) thành khối. Khối viết phẳng (trường
 * nằm ngay cạnh `kind`, không gói trong `data`) cũng đọc được. Chỉ đổi dạng; kiểm tra nằm ở
 * `hauKiemKhoiAi`.
 */
export function docKhoiAi(json: unknown): { khoi: KhoiAi[]; loi: string[] } {
  const ds = Array.isArray(json) ? json : laObject(json) ? json.khoi : undefined;
  if (!Array.isArray(ds)) return { khoi: [], loi: ["Kết quả của mô hình không có danh sách khoi"] };
  const khoi: KhoiAi[] = [];
  const loi: string[] = [];
  ds.forEach((x, i) => {
    if (!laObject(x)) {
      loi.push(`Phần tử thứ ${i + 1} không phải khối nội dung`);
      return;
    }
    const { kind, data, citations, ...phang } = x;
    const d = laObject(data) ? data : phang;
    const cit = mangChuoi(citations);
    // Thẻ căn cứ luôn viện dẫn chính điều khoản nó trích, kể cả khi mô hình quên ghi.
    const urn = chuoi(d.urn);
    if (chuoi(kind) === "can_cu" && urn && !cit.includes(urn)) cit.unshift(urn);
    khoi.push({ kind: chuoi(kind), data: d, citations: cit });
  });
  return { khoi, loi };
}

/**
 * Chuẩn hoá để so nguyên văn: bỏ dấu định dạng Markdown, ngoặc kép và dấu lửng ở hai đầu, gộp
 * khoảng trắng. Không bỏ dấu tiếng Việt và không đổi chữ hoa/thường: đó là nội dung.
 */
export function chuanHoaNguyenVan(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["“”'‘’…]+|["“”'‘’…]+$/g, "")
    .replace(/(\.\.\.|…)$/, "")
    .trim();
}

/** Độ dài tối thiểu của một trích dẫn nguyên văn, để "a)" hay "Điều 5." không lọt qua. */
const NGUYEN_VAN_TOI_THIEU = 12;

/** Trích dẫn có phải là một đoạn liền của điều khoản chứa nó (hoặc chính nó) trong ngữ cảnh không. */
export function dungNguyenVan(urn: string, trich: string, nguyenVan: ReadonlyMap<string, string>): boolean {
  const t = chuanHoaNguyenVan(trich);
  if (t.length < NGUYEN_VAN_TOI_THIEU) return false;
  for (const [u, text] of nguyenVan) {
    if (urn === u || urn.startsWith(`${u}.`)) {
      if (chuanHoaNguyenVan(text).includes(t)) return true;
    }
  }
  return false;
}

export interface NguCanhHauKiemKhoi extends NguCanhBaiHoc {
  /** Nguyên văn từng điều khoản đã đưa cho mô hình, khóa là URN. */
  nguyenVan: ReadonlyMap<string, string>;
}

/** Lỗi riêng theo loại khối mà `kiemTraKhoi` không bắt (nó chỉ kiểm trường bắt buộc). */
function loiTheoLoai(k: KhoiAi, ng: NguCanhHauKiemKhoi): string[] {
  const d = k.data;
  if (k.kind === "can_cu") {
    const urn = chuoi(d.urn);
    if (!urn) return [];
    return dungNguyenVan(urn, chuoi(d.nguyen_van), ng.nguyenVan)
      ? []
      : [`Thẻ căn cứ ${urn} không trích đúng nguyên văn điều khoản trong ngữ cảnh`];
  }
  if (k.kind === "hoi_nhanh") {
    const pa = Array.isArray(d.phuong_an) ? d.phuong_an : [];
    const ids = pa.map((p) => chuoi((p as Record<string, unknown>)?.id));
    const loi: string[] = [];
    if (pa.length < 2) loi.push("Câu hỏi nhanh cần ít nhất hai phương án");
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) loi.push("Phương án phải có id riêng");
    if (!ids.includes(chuoi(d.dap_an))) loi.push("Đáp án của câu hỏi nhanh không trùng phương án nào");
    return loi;
  }
  return [];
}

/**
 * Hậu kiểm từng khối. Khối hỏng bị loại kèm lý do, khối còn lại giữ nguyên thứ tự. Quy tắc
 * cả bài (phải có thẻ căn cứ, nhịp tương tác) do `kiemTraBaiHoc` kiểm trên các khối được giữ.
 */
export function hauKiemKhoiAi(
  ds: readonly KhoiAi[],
  ng: NguCanhHauKiemKhoi,
): { khoi: KhoiAi[]; biLoai: BiLoai[] } {
  const khoi: KhoiAi[] = [];
  const biLoai: BiLoai[] = [];
  ds.forEach((k, i) => {
    const lyDo: string[] = [];
    if (!(KHOI_BAI_GIANG as readonly string[]).includes(k.kind)) {
      lyDo.push(`Trang bài giảng chưa dựng loại khối "${k.kind}"`);
    } else {
      lyDo.push(
        ...kiemTraKhoi({
          id: "",
          lessonId: "",
          ordinal: i + 1,
          kind: k.kind as LoaiKhoi,
          data: k.data,
          citations: k.citations,
          citationHealth: "ok",
          source: "ai",
          status: "nhap",
          modes: [],
        })
          .filter((l) => l.muc === "loi")
          .map((l) => l.thong_diep),
        ...loiVienDan(k.citations, ng),
        ...loiTheoLoai(k, ng),
      );
    }
    if (lyDo.length) biLoai.push({ viTri: i + 1, kind: k.kind, lyDo });
    else khoi.push(k);
  });
  return { khoi, biLoai };
}

/* ------------------------------------------------------------------ */
/* Bài tập                                                             */
/* ------------------------------------------------------------------ */

export interface BaiTapAi {
  kind: string;
  mode: string;
  title: string | null;
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
  rubric: Record<string, unknown>;
  citations: string[];
  errorTags: string[];
  level: number;
  points: number;
}

/** Trường của phương án chỉ được nằm trong đáp án, không bao giờ trong đề gửi người học. */
const TRUONG_DAP_AN_CUA_PHUONG_AN = ["dung", "giai_thich", "ma_loi"] as const;

/**
 * Đọc JSON mô hình trả về (`{ bai_tap: [...] }` hoặc một mảng) thành bài tập.
 *
 * Mô hình hay ghi `dung: true` ngay trong phương án của đề. Phần đề được gửi nguyên cho người
 * học, nên ở đây tách hẳn: đề chỉ giữ `id`, `text`, `citations`; phương án đầy đủ chuyển sang
 * `answer.phuong_an`, và `answer.dung` được suy ra nếu mô hình chưa ghi.
 */
export function docBaiTapAi(json: unknown): { baiTap: BaiTapAi[]; loi: string[] } {
  const ds = Array.isArray(json) ? json : laObject(json) ? json.bai_tap : undefined;
  if (!Array.isArray(ds)) return { baiTap: [], loi: ["Kết quả của mô hình không có danh sách bai_tap"] };
  const baiTap: BaiTapAi[] = [];
  const loi: string[] = [];
  ds.forEach((x, i) => {
    if (!laObject(x)) {
      loi.push(`Phần tử thứ ${i + 1} không phải bài tập`);
      return;
    }
    const kind = chuoi(x.kind);
    const prompt: Record<string, unknown> = laObject(x.prompt) ? { ...x.prompt } : {};
    const answer: Record<string, unknown> = laObject(x.answer) ? { ...x.answer } : {};

    if (Array.isArray(prompt.phuong_an)) {
      const day = prompt.phuong_an.filter(laObject);
      prompt.phuong_an = day.map((p) => ({
        id: chuoi(p.id),
        text: chuoi(p.text),
        ...(Array.isArray(p.citations) ? { citations: mangChuoi(p.citations) } : {}),
      }));
      if (day.some((p) => TRUONG_DAP_AN_CUA_PHUONG_AN.some((t) => t in p))) {
        if (!Array.isArray(answer.phuong_an)) answer.phuong_an = day;
        if (!Array.isArray(answer.dung))
          answer.dung = day.filter((p) => p.dung === true).map((p) => chuoi(p.id));
      }
    }

    const mo = BAI_TAP_THEO_KIND.get(kind);
    const level = Number(x.level);
    const points = Number(x.points);
    baiTap.push({
      kind,
      // Cách chấm lấy theo thư viện dạng bài, không theo mô hình; quản trị viên nội dung đổi sau nếu cần.
      mode: mo?.cham ?? "may",
      title: chuoi(x.title) || null,
      prompt,
      answer,
      rubric: laObject(x.rubric) ? x.rubric : {},
      citations: mangChuoi(x.citations),
      errorTags: mangChuoi(x.error_tags),
      level: Number.isInteger(level) && level >= 0 && level <= 3 ? level : 1,
      points: Number.isInteger(points) && points > 0 && points <= 100 ? points : mo?.can_rubric ? 10 : 1,
    });
  });
  return { baiTap, loi };
}

/**
 * `kiemTraRubric` tin rằng rubric đã đúng kiểu `Rubric`. Rubric do mô hình viết thì chưa chắc,
 * nên kiểm hình dạng trước để rubric hỏng thành lý do loại chứ không làm hậu kiểm ném lỗi.
 */
function loiHinhDangRubric(r: Record<string, unknown>): string[] {
  if (!Array.isArray(r.tieu_chi) || !r.tieu_chi.length) return ["Rubric phải có ít nhất một tiêu chí"];
  const hong = r.tieu_chi.some(
    (tc) =>
      !laObject(tc) ||
      !chuoi(tc.ma) ||
      typeof tc.trong_so !== "number" ||
      !Array.isArray(tc.muc) ||
      !tc.muc.length ||
      tc.muc.some((m) => !laObject(m) || typeof m.diem !== "number"),
  );
  if (hong) return ["Rubric sai dạng: mỗi tiêu chí cần ma, trong_so (số) và các mức có diem (số)"];
  return typeof r.nguong_dat === "number" ? [] : ["Rubric thiếu ngưỡng đạt (nguong_dat)"];
}

export interface NguCanhHauKiemBaiTap extends NguCanhBaiHoc {
  /** Mã lỗi khái niệm có trong danh mục. Rỗng thì không lọc. */
  maLoi?: ReadonlySet<string>;
}

/**
 * Hậu kiểm từng bài tập. Bài chấm bằng AI hoặc người phải có rubric hợp lệ; bài chấm bằng máy
 * phải có đáp án. Mã lỗi không có trong danh mục bị bỏ (không loại cả bài), vì đó là nhãn phụ.
 */
export function hauKiemBaiTapAi(
  ds: readonly BaiTapAi[],
  ng: NguCanhHauKiemBaiTap,
): { baiTap: BaiTapAi[]; biLoai: BiLoai[] } {
  const baiTap: BaiTapAi[] = [];
  const biLoai: BiLoai[] = [];
  ds.forEach((b, i) => {
    const lyDo: string[] = [];
    const mo = BAI_TAP_THEO_KIND.get(b.kind as LoaiBaiTap);
    if (!mo) lyDo.push(`Không có dạng bài "${b.kind}"`);
    if (!chuoi(b.prompt.cau_hoi)) lyDo.push("Bài tập thiếu đề (prompt.cau_hoi)");
    if (mo?.can_rubric) {
      const hinhDang = loiHinhDangRubric(b.rubric);
      lyDo.push(...(hinhDang.length ? hinhDang : kiemTraRubric(b.rubric)));
    } else if (mo) {
      const coDapAn = Object.entries(b.answer).some(
        ([k, v]) =>
          k !== "giai_thich" &&
          k !== "phuong_an" &&
          v !== undefined &&
          v !== null &&
          !(Array.isArray(v) && v.length === 0),
      );
      if (!coDapAn) lyDo.push("Bài chấm bằng máy phải có đáp án");
    }
    if (b.kind === "trac_nghiem") {
      const ids = (Array.isArray(b.prompt.phuong_an) ? b.prompt.phuong_an : []).map((p) =>
        chuoi((p as Record<string, unknown>).id),
      );
      const dung = mangChuoi(b.answer.dung);
      if (ids.length < 2) lyDo.push("Trắc nghiệm cần ít nhất hai phương án");
      if (!dung.length || dung.some((d) => !ids.includes(d))) {
        lyDo.push("Đáp án trắc nghiệm không trùng phương án nào");
      }
    }
    if (!b.citations.length) lyDo.push("Bài tập không có căn cứ");
    lyDo.push(...loiVienDan(b.citations, ng));

    if (lyDo.length) {
      biLoai.push({ viTri: i + 1, kind: b.kind, lyDo });
      return;
    }
    baiTap.push(ng.maLoi?.size ? { ...b, errorTags: b.errorTags.filter((m) => ng.maLoi!.has(m)) } : b);
  });
  return { baiTap, biLoai };
}

/* ------------------------------------------------------------------ */
/* Dàn ý chuyên đề soạn từ văn bản                                     */
/* ------------------------------------------------------------------ */

export interface BaiDanY {
  tieuDe: string;
  tomTat: string | null;
  /** URN điều khoản làm căn cứ chính của bài; luôn nằm trong ngữ cảnh. */
  canCu: string[];
}

/**
 * Đọc dàn ý mô hình trả về (`{ bai: [...] }` hoặc một mảng) thành danh sách bài. Chỉ đổi dạng;
 * kiểm tra nằm ở `hauKiemDanYAi`.
 */
export function docDanYAi(json: unknown): { bai: BaiDanY[]; loi: string[] } {
  const ds = Array.isArray(json) ? json : laObject(json) ? json.bai : undefined;
  if (!Array.isArray(ds)) return { bai: [], loi: ["Kết quả của mô hình không có danh sách bai"] };
  const bai: BaiDanY[] = [];
  const loi: string[] = [];
  ds.forEach((x, i) => {
    if (!laObject(x)) {
      loi.push(`Phần tử thứ ${i + 1} không phải bài học`);
      return;
    }
    bai.push({ tieuDe: chuoi(x.tieu_de), tomTat: chuoi(x.tom_tat) || null, canCu: mangChuoi(x.can_cu) });
  });
  return { bai, loi };
}

/**
 * Hậu kiểm dàn ý: bài phải có tiêu đề và ít nhất một căn cứ nằm trong ngữ cảnh; căn cứ ngoài
 * ngữ cảnh bị bỏ khỏi bài (bài không còn căn cứ nào thì bị loại); tiêu đề trùng bị loại; quá
 * `soBaiToiDa` thì cắt. Trả thêm các điều khoản trong ngữ cảnh chưa bài nào dùng, để biên tập
 * viên biết dàn ý bỏ sót gì.
 */
export function hauKiemDanYAi(
  ds: readonly BaiDanY[],
  ng: { urnNguCanh: readonly string[]; soBaiToiDa: number },
): { bai: BaiDanY[]; biLoai: BiLoai[]; chuaDung: string[] } {
  const bai: BaiDanY[] = [];
  const biLoai: BiLoai[] = [];
  const daCoTieuDe = new Set<string>();
  ds.forEach((b, i) => {
    const lyDo: string[] = [];
    const canCu = [...new Set(b.canCu)].filter((u) => trongNguCanh(u, ng.urnNguCanh));
    if (b.tieuDe.length < 3) lyDo.push("Bài thiếu tiêu đề");
    if (!canCu.length) lyDo.push("Bài không có căn cứ nào nằm trong văn bản đã chọn");
    const khoa = b.tieuDe.toLowerCase();
    if (daCoTieuDe.has(khoa)) lyDo.push("Trùng tiêu đề với bài trước");
    if (!lyDo.length && bai.length >= ng.soBaiToiDa) lyDo.push(`Vượt số bài yêu cầu (${ng.soBaiToiDa})`);
    if (lyDo.length) {
      biLoai.push({ viTri: i + 1, kind: "bai", lyDo });
      return;
    }
    daCoTieuDe.add(khoa);
    bai.push({ ...b, canCu });
  });
  const dung = bai.flatMap((b) => b.canCu);
  const chuaDung = ng.urnNguCanh.filter((u) => !dung.some((x) => x === u || x.startsWith(`${u}.`)));
  return { bai, biLoai, chuaDung };
}

/** Slug từ tiêu đề tiếng Việt: "Tốc độ, khoảng cách" → "toc-do-khoang-cach". */
export function slugTuTieuDe(s: string, toiDa = 60): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, toiDa)
    .replace(/-$/, "");
}
