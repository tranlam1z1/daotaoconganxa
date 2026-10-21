"""Kiểm thử agent tái cấu trúc theo cửa sổ trang (ke-hoach/05 §4)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from docproc.ai_convert import (
    WINDOW_SCHEMA,
    WindowInput,
    build_request,
    convert_document,
    layout_json,
    load_prompt,
    parse_window_response,
)
from docproc.llm import LlmClient, LlmRequest, LlmResponse
from docproc.types import LayoutBlock, OpenState, Route


def test_load_prompt_co_phien_ban_va_du_thanh_phan() -> None:
    prompt = load_prompt("convert_window", "v1")
    assert prompt.name == "convert_window" and prompt.version == "v1"
    assert prompt.tier(Route.C_PDF_TEXT) == "bulk"      # Sonnet cho tuyến C
    assert prompt.tier(Route.D_PDF_SCAN) == "heavy"     # Opus cho tuyến D/E
    assert prompt.effort(Route.E_PDF_VISION) == "high"
    assert len(prompt.few_shot) >= 3
    system = prompt.system_text()
    for rule in ["không kết thúc bằng", "CÔNG BÁO", "cùng số cột", "gạch nối", "Nơi nhận"]:
        assert rule in system


def test_load_prompt_thieu_tep_thi_bao_loi() -> None:
    with pytest.raises(FileNotFoundError):
        load_prompt("khong_ton_tai", "v9")


def test_schema_structured_output_du_truong_theo_dac_ta() -> None:
    props = WINDOW_SCHEMA["properties"]
    assert set(props) == {"markdown", "open_state", "tables", "corrections", "warnings"}
    assert WINDOW_SCHEMA["additionalProperties"] is False


def test_build_request_gan_anh_va_ngu_canh(tmp_path: Path) -> None:
    img = tmp_path / "p1.png"
    img.write_bytes(b"\x89PNG\r\n\x1a\n gia lap")
    prompt = load_prompt()
    win = WindowInput(
        pages=[4, 5, 6],
        layout=[LayoutBlock(kind="paragraph", page=4, bbox=(1, 2, 3, 4), text="Điều 7. A")],
        image_paths=[img],
        prev_tail="… bố trí nguồn vốn",
        open_state=OpenState(paragraph_open=True, node_label="điểm c khoản 2 Điều 7"),
    )
    req = build_request(prompt, win, Route.D_PDF_SCAN)
    assert isinstance(req, LlmRequest)
    assert req.tier == "heavy" and req.effort == "high"
    assert req.json_schema is WINDOW_SCHEMA
    assert len(req.images) == 1
    assert "4, 5, 6" in req.user
    assert "bố trí nguồn vốn" in req.user
    assert "điểm c khoản 2 Điều 7" in req.user
    assert "Điều 7. A" in req.user


def test_layout_json_giu_bbox_de_truy_nguoc_page_refs() -> None:
    blocks = [LayoutBlock(kind="table", page=2, bbox=(10.11, 20.22, 30.33, 40.44), text="")]
    data = json.loads(layout_json(blocks))
    assert data[0]["page"] == 2 and data[0]["bbox"] == [10.1, 20.2, 30.3, 40.4]


def test_parse_window_response() -> None:
    payload = {
        "markdown": "### Điều 7. A",
        "open_state": {"paragraph_open": True, "table_open": False, "table_cols": 0,
                       "node_label": "khoản 2 Điều 7"},
        "tables": [{"rows": 4, "cols": 3}],
        "corrections": [{"page": 4, "before": "l", "after": "1", "reason": "OCR"}],
        "warnings": ["trang 5 mờ"],
    }
    win = parse_window_response(payload, [4, 5])
    assert win.markdown == "### Điều 7. A"
    assert win.open_state.paragraph_open is True
    assert win.open_state.node_label == "khoản 2 Điều 7"
    assert win.tables[0].n_rows == 4 and win.tables[0].cols == 3
    assert win.warnings == ["trang 5 mờ"]


def test_parse_window_response_bao_loi_khi_khong_phai_object() -> None:
    with pytest.raises(ValueError):
        parse_window_response(["không phải object"], [1])


class _FakeProvider:
    """Provider giả lập trả về Markdown thật cho từng cửa sổ, có phần chồng lấn."""

    name = "fake"

    def __init__(self) -> None:
        self.calls: list[LlmRequest] = []
        self.payloads = [
            {
                "markdown": "### Điều 1. Phạm vi\n\n1. Nghị định này quy định về đầu tư sử dụng nguồn vốn",
                "open_state": {"paragraph_open": True, "table_open": False, "table_cols": 0,
                               "node_label": "khoản 1 Điều 1"},
                "tables": [], "corrections": [{"page": 2, "before": "dầu", "after": "đầu",
                                               "reason": "lỗi OCR hiển nhiên"}],
                "warnings": [],
            },
            {
                "markdown": "1. Nghị định này quy định về đầu tư sử dụng nguồn vốn\n\n"
                            "ngân sách nhà nước.\n\n### Điều 2. Giải thích",
                "open_state": {"paragraph_open": False, "table_open": False, "table_cols": 0,
                               "node_label": "Điều 2"},
                "tables": [], "corrections": [], "warnings": ["trang 6 hơi mờ"],
            },
        ]

    def complete(self, req: LlmRequest) -> LlmResponse:
        payload = self.payloads[len(self.calls)]
        self.calls.append(req)
        return LlmResponse(
            text=json.dumps(payload, ensure_ascii=False),
            json_value=payload,
            model="claude-opus-5",
            tokens_in=1000,
            tokens_out=500,
            cost_usd=0.02,
        )


def test_convert_document_ghep_cac_cua_so() -> None:
    client = LlmClient(_FakeProvider())
    layout = [LayoutBlock(kind="paragraph", page=p, bbox=(0, p, 0, p), text=f"trang {p}") for p in range(1, 10)]
    result = convert_document(
        client, route=Route.D_PDF_SCAN, page_count=9, layout=layout, window_size=5, overlap=1
    )
    assert len(result.windows) == 2
    assert result.tokens_in == 2000 and result.tokens_out == 1000
    assert result.cost_usd == pytest.approx(0.04)
    assert result.model == "claude-opus-5"
    assert result.corrections and result.corrections[0]["after"] == "đầu"
    assert "trang 6 hơi mờ" in result.warnings
    # phần chồng lấn không bị lặp và câu bị cắt được nối liền
    assert result.markdown.count("Nghị định này quy định về đầu tư") == 1
    assert "nguồn vốn ngân sách nhà nước." in result.markdown
    assert "### Điều 2. Giải thích" in result.markdown


def test_convert_document_truyen_ngu_canh_va_trang_thai_mo_sang_cua_so_sau() -> None:
    provider = _FakeProvider()
    layout = [LayoutBlock(kind="paragraph", page=p, bbox=(0, p, 0, p), text="x") for p in range(1, 10)]
    convert_document(
        LlmClient(provider), route=Route.C_PDF_TEXT, page_count=9, layout=layout,
        window_size=5, overlap=1,
    )
    second = provider.calls[1].user
    assert "nguồn vốn" in second, "ngữ cảnh cuối cụm trước phải được truyền sang"
    assert '"paragraph_open": true' in second
    assert "khoản 1 Điều 1" in second


def test_convert_document_canh_bao_khi_mo_hinh_tra_rong(tmp_path: Path) -> None:
    from docproc.llm import MockProvider

    client = LlmClient(MockProvider(tmp_path))
    layout = [LayoutBlock(kind="paragraph", page=1, bbox=(0, 0, 0, 0), text="x")]
    result = convert_document(client, route=Route.C_PDF_TEXT, page_count=1, layout=layout)
    assert any("không trả nội dung" in w for w in result.warnings)
