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
    links: [{ id: "pacs", label: "PACS", url: "https://pacs.example/" }],
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

function makeDom({ content = baseContent(), mode = "viewer", failContent = false, github = null, publish = null } = {}) {
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
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.DecompressionStream = DecompressionStream;
      if (publish) window.localStorage.setItem("pano-publish", JSON.stringify(publish));
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
            return jsonResponse({ sha: store.github.sha });
          }
          if (!store.github.repo) return jsonResponse({ message: "Not Found" }, 404);
          return jsonResponse({ full_name: "test/repo" });
        }
        if (url.includes("content.json")) {
          if (store.fail) throw new TypeError("ağ yok");
          return jsonResponse(store.content);
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
  check("hafta şeridi 7 gün", doc.querySelectorAll("#weekstrip .chip").length === 7);
  check("ekip içerikten geldi", doc.getElementById("team-list").textContent.includes("Ece Kaya"));
  check("vardiya grubu", doc.querySelectorAll("#team-list .group-label").length === 2);
  check("telefon bağlantısı", Boolean(q(doc, '#team-list a[href^="tel:"]')));
  check("ekip düzenleme düğmesi yok", doc.querySelectorAll("#team-list [data-edit-member]").length === 0);
  check("ekip ekle düğmesi gizli", doc.getElementById("add-member").hidden);
  check("not formu gizli", doc.getElementById("note-form").hidden);
  check("not işlem düğmesi yok", doc.querySelectorAll("#note-list .note-actions").length === 0);
  check("başlık içerikten", doc.getElementById("brand-title").textContent === "Radyoloji Panosu");
  check("bölüm içerikten", doc.getElementById("brand-dept").textContent === "Görüntüleme");
  check("hızlı erişim çipi", Boolean(q(doc, '#quick-links a[href="https://pacs.example/"]')));
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

  /* ---------- 2. Yemek ve notlar (görüntüleme) ---------- */
  console.log("\n2) Yemek ve notlar (görüntüleme)");
  doc.querySelector('.tab[data-view="yemek"]').click();
  check("yemek sekmesi", doc.querySelector('.view[data-view="yemek"]').classList.contains("is-active"));
  check("menü göründü", doc.getElementById("meal-body").textContent.includes("Izgara tavuk"));
  const mealLines = doc.querySelector("#meal-body .meal-text").textContent.split("\n").length;
  check("menü satırları korundu", mealLines === 3);
  doc.querySelector('.tab[data-view="notlar"]').click();
  check("not listede", doc.getElementById("note-list").textContent.includes("toplantı"));
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
  check("depo önceden dolu", doc.getElementById("pub-repo").value === "mryusufcan/gunluk-pano");
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
  doc.getElementById("m-role").value = "Teknisyen";
  doc.getElementById("m-shift").value = "24–08";
  doc.getElementById("member-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("yeni kişi listede", doc.getElementById("team-list").textContent.includes("Yeni Teknisyen"));
  check("durum: taslak", doc.getElementById("admin-status").textContent.includes("Yayınlanmamış"));
  const draft = JSON.parse(dom.window.localStorage.getItem("pano-draft"));
  check("taslak kaydedildi", JSON.stringify(draft).includes("Yeni Teknisyen"));

  doc.querySelector('.tab[data-view="yemek"]').click();
  doc.getElementById("edit-meal").click();
  doc.getElementById("meal-textarea").value = "Ezogelin\nKuru fasulye";
  doc.getElementById("meal-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("menü düzenlendi", doc.getElementById("meal-body").textContent.includes("Kuru fasulye"));

  doc.querySelector('.tab[data-view="notlar"]').click();
  doc.getElementById("note-text").value = "Cihaz bakımı yarın";
  doc.getElementById("note-author").value = "Teknisyen Ali";
  doc.getElementById("note-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(40);
  check("not eklendi", doc.getElementById("note-list").textContent.includes("Cihaz bakımı"));
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
  check("xlsx aktarıldı", draft4.days["2026-11-16"].team.length === 4);
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
  await wait(250);
  check("çevrimdışı uyarısı", ldoc.getElementById("offline-note").hidden === false);
  check("önbellek gösterildi", ldoc.getElementById("team-list").textContent.includes("Ece Kaya"));
  liveInstance.dom.window.close();

  /* ---------- 11. Bozuk içerik ---------- */
  console.log("\n11) Bozuk içerik");
  const brokenInstance = await boot({ content: { days: { "bozuk": { team: [{ name: 5 }] } }, notes: "yok" } });
  check("bozuk içerik çökertmiyor", brokenInstance.errors.length === 0, brokenInstance.errors.join(" | "));
  check("sayfa yine açıldı", brokenInstance.dom.window.document.getElementById("date-title").textContent.trim().length > 5);
  brokenInstance.dom.window.close();

  /* ---------- 12. Tema, paylaşım, aylık tablo ---------- */
  console.log("\n12) Tema ve paylaşım");
  ({ dom } = await boot());
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

  console.log("\n" + (failures.length ? `BAŞARISIZ: ${failures.length} kontrol` : "TÜM KONTROLLER GEÇTİ"));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
