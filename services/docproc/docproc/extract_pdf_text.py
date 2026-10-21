"""Tuyến C — PDF có text layer (ke-hoach/05 §1).

Trích text + bảng + hình bằng engine layout (mặc định PyMuPDF), loại header/
footer/số trang lặp theo vị trí, rồi trả về danh sách `PageChunk` để bộ ghép
(`stitch`) nối câu/đoạn/bảng qua trang.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .layout import get_layout_engine
from .markdown import asset_id
from .preprocess import detect_running_blocks
from .stitch import render_table
from .types import AssetOut, LayoutBlock, PageChunk
from .verify import nonspace_len


@dataclass
class PdfExtraction:
    pages: list[PageChunk] = field(default_factory=list)
    assets: list[AssetOut] = field(default_factory=list)
    source_chars: int = 0
    """Tổng ký tự thô trích được — mốc để đối chiếu độ dài (ke-hoach/05 §5)."""
    page_count: int = 0
    dropped: list[str] = field(default_factory=list)


def page_heights(pdf_path: str | Path) -> dict[int, float]:
    import pymupdf

    with pymupdf.open(str(pdf_path)) as doc:
        return {i + 1: float(doc[i].rect.height) for i in range(doc.page_count)}


def extract_images(pdf_path: str | Path, out_dir: str | Path) -> dict[tuple[int, int], AssetOut]:
    """Trích hình nhúng ra tệp riêng; khóa là (trang, xref)."""
    import pymupdf

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    found: dict[tuple[int, int], AssetOut] = {}
    with pymupdf.open(str(pdf_path)) as doc:
        for page_index in range(doc.page_count):
            page = doc[page_index]
            for img in page.get_images(full=True):
                xref = img[0]
                info = doc.extract_image(xref)
                ext = info.get("ext", "png")
                data = info["image"]
                aid = asset_id("image", f"{pdf_path}:{page_index+1}:{xref}")
                path = out / f"{aid}.{ext}"
                path.write_bytes(data)
                found[(page_index + 1, xref)] = AssetOut(
                    id=aid,
                    kind="image",
                    image_uri=str(path),
                    page=page_index + 1,
                )
    return found


def blocks_to_pages(
    blocks: list[LayoutBlock],
    heights: dict[int, float],
    *,
    drop_running: bool = True,
) -> tuple[list[PageChunk], list[str], int]:
    """Chuyển danh sách block layout thành `PageChunk` theo thứ tự đọc."""
    dropped: list[str] = []
    drop_idx = detect_running_blocks(blocks, heights) if drop_running else set()
    for idx in sorted(drop_idx):
        dropped.append(f"p{blocks[idx].page}:running_block:{blocks[idx].text.strip()[:80]}")

    by_page: dict[int, list[str]] = {}
    source_chars = 0
    for idx, block in enumerate(blocks):
        if idx in drop_idx:
            continue
        lines = by_page.setdefault(block.page, [])
        if block.kind == "table" and block.table is not None:
            if lines and lines[-1].strip():
                lines.append("")
            lines.extend(render_table(block.table))
            source_chars += sum(nonspace_len(c) for row in block.table.rows for c in row)
            source_chars += sum(nonspace_len(c) for c in (block.table.header or []))
            continue
        if block.kind == "figure":
            continue
        text = block.text.strip()
        if not text:
            continue
        source_chars += nonspace_len(text)
        if lines and lines[-1].startswith("|"):
            lines.append("")
        lines.extend(text.splitlines())

    pages = [PageChunk(page_no=p, lines=by_page[p], wrapped=True) for p in sorted(by_page)]
    return pages, dropped, source_chars


def extract(
    pdf_path: str | Path,
    *,
    asset_dir: str | Path | None = None,
    engine_name: str | None = None,
    drop_running: bool = True,
) -> PdfExtraction:
    """Trích toàn bộ PDF có text layer thành `PageChunk` + assets hình."""
    engine = get_layout_engine(engine_name)
    blocks = engine.analyze(str(pdf_path))
    heights = page_heights(pdf_path)
    pages, dropped, source_chars = blocks_to_pages(blocks, heights, drop_running=drop_running)
    assets: list[AssetOut] = []
    if asset_dir is not None:
        assets = list(extract_images(pdf_path, asset_dir).values())
    return PdfExtraction(
        pages=pages,
        assets=assets,
        source_chars=source_chars,
        page_count=len(heights),
        dropped=dropped,
    )
