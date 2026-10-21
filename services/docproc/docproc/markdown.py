"""Dựng Markdown mở rộng chuẩn nội bộ (ke-hoach/03 §4).

Đặc điểm: mỗi nút cấu trúc có một marker HTML comment `<!-- node: … -->` giữ
ánh xạ nút ↔ Markdown; nội dung hiển thị vẫn là Markdown thuần. Bảng đơn giản
dùng GFM, bảng gộp ô dùng `<table>` HTML; công thức dùng `$$…$$`.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from . import formula as formula_mod
from .labels import (
    RE_PHU_LUC,
    is_heading,
    is_node_marker,
    is_table_row,
    label_kind,
    parse_dieu_no,
    parse_diem_no,
    parse_khoan_no,
    roman_to_int,
    slugify_label,
    strip_markup,
)
from .types import AssetOut

RE_CAN_CU = re.compile(r"^\s*Căn\s+cứ\b", re.IGNORECASE)
RE_NOI_NHAN = re.compile(r"^\s*Nơi\s+nhận\s*:", re.IGNORECASE)
RE_KY_HIEU = re.compile(r"^\s*Số\s*:\s*(\S+)", re.IGNORECASE)
# Tên loại văn bản đứng một mình trên một dòng -> tiêu đề cấp 1 của tài liệu.
RE_DOC_TYPE_HEADING = re.compile(
    r"^(NGHỊ ĐỊNH|THÔNG TƯ|THÔNG TƯ LIÊN TỊCH|QUYẾT ĐỊNH|NGHỊ QUYẾT|LUẬT|BỘ LUẬT|"
    r"PHÁP LỆNH|LỆNH|VĂN BẢN HỢP NHẤT|CHỈ THỊ)$"
)


def asset_id(kind: str, payload: str, salt: str = "") -> str:
    """Sinh id ổn định cho asset từ nội dung (để chạy lại cho kết quả như nhau)."""
    h = hashlib.sha256(f"{kind}|{salt}|{payload}".encode("utf-8")).hexdigest()
    return h[:32]


def front_matter(meta: dict[str, Any]) -> list[str]:
    """Khối YAML front matter: urn, version, valid_from…"""
    if not meta:
        return []
    lines = ["---"]
    for key, value in meta.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            lines.append(f"{key}: [{', '.join(str(v) for v in value)}]")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return lines


@dataclass
class _Ctx:
    """Ngữ cảnh nút hiện hành, để dựng `node_path` rút gọn."""

    chuong: str | None = None
    muc: str | None = None
    phu_luc: str | None = None
    dieu: str | None = None
    khoan: str | None = None
    diem: str | None = None
    n_bang: int = 0
    n_cong_thuc: int = 0
    n_hinh: int = 0

    def path(self) -> str:
        """Path rút gọn (`dieu-15.khoan-2.diem-a`) — khóa tra cứu chính (03 §1)."""
        parts: list[str] = []
        if self.dieu:
            parts.append(slugify_label("dieu", self.dieu))
            if self.khoan:
                parts.append(slugify_label("khoan", self.khoan))
                if self.diem:
                    parts.append(slugify_label("diem", self.diem))
        elif self.phu_luc:
            parts.append(slugify_label("phu-luc", self.phu_luc))
        elif self.muc:
            parts.append(slugify_label("muc", self.muc))
        elif self.chuong:
            parts.append(slugify_label("chuong", self.chuong))
        return ".".join(parts)

    def container(self) -> str:
        """Path của khối chứa (dùng cho bảng/công thức/hình)."""
        if self.phu_luc:
            base = slugify_label("phu-luc", self.phu_luc)
            if self.dieu:
                return f"{base}.{slugify_label('dieu', self.dieu)}"
            return base
        return self.path() or "than-van-ban"


@dataclass
class RenderResult:
    markdown: str
    assets: list[AssetOut] = field(default_factory=list)


def _marker(path: str, asset: str | None = None) -> str:
    if asset:
        return f"<!-- node: {path} | asset: {asset} -->"
    return f"<!-- node: {path} -->"


def _chuong_number(line: str) -> str:
    m = re.match(r"^Chương\s+([IVXLCDM]+|\d+)", strip_markup(line), re.IGNORECASE)
    if not m:
        return "0"
    raw = m.group(1)
    n = roman_to_int(raw)
    return str(n) if n else raw


def _muc_number(line: str) -> str:
    m = re.match(r"^Mục\s+(\d+)", strip_markup(line), re.IGNORECASE)
    return m.group(1) if m else "0"


def _phu_luc_number(line: str) -> str:
    m = re.match(r"^PHỤ\s+LỤC\s+([IVXLCDM]+|\d+)", strip_markup(line), re.IGNORECASE)
    if not m:
        return "1"
    n = roman_to_int(m.group(1))
    return str(n) if n else m.group(1)


def build_internal_markdown(
    body: str,
    meta: dict[str, Any] | None = None,
    *,
    title: str | None = None,
    doc_heading: str | None = None,
    page_of_line: dict[int, int] | None = None,
) -> RenderResult:
    """Chuyển Markdown thân văn bản thô thành định dạng chuẩn nội bộ.

    - Chèn marker nút trước mỗi Chương/Mục/Điều/khoản/điểm/bảng/công thức/hình.
    - Nâng cấp heading: Chương -> `##`, Điều -> `###`, Phụ lục -> `##`.
    - Tách bảng/công thức/hình thành `assets` kèm id ổn định.
    """
    meta = meta or {}
    lines = body.splitlines()
    out: list[str] = front_matter(meta)
    if doc_heading:
        out.append(f"# {doc_heading}")
    if title:
        out.append(f"## {title}")
    assets: list[AssetOut] = []
    ctx = _Ctx()
    can_cu_open = False
    signature_open = False
    doc_title_done = bool(doc_heading)
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        page = (page_of_line or {}).get(i)

        if not line.strip():
            out.append("")
            i += 1
            continue

        if is_node_marker(line):
            out.append(line)
            i += 1
            continue

        # --- bảng -------------------------------------------------------
        if is_table_row(line):
            block: list[str] = []
            while i < len(lines) and is_table_row(lines[i]):
                block.append(lines[i].rstrip())
                i += 1
            ctx.n_bang += 1
            md = "\n".join(block)
            aid = asset_id("table", md)
            rows = sum(1 for b in block if not re.fullmatch(r"\|(?:\s*:?-{2,}:?\s*\|)+", b.strip()))
            cols = block[0].count("|") - 1 if block else 0
            path = f"{ctx.container()}.bang-{ctx.n_bang}"
            assets.append(
                AssetOut(id=aid, kind="table", md=md, rows=max(rows - 1, 0), cols=cols, page=page)
            )
            _blank(out)
            out.append(_marker(path, aid))
            out.extend(block)
            continue

        # --- hình -------------------------------------------------------
        if line.lstrip().startswith("!["):
            ctx.n_hinh += 1
            m = re.match(r"!\[(.*?)\]\((.*?)\)", line.strip())
            caption = m.group(1) if m else ""
            uri = m.group(2) if m else ""
            aid = asset_id("image", uri or line)
            assets.append(AssetOut(id=aid, kind="image", caption=caption, image_uri=uri, page=page))
            _blank(out)
            out.append(_marker(f"{ctx.container()}.hinh-{ctx.n_hinh}", aid))
            out.append(f"![{caption}](asset://{aid})")
            i += 1
            continue

        # --- công thức --------------------------------------------------
        if formula_mod.looks_like_formula(line):
            latex = formula_mod.to_latex(line)
            ctx.n_cong_thuc += 1
            aid = asset_id("formula", latex)
            explanation: list[str] = []
            j = i + 1
            if j < len(lines) and formula_mod.RE_GIAI_THICH.match(lines[j]):
                j += 1
                while j < len(lines) and lines[j].strip() and not label_kind(lines[j]) in {"dieu", "khoan"}:
                    explanation.append(lines[j])
                    j += 1
            alt = formula_mod.describe(latex)
            assets.append(
                AssetOut(
                    id=aid,
                    kind="formula",
                    md=latex,
                    alt=alt,
                    page=page,
                    needs_review=not formula_mod.latex_parses(latex)[0],
                )
            )
            _blank(out)
            out.append(_marker(f"{ctx.container()}.cong-thuc-{ctx.n_cong_thuc}", aid))
            out.append(latex)
            out.append("")
            i += 1
            continue

        stripped = strip_markup(line)

        # --- tiêu đề loại văn bản + trích yếu ------------------------------
        if not doc_title_done and RE_DOC_TYPE_HEADING.match(stripped):
            doc_title_done = True
            _blank(out)
            out.append(f"# {stripped}")
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and not label_kind(lines[j]) and not RE_CAN_CU.match(strip_markup(lines[j])):
                out.append(f"## {strip_markup(lines[j])}")
                i = j
            i += 1
            continue

        # --- căn cứ -----------------------------------------------------
        if RE_CAN_CU.match(stripped):
            if not can_cu_open:
                _blank(out)
                out.append(_marker("can-cu"))
                can_cu_open = True
            out.append(f"*{stripped}*")
            i += 1
            continue
        can_cu_open = False

        # --- chữ ký / nơi nhận -------------------------------------------
        if RE_NOI_NHAN.match(stripped) and not signature_open:
            signature_open = True
            _blank(out)
            out.append(_marker("chu-ky"))
            out.append(stripped)
            i += 1
            continue

        kind = label_kind(line) if not signature_open else None

        if kind == "phu_luc":
            ctx = _Ctx(phu_luc=_phu_luc_number(line))
            _blank(out)
            out.append(_marker(f"phu-luc-{ctx.phu_luc}"))
            out.append(f"## {stripped}")
        elif kind == "chuong":
            ctx.chuong, ctx.muc, ctx.dieu, ctx.khoan, ctx.diem = _chuong_number(line), None, None, None, None
            _blank(out)
            out.append(_marker(f"chuong-{ctx.chuong}"))
            out.append(f"## {stripped}")
        elif kind == "muc":
            ctx.muc, ctx.dieu, ctx.khoan, ctx.diem = _muc_number(line), None, None, None
            _blank(out)
            out.append(_marker(f"muc-{ctx.muc}"))
            out.append(f"### {stripped}")
        elif kind == "dieu":
            ctx.dieu, ctx.khoan, ctx.diem = parse_dieu_no(line), None, None
            _blank(out)
            out.append(_marker(ctx.path()))
            out.append(f"### {stripped}")
        elif kind == "khoan":
            ctx.khoan, ctx.diem = parse_khoan_no(line), None
            _blank(out)
            out.append(_marker(ctx.path()))
            out.append(stripped)
        elif kind == "diem":
            ctx.diem = parse_diem_no(line)
            _blank(out)
            out.append(_marker(ctx.path()))
            out.append(f"   {stripped}")
        elif is_heading(line):
            out.append(line)
        else:
            out.append(stripped if not signature_open else line.strip())
        i += 1

    md = _squeeze(out)
    return RenderResult(markdown=md, assets=assets)


def _blank(out: list[str]) -> None:
    if out and out[-1].strip():
        out.append("")


def _squeeze(lines: Iterable[str]) -> str:
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


def html_table(rows: list[list[str]], spans: list[list[tuple[int, int]]] | None = None) -> str:
    """Render bảng có gộp ô thành `<table>` HTML (ke-hoach/05 §4.3)."""
    out = ["<table>"]
    for r, row in enumerate(rows):
        out.append("  <tr>")
        for c, cell in enumerate(row):
            attrs = ""
            if spans and r < len(spans) and c < len(spans[r]):
                rowspan, colspan = spans[r][c]
                if rowspan > 1:
                    attrs += f' rowspan="{rowspan}"'
                if colspan > 1:
                    attrs += f' colspan="{colspan}"'
            tag = "th" if r == 0 else "td"
            out.append(f"    <{tag}{attrs}>{cell}</{tag}>")
        out.append("  </tr>")
    out.append("</table>")
    return "\n".join(out)
