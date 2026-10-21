"""Fixture dùng chung cho bộ kiểm thử docproc."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "tests" / "fixtures"
FIXTURE_PDF = FIXTURE_DIR / "nghi-dinh-45-2026-nd-cp.pdf"


@pytest.fixture(scope="session")
def fixture_pdf() -> Path:
    """PDF thử mô phỏng Nghị định 45/2026/NĐ-CP; tự sinh lại nếu thiếu."""
    if not FIXTURE_PDF.exists():
        subprocess.run(
            [sys.executable, str(ROOT / "tools" / "make_fixture_pdf.py"), str(FIXTURE_PDF)],
            check=True,
            cwd=ROOT,
        )
    return FIXTURE_PDF


@pytest.fixture(scope="session")
def converted(fixture_pdf: Path, tmp_path_factory: pytest.TempPathFactory):
    """Chạy pipeline thật một lần trên PDF thử, dùng lại cho nhiều bài kiểm thử."""
    from docproc.pipeline import PipelineOptions, convert_file

    out = tmp_path_factory.mktemp("convert")
    return convert_file(fixture_pdf, PipelineOptions(out_dir=out))
