"""Ayni kisinin iki kez durdugu rehber kayitlarini birlestirir.

Kisi kimligi: ayni cep telefonu VE ayni sayilabilecek ad (birebir ayni ya da
birinin adi digerinin kelime alt kumesi: 'MURAT GUNDUZ' ~ 'MURAT GUNDUZ SEN').
Cep numaralari content.json'da durmadigi icin mobil eslesmesi
tools/cep_yedek.json uzerinden yapilir.

Kullanim:
    python tools/dedupe_directory.py          # deneme, yazmaz
    python tools/dedupe_directory.py --yaz    # content.json'a yazar
"""

import argparse
import io
import json
import re
import unicodedata


def tokens(value):
    text = unicodedata.normalize("NFKD", (value or "").upper().replace("ı", "I").replace("İ", "I"))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]", "", text), set(re.findall(r"[A-Z0-9]+", text))


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def same_person(a, b):
    ta, sa = tokens(a)
    tb, sb = tokens(b)
    if not ta or not tb:
        return ta == tb
    if len(sa) >= 2 and len(sb) >= 2 and (sa == sb or sa < sb or sb < sa):
        return True
    # Yazim farki: 'FATMAGUL BURSIN' ~ 'FATMA GUL BIRSIN', 'SEBAHATTIN' ~ 'SABAHATTIN'.
    return lev(ta, tb) <= 2 and min(len(ta), len(tb)) >= 8


def is_internal(raw):
    digits = re.sub(r"\D", "", raw or "")
    return 3 <= len(digits) <= 5


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yaz", action="store_true")
    args = parser.parse_args()

    with io.open("content.json", encoding="utf-8") as handle:
        data = json.load(handle)
    mobile = {row["id"]: re.sub(r"\D", "", row["mobile"])[-10:] for row in
              json.load(io.open("tools/cep_yedek.json", encoding="utf-8"))}

    kept, removed, open_pairs = [], [], []
    by_tel = {}
    for item in data["directory"]:
        tel = mobile.get(item["id"], "")
        twin = by_tel.get(tel) if tel else None
        if twin is None:
            by_tel[tel] = item if tel else None
            kept.append(item)
            continue
        if not same_person(twin["name"], item["name"]):
            open_pairs.append((twin["name"], item["name"], tel))
            kept.append(item)
            continue
        # Uzun (orta adi tam) ad kazanir; esitse onceki kalir.
        if len(tokens(item["name"])[1]) > len(tokens(twin["name"])[1]):
            kept[kept.index(twin)] = item
            twin, item = item, twin
        if is_internal(item.get("phone")) and not is_internal(twin.get("phone")):
            twin["phone"] = item["phone"]
            twin["phone2"] = twin.get("phone2") or ""
        twin["fav"] = bool(twin.get("fav")) or bool(item.get("fav"))
        if tel:
            by_tel[tel] = twin
        removed.append((twin, item))

    print(f"birlestirilecek: {len(removed)}  rehber: {len(data['directory'])} -> {len(kept)}")
    for keep, drop in removed:
        print(f"  tutulan {keep['id']:>6} {keep['name']}  <-  silinen {drop['id']:>6} {drop['name']} ({drop['unit']})")
    print(f"ayni cep, farkli ad (dokunulmadi): {len(open_pairs)}")
    for a, b, tel in open_pairs:
        print(f"  {tel}  {a} | {b}")
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
    raise SystemExit(main())
