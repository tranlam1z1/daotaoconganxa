/**
 * Thanh giọng nói của một câu hỏi lựa chọn (docs/PLAN.md GĐ14): "Đọc câu hỏi" và "Nói đáp án".
 *
 * Lời nói được máy chủ khớp với phương án (packages/dao-tao/src/khop-loi-noi.ts). Khớp chắc thì
 * gọi `onChon`; không chắc thì báo nói lại, không tự chọn thay người học.
 */
import { useEffect, useState } from "react";

import type { DeCauHoi } from "../../lib/ngan-hang";
import { Icon } from "../ui/Icon";
import { NutMicro } from "./NutMicro";
import { loiDocCauHoi, useDocThanhTieng } from "./useDocThanhTieng";

export type KetQuaKhop =
  | { loai: "khop"; id: string; viTri: number; cach: "chu_cai" | "noi_dung" }
  | { loai: "khong_chac"; lyDo: "rong" | "mo_ho" | "ngoai_pham_vi" };

/** Hỏi máy chủ lời nói chỉ phương án nào. Lỗi mạng trả null. */
export async function khopDapAn(loiNoi: string, phuongAn: Array<{ id: string; text: string }>) {
  try {
    const res = await fetch("/api/giong-doc/khop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loi_noi: loiNoi, phuong_an: phuongAn }),
    });
    return res.ok ? ((await res.json()) as KetQuaKhop) : null;
  } catch {
    return null;
  }
}

/** Loại câu trả lời được bằng một lời nói. */
export function noiDuocDapAn(de: DeCauHoi): boolean {
  return (de.kind === "mot_dap_an" || de.kind === "dung_sai") && (de.options.phuong_an?.length ?? 0) > 0;
}

export function ThanhGiongNoiCauHoi({
  de,
  onChon,
  khoa = false,
  tuDoc = false,
}: {
  de: DeCauHoi;
  onChon: (id: string) => void;
  /** Câu đã chấm: không nhận đáp án nói nữa. */
  khoa?: boolean;
  /** Đọc câu hỏi ngay khi hiện. */
  tuDoc?: boolean;
}) {
  const tts = useDocThanhTieng();
  const [thongBao, setThongBao] = useState<{ loai: "ok" | "loi"; text: string } | null>(null);
  const [dangKhop, setDangKhop] = useState(false);
  const phuongAn = de.options.phuong_an ?? [];
  const loiDoc = loiDocCauHoi(de);

  // Đổi câu thì xóa thông báo cũ; trình đọc tự đọc câu mới.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chỉ chạy lại khi đổi câu hoặc khi biết có giọng đọc
  useEffect(() => {
    setThongBao(null);
    if (tuDoc && tts.hoTro) void tts.doc(loiDoc);
  }, [loiDoc, tts.hoTro]);

  const nhan = async (loiNoi: string) => {
    if (khoa) return;
    setDangKhop(true);
    const kq = await khopDapAn(loiNoi, phuongAn);
    setDangKhop(false);
    if (!kq) {
      setThongBao({ loai: "loi", text: "Không kết nối được máy chủ. Hãy chạm vào đáp án." });
    } else if (kq.loai === "khop") {
      const p = phuongAn[kq.viTri];
      const ten =
        de.kind === "dung_sai" ? (p?.text ?? "") : `phương án ${String.fromCharCode(65 + kq.viTri)}`;
      setThongBao({ loai: "ok", text: `Nghe được "${loiNoi}": chọn ${ten}.` });
      onChon(kq.id);
    } else {
      const viDu = de.kind === "dung_sai" ? '"đúng" hoặc "sai"' : '"đáp án A" hoặc đọc nội dung phương án';
      setThongBao({
        loai: "loi",
        text: `Nghe được "${loiNoi}" nhưng chưa rõ đáp án. Hãy nói lại, ví dụ ${viDu}.`,
      });
    }
  };

  const coNoi = noiDuocDapAn(de) && !khoa;
  if (!tts.hoTro && !coNoi) return null;

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-start gap-2">
        {tts.hoTro ? (
          <button
            type="button"
            onClick={() => (tts.dangDoc || tts.dangTai ? tts.dung() : void tts.doc(loiDoc))}
            aria-pressed={tts.dangDoc}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-[15px] font-medium dong-bam"
          >
            <Icon name={tts.dangDoc ? "pause" : "loa"} />
            {tts.dangTai ? "Đang chuẩn bị giọng đọc" : tts.dangDoc ? "Dừng đọc" : "Đọc câu hỏi"}
          </button>
        ) : null}
        {coNoi ? <NutMicro nhan={dangKhop ? "Đang khớp đáp án" : "Nói đáp án"} onKetQua={nhan} /> : null}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {tts.loi ? <span className="text-danger">{tts.loi}</span> : null}
        {thongBao ? (
          <span className={thongBao.loai === "ok" ? "text-ok" : "text-danger"}>{thongBao.text}</span>
        ) : null}
      </p>
    </div>
  );
}
