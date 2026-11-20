"""Ayni isimli cep + dahili cift kayitlari tek satira birlestirir.

Numaranin son 10 hane kaynagina gore:
  - 10+ hane ve "05..." ile basliyorsa => cep (main phone)
  - kisa dahili (4-6 hane) veya "DECT/DECK" => ikinci numara (phone2)
Kullaniciya gosterim korunur; tek kayitta iki tel: baglantisi olur.

Kullanim:
    python tools/merge_directory_phones.py        # deneme, dosyaya yazmaz
    python tools/merge_directory_phones.py --yaz  # content.json'a yazar
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


def is_cell(phone):
    digits = re.sub(r"\D", "", phone or "")
    return len(digits) >= 10 and digits.startswith("05")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yaz", action="store_true", help="content.json'a yaz")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)

    by_name = {}
    for item in data["directory"]:
        by_name.setdefault(norm(item["name"]), []).append(item)

    merged = []
    skip = set()
    for key, items in by_name.items():
        items = [i for i in items if i["id"] not in skip]
        if len(items) < 2:
            merged.extend(items)
            continue
        cells = [i for i in items if is_cell(i["phone"])]
        internals = [i for i in items if not is_cell(i["phone"])]
        # Cift cep: tek numara tek satir da tek veriyle birlesme; ayrilmis dogru kayit varsa karistirma.
        if len(cells) > 1 or len(cells) == 0:
            merged.extend(items)
            continue
        cell = cells[0]
        keep = cell
        for extra in internals:
            keep["phone2"] = keep.get("phone2") or extra["phone"]
            if not keep["unit"] and extra["unit"]:
                keep["unit"] = extra["unit"]
            keep["fav"] = bool(keep.get("fav")) or bool(extra.get("fav"))
            skip.add(extra["id"])
        merged.append(keep)

    removed = len(data["directory"]) - len(merged)
    print(f"birlestirilen satir: {removed}")
    assert len({i["id"] for i in merged}) == len(merged), "id tekrari"
    assert not any(i["id"] in skip for i in merged), "silinen kayit hala listede"

    if not args.yaz:
        print("deneme modu; yazmak icin --yaz")
        return 0
    data["directory"] = merged
    with io.open("content.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("content.json guncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())