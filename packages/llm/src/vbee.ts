/**
 * Gọi API chuyển văn bản thành giọng nói của Vbee (tách từ apps/api/src/giong-doc.ts, GĐ14).
 *
 * Dùng chung cho API (đọc lời thoại, đọc câu hỏi) và worker sách nói. Tệp này chỉ lo gọi Vbee;
 * bộ nhớ đệm, kho đối tượng và hạn mức nằm ở nơi gọi.
 *
 * Gói Vbee đang dùng không có API realtime, chỉ có API bất đồng bộ: gửi lời, nhận mã yêu cầu,
 * hỏi lại cho tới khi xong rồi tải tệp MP3 về. Một lời mới mất chừng 15 giây.
 */
import { createHash } from "node:crypto";

const CHU_KY_HOI_MS = 700;
const CHO_TOI_DA_MS = 90_000;
/** Tốc độ bit của tệp xin Vbee trả về; dùng để tính thời lượng từ số byte. */
export const BITRATE_VBEE = 128;

export interface CauHinhVbee {
  url: string;
  appId: string;
  token: string;
  voiceCode: string;
  speed: number;
  callbackUrl: string;
}

export function cauHinhVbee(): CauHinhVbee | null {
  const appId = process.env.VBEE_APP_ID?.trim();
  const token = process.env.VBEE_ACCESS_TOKEN?.trim();
  if (!appId || !token) return null;
  const speed = Number(process.env.VBEE_SPEED ?? 1);
  return {
    url: (process.env.VBEE_API_URL?.trim() || "https://vbee.vn/api/v1/tts").replace(/\/+$/, ""),
    appId,
    token,
    voiceCode: process.env.VBEE_VOICE_CODE?.trim() || "hn_female_ngochuyen_full_48k-fhg",
    speed: Number.isFinite(speed) && speed >= 0.1 && speed <= 1.9 ? speed : 1,
    // API bắt buộc có callback_url dù ta tự hỏi kết quả; Vbee gọi vào đó thất bại cũng không sao.
    callbackUrl: process.env.VBEE_CALLBACK_URL?.trim() || "https://quydinhphapluat.vn/api/vbee-callback",
  };
}

export function chuanHoaLoiDoc(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[*_`#>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Khóa bản đọc: cùng giọng, cùng tốc độ, cùng lời thì cùng khóa, dùng lại được mọi nơi. */
export function khoaGiongDoc(cfg: Pick<CauHinhVbee, "voiceCode" | "speed">, text: string): string {
  return createHash("sha256")
    .update(`${cfg.voiceCode}|${cfg.speed}|${chuanHoaLoiDoc(text)}`)
    .digest("hex");
}

/** URI trong kho đối tượng của một bản đọc. */
export const uriGiongDoc = (khoa: string) => `giong-doc/${khoa}.mp3`;

/** Thời lượng (giây) của tệp MP3 tốc độ bit cố định. */
export function giayCuaMp3(soByte: number, bitrateKbps = BITRATE_VBEE): number {
  return Math.round((soByte * 8 * 100) / (bitrateKbps * 1000)) / 100;
}

export class LoiGiongDoc extends Error {
  constructor(
    readonly status: number,
    chiTiet: string,
  ) {
    super(`Vbee trả về ${status}: ${chiTiet}`);
    this.name = "LoiGiongDoc";
  }
}

export type KetQuaYeuCau =
  | { trangThai: "xong"; link: string }
  | { trangThai: "cho" }
  | { trangThai: "loi"; lyDo: string };

/** Đọc phản hồi của lần hỏi kết quả. Trạng thái lạ mà không mang dấu hiệu lỗi thì coi là đang xử lý. */
export function docKetQua(json: unknown): KetQuaYeuCau {
  const r = (json as { status?: number; result?: { status?: string; audio_link?: string } } | null) ?? {};
  const st = r.result?.status ?? "";
  if (st === "SUCCESS" && r.result?.audio_link) return { trangThai: "xong", link: r.result.audio_link };
  if (r.status === 0 || /FAIL|ERROR/i.test(st))
    return { trangThai: "loi", lyDo: JSON.stringify(json).slice(0, 300) };
  return { trangThai: "cho" };
}

async function docJson(res: Response): Promise<unknown> {
  return await res.json().catch(() => null);
}

async function taoYeuCau(cfg: CauHinhVbee, text: string): Promise<string> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      app_id: cfg.appId,
      response_type: "indirect",
      callback_url: cfg.callbackUrl,
      input_text: chuanHoaLoiDoc(text),
      voice_code: cfg.voiceCode,
      audio_type: "mp3",
      bitrate: BITRATE_VBEE,
      speed_rate: cfg.speed.toFixed(1),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await docJson(res)) as { status?: number; result?: { request_id?: string } } | null;
  const id = json?.result?.request_id;
  if (!res.ok || json?.status !== 1 || !id)
    throw new LoiGiongDoc(res.status, JSON.stringify(json).slice(0, 300));
  return id;
}

async function choLink(cfg: CauHinhVbee, id: string): Promise<string> {
  const han = Date.now() + CHO_TOI_DA_MS;
  while (Date.now() < han) {
    await Bun.sleep(CHU_KY_HOI_MS);
    let json: unknown;
    try {
      const res = await fetch(`${cfg.url}/${id}`, {
        headers: { authorization: `Bearer ${cfg.token}` },
        signal: AbortSignal.timeout(10_000),
      });
      // Lỗi tạm của một lần hỏi thì hỏi lại; chỉ dừng khi Vbee báo yêu cầu hỏng hoặc hết giờ.
      if (!res.ok) continue;
      json = await docJson(res);
    } catch {
      continue;
    }
    const kq = docKetQua(json);
    if (kq.trangThai === "xong") return kq.link;
    if (kq.trangThai === "loi") throw new LoiGiongDoc(500, `yêu cầu ${id}: ${kq.lyDo}`);
  }
  throw new LoiGiongDoc(504, `yêu cầu ${id} quá ${CHO_TOI_DA_MS / 1000} giây chưa xong`);
}

/** Gửi một lời cho Vbee, chờ đọc xong và tải tệp MP3 về. Không có bộ nhớ đệm. */
export async function docBangVbee(cfg: CauHinhVbee, text: string): Promise<Uint8Array<ArrayBuffer>> {
  const link = await choLink(cfg, await taoYeuCau(cfg, text));
  // Link hết hạn sau vài phút và chuyển hướng sang nơi chứa tệp: tải ngay, theo chuyển hướng.
  const res = await fetch(link, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  const mp3 = new Uint8Array(await res.arrayBuffer());
  if (!res.ok || mp3.byteLength === 0) throw new LoiGiongDoc(res.status, "không tải được tệp âm thanh");
  return mp3;
}
