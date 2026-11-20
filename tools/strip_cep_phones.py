"""Rehberden cep telefonu numaralarini cikarir, yedigini ayri dosyaya yazar.

KVKK: cep numaralari halka acik GitHub Pages sayfasindan kaldirilir. Cep numaralari
tek tek yedek dosyaya (tools/cep_yedek.json) alinir; dahili numaralar rehberde kalir.

Kural:
- Cep = alan kodu 05 ile baslayan, 11 haneli dogal telefon (05xx ...).
- Dahili = 4-5 haneli santral numarasi. Dahili alanlar dokunulmaz.
- Bir kayitta hem cep hem dahili varsa: cep yedek dosyaya, dahili phone'a tasinir.

Kullanim:
    python tools/strip_cep_phones.py          # deneme, yazmaz
    python tools/strip_cep_phones.py --yaz    # content.json + tools/cep_yedek.json yazar
"""

import argparse
import io
import json
import re
import sys
from datetime import datetime, timezone


def is_mobile(raw):
    digits = re.sub(r"\D", "", raw or "")
    return len(digits) == 11 and digits.startswith("05")


def is_internal(raw):
    digits = re.sub(r"\D", "", raw or "")
    return 3 <= len(digits) <= 5 and digits.isdigit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yaz", action="store_true", help="content.json + cep_yedek.json'a yaz")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)

    backup, changed = [], []
    for item in data["directory"]:
        phone, phone2 = item.get("phone") or "", item.get("phone2") or ""
        mobile = phone if is_mobile(phone) else (phone2 if is_mobile(phone2) else None)
        if mobile is None:
            continue

        row = {
            "id": item["id"],
            "name": item.get("name"),
            "unit": item.get("unit"),
            "group": item.get("group"),
            "mobile": mobile,
        }
        # cep kimin numarasi oldugunu netlestir: phone mu phone2 mi
        row["dugme"] = "phone" if phone == mobile else "phone2"
        backup.append(row)
        item["hasMobile"] = True  # numara sifreli dosyada; sadece maskeleme icin bayrak

        # yedegin oldugu alani bosalt; diger alan dahiliyse phone'a tasi
        if phone == mobile:
            item["phone"] = phone2 if is_internal(phone2) else ""
            if item["phone"] == phone2:  # dahili tek yerde dursun
                item["phone2"] = ""
        if phone2 and phone2 == mobile:
            item["phone2"] = ""
        # cep phone2'de ama phone bos ve dahili yoksa: phone bos kalir
        changed.append(item["id"])

    print(f"cep numarali kayit: {len(backup)}")
    for row in backup:
        print(f"  - {row['id']} {row['name']}: {row['mobile']} ({row['dugme']})")

    if not args.yaz:
        print("deneme modu; yazmak icin --yaz")
        return 0

    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    with io.open("content.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    backup.sort(key=lambda r: r["name"] or "")
    with io.open("tools/cep_yedek.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(backup, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print("content.json + tools/cep_yedek.json guncellendi")
    return 0


if __name__ == "__main__":
    sys.exit(main())