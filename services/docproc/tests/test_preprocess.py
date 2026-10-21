"""Kiểm thử tiền xử lý ảnh trang (ke-hoach/05 §2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from docproc.preprocess import (
    binarize,
    denoise,
    deskew,
    detect_running_blocks,
    estimate_skew,
    preprocess_pdf,
    render_pages,
    split_double_page,
)
from docproc.types import LayoutBlock


def test_render_pages_300_dpi(fixture_pdf: Path, tmp_path: Path) -> None:
    images = render_pages(fixture_pdf, tmp_path, dpi=300, pages=[1, 2])
    assert [i.page_no for i in images] == [1, 2]
    assert all(i.path.exists() for i in images)
    # A4 rộng 595 pt -> 595/72*300 ≈ 2479 px
    assert 2400 < images[0].width < 2560
    assert images[0].dpi == 300


def _skewed_page(tmp_path: Path, angle: float) -> Path:
    from PIL import Image, ImageDraw

    img = Image.new("L", (800, 600), color=255)
    draw = ImageDraw.Draw(img)
    for y in range(80, 520, 30):
        draw.rectangle([80, y, 700, y + 10], fill=0)   # giả lập các dòng chữ
    rotated = img.rotate(-angle, fillcolor=255, expand=False)
    path = tmp_path / f"skew{angle}.png"
    rotated.save(path)
    return path


def test_estimate_skew_nhan_ra_goc_nghieng(tmp_path: Path) -> None:
    assert abs(estimate_skew(_skewed_page(tmp_path, 0.0))) < 0.5
    detected = estimate_skew(_skewed_page(tmp_path, 2.0))
    assert 1.0 < detected < 3.0, f"góc đo được {detected}"


def test_deskew_ghi_ra_anh_da_xoay(tmp_path: Path) -> None:
    src = _skewed_page(tmp_path, 2.0)
    dst, angle = deskew(src, tmp_path / "fixed.png")
    assert dst.exists() and angle > 0.5
    assert abs(estimate_skew(dst)) < abs(angle)


def test_denoise_va_binarize_chay_duoc(tmp_path: Path) -> None:
    from PIL import Image

    src = _skewed_page(tmp_path, 0.0)
    out = denoise(src, tmp_path / "clean.png")
    assert out.exists()
    binary = binarize(out, tmp_path / "bw.png", block=32)
    with Image.open(binary) as img:
        assert set(img.convert("L").getdata()) <= {0, 255}


def test_split_double_page(tmp_path: Path) -> None:
    from PIL import Image

    wide = Image.new("L", (1600, 900), color=255)
    wide.save(tmp_path / "double.png")
    parts = split_double_page(tmp_path / "double.png", tmp_path / "split")
    assert len(parts) == 2 and all(p.exists() for p in parts)
    # ảnh dọc bình thường thì không tách
    Image.new("L", (600, 900), color=255).save(tmp_path / "single.png")
    assert len(split_double_page(tmp_path / "single.png", tmp_path / "split")) == 1


def test_preprocess_pdf_day_du(fixture_pdf: Path, tmp_path: Path) -> None:
    result = preprocess_pdf(fixture_pdf, tmp_path / "pages", dpi=120)
    assert len(result.images) == 5
    assert set(result.skews) == {1, 2, 3, 4, 5}
    assert all(abs(a) < 1.0 for a in result.skews.values()), "trang thẳng không được xoay nhiều"


def test_detect_running_blocks_theo_vi_tri_va_tan_suat() -> None:
    height = 842.0
    blocks: list[LayoutBlock] = []
    for page in range(1, 6):
        blocks.append(LayoutBlock("paragraph", page, (60, 40, 500, 55), "CÔNG BÁO/Số 123 + 124"))
        blocks.append(LayoutBlock("paragraph", page, (60, 300, 500, 320), f"Điều {page}. Nội dung."))
        blocks.append(LayoutBlock("paragraph", page, (290, 800, 310, 815), str(page)))
    heights = {p: height for p in range(1, 6)}
    drop = detect_running_blocks(blocks, heights)
    dropped_texts = {blocks[i].text for i in drop}
    assert "CÔNG BÁO/Số 123 + 124" in dropped_texts
    assert {"1", "2", "3", "4", "5"} <= dropped_texts
    assert not any(t.startswith("Điều") for t in dropped_texts)


def test_detect_running_blocks_giu_khoi_chu_ky() -> None:
    heights = {p: 842.0 for p in range(1, 6)}
    blocks: list[LayoutBlock] = []
    for page in range(1, 6):
        blocks.append(LayoutBlock("paragraph", page, (60, 780, 500, 830), "Nơi nhận:\n- Lưu: VT."))
    assert detect_running_blocks(blocks, heights) == set()
