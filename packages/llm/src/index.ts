/**
 * Điểm vào duy nhất để gọi LLM. Tự chọn provider:
 * có ANTHROPIC_API_KEY -> Anthropic thật; không có -> mock/replay.
 */
import { AnthropicProvider } from "./anthropic.ts";
import { MockProvider } from "./mock.ts";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types.ts";

export { AnthropicProvider, safeJson } from "./anthropic.ts";
export * from "./cham-tu-luan.ts";
export { MockProvider, requestHash } from "./mock.ts";
export * from "./prompts.ts";
export * from "./types.ts";
export * from "./vbee.ts";

let provider: LlmProvider | undefined;

export function getProvider(): LlmProvider {
  if (provider) return provider;
  const mode = process.env.LLM_PROVIDER ?? "auto";
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (mode === "anthropic" || (mode === "auto" && hasKey)) {
    provider = new AnthropicProvider();
  } else {
    provider = new MockProvider();
  }
  return provider;
}

export function setProvider(p: LlmProvider) {
  provider = p;
}

/** Tổng chi phí đã dùng trong tiến trình, để giám sát ngân sách. */
export const meter = { calls: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };

export async function complete(req: LlmRequest): Promise<LlmResponse> {
  const res = await getProvider().complete(req);
  meter.calls += 1;
  meter.tokensIn += res.tokensIn;
  meter.tokensOut += res.tokensOut;
  meter.costUsd += res.costUsd;
  return res;
}

export function isMock(): boolean {
  return getProvider().name === "mock";
}
