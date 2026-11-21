// livhospital.com hekim listesiyle content.json rehberini karşılaştırır (sadece rapor, yazmaz).
// Kullanım: node tools/check_branches.mjs
import { readFile } from "node:fs/promises";

const UA = { "user-agent": "Mozilla/5.0" };
const SITE = "https://www.livhospital.com";

const flat = (s) =>
  String(s || "").toLocaleUpperCase("tr-TR").replace(/İ/g, "I")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const brief = (token) => token.slice(0, 4);
const related = (a, b) => {
  const x = flat(a).split(" ").filter((t) => t.length > 2);
  const y = flat(b).split(" ").filter((t) => t.length > 2);
  const hit = (p, q) => p.some((t) => q.some((u) => brief(t) === brief(u) || t.startsWith(u) || u.startsWith(t)));
  return hit(x, y);
};

function parseDoctors(html) {
  const at = html.indexOf("var jsonData");
  if (at < 0) return [];
  const start = html.indexOf("[", at);
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && !--depth) { end = i + 1; break; }
  }
  if (end < 0) return [];
  return JSON.parse(html.slice(start, end)).map((d) => ({
    name: d.doctorName,
    branch: d.branchWebName || "",
    hospital: (d.hospitalWebNameList || []).join(" / "),
    link: SITE + d.pageLink,
  }));
}

async function fetchAll() {
  const all = [];
  for (let page = 1; page <= 60; page++) {
    const res = await fetch(`${SITE}/liv-hekimleri?sayfa=${page}`, { headers: UA });
    const list = parseDoctors(await res.text());
    all.push(...list);
    if (list.length < 20) break;
  }
  return all;
}

const [content, site] = await Promise.all([
  readFile(new URL("../content.json", import.meta.url), "utf8").then(JSON.parse),
  fetchAll(),
]);
const byFlat = new Map(site.map((s) => [flat(s.name), s]));
const doctors = content.directory.filter((d) => d.group === "Doktorlar");
const placeholder = /^(DOKTOR|RADYOLOG|GYB DOKTOR|DR|DT)?$/i;
let bad = 0;
console.log(`sitede ${site.length} hekim, panoda ${doctors.length} doktor kaydı`);
for (const d of doctors) {
  let hit = byFlat.get(flat(d.name));
  if (!hit) {
    const parts = flat(d.name).split(" ");
    const surname = parts.at(-1);
    hit = site.find((s) => {
      const st = flat(s.name).split(" ");
      return st.at(-1) === surname && st.some((t, i) => i < st.length - 1 && brief(t) === brief(parts[0]));
    });
  }
  if (!hit) { console.log(`YOK        | ${d.name} | pano: ${d.unit || "(boş)"}`); bad++; continue; }
  if (placeholder.test((d.unit || "").trim())) {
    console.log(`EKSİK      | ${d.name} | site: ${hit.branch} | ${hit.link}`); bad++; continue;
  }
  if (!related(d.unit, hit.branch)) {
    console.log(`FARK       | ${d.name} | pano: ${d.unit} | site: ${hit.branch} | ${hit.link}`); bad++;
  }
}
console.log(bad ? `\n${bad} kayıt elle bakılmalı` : "\nFark yok");
