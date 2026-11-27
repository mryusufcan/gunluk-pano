"""content.json rehberi -> Google Kisiler CSV (liv etiketi).

Kullanim:
    python tools/export_google_csv.py cikti.csv

Cep numaralari tools/cep_yedek.json'dan (git disi) okunur; CSV'yi depo
disina yaz, aksi halde cep numaralari git'e girer.

Google Contacts > Ice aktar ile yukle; ayni kisiler varsa ice aktarma
sonrasi "Mukerrerleri birlestir" kullan.
"""

import csv
import io
import json
import sys

HEADER = [
    "Name", "Given Name", "Additional Name", "Family Name", "Yomi Name",
    "Given Name Yomi", "Additional Name Yomi", "Family Name Yomi",
    "Name Prefix", "Name Suffix", "Initials", "Nickname", "Short Name",
    "Maiden Name", "Birthday", "Gender", "Location", "Billing Information",
    "Directory Server", "Mileage", "Occupation", "Hobby", "Sensitivity",
    "Priority", "Subject", "Notes", "Language", "Photo", "Group Membership",
    "E-mail 1 - Type", "E-mail 1 - Value",
    "Phone 1 - Type", "Phone 1 - Value", "Phone 2 - Type", "Phone 2 - Value",
    "Organization 1 - Type", "Organization 1 - Name", "Organization 1 - Title",
    "Organization 1 - Department",
]

FIRMA = "Liv Ulus"
ETIKET = "Liv"


def fold(value):
    text = (value or "").replace("İ", "I").replace("ı", "i").upper()
    return "".join(ch for ch in text if ch.isalnum())


def org_fields(item):
    """Unvan birimi tekrar ediyorsa tek alan yaz (sitedeki subtitleOf kurali)."""
    title = (item.get("title") or "").strip()
    unit = (item.get("unit") or "").strip()
    if not title:
        return unit, ""
    if fold(title) == fold(unit):
        return title, ""
    return title, unit


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    out = sys.argv[1]

    data = json.load(open("content.json", encoding="utf-8"))
    mobiles = {}
    for row in json.load(open("tools/cep_yedek.json", encoding="utf-8")):
        mobiles.setdefault(row["id"], []).append(row["mobile"])

    with io.open(out, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for item in data["directory"]:
            name = " ".join(item["name"].split())
            parts = name.split(" ")
            given = " ".join(parts[:-1]) if len(parts) > 1 else name
            family = parts[-1] if len(parts) > 1 else ""
            title, dept = org_fields(item)
            cep = mobiles.get(item["id"], [])
            row = {key: "" for key in HEADER}
            row.update({
                "Name": name,
                "Given Name": given,
                "Family Name": family,
                "Group Membership": f"* myContacts ::: {ETIKET}",
                "Organization 1 - Type": "Work",
                "Organization 1 - Name": FIRMA,
                "Organization 1 - Title": title,
                "Organization 1 - Department": dept,
            })
            if cep:
                row["Phone 1 - Type"] = "Mobile"
                row["Phone 1 - Value"] = cep[0]
            if len(cep) > 1:
                row["Phone 2 - Type"] = "Mobile"
                row["Phone 2 - Value"] = cep[1]
            elif item.get("phone"):
                row["Phone 2 - Type"] = "Work"
                row["Phone 2 - Value"] = item["phone"]
            writer.writerow([row[key] for key in HEADER])

    total = len(data["directory"])
    print(f"yazildi: {out} | kisi: {total} | cep: {sum(1 for x in data['directory'] if x['id'] in mobiles)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
