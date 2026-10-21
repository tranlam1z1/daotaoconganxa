import { cn } from "../../lib/cn";

/**
 * Bộ biểu tượng "Nét đậm, hai lớp màu" (docs/PROMPT_BO_ICON.md), SVG nội tuyến trên lưới 24, lề 2
 * (giao diện không dùng emoji — QUY-TAC-HANH-VAN.md §3.4).
 *
 * Mỗi khóa có ba lớp:
 * - net: nét chính dày 2, bo tròn, màu currentColor. Một mình lớp này phải đủ nghĩa.
 * - nen: mảng tô đặc nằm dưới nét, lệch 1,25 về phía dưới phải, màu --ic-nen (sắc pha nhạt).
 * - nhan: một chi tiết điểm nhấn, tô và viền bằng --ic-nhan. Vẽ nét đơn (không tô) thì bọc
 *   bằng vach(): đường lặp hai lần, quy tắc evenodd triệt phần tô.
 * Màu chỉ khai ở styles/app.css (khối "Bộ biểu tượng"), TSX không viết mã màu.
 *
 * Luôn aria-hidden: nghĩa của nút phải nằm ở chữ hoặc aria-label của phần tử bao ngoài.
 */
export type Sac = "chinh" | "vang" | "cam" | "do" | "luc" | "tim" | "ngoc" | "trung";
/** hai-lop: nét + nền + nhấn; net: chỉ nét, đơn sắc; dac: ô tô đặc màu sắc, nét màu chữ trên nền. */
export type KieuIcon = "hai-lop" | "net" | "dac";

interface Hinh {
  net: string;
  nen?: string;
  /** Một điểm nhấn; riêng đèn giao thông có ba đèn ba màu. */
  nhan?: string | ReadonlyArray<readonly [string, Sac]>;
  sac: Sac;
  /** Sắc của điểm nhấn khi khác sắc chính (cửa sổ vàng của ngôi nhà, dải đỏ của sách). */
  sacNhan?: Sac;
}

const vach = (d: string) => d + d;

// Hình dùng chung giữa các khóa.
const TRON = "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
const LOA = "M3 10a1 1 0 0 1 1-1h3.5L12 5v14l-4.5-4H4a1 1 0 0 1-1-1Z";
const DIEN_THOAI = "M9.5 3.5h5a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z";
const BANH = (x: number) => `M${x} 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z`;
const DEN = (y: number) => `M13 ${y}a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z`;

const BO = {
  /* Điều hướng và thao tác chung */
  search: {
    net: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.6-1.9L20 20",
    nen: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
    nhan: vach("M7.6 9.6a3 3 0 0 1 2-2"),
    sac: "ngoc",
  },
  menu: { net: "M4 6.5h16M4 12h10M4 17.5h16", sac: "trung" },
  close: { net: "M6.5 6.5l11 11m0-11-11 11", sac: "trung" },
  sun: {
    net: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
    nen: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    nhan: "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
    sac: "vang",
  },
  moon: {
    net: "M19.5 15A8 8 0 0 1 9 4.5 8 8 0 1 0 19.5 15Z",
    nen: "M19.5 15A8 8 0 0 1 9 4.5 8 8 0 1 0 19.5 15Z",
    nhan: vach("M17 3.5v3M15.5 5h3"),
    sac: "tim",
  },
  monitor: {
    net: "M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 16.5h6M12 17v3.5",
    nen: "M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    sac: "trung",
  },
  // Mũi tên: đầu tam giác nhỏ, thân chạy vào giữa đầu nên ở nét 2 đầu kín như tô đặc.
  arrowRight: { net: "M4 12h14m-3-4 5 4-5 4z", sac: "trung" },
  arrowLeft: { net: "M20 12H6m3-4-5 4 5 4z", sac: "trung" },
  arrowUp: { net: "M12 20V6m-4 3 4-5 4 5z", sac: "trung" },
  home: {
    net: "M3 11 12 3.5l9 7.5M5.5 9.5V20h13V9.5M10 20v-3.5a2 2 0 0 1 4 0V20",
    nen: "M5.5 9.5 12 4l6.5 5.5V20h-13Z",
    nhan: "M11.25 10.25h1.5v1.5h-1.5z",
    sac: "chinh",
    sacNhan: "vang",
  },
  cap: {
    net: "M2 9.5 12 5l10 4.5-10 4.5L2 9.5Zm4.5 2v4.3c0 1.6 2.5 3.2 5.5 3.2s5.5-1.6 5.5-3.2v-4.3M20.5 10.2v4.3",
    nen: "M2 9.5 12 5l10 4.5-10 4.5Z",
    nhan: "M19.75 15.5h1.5v2h-1.5z",
    sac: "chinh",
    sacNhan: "vang",
  },
  steps: {
    net: "M9 4.5H6a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-3M9 3h6v3H9zm-1.5 8 1.5 1.5 2.5-2.5m-4 6 1.5 1.5 2.5-2.5m2.5-3.5h2.5m-2.5 5h2.5",
    nen: "M6 4.5h12a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z",
    nhan: vach("M7.5 11l1.5 1.5 2.5-2.5m-4 6 1.5 1.5 2.5-2.5"),
    sac: "luc",
  },
  user: {
    net: `${TRON}M12 12.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm-5.7 6.4c1.1-2.4 3.2-3.9 5.7-3.9s4.6 1.5 5.7 3.9`,
    nen: TRON,
    sac: "chinh",
  },
  layers: {
    net: "M12 3.5 3 8l9 4.5L21 8l-9-4.5ZM3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5",
    nen: "M12 3.5 3 8l9 4.5L21 8Z",
    sac: "chinh",
  },
  help: {
    net: `${TRON}M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3m0 3.3v.01`,
    nen: TRON,
    sac: "chinh",
  },
  logout: {
    net: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m0-8h10m-3.5-3.5L20 12l-3.5 3.5",
    nen: "M4 6a2 2 0 0 1 2-2h4v16H6a2 2 0 0 1-2-2Z",
    sac: "do",
  },
  copy: {
    net: "M9 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Zm-2 8H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    nen: "M9 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
    sac: "chinh",
  },
  check: { net: "M4.5 12.5l5 5 10-11", sac: "luc" },
  x: { net: "M6 6l12 12M18 6 6 18", sac: "do" },
  chevronLeft: { net: "M15 5l-7 7 7 7", sac: "trung" },
  chevronRight: { net: "M9 5l7 7-7 7", sac: "trung" },
  chevronUp: { net: "M5 15.5l7-7 7 7", sac: "trung" },
  chevronDown: { net: "M5 8.5l7 7 7-7", sac: "trung" },
  mail: {
    net: "M5 5.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Zm-1.5 2 8.5 6 8.5-6",
    nen: "M5 5.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z",
    sac: "chinh",
  },
  phone: {
    net: "M6.5 3.5h2.2a1 1 0 0 1 1 .8l.7 3.3a1 1 0 0 1-.4 1l-1.6 1.2a11 11 0 0 0 5.8 5.8l1.2-1.6a1 1 0 0 1 1-.4l3.3.7a1 1 0 0 1 .8 1v2.2a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z",
    sac: "luc",
  },
  eye: {
    net: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    sac: "trung",
  },
  eyeOff: {
    net: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 4l16 16",
    sac: "trung",
  },

  /* Học, tài liệu, trợ lý */
  book: {
    net: "M12 6.5C10.5 5 8 4.5 3 4.5V18c5 0 7.5.5 9 2 1.5-1.5 4-2 9-2V4.5c-5 0-7.5.5-9 2Zm0 0V20",
    nen: "M12 6.5C10.5 5 8 4.5 3 4.5V18c5 0 7.5.5 9 2 1.5-1.5 4-2 9-2V4.5c-5 0-7.5.5-9 2Z",
    nhan: "M16 5.2V10l1.5-1.3L19 10V4.9Z",
    sac: "chinh",
    sacNhan: "do",
  },
  chat: {
    net: "M5 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3.5V17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm1.5 5.5h.01m3.5 0h.01m3.5 0h.01",
    nen: "M5 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3.5V17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
    nhan: "M20 3l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5Z",
    sac: "tim",
  },
  scale: {
    net: "M12 5v15m-5 0h10M5 7.5h14M5 7.5 2.5 13a2.5 2.5 0 0 0 5 0L5 7.5Zm14 0L16.5 13a2.5 2.5 0 0 0 5 0L19 7.5Z",
    nen: "M2.5 13a2.5 2.5 0 0 0 5 0Zm14 0a2.5 2.5 0 0 0 5 0Z",
    nhan: "M13 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
    sac: "chinh",
    sacNhan: "vang",
  },
  file: {
    net: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6m-6 4h6",
    nen: "M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
    nhan: "M14 3v5h5Z",
    sac: "chinh",
  },
  list: { net: "M9 6.5h11M9 12h11M9 17.5h11M4 6.5h1M4 12h1M4 17.5h1", sac: "chinh" },
  calendar: {
    net: "M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm-2 5h16M8.5 3v4m7-4v4",
    nen: "M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    nhan: "M14 14h2v2h-2z",
    sac: "cam",
  },
  chart: {
    net: "M3.5 20.5h17M5 13h2.5v5H5zm5.75-4h2.5v9h-2.5zm5.75-4.5H19V18h-2.5z",
    nen: "M5 13h2.5v5H5zm5.75-4h2.5v9h-2.5z",
    nhan: "M16.5 4.5H19V18h-2.5z",
    sac: "ngoc",
  },
  bell: {
    net: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2ZM12 3v2m-2.5 16.5h5",
    nen: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z",
    nhan: "M19.5 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
    sac: "cam",
    sacNhan: "do",
  },
  idCard: {
    net: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm1.5 4.5h4v5h-4zm7 .5h4m-4 4h4",
    nen: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    sac: "chinh",
  },
  nhom: {
    net: "M9 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0M15.5 5.3a2.5 2.5 0 1 1 0 4.4M17.5 14a5 5 0 0 1 3.5 5",
    nen: "M9 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8a6 6 0 0 1 12 0Z",
    sac: "chinh",
  },
  coVu: {
    net: "M7 14V7a1.5 1.5 0 0 1 3 0v5m0-6.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4l-1-1.8a1.5 1.5 0 0 1 2.5-1.6L7 16",
    nen: "M7 13h9v1c0 4-2.5 7-6.5 7-3 0-4.5-1.5-6-4l-1-1.8a1.5 1.5 0 0 1 2.5-1.6L7 16Z",
    nhan: vach("M18.5 4.5 20 3M19.5 8H21"),
    sac: "vang",
  },

  /* Thành tích và tiến độ */
  star: {
    net: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
    nen: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z",
    nhan: vach("M9.6 11.8l1.3-1.6"),
    sac: "vang",
  },
  trophy: {
    net: "M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0V4Zm0 2h-3v1A3.5 3.5 0 0 0 8 10.5M16.5 6h3v1a3.5 3.5 0 0 1-3.5 3.5M12 14v3m-2.5 0h5l1 3.5h-7l1-3.5Z",
    nen: "M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0Z",
    nhan: "M12 7l.6 1 1 .4-1 .5-.6 1.1-.6-1.1-1-.5 1-.4Z",
    sac: "vang",
  },
  flame: {
    net: "M12 21c-3.9 0-7-2.8-7-6.5 0-3 2-5 3.5-6.5.3 1.8 1.2 3 2.5 3.5C11 8 12 5 14.5 3c.2 3 1.4 4.6 2.7 6.2C18.4 10.7 19 12.3 19 14.5 19 18.2 15.9 21 12 21Zm0 0c-1.7 0-3-1.3-3-3 0-1.8 1.5-3 3-4.5 1.5 1.5 3 2.7 3 4.5 0 1.7-1.3 3-3 3Z",
    nen: "M12 21c-3.9 0-7-2.8-7-6.5 0-3 2-5 3.5-6.5.3 1.8 1.2 3 2.5 3.5C11 8 12 5 14.5 3c.2 3 1.4 4.6 2.7 6.2C18.4 10.7 19 12.3 19 14.5 19 18.2 15.9 21 12 21Z",
    nhan: "M12 19c-.6 0-1-.4-1-1 0-.7.4-1.2 1-1.8.6.6 1 1.1 1 1.8 0 .6-.4 1-1 1Z",
    sac: "cam",
    sacNhan: "vang",
  },
  gauge: {
    net: "M3 16.5a9 9 0 0 1 18 0M5.5 12.75l1.3.75M12 9v1.5m6.5 2.25-1.3.75M12 16.5l4-4.5",
    nen: "M3 16.5a9 9 0 0 1 18 0Z",
    nhan: "M13.5 16.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
    sac: "ngoc",
  },
  timer: {
    net: "M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm0-7.5V10M10 3h4m-2 0v3m6 1.5 1.2-1.2",
    nen: "M12 21a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z",
    nhan: "M13 10.5a3.2 3.2 0 0 1 1.8 4.3L13 13.5Z",
    sac: "cam",
  },
  clock: { net: `${TRON}M12 7v5l3.5 2`, nen: TRON, sac: "cam" },
  lock: {
    net: "M6.5 10.5h11a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2ZM8 10.5v-3a4 4 0 0 1 8 0v3",
    nen: "M6.5 10.5h11a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z",
    nhan: "M12 14.5v2",
    sac: "trung",
  },
  puzzle: {
    net: "M3.5 8.5H8a2.25 2.25 0 1 1 4 0h4.5V13a2.25 2.25 0 1 1 0 4v3.5h-13Z",
    nen: "M3.5 8.5H8a2.25 2.25 0 1 1 4 0h4.5V13a2.25 2.25 0 1 1 0 4v3.5h-13Z",
    sac: "tim",
  },

  /* Giao thông và nghiệp vụ */
  sign: {
    net: "M10.3 4.5a2 2 0 0 1 3.4 0l7.4 12.6a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3ZM12 9.5V14m0 3v.01",
    nen: "M10.3 4.5a2 2 0 0 1 3.4 0l7.4 12.6a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z",
    nhan: vach("M10.3 4.5a2 2 0 0 1 3.4 0l7.4 12.6a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3Z"),
    sac: "vang",
    sacNhan: "do",
  },
  banknote: {
    net: "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5.5 12h.01m13 0h.01",
    nen: "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
    nhan: "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
    sac: "luc",
  },
  car: {
    net: `M5.5 16.5h-2a1 1 0 0 1-1-1V13a1 1 0 0 1 .8-1l2.7-.5L8 7.5h7l3.5 4 2 .5a1 1 0 0 1 .8 1v2.5a1 1 0 0 1-1 1h-1.8m-9 0h5M6 11.5h12.5M12 7.5v4${BANH(7.5)}${BANH(16.5)}`,
    nen: "M2.5 13a1 1 0 0 1 .8-1l2.7-.5L8 7.5h7l3.5 4 2 .5a1 1 0 0 1 .8 1v2.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1Z",
    nhan: "M19.5 13.8h1",
    sac: "chinh",
    sacNhan: "vang",
  },
  truck: {
    net: `M4.5 16.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10m-5 0h6.5m4 0h1a1 1 0 0 0 1-1V13l-2.5-3.5h-5${BANH(6.5)}${BANH(17)}`,
    nen: "M3.5 5.5h9a1 1 0 0 1 1 1v10h-10a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z",
    sac: "cam",
  },
  moto: {
    // Xe tay ga nhìn nghiêng: thân sau trên bánh sau, sàn để chân, càng trước lên tay lái.
    net: "M5.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 14.5A3.5 3.5 0 0 1 6.5 11H11l1.5 6H8m4.5 0H15l2-5m1.5 5L16 8h-2.5",
    nen: "M3 14.5A3.5 3.5 0 0 1 6.5 11H11l1.5 6H8Z",
    nhan: "M18.25 10h1",
    sac: "chinh",
    sacNhan: "vang",
  },
  camera: {
    net: "M4 7.5h3l1.5-2.5h7L17 7.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Zm8 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    nen: "M4 7.5h3l1.5-2.5h7L17 7.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z",
    nhan: "M18.5 10.5h.01",
    sac: "tim",
    sacNhan: "do",
  },
  shield: {
    net: "M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Zm-3.5 9 2.5 2.5 4.5-4.5",
    nen: "M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6Z",
    nhan: vach("M8.5 12l2.5 2.5 4.5-4.5"),
    sac: "luc",
  },
  ban: { net: `${TRON}M5.6 5.6l12.8 12.8`, nen: TRON, sac: "do" },
  alert: { net: `${TRON}M12 7.5V13m0 3.5v.01`, nen: TRON, sac: "do" },
  info: { net: `${TRON}M12 11v5.5m0-9v.01`, nen: TRON, sac: "chinh" },
  road: {
    net: "M4 21 9.5 3m10.5 18L14.5 3M12 4v2.5m0 4v3m0 4V21",
    nen: "M4 21 9.5 3h5L20 21Z",
    nhan: vach("M12 4v2.5m0 4v3m0 4V21"),
    sac: "ngoc",
    sacNhan: "vang",
  },
  /* Bản đồ gấp ba tấm: địa giới hành chính. */
  map: {
    net: "M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11V20",
    nen: "M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5Z",
    nhan: "M15 6.5 9 4v13.5l6 2.5Z",
    sac: "luc",
  },
  /* Ghim vị trí: địa chỉ, xã/phường. */
  ghim: {
    net: "M12 21.5s-7-5.8-7-11.5a7 7 0 0 1 14 0c0 5.7-7 11.5-7 11.5Z",
    nen: "M12 21.5s-7-5.8-7-11.5a7 7 0 0 1 14 0c0 5.7-7 11.5-7 11.5Z",
    nhan: "M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
    sac: "chinh",
    sacNhan: "vang",
  },
  /* Định vị GPS: lấy vị trí hiện tại. */
  dinhVi: {
    net: "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 2v3m0 14v3M2 12h3m14 0h3",
    nen: "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
    nhan: "M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
    sac: "ngoc",
  },
  /* Tòa nhà: tỉnh, thành phố. */
  toaNha: {
    net: "M3 21h18M5 21V9l5-2.5V21m0-17.5h9V21M13 7.5h3M13 11h3M13 14.5h3",
    nen: "M5 21V9l5-2.5V3.5h9V21Z",
    nhan: "M7 12.5h1v1H7z",
    sac: "tim",
    sacNhan: "vang",
  },
  turn: { net: "M6 20.5V13a5 5 0 0 1 5-5h7m-3-4 5 4-5 4z", sac: "ngoc" },
  trafficLight: {
    net: `M9 2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 18v2${DEN(6.25)}${DEN(11)}${DEN(15.75)}`,
    nen: "M9 2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z",
    // Ba đèn đỏ, vàng, xanh từ trên xuống: vẫn phân biệt được bằng vị trí khi không nhìn màu.
    nhan: [
      [DEN(6.25), "do"],
      [DEN(11), "vang"],
      [DEN(15.75), "luc"],
    ],
    sac: "trung",
  },
  bolt: {
    net: "M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8Z",
    nen: "M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8Z",
    sac: "vang",
  },

  /* Giọng nói, âm thanh, rung */
  mic: {
    net: "M12 3a3 3 0 0 0-3 3v5.5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3.5 0h7",
    nen: "M9 6a3 3 0 0 1 6 0v5.5a3 3 0 0 1-6 0Z",
    sac: "tim",
  },
  loa: { net: `${LOA}M15.5 9a4 4 0 0 1 0 6M18.5 6a8 8 0 0 1 0 12`, nen: LOA, sac: "tim" },
  volumeOff: { net: `${LOA}M16 9.5l5 5m0-5-5 5`, nen: LOA, sac: "tim" },
  play: {
    net: "M6.5 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L8 4.3a1 1 0 0 0-1.5.9Z",
    nen: "M6.5 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L8 4.3a1 1 0 0 0-1.5.9Z",
    sac: "tim",
  },
  pause: {
    net: "M7 5h2.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7.5 0H17a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
    nen: "M7 5h2.5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7.5 0H17a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
    sac: "tim",
  },
  "doan-truoc": {
    net: "M18 6.2v11.6a1 1 0 0 1-1.6.8L8.5 12.8a1 1 0 0 1 0-1.6l7.9-5.8a1 1 0 0 1 1.6.8ZM5.5 6v12",
    nen: "M18 6.2v11.6a1 1 0 0 1-1.6.8L8.5 12.8a1 1 0 0 1 0-1.6l7.9-5.8a1 1 0 0 1 1.6.8Z",
    sac: "tim",
  },
  "doan-sau": {
    net: "M6 6.2v11.6a1 1 0 0 0 1.6.8l7.9-5.8a1 1 0 0 0 0-1.6L7.6 5.4A1 1 0 0 0 6 6.2ZM18.5 6v12",
    nen: "M6 6.2v11.6a1 1 0 0 0 1.6.8l7.9-5.8a1 1 0 0 0 0-1.6L7.6 5.4A1 1 0 0 0 6 6.2Z",
    sac: "tim",
  },
  vibrate: { net: `${DIEN_THOAI}M4.5 8.5v7M2 10.5v3m17.5-5v7m2.5-5v3`, nen: DIEN_THOAI, sac: "tim" },
  vibrateOff: { net: `${DIEN_THOAI}M3.5 3.5l17 17`, nen: DIEN_THOAI, sac: "tim" },
} satisfies Record<string, Hinh>;

export type IconName = keyof typeof BO;

/** Mọi khóa, theo thứ tự khai báo (trang xem trước /xem-bieu-tuong). */
export const TEN_BIEU_TUONG = Object.keys(BO) as IconName[];

/** Sắc mặc định của một khóa. */
export const sacCua = (name: IconName): Sac => (BO[name] as Hinh).sac;

export function Icon({
  name,
  className = "size-5",
  sac,
  kieu = "hai-lop",
}: {
  name: IconName;
  className?: string;
  /** Ghi đè sắc mặc định của khóa. */
  sac?: Sac;
  kieu?: KieuIcon;
}) {
  const h: Hinh = BO[name];
  const s = sac ?? h.sac;
  const dac = kieu === "dac";
  const nhan =
    kieu === "net" || !h.nhan
      ? []
      : typeof h.nhan === "string"
        ? [[h.nhan, h.sacNhan ?? s] as const]
        : h.nhan;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("ic", className)}
      data-sac={s}
      data-kieu={kieu}
    >
      {/* Kiểu tô đặc: ô bo góc màu sắc, hình thu 75% vào giữa, nét giữ dày 2 sau khi thu. */}
      {dac ? <rect width="24" height="24" rx="7" className="ic-o" stroke="none" /> : null}
      <g
        className={dac ? "ic-tren" : undefined}
        transform={dac ? "matrix(.75 0 0 .75 3 3)" : undefined}
        strokeWidth={dac ? 2.67 : undefined}
      >
        {kieu === "hai-lop" && h.nen ? (
          <path d={h.nen} className="ic-nen" stroke="none" transform="translate(1.25 1.25)" />
        ) : null}
        <path d={h.net} />
        {nhan.map(([d, sn]) => (
          <path key={sn + d} d={d} className="ic-nhan" data-sac={sn} fillRule="evenodd" />
        ))}
      </g>
    </svg>
  );
}
