/**
 * Kiểu dữ liệu và nhãn của phần bài tập ở trang soạn bài (ke-hoach/09-c §4).
 *
 * Web chỉ gọi API (giả định A2); các kiểu ở đây chép theo phản hồi của
 * apps/api/src/routes/quan-tri.ts và packages/db/src/dao-tao.ts, phải đổi cùng lúc khi bên đó đổi.
 */

export interface HoatDongQuanTri {
  id: string;
  kind: string;
  mode: string;
  title: string | null;
  prompt: { cau_hoi?: string; huong_dan?: string; phuong_an?: Array<{ id: string; text: string }> };
  answer: { dung?: string[]; giai_thich?: string };
  rubric: {
    tieu_chi?: Array<{
      ma: string;
      ten: string;
      trong_so: number;
      muc: Array<{ diem: number; mo_ta: string }>;
    }>;
    nguong_dat?: number;
  };
  citations: string[];
  points: number;
  source: string;
  retired: boolean;
}

export const TEN_DANG_BAI: Record<string, string> = {
  trac_nghiem: "Trắc nghiệm",
  dung_sai: "Đúng/sai kèm căn cứ",
  viet_co_can_cu: "Tự luận có căn cứ",
};

export const TEN_CACH_CHAM: Record<string, string> = {
  may: "Máy chấm",
  ai: "AI chấm theo rubric",
  nguoi: "Người chấm",
  tu_danh_gia: "Tự đánh giá",
};
