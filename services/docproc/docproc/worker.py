"""Worker hàng đợi `docproc`: lấy job từ bảng `jobs` trong Postgres, chuyển đổi,
ghi Markdown + assets ra `STORAGE_DIR`, cập nhật job và ghi `pipeline_runs`.

Cách lấy job giống hệt `claimJob` trong `packages/db/src/repo.ts`:
`UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1)` để nhiều worker
(TypeScript và Python) chạy song song không tranh nhau một job.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .pipeline import PipelineOptions, convert_file
from .types import Route

QUEUE = "docproc"
LOG = logging.getLogger("docproc.worker")

CLAIM_SQL = """
UPDATE jobs SET state = 'active', attempts = attempts + 1, started_at = now()
WHERE id = (
  SELECT id FROM jobs
  WHERE queue = ANY(%(queues)s) AND state = 'pending' AND run_after <= now()
  ORDER BY priority DESC, id ASC
  FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING id, queue, payload, attempts, max_attempts
"""

FINISH_OK_SQL = "UPDATE jobs SET state = 'done', finished_at = now() WHERE id = %(id)s"

FINISH_ERR_SQL = """
UPDATE jobs
SET state = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
    last_error = %(error)s,
    run_after = now() + (interval '1 minute' * attempts)
WHERE id = %(id)s
"""

RUN_SQL = """
INSERT INTO pipeline_runs (document_id, step, route, status, model, prompt_version,
                           tokens_in, tokens_out, cost_usd, duration_ms, warnings, error,
                           finished_at)
VALUES (%(document_id)s, %(step)s, %(route)s, %(status)s, %(model)s, %(prompt_version)s,
        %(tokens_in)s, %(tokens_out)s, %(cost_usd)s, %(duration_ms)s, %(warnings)s,
        %(error)s, now())
RETURNING id
"""


def database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "Thiếu DATABASE_URL (ví dụ postgres://qdpl:qdpl_dev@127.0.0.1:5436/quydinhphapluat)."
        )
    return url


def storage_dir() -> Path:
    return Path(os.environ.get("STORAGE_DIR") or "./data")


@dataclass
class Job:
    id: int
    queue: str
    payload: dict[str, Any]
    attempts: int
    max_attempts: int


def _connect():
    import psycopg

    return psycopg.connect(database_url(), autocommit=True)


def claim_job(conn, queues: list[str] | None = None) -> Job | None:
    """Lấy và khóa một job (SKIP LOCKED) — tương đương `claimJob` bên TypeScript."""
    with conn.cursor() as cur:
        cur.execute(CLAIM_SQL, {"queues": queues or [QUEUE]})
        row = cur.fetchone()
    if not row:
        return None
    payload = row[2]
    if isinstance(payload, (str, bytes)):
        payload = json.loads(payload)
    return Job(id=int(row[0]), queue=row[1], payload=payload or {}, attempts=int(row[3]), max_attempts=int(row[4]))


def finish_job(conn, job_id: int, error: str | None = None) -> None:
    with conn.cursor() as cur:
        if error is None:
            cur.execute(FINISH_OK_SQL, {"id": job_id})
        else:
            cur.execute(FINISH_ERR_SQL, {"id": job_id, "error": error[:4000]})


def log_run(conn, **fields: Any) -> str | None:
    """Ghi một bản ghi `pipeline_runs` (audit + tính lại khi đổi mô hình)."""
    params = {
        "document_id": fields.get("document_id"),
        "step": fields.get("step", "convert"),
        "route": fields.get("route"),
        "status": fields.get("status", "ok"),
        "model": fields.get("model"),
        "prompt_version": fields.get("prompt_version"),
        "tokens_in": fields.get("tokens_in"),
        "tokens_out": fields.get("tokens_out"),
        "cost_usd": fields.get("cost_usd"),
        "duration_ms": fields.get("duration_ms"),
        "warnings": json.dumps(fields.get("warnings") or [], ensure_ascii=False),
        "error": fields.get("error"),
    }
    with conn.cursor() as cur:
        cur.execute(RUN_SQL, params)
        row = cur.fetchone()
    return str(row[0]) if row else None


def resolve_path(raw: str) -> Path:
    """Đường dẫn trong payload có thể tuyệt đối hoặc tương đối `STORAGE_DIR`."""
    p = Path(raw)
    return p if p.is_absolute() else (storage_dir() / p)


def options_from_payload(payload: dict[str, Any], out_dir: Path) -> PipelineOptions:
    return PipelineOptions(
        out_dir=out_dir,
        use_llm=bool(payload.get("useLlm", False)),
        window_size=int(payload.get("windowSize", 5)),
        overlap=int(payload.get("overlap", 1)),
        dpi=int(payload.get("dpi", 300)),
        keep_running_heads=bool(payload.get("keepRunningHeads", False)),
    )


def process_job(conn, job: Job) -> dict[str, Any]:
    """Xử lý một job `docproc`; ném lỗi nếu thất bại (không nuốt lỗi)."""
    payload = job.payload
    input_raw = payload.get("inputPath") or payload.get("input_path")
    if not input_raw:
        raise ValueError(f"job {job.id} thiếu trường payload.inputPath")
    src = resolve_path(str(input_raw))
    if not src.exists():
        raise FileNotFoundError(f"job {job.id}: không thấy tệp đầu vào {src}")

    document_id = payload.get("documentId") or payload.get("document_id")
    out_raw = payload.get("outputDir") or payload.get("output_dir") or f"out/{document_id or job.id}"
    out_dir = resolve_path(str(out_raw))

    started = time.time()
    try:
        result = convert_file(src, options_from_payload(payload, out_dir))
    except Exception as exc:
        log_run(
            conn,
            document_id=document_id,
            step="convert",
            status="error",
            duration_ms=int((time.time() - started) * 1000),
            error=f"{type(exc).__name__}: {exc}",
        )
        raise

    duration_ms = int((time.time() - started) * 1000)
    run_id = log_run(
        conn,
        document_id=document_id,
        step="convert",
        route=result.route.value,
        status="ok" if result.quality.get("score", 0) >= 0.95 else "needs_review",
        model=os.environ.get("LLM_MODEL_HEAVY") if payload.get("useLlm") else None,
        prompt_version=payload.get("promptVersion", "v1"),
        duration_ms=duration_ms,
        warnings=result.warnings,
    )
    LOG.info(
        "job %s xong: tuyến %s, điểm %.3f, %s cảnh báo, %s ms -> %s",
        job.id, result.route.value, result.quality.get("score", 0.0),
        len(result.warnings), duration_ms, out_dir,
    )
    return {
        "run_id": run_id,
        "route": result.route.value,
        "quality": result.quality,
        "out_dir": str(out_dir),
        "duration_ms": duration_ms,
    }


class Worker:
    """Vòng lặp worker: poll -> claim -> process -> finish."""

    def __init__(self, queues: list[str] | None = None, poll_seconds: float = 2.0) -> None:
        self.queues = queues or [QUEUE]
        self.poll_seconds = poll_seconds
        self._stop = False

    def stop(self, *_: Any) -> None:
        self._stop = True

    def run_once(self, conn) -> dict[str, Any] | None:
        job = claim_job(conn, self.queues)
        if job is None:
            return None
        try:
            info = process_job(conn, job)
        except Exception as exc:
            LOG.error("job %s thất bại: %s\n%s", job.id, exc, traceback.format_exc())
            finish_job(conn, job.id, f"{type(exc).__name__}: {exc}")
            return {"job_id": job.id, "error": str(exc)}
        finish_job(conn, job.id, None)
        return {"job_id": job.id, **info}

    def run(self, max_jobs: int | None = None) -> int:
        """Chạy đến khi bị dừng (SIGINT/SIGTERM) hoặc đủ `max_jobs`."""
        signal.signal(signal.SIGINT, self.stop)
        signal.signal(signal.SIGTERM, self.stop)
        done = 0
        with _connect() as conn:
            LOG.info("worker docproc bắt đầu, hàng đợi=%s", ",".join(self.queues))
            while not self._stop and (max_jobs is None or done < max_jobs):
                result = self.run_once(conn)
                if result is None:
                    time.sleep(self.poll_seconds)
                    continue
                done += 1
        LOG.info("worker dừng sau %d job", done)
        return done


def enqueue(conn, payload: dict[str, Any], *, queue: str = QUEUE, priority: int = 0) -> int:
    """Tiện ích đẩy job (dùng cho kiểm thử và cho script vận hành)."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO jobs (queue, payload, priority) VALUES (%s, %s, %s) RETURNING id",
            (queue, json.dumps(payload, ensure_ascii=False), priority),
        )
        return int(cur.fetchone()[0])
