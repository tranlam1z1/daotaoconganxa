"""Kiểm chứng tự động sau chuyển đổi (ke-hoach/05 §5).

Chấm điểm chất lượng 0..1 và sinh danh sách cảnh báo. Điểm được ghi vào
`document_versions.quality`; dưới ngưỡng thì đưa vào `review_queue`.
"""

from __future__ import annotations

import difflib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Iterable

from .formula import latex_parses
from .labels import (
    DIEM_ALPHABET,
    is_table_row,
    label_kind,
    next_diem,
    parse_dieu_no,
    parse_diem_no,
    parse_khoan_no,
    strip_markup,
)
from .stitch import is_table_separator, parse_table

# Trọng số các phép kiểm (tổng = 1.0).
WEIGHTS: dict[str, float] = {
    "dieu_continuity": 0.22,
    "khoan_continuity": 0.13,
    "diem_continuity": 0.13,
    "length_match": 0.14,
    "tables": 0.12,
    "formulas": 0.08,
    "vocabulary": 0.10,
    "signature": 0.08,
}

LENGTH_TOLERANCE = 0.08          # ±8% theo §5
UNKNOWN_WORD_LIMIT = 0.005       # 0,5% theo §5
REFERENCE_SIMILARITY = 0.985     # ≥0,985 theo §5

_VOWELS = "aăâeêioôơuưy"
_ONSETS = (
    "ngh|ng|nh|gh|gi|ch|kh|ph|th|tr|qu|"
    "b|c|d|đ|g|h|k|l|m|n|p|q|r|s|t|v|x"
)
_CODAS = "ch|ng|nh|c|m|n|p|t|i|o|u|y"
_RE_SYLLABLE = re.compile(rf"^(?:{_ONSETS})?[{_VOWELS}]{{1,3}}(?:{_CODAS})?$")
_TONE_MARKS = {0x0300, 0x0301, 0x0303, 0x0309, 0x0323}
# Chữ cái không dùng trong tiếng Việt — xuất hiện trong từ thường là lỗi OCR.
_FOREIGN_LETTERS = set("fjwz")
_RE_TOKEN = re.compile(r"[0-9A-Za-zÀ-ỹĐđ]+", re.UNICODE)
_RE_NODE_MARKER = re.compile(r"<!--.*?-->", re.DOTALL)
_RE_LATEX = re.compile(r"\$\$(.+?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)", re.DOTALL)
_RE_NOI_NHAN = re.compile(r"^\s*Nơi\s+nhận\s*:", re.IGNORECASE | re.MULTILINE)
_RE_SIGNER_ROLE = re.compile(
    r"\b(TM\.|KT\.|TL\.|CHỦ TỊCH|THỦ TƯỚNG|BỘ TRƯỞNG|THỨ TRƯỞNG|CHÁNH ÁN|VIỆN TRƯỞNG)",
)

# Thuật ngữ/viết tắt pháp lý hợp lệ tuy không phải âm tiết thuần Việt.
LEGAL_ALLOWLIST: set[str] = {
    "qppl", "vbqppl", "vbhn", "ubnd", "hdnd", "hđnd", "ubtvqh", "qh", "cp", "ttg",
    "nđ", "nd", "tt", "qđ", "nq", "pl", "tandtc", "vksndtc", "tcvn", "qcvn",
    "iso", "gdp", "cpi", "ict", "it", "web", "internet", "email", "website",
    "km", "kg", "kw", "kwh", "m2", "m3", "vnđ", "usd", "pdf", "docx", "html",
}


@dataclass
class Check:
    name: str
    ok: bool
    detail: str
    value: Any = None


@dataclass
class VerifyResult:
    score: float
    checks: list[Check] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    @property
    def needs_review(self) -> bool:
        return self.score < 0.95 or bool(self.warnings)

    def to_json(self) -> dict[str, Any]:
        return {
            "score": round(self.score, 4),
            "needs_review": self.needs_review,
            "warnings": self.warnings,
            "stats": self.stats,
            "checks": [{"name": c.name, "ok": c.ok, "detail": c.detail} for c in self.checks],
        }


# --- tiện ích --------------------------------------------------------------


def strip_tones(text: str) -> str:
    """Bỏ **dấu thanh** nhưng giữ chữ cái riêng (ă, â, ê, ô, ơ, ư, đ)."""
    decomposed = unicodedata.normalize("NFD", text)
    kept = "".join(ch for ch in decomposed if ord(ch) not in _TONE_MARKS)
    return unicodedata.normalize("NFC", kept)


def is_vietnamese_syllable(token: str) -> bool:
    """Token có phải một âm tiết tiếng Việt hợp lệ về mặt cấu trúc không."""
    base = strip_tones(token.lower())
    if not base or any(ch in _FOREIGN_LETTERS for ch in base):
        return False
    return bool(_RE_SYLLABLE.match(base))


def nonspace_len(text: str) -> str | int:
    """Đếm ký tự không phải khoảng trắng — mốc chung cho phép đối chiếu độ dài."""
    return len(re.sub(r"\s+", "", text))


_RE_FRONT_MATTER = re.compile(r"\A---\n.*?\n---\n", re.DOTALL)


def plain_text(markdown: str) -> str:
    """Bỏ front matter, marker nút, công thức LaTeX và ký hiệu Markdown.

    Front matter và LaTeX không phải nội dung pháp lý nên không được tính vào
    phép đối chiếu độ dài lẫn phép đếm "từ lạ".
    """
    text = _RE_FRONT_MATTER.sub("", markdown)
    text = _RE_LATEX.sub(" ", text)
    text = re.sub(r"asset://[0-9a-f]+", " ", text)
    text = _RE_NODE_MARKER.sub("", text)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_`]", "", text)
    return text


# --- các phép kiểm ---------------------------------------------------------


def check_dieu_continuity(markdown: str) -> Check:
    """Điều 1..n liên tục, không trùng, không thiếu (chấp nhận Điều 12a bổ sung)."""
    numbers: list[str] = []
    for line in markdown.splitlines():
        if label_kind(line) == "dieu":
            no = parse_dieu_no(line)
            if no:
                numbers.append(no)
    if not numbers:
        return Check("dieu_continuity", True, "văn bản không có điều (phụ lục/biểu mẫu)", [])

    problems: list[str] = []
    seen: set[str] = set()
    prev_base = 0
    for raw in numbers:
        if raw in seen:
            problems.append(f"Điều {raw} bị lặp")
        seen.add(raw)
        m = re.match(r"^(\d+)([a-zđ]?)$", raw)
        if not m:
            problems.append(f"số điều không hợp lệ: {raw}")
            continue
        base, suffix = int(m.group(1)), m.group(2)
        if suffix:
            if base != prev_base:
                problems.append(f"Điều {raw} bổ sung nhưng không đứng sau Điều {base}")
            continue
        if prev_base and base != prev_base + 1:
            missing = list(range(prev_base + 1, base))
            if missing:
                problems.append("thiếu Điều " + ", ".join(str(x) for x in missing))
            else:
                problems.append(f"Điều {base} không liên tục sau Điều {prev_base}")
        prev_base = base
    detail = "liên tục" if not problems else "; ".join(problems)
    return Check("dieu_continuity", not problems, detail, numbers)


def _grouped_labels(markdown: str) -> list[tuple[str | None, list[tuple[str, list[str]]]]]:
    """Gom cấu trúc: [(số điều, [(số khoản, [chữ cái điểm…])…])…]."""
    out: list[tuple[str | None, list[tuple[str, list[str]]]]] = []
    cur_dieu: list[tuple[str, list[str]]] = []
    dieu_no: str | None = None
    khoan_no: str | None = None
    for line in markdown.splitlines():
        kind = label_kind(line)
        if is_table_row(line):
            continue
        if kind == "dieu":
            if dieu_no is not None or cur_dieu:
                out.append((dieu_no, cur_dieu))
            dieu_no, cur_dieu, khoan_no = parse_dieu_no(line), [], None
        elif kind == "khoan":
            khoan_no = parse_khoan_no(line)
            if khoan_no:
                cur_dieu.append((khoan_no, []))
        elif kind == "diem":
            diem = parse_diem_no(line)
            if diem and cur_dieu:
                cur_dieu[-1][1].append(diem)
    if dieu_no is not None or cur_dieu:
        out.append((dieu_no, cur_dieu))
    return out


def check_khoan_continuity(markdown: str) -> Check:
    problems: list[str] = []
    total = 0
    for dieu_no, khoans in _grouped_labels(markdown):
        prev = 0
        for raw, _ in khoans:
            total += 1
            m = re.match(r"^(\d+)([a-zđ]?)$", raw)
            if not m:
                problems.append(f"Điều {dieu_no}: khoản '{raw}' không hợp lệ")
                continue
            base, suffix = int(m.group(1)), m.group(2)
            if suffix:
                continue
            if prev and base != prev + 1:
                problems.append(f"Điều {dieu_no}: khoản {base} không liên tục sau khoản {prev}")
            prev = base
    detail = "liên tục" if not problems else "; ".join(problems)
    return Check("khoan_continuity", not problems, detail, total)


def check_diem_continuity(markdown: str) -> Check:
    """Điểm phải theo a, b, c, d, đ, e, g… (không có f, j, w, z)."""
    problems: list[str] = []
    total = 0
    for dieu_no, khoans in _grouped_labels(markdown):
        for khoan_no, diems in khoans:
            prev: str | None = None
            for raw in diems:
                total += 1
                letter = raw[0]
                if letter not in DIEM_ALPHABET:
                    problems.append(
                        f"Điều {dieu_no} khoản {khoan_no}: điểm '{raw}' dùng chữ cái ngoài bảng pháp lý"
                    )
                    continue
                if len(raw) > 1:  # điểm bổ sung dạng đ1
                    continue
                if prev is None:
                    if letter != "a":
                        problems.append(
                            f"Điều {dieu_no} khoản {khoan_no}: điểm đầu là '{letter}', không phải 'a'"
                        )
                elif next_diem(prev) != letter:
                    problems.append(
                        f"Điều {dieu_no} khoản {khoan_no}: sau điểm {prev} phải là "
                        f"{next_diem(prev)}, gặp {letter}"
                    )
                prev = letter
    detail = "liên tục" if not problems else "; ".join(problems)
    return Check("diem_continuity", not problems, detail, total)


def check_length(markdown: str, source_chars: int | None) -> Check:
    """Đối chiếu độ dài Markdown với tổng ký tự trích được (±8%)."""
    if not source_chars:
        return Check("length_match", True, "không có mốc độ dài để đối chiếu", None)
    n = nonspace_len(plain_text(markdown))
    base = source_chars
    ratio = n / max(1, base)
    ok = abs(ratio - 1.0) <= LENGTH_TOLERANCE
    return Check(
        "length_match",
        ok,
        f"Markdown {n} ký tự / nguồn {base} ký tự (tỷ lệ {ratio:.3f}, ngưỡng ±{LENGTH_TOLERANCE:.0%})",
        round(ratio, 4),
    )


def collect_tables(markdown: str) -> list[tuple[int, int]]:
    """Trả [(số hàng dữ liệu, số cột)] của mọi bảng GFM trong Markdown."""
    lines = markdown.splitlines()
    out: list[tuple[int, int]] = []
    i = 0
    while i < len(lines):
        if is_table_row(lines[i]):
            table, nxt = parse_table(lines, i)
            out.append((table.n_rows, table.cols))
            i = nxt
        else:
            i += 1
    # bảng HTML (gộp ô)
    for block in re.findall(r"<table>.*?</table>", markdown, re.DOTALL):
        rows = re.findall(r"<tr>", block)
        cols = max((len(re.findall(r"<t[hd][ >]", r)) for r in block.split("<tr>")), default=0)
        out.append((max(0, len(rows) - 1), cols))
    return out


def check_tables(markdown: str, expected: list[tuple[int, int]] | None) -> Check:
    """Số bảng và số hàng/cột khớp với layout engine ±1 (§5)."""
    found = collect_tables(markdown)
    if expected is None:
        return Check("tables", True, f"tìm thấy {len(found)} bảng (không có mốc đối chiếu)", found)
    if len(found) != len(expected):
        return Check(
            "tables", False,
            f"số bảng lệch: Markdown {len(found)}, layout {len(expected)}", found,
        )
    problems = [
        f"bảng {i+1}: {f[0]}x{f[1]} vs layout {e[0]}x{e[1]}"
        for i, (f, e) in enumerate(zip(found, expected))
        if abs(f[0] - e[0]) > 1 or abs(f[1] - e[1]) > 1
    ]
    detail = f"{len(found)} bảng khớp layout" if not problems else "; ".join(problems)
    return Check("tables", not problems, detail, found)


def check_formulas(markdown: str) -> Check:
    """Mọi công thức LaTeX phải parse được."""
    formulas = [m.group(0) for m in _RE_LATEX.finditer(markdown)]
    bad: list[str] = []
    for f in formulas:
        ok, err = latex_parses(f)
        if not ok:
            bad.append(f"{f[:40]}… ({err})")
    detail = f"{len(formulas)} công thức parse được" if not bad else "; ".join(bad)
    return Check("formulas", not bad, detail, len(formulas))


def unknown_words(markdown: str, allowlist: Iterable[str] | None = None) -> tuple[list[str], float]:
    """Trả (danh sách từ lạ, tỷ lệ) — nghi lỗi OCR khi tỷ lệ > 0,5%."""
    allow = set(LEGAL_ALLOWLIST) | {w.lower() for w in (allowlist or ())}
    text = plain_text(markdown)
    tokens = [t for t in _RE_TOKEN.findall(text)]
    checked: list[str] = []
    bad: list[str] = []
    for tok in tokens:
        if any(ch.isdigit() for ch in tok):
            continue
        if len(tok) < 2:
            continue
        if tok.isupper():          # viết tắt: NĐ-CP, UBND…
            continue
        low = tok.lower()
        if low in allow:
            continue
        checked.append(tok)
        if not is_vietnamese_syllable(tok):
            bad.append(tok)
    ratio = len(bad) / max(1, len(checked))
    return bad, ratio


def check_vocabulary(markdown: str, allowlist: Iterable[str] | None = None) -> Check:
    bad, ratio = unknown_words(markdown, allowlist)
    ok = ratio <= UNKNOWN_WORD_LIMIT
    sample = ", ".join(sorted(set(bad))[:10])
    detail = f"tỷ lệ từ lạ {ratio:.3%} (ngưỡng {UNKNOWN_WORD_LIMIT:.1%})"
    if sample:
        detail += f"; ví dụ: {sample}"
    return Check("vocabulary", ok, detail, round(ratio, 5))


def check_signature(markdown: str, signer: str | None = None) -> Check:
    """Phải còn khối "Nơi nhận"/chữ ký; nếu có metadata thì tên người ký phải khớp."""
    has_noi_nhan = bool(_RE_NOI_NHAN.search(markdown))
    has_role = bool(_RE_SIGNER_ROLE.search(markdown))
    if not (has_noi_nhan or has_role):
        return Check("signature", False, "không tìm thấy khối 'Nơi nhận'/chữ ký cuối văn bản", False)
    if signer:
        norm = lambda s: re.sub(r"\s+", " ", strip_tones(s).lower()).strip()
        if norm(signer) not in norm(markdown):
            return Check("signature", False, f"không thấy tên người ký '{signer}' trong văn bản", False)
    return Check("signature", True, "có khối chữ ký/nơi nhận", True)


def check_reference(markdown: str, reference: str | None) -> Check | None:
    """So sánh mức ký tự với bản tham chiếu (HTML vbpl.vn / DOCX Công báo)."""
    if reference is None:
        return None
    a = re.sub(r"\s+", " ", plain_text(markdown)).strip()
    b = re.sub(r"\s+", " ", plain_text(reference)).strip()
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    ok = ratio >= REFERENCE_SIMILARITY
    return Check(
        "reference_similarity", ok,
        f"tương đồng {ratio:.4f} với bản tham chiếu (ngưỡng {REFERENCE_SIMILARITY})",
        round(ratio, 4),
    )


# --- điểm tổng hợp ---------------------------------------------------------


def verify(
    markdown: str,
    *,
    source_chars: int | None = None,
    expected_tables: list[tuple[int, int]] | None = None,
    signer: str | None = None,
    reference: str | None = None,
    allowlist: Iterable[str] | None = None,
) -> VerifyResult:
    """Chạy toàn bộ phép kiểm và tính điểm chất lượng 0..1."""
    checks = [
        check_dieu_continuity(markdown),
        check_khoan_continuity(markdown),
        check_diem_continuity(markdown),
        check_length(markdown, source_chars),
        check_tables(markdown, expected_tables),
        check_formulas(markdown),
        check_vocabulary(markdown, allowlist),
        check_signature(markdown, signer),
    ]
    ref = check_reference(markdown, reference)
    score = sum(WEIGHTS[c.name] for c in checks if c.ok)
    if ref is not None:
        checks.append(ref)
        # bản tham chiếu là phép kiểm bổ sung: sai thì trừ 20% điểm
        if not ref.ok:
            score *= 0.8
    warnings = [f"{c.name}: {c.detail}" for c in checks if not c.ok]
    stats = {
        "chars": len(plain_text(markdown)),
        "tables": len(collect_tables(markdown)),
        "formulas": len(_RE_LATEX.findall(markdown)),
        "dieu": len(check_dieu_continuity(markdown).value or []),
    }
    return VerifyResult(score=round(score, 4), checks=checks, warnings=warnings, stats=stats)
