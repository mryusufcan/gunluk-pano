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

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const DAY_MS = 86400000;
function shiftKey(amount) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + amount);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function trDate(key) {
  const [year, month, day] = key.split("-");
  return `${day}.${month}.${year}`;
}

function baseContent() {
  return {
    version: 1,
    updatedAt: "2026-11-15T18:00:00.000Z",
    settings: { title: "Radyoloji Panosu", dept: "Görüntüleme" },
    directory: [
      { id: "d1", name: "Radyoloji Sekreterliği", phone: "1234", unit: "Sekreterya" },
      { id: "d2", name: "Uzm. Dr. Ece Kaya", phone: "8278", unit: "Radyoloji", hasMobile: true },
      { id: "d3", name: "dr.ayşe  yılmaz", phone: "", unit: "Radyoloji", hasMobile: true },
    ],
    days: {
      [TODAY]: {
        team: [
          { id: "a1", name: "Uzm. Dr. Ece Kaya", role: "Radyolog", shift: "08–16", phone: "1234", note: "MR" },
          { id: "a2", name: "Murat Demir", role: "Teknisyen", shift: "16–24", phone: "", note: "BT" },
        ],
        meal: { text: "Mercimek çorbası\nIzgara tavuk\nPilav", updatedAt: 0 },
      },
    },
    notes: [
      { id: "n1", text: "Saat 15:00 toplantı", author: "Başhekimlik", ts: Date.parse("2026-11-15T12:00:00Z"), pinned: true, done: false },
    ],
    notice: { text: "BT 14:00–16:00 arası bakımda", tone: "warn", updatedAt: Date.parse("2026-11-15T10:00:00Z") },
  };
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

const { webcrypto } = require("crypto");
const PHONE_PASS = "test-sifre";
const PHONE_MAP = { d2: "0532 111 22 33", d3: "0532 111 22 33" };
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

async function encryptFixture(pass) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const data = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(PHONE_MAP)));
  return { v: 1, iterations: 100000, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

let phonesFixture = null;
const getPhonesFixture = () => (phonesFixture = phonesFixture || encryptFixture(PHONE_PASS));

function makeDom({ content = baseContent(), mode = "viewer", failContent = false, github = null, publish = null, draft = null, hour = null, phones = true } = {}) {
  const store = {
    content: JSON.parse(JSON.stringify(content)),
    fail: failContent,
    puts: [],
    github: github || {
      repo: true,
      sha: "sha-123",
      putOk: true,
      putStatus: 200,
    },
  };
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(String(error && error.stack ? error.stack : error)));
  virtualConsole.on("error", (...args) => errors.push(args.join(" ")));

  const dom = new JSDOM(inline, {
    url: `http://localhost/gunluk-pano/${mode === "admin" ? "?admin=1" : ""}`,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      if (hour !== null) {
        const RealDate = window.Date;
        const now = new RealDate(RealDate.now());
        now.setHours(hour, 30, 0, 0);
        class FixedDate extends RealDate {
          constructor(...args) {
            if (args.length) super(...args);
            else super(now.getTime());
          }
        }
        FixedDate.now = () => now.getTime();
        window.Date = FixedDate;
      }
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.DecompressionStream = DecompressionStream;
      Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
      if (publish) window.localStorage.setItem("pano-publish", JSON.stringify(publish));
      if (draft) window.localStorage.setItem("pano-draft", JSON.stringify(draft));
      if (phones) window.localStorage.setItem("pano-phones", PHONE_PASS);
      window.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith("https://api.github.com/repos/")) {
          const method = String(init.method || "GET").toUpperCase();
          if (url.includes("/contents/")) {
            if (method === "PUT") {
              store.puts.push({ headers: init.headers || {}, body: JSON.parse(init.body || "{}") });
              return jsonResponse({ content: { path: "content.json" } }, store.github.putOk ? 200 : store.github.putStatus);
            }
            if (!store.github.sha) return jsonResponse({ message: "Not Found" }, 404);
            return jsonResponse({
              sha: store.github.sha,
              ...(store.github.content ? { content: store.github.content } : {}),
            });
          }
          if (!store.github.repo) return jsonResponse({ message: "Not Found" }, 404);
          return jsonResponse({ full_name: "test/repo" });
        }
        if (url.includes("content.json")) {
          if (store.fail) throw new TypeError("ağ yok");
          return jsonResponse(store.content);
        }
        if (url.includes("phones.enc")) {
          return { ok: true, status: 200, json: async () => getPhonesFixture() };
        }
        return jsonResponse({ message: "yok" }, 404);
      };
    },
  });
  return { dom, errors, store };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function boot(options = {}) {
  const instance = makeDom(options);
  await wait(180);
  return instance;
}

function q(doc, selector) {
  return doc.querySelector(selector);
}

async function main() {
  /* ---------- 1. Görüntüleme modu ---------- */
  console.log("\n1) Görüntüleme modu (ekip)");
  let { dom, errors } = await boot();
  let doc = dom.window.document;
  check("sayfa hatasız yüklendi", errors.length === 0, errors.join(" | "));
  check("görüntüleme modu", doc.documentElement.dataset.admin === "0");
  check("tarih başlığı dolu", doc.getElementById("date-title").textContent.trim().length > 5);
  check("hafta şeridi kaldırıldı", !doc.querySelector("#weekstrip"));
  check("hero tarih başlığı", doc.getElementById("date-title").textContent.length > 3);
  check("hero güncelleme satırı ekipte", !doc.getElementById("updated-line").hidden);
  check("ekip içerikten geldi", doc.getElementById("team-list").textContent.includes("Ece Kaya"));
  check("vardiya grubu", doc.querySelectorAll("#team-list details.shift").length === 2);
  check("telefon bağlantısı", Boolean(q(doc, '#team-list a[href^="tel:"]')));
  check("ekip düzenleme düğmesi yok", doc.querySelectorAll("#team-list [data-edit-member]").length === 0);
  check("görev rozeti yok", doc.querySelectorAll("#team-list .role").length === 0);
  check("ekip ekle düğmesi gizli", doc.getElementById("team-actions").hidden);
  check("not formu gizli", doc.querySelector(".composer").hidden);
  check("not işlem düğmesi yok", doc.querySelectorAll("#note-list .note-actions").length === 0);
  check("başlık içerikten", doc.getElementById("brand-title").textContent === "Radyoloji Panosu");
  check("bölüm içerikten", doc.getElementById("brand-dept").textContent === "Görüntüleme");
  check("rehber kaydı var", doc.getElementById("directory-list").textContent.includes("RADYOLOJİ SEKRETERLİĞİ"));
  check("rehber ünvanı sıyrıldı", !doc.getElementById("directory-list").textContent.includes("UZM. DR.") && doc.getElementById("directory-list").textContent.includes("ECE KAYA"));
  check("rehber telefon bağlantısı", Boolean(q(doc, '#directory-list a[href^="tel:"]')));
  check("rehber sayacı", doc.getElementById("directory-count").textContent.includes("3 kişi"));
  check("rehber adı düzenlendi", doc.getElementById("directory-list").textContent.includes("AYŞE YILMAZ"));
  check("rehber telefonu düzenlendi", doc.getElementById("directory-list").textContent.includes("0532 111 22 33"));
  check("kategori çipleri", doc.querySelectorAll("#directory-chips button").length === 19);
  check("kategori bölümleri", doc.querySelectorAll("#directory-list details.directory-group").length === 2);
  doc.querySelector('#directory-chips button[data-group="Hekimler"]').click();
  check("kategori filtresi", doc.querySelectorAll("#directory-list .directory-row").length === 2 && doc.getElementById("directory-list").textContent.includes("AYŞE YILMAZ"));
  check("yönetici çubuğu gizli", doc.getElementById("admin-bar").hidden);
  check("duyuru şeridi görünür", !doc.getElementById("notice").hidden);
  check("duyuru metni", doc.getElementById("notice-text").textContent.includes("bakımda"));
  check("duyuru uyarı tonu", doc.getElementById("notice").classList.contains("notice-warn"));
  check("duyuru düzenle gizli", doc.getElementById("notice-edit").hidden);
  check("son güncelleme satırı", doc.getElementById("updated-line").textContent.includes("Son güncelleme"));
  check("önbellek uyarısı gizli", doc.getElementById("offline-note").hidden);
  check("ayarlarda okuma bilgisi", doc.getElementById("view-title").textContent === "Radyoloji Panosu");
  check("yayın bölümü gizli", doc.getElementById("pub-repo").closest(".panel").hidden);

  /* Yetkisiz düzenleme denemesi */
  doc.getElementById("add-member").click();
  await wait(30);
  check("görüntüleyici ekip ekleyemiyor", !doc.getElementById("member-dialog").hasAttribute("open"));

  doc = dom.window.document;

  /* ---------- 2. Yemek, rehber ve notlar (görüntüleme) ---------- */
  console.log("\n2) Yemek, rehber ve notlar (görüntüleme)");
  doc.querySelector('.tab[data-view="rehber"]').click();
  check("rehber sekmesi", doc.querySelector('.view[data-view="rehber"]').classList.contains("is-active"));
  check("rehber araması başlıkta", !doc.getElementById("hero-search").hidden);
  check("arama kutusu başlık içinde", Boolean(doc.querySelector(".hero #directory-search")));
  check("arama düğmesi sonuçta", Boolean(q(doc, "#directory-list .call-btn[href^='tel:']")));
  const dirSearch = doc.getElementById("directory-search");
  dirSearch.value = "kaya ece";
  dirSearch.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  check("kelime kelime arama", doc.getElementById("directory-list").textContent.includes("ECE KAYA"));
  dirSearch.value = "";
  dirSearch.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  check("çift numara iki arama düğmesi", doc.querySelectorAll("#directory-list .directory-calls .call-btn").length >= 2);
  doc.querySelector('.tab[data-view="modalite"]').click();
  check("modalite sekmesi", doc.querySelector('.view[data-view="modalite"]').classList.contains("is-active"));
  const modalityText = doc.getElementById("modality-summary").textContent;
  check("modalite tablosu", modalityText.includes("Ece Kaya") && modalityText.includes("MR") && modalityText.includes("Akşam"));
  check("modalite bu ay", doc.getElementById("modality-hint").textContent.includes(String(new Date().getFullYear())));
  doc.querySelector('.tab[data-view="ekip"]').click();
  check("ekip sekmesi", doc.querySelector('.view[data-view="ekip"]').classList.contains("is-active"));
  check("menü ekip ekranında", doc.getElementById("meal-body").textContent.includes("Izgara tavuk"));
  check("menü başlığı", doc.getElementById("team-hint").textContent.includes("kişi"));
  const mealLines = doc.querySelector("#meal-body .meal-text").textContent.split("\n").length;
  check("menü satırları korundu", mealLines === 3);
  doc.querySelector('.tab[data-view="notlar"]').click();
  check("not listede", doc.getElementById("note-list").textContent.includes("toplantı"));
  check("not durum noktası", Boolean(q(doc, "#note-list .note-status")));
  check("sabitlenen filtresi", (doc.querySelector('.filter[data-filter="pinned"]').click(), doc.querySelectorAll("#note-list .note.is-pinned").length === 1));
  dom.window.close();

  /* ---------- 3. Tarih gezinme ---------- */
  console.log("\n3) Tarih gezinme");
  ({ dom } = await boot());
  doc = dom.window.document;
  const firstDate = doc.getElementById("date-title").textContent;
  doc.getElementById("next-day").click();
  await wait(20);
  check("sonraki gün boş", doc.getElementById("team-list").textContent.includes("yayınladığında"));
  check("tarih değişti", doc.getElementById("date-title").textContent !== firstDate);
  doc.getElementById("prev-day").click();
  await wait(20);
  check("geri dönünce ekip", doc.getElementById("team-list").textContent.includes("Ece Kaya"));
  dom.window.close();

  /* ---------- 4. Yönetici modu: ekip düzenleme ---------- */
  console.log("\n4) Yönetici modu: düzenleme");
  ({ dom } = await boot({ mode: "admin" }));
  doc = dom.window.document;
  check("yönetici modu", doc.documentElement.dataset.admin === "1");
  check("yönetici çubuğu görünür", !doc.getElementById("admin-bar").hidden);
  check("durum: yayınlanmış", doc.getElementById("admin-status").textContent.includes("Yayınlandı"));
  check("ekip ekle görünür", !doc.getElementById("add-member").hidden);
  check("icap vardiyası yok", ![...doc.getElementById("m-shift").options].some((option) => option.value === "İcap"));
  check("depo önceden dolu", doc.getElementById("pub-repo").value === "mryusufcan/gunluk-pano");
  check("rehber düzenleyicisi satırları", doc.querySelectorAll("#directory-editor .directory-edit-row").length === 3);
  const editSearch = doc.getElementById("directory-edit-search");
  editSearch.value = "#eksik";
  editSearch.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  check("birimsiz filtresi", doc.getElementById("directory-editor").textContent.includes("Eşleşen kayıt yok"));
  editSearch.value = "";
  editSearch.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const directoryPhone = doc.querySelector('#directory-editor input[data-directory="phone"]');
  check("rehber giriş alanı", Boolean(directoryPhone));
  check("rehber ad alanı", doc.querySelector('#directory-editor input[data-directory="name"]').value.includes("SEKRETERLİĞİ"));
  directoryPhone.value = "9999";
  directoryPhone.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(600);
  check("rehber taslağa yazıldı", JSON.parse(dom.window.localStorage.getItem("pano-draft")).directory[0].phone === "9999");
  const groupSelect = doc.querySelector('#directory-editor select[data-directory="group"]');
  check("kategori seçici", Boolean(groupSelect) && groupSelect.options.length === 18);
  groupSelect.value = "İdari İşler";
  groupSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await wait(600);
  check("kategori taslağa yazıldı", JSON.parse(dom.window.localStorage.getItem("pano-draft")).directory[0].group === "İdari İşler");
  doc.querySelector("[data-fav-directory]").click();
  await wait(40);
  check("sık kullanılan kutucuğu", doc.querySelectorAll("#favorites .fav-tile").length === 1);
  check("sık kullanılan taslağa yazıldı", JSON.parse(dom.window.localStorage.getItem("pano-draft")).directory.some((item) => item.fav));
  check("duyuru alanı dolu", doc.getElementById("notice-input").value.includes("bakımda"));
  doc.getElementById("notice-input").value = "MR cihazı arızalı";
  doc.getElementById("notice-input").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(550);
  check("duyuru şeridi güncellendi", doc.getElementById("notice-text").textContent === "MR cihazı arızalı");
  check("duyuru taslağa yazıldı", JSON.parse(dom.window.localStorage.getItem("pano-draft")).notice.text === "MR cihazı arızalı");
  check("GitHub düzenleme bağlantısı", doc.getElementById("pub-github-edit").href.includes("/mryusufcan/gunluk-pano/edit/main/content.json"));
  doc.getElementById("add-member").click();
  check("üye diyaloğu açıldı", doc.getElementById("member-dialog").hasAttribute("open"));
  doc.getElementById("m-name").value = "Yeni Teknisyen";
  doc.getElementById("m-shift").value = "24–08";
  doc.getElementById("member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("yeni kişi listede", doc.getElementById("team-list").textContent.includes("Yeni Teknisyen"));
  check("durum: taslak", doc.getElementById("admin-status").textContent.includes("Yayınlanmamış"));
  const draft = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("taslak kaydedildi", JSON.stringify(draft).includes("Yeni Teknisyen"));

  doc.querySelector('.tab[data-view="ekip"]').click();
  doc.getElementById("edit-meal").click();
  doc.getElementById("meal-textarea").value = "Ezogelin\nKuru fasulye";
  doc.getElementById("meal-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("menü düzenlendi", doc.getElementById("meal-body").textContent.includes("Kuru fasulye"));

  doc.querySelector('.tab[data-view="notlar"]').click();
  doc.getElementById("note-text").value = "Cihaz bakımı yarın";
  doc.getElementById("note-author").value = "Teknisyen Ali";
  doc.getElementById("note-tag").value = "ariza";
  doc.getElementById("note-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("not eklendi", doc.getElementById("note-list").textContent.includes("Cihaz bakımı"));
  check("not etiketi", Boolean(q(doc, "#note-list .note.tag-ariza .note-tag")));
  const draft2 = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("taslakta not var", draft2.notes.some((note) => note.text.includes("Cihaz bakımı")));
  dom.window.close();

  /* ---------- 5. Yönetici modu: içe aktarma ---------- */
  console.log("\n5) Yönetici modu: liste içe aktarma");
  ({ dom } = await boot({ mode: "admin" }));
  doc = dom.window.document;
  doc.getElementById("import-team").click();
  check("içe aktarma diyaloğu", doc.getElementById("import-dialog").hasAttribute("open"));
  doc.getElementById("import-text").value = [
    `${trDate(shiftKey(1))} Pazartesi`,
    "08:00-16:00  Dr. Ayşe Yılmaz (MR), Murat Demir (BT)",
    "16:00-24:00  Ali Şahin",
  ].join("\n");
  doc.getElementById("import-text").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("önizleme kişi sayısı", doc.getElementById("import-preview").textContent.includes("3 kişi"));
  doc.getElementById("import-apply").click();
  await wait(60);
  const draft3 = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  const imported = draft3.days[shiftKey(1)];
  check("içe aktarma yazıldı", Boolean(imported) && imported.team.length === 3);
  check("cihaz notu", imported.team.some((member) => member.name.includes("Ayşe") && member.note === "MR"));

  doc.getElementById("import-team").click();
  doc.getElementById("import-text").value = [
    `${trDate(shiftKey(1))} Pazartesi`,
    "08:00-16:00  MURAT DEMİR (BT)",
    "16:00-24:00  ALİ ŞAHİN",
  ].join("\n");
  doc.getElementById("import-text").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(450);
  doc.getElementById("import-apply").click();
  await wait(60);
  const draft3b = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("büyük/küçük harf çift kayıt yapmıyor", draft3b.days[shiftKey(1)].team.length === 3, JSON.stringify(draft3b.days[shiftKey(1)].team.map((m) => [m.name, m.shift])));
  doc.querySelector('.tab[data-view="modalite"]').click();
  const modalityText2 = doc.getElementById("modality-summary").textContent.toLocaleLowerCase("tr");
  check("modalite harf farkını tek satırda topluyor", modalityText2.split("murat demir").length - 1 === 1);
  dom.window.close();

  /* ---------- 6. Excel ve Word dosyası ---------- */
  console.log("\n6) Excel ve Word dosyası");
  ({ dom } = await boot({ mode: "admin" }));
  doc = dom.window.document;
  doc.getElementById("import-team").click();
  const xlsx = fs.readFileSync(path.join(root, "tests/fixtures/ekip-listesi.xlsx"));
  const xlsxFile = {
    name: "ekip-listesi.xlsx",
    arrayBuffer: async () => xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength),
    text: async () => "",
  };
  const fileInput = doc.getElementById("import-file");
  Object.defineProperty(fileInput, "files", { value: [xlsxFile], configurable: true });
  fileInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await wait(500);
  check("xlsx metne çevrildi", doc.getElementById("import-text").value.includes("Ece Kaya"));
  check("xlsx tarih okundu", doc.getElementById("import-text").value.includes("16.11.2026"));
  doc.getElementById("import-apply").click();
  await wait(60);
  const draft4 = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  const importedTeam = (draft4.days["2026-11-16"] && draft4.days["2026-11-16"].team) || [];
  const importedNext = (draft4.days["2026-11-17"] && draft4.days["2026-11-17"].team) || [];
  check(
    "xlsx aktarıldı",
    importedTeam.some((member) => member.name === "Ali Şahin") &&
      importedTeam.some((member) => member.name === "Emre Yıldız") &&
      importedNext.some((member) => member.name === "Zeynep Ak"),
    JSON.stringify([importedTeam.map((m) => m.name), importedNext.map((m) => m.name)]),
  );
  dom.window.close();

  ({ dom } = await boot({ mode: "admin" }));
  doc = dom.window.document;
  doc.getElementById("import-meal").click();
  const docx = fs.readFileSync(path.join(root, "tests/fixtures/yemek-listesi.docx"));
  const docxFile = {
    name: "yemek-listesi.docx",
    arrayBuffer: async () => docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength),
    text: async () => "",
  };
  const docxInput = doc.getElementById("import-file");
  Object.defineProperty(docxInput, "files", { value: [docxFile], configurable: true });
  docxInput.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  await wait(500);
  check("docx okundu", doc.getElementById("import-text").value.includes("Mercimek"));
  doc.getElementById("import-apply").click();
  await wait(60);
  const draft5 = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("docx menüsü", draft5.days["2026-11-16"].meal.text.split("\n").length === 3);
  dom.window.close();

  /* ---------- 7. GitHub yayını ---------- */
  console.log("\n7) GitHub yayını");
  ({ dom } = await boot({
    mode: "admin",
    publish: { repo: "mryusufcan/gunluk-pano", branch: "main", path: "content.json", token: "test-token" },
  }));
  doc = dom.window.document;
  doc.getElementById("add-member").click();
  doc.getElementById("m-name").value = "Yayın Testi Kişi";
  doc.getElementById("m-shift").value = "08–16";
  doc.getElementById("member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  doc.getElementById("admin-publish").click();
  await wait(250);
  check("yayın isteği gönderildi", dom.window.localStorage.getItem("pano-draft") === null);
  check("durum: yayınlandı", doc.getElementById("admin-status").textContent.includes("Yayınlandı"));
  dom.window.close();

  /* ---------- 8. Yayın isteği içeriği ---------- */
  console.log("\n8) Yayın isteği içeriği");
  const pubInstance = await boot({
    mode: "admin",
    publish: { repo: "mryusufcan/gunluk-pano", branch: "main", path: "content.json", token: "test-token" },
  });
  const pdoc = pubInstance.dom.window.document;
  pdoc.getElementById("add-member").click();
  pdoc.getElementById("m-name").value = "İçerik Kontrol";
  pdoc.getElementById("member-form").dispatchEvent(new pubInstance.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  pdoc.getElementById("admin-publish").click();
  await wait(250);
  const put = pubInstance.store.puts[0];
  check("PUT isteği var", Boolean(put));
  check("yetki başlığı", put && put.headers.Authorization === "Bearer test-token");
  check("sha gönderildi", put && put.body.sha === "sha-123");
  const decoded = put ? JSON.parse(Buffer.from(put.body.content, "base64").toString("utf8")) : {};
  check("yayınlanan içerik", JSON.stringify(decoded).includes("İçerik Kontrol"));
  check("yayın zamanı", typeof decoded.updatedAt === "string" && !Number.isNaN(Date.parse(decoded.updatedAt)));
  check("tema yayınlanmıyor", !decoded.theme && !(decoded.settings && decoded.settings.theme));
  pubInstance.dom.window.close();

  /* ---------- 9. Yayın hatası ---------- */
  console.log("\n9) Yayın hatası");
  const failInstance = await boot({
    mode: "admin",
    github: { repo: true, sha: "sha-123", putOk: false, putStatus: 500 },
    publish: { repo: "mryusufcan/gunluk-pano", branch: "main", path: "content.json", token: "test-token" },
  });
  const fdoc = failInstance.dom.window.document;
  fdoc.getElementById("add-member").click();
  fdoc.getElementById("m-name").value = "Taslak Kişi";
  fdoc.getElementById("member-form").dispatchEvent(new failInstance.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  fdoc.getElementById("pub-publish").click();
  await wait(200);
  check("hata bildirildi", fdoc.getElementById("pub-status").classList.contains("is-warn"));
  check("taslak korundu", failInstance.dom.window.localStorage.getItem("pano-draft") !== null);
  failInstance.dom.window.close();

  /* ---------- 10. Görüntüleyici yenileme ve önbellek ---------- */
  console.log("\n10) Görüntüleyici yenileme ve önbellek");
  const liveInstance = await boot();
  const ldoc = liveInstance.dom.window.document;
  liveInstance.store.content.days[TODAY].team.push({
    id: "a9",
    name: "Sonradan Eklenen",
    role: "Radyolog",
    shift: "08–16",
    phone: "",
    note: "",
  });
  ldoc.getElementById("refresh-btn").click();
  await wait(250);
  check("yenileme yeni veriyi getirdi", ldoc.getElementById("team-list").textContent.includes("Sonradan Eklenen"));
  liveInstance.store.fail = true;
  ldoc.getElementById("refresh-btn").click();
  await wait(1100);
  check("çevrimdışı uyarısı", ldoc.getElementById("offline-note").hidden === false);
  check("önbellek gösterildi", ldoc.getElementById("team-list").textContent.includes("Ece Kaya"));
  liveInstance.dom.window.close();

  console.log("\n10b) Yönetici çevrimdışı: taslak korunuyor");
  const draftBase = baseContent();
  draftBase.days[TODAY].team.push({ id: "a7", name: "Taslaktan Gelen", shift: "08–16", phone: "", note: "" });
  draftBase.updatedAt = Date.now() + 5000;
  const offlineAdmin = makeDom({ mode: "admin", failContent: true, draft: draftBase });
  await wait(1100);
  const odoc = offlineAdmin.dom.window.document;
  check("taslak yüklendi", odoc.getElementById("team-list").textContent.includes("Taslaktan Gelen"));
  check("yönetici durumu çevrimdışı", odoc.getElementById("admin-status").textContent.includes("Çevrimdışı"));
  check("yayın düğmesi kapalı", odoc.getElementById("admin-publish").disabled === true);
  check("yönetici yeniden dene görünür", odoc.getElementById("admin-retry").hidden === false);
  check("çevrimdışı bant yöneticide gizli", odoc.getElementById("offline-note").hidden === true);
  check("çevrimdışı hata yok", offlineAdmin.errors.length === 0, offlineAdmin.errors.join(" | "));
  offlineAdmin.dom.window.close();

  /* ---------- 11. Bozuk içerik ---------- */
  console.log("\n11) Bozuk içerik");
  const brokenInstance = await boot({ content: { days: { "bozuk": { team: [{ name: 5 }] } }, notes: "yok" } });
  check("bozuk içerik çökertmiyor", brokenInstance.errors.length === 0, brokenInstance.errors.join(" | "));
  check("sayfa yine açıldı", brokenInstance.dom.window.document.getElementById("date-title").textContent.trim().length > 5);
  brokenInstance.dom.window.close();

  /* ---------- 12. Tema, paylaşım, aylık tablo ---------- */
  console.log("\n12) Tema ve paylaşım");
  ({ dom } = await boot({ hour: 12 })); // öğlen: otomatik gece teması karışmasın
  doc = dom.window.document;
  doc.getElementById("theme-toggle").click();
  check("gece teması", doc.documentElement.dataset.theme === "dark");
  check("tema cihazda", dom.window.localStorage.getItem("pano-theme") === "dark");
  doc.getElementById("share-btn").click();
  await wait(60);
  check("paylaşım diyaloğu", doc.getElementById("share-dialog").hasAttribute("open"));
  check("paylaşım metni", doc.getElementById("share-text").value.includes("GÜNÜN EKİBİ"));
  check("paylaşımda duyuru", doc.getElementById("share-text").value.includes("DUYURU:"));
  dom.window.close();

  console.log("\n13) Aylık ızgara (yönetici)");
  ({ dom } = await boot({ mode: "admin" }));
  doc = dom.window.document;
  doc.getElementById("import-team").click();
  doc.getElementById("import-text").value = [
    "KASIM 2026",
    "Vardiya\t1\t2\t3\t4\t5",
    "08-16\tAyşe Kaya\tMehmet Demir\tAli Vural\tAyşe Kaya\tMehmet Demir",
    "16-24\tZeynep Ak\tAli Vural\tEmre Yıldız\tZeynep Ak\tAli Vural",
  ].join("\n");
  doc.getElementById("import-text").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(450);
  check("aylık önizleme", doc.getElementById("import-preview").textContent.includes("10 kişi"));
  doc.getElementById("import-apply").click();
  await wait(60);
  const draft6 = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("aylık günler yazıldı", draft6.days["2026-11-01"] && draft6.days["2026-11-05"]);
  check("başlık isim sanılmadı", !Object.values(draft6.days).some((day) => day.team.some((member) => member.name.includes("Kasım 2026"))));
  dom.window.close();

  console.log("\n14) Eski günler kırpılıyor (yönetici)");
  const oldContent = baseContent();
  const oldKey = shiftKey(-120);
  oldContent.days[oldKey] = {
    team: [{ id: "a9", name: "Eski Kişi", shift: "08–16", phone: "", note: "" }],
    meal: { text: "Eski menü", updatedAt: 0 },
  };
  ({ dom } = await boot({ mode: "admin", content: oldContent }));
  doc = dom.window.document;
  const directoryName = doc.querySelector('#directory-editor input[data-directory="name"]');
  directoryName.value = "Sekreterya";
  directoryName.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await wait(700);
  const rawDraft = dom.window.localStorage.getItem("pano-draft");
  check("taslak yazıldı", Boolean(rawDraft));
  const draft7 = rawDraft ? JSON.parse(rawDraft) : { days: {} };
  check("eski gün taslaktan düştü", !draft7.days[oldKey]);
  check("bugünkü gün duruyor", Boolean(draft7.days[TODAY]));
  dom.window.close();

  console.log("\n15) Araya giren yayın uyarısı");
  const newer = baseContent();
  newer.updatedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const conflict = await boot({
    mode: "admin",
    github: { repo: true, sha: "sha-999", content: Buffer.from(JSON.stringify(newer)).toString("base64") },
    publish: { repo: "mryusufcan/gunluk-pano", branch: "main", path: "content.json", token: "test-token" },
  });
  const cdoc = conflict.dom.window.document;
  cdoc.getElementById("add-member").click();
  cdoc.getElementById("m-name").value = "Çakışma Kişi";
  cdoc.getElementById("member-form").dispatchEvent(new conflict.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  cdoc.getElementById("admin-publish").click();
  await wait(300);
  check("yeni sürüm uyarısı", cdoc.getElementById("confirm-dialog").hasAttribute("open"));
  check("onaydan önce yazılmadı", conflict.store.puts.length === 0);
  cdoc.getElementById("confirm-ok").click();
  await wait(300);
  check("onaydan sonra yayınlandı", conflict.store.puts.length === 1);
  conflict.dom.window.close();

  console.log("\n16) Gece vardiyasi hangi gune ait");
  const yesterday = shiftKey(-1);
  function nightContent() {
    const content = baseContent();
    content.days[yesterday] = {
      team: [{ id: "g1", name: "Dun Gececisi", shift: "24\u201308", phone: "", note: "" }],
      meal: { text: "", updatedAt: 0 },
    };
    content.days[TODAY].team.push({ id: "g2", name: "Yarin Gececisi", shift: "24\u201308", phone: "", note: "" });
    return content;
  }
  const night = await boot({ content: nightContent(), hour: 3 });
  const ndoc = night.dom.window.document;
  check("gece 03:00 dunun panosu acilir", ndoc.getElementById("date-input").value === yesterday);
  check("gece 03:00 dunun gececisi gorunur", ndoc.getElementById("team-list").textContent.includes("Dun Gececisi"));
  const nightChip = ndoc.querySelector("#team-list .chip-now");
  check("gece 03:00 su an cipi 24-08 grubunda", Boolean(nightChip) && nightChip.closest("details").dataset.shift.replace(/\D/g, "") === "2408");
  check("gece 03:00 yarinin gececisi gorunmez", !ndoc.getElementById("team-list").textContent.includes("Yarin Gececisi"));
  night.dom.window.close();

  const morning = await boot({ content: nightContent(), hour: 10 });
  const mdoc = morning.dom.window.document;
  check("sabah 10:00 bugunun panosu acilir", mdoc.getElementById("date-input").value === TODAY);
  const morningChip = mdoc.querySelector("#team-list .chip-now");
  check("sabah 10:00 su an cipi 08-16 grubunda", Boolean(morningChip) && morningChip.closest("details").dataset.shift.replace(/\D/g, "") === "0816");
  morning.dom.window.close();

  /* ---------- 17. Cep numaralari sifre kilidi ---------- */
  console.log("\n17) Cep numaralari kilidi");
  const lockInst = await boot({ phones: false, hour: 12 });
  const lockDoc = lockInst.dom.window.document;
  check("kilitli: cep numarasi gizli", !lockDoc.getElementById("directory-list").textContent.includes("0532 111 22 33"));
  check("kilitli: maskeli cep dugmesi", Boolean(q(lockDoc, "#directory-list .call-btn.is-locked")));
  check("kilitli: dahili numara gorunur", lockDoc.getElementById("directory-list").textContent.includes("8278"));
  check("kilitli: sifre cubugu gorunur", !lockDoc.getElementById("phone-lock").hidden);

  lockDoc.getElementById("phone-pass").value = "yanlis";
  lockDoc.getElementById("phone-unlock").dispatchEvent(new lockInst.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  check("yanlis sifre: hala kilitli", Boolean(q(lockDoc, "#directory-list .call-btn.is-locked")));

  lockDoc.getElementById("phone-pass").value = PHONE_PASS;
  lockDoc.getElementById("phone-unlock").dispatchEvent(new lockInst.dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(30);
  check("dogru sifre: cep numarasi acilir", lockDoc.getElementById("directory-list").textContent.includes("0532 111 22 33"));
  check("dogru sifre: kilit cubugu gizlenir", lockDoc.getElementById("phone-lock").hidden);
  check("dogru sifre: cep tel: baglantisi", Boolean(q(lockDoc, '#directory-list a[href^="tel:"]')));
  lockInst.dom.window.close();

  /* ---------- 18. Fotografdan cizelge metni ---------- */
  console.log("\n18) Fotograftan cizelge okuma");
  const ocrInst = await boot({ hour: 12 });
  const ocrData = {
    days: [
      {
        date: "2026-11-23",
        lines: [
          { shift: "08:00-16:00", name: "KUTAY HOŞ", device: "MR" },
          { shift: "08:00-16:00", name: "DAMLANUR KÖKSALAN", device: "BT" },
          { shift: "16:00-24:00", name: "SEDANUR DEMİR", device: "" },
          { shift: "16:00-24:00", name: "MERT ASLAN", device: "" },
          { shift: "24:00-08:00", name: "ABDULLAH TECEN", device: "" },
        ],
      },
      { date: "2026-11-24", lines: [] },
    ],
  };
  const ocrValue = ocrInst.dom.window.ocrText(ocrData);
  check("fotograf metni gun basligi", ocrValue.includes("23.11.2026"));
  check("fotograf metni cihaz", ocrValue.includes("KUTAY HOŞ (MR)"));
  check("fotograf metni bos gun atlanir", !ocrValue.includes("24.11.2026"));
  const ocrParsed = ocrInst.dom.window.parseImport(ocrValue, "team", "2026-11-23", 0);
  const ocrMembers = ocrParsed.groups.get("2026-11-23") || [];
  const ocrFind = (name) => ocrMembers.find((member) => member.name === name) || {};
  check(
    "fotograf metni vardiyalara ayrilir",
    ocrFind("KUTAY HOŞ").shift === "08–16" &&
      ocrFind("SEDANUR DEMİR").shift === "16–24" &&
      ocrFind("ABDULLAH TECEN").shift === "24–08",
  );
  check("fotograf metni cihaz notu", ocrFind("KUTAY HOŞ").note === "MR" && ocrFind("SEDANUR DEMİR").note === "");
  check("fotograf metni kisi sayisi", ocrMembers.length === 5, `(${ocrMembers.length})`);
  check("fotograf icin anahtar alani var", Boolean(ocrInst.dom.window.document.getElementById("ocr-key")));
  check(
    "fotograf okuma durumu gorunur",
    Boolean(ocrInst.dom.window.document.getElementById("import-status")) &&
      Boolean(ocrInst.dom.window.document.getElementById("import-file-text")),
  );
  ocrInst.dom.window.close();

  const exitCode = failures.length ? 1 : 0;
  console.log("\n" + (failures.length ? `BAŞARISIZ: ${failures.length} kontrol` : "TÜM KONTROLLER GEÇTİ"));
  process.exitCode = exitCode;
  // jsdom zamanlayıcıları süreci askıda bırakmasın
  setTimeout(() => process.exit(exitCode), 200);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
