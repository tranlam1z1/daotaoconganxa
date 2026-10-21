"""Kiểm thử tuyến A (DOCX), B (HTML) và C (PDF có text layer)."""

from __future__ import annotations

from pathlib import Path

import pytest

from docproc import extract_docx, extract_html, extract_pdf_text
from docproc.stitch import stitch_pages


def _make_docx(path: Path) -> Path:
    import docx

    d = docx.Document()
    d.add_paragraph("Chương I. QUY ĐỊNH CHUNG")
    d.add_paragraph("Điều 1. Phạm vi điều chỉnh")
    d.add_paragraph("1. Nghị định này quy định về quản lý đầu tư.")
    d.add_paragraph("a) Dự án nhóm A;")
    table = d.add_table(rows=3, cols=3)
    for r, row in enumerate([["STT", "Hạng mục", "Định mức"], ["1", "Khảo sát", "12"], ["2", "Thiết kế", "18"]]):
        for c, value in enumerate(row):
            table.cell(r, c).text = value
    d.add_paragraph("Nơi nhận:")
    d.save(path)
    return path


def test_docx_giu_bang_dang_gfm(tmp_path: Path) -> None:
    ex = extract_docx.extract(_make_docx(tmp_path / "vb.docx"))
    md = "\n".join(ex.lines)
    assert "| STT | Hạng mục | Định mức |" in md
    assert "| 1 | Khảo sát | 12 |" in md
    assert "Điều 1. Phạm vi điều chỉnh" in md
    table_asset = next(a for a in ex.assets if a.kind == "table")
    assert (table_asset.rows, table_asset.cols) == (2, 3)


def test_docx_bang_gop_o_dung_html(tmp_path: Path) -> None:
    import docx

    path = tmp_path / "merge.docx"
    d = docx.Document()
    table = d.add_table(rows=2, cols=2)
    table.cell(0, 0).merge(table.cell(0, 1))
    table.cell(0, 0).text = "Tiêu đề gộp"
    table.cell(1, 0).text = "x"
    table.cell(1, 1).text = "y"
    d.save(path)
    ex = extract_docx.extract(path)
    md = "\n".join(ex.lines)
    assert "<table>" in md and "Tiêu đề gộp" in md


def test_docx_to_pages_khong_wrap(tmp_path: Path) -> None:
    ex = extract_docx.extract(_make_docx(tmp_path / "vb.docx"))
    pages = extract_docx.to_pages(ex)
    assert len(pages) == 1 and pages[0].wrapped is False


HTML = """<html><head><title>Nghị định 45/2026</title></head><body>
<nav>Trang chủ | Văn bản</nav>
<h2>Chương I. QUY ĐỊNH CHUNG</h2>
<p>Điều 1. Phạm vi điều chỉnh</p>
<p>1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn</p>
<p>ngân sách nhà nước.</p>
<table><tr><th>STT</th><th>Hạng mục</th></tr><tr><td>1</td><td>Khảo sát</td></tr></table>
<table><tr><td rowspan="2">Gộp</td><td>a</td></tr><tr><td>b</td></tr></table>
<img src="so-do.png" alt="Sơ đồ thẩm định">
<script>var x = 1;</script>
</body></html>"""


def test_html_bo_khung_trang_va_giu_bang() -> None:
    ex = extract_html.extract(HTML, is_path=False)
    md = "\n".join(ex.lines)
    assert "Trang chủ" not in md and "var x" not in md
    assert "## Chương I. QUY ĐỊNH CHUNG" in md
    assert "| STT | Hạng mục |" in md
    assert "<table>" in md and 'rowspan="2"' in md
    assert "![Sơ đồ thẩm định](so-do.png)" in md
    assert ex.title == "Nghị định 45/2026"


def test_html_noi_cau_bi_ngat_giua_hai_the_p() -> None:
    ex = extract_html.extract(HTML, is_path=False)
    pages = extract_html.to_pages(ex)
    # dòng HTML đã là đoạn, nhưng câu bị cắt vẫn phải nối lại được bằng bộ ghép
    md = stitch_pages([type(pages[0])(1, pages[0].lines, wrapped=True)]).markdown
    assert "nguồn vốn ngân sách nhà nước." in md


def test_pdf_text_layer_tra_ve_dung_so_trang(fixture_pdf: Path) -> None:
    ex = extract_pdf_text.extract(fixture_pdf)
    assert ex.page_count == 5
    assert len(ex.pages) == 5
    assert ex.source_chars > 1500


def test_pdf_loai_header_lap_va_so_trang(fixture_pdf: Path) -> None:
    ex = extract_pdf_text.extract(fixture_pdf)
    text = "\n".join(ln for page in ex.pages for ln in page.lines)
    assert "CÔNG BÁO" not in text
    assert any("running_block" in d for d in ex.dropped)


def test_pdf_giu_header_khi_duoc_yeu_cau(fixture_pdf: Path) -> None:
    ex = extract_pdf_text.extract(fixture_pdf, drop_running=False)
    text = "\n".join(ln for page in ex.pages for ln in page.lines)
    assert "CÔNG BÁO" in text


def test_pdf_bang_duoc_trich_dang_gfm(fixture_pdf: Path) -> None:
    ex = extract_pdf_text.extract(fixture_pdf)
    text = "\n".join(ln for page in ex.pages for ln in page.lines)
    assert "| STT | Hạng mục công việc | Đơn vị tính | Định mức |" in text


def test_pdf_page_heights(fixture_pdf: Path) -> None:
    heights = extract_pdf_text.page_heights(fixture_pdf)
    assert set(heights) == {1, 2, 3, 4, 5}
    assert all(abs(h - 842.0) < 1 for h in heights.values())
