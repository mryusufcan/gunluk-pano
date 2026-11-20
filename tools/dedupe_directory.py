"""Rehberde ayni isim + ayni numara ile iki kez duran kayitlari birlestirir.

Kullanim:
    python tools/dedupe_directory.py          # deneme, dosyaya yazmaz
    python tools/dedupe_directory.py --yaz    # content.json'a yazar
"""

import argparse
import io
import json
import re
import sys
import unicodedata


def norm(value):
    s = unicodedata.normalize("NFKD", (value or "").upper().replace("ı", "I").replace("İ", "I"))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]", "", s)


def key_of(item):
    digits = re.sub(r"\D", "", item.get("phone") or "")
    if not digits:
        return None
    if len(digits) >= 10:
        digits = digits[-10:]
    return norm(item["name"]), digits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yaz", action="store_true", help="content.json'a yaz")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)

    kept, seen, removed = [], {}, []
    for item in data["directory"]:
        key = key_of(item)
        if key is None or key not in seen:
            if key is not None:
                seen[key] = item
            kept.append(item)
            continue
        first = seen[key]
        removed.append((first, item))
        if len(item.get("unit") or "") > len(first.get("unit") or ""):
            first["unit"] = item["unit"]
        first["fav"] = bool(first.get("fav")) or bool(item.get("fav"))

    print(f"kaldirilacak: {len(removed)}")
    for first, item in removed:
        print(f"  - {first['id']} tutuldu ({first['phone']}), {item['id']} silindi: {item['name']}")
    assert len({item["id"] for item in kept}) == len(kept), "id tekrari"

    if not args.yaz:
        print("deneme modu; yazmak icin --yaz")
        return 0
    data["directory"] = kept
    with io.open("content.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("content.json guncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())
