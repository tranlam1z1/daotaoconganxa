"""Kiểm thử bộ ghép — phần quan trọng nhất (ke-hoach/05 §4.1–4.2).

Bao phủ đủ các ca bắt buộc: câu bị cắt giữa chừng qua trang, bảng qua trang,
điểm a) ở cuối trang tiếp tục ở trang sau, header lặp, số trang, gạch nối OCR,
và ghép hai cửa sổ bằng so khớp mờ trên trang chồng lấn.
"""

from __future__ import annotations

import pytest

from docproc.stitch import (
    StitchConfig,
    build_windows,
    clean_pages,
    detect_running_lines,
    find_overlap,
    join_lines,
    merge_windows,
    parse_table,
    render_table,
    should_join,
    stitch_pages,
    track_node_path,
    unwrap_lines,
    WindowResult,
)
from docproc.types import OpenState, PageChunk

HEADER = "CÔNG BÁO/Số 123 + 124   Ngày 15-6-2026"


def md_of(pages: list[PageChunk]) -> str:
    return stitch_pages(pages).markdown


# --- Quy tắc 1: nối câu/đoạn qua trang -------------------------------------


def test_cau_bi_cat_giua_chung_qua_trang_duoc_noi_lien() -> None:
    pages = [
        PageChunk(1, [HEADER, "1. Nghị định này quy định về quản lý đầu tư sử dụng nguồn vốn", "1"]),
        PageChunk(2, [HEADER, "ngân sách nhà nước, bao gồm chuẩn bị đầu tư và quyết toán.", "2"]),
    ]
    md = md_of(pages)
    assert "nguồn vốn ngân sách nhà nước" in md
    assert "nguồn vốn\nngân sách" not in md
    assert md.count("\n") <= 1  # đúng một đoạn duy nhất


def test_khong_noi_khi_dong_truoc_da_ket_thuc_cau() -> None:
    pages = [
        PageChunk(1, ["1. Nghị định này quy định về quản lý đầu tư."]),
        PageChunk(2, ["2. Đối tượng áp dụng gồm các cơ quan nhà nước."]),
    ]
    md = md_of(pages)
    assert "quản lý đầu tư.\n\n2. Đối tượng" in md


def test_khong_noi_khi_trang_sau_bat_dau_bang_nhan() -> None:
    for label in ["Điều 5. Trách nhiệm", "Chương II. THẨM ĐỊNH", "3. Khoản mới", "b) Điểm mới"]:
        pages = [
            PageChunk(1, ["Quy định tại khoản này được áp dụng cho mọi dự án đầu tư"]),
            PageChunk(2, [label]),
        ]
        md = md_of(pages)
        assert label in md
        assert f"đầu tư {label}" not in md


def test_diem_a_cuoi_trang_tiep_tuc_o_trang_sau() -> None:
    """Điểm d) mở ở cuối trang, phần còn lại ở trang sau: giữ một nút, không tạo nút mới."""
    pages = [
        PageChunk(1, [
            "2. Công khai, minh bạch trong quá trình đầu tư, cụ thể như sau:",
            "a) Thông tin về dự án được công bố công khai;",
            "d) Việc thanh toán, quyết toán vốn đầu tư thực hiện theo quy định của pháp luật về ngân sách",
            "3",
        ]),
        PageChunk(2, [HEADER, "nhà nước và pháp luật về đầu tư công;", "đ) Các nội dung khác.", "4"]),
    ]
    md = md_of(pages)
    assert "pháp luật về ngân sách nhà nước và pháp luật về đầu tư công;" in md
    # không sinh thêm nút: vẫn chỉ có một dòng bắt đầu bằng "d)"
    assert sum(1 for ln in md.splitlines() if ln.startswith("d)")) == 1
    assert "đ) Các nội dung khác." in md


def test_bo_gach_noi_cuoi_dong_do_ocr_sinh() -> None:
    pages = [
        PageChunk(1, ["Chủ đầu tư có trách nhiệm bố trí nguồn vốn để thực hiện dự án đầu"]),
        PageChunk(2, ["tư theo tiến độ."]),
    ]
    assert "dự án đầu tư theo tiến độ." in md_of(pages)

    pages_hyphen = [
        PageChunk(1, ["Chủ đầu tư có trách nhiệm bố trí nguồn vốn để thực hiện dự án đầu-"]),
        PageChunk(2, ["tư theo tiến độ."]),
    ]
    md = md_of(pages_hyphen)
    assert "dự án đầutư theo tiến độ." in md or "dự án đầu tư theo tiến độ." in md
    assert "đầu-" not in md


def test_join_lines_va_should_join_truc_tiep() -> None:
    assert should_join("nguồn vốn", "ngân sách") is True
    assert should_join("nguồn vốn.", "ngân sách") is False
    assert should_join("nguồn vốn", "Điều 5. Trách nhiệm") is False
    assert should_join("| a | b |", "c") is False
    assert join_lines("đầu-", "tư theo") == "đầutư theo"
    assert join_lines("nguồn vốn", "ngân sách") == "nguồn vốn ngân sách"


def test_unwrap_lines_gop_dong_hien_thi_trong_cung_trang() -> None:
    lines = [
        "1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử",
        "dụng nguồn vốn ngân sách nhà nước.",
        "2. Đối tượng áp dụng:",
    ]
    assert unwrap_lines(lines) == [
        "1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử dụng "
        "nguồn vốn ngân sách nhà nước.",
        "2. Đối tượng áp dụng:",
    ]


# --- Quy tắc 2: header, số trang -------------------------------------------


def test_loai_so_trang_va_header_cong_bao() -> None:
    pages = [
        PageChunk(1, [HEADER, "Điều 1. Phạm vi điều chỉnh", "- 1 -"]),
        PageChunk(2, [HEADER, "Điều 2. Giải thích từ ngữ", "2"]),
        PageChunk(3, [HEADER, "Điều 3. Nguyên tắc", "Trang 3"]),
    ]
    result = stitch_pages(pages)
    assert "CÔNG BÁO" not in result.markdown
    assert "- 1 -" not in result.markdown and "Trang 3" not in result.markdown
    assert result.markdown.splitlines() == [
        "Điều 1. Phạm vi điều chỉnh",
        "",
        "Điều 2. Giải thích từ ngữ",
        "",
        "Điều 3. Nguyên tắc",
    ]
    assert any("gazette_header" in d for d in result.dropped)
    assert any("page_number" in d for d in result.dropped)


def test_header_co_quan_lap_bi_loai_theo_tan_suat() -> None:
    running_head = "BỘ KHOA HỌC VÀ CÔNG NGHỆ"
    pages = [PageChunk(i, [running_head, f"Điều {i}. Nội dung điều {i}.", str(i)]) for i in range(1, 6)]
    detected = detect_running_lines(pages, StitchConfig())
    assert any("khoa học" in d for d in detected)
    md = md_of(pages)
    assert running_head not in md
    assert "Điều 3. Nội dung điều 3." in md


def test_giu_khoi_noi_nhan_va_chu_ky_du_lap() -> None:
    """Khối "Nơi nhận"/chữ ký phải được giữ, kể cả khi nội dung lặp giữa các trang."""
    tail = ["Nơi nhận:", "- Như Điều 3;", "- Lưu: VT.", "TM. CHÍNH PHỦ", "THỦ TƯỚNG"]
    pages = [
        PageChunk(1, [HEADER, "Điều 1. Phạm vi.", "1"]),
        PageChunk(2, [HEADER, "Điều 2. Đối tượng.", "2"]),
        PageChunk(3, [HEADER, "Điều 3. Hiệu lực.", *tail, "3"]),
    ]
    md = md_of(pages)
    for line in tail:
        assert line in md
    assert "CÔNG BÁO" not in md
    assert "\n3\n" not in md


def test_clean_pages_tra_ve_ly_do_loai() -> None:
    pages = [PageChunk(1, [HEADER, "Nội dung.", "1"])]
    _, dropped = clean_pages(pages)
    assert any(d.startswith("p1:gazette_header:") for d in dropped)
    assert any(d.startswith("p1:page_number:") for d in dropped)


# --- Quy tắc 3: bảng qua trang ---------------------------------------------


HEAD_ROW = "| STT | Hạng mục | Định mức |"
SEP_ROW = "| --- | --- | --- |"


def test_bang_qua_trang_duoc_noi_thanh_mot_bang() -> None:
    pages = [
        PageChunk(1, [HEADER, HEAD_ROW, SEP_ROW, "| 1 | Khảo sát | 12 |", "| 2 | Thiết kế | 18 |", "1"]),
        PageChunk(2, [HEADER, HEAD_ROW, SEP_ROW, "| 3 | Lập trình | 45 |", "| 4 | Kiểm thử | 20 |", "2"]),
    ]
    result = stitch_pages(pages)
    lines = [ln for ln in result.markdown.splitlines() if ln.strip()]
    assert lines.count(HEAD_ROW) == 1, "hàng tiêu đề lặp ở trang sau phải bị bỏ"
    assert len(result.tables) == 1
    assert result.tables[0].n_rows == 4
    assert result.tables[0].cols == 3
    assert "| 4 | Kiểm thử | 20 |" in result.markdown


def test_bang_qua_trang_khong_noi_khi_khac_so_cot() -> None:
    pages = [
        PageChunk(1, [HEAD_ROW, SEP_ROW, "| 1 | Khảo sát | 12 |"]),
        PageChunk(2, ["| A | B |", "| --- | --- |", "| 1 | 2 |"]),
    ]
    result = stitch_pages(pages)
    assert len(result.tables) == 2


def test_bang_qua_trang_khong_noi_khi_co_tieu_de_bang_moi() -> None:
    pages = [
        PageChunk(1, [HEAD_ROW, SEP_ROW, "| 1 | Khảo sát | 12 |"]),
        PageChunk(2, ["Bảng 2. ĐỊNH MỨC KHÁC", HEAD_ROW, SEP_ROW, "| 1 | Triển khai | 15 |"]),
    ]
    result = stitch_pages(pages)
    assert len(result.tables) == 2
    assert "Bảng 2. ĐỊNH MỨC KHÁC" in result.markdown


def test_bang_khong_co_tieu_de_lap_thi_giu_lai_hang_dau() -> None:
    pages = [
        PageChunk(1, [HEAD_ROW, SEP_ROW, "| 1 | Khảo sát | 12 |"]),
        PageChunk(2, ["| 2 | Thiết kế | 18 |", "| 3 | Lập trình | 45 |"]),
    ]
    result = stitch_pages(pages)
    assert len(result.tables) == 1
    assert result.tables[0].n_rows == 3


def test_parse_va_render_bang_khu_hoi() -> None:
    lines = [HEAD_ROW, SEP_ROW, "| 1 | Khảo sát | 12 |"]
    table, nxt = parse_table(lines, 0)
    assert nxt == 3
    assert table.header == ["STT", "Hạng mục", "Định mức"]
    assert table.n_rows == 1
    assert render_table(table)[0] == HEAD_ROW


# --- Trạng thái mở ---------------------------------------------------------


def test_open_state_khai_bao_dung_nut_dang_do() -> None:
    pages = [
        PageChunk(1, [
            "Điều 15. Trách nhiệm của chủ đầu tư",
            "2. Chủ đầu tư có trách nhiệm:",
            "c) Bố trí nguồn vốn theo tiến độ được duyệt và",
        ])
    ]
    state = stitch_pages(pages).open_state
    assert state.paragraph_open is True
    assert state.node_label == "điểm c khoản 2 Điều 15"
    assert state.table_open is False


def test_track_node_path() -> None:
    lines = ["Điều 7. A", "1. B", "a) C", "b) D", "Điều 8. E"]
    assert track_node_path(lines) == ("8", None, None)
    assert track_node_path(lines[:4]) == ("7", "1", "b")


# --- Cửa sổ trang chồng lấn -------------------------------------------------


@pytest.mark.parametrize(
    "count,size,overlap,expected",
    [
        (5, 5, 1, [[1, 2, 3, 4, 5]]),
        (9, 5, 1, [[1, 2, 3, 4, 5], [5, 6, 7, 8, 9]]),
        (10, 6, 1, [[1, 2, 3, 4, 5, 6], [6, 7, 8, 9, 10]]),
        (3, 4, 1, [[1, 2, 3]]),
        (0, 5, 1, []),
    ],
)
def test_build_windows(count: int, size: int, overlap: int, expected: list[list[int]]) -> None:
    assert build_windows(count, size, overlap) == expected


def test_build_windows_luon_chong_lan_dung_so_trang() -> None:
    windows = build_windows(13, 5, 1)
    for a, b in zip(windows, windows[1:]):
        assert a[-1] == b[0], "hai cửa sổ liền nhau phải chồng đúng 1 trang"


def test_find_overlap_so_khop_mo() -> None:
    prev = ["Điều 1. Phạm vi điều chỉnh", "1. Nghị định này quy định về quản lý đầu tư."]
    nxt = ["1. Nghị định này quy định về quản lý dầu tư."]  # sai khác nhỏ do OCR
    assert find_overlap(prev, nxt, StitchConfig()) == 1


def test_merge_windows_uu_tien_ban_cua_cua_so_sau() -> None:
    w1 = WindowResult(
        pages=[1, 2],
        markdown="Điều 1. Phạm vi\n\n1. Nghị định này quy định về quản lý dầu tư.\n",
        open_state=OpenState(paragraph_open=False),
    )
    w2 = WindowResult(
        pages=[2, 3],
        markdown="1. Nghị định này quy định về quản lý đầu tư.\n\nĐiều 2. Giải thích từ ngữ\n",
    )
    merged = merge_windows([w1, w2])
    assert merged.markdown.count("Nghị định này quy định") == 1
    assert "quản lý đầu tư." in merged.markdown   # bản của cửa sổ sau thắng
    assert "quản lý dầu tư." not in merged.markdown
    assert "Điều 2. Giải thích từ ngữ" in merged.markdown


def test_merge_windows_khong_chen_ngat_doan_khi_cau_chua_ket_thuc() -> None:
    w1 = WindowResult(
        pages=[1, 2],
        markdown="Điều 1. Phạm vi\n\n1. Nghị định này quy định về quản lý đầu tư sử dụng nguồn vốn",
        open_state=OpenState(paragraph_open=True),
    )
    w2 = WindowResult(pages=[2, 3], markdown="ngân sách nhà nước.\n\nĐiều 2. Giải thích\n")
    merged = merge_windows([w1, w2])
    assert "nguồn vốn ngân sách nhà nước." in merged.markdown


def test_merge_windows_noi_bang_qua_ranh_gioi_cua_so() -> None:
    w1 = WindowResult(
        pages=[1, 2],
        markdown=f"{HEAD_ROW}\n{SEP_ROW}\n| 1 | Khảo sát | 12 |",
        open_state=OpenState(table_open=True, table_cols=3),
    )
    w2 = WindowResult(pages=[2, 3], markdown=f"{HEAD_ROW}\n{SEP_ROW}\n| 2 | Thiết kế | 18 |")
    merged = merge_windows([w1, w2])
    assert merged.markdown.count("| STT | Hạng mục | Định mức |") == 1
    assert "| 1 | Khảo sát | 12 |" in merged.markdown
    assert "| 2 | Thiết kế | 18 |" in merged.markdown


def test_merge_windows_canh_bao_khi_khong_thay_vung_chong_lan() -> None:
    w1 = WindowResult(pages=[1], markdown="Nội dung hoàn toàn khác biệt một.\n")
    w2 = WindowResult(pages=[2], markdown="Nội dung hoàn toàn khác biệt hai ba bốn năm sáu.\n")
    merged = merge_windows([w1, w2], StitchConfig(fuzzy_threshold=0.99))
    assert any("chồng lấn" in w for w in merged.warnings)


def test_merge_windows_rong() -> None:
    assert merge_windows([]).markdown == ""


def test_mau_bao_ve_khoi_chu_ky_khop_ca_tm_va_kt() -> None:
    """Hồi quy: "TM."/"KT." kết thúc bằng dấu chấm nên mẫu không được dùng `\\b`."""
    from docproc.stitch import RE_PROTECTED

    for line in ["TM. CHÍNH PHỦ", "KT. BỘ TRƯỞNG", "TL. THỦ TƯỚNG", "Nơi nhận:", "THỦ TƯỚNG"]:
        assert RE_PROTECTED.match(line), line
    assert RE_PROTECTED.match("Điều 1. Phạm vi") is None


def test_is_allcaps_line() -> None:
    from docproc.stitch import is_allcaps_line

    assert is_allcaps_line("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM") is True
    assert is_allcaps_line("### CHƯƠNG I") is True
    assert is_allcaps_line("Nghị định này quy định") is False
    assert is_allcaps_line("123 456") is False


def test_join_adjacent_blocks_luoi_an_toan_sau_hop_nhat() -> None:
    from docproc.stitch import join_adjacent_blocks

    blocks = ["1. Nghị định này quy định về đầu tư sử dụng nguồn vốn", "ngân sách nhà nước."]
    assert join_adjacent_blocks(blocks) == [
        "1. Nghị định này quy định về đầu tư sử dụng nguồn vốn ngân sách nhà nước."
    ]
    keep = ["1. Nghị định này quy định.", "2. Đối tượng áp dụng."]
    assert join_adjacent_blocks(keep) == keep
