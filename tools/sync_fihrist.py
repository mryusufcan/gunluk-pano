"""Dijital fihrist (CSV/MD disa aktarim) dosyalarini content.json rehberine isler.

Fihrist tek kisi kaynagi: CSV'ler ve .md dosyalari ayni kisileri tasir, isim
uzerinden tekillestirilir. Eslesen kiside yalnizca cep tazelenir; yeni kisi
rehbere eklenir. Telefonsuz kayit ve kisi olmayan satirlar (ortak hat) atlanir.

Kullanim:
    python tools/sync_fihrist.py                    # deneme, yazmaz
    python tools/sync_fihrist.py --yaz              # content.json'a yazar
    python tools/sync_fihrist.py --kaynak DIZIN     # baska fihrist klasoru
"""

import argparse
import csv
import io
import json
import os
import re
import unicodedata
from datetime import datetime, timezone

# Fihrist disa aktarimi birim adlarini Turkce bilmeyen bir upper() ile yazmis
# ("HEKIMLIK"); karsilastirma ve ekrandaki ad bu yuzden ASCII'ye katlanmis anahtarla yapilir.
UNIT_LABELS = {
    "ANLASMALI KURUMLAR MUDURLUGU": "ANLAŞMALI KURUMLAR MÜDÜRLÜĞÜ",
    "BASHEKIMLIK": "BAŞHEKİMLİK",
    "BILGI SISTEMLERI MUDURLUGU": "BİLGİ SİSTEMLERİ MÜDÜRLÜĞÜ",
    "BIYOMEDIKAL MUDURLUGU": "BİYOMEDİKAL MÜDÜRLÜĞÜ",
    "HASTA BAKIM HIZMETLERI MUDURLUGU": "HASTA BAKIM HİZMETLERİ MÜDÜRLÜĞÜ",
    "HASTA HAKLARI MUDURLUGU": "HASTA HAKLARI MÜDÜRLÜĞÜ",
    "HEKIMLIK": "HEKİMLİK",
    "IDARI ISLER VE DESTEK HIZMETLER MUDURLUGU": "İDARİ İŞLER VE DESTEK HİZMETLER MÜDÜRLÜĞÜ",
    "INSAN KAYNAKLARI MUDURLUGU": "İNSAN KAYNAKLARI MÜDÜRLÜĞÜ",
    "KOK HUCRE": "KÖK HÜCRE",
    "KURUMSAL FATURALAMA MUDURLUGU": "KURUMSAL FATURALAMA MÜDÜRLÜĞÜ",
    "KURUMSAL TANITIM MUDURLUGU": "KURUMSAL TANITIM MÜDÜRLÜĞÜ",
    "MALI ISLER MUDURLUGU": "MALİ İŞLER MÜDÜRLÜĞÜ",
    "MISAFIR HIZMETLERI MUDURLUGU": "MİSAFİR HİZMETLERİ MÜDÜRLÜĞÜ",
    "TEDARIK ZINCIRI MUDURLUGU": "TEDARİK ZİNCİRİ MÜDÜRLÜĞÜ",
    "TEKNIK HIZMETLER MUDURLUGU": "TEKNİK HİZMETLER MÜDÜRLÜĞÜ",
    "ULUSLARARASI MISAFIR HIZMETLERI MUDURLUGU": "ULUSLARARASI MİSAFİR HİZMETLERİ MÜDÜRLÜĞÜ",
    "UST YONETIM": "ÜST YÖNETİM",
}
UNIT_GROUPS = {
    "HEKIMLIK": "Doktorlar",
    "MISAFIR HIZMETLERI MUDURLUGU": "Misafir & VIP",
    "ULUSLARARASI MISAFIR HIZMETLERI MUDURLUGU": "Misafir & VIP",
    "KURUMSAL TANITIM MUDURLUGU": "Misafir & VIP",
    "ANLASMALI KURUMLAR MUDURLUGU": "Misafir & VIP",
    "KOK HUCRE": "Görüntüleme & Lab",
}
ADMIN_UNITS = {
    "BASHEKIMLIK", "UST YONETIM", "IDARI ISLER VE DESTEK HIZMETLER MUDURLUGU",
    "INSAN KAYNAKLARI MUDURLUGU", "MALI ISLER MUDURLUGU",
    "KURUMSAL FATURALAMA MUDURLUGU", "BILGI SISTEMLERI MUDURLUGU",
    "BIYOMEDIKAL MUDURLUGU", "TEKNIK HIZMETLER MUDURLUGU",
    "TEDARIK ZINCIRI MUDURLUGU", "HASTA HAKLARI MUDURLUGU",
}
LAB_TITLE = re.compile(
    r"LABORATUVAR|BIYOKIMYA|PATOLOJI|RADYOLOJ|RADYOTERAPI|STERIL|KAN ALMA|"
    r"ANESTEZI|AMELIYATHANE|CIHAZ|EEG|EKG|NUKLEER|GORUNTULEME|PERFUZYON|"
    r"ODIYOMETR|SUT BANKASI|EMBRIYOLOG|BIYOLOG"
)
# Kisi degil: ortak hat / birim adi.
NOT_PERSON = {"ULUS LIV RPA", "ULUS HASTANE"}
NAME_TITLES = re.compile(r"^(?:(?:DOÇ|PROF|UZMAN|UZM|DR|DT|OP|DOKTOR)\.?\s+)+", re.I)


def norm_name(value):
    text = fold(value)
    text = re.sub(r"[^A-Z0-9 ]", " ", re.sub(r"\s+", " ", text)).strip()
    return NAME_TITLES.sub("", text)


def fold(value):
    """Turkce I/i, aksan ve noktalama farkini sil: karsilastirma anahtari."""
    text = unicodedata.normalize("NFKD", value.replace("İ", "I").replace("ı", "i").upper())
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def phone_of(raw):
    """Cep (05..) ve sehir/santral hatti (02..) kabul edilir; yabanci numara ve cop atilir."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("90"):
        digits = "0" + digits[2:]
    elif len(digits) == 10 and digits[0] in "2345":
        digits = "0" + digits
    return digits if len(digits) == 11 and digits[0] == "0" and digits[1] in "2345" else ""


def group_of(unit, title):
    key = fold(unit)
    if key in UNIT_GROUPS:
        return UNIT_GROUPS[key]
    if key == "HASTA BAKIM HIZMETLERI MUDURLUGU":
        return "Görüntüleme & Lab" if LAB_TITLE.search(fold(title)) else "Hemşirelik & Yatan"
    return "Yönetim & İdari" if key in ADMIN_UNITS else "Poliklinikler"


def read_fihrist(folder):
    rows = []
    for name in sorted(os.listdir(folder)):
        path = os.path.join(folder, name)
        if name.lower().endswith(".csv"):
            with io.open(path, encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle, delimiter=";", quotechar='"'):
                    rows.append((row["nameSurname"], row["userDesc"], row["workPhoneNumber"]))
        elif name.lower().endswith(".md"):
            lines = [line.strip() for line in io.open(path, encoding="utf-8").read().splitlines()]
            for i, line in enumerate(lines):
                if line.startswith("### "):
                    rest = [x for x in lines[i + 1:i + 5] if x]
                    rows.append((line[4:], rest[0] if rest else "", rest[1] if len(rest) > 1 else ""))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kaynak", default=r"C:\Users\yusuf\Desktop\rehber")
    parser.add_argument("--yaz", action="store_true")
    args = parser.parse_args()

    people = {}
    for name, desc, phone in read_fihrist(args.kaynak):
        parts = [part.strip() for part in desc.split("/")]
        title, unit = (parts[0].rstrip("."), parts[1]) if len(parts) > 1 else (desc, "")
        key = norm_name(name)
        tel = phone_of(phone)
        if not key or key in NOT_PERSON or not tel:
            continue
        people.setdefault(key, {"name": name, "title": title, "unit": unit, "tel": tel})

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)
    directory = data["directory"]
    by_key = {norm_name(item.get("name") or ""): item for item in directory}
    next_id = max(int(item["id"][1:]) for item in directory if re.fullmatch(r"d\d+", item["id"])) + 1

    updated, added = [], []
    for key, person in people.items():
        fmt = f"{person['tel'][:4]} {person['tel'][4:7]} {person['tel'][7:9]} {person['tel'][9:]}"
        item = by_key.get(key)
        if item is not None:
            # Dahili numara kaybolmasin: cep bos alana yazilir, strip sonrasi dahili phone'da kalir.
            field = "phone" if phone_of(item.get("phone")) else "phone2"
            if item.get(field) != fmt:
                item[field] = fmt
                updated.append(item["name"])
            continue
        item = {
            "id": f"d{next_id}",
            "name": person["name"].upper(),
            "phone": fmt,
            "phone2": "",
            "unit": UNIT_LABELS.get(fold(person["unit"]), fold(person["unit"])),
            "group": group_of(person["unit"], person["title"]),
            "fav": False,
            "hasMobile": False,
        }
        next_id += 1
        directory.append(item)
        by_key[key] = item
        added.append(item["name"])

    print(f"fihrist kisi: {len(people)}  yeni: {len(added)}  cep tazelenen: {len(updated)}  rehber: {len(directory)}")
    if not args.yaz:
        print("deneme modu; yazmak icin --yaz")
        return 0

    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    with io.open("content.json", "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print("content.json guncellendi")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
