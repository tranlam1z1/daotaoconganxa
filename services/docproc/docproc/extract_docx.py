"""Tuyến A — DOCX (Công báo, cổng bộ) chuyển thẳng sang Markdown chuẩn nội bộ.

Giữ bảng ở dạng GFM (hoặc HTML khi có gộp ô), giữ công thức, trích hình ra tệp
riêng kèm bản ghi `assets`.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .markdown import asset_id, html_table
from .types import AssetOut, PageChunk
from .verify import nonspace_len

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


@dataclass
class DocxExtraction:
    lines: list[str] = field(default_factory=list)
    assets: list[AssetOut] = field(default_factory=list)
    source_chars: int = 0


def _cell_text(cell: Any) -> str:
    """Text của một ô bảng, các đoạn nối bằng `<br>` để không vỡ hàng GFM."""
    parts = [p.text.strip() for p in cell.paragraphs if p.text.strip()]
    return "<br>".join(parts).replace("|", "\\|")


def _grid_spans(table: Any) -> tuple[list[list[str]], list[list[tuple[int, int]]], bool]:
    """Đọc bảng DOCX kèm rowspan/colspan; trả (ô, span, có_gộp_ô).

    Duyệt trực tiếp `w:tc` của từng `w:tr` (không dùng `row.cells`, vì API đó nhân
    bản ô khi có gridSpan) và theo dõi `w:vMerge` để suy ra rowspan.
    """
    from docx.table import _Cell

    rows: list[list[str]] = []
    spans: list[list[tuple[int, int]]] = []
    merged = False
    # cột lưới -> (chỉ số hàng, chỉ số ô) của ô đang mở vMerge
    open_vmerge: dict[int, tuple[int, int]] = {}

    for r, tr in enumerate(table.rows):
        cells: list[str] = []
        row_spans: list[list[int]] = []
        grid_col = 0
        for tc in tr._tr.tc_lst:
            tc_pr = tc.find(f"{_W_NS}tcPr")
            colspan = 1
            vmerge_continue = False
            if tc_pr is not None:
                grid_span = tc_pr.find(f"{_W_NS}gridSpan")
                if grid_span is not None:
                    colspan = int(grid_span.get(f"{_W_NS}val") or 1)
                vmerge = tc_pr.find(f"{_W_NS}vMerge")
                if vmerge is not None:
                    merged = True
                    vmerge_continue = (vmerge.get(f"{_W_NS}val") or "continue") == "continue"
            if colspan > 1:
                merged = True
            if vmerge_continue:
                anchor = open_vmerge.get(grid_col)
                if anchor is not None:
                    ar, ac = anchor
                    spans[ar][ac][0] += 1
                grid_col += colspan
                continue
            cells.append(_cell_text(_Cell(tc, table)))
            row_spans.append([1, colspan])
            if tc_pr is not None and tc_pr.find(f"{_W_NS}vMerge") is not None:
                open_vmerge[grid_col] = (r, len(cells) - 1)
            grid_col += colspan
        rows.append(cells)
        spans.append(row_spans)  # type: ignore[arg-type]

    frozen = [[(int(a), int(b)) for a, b in row] for row in spans]
    return rows, frozen, merged


def _table_to_lines(table: Any, index: int, assets: list[AssetOut]) -> list[str]:
    rows, spans, merged = _grid_spans(table)
    if not rows:
        return []
    if merged:
        md = html_table(rows, spans)
    else:
        cols = max(len(r) for r in rows)
        pad = lambda r: r + [""] * (cols - len(r))
        header = pad(rows[0])
        body = [pad(r) for r in rows[1:]]
        md_lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * cols) + " |"]
        md_lines += ["| " + " | ".join(r) + " |" for r in body]
        md = "\n".join(md_lines)
    aid = asset_id("table", md, salt=str(index))
    assets.append(
        AssetOut(
            id=aid,
            kind="table",
            md=md,
            rows=max(0, len(rows) - 1),
            cols=max((len(r) for r in rows), default=0),
        )
    )
    return md.splitlines()


def _para_line(para: Any) -> str:
    """Một đoạn DOCX -> một dòng Markdown, giữ in đậm/nghiêng ở mức thô."""
    text = para.text.strip()
    if not text:
        return ""
    style = (para.style.name or "").lower()
    if style.startswith("heading 1"):
        return f"# {text}"
    if style.startswith("heading 2"):
        return f"## {text}"
    if style.startswith("heading 3"):
        return f"### {text}"
    return text


def extract_media(docx_path: str | Path, out_dir: str | Path) -> list[AssetOut]:
    """Trích hình trong `word/media/` ra thư mục assets."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    assets: list[AssetOut] = []
    with zipfile.ZipFile(docx_path) as zf:
        for name in zf.namelist():
            if not name.startswith("word/media/"):
                continue
            data = zf.read(name)
            ext = Path(name).suffix.lstrip(".") or "png"
            aid = asset_id("image", name + str(len(data)))
            path = out / f"{aid}.{ext}"
            path.write_bytes(data)
            assets.append(AssetOut(id=aid, kind="image", image_uri=str(path), caption=Path(name).stem))
    return assets


def extract(docx_path: str | Path, *, asset_dir: str | Path | None = None) -> DocxExtraction:
    """Trích DOCX thành danh sách dòng Markdown theo đúng thứ tự đọc."""
    try:
        import docx
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError as exc:
        raise RuntimeError("Thiếu gói `python-docx`. Chạy `pip install python-docx`.") from exc

    document = docx.Document(str(docx_path))
    lines: list[str] = []
    assets: list[AssetOut] = []
    table_idx = 0
    body = document.element.body
    for child in body.iterchildren():
        if child.tag == f"{_W_NS}p":
            line = _para_line(Paragraph(child, document))
            if lines and lines[-1].startswith("|") and line:
                lines.append("")
            lines.append(line)
        elif child.tag == f"{_W_NS}tbl":
            table_idx += 1
            if lines and lines[-1].strip():
                lines.append("")
            lines.extend(_table_to_lines(Table(child, document), table_idx, assets))
            lines.append("")

    if asset_dir is not None:
        assets.extend(extract_media(docx_path, asset_dir))

    lines = [ln for ln in _squeeze(lines)]
    source_chars = sum(nonspace_len(ln) for ln in lines)
    return DocxExtraction(lines=lines, assets=assets, source_chars=source_chars)


def _squeeze(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        if not line.strip():
            if out and not out[-1].strip():
                continue
            out.append("")
        else:
            out.append(line.rstrip())
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return out


def to_pages(extraction: DocxExtraction) -> list[PageChunk]:
    """DOCX không có khái niệm trang -> coi toàn văn bản là một "trang"."""
    return [PageChunk(page_no=1, lines=list(extraction.lines), wrapped=False)]
