"""Kiểm thử lớp LlmClient: băm yêu cầu, mock/replay, chọn mô hình, chi phí."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from docproc.llm import (
    AnthropicProvider,
    LlmClient,
    LlmImage,
    LlmRequest,
    LlmTextDoc,
    MockProvider,
    cost_of,
    default_provider,
    empty_for_schema,
    model_for,
    request_hash,
)

SCHEMA = {
    "type": "object",
    "properties": {
        "markdown": {"type": "string"},
        "tables": {"type": "array"},
        "warnings": {"type": "array"},
        "ok": {"type": "boolean"},
        "n": {"type": "integer"},
    },
}


def test_model_for_theo_tuyen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LLM_MODEL_HEAVY", raising=False)
    monkeypatch.delenv("LLM_MODEL_BULK", raising=False)
    monkeypatch.delenv("LLM_MODEL_LIGHT", raising=False)
    assert model_for("heavy") == "claude-opus-5"
    assert model_for("bulk") == "claude-sonnet-5"
    assert model_for("light") == "claude-haiku-4-5"
    monkeypatch.setenv("LLM_MODEL_HEAVY", "claude-opus-4-8")
    assert model_for("heavy") == "claude-opus-4-8"


def test_cost_of_va_giam_50_phan_tram_khi_batch() -> None:
    full = cost_of("claude-opus-5", 1_000_000, 100_000)
    assert full == pytest.approx(5.0 + 2.5)
    assert cost_of("claude-opus-5", 1_000_000, 100_000, batch=True) == pytest.approx(full / 2)
    cached = cost_of("claude-opus-5", 1_000_000, 0, cache_read=1_000_000)
    assert cached == pytest.approx(0.5)


def test_request_hash_on_dinh_va_nhay_voi_moi_truong_dau_vao() -> None:
    base = LlmRequest(tier="heavy", prompt_name="convert_window", user="nội dung")
    assert request_hash(base) == request_hash(
        LlmRequest(tier="heavy", prompt_name="convert_window", user="nội dung")
    )
    assert request_hash(base) != request_hash(
        LlmRequest(tier="bulk", prompt_name="convert_window", user="nội dung")
    )
    with_image = LlmRequest(
        tier="heavy", prompt_name="convert_window", user="nội dung",
        images=[LlmImage(base64="AAAA")],
    )
    assert request_hash(base) != request_hash(with_image)
    with_doc = LlmRequest(
        tier="heavy", prompt_name="convert_window", user="nội dung",
        docs=[LlmTextDoc(text="x", title="t", key="k")],
    )
    assert request_hash(base) != request_hash(with_doc)


def test_empty_for_schema() -> None:
    assert empty_for_schema(SCHEMA) == {
        "markdown": "", "tables": [], "warnings": [], "ok": False, "n": 0
    }
    assert empty_for_schema({"type": "array"}) == []
    assert empty_for_schema(None) is None


def test_mock_provider_ghi_va_phat_lai_cache(tmp_path: Path) -> None:
    provider = MockProvider(tmp_path)
    req = LlmRequest(tier="heavy", prompt_name="convert_window", user="xin chào", json_schema=SCHEMA)
    first = provider.complete(req)
    assert first.from_cache is True
    assert first.json_value["markdown"] == ""
    files = list(tmp_path.glob("convert_window.py-*.json"))
    assert len(files) == 1

    # ghi đè bản ghi trên đĩa -> lần sau phải PHÁT LẠI đúng nội dung đó
    payload = json.loads(files[0].read_text(encoding="utf-8"))
    payload["text"] = json.dumps({"markdown": "### Điều 1. A"}, ensure_ascii=False)
    payload["json_value"] = {"markdown": "### Điều 1. A"}
    files[0].write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    second = provider.complete(req)
    assert second.json_value == {"markdown": "### Điều 1. A"}
    assert second.from_cache is True


def test_mock_provider_khong_schema_tra_van_ban_canh_bao(tmp_path: Path) -> None:
    res = MockProvider(tmp_path).complete(
        LlmRequest(tier="bulk", prompt_name="verify", user="kiểm tra")
    )
    assert "[MOCK]" in res.text
    assert res.model == "claude-sonnet-5"


def test_default_provider_chon_mock_khi_khong_co_khoa(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "auto")
    assert default_provider().name == "mock"
    monkeypatch.setenv("LLM_PROVIDER", "mock")
    assert default_provider().name == "mock"


def test_llm_client_bao_trang_thai_mock(tmp_path: Path) -> None:
    client = LlmClient(MockProvider(tmp_path))
    assert client.is_mock is True and client.name == "mock"


def test_anthropic_provider_dung_adaptive_thinking_va_prompt_caching() -> None:
    """Không gọi mạng: chỉ kiểm tra phần thân yêu cầu do provider dựng ra."""
    provider = AnthropicProvider.__new__(AnthropicProvider)  # bỏ qua __init__ (cần khóa API)
    req = LlmRequest(
        tier="heavy",
        prompt_name="convert_window",
        user="nội dung biến đổi",
        cacheable_system="quy tắc ổn định + few-shot",
        system="phần phụ thuộc tài liệu",
        images=[LlmImage(base64="AAAA")],
        json_schema=SCHEMA,
        effort="high",
        max_tokens=16000,
    )
    params = AnthropicProvider._params(provider, req)
    assert params["model"] == "claude-opus-5"
    assert params["thinking"] == {"type": "adaptive"}
    assert params["output_config"]["effort"] == "high"
    assert params["output_config"]["format"]["type"] == "json_schema"
    # cache breakpoint nằm ở khối ổn định, đặt TRƯỚC phần biến đổi
    assert params["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert params["system"][0]["text"] == "quy tắc ổn định + few-shot"
    assert "cache_control" not in params["system"][1]
    content = params["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert content[-1] == {"type": "text", "text": "nội dung biến đổi"}


def test_complete_tu_choi_yeu_cau_batch() -> None:
    provider = AnthropicProvider.__new__(AnthropicProvider)
    with pytest.raises(RuntimeError, match="submit_batch"):
        AnthropicProvider.complete(
            provider, LlmRequest(tier="heavy", prompt_name="x", user="y", batch=True)
        )
