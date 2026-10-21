"""Nhãn, quy tắc đánh số và bố cục VBQPPL Việt Nam (ke-hoach/01 §5).

Module thuần Python, không phụ thuộc thư viện ngoài — dùng chung cho bộ ghép
(stitch), bộ kiểm chứng (verify) và bộ dựng Markdown.
"""

from __future__ import annotations

import re
import unicodedata

# Chữ cái đánh điểm trong VBQPPL: KHÔNG dùng f, j, w, z.
DIEM_ALPHABET: str = "abcdđeghiklmnopqrstuvxy"

# Dấu kết thúc câu/mệnh đề — dòng kết thúc bằng các dấu này thì KHÔNG nối sang trang sau.
SENTENCE_END_CHARS: str = ".;:!?…"

_RE_HEADING_HASH = re.compile(r"^\s*#{1,6}\s*")
_RE_NODE_MARKER = re.compile(r"^\s*<!--\s*node:")
_RE_EMPHASIS = re.compile(r"^[*_]{1,3}|[*_]{1,3}$")

RE_PHAN = re.compile(r"^Phần\s+(thứ\s+\S+|[IVXLCDM]+|\d+)\b", re.IGNORECASE)
RE_CHUONG = re.compile(r"^Chương\s+([IVXLCDM]+|\d+)\b", re.IGNORECASE)
RE_MUC = re.compile(r"^Mục\s+(\d+)\b", re.IGNORECASE)
RE_TIEU_MUC = re.compile(r"^Tiểu\s+mục\s+(\d+)\b", re.IGNORECASE)
# "Điều 15." / "Điều 12a." / "Điều 3" (có văn bản bỏ dấu chấm)
RE_DIEU = re.compile(r"^Điều\s+(\d+[a-zđ]?)\s*[.:]?\s*", re.IGNORECASE)
# Khoản: "1. ", "2a. " ở đầu dòng.
RE_KHOAN = re.compile(r"^(\d+[a-zđ]?)\.\s+")
# Điểm: "a) ", "đ) ", "đ1) " ở đầu dòng.
RE_DIEM = re.compile(rf"^([{DIEM_ALPHABET}]\d?)\)\s+")
RE_PHU_LUC = re.compile(r"^PHỤ\s+LỤC\b", re.IGNORECASE)
RE_GACH_DAU_DONG = re.compile(r"^[-–—+•]\s+")
RE_CAN_CU = re.compile(r"^Căn\s+cứ\b", re.IGNORECASE)

_ROMAN_MAP = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def strip_markup(line: str) -> str:
    """Bỏ dấu heading Markdown, marker nút và dấu nhấn để lộ nhãn thật."""
    s = line.strip()
    s = _RE_HEADING_HASH.sub("", s)
    s = s.strip()
    # bỏ **...** hoặc *...* bao quanh
    while True:
        stripped = re.sub(r"^(\*\*|__|\*|_)(.*?)(\*\*|__|\*|_)$", r"\2", s)
        if stripped == s:
            break
        s = stripped.strip()
    return s.strip()


def is_node_marker(line: str) -> bool:
    """Dòng marker `<!-- node: ... -->` của định dạng chuẩn nội bộ."""
    return bool(_RE_NODE_MARKER.match(line))


def is_table_row(line: str) -> bool:
    return line.lstrip().startswith("|")


def is_table_separator(line: str) -> bool:
    s = line.strip()
    if not s.startswith("|"):
        return False
    return bool(re.fullmatch(r"\|(?:\s*:?-{2,}:?\s*\|)+", s))


def is_heading(line: str) -> bool:
    return bool(_RE_HEADING_HASH.match(line))


def label_kind(line: str) -> str | None:
    """Trả về loại nhãn mở đầu dòng, hoặc None nếu dòng là văn bản thường."""
    s = strip_markup(line)
    if not s:
        return None
    if RE_PHU_LUC.match(s):
        return "phu_luc"
    if RE_PHAN.match(s):
        return "phan"
    if RE_CHUONG.match(s):
        return "chuong"
    if RE_TIEU_MUC.match(s):
        return "tieu_muc"
    if RE_MUC.match(s):
        return "muc"
    if RE_DIEU.match(s):
        return "dieu"
    if RE_KHOAN.match(s):
        return "khoan"
    if RE_DIEM.match(s):
        return "diem"
    if RE_CAN_CU.match(s):
        return "can_cu"
    if RE_GACH_DAU_DONG.match(s):
        return "gach_dau_dong"
    return None


def is_label_start(line: str) -> bool:
    """Dòng có mở đầu bằng nhãn cấu trúc (Điều/Chương/số./chữ cái)) không.

    Đây là vế thứ hai của quy tắc nối đoạn qua trang (ke-hoach/05 §4.2 quy tắc 1):
    dòng đầu trang sau là nhãn -> KHÔNG nối vào đoạn của trang trước.
    """
    if is_heading(line) or is_node_marker(line) or is_table_row(line):
        return True
    return label_kind(line) is not None


def is_sentence_end(text: str) -> bool:
    """Đoạn/dòng đã kết thúc câu chưa (dấu . ; : ! ? …, cho phép đóng ngoặc/nháy)."""
    s = text.rstrip()
    if not s:
        return True
    # bỏ các ký tự đóng ở cuối để nhìn dấu câu thật
    while s and s[-1] in ')]}»”"\'':
        s = s[:-1].rstrip()
    if not s:
        return True
    return s[-1] in SENTENCE_END_CHARS


def starts_lowercase(text: str) -> bool:
    """Dòng bắt đầu bằng chữ thường (dấu hiệu câu bị cắt giữa chừng)."""
    s = text.lstrip()
    if not s:
        return False
    ch = s[0]
    return ch.isalpha() and ch.islower()


def roman_to_int(s: str) -> int | None:
    """Chuyển số La Mã (Chương I, II…) sang số nguyên; None nếu không hợp lệ."""
    s = s.strip().upper()
    if not s or any(c not in _ROMAN_MAP for c in s):
        return None
    total = 0
    prev = 0
    for ch in reversed(s):
        val = _ROMAN_MAP[ch]
        total = total - val if val < prev else total + val
        prev = max(prev, val)
    return total


def next_diem(letter: str) -> str | None:
    """Chữ cái điểm kế tiếp theo bảng chữ cái pháp lý (a,b,c,d,đ,e,g…)."""
    base = letter[0]
    idx = DIEM_ALPHABET.find(base)
    if idx < 0 or idx + 1 >= len(DIEM_ALPHABET):
        return None
    return DIEM_ALPHABET[idx + 1]


def parse_dieu_no(line: str) -> str | None:
    """Lấy số điều ("15", "12a") từ một dòng bắt đầu bằng "Điều …"."""
    m = RE_DIEU.match(strip_markup(line))
    return m.group(1) if m else None


def parse_khoan_no(line: str) -> str | None:
    m = RE_KHOAN.match(strip_markup(line))
    return m.group(1) if m else None


def parse_diem_no(line: str) -> str | None:
    m = RE_DIEM.match(strip_markup(line))
    return m.group(1) if m else None


def slugify_label(kind: str, number: str) -> str:
    """Sinh mảnh `node_path` cho marker: ("dieu", "15") -> "dieu-15"."""
    num = number.strip().lower().replace(" ", "")
    num = unicodedata.normalize("NFC", num)
    return f"{kind}-{num}"


def describe_node(dieu: str | None, khoan: str | None, diem: str | None) -> str | None:
    """Mô tả nút theo chuẩn viện dẫn: "điểm a khoản 2 Điều 15"."""
    if not dieu:
        return None
    parts: list[str] = []
    if diem:
        parts.append(f"điểm {diem}")
    if khoan:
        parts.append(f"khoản {khoan}")
    parts.append(f"Điều {dieu}")
    return " ".join(parts)
