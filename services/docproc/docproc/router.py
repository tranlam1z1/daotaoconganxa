"""Bộ định tuyến đầu vào (ke-hoach/05 §1).

Tín hiệu dùng để chọn tuyến:
* tỷ lệ ký tự text-layer trên mỗi trang và tỷ lệ trang có text,
* DPI ước lượng của ảnh nhúng (PDF scan),
* tỷ lệ diện tích trang là vùng bảng (từ engine layout),
* độ tin cậy OCR trung bình (chỉ tính khi cần và khi có engine OCR).

Kết quả `RouteDecision` được ghi vào `pipeline_runs.route` + `confidence`.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .types import Route, RouteDecision

DOCX_EXT = {".docx", ".doc"}
HTML_EXT = {".html", ".htm", ".xhtml"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp", ".bmp"}
PDF_EXT = {".pdf"}

# Ngưỡng (có thể chỉnh qua biến môi trường khi hiệu chỉnh trên dữ liệu vàng).
MIN_CHARS_PER_PAGE = int(os.environ.get("DOCPROC_MIN_CHARS_PER_PAGE", "180"))
MIN_TEXT_PAGE_RATIO = float(os.environ.get("DOCPROC_MIN_TEXT_PAGE_RATIO", "0.7"))
MIN_SCAN_DPI = float(os.environ.get("DOCPROC_MIN_SCAN_DPI", "200"))
MIN_OCR_CONFIDENCE = float(os.environ.get("DOCPROC_MIN_OCR_CONFIDENCE", "0.72"))


def sniff_kind(path: str | Path) -> str:
    """Đoán loại tệp theo phần mở rộng + chữ ký nhị phân (magic bytes)."""
    p = Path(path)
    ext = p.suffix.lower()
    if ext in DOCX_EXT:
        return "docx"
    if ext in HTML_EXT:
        return "html"
    if ext in IMAGE_EXT:
        return "image"
    if ext in PDF_EXT:
        return "pdf"
    try:
        head = p.open("rb").read(8)
    except OSError as exc:
        raise ValueError(f"không đọc được tệp {p}: {exc}") from exc
    if head.startswith(b"%PDF"):
        return "pdf"
    if head.startswith(b"PK\x03\x04"):
        return "docx"
    if head.lstrip()[:1] == b"<":
        return "html"
    raise ValueError(f"không nhận diện được loại tệp: {p}")


def pdf_text_signals(pdf_path: str | Path) -> dict[str, Any]:
    """Đo text layer, DPI ảnh nhúng và tỷ lệ vùng bảng của một PDF."""
    import pymupdf

    from .layout import PyMuPdfLayout

    chars_per_page: list[int] = []
    dpis: list[float] = []
    table_area_ratio = 0.0
    page_area_total = 0.0
    table_area_total = 0.0

    with pymupdf.open(str(pdf_path)) as doc:
        page_count = doc.page_count
        for page in doc:
            text = page.get_text("text") or ""
            chars_per_page.append(len(text.strip()))
            rect = page.rect
            page_area_total += float(rect.width * rect.height)
            for img in page.get_images(full=True):
                xref = img[0]
                try:
                    info = doc.extract_image(xref)
                except Exception:
                    continue
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                w_pt = float(rects[0].width) or 1.0
                dpis.append(info["width"] / w_pt * 72.0)
            try:
                for tbl in page.find_tables().tables:
                    x0, y0, x1, y1 = tbl.bbox
                    table_area_total += abs((x1 - x0) * (y1 - y0))
            except Exception:
                pass

    if page_area_total > 0:
        table_area_ratio = table_area_total / page_area_total
    total_chars = sum(chars_per_page)
    text_pages = sum(1 for c in chars_per_page if c >= MIN_CHARS_PER_PAGE)
    return {
        "page_count": page_count,
        "total_chars": total_chars,
        "chars_per_page": round(total_chars / max(1, page_count), 1),
        "text_page_ratio": round(text_pages / max(1, page_count), 3),
        "embedded_dpi": round(min(dpis), 1) if dpis else None,
        "table_area_ratio": round(table_area_ratio, 4),
    }


def probe_ocr_confidence(pdf_path: str | Path, sample_pages: int = 2) -> float | None:
    """Chạy thử OCR vài trang để lấy confidence trung bình; None nếu không có engine."""
    import tempfile

    from . import ocr as ocr_mod
    from .preprocess import render_pages

    if not ocr_mod.available_engines():
        return None
    with tempfile.TemporaryDirectory() as tmp:
        images = render_pages(pdf_path, tmp, dpi=200, pages=list(range(1, sample_pages + 1)))
        scores = [ocr_mod.mean_confidence(ocr_mod.recognize_page(str(i.path))) for i in images]
    return round(sum(scores) / len(scores), 3) if scores else None


def route_file(path: str | Path, *, probe_ocr: bool = True) -> RouteDecision:
    """Chọn tuyến A/B/C/D/E cho một tệp đầu vào."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"không thấy tệp: {p}")
    kind = sniff_kind(p)

    if kind == "docx":
        return RouteDecision(
            Route.A_DOCX, 0.98, ["đầu vào là DOCX — trích trực tiếp, không cần OCR"],
            {"kind": kind},
        )
    if kind == "html":
        return RouteDecision(
            Route.B_HTML, 0.95, ["đầu vào là HTML có cấu trúc — chuyển thẳng sang Markdown"],
            {"kind": kind},
        )
    if kind == "image":
        return RouteDecision(
            Route.D_PDF_SCAN, 0.7, ["đầu vào là ảnh — bắt buộc OCR"], {"kind": kind}
        )

    signals = pdf_text_signals(p)
    signals["kind"] = kind
    reasons: list[str] = []

    has_text = (
        signals["chars_per_page"] >= MIN_CHARS_PER_PAGE
        and signals["text_page_ratio"] >= MIN_TEXT_PAGE_RATIO
    )
    if has_text:
        reasons.append(
            f"PDF có text layer ({signals['chars_per_page']} ký tự/trang, "
            f"{signals['text_page_ratio']:.0%} số trang có text)"
        )
        if signals["table_area_ratio"] > 0.25:
            reasons.append(
                f"tỷ lệ vùng bảng cao ({signals['table_area_ratio']:.0%}) — cần giữ bảng cẩn thận"
            )
        margin = min(
            signals["chars_per_page"] / max(1.0, MIN_CHARS_PER_PAGE * 3),
            signals["text_page_ratio"],
        )
        confidence = round(min(0.97, 0.7 + 0.27 * margin), 3)
        return RouteDecision(Route.C_PDF_TEXT, confidence, reasons, signals)

    reasons.append(
        f"PDF thiếu text layer ({signals['chars_per_page']} ký tự/trang, "
        f"{signals['text_page_ratio']:.0%} số trang có text) — phải OCR"
    )
    ocr_conf = probe_ocr_confidence(p) if probe_ocr else None
    signals["ocr_confidence"] = ocr_conf
    dpi = signals.get("embedded_dpi")

    low_dpi = dpi is not None and dpi < MIN_SCAN_DPI
    low_ocr = ocr_conf is not None and ocr_conf < MIN_OCR_CONFIDENCE
    if low_dpi:
        reasons.append(f"DPI ảnh nhúng thấp ({dpi})")
    if low_ocr:
        reasons.append(f"độ tin cậy OCR thấp ({ocr_conf})")

    if low_ocr or (low_dpi and ocr_conf is None):
        return RouteDecision(
            Route.E_PDF_VISION,
            0.6 if ocr_conf is None else round(0.55 + 0.4 * (1 - ocr_conf), 3),
            reasons + ["chuyển tuyến E: AI vision đọc thẳng ảnh trang, đối chiếu chéo với D"],
            signals,
        )
    if ocr_conf is None:
        reasons.append("chưa có engine OCR để đo confidence — mặc định tuyến D")
        return RouteDecision(Route.D_PDF_SCAN, 0.5, reasons, signals)
    return RouteDecision(
        Route.D_PDF_SCAN, round(min(0.95, 0.5 + 0.5 * ocr_conf), 3), reasons, signals
    )
