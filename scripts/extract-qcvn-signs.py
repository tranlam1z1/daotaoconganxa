"""Reproduce the explicitly mapped sign excerpts from the official QCVN 41:2024 PDF.

This extracts source material only. The separate reviewed manifest and importer control publication.
Usage: python scripts/extract-qcvn-signs.py path/to/51-bgtvt-kem.pdf
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SOURCE = "https://datafiles.chinhphu.vn/cpp/files/vbpq/2024/11/51-bgtvt-kem.pdf"
# Each mapping was checked against the printed caption; composite R.301 is clipped explicitly.
MAPPING = [
    ("P.102", "B.2", 80, 791), ("P.103a", "B.3", 81, 799),
    ("P.106a", "B.6", 82, 811), ("P.123a", "B.23", 87, 869),
    ("P.127", "B.27", 90, 927), ("P.130", "B.30", 94, 949),
    ("P.131a", "B.31", 94, 951), ("W.224", "C.24", 107, 1087),
    ("W.225", "C.25", 107, 1089), ("R.302a", "D.2", 117, 1171),
    ("R.303", "D.3", 117, 1177), ("I.408", "E.8", 132, 1333),
    ("S.501", "F.1", 151, 1525), ("P.101", "B.1", 80, 789),
    ("P.123b", "B.23", 87, 871), ("P.124a", "B.24", 88, 874),
    ("P.128", "B.28", 93, 944), ("P.136", "B.36", 96, 967),
    ("W.201a", "C.1", 98, 979), ("W.203b", "C.3", 99, 994),
    ("W.207a", "C.7", 101, 1014), ("W.208", "C.8", 102, 1038),
    ("W.210", "C.10", 102, 1042), ("W.211", "C.11", 103, 1045),
    ("W.227", "C.27", 108, 1094), ("W.245a", "C.45", 113, 1149),
    ("R.122", "D.1", 115, 1163), ("R.301a", "D.1a", 116, 1166),
    ("I.409", "E.9", 133, 1338), ("I.423b", "E.23a", 137, 1382),
    ("I.434a", "E.36", 143, 1433),
]


def clean_page(text):
    text = re.sub(r"[\x00-\x09\x0b-\x1f]", " ", text)
    return "\n".join(line.strip() for line in text.splitlines() if not re.fullmatch(r"\s*\d+\s*", line))


def main():
    pdf = Path(sys.argv[1])
    doc = pymupdf.open(pdf)
    # Only the explanatory appendices B-F, excluding the separate engineering plates.
    text = "\n".join(clean_page(doc[i].get_text()) for i in range(79, 156))
    headings = list(re.finditer(r"(?m)^\s*([BCDEF]\.\d+[a-z]?)\s+Biển", text))
    sections = {h[1]: text[h.start():headings[i+1].start() if i+1 < len(headings) else len(text)].strip()
                for i, h in enumerate(headings)}
    old = json.loads((ROOT / "data/bien-bao/bien-bao.json").read_text(encoding="utf-8"))["bien"]
    old = {r["ma"].replace("W.211a", "W.211"): r for r in old}
    out_dir = ROOT / "data/bien-bao/anh-qcvn-2024"
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for code, section, page, xref in MAPPING:
        fragment = sections[section]
        fragment = re.sub(r"[ \t]+", " ", fragment).replace("tr ừ", "trừ")
        figure_at = re.search(r"(?m)^\s*Hình", fragment)
        # Summary is an exact source excerpt; the complete section is stored alongside it.
        excerpt = fragment[:figure_at.start()].strip() if figure_at else fragment
        first_body = re.search(r"(?m)^a\)\s|^Để\s|^Đường\s|^Dùng\s", excerpt)
        meaning = excerpt[first_body.start():].strip() if first_body else excerpt
        meaning = re.sub(r"(?m)^[a-z]\) Biển số [A-Z]\.\d+[a-z]?\s*$", "", meaning)
        meaning = re.sub(r"\n{3,}", "\n\n", meaning).strip()
        if code == "R.301a":
            pix = doc[page-1].get_pixmap(clip=pymupdf.Rect(81, 428, 178, 530), alpha=False)
        else:
            pix = pymupdf.Pixmap(doc, xref)
            if pix.colorspace.n != 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        name = old[code]["ten"]
        if code == "I.423b":
            name = "Vị trí người đi bộ sang ngang"
        image_name = f"{code}.qcvn-2024.png"
        image = out_dir / image_name
        pix.save(str(image))
        rows.append({"ma": code, "nhom": old[code]["nhom"], "ten": name,
                     "y_nghia": meaning, "anh": image_name, "muc": section,
                     "trang_anh": page, "xref_anh": xref,
                     "sha256_anh": hashlib.sha256(image.read_bytes()).hexdigest(),
                     "nguyen_van_muc": fragment,
                     "can_cu": f"vn:doc:qcvn:41/2024/BGTVT#phu-luc-{section[0].lower()}.muc-{section[2:]}",
                     "trang_thai": "cho_duyet"})
    result = {"source_url": SOURCE, "source_sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
              "effective_from": "2025-01-01", "bien": rows}
    target = ROOT / "data/bien-bao/qcvn-41-2024-source.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(rows)} source excerpts and PNGs; publication remains disabled until reviewed.")


if __name__ == "__main__":
    main()
