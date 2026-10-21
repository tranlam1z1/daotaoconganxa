"""Tiền xử lý ảnh trang cho tuyến D/E (ke-hoach/05 §2).

* PDF -> ảnh trang 300 DPI (PyMuPDF, thay cho pdftoppm để không cần binary ngoài).
* Khử nghiêng (deskew) bằng profile chiếu ngang, khử nhiễu, nhị phân hóa thích ứng.
* Phát hiện & loại header/footer/số trang lặp theo **vị trí + tần suất**, nhưng
  GIỮ khối "Nơi nhận"/chức danh/tên người ký ở cuối văn bản.

Chỉ dùng PyMuPDF + Pillow (không numpy/opencv) để chạy được trên máy không GPU.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .stitch import RE_PROTECTED, _norm_running
from .types import LayoutBlock

DEFAULT_DPI = 300


@dataclass
class PageImage:
    page_no: int
    path: Path
    width: int
    height: int
    dpi: int
    skew_deg: float = 0.0


def render_pages(
    pdf_path: str | Path,
    out_dir: str | Path,
    dpi: int = DEFAULT_DPI,
    pages: list[int] | None = None,
) -> list[PageImage]:
    """PDF -> ảnh PNG từng trang ở `dpi` (mặc định 300).

    Ảnh lưu theo quy ước `pages/{doc}/{page}.png` của ke-hoach/05 §2 — người gọi
    truyền `out_dir` đã bao gồm phần `{doc}`.
    """
    import pymupdf

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    images: list[PageImage] = []
    with pymupdf.open(str(pdf_path)) as doc:
        targets = pages or list(range(1, doc.page_count + 1))
        for page_no in targets:
            pix = doc[page_no - 1].get_pixmap(matrix=matrix, alpha=False)
            path = out / f"{page_no}.png"
            pix.save(str(path))
            images.append(
                PageImage(page_no=page_no, path=path, width=pix.width, height=pix.height, dpi=dpi)
            )
    return images


# --- xử lý ảnh -------------------------------------------------------------


def _row_profile(img) -> list[float]:
    """Độ đậm trung bình của từng hàng điểm ảnh (chiếu ngang)."""
    from PIL import Image

    thumb = img.convert("L").resize((1, img.height), Image.BILINEAR)
    return [255.0 - float(p) for p in thumb.getdata()]


def estimate_skew(image_path: str | Path, max_deg: float = 4.0, step: float = 0.25) -> float:
    """Ước lượng góc nghiêng bằng cách tối đa hóa phương sai profile chiếu ngang.

    Trang thẳng có các dòng chữ nằm ngang -> profile có đỉnh/đáy rõ -> phương sai lớn.
    """
    from PIL import Image

    with Image.open(image_path) as src:
        gray = src.convert("L")
        # thu nhỏ để chạy nhanh; giữ đủ chi tiết dòng chữ
        scale = 900 / max(gray.width, 1)
        if scale < 1:
            gray = gray.resize((int(gray.width * scale), int(gray.height * scale)), Image.BILINEAR)
        best_angle, best_score = 0.0, -1.0
        angle = -max_deg
        while angle <= max_deg + 1e-9:
            rotated = gray.rotate(angle, resample=Image.BILINEAR, fillcolor=255)
            profile = _row_profile(rotated)
            mean = sum(profile) / len(profile)
            score = sum((p - mean) ** 2 for p in profile) / len(profile)
            if score > best_score:
                best_score, best_angle = score, angle
            angle += step
    return round(best_angle, 3)


def deskew(image_path: str | Path, out_path: str | Path | None = None, angle: float | None = None) -> tuple[Path, float]:
    """Xoay ảnh về ngang. Trả (đường dẫn ảnh kết quả, góc đã xoay)."""
    from PIL import Image

    src_path = Path(image_path)
    dst = Path(out_path) if out_path else src_path
    theta = estimate_skew(src_path) if angle is None else angle
    if abs(theta) < 0.1:
        if dst != src_path:
            with Image.open(src_path) as img:
                img.save(dst)
        return dst, 0.0
    with Image.open(src_path) as img:
        rotated = img.rotate(theta, resample=Image.BICUBIC, expand=True, fillcolor=255)
        rotated.save(dst)
    return dst, theta


def denoise(image_path: str | Path, out_path: str | Path | None = None, size: int = 3) -> Path:
    """Khử nhiễu muối tiêu bằng lọc trung vị."""
    from PIL import Image, ImageFilter

    dst = Path(out_path) if out_path else Path(image_path)
    with Image.open(image_path) as img:
        img.convert("L").filter(ImageFilter.MedianFilter(size=size)).save(dst)
    return dst


def binarize(image_path: str | Path, out_path: str | Path | None = None, block: int = 32, offset: int = 10) -> Path:
    """Nhị phân hóa **thích ứng**: ngưỡng tính theo từng ô `block`×`block`.

    Chịu được scan có nền không đều (bóng gáy sách, dấu giáp lai mờ).
    """
    from PIL import Image

    dst = Path(out_path) if out_path else Path(image_path)
    with Image.open(image_path) as src:
        gray = src.convert("L")
        w, h = gray.size
        # ảnh trung bình cục bộ: thu nhỏ theo block rồi phóng lại
        small = gray.resize((max(1, w // block), max(1, h // block)), Image.BOX)
        local_mean = small.resize((w, h), Image.BILINEAR)
        out = Image.new("L", (w, h))
        gpx, mpx, opx = gray.load(), local_mean.load(), out.load()
        for y in range(h):
            for x in range(w):
                opx[x, y] = 0 if gpx[x, y] < mpx[x, y] - offset else 255
        out.save(dst)
    return dst


def split_double_page(image_path: str | Path, out_dir: str | Path) -> list[Path]:
    """Tách trang đôi (scan sách): cắt ở cột có tổng độ đậm nhỏ nhất quanh giữa ảnh."""
    from PIL import Image

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as src:
        img = src.convert("L")
        w, h = img.size
        if w < h * 1.2:
            return [Path(image_path)]  # không phải trang đôi
        col = img.resize((w, 1), Image.BILINEAR)
        values = list(col.getdata())
        lo, hi = int(w * 0.4), int(w * 0.6)
        cut = min(range(lo, hi), key=lambda x: 255 - values[x])
        stem = Path(image_path).stem
        left = out / f"{stem}a.png"
        right = out / f"{stem}b.png"
        src.crop((0, 0, cut, h)).save(left)
        src.crop((cut, 0, w, h)).save(right)
    return [left, right]


@dataclass
class PreprocessResult:
    images: list[PageImage] = field(default_factory=list)
    skews: dict[int, float] = field(default_factory=dict)


def preprocess_pdf(
    pdf_path: str | Path,
    out_dir: str | Path,
    dpi: int = DEFAULT_DPI,
    *,
    do_deskew: bool = True,
    do_denoise: bool = True,
    do_binarize: bool = False,
) -> PreprocessResult:
    """Chuỗi tiền xử lý đầy đủ cho tuyến D/E.

    `do_binarize` mặc định tắt vì nhị phân hóa thuần Python khá chậm; bật khi
    scan có nền bẩn.
    """
    images = render_pages(pdf_path, out_dir, dpi=dpi)
    result = PreprocessResult(images=images)
    for img in images:
        if do_deskew:
            _, angle = deskew(img.path)
            img.skew_deg = angle
            result.skews[img.page_no] = angle
        if do_denoise:
            denoise(img.path)
        if do_binarize:
            binarize(img.path)
    return result


# --- header/footer lặp theo vị trí + tần suất -------------------------------

RE_PAGE_NUMBER_BLOCK = re.compile(r"^\s*(?:[-–—]\s*)?(?:Trang\s+)?\d{1,4}\s*(?:/\s*\d{1,4})?\s*(?:[-–—])?\s*$")


def detect_running_blocks(
    blocks: list[LayoutBlock],
    page_heights: dict[int, float],
    *,
    band: float = 0.12,
    ratio: float = 0.6,
) -> set[int]:
    """Trả tập chỉ số block là header/footer/số trang lặp — cần loại bỏ.

    Điều kiện: block nằm trong dải `band` (12%) trên/dưới trang **và** nội dung
    (đã chuẩn hóa số) lặp ở >= `ratio` số trang. Block thuộc khối chữ ký / "Nơi
    nhận" luôn được giữ (ke-hoach/05 §2).
    """
    pages = sorted({b.page for b in blocks})
    if not pages:
        return set()
    counter: Counter[str] = Counter()
    candidates: dict[int, str] = {}
    for idx, block in enumerate(blocks):
        height = page_heights.get(block.page) or 0.0
        if height <= 0:
            continue
        top, bottom = block.bbox[1], block.bbox[3]
        in_band = top <= height * band or bottom >= height * (1 - band)
        if not in_band:
            continue
        first_line = block.text.splitlines()[0] if block.text else ""
        if RE_PROTECTED.match(first_line):
            continue
        key = _norm_running(block.text)
        if not key:
            continue
        candidates[idx] = key
        counter[key] += 1

    threshold = max(2, math.ceil(ratio * len(pages)))
    drop: set[int] = set()
    for idx, key in candidates.items():
        if counter[key] >= threshold or RE_PAGE_NUMBER_BLOCK.match(blocks[idx].text.strip()):
            drop.add(idx)
    return drop
