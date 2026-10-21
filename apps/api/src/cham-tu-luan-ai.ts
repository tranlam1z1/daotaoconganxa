/**
 * Gọi mô hình chấm một bài tự luận theo rubric (ke-hoach/09-a §4.3), rồi hậu kiểm bằng
 * `docKetQuaChamAi` của @qdpl/dao-tao.
 *
 * Mô hình chỉ thấy đề, rubric, nguyên văn các điều khoản làm căn cứ của bài, và bài làm. Không
 * thấy đáp án mẫu, nên không thể để lộ nó trong nhận xét. Lỗi mạng hay kết quả không đọc được
 * thì trả `undefined`: người gọi chuyển bài cho giảng viên, không bịa điểm.
 */

import {
  docKetQuaChamAi,
  type HoatDong,
  type KetQuaCham,
  ketQuaChamTuLuan,
  type Rubric,
} from "@qdpl/dao-tao";
import { nguCanhCanCu } from "@qdpl/db";
import { goiMoHinhChamTuLuan } from "@qdpl/llm";

export async function chamTuLuanBangAi(
  hd: Pick<HoatDong, "prompt" | "points" | "citations">,
  rubric: Rubric,
  baiLam: string,
  asOf: string,
): Promise<{ kq: KetQuaCham; model: string; costUsd: number } | undefined> {
  try {
    const de = [hd.prompt.cau_hoi, typeof hd.prompt.huong_dan === "string" ? hd.prompt.huong_dan : ""]
      .filter(Boolean)
      .join("\n");
    const res = await goiMoHinhChamTuLuan({
      deBai: de,
      rubric,
      nguCanh: await nguCanhCanCu(hd.citations, asOf),
      baiLam,
      asOf,
    });
    const doc = docKetQuaChamAi(res.json, rubric, baiLam);
    if (!doc.dungDuoc) return undefined;
    return { kq: ketQuaChamTuLuan(hd, rubric, doc), model: res.model, costUsd: res.costUsd };
  } catch (e) {
    console.error("[cham-tu-luan] mô hình không chấm được:", e instanceof Error ? e.message : e);
    return undefined;
  }
}
