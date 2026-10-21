/**
 * Bộ kiểm tra hành văn cho nội dung hiển thị (QUY-TAC-HANH-VAN.md).
 *
 * Vì sao cần máy kiểm: quy tắc hành văn dài mười mục, và người soạn — kể cả mô hình — vi
 * phạm nhiều nhất ở đúng ba chỗ khó tự thấy: tiểu từ tình thái cuối câu, câu bàn luận về
 * chính trang, và số hiệu văn bản viết tắt. Ba lỗi đó đều nhận ra được bằng biểu thức chính
 * quy, nên không có lý do gì để chúng lọt tới người đọc.
 *
 * Bộ kiểm này chỉ soi CHỮ SẼ HIỆN LÊN MÀN HÌNH: nội dung khối bài học, đề bài, phản hồi,
 * lời thoại nhân vật. Nó không soi mã nguồn và không soi chú thích — chú thích trong repo
 * này viết bằng tiếng Việt tự nhiên và có quyền dùng những từ mà giao diện không được dùng.
 */

export type MucLoiHanhVan = "loi" | "canh_bao";

export interface LoiHanhVan {
  muc: MucLoiHanhVan;
  /** Mã quy tắc, trỏ về mục trong QUY-TAC-HANH-VAN.md. */
  ma: string;
  /** Mục của quy tắc, ví dụ "3.1". */
  muc_quy_tac: string;
  /** Đoạn chữ vi phạm. */
  trich: string;
  goi_y: string;
  /** Đường dẫn tới chỗ vi phạm, do người gọi đặt (ví dụ "bai-1 › khối 3 › md"). */
  o?: string;
}

interface QuyTac {
  ma: string;
  muc_quy_tac: string;
  muc: MucLoiHanhVan;
  re: RegExp;
  goi_y: string;
}

/** Ranh giới từ dùng được với tiếng Việt có dấu (\b của JS chỉ hiểu ASCII). */
const TRUOC = "(?<=^|[\\s,.;:!?\"'()\\[\\]«»“”–—-])";
const SAU = "(?=$|[\\s,.;:!?\"'()\\[\\]«»“”–—-])";

function tu(...cac: string[]): RegExp {
  return new RegExp(`${TRUOC}(${cac.join("|")})${SAU}`, "giu");
}

/**
 * Bảng quy tắc. Mức `loi` chặn xuất bản; `canh_bao` để người biên tập cân nhắc.
 *
 * Xếp mức theo mức độ nghiêm trọng nêu ở đầu quy tắc: nội dung pháp lý không có viện dẫn và
 * giọng suồng sã là lỗi; những thứ còn lại phần lớn là cảnh báo.
 */
export const QUY_TAC_HANH_VAN: readonly QuyTac[] = [
  // §3.4 — không emoji, không dấu chấm than.
  {
    ma: "emoji",
    muc_quy_tac: "3.4",
    muc: "loi",
    // Viết dạng lựa chọn thay cho lớp ký tự: U+FE0F là ký tự tổ hợp, đặt chung trong lớp
    // ký tự sẽ khớp sai (nó ghép với ký tự đứng trước thành một ký tự khác).
    re: /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|\u{FE0F}/gu,
    goi_y: "Bỏ emoji. Biểu tượng chức năng dùng SVG kèm nhãn cho trình đọc màn hình.",
  },
  {
    ma: "dau_cham_than",
    muc_quy_tac: "3.4",
    muc: "loi",
    re: /!/g,
    goi_y: "Bỏ dấu chấm than. Dùng câu trần thuật.",
  },

  // §3.1 — tiểu từ tình thái cuối câu.
  {
    ma: "tieu_tu_tinh_thai",
    muc_quy_tac: "3.1",
    muc: "loi",
    // "cơ" đứng sau "động" là danh từ "động cơ" (xe bốn bánh có gắn động cơ.) — thuật ngữ trong
    // Luật Trật tự, an toàn giao thông đường bộ và Nghị định 89/2026/NĐ-CP, không phải tiểu từ.
    re: /(?<=[\p{L}\p{N}])(?<!động)\s+(nhé|nha|ạ|đấy|nhỉ|cơ|mà)\s*(?=[.?,;]|$)/giu,
    goi_y: "Bỏ tiểu từ tình thái cuối câu.",
  },

  // §3.1 — khẩu ngữ.
  {
    ma: "khau_ngu",
    muc_quy_tac: "3.1",
    muc: "loi",
    re: tu(
      "chuẩn luôn",
      "ổn áp",
      "gần rồi",
      "sát rồi",
      "mình chịu",
      "khoan đã",
      "hơi rối",
      "khó nhằn",
      "tất tần tật",
      "trọn gói",
      "từ A đến Z",
      "siêu nhanh",
      "dễ như ăn kẹo",
      "vài cú nhấp",
      "đội ngũ tâm huyết",
    ),
    goi_y: "Thay bằng cách diễn đạt trung tính (xem bảng §3.1).",
  },

  // §3.2 — ẩn dụ ngoài danh sách cho phép.
  {
    ma: "an_du",
    muc_quy_tac: "3.2",
    muc: "canh_bao",
    re: tu(
      "xương sống",
      "trái tim",
      "linh hồn",
      "kim chỉ nam",
      "bệ phóng",
      "chắp cánh",
      "lột xác",
      "cẩm nang gối đầu giường",
      "thay đổi cuộc chơi",
    ),
    goi_y: "Chỉ giữ ẩn dụ đã thành thuật ngữ (vòng đời dự án, luồng công việc, bản đồ pháp lý…).",
  },

  // §3.3 — từ nhấn mạnh cảm tính.
  {
    ma: "tu_nhan_manh",
    muc_quy_tac: "3.3",
    muc: "canh_bao",
    re: tu(
      "cực kỳ",
      "siêu",
      "vô cùng",
      "đáng kinh ngạc",
      "mạnh mẽ",
      "vượt trội",
      "tối ưu nhất",
      "quan trọng nhất",
      "đột phá",
      "cách mạng",
    ),
    goi_y: "Bỏ, hoặc thay bằng một số đo cụ thể.",
  },

  // §4 — xưng hô.
  {
    ma: "xung_ho",
    muc_quy_tac: "4",
    muc: "loi",
    re: tu("tớ", "cậu", "lão", "chúng ta", "người ta", "ai cũng biết", "dân trong nghề"),
    goi_y: 'Xưng "tôi", gọi người học là "bạn" (hoặc "anh/chị" trong ngữ cảnh đánh giá).',
  },

  // §1 — ra lệnh trống không.
  {
    ma: "ra_lenh",
    muc_quy_tac: "1",
    muc: "loi",
    re: tu("đừng", "nhớ nhé", "phải nhớ", "chú ý nha", "yên tâm"),
    goi_y: 'Dùng thể trần thuật: "không sử dụng…", "cần đối chiếu…".',
  },

  // §2.2 — câu dự đoán phản ứng của người đọc.
  {
    ma: "du_doan_phan_ung",
    muc_quy_tac: "2.2",
    muc: "loi",
    re: /(chắc\s+bạn\s+đang|hẳn\s+bạn\s+đã|nghe\s+(thì|có\s+vẻ)\s+(đơn\s+giản|phức\s+tạp)|bạn\s+có\s+thể\s+đang\s+tự\s+hỏi)/giu,
    goi_y: "Bỏ hẳn câu dự đoán phản ứng của người đọc.",
  },

  // §2.1 — câu nói về chính trang thay vì về nội dung.
  {
    ma: "ban_luan_noi_bo",
    muc_quy_tac: "2.1",
    muc: "canh_bao",
    re: /(phần\s+quan\s+trọng\s+nhất\s+của\s+bài|điểm\s+cần\s+làm\s+rõ\s+nhất|chúng\s+tôi\s+để\s+mục|nói\s+thẳng\s+một\s+điều)/giu,
    goi_y: "Bỏ câu bàn luận về chính trang; đặt thẳng nội dung vào đúng chỗ.",
  },

  // §6 — số hiệu văn bản viết tắt trong nội dung hiển thị.
  {
    ma: "so_hieu_viet_tat",
    muc_quy_tac: "6",
    muc: "loi",
    re: /(?<=^|[\s(«"“])(NĐ|TT|QĐ|NQ|TTLT)\s+\d+\/\d{4}/gu,
    goi_y: 'Viết đầy đủ: "Nghị định số 224/2026/NĐ-CP". Dạng viết tắt chỉ dùng trong sơ đồ và bảng chật chỗ.',
  },

  // §6 — khẳng định pháp lý không nêu văn bản.
  {
    ma: "quy_dinh_hien_hanh",
    muc_quy_tac: "6",
    muc: "loi",
    re: /(theo\s+quy\s+định\s+hiện\s+hành|theo\s+quy\s+định\s+của\s+pháp\s+luật)(?!\s+(tại|về\s+))/giu,
    goi_y: "Nêu rõ tên văn bản và thời điểm áp dụng, không viết chung chung.",
  },

  // §9 — dấu ba chấm bỏ lửng để tạo kịch tính.
  {
    ma: "bo_lung",
    muc_quy_tac: "9",
    muc: "canh_bao",
    re: /(?<=[\p{L}\p{N}])\s*(\.\.\.|…)\s*$/gmu,
    goi_y: "Không bỏ lửng câu để tạo kịch tính; viết trọn ý.",
  },
];

/** Nhãn tiêu đề bị cấm và bản thay thế (§5). */
export const TIEU_DE_THAY_THE: Record<string, string> = {
  "làm thử": "Bài tập",
  "chốt lại": "Tóm tắt",
  "học ngay": "Xem lộ trình chuyên đề",
  "bắt đầu ngay": "Bắt đầu bài học",
  "khám phá": "Xem danh mục",
  "xem thêm": "Xem toàn bộ danh sách",
};

export interface TuyChonSoat {
  /**
   * Cho phép số hiệu văn bản viết tắt. §6 miễn trừ cho **sơ đồ và bảng chật chỗ** — ở đó
   * viết đủ "Nghị định số 224/2026/NĐ-CP" sẽ vỡ bố cục và làm sơ đồ khó đọc hơn.
   */
  choPhepVietTat?: boolean;
  /**
   * Đoạn chữ là NGUYÊN VĂN văn bản quy phạm (trường `nguyen_van` của thẻ căn cứ): người soạn
   * không được sửa câu chữ của luật, nên không áp các quy tắc về cách viết của người soạn — §6
   * (luật vốn viết "theo quy định của pháp luật"), số hiệu viết tắt ("Luật này"), bỏ lửng do trích lược.
   */
  nguyenVan?: boolean;
}

/** Quy tắc không áp cho nguyên văn văn bản quy phạm. */
const QUY_TAC_MIEN_NGUYEN_VAN: ReadonlySet<string> = new Set([
  "quy_dinh_hien_hanh",
  "so_hieu_viet_tat",
  "bo_lung",
]);

/** Kiểu khối được miễn trừ §6: sơ đồ và bảng, nơi chỗ hiển thị bị giới hạn thật. */
export const KHOI_CHO_PHEP_VIET_TAT: ReadonlySet<string> = new Set([
  "so_do_trinh_tu",
  "dong_thoi_gian",
  "bang_tra",
  "ban_do_khai_niem",
  "cay_quyet_dinh",
  "ho_so",
]);

/** Soát một đoạn chữ. `o` là mô tả vị trí để báo cáo chỉ đúng chỗ. */
export function soatChu(chu: string, o?: string, tuyChon: TuyChonSoat = {}): LoiHanhVan[] {
  if (!chu?.trim()) return [];
  const ra: LoiHanhVan[] = [];
  for (const qt of QUY_TAC_HANH_VAN) {
    if (tuyChon.choPhepVietTat && qt.ma === "so_hieu_viet_tat") continue;
    if (tuyChon.nguyenVan && QUY_TAC_MIEN_NGUYEN_VAN.has(qt.ma)) continue;
    // Biểu thức có cờ `g` giữ trạng thái lastIndex giữa các lần gọi — đặt lại trước khi dùng.
    qt.re.lastIndex = 0;
    for (const khop of chu.matchAll(qt.re)) {
      ra.push({
        muc: qt.muc,
        ma: qt.ma,
        muc_quy_tac: qt.muc_quy_tac,
        trich: nganhCanh(chu, khop.index ?? 0, khop[0].length),
        goi_y: qt.goi_y,
        ...(o ? { o } : {}),
      });
    }
  }
  const thap = chu.trim().toLowerCase();
  for (const [cam, thay] of Object.entries(TIEU_DE_THAY_THE)) {
    if (thap === cam) {
      ra.push({
        muc: "loi",
        ma: "tieu_de_cam",
        muc_quy_tac: "5",
        trich: chu.trim(),
        goi_y: `Đổi thành "${thay}".`,
        ...(o ? { o } : {}),
      });
    }
  }
  return ra;
}

/** Cắt một đoạn ngắn quanh chỗ vi phạm để người sửa thấy ngay ngữ cảnh. */
function nganhCanh(chu: string, tu_: number, dai: number): string {
  const dau = Math.max(0, tu_ - 30);
  const cuoi = Math.min(chu.length, tu_ + dai + 30);
  return `${dau > 0 ? "…" : ""}${chu.slice(dau, cuoi).replace(/\s+/g, " ")}${cuoi < chu.length ? "…" : ""}`;
}

/**
 * Soát mọi chuỗi nằm trong một cấu trúc dữ liệu (khối bài học, đề bài, phản hồi).
 * Bỏ qua khoá kỹ thuật: URN, mã, đường dẫn — đó không phải chữ người đọc.
 */
const KHOA_BO_QUA = new Set([
  "urn",
  "uri",
  "ma",
  "id",
  "code",
  "slug",
  "kind",
  "loai",
  "cong_cu",
  "che_do",
  "anh",
  "nguon",
  "latex",
  "don_vi",
  "ngay",
  "as_of",
  "citations",
  "lenh",
]);

export function soatCauTruc(
  gt: unknown,
  o = "",
  tuyChon: TuyChonSoat = {},
  ra: LoiHanhVan[] = [],
): LoiHanhVan[] {
  if (typeof gt === "string") {
    ra.push(...soatChu(gt, o, tuyChon));
  } else if (Array.isArray(gt)) {
    gt.forEach((x, i) => {
      soatCauTruc(x, `${o}[${i}]`, tuyChon, ra);
    });
  } else if (gt && typeof gt === "object") {
    for (const [k, v] of Object.entries(gt as Record<string, unknown>)) {
      if (KHOA_BO_QUA.has(k)) continue;
      // Trường `nguyen_van` (thẻ căn cứ) chép nguyên câu chữ của văn bản quy phạm.
      const tc = k === "nguyen_van" ? { ...tuyChon, nguyenVan: true } : tuyChon;
      soatCauTruc(v, o ? `${o}.${k}` : k, tc, ra);
    }
  }
  return ra;
}

export function coLoiChan(ds: LoiHanhVan[]): boolean {
  return ds.some((l) => l.muc === "loi");
}
