"""Bộ ghép (stitcher) — phần quan trọng nhất của pipeline (ke-hoach/05 §4.1–4.2).

Hai việc:
1. `stitch_pages`  — ghép các trang liên tiếp thành Markdown liền mạch:
   nối câu/đoạn qua trang, nối bảng qua trang, loại header/số trang lặp,
   giữ khối "Nơi nhận"/chữ ký, bỏ gạch nối cuối dòng do OCR sinh.
2. `merge_windows` — ghép kết quả của các **cửa sổ trang chồng lấn**
   (4–6 trang, chồng 1 trang) bằng so khớp mờ trên phần chồng lấn.

Toàn bộ là logic thuần Python (không I/O, không mạng) để test được đầy đủ.
"""

from __future__ import annotations

import difflib
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field

from .labels import (
    describe_node,
    starts_lowercase,
    is_heading,
    is_label_start,
    is_node_marker,
    is_sentence_end,
    is_table_row,
    is_table_separator,
    label_kind,
    parse_dieu_no,
    parse_diem_no,
    parse_khoan_no,
    strip_markup,
)
from .types import OpenState, PageChunk, TableBlock

# --- Mẫu nhận diện rác đầu/cuối trang -------------------------------------

RE_PAGE_NUMBER = re.compile(
    r"^\s*(?:[-–—]\s*)?(?:Trang\s+)?\d{1,4}\s*(?:/\s*\d{1,4})?\s*(?:[-–—])?\s*$",
    re.IGNORECASE,
)
RE_GAZETTE = re.compile(
    r"^\s*(?:CÔNG\s*BÁO|CONG\s*BAO)\b.*$",
    re.IGNORECASE,
)
RE_GAZETTE_SLASH = re.compile(r"CÔNG\s*BÁO\s*/\s*Số", re.IGNORECASE)

# Khối chữ ký / nơi nhận — KHÔNG được loại dù có lặp qua các trang.
RE_PROTECTED = re.compile(
    r"^\s*(?:Nơi\s+nhận|TM\.|KT\.|TL\.|TUQ\.|Lưu\s*:|"
    r"CHỦ\s+TỊCH|PHÓ\s+CHỦ\s+TỊCH|THỦ\s+TƯỚNG|PHÓ\s+THỦ\s+TƯỚNG|"
    r"BỘ\s+TRƯỞNG|THỨ\s+TRƯỞNG|CHÁNH\s+ÁN|VIỆN\s+TRƯỞNG)",
    re.IGNORECASE,
)   # không dùng \b vì "TM."/"KT." kết thúc bằng dấu chấm
RE_NOI_NHAN = re.compile(r"^\s*Nơi\s+nhận\s*:", re.IGNORECASE)

RE_TABLE_CAPTION = re.compile(
    r"^\s*(?:\*\*)?\s*(?:Bảng|Biểu|Biểu\s+số|Mẫu\s+số|Phụ\s+lục)\b",
    re.IGNORECASE,
)

# Gạch nối cuối dòng do OCR sinh giữa từ (tiếng Việt không gạch nối khi ngắt dòng).
RE_TRAILING_HYPHEN = re.compile(r"(?<=[^\W\d_])[-‐‑]$")

# Nhãn mở đầu một tiêu đề cấu trúc (có tiêu đề riêng, không phải văn xuôi).
_HEADING_LABELS = {"phan", "chuong", "muc", "tieu_muc", "dieu", "phu_luc"}


def is_allcaps_line(line: str) -> bool:
    """Dòng viết hoa toàn bộ và đủ ngắn — quốc hiệu, tên loại văn bản, chức danh."""
    s = strip_markup(line)
    if not s or len(s) > 90:
        return False
    letters = [ch for ch in s if ch.isalpha()]
    return bool(letters) and not any(ch.islower() for ch in letters)


@dataclass
class StitchConfig:
    """Tham số của bộ ghép."""

    head_scan: int = 3
    """Số dòng đầu trang được xét là ứng viên header lặp."""
    foot_scan: int = 3
    """Số dòng cuối trang được xét là ứng viên footer lặp."""
    running_ratio: float = 0.6
    """Tỷ lệ trang tối thiểu để coi một dòng là header/footer lặp."""
    min_pages_for_running: int = 3
    """Dưới ngưỡng này thì không suy luận header lặp theo tần suất (dễ nhầm)."""
    fuzzy_threshold: float = 0.82
    """Ngưỡng so khớp mờ khi ghép hai cửa sổ trên trang chồng lấn."""
    max_overlap_blocks: int = 60
    """Số khối tối đa được xét khi tìm vùng chồng lấn giữa hai cửa sổ."""


@dataclass
class StitchResult:
    markdown: str
    open_state: OpenState = field(default_factory=OpenState)
    tables: list[TableBlock] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    dropped: list[str] = field(default_factory=list)
    """Các dòng đã bị loại (header/footer/số trang) — để kiểm tra lại."""


# ---------------------------------------------------------------------------
# 1. Làm sạch trang: header cơ quan, "CÔNG BÁO/Số …", số trang
# ---------------------------------------------------------------------------


def _norm_running(line: str) -> str:
    """Chuẩn hóa dòng để so tần suất: bỏ dấu cách thừa, số hóa thành '#'."""
    s = unicodedata.normalize("NFC", line.strip().lower())
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\d+", "#", s)
    return s


def detect_running_lines(pages: list[PageChunk], cfg: StitchConfig) -> set[str]:
    """Phát hiện header/footer lặp theo **vị trí + tần suất** (ke-hoach/05 §2).

    Chỉ xét vài dòng đầu và vài dòng cuối mỗi trang; dòng nào xuất hiện ở
    >= `running_ratio` số trang thì coi là rác lặp.
    """
    if len(pages) < cfg.min_pages_for_running:
        return set()
    counter: Counter[str] = Counter()
    for page in pages:
        content = [ln for ln in page.lines if ln.strip()]
        if not content:
            continue
        span = min(cfg.head_scan, max(1, len(content) // 3))
        candidates = content[:span] + content[-min(cfg.foot_scan, max(1, len(content) // 3)) :]
        seen: set[str] = set()
        for line in candidates:
            if RE_PROTECTED.match(line):
                continue
            # Nội dung thật (Điều/khoản/điểm/căn cứ/bảng) không bao giờ là header lặp.
            if is_label_start(line) or len(line.strip()) > 120:
                continue
            key = _norm_running(line)
            if not key or key in seen:
                continue
            seen.add(key)
            counter[key] += 1
    threshold = max(2, math.ceil(cfg.running_ratio * len(pages)))
    return {key for key, n in counter.items() if n >= threshold}


def _is_junk(line: str, running: set[str]) -> str | None:
    """Trả về lý do dòng bị loại, hoặc None nếu giữ lại."""
    s = line.strip()
    if not s:
        return None
    if RE_PAGE_NUMBER.match(s):
        return "page_number"
    if RE_GAZETTE_SLASH.search(s):
        return "gazette_header"
    if _norm_running(s) in running:
        return "running_head"
    return None


def clean_pages(pages: list[PageChunk], cfg: StitchConfig | None = None) -> tuple[list[PageChunk], list[str]]:
    """Loại header/footer/số trang lặp, GIỮ nguyên khối "Nơi nhận"/chữ ký."""
    cfg = cfg or StitchConfig()
    running = detect_running_lines(pages, cfg)
    out: list[PageChunk] = []
    dropped: list[str] = []
    for page in pages:
        kept: list[str] = []
        in_signature = False
        for line in page.lines:
            if RE_NOI_NHAN.match(line) or RE_PROTECTED.match(line):
                in_signature = True
            if in_signature:
                # Trong khối ký chỉ loại số trang / header Công báo, không loại
                # theo tần suất (vì "- Như Điều 3;" có thể lặp giữa các văn bản).
                reason = None
                s = line.strip()
                if s and RE_PAGE_NUMBER.match(s):
                    reason = "page_number"
                elif s and RE_GAZETTE_SLASH.search(s):
                    reason = "gazette_header"
            else:
                reason = _is_junk(line, running)
            if reason:
                dropped.append(f"p{page.page_no}:{reason}:{line.strip()}")
                continue
            kept.append(line)
        out.append(PageChunk(page_no=page.page_no, lines=kept, wrapped=page.wrapped))
    return out, dropped


# ---------------------------------------------------------------------------
# 2. Quy tắc nối hai dòng
# ---------------------------------------------------------------------------


def should_join(prev_line: str, next_line: str) -> bool:
    """Quy tắc 1 của ke-hoach/05 §4.2 — có nối `next_line` vào đoạn của `prev_line`?

    Nối khi: dòng trước KHÔNG kết thúc bằng `.` `;` `:` (…, !, ?) VÀ dòng sau
    KHÔNG phải nhãn (Điều/Chương/số./chữ cái)/heading/bảng/marker).
    """
    if not prev_line.strip() or not next_line.strip():
        return False
    if is_table_row(prev_line) or is_table_row(next_line):
        return False
    if is_node_marker(prev_line) or is_node_marker(next_line):
        return False
    if is_heading(prev_line):
        return False
    # công thức hiển thị là một khối riêng, không nối vào văn xuôi hai bên
    from . import formula as _formula

    if _formula.looks_like_formula(prev_line) or _formula.looks_like_formula(next_line):
        return False
    if is_label_start(next_line):
        return False
    if is_sentence_end(prev_line):
        return False
    # Dòng viết hoa toàn bộ (quốc hiệu, tên loại văn bản, chức danh người ký) là
    # một khối riêng — không được dính vào đoạn trước/sau.
    if is_allcaps_line(prev_line) or is_allcaps_line(next_line):
        return False
    # Tiêu đề Điều/Chương/Mục/Phụ lục chỉ được nối tiếp khi phần sau là phần
    # tiêu đề bị ngắt dòng (bắt đầu bằng chữ thường).
    if label_kind(prev_line) in _HEADING_LABELS and not starts_lowercase(next_line):
        return False
    return True


def join_lines(prev_line: str, next_line: str) -> str:
    """Nối hai dòng, xử lý gạch nối cuối dòng do OCR sinh (quy tắc 5)."""
    left = prev_line.rstrip()
    right = next_line.lstrip()
    if RE_TRAILING_HYPHEN.search(left) and right[:1].islower():
        return left[:-1] + right
    return f"{left} {right}"


def unwrap_lines(lines: list[str]) -> list[str]:
    """Gộp các dòng hiển thị bị ngắt trong CÙNG một trang thành đoạn.

    Dùng đúng vị từ `should_join` như ở ranh giới trang để hành vi nhất quán.
    """
    out: list[str] = []
    for line in lines:
        if out and should_join(out[-1], line):
            out[-1] = join_lines(out[-1], line)
        else:
            out.append(line)
    return out


# ---------------------------------------------------------------------------
# 3. Bảng
# ---------------------------------------------------------------------------


def split_row(line: str) -> list[str]:
    """Tách một hàng GFM `| a | b |` thành danh sách ô."""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def render_table(table: TableBlock) -> list[str]:
    """Render `TableBlock` thành GFM (hoặc trả nguyên HTML khi có gộp ô)."""
    if table.html:
        return table.html.splitlines()
    cols = table.cols
    if cols == 0:
        return []
    lines: list[str] = []
    header = table.header or [""] * cols
    lines.append("| " + " | ".join(_pad(header, cols)) + " |")
    align = table.align or ["---"] * cols
    lines.append("| " + " | ".join(_pad(align, cols)) + " |")
    for row in table.rows:
        lines.append("| " + " | ".join(_pad(row, cols)) + " |")
    return lines


def _pad(cells: list[str], cols: int) -> list[str]:
    cells = list(cells[:cols])
    while len(cells) < cols:
        cells.append("")
    return cells


def _same_header(a: list[str] | None, b: list[str] | None) -> bool:
    if a is None or b is None:
        return False
    norm = lambda cells: [_norm_running(c) for c in cells]
    return norm(a) == norm(b)


def parse_table(lines: list[str], start: int) -> tuple[TableBlock, int]:
    """Đọc một bảng GFM bắt đầu tại `lines[start]`; trả bảng và chỉ số kế tiếp."""
    i = start
    rows: list[list[str]] = []
    header: list[str] | None = None
    align: list[str] | None = None
    while i < len(lines) and is_table_row(lines[i]):
        if is_table_separator(lines[i]):
            align = split_row(lines[i])
            i += 1
            continue
        cells = split_row(lines[i])
        if header is None and align is None:
            header = cells
        else:
            rows.append(cells)
        i += 1
    if align is None and header is not None:
        # Không có hàng phân cách -> coi hàng đầu là dữ liệu, không phải tiêu đề.
        rows.insert(0, header)
        header = None
    return TableBlock(header=header, rows=rows, align=align), i


# ---------------------------------------------------------------------------
# 4. Bộ ghép chính
# ---------------------------------------------------------------------------


def needs_blank_between(prev: str, cur: str) -> bool:
    """Hai khối liền nhau có cần một dòng trống ngăn cách không.

    Cần, trừ khi cả hai cùng thuộc một danh sách gạch đầu dòng (khối "Nơi nhận").
    """
    pk, ck = label_kind(prev), label_kind(cur)
    if ck == "gach_dau_dong" and (pk == "gach_dau_dong" or prev.rstrip().endswith(":")):
        return False
    return True


class _Accumulator:
    """Trạng thái tích lũy khi duyệt tuần tự các trang."""

    def __init__(self) -> None:
        self.out: list[str] = []
        self.para: str | None = None
        self.table: TableBlock | None = None
        self.tables: list[TableBlock] = []
        self.warnings: list[str] = []

    def _sep(self, first_line: str) -> None:
        if not self.out or not self.out[-1].strip():
            return   # đã có dòng trống ngay trước
        prev = self.out[-1]
        if needs_blank_between(prev, first_line):
            self.out.append("")

    def flush_para(self) -> None:
        if self.para is not None:
            self._sep(self.para)
            self.out.append(self.para)
            self.para = None

    def flush_table(self) -> None:
        if self.table is not None:
            self.tables.append(self.table)
            rendered = render_table(self.table)
            if rendered:
                self._sep(rendered[0])
            self.out.extend(rendered)
            self.table = None

    def flush_all(self) -> None:
        self.flush_para()
        self.flush_table()

    def emit(self, line: str) -> None:
        self.flush_all()
        self._sep(line)
        self.out.append(line)


def stitch_pages(
    pages: list[PageChunk],
    cfg: StitchConfig | None = None,
    *,
    clean: bool = True,
) -> StitchResult:
    """Ghép danh sách trang thành Markdown liền mạch.

    Áp dụng đủ 5 quy tắc cơ học của ke-hoach/05 §4.2 (quy tắc 6 — không tóm tắt,
    không sửa văn phong — được bảo đảm bằng việc module này không hề viết lại chữ).
    """
    cfg = cfg or StitchConfig()
    dropped: list[str] = []
    if clean:
        pages, dropped = clean_pages(pages, cfg)

    acc = _Accumulator()
    first_page = True
    for page in pages:
        lines = [ln.rstrip() for ln in page.lines]
        if page.wrapped:
            lines = unwrap_lines(lines)
        # bỏ dòng trống ở đầu/cuối trang: ngắt trang không phải ngắt đoạn
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        if not lines:
            continue
        _consume_page(acc, lines, first_page=first_page, cfg=cfg)
        first_page = False

    open_state = _open_state_of(acc)
    acc.flush_all()
    markdown = _normalize_blank_lines(acc.out)
    return StitchResult(
        markdown=markdown,
        open_state=open_state,
        tables=acc.tables,
        warnings=acc.warnings,
        dropped=dropped,
    )


def _consume_page(acc: _Accumulator, lines: list[str], *, first_page: bool, cfg: StitchConfig) -> None:
    i = 0
    at_page_start = not first_page

    while i < len(lines):
        line = lines[i]

        if not line.strip():
            acc.flush_all()
            acc.out.append("")
            i += 1
            at_page_start = False
            continue

        if is_table_row(line):
            table, nxt = parse_table(lines, i)
            _merge_table(acc, table, at_page_start=at_page_start)
            i = nxt
            at_page_start = False
            continue

        # dòng thường / heading / marker: bảng (nếu có) kết thúc tại đây
        if acc.table is not None:
            # Quy tắc 3: chỉ nối bảng khi trang sau bắt đầu ngay bằng bảng.
            acc.flush_table()

        if at_page_start and acc.para is not None and should_join(acc.para, line):
            # Quy tắc 1: câu/đoạn bị cắt qua trang -> nối, thay ngắt dòng bằng dấu cách.
            acc.para = join_lines(acc.para, line)
        elif is_heading(line) or is_node_marker(line):
            acc.emit(line)
        elif acc.para is not None and should_join(acc.para, line):
            acc.para = join_lines(acc.para, line)
        else:
            acc.flush_all()
            acc.para = line
        i += 1
        at_page_start = False


def _merge_table(acc: _Accumulator, table: TableBlock, *, at_page_start: bool) -> None:
    """Quy tắc 3: bảng qua trang — cùng số cột, không có tiêu đề bảng mới -> nối hàng."""
    cur = acc.table
    if (
        cur is not None
        and at_page_start
        and table.caption is None
        and cur.cols == table.cols
        and table.cols > 0
    ):
        rows = list(table.rows)
        if _same_header(cur.header, table.header):
            # header lặp lại ở đầu trang sau -> bỏ
            pass
        elif table.header is not None:
            rows.insert(0, table.header)
        cur.rows.extend(rows)
        return
    acc.flush_all()
    acc.table = table


def _open_state_of(acc: _Accumulator) -> OpenState:
    """Tính "trạng thái mở" ở cuối phần đã ghép (để chuyển cho cửa sổ sau)."""
    lines = list(acc.out)
    if acc.para is not None:
        lines.append(acc.para)
    dieu, khoan, diem = track_node_path(lines)
    para_open = acc.para is not None and not is_sentence_end(acc.para)
    tail = "\n\n".join([ln for ln in lines if ln.strip()][-3:])
    return OpenState(
        paragraph_open=para_open,
        tail_text=tail,
        table_open=acc.table is not None,
        table_cols=acc.table.cols if acc.table else 0,
        table_header=list(acc.table.header) if acc.table and acc.table.header else None,
        node_label=describe_node(dieu, khoan, diem),
    )


def track_node_path(lines: list[str]) -> tuple[str | None, str | None, str | None]:
    """Theo vết nút đang mở: (số điều, số khoản, chữ cái điểm) ở cuối `lines`."""
    dieu = khoan = diem = None
    for line in lines:
        if not line.strip() or is_table_row(line) or is_node_marker(line):
            continue
        kind = label_kind(line)
        if kind == "dieu":
            dieu, khoan, diem = parse_dieu_no(line), None, None
        elif kind == "khoan":
            khoan, diem = parse_khoan_no(line), None
        elif kind == "diem":
            diem = parse_diem_no(line)
        elif kind in {"chuong", "muc", "tieu_muc", "phan", "phu_luc"}:
            dieu = khoan = diem = None
    return dieu, khoan, diem


def _normalize_blank_lines(lines: list[str]) -> str:
    out: list[str] = []
    for line in lines:
        if not line.strip():
            if out and not out[-1].strip():
                continue
            out.append("")
        else:
            out.append(line.rstrip())
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out) + ("\n" if out else "")


# ---------------------------------------------------------------------------
# 5. Cửa sổ trang chồng lấn
# ---------------------------------------------------------------------------


def build_windows(page_count: int, size: int = 5, overlap: int = 1) -> list[list[int]]:
    """Chia thành cụm 4–6 trang, chồng lấn `overlap` trang (ke-hoach/05 §4.1).

    Trả danh sách số trang (1-based) cho từng cửa sổ.
    """
    if page_count <= 0:
        return []
    size = max(2, size)
    overlap = max(0, min(overlap, size - 1))
    step = size - overlap
    windows: list[list[int]] = []
    start = 1
    while start <= page_count:
        end = min(start + size - 1, page_count)
        windows.append(list(range(start, end + 1)))
        if end >= page_count:
            break
        start += step
    return windows


def _split_blocks(markdown: str) -> list[str]:
    """Tách Markdown thành khối (đoạn/bảng/heading) ngăn bởi dòng trống."""
    blocks: list[str] = []
    buf: list[str] = []
    for line in markdown.splitlines():
        if line.strip():
            buf.append(line)
        elif buf:
            blocks.append("\n".join(buf))
            buf = []
    if buf:
        blocks.append("\n".join(buf))
    return blocks


def _block_key(block: str) -> str:
    return re.sub(r"\s+", " ", strip_markup(block)).strip().lower()


def find_overlap(prev_blocks: list[str], next_blocks: list[str], cfg: StitchConfig) -> int:
    """Tìm số khối chồng lấn ở cuối `prev_blocks` khớp mờ với đầu `next_blocks`."""
    limit = min(len(prev_blocks), len(next_blocks), cfg.max_overlap_blocks)
    for k in range(limit, 0, -1):
        left = [_block_key(b) for b in prev_blocks[-k:]]
        right = [_block_key(b) for b in next_blocks[:k]]
        pairs = [(a, b) for a, b in zip(left, right) if a or b]
        if not pairs:
            continue
        ratios = [difflib.SequenceMatcher(None, a, b).ratio() for a, b in pairs]
        # Bảng có khung giống nhau nhưng dữ liệu khác -> cần ngưỡng chặt hơn,
        # nếu không hai bảng nối tiếp sẽ bị nhầm là vùng chồng lấn.
        has_table = any(a.startswith("|") or b.startswith("|") for a, b in pairs)
        threshold = max(cfg.fuzzy_threshold, 0.95) if has_table else cfg.fuzzy_threshold
        if sum(ratios) / len(ratios) >= threshold:
            return k
    return 0


@dataclass
class WindowResult:
    """Kết quả một cửa sổ: Markdown + trạng thái mở do agent/bộ ghép khai báo."""

    pages: list[int]
    markdown: str
    open_state: OpenState = field(default_factory=OpenState)
    tables: list[TableBlock] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def merge_windows(windows: list[WindowResult], cfg: StitchConfig | None = None) -> StitchResult:
    """Hợp nhất các cửa sổ bằng so khớp mờ trên trang chồng lấn.

    Ưu tiên bản của cửa sổ SAU cho phần chồng lấn (ke-hoach/05 §4.1); không chèn
    ngắt đoạn khi `open_state.paragraph_open` nói câu chưa kết thúc.
    """
    cfg = cfg or StitchConfig()
    if not windows:
        return StitchResult(markdown="")

    blocks: list[str] = _split_blocks(windows[0].markdown)
    tables: list[TableBlock] = list(windows[0].tables)
    warnings: list[str] = list(windows[0].warnings)
    prev_state = windows[0].open_state

    for win in windows[1:]:
        nxt = _split_blocks(win.markdown)
        k = find_overlap(blocks, nxt, cfg)
        if k:
            blocks = blocks[:-k]
        else:
            warnings.append(
                f"không tìm thấy vùng chồng lấn giữa cửa sổ trước và trang {win.pages[0]}"
            )
        if blocks and nxt:
            if prev_state.paragraph_open and should_join(blocks[-1], nxt[0]):
                blocks[-1] = join_lines(blocks[-1], nxt[0])
                nxt = nxt[1:]
            elif prev_state.table_open and is_table_row(nxt[0]) and is_table_row(blocks[-1]):
                merged = _merge_table_blocks(blocks[-1], nxt[0])
                if merged is not None:
                    blocks[-1] = merged
                    nxt = nxt[1:]
        blocks.extend(nxt)
        tables.extend(win.tables)
        warnings.extend(win.warnings)
        prev_state = win.open_state

    blocks = join_adjacent_blocks([b for b in blocks if b.strip()])
    markdown = "\n\n".join(b.strip("\n") for b in blocks) + "\n" if blocks else ""
    return StitchResult(markdown=markdown, open_state=prev_state, tables=tables, warnings=warnings)


def join_adjacent_blocks(blocks: list[str]) -> list[str]:
    """Hậu xử lý: nối hai khối liền kề nếu vẫn thuộc cùng một câu/đoạn.

    Đây là lưới an toàn cho quy tắc 1 (ke-hoach/05 §4.2) sau khi hợp nhất cửa sổ:
    mô hình có thể vô tình chèn ngắt đoạn ở chỗ câu chưa kết thúc.
    """
    out: list[str] = []
    for block in blocks:
        if out:
            prev_last = out[-1].splitlines()[-1]
            cur_first = block.splitlines()[0]
            if should_join(prev_last, cur_first):
                prev_lines = out[-1].splitlines()
                cur_lines = block.splitlines()
                prev_lines[-1] = join_lines(prev_lines[-1], cur_lines[0])
                out[-1] = "\n".join(prev_lines + cur_lines[1:])
                continue
        out.append(block)
    return out


def _merge_table_blocks(prev_block: str, next_block: str) -> str | None:
    """Nối hai khối bảng GFM liền kề nhau qua ranh giới cửa sổ."""
    prev_lines = prev_block.splitlines()
    next_lines = next_block.splitlines()
    left, _ = parse_table(prev_lines, 0)
    right, _ = parse_table(next_lines, 0)
    if left.cols == 0 or left.cols != right.cols:
        return None
    rows = list(right.rows)
    if _same_header(left.header, right.header):
        pass
    elif right.header is not None:
        rows.insert(0, right.header)
    left.rows.extend(rows)
    return "\n".join(render_table(left))
