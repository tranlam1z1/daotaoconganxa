/**
 * Chế độ sáng/tối. Lựa chọn lưu ở localStorage; mọi thao tác bọc try/catch vì trình duyệt có
 * thể chặn lưu trữ (chế độ riêng tư). Khi chưa chọn lần nào, lần tải đầu lấy theo hệ thống.
 */
export type ThemeChoice = "sang" | "toi";

export const THEME_KEY = "qdpl.giao-dien";

/** Đọc chế độ đang áp dụng (script khởi động trong <head> đã đặt sẵn data-theme). */
export function readTheme(): ThemeChoice {
  return document.documentElement.dataset.theme === "dark" ? "toi" : "sang";
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice === "toi" ? "dark" : "light";
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Không lưu được thì vẫn áp dụng cho phiên hiện tại.
  }
}
