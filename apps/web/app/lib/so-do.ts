/**
 * Sổ ghi số đo kèm ảnh (routes/cong-cu.do-dac-dien-tu.tsx): cán bộ đo bằng thước, ghim số thứ tự lên
 * ảnh chụp xe hoặc hiện trường, nhập tên và số đo của từng ghim, rồi tải về một ảnh gồm ảnh gốc có
 * ghim và bảng số đo bên dưới để đưa vào hồ sơ.
 *
 * Mọi thứ chạy trên trình duyệt: ảnh và số đo không gửi lên máy chủ, không lưu lại sau khi rời trang.
 */

export const DON_VI = ["m", "cm", "mm"] as const;
export type DonVi = (typeof DON_VI)[number];

export interface SoDo {
  id: number;
  ten: string;
  /** Giữ nguyên chuỗi người dùng gõ: đây là số ghi lại, không dùng để tính. */
  giaTri: string;
  donVi: DonVi;
  /** Vị trí ghim trên ảnh, tính theo tỷ lệ 0–1 từ góc trên trái. */
  x: number;
  y: number;
}

export interface PhieuDo {
  tieuDe: string;
  ghiChu: string;
  thoiGian: Date;
  soDo: readonly SoDo[];
}

/** Tên đại lượng hay đo, gợi ý khi gõ. */
export const GOI_Y_TEN = [
  "Chiều dài thùng xe",
  "Chiều rộng thùng xe",
  "Chiều cao thành thùng",
  "Chiều cao xếp hàng tính từ mặt đường",
  "Chiều rộng xếp hàng",
  "Chiều dài xếp hàng",
  "Chiều dài toàn bộ xe",
  "Chiều rộng mặt đường",
  "Chiều rộng làn đường",
  "Chiều dài vết phanh",
  "Khoảng cách tới mép đường",
  "Khoảng cách giữa hai xe",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Một dòng của bảng số đo: "1. Chiều cao thành thùng: 2.350 mm". */
export function dongSoDo(d: Pick<SoDo, "ten" | "giaTri" | "donVi">, stt: number): string {
  const ten = d.ten.trim() || "Số đo";
  const giaTri = d.giaTri.trim();
  return `${stt}. ${ten}: ${giaTri ? `${giaTri} ${d.donVi}` : "chưa nhập"}`;
}

/** "14:32 ngày 10/10/2026", theo giờ của máy. */
export function thoiGianChu(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tên tệp ảnh tải về: "so-do-20261010-1432.jpg". */
export function tenTepSoDo(d: Date): string {
  return `so-do-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.jpg`;
}

/** Ngắt một đoạn chữ thành các dòng không rộng quá `toiDa`; từ dài hơn cả dòng thì cắt giữa từ. */
export function ngatDong(chu: string, doRong: (s: string) => number, toiDa: number): string[] {
  const dong: string[] = [];
  let hienTai = "";
  for (let tu of chu.split(/\s+/).filter(Boolean)) {
    const thu = hienTai ? `${hienTai} ${tu}` : tu;
    if (doRong(thu) <= toiDa) {
      hienTai = thu;
      continue;
    }
    if (hienTai) dong.push(hienTai);
    while (doRong(tu) > toiDa) {
      let n = tu.length - 1;
      while (n > 1 && doRong(tu.slice(0, n)) > toiDa) n--;
      dong.push(tu.slice(0, n));
      tu = tu.slice(n);
    }
    hienTai = tu;
  }
  if (hienTai) dong.push(hienTai);
  return dong;
}

/** Bề rộng ảnh xuất ra (px): ảnh chụp điện thoại lớn hơn thì thu lại cho tệp gọn. */
const RONG_TOI_DA = 1600;
const MAU_GHIM = "#c92a2a";
const PHONG = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/**
 * Vẽ ảnh hồ sơ: ảnh gốc có ghim đánh số ở trên, khung trắng ghi tiêu đề, thời gian, bảng số đo và
 * ghi chú ở dưới. Chỉ gọi trên trình duyệt.
 */
export function veAnhSoDo(anh: HTMLImageElement, phieu: PhieuDo): HTMLCanvasElement {
  const rong = Math.min(anh.naturalWidth, RONG_TOI_DA);
  const caoAnh = Math.round((anh.naturalHeight * rong) / anh.naturalWidth);
  const co = Math.max(16, Math.round(rong / 45));
  const le = co;
  const cachDong = Math.round(co * 1.45);
  const kieu = (dam: boolean, heSo = 1) => `${dam ? "700" : "400"} ${Math.round(co * heSo)}px ${PHONG}`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không vẽ được ảnh");

  // Xếp chữ trước để biết chiều cao khung dưới; đổi cỡ canvas làm mất kiểu chữ nên đặt lại khi vẽ.
  const doan: Array<{ chu: string; dam: boolean }> = [
    ...(phieu.tieuDe.trim() ? [{ chu: phieu.tieuDe.trim(), dam: true }] : []),
    { chu: `Ghi lúc ${thoiGianChu(phieu.thoiGian)}`, dam: false },
    ...phieu.soDo.map((d, i) => ({ chu: dongSoDo(d, i + 1), dam: false })),
    ...(phieu.ghiChu.trim() ? [{ chu: `Ghi chú: ${phieu.ghiChu.trim()}`, dam: false }] : []),
  ];
  const dong = doan.flatMap((d) => {
    ctx.font = kieu(d.dam);
    return ngatDong(d.chu, (s) => ctx.measureText(s).width, rong - 2 * le).map((chu) => ({
      chu,
      dam: d.dam,
    }));
  });

  canvas.width = rong;
  canvas.height = caoAnh + 2 * le + dong.length * cachDong;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(anh, 0, 0, rong, caoAnh);

  const r = Math.max(14, Math.round(rong / 50));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  phieu.soDo.forEach((d, i) => {
    const x = d.x * rong;
    const y = d.y * caoAnh;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = MAU_GHIM;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r / 6);
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${Math.round(r * 1.1)}px ${PHONG}`;
    ctx.fillText(String(i + 1), x, y);
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111111";
  dong.forEach((d, i) => {
    ctx.font = kieu(d.dam);
    ctx.fillText(d.chu, le, caoAnh + le + i * cachDong);
  });
  return canvas;
}
