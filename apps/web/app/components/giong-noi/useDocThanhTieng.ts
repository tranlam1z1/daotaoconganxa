/**
 * Đọc thành tiếng (docs/PLAN.md GĐ14), dựng lại từ useGiongDoc.ts của nhân vật đồng hành.
 *
 * Giọng Vbee đi qua cầu nối `/api/giong-doc` (bắt buộc đăng nhập). Lời mới lần đầu có thể mất vài
 * chục giây, lời đã đọc thì có ngay. Hỏng ở bất kỳ bước nào thì dừng êm và báo một dòng: chữ vẫn
 * nằm trên màn hình, giọng đọc không được làm hỏng việc học.
 *
 * `hoTro` là false khi chưa đăng nhập hoặc máy chủ chưa cấu hình Vbee; giao diện ẩn nút đọc.
 */
import { useCallback, useEffect, useRef, useState } from "react";

let trangThai: Promise<boolean> | null = null;

/** Hỏi máy chủ một lần cho cả trang: có đọc thành tiếng được không. */
function coDocThanhTieng(): Promise<boolean> {
  trangThai ??= fetch("/api/giong-doc")
    .then(async (r) =>
      r.ok ? Boolean(((await r.json()) as { doc_thanh_tieng?: boolean }).doc_thanh_tieng) : false,
    )
    .catch(() => false);
  return trangThai;
}

/** Bản đọc đã tải trong phiên trang, để đọc lại không phải tải lại. Giữ tối đa 40 lời. */
const daTai = new Map<string, string>();
function ghiDaTai(text: string, url: string) {
  daTai.set(text, url);
  if (daTai.size > 40) {
    const [cu, u] = daTai.entries().next().value as [string, string];
    daTai.delete(cu);
    URL.revokeObjectURL(u);
  }
}

async function taiBanDoc(text: string, signal?: AbortSignal): Promise<string | null> {
  const co = daTai.get(text);
  if (co) return co;
  const res = await fetch("/api/giong-doc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) return null;
  const url = URL.createObjectURL(await res.blob());
  ghiDaTai(text, url);
  return url;
}

/** Nhờ máy chủ đọc trước các lời sắp dùng (câu hỏi kế tiếp). Không chờ, không báo lỗi. */
export function chuanBiDocThanhTieng(texts: string[]) {
  const cacLoi = texts.map((t) => t.trim()).filter(Boolean);
  if (!cacLoi.length) return;
  void coDocThanhTieng().then((co) => {
    if (!co) return;
    fetch("/api/giong-doc/chuan-bi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: cacLoi }),
    }).catch(() => {});
  });
}

export interface DocThanhTieng {
  hoTro: boolean;
  /** Đang chờ bản đọc từ máy chủ. */
  dangTai: boolean;
  dangDoc: boolean;
  loi: string | null;
  doc: (text: string) => Promise<void>;
  dung: () => void;
}

export function useDocThanhTieng(): DocThanhTieng {
  const [hoTro, setHoTro] = useState(false);
  const [dangTai, setDangTai] = useState(false);
  const [dangDoc, setDangDoc] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const huy = useRef<AbortController | null>(null);

  useEffect(() => {
    let conGan = true;
    void coDocThanhTieng().then((co) => conGan && setHoTro(co));
    return () => {
      conGan = false;
      huy.current?.abort();
      audio.current?.pause();
    };
  }, []);

  const dung = useCallback(() => {
    huy.current?.abort();
    audio.current?.pause();
    setDangTai(false);
    setDangDoc(false);
  }, []);

  const doc = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      dung();
      const ac = new AbortController();
      huy.current = ac;
      setLoi(null);
      setDangTai(true);
      try {
        const url = await taiBanDoc(t, ac.signal);
        if (ac.signal.aborted) return;
        setDangTai(false);
        if (!url) {
          setLoi("Chưa đọc được lời này. Hãy thử lại sau.");
          return;
        }
        const a = audio.current ?? new Audio();
        audio.current = a;
        a.src = url;
        a.onended = () => setDangDoc(false);
        a.onpause = () => setDangDoc(false);
        setDangDoc(true);
        await a.play();
      } catch (e) {
        if (ac.signal.aborted) return;
        setDangDoc(false);
        // Trình duyệt chặn phát tiếng khi người dùng chưa chạm vào trang: nhắc bấm nút đọc.
        setLoi(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Trình duyệt chặn tự phát tiếng. Hãy bấm nút đọc."
            : "Chưa đọc được lời này. Hãy thử lại sau.",
        );
      } finally {
        if (!ac.signal.aborted) setDangTai(false);
      }
    },
    [dung],
  );

  return { hoTro, dangTai, dangDoc, loi, doc, dung };
}

/** Lời đọc một câu hỏi lựa chọn: đề bài rồi từng phương án theo chữ cái đang hiện. */
export function loiDocCauHoi(de: {
  kind: string;
  stem: string;
  options: { phuong_an?: Array<{ text: string }> };
}): string {
  const pa = de.options.phuong_an ?? [];
  if (de.kind === "dung_sai") return `${de.stem.trim()}\nĐúng hay sai.`;
  // Sắp xếp, ghép cặp, điền chỗ trống: chỉ đọc đề, phần thao tác nằm trên màn hình.
  if (de.kind !== "mot_dap_an" && de.kind !== "nhieu_dap_an") return de.stem.trim();
  const cacPhuongAn = pa.map((p, i) => `Phương án ${String.fromCharCode(65 + i)}: ${p.text.trim()}`);
  return [de.stem.trim(), ...cacPhuongAn].join("\n");
}
