/**
 * Dựng sách nói (docs/PLAN.md GĐ14): đọc trước từng khối của bài giảng đã xuất bản bằng Vbee,
 * lưu MP3 vào kho đối tượng, ghi bảng `lesson_audio`.
 *
 * Chạy theo hai cách: job một bài (xếp khi bài được xuất bản) và job lặp không có `lessonId`
 * quét mọi bài đã xuất bản. Cả hai đều rẻ khi không có gì đổi: lời đọc của khối được băm cùng
 * giọng đọc (`text_hash`), băm không đổi thì không gọi lại Vbee. Tệp nằm ở cùng chỗ với bản đọc
 * của API giọng đọc (`giong-doc/<băm>.mp3`), nên lời đã đọc ở đâu cũng dùng lại được.
 *
 * Không thuộc đường ống nạp kho: job không mang runId nên vỏ bọc không ghi sổ cái.
 */
import { loiDocCuaKhoi } from "@qdpl/dao-tao";
import {
  amThanhCuaBai,
  amThanhTheoBam,
  baiDaXuatBanChoSachNoi,
  khoiCuaBai,
  luuAmThanhKhoi,
  xoaAmThanhNgoai,
} from "@qdpl/db";
import { cauHinhVbee, docBangVbee, giayCuaMp3, khoaGiongDoc, uriGiongDoc } from "@qdpl/llm";
import { QUEUES } from "@qdpl/queue";
import { getObject, objectExists, putObject } from "@qdpl/storage";
import { defineStage } from "../stage.ts";

/** Quét lại mọi bài mỗi 6 giờ: bắt kịp bài sửa sau khi xuất bản mà không ai xếp job. */
export const LICH_SACH_NOI = { id: "sach-noi-quet-dinh-ky", everyMs: 6 * 3600_000 } as const;

/** Phần phụ thuộc bên ngoài, tách ra để test thay bằng bản giả có bộ đếm. */
export interface NguonDoc {
  /** Khóa (băm) của một lời đọc với giọng đang dùng. */
  khoa: (loi: string) => string;
  /** Gọi dịch vụ đọc. Đây là việc tốn tiền: chỉ gọi khi thật sự chưa có bản đọc. */
  doc: (loi: string) => Promise<Uint8Array>;
  /** Kho đối tượng. */
  coSan: (uri: string) => Promise<boolean>;
  lay: (uri: string) => Promise<Uint8Array>;
  luu: (uri: string, mp3: Uint8Array) => Promise<void>;
}

export interface KetQuaDungBai {
  so_khoi: number;
  goi_moi: number;
  dung_lai: number;
  khong_doi: number;
  bo: number;
}

/** Dựng sách nói cho một bài. Lỗi đọc một khối ném ra để BullMQ thử lại cả job; khối xong không làm lại. */
export async function dungSachNoiBai(lessonId: string, nguon: NguonDoc): Promise<KetQuaDungBai> {
  const [khoi, daCo] = await Promise.all([khoiCuaBai(lessonId), amThanhCuaBai(lessonId)]);
  const cu = new Map(daCo.map((a) => [a.block_id, a]));
  const kq: KetQuaDungBai = { so_khoi: 0, goi_moi: 0, dung_lai: 0, khong_doi: 0, bo: 0 };
  const giu: string[] = [];

  for (const k of khoi) {
    const loi = loiDocCuaKhoi({ kind: k.kind as never, data: k.data });
    if (!loi) continue;
    kq.so_khoi += 1;
    giu.push(k.id);
    const bam = nguon.khoa(loi);
    if (cu.get(k.id)?.text_hash === bam) {
      kq.khong_doi += 1;
      continue;
    }

    let uri = uriGiongDoc(bam);
    let giay: number;
    const trongBang = await amThanhTheoBam(bam);
    if (trongBang) {
      uri = trongBang.uri;
      giay = Number(trongBang.seconds);
      kq.dung_lai += 1;
    } else if (await nguon.coSan(uri)) {
      giay = giayCuaMp3((await nguon.lay(uri)).byteLength);
      kq.dung_lai += 1;
    } else {
      const mp3 = await nguon.doc(loi);
      await nguon.luu(uri, mp3);
      giay = giayCuaMp3(mp3.byteLength);
      kq.goi_moi += 1;
    }
    await luuAmThanhKhoi({ lessonId, blockId: k.id, uri, seconds: giay, textHash: bam });
  }
  kq.bo = await xoaAmThanhNgoai(lessonId, giu);
  return kq;
}

/** Nguồn đọc thật: Vbee và kho đối tượng. Null khi máy chủ chưa cấu hình Vbee. */
export function nguonDocVbee(): NguonDoc | null {
  const cfg = cauHinhVbee();
  if (!cfg) return null;
  return {
    khoa: (loi) => khoaGiongDoc(cfg, loi),
    doc: (loi) => docBangVbee(cfg, loi),
    coSan: (uri) => objectExists(uri).catch(() => false),
    lay: (uri) => getObject(uri),
    luu: async (uri, mp3) => {
      await putObject(uri, mp3, { contentType: "audio/mpeg" });
    },
  };
}

export const sachNoiStage = defineStage(QUEUES.sachNoi, async (job, ctx) => {
  const nguon = nguonDocVbee();
  if (!nguon) return { skipped: true, reason: "chưa cấu hình VBEE_APP_ID và VBEE_ACCESS_TOKEN" };

  const bai = job.data.lessonId ? [{ id: job.data.lessonId }] : await baiDaXuatBanChoSachNoi();
  const tong: KetQuaDungBai = { so_khoi: 0, goi_moi: 0, dung_lai: 0, khong_doi: 0, bo: 0 };
  for (const [i, b] of bai.entries()) {
    const kq = await dungSachNoiBai(b.id, nguon);
    for (const k of Object.keys(tong) as Array<keyof KetQuaDungBai>) tong[k] += kq[k];
    await ctx.progress(Math.round(((i + 1) / bai.length) * 100));
  }
  return { detail: { so_bai: bai.length, ...tong } };
});
