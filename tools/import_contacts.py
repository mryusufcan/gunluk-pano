"""Google Contacts CSV (liv etiketi) -> content.json rehberi.

Kullanim:
    python tools/import_contacts.py contacts.csv          # deneme, dosyaya yazmaz
    python tools/import_contacts.py contacts.csv --yaz    # content.json'a ekler
"""

import argparse
import csv
import io
import json
import re
import sys
import unicodedata


def norm(value):
    s = unicodedata.normalize("NFKD", (value or "").upper().replace("ı", "I").replace("İ", "I"))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]", "", s)


def phone_key(value):
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) >= 10 else ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--yaz", action="store_true", help="content.json'a yaz")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)
    directory = data["directory"]

    names = {norm(item["name"]) for item in directory}
    phones = {phone_key(item["phone"]) for item in directory} - {""}
    next_id = max(int(item["id"][1:]) for item in directory if item["id"][:1] == "d" and item["id"][1:].isdigit()) + 1

    added, same_name, same_phone = [], [], []
    with io.open(args.csv_path, encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            name = " ".join(part for part in (row["First Name"], row["Last Name"]) if part.strip()).strip()
            raw_phone = (row["Phone 1 - Value"] or "").strip()
            key = phone_key(raw_phone)
            if not name or not key:
                continue
            if key in phones:
                same_phone.append(name)
                continue
            if norm(name) in names:
                same_name.append(f"{name} ({raw_phone})")
                continue
            title = (row["Organization Title"] or "").strip()
            dept = (row["Organization Department"] or "").strip()
            labels = (row["Labels"] or "").casefold()
            group = ""
            if "doktor" in labels or title in ("Doktor", "Radyolog"):
                group = "Doktorlar"
            elif "ulaşım" in labels:
                group = "Misafir & VIP"
            added.append({
                "id": f"d{next_id}",
                "name": name,
                "phone": raw_phone,
                "unit": title or dept,
                "fav": False,
                "group": group,
            })
            next_id += 1
            names.add(norm(name))
            phones.add(key)

    print(f"eklenecek: {len(added)}")
    print(f"telefon zaten kayitli: {len(same_phone)}")
    print(f"isim zaten kayitli (numarasi farkli): {len(same_name)}")
    for line in same_name:
        print("  ?", line)
    for item in added[:5]:
        print("  +", item["id"], item["name"], "|", item["phone"], "|", item["unit"], "|", item["group"])
    assert all(item["name"] and item["phone"] for item in added), "bos kayit"

    if not args.yaz:
        print("deneme modu; yazmak icin --yaz")
        return 0
    data["directory"] = directory + added
    with io.open("content.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("content.json guncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
