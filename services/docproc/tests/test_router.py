"""Kiểm thử bộ định tuyến đầu vào (ke-hoach/05 §1)."""

from __future__ import annotations

from pathlib import Path

import pytest

from docproc.router import pdf_text_signals, route_file, sniff_kind
from docproc.types import Route


def test_sniff_kind_theo_duoi_va_magic(tmp_path: Path, fixture_pdf: Path) -> None:
    assert sniff_kind(fixture_pdf) == "pdf"
    html = tmp_path / "vb.html"
    html.write_text("<html><body>x</body></html>", encoding="utf-8")
    assert sniff_kind(html) == "html"
    unknown = tmp_path / "vb.bin"
    unknown.write_bytes(b"%PDF-1.7 gia lap")
    assert sniff_kind(unknown) == "pdf"
    bad = tmp_path / "vb.dat"
    bad.write_bytes(b"\x00\x01\x02\x03")
    with pytest.raises(ValueError):
        sniff_kind(bad)


def test_route_pdf_co_text_layer_ra_tuyen_C(fixture_pdf: Path) -> None:
    decision = route_file(fixture_pdf)
    assert decision.route is Route.C_PDF_TEXT
    assert decision.confidence > 0.9
    assert decision.signals["page_count"] == 5
    assert decision.signals["text_page_ratio"] == 1.0
    assert any("text layer" in r for r in decision.reasons)


def test_route_docx_ra_tuyen_A(tmp_path: Path) -> None:
    import docx

    path = tmp_path / "vb.docx"
    d = docx.Document()
    d.add_paragraph("Điều 1. Phạm vi điều chỉnh")
    d.save(path)
    decision = route_file(path)
    assert decision.route is Route.A_DOCX
    assert decision.confidence > 0.9


def test_route_html_ra_tuyen_B(tmp_path: Path) -> None:
    path = tmp_path / "vb.html"
    path.write_text("<html><body><p>Điều 1.</p></body></html>", encoding="utf-8")
    assert route_file(path).route is Route.B_HTML


def test_route_pdf_khong_co_text_ra_tuyen_D_hoac_E(tmp_path: Path) -> None:
    """PDF trắng (không text layer) phải rời khỏi tuyến C."""
    import pymupdf

    path = tmp_path / "scan.pdf"
    doc = pymupdf.open()
    for _ in range(3):
        doc.new_page(width=595, height=842)
    doc.save(str(path))
    doc.close()
    decision = route_file(path, probe_ocr=False)
    assert decision.route in (Route.D_PDF_SCAN, Route.E_PDF_VISION)
    assert any("thiếu text layer" in r for r in decision.reasons)


def test_route_file_bao_loi_khi_thieu_tep() -> None:
    with pytest.raises(FileNotFoundError):
        route_file("/khong/ton/tai.pdf")


def test_pdf_text_signals_do_ty_le_vung_bang(fixture_pdf: Path) -> None:
    signals = pdf_text_signals(fixture_pdf)
    assert signals["total_chars"] > 2000
    assert signals["table_area_ratio"] > 0.0
    assert signals["chars_per_page"] > 180
