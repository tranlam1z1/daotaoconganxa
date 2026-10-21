/**
 * Chấm tự luận bằng AI theo rubric (ke-hoach/09-a §4.3): đọc kết quả mô hình rồi hậu kiểm.
 *
 * Mô hình chỉ đưa điểm thô từng tiêu chí kèm bằng chứng; điểm cuối cùng tính ở đây, tất định:
 *  1. tiêu chí lạ bị bỏ, tiêu chí thiếu tính 0 điểm;
 *  2. điểm kẹp trong [0, mức cao nhất của tiêu chí];
 *  3. tiêu chí có điểm phải kèm `bang_chung` là một đoạn NGUYÊN VĂN của bài làm. Không tìm thấy
 *     đoạn đó trong bài thì tiêu chí bằng 0 — mô hình không được cho điểm cái người học không viết;
 *  4. quy về thang điểm của bài theo trọng số (`tinhDiemRubric`), đạt khi chạm ngưỡng của rubric.
 *
 * Bài AI chấm vẫn được lấy mẫu cho giảng viên đối chiếu, và người học có quyền phúc khảo.
 */

import { diemToiDaTieuChi, tinhDiemRubric } from "./grading.ts";
import type { DiemTieuChi, HoatDong, KetQuaCham, Rubric } from "./types.ts";

/** Độ dài bài viết (ký tự) chấp nhận được, để chặn bài trống và bài dán nguyên văn bản quá dài. */
export const DO_DAI_BAI_VIET = { toiThieu: 50, toiDa: 6000 } as const;

/** Số lần nộp một bài AI chấm trong 24 giờ: mỗi lần là một lượt gọi mô hình có chi phí. */
export const SO_LAN_NOP_AI_MOI_NGAY = 5;

function chuanHoa(s: string): string {
  return s
    .normalize("NFC")
    .replace(/["“”'‘’…*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Bằng chứng có thật sự nằm trong bài làm không (bỏ qua khoảng trắng, ngoặc kép, chữ hoa). */
export function coTrongBaiLam(bangChung: string, baiLam: string): boolean {
  const b = chuanHoa(bangChung).replace(/^\.+|\.+$/g, "");
  return b.length >= 4 && chuanHoa(baiLam).includes(b);
}

export interface KetQuaDocCham {
  /** Điểm thô từng tiêu chí sau hậu kiểm, khóa là mã tiêu chí. */
  diem: Record<string, number>;
  tieuChi: DiemTieuChi[];
  tomTat: string;
  /** Mô hình trả được ít nhất một tiêu chí khớp rubric; false thì không dùng được kết quả. */
  dungDuoc: boolean;
}

/**
 * Đọc `{ tieu_chi: [{ ma, diem, nhan_xet, bang_chung }], tom_tat }` của mô hình và hậu kiểm theo
 * rubric và bài làm. Không ném lỗi: kết quả không dùng được thì `dungDuoc = false`.
 */
export function docKetQuaChamAi(json: unknown, rubric: Rubric, baiLam: string): KetQuaDocCham {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const ds = Array.isArray(o.tieu_chi) ? (o.tieu_chi as Array<Record<string, unknown>>) : [];
  const theoMa = new Map(ds.filter((x) => x && typeof x === "object").map((x) => [String(x.ma ?? ""), x]));

  const diem: Record<string, number> = {};
  const tieuChi: DiemTieuChi[] = rubric.tieu_chi.map((tc) => {
    const toiDa = diemToiDaTieuChi(tc);
    const x = theoMa.get(tc.ma);
    if (!x) {
      diem[tc.ma] = 0;
      return {
        ma: tc.ma,
        ten: tc.ten,
        diem: 0,
        diem_toi_da: toiDa,
        nhan_xet: "Chưa chấm được tiêu chí này.",
      };
    }
    const tho = Number(x.diem);
    let d = Number.isFinite(tho) ? Math.min(Math.max(tho, 0), toiDa) : 0;
    const bangChung = typeof x.bang_chung === "string" ? x.bang_chung.trim() : "";
    let nhanXet = typeof x.nhan_xet === "string" ? x.nhan_xet.trim() : "";
    if (d > 0 && !coTrongBaiLam(bangChung, baiLam)) {
      d = 0;
      nhanXet = "Không tìm thấy nội dung tương ứng trong bài làm.";
    }
    diem[tc.ma] = d;
    return {
      ma: tc.ma,
      ten: tc.ten,
      diem: d,
      diem_toi_da: toiDa,
      ...(nhanXet ? { nhan_xet: nhanXet } : {}),
      ...(d > 0 && bangChung ? { bang_chung: bangChung } : {}),
    };
  });

  return {
    diem,
    tieuChi,
    tomTat: typeof o.tom_tat === "string" && o.tom_tat.trim() ? o.tom_tat.trim() : "",
    dungDuoc: rubric.tieu_chi.some((tc) => theoMa.has(tc.ma)),
  };
}

/** Kết quả chấm cuối cùng của một bài tự luận AI chấm, theo thang điểm của bài. */
export function ketQuaChamTuLuan(
  hd: Pick<HoatDong, "points" | "citations">,
  rubric: Rubric,
  doc: KetQuaDocCham,
): KetQuaCham {
  const phanTram = tinhDiemRubric(rubric, doc.diem);
  const dat = phanTram >= rubric.nguong_dat;
  return {
    score: Math.round((phanTram / 100) * hd.points * 100) / 100,
    maxScore: hd.points,
    passed: dat,
    errorTags: [],
    feedback: {
      tom_tat:
        doc.tomTat ||
        (dat ? "Bài đạt yêu cầu." : "Bài chưa đạt. Xem nhận xét từng tiêu chí, sửa rồi nộp lại."),
      tieu_chi: doc.tieuChi,
      ...(hd.citations.length ? { can_cu: hd.citations } : {}),
    },
    gradedBy: "ai",
    canChamTiep: false,
  };
}
