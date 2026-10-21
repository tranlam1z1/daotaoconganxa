/**
 * Nhận dạng giọng nói tiếng Việt bằng Web Speech API của trình duyệt (docs/PLAN.md GĐ14).
 *
 * Không tốn phí và không cần máy chủ. Chrome (máy tính, Android) và Safari (iOS 14.5 trở lên) có
 * API này; Firefox thì không, khi đó `hoTro` là false và giao diện ẩn nút micro. `hoTro` chỉ biết
 * được sau khi trang chạy trên trình duyệt, nên lần vẽ ở máy chủ luôn coi là chưa hỗ trợ.
 *
 * Chrome gửi tiếng nói lên máy chủ của Google để nhận dạng: mất mạng thì báo lỗi "network".
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface KetQuaNhanDang {
  readonly isFinal: boolean;
  readonly [i: number]: { readonly transcript: string };
}
interface SuKienNhanDang {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: KetQuaNhanDang };
}
interface MayNhanDang {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SuKienNhanDang) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type HamTaoMay = new () => MayNhanDang;

function layHamTao(): HamTaoMay | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: HamTaoMay; webkitSpeechRecognition?: HamTaoMay };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Trình duyệt có nhận dạng giọng nói không. Chỉ gọi ở phía trình duyệt. */
export function coNhanDangGiong(): boolean {
  return layHamTao() !== null;
}

const THONG_BAO_LOI: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa cho dùng micro. Hãy cho phép micro trong cài đặt của trang.",
  "service-not-allowed": "Trình duyệt chưa cho dùng micro. Hãy cho phép micro trong cài đặt của trang.",
  "no-speech": "Chưa nghe thấy tiếng nói. Hãy bấm micro rồi nói lại.",
  "audio-capture": "Không tìm thấy micro trên thiết bị.",
  network: "Nhận dạng giọng nói cần kết nối mạng.",
};

export interface NhanDangGiong {
  hoTro: boolean;
  dangNghe: boolean;
  /** Chữ đang nghe được (chưa chốt), để hiện ngay khi người dùng còn đang nói. */
  tamThoi: string;
  loi: string | null;
  batDau: () => void;
  dung: () => void;
}

/**
 * `onKetQua` nhận câu đã chốt khi người dùng ngừng nói. Mỗi lần bấm chỉ nghe một câu
 * (`continuous = false`): đủ cho một câu hỏi hay một đáp án, và tự tắt micro.
 */
export function useNhanDangGiong(onKetQua: (text: string) => void): NhanDangGiong {
  const [hoTro, setHoTro] = useState(false);
  const [dangNghe, setDangNghe] = useState(false);
  const [tamThoi, setTamThoi] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const may = useRef<MayNhanDang | null>(null);
  const goiLai = useRef(onKetQua);
  goiLai.current = onKetQua;

  useEffect(() => {
    setHoTro(coNhanDangGiong());
    return () => may.current?.abort();
  }, []);

  const batDau = useCallback(() => {
    const HamTao = layHamTao();
    if (!HamTao) return;
    may.current?.abort();
    const m = new HamTao();
    m.lang = "vi-VN";
    m.continuous = false;
    m.interimResults = true;
    m.maxAlternatives = 1;
    m.onresult = (e) => {
      let chot = "";
      let tam = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const loi = r?.[0]?.transcript ?? "";
        if (r?.isFinal) chot += loi;
        else tam += loi;
      }
      setTamThoi(tam);
      if (chot.trim()) {
        setTamThoi("");
        goiLai.current(chot.trim());
      }
    };
    m.onerror = (e) => {
      // "aborted" là do chính trang dừng máy nghe: không phải lỗi của người dùng.
      if (e.error !== "aborted")
        setLoi(THONG_BAO_LOI[e.error] ?? "Không nhận dạng được giọng nói. Hãy thử lại.");
    };
    m.onend = () => {
      setDangNghe(false);
      setTamThoi("");
    };
    may.current = m;
    setLoi(null);
    setTamThoi("");
    try {
      m.start();
      setDangNghe(true);
    } catch {
      setLoi("Không bật được micro. Hãy thử lại.");
    }
  }, []);

  const dung = useCallback(() => {
    may.current?.stop();
  }, []);

  return { hoTro, dangNghe, tamThoi, loi, batDau, dung };
}
