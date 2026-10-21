/**
 * Thống kê chất lượng câu hỏi và hành trình người học (ke-hoach/09-a §7).
 *
 * Hai chỉ số quan trọng nhất và hay bị bỏ qua:
 *  - **Độ khó thực tế**: tỷ lệ đúng NGAY LẦN ĐẦU. Tính cả lần làm lại thì mọi câu đều dễ.
 *  - **Độ phân biệt** (point-biserial): câu có tách được người nắm bài với người chưa không.
 *    Câu độ phân biệt thấp thường là câu hỏi mẹo hoặc câu diễn đạt mơ hồ — gỡ ra thì đề tốt lên.
 */

export interface LuotLam {
  activityId: string;
  enrollmentId: string;
  attemptNo: number;
  score: number;
  maxScore: number;
  passed: boolean;
  secondsSpent: number;
  errorTags: string[];
}

export interface ChiSoCauHoi {
  activityId: string;
  soLuot: number;
  /** Tỷ lệ đúng ở lần làm đầu tiên. */
  doKho: number;
  /** Tương quan điểm câu này với tổng điểm của người học, −1..1. */
  doPhanBiet: number;
  giayTrungBinh: number;
  tyLeBoTrong: number;
  /** Kết luận để màn hình quản trị hiển thị ngay, không bắt người đọc tự luận. */
  ketLuan: "tot" | "qua_de" | "qua_kho" | "khong_phan_biet" | "chua_du_du_lieu";
}

const TOI_THIEU_DE_KET_LUAN = 20;

function trungBinh(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function docLech(xs: number[]): number {
  if (xs.length < 2) return 0;
  const tb = trungBinh(xs);
  return Math.sqrt(xs.reduce((t, x) => t + (x - tb) ** 2, 0) / xs.length);
}

/**
 * Hệ số tương quan point-biserial giữa kết quả một câu và tổng điểm của người học.
 * `tongDiem` là tổng điểm của mỗi người học trên toàn bộ bài, đã trừ câu đang xét
 * (hiệu chỉnh này tránh việc một câu tự tương quan với chính nó).
 */
export function doPhanBiet(dung: boolean[], tongDiem: number[]): number {
  const n = dung.length;
  if (n < 2 || tongDiem.length !== n) return 0;
  const sd = docLech(tongDiem);
  if (sd === 0) return 0;
  const nhomDung = tongDiem.filter((_, i) => dung[i]);
  const nhomSai = tongDiem.filter((_, i) => !dung[i]);
  if (!nhomDung.length || !nhomSai.length) return 0;
  const p = nhomDung.length / n;
  return ((trungBinh(nhomDung) - trungBinh(nhomSai)) / sd) * Math.sqrt(p * (1 - p));
}

/** Chỉ số của từng câu, tính từ toàn bộ lượt làm của một chuyên đề. */
export function chiSoCauHoi(luot: LuotLam[]): ChiSoCauHoi[] {
  // Tổng điểm mỗi người học, để tính độ phân biệt.
  const tongTheoNguoi = new Map<string, number>();
  for (const l of luot) {
    if (l.attemptNo !== 1) continue;
    const ty = l.maxScore ? l.score / l.maxScore : 0;
    tongTheoNguoi.set(l.enrollmentId, (tongTheoNguoi.get(l.enrollmentId) ?? 0) + ty);
  }

  const theoCau = new Map<string, LuotLam[]>();
  for (const l of luot) {
    const ds = theoCau.get(l.activityId);
    if (ds) ds.push(l);
    else theoCau.set(l.activityId, [l]);
  }

  const ra: ChiSoCauHoi[] = [];
  for (const [activityId, ds] of theoCau) {
    const lanDau = ds.filter((l) => l.attemptNo === 1);
    const soLuot = lanDau.length;
    const dung = lanDau.map((l) => l.passed);
    // Trừ chính câu này ra khỏi tổng điểm để tránh tự tương quan.
    const tong = lanDau.map(
      (l) => (tongTheoNguoi.get(l.enrollmentId) ?? 0) - (l.maxScore ? l.score / l.maxScore : 0),
    );
    const doKho = soLuot ? dung.filter(Boolean).length / soLuot : 0;
    const pb = doPhanBiet(dung, tong);

    let ketLuan: ChiSoCauHoi["ketLuan"] = "tot";
    if (soLuot < TOI_THIEU_DE_KET_LUAN) ketLuan = "chua_du_du_lieu";
    else if (doKho > 0.95) ketLuan = "qua_de";
    else if (doKho < 0.3) ketLuan = "qua_kho";
    else if (pb < 0.15) ketLuan = "khong_phan_biet";

    ra.push({
      activityId,
      soLuot,
      doKho: Number(doKho.toFixed(3)),
      doPhanBiet: Number(pb.toFixed(3)),
      giayTrungBinh: Math.round(trungBinh(lanDau.map((l) => l.secondsSpent))),
      tyLeBoTrong: soLuot ? Number((lanDau.filter((l) => l.score === 0).length / soLuot).toFixed(3)) : 0,
      ketLuan,
    });
  }
  return ra.sort((a, b) => a.doPhanBiet - b.doPhanBiet);
}

export const NHAN_KET_LUAN_CAU_HOI: Record<ChiSoCauHoi["ketLuan"], string> = {
  tot: "Tốt",
  qua_de: "Quá dễ — hầu như ai cũng đúng",
  qua_kho: "Quá khó — có thể đề mơ hồ",
  khong_phan_biet: "Không phân biệt được người nắm bài",
  chua_du_du_lieu: "Chưa đủ lượt làm để kết luận",
};

/* ------------------------------------------------------------------ */
/* Điểm rơi                                                            */
/* ------------------------------------------------------------------ */

export interface DiemRoiKhoi {
  blockId: string;
  ordinal: number;
  vao: number;
  roi: number;
  tyLeRoi: number;
  canhBao: boolean;
}

/**
 * Điểm rơi theo khối: bao nhiêu người mở khối rồi rời bài ngay tại đó.
 * Một khối vượt 15% là dấu hiệu khối đó quá dài, quá khó, hoặc bị hỏng.
 */
export function diemRoi(
  suKien: Array<{ blockId: string | null; ordinal: number; kind: string; enrollmentId: string }>,
): DiemRoiKhoi[] {
  const vao = new Map<string, { ordinal: number; nguoi: Set<string> }>();
  const roi = new Map<string, Set<string>>();
  // Khối cuối cùng mà mỗi người mở trong một bài chính là chỗ họ rời đi.
  const cuoiCua = new Map<string, { blockId: string; ordinal: number }>();

  for (const sk of suKien) {
    if (!sk.blockId || sk.kind !== "mo_khoi") continue;
    const m = vao.get(sk.blockId) ?? { ordinal: sk.ordinal, nguoi: new Set<string>() };
    m.nguoi.add(sk.enrollmentId);
    vao.set(sk.blockId, m);
    const truoc = cuoiCua.get(sk.enrollmentId);
    if (!truoc || sk.ordinal > truoc.ordinal)
      cuoiCua.set(sk.enrollmentId, { blockId: sk.blockId, ordinal: sk.ordinal });
  }
  for (const [nguoi, cuoi] of cuoiCua) {
    const s = roi.get(cuoi.blockId) ?? new Set<string>();
    s.add(nguoi);
    roi.set(cuoi.blockId, s);
  }

  return [...vao.entries()]
    .map(([blockId, m]) => {
      const soRoi = roi.get(blockId)?.size ?? 0;
      const tyLe = m.nguoi.size ? soRoi / m.nguoi.size : 0;
      return {
        blockId,
        ordinal: m.ordinal,
        vao: m.nguoi.size,
        roi: soRoi,
        tyLeRoi: Number(tyLe.toFixed(3)),
        canhBao: tyLe > 0.15 && m.nguoi.size >= 10,
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal);
}

/* ------------------------------------------------------------------ */
/* Lệch chấm AI ↔ người                                                */
/* ------------------------------------------------------------------ */

export interface LechCham {
  soBai: number;
  lechTrungBinh: number;
  lechLonNhat: number;
  /** Vượt ngưỡng nghĩa là rubric hoặc prompt chấm cần hiệu chỉnh (09-a §4.3). */
  canHieuChinh: boolean;
}

export function lechCham(cap: Array<{ ai: number; nguoi: number; max: number }>): LechCham {
  if (!cap.length) return { soBai: 0, lechTrungBinh: 0, lechLonNhat: 0, canHieuChinh: false };
  // Quy về thang 4 mức của rubric để "lệch 1 mức" có nghĩa như trong tài liệu.
  const lech = cap.map((c) => (c.max ? (Math.abs(c.ai - c.nguoi) / c.max) * 4 : 0));
  const tb = trungBinh(lech);
  return {
    soBai: cap.length,
    lechTrungBinh: Number(tb.toFixed(2)),
    lechLonNhat: Number(Math.max(...lech).toFixed(2)),
    canHieuChinh: tb > 1,
  };
}

/* ------------------------------------------------------------------ */
/* Phễu hoàn thành                                                     */
/* ------------------------------------------------------------------ */

export interface BuocPheu {
  ma: string;
  nhan: string;
  so: number;
  tyLe: number;
}

export function pheuHoanThanh(d: {
  ghiDanh: number;
  vaoBaiDau: number;
  xongBaiDau: number;
  xongNuaChuyenDe: number;
  hoanThanh: number;
}): BuocPheu[] {
  const goc = d.ghiDanh || 1;
  const b = (ma: string, nhan: string, so: number) => ({ ma, nhan, so, tyLe: Number((so / goc).toFixed(3)) });
  return [
    b("ghi_danh", "Ghi danh", d.ghiDanh),
    b("vao_bai_dau", "Vào bài 1", d.vaoBaiDau),
    b("xong_bai_dau", "Xong bài 1", d.xongBaiDau),
    b("xong_nua", "Xong 50%", d.xongNuaChuyenDe),
    b("hoan_thanh", "Hoàn thành", d.hoanThanh),
  ];
}
