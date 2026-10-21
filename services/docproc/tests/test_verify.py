"""Kiểm thử bộ kiểm chứng tự động (ke-hoach/05 §5)."""

from __future__ import annotations

import pytest

from docproc import verify as V


def test_dieu_lien_tuc() -> None:
    md = "### Điều 1. A\n\n### Điều 2. B\n\n### Điều 3. C\n"
    assert V.check_dieu_continuity(md).ok is True


def test_dieu_thieu_bi_phat_hien() -> None:
    check = V.check_dieu_continuity("### Điều 1. A\n\n### Điều 4. D\n")
    assert check.ok is False
    assert "thiếu Điều 2, 3" in check.detail


def test_dieu_trung_bi_phat_hien() -> None:
    check = V.check_dieu_continuity("### Điều 1. A\n\n### Điều 1. B\n")
    assert check.ok is False
    assert "lặp" in check.detail


def test_dieu_bo_sung_dang_12a_duoc_chap_nhan() -> None:
    md = "### Điều 12. A\n\n### Điều 12a. B\n\n### Điều 13. C\n"
    assert V.check_dieu_continuity(md).ok is True


def test_khoan_lien_tuc() -> None:
    md = "### Điều 1. A\n\n1. Một.\n\n2. Hai.\n\n3. Ba.\n"
    assert V.check_khoan_continuity(md).ok is True
    bad = "### Điều 1. A\n\n1. Một.\n\n3. Ba.\n"
    assert V.check_khoan_continuity(bad).ok is False


def test_diem_theo_bang_chu_cai_phap_ly() -> None:
    md = "### Điều 1. A\n\n1. Một:\n\na) A.\n\nb) B.\n\nc) C.\n\nd) D.\n\nđ) Đ.\n\ne) E.\n\ng) G.\n"
    assert V.check_diem_continuity(md).ok is True


def test_diem_nhay_coc_bi_phat_hien() -> None:
    md = "### Điều 1. A\n\n1. Một:\n\na) A.\n\nc) C.\n"
    check = V.check_diem_continuity(md)
    assert check.ok is False
    assert "sau điểm a phải là b" in check.detail


def test_diem_khong_bat_dau_bang_a_bi_phat_hien() -> None:
    md = "### Điều 1. A\n\n1. Một:\n\nb) B.\n"
    assert V.check_diem_continuity(md).ok is False


def test_do_dai_trong_nguong_8_phan_tram() -> None:
    md = "### Điều 1. Phạm vi\n\n1. Nghị định này quy định.\n"
    n = V.nonspace_len(V.plain_text(md))
    assert V.check_length(md, n).ok is True
    assert V.check_length(md, int(n * 1.3)).ok is False


def test_bang_khop_layout() -> None:
    md = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n"
    assert V.collect_tables(md) == [(2, 2)]
    assert V.check_tables(md, [(2, 2)]).ok is True
    assert V.check_tables(md, [(2, 2), (1, 1)]).ok is False
    assert V.check_tables(md, [(9, 2)]).ok is False


def test_bang_html_gop_o_duoc_dem() -> None:
    md = "<table>\n  <tr><th>A</th><th>B</th></tr>\n  <tr><td colspan=\"2\">x</td></tr>\n</table>"
    assert V.collect_tables(md) == [(1, 2)]


def test_cong_thuc_latex_parse_duoc() -> None:
    assert V.check_formulas("$$ G_{PM} = \\sum (E_i) $$").ok is True
    bad = V.check_formulas("$$ G_{PM = \\sum (E_i $$")
    assert bad.ok is False


@pytest.mark.parametrize("word", ["nghiêng", "quyền", "trường", "đầu", "khoản", "nghị"])
def test_am_tiet_tieng_viet_hop_le(word: str) -> None:
    assert V.is_vietnamese_syllable(word) is True


@pytest.mark.parametrize("word", ["fjwz", "xzqw", "jozz", "wfgh"])
def test_am_tiet_khong_hop_le(word: str) -> None:
    assert V.is_vietnamese_syllable(word) is False


def test_ty_le_tu_la_vuot_nguong() -> None:
    md = "### Điều 1. A\n\n1. " + " ".join(["nghị"] * 50 + ["fjwz"] * 5) + ".\n"
    check = V.check_vocabulary(md)
    assert check.ok is False
    assert "fjwz" in check.detail


def test_tu_viet_tat_phap_ly_khong_bi_tinh_la_tu_la() -> None:
    bad, ratio = V.unknown_words("Nghị định số 45/2026/NĐ-CP của Chính phủ và UBND tỉnh.")
    assert ratio == 0.0
    assert bad == []


def test_chu_ky_va_nguoi_ky() -> None:
    md = "Nơi nhận:\n- Lưu: VT.\n\nTM. CHÍNH PHỦ\n\nNguyễn Văn A\n"
    assert V.check_signature(md).ok is True
    assert V.check_signature(md, signer="Nguyễn Văn A").ok is True
    assert V.check_signature(md, signer="Trần Thị B").ok is False
    assert V.check_signature("### Điều 1. A\n").ok is False


def test_doi_chieu_ban_tham_chieu() -> None:
    md = "### Điều 1. Phạm vi điều chỉnh của Nghị định này.\n"
    same = V.check_reference(md, md)
    assert same is not None and same.ok is True
    diff = V.check_reference(md, "### Điều 1. Một nội dung hoàn toàn khác biệt.\n")
    assert diff is not None and diff.ok is False
    assert V.check_reference(md, None) is None


def test_diem_tong_hop_va_needs_review() -> None:
    good = (
        "### Điều 1. Phạm vi\n\n1. Nghị định này quy định.\n\n"
        "### Điều 2. Hiệu lực\n\n1. Nghị định này có hiệu lực.\n\n"
        "Nơi nhận:\n- Lưu: VT.\n\nTM. CHÍNH PHỦ\n"
    )
    result = V.verify(good, source_chars=V.nonspace_len(V.plain_text(good)))
    assert result.score == pytest.approx(1.0)
    assert result.needs_review is False

    bad = "### Điều 1. A\n\n### Điều 5. B\n"
    assert V.verify(bad).score < 0.9
    assert V.verify(bad).needs_review is True


def test_plain_text_bo_front_matter_va_latex() -> None:
    md = "---\nurn: vn:x\n---\n\n<!-- node: dieu-1 -->\n### Điều 1. A\n\n$$ x \\times y $$\n"
    text = V.plain_text(md)
    assert "urn" not in text and "times" not in text and "node:" not in text
    assert "Điều 1. A" in text
