/**
 * Một lượt gọi mô hình chấm bài tự luận theo rubric (prompt `dao-tao/cham-tu-luan`). Chỉ dựng
 * prompt và gọi mô hình; đọc kết quả và hậu kiểm (bằng chứng phải có trong bài làm, kẹp điểm)
 * là việc của `docKetQuaChamAi` trong @qdpl/dao-tao, lấy ngữ cảnh điều khoản là việc của người
 * gọi. Bài tập trong bài học (apps/api) và câu tự luận trong đề thi (API nộp bài, worker) cùng
 * đi qua đây.
 */

import { safeJson } from "./anthropic.ts";
import { complete } from "./index.ts";
import { loadPrompt, render } from "./prompts.ts";

const PROMPT = "dao-tao/cham-tu-luan";

export interface YeuCauChamTuLuan {
  /** Đề bài người học thấy (câu hỏi kèm hướng dẫn nếu có). */
  deBai: string;
  /** Rubric dạng JSON thuần; mô hình đọc mức điểm từng tiêu chí. */
  rubric: unknown;
  /** Nguyên văn các điều khoản làm căn cứ, mỗi điều mở đầu bằng `### <urn>`. */
  nguCanh: string;
  baiLam: string;
  /** Ngày áp dụng để mô hình xét hiệu lực của căn cứ người học viện dẫn (YYYY-MM-DD). */
  asOf: string;
}

export interface KetQuaGoiChamTuLuan {
  /** JSON mô hình trả (đã thử đọc từ chữ nếu mô hình không trả JSON thuần); chưa hậu kiểm. */
  json: unknown;
  text: string;
  model: string;
  costUsd: number;
}

/** Bỏ dấu phân cách bài làm khỏi chính bài làm, để người học không "đóng" khối bài làm sớm. */
export function lamSachBaiLam(s: string): string {
  return s.replace(/<<<\s*BAI_LAM|BAI_LAM\s*>>>/gi, "");
}

export async function goiMoHinhChamTuLuan(y: YeuCauChamTuLuan): Promise<KetQuaGoiChamTuLuan> {
  const prompt = loadPrompt(PROMPT);
  const res = await complete({
    tier: "bulk",
    promptName: PROMPT,
    promptVersion: prompt.version,
    cacheableSystem: prompt.system,
    user: render(prompt.user, {
      de_bai: y.deBai,
      as_of: y.asOf,
      // Một dòng JSON: mô hình đọc được mức điểm từng tiêu chí, không cần dàn trang.
      rubric: JSON.stringify(y.rubric),
      ngu_canh: y.nguCanh || "(bài không ghi căn cứ)",
      bai_lam: lamSachBaiLam(y.baiLam),
    }),
    maxTokens: 2_000,
    batch: false,
  });
  return { json: res.json ?? safeJson(res.text), text: res.text, model: res.model, costUsd: res.costUsd };
}
