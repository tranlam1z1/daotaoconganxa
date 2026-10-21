"""Giao diện dòng lệnh: `python -m docproc <lệnh>`."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .pipeline import PipelineOptions, convert_file
from .router import route_file


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m docproc",
        description="Dịch vụ chuyển đổi tài liệu sang Markdown chuẩn nội bộ (quydinhphapluat.vn).",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="ghi log chi tiết")
    sub = parser.add_subparsers(dest="command", required=True)

    p_convert = sub.add_parser("convert", help="chuyển một tệp sang Markdown")
    p_convert.add_argument("file", help="đường dẫn tệp DOCX/HTML/PDF")
    p_convert.add_argument("--out", required=True, help="thư mục ghi kết quả")
    p_convert.add_argument("--llm", action="store_true", help="gọi agent AI tái cấu trúc theo cửa sổ trang")
    p_convert.add_argument("--window-size", type=int, default=5, help="số trang mỗi cửa sổ (4–6)")
    p_convert.add_argument("--overlap", type=int, default=1, help="số trang chồng lấn giữa hai cửa sổ")
    p_convert.add_argument("--dpi", type=int, default=300, help="DPI khi render ảnh trang")
    p_convert.add_argument("--keep-running-heads", action="store_true",
                           help="giữ nguyên header/footer lặp (để so sánh)")
    p_convert.add_argument("--print", action="store_true", help="in Markdown ra stdout")

    p_route = sub.add_parser("route", help="chỉ phân loại đầu vào, không chuyển đổi")
    p_route.add_argument("file", help="đường dẫn tệp")
    p_route.add_argument("--no-probe-ocr", action="store_true",
                         help="không chạy thử OCR để đo confidence")

    p_worker = sub.add_parser("worker", help="chạy worker hàng đợi `docproc`")
    p_worker.add_argument("--queue", action="append", default=None, help="tên hàng đợi (lặp lại được)")
    p_worker.add_argument("--max-jobs", type=int, default=None, help="dừng sau N job")
    p_worker.add_argument("--poll-seconds", type=float, default=2.0, help="chu kỳ poll khi hàng đợi rỗng")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.command == "route":
        decision = route_file(args.file, probe_ocr=not args.no_probe_ocr)
        print(json.dumps(decision.to_json(), ensure_ascii=False, indent=2))
        return 0

    if args.command == "convert":
        out_dir = Path(args.out)
        result = convert_file(
            args.file,
            PipelineOptions(
                out_dir=out_dir,
                use_llm=args.llm,
                window_size=args.window_size,
                overlap=args.overlap,
                dpi=args.dpi,
                keep_running_heads=args.keep_running_heads,
            ),
        )
        if args.print:
            print(result.markdown)
        summary = {
            "route": result.route.value,
            "confidence": result.confidence,
            "pages": result.page_count,
            "assets": len(result.assets),
            "quality_score": result.quality.get("score"),
            "warnings": result.warnings,
            "output": {
                "markdown": str(out_dir / "document.md"),
                "assets": str(out_dir / "assets.json"),
                "report": str(out_dir / "result.json"),
            },
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2), file=sys.stderr if args.print else sys.stdout)
        return 0 if result.quality.get("score", 0) >= 0.8 else 2

    if args.command == "worker":
        from .worker import Worker

        done = Worker(queues=args.queue, poll_seconds=args.poll_seconds).run(max_jobs=args.max_jobs)
        print(json.dumps({"processed": done}, ensure_ascii=False))
        return 0

    raise SystemExit(f"lệnh không hỗ trợ: {args.command}")
