/* Günün Panosu — radyoloji günlük pano.
   İçerik content.json dosyasından okunur; ekip sadece görüntüler.
   Yönetici ?admin=1 adresinden düzenler ve GitHub'a yayınlar. */
"use strict";

/* ---------- Sabitler ---------- */
const PREVIEW = typeof window !== "undefined" && Boolean(window.__PANO_PREVIEW);
const CONTENT_URL = (typeof window !== "undefined" && window.__PANO_CONTENT_URL) || "content.json";
const CACHE_KEY = "pano-cache";
const DRAFT_KEY = "pano-draft";
const PUBLISH_KEY = "pano-publish";
const OCR_KEY = "pano-ocr-key";
const AUTHOR_KEY = "pano-author";
const THEME_KEY = "pano-theme";
const VIEW_KEY = "pano-view";
const SHIFT_KEY = "nobet-listesi-static-v1";
const SHIFT_SHEET_ID = "10-i9GBdUwCZ2XWA1IylaA5V5EgxPQG3BzGmemyJT-5I";
const SHIFT_DEVICES = ["MR", "BT", "RÖNT-PORT", "RÖNTGEN", "RÖNT-MAMO"];
const SHIFTS = ["08–16", "16–24", "24–08", "İdari", "İzinli"];
const SHIFT_LABELS = { "08–16": "Sabah", "16–24": "Akşam", "24–08": "Gece", "İdari": "İdari", "İzinli": "İzinli" };
const NOTE_TAGS = { sabit: "Sabit", ariza: "Arıza", duyuru: "Duyuru", hatirlatma: "Hatırlatma" };
const VIEWS = ["ekip", "modalite", "rehber", "notlar", "ayarlar"];
const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const WEEKDAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>';
const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3-4 1-1.5 7L10 13l-4-1 3-3-1-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7l-1.1 1.1M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.1-1.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>';
const ICON_CHEVRON = '<svg class="shift-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h2.6l1.5 4-1.9 1.4a11 11 0 0 0 6.4 6.4l1.4-1.9 4 1.5v2.6a2.5 2.5 0 0 1-2.7 2.5A16.5 16.5 0 0 1 4 6.2 2.5 2.5 0 0 1 6.5 3.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5L12 16.6 6.9 19.2l1-5.5-4-3.9 5.6-.8L12 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>';

/* ---------- Kısa yardımcılar ---------- */
const el = (id) => document.getElementById(id);
const pad = (value) => String(value).padStart(2, "0");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function uid() {
  const uuid = globalThis.crypto?.randomUUID;
  if (typeof uuid === "function") return uuid.call(globalThis.crypto);
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function str(value, fallback = "", max = 200) {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key, amount) {
  const date = parseKey(key);
  date.setDate(date.getDate() + amount);
  return keyOf(date);
}

function todayKey() {
  return keyOf(new Date());
}

// Gece 00:00-08:00 arası çalışanlar bir önceki günün 24-08 vardiyasıdır.
function activeDayKey() {
  const today = todayKey();
  return new Date().getHours() < 8 ? addDays(today, -1) : today;
}

function longDate(key) {
  const date = parseKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function shortDate(key) {
  const date = parseKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function weekdayOf(key) {
  return WEEKDAYS[parseKey(key).getDay()];
}

function formatStamp(timestamp) {
  const date = new Date(timestamp);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (keyOf(date) === todayKey()) return `Bugün ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${time}`;
}

function hueOf(text) {
  let hue = 0;
  for (const character of String(text)) hue = (hue * 31 + character.codePointAt(0)) % 360;
  return hue;
}

function initialsOf(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

function telOf(phone) {
  const clean = String(phone || "").replace(/[^\d+]/g, "");
  return clean.length >= 3 ? clean : "";
}

/* ---------- Durum ---------- */
const ADMIN_MODE =
  !PREVIEW &&
  (() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.has("admin") || location.hash === "#admin";
    } catch (error) {
      return false;
    }
  })();

function blankState() {
  return {
    v: 1,
    settings: { title: "Günün Panosu", dept: "Radyoloji" },
    days: {},
    notes: [],
    directory: [],
    notice: { text: "", tone: "info", updatedAt: 0 },
    updatedAt: 0,
  };
}

function normalizeNotice(raw) {
  const notice = { text: "", tone: "info", updatedAt: 0 };
  if (!raw || typeof raw !== "object") return notice;
  notice.text = str(raw.text, "", 200).trim();
  notice.tone = raw.tone === "warn" ? "warn" : "info";
  const updated = Number(raw.updatedAt);
  notice.updatedAt = Number.isFinite(updated) && updated > 0 ? updated : 0;
  return notice;
}

// Kategoriler fihrist dosyalarina gore: her kisi tek departmana duser.
const DIRECTORY_GROUPS = [
  "Hekimler",
  "Hasta Bakım",
  "İdari İşler",
  "Misafir Hizmetleri",
  "Uluslararası Misafir",
  "Başhekimlik",
  "Kök Hücre",
  "Teknik Hizmetler",
  "Üst Yönetim",
  "Tedarik Zinciri",
  "Kurumsal Faturalama",
  "İnsan Kaynakları",
  "Biyomedikal",
  "Bilgi Sistemleri",
  "Mali İşler",
  "Anlaşmalı Kurumlar",
  "Kurumsal Tanıtım",
  "Hasta Hakları",
];

// Kategori girilmemiş eski kayıtlar için: önce unvan, sonra birim.
const GROUP_RULES = [
  ["Başhekimlik", /BAŞHEKİM/i],
  ["Üst Yönetim", /ÜST YÖNETİM/i],
  ["Bilgi Sistemleri", /BİLGİ SİSTEM/i],
  ["Biyomedikal", /BİYOMEDİKAL/i],
  ["Hasta Hakları", /HASTA HAKLARI/i],
  ["İnsan Kaynakları", /İNSAN KAYNAK/i],
  ["Kök Hücre", /KÖK HÜCRE/i],
  ["Kurumsal Faturalama", /FATURA/i],
  ["Kurumsal Tanıtım", /TANITIM/i],
  ["Mali İşler", /MALİ/i],
  ["Tedarik Zinciri", /TEDARİK/i],
  ["Teknik Hizmetler", /TEKNİK/i],
  ["Uluslararası Misafir", /ULUSLARARASI/i],
  ["Anlaşmalı Kurumlar", /ANLAŞMALI/i],
  ["Misafir Hizmetleri", /MİSAFİR|VIP|TERCÜMAN|DANIŞMA|ÇAĞRI/i],
  ["İdari İşler", /İDARİ|GÜVENLİK|OTOPARK|TEMİZLİK|PORTER|YEMEKHANE|KAFETERYA|ÇAMAŞIR|BERBER|KUAFÖR/i],
];

function groupOf(item) {
  if (DIRECTORY_GROUPS.includes(item.group)) return item.group;
  if (/^(DR|DT)\.|^UZM\. DR\.|^DOÇ\.|^PROF\./i.test(item.name || "")) return "Hekimler";
  if (/HEKİM|DOKTOR/i.test(item.title || "")) return "Hekimler";
  const text = `${item.unit || ""} ${item.name || ""}`;
  for (const [group, pattern] of GROUP_RULES) if (pattern.test(text)) return group;
  return "Hasta Bakım";
}

// Rehberde ad başında ünvan gösterilmez; eski kayıt ve içe aktarımlar da sıyrılır.
const NAME_TITLES = /^(?:(?:DOÇ|DOC|PROF|UZMAN|UZM|DR|DT|OP|RADYOLOG|DOKTOR)\.?\s+)+/i;

function cleanName(value) {
  // Rehber tek biçimde görünsün: büyük harf, tek boşluk, nokta/parantez aralıkları düzgün.
  return String(value || "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\.\s*/g, ". ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function dialNumber(digits) {
  let d = digits;
  if (d.length === 12 && d.startsWith("90")) d = d.slice(2);
  if (d.length === 10) d = `0${d}`;
  if (d.length !== 11 || d[0] !== "0") return digits;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

function formatPhone(value) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  const word = (text.match(/^(dect|deck)\b/i) || [])[0];
  const body = word ? text.slice(word.length).trim() : text;
  const label = word ? `${word.toLocaleUpperCase("tr-TR")} ` : "";
  if (!/\d/.test(body)) return /dah[iİ]l/i.test(text) ? "Dahili yok" : text;
  const digits = body.replace(/\D/g, "");
  if (!/[-/]/.test(body) && digits.length >= 10) return label + dialNumber(digits);
  // Kısa dahiller: "8541-8542", "8475-76" (76 => 8476), "9999 - 9999".
  let previous = "";
  const parts = (body.match(/\d+/g) || []).map((part) => {
    const full = part.length < 4 && previous.length === 4 ? previous.slice(0, 4 - part.length) + part : part;
    previous = full;
    return full;
  });
  return label + parts.join("-");
}

function normalizeDirectory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const name = cleanName(item.name);
      const displayName = name.replace(NAME_TITLES, "").slice(0, 60);
      if (!displayName) return null;
      const unit = cleanName(item.unit).slice(0, 60);
      const title = cleanName(item.title).slice(0, 60);
      return {
        id: str(item.id, uid(), 60),
        name: displayName,
        phone: formatPhone(item.phone).slice(0, 30),
        phone2: item.phone2 ? formatPhone(item.phone2).slice(0, 30) : "",
        unit,
        title: title === unit ? "" : title,
        group: groupOf({ name, unit, group: item.group }),
        fav: Boolean(item.fav),
        hasMobile: Boolean(item.hasMobile),
      };
    })
    .filter(Boolean)
    .slice(0, 2000);
}

function normalizeMember(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name, "", 60).trim();
  if (!name) return null;
  return {
    id: str(raw.id, uid(), 60),
    name,
    shift: str(raw.shift, "", 12).trim(),
    phone: str(raw.phone, "", 30).trim(),
    note: str(raw.note, "", 80).trim(),
  };
}

function normalizeNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = str(raw.text, "", 1200).trim();
  if (!text) return null;
  const timestamp = Number(raw.ts);
  let tag = Object.hasOwn(NOTE_TAGS, raw.tag) ? raw.tag : "";
  if (!tag && raw.pinned) tag = "sabit";
  return {
    id: str(raw.id, uid(), 60),
    text,
    author: str(raw.author, "", 40).trim(),
    ts: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    tag,
    pinned: tag === "sabit",
    done: Boolean(raw.done),
  };
}

function normalizeDay(raw) {
  const day = { team: [], meal: { text: "", updatedAt: 0 } };
  if (!raw || typeof raw !== "object") return day;
  if (Array.isArray(raw.team)) {
    const seen = new Set();
    day.team = raw.team
      .map(normalizeMember)
      .filter((member) => {
        if (!member) return false;
        const key = `${nameKey(member.name)}|${shiftKey(member.shift)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 40);
  }
  if (raw.meal && typeof raw.meal === "object") {
    day.meal.text = str(raw.meal.text, "", 600);
    const updated = Number(raw.meal.updatedAt);
    day.meal.updatedAt = Number.isFinite(updated) && updated > 0 ? updated : 0;
  }
  return day;
}

function normalizeState(raw) {
  const state = blankState();
  if (!raw || typeof raw !== "object") return state;

  if (raw.settings && typeof raw.settings === "object") {
    state.settings.title = str(raw.settings.title, state.settings.title, 40).trim() || "Günün Panosu";
    state.settings.dept = str(raw.settings.dept, state.settings.dept, 40).trim();
  }

  state.directory = normalizeDirectory(raw.directory);

  if (raw.days && typeof raw.days === "object") {
    for (const [date, day] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      state.days[date] = normalizeDay(day);
    }
  }

  if (Array.isArray(raw.notes)) {
    state.notes = raw.notes.map(normalizeNote).filter(Boolean).slice(0, 300);
  }

  state.notice = normalizeNotice(raw.notice);

  const updated = Number(raw.updatedAt);
  state.updatedAt = Number.isFinite(updated) && updated > 0 ? updated : 0;
  return state;
}

/* Yalnızca yayınlanacak alanlar; tema ve yazar cihazda kalır. */
function contentPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: state.settings,
    days: state.days,
    notes: state.notes,
    directory: state.directory,
    notice: state.notice,
  };
}

let state = blankState();
let selected = activeDayKey();
try {
  const savedDate = sessionStorage.getItem("pano-date");
  if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)) selected = savedDate;
} catch (error) {
  /* depolama kapalıysa bugünle devam */
}
let noteFilter = "all";
let directoryQuery = "";
let directoryGroup = "Tümü";
let directoryEditQuery = "";
// Cep numaralari phones.enc icinde AES-GCM sifreli durur; sifre kodda saklanmaz,
// yalnizca decrypt anahtari olarak denenir. Yanlis sifre = cozme hatasi.
let mobileMap = {};
let phonesPass = (() => {
  try {
    return localStorage.getItem("pano-phones");
  } catch (error) {
    return null;
  }
})();
let phonesUnlocked = false;
let editingMemberId = null;
let publishedAt = 0;
let isDraft = false;
let offlineMode = false;
let lastLoadedAt = 0;
let authorName = "";

try {
  authorName = localStorage.getItem(AUTHOR_KEY) || "";
} catch (error) {
  authorName = "";
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed : null;
  } catch (error) {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {
    /* depolama kapalıysa önbellek yok */
  }
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function writeDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch (error) {
    toast("Taslak kaydedilemedi: tarayıcı depolaması dolu ya da kapalı.", true);
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    /* yoksay */
  }
}

async function discardDraft() {
  if (!ADMIN_MODE || !isDraft) return;
  const ok = await askConfirm({
    title: "Taslağı at",
    text: "Yayınlanmamış değişiklikler silinecek ve son yayınlanmış sürüm geri yüklenecek. Emin misiniz?",
    ok: "Taslağı at",
  });
  if (!ok) return;
  clearDraft();
  isDraft = false;
  const cached = readCache();
  state = normalizeState(cached ? cached.data : blankState());
  publishedAt = cached ? Date.parse(cached.data.updatedAt) || cached.savedAt || 0 : publishedAt;
  render();
  renderDirectoryEditor();
  updateChrome();
  toast("Taslak atıldı; son yayınlanmış sürüm geri yüklendi.");
}

async function fetchContent() {
  const url = new URL(CONTENT_URL, location.href);
  url.searchParams.set("v", String(Date.now()));
  const attempts = navigator.onLine === false ? 1 : 2;
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error(`content.json okunamadı (${response.status})`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error("content.json okunamadı");
}

async function loadContent({ quiet = false } = {}) {
  offlineMode = false;
  try {
    const data = await fetchContent();
    state = normalizeState(data);
    publishedAt = Date.parse(data.updatedAt) || 0;
    writeCache(data);
    isDraft = false;
    if (ADMIN_MODE) {
      const draft = readDraft();
      if (draft && Number(draft.updatedAt) > publishedAt) {
        state = normalizeState(draft);
        isDraft = true;
      }
    }
  } catch (error) {
    offlineMode = true;
    const draft = ADMIN_MODE ? readDraft() : null;
    const cached = readCache();
    if (draft) {
      state = normalizeState(draft);
      isDraft = true;
      publishedAt = cached ? Date.parse(cached.data.updatedAt) || cached.savedAt || 0 : publishedAt;
    } else if (cached) {
      state = normalizeState(cached.data);
      publishedAt = Date.parse(cached.data.updatedAt) || cached.savedAt || 0;
    } else {
      state = blankState();
    }
    if (!quiet) {
      toast(
        draft
          ? "Çevrimdışısınız; taslağınız yüklendi. Yayınlamak için internet gerekir."
          : cached
            ? "Bağlantı kurulamadı; son kaydedilmiş veriler gösteriliyor."
            : "İçerik yüklenemedi. Bağlantıyı kontrol edin.",
        true,
      );
    }
  }
  lastLoadedAt = Date.now();
  render();
  updateChrome();
}

let stateTimer = null;
function prune() {
  // İzleyici en fazla haftayı görüyor; 90 günden eski günler yayın dosyasını şişirmesin.
  const cutoff = addDays(todayKey(), -90);
  for (const [date, day] of Object.entries(state.days)) {
    const empty = !day.team.length && !day.meal.text.trim();
    if (empty || date < cutoff) delete state.days[date];
  }
}
function save() {
  if (!ADMIN_MODE) return;
  state.updatedAt = Date.now();
  prune();
  isDraft = true;
  writeDraft();
  updateChrome();
}

function saveSoon() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    save();
    renderSettings();
    renderNotice();
    renderUpdatedLine();
    renderDirectory();
  }, 450);
}

function getDay(key) {
  return state.days[key] || { team: [], meal: { text: "", updatedAt: 0 } };
}

function ensureDay(key) {
  if (!state.days[key]) state.days[key] = { team: [], meal: { text: "", updatedAt: 0 } };
  return state.days[key];
}

/* ---------- Küçük arayüz yardımcıları ---------- */
let toastTimer = null;
function toast(message, warn = false) {
  const box = el("toast");
  box.textContent = message;
  box.classList.toggle("is-warn", Boolean(warn));
  box.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("is-visible"), 2600);
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    try {
      if (!dialog.open) dialog.showModal();
      return;
    } catch (error) {
      /* aşağıdaki yedeğe düş */
    }
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    /* yedek yönteme geç */
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

/* ---------- Görünüm ---------- */
function renderNotice() {
  const notice = state.notice || { text: "", tone: "info" };
  const text = String(notice.text || "").trim();
  const box = el("notice");
  if (!box) return;
  box.hidden = !text;
  if (!text) return;
  box.className = `notice notice-${notice.tone === "warn" ? "warn" : "info"}`;
  el("notice-text").textContent = text;
}

function renderUpdatedLine() {
  const line = el("updated-line");
  if (!line) return;
  if (ADMIN_MODE) {
    line.hidden = true;
    return;
  }
  const updated = state.updatedAt || publishedAt;
  line.hidden = !updated;
  line.textContent = updated ? `Son güncelleme: ${formatStamp(updated)}` : "";
}

function currentShift() {
  const today = todayKey();
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 16) return selected === today ? SHIFTS[0] : "";
  if (hour >= 16) return selected === today ? SHIFTS[1] : "";
  return selected === addDays(today, -1) ? SHIFTS[2] : "";
}

function renderHero() {
  const view = currentView;
  const isEkip = view === "ekip";
  el("brand-dept").textContent = state.settings.dept || "Radyoloji";
  el("brand-title").textContent = state.settings.title || "Günün Panosu";
  document.title = `${state.settings.title || "Günün Panosu"} · ${state.settings.dept || "Radyoloji"}`;
  el("hero-brand").hidden = !isEkip;
  el("hero-eyebrow").hidden = isEkip;

  const title = el("date-title");
  const sub = el("date-sub");
  const team = getDay(selected).team.length;
  const openNotes = state.notes.filter((note) => !note.done).length;

  if (isEkip) {
    const relative = selected === todayKey() ? "Bugün" : selected === addDays(todayKey(), 1) ? "Yarın" : selected === addDays(todayKey(), -1) ? "Dün" : "";
    title.textContent = shortDate(selected);
    sub.textContent = [weekdayOf(selected), relative].filter(Boolean).join(" · ");
    el("team-hint").textContent = team ? `${team} kişi görevli` : "Vardiyaya göre kimler var?";
  } else if (view === "rehber") {
    el("hero-eyebrow").textContent = "Dahili numaralar";
    title.textContent = "Telefon rehberi";
    sub.textContent = "";
  } else if (view === "modalite") {
    el("hero-eyebrow").textContent = "Kişi başına dağılım";
    title.textContent = "Modalite özeti";
    sub.textContent = "";
  } else if (view === "notlar") {
    el("hero-eyebrow").textContent = `${shortDate(selected)} · ${weekdayOf(selected)}`;
    title.textContent = "Notlar";
    sub.textContent = "";
  } else {
    el("hero-eyebrow").textContent = "Yönetici";
    title.textContent = "Ayarlar";
    sub.textContent = "";
  }

  const teamCount = el("team-count");
  teamCount.hidden = !isEkip || !team;
  teamCount.textContent = team ? `${team} kişi vardiyada` : "";
  const notesCount = el("notes-count");
  notesCount.hidden = view !== "notlar" || !openNotes;
  notesCount.textContent = openNotes ? `${openNotes} açık` : "";
  el("hero-search").hidden = view !== "rehber";
  el("prev-day").hidden = !isEkip;
  el("next-day").hidden = !isEkip;
  el("date-input").hidden = !isEkip;
  el("date-input").value = selected;
  if (!isEkip) el("updated-line").hidden = true;
}

function personHtml(member) {
  const meta = [];
  if (member.phone) {
    const tel = telOf(member.phone);
    meta.push(tel ? `<a href="tel:${esc(tel)}">${esc(member.phone)}</a>` : esc(member.phone));
  }
  if (member.note) meta.push(`<span>${esc(member.note)}</span>`);
  return `<article class="person">
    <span class="avatar" style="--h:${hueOf(member.name)}" aria-hidden="true">${esc(initialsOf(member.name))}</span>
    <div class="person-body">
      <div class="person-name">${esc(member.name)}</div>
      ${meta.length ? `<div class="person-meta">${meta.join("")}</div>` : ""}
    </div>
    ${ADMIN_MODE ? `<div class="person-actions">
      <button class="mini-btn" type="button" data-edit-member="${esc(member.id)}" aria-label="${esc(member.name)} bilgilerini düzenle" title="Düzenle">${ICON_EDIT}</button>
    </div>` : ""}
  </article>`;
}

function sortTeam(team) {
  const order = (shift) => {
    const index = SHIFTS.indexOf(shift);
    return index === -1 ? SHIFTS.length : index;
  };
  return [...team].sort((a, b) => order(a.shift) - order(b.shift) || a.name.localeCompare(b.name, "tr"));
}

let openShifts = null;

function renderTeam() {
  const day = getDay(selected);
  const team = sortTeam(day.team);
  const now = currentShift();
  const box = el("team-list");

  if (!team.length) {
    box.innerHTML = `<div class="empty"><strong>Bu gün için ekip girilmemiş</strong>${
      ADMIN_MODE
        ? "Vardiyadaki isimleri ekleyin, listeden içe aktarın ya da dünkü ekibi kopyalayın."
        : "Yönetici bu gün için kadro yayınladığında burada görünür."
    }</div>`;
  } else {
    const groups = [];
    for (const member of team) {
      const shift = member.shift || "Diğer";
      let group = groups.find((item) => item.shift === shift);
      if (!group) groups.push((group = { shift, members: [] }));
      group.members.push(member);
    }
    box.innerHTML = groups
      .map(({ shift, members }) => {
        const isNow = Boolean(now) && shift === now;
        const open = openShifts ? openShifts.has(shift) : isNow || !now;
        return `<details class="shift" data-shift="${esc(shift)}"${open ? " open" : ""}>
          <summary class="shift-head">
            <span class="shift-time">${esc(shift)}</span>
            ${SHIFT_LABELS[shift] ? `<span class="shift-name">${esc(SHIFT_LABELS[shift])}</span>` : ""}
            ${isNow ? '<span class="chip-now">Şu an</span>' : ""}
            <span class="shift-count">${members.length} kişi</span>
            ${ICON_CHEVRON}
          </summary>
          <div class="shift-people">${members.map(personHtml).join("")}</div>
        </details>`;
      })
      .join("");
  }

  el("sync-shift").hidden = !ADMIN_MODE;
  el("forward-team").hidden = !ADMIN_MODE || !team.length;
  el("copy-team").hidden = !ADMIN_MODE || team.length > 0;
}

function renderMeal() {
  const day = getDay(selected);
  const text = day.meal.text.trim();
  el("meal-pill").hidden = !text;
  el("meal-pill").textContent = text ? "Girildi" : "";
  el("copy-meal").hidden = !ADMIN_MODE || Boolean(text);
  el("meal-body").innerHTML = text
    ? `<p class="meal-text">${esc(text)}</p>${day.meal.updatedAt ? `<p class="meal-updated">Son güncelleme: ${esc(formatStamp(day.meal.updatedAt))}</p>` : ""}`
    : `<div class="empty"><strong>Menü girilmemiş</strong>${
        ADMIN_MODE
          ? "Yemekhanenin menüsünü yazın, listeden içe aktarın ya da dünkü menüyü kopyalayın."
          : "Yönetici menüyü yayınladığında burada görünür."
      }</div>`;
}

function visibleNotes() {
  const filtered = state.notes.filter((note) => {
    if (noteFilter === "today") return keyOf(new Date(note.ts)) === todayKey();
    if (noteFilter === "pinned") return note.pinned;
    if (noteFilter === "open") return !note.done;
    return true;
  });
  return filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts);
}

function noteHtml(note) {
  const classes = ["note"];
  if (note.pinned) classes.push("is-pinned");
  if (note.done) classes.push("is-done");
  if (note.tag) classes.push(`tag-${note.tag}`);
  const tag = note.tag && NOTE_TAGS[note.tag] ? `<span class="note-tag">${esc(NOTE_TAGS[note.tag])}</span>` : "";
  return `<article class="${classes.join(" ")}">
    <div class="note-header">
      ${tag}
      <span class="note-author">${esc(note.author || "Ekip")}</span>
      <span class="note-time">${esc(formatStamp(note.ts))}</span>
    </div>
    <div class="note-text">${esc(note.text)}</div>
    <div class="note-footer">
      <span class="note-status${note.done ? " is-done" : ""}">${note.done ? "Tamamlandı" : "Açık"}</span>
      ${ADMIN_MODE ? `<div class="note-actions">
        <button class="mini-btn${note.pinned ? " is-on" : ""}" type="button" data-note-pin="${esc(note.id)}" aria-label="${note.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}" title="${note.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}" aria-pressed="${note.pinned}">${ICON_PIN}</button>
        <button class="mini-btn${note.done ? " is-on" : ""}" type="button" data-note-done="${esc(note.id)}" aria-label="${note.done ? "Açık olarak işaretle" : "Tamamlandı olarak işaretle"}" title="${note.done ? "Açık" : "Tamamlandı"}" aria-pressed="${note.done}">${ICON_CHECK}</button>
        <button class="mini-btn" type="button" data-note-delete="${esc(note.id)}" aria-label="Notu sil" title="Sil">${ICON_TRASH}</button>
      </div>` : ""}
    </div>
  </article>`;
}

function renderNotes() {
  const notes = visibleNotes();
  document.querySelectorAll("#note-filters .filter").forEach((button) => {
    const active = button.dataset.filter === noteFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (!notes.length) {
    const messages = {
      all: "Henüz not yok. İlk notu yukarıdaki alandan ekleyin.",
      today: "Bugün için not yok.",
      pinned: "Sabit not yok.",
      open: "Açık not yok; her şey tamam.",
    };
    el("note-list").innerHTML = `<div class="empty"><strong>Liste boş</strong>${messages[noteFilter]}</div>`;
  } else {
    el("note-list").innerHTML = notes.map(noteHtml).join("");
  }
  const open = state.notes.filter((note) => !note.done).length;
  const badge = el("badge-notlar");
  badge.hidden = !open;
  badge.textContent = open > 9 ? "9+" : String(open);
}

// Birim alanı yer tutucuysa (boş, "DOKTOR", "RADYOLOG"...) kayıt eksik sayılır.
const UNIT_PLACEHOLDERS = /^(DOKTOR|RADYOLOG|GYB DOKTOR|DR|DT)$/i;

function unitMissing(item) {
  const unit = String(item.unit || "").trim();
  return !unit || UNIT_PLACEHOLDERS.test(unit);
}

// Unvan birimi tekrar ediyorsa ("RADYOLOJİ HEKİMİ · RADYOLOJİ") birim gizlenir.
const SUBTITLE_STOP = new Set([
  "VE", "ILE", "HEKIMI", "HEKIMLIGI", "HEKIMLIK", "CERRAHISI", "UZMANI", "UZMANLIGI",
  "DOKTOR", "DR", "PROF", "DOC", "UZM", "ASISTANI", "SORUMLUSU", "YETKILISI",
]);
function subtitleWords(text) {
  const plain = lowerTr(String(text).replace(/\([^)]*\)/g, " "))
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return new Set(plain.split(/[^A-Z0-9]+/).filter((word) => word && !SUBTITLE_STOP.has(word)));
}
function subtitleOf(item) {
  const title = String(item.title || "").trim();
  const unit = String(item.unit || "").trim();
  if (!unit || unit === "HEKİMLİK") return title;
  if (!title) return unit;
  const titleWords = subtitleWords(title);
  const unitWords = subtitleWords(unit);
  const subset = (a, b) => a.size > 0 && [...a].every((word) => b.has(word));
  if (unitWords.size === 0 || subset(unitWords, titleWords) || subset(titleWords, unitWords)) return title;
  // Birimin kelimelerinin yarisindan fazlasi unvanda geciyorsa birim tekrar sayilir.
  const shared = [...unitWords].filter((word) => titleWords.has(word)).length;
  if (shared * 2 > unitWords.size) return title;
  return `${title} · ${unit}`;
}

function directoryMatches(item, query) {
  if (!query) return true;
  // Turkce kucultmede I -> ı olur; arama icin ikisini de i say. Aksanlar da katlanir: "sukran" -> "ŞÜKRAN".
  const fold = (text) =>
    lowerTr(text)
      .replace(/ı/g, "i")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  const search = fold(query).trim();
  if (!search) return true;
  if (search === "#eksik" || search === "#birimsiz") return unitMissing(item);
  const digits = search.replace(/[^\d+]/g, "");
  if (digits && String(item.phone || "").replace(/[^\d+]/g, "").includes(digits)) return true;
  if (digits && mobilesOf(item).some((mobile) => mobile.replace(/[^\d+]/g, "").includes(digits))) return true;
  const text = fold(`${item.name} ${item.title || ""} ${item.unit || ""} ${groupOf(item)}`);
  const words = search.split(/\s+/).filter(Boolean);
  // Tüm kelimeler geçiyorsa eşleşir: "ali kaya" hem "ALI KAYA"yı hem sıralı eşleşmeleri bulur.
  return words.every((word) => text.includes(word));
}

const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function decryptPhones(pass) {
  const res = await fetch("phones.enc", { cache: "no-store" });
  if (!res.ok) throw new Error("phones.enc yok");
  const blob = await res.json();
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(blob.salt), iterations: blob.iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(blob.iv) }, aesKey, b64ToBytes(blob.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

function callBtn(raw, name, second) {
  const tel = telOf(raw);
  if (!tel) return "";
  const cls = second ? "call-btn is-second" : "call-btn";
  return `<a class="${cls}" href="tel:${esc(tel)}" aria-label="${esc(name)}${second ? " ikinci numara" : ""} ara">${ICON_PHONE}<span>${esc(raw)}</span></a>`;
}

function lockedBtn(name, second) {
  const cls = second ? "call-btn is-second is-locked" : "call-btn is-locked";
  return `<span class="${cls}" aria-label="${esc(name)} cep numarası kilitli">${ICON_PHONE}<span>••• ••• •• ••</span></span>`;
}

function mobilesOf(item) {
  const mobile = mobileMap[item.id];
  return Array.isArray(mobile) ? mobile : mobile ? [mobile] : [];
}

function callHtml(item) {
  const mobiles = mobilesOf(item);
  const parts = [];
  if (item.phone) parts.push(callBtn(item.phone, item.name, false));
  if (item.phone2) parts.push(callBtn(item.phone2, item.name, true));
  for (const mobile of mobiles) parts.push(callBtn(mobile, item.name, true));
  if (!mobiles.length && item.hasMobile) parts.push(lockedBtn(item.name, true));
  if (!parts.length) return `<span class="call-btn is-empty" aria-hidden="true">${ICON_PHONE}</span>`;
  return `<div class="directory-calls">${parts.join("")}</div>`;
}

function renderDirectory() {
  const box = el("directory-list");
  if (!box) return;
  const entries = state.directory || [];

  const lockBar = el("phone-lock");
  if (lockBar) lockBar.hidden = phonesUnlocked;

  const favorites = entries.filter((item) => item.fav).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  el("favorites-head").hidden = !favorites.length;
  el("favorites").innerHTML = favorites
    .map((item) => {
      const mobiles = mobilesOf(item);
      const nums = [item.phone, item.phone2, ...mobiles].filter(Boolean);
      if (!mobiles.length && item.hasMobile) nums.push("••• ••• •• ••");
      const tel = telOf(item.phone || item.phone2 || mobiles[0]);
      const label = nums.join(" · ");
      const body = `<span class="fav-name">${esc(item.name)}</span><span class="fav-phone">${esc(label || item.unit || "-")}</span>`;
      return tel ? `<a class="fav-tile" href="tel:${esc(tel)}">${body}</a>` : `<div class="fav-tile">${body}</div>`;
    })
    .join("");

  const chips = el("directory-chips");
  if (chips) {
    chips.innerHTML = ["Tümü", ...DIRECTORY_GROUPS]
      .map((label) => {
        const total = label === "Tümü" ? entries.length : entries.filter((item) => groupOf(item) === label).length;
        return `<button class="import-chip${directoryGroup === label ? " is-on" : ""}" type="button" data-group="${esc(label)}" aria-pressed="${directoryGroup === label}">${esc(label)} <b>${total}</b></button>`;
      })
      .join("");
  }

  const items = entries
    .filter((item) => (directoryGroup === "Tümü" || groupOf(item) === directoryGroup) && directoryMatches(item, directoryQuery))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const count = el("directory-count");
  if (count) {
    count.hidden = !items.length;
    count.textContent = items.length ? `${items.length} kişi` : "";
  }

  if (!items.length) {
    const text = entries.length
      ? "Eşleşen kişi yok."
      : ADMIN_MODE
        ? "Rehber henüz boş. Ayarlar sekmesindeki düzenleyiciden satır ekleyin."
        : "Rehber henüz yayınlanmadı.";
    box.innerHTML = `<div class="empty"><strong>${entries.length ? "Sonuç yok" : "Rehber boş"}</strong>${text}</div>`;
    return;
  }

  const rowHtml = (item) => {
    const subtitle = subtitleOf(item);
    return `<div class="directory-row">
        <div class="directory-main">
          <span class="directory-name">${esc(item.name)}</span>
          ${subtitle ? `<span class="directory-unit" title="${esc(subtitle)}">${esc(subtitle)}</span>` : ""}
        </div>
        ${callHtml(item)}
      </div>`;
  };
  // Arama veya tek kategori seçiliyse bölümler açık gelir; "Tümü"de kapalı liste daha kısa.
  const open = Boolean(directoryQuery.trim()) || directoryGroup !== "Tümü";
  box.innerHTML = DIRECTORY_GROUPS.map((group) => ({
    group,
    list: items.filter((item) => groupOf(item) === group),
  }))
    .filter((section) => section.list.length)
    .map(
      (section) => `<details class="shift directory-group" data-group="${esc(section.group)}"${open ? " open" : ""}>
        <summary class="shift-head">
          <span class="shift-time">${esc(section.group)}</span>
          <span class="shift-count">${section.list.length} kişi</span>
          ${ICON_CHEVRON}
        </summary>
        <div class="directory-rows">${section.list.map(rowHtml).join("")}</div>
      </details>`,
    )
    .join("");
}

function renderDirectoryEditor() {
  const box = el("directory-editor");
  if (!box) return;
  if (!state.directory.length) {
    box.innerHTML = '<p class="import-empty">Henüz kayıt yok. "Satır ekle" ile başlayın.</p>';
    return;
  }
  const filtered = state.directory.filter((item) => directoryMatches(item, directoryEditQuery));
  const shown = filtered.slice(0, 50);
  const missing = state.directory.filter(unitMissing).length;
  const hint = filtered.length
    ? `<p class="import-empty">${filtered.length} kayıt${filtered.length > shown.length ? ` · ilk ${shown.length} gösteriliyor, arayarak daraltın` : ""}${missing ? ` · ${missing} birimsiz (#eksik)` : ""}</p>`
    : '<p class="import-empty">Eşleşen kayıt yok.</p>';
  box.innerHTML = hint + shown
    .map(
      (item) => `<div class="directory-edit-row" data-id="${esc(item.id)}">
        <button class="mini-btn${item.fav ? " is-on" : ""}" type="button" data-fav-directory="${esc(item.id)}" aria-label="Sık kullanılanlara ${item.fav ? "çıkarma" : "ekleme"}" title="Sık kullanılan" aria-pressed="${Boolean(item.fav)}">${ICON_STAR}</button>
        <input data-directory="name" type="text" maxlength="60" value="${esc(item.name)}" placeholder="Ad soyad" aria-label="Ad soyad" />
        <input data-directory="phone" type="text" maxlength="30" value="${esc(item.phone)}" placeholder="Dahili / telefon" aria-label="Telefon" inputmode="tel" />
        ${item.phone2 ? `<input data-directory="phone2" type="text" maxlength="30" value="${esc(item.phone2)}" placeholder="İkinci numara" aria-label="İkinci numara" inputmode="tel" />` : ""}
        <input data-directory="unit" type="text" maxlength="60" value="${esc(item.unit)}" placeholder="Birim (isteğe bağlı)" aria-label="Birim" />
        <input data-directory="title" type="text" maxlength="60" value="${esc(item.title || "")}" placeholder="Görev (isteğe bağlı)" aria-label="Görev" />
        <select data-directory="group" aria-label="Kategori">${DIRECTORY_GROUPS.map((group) => `<option${groupOf(item) === group ? " selected" : ""}>${esc(group)}</option>`).join("")}</select>
        <button class="mini-btn" type="button" data-delete-directory="${esc(item.id)}" aria-label="Satırı sil" title="Sil">${ICON_TRASH}</button>
      </div>`,
    )
    .join("");
}

function applyMode() {
  document.documentElement.dataset.admin = ADMIN_MODE ? "1" : "0";
  document.querySelectorAll(".admin-only").forEach((node) => {
    if (node.id === "admin-bar") return;
    node.hidden = !ADMIN_MODE;
  });
  document.querySelectorAll(".viewer-only").forEach((node) => {
    node.hidden = ADMIN_MODE;
  });
  const bar = el("admin-bar");
  if (bar) bar.hidden = !ADMIN_MODE;
}

function updateChrome() {
  const bar = el("admin-bar");
  if (bar) bar.hidden = !ADMIN_MODE;
  if (ADMIN_MODE) {
    const status = el("admin-status");
    status.classList.toggle("is-draft", isDraft || !publishedAt || offlineMode);
    status.textContent = offlineMode
      ? isDraft
        ? "Çevrimdışı · taslak yüklendi"
        : "Çevrimdışı"
      : isDraft
        ? "Yayınlanmamış değişiklikler var"
        : publishedAt
          ? `Yayınlandı · ${formatStamp(publishedAt)}`
          : "Henüz yayınlanmadı";
    const publishButton = el("admin-publish");
    if (publishButton) publishButton.disabled = offlineMode;
    const retryButton = el("admin-retry");
    if (retryButton) retryButton.hidden = !offlineMode;
    const discardButton = el("admin-discard");
    if (discardButton) discardButton.hidden = !isDraft;
  }
  const offline = el("offline-note");
  if (offline) {
    offline.hidden = ADMIN_MODE || !offlineMode;
    const label = el("offline-text");
    if (label) {
      label.textContent =
        navigator.onLine === false
          ? "İnternet yok; son kaydedilmiş veriler gösteriliyor."
          : "İçerik alınamadı; son kaydedilmiş veriler gösteriliyor (sayfa yenilemesi yeterli olabilir).";
    }
  }
}

function renderSettings() {
  if (ADMIN_MODE) {
    const titleInput = el("set-title");
    const deptInput = el("set-dept");
    if (document.activeElement !== titleInput) titleInput.value = state.settings.title;
    if (document.activeElement !== deptInput) deptInput.value = state.settings.dept;
    const noticeInput = el("notice-input");
    if (noticeInput && document.activeElement !== noticeInput) noticeInput.value = state.notice.text;
    if (el("notice-tone")) el("notice-tone").value = state.notice.tone === "warn" ? "warn" : "info";
  } else {
    el("view-title").textContent = state.settings.title;
    el("view-dept").textContent = state.settings.dept;
  }
  el("set-theme").value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  renderStats();
  const updated = state.updatedAt || publishedAt;
  el("version-note").textContent = updated
    ? `${offlineMode ? "Önbellek" : "Son güncelleme"}: ${formatStamp(updated)} · Sürüm 2.1`
    : "Sürüm 2.1 · Henüz içerik yayınlanmadı";
}

const MODALITIES = ["MR", "BT", "RÖNT-PORT", "RÖNTGEN", "RÖNT-MAMO"];

// Nöbet listesindeki modalite özetinin panoya uyarlanmış hâli: gün kayıtlarından sayılır.
function renderModality() {
  const box = el("modality-summary");
  if (!box) return;
  const month = todayKey().slice(0, 7);
  const keys = Object.keys(state.days).filter((key) => key.startsWith(month)).sort();
  const people = new Map();
  for (const key of keys) {
    for (const member of state.days[key].team) {
      const shift = String(member.shift || "").replace("–", "-");
      const personKey = nameKey(member.name);
      const row = people.get(personKey) || { name: member.name, nameCounts: {}, devices: {}, morning: 0, evening: 0, night: 0 };
      row.nameCounts[member.name] = (row.nameCounts[member.name] || 0) + 1;
      if (shift.startsWith("08")) {
        row.morning++;
        if (MODALITIES.includes(member.note)) row.devices[member.note] = (row.devices[member.note] || 0) + 1;
      } else if (shift.startsWith("16")) row.evening++;
      else if (shift.startsWith("24")) row.night++;
      people.set(personKey, row);
    }
  }
  el("modality-hint").textContent = keys.length
    ? `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)} · ${keys.length} gün`
    : "Bu ay kayıt yok";
  if (!people.size) {
    box.innerHTML = '<p class="import-empty">Bu ay için gün kaydı yok.</p>';
    return;
  }
  for (const row of people.values()) {
    row.name = Object.entries(row.nameCounts).sort((a, b) => b[1] - a[1])[0][0];
  }
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const head = ["Personel", ...MODALITIES, "Sabah", "Akşam", "Gece", "Toplam"]
    .map((label) => `<th scope="col">${esc(label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const counts = MODALITIES.map((name) => `<td>${row.devices[name] || 0}</td>`).join("");
      const total = row.morning + row.evening + row.night;
      return `<tr><td>${esc(row.name)}</td>${counts}<td>${row.morning}</td><td>${row.evening}</td><td>${row.night}</td><td><b>${total}</b></td></tr>`;
    })
    .join("");
  box.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderStats() {
  const days = Object.keys(state.days).length;
  const teams = Object.values(state.days).reduce((total, day) => total + day.team.length, 0);
  el("stats").textContent = `${days} gün kaydı · ${teams} ekip kaydı · ${state.notes.length} not`;
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.view === currentView;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
}

let currentView = "ekip";
try {
  const savedView = sessionStorage.getItem(VIEW_KEY);
  if (VIEWS.includes(savedView)) currentView = savedView;
} catch (error) {
  currentView = "ekip";
}

function switchView(view) {
  if (!VIEWS.includes(view)) return;
  if (view === "ayarlar" && !ADMIN_MODE) return;
  currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.view === view);
  });
  renderTabs();
  renderHero();
  try {
    sessionStorage.setItem(VIEW_KEY, view);
  } catch (error) {
    /* yoksay */
  }
  el("main").scrollTop = 0;
}

function setDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
  selected = key;
  openShifts = null;
  try {
    sessionStorage.setItem("pano-date", key);
  } catch (error) {
    /* yoksay */
  }
  render();
}

function changeDay(amount) {
  setDate(addDays(selected, amount));
}

function render() {
  renderUpdatedLine();
  renderHero();
  renderNotice();
  renderTeam();
  renderModality();
  renderMeal();
  renderNotes();
  renderDirectory();
  if (ADMIN_MODE) renderDirectoryEditor();
  renderSettings();
}

/* ---------- Nöbet listesinden aktarma ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function titleTr(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((word) => (word ? word[0].toLocaleUpperCase("tr-TR") + word.slice(1) : ""))
    .join(" ")
    .trim();
}

async function readSheetShiftTeam(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = `https://docs.google.com/spreadsheets/d/${SHIFT_SHEET_ID}`;
  const html = await (await fetch(`${base}/htmlview`)).text();
  const sheet = [...html.matchAll(/items\.push\(\{name: "([^"]+)", pageUrl: "[^"]*gid=(\d+)/g)]
    .find((match) => nameKey(match[1]) === nameKey(`${year} ${MONTHS[month - 1]}`));
  if (!sheet) return null;
  const csv = await (await fetch(`${base}/gviz/tq?tqx=out:csv&gid=${sheet[2]}`)).text();
  const rows = parseCsv(csv);
  const stamp = `${pad(day)}.${pad(month)}.${year}`;
  const head = rows.findIndex((row) => row.some((cell) => cell.includes(stamp)));
  if (head < 0) return null;
  const column = rows[head].findIndex((cell) => cell.includes(stamp));
  const list = [];
  let shift = "";
  for (const row of rows.slice(head + 1, head + 16)) {
    if ((row[0] || "").trim() === "Vardiya") break;
    const label = (row[0] || "").trim();
    if (label) shift = label;
    const device = (row[1] || "").trim();
    const name = (row[column] || "").trim();
    if (!name) continue;
    if (SHIFT_DEVICES.includes(device)) list.push({ name: titleTr(name), shift: "08–16", note: device });
    else if (shift.startsWith("16")) list.push({ name: titleTr(name), shift: "16–24", note: "Akşam" });
    else if (shift.startsWith("24")) list.push({ name: titleTr(name), shift: "24–08", note: "Gece" });
  }
  return list.length ? list : null;
}

async function readShiftTeam(dateKey) {
  try {
    const list = await readSheetShiftTeam(dateKey);
    if (list) return list;
  } catch (error) {
    // Ağ yoksa aşağıdaki tarayıcı kopyasına düşer.
  }
  return readLocalShiftTeam(dateKey);
}

function readLocalShiftTeam(dateKey) {
  let raw = null;
  try {
    raw = localStorage.getItem(SHIFT_KEY);
  } catch (error) {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const plan = data?.plan;
    if (!plan || !Array.isArray(plan.days)) return null;
    const [year, month] = dateKey.split("-").map(Number);
    if (plan.year !== year || plan.month !== month) return null;
    const day = plan.days.find((entry) => entry && entry.date === dateKey);
    if (!day) return null;
    const staff = Array.isArray(data.staff) ? data.staff : [];
    const nameOf = (id) => {
      if (!id) return "";
      const person = staff.find((item) => item && item.id === id);
      return person && typeof person.name === "string" ? person.name : "";
    };
    const list = [];
    const morning = Array.isArray(day.morning) ? day.morning : [];
    morning.forEach((id, index) => {
      const name = nameOf(id);
      if (name) list.push({ name, shift: "08–16", note: SHIFT_DEVICES[index] || "" });
    });
    (Array.isArray(day.evening) ? day.evening : []).forEach((id) => {
      const name = nameOf(id);
      if (name) list.push({ name, shift: "16–24", note: "Akşam" });
    });
    (Array.isArray(day.night) ? day.night : []).forEach((id) => {
      const name = nameOf(id);
      if (name) list.push({ name, shift: "24–08", note: "Gece" });
    });
    return list.length ? list : null;
  } catch (error) {
    return null;
  }
}

async function importShiftTeam() {
  if (!ADMIN_MODE) return;
  const list = await readShiftTeam(selected);
  if (!list || !list.length) {
    toast("Bu tarih için nöbet listesi bulunamadı.", true);
    return;
  }
  const day = ensureDay(selected);
  const same =
    day.team.length === list.length &&
    list.every((person) => day.team.some((member) => sameMember(member, person) && member.note === person.note));
  if (same) {
    toast("Ekip nöbet listesiyle zaten aynı.");
    return;
  }
  if (day.team.length) {
    const ok = await askConfirm({
      title: "Ekip değiştirilsin mi?",
      text: `${longDate(selected)} için mevcut ${day.team.length} kişi silinip nöbet listesindeki ${list.length} kişi yazılacak. Elle eklenen kişiler de silinir.`,
      html: `<strong>Yeni ekip</strong><br>${list
        .map((person) => `${esc(SHIFT_LABELS[person.shift] || person.shift)} · ${esc(person.name)}${person.note && person.shift === "08–16" ? ` · ${esc(person.note)}` : ""}`)
        .join("<br>")}`,
      ok: "Değiştir",
    });
    if (!ok) return;
  }
  const phones = new Map(day.team.map((member) => [nameKey(member.name), member.phone]));
  day.team = list.map((person) => ({
    id: uid(),
    name: person.name,
    shift: person.shift,
    phone: phones.get(nameKey(person.name)) || "",
    note: person.note,
  }));
  save();
  render();
  toast(`${longDate(selected)} nöbet listesi alındı · ${list.length} kişi.`);
}

/* ---------- Paylaşım ---------- */
function buildShareText() {
  const day = getDay(selected);
  const lines = [`${state.settings.dept || "Radyoloji"} · ${longDate(selected)} ${weekdayOf(selected)}`];
  const notice = String((state.notice && state.notice.text) || "").trim();
  if (notice) lines.push("", `DUYURU: ${notice}`);
  lines.push("", "GÜNÜN EKİBİ");
  const team = sortTeam(day.team);
  if (team.length) {
    for (const member of team) {
      const extras = [member.phone ? `tel: ${member.phone}` : "", member.note].filter(Boolean).join(" · ");
      lines.push(`• ${member.shift || "—"} · ${member.name}${extras ? ` (${extras})` : ""}`);
    }
  } else {
    lines.push("• Henüz girilmedi");
  }
  const nightTeam = team.filter((member) => member.shift === SHIFTS[2]);
  if (nightTeam.length) {
    const starts = addDays(selected, 1);
    const when = starts === todayKey() ? "bugün" : starts === addDays(todayKey(), 1) ? "yarın" : longDate(starts);
    lines.push("", `GECE NÖBETİ · ${when} 00:00-08:00`);
    for (const member of nightTeam) lines.push(`  ${member.name}${member.note ? ` (${member.note})` : ""}`);
  }
  const meal = day.meal.text.trim();
  lines.push("", "GÜNÜN YEMEĞİ");
  lines.push(meal ? meal.split("\n").map((row) => `• ${row.trim()}`).join("\n") : "• Henüz girilmedi");
  const notes = [...state.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts).slice(0, 4);
  if (notes.length) {
    lines.push("", "NOTLAR");
    for (const note of notes) lines.push(`• ${note.text}${note.author ? ` — ${note.author}` : ""}`);
  }
  return lines.join("\n");
}

function b64encode(text) {
  try {
    if (typeof TextEncoder === "function") {
      const bytes = new TextEncoder().encode(text);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (error) {
    return "";
  }
}

function b64decode(text) {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    if (typeof TextDecoder === "function") {
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(binary));
  } catch (error) {
    return "";
  }
}

function buildShareLink() {
  if (!ADMIN_MODE) return "";
  if (!/^https?:$/.test(location.protocol)) return "";
  const day = getDay(selected);
  const payload = {
    v: 1,
    date: selected,
    team: day.team.map((member) => ({ name: member.name, shift: member.shift, phone: member.phone, note: member.note })),
    meal: day.meal.text,
    notes: state.notes
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3)
      .map((note) => ({ text: note.text, author: note.author, ts: note.ts })),
  };
  const encoded = b64encode(JSON.stringify(payload));
  if (!encoded || encoded.length > 5000) return "";
  return `${location.origin}${location.pathname}#pano=${encoded}`;
}

async function shareBoard() {
  const text = buildShareText();
  const link = buildShareLink();
  const message = link ? `${text}\n\nBağlantı: ${link}` : text;

  if (navigator.share) {
    try {
      await navigator.share({ title: `${state.settings.title} · ${longDate(selected)}`, text: message });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  const copied = await copyText(message);
  if (copied) {
    toast(link ? "Özet ve bağlantı panoya kopyalandı." : "Özet panoya kopyalandı.");
    return;
  }
  el("share-text").value = message;
  openDialog(el("share-dialog"));
}

function readSharedHash() {
  const hash = String(location.hash || "");
  if (!hash.startsWith("#pano=")) return null;
  const decoded = b64decode(hash.slice(6));
  if (!decoded) return null;
  try {
    const data = JSON.parse(decoded);
    if (!data || data.v !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ""))) return null;
    return data;
  } catch (error) {
    return null;
  }
}

async function applySharedHash() {
  const shared = readSharedHash();
  if (!shared) return;
  if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  if (!ADMIN_MODE) {
    toast("Paylaşılan bağlantı yalnızca yönetici modunda uygulanır.", true);
    return;
  }
  const team = Array.isArray(shared.team) ? shared.team.length : 0;
  const ok = await askConfirm({
    title: "Paylaşılan pano",
    text: `${longDate(shared.date)} ${weekdayOf(shared.date)} için ${team} kişilik ekip${shared.meal ? " ve yemek menüsü" : ""} geldi. Bu cihazdaki kayıtlara eklensin mi?`,
    ok: "Ekle",
  });
  if (!ok) return;

  const day = ensureDay(shared.date);
  for (const raw of Array.isArray(shared.team) ? shared.team : []) {
    const member = normalizeMember(raw);
    if (!member) continue;
    if (day.team.some((item) => sameMember(item, member))) continue;
    day.team.push({ ...member, id: uid() });
  }
  const meal = str(shared.meal, "", 600).trim();
  if (meal && !day.meal.text.trim()) day.meal = { text: meal, updatedAt: Date.now() };
  for (const raw of Array.isArray(shared.notes) ? shared.notes : []) {
    const note = normalizeNote(raw);
    if (!note) continue;
    if (state.notes.some((item) => item.text === note.text && Math.abs(item.ts - note.ts) < 1000)) continue;
    state.notes.push({ ...note, id: uid() });
  }
  save();
  setDate(shared.date);
  toast("Paylaşılan pano eklendi.");
}

/* ---------- GitHub yayını ---------- */
const DEFAULT_PUBLISH = {
  repo: document.querySelector('meta[name="pano-repo"]')?.content || "",
  branch: "main",
  path: "content.json",
  token: "",
};

function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

function readPublishConfig() {
  try {
    const raw = localStorage.getItem(PUBLISH_KEY);
    return raw ? { ...DEFAULT_PUBLISH, ...JSON.parse(raw) } : { ...DEFAULT_PUBLISH };
  } catch (error) {
    return { ...DEFAULT_PUBLISH };
  }
}

function writePublishConfig(config) {
  try {
    localStorage.setItem(PUBLISH_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    toast("Yayın ayarları kaydedilemedi.", true);
    return false;
  }
}

function publishFields() {
  return {
    repo: el("pub-repo").value.trim(),
    branch: el("pub-branch").value.trim() || "main",
    path: el("pub-path").value.trim() || "content.json",
    token: el("pub-token").value.trim(),
  };
}

function setPublishStatus(message, warn = false) {
  const box = el("pub-status");
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("is-warn", Boolean(warn));
}

function updateGithubEditLink(config) {
  const link = el("pub-github-edit");
  if (!link) return;
  const parts = repoParts(config.repo);
  if (!parts) {
    link.hidden = true;
    return;
  }
  link.hidden = false;
  link.href = `https://github.com/${parts.owner}/${parts.name}/edit/${encodeURIComponent(config.branch)}/${config.path}`;
}

function fillPublishFields() {
  const config = readPublishConfig();
  el("pub-repo").value = config.repo;
  el("pub-branch").value = config.branch;
  el("pub-path").value = config.path;
  el("pub-token").value = config.token;
  updateGithubEditLink(config);
  setPublishStatus(config.token ? "Ayarlar kayıtlı." : "Depo hazır; yayınlamak için GitHub anahtarı girin.");
}

function repoParts(repo) {
  const [owner, name] = String(repo || "").split("/").map((part) => part.trim());
  return owner && name ? { owner, name } : null;
}

async function currentFile(api, config) {
  const response = await fetch(`${api}?ref=${encodeURIComponent(config.branch)}`, {
    headers: ghHeaders(config.token),
    cache: "no-store",
  });
  if (response.status === 404) return { sha: "", updatedAt: 0 };
  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Anahtar geçersiz ya da yetkisi yok."
        : `Dosya okunamadı (${response.status}).`,
    );
  }
  const data = await response.json();
  let updatedAt = 0;
  try {
    const raw = atob(String(data.content || "").replace(/\s+/g, ""));
    const live = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (ch) => ch.charCodeAt(0))));
    updatedAt = Date.parse(live.updatedAt) || 0;
  } catch (error) {
    /* içerik çözülemezse çakışma denetimi atlanır */
  }
  return { sha: data.sha || "", updatedAt };
}

async function putContent(api, config, text, sha) {
  return fetch(api, {
    method: "PUT",
    headers: ghHeaders(config.token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: `Pano güncellendi · ${new Date().toLocaleString("tr-TR")}`,
      content: base64Utf8(text),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function testPublishConnection() {
  const config = publishFields();
  const parts = repoParts(config.repo);
  if (!parts) {
    setPublishStatus("Depo adı 'kullanıcı/depo' biçiminde olmalı.", true);
    return false;
  }
  if (!config.token) {
    setPublishStatus("GitHub anahtarı gerekli.", true);
    return false;
  }
  setPublishStatus("Bağlanılıyor…");
  try {
    const response = await fetch(`https://api.github.com/repos/${parts.owner}/${parts.name}`, {
      headers: ghHeaders(config.token),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Anahtar geçersiz."
          : response.status === 404
            ? "Depo bulunamadı ya da anahtarın erişimi yok."
            : `GitHub hatası (${response.status}).`,
      );
    }
    writePublishConfig(config);
    setPublishStatus("Bağlantı tamam. Yayınlayabilirsiniz.");
    return true;
  } catch (error) {
    setPublishStatus(String(error.message || error), true);
    return false;
  }
}

async function publishContent() {
  if (!ADMIN_MODE) return;
  const config = publishFields();
  const parts = repoParts(config.repo);
  if (!parts) {
    setPublishStatus("Önce depo adını girin.", true);
    switchView("ayarlar");
    return;
  }
  if (!config.token) {
    setPublishStatus("Önce GitHub anahtarını girin.", true);
    switchView("ayarlar");
    return;
  }

  const button = el("admin-publish");
  const settingsButton = el("pub-publish");
  button.disabled = true;
  settingsButton.disabled = true;
  setPublishStatus("Yayınlanıyor…");

  const text = JSON.stringify(contentPayload(), null, 2);
  const api = `https://api.github.com/repos/${parts.owner}/${parts.name}/contents/${config.path}`;

  try {
    const remote = await currentFile(api, config);
    if (remote.updatedAt && publishedAt && remote.updatedAt > publishedAt + 1000) {
      const proceed = await askConfirm({
        title: "Yeni bir yayın var",
        text: `${formatStamp(remote.updatedAt)} tarihli daha yeni bir yayın yapılmış. Üzerine yazarsanız o değişiklikler kaybolur. Önce Yenile ile son sürümü almanız önerilir.`,
        ok: "Yine de yayınla",
      });
      if (!proceed) {
        setPublishStatus("Yayın iptal edildi; önce Yenile ile son sürümü alın.", true);
        return;
      }
    }

    let ok = false;
    let lastError = "";
    for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
      const { sha } = await currentFile(api, config);
      const response = await putContent(api, config, text, sha);
      if (response.ok) {
        ok = true;
        break;
      }
      const body = await response.json().catch(() => ({}));
      lastError = body.message || `GitHub hatası (${response.status}).`;
      if (response.status !== 409) break;
    }
    if (!ok) throw new Error(lastError);

    writePublishConfig(config);
    clearDraft();
    isDraft = false;
    state.updatedAt = Date.now();
    publishedAt = Date.now();
    writeCache(contentPayload());
    setPublishStatus(`Yayınlandı · ${formatStamp(Date.now())}. GitHub Pages 1-2 dakikada günceller.`);
    updateChrome();
    toast("Yayınlandı. Ekip sayfayı yenileyince görür.");
    setTimeout(checkLivePublish, 60000);
  } catch (error) {
    setPublishStatus(String(error.message || error), true);
    toast("Yayınlanamadı; ayarları kontrol edin.", true);
  } finally {
    button.disabled = false;
    settingsButton.disabled = false;
  }
}

async function checkLivePublish() {
  setPublishStatus("Canlı yayın kontrol ediliyor…");
  try {
    const response = await fetch(`content.json?live=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Canlı içerik okunamadı (${response.status}).`);
    const live = await response.json();
    const liveTime = Date.parse(live.updatedAt) || 0;
    const expected = state.updatedAt || publishedAt;
    if (liveTime && expected && Math.abs(liveTime - expected) < 180000) {
      setPublishStatus(`Canlı yayın güncel · ${formatStamp(liveTime)}`);
      toast("Canlı yayın güncel.");
    } else {
      const liveLabel = liveTime ? formatStamp(liveTime) : "yayınlanmamış";
      setPublishStatus(`Canlıdaki sürüm: ${liveLabel}. Yeni sürüm henüz görünmüyor; 1-2 dakika sonra tekrar deneyin.`, true);
    }
  } catch (error) {
    setPublishStatus(String(error.message || error), true);
  }
}

function contentJsonText() {
  return JSON.stringify(contentPayload(), null, 2);
}

function downloadContentFile() {
  const blob = new Blob([contentJsonText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "content.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("content.json indirildi; GitHub'da bu dosyayı güncelleyin.");
}

async function copyContentJson() {
  const ok = await copyText(contentJsonText());
  toast(ok ? "content.json panoya kopyalandı." : "Kopyalanamadı; dosyayı indirin.", !ok);
}

async function refreshContent() {
  await loadContent({ quiet: true });
  toast(offlineMode ? "Bağlantı yok; önbellek gösteriliyor." : "Veriler yenilendi.", offlineMode);
}

function bindAdminEvents() {
  el("admin-publish").addEventListener("click", publishContent);
  el("admin-discard").addEventListener("click", discardDraft);
  el("pub-save").addEventListener("click", () => {
    const config = publishFields();
    if (writePublishConfig(config)) {
      updateGithubEditLink(config);
      setPublishStatus("Ayarlar kaydedildi. Bağlantıyı deneyin.");
      toast("Yayın ayarları kaydedildi.");
    }
  });
  el("pub-test").addEventListener("click", testPublishConnection);
  el("pub-publish").addEventListener("click", publishContent);
  el("ocr-save").addEventListener("click", () => {
    localStorage.setItem(OCR_KEY, el("ocr-key").value.trim());
    fillOcrField();
    toast("Fotoğraf okuma anahtarı kaydedildi.");
  });
  el("download-content").addEventListener("click", downloadContentFile);
  el("copy-content").addEventListener("click", copyContentJson);
}

/* ---------- Liste içe aktarma ---------- */
const IMPORT_MONTHS = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4, mayıs: 5, mayis: 5, haziran: 6,
  temmuz: 7, ağustos: 8, agustos: 8, eylül: 9, eylul: 9, ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
  oca: 1, şub: 2, sub: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, ağu: 8, agu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
};
const MONTH_SOURCE = "(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik|oca|şub|sub|mar|nis|may|haz|tem|ağu|agu|eyl|eki|kas|ara)";

const IMPORT_WEEKDAYS = {
  pazartesi: 1, salı: 2, sali: 2, çarşamba: 3, carsamba: 3, perşembe: 4, persembe: 4,
  cuma: 5, cumartesi: 6, pazar: 0, pzt: 1, sal: 2, çar: 3, car: 3, per: 4, cum: 5, cmt: 6, paz: 0,
};

const SHIFT_WORDS = {
  sabah: "08–16", sabahçı: "08–16", sabahci: "08–16", gündüz: "08–16", gunduz: "08–16", öğle: "08–16", ogle: "08–16",
  akşam: "16–24", aksam: "16–24", akşamcı: "16–24", aksamci: "16–24",
  gece: "24–08", gececi: "24–08", icap: "İcap", idari: "İdari", izinli: "İzinli", izin: "İzinli",
};
const ROLE_WORDS = {
  "asistan radyolog": "Asistan radyolog", radyolog: "Radyolog", "röntgen teknisyeni": "Teknisyen", teknisyen: "Teknisyen",
  hemşire: "Hemşire", sekreter: "Sekreter", fizikçi: "Fizikçi", öğrenci: "Öğrenci", stajyer: "Öğrenci", başasistan: "Asistan radyolog",
};

const RANGE_SOURCE = "\\d{1,2}(?:[:.]\\d{1,2})?\\s*(?:-|–|—|~)\\s*\\d{1,2}(?:[:.]\\d{1,2})?";
const ROLE_SOURCE = "(?:asistan\\s+radyolog|radyolog|röntgen\\s+teknisyeni|teknisyen|hemşire|sekreter|fizikçi|öğrenci|stajyer|başasistan)";
const DEVICE_SOURCE = "(?:rönt-port|röntgen|rönt-mamo|mamografi|mamograf|ultrason|rönt|usg|mr|bt)";
const LABEL_SOURCE = "(?:personel|isim|ad\\s+soyad|ekip|nöbetçi|vardiya|saat|tarih|gün|liste)\\s*:";
const SHIFT_WORD_SOURCE = "(?:sabahçı|akşamcı|gececi|sabah|akşam|gece|gündüz|icap|idari|izinli|izin)";
const TIME_SOURCE = "\\d{1,2}[:.]\\d{2}";
const HEADER_RE = /^(tarih|günün|günlük|gün|günler|personel|isim|ad|ad soyad|ekip|vardiya|saat|mesai|kişi|nöbet|nöbetçi|liste|hafta|kadro|program|çizelge|toplam|not|notlar|açıklama|menü|çorba|ana yemek|yardımcı yemek|tatlı|salata|içecek|kahvaltı)(?![a-zçğıöşü])/;
const STOP_RE = /^(radyoloji|görüntüleme|hastane|departman|servis|poliklinik|toplantı|toplanti|duyuru|eğitim|egitim|seminer|kurul|rapor|tatil|bayram|nöbet| nobet|ekip|kadro|liste|program|çizelge|hafta)$/;

const EXAMPLE_TEAM = `15.11.2026 Cumartesi
08:00-16:00  Dr. Ayşe Yılmaz (MR), Murat Demir (BT), Ece K. (RÖNT-PORT)
16:00-24:00  Ali Şahin, Zeynep Ak
24:00-08:00  Emre Yıldız

16.11.2026 Pazar
08:00-16:00  Dr. Ayşe Yılmaz (MR)
16:00-24:00  Murat Demir
24:00-08:00  Ali Şahin`;

const EXAMPLE_MEAL = `15.11.2026 Cumartesi
Mercimek çorbası
Izgara tavuk
Pirinç pilavı
Mevsim salatası

16.11.2026 Pazar
Domates çorbası · Karnıyarık · Bulgur pilavı · Sütlaç`;

let importMode = "team";
let importResult = null;
let importTimer = null;

function lowerTr(text) {
  return String(text ?? "").toLocaleLowerCase("tr");
}

function nameKey(name) {
  return lowerTr(name).replace(/\s+/g, " ").trim();
}

function shiftKey(value) {
  return String(value || "").replace(/[-–—~]/g, "-");
}

/** Aynı kişi + vardiya mı? Ad ve vardiya büyük/küçük harf ve tire farkı duyarsız. */
function sameMember(a, b) {
  return nameKey(a.name) === nameKey(b.name) && shiftKey(a.shift) === shiftKey(b.shift);
}

function blankOut(text, index, length) {
  return text.slice(0, index) + " ".repeat(length) + text.slice(index + length);
}

function dateKeyFrom(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return keyOf(date);
}

/** Metindeki ilk tarihi bulur ve o kısmı boşlukla değiştirir. */
function takeDate(text, refKey) {
  const lower = lowerTr(text);
  const ref = parseKey(refKey);
  let match = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ]\d{1,2}[:.]\d{2}(?::\d{2})?)?/);
  if (match) {
    const key = dateKeyFrom(Number(match[1]), Number(match[2]), Number(match[3]));
    if (key) return { key, cleaned: blankOut(text, match.index, match[0].length) };
  }
  match = lower.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (match) {
    const key = dateKeyFrom(Number(match[3]), Number(match[2]), Number(match[1]));
    if (key) return { key, cleaned: blankOut(text, match.index, match[0].length) };
  }
  match = lower.match(new RegExp(`(\\d{1,2})\\s+${MONTH_SOURCE}(?![a-zçğıöşü])(?:\\s+(\\d{4}))?`));
  if (match) {
    const month = IMPORT_MONTHS[match[2]];
    if (month) {
      const year = match[3] ? Number(match[3]) : ref.getFullYear();
      const key = dateKeyFrom(year, month, Number(match[1]));
      if (key) return { key, cleaned: blankOut(text, match.index, match[0].length) };
    }
  }
  match = lower.match(/(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?![\d])/);
  if (match) {
    const offset = match[0].search(/\d/);
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let key = dateKeyFrom(ref.getFullYear(), month, day);
      if (key) {
        const candidate = parseKey(key);
        if ((ref - candidate) / 86400000 > 183) key = dateKeyFrom(ref.getFullYear() + 1, month, day) || key;
        return { key, cleaned: blankOut(text, match.index + offset, match[0].length - offset) };
      }
    }
  }
  return null;
}

function takeWeekday(text) {
  const lower = lowerTr(text);
  const words = Object.keys(IMPORT_WEEKDAYS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const index = lower.indexOf(word);
    if (index === -1) continue;
    const before = index > 0 ? lower[index - 1] : "";
    const after = lower[index + word.length] || "";
    if (/[a-zçğıöşü]/.test(before) || /[a-zçğıöşü]/.test(after)) continue;
    return { day: IMPORT_WEEKDAYS[word], cleaned: blankOut(text, index, word.length) };
  }
  return null;
}

function detectShift(text) {
  const lower = lowerTr(text).replace(/\s+/g, " ");
  const regex = new RegExp(RANGE_SOURCE, "g");
  let match;
  while ((match = regex.exec(lower))) {
    const before = match.index > 0 ? lower[match.index - 1] : "";
    if (/[\d./:]/.test(before)) continue;
    const pieces = match[0].split(/\s*(?:-|–|—|~)\s*/);
    if (pieces.length < 2) continue;
    const start = Number(pieces[0].split(/[:.]/)[0]);
    const end = Number(pieces[1].split(/[:.]/)[0]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > 24 || end > 24 || start === end) continue;
    return shiftLabel(start, end);
  }
  const single = lower.match(/(?:^|[\s(])(\d{1,2})[:.](\d{2})(?![\d])/);
  if (single) {
    const hour = Number(single[1]);
    const mapped = { 8: "08–16", 16: "16–24", 24: "24–08", 0: "24–08" }[hour];
    if (mapped) return mapped;
  }
  const words = Object.keys(SHIFT_WORDS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const index = lower.indexOf(word);
    if (index === -1) continue;
    const before = index > 0 ? lower[index - 1] : "";
    const after = lower[index + word.length] || "";
    if (/[a-zçğıöşü]/.test(before) || /[a-zçğıöşü]/.test(after)) continue;
    return SHIFT_WORDS[word];
  }
  return "";
}

function shiftLabel(start, end) {
  const from = start === 24 ? 0 : start;
  const to = end === 24 ? 0 : end;
  if (from === 8 && to === 16) return "08–16";
  if (from === 16 && to === 0) return "16–24";
  if (from === 0 && to === 8) return "24–08";
  return `${pad(start)}–${pad(end)}`;
}

function detectDevice(text) {
  const lower = lowerTr(text);
  const regex = new RegExp(DEVICE_SOURCE, "g");
  let match;
  while ((match = regex.exec(lower))) {
    const before = match.index > 0 ? lower[match.index - 1] : "";
    const after = lower[match.index + match[0].length] || "";
    if (/[a-zçğıöşü]/.test(before) || /[a-zçğıöşü]/.test(after)) continue;
    return match[0].toLocaleUpperCase("tr-TR");
  }
  return "";
}

function detectRole(text) {
  const lower = lowerTr(text);
  const words = Object.keys(ROLE_WORDS).sort((a, b) => b.length - a.length);
  for (const word of words) {
    const index = lower.indexOf(word);
    if (index === -1) continue;
    const before = index > 0 ? lower[index - 1] : "";
    const after = lower[index + word.length] || "";
    if (/[a-zçğıöşü]/.test(before) || /[a-zçğıöşü]/.test(after)) continue;
    return ROLE_WORDS[word];
  }
  return "";
}

/** Metinden belirli kalıpları boşlukla siler; Türkçe küçültme uzunluğu korur. */
function removeMatches(text, source) {
  const lower = lowerTr(text);
  const regex = new RegExp(source, "g");
  let result = "";
  let last = 0;
  let match;
  while ((match = regex.exec(lower))) {
    if (!match[0].length) {
      regex.lastIndex += 1;
      continue;
    }
    result += text.slice(last, match.index) + " ".repeat(match[0].length);
    last = match.index + match[0].length;
  }
  return result + text.slice(last);
}

/** Tek satırda birden fazla vardiya varsa (08-16 Ayşe 16-24 Ali) dilimlere ayırır. */
function shiftSegments(line) {
  const regex = new RegExp(RANGE_SOURCE, "g");
  const matches = [];
  let match;
  while ((match = regex.exec(line))) {
    const before = match.index > 0 ? line[match.index - 1] : "";
    if (/[\d./:]/.test(before)) continue;
    matches.push({ index: match.index });
  }
  if (matches.length < 2) return null;
  return matches.map((item, position) => {
    const start = item.index;
    const stop = position + 1 < matches.length ? matches[position + 1].index : line.length;
    return line.slice(start, stop);
  });
}

function looksLikePerson(text) {
  if (!text || text.length < 2 || text.length > 60) return false;
  if (!/[a-zçğıöşü]/i.test(text)) return false;
  if (/\d/.test(text)) return false;
  const lower = lowerTr(text);
  if (HEADER_RE.test(lower)) return false;
  if (STOP_RE.test(lower)) return false;
  return true;
}

const TR_LETTERS = "a-zçğıöşü";

/** Türkçe harfler  ile sınır sayılmadığı için kendi sınır kontrolümüz. */
function boundedSource(source) {
  return `(?<![${TR_LETTERS}])${source}(?![${TR_LETTERS}])`;
}

function splitPersonPieces(text) {
  return text.split(/\s*(?:[,;|]|\t|\s\/\s|\s\+\s|\s&\s|\bile\b|\bve\b)\s*|\s{2,}/i);
}

function cleanPersonPiece(piece) {
  return piece
    .replace(/^[\s\-–—•*·→>):;,]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[\s:;.]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractPeople(text) {
  const lineRole = detectRole(text);
  const lineDevice = detectDevice(text);
  const details = [];
  for (const raw of splitPersonPieces(text)) {
    if (!raw.trim()) continue;
    const role = detectRole(raw) || lineRole;
    const device = detectDevice(raw) || lineDevice;
    let work = removeMatches(raw, RANGE_SOURCE);
    work = removeMatches(work, boundedSource(TIME_SOURCE));
    work = removeMatches(work, boundedSource(ROLE_SOURCE));
    work = removeMatches(work, boundedSource(DEVICE_SOURCE));
    work = removeMatches(work, boundedSource(SHIFT_WORD_SOURCE));
    work = removeMatches(work, LABEL_SOURCE);
    work = work.replace(/\([^)]*\)/g, " ");
    const name = cleanPersonPiece(work);
    if (looksLikePerson(name)) details.push({ name, role, device });
  }
  return { names: details.map((item) => item.name), details, role: lineRole, device: lineDevice };
}

function addParsedMember(groups, dateKey, member) {
  const list = groups.get(dateKey) || [];
  const exists = list.some((item) => sameMember(item, member));
  if (!exists) {
    list.push({ name: member.name, shift: member.shift || "", note: member.note || "" });
    groups.set(dateKey, list);
  }
}

function weekdayDate(refKey, day) {
  const date = parseKey(refKey);
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(refKey, -offset);
  return addDays(monday, (day + 6) % 7);
}

function tableSeparator(lines) {
  if (lines.some((line) => line.includes("\t"))) return "\t";
  if (lines.filter((line) => line.split(";").length >= 3).length >= 2) return ";";
  return "";
}

function rowDate(row, index, weekRef) {
  const cell = row[index] || "";
  const dateInfo = takeDate(cell, weekRef);
  if (dateInfo) return dateInfo.key;
  const weekday = takeWeekday(cell);
  if (weekday) return weekdayDate(weekRef, weekday.day);
  return "";
}

function rowDateAnywhere(row, weekRef) {
  for (const cell of row) {
    const dateInfo = takeDate(cell, weekRef);
    if (dateInfo) return dateInfo.key;
    const weekday = takeWeekday(cell);
    if (weekday) return weekdayDate(weekRef, weekday.day);
  }
  return "";
}

function detectMonthContext(text, refKey) {
  const lower = lowerTr(text);
  const ref = parseKey(refKey);
  const match = lower.match(new RegExp(`${MONTH_SOURCE}\\s*(\\d{4})?`));
  if (match && IMPORT_MONTHS[match[1]]) {
    return { year: match[2] ? Number(match[2]) : ref.getFullYear(), month: IMPORT_MONTHS[match[1]], explicit: true };
  }
  const numeric = lower.match(/\b(\d{1,2})[./](\d{4})\b/);
  if (numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12) {
    return { year: Number(numeric[2]), month: Number(numeric[1]), explicit: true };
  }
  return { year: ref.getFullYear(), month: ref.getMonth() + 1, explicit: false };
}

function dayNumberDate(cell, context) {
  const text = String(cell || "").trim();
  if (!/^\d{1,2}$/.test(text) || !context) return "";
  const day = Number(text);
  if (day < 1 || day > 31) return "";
  return dateKeyFrom(context.year, context.month, day);
}

function parseTeamTable(lines, refKey, weekOffset, monthContext) {
  const separator = tableSeparator(lines);
  if (!separator) return null;
  const weekRef = addDays(refKey, (weekOffset || 0) * 7);
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim())).filter((row) => row.some(Boolean));
  if (rows.length < 2) return null;

  const groups = new Map();
  const dayHeaderIndex = rows.findIndex((row) => {
    const numeric = row.filter((cell) => /^\d{1,2}$/.test(String(cell || "").trim())).length;
    return numeric >= 3 || (numeric >= 2 && monthContext && monthContext.explicit);
  });
  if (dayHeaderIndex >= 0) {
    const header = rows[dayHeaderIndex];
    const dayColumns = header
      .map((cell, index) => ({ index, day: Number(String(cell || "").trim()) }))
      .filter((entry) => /^\d{1,2}$/.test(String(header[entry.index] || "").trim()) && entry.day >= 1 && entry.day <= 31);
    const context = monthContext || { year: parseKey(refKey).getFullYear(), month: parseKey(refKey).getMonth() + 1 };
    for (const row of rows.slice(dayHeaderIndex + 1)) {
      const label = row[0] || "";
      const rowShift = detectShift(label);
      const rowRole = detectRole(label);
      const labelDevice = detectDevice(label);
      for (const column of dayColumns) {
        const cell = row[column.index] || "";
        if (!cell.trim()) continue;
        const dateKey = dateKeyFrom(context.year, context.month, column.day);
        if (!dateKey) continue;
        const people = extractPeople(cell);
        for (const person of people.details) {
          addParsedMember(groups, dateKey, {
            name: person.name,
            role: person.role || rowRole,
            shift: rowShift || "",
            note: labelDevice || person.device || "",
          });
        }
      }
    }
    return groups.size ? groups : null;
  }

  const header = rows[0];
  const headerShifts = header.map((cell) => detectShift(cell));
  const headerDevices = header.map((cell) => detectDevice(cell));
  const hasColumnMeta = headerShifts.some(Boolean) || headerDevices.some(Boolean);
  const looksHeader = header.some((cell) => HEADER_RE.test(lowerTr(cell))) || hasColumnMeta;
  const dataRows = looksHeader ? rows.slice(1) : rows;
  if (!dataRows.length) return null;

  if (hasColumnMeta) {
    const dateCol = Math.max(0, header.findIndex((cell) => /tarih|gün/.test(lowerTr(cell))));
    const metaCols = header.map((_, index) => index).filter((index) => headerShifts[index] || headerDevices[index]);
    for (const row of dataRows) {
      const dateKey = rowDate(row, dateCol, weekRef) || rowDateAnywhere(row, weekRef) || dayNumberDate(row[dateCol], monthContext);
      if (!dateKey) continue;
      const rowShift = detectShift(row.filter((_, index) => index !== dateCol).join(" "));
      for (const index of metaCols) {
        if (index === dateCol) continue;
        const people = extractPeople(row[index] || "");
        for (const person of people.details) {
          addParsedMember(groups, dateKey, {
            name: person.name,
            role: person.role,
            shift: headerShifts[index] || rowShift || "",
            note: headerDevices[index] || person.device || "",
          });
        }
      }
    }
    return groups.size ? groups : null;
  }

  const dateCol = header.findIndex((cell) => /tarih|gün/.test(lowerTr(cell)));
  const shiftCol = header.findIndex((cell) => /vardiya|saat|mesai/.test(lowerTr(cell)));
  const nameCols = header.map((cell, index) => (/personel|isim|ad|ekip|kişi/.test(lowerTr(cell)) ? index : -1)).filter((index) => index >= 0);
  const useHeader = dateCol >= 0 || shiftCol >= 0 || nameCols.length > 0;

  for (const row of useHeader ? rows.slice(1) : rows) {
    const firstCellIndex = useHeader && dateCol >= 0 ? dateCol : 0;
    const dateKey = rowDate(row, firstCellIndex, weekRef) || rowDateAnywhere(row, weekRef) || dayNumberDate(row[firstCellIndex], monthContext);
    if (!dateKey) continue;
    const shift = useHeader && shiftCol >= 0 ? detectShift(row[shiftCol] || "") : detectShift(row.join(" "));
    const first = useHeader && dateCol >= 0 ? dateCol : 0;
    const cols = useHeader && nameCols.length ? nameCols : row.map((_, index) => index).filter((index) => index !== first && index !== shiftCol);
    for (const index of cols) {
      const cell = row[index] || "";
      if (!cell) continue;
      const people = extractPeople(cell);
      for (const person of people.details) {
        addParsedMember(groups, dateKey, { name: person.name, role: person.role, shift: shift || "", note: person.device });
      }
    }
  }
  return groups.size ? groups : null;
}

function parseTeamLines(lines, refKey, weekOffset, skipped) {
  const weekRef = addDays(refKey, (weekOffset || 0) * 7);
  const groups = new Map();
  let currentDate = "";
  let currentShift = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-=_*•·\s]+$/.test(line)) continue;

    let work = line;
    const dateInfo = takeDate(work, weekRef);
    if (dateInfo) work = dateInfo.cleaned;
    const weekdayInfo = takeWeekday(work);
    if (weekdayInfo) work = weekdayInfo.cleaned;

    const date = dateInfo ? dateInfo.key : weekdayInfo ? weekdayDate(weekRef, weekdayInfo.day) : "";
    const shift = detectShift(work);
    const segments = shiftSegments(work);

    if (date) {
      currentDate = date;
      currentShift = segments ? "" : shift || "";
    }

    if (segments) {
      const target = currentDate || refKey;
      for (const segment of segments) {
        const segmentShift = detectShift(segment) || currentShift;
        const people = extractPeople(segment);
        for (const person of people.details) {
          addParsedMember(groups, target, { name: person.name, role: person.role, shift: segmentShift, note: person.device });
        }
      }
      continue;
    }

    const people = extractPeople(work);
    if (!people.names.length) {
      if (!date && shift) currentShift = shift;
      else if (!date && !shift) skipped.push(line);
      continue;
    }

    const target = currentDate || refKey;
    const memberShift = shift || currentShift;
    for (const person of people.details) {
      addParsedMember(groups, target, { name: person.name, role: person.role, shift: memberShift, note: person.device });
    }
  }

  return groups;
}

function parseTeamText(text, refKey, weekOffset) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/\u00a0/g, " "));
  const skipped = [];
  let groups = null;
  if (tableSeparator(lines)) groups = parseTeamTable(lines, refKey, weekOffset, detectMonthContext(text, refKey));
  if (!groups || !groups.size) groups = parseTeamLines(lines, refKey, weekOffset, skipped);
  return { mode: "team", groups: groups || new Map(), skipped };
}

function cleanDish(line) {
  return line
    .replace(/^[\s\-–—•*·→>):;,]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s*(?:·|\|)\s*/g, "\n")
    .replace(/,\s*/g, "\n")
    .replace(/[\s:;]+$/, "")
    .trim();
}

function parseMealTable(lines, refKey, weekOffset, monthContext) {
  const separator = tableSeparator(lines);
  if (!separator) return null;
  const weekRef = addDays(refKey, (weekOffset || 0) * 7);
  const rows = lines.map((line) => line.split(separator).map((cell) => cell.trim())).filter((row) => row.some(Boolean));
  if (rows.length < 2) return null;
  const groups = new Map();

  const dayHeaderIndex = rows.findIndex((row) => {
    const numeric = row.filter((cell) => /^\d{1,2}$/.test(String(cell || "").trim())).length;
    return numeric >= 3 || (numeric >= 2 && monthContext && monthContext.explicit);
  });
  if (dayHeaderIndex >= 0) {
    const header = rows[dayHeaderIndex];
    const dayColumns = header
      .map((cell, index) => ({ index, day: Number(String(cell || "").trim()) }))
      .filter((entry) => /^\d{1,2}$/.test(String(header[entry.index] || "").trim()) && entry.day >= 1 && entry.day <= 31);
    const context = monthContext || { year: parseKey(refKey).getFullYear(), month: parseKey(refKey).getMonth() + 1 };
    for (const row of rows.slice(dayHeaderIndex + 1)) {
      for (const column of dayColumns) {
        const cell = row[column.index] || "";
        if (!cell.trim()) continue;
        const dateKey = dateKeyFrom(context.year, context.month, column.day);
        if (!dateKey) continue;
        const dishes = cleanDish(cell).split("\n").map((dish) => dish.trim()).filter(Boolean);
        if (!dishes.length) continue;
        groups.set(dateKey, (groups.get(dateKey) || []).concat(dishes));
      }
    }
    return groups.size ? groups : null;
  }

  const header = rows[0];
  const hasHeader = header.some((cell) => /tarih|gün|menü|çorba/.test(lowerTr(cell)));
  const dateCol = hasHeader ? Math.max(0, header.findIndex((cell) => /tarih|gün/.test(lowerTr(cell)))) : 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    const dateKey = rowDate(row, dateCol, weekRef) || rowDateAnywhere(row, weekRef) || dayNumberDate(row[dateCol], monthContext);
    if (!dateKey) continue;
    const dishes = row
      .filter((_, index) => index !== dateCol)
      .flatMap((cell) => cleanDish(cell).split("\n"))
      .map((dish) => dish.trim())
      .filter(Boolean);
    if (!dishes.length) continue;
    groups.set(dateKey, (groups.get(dateKey) || []).concat(dishes));
  }
  return groups.size ? groups : null;
}

function parseMealLines(lines, refKey, weekOffset) {
  const weekRef = addDays(refKey, (weekOffset || 0) * 7);
  const groups = new Map();
  const loose = [];
  const skipped = [];
  let currentDate = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-=_*•·\s]+$/.test(line)) continue;

    let work = line;
    const dateInfo = takeDate(work, weekRef);
    if (dateInfo) work = dateInfo.cleaned;
    const weekdayInfo = takeWeekday(work);
    if (weekdayInfo) work = weekdayInfo.cleaned;
    const date = dateInfo ? dateInfo.key : weekdayInfo ? weekdayDate(weekRef, weekdayInfo.day) : "";
    if (date) currentDate = date;

    const dishes = cleanDish(work).split("\n").map((dish) => dish.trim()).filter(Boolean);
    if (!dishes.length) continue;
    if (currentDate) {
      groups.set(currentDate, (groups.get(currentDate) || []).concat(dishes));
    } else {
      loose.push(...dishes);
    }
  }

  if (!groups.size) {
    if (!loose.length) return { mode: "meal", groups: new Map(), skipped };
    return { mode: "meal", groups: new Map([[refKey, loose]]), skipped };
  }
  return { mode: "meal", groups, skipped };
}

function parseMealText(text, refKey, weekOffset) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/\u00a0/g, " "));
  let groups = null;
  if (tableSeparator(lines)) groups = parseMealTable(lines, refKey, weekOffset, detectMonthContext(text, refKey));
  if (!groups || !groups.size) {
    const parsed = parseMealLines(lines, refKey, weekOffset);
    groups = parsed.groups;
    return { mode: "meal", groups, skipped: parsed.skipped };
  }
  return { mode: "meal", groups, skipped: [] };
}

function parseImport(text, mode, refKey, weekOffset) {
  return mode === "meal" ? parseMealText(text, refKey, weekOffset) : parseTeamText(text, refKey, weekOffset);
}

/* ---------- İçe aktarma arayüzü ---------- */
function importEmptyPreview() {
  return '<p class="import-empty">Listeyi yapıştırın; önizleme burada görünecek.</p>';
}

function updateImportModeUi() {
  document.querySelectorAll("[data-import-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.importMode === importMode);
    button.setAttribute("aria-pressed", String(button.dataset.importMode === importMode));
  });
  el("import-title").textContent = importMode === "team" ? "Ekip listesini içe aktar" : "Yemek listesini içe aktar";
  el("import-hint").textContent =
    importMode === "team"
      ? "Excel, Word, WhatsApp metni ya da çizelgenin fotoğrafını seçin. Tarih, vardiya, isim ve cihaz otomatik ayrılır; gün adları seçili haftaya göre yorumlanır."
      : "Tarih satırları ve altındaki yemekler ayrıştırılır. Tarih yoksa menü seçili güne yazılır.";
  el("import-replace-label").textContent = importMode === "team" ? "Bu günlerdeki mevcut ekibi sil" : "Aynı günlerin menüsünün üzerine yaz";
  el("import-replace").checked = importMode === "meal";
}

function openImport(mode) {
  if (!ADMIN_MODE) return;
  importMode = mode === "meal" ? "meal" : "team";
  importResult = null;
  el("import-text").value = "";
  el("import-preview").innerHTML = importEmptyPreview();
  setImportStatus("");
  el("import-apply").disabled = true;
  el("import-apply").textContent = "İçe aktar";
  el("import-week").value = "0";
  updateImportModeUi();
  openDialog(el("import-dialog"));
  setTimeout(() => el("import-text").focus(), 80);
}

function renderImportPreview() {
  const text = el("import-text").value;
  const box = el("import-preview");
  const apply = el("import-apply");

  if (!text.trim()) {
    importResult = null;
    box.innerHTML = importEmptyPreview();
    apply.disabled = true;
    apply.textContent = "İçe aktar";
    return;
  }

  const weekOffset = Number(el("import-week").value) || 0;
  const parsed = parseImport(text, importMode, selected, weekOffset);
  importResult = { ...parsed, replace: el("import-replace").checked };
  const dates = [...parsed.groups.keys()].sort();

  if (!dates.length) {
    importResult = null;
    box.innerHTML = `<p class="import-empty">Listeden tarih veya isim çıkarılamadı. Satırları kontrol edin ya da örnek biçime bakın.</p>${
      parsed.skipped.length ? `<p class="import-skip">Atlanan: ${esc(parsed.skipped.slice(0, 2).join(" · "))}</p>` : ""
    }`;
    apply.disabled = true;
    apply.textContent = "İçe aktar";
    return;
  }

  let total = 0;
  let html = "";
  const MAX_DAYS = 8;
  for (const date of dates.slice(0, MAX_DAYS)) {
    const items = parsed.groups.get(date);
    if (importMode === "team") {
      total += items.length;
      const chips = items
        .slice(0, 10)
        .map((member) => `<span class="import-chip">${member.shift ? `<b>${esc(member.shift)}</b>` : ""}${esc(member.name)}${member.note ? ` <span class="import-empty">· ${esc(member.note)}</span>` : ""}</span>`)
        .join("");
      const more = items.length > 10 ? `<span class="import-chip">+${items.length - 10}</span>` : "";
      html += `<div class="import-day"><div class="import-day-head">${esc(longDate(date))} ${esc(weekdayOf(date))}<span>${items.length} kişi</span></div><div class="import-chips">${chips}${more}</div></div>`;
    } else {
      total += items.length;
      html += `<div class="import-day"><div class="import-day-head">${esc(longDate(date))} ${esc(weekdayOf(date))}<span>${items.length} satır</span></div><p class="import-meal">${esc(items.join("\n"))}</p></div>`;
    }
  }
  const rest = dates.length - MAX_DAYS;
  if (rest > 0) html += `<p class="import-empty">… ve ${rest} gün daha</p>`;

  const summary =
    importMode === "team"
      ? `${dates.length} gün · ${total} kişi`
      : `${dates.length} gün · ${total} yemek satırı`;
  const skipped = parsed.skipped.length ? ` · ${parsed.skipped.length} satır atlandı` : "";
  box.innerHTML = `<p class="import-summary">${esc(summary)}<span>${esc(skipped)}</span></p>${html}${
    parsed.skipped.length ? `<details><summary class="import-skip">Atlanan satırlar</summary><p class="import-skip">${esc(parsed.skipped.slice(0, 6).join("\n"))}</p></details>` : ""
  }`;
  apply.disabled = false;
  apply.textContent =
    importMode === "team" ? `İçe aktar (${total} kişi)` : `İçe aktar (${dates.length} gün)`;
}

function applyImport() {
  if (!ADMIN_MODE || !importResult) return;
  const { mode, groups } = importResult;
  const replace = el("import-replace").checked;
  const dates = [...groups.keys()].sort();
  if (!dates.length) return;

  let added = 0;
  let days = 0;
  const firstDate = dates[0];

  if (mode === "team") {
    for (const date of dates) {
      const day = ensureDay(date);
      if (replace) day.team = [];
      let touched = false;
      for (const member of groups.get(date)) {
        if (day.team.some((item) => sameMember(item, member))) continue;
        day.team.push({ id: uid(), name: member.name, shift: member.shift, phone: "", note: member.note });
        added += 1;
        touched = true;
      }
      if (touched || (replace && day.team.length)) days += 1;
    }
    if (!added && !replace) {
      toast("Yeni kişi yok; liste zaten panoda.", true);
      return;
    }
  } else {
    for (const date of dates) {
      const day = ensureDay(date);
      if (!replace && day.meal.text.trim()) continue;
      const text = groups.get(date).join("\n").trim();
      if (!text) continue;
      day.meal = { text, updatedAt: Date.now() };
      added += groups.get(date).length;
      days += 1;
    }
    if (!days) {
      toast("Mevcut menüler korundu; üzerine yazmak için kutuyu işaretleyin.", true);
      return;
    }
  }

  save();
  render();
  setDate(firstDate);
  closeDialog(el("import-dialog"));
  toast(
    mode === "team"
      ? `${added} kişi ${days} güne eklendi.`
      : `${days} günün menüsü kaydedildi.`,
  );
}

function setImportStatus(message, kind = "") {
  const box = el("import-status");
  if (!box) return;
  box.textContent = message;
  box.classList.toggle("is-busy", kind === "busy");
  box.classList.toggle("is-warn", kind === "warn");
  el("import-file-text").textContent = kind === "busy" ? "Okunuyor…" : "Dosya seç";
}

/** İşlem sürerken geçen saniyeyi gösterir; uzun bekleyiş boş görünmesin. */
function startImportStatus(base) {
  const started = Date.now();
  setImportStatus(base, "busy");
  return setInterval(() => setImportStatus(`${base} ${Math.round((Date.now() - started) / 1000)} sn`, "busy"), 1000);
}

async function handleImportFile(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const photo = String(file.type || "").startsWith("image/");
  const statusTimer = startImportStatus(photo ? "Fotoğraf okunuyor…" : "Dosya okunuyor…");
  try {
    const text = await readImportFile(file);
    if (!text || !text.trim()) {
      setImportStatus("Dosyadan metin okunamadı.", "warn");
      return;
    }
    el("import-text").value = text;
    renderImportPreview();
    setImportStatus(photo ? "Fotoğraf okundu. Önizlemeyi kontrol edin." : "Dosya okundu. Önizlemeyi kontrol edin.");
  } catch (error) {
    const reason = String(error && error.message ? error.message : error);
    if (reason === "no-key") {
      setImportStatus("Fotoğraf okumak için Ayarlar → Fotoğraftan liste anahtarını girin.", "warn");
    } else if (reason.startsWith("api-")) {
      setImportStatus(`Fotoğraf okunamadı (${reason.slice(4)}).`, "warn");
    } else if (photo) {
      setImportStatus("Fotoğraftan çizelge çıkarılamadı. Daha net bir fotoğraf deneyin.", "warn");
    } else {
      setImportStatus("Dosya okunamadı. Listeyi kopyalayıp yapıştırın (.xlsx/.docx dışındaki dosyalar desteklenmez).", "warn");
    }
  } finally {
    clearInterval(statusTimer);
    if (el("import-status").classList.contains("is-busy")) setImportStatus("");
  }
}

async function readImportFile(file) {
  const name = lowerTr(file.name);
  if (name.endsWith(".xlsx") || name.endsWith(".docx")) {
    return readOfficeText(await file.arrayBuffer(), name.endsWith(".docx") ? "docx" : "xlsx");
  }
  if (String(file.type || "").startsWith("image/")) {
    return readSchedulePhoto(file);
  }
  return file.text();
}

/* ---------- Fotoğraftan çizelge okuma (Gemini, ücretsiz kota) ---------- */
const OCR_MODEL = "gemini-flash-lite-latest";
const OCR_PROMPT = `Bu, radyoloji bölümünün haftalık çalışma çizelgesi fotoğrafı.
Sütunlar günlerdir (üst satırda "Pazartesi 23.11.2026" gibi tarih yazar).
Satırlar vardiyadır: "08:00-16:00" altında cihaz satırları (MR, BT, RÖNT-PORT, RÖNTGEN, RÖNT-MAMO),
"16:00-24:00" altında iki satır, "24:00-08:00" altında bir satır.
Her gün için hücrelerde yazan isimleri, hangi vardiyada ve hangi cihazda olduklarıyla birlikte döndür.
Boş hücreleri atla. İsimleri fotoğrafta yazdığı gibi (büyük harf) yaz, uydurma.
Tarihi YYYY-MM-DD biçiminde ver. Vardiyayı "08:00-16:00", "16:00-24:00" veya "24:00-08:00" olarak ver.
Cihaz yalnızca 08:00-16:00 satırlarında olur; diğerlerinde boş bırak.`;

const OCR_SCHEMA = {
  type: "OBJECT",
  properties: {
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          lines: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                shift: { type: "STRING" },
                name: { type: "STRING" },
                device: { type: "STRING" },
              },
              required: ["shift", "name"],
            },
          },
        },
        required: ["date", "lines"],
      },
    },
  },
  required: ["days"],
};

function readOcrKey() {
  return localStorage.getItem(OCR_KEY) || "";
}

function fillOcrField() {
  el("ocr-key").value = readOcrKey();
  el("ocr-status").textContent = readOcrKey()
    ? "Anahtar kayıtlı; çizelge fotoğrafını seçebilirsiniz."
    : "Anahtar yok; fotoğraftan okuma kapalı.";
}

/** Okunan JSON'u içe aktarma kutusunun anladığı metne çevirir. */
function ocrText(data) {
  const days = Array.isArray(data?.days) ? data.days : [];
  const blocks = [];
  for (const day of days) {
    const match = String(day?.date || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) continue;
    const byShift = new Map();
    for (const line of Array.isArray(day.lines) ? day.lines : []) {
      const shift = String(line?.shift || "").replace(/\s/g, "");
      const name = String(line?.name || "").trim();
      if (!name || !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(shift)) continue;
      if (!byShift.has(shift)) byShift.set(shift, []);
      const device = String(line?.device || "").trim();
      byShift.get(shift).push(device ? `${name} (${device})` : name);
    }
    if (!byShift.size) continue;
    blocks.push(
      [`${match[3]}.${match[2]}.${match[1]}`, ...[...byShift].map(([shift, names]) => `${shift}  ${names.join(", ")}`)].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

/** Fotoğrafı 1600 px'e küçültüp base64 JPEG döndürür (ücretsiz kotayı korur). */
async function shrinkPhoto(file, max = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

async function readSchedulePhoto(file) {
  const key = readOcrKey();
  if (!key) throw new Error("no-key");
  const data = await shrinkPhoto(file);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${OCR_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: OCR_PROMPT }, { inline_data: { mime_type: "image/jpeg", data } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: OCR_SCHEMA },
    }),
  });
  if (!response.ok) {
    const info = await response.json().catch(() => ({}));
    const detail = info?.error?.message ? `: ${String(info.error.message).slice(0, 140)}` : "";
    throw new Error(`api-${response.status}${detail}`);
  }
  const payload = await response.json();
  const parts = payload.candidates?.[0]?.content?.parts || [];
  const raw = parts.filter((part) => !part.thought).map((part) => part.text || "").join("");
  const text = ocrText(JSON.parse(raw));
  if (!text.trim()) throw new Error("empty");
  return text;
}


/* ---------- Excel (.xlsx) ve Word (.docx) okuma ---------- */
async function inflateRaw(data) {
  if (typeof DecompressionStream !== "function") throw new Error("sıkıştırma desteği yok");
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function unzipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65558); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip değil");
  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const entries = new Map();
  let pointer = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, { method, data: bytes.subarray(start, start + compressedSize) });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  if (!entries.size) throw new Error("boş zip");
  return {
    has: (name) => entries.has(name),
    names: () => [...entries.keys()],
    text: async (name) => {
      const entry = entries.get(name);
      if (!entry) return "";
      const raw = entry.method === 0 ? entry.data : await inflateRaw(entry.data);
      return new TextDecoder().decode(raw);
    },
  };
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (!doc || doc.getElementsByTagName("parsererror").length) throw new Error("xml okunamadı");
  return doc;
}

function xmlText(element) {
  return [...element.getElementsByTagName("t")].map((node) => node.textContent || "").join("");
}

function columnIndex(reference) {
  const letters = String(reference).replace(/\d+/g, "").toUpperCase();
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.charCodeAt(0) - 64);
  return Math.max(0, value - 1);
}

function formatExcelDate(serial) {
  const days = Math.floor(serial);
  const fraction = serial - days;
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
  let text = `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
  if (fraction > 0.0001) {
    const minutes = Math.round(fraction * 1440);
    text += ` ${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
  }
  return text;
}

async function readDateStyles(zip) {
  const builtin = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
  if (!zip.has("xl/styles.xml")) return { isDate: () => false };
  try {
    const doc = parseXml(await zip.text("xl/styles.xml"));
    const custom = new Map();
    for (const format of doc.getElementsByTagName("numFmt")) {
      const id = Number(format.getAttribute("numFmtId"));
      const code = String(format.getAttribute("formatCode") || "")
        .replace(/"[^"]*"/g, "")
        .replace(/\[[^\]]*\]/g, "");
      custom.set(id, /[dmy]/i.test(code));
    }
    const styles = [];
    const cellXfs = doc.getElementsByTagName("cellXfs")[0];
    if (cellXfs) {
      for (const xf of cellXfs.getElementsByTagName("xf")) styles.push(Number(xf.getAttribute("numFmtId")));
    }
    return {
      isDate(styleIndex) {
        const id = styles[styleIndex];
        if (!Number.isFinite(id)) return false;
        if (builtin.has(id)) return true;
        return custom.get(id) === true;
      },
    };
  } catch (error) {
    return { isDate: () => false };
  }
}

function readSheetCell(cell, sharedStrings, dateStyles) {
  const type = cell.getAttribute("t") || "";
  if (type === "inlineStr") return xmlText(cell);
  const valueNode = cell.getElementsByTagName("v")[0];
  const raw = valueNode ? valueNode.textContent || "" : "";
  if (type === "s") {
    const index = Number(raw);
    return Number.isFinite(index) ? sharedStrings[index] || "" : "";
  }
  if (type === "b") return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
  if (type === "str") return raw;
  if (!raw) return "";
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const styleIndex = Number(cell.getAttribute("s"));
    if (Number.isFinite(styleIndex) && dateStyles.isDate(styleIndex) && numeric > 0) return formatExcelDate(numeric);
  }
  return raw;
}

function rowsToText(rows) {
  const lines = [];
  for (const row of rows) {
    const cells = row.map((value) => String(value == null ? "" : value).replace(/\t/g, " ").replace(/\r?\n/g, " "));
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (!cells.length) continue;
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

async function readXlsx(buffer) {
  const zip = await unzipEntries(buffer);
  const sharedStrings = [];
  if (zip.has("xl/sharedStrings.xml")) {
    try {
      const doc = parseXml(await zip.text("xl/sharedStrings.xml"));
      for (const item of doc.getElementsByTagName("si")) sharedStrings.push(xmlText(item));
    } catch (error) {
      /* paylaşılan metin yoksa hücreler kendi değerini taşır */
    }
  }
  const dateStyles = await readDateStyles(zip);

  let sheetPath = "xl/worksheets/sheet1.xml";
  if (!zip.has(sheetPath)) {
    const candidate = zip.names().find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    if (candidate) sheetPath = candidate;
  }
  if (zip.has("xl/workbook.xml") && zip.has("xl/_rels/workbook.xml.rels")) {
    try {
      const workbook = parseXml(await zip.text("xl/workbook.xml"));
      const rels = parseXml(await zip.text("xl/_rels/workbook.xml.rels"));
      const sheet = workbook.getElementsByTagName("sheet")[0];
      const relationId = sheet && (sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
      if (relationId) {
        const relation = [...rels.getElementsByTagName("Relationship")].find((node) => node.getAttribute("Id") === relationId);
        const target = relation && relation.getAttribute("Target");
        if (target) {
          const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
          if (zip.has(normalized)) sheetPath = normalized;
        }
      }
    } catch (error) {
      /* ilk çalışma sayfasıyla devam */
    }
  }

  const sheet = parseXml(await zip.text(sheetPath));
  const rows = [];
  for (const row of sheet.getElementsByTagName("row")) {
    const cells = [];
    for (const cell of row.getElementsByTagName("c")) {
      const reference = cell.getAttribute("r") || "";
      const index = reference ? columnIndex(reference) : cells.length;
      cells[index] = readSheetCell(cell, sharedStrings, dateStyles);
    }
    rows.push(cells.map((value) => (value == null ? "" : value)));
  }
  return rowsToText(rows);
}

async function readDocx(buffer) {
  const zip = await unzipEntries(buffer);
  let xml = await zip.text("word/document.xml");
  if (!xml) throw new Error("Word belgesi okunamadı");
  xml = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "");
  xml = xml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return xml.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function readOfficeText(buffer, type) {
  if (typeof DOMParser !== "function") throw new Error("tarayıcı desteği yok");
  return type === "docx" ? readDocx(buffer) : readXlsx(buffer);
}

/* ---------- Diyaloglar ---------- */
let confirmResolver = null;
function askConfirm({ title = "Emin misiniz?", text = "", html = "", ok = "Sil" } = {}) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    el("confirm-title").textContent = title;
    el("confirm-text").innerHTML = html ? `${esc(text)}<br><br>${html}` : esc(text);
    el("confirm-ok").textContent = ok;
    openDialog(el("confirm-dialog"));
  });
}

function finishConfirm(value) {
  const resolve = confirmResolver;
  confirmResolver = null;
  closeDialog(el("confirm-dialog"));
  if (resolve) resolve(value);
}

function fillSelect(select, values) {
  select.innerHTML = values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function openMemberDialog(memberId) {
  if (!ADMIN_MODE) return;
  editingMemberId = memberId || null;
  const member = memberId ? getDay(selected).team.find((item) => item.id === memberId) : null;
  el("member-title").textContent = member ? "Ekip üyesini düzenle" : "Ekip üyesi ekle";
  el("m-name").value = member ? member.name : "";
  el("m-shift").value = member && member.shift ? member.shift : SHIFTS[0];
  el("m-phone").value = member ? member.phone : "";
  el("m-note").value = member ? member.note : "";
  el("m-error").hidden = true;
  el("m-delete").hidden = !member;
  openDialog(el("member-dialog"));
  setTimeout(() => el("m-name").focus(), 60);
}

function openMealDialog() {
  if (!ADMIN_MODE) return;
  el("meal-textarea").value = getDay(selected).meal.text;
  openDialog(el("meal-dialog"));
  setTimeout(() => el("meal-textarea").focus(), 60);
}

/* ---------- Olaylar ---------- */
function bindEvents() {
  document.addEventListener(
    "click",
    (event) => {
      if (ADMIN_MODE) return;
      if (event.target.closest(".admin-only")) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  el("refresh-btn").addEventListener("click", refreshContent);
  el("offline-retry").addEventListener("click", refreshContent);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (offlineMode) {
      loadContent({ quiet: true });
      return;
    }
    if (ADMIN_MODE) return;
    if (Date.now() - lastLoadedAt < 120000) return;
    loadContent({ quiet: true });
  });

  window.addEventListener("online", () => {
    if (!offlineMode) return;
    loadContent({ quiet: true }).then(() => {
      if (!offlineMode) toast("Bağlantı geri geldi; veriler yenilendi.");
    });
  });

  setInterval(() => {
    if (offlineMode && document.visibilityState === "visible") loadContent({ quiet: true });
  }, 20000);

  el("prev-day").addEventListener("click", () => changeDay(-1));
  el("next-day").addEventListener("click", () => changeDay(1));
  el("date-input").addEventListener("change", (event) => {
    if (event.target.value) setDate(event.target.value);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  // details "toggle" kabarmaz; açık vardiyaları yakalamak için capture gerekir.
  el("team-list").addEventListener(
    "toggle",
    () => {
      openShifts = new Set([...el("team-list").querySelectorAll("details[open]")].map((node) => node.dataset.shift));
    },
    true,
  );

  el("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });
  el("set-theme").addEventListener("change", (event) => applyTheme(event.target.value));

  el("share-btn").addEventListener("click", shareBoard);
  el("share-copy").addEventListener("click", async () => {
    const ok = await copyText(el("share-text").value);
    toast(ok ? "Metin kopyalandı." : "Kopyalanamadı; metni elle seçin.", !ok);
  });

  el("add-member").addEventListener("click", () => openMemberDialog(null));
  el("sync-shift").addEventListener("click", importShiftTeam);

  el("notice-input").addEventListener("input", () => {
    if (!ADMIN_MODE) return;
    state.notice.text = el("notice-input").value.slice(0, 200);
    state.notice.updatedAt = Date.now();
    renderNotice();
    saveSoon();
  });
  el("notice-tone").addEventListener("change", () => {
    if (!ADMIN_MODE) return;
    state.notice.tone = el("notice-tone").value === "warn" ? "warn" : "info";
    state.notice.updatedAt = Date.now();
    renderNotice();
    saveSoon();
  });
  el("admin-retry").addEventListener("click", refreshContent);
  el("notice-edit").addEventListener("click", () => {
    switchView("ayarlar");
    setTimeout(() => {
      if (el("notice-input")) el("notice-input").focus();
    }, 120);
  });
  el("pub-check").addEventListener("click", checkLivePublish);

  el("import-team").addEventListener("click", () => openImport("team"));
  el("import-meal").addEventListener("click", () => openImport("meal"));
  document.querySelectorAll("[data-import-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      importMode = button.dataset.importMode === "meal" ? "meal" : "team";
      updateImportModeUi();
      renderImportPreview();
    });
  });
  el("import-text").addEventListener("input", () => {
    clearTimeout(importTimer);
    importTimer = setTimeout(renderImportPreview, 300);
  });
  el("import-week").addEventListener("change", () => {
    clearTimeout(importTimer);
    importTimer = setTimeout(renderImportPreview, 50);
  });
  el("import-example").addEventListener("click", () => {
    el("import-text").value = importMode === "team" ? EXAMPLE_TEAM : EXAMPLE_MEAL;
    renderImportPreview();
  });
  el("import-apply").addEventListener("click", applyImport);
  el("import-file").addEventListener("change", handleImportFile);

  el("copy-team").addEventListener("click", () => {
    const previous = state.days[addDays(selected, -1)];
    if (!previous || !previous.team.length) {
      toast("Dün için ekip kaydı yok.", true);
      return;
    }
    const day = ensureDay(selected);
    if (day.team.length) {
      toast("Bu günde zaten ekip var.", true);
      return;
    }
    day.team = previous.team.map((member) => ({ ...member, id: uid() }));
    save();
    render();
    toast("Dünkü ekip kopyalandı.");
  });

  el("forward-team").addEventListener("click", () => {
    const day = getDay(selected);
    if (!day.team.length) return;
    const nextKey = addDays(selected, 1);
    const next = state.days[nextKey];
    if (next && next.team.length) {
      toast("Yarın için zaten ekip girilmiş.", true);
      return;
    }
    const target = ensureDay(nextKey);
    target.team = day.team.map((member) => ({ ...member, id: uid() }));
    save();
    render();
    toast("Ekip yarına aktarıldı.");
  });

  el("member-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = el("m-name").value.trim();
    if (!name) {
      el("m-error").hidden = false;
      el("m-error").textContent = "Ad soyad gerekli.";
      el("m-name").focus();
      return;
    }
    const member = {
      id: editingMemberId || uid(),
      name,
      shift: el("m-shift").value,
      phone: el("m-phone").value.trim(),
      note: el("m-note").value.trim(),
    };
    const day = ensureDay(selected);
    const index = day.team.findIndex((item) => item.id === member.id);
    if (index === -1) day.team.push(member);
    else day.team[index] = member;
    save();
    render();
    closeDialog(el("member-dialog"));
    toast(index === -1 ? "Ekip üyesi eklendi." : "Ekip üyesi güncellendi.");
  });

  el("m-delete").addEventListener("click", async () => {
    const member = getDay(selected).team.find((item) => item.id === editingMemberId);
    if (!member) return;
    const ok = await askConfirm({ text: `${member.name} bu günün ekibinden çıkarılsın mı?`, ok: "Çıkar" });
    if (!ok) return;
    const day = ensureDay(selected);
    day.team = day.team.filter((item) => item.id !== member.id);
    save();
    render();
    closeDialog(el("member-dialog"));
    toast("Ekip üyesi çıkarıldı.");
  });

  el("edit-meal").addEventListener("click", openMealDialog);
  el("copy-meal").addEventListener("click", () => {
    const previous = state.days[addDays(selected, -1)];
    if (!previous || !previous.meal.text.trim()) {
      toast("Dün için menü kaydı yok.", true);
      return;
    }
    const day = ensureDay(selected);
    day.meal = { text: previous.meal.text, updatedAt: Date.now() };
    save();
    render();
    toast("Dünkü menü kopyalandı.");
  });

  el("meal-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const day = ensureDay(selected);
    day.meal = { text: el("meal-textarea").value.slice(0, 600), updatedAt: Date.now() };
    save();
    render();
    closeDialog(el("meal-dialog"));
    toast("Menü kaydedildi.");
  });

  el("note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = el("note-text").value.trim();
    if (!text) return;
    const author = el("note-author").value.trim();
    authorName = author;
    try {
      localStorage.setItem(AUTHOR_KEY, author);
    } catch (error) {
      /* yoksay */
    }
    state.notes.push({ id: uid(), text, author, ts: Date.now(), tag: el("note-tag").value, pinned: el("note-tag").value === "sabit", done: false });
    el("note-text").value = "";
    el("note-tag").value = "";
    save();
    render();
    toast("Not eklendi.");
  });

  el("note-author").addEventListener("input", () => {
    authorName = el("note-author").value.trim();
    try {
      localStorage.setItem(AUTHOR_KEY, authorName);
    } catch (error) {
      /* yoksay */
    }
  });

  el("note-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    noteFilter = button.dataset.filter;
    renderNotes();
  });

  el("directory-search").addEventListener("input", (event) => {
    directoryQuery = event.target.value;
    renderDirectory();
  });

  el("directory-chips").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group]");
    if (!button) return;
    directoryGroup = button.dataset.group;
    renderDirectory();
  });

  const phoneForm = el("phone-unlock");
  if (phoneForm) {
    phoneForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pass = el("phone-pass").value.trim();
      if (!pass) return;
      try {
        mobileMap = await decryptPhones(pass);
      } catch (error) {
        toast("Şifre yanlış.", true);
        return;
      }
      phonesPass = pass;
      phonesUnlocked = true;
      try {
        localStorage.setItem("pano-phones", pass);
      } catch (error) {
        /* depolama kapalıysa bu oturumda açık kalır */
      }
      el("phone-pass").value = "";
      renderDirectory();
    });
  }

  el("directory-edit-search").addEventListener("input", (event) => {
    directoryEditQuery = event.target.value;
    renderDirectoryEditor();
  });

  el("add-directory").addEventListener("click", () => {
    if (!ADMIN_MODE) return;
    if (state.directory.length >= 2000) {
      toast("En fazla 2000 kişi eklenebilir.", true);
      return;
    }
    state.directory.push({ id: uid(), name: "", phone: "", unit: "" });
    save();
    directoryEditQuery = "";
    if (el("directory-edit-search")) el("directory-edit-search").value = "";
    renderDirectoryEditor();
    const last = el("directory-editor").lastElementChild?.querySelector('input[data-directory="name"]');
    if (last) last.focus();
  });

  el("directory-editor").addEventListener("input", (event) => {
    if (!ADMIN_MODE) return;
    const row = event.target.closest(".directory-edit-row");
    const field = event.target.dataset.directory;
    if (!row || !field) return;
    const entry = state.directory.find((item) => item.id === row.dataset.id);
    if (!entry) return;
    entry[field] = event.target.value.slice(0, field === "name" ? 60 : field === "phone" || field === "phone2" ? 30 : field === "unit" || field === "title" ? 60 : 40);
    renderDirectory();
    saveSoon();
  });

  el("directory-editor").addEventListener("change", (event) => {
    if (!ADMIN_MODE || event.target.dataset.directory !== "group") return;
    const row = event.target.closest(".directory-edit-row");
    const entry = row && state.directory.find((item) => item.id === row.dataset.id);
    if (!entry) return;
    entry.group = event.target.value;
    renderDirectory();
    saveSoon();
  });

  el("export-data").addEventListener("click", () => {
    const payload = { app: "gunluk-pano", version: 1, exportedAt: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gunluk-pano-${todayKey()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Yedek indirildi.");
  });

  el("import-data").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    let parsed = null;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      toast("Dosya okunamadı; geçerli bir yedek değil.", true);
      return;
    }
    if (!parsed || typeof parsed !== "object" || (!parsed.days && !parsed.notes)) {
      toast("Bu dosya bir pano yedeği değil.", true);
      return;
    }
    const ok = await askConfirm({
      title: "Yedek yüklensin mi?",
      text: "Bu cihazdaki mevcut pano kayıtlarının üzerine yazılacak.",
      ok: "Yükle",
    });
    if (!ok) return;
    const next = normalizeState(parsed);
    Object.assign(state, next);
    if (parsed.settings && (parsed.settings.theme === "dark" || parsed.settings.theme === "light")) {
      applyTheme(parsed.settings.theme);
    }
    el("note-author").value = authorName;
    save();
    renderDirectoryEditor();
    render();
    toast("Yedek yüklendi.");
  });

  el("clear-board").addEventListener("click", async () => {
    const ok = await askConfirm({
      title: "Tüm veriler silinsin mi?",
      text: "Ekip, menü ve not kayıtları bu cihazdan kalıcı olarak silinir. Önce yedek almak isterseniz vazgeçin.",
      ok: "Sil",
    });
    if (!ok) return;
    const fresh = blankState();
    fresh.settings.theme = document.documentElement.dataset.theme;
    Object.assign(state, fresh);
    save();
    renderDirectoryEditor();
    render();
    toast("Tüm veriler silindi.");
  });

  el("set-title").addEventListener("input", (event) => {
    state.settings.title = event.target.value.slice(0, 40);
    renderHero();
    saveSoon();
  });

  el("set-dept").addEventListener("input", (event) => {
    state.settings.dept = event.target.value.slice(0, 40);
    renderHero();
    saveSoon();
  });

  el("confirm-ok").addEventListener("click", () => finishConfirm(true));
  el("confirm-dialog").addEventListener("close", () => finishConfirm(false));
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

  document.addEventListener("click", async (event) => {
    const goto = event.target.closest("[data-goto]");
    if (goto) {
      switchView(goto.dataset.goto);
      return;
    }

    const editMember = event.target.closest("[data-edit-member]");
    if (editMember) {
      openMemberDialog(editMember.dataset.editMember);
      return;
    }

    const deleteDirectory = event.target.closest("[data-delete-directory]");
    if (deleteDirectory) {
      if (!ADMIN_MODE) return;
      state.directory = state.directory.filter((item) => item.id !== deleteDirectory.dataset.deleteDirectory);
      save();
      renderDirectoryEditor();
      renderDirectory();
      return;
    }

    const pin = event.target.closest("[data-note-pin]");
    if (pin) {
      const note = state.notes.find((item) => item.id === pin.dataset.notePin);
      if (note) {
        note.pinned = !note.pinned;
        note.tag = note.pinned ? "sabit" : note.tag === "sabit" ? "" : note.tag;
        save();
        renderNotes();
      }
      return;
    }

    const fav = event.target.closest("[data-fav-directory]");
    if (fav) {
      if (!ADMIN_MODE) return;
      const entry = state.directory.find((item) => item.id === fav.dataset.favDirectory);
      if (entry) {
        entry.fav = !entry.fav;
        save();
        renderDirectoryEditor();
        renderDirectory();
      }
      return;
    }

    const done = event.target.closest("[data-note-done]");
    if (done) {
      const note = state.notes.find((item) => item.id === done.dataset.noteDone);
      if (note) {
        note.done = !note.done;
        save();
        renderNotes();
      }
      return;
    }

    const remove = event.target.closest("[data-note-delete]");
    if (remove) {
      const note = state.notes.find((item) => item.id === remove.dataset.noteDelete);
      if (!note) return;
      const ok = await askConfirm({ text: "Bu not silinsin mi?", ok: "Sil" });
      if (!ok) return;
      state.notes = state.notes.filter((item) => item.id !== note.id);
      save();
      renderNotes();
      toast("Not silindi.");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key >= "1" && event.key <= "4") {
      switchView(VIEWS[Number(event.key) - 1]);
      return;
    }
    if (event.key.toLowerCase() === "n" && ADMIN_MODE) {
      switchView("notlar");
      setTimeout(() => el("note-text").focus(), 40);
      return;
    }
    if (event.key === "ArrowLeft") changeDay(-1);
    if (event.key === "ArrowRight") changeDay(1);
  });

  window.addEventListener("focus", () => {
    if (document.activeElement && document.activeElement.closest("dialog")) return;
    renderHero();
  });
}

function applyTheme(theme, persist = true) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (error) {
      /* yoksay */
    }
  }
  el("set-theme").value = value;
  el("theme-toggle").setAttribute("aria-label", value === "dark" ? "Aydınlık temaya geç" : "Gece temasına geç");
}

/* ---------- Başlangıç ---------- */
async function init() {
  applyMode();
  if (phonesPass) {
    try {
      mobileMap = await decryptPhones(phonesPass);
      phonesUnlocked = true;
    } catch (error) {
      phonesPass = null;
      try {
        localStorage.removeItem("pano-phones");
      } catch (ignore) {
        /* yoksay */
      }
    }
  }
  fillSelect(el("m-shift"), SHIFTS);
  applyTheme(document.documentElement.dataset.theme, false);
  el("note-author").value = authorName;
  if (ADMIN_MODE) {
    renderDirectoryEditor();
    fillPublishFields();
    fillOcrField();
  }
  bindEvents();
  if (ADMIN_MODE) bindAdminEvents();
  switchView(currentView);
  render();
  await loadContent();
  applySharedHash();

  let bootDay = activeDayKey();
  setInterval(() => {
    const active = activeDayKey();
    if (active === bootDay) return;
    const wasActive = selected === bootDay;
    bootDay = active;
    renderModality();
    if (wasActive) {
      setDate(active);
      toast(`Yeni gün: ${longDate(active)}`);
    }
  }, 30000);

  setInterval(() => {
    if (!ADMIN_MODE && document.visibilityState === "visible") loadContent({ quiet: true });
  }, 300000);

  if (!PREVIEW && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* çevrimdışı destek yoksa uygulama yine çalışır */
    });
    // Yeni sürüm devralınca bir kez yenile; yoksa eski kod açık kalır.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("pano-reloaded")) return;
      sessionStorage.setItem("pano-reloaded", "1");
      location.reload();
    });
    window.addEventListener("load", () => sessionStorage.removeItem("pano-reloaded"));
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
