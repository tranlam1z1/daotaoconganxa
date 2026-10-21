"""Kiểu dữ liệu dùng chung cho toàn bộ pipeline chuyển đổi."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol


class Route(str, Enum):
    """Tuyến xử lý theo ke-hoach/05 §1."""

    A_DOCX = "A"          # DOCX -> Markdown trực tiếp
    B_HTML = "B"          # HTML có cấu trúc -> Markdown
    C_PDF_TEXT = "C"      # PDF có text layer -> trích + AI làm sạch/nối đoạn
    D_PDF_SCAN = "D"      # PDF scan -> tiền xử lý + OCR + AI tái cấu trúc
    E_PDF_VISION = "E"    # PDF scan chất lượng rất thấp -> AI vision trực tiếp


@dataclass
class RouteDecision:
    """Kết quả phân loại đầu vào: ghi vào `pipeline_runs.route` + `confidence`."""

    route: Route
    confidence: float
    reasons: list[str] = field(default_factory=list)
    signals: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "route": self.route.value,
            "confidence": round(self.confidence, 4),
            "reasons": self.reasons,
            "signals": self.signals,
        }


@dataclass
class PageChunk:
    """Nội dung một trang đã trích, ở dạng dòng Markdown thô.

    `wrapped=True` nghĩa là các dòng còn bị ngắt theo dòng hiển thị (OCR, hoặc
    trích theo dòng); bộ ghép sẽ tự nối lại thành đoạn. `wrapped=False` nghĩa là
    mỗi phần tử đã là một đoạn hoàn chỉnh.
    """

    page_no: int
    lines: list[str]
    wrapped: bool = True


@dataclass
class TableBlock:
    """Bảng ở dạng trung gian, để nối qua trang trước khi render."""

    header: list[str] | None
    rows: list[list[str]]
    caption: str | None = None
    align: list[str] | None = None
    html: str | None = None        # dùng khi bảng có gộp ô (rowspan/colspan)
    asset_id: str | None = None
    page_start: int | None = None
    page_end: int | None = None

    @property
    def cols(self) -> int:
        if self.header:
            return len(self.header)
        return max((len(r) for r in self.rows), default=0)

    @property
    def n_rows(self) -> int:
        """Số hàng dữ liệu (không tính hàng tiêu đề)."""
        return len(self.rows)


@dataclass
class OpenState:
    """"Trạng thái mở" ở cuối một cửa sổ trang (ke-hoach/05 §4.1)."""

    paragraph_open: bool = False
    """Đoạn cuối chưa kết thúc câu -> cửa sổ sau phải nối tiếp, không xuống dòng."""
    tail_text: str = ""
    """2–3 đoạn cuối đã chấp nhận, làm ngữ cảnh nối cho cửa sổ sau."""
    table_open: bool = False
    table_cols: int = 0
    table_header: list[str] | None = None
    node_label: str | None = None
    """Ví dụ: "điểm c khoản 2 Điều 15" — nút đang dang dở."""

    def to_json(self) -> dict[str, Any]:
        return {
            "paragraph_open": self.paragraph_open,
            "tail_text": self.tail_text,
            "table_open": self.table_open,
            "table_cols": self.table_cols,
            "table_header": self.table_header,
            "node_label": self.node_label,
        }


@dataclass
class AssetOut:
    """Một `assets` row: bảng / hình / công thức tách rời (ke-hoach/03 §2.4)."""

    id: str
    kind: str                      # table | image | formula
    md: str | None = None
    alt: str | None = None
    caption: str | None = None
    image_uri: str | None = None
    rows: int | None = None
    cols: int | None = None
    confidence: float = 1.0
    needs_review: bool = False
    page: int | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "md": self.md,
            "alt": self.alt,
            "caption": self.caption,
            "image_uri": self.image_uri,
            "rows": self.rows,
            "cols": self.cols,
            "confidence": self.confidence,
            "needs_review": self.needs_review,
            "page": self.page,
        }


@dataclass
class ConvertResult:
    """Đầu ra của một lần chuyển đổi."""

    markdown: str
    route: Route
    confidence: float
    assets: list[AssetOut] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    corrections: list[dict[str, Any]] = field(default_factory=list)
    open_state: OpenState = field(default_factory=OpenState)
    page_count: int = 0
    source_chars: int = 0
    """Tổng ký tự thô trích được (OCR/text layer) — dùng để đối chiếu độ dài."""
    quality: dict[str, Any] = field(default_factory=dict)


@dataclass
class LayoutBlock:
    """Một khối layout: đoạn, bảng, hình, chú thích, công thức."""

    kind: str                       # paragraph | table | figure | caption | list | formula
    page: int
    bbox: tuple[float, float, float, float]
    text: str = ""
    confidence: float = 1.0
    table: TableBlock | None = None


class LayoutEngine(Protocol):
    """Giao diện chung cho bộ phân tích layout (PyMuPDF / Docling / Marker)."""

    name: str

    def available(self) -> bool:
        """Engine có chạy được trong môi trường hiện tại không."""
        ...

    def analyze(self, pdf_path: str, pages: list[int] | None = None) -> list[LayoutBlock]:
        ...


@dataclass
class OcrLine:
    """Một dòng OCR kèm vị trí và độ tin cậy, để bỏ phiếu giữa các engine."""

    text: str
    bbox: tuple[float, float, float, float]
    confidence: float
    engine: str = ""


class OcrEngine(Protocol):
    """Giao diện chung cho engine OCR (Tesseract / PaddleOCR)."""

    name: str

    def available(self) -> bool:
        ...

    def recognize(self, image_path: str, lang: str = "vie") -> list[OcrLine]:
        ...
