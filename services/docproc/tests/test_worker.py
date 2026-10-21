"""Kiểm thử worker hàng đợi `docproc` (cần Postgres đã chạy migration 0001)."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from docproc.worker import (
    Job,
    Worker,
    claim_job,
    enqueue,
    finish_job,
    log_run,
    options_from_payload,
    resolve_path,
)

DEFAULT_URL = "postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat"


def _db_available() -> bool:
    try:
        import psycopg

        with psycopg.connect(os.environ.get("DATABASE_URL", DEFAULT_URL), connect_timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT to_regclass('public.jobs'), to_regclass('public.pipeline_runs')")
                return all(cur.fetchone())
    except Exception:
        return False


DB_OK = _db_available()
needs_db = pytest.mark.skipif(not DB_OK, reason="không kết nối được Postgres hoặc thiếu bảng jobs")


def test_resolve_path_tuong_doi_storage_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path))
    assert resolve_path("raw/a.pdf") == tmp_path / "raw/a.pdf"
    assert resolve_path("/tmp/a.pdf") == Path("/tmp/a.pdf")


def test_options_from_payload() -> None:
    opts = options_from_payload(
        {"useLlm": True, "windowSize": 6, "overlap": 1, "dpi": 200}, Path("/tmp/out")
    )
    assert opts.use_llm is True and opts.window_size == 6 and opts.dpi == 200
    default = options_from_payload({}, Path("/tmp/out"))
    assert default.use_llm is False and default.window_size == 5 and default.overlap == 1


@pytest.fixture()
def conn(monkeypatch: pytest.MonkeyPatch):
    import psycopg

    # Bỏ qua ngay trong fixture, không đợi tới thân test: fixture chạy trước, nên thiếu CSDL
    # thì pytest báo ERROR chứ không phải "skipped" — CI đỏ vì một thành phần đã ngưng dùng.
    if not DB_OK:
        pytest.skip("không kết nối được Postgres hoặc thiếu bảng jobs")

    monkeypatch.setenv("DATABASE_URL", os.environ.get("DATABASE_URL", DEFAULT_URL))
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as c:
        yield c


@needs_db
@pytest.mark.integration
def test_claim_job_skip_locked_khong_tra_hai_lan(conn) -> None:
    queue = "docproc_test_claim"
    job_id = enqueue(conn, {"inputPath": "khong-dung.pdf"}, queue=queue)
    try:
        job = claim_job(conn, [queue])
        assert job is not None and job.id == job_id
        assert job.attempts == 1
        assert claim_job(conn, [queue]) is None, "job đang active không được lấy lại"
        finish_job(conn, job_id, None)
        with conn.cursor() as cur:
            cur.execute("SELECT state, finished_at FROM jobs WHERE id = %s", (job_id,))
            state, finished = cur.fetchone()
        assert state == "done" and finished is not None
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE queue = %s", (queue,))


@needs_db
@pytest.mark.integration
def test_finish_job_loi_thi_lui_lich_va_chet_khi_het_luot(conn) -> None:
    queue = "docproc_test_retry"
    job_id = enqueue(conn, {"inputPath": "x.pdf"}, queue=queue)
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE jobs SET max_attempts = 1 WHERE id = %s", (job_id,))
        claim_job(conn, [queue])
        finish_job(conn, job_id, "lỗi giả lập")
        with conn.cursor() as cur:
            cur.execute("SELECT state, last_error FROM jobs WHERE id = %s", (job_id,))
            state, error = cur.fetchone()
        assert state == "dead" and error == "lỗi giả lập"
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE queue = %s", (queue,))


@needs_db
@pytest.mark.integration
def test_worker_xu_ly_job_that_va_ghi_pipeline_runs(
    conn, fixture_pdf: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    queue = "docproc_test_run"
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path))
    out_rel = "out/nd-45"
    job_id = enqueue(conn, {"inputPath": str(fixture_pdf), "outputDir": out_rel}, queue=queue)
    try:
        result = Worker(queues=[queue]).run_once(conn)
        assert result is not None and result.get("error") is None
        assert result["route"] == "C"
        assert result["quality"]["score"] >= 0.95
        md = (tmp_path / out_rel / "document.md").read_text(encoding="utf-8")
        assert "<!-- node: dieu-1 -->" in md
        assert "| STT | Hạng mục công việc | Đơn vị tính | Định mức |" in md

        with conn.cursor() as cur:
            cur.execute("SELECT state FROM jobs WHERE id = %s", (job_id,))
            assert cur.fetchone()[0] == "done"
            cur.execute(
                "SELECT step, route, status FROM pipeline_runs WHERE id = %s", (result["run_id"],)
            )
            step, route, status = cur.fetchone()
        assert (step, route, status) == ("convert", "C", "ok")
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE queue = %s", (queue,))


@needs_db
@pytest.mark.integration
def test_worker_job_thieu_input_thi_that_bai_co_kiem_soat(conn) -> None:
    queue = "docproc_test_bad"
    job_id = enqueue(conn, {"khong_co_input": True}, queue=queue)
    try:
        result = Worker(queues=[queue]).run_once(conn)
        assert result is not None and "inputPath" in result["error"]
        with conn.cursor() as cur:
            cur.execute("SELECT state, last_error FROM jobs WHERE id = %s", (job_id,))
            state, error = cur.fetchone()
        assert state == "pending" and "inputPath" in error
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE queue = %s", (queue,))


@needs_db
@pytest.mark.integration
def test_log_run_ghi_ban_ghi_kiem_toan(conn) -> None:
    run_id = log_run(
        conn, step="convert", route="C", status="ok", model="claude-sonnet-5",
        prompt_version="v1", tokens_in=1000, tokens_out=500, cost_usd=0.01,
        duration_ms=1234, warnings=["cảnh báo thử"],
    )
    assert run_id
    with conn.cursor() as cur:
        cur.execute("SELECT model, tokens_in, warnings FROM pipeline_runs WHERE id = %s", (run_id,))
        model, tokens_in, warnings = cur.fetchone()
        cur.execute("DELETE FROM pipeline_runs WHERE id = %s", (run_id,))
    assert model == "claude-sonnet-5" and tokens_in == 1000
    assert warnings == ["cảnh báo thử"]


def test_worker_run_once_khong_co_job_thi_tra_none(conn) -> None:
    if not DB_OK:
        pytest.skip("không có Postgres")
    assert Worker(queues=["docproc_test_empty"]).run_once(conn) is None
