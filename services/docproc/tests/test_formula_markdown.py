"""Kiểm thử công thức và bộ dựng Markdown chuẩn nội bộ (ke-hoach/03 §4, 05 §4.3)."""

from __future__ import annotations

import pytest

from docproc import formula
from docproc.markdown import build_internal_markdown, html_table


def test_nhan_dien_va_chuyen_cong_thuc_sang_latex() -> None:
    src = "G(PM) = Σ (E_i × k_i)"
    assert formula.looks_like_formula(src) is True
    latex = formula.to_latex(src)
    assert latex == "$$ G_{PM} = \\sum (E_{i} \\times k_{i}) $$"
    assert formula.latex_parses(latex) == (True, None)


def test_khong_nham_van_xuoi_la_cong_thuc() -> None:
    assert formula.looks_like_formula("Chủ đầu tư có trách nhiệm bố trí nguồn vốn.") is False
    assert formula.looks_like_formula("Trong đó: G(PM) là chi phí phần mềm nội bộ") is False


@pytest.mark.parametrize(
    "latex,ok",
    [
        ("$$ a = b $$", True),
        ("$$ \\frac{a}{b} $$", True),
        ("$$ a = { b $$", False),
        ("$$ a = b )$$", False),
        ("$$ \\frac{a} $$", False),
        ("$ a = b $", True),
        ("$ a = b", False),
    ],
)
def test_latex_parses(latex: str, ok: bool) -> None:
    assert formula.latex_parses(latex)[0] is ok


def test_dien_giai_cong_thuc_cho_rag() -> None:
    alt = formula.describe("$$ G_{PM} = \\sum (E_{i} \\times k_{i}) $$")
    assert "tổng" in alt and "nhân" in alt


def test_trich_bien_tu_khoi_trong_do() -> None:
    variables = formula.extract_variables([
        "E_i là giá trị hạng mục thứ i;",
        "k_i là hệ số điều chỉnh theo vùng.",
    ])
    assert {v["symbol"] for v in variables} == {"E_i", "k_i"}


BODY = """Chương I. QUY ĐỊNH CHUNG
Điều 1. Phạm vi điều chỉnh
1. Nghị định này quy định về đầu tư.
a) Dự án nhóm A.
b) Dự án nhóm B.
Điều 2. Chi phí
1. Chi phí xác định theo công thức:
G(PM) = Σ (E_i × k_i)
PHỤ LỤC I
| STT | Hạng mục |
| --- | --- |
| 1 | Khảo sát |
Nơi nhận:
- Lưu: VT.
"""


def test_marker_nut_dung_dinh_dang_chuan_noi_bo() -> None:
    result = build_internal_markdown(BODY, {"urn": "vn:vbqppl:nd:45/2026/NĐ-CP", "version": 1})
    md = result.markdown
    assert md.startswith("---\nurn: vn:vbqppl:nd:45/2026/NĐ-CP\nversion: 1\n---")
    assert "<!-- node: chuong-1 -->" in md
    assert "<!-- node: dieu-1 -->" in md
    assert "<!-- node: dieu-1.khoan-1 -->" in md
    assert "<!-- node: dieu-1.khoan-1.diem-a -->" in md
    assert "<!-- node: dieu-1.khoan-1.diem-b -->" in md
    assert "<!-- node: chu-ky -->" in md
    assert "## Chương I. QUY ĐỊNH CHUNG" in md
    assert "### Điều 1. Phạm vi điều chỉnh" in md


def test_asset_cho_bang_va_cong_thuc() -> None:
    result = build_internal_markdown(BODY, {})
    kinds = {a.kind for a in result.assets}
    assert kinds == {"table", "formula"}
    table = next(a for a in result.assets if a.kind == "table")
    assert (table.rows, table.cols) == (1, 2)
    formula_asset = next(a for a in result.assets if a.kind == "formula")
    assert formula_asset.md.startswith("$$") and formula_asset.alt
    assert f"asset: {table.id}" in result.markdown
    assert f"asset: {formula_asset.id}" in result.markdown


def test_asset_id_on_dinh_giua_cac_lan_chay() -> None:
    a = build_internal_markdown(BODY, {}).assets
    b = build_internal_markdown(BODY, {}).assets
    assert [x.id for x in a] == [x.id for x in b]


def test_hinh_duoc_doi_sang_asset_uri() -> None:
    result = build_internal_markdown("![Sơ đồ thẩm định](files/so-do.png)\n", {})
    image = next(a for a in result.assets if a.kind == "image")
    assert f"![Sơ đồ thẩm định](asset://{image.id})" in result.markdown
    assert image.image_uri == "files/so-do.png"


def test_tieu_de_loai_van_ban_va_trich_yeu() -> None:
    body = "NGHỊ ĐỊNH\nQuy định quản lý đầu tư ứng dụng công nghệ thông tin\nĐiều 1. Phạm vi\n"
    md = build_internal_markdown(body, {}).markdown
    assert "# NGHỊ ĐỊNH" in md
    assert "## Quy định quản lý đầu tư ứng dụng công nghệ thông tin" in md


def test_can_cu_duoc_gan_nhan_va_in_nghieng() -> None:
    md = build_internal_markdown("Căn cứ Luật Tổ chức Chính phủ;\nCăn cứ Luật số 64/2025/QH15;\n", {}).markdown
    assert "<!-- node: can-cu -->" in md
    assert md.count("*Căn cứ") == 2


def test_html_table_gop_o() -> None:
    html = html_table([["A", "B"], ["x", "y"]], [[(1, 2), (1, 1)], [(1, 1), (2, 1)]])
    assert 'colspan="2"' in html and 'rowspan="2"' in html
    assert html.startswith("<table>") and html.endswith("</table>")
