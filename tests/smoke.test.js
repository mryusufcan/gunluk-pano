const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const inline = html.replace('<script src="./app.js"></script>', `<script>${appJs}</script>`);

const failures = [];
function check(name, condition, extra = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${extra}`);
  }
}

function makeDom(seedState) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(String(error && error.stack ? error.stack : error)));
  virtualConsole.on("error", (...args) => errors.push(args.join(" ")));
  const dom = new JSDOM(inline, {
    url: "http://localhost/gunluk-pano/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.DecompressionStream = DecompressionStream;
      if (seedState) window.localStorage.setItem("rad-pano-v1", JSON.stringify(seedState));
    },
  });
  return { dom, errors };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  /* ---------- 1. Boş kurulum ---------- */
  console.log("\n1) İlk açılış");
  let { dom, errors: bootErrors } = makeDom(null);
  await wait(120);
  let doc = dom.window.document;
  const $ = (selector) => doc.querySelector(selector);
  const text = (selector) => ($(selector) || {}).textContent || "";

  check("sayfa hatasız yüklendi", bootErrors.length === 0, bootErrors.join(" | "));
  check("tarih başlığı dolu", text("#date-title").trim().length > 5);
  check("hafta şeridi 7 gün", doc.querySelectorAll("#weekstrip .chip").length === 7);
  check("bugün işaretli", doc.querySelectorAll("#weekstrip .chip.is-today").length === 1);
  check("varsayılan sekme ekip", $('.view[data-view="ekip"]').classList.contains("is-active"));
  check("boş ekip mesajı", $("#team-list").textContent.includes("ekip girilmemiş"));
  check("tema aydınlık", doc.documentElement.dataset.theme === "light");

  /* ---------- 2. Ekip ekleme ---------- */
  console.log("\n2) Ekip ekleme ve vardiya gruplama");
  $("#add-member").click();
  check("üye diyaloğu açıldı", $("#member-dialog").hasAttribute("open"));
  $("#m-name").value = "Dr. Ayşe Yılmaz";
  $("#m-role").value = "Radyolog";
  $("#m-shift").value = "08–16";
  $("#m-phone").value = "0532 111 22 33";
  $("#member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(10);
  check("isim listede", $("#team-list").textContent.includes("Dr. Ayşe Yılmaz"));
  check("telefon bağlantısı", Boolean($('#team-list a[href="tel:05321112233"]')));
  check("grup etiketi 08–16", $("#team-list .group-label") && $("#team-list .group-label").textContent.includes("08–16"));
  check("sayaç 1 kişi", text("#team-count").includes("1 kişi"));

  $("#add-member").click();
  $("#m-name").value = "Murat Demir";
  $("#m-shift").value = "16–24";
  $("#member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(10);
  const labels = [...doc.querySelectorAll("#team-list .group-label")].map((node) => node.textContent.trim());
  check("iki vardiya grubu", labels.length === 2 && labels[1].includes("16–24"), JSON.stringify(labels));

  const stored = JSON.parse(dom.window.localStorage.getItem("rad-pano-v1"));
  const storedDate = Object.keys(stored.days)[0];
  check("localStorage'a yazıldı", stored.days[storedDate].team.length === 2);

  /* ---------- 3. Düzenleme ve silme ---------- */
  console.log("\n3) Düzenleme");
  $("#team-list [data-edit-member]").click();
  check("düzenleme diyaloğu dolu", $("#m-name").value === "Dr. Ayşe Yılmaz");
  $("#m-note").value = "MR–BT";
  $("#member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(10);
  check("not güncellendi", $("#team-list").textContent.includes("MR–BT"));

  /* ---------- 4. Yemek ---------- */
  console.log("\n4) Yemek menüsü");
  doc.querySelector('.tab[data-view="yemek"]').click();
  check("yemek sekmesi aktif", $('.view[data-view="yemek"]').classList.contains("is-active"));
  check("boş menü mesajı", $("#meal-body").textContent.includes("Menü girilmemiş"));
  $("#edit-meal").click();
  $("#meal-textarea").value = "Mercimek çorbası\nIzgara tavuk\nPilav";
  $("#meal-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(10);
  check("menü göründü", $("#meal-body").textContent.includes("Izgara tavuk"));
  check("menü satır korunuyor", $("#meal-body .meal-text").textContent.includes("Mercimek çorbası\nIzgara tavuk"));
  check("menü pili", !$("#meal-pill").hidden);

  /* ---------- 5. Notlar ---------- */
  console.log("\n5) Notlar");
  doc.querySelector('.tab[data-view="notlar"]').click();
  $("#note-text").value = "BT cihazı 14:00–16:00 arası bakımda.";
  $("#note-author").value = "Teknisyen Ali";
  $("#note-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(10);
  check("not listede", $("#note-list").textContent.includes("bakımda"));
  check("yazar göründü", $("#note-list").textContent.includes("Teknisyen Ali"));
  check("not sayacı rozeti", !$("#badge-notlar").hidden);
  $("#note-list [data-note-pin]").click();
  await wait(10);
  check("sabitleme çalıştı", $("#note-list .note").classList.contains("is-pinned"));
  $("#note-list [data-note-done]").click();
  await wait(10);
  check("tamamlandı çalıştı", $("#note-list .note").classList.contains("is-done"));

  doc.querySelector('.filter[data-filter="pinned"]').click();
  check("sabitlenen filtresi", $("#note-list .note.is-pinned") !== null);
  doc.querySelector('.filter[data-filter="all"]').click();

  /* ---------- 6. Ayarlar ---------- */
  console.log("\n6) Ayarlar");
  doc.querySelector('.tab[data-view="ayarlar"]').click();
  check("ayarlar sekmesi aktif", $('.view[data-view="ayarlar"]').classList.contains("is-active"));
  $("#set-title").value = "Radyoloji Günlük";
  $("#set-title").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(500);
  check("başlık güncellendi", text("#brand-title") === "Radyoloji Günlük");
  $("#set-theme").value = "dark";
  $("#set-theme").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  check("gece teması", doc.documentElement.dataset.theme === "dark");
  check("tema kaydedildi", dom.window.localStorage.getItem("pano-theme") === "dark");
  const saved = JSON.parse(dom.window.localStorage.getItem("rad-pano-v1"));
  check("ayar kalıcı", saved.settings.title === "Radyoloji Günlük");
  check("istatistik satırı", text("#stats").includes("not"));

  /* ---------- 7. Tarih gezinme ---------- */
  console.log("\n7) Tarih gezinme");
  const firstDate = text("#date-title");
  $("#next-day").click();
  await wait(10);
  check("sonraki gün", text("#date-title") !== firstDate);
  const emptyDay = $("#team-list").textContent.includes("ekip girilmemiş");
  check("yeni gün boş", emptyDay);
  $("#prev-day").click();
  await wait(10);
  check("önceki gün geri döndü", text("#date-title") === firstDate);
  check("ekip geri geldi", $("#team-list").textContent.includes("Dr. Ayşe Yılmaz"));
  dom.window.close();

  /* ---------- 8. Kalıcılık ---------- */
  console.log("\n8) Yeniden açılış (kalıcılık)");
  const seed = {
    v: 1,
    settings: { title: "Radyoloji Panosu", dept: "Görüntüleme", theme: "light" },
    links: [{ id: "pacs", label: "PACS", url: "https://pacs.example/", }],
    days: {
      [firstKey()]: {
        team: [{ id: "a1", name: "Uzm. Dr. Ece Kaya", role: "Radyolog", shift: "08–16", phone: "1234", note: "MR" }],
        meal: { text: "Ezogelin\nKuru fasulye", updatedAt: Date.now() },
      },
    },
    notes: [{ id: "n1", text: "Saat 15:00 toplantı", author: "Başhekimlik", ts: Date.now(), pinned: true, done: false }],
    author: "Ece",
    updatedAt: Date.now(),
  };
  function firstKey() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  ({ dom, errors } = makeDom(seed));
  await wait(120);
  doc = dom.window.document;
  const q = (selector) => doc.querySelector(selector);
  check("kayıt hatasız yüklendi", errors.length === 0, errors.join(" | "));
  check("başlık kayıttan", doc.getElementById("brand-title").textContent === "Radyoloji Panosu");
  check("bölüm kayıttan", doc.getElementById("brand-dept").textContent === "Görüntüleme");
  check("ekip kayıttan", doc.getElementById("team-list").textContent.includes("Ece Kaya"));
  check("bağlantı çipi", Boolean(q('#quick-links a[href="https://pacs.example/"]')));
  check("not kayıttan", doc.getElementById("note-list").textContent.includes("toplantı"));
  doc.querySelector('.tab[data-view="yemek"]').click();
  check("menü kayıttan", doc.getElementById("meal-body").textContent.includes("Kuru fasulye"));

  /* ---------- 9. Bozuk kayıt dayanıklılığı ---------- */
  console.log("\n9) Bozuk kayıt");
  const broken = makeDom(null);
  broken.dom.window.localStorage.setItem("rad-pano-v1", "{bozuk json");
  broken.dom.window.close();
  const recovered = makeDom({ v: 1, days: { "bozuk-tarih": { team: [{ name: 5 }] } }, notes: [{ text: 12 }] });
  await wait(120);
  check("bozuk alanlar temizlendi", recovered.errors.length === 0);
  check("uygulama açıldı", recovered.dom.window.document.getElementById("date-title").textContent.trim().length > 5);


  /* ---------- 10. Ekip listesi yapıştırma ---------- */
  console.log("\n10) Ekip listesi içe aktarma (metin)");
  let pasteDom = makeDom(null);
  await wait(120);
  let pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-team").click();
  check("içe aktarma diyaloğu açıldı", pdoc.getElementById("import-dialog").hasAttribute("open"));
  const pasteText = [
    "15.11.2026 Cumartesi",
    "08:00-16:00  Dr. Ayşe Yılmaz (MR), Murat Demir (BT)",
    "16:00-24:00  Ali Şahin",
    "24:00-08:00  Emre Yıldız",
    "",
    "16.11.2026 Pazar",
    "08:00-16:00  Dr. Ayşe Yılmaz (MR)",
  ].join("\n");
  pdoc.getElementById("import-text").value = pasteText;
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("önizleme: 2 gün", pdoc.getElementById("import-preview").textContent.includes("2 gün"));
  check("önizleme: 5 kişi", pdoc.getElementById("import-preview").textContent.includes("5 kişi"));
  check("uygula etkin", !pdoc.getElementById("import-apply").disabled);
  pdoc.getElementById("import-apply").click();
  await wait(60);
  let stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("ilk gün 4 kişi", stored2.days["2026-11-15"].team.length === 4);
  check("ikinci gün 1 kişi", stored2.days["2026-11-16"].team.length === 1);
  const ayse = stored2.days["2026-11-15"].team.find((member) => member.name.includes("Ayşe"));
  check("vardiya çözüldü", ayse.shift === "08–16");
  check("cihaz nota yazıldı", ayse.note === "MR");
  const emre = stored2.days["2026-11-15"].team.find((member) => member.name.includes("Emre"));
  check("gece vardiyası", emre.shift === "24–08");
  check("tarih seçildi", pdoc.getElementById("date-title").textContent.includes("15 Kasım"));

  pdoc.getElementById("import-team").click();
  pdoc.getElementById("import-text").value = pasteText;
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("tekrar ekleme çoğaltmıyor", stored2.days["2026-11-15"].team.length === 4);
  check("mükerrer uyarısı", pdoc.getElementById("toast").textContent.includes("zaten"));
  pdoc.querySelector("#import-dialog [data-close]").click();
  pasteDom.dom.window.close();

  /* ---------- 11. Excel'den kopyalanmış tablo ---------- */
  console.log("\n11) Excel tablosu yapıştırma");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-team").click();
  pdoc.getElementById("import-text").value = [
    "Tarih\t08:00-16:00\t16:00-24:00\t24:00-08:00",
    "16.11.2026 Pazartesi\tDr. Ece Kaya, Murat Demir\tAli Şahin\tEmre Yıldız",
    "17.11.2026 Salı\tDr. Ece Kaya\tZeynep Ak\tAli Şahin",
  ].join("\n");
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("tablo önizlemesi", pdoc.getElementById("import-preview").textContent.includes("7 kişi"));
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  const pzt = stored2.days["2026-11-16"].team;
  check("sütun vardiyaları", pzt.filter((member) => member.shift === "08–16").length === 2 && pzt.filter((member) => member.shift === "16–24").length === 1);
  check("gece sütunu", pzt.some((member) => member.name.includes("Emre") && member.shift === "24–08"));
  pasteDom.dom.window.close();

  /* ---------- 12. Gün adlarıyla haftalık liste ---------- */
  console.log("\n12) Gün adlarıyla haftalık liste");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-team").click();
  pdoc.getElementById("import-text").value = ["Pazartesi", "08-16: Ayşe Kaya, Mehmet Demir", "16-24: Ali Vural"].join("\n");
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  const monday = stored2.days["2026-11-09"];
  check("pazartesiye yazıldı", Boolean(monday) && monday.team.length === 3);
  check("gün adı vardiyası", monday.team.filter((member) => member.shift === "08–16").length === 2);
  pasteDom.dom.window.close();

  /* ---------- 13. Yemek listesi yapıştırma ---------- */
  console.log("\n13) Yemek listesi içe aktarma");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-meal").click();
  check("yemek modu", pdoc.querySelector('[data-import-mode="meal"]').classList.contains("is-active"));
  pdoc.getElementById("import-text").value = [
    "15.11.2026 Cumartesi",
    "Mercimek çorbası",
    "Izgara tavuk",
    "Pirinç pilavı",
    "",
    "16.11.2026 Pazar",
    "Domates çorbası · Karnıyarık · Sütlaç",
  ].join("\n");
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("menü önizlemesi", pdoc.getElementById("import-preview").textContent.includes("2 gün"));
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("menü satırları", stored2.days["2026-11-15"].meal.text.split("\n").length === 3);
  check("orta nokta ayrıldı", stored2.days["2026-11-16"].meal.text.split("\n").length === 3);
  check("menü içeriği", stored2.days["2026-11-15"].meal.text.includes("Izgara tavuk"));
  pasteDom.dom.window.close();

  /* ---------- 14. Excel dosyası ---------- */
  console.log("\n14) Excel dosyasından içe aktarma");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-team").click();
  const xlsxBuffer = fs.readFileSync(path.join(root, "tests/fixtures/ekip-listesi.xlsx"));
  const xlsxFile = {
    name: "ekip-listesi.xlsx",
    arrayBuffer: async () => xlsxBuffer.buffer.slice(xlsxBuffer.byteOffset, xlsxBuffer.byteOffset + xlsxBuffer.byteLength),
    text: async () => "",
  };
  const fileInput = pdoc.getElementById("import-file");
  Object.defineProperty(fileInput, "files", { value: [xlsxFile], configurable: true });
  fileInput.dispatchEvent(new pasteDom.dom.window.Event("change", { bubbles: true }));
  await wait(500);
  check("xlsx metne çevrildi", pdoc.getElementById("import-text").value.includes("Ece Kaya"));
  check("xlsx tarih hücresi", pdoc.getElementById("import-text").value.includes("16.11.2026"));
  check("xlsx önizlemesi", pdoc.getElementById("import-preview").textContent.includes("2 gün"));
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("xlsx 16 kasım kadrosu", stored2.days["2026-11-16"].team.length === 4);
  check("xlsx 17 kasım kadrosu", stored2.days["2026-11-17"].team.length === 3);
  pasteDom.dom.window.close();

  /* ---------- 15. Word dosyası ---------- */
  console.log("\n15) Word dosyasından içe aktarma");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-meal").click();
  const docxBuffer = fs.readFileSync(path.join(root, "tests/fixtures/yemek-listesi.docx"));
  const docxFile = {
    name: "yemek-listesi.docx",
    arrayBuffer: async () => docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength),
    text: async () => "",
  };
  const docxInput = pdoc.getElementById("import-file");
  Object.defineProperty(docxInput, "files", { value: [docxFile], configurable: true });
  docxInput.dispatchEvent(new pasteDom.dom.window.Event("change", { bubbles: true }));
  await wait(500);
  check("docx metne çevrildi", pdoc.getElementById("import-text").value.includes("Mercimek"));
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("docx menüsü", stored2.days["2026-11-16"] && stored2.days["2026-11-16"].meal.text.split("\n").length === 3);
  pasteDom.dom.window.close();


  /* ---------- 16. Aylık ızgara tablosu ---------- */
  console.log("\n16) Aylık ızgara (gün numaralı) tablo");
  pasteDom = makeDom(null);
  await wait(120);
  pdoc = pasteDom.dom.window.document;
  pdoc.getElementById("import-team").click();
  pdoc.getElementById("import-text").value = [
    "KASIM 2026",
    "Vardiya\t1\t2\t3\t4\t5",
    "08-16\tAyşe Kaya\tMehmet Demir\tAli Vural\tAyşe Kaya\tMehmet Demir",
    "16-24\tZeynep Ak\tAli Vural\tEmre Yıldız\tZeynep Ak\tAli Vural",
  ].join("\n");
  pdoc.getElementById("import-text").dispatchEvent(new pasteDom.dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("aylık önizleme 5 gün", pdoc.getElementById("import-preview").textContent.includes("5 gün"));
  check("aylık önizleme 10 kişi", pdoc.getElementById("import-preview").textContent.includes("10 kişi"));
  pdoc.getElementById("import-apply").click();
  await wait(60);
  stored2 = JSON.parse(pasteDom.dom.window.localStorage.getItem("rad-pano-v1"));
  check("ayın ilk günü", stored2.days["2026-11-01"] && stored2.days["2026-11-01"].team.length === 2);
  check("ayın beşinci günü", stored2.days["2026-11-05"] && stored2.days["2026-11-05"].team.length === 2);
  check("başlık isim sanılmadı", !Object.values(stored2.days).some((day) => day.team.some((member) => member.name.includes("Kasım 2026"))));
  check("vardiya sütunları", stored2.days["2026-11-01"].team.some((member) => member.shift === "16–24"));
  pasteDom.dom.window.close();

  console.log("\n" + (failures.length ? `BAŞARISIZ: ${failures.length} kontrol` : "TÜM KONTROLLER GEÇTİ"));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
