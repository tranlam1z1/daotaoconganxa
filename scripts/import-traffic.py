"""Extract legal source material to private staging. Never infers or publishes penalties.

Install: pip install pymupdf python-docx
Usage: python scripts/import-traffic.py document.pdf --source-url https://... --output data/work/traffic
The generated manifest can be POSTed to /api/v1/traffic/admin/imports.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def candidates(pages):
    records, seen = [], set()
    for page, text in pages:
        # Preserve clauses and source wording; money parsing requires human review.
        for raw in text.splitlines():
            text = normalize(raw)
            if not text or text in seen:
                continue
            seen.add(text)
            if re.search(r"\b(?:P|W|R|I|S)\.\d{3}", text):
                kind = "sign"
            elif re.search(r"phạt|điểm|giấy phép lái xe", text, re.I):
                kind = "violation"
            else:
                kind = "unclassified"
            records.append({"kind": kind, "text": text, "page": page, "status": "nhap",
                            "missing": ["exact_provision", "effective_dates", "human_review",
                                        "amendment_relationships"]})
    return records


def extract(path, output):
    pages = []
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".pdf":
        import fitz
        with fitz.open(path) as doc:
            if doc.page_count > 2000:
                raise ValueError("Document exceeds 2000 pages")
            for i, page in enumerate(doc, 1):
                pages.append((i, page.get_text()))
                for image in page.get_images():
                    pix = fitz.Pixmap(doc, image[0])
                    if pix.width * pix.height > 25_000_000:
                        continue
                    if pix.colorspace is None:
                        continue
                    if pix.colorspace.n > 3:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    pix.save(str(images / f"page-{i}-xref-{image[0]}.png"))
    elif path.suffix.lower() == ".docx":
        from docx import Document
        doc = Document(path)
        pages = [(None, "\n".join(p.text for p in doc.paragraphs))]
        for table in doc.tables:
            pages.append((None, "\n".join(" | ".join(c.text for c in row.cells) for row in table.rows)))
        # Word has no reliable physical page numbers. Images remain unassigned to signs.
        for rel in doc.part.rels.values():
            if "image" not in rel.reltype or rel.is_external:
                continue
            blob = rel.target_part.blob
            ext = Path(str(rel.target_part.partname)).suffix.lower()
            if ext in {".png", ".jpg", ".jpeg"}:
                (images / f"{hashlib.sha256(blob).hexdigest()}{ext}").write_bytes(blob)
    else:
        raise ValueError("Only PDF and DOCX are supported")
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--output", type=Path, default=Path("data/work/traffic"))
    args = parser.parse_args()
    url = urlparse(args.source_url)
    if url.scheme != "https" or not url.hostname:
        parser.error("source-url must be an HTTPS URL")
    if args.file.stat().st_size > 100 * 1024 * 1024:
        parser.error("Source file exceeds 100 MB")
    digest = hashlib.sha256(args.file.read_bytes()).hexdigest()
    target = args.output / digest
    target.mkdir(parents=True, exist_ok=True)
    if (target / "manifest.json").exists():
        parser.error("Duplicate source: manifest already exists")
    pages = extract(args.file, target)
    records = candidates(pages)
    payload = {"source_url": args.source_url, "source_hash": digest, "records": records}
    (target / "source-text.json").write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
    (target / "manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Staged {len(records)} fragments at {target}; no records published.")
    if not any(normalize(text) for _, text in pages):
        print("No selectable text: OCR and manual transcription required.")
    if len(records) > 1000:
        print("More than 1000 fragments: split into reviewed batches before API upload.")


if __name__ == "__main__":
    main()
