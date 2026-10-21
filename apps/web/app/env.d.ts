/// <reference types="vite/client" />

// Khai báo tối thiểu cho biến môi trường phía máy chủ (không cài @types/node trong app này).
declare const process: {
  env: Record<string, string | undefined>;
};
