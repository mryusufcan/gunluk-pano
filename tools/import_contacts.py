"""Google Contacts CSV (liv etiketi) -> content.json rehberi.

Yeni kisileri ekler; --guncelle ile ayni isimli kayitlarin cep numarasini
ve bos birimini CSV'den tazeler (cep numarasi phone2'ye yazilir, ardindan
strip_cep_phones.py sifreli yedege tasir).

Kullanim:
    python tools/import_contacts.py contacts.csv                  # deneme
    python tools/import_contacts.py contacts.csv --guncelle       # deneme + guncelleme raporu
    python tools/import_contacts.py contacts.csv --guncelle --yaz # content.json'a yaz
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


def bare_name(value):
    # DR./DT./UZM. on ekini yok say: "DR. ADEM UCAR" ile "ADEM UCAR" ayni kisi.
    n = norm(value)
    for prefix in ("PROFDR", "DOCDR", "UZMDR", "DR", "DT", "UZM", "PROF", "DOC"):
        if n.startswith(prefix):
            return n[len(prefix):]
    return n


def phone_key(value):
    digits = re.sub(r"\D", "", value or "")
    return digits[-10:] if len(digits) >= 10 else ""


def is_mobile(value):
    digits = re.sub(r"\D", "", value or "")
    return len(digits) == 11 and digits.startswith("05")


def first_phone(value):
    return re.split(r"\s*:::\s*|\s*,\s*", value or "")[0].strip()


def all_phones(row):
    raw = " ::: ".join(row[f"Phone {i} - Value"] or "" for i in (1, 2, 3))
    return [p.strip() for p in re.split(r"\s*:::\s*|\s*,\s*", raw) if p.strip()]


def mobile_text(value):
    """Cep numarasini '05XX XXX XX XX' bicimine getir; cep degilse dokunma."""
    d = re.sub(r"\D", "", value or "")
    if len(d) == 12 and d.startswith("90"):
        d = d[2:]
    if len(d) == 11 and d.startswith("0"):
        d = d[1:]
    if len(d) == 10 and d.startswith("5"):
        return f"0{d[0:3]} {d[3:6]} {d[6:8]} {d[8:10]}"
    return (value or "").strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--yaz", action="store_true", help="content.json'a yaz")
    parser.add_argument("--guncelle", action="store_true", help="ayni isimli kayitlari tazele")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)
    directory = data["directory"]

    by_name = {}
    for item in directory:
        by_name.setdefault(bare_name(item["name"]), []).append(item)
    # Cep numaralari content.json'da degil; onceki kosunun yedegi de karsilastirmaya girer.
    backup = {}
    try:
        with io.open("tools/cep_yedek.json", encoding="utf-8") as handle:
            backup = {row["id"]: row.get("mobile") or "" for row in json.load(handle)}
    except FileNotFoundError:
        pass
    phones = {phone_key(item["phone"]) for item in directory} - {""}
    phones |= {phone_key(backup.get(item["id"])) for item in directory} - {""}
    next_id = max(int(item["id"][1:]) for item in directory if item["id"][:1] == "d" and item["id"][1:].isdigit()) + 1

    added, same_phone, updated, skipped = [], [], [], []
    with io.open(args.csv_path, encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            name = " ".join(part for part in (row["First Name"], row["Last Name"]) if part.strip()).strip()
            name = re.sub(r"\s+", " ", name)
            raw_phone = mobile_text(first_phone(row["Phone 1 - Value"] or row["Phone 2 - Value"] or row["Phone 3 - Value"]))
            key = phone_key(raw_phone)
            title = (row["Organization Title"] or "").strip()
            dept = (row["Organization Department"] or "").strip()
            labels = (row["Labels"] or "").casefold()
            if not name:
                continue
            if bare_name(name).startswith("LIVULUS"):
                skipped.append(name)  # hastane santral karti, kisi degil
                continue
            hit = by_name.get(bare_name(name))
            if not hit:
                # "Merdan Fayda" ~ "EMRE MERDAN FAYDA": soyad+ad ayni, onek farkli.
                hit = [i for key, items in by_name.items() if key.endswith(bare_name(name)) for i in items]
            if hit:
                if not args.guncelle:
                    if key and key in phones:
                        same_phone.append(name)
                    else:
                        updated.append(f"{hit[0]['id']} {hit[0]['name']} (--guncelle yok)")
                    continue
                item = hit[0]
                changes = []
                for field in ("phone", "phone2"):
                    value = item.get(field) or ""
                    digits = re.sub(r"\D", "", value)
                    if 10 <= len(digits) <= 12 and digits[-10:].startswith("5"):
                        fixed = mobile_text(value)
                        if fixed != value:
                            item[field] = fixed
                            changes.append(f"bicim {value} -> {fixed}")
                current = phone_key(item.get("phone")) or phone_key(item.get("phone2")) or phone_key(backup.get(item["id"]))
                fresh = [p for p in all_phones(row) if phone_key(p) and phone_key(p) != current]
                if current and fresh and any(phone_key(p) == current for p in all_phones(row)):
                    fresh = []  # CSV'de eski numara da duruyor: degistirme
                if fresh:
                    raw_phone = mobile_text(fresh[0])
                    if is_mobile(item.get("phone")):
                        item["phone"] = raw_phone
                    elif not item.get("phone"):
                        item["phone"] = raw_phone
                    else:
                        item["phone2"] = raw_phone
                    changes.append(f"cep {raw_phone}")
                if not item["unit"] and (title or dept):
                    item["unit"] = title or dept
                    changes.append(f"birim {item['unit']}")
                if changes:
                    updated.append(f"{item['id']} {item['name']}: " + ", ".join(changes))
                continue
            if not key:
                continue
            if key in phones:
                same_phone.append(name)
                continue
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
            by_name.setdefault(bare_name(name), []).append(added[-1])
            phones.add(key)

    print(f"eklenecek: {len(added)}")
    print(f"guncellenecek: {len(updated)}")
    print(f"telefon zaten kayitli: {len(same_phone)}")
    print(f"santral karti atlandi: {len(skipped)}")
    for line in updated:
        print("  ~", line)
    for line in same_phone:
        print("  =", line)
    for item in added:
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
