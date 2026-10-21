"""Bộ điều phối: định tuyến → trích → ghép → dựng Markdown chuẩn → kiểm chứng."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import extract_docx, extract_html, extract_pdf_text
from . import verify as verify_mod
from .llm import LlmClient
from .markdown import build_internal_markdown
from .router import route_file, sniff_kind
from .stitch import StitchConfig, stitch_pages
from .types import AssetOut, ConvertResult, PageChunk, Route

DOC_TYPE_BY_SUFFIX: dict[str, str] = {
    "NĐ-CP": "nd", "QĐ-TTg": "qd-ttg", "QĐ-UBND": "qd-ubnd-t", "NQ-HĐND": "nq-hdnd-t",
    "TT-BKHCN": "tt", "TT-BTC": "tt", "QH15": "l", "QH16": "l", "UBTVQH15": "pl",
}

RE_SO_KY_HIEU = re.compile(r"^\s*Số\s*:\s*([0-9A-Za-zÀ-ỹĐđ/\-\.]+)", re.MULTILINE)
RE_DOC_HEADING = re.compile(
    r"^\s*(NGHỊ\s+ĐỊNH|THÔNG\s+TƯ|QUYẾT\s+ĐỊNH|NGHỊ\s+QUYẾT|LUẬT|PHÁP\s+LỆNH|"
    r"THÔNG\s+TƯ\s+LIÊN\s+TỊCH|VĂN\s+BẢN\s+HỢP\s+NHẤT)\s*$",
    re.MULTILINE,
)
RE_SIGNER_ROLE_LINE = re.compile(
    r"^(?:TM\.|KT\.|TL\.|TUQ\.|THỦ TƯỚNG|PHÓ THỦ TƯỚNG|BỘ TRƯỞNG|THỨ TRƯỞNG|"
    r"CHỦ TỊCH|PHÓ CHỦ TỊCH|CHÁNH ÁN|VIỆN TRƯỞNG|TỔNG KIỂM TOÁN)"
)   # không dùng \b vì "TM." kết thúc bằng dấu chấm (không có ranh giới từ sau đó)


def find_signer(text: str) -> str | None:
    """Tên người ký = dòng có chữ thường đầu tiên sau khối chức danh viết hoa."""
    lines = [ln.strip() for ln in text.splitlines()]
    last_role = None
    for i, line in enumerate(lines):
        if RE_SIGNER_ROLE_LINE.match(line):
            last_role = i
    if last_role is None:
        return None
    for line in lines[last_role + 1 :]:
        if not line or line.startswith(("-", "|", "<", "#", "*", "$")) or len(line) > 60:
            continue
        letters = [c for c in line if c.isalpha()]
        if not letters or not any(c.islower() for c in letters):
            continue   # vẫn là dòng chức danh viết hoa
        return line
    return None


def guess_doc_type(so_ky_hieu: str | None) -> str | None:
    if not so_ky_hieu:
        return None
    suffix = so_ky_hieu.rsplit("/", 1)[-1]
    return DOC_TYPE_BY_SUFFIX.get(suffix, suffix.lower().replace("-", "-") or None)


def extract_meta(text: str) -> dict[str, Any]:
    """Rút một số trường định danh cơ bản để dựng front matter + URN."""
    meta: dict[str, Any] = {}
    m = RE_SO_KY_HIEU.search(text)
    if m:
        meta["so_ky_hieu"] = m.group(1).rstrip(".")
        meta["doc_type"] = guess_doc_type(meta["so_ky_hieu"])
        meta["urn"] = f"vn:vbqppl:{meta['doc_type']}:{meta['so_ky_hieu']}"
    h = RE_DOC_HEADING.search(text)
    if h:
        meta["doc_heading"] = re.sub(r"\s+", " ", h.group(1)).strip()
    signer = find_signer(text)
    if signer:
        meta["signer"] = signer
    return meta


@dataclass
class PipelineOptions:
    out_dir: Path | None = None
    use_llm: bool = False
    """Gọi agent LLM tái cấu trúc (bắt buộc cho tuyến D/E, tùy chọn cho C)."""
    window_size: int = 5
    overlap: int = 1
    dpi: int = 300
    keep_running_heads: bool = False
    stitch_cfg: StitchConfig = field(default_factory=StitchConfig)


def convert_file(path: str | Path, options: PipelineOptions | None = None) -> ConvertResult:
    """Chuyển một tệp bất kỳ sang Markdown chuẩn nội bộ + kiểm chứng."""
    opts = options or PipelineOptions()
    src = Path(path)
    decision = route_file(src, probe_ocr=True)
    asset_dir = (opts.out_dir / "assets") if opts.out_dir else None

    pages: list[PageChunk]
    assets: list[AssetOut] = []
    source_chars = 0
    page_count = 1
    warnings: list[str] = []
    dropped: list[str] = []
    expected_tables: list[tuple[int, int]] | None = None

    if decision.route is Route.A_DOCX:
        ex = extract_docx.extract(src, asset_dir=asset_dir)
        pages, assets, source_chars = extract_docx.to_pages(ex), list(ex.assets), ex.source_chars
        expected_tables = [(a.rows or 0, a.cols or 0) for a in ex.assets if a.kind == "table"]
    elif decision.route is Route.B_HTML:
        ex_h = extract_html.extract(src)
        pages, assets, source_chars = extract_html.to_pages(ex_h), list(ex_h.assets), ex_h.source_chars
        expected_tables = None  # bảng qua trang không tồn tại trong HTML một trang
    else:
        ex_p = extract_pdf_text.extract(
            src, asset_dir=asset_dir, drop_running=not opts.keep_running_heads
        )
        pages, assets, source_chars = ex_p.pages, list(ex_p.assets), ex_p.source_chars
        page_count = ex_p.page_count
        dropped.extend(ex_p.dropped)
        if decision.route in (Route.D_PDF_SCAN, Route.E_PDF_VISION):
            warnings.append(
                "tuyến D/E cần OCR + agent AI; môi trường hiện tại chưa bật engine OCR "
                "nên chỉ trích được text layer (nếu có). Xem README mục OCR."
            )

    stitched = stitch_pages(pages, opts.stitch_cfg)
    body = stitched.markdown
    corrections: list[dict[str, Any]] = []
    warnings.extend(stitched.warnings)
    dropped.extend(stitched.dropped)

    if opts.use_llm:
        body, llm_warnings, corrections = _ai_pass(src, decision.route, body, opts)
        warnings.extend(llm_warnings)

    meta_src = extract_meta(body)
    front: dict[str, Any] = {}
    if meta_src.get("urn"):
        front["urn"] = meta_src["urn"]
    front["version"] = 1
    rendered = build_internal_markdown(
        body, front, doc_heading=None
    )
    all_assets = assets + rendered.assets

    if expected_tables is None:
        expected_tables = [
            (a.rows or 0, a.cols or 0) for a in rendered.assets if a.kind == "table"
        ] or None

    result = verify_mod.verify(
        rendered.markdown,
        source_chars=source_chars or None,
        expected_tables=expected_tables,
        signer=meta_src.get("signer"),
    )

    out = ConvertResult(
        markdown=rendered.markdown,
        route=decision.route,
        confidence=decision.confidence,
        assets=all_assets,
        warnings=warnings + result.warnings,
        corrections=corrections,
        open_state=stitched.open_state,
        page_count=page_count,
        source_chars=source_chars,
        quality=result.to_json(),
    )
    if opts.out_dir:
        write_outputs(out, opts.out_dir, decision=decision, dropped=dropped, meta=meta_src)
    return out


def _ai_pass(
    src: Path, route: Route, deterministic_md: str, opts: PipelineOptions
) -> tuple[str, list[str], list[dict[str, Any]]]:
    """Gọi agent AI theo cửa sổ trang; giữ kết quả tất định nếu provider là mock."""
    from .ai_convert import convert_document
    from .layout import get_layout_engine

    client = LlmClient()
    if sniff_kind(src) != "pdf":
        return deterministic_md, ["bỏ qua bước AI: đầu vào không phải PDF"], []
    layout = get_layout_engine().analyze(str(src))
    page_count = max((b.page for b in layout), default=1)
    images: dict[int, Path] = {}
    if opts.out_dir and route in (Route.D_PDF_SCAN, Route.E_PDF_VISION):
        from .preprocess import preprocess_pdf

        pre = preprocess_pdf(src, opts.out_dir / "pages", dpi=opts.dpi)
        images = {img.page_no: img.path for img in pre.images}

    res = convert_document(
        client,
        route=route,
        page_count=page_count,
        layout=layout,
        image_paths=images or None,
        window_size=opts.window_size,
        overlap=opts.overlap,
        cfg=opts.stitch_cfg,
    )
    if client.is_mock or not res.markdown.strip():
        return (
            deterministic_md,
            res.warnings
            + [
                "provider LLM đang ở chế độ mock/replay (không có ANTHROPIC_API_KEY) — "
                "giữ kết quả của bộ ghép tất định thay vì đầu ra rỗng của mock"
            ],
            res.corrections,
        )
    return res.markdown, res.warnings, res.corrections


def write_outputs(
    result: ConvertResult,
    out_dir: str | Path,
    *,
    decision: Any = None,
    dropped: list[str] | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Path]:
    """Ghi Markdown + assets + báo cáo ra `out_dir` (tương ứng STORAGE_DIR)."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    md_path = out / "document.md"
    md_path.write_text(result.markdown, encoding="utf-8")
    assets_path = out / "assets.json"
    assets_path.write_text(
        json.dumps([a.to_json() for a in result.assets], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    report_path = out / "result.json"
    report_path.write_text(
        json.dumps(
            {
                "route": result.route.value,
                "confidence": result.confidence,
                "route_detail": decision.to_json() if decision is not None else None,
                "page_count": result.page_count,
                "source_chars": result.source_chars,
                "quality": result.quality,
                "warnings": result.warnings,
                "corrections": result.corrections,
                "open_state": result.open_state.to_json(),
                "meta": meta or {},
                "dropped_lines": dropped or [],
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"markdown": md_path, "assets": assets_path, "report": report_path}
