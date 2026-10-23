import importlib.util
import unittest
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("import_traffic", Path(__file__).with_name("import-traffic.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportTrafficTests(unittest.TestCase):
    def test_duplicates_and_no_invented_penalty(self):
        rows = module.candidates([(1, "Phạt tiền theo điều kiện\nPhạt tiền theo điều kiện"), (2, "P.102 Biển báo")])
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r["status"] == "nhap" for r in rows))
        self.assertNotIn("fine_min", rows[0])
        self.assertEqual(rows[1]["page"], 2)
        self.assertEqual(rows[1]["kind"], "sign")

    def test_docx_has_no_guessed_page(self):
        row = module.candidates([(None, "Điều 1. Nội dung")])[0]
        self.assertIsNone(row["page"])
        self.assertIn("human_review", row["missing"])

    def test_extract_pdf(self):
        import fitz
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            source = target / "fixture.pdf"
            with fitz.open() as doc:
                page = doc.new_page()
                page.insert_text((72, 72), "P.102 Test fixture only")
                doc.save(source)
            pages = module.extract(source, target / "out")
            self.assertEqual(pages[0][0], 1)
            self.assertIn("P.102", pages[0][1])
            self.assertEqual(module.candidates(pages)[0]["status"], "nhap")

    def test_extract_docx_paragraph_and_table(self):
        from docx import Document
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            source = target / "fixture.docx"
            doc = Document()
            doc.add_paragraph("P.102 Test fixture only")
            table = doc.add_table(rows=1, cols=2)
            table.cell(0, 0).text = "Điều khoản thử nghiệm"
            table.cell(0, 1).text = "Không xuất bản"
            doc.save(source)
            pages = module.extract(source, target / "out")
            self.assertTrue(all(page is None for page, _ in pages))
            self.assertIn("Điều khoản thử nghiệm", pages[1][1])


if __name__ == "__main__":
    unittest.main()
