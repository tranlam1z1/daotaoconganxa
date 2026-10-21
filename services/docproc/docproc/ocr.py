"""OCR tiếng Việt và bỏ phiếu mức dòng (ke-hoach/05 §3).

* `TesseractEngine`  — Tesseract với gói ngôn ngữ `vie`, gọi qua CLI (`--psm 6 tsv`).
* `PaddleOcrEngine`  — PaddleOCR mô hình `vi`, engine chính khi có GPU.

Khi có từ hai engine trở lên, `vote_lines` bỏ phiếu ở **mức dòng**: gom các dòng
cùng vị trí (chồng lấn theo trục y), chọn chuỗi được nhiều engine đồng ý nhất,
hòa thì chọn dòng có confidence cao nhất.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from collections import Counter, defaultdict

from .types import OcrLine


class TesseractEngine:
    """Tesseract OCR — engine dự phòng, chạy được trên CPU."""

    name = "tesseract"

    def __init__(self, binary: str | None = None, psm: int = 6) -> None:
        self.binary = binary or os.environ.get("TESSERACT_BIN") or "tesseract"
        self.psm = psm

    def available(self) -> bool:
        if shutil.which(self.binary) is None:
            return False
        try:
            subprocess.run(
                [self.binary, "--version"], capture_output=True, check=True, timeout=20
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            return False
        return True

    def languages(self) -> list[str]:
        """Danh sách gói ngôn ngữ đã cài (cần có `vie` cho tiếng Việt)."""
        if shutil.which(self.binary) is None:
            return []
        proc = subprocess.run(
            [self.binary, "--list-langs"], capture_output=True, text=True, timeout=20
        )
        return [ln.strip() for ln in proc.stdout.splitlines()[1:] if ln.strip()]

    def recognize(self, image_path: str, lang: str = "vie") -> list[OcrLine]:
        if not self.available():
            raise RuntimeError(
                "Tesseract chưa được cài. Cài `tesseract-ocr` và gói `tesseract-ocr-vie` "
                "(xem README), hoặc dùng PaddleOCR."
            )
        proc = subprocess.run(
            [self.binary, image_path, "stdout", "-l", lang, "--psm", str(self.psm), "tsv"],
            capture_output=True,
            text=True,
            check=True,
        )
        return parse_tesseract_tsv(proc.stdout, engine=self.name)


def parse_tesseract_tsv(tsv: str, engine: str = "tesseract") -> list[OcrLine]:
    """Gom các từ trong TSV của Tesseract thành dòng kèm bbox và confidence."""
    rows = tsv.splitlines()
    if not rows:
        return []
    header = rows[0].split("\t")
    try:
        idx = {name: header.index(name) for name in
               ("level", "block_num", "par_num", "line_num", "left", "top", "width", "height", "conf", "text")}
    except ValueError as exc:
        raise ValueError(f"TSV Tesseract thiếu cột bắt buộc: {exc}") from exc

    groups: dict[tuple[str, str, str], list[list[str]]] = defaultdict(list)
    for row in rows[1:]:
        cells = row.split("\t")
        if len(cells) <= idx["text"]:
            continue
        if cells[idx["level"]] != "5":  # level 5 = word
            continue
        text = cells[idx["text"]].strip()
        if not text:
            continue
        key = (cells[idx["block_num"]], cells[idx["par_num"]], cells[idx["line_num"]])
        groups[key].append(cells)

    out: list[OcrLine] = []
    for cells_list in groups.values():
        words = [c[idx["text"]] for c in cells_list]
        lefts = [float(c[idx["left"]]) for c in cells_list]
        tops = [float(c[idx["top"]]) for c in cells_list]
        rights = [float(c[idx["left"]]) + float(c[idx["width"]]) for c in cells_list]
        bottoms = [float(c[idx["top"]]) + float(c[idx["height"]]) for c in cells_list]
        confs = [float(c[idx["conf"]]) for c in cells_list if float(c[idx["conf"]]) >= 0]
        out.append(
            OcrLine(
                text=" ".join(words),
                bbox=(min(lefts), min(tops), max(rights), max(bottoms)),
                confidence=(sum(confs) / len(confs) / 100.0) if confs else 0.0,
                engine=engine,
            )
        )
    out.sort(key=lambda l: (round(l.bbox[1], 1), round(l.bbox[0], 1)))
    return out


class PaddleOcrEngine:
    """PaddleOCR mô hình tiếng Việt — engine chính khi môi trường cho phép.

    Cài: `pip install paddlepaddle paddleocr` (~2 GB; bản GPU nặng hơn).
    """

    name = "paddleocr"

    def __init__(self, lang: str = "vi", use_gpu: bool = False) -> None:
        self.lang = lang
        self.use_gpu = use_gpu
        self._ocr = None

    def available(self) -> bool:
        try:
            import paddleocr  # noqa: F401
        except ImportError:
            return False
        return True

    def _engine(self):
        if self._ocr is None:
            try:
                from paddleocr import PaddleOCR
            except ImportError as exc:
                raise RuntimeError(
                    "PaddleOCR chưa được cài. Chạy `pip install paddlepaddle paddleocr` "
                    "rồi đặt DOCPROC_OCR_ENGINES=paddleocr,tesseract."
                ) from exc
            self._ocr = PaddleOCR(lang=self.lang, use_angle_cls=True, show_log=False)
        return self._ocr

    def recognize(self, image_path: str, lang: str = "vi") -> list[OcrLine]:
        result = self._engine().ocr(image_path, cls=True)
        out: list[OcrLine] = []
        for page in result or []:
            for entry in page or []:
                box, (text, conf) = entry[0], entry[1]
                xs = [float(p[0]) for p in box]
                ys = [float(p[1]) for p in box]
                out.append(
                    OcrLine(
                        text=str(text).strip(),
                        bbox=(min(xs), min(ys), max(xs), max(ys)),
                        confidence=float(conf),
                        engine=self.name,
                    )
                )
        out.sort(key=lambda l: (round(l.bbox[1], 1), round(l.bbox[0], 1)))
        return out


def _overlaps(a: OcrLine, b: OcrLine, tol: float = 0.5) -> bool:
    """Hai dòng có cùng vị trí dọc không (chồng lấn > `tol` chiều cao)."""
    ay0, ay1 = a.bbox[1], a.bbox[3]
    by0, by1 = b.bbox[1], b.bbox[3]
    inter = min(ay1, by1) - max(ay0, by0)
    height = min(ay1 - ay0, by1 - by0)
    return height > 0 and inter / height >= tol


def vote_lines(results: list[list[OcrLine]]) -> list[OcrLine]:
    """Bỏ phiếu mức dòng giữa nhiều engine OCR.

    Dòng nào được nhiều engine cho ra cùng chuỗi thì thắng; hòa phiếu thì lấy
    dòng có confidence trung bình cao nhất. Kết quả giữ `engine` là danh sách
    engine đã đồng ý, phục vụ audit.
    """
    engines = [r for r in results if r]
    if not engines:
        return []
    if len(engines) == 1:
        return list(engines[0])

    base = max(engines, key=len)
    others = [r for r in engines if r is not base]
    out: list[OcrLine] = []
    for line in base:
        candidates = [line]
        for other in others:
            match = next((o for o in other if _overlaps(line, o)), None)
            if match is not None:
                candidates.append(match)
        counts = Counter(c.text for c in candidates)
        best_text, best_n = counts.most_common(1)[0]
        if best_n == 1:
            winner = max(candidates, key=lambda c: c.confidence)
        else:
            winner = max(
                (c for c in candidates if c.text == best_text), key=lambda c: c.confidence
            )
        agreed = sorted({c.engine for c in candidates if c.text == winner.text})
        out.append(
            OcrLine(
                text=winner.text,
                bbox=winner.bbox,
                confidence=sum(c.confidence for c in candidates if c.text == winner.text)
                / max(1, sum(1 for c in candidates if c.text == winner.text)),
                engine="+".join(agreed),
            )
        )
    return out


ENGINES: dict[str, type] = {
    "tesseract": TesseractEngine,
    "paddleocr": PaddleOcrEngine,
}


def available_engines(names: str | None = None) -> list[object]:
    """Trả các engine OCR thực sự chạy được (theo DOCPROC_OCR_ENGINES)."""
    wanted = (names or os.environ.get("DOCPROC_OCR_ENGINES") or "paddleocr,tesseract").split(",")
    out: list[object] = []
    for raw in wanted:
        key = raw.strip().lower()
        if not key:
            continue
        if key not in ENGINES:
            raise ValueError(f"engine OCR không hợp lệ: {key} (có: {', '.join(ENGINES)})")
        engine = ENGINES[key]()
        if engine.available():  # type: ignore[attr-defined]
            out.append(engine)
    return out


def recognize_page(image_path: str, lang: str = "vie") -> list[OcrLine]:
    """OCR một ảnh trang bằng mọi engine khả dụng rồi bỏ phiếu."""
    engines = available_engines()
    if not engines:
        raise RuntimeError(
            "Không có engine OCR nào khả dụng. Cài tesseract-ocr + tesseract-ocr-vie, "
            "hoặc `pip install paddlepaddle paddleocr` (xem README)."
        )
    results = []
    for engine in engines:
        engine_lang = "vi" if engine.name == "paddleocr" else lang  # type: ignore[attr-defined]
        results.append(engine.recognize(image_path, engine_lang))  # type: ignore[attr-defined]
    return vote_lines(results)


def mean_confidence(lines: list[OcrLine]) -> float:
    """Độ tin cậy OCR trung bình của trang (đầu vào cho bộ định tuyến)."""
    if not lines:
        return 0.0
    return sum(l.confidence for l in lines) / len(lines)
