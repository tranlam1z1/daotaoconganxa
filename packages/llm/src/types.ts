/** Hợp đồng dùng chung cho mọi lời gọi mô hình ngôn ngữ trong hệ thống. */

export type ModelTier = "heavy" | "bulk" | "light";

export interface LlmImage {
  /** Ảnh base64, không có tiền tố data:. */
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
}

export interface LlmDocument {
  /** PDF base64. */
  base64: string;
  mediaType: "application/pdf";
  title?: string;
  /** Bật trích dẫn để lấy vị trí trang. */
  citations?: boolean;
}

export interface LlmTextDoc {
  text: string;
  title: string;
  /** Khóa để ánh xạ ngược trích dẫn về URN. */
  key: string;
  citations?: boolean;
}

export interface LlmRequest {
  tier: ModelTier;
  /** Tên prompt trong prompts/, dùng cho log và cache. */
  promptName: string;
  promptVersion?: string;
  system?: string;
  /** Phần system ổn định được cache. */
  cacheableSystem?: string;
  user: string;
  images?: LlmImage[];
  pdfs?: LlmDocument[];
  /** Tài liệu ngữ cảnh cho RAG; bật citations để lấy dẫn chứng. */
  docs?: LlmTextDoc[];
  maxTokens?: number;
  /** Yêu cầu JSON theo schema. */
  jsonSchema?: Record<string, unknown>;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Gửi qua Batch API (rẻ hơn 50%, không cần độ trễ thấp). */
  batch?: boolean;
  temperatureHint?: never;
}

export interface LlmCitation {
  /** key của LlmTextDoc được trích. */
  docKey: string;
  citedText: string;
  startCharIndex?: number;
  endCharIndex?: number;
  startPage?: number;
  endPage?: number;
}

export interface LlmResponse {
  text: string;
  json?: unknown;
  citations: LlmCitation[];
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  costUsd: number;
  stopReason?: string;
  /** true nếu kết quả lấy từ cache đĩa hoặc provider mock. */
  fromCache?: boolean;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** Bảng giá USD/1 triệu token, cập nhật 06/2026. */
export const PRICING: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-5": { in: 5, out: 25, cacheRead: 0.5 },
  "claude-sonnet-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { in: 1, out: 5, cacheRead: 0.1 },
};

export function modelFor(tier: ModelTier): string {
  if (tier === "heavy") return process.env.LLM_MODEL_HEAVY ?? "claude-opus-5";
  if (tier === "bulk") return process.env.LLM_MODEL_BULK ?? "claude-sonnet-5";
  return process.env.LLM_MODEL_LIGHT ?? "claude-haiku-4-5";
}

export function costOf(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cacheRead = 0,
  batch = false,
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-5"]!;
  const raw = ((tokensIn - cacheRead) * p.in + cacheRead * p.cacheRead + tokensOut * p.out) / 1_000_000;
  return batch ? raw / 2 : raw;
}
