"""Nhận diện và chuyển công thức sang LaTeX (ke-hoach/05 §4.3).

Chỉ xử lý các công thức dạng một dòng thường gặp trong phụ lục định mức của
văn bản Việt Nam. Không "đoán" nội dung: ký hiệu nào không nhận ra thì giữ nguyên.
"""

from __future__ import annotations

import re

# Ký hiệu toán -> lệnh LaTeX tương ứng.
SYMBOL_MAP: dict[str, str] = {
    "∑": r"\sum",
    "Σ": r"\sum",
    "∏": r"\prod",
    "√": r"\sqrt",
    "×": r"\times",
    "·": r"\cdot",
    "÷": r"\div",
    "≤": r"\leq",
    "≥": r"\geq",
    "≠": r"\neq",
    "≈": r"\approx",
    "±": r"\pm",
    "∞": r"\infty",
    "α": r"\alpha",
    "β": r"\beta",
    "γ": r"\gamma",
    "δ": r"\delta",
    "θ": r"\theta",
    "λ": r"\lambda",
    "μ": r"\mu",
    "π": r"\pi",
    "σ": r"\sigma",
    "φ": r"\varphi",
    "ω": r"\omega",
    "∈": r"\in",
    "→": r"\rightarrow",
}

_MATH_CHARS = set(SYMBOL_MAP) | set("=+-*/^_()[]{}<>")

_RE_ALREADY_LATEX = re.compile(r"^\s*\$\$?.*\$\$?\s*$", re.DOTALL)
_RE_SUBSCRIPT = re.compile(r"(?<=[A-Za-z])_([A-Za-z0-9]{1,6})\b")
_RE_SUB_PAREN = re.compile(r"(?<=[A-Za-z])\(([A-Za-z0-9]{1,6})\)")
_RE_SUP = re.compile(r"\^([A-Za-z0-9]{1,4})")
# "Trong đó:" — phần giải thích ký hiệu đi ngay dưới công thức.
RE_GIAI_THICH = re.compile(r"^\s*Trong\s+đó\s*:", re.IGNORECASE)


def looks_like_formula(line: str) -> bool:
    """Dòng này có phải công thức không (heuristic, thiên về bỏ sót hơn nhận nhầm)."""
    s = line.strip()
    if not s or len(s) > 200:
        return False
    if _RE_ALREADY_LATEX.match(s):
        return True
    if "=" not in s:
        return False
    if not any(ch in SYMBOL_MAP for ch in s) and "_" not in s and "^" not in s:
        return False
    letters = sum(1 for ch in s if ch.isalpha())
    words = [w for w in re.split(r"\s+", s) if len(w) > 3 and w.isalpha()]
    # công thức có ít từ "văn xuôi" dài
    if len(words) > 3:
        return False
    return letters > 0


def to_latex(line: str) -> str:
    """Chuyển một dòng công thức sang LaTeX dạng `$$ … $$`."""
    s = line.strip()
    if _RE_ALREADY_LATEX.match(s):
        inner = s.strip("$").strip()
        return f"$$ {inner} $$"
    for sym, cmd in SYMBOL_MAP.items():
        s = s.replace(sym, f"{cmd} ")
    s = _RE_SUB_PAREN.sub(r"_{\1}", s)
    s = _RE_SUBSCRIPT.sub(r"_{\1}", s)
    s = _RE_SUP.sub(r"^{\1}", s)
    s = re.sub(r"\s+", " ", s).strip()
    return f"$$ {s} $$"


def describe(latex: str) -> str:
    """Diễn giải bằng lời để đưa vào `alt` cho RAG tìm kiếm được."""
    text = latex.strip("$ ").strip()
    for cmd, word in (
        (r"\sum", "tổng"),
        (r"\prod", "tích"),
        (r"\sqrt", "căn bậc hai"),
        (r"\times", "nhân"),
        (r"\div", "chia"),
        (r"\leq", "nhỏ hơn hoặc bằng"),
        (r"\geq", "lớn hơn hoặc bằng"),
        (r"\neq", "khác"),
    ):
        text = text.replace(cmd, f" {word} ")
    text = re.sub(r"[_^]\{([^}]*)\}", r" \1", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_variables(explanation_lines: list[str]) -> list[dict[str, str]]:
    """Trích danh sách biến từ khối "Trong đó: …" ngay dưới công thức."""
    out: list[dict[str, str]] = []
    for line in explanation_lines:
        m = re.match(r"^\s*[-–•]?\s*([A-Za-zĐđ][A-Za-z0-9_()]{0,10})\s*(?:là|:)\s*(.+?)\s*[;.]?\s*$", line)
        if m:
            out.append({"symbol": m.group(1), "meaning": m.group(2)})
    return out


def latex_parses(latex: str) -> tuple[bool, str | None]:
    """Kiểm tra LaTeX có "parse được" không (thay cho KaTeX ở phía server).

    Kiểm tra: cân bằng `$`, cân bằng `{}` `[]` `()`, lệnh `\\frac` đủ 2 đối số.
    """
    s = latex.strip()
    if s.count("$$") % 2 != 0:
        return False, "dấu $$ không cân bằng"
    stripped = s.replace("$$", "")
    if stripped.count("$") % 2 != 0:
        return False, "dấu $ không cân bằng"
    stack: list[str] = []
    pairs = {")": "(", "]": "[", "}": "{"}
    i = 0
    while i < len(stripped):
        ch = stripped[i]
        if ch == "\\":
            i += 2
            continue
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False, f"dấu đóng '{ch}' không khớp"
        i += 1
    if stack:
        return False, f"thiếu dấu đóng cho '{stack[-1]}'"
    for m in re.finditer(r"\\frac\s*", stripped):
        rest = stripped[m.end() :]
        if not re.match(r"\{[^{}]*\}\s*\{", rest):
            return False, r"\frac thiếu đối số"
    return True, None
