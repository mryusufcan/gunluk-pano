"""sync_schedule.py ayrıştırıcısı: sessiz bozulmayı yakalayan kontroller.

Çalıştırma: python -m unittest discover tests
"""
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime

from openpyxl import Workbook

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import sync_schedule  # noqa: E402

TODAY = date(2026, 11, 16)


def schedule_book():
    wb = Workbook()
    ws = wb.active
    ws.title = "2026 Kasım"

    def add(row, column, value):
        ws.cell(row=row, column=column, value=value)

    add(1, 1, "VARDIYA")
    days = [16, 17, 18, 19, 20, 21, 22]
    for index, day in enumerate(days):
        add(1, 3 + index, datetime(2026, 11, day, 0, 0))

    add(2, 1, "08:00 - 16:00")
    add(2, 3, "Ali Veli")
    add(2, 4, "Ayşe Kaya")
    add(2, 5, "BT")

    add(3, 1, "08:00 - 16:00")
    add(3, 2, "MR")
    add(3, 3, "Mehmet Can")

    add(4, 1, "16:00 - 24:00")
    add(4, 3, "Zeynep Ak")
    add(4, 4, "İZİN")
    add(4, 5, "Ali")

    add(5, 1, "RENKLER")
    return wb


class ParseScheduleTest(unittest.TestCase):
    def setUp(self):
        self.parsed = sync_schedule.parse_schedule(schedule_book(), TODAY)

    def test_names_and_shifts(self):
        self.assertEqual(self.parsed["2026-11-16"], [
            {"name": "Ali Veli", "shift": "08–16", "note": ""},
            {"name": "Mehmet Can", "shift": "08–16", "note": "MR"},
            {"name": "Zeynep Ak", "shift": "16–24", "note": ""},
        ])
        self.assertEqual([m["name"] for m in self.parsed["2026-11-17"]], ["Ayşe Kaya"])

    def test_device_note(self):
        self.assertEqual(self.parsed["2026-11-16"][1]["note"], "MR")

    def test_junk_filtered(self):
        names = [m["name"] for day in self.parsed.values() for m in day]
        self.assertNotIn("İZİN", names)
        self.assertNotIn("Ali", names)

    def test_empty_schedule_fails_loudly(self):
        empty = Workbook()
        original_fetch, original_path = sync_schedule.fetch_workbook, sync_schedule.CONTENT_PATH
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "content.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({"days": {}}, handle)
            sync_schedule.fetch_workbook = lambda: empty
            sync_schedule.CONTENT_PATH = path
            try:
                self.assertEqual(sync_schedule.main(), 1)
                with open(path, encoding="utf-8") as handle:
                    self.assertEqual(json.load(handle), {"days": {}})
            finally:
                sync_schedule.fetch_workbook, sync_schedule.CONTENT_PATH = original_fetch, original_path


if __name__ == "__main__":
    unittest.main()
