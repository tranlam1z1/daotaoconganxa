"""Lớp gọi mô hình ngôn ngữ — bản Python của `packages/llm` (TypeScript).

Hai provider theo cùng giao diện `LlmProvider`:

* `AnthropicProvider` — SDK `anthropic` thật: `claude-opus-5` cho tuyến khó
  (D/E, kiểm chứng), `claude-sonnet-5` cho tuyến thường (C); adaptive thinking,
  `output_config.effort`, prompt caching, structured output, Batch API cho backfill,
  `fallbacks: "default"` để không gián đoạn khi bị từ chối ngoài ý muốn.
* `MockProvider`     — chế độ mock/replay khi KHÔNG có `ANTHROPIC_API_KEY`:
  đọc/ghi cache đĩa `data/llm-cache`, không có bản ghi thì sinh kết quả tất định.

Cách băm yêu cầu mô phỏng `packages/llm/src/mock.ts` (cùng danh sách trường và
cùng thứ tự). Khác biệt duy nhất: TypeScript dùng `Bun.hash`, Python dùng
sha256 — nên tệp cache của hai phía được đặt tiền tố khác nhau (`py-`) để không
lẫn nhau; đọc thêm README mục "Cache LLM".
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Protocol

ModelTier = Literal["heavy", "bulk", "light"]

# Bảng giá USD/1 triệu token — giữ khớp `packages/llm/src/types.ts`.
PRICING: dict[str, dict[str, float]] = {
    "claude-opus-5": {"in": 5.0, "out": 25.0, "cache_read": 0.5},
    "claude-sonnet-5": {"in": 2.0, "out": 10.0, "cache_read": 0.2},
    "claude-haiku-4-5": {"in": 1.0, "out": 5.0, "cache_read": 0.1},
}

# Beta cho `fallbacks: "default"` (dạng scalar) theo hướng dẫn SDK.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def model_for(tier: ModelTier) -> str:
    if tier == "heavy":
        return os.environ.get("LLM_MODEL_HEAVY") or "claude-opus-5"
    if tier == "bulk":
        return os.environ.get("LLM_MODEL_BULK") or "claude-sonnet-5"
    return os.environ.get("LLM_MODEL_LIGHT") or "claude-haiku-4-5"


def cost_of(model: str, tokens_in: int, tokens_out: int, cache_read: int = 0, batch: bool = False) -> float:
    p = PRICING.get(model, PRICING["claude-sonnet-5"])
    raw = ((tokens_in - cache_read) * p["in"] + cache_read * p["cache_read"] + tokens_out * p["out"]) / 1_000_000
    return raw / 2 if batch else raw


@dataclass
class LlmImage:
    base64: str
    media_type: str = "image/png"


@dataclass
class LlmPdf:
    base64: str
    title: str | None = None
    citations: bool = False


@dataclass
class LlmTextDoc:
    text: str
    title: str
    key: str
    citations: bool = False


@dataclass
class LlmRequest:
    tier: ModelTier
    prompt_name: str
    user: str
    prompt_version: str | None = None
    system: str | None = None
    cacheable_system: str | None = None
    """Phần system ổn định (quy tắc + few-shot) — đặt trước, có cache breakpoint."""
    images: list[LlmImage] = field(default_factory=list)
    pdfs: list[LlmPdf] = field(default_factory=list)
    docs: list[LlmTextDoc] = field(default_factory=list)
    max_tokens: int = 16000
    json_schema: dict[str, Any] | None = None
    effort: Literal["low", "medium", "high", "xhigh", "max"] | None = None
    batch: bool = False


@dataclass
class LlmResponse:
    text: str = ""
    json_value: Any = None
    model: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    cache_read_tokens: int = 0
    cost_usd: float = 0.0
    stop_reason: str | None = None
    from_cache: bool = False


class LlmProvider(Protocol):
    name: str

    def complete(self, req: LlmRequest) -> LlmResponse:
        ...


def _sha(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


def request_hash(req: LlmRequest) -> str:
    """Băm yêu cầu — cùng danh sách trường như `requestHash` trong mock.ts."""
    material: dict[str, Any] = {
        "tier": req.tier,
        "promptName": req.prompt_name,
        "promptVersion": req.prompt_version,
        "system": req.system,
        "cacheableSystem": req.cacheable_system,
        "user": req.user,
        "images": [_sha(i.base64) for i in req.images] or None,
        "pdfs": [_sha(p.base64) for p in req.pdfs] or None,
        "docs": [[d.key, _sha(d.text)] for d in req.docs] or None,
        "jsonSchema": req.json_schema,
    }
    material = {k: v for k, v in material.items() if v is not None}
    blob = json.dumps(material, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def cache_dir() -> Path:
    return Path(os.environ.get("LLM_CACHE_DIR") or "./data/llm-cache")


class MockProvider:
    """Mock/replay: phát lại bản ghi trên đĩa, không có thì sinh kết quả tất định."""

    name = "mock"

    def __init__(self, directory: str | Path | None = None) -> None:
        self.dir = Path(directory) if directory else cache_dir()

    def _file(self, req: LlmRequest) -> Path:
        return self.dir / f"{req.prompt_name}.py-{request_hash(req)}.json"

    def complete(self, req: LlmRequest) -> LlmResponse:
        path = self._file(req)
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return LlmResponse(**{**data, "from_cache": True})
        res = self._synthesize(req)
        self.dir.mkdir(parents=True, exist_ok=True)
        payload = {k: v for k, v in res.__dict__.items()}
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return res

    def _synthesize(self, req: LlmRequest) -> LlmResponse:
        model = model_for(req.tier)
        base = LlmResponse(
            model=model,
            tokens_in=max(1, len(req.user) // 3),
            tokens_out=0,
            from_cache=True,
            stop_reason="end_turn",
        )
        if req.json_schema:
            empty = empty_for_schema(req.json_schema)
            base.json_value = empty
            base.text = json.dumps(empty, ensure_ascii=False)
            return base
        base.text = (
            "[MOCK] Chưa cấu hình ANTHROPIC_API_KEY nên không gọi được mô hình. "
            f"Yêu cầu '{req.prompt_name}' đã được ghi vào cache để phát lại."
        )
        base.tokens_out = max(1, len(base.text) // 3)
        return base


def empty_for_schema(schema: Any) -> Any:
    """Sinh giá trị rỗng hợp lệ theo JSON Schema (giống `emptyForSchema` bên TS)."""
    if not isinstance(schema, dict):
        return None
    t = schema.get("type")
    if t == "array":
        return []
    if t == "object":
        return {k: empty_for_schema(v) for k, v in (schema.get("properties") or {}).items()}
    if t == "string":
        return ""
    if t in ("number", "integer"):
        return 0
    if t == "boolean":
        return False
    return None


class AnthropicProvider:
    """Provider thật dùng SDK `anthropic`."""

    name = "anthropic"

    def __init__(self, api_key: str | None = None) -> None:
        try:
            import anthropic
        except ImportError as exc:
            raise RuntimeError("Thiếu gói `anthropic`. Chạy `pip install anthropic`.") from exc
        self._anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

    # -- dựng phần thân yêu cầu ------------------------------------------
    def _system_blocks(self, req: LlmRequest) -> list[dict[str, Any]] | None:
        blocks: list[dict[str, Any]] = []
        if req.cacheable_system:
            # cache breakpoint đặt SAU phần ổn định (system + quy tắc + few-shot)
            blocks.append(
                {"type": "text", "text": req.cacheable_system, "cache_control": {"type": "ephemeral"}}
            )
        if req.system:
            blocks.append({"type": "text", "text": req.system})
        return blocks or None

    def _content(self, req: LlmRequest) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = []
        for pdf in req.pdfs:
            block: dict[str, Any] = {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": pdf.base64},
            }
            if pdf.title:
                block["title"] = pdf.title
            if pdf.citations:
                block["citations"] = {"enabled": True}
            content.append(block)
        for img in req.images:
            content.append(
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": img.media_type, "data": img.base64},
                }
            )
        for doc in req.docs:
            block = {
                "type": "document",
                "source": {"type": "text", "media_type": "text/plain", "data": doc.text},
                "title": doc.title,
            }
            if doc.citations:
                block["citations"] = {"enabled": True}
            content.append(block)
        content.append({"type": "text", "text": req.user})
        return content

    def _params(self, req: LlmRequest) -> dict[str, Any]:
        model = model_for(req.tier)
        output_config: dict[str, Any] = {}
        if req.effort:
            output_config["effort"] = req.effort
        if req.json_schema:
            output_config["format"] = {"type": "json_schema", "schema": req.json_schema}
        params: dict[str, Any] = {
            "model": model,
            "max_tokens": req.max_tokens,
            "messages": [{"role": "user", "content": self._content(req)}],
            # adaptive thinking: mô hình tự quyết định độ sâu suy luận
            "thinking": {"type": "adaptive"},
        }
        system = self._system_blocks(req)
        if system:
            params["system"] = system
        if output_config:
            params["output_config"] = output_config
        return params

    # -- gọi -------------------------------------------------------------
    def complete(self, req: LlmRequest) -> LlmResponse:
        if req.batch:
            raise RuntimeError(
                "Yêu cầu batch phải đi qua `submit_batch`/`fetch_batch`, không dùng `complete`."
            )
        params = self._params(req)
        # streaming để tránh timeout khi max_tokens lớn; fallbacks để không gián đoạn
        with self.client.beta.messages.stream(
            betas=[FALLBACK_BETA], fallbacks="default", **params
        ) as stream:
            message = stream.get_final_message()
        return self._to_response(message, req)

    def _to_response(self, message: Any, req: LlmRequest) -> LlmResponse:
        text = "".join(b.text for b in message.content if getattr(b, "type", "") == "text")
        usage = message.usage
        cache_read = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
        tokens_in = int(usage.input_tokens or 0) + cache_read
        tokens_out = int(usage.output_tokens or 0)
        parsed: Any = None
        if req.json_schema and text.strip():
            parsed = json.loads(text)
        return LlmResponse(
            text=text,
            json_value=parsed,
            model=message.model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            cache_read_tokens=cache_read,
            cost_usd=cost_of(message.model, tokens_in, tokens_out, cache_read, req.batch),
            stop_reason=getattr(message, "stop_reason", None),
        )

    # -- Batch API (backfill, rẻ hơn 50%) ---------------------------------
    def submit_batch(self, requests: list[tuple[str, LlmRequest]]) -> str:
        """Gửi một lô yêu cầu qua Batch API; trả về `batch_id`.

        `fallbacks` không được Batch API chấp nhận nên lô chạy không có fallback.
        """
        from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
        from anthropic.types.messages.batch_create_params import Request

        items = [
            Request(custom_id=cid, params=MessageCreateParamsNonStreaming(**self._params(req)))
            for cid, req in requests
        ]
        batch = self.client.messages.batches.create(requests=items)
        return batch.id

    def fetch_batch(
        self, batch_id: str, requests: dict[str, LlmRequest], poll_seconds: int = 60, timeout_s: int = 86400
    ) -> dict[str, LlmResponse]:
        """Chờ lô xong rồi lấy kết quả, khóa theo `custom_id` (không theo thứ tự)."""
        deadline = time.time() + timeout_s
        while True:
            batch = self.client.messages.batches.retrieve(batch_id)
            if batch.processing_status == "ended":
                break
            if time.time() > deadline:
                raise TimeoutError(f"lô {batch_id} chưa xong sau {timeout_s}s")
            time.sleep(poll_seconds)
        out: dict[str, LlmResponse] = {}
        for entry in self.client.messages.batches.results(batch_id):
            cid = entry.custom_id
            if entry.result.type != "succeeded":
                raise RuntimeError(f"yêu cầu {cid} trong lô {batch_id} thất bại: {entry.result.type}")
            out[cid] = self._to_response(entry.result.message, requests[cid])
        return out


class LlmClient:
    """Điểm vào duy nhất cho phần LLM của docproc."""

    def __init__(self, provider: LlmProvider | None = None) -> None:
        self.provider = provider or default_provider()

    @property
    def name(self) -> str:
        return self.provider.name

    @property
    def is_mock(self) -> bool:
        return self.provider.name == "mock"

    def complete(self, req: LlmRequest) -> LlmResponse:
        return self.provider.complete(req)


def default_provider() -> LlmProvider:
    """Chọn provider theo `LLM_PROVIDER` (auto|anthropic|mock) và sự có mặt của khóa."""
    mode = (os.environ.get("LLM_PROVIDER") or "auto").lower()
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if mode == "mock":
        return MockProvider()
    if mode == "anthropic":
        return AnthropicProvider()
    return AnthropicProvider() if has_key else MockProvider()
