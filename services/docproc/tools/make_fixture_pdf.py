"""Sinh PDF thử mô phỏng một văn bản QPPL tiếng Việt nhiều trang.

Dữ liệu thử này cố ý chứa đủ các ca khó mà bộ ghép phải xử lý:

* câu bị ngắt giữa chừng qua ranh giới trang (trang 1→2, 2→3, 3→4),
* điểm d) bắt đầu ở cuối trang 3 và tiếp tục ở đầu trang 4,
* một bảng bị cắt qua trang 4→5, có hàng tiêu đề lặp lại ở đầu trang 5,
* điểm a), b), c), d), đ) theo bảng chữ cái pháp lý,
* một công thức tính chi phí,
* header "CÔNG BÁO/Số 123 + 124" và số trang ở mọi trang,
* khối "Nơi nhận" + chữ ký ở cuối văn bản.

Chạy: `python tools/make_fixture_pdf.py [đường/dẫn/ra.pdf]`
"""

from __future__ import annotations

import sys
from pathlib import Path

import pymupdf

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

PAGE_W, PAGE_H = 595.0, 842.0
MARGIN_X = 60.0
BODY_TOP = 110.0
LINE_H = 15.0
FONT_SIZE = 10.0

GAZETTE_HEADER = "CÔNG BÁO/Số 123 + 124   Ngày 15-6-2026"

TABLE_HEADER = ["STT", "Hạng mục công việc", "Đơn vị tính", "Định mức"]
TABLE_ROWS_P4 = [
    ["1", "Khảo sát, phân tích yêu cầu", "Người-ngày", "12"],
    ["2", "Thiết kế hệ thống thông tin", "Người-ngày", "18"],
    ["3", "Lập trình phần mềm nội bộ", "Người-ngày", "45"],
    ["4", "Kiểm thử và nghiệm thu", "Người-ngày", "20"],
]
TABLE_ROWS_P5 = [
    ["5", "Triển khai, cài đặt", "Người-ngày", "15"],
    ["6", "Đào tạo chuyển giao", "Người-ngày", "8"],
    ["7", "Bảo hành, bảo trì", "Tháng", "12"],
]
COL_W = [40.0, 230.0, 110.0, 95.0]

# Mỗi phần tử là (kiểu, nội dung); kiểu "b" = in đậm, "t" = thường, "" = dòng trống.
PAGES: list[list[tuple[str, str]]] = [
    # ---- trang 1 -------------------------------------------------------
    [
        ("right", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"),
        ("right", "Độc lập - Tự do - Hạnh phúc"),
        ("b", "CHÍNH PHỦ"),
        ("t", "Số: 45/2026/NĐ-CP"),
        ("", ""),
        ("b", "NGHỊ ĐỊNH"),
        ("t", "Quy định quản lý đầu tư ứng dụng công nghệ thông tin sử dụng nguồn vốn"),
        ("t", "ngân sách nhà nước"),
        ("", ""),
        ("t", "Căn cứ Luật Tổ chức Chính phủ ngày 18 tháng 02 năm 2025;"),
        ("t", "Căn cứ Luật Ban hành văn bản quy phạm pháp luật số 64/2025/QH15;"),
        ("t", "Theo đề nghị của Bộ trưởng Bộ Khoa học và Công nghệ;"),
        ("t", "Chính phủ ban hành Nghị định quy định quản lý đầu tư ứng dụng công nghệ thông tin."),
        ("", ""),
        ("b", "Chương I. QUY ĐỊNH CHUNG"),
        ("", ""),
        ("b", "Điều 1. Phạm vi điều chỉnh"),
        ("t", "1. Nghị định này quy định về quản lý đầu tư ứng dụng công nghệ thông tin sử"),
        ("t", "dụng nguồn vốn"),
    ],
    # ---- trang 2: câu của khoản 1 chạy tiếp từ trang 1 -------------------
    [
        ("t", "ngân sách nhà nước, bao gồm hoạt động chuẩn bị đầu tư, thực hiện đầu tư và"),
        ("t", "quyết toán dự án hoàn thành."),
        ("t", "2. Đối tượng áp dụng của Nghị định này gồm:"),
        ("t", "a) Cơ quan nhà nước, đơn vị sự nghiệp công lập sử dụng ngân sách nhà nước để"),
        ("t", "đầu tư ứng dụng công nghệ thông tin;"),
        ("t", "b) Tổ chức, cá nhân tham gia hoạt động đầu tư quy định tại điểm a khoản này;"),
        ("t", "c) Tổ chức, cá nhân khác có liên quan."),
        ("", ""),
        ("b", "Điều 2. Giải thích từ ngữ"),
        ("t", "Trong Nghị định này, các từ ngữ dưới đây được hiểu như sau:"),
        ("t", "1. Dự án đầu tư ứng dụng công nghệ thông tin là tập hợp các đề xuất có liên quan"),
        ("t", "đến việc bỏ vốn để"),
    ],
    # ---- trang 3: câu của khoản 1 Điều 2 chạy tiếp; điểm d) bị cắt cuối trang
    [
        ("t", "mua sắm, nâng cấp hạ tầng kỹ thuật và phần mềm nội bộ trong một thời hạn xác định."),
        ("t", "2. Chi phí đầu tư là toàn bộ chi phí cần thiết để thực hiện dự án."),
        ("", ""),
        ("b", "Điều 3. Nguyên tắc quản lý đầu tư"),
        ("t", "1. Việc đầu tư phải bảo đảm đúng mục tiêu, tiết kiệm và hiệu quả."),
        ("t", "2. Công khai, minh bạch trong toàn bộ quá trình đầu tư, cụ thể như sau:"),
        ("t", "a) Thông tin về dự án được công bố trên cổng thông tin điện tử của chủ đầu tư;"),
        ("t", "b) Kết quả lựa chọn nhà thầu được công khai theo pháp luật về đấu thầu;"),
        ("t", "c) Báo cáo giám sát, đánh giá đầu tư được gửi cơ quan có thẩm quyền;"),
        ("t", "d) Việc thanh toán, quyết toán vốn đầu tư được thực hiện theo quy định của"),
        ("t", "pháp luật về ngân sách"),
    ],
    # ---- trang 4: tiếp điểm d), điểm đ), công thức, bảng bắt đầu ---------
    [
        ("t", "nhà nước và pháp luật về đầu tư công;"),
        ("t", "đ) Các nội dung khác theo quy định của pháp luật có liên quan."),
        ("", ""),
        ("b", "Điều 4. Chi phí đầu tư của dự án"),
        ("t", "1. Chi phí đầu tư của dự án được xác định theo công thức sau:"),
        ("t", "G(PM) = Σ (E_i × k_i)"),
        ("t", "Trong đó: G(PM) là chi phí phần mềm nội bộ; E_i là giá trị hạng mục thứ i;"),
        ("t", "k_i là hệ số điều chỉnh theo vùng."),
        ("", ""),
        ("b", "PHỤ LỤC I"),
        ("b", "Bảng 1. ĐỊNH MỨC CHI PHÍ ĐẦU TƯ ỨNG DỤNG CÔNG NGHỆ THÔNG TIN"),
        ("table_start", ""),
    ],
    # ---- trang 5: bảng chạy tiếp (tiêu đề lặp), nơi nhận, chữ ký ---------
    [
        ("table_cont", ""),
        ("", ""),
        ("t", "Nơi nhận:"),
        ("t", "- Ban Bí thư Trung ương Đảng;"),
        ("t", "- Thủ tướng, các Phó Thủ tướng Chính phủ;"),
        ("t", "- Các bộ, cơ quan ngang bộ;"),
        ("t", "- Lưu: VT, KHCN."),
        ("", ""),
        ("b", "TM. CHÍNH PHỦ"),
        ("b", "THỦ TƯỚNG"),
        ("", ""),
        ("t", "Nguyễn Văn A"),
    ],
]


def _draw_table(page, x: float, y: float, rows: list[list[str]], font: str) -> float:
    """Vẽ bảng có kẻ khung để `find_tables()` nhận ra được."""
    row_h = 20.0
    total_w = sum(COL_W)
    for r, row in enumerate(rows):
        cy = y + r * row_h
        page.draw_rect(pymupdf.Rect(x, cy, x + total_w, cy + row_h), color=(0, 0, 0), width=0.6)
        cx = x
        for c, width in enumerate(COL_W):
            page.draw_line(pymupdf.Point(cx, cy), pymupdf.Point(cx, cy + row_h), color=(0, 0, 0), width=0.6)
            text = row[c] if c < len(row) else ""
            page.insert_text(
                pymupdf.Point(cx + 4, cy + 13.5), text, fontname=font, fontsize=9.0
            )
            cx += width
        page.draw_line(
            pymupdf.Point(cx, cy), pymupdf.Point(cx, cy + row_h), color=(0, 0, 0), width=0.6
        )
    return y + len(rows) * row_h


def build(out_path: str | Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()

    for page_idx, items in enumerate(PAGES, start=1):
        page = doc.new_page(width=PAGE_W, height=PAGE_H)
        page.insert_font(fontname="DJV", fontfile=FONT_REGULAR)
        page.insert_font(fontname="DJVB", fontfile=FONT_BOLD)

        # header Công báo (lặp ở mọi trang) + số trang ở chân trang
        page.insert_text(
            pymupdf.Point(MARGIN_X, 45.0), GAZETTE_HEADER, fontname="DJV", fontsize=9.0
        )
        page.insert_text(
            pymupdf.Point(PAGE_W / 2 - 5, PAGE_H - 30.0), str(page_idx), fontname="DJV", fontsize=9.0
        )

        y = BODY_TOP
        for kind, text in items:
            if kind == "table_start":
                y = _draw_table(page, MARGIN_X, y + 4, [TABLE_HEADER] + TABLE_ROWS_P4, "DJV")
                continue
            if kind == "table_cont":
                # hàng tiêu đề LẶP LẠI ở đầu trang sau — bộ ghép phải bỏ
                y = _draw_table(page, MARGIN_X, y, [TABLE_HEADER] + TABLE_ROWS_P5, "DJV")
                continue
            if kind == "right":
                # quốc hiệu, tiêu ngữ căn về nửa phải trang như văn bản thật
                page.insert_text(pymupdf.Point(300.0, y), text, fontname="DJVB", fontsize=FONT_SIZE)
                y += LINE_H
                continue
            if not text:
                y += LINE_H * 1.2   # khoảng trống đủ lớn để tách khối văn bản
                continue
            font = "DJVB" if kind == "b" else "DJV"
            page.insert_text(
                pymupdf.Point(MARGIN_X, y), text, fontname=font, fontsize=FONT_SIZE
            )
            y += LINE_H

    doc.subset_fonts()  # nhúng tối thiểu bộ ký tự -> tệp fixture nhỏ gọn
    doc.save(str(out), garbage=4, deflate=True)
    doc.close()
    return out


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/nghi-dinh-45-2026-nd-cp.pdf"
    path = build(target)
    print(f"đã tạo {path} ({path.stat().st_size} byte)")
