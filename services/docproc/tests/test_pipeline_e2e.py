"""Kiểm thử end-to-end trên PDF thử: chạy pipeline THẬT và kiểm tra kết quả.

Đây là bài kiểm thử chứng minh các yêu cầu bắt buộc của chủ đầu tư:
câu không bị ngắt qua trang, bảng qua trang thành MỘT bảng, header/số trang bị
loại, khối "Nơi nhận" được giữ, điều/khoản/điểm liên tục.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from docproc.pipeline import PipelineOptions, convert_file, extract_meta
from docproc.types import Route
from docproc.verify import collect_tables


def test_dinh_tuyen_va_diem_chat_luong(converted) -> None:
    assert converted.route is Route.C_PDF_TEXT
    assert converted.confidence > 0.9
    assert converted.page_count == 5
    assert converted.quality["score"] >= 0.95, converted.quality["warnings"]
    assert converted.quality["needs_review"] is False
    assert converted.warnings == []


def test_cau_bi_ngat_qua_trang_duoc_noi_lien(converted) -> None:
    md = converted.markdown
    # trang 1 -> 2
    assert "sử dụng nguồn vốn ngân sách nhà nước, bao gồm hoạt động chuẩn bị đầu tư" in md
    # trang 2 -> 3
    assert "đến việc bỏ vốn để mua sắm, nâng cấp hạ tầng kỹ thuật" in md
    # trang 3 -> 4 (bên trong điểm d)
    assert "pháp luật về ngân sách nhà nước và pháp luật về đầu tư công;" in md


def test_khong_con_dong_bi_cat_giua_cau(converted) -> None:
    """Không dòng văn xuôi nào kết thúc mà câu còn dở, trừ tiêu đề/bảng/marker."""
    from docproc.labels import is_heading, is_label_start, is_sentence_end, is_table_row
    from docproc.stitch import is_allcaps_line

    lines = [ln for ln in converted.markdown.splitlines() if ln.strip()]
    body = lines[lines.index("<!-- node: chuong-1 -->") :]
    for cur, nxt in zip(body, body[1:]):
        if is_table_row(cur) or is_heading(cur) or cur.startswith("<!--") or cur.startswith("$$"):
            continue
        # chức danh/quốc hiệu viết hoa toàn bộ là khối riêng, không phải câu dở
        if is_allcaps_line(cur) or is_allcaps_line(nxt):
            continue
        if is_sentence_end(cur):
            continue
        # dòng chưa kết thúc câu chỉ được phép đứng trước một nhãn/khối mới
        assert is_label_start(nxt) or nxt.startswith("<!--"), f"câu bị cắt: {cur!r} -> {nxt!r}"


def test_diem_a_den_dd_lien_tuc_va_khong_tao_nut_moi(converted) -> None:
    md = converted.markdown
    for letter in "abcdđ":
        assert f"<!-- node: dieu-3.khoan-2.diem-{letter} -->" in md
    # điểm d) chạy qua hai trang nhưng chỉ có MỘT nút
    assert md.count("<!-- node: dieu-3.khoan-2.diem-d -->") == 1


def test_bang_qua_trang_ghep_thanh_mot_bang(converted) -> None:
    md = converted.markdown
    tables = collect_tables(md)
    assert tables == [(7, 4)], f"phải là một bảng 7 hàng x 4 cột, nhận được {tables}"
    assert md.count("| STT | Hạng mục công việc | Đơn vị tính | Định mức |") == 1
    for row in ["| 1 | Khảo sát", "| 4 | Kiểm thử", "| 5 | Triển khai", "| 7 | Bảo hành"]:
        assert row in md


def test_header_cong_bao_va_so_trang_bi_loai(converted) -> None:
    md = converted.markdown
    assert "CÔNG BÁO" not in md
    body_lines = [ln.strip() for ln in md.splitlines() if ln.strip()]
    assert not any(re.fullmatch(r"\d{1,2}", ln) for ln in body_lines), "còn sót số trang"


def test_khoi_noi_nhan_va_chu_ky_duoc_giu(converted) -> None:
    md = converted.markdown
    assert "<!-- node: chu-ky -->" in md
    for line in [
        "Nơi nhận:",
        "- Ban Bí thư Trung ương Đảng;",
        "- Lưu: VT, KHCN.",
        "TM. CHÍNH PHỦ",
        "THỦ TƯỚNG",
        "Nguyễn Văn A",
    ]:
        assert line in md, f"thiếu dòng {line!r} trong khối cuối văn bản"


def test_dieu_khoan_lien_tuc(converted) -> None:
    md = converted.markdown
    for n in (1, 2, 3, 4):
        assert f"<!-- node: dieu-{n} -->" in md
    checks = {c["name"]: c for c in converted.quality["checks"]}
    assert checks["dieu_continuity"]["ok"] is True
    assert checks["khoan_continuity"]["ok"] is True
    assert checks["diem_continuity"]["ok"] is True


def test_marker_nut_va_front_matter(converted) -> None:
    md = converted.markdown
    assert md.startswith("---\nurn: vn:vbqppl:nd:45/2026/NĐ-CP\nversion: 1\n---")
    assert "<!-- node: chuong-1 -->" in md
    assert "<!-- node: can-cu -->" in md
    assert "<!-- node: phu-luc-1 -->" in md


def test_cong_thuc_thanh_latex_va_co_asset(converted) -> None:
    md = converted.markdown
    assert "$$ G_{PM} = \\sum (E_{i} \\times k_{i}) $$" in md
    formula = next(a for a in converted.assets if a.kind == "formula")
    assert formula.alt and "tổng" in formula.alt
    assert f"asset: {formula.id}" in md
    assert formula.needs_review is False


def test_asset_bang_co_so_hang_cot(converted) -> None:
    table = next(a for a in converted.assets if a.kind == "table")
    assert (table.rows, table.cols) == (7, 4)
    assert f"asset: {table.id}" in converted.markdown


def test_ghi_du_tep_dau_ra(fixture_pdf: Path, tmp_path: Path) -> None:
    result = convert_file(fixture_pdf, PipelineOptions(out_dir=tmp_path))
    assert (tmp_path / "document.md").read_text(encoding="utf-8") == result.markdown
    assets = json.loads((tmp_path / "assets.json").read_text(encoding="utf-8"))
    assert {a["kind"] for a in assets} == {"table", "formula"}
    report = json.loads((tmp_path / "result.json").read_text(encoding="utf-8"))
    assert report["route"] == "C"
    assert report["quality"]["score"] >= 0.95
    assert report["route_detail"]["signals"]["page_count"] == 5
    assert any("gazette_header" in d or "running_block" in d for d in report["dropped_lines"])
    assert report["meta"]["so_ky_hieu"] == "45/2026/NĐ-CP"
    assert report["meta"]["signer"] == "Nguyễn Văn A"


def test_extract_meta_tu_van_ban() -> None:
    text = "CHÍNH PHỦ\nSố: 45/2026/NĐ-CP\n\nNGHỊ ĐỊNH\n\nTM. CHÍNH PHỦ\nNguyễn Văn A"
    meta = extract_meta(text)
    assert meta["so_ky_hieu"] == "45/2026/NĐ-CP"
    assert meta["doc_type"] == "nd"
    assert meta["urn"] == "vn:vbqppl:nd:45/2026/NĐ-CP"
    assert meta["doc_heading"] == "NGHỊ ĐỊNH"
    assert meta["signer"] == "Nguyễn Văn A"


def test_convert_giu_header_khi_bat_co(fixture_pdf: Path, tmp_path: Path) -> None:
    result = convert_file(
        fixture_pdf, PipelineOptions(out_dir=tmp_path, keep_running_heads=True)
    )
    # bộ ghép vẫn loại "CÔNG BÁO/Số" theo quy tắc 2 dù không loại theo vị trí
    assert "CÔNG BÁO" not in result.markdown


def test_cli_convert_va_route(fixture_pdf: Path, tmp_path: Path, capsys) -> None:
    from docproc.cli import main

    assert main(["route", str(fixture_pdf), "--no-probe-ocr"]) == 0
    decision = json.loads(capsys.readouterr().out)
    assert decision["route"] == "C"

    assert main(["convert", str(fixture_pdf), "--out", str(tmp_path / "cli")]) == 0
    summary = json.loads(capsys.readouterr().out)
    assert summary["route"] == "C" and summary["quality_score"] >= 0.95
    assert Path(summary["output"]["markdown"]).exists()
