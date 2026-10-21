/**
 * Giọng đọc tiếng Việt (lời mascot, đọc câu hỏi), qua API chuyển văn bản thành giọng nói của Vbee.
 * Phần gọi Vbee nằm ở packages/llm/src/vbee.ts, dùng chung với worker sách nói (GĐ14).
 *
 * Gói Vbee đang dùng không có API realtime, chỉ có API bất đồng bộ: gửi lời, nhận mã yêu cầu,
 * hỏi lại cho tới khi xong rồi tải tệp MP3 về. Một lời mới mất chừng 15 giây. Vì vậy:
 *  - bản đọc được lưu vào kho đối tượng (và giữ trong bộ nhớ), mỗi lời chỉ phải đọc một lần
 *    cho mọi người học, kể cả sau khi máy chủ khởi động lại;
 *  - giao diện gửi trước cả lộ trình dẫn dắt để đọc sẵn (`chuanBiGiongDoc`), tới lúc người học
 *    bấm "Tiếp theo" thì đã có tiếng.
 */
import {
  cauHinhVbee as cauHinh,
  chuanHoaLoiDoc as chuanHoa,
  docBangVbee,
  khoaGiongDoc as khoaCua,
  uriGiongDoc as uriKho,
} from "@qdpl/llm";
import { getObject, objectExists, putObject } from "@qdpl/storage";

export { docKetQua, type KetQuaYeuCau, LoiGiongDoc } from "@qdpl/llm";

/** Giới hạn độ dài một lời gửi lên để đọc. Lời thoại mascot ngắn hơn nhiều. */
export const TOI_DA_KY_TU = 1500;
/** Số lời tối đa một lần đọc trước. Một bài dài có khoảng 20 bước dẫn dắt. */
export const TOI_DA_CHUAN_BI = 60;

const BO_NHO_TOI_DA = 32 * 1024 * 1024;
const CUA_SO_MS = 10 * 60_000;
/** Số lời chưa có sẵn một địa chỉ được đọc trong một cửa sổ; chặn việc dùng API để đốt ký tự. */
const TOI_DA_TRONG_CUA_SO = 120;
/** Số yêu cầu gửi Vbee cùng lúc. Đọc trước cả bài không được chiếm hết lượt của lời đang chờ. */
const DONG_THOI = 3;

/** Máy chủ đã cấu hình Vbee chưa. Chưa thì giao diện không hiện nút giọng đọc. */
export function coGiongDoc(): boolean {
  return cauHinh() !== null;
}

/* -------------------- bộ nhớ đệm -------------------- */

const boNho = new Map<string, Uint8Array<ArrayBuffer>>();
let tongByte = 0;
const dangDoc = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();

function ghiBoNho(khoa: string, mp3: Uint8Array<ArrayBuffer>) {
  if (mp3.byteLength > BO_NHO_TOI_DA || boNho.has(khoa)) return;
  boNho.set(khoa, mp3);
  tongByte += mp3.byteLength;
  // Map giữ thứ tự chèn: bỏ các bản cũ nhất cho tới khi về dưới hạn mức.
  for (const [k, v] of boNho) {
    if (tongByte <= BO_NHO_TOI_DA) break;
    boNho.delete(k);
    tongByte -= v.byteLength;
  }
}

/** Lời này đã có sẵn bản đọc chưa (có thì không tính vào hạn mức). */
export async function daCoSan(text: string): Promise<boolean> {
  const cfg = cauHinh();
  if (!cfg) return false;
  const khoa = khoaCua(cfg, text);
  if (boNho.has(khoa) || dangDoc.has(khoa)) return true;
  try {
    return await objectExists(uriKho(khoa));
  } catch {
    return false;
  }
}

/* -------------------- hạn mức theo địa chỉ -------------------- */

const luot = new Map<string, number[]>();

export function choPhepDoc(diaChi: string, now = Date.now()): boolean {
  const moc = (luot.get(diaChi) ?? []).filter((t) => now - t < CUA_SO_MS);
  const duoc = moc.length < TOI_DA_TRONG_CUA_SO;
  if (duoc) moc.push(now);
  luot.set(diaChi, moc);
  if (luot.size > 5000) {
    for (const [k, v] of luot) if (!v.some((t) => now - t < CUA_SO_MS)) luot.delete(k);
  }
  return duoc;
}

/* -------------------- giới hạn đồng thời -------------------- */

let dangChay = 0;
const hangCho: Array<() => void> = [];

/** Chạy `viec` khi còn lượt. Lời người học đang chờ nghe (`uuTien`) chen lên trước lời đọc trước. */
async function theoLuot<T>(viec: () => Promise<T>, uuTien: boolean): Promise<T> {
  if (dangChay >= DONG_THOI) {
    // Lượt được trao thẳng từ việc vừa xong, nên không tăng `dangChay` ở đây.
    await new Promise<void>((r) => (uuTien ? hangCho.unshift(r) : hangCho.push(r)));
  } else {
    dangChay += 1;
  }
  try {
    return await viec();
  } finally {
    const keTiep = hangCho.shift();
    if (keTiep) keTiep();
    else dangChay -= 1;
  }
}

/**
 * Đọc một lời thành MP3: bộ nhớ, rồi kho, cuối cùng mới gọi Vbee.
 * Lời trùng nhau đang đọc dở thì dùng chung một lần gọi.
 */
export async function tongHopGiongDoc(text: string, uuTien = true): Promise<Uint8Array<ArrayBuffer>> {
  const cfg = cauHinh();
  if (!cfg) throw new Error("Chưa cấu hình VBEE_APP_ID và VBEE_ACCESS_TOKEN");
  const khoa = khoaCua(cfg, text);
  const co = boNho.get(khoa);
  if (co) return co;
  const dang = dangDoc.get(khoa);
  if (dang) return dang;

  const viec = (async () => {
    const uri = uriKho(khoa);
    try {
      if (await objectExists(uri)) {
        const mp3 = new Uint8Array(await getObject(uri));
        ghiBoNho(khoa, mp3);
        return mp3;
      }
    } catch (e) {
      console.warn("[giong-doc] không đọc được kho, đọc lại bằng Vbee:", e instanceof Error ? e.message : e);
    }
    const mp3 = await theoLuot(() => docBangVbee(cfg, text), uuTien);
    ghiBoNho(khoa, mp3);
    await putObject(uri, mp3, { contentType: "audio/mpeg" }).catch((e) =>
      console.warn("[giong-doc] không lưu được bản đọc vào kho:", e instanceof Error ? e.message : e),
    );
    return mp3;
  })();
  dangDoc.set(khoa, viec);
  try {
    return await viec;
  } finally {
    dangDoc.delete(khoa);
  }
}

/**
 * Đọc trước một loạt lời, không chờ kết quả. Lời đã có sẵn bỏ qua; hết hạn mức thì dừng.
 * Trả số lời được đưa vào hàng đọc.
 */
export async function chuanBiGiongDoc(texts: string[], diaChi: string): Promise<number> {
  let so = 0;
  const cacLoi = [...new Set(texts.map(chuanHoa).filter(Boolean))].slice(0, TOI_DA_CHUAN_BI);
  for (const text of cacLoi) {
    if (await daCoSan(text)) continue;
    if (!choPhepDoc(diaChi)) break;
    so += 1;
    tongHopGiongDoc(text, false).catch((e) =>
      console.warn("[giong-doc] đọc trước thất bại:", e instanceof Error ? e.message : e),
    );
  }
  return so;
}
