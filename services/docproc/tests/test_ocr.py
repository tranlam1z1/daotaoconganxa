"""Kiểm thử lớp OCR và bỏ phiếu mức dòng (ke-hoach/05 §3).

Tesseract/PaddleOCR chưa được cài trong môi trường này nên các bài kiểm thử cần
engine thật được bỏ qua có điều kiện; phần logic thuần (parse TSV, voting) vẫn
được kiểm thử đầy đủ.
"""

from __future__ import annotations

import pytest

from docproc.ocr import (
    PaddleOcrEngine,
    TesseractEngine,
    available_engines,
    mean_confidence,
    parse_tesseract_tsv,
    recognize_page,
    vote_lines,
)
from docproc.types import OcrLine

TSV = "\t".join(
    ["level", "page_num", "block_num", "par_num", "line_num", "word_num",
     "left", "top", "width", "height", "conf", "text"]
) + "\n" + "\n".join([
    "\t".join(["5", "1", "1", "1", "1", "1", "60", "100", "40", "14", "96", "Điều"]),
    "\t".join(["5", "1", "1", "1", "1", "2", "105", "100", "20", "14", "94", "1."]),
    "\t".join(["5", "1", "1", "1", "1", "3", "130", "100", "60", "14", "90", "Phạm"]),
    "\t".join(["5", "1", "1", "1", "2", "1", "60", "120", "80", "14", "88", "Nghị"]),
    "\t".join(["5", "1", "1", "1", "2", "2", "145", "120", "50", "14", "86", "định"]),
    "\t".join(["4", "1", "1", "1", "2", "0", "0", "0", "0", "0", "-1", ""]),
])


def test_parse_tesseract_tsv_gom_tu_thanh_dong() -> None:
    lines = parse_tesseract_tsv(TSV)
    assert [l.text for l in lines] == ["Điều 1. Phạm", "Nghị định"]
    assert lines[0].bbox == (60.0, 100.0, 190.0, 114.0)
    assert 0.9 < lines[0].confidence < 0.95
    assert lines[0].engine == "tesseract"


def test_parse_tesseract_tsv_thieu_cot_thi_bao_loi() -> None:
    with pytest.raises(ValueError):
        parse_tesseract_tsv("a\tb\n1\t2")


def test_mean_confidence() -> None:
    assert mean_confidence([]) == 0.0
    lines = parse_tesseract_tsv(TSV)
    assert 0.85 < mean_confidence(lines) < 0.95


def _line(text: str, y: float, conf: float, engine: str) -> OcrLine:
    return OcrLine(text=text, bbox=(10.0, y, 200.0, y + 14.0), confidence=conf, engine=engine)


def test_vote_lines_da_so_thang() -> None:
    a = [_line("Điều 1. Phạm vi", 100, 0.80, "paddleocr")]
    b = [_line("Điều 1. Phạm vi", 101, 0.70, "tesseract")]
    c = [_line("Điều l. Phạm vi", 100, 0.99, "other")]
    voted = vote_lines([a, b, c])
    assert len(voted) == 1
    assert voted[0].text == "Điều 1. Phạm vi"
    assert "paddleocr" in voted[0].engine and "tesseract" in voted[0].engine


def test_vote_lines_hoa_phieu_lay_confidence_cao_nhat() -> None:
    a = [_line("Điều 1", 100, 0.60, "paddleocr")]
    b = [_line("Điều I", 100, 0.95, "tesseract")]
    voted = vote_lines([a, b])
    assert voted[0].text == "Điều I"


def test_vote_lines_mot_engine_thi_giu_nguyen() -> None:
    a = [_line("Điều 1", 100, 0.6, "tesseract")]
    assert vote_lines([a]) == a
    assert vote_lines([]) == []


def test_engine_bao_trang_thai_kha_dung() -> None:
    for engine in (TesseractEngine(), PaddleOcrEngine()):
        assert isinstance(engine.available(), bool)


def test_recognize_page_bao_loi_ro_rang_khi_khong_co_engine(tmp_path) -> None:
    if available_engines():
        pytest.skip("môi trường đã có engine OCR")
    img = tmp_path / "p.png"
    img.write_bytes(b"")
    with pytest.raises(RuntimeError, match="Không có engine OCR"):
        recognize_page(str(img))


@pytest.mark.integration
@pytest.mark.skipif(not TesseractEngine().available(), reason="chưa cài tesseract-ocr")
def test_tesseract_doc_duoc_anh_tieng_viet(tmp_path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    engine = TesseractEngine()
    assert "vie" in engine.languages(), "thiếu gói ngôn ngữ tesseract-ocr-vie"
    img = Image.new("L", (900, 120), color=255)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
    draw.text((20, 30), "Điều 1. Phạm vi điều chỉnh", fill=0, font=font)
    path = tmp_path / "vie.png"
    img.save(path)
    lines = engine.recognize(str(path), "vie")
    assert any("Điều" in l.text for l in lines)


@pytest.mark.integration
@pytest.mark.skipif(not PaddleOcrEngine().available(), reason="chưa cài paddleocr")
def test_paddleocr_kha_dung() -> None:
    assert PaddleOcrEngine().available() is True
