/**
 * Provider thật dùng Anthropic SDK.
 * Model mặc định: claude-opus-5 (heavy), claude-sonnet-5 (bulk), claude-haiku-4-5 (light).
 * Áp dụng adaptive thinking, prompt caching, structured output và citations.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { LlmCitation, LlmProvider, LlmRequest, LlmResponse } from "./types.ts";
import { costOf, modelFor } from "./types.ts";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const model = modelFor(req.tier);
    const content: any[] = [];

    for (const pdf of req.pdfs ?? []) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: pdf.mediaType, data: pdf.base64 },
        ...(pdf.title ? { title: pdf.title } : {}),
        ...(pdf.citations ? { citations: { enabled: true } } : {}),
      });
    }
    for (const img of req.images ?? []) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }
    for (const doc of req.docs ?? []) {
      content.push({
        type: "document",
        source: { type: "text", media_type: "text/plain", data: doc.text },
        title: doc.title,
        context: doc.key,
        ...(doc.citations === false ? {} : { citations: { enabled: true } }),
      });
    }
    content.push({ type: "text", text: req.user });

    const system: any[] = [];
    if (req.cacheableSystem) {
      system.push({ type: "text", text: req.cacheableSystem, cache_control: { type: "ephemeral" } });
    }
    if (req.system) system.push({ type: "text", text: req.system });

    const params: any = {
      model,
      max_tokens: req.maxTokens ?? 16000,
      messages: [{ role: "user", content }],
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort ?? "high" },
    };
    if (system.length) params.system = system;
    // Structured output không dùng chung với citations (API trả 400).
    if (req.jsonSchema && !(req.docs ?? []).length) {
      params.output_config.format = { type: "json_schema", schema: req.jsonSchema };
    }

    const stream = await this.client.messages.stream(params);
    const msg = await stream.finalMessage();

    let text = "";
    const citations: LlmCitation[] = [];
    for (const block of msg.content as any[]) {
      if (block.type !== "text") continue;
      text += block.text;
      for (const c of block.citations ?? []) {
        citations.push({
          docKey: c.document_title ?? String(c.document_index ?? ""),
          citedText: c.cited_text ?? "",
          startCharIndex: c.start_char_index,
          endCharIndex: c.end_char_index,
          startPage: c.start_page_number,
          endPage: c.end_page_number,
        });
      }
    }

    const usage: any = msg.usage ?? {};
    const tokensIn =
      (usage.input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const tokensOut = usage.output_tokens ?? 0;

    let json: unknown;
    if (req.jsonSchema) {
      json = safeJson(text);
    }

    return {
      text,
      json,
      citations,
      model,
      tokensIn,
      tokensOut,
      cacheReadTokens: cacheRead,
      costUsd: costOf(model, tokensIn, tokensOut, cacheRead, req.batch),
      stopReason: msg.stop_reason ?? undefined,
    };
  }
}

/** Trích JSON từ câu trả lời kể cả khi bị bọc trong ```json. */
export function safeJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1]! : text;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const startArr = raw.indexOf("[");
    const from = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
    if (from === -1) return undefined;
    const endObj = raw.lastIndexOf("}");
    const endArr = raw.lastIndexOf("]");
    const to = Math.max(endObj, endArr);
    if (to <= from) return undefined;
    try {
      return JSON.parse(raw.slice(from, to + 1));
    } catch {
      return undefined;
    }
  }
}
