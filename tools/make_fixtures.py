"""Testler için örnek Excel ve Word dosyaları üretir."""
import os
import zipfile
from datetime import date

from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "tests", "fixtures")
os.makedirs(OUT, exist_ok=True)

# --- Excel: haftalık vardiya tablosu ---
book = Workbook()
sheet = book.active
sheet.title = "Kasım"
sheet["A1"] = "Tarih"
sheet["B1"] = "08:00-16:00"
sheet["C1"] = "16:00-24:00"
sheet["D1"] = "24:00-08:00"
sheet["A2"] = date(2026, 11, 16)
sheet["B2"] = "Dr. Ece Kaya, Murat Demir"
sheet["C2"] = "Ali Şahin"
sheet["D2"] = "Emre Yıldız"
sheet["A3"] = date(2026, 11, 17)
sheet["B3"] = "Dr. Ece Kaya"
sheet["C3"] = "Zeynep Ak"
sheet["D3"] = "Ali Şahin"
book.save(os.path.join(OUT, "ekip-listesi.xlsx"))

# --- Word: günlük yemek listesi ---
DOCX = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>GÜNLÜK YEMEK LİSTESİ</w:t></w:r></w:p>
    <w:p><w:r><w:t>16.11.2026 Pazartesi</w:t></w:r></w:p>
    <w:p><w:r><w:t>Mercimek çorbası</w:t></w:r></w:p>
    <w:p><w:r><w:t>Izgara tavuk</w:t></w:r></w:p>
    <w:p><w:r><w:t>Pirinç pilavı</w:t></w:r></w:p>
    <w:p><w:r><w:t>17.11.2026 Salı</w:t></w:r></w:p>
    <w:p><w:r><w:t>Domates çorbası</w:t></w:r></w:p>
    <w:p><w:r><w:t>Karnıyarık</w:t></w:r></w:p>
    <w:p><w:r><w:t>Sütlaç</w:t></w:r></w:p>
  </w:body>
</w:document>
"""
with zipfile.ZipFile(os.path.join(OUT, "yemek-listesi.docx"), "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
    archive.writestr("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
    archive.writestr("word/document.xml", DOCX)

print("fixtures:", os.listdir(OUT))
