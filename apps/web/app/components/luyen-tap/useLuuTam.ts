/**
 * Lưu tạm câu trả lời của phiên luyện tập lên máy chủ (qua /luyen-tap/:phien/luu), chưa chấm.
 * Trang phiên luyện tập và trò Hỏi nhanh giọng nói dùng chung.
 *
 * - Lưu tuần tự bằng một hàng đợi promise; sửa liên tục (gõ chỗ trống) thì chờ 0,6 giây sau lần sửa
 *   cuối mới gửi, giống trang làm bài thi.
 * - Câu gửi lỗi vì mất mạng được gửi lại ở lần chuyển câu hoặc nộp bài kế tiếp (`guiHet`).
 * - Số giây làm từng câu: cộng thời gian đang mở câu đó, gửi kèm lần lưu kế tiếp của câu (máy chủ
 *   cộng dồn). Câu chưa chọn gì thì thời gian chờ tới lần lưu đầu tiên.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { TraLoiCauHoi } from "../../lib/ngan-hang";

export type TrangThaiLuu = "da_luu" | "dang_luu" | "loi";

/** Câu trả lời có nội dung (đã chọn, đã xếp, đã ghép hoặc đã điền ít nhất một ô). */
export function coTraLoi(t: TraLoiCauHoi | null | undefined): boolean {
  if (!t) return false;
  return Boolean(
    t.chon?.length ||
      t.thu_tu?.length ||
      Object.values(t.cap ?? {}).some(Boolean) ||
      Object.values(t.o_trong ?? {}).some((v) => String(v).trim()),
  );
}

export function useLuuTam(phienId: string, sttDangXem: number) {
  const [trangThai, datTrangThai] = useState<TrangThaiLuu>("da_luu");
  const [loi, datLoi] = useState<string | null>(null);
  const hangDoi = useRef<Promise<void>>(Promise.resolve());
  const cho = useRef(new Map<number, { timer: number; traLoi: TraLoiCauHoi }>());
  const thatBai = useRef(new Map<number, TraLoiCauHoi>());

  // Thời gian từng câu: phần chưa gửi theo câu, và mốc bắt đầu mở câu đang xem. Cập nhật ngay lúc
  // vẽ câu mới (như đồng hồ câu cũ của trang phiên), để không lệch một khung hình.
  const msChuaGui = useRef(new Map<number, number>());
  const dangXem = useRef({ stt: sttDangXem, tu: Date.now() });
  if (dangXem.current.stt !== sttDangXem) {
    const { stt, tu } = dangXem.current;
    msChuaGui.current.set(stt, (msChuaGui.current.get(stt) ?? 0) + Date.now() - tu);
    dangXem.current = { stt: sttDangXem, tu: Date.now() };
  }

  const layGiay = useCallback((stt: number): number => {
    let ms = msChuaGui.current.get(stt) ?? 0;
    msChuaGui.current.delete(stt);
    if (dangXem.current.stt === stt) {
      const now = Date.now();
      ms += now - dangXem.current.tu;
      dangXem.current.tu = now;
    }
    return ms / 1000;
  }, []);

  const gui = useCallback(
    (stt: number, t: TraLoiCauHoi) => {
      const giay = layGiay(stt);
      hangDoi.current = hangDoi.current.then(async () => {
        datTrangThai("dang_luu");
        let loiMang = false;
        try {
          const res = await fetch(`/luyen-tap/${phienId}/luu`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ stt, tra_loi: t, giay }),
          });
          const kq = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; loi?: string };
          if (kq.ok) thatBai.current.delete(stt);
          else if (res.status >= 400 && res.status < 500 && kq.loi) {
            // Máy chủ từ chối hẳn (phiên đã kết thúc, câu đã chấm): gửi lại cũng vậy.
            thatBai.current.delete(stt);
            datLoi(kq.loi);
          } else loiMang = true;
        } catch {
          loiMang = true;
        }
        if (loiMang) {
          thatBai.current.set(stt, t);
          msChuaGui.current.set(stt, (msChuaGui.current.get(stt) ?? 0) + giay * 1000);
        }
        datTrangThai(thatBai.current.size ? "loi" : "da_luu");
      });
    },
    [phienId, layGiay],
  );

  /** Câu `stt` vừa đổi câu trả lời: gửi sau 0,6 giây nếu không sửa thêm. */
  const doi = useCallback(
    (stt: number, t: TraLoiCauHoi) => {
      datTrangThai("dang_luu");
      const cu = cho.current.get(stt);
      if (cu) window.clearTimeout(cu.timer);
      cho.current.set(stt, {
        traLoi: t,
        timer: window.setTimeout(() => {
          cho.current.delete(stt);
          gui(stt, t);
        }, 600),
      });
    },
    [gui],
  );

  /** Gửi ngay mọi câu đang chờ và câu gửi lỗi, đợi xong. Trả true nếu mọi câu đã lưu. */
  const guiHet = useCallback(async (): Promise<boolean> => {
    for (const [stt, v] of cho.current) {
      window.clearTimeout(v.timer);
      gui(stt, v.traLoi);
    }
    cho.current.clear();
    const guiLai = [...thatBai.current];
    thatBai.current.clear();
    for (const [stt, t] of guiLai) gui(stt, t);
    await hangDoi.current;
    return thatBai.current.size === 0;
  }, [gui]);

  // Rời trang khi còn câu chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    const truocKhiRoi = (e: BeforeUnloadEvent) => {
      if (cho.current.size || thatBai.current.size || trangThai === "dang_luu") e.preventDefault();
    };
    window.addEventListener("beforeunload", truocKhiRoi);
    return () => window.removeEventListener("beforeunload", truocKhiRoi);
  }, [trangThai]);

  return { trangThai, loi, doi, guiHet };
}
