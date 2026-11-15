#!/usr/bin/env python3
"""Google E-Tablo'daki haftalık çalışma listesini content.json'a aktarır.

Yalnızca ekip alanlarını günceller; yemek, not, duyuru ve ayarlara dokunmaz.
GitHub Actions içinde günde bir kez çalışır (ayrıca elle tetiklenebilir)."""
import io
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

import openpyxl

SHEET_ID = "10-i9GBdUwCZ2XWA1IylaA5V5EgxPQG3BzGmemyJT-5I"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx"
CONTENT_PATH = "content.json"

DEVICES = {"MR", "BT", "RÖNT-PORT", "RÖNTGEN", "RÖNT-MAMO"}
MONTHS = {"OCAK": 1, "ŞUBAT": 2, "MART": 3, "NİSAN": 4, "MAYIS": 5, "HAZİRAN": 6,
          "TEMMUZ": 7, "AĞUSTOS": 8, "EYLÜL": 9, "EKİM": 10, "KASIM": 11, "ARALIK": 12}
STOP_WORDS = {"CUMARTESİ", "PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA",
              "GECE", "SABAH", "AKŞAM", "ÇIKIŞ", "GİRİŞ", "SAAT", "ÇALIŞMA", "GÜN", "SAYISI",
              "YIL", "İSİM", "AYLIK", "TOPLAM", "NOT", "UYARI", "KONTROL", "BAYRAM", "TATİL",
              "İZİN", "RAPOR", "RENKLER", "ANLAMLARI", "CİHAZ", "GECECİ", "SABAHÇI", "AKŞAMCI", "SAATİ"}
BAD_SUBSTR = ("ÇIKIŞ", "ÇALIŞMA", "SAAT", "GÜN SAYISI", "YIL", "İSİM", "RENKLER", "BAYRAM",
              "TATİL", "İZİN", "RAPOR", "TOPLAM", "AYLIK", "GECECİ", "SABAHÇI", "AKŞAMCI",
              "KONTROL", "CİHAZ")
TR_LETTERS = "abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"

WINDOW_BACK = 10
WINDOW_FORWARD = 70


def cell_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        match = re.search(r"(\d{1,2})[./](\d{1,2})[./](\d{4})", value)
        if match:
            try:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            except ValueError:
                return None
    return None


def text(value):
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def tr_lower(value):
    return value.replace("İ", "i").replace("I", "ı").lower()


def title_tr(value):
    return " ".join(word[0] + tr_lower(word[1:]) for word in value.split() if word)


def is_person(name):
    if not name or len(name) > 45:
        return False
    if any(char.isdigit() for char in name):
        return False
    upper = name.upper()
    if any(bad in upper for bad in BAD_SUBSTR):
        return False
    if not all(char in TR_LETTERS or char == " " for char in name):
        return False
    words = [word for word in name.split() if word]
    if not 2 <= len(words) <= 4:
        return False
    if any(word.upper() in STOP_WORDS for word in words):
        return False
    return True


def fetch_workbook():
    request = urllib.request.Request(SHEET_URL, headers={"User-Agent": "gunluk-pano-sync/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return openpyxl.load_workbook(io.BytesIO(response.read()), data_only=True)


def parse_schedule(workbook, today):
    window_start = today - timedelta(days=WINDOW_BACK)
    window_end = today + timedelta(days=WINDOW_FORWARD)
    collected = {}

    for sheet_name in workbook.sheetnames:
        match = re.match(r"^(\d{4})\s+(\S+)$", sheet_name.strip())
        if not match or match.group(2).upper() not in MONTHS:
            continue
        tab_year, tab_month = int(match.group(1)), MONTHS[match.group(2).upper()]
        ws = workbook[sheet_name]
        cells = [[ws.cell(row=r, column=c) for c in range(1, 10)] for r in range(1, ws.max_row + 1)]

        def txt(row, column):
            return text(cells[row - 1][column - 1].value)

        blocks = []
        for row in range(1, ws.max_row + 1):
            if txt(row, 1).upper() != "VARDIYA":
                continue
            dates = {column: cell_date(cells[row - 1][column - 1].value) for column in range(3, 10)}
            if sum(1 for value in dates.values() if value) >= 3:
                blocks.append((row, dates))
        if not blocks:
            continue

        summary_start = ws.max_row + 1
        for row in range(blocks[0][0] + 1, ws.max_row + 1):
            probe = " ".join(txt(row, column) for column in (1, 2, 3)).upper()
            if "RENKLER" in probe or txt(row, 3).upper() in {"YIL", "İSİM"}:
                summary_start = row
                break

        for index, (start_row, dates) in enumerate(blocks):
            end_row = blocks[index + 1][0] - 1 if index + 1 < len(blocks) else min(summary_start - 1, ws.max_row)
            current_shift = ""
            for row in range(start_row + 1, end_row + 1):
                a, b = txt(row, 1), txt(row, 2)
                if any(bad in a.upper() for bad in ("ÇALIŞMA", "GÜN SAYISI", "AYLIK", "TATİL", "BAYRAM")):
                    continue
                if a.upper() in {"08:00 - 16:00", "08:00-16:00"}:
                    current_shift = "08–16"
                elif a.upper() in {"16:00-24:00", "16:00 - 24:00"}:
                    current_shift = "16–24"
                elif a.upper() in {"24:00-08:00", "24:00 - 08:00"}:
                    current_shift = "24–08"
                note = ""
                if b.upper() in DEVICES:
                    current_shift = "08–16"
                    note = b.upper()
                if not current_shift:
                    continue
                for column, day in dates.items():
                    if not day or not window_start <= day <= window_end:
                        continue
                    name = txt(row, column)
                    if not is_person(name):
                        continue
                    person = {"name": title_tr(name), "shift": current_shift, "note": note}
                    strength = 1 if (day.year == tab_year and day.month == tab_month) else 0
                    existing = collected.get(day)
                    if existing is None or strength > existing[1]:
                        collected[day] = ([person], strength)
                    elif strength == existing[1]:
                        bucket = existing[0]
                        if not any(item["name"] == person["name"] and item["shift"] == person["shift"] for item in bucket):
                            bucket.append(person)
    return {day.isoformat(): members for day, (members, _) in sorted(collected.items())}


def build_team(day, members, previous):
    by_name = {item.get("name", "").casefold(): item for item in previous if item.get("name")}
    team = []
    for index, person in enumerate(members):
        old = by_name.get(person["name"].casefold())
        team.append({
            "id": old.get("id") if old and old.get("id") else f"sheet-{day}-{index}",
            "name": person["name"],
            "role": (old or {}).get("role") or "Teknisyen",
            "shift": person["shift"],
            "phone": (old or {}).get("phone", ""),
            "note": person.get("note", ""),
        })
    return team


def main():
    today = date.today()
    schedule = parse_schedule(fetch_workbook(), today)
    with open(CONTENT_PATH, encoding="utf-8") as handle:
        content = json.load(handle)

    changed_days = 0
    for day, members in schedule.items():
        entry = content.setdefault("days", {}).setdefault(day, {"team": [], "meal": {"text": "", "updatedAt": 0}})
        previous = entry.get("team") or []
        team = build_team(day, members, previous)
        if team != previous:
            entry["team"] = team
            changed_days += 1

    if not changed_days:
        print("Değişiklik yok.")
        return 0

    content["updatedAt"] = datetime.now(timezone(timedelta(hours=3))).isoformat(timespec="seconds")
    with open(CONTENT_PATH, "w", encoding="utf-8") as handle:
        json.dump(content, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"{changed_days} gün güncellendi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
