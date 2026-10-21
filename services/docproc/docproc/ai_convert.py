"""Agent AI tái cấu trúc theo cửa sổ trang chồng lấn (ke-hoach/05 §4).

Mỗi cửa sổ 4–6 trang (chồng 1 trang) được gửi kèm: ảnh trang, layout JSON,
2–3 đoạn cuối của cửa sổ trước và "trạng thái mở". Mô hình trả structured output
`{markdown, open_state, tables, corrections, warnings}`; bộ ghép (`stitch`) hợp
nhất các cửa sổ bằng so khớp mờ trên trang chồng lấn.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .llm import LlmClient, LlmImage, LlmRequest
from .stitch import StitchConfig, WindowResult, build_windows, merge_windows
from .types import LayoutBlock, OpenState, Route, TableBlock

PROMPT_DIR = Path(__file__).parent / "prompts"

# Structured output cho phần metadata của cụm (ke-hoach/05 §4.4).
WINDOW_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "markdown": {"type": "string"},
        "open_state": {
            "type": "object",
            "properties": {
                "paragraph_open": {"type": "boolean"},
                "table_open": {"type": "boolean"},
                "table_cols": {"type": "integer"},
                "node_label": {"type": "string"},
            },
            "required": ["paragraph_open", "table_open", "table_cols", "node_label"],
            "additionalProperties": False,
        },
        "tables": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"rows": {"type": "integer"}, "cols": {"type": "integer"}},
                "required": ["rows", "cols"],
                "additionalProperties": False,
            },
        },
        "corrections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "page": {"type": "integer"},
                    "before": {"type": "string"},
                    "after": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["page", "before", "after", "reason"],
                "additionalProperties": False,
            },
        },
        "warnings": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["markdown", "open_state", "tables", "corrections", "warnings"],
    "additionalProperties": False,
}


@dataclass
class Prompt:
    name: str
    version: str
    cacheable_system: str
    instructions: str
    few_shot: list[dict[str, Any]] = field(default_factory=list)
    tier_by_route: dict[str, str] = field(default_factory=dict)
    effort_by_route: dict[str, str] = field(default_factory=dict)
    max_tokens: int = 16000

    def tier(self, route: Route) -> str:
        return self.tier_by_route.get(route.value, "heavy")

    def effort(self, route: Route) -> str:
        return self.effort_by_route.get(route.value, "high")

    def system_text(self) -> str:
        """System ổn định = quy tắc + few-shot; cache breakpoint nằm ngay sau đây."""
        parts = [self.cacheable_system, "\n## Ví dụ\n"]
        for ex in self.few_shot:
            parts.append(f"### {ex.get('title', '')}\nVào:\n{ex.get('input', '')}\nRa:\n{ex.get('output', '')}\n")
        return "\n".join(parts)


def load_prompt(name: str = "convert_window", version: str = "v1") -> Prompt:
    """Đọc prompt có phiên bản từ `docproc/prompts/<name>.<version>.yaml`."""
    import yaml

    path = PROMPT_DIR / f"{name}.{version}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"không thấy prompt {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return Prompt(
        name=data["name"],
        version=str(data["version"]),
        cacheable_system=data["cacheable_system"],
        instructions=data["instructions"],
        few_shot=data.get("few_shot") or [],
        tier_by_route=data.get("tier_by_route") or {},
        effort_by_route=data.get("effort_by_route") or {},
        max_tokens=int(data.get("max_tokens") or 16000),
    )


@dataclass
class WindowInput:
    """Đầu vào một cửa sổ trang."""

    pages: list[int]
    layout: list[LayoutBlock] = field(default_factory=list)
    image_paths: list[Path] = field(default_factory=list)
    prev_tail: str = ""
    open_state: OpenState = field(default_factory=OpenState)


def layout_json(blocks: list[LayoutBlock]) -> str:
    """Serialize layout gọn để đưa vào prompt (giữ bbox để truy ngược page_refs)."""
    return json.dumps(
        [
            {
                "page": b.page,
                "kind": b.kind,
                "bbox": [round(v, 1) for v in b.bbox],
                "text": b.text,
                "confidence": round(b.confidence, 3),
                "table": (
                    {"header": b.table.header, "rows": b.table.rows} if b.table else None
                ),
            }
            for b in blocks
        ],
        ensure_ascii=False,
    )


def build_request(prompt: Prompt, win: WindowInput, route: Route) -> LlmRequest:
    """Dựng `LlmRequest` cho một cửa sổ (ảnh trang + layout + ngữ cảnh + trạng thái mở)."""
    images = [
        LlmImage(base64=base64.standard_b64encode(Path(p).read_bytes()).decode("ascii"))
        for p in win.image_paths
    ]
    user = prompt.instructions.format(
        pages=", ".join(str(p) for p in win.pages),
        prev_tail=win.prev_tail or "(cụm đầu tiên — không có ngữ cảnh trước)",
        open_state=json.dumps(win.open_state.to_json(), ensure_ascii=False),
        layout=layout_json(win.layout),
    )
    return LlmRequest(
        tier=prompt.tier(route),  # type: ignore[arg-type]
        prompt_name=prompt.name,
        prompt_version=prompt.version,
        cacheable_system=prompt.system_text(),
        user=user,
        images=images,
        max_tokens=prompt.max_tokens,
        json_schema=WINDOW_SCHEMA,
        effort=prompt.effort(route),  # type: ignore[arg-type]
    )


def parse_window_response(data: Any, pages: list[int]) -> WindowResult:
    """Chuyển JSON structured output thành `WindowResult` cho bộ ghép."""
    if not isinstance(data, dict):
        raise ValueError(f"đầu ra mô hình không phải object JSON: {type(data).__name__}")
    raw_state = data.get("open_state") or {}
    state = OpenState(
        paragraph_open=bool(raw_state.get("paragraph_open")),
        table_open=bool(raw_state.get("table_open")),
        table_cols=int(raw_state.get("table_cols") or 0),
        node_label=raw_state.get("node_label") or None,
    )
    tables = [
        TableBlock(header=None, rows=[[""] * int(t.get("cols") or 0)] * int(t.get("rows") or 0))
        for t in (data.get("tables") or [])
    ]
    return WindowResult(
        pages=pages,
        markdown=str(data.get("markdown") or ""),
        open_state=state,
        tables=tables,
        warnings=[str(w) for w in (data.get("warnings") or [])],
    )


@dataclass
class AiConvertResult:
    markdown: str
    windows: list[WindowResult] = field(default_factory=list)
    corrections: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    model: str = ""
    from_cache: bool = False


def convert_document(
    client: LlmClient,
    *,
    route: Route,
    page_count: int,
    layout: list[LayoutBlock],
    image_paths: dict[int, Path] | None = None,
    window_size: int = 5,
    overlap: int = 1,
    prompt: Prompt | None = None,
    cfg: StitchConfig | None = None,
) -> AiConvertResult:
    """Chạy agent theo từng cửa sổ rồi hợp nhất bằng trang chồng lấn."""
    prompt = prompt or load_prompt()
    windows = build_windows(page_count, size=window_size, overlap=overlap)
    results: list[WindowResult] = []
    corrections: list[dict[str, Any]] = []
    warnings: list[str] = []
    tokens_in = tokens_out = 0
    cost = 0.0
    model = ""
    from_cache = True
    prev_tail = ""
    state = OpenState()

    for pages in windows:
        win = WindowInput(
            pages=pages,
            layout=[b for b in layout if b.page in pages],
            image_paths=[image_paths[p] for p in pages if image_paths and p in image_paths],
            prev_tail=prev_tail,
            open_state=state,
        )
        req = build_request(prompt, win, route)
        res = client.complete(req)
        tokens_in += res.tokens_in
        tokens_out += res.tokens_out
        cost += res.cost_usd
        model = res.model or model
        from_cache = from_cache and res.from_cache
        payload = res.json_value if res.json_value is not None else (json.loads(res.text) if res.text.strip() else {})
        window = parse_window_response(payload, pages)
        if not window.markdown.strip():
            warnings.append(
                f"cụm trang {pages}: mô hình không trả nội dung "
                f"(provider={client.name}) — cần chạy lại với khóa API thật"
            )
        corrections.extend((payload or {}).get("corrections") or [])
        results.append(window)
        prev_tail = window.open_state.tail_text or _tail_of(window.markdown)
        state = window.open_state

    merged = merge_windows(results, cfg)
    warnings.extend(merged.warnings)
    return AiConvertResult(
        markdown=merged.markdown,
        windows=results,
        corrections=corrections,
        warnings=warnings,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_usd=round(cost, 6),
        model=model,
        from_cache=from_cache,
    )


def _tail_of(markdown: str, n_blocks: int = 3) -> str:
    blocks = [b for b in markdown.split("\n\n") if b.strip()]
    return "\n\n".join(blocks[-n_blocks:])
