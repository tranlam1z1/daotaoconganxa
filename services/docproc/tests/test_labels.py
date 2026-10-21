"""Kiểm thử quy tắc nhãn và đánh số VBQPPL (ke-hoach/01 §5)."""

from __future__ import annotations

import pytest

from docproc import labels


def test_diem_alphabet_khong_co_f_j_w_z() -> None:
    for ch in "fjwz":
        assert ch not in labels.DIEM_ALPHABET
    assert labels.DIEM_ALPHABET.startswith("abcdđeg")


@pytest.mark.parametrize(
    "letter,expected",
    [("a", "b"), ("c", "d"), ("d", "đ"), ("đ", "e"), ("e", "g"), ("g", "h"), ("y", None)],
)
def test_next_diem(letter: str, expected: str | None) -> None:
    assert labels.next_diem(letter) == expected


@pytest.mark.parametrize(
    "line,kind",
    [
        ("Phần thứ nhất", "phan"),
        ("Chương I. QUY ĐỊNH CHUNG", "chuong"),
        ("Mục 2. THẨM ĐỊNH", "muc"),
        ("Tiểu mục 1. HỒ SƠ", "tieu_muc"),
        ("Điều 15. Trách nhiệm", "dieu"),
        ("Điều 12a. Bổ sung", "dieu"),
        ("2. Chủ đầu tư có trách nhiệm", "khoan"),
        ("2a. Khoản bổ sung", "khoan"),
        ("đ) Nội dung khác", "diem"),
        ("đ1) Nội dung bổ sung", "diem"),
        ("Căn cứ Luật Tổ chức Chính phủ;", "can_cu"),
        ("- Lưu: VT.", "gach_dau_dong"),
        ("Nghị định này quy định", None),
    ],
)
def test_label_kind(line: str, kind: str | None) -> None:
    assert labels.label_kind(line) == kind


def test_label_kind_bo_qua_markup_markdown() -> None:
    assert labels.label_kind("### **Điều 7. Nguyên tắc**") == "dieu"
    assert labels.parse_dieu_no("### Điều 7. Nguyên tắc") == "7"


@pytest.mark.parametrize(
    "text,expected",
    [
        ("nguồn vốn", False),
        ("nguồn vốn.", True),
        ("theo quy định;", True),
        ("như sau:", True),
        ('trích dẫn."', True),
        ("(xem Điều 5)", False),
    ],
)
def test_is_sentence_end(text: str, expected: bool) -> None:
    assert labels.is_sentence_end(text) is expected


def test_roman_to_int() -> None:
    assert labels.roman_to_int("IV") == 4
    assert labels.roman_to_int("XII") == 12
    assert labels.roman_to_int("ABC") is None


def test_describe_node_theo_chuan_vien_dan() -> None:
    assert labels.describe_node("15", "2", "a") == "điểm a khoản 2 Điều 15"
    assert labels.describe_node("15", None, None) == "Điều 15"
    assert labels.describe_node(None, "2", "a") is None
