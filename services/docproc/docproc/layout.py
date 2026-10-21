"""Phân tích layout trang PDF (ke-hoach/05 §3).

Ba engine theo cùng một giao diện `LayoutEngine`:

* `PyMuPdfLayout`  — **mặc định**, nhẹ, chạy được mọi nơi (không GPU).
* `DoclingLayout`  — phân vùng layout + TableFormer; nặng, cần cài thêm.
* `MarkerLayout`   — trích LaTeX tốt cho trang có công thức; cần GPU.

Docling/Marker được import **bên trong hàm** để không kéo phụ thuộc nặng khi
chỉ chạy engine nhẹ; `available()` kiểm tra khả dụng lúc chạy.
"""

from __future__ import annotations

import re
from typing import Any

from .types import LayoutBlock, TableBlock


def _pymupdf():
    import pymupdf  # nhập trễ để module này import được cả khi thiếu pymupdf

    return pymupdf


class PyMuPdfLayout:
    """Engine layout nhẹ dựa trên PyMuPDF: block văn bản + bảng có kẻ khung."""

    name = "pymupdf"

    def available(self) -> bool:
        try:
            _pymupdf()
        except ImportError:
            return False
        return True

    def analyze(self, pdf_path: str, pages: list[int] | None = None) -> list[LayoutBlock]:
        pymupdf = _pymupdf()
        blocks: list[LayoutBlock] = []
        with pymupdf.open(pdf_path) as doc:
            targets = pages or list(range(1, doc.page_count + 1))
            for page_no in targets:
                if page_no < 1 or page_no > doc.page_count:
                    raise ValueError(f"trang {page_no} nằm ngoài tài liệu ({doc.page_count} trang)")
                blocks.extend(self._analyze_page(doc[page_no - 1], page_no))
        blocks.sort(key=lambda b: (b.page, round(b.bbox[1], 1), round(b.bbox[0], 1)))
        return blocks

    def _analyze_page(self, page: Any, page_no: int) -> list[LayoutBlock]:
        out: list[LayoutBlock] = []
        table_boxes: list[tuple[float, float, float, float]] = []
        try:
            finder = page.find_tables()
        except Exception:  # pragma: no cover - phụ thuộc phiên bản PyMuPDF
            finder = None
        if finder is not None:
            for tbl in finder.tables:
                data = [[(c or "").strip() for c in row] for row in tbl.extract()]
                if not data:
                    continue
                header, rows = data[0], data[1:]
                bbox = tuple(float(v) for v in tbl.bbox)  # type: ignore[assignment]
                table_boxes.append(bbox)  # type: ignore[arg-type]
                out.append(
                    LayoutBlock(
                        kind="table",
                        page=page_no,
                        bbox=bbox,  # type: ignore[arg-type]
                        text="",
                        table=TableBlock(
                            header=header,
                            rows=rows,
                            page_start=page_no,
                            page_end=page_no,
                        ),
                    )
                )

        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                bbox = tuple(float(v) for v in block["bbox"])
                out.append(LayoutBlock(kind="figure", page=page_no, bbox=bbox, text=""))  # type: ignore[arg-type]
                continue
            bbox = tuple(float(v) for v in block["bbox"])
            if _inside_any(bbox, table_boxes):
                continue  # chữ nằm trong bảng đã được engine bảng lấy
            lines: list[str] = []
            for line in block.get("lines", []):
                text = "".join(span.get("text", "") for span in line.get("spans", []))
                if text.strip():
                    lines.append(text.strip())
            if not lines:
                continue
            text = "\n".join(lines)
            out.append(
                LayoutBlock(kind=_guess_kind(text), page=page_no, bbox=bbox, text=text)  # type: ignore[arg-type]
            )
        return out


def _inside_any(bbox: tuple[float, ...], boxes: list[tuple[float, float, float, float]]) -> bool:
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    for x0, y0, x1, y1 in boxes:
        if x0 - 2 <= cx <= x1 + 2 and y0 - 2 <= cy <= y1 + 2:
            return True
    return False


_RE_CAPTION = re.compile(r"^\s*(?:Hình|Bảng|Biểu|Sơ\s+đồ)\s+\d+", re.IGNORECASE)


def _guess_kind(text: str) -> str:
    from . import formula as formula_mod

    first = text.splitlines()[0]
    if _RE_CAPTION.match(first):
        return "caption"
    if formula_mod.looks_like_formula(first):
        return "formula"
    from .labels import label_kind

    if label_kind(first) in {"diem", "khoan", "gach_dau_dong"}:
        return "list"
    return "paragraph"


class DoclingLayout:
    """Adapter Docling (`DoclingDocument` JSON, TableFormer).

    Cài: `pip install docling` (kéo theo torch — cần ~3 GB đĩa, nên chỉ bật khi
    có GPU/đĩa dư; xem README).
    """

    name = "docling"

    def __init__(self, ocr_lang: str = "vi") -> None:
        self.ocr_lang = ocr_lang

    def available(self) -> bool:
        try:
            import docling  # noqa: F401
        except ImportError:
            return False
        return True

    def analyze(self, pdf_path: str, pages: list[int] | None = None) -> list[LayoutBlock]:
        try:
            from docling.document_converter import DocumentConverter
        except ImportError as exc:  # không nuốt lỗi: nói rõ cách bật
            raise RuntimeError(
                "Docling chưa được cài. Chạy `pip install docling` (cần ~3 GB đĩa) "
                "rồi đặt DOCPROC_LAYOUT_ENGINE=docling."
            ) from exc

        converter = DocumentConverter()
        result = converter.convert(pdf_path)
        blocks: list[LayoutBlock] = []
        for item, _level in result.document.iterate_items():
            page_no = _docling_page(item)
            if pages and page_no not in pages:
                continue
            bbox = _docling_bbox(item)
            label = str(getattr(item, "label", "text")).lower()
            if "table" in label and hasattr(item, "export_to_dataframe"):
                grid = [[str(c) for c in row] for row in item.data.grid] if getattr(item, "data", None) else []
                header = grid[0] if grid else None
                rows = grid[1:] if len(grid) > 1 else []
                blocks.append(
                    LayoutBlock(
                        kind="table",
                        page=page_no,
                        bbox=bbox,
                        table=TableBlock(header=header, rows=rows, page_start=page_no, page_end=page_no),
                    )
                )
                continue
            text = getattr(item, "text", "") or ""
            if not text.strip():
                continue
            kind = {
                "section_header": "paragraph",
                "list_item": "list",
                "caption": "caption",
                "formula": "formula",
                "picture": "figure",
            }.get(label, "paragraph")
            blocks.append(LayoutBlock(kind=kind, page=page_no, bbox=bbox, text=text))
        return blocks


def _docling_page(item: Any) -> int:
    prov = getattr(item, "prov", None) or []
    if prov:
        return int(getattr(prov[0], "page_no", 1))
    return 1


def _docling_bbox(item: Any) -> tuple[float, float, float, float]:
    prov = getattr(item, "prov", None) or []
    if prov and getattr(prov[0], "bbox", None) is not None:
        b = prov[0].bbox
        return (float(b.l), float(b.t), float(b.r), float(b.b))
    return (0.0, 0.0, 0.0, 0.0)


class MarkerLayout:
    """Adapter Marker (GPU) — dùng cho trang có công thức, trích LaTeX tốt hơn.

    Cài: `pip install marker-pdf` (cần GPU + ~5 GB mô hình).
    """

    name = "marker"

    def available(self) -> bool:
        try:
            import marker  # noqa: F401
        except ImportError:
            return False
        return True

    def analyze(self, pdf_path: str, pages: list[int] | None = None) -> list[LayoutBlock]:
        try:
            from marker.converters.pdf import PdfConverter
            from marker.models import create_model_dict
        except ImportError as exc:
            raise RuntimeError(
                "Marker chưa được cài. Chạy `pip install marker-pdf` trên máy có GPU "
                "rồi đặt DOCPROC_LAYOUT_ENGINE=marker."
            ) from exc

        converter = PdfConverter(artifact_dict=create_model_dict())
        rendered = converter(pdf_path)
        markdown = getattr(rendered, "markdown", "") or ""
        blocks: list[LayoutBlock] = []
        for idx, chunk in enumerate(markdown.split("\n\n")):
            if not chunk.strip():
                continue
            kind = "table" if chunk.lstrip().startswith("|") else "paragraph"
            if chunk.strip().startswith("$$"):
                kind = "formula"
            blocks.append(LayoutBlock(kind=kind, page=1, bbox=(0.0, float(idx), 0.0, float(idx)), text=chunk))
        return blocks


ENGINES: dict[str, type] = {
    "pymupdf": PyMuPdfLayout,
    "docling": DoclingLayout,
    "marker": MarkerLayout,
}


def get_layout_engine(name: str | None = None):
    """Lấy engine layout theo tên; mặc định PyMuPDF (nhẹ, luôn khả dụng)."""
    import os

    key = (name or os.environ.get("DOCPROC_LAYOUT_ENGINE") or "pymupdf").lower()
    if key not in ENGINES:
        raise ValueError(f"engine layout không hợp lệ: {key} (có: {', '.join(ENGINES)})")
    engine = ENGINES[key]()
    if not engine.available():
        raise RuntimeError(
            f"engine layout '{key}' không khả dụng trong môi trường này; xem README mục 'Bật Docling/Marker'."
        )
    return engine
