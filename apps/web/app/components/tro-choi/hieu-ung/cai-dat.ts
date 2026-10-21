/**
 * Cài đặt âm thanh, rung, giảm hiệu ứng của khu trò chơi (docs/VISUAL_STYLE.md §4.3, §6.3).
 * Lưu trên máy (localStorage), dùng chung cho mọi trang trò chơi và trang Tôi.
 *
 * Máy chủ render với giá trị mặc định; trình duyệt đọc giá trị đã lưu sau khi hydrate.
 */
import { useSyncExternalStore } from "react";

import { CAI_DAT_MAC_DINH, type CaiDatGame, docCaiDat, KHOA_CAI_DAT } from "../../../lib/hieu-ung";

const nghe = new Set<() => void>();
let hienTai: CaiDatGame | null = null;

function doc(): CaiDatGame {
  if (typeof window === "undefined") return CAI_DAT_MAC_DINH;
  hienTai ??= docCaiDat((k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  });
  return hienTai;
}

export function layCaiDatGame(): CaiDatGame {
  return doc();
}

export function datCaiDatGame<K extends keyof CaiDatGame>(khoa: K, giaTri: CaiDatGame[K]): void {
  hienTai = { ...doc(), [khoa]: giaTri };
  try {
    localStorage.setItem(KHOA_CAI_DAT[khoa], giaTri ? "1" : "0");
  } catch {
    // Chế độ riêng tư chặn localStorage: cài đặt chỉ giữ tới khi tải lại trang.
  }
  for (const f of nghe) f();
}

function dangKy(f: () => void) {
  nghe.add(f);
  return () => nghe.delete(f);
}

export function useCaiDatGame(): CaiDatGame {
  return useSyncExternalStore(dangKy, doc, () => CAI_DAT_MAC_DINH);
}

/* ------------------------------------------------------------------ */
/* Giảm chuyển động: hệ điều hành HOẶC công tắc trong trò chơi          */
/* ------------------------------------------------------------------ */

const MQ = "(prefers-reduced-motion: reduce)";

function dangKyMq(f: () => void) {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", f);
  return () => mq.removeEventListener("change", f);
}

/** Hệ điều hành có bật giảm chuyển động không. */
export function useHeThongGiamChuyenDong(): boolean {
  return useSyncExternalStore(
    dangKyMq,
    () => window.matchMedia(MQ).matches,
    () => false,
  );
}

/** Có đang giảm chuyển động không (hệ điều hành hoặc công tắc trong trò chơi). */
export function useGiamChuyenDong(): boolean {
  const heThong = useHeThongGiamChuyenDong();
  return useCaiDatGame().giamHieuUng || heThong;
}

/** Bản không dùng hook, cho mã chạy ngoài React (pháo hoa, số chạy). */
export function dangGiamChuyenDong(): boolean {
  if (typeof window === "undefined") return true;
  return doc().giamHieuUng || window.matchMedia(MQ).matches;
}
