"""Tuyến B — HTML có cấu trúc (vbpl.vn, cổng bộ) sang Markdown chuẩn nội bộ.

Quy tắc riêng cho VBQPPL:
* giữ bảng: `<table>` đơn giản -> GFM; có `rowspan`/`colspan` -> giữ nguyên HTML;
* giữ công thức: `<math>`/`.katex`/`$…$` giữ nguyên để `markdown.py` xử lý;
* trích `<img>` thành `assets` kèm `alt` làm caption;
* bỏ khung trang (nav, header, footer, script, style) và các nhãn "In văn bản"…
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .markdown import asset_id, html_table
from .types import AssetOut, PageChunk
from .verify import nonspace_len

DROP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "form", "iframe", "svg"}
DROP_CLASS_HINTS = ("breadcrumb", "menu", "banner", "advert", "share", "toolbar", "pagination")

_RE_WS = re.compile(r"[ \t ]+")


@dataclass
class HtmlExtraction:
    lines: list[str] = field(default_factory=list)
    assets: list[AssetOut] = field(default_factory=list)
    source_chars: int = 0
    title: str | None = None


def _clean_text(text: str) -> str:
    return _RE_WS.sub(" ", text.replace("­", "")).strip()


def _table_lines(table: Any, index: int, assets: list[AssetOut]) -> list[str]:
    rows: list[list[str]] = []
    spans: list[list[tuple[int, int]]] = []
    merged = False
    for tr in table.find_all("tr"):
        cells: list[str] = []
        row_spans: list[tuple[int, int]] = []
        for cell in tr.find_all(["td", "th"]):
            rowspan = int(cell.get("rowspan", 1) or 1)
            colspan = int(cell.get("colspan", 1) or 1)
            if rowspan > 1 or colspan > 1:
                merged = True
            cells.append(_clean_text(cell.get_text(" ", strip=True)).replace("|", "\\|"))
            row_spans.append((rowspan, colspan))
        if cells:
            rows.append(cells)
            spans.append(row_spans)
    if not rows:
        return []
    if merged:
        md = html_table(rows, spans)
    else:
        cols = max(len(r) for r in rows)
        pad = lambda r: r + [""] * (cols - len(r))
        md_lines = ["| " + " | ".join(pad(rows[0])) + " |",
                    "| " + " | ".join(["---"] * cols) + " |"]
        md_lines += ["| " + " | ".join(pad(r)) + " |" for r in rows[1:]]
        md = "\n".join(md_lines)
    aid = asset_id("table", md, salt=str(index))
    assets.append(
        AssetOut(id=aid, kind="table", md=md, rows=max(0, len(rows) - 1),
                 cols=max((len(r) for r in rows), default=0))
    )
    return md.splitlines()


def extract(html: str | Path, *, is_path: bool | None = None) -> HtmlExtraction:
    """Chuyển HTML sang danh sách dòng Markdown."""
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise RuntimeError("Thiếu gói `beautifulsoup4`. Chạy `pip install beautifulsoup4 lxml`.") from exc

    if is_path is None:
        is_path = isinstance(html, Path) or (isinstance(html, str) and "\n" not in html and Path(html).exists())
    source = Path(html).read_text(encoding="utf-8", errors="replace") if is_path else str(html)
    soup = BeautifulSoup(source, "lxml")

    for tag in soup.find_all(list(DROP_TAGS)):
        tag.decompose()
    for tag in soup.find_all(attrs={"class": True}):
        classes = " ".join(tag.get("class", [])).lower()
        if any(hint in classes for hint in DROP_CLASS_HINTS):
            tag.decompose()

    title = _clean_text(soup.title.get_text()) if soup.title else None
    root = soup.body or soup
    lines: list[str] = []
    assets: list[AssetOut] = []
    table_idx = 0

    for node in root.find_all(
        ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "li", "table", "img", "pre"],
        recursive=True,
    ):
        if node.find_parent("table") is not None and node.name != "table":
            continue
        if node.name == "table":
            table_idx += 1
            if lines and lines[-1].strip():
                lines.append("")
            lines.extend(_table_lines(node, table_idx, assets))
            lines.append("")
            continue
        if node.name == "img":
            src = node.get("src", "")
            alt = _clean_text(node.get("alt", "")) or "Hình"
            aid = asset_id("image", src or alt)
            assets.append(AssetOut(id=aid, kind="image", image_uri=src, caption=alt))
            lines.append(f"![{alt}]({src})")
            continue
        if node.name == "div":
            # chỉ lấy div "lá" (không chứa khối con) để tránh nhân đôi nội dung
            if node.find(["p", "div", "table", "li", "h1", "h2", "h3", "h4"]) is not None:
                continue
        text = _clean_text(node.get_text(" ", strip=True))
        if not text:
            continue
        if node.name.startswith("h") and node.name[1:].isdigit():
            level = min(int(node.name[1:]), 6)
            lines.append("#" * level + " " + text)
        else:
            lines.append(text)

    lines = _dedupe_squeeze(lines)
    return HtmlExtraction(
        lines=lines,
        assets=assets,
        source_chars=sum(nonspace_len(ln) for ln in lines),
        title=title,
    )


def _dedupe_squeeze(lines: list[str]) -> list[str]:
    out: list[str] = []
    for line in lines:
        if not line.strip():
            if out and not out[-1].strip():
                continue
            out.append("")
            continue
        if out and out[-1] == line:
            continue
        out.append(line.rstrip())
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return out


def to_pages(extraction: HtmlExtraction) -> list[PageChunk]:
    """HTML không phân trang -> một "trang" duy nhất, các dòng đã là đoạn."""
    return [PageChunk(page_no=1, lines=list(extraction.lines), wrapped=False)]
