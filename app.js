/* Günün Panosu — radyoloji günlük pano.
   Bağımlılıksız, tek sayfa; tüm veri tarayıcının localStorage alanında kalır. */
"use strict";

/* ---------- Sabitler ---------- */
const KEY = "rad-pano-v1";
const THEME_KEY = "pano-theme";
const VIEW_KEY = "pano-view";
const SHIFT_KEY = "nobet-listesi-static-v1";
const SHIFT_DEVICES = ["MR", "BT", "RÖNT-PORT", "RÖNTGEN", "RÖNT-MAMO"];
const ROLES = ["Radyolog", "Asistan radyolog", "Teknisyen", "Hemşire", "Sekreter", "Fizikçi", "Öğrenci", "Diğer"];
const SHIFTS = ["08–16", "16–24", "24–08", "İcap", "İdari", "İzinli"];
const VIEWS = ["ekip", "yemek", "notlar", "ayarlar"];
const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const WEEKDAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const ICON_EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" /></svg>';
const ICON_PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 5 3 3-4 1-1.5 7L10 13l-4-1 3-3-1-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7l-1.1 1.1M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>';

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

function longDate(key) {
  const date = parseKey(key);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
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
function blankState() {
  return {
    v: 1,
    settings: { title: "Günün Panosu", dept: "Radyoloji", theme: "light" },
    links: [
      { id: "pacs", label: "PACS", url: "" },
      { id: "grup", label: "Ekip grubu", url: "" },
    ],
    days: {},
    notes: [],
    author: "",
    updatedAt: 0,
  };
}

function normalizeLink(raw) {
  if (!raw || typeof raw !== "object") return null;
  const label = str(raw.label, "", 30).trim();
  if (!label) return null;
  return { id: str(raw.id, uid(), 60), label, url: str(raw.url, "", 300).trim() };
}

function normalizeMember(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name, "", 60).trim();
  if (!name) return null;
  return {
    id: str(raw.id, uid(), 60),
    name,
    role: str(raw.role, "", 30).trim(),
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
  return {
    id: str(raw.id, uid(), 60),
    text,
    author: str(raw.author, "", 40).trim(),
    ts: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    pinned: Boolean(raw.pinned),
    done: Boolean(raw.done),
  };
}

function normalizeDay(raw) {
  const day = { team: [], meal: { text: "", updatedAt: 0 } };
  if (!raw || typeof raw !== "object") return day;
  if (Array.isArray(raw.team)) {
    day.team = raw.team.map(normalizeMember).filter(Boolean).slice(0, 40);
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
    if (raw.settings.theme === "dark" || raw.settings.theme === "light") state.settings.theme = raw.settings.theme;
  }
  state.author = str(raw.author, "", 40).trim();

  if (Array.isArray(raw.links)) {
    state.links = raw.links.map(normalizeLink).filter(Boolean).slice(0, 12);
  }

  if (raw.days && typeof raw.days === "object") {
    for (const [date, day] of Object.entries(raw.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      state.days[date] = normalizeDay(day);
    }
  }

  if (Array.isArray(raw.notes)) {
    state.notes = raw.notes.map(normalizeNote).filter(Boolean).slice(0, 300);
  }

  const updated = Number(raw.updatedAt);
  state.updatedAt = Number.isFinite(updated) && updated > 0 ? updated : 0;
  return state;
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return blankState();
  }
}

const state = loadState();
let selected = todayKey();
try {
  const savedDate = sessionStorage.getItem("pano-date");
  if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate)) selected = savedDate;
} catch (error) {
  /* depolama kapalıysa bugünle devam */
}
let noteFilter = "all";
let editingMemberId = null;
let saveTimer = null;

function prune() {
  for (const [date, day] of Object.entries(state.days)) {
    const empty = !day.team.length && !day.meal.text.trim();
    if (empty) delete state.days[date];
  }
}

function save() {
  state.updatedAt = Date.now();
  prune();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    toast("Kayıt yapılamadı: tarayıcı depolaması dolu ya da kapalı.", true);
  }
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save();
    renderSettings();
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
function renderBrand() {
  el("brand-title").textContent = state.settings.title || "Günün Panosu";
  el("brand-dept").textContent = state.settings.dept || "Radyoloji";
  document.title = `${state.settings.title || "Günün Panosu"} · ${state.settings.dept || "Radyoloji"}`;
}

function renderDate() {
  const isToday = selected === todayKey();
  const relative = isToday ? "Bugün" : selected === addDays(todayKey(), 1) ? "Yarın" : selected === addDays(todayKey(), -1) ? "Dün" : "";
  el("date-title").textContent = longDate(selected);
  el("date-sub").textContent = [weekdayOf(selected), relative].filter(Boolean).join(" · ");
  el("date-input").value = selected;
  const team = getDay(selected).team.length;
  el("team-hint").textContent = team ? `${team} kişi görevli` : "Vardiyaya göre kimler var?";
}

function renderWeekstrip() {
  const monday = parseKey(selected);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const chips = [];
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = keyOf(date);
    const has = Boolean(state.days[key] && (state.days[key].team.length || state.days[key].meal.text.trim()));
    const classes = ["chip"];
    if (key === todayKey()) classes.push("is-today");
    if (key === selected) classes.push("is-active");
    chips.push(
      `<button class="${classes.join(" ")}" type="button" data-date="${key}" aria-label="${esc(longDate(key))} ${esc(weekdayOf(key))}"${key === selected ? ' aria-current="date"' : ""}>
        <span>${WEEKDAYS_SHORT[date.getDay()]}</span>
        <b>${date.getDate()}</b>
        <span class="dot"${has ? "" : ' style="opacity:0"'} aria-hidden="true"></span>
      </button>`,
    );
  }
  el("weekstrip").innerHTML = chips.join("");
  const active = el("weekstrip").querySelector(".is-active");
  if (active && typeof active.scrollIntoView === "function") active.scrollIntoView({ block: "nearest", inline: "center" });
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
      <div class="person-name">${esc(member.name)}${member.role ? `<span class="role">${esc(member.role)}</span>` : ""}</div>
      ${meta.length ? `<div class="person-meta">${meta.join("")}</div>` : ""}
    </div>
    <div class="person-actions">
      <button class="mini-btn" type="button" data-edit-member="${esc(member.id)}" aria-label="${esc(member.name)} bilgilerini düzenle" title="Düzenle">${ICON_EDIT}</button>
    </div>
  </article>`;
}

function sortTeam(team) {
  const order = (shift) => {
    const index = SHIFTS.indexOf(shift);
    return index === -1 ? SHIFTS.length : index;
  };
  return [...team].sort((a, b) => order(a.shift) - order(b.shift) || a.name.localeCompare(b.name, "tr"));
}

function renderTeam() {
  const day = getDay(selected);
  const team = sortTeam(day.team);
  const count = el("team-count");
  count.hidden = !team.length;
  count.textContent = team.length ? `${team.length} kişi` : "";

  if (!team.length) {
    el("team-list").innerHTML = `<div class="empty"><strong>Bugün için ekip girilmemiş</strong>Vardiyadaki isimleri ekleyin; ertesi gün tek tuşla kopyalayabilirsiniz.</div>`;
  } else {
    const parts = [];
    let lastShift = null;
    for (const member of team) {
      if (member.shift !== lastShift) {
        parts.push(`<div class="group-label">${esc(member.shift || "Diğer")}</div>`);
        lastShift = member.shift;
      }
      parts.push(personHtml(member));
    }
    el("team-list").innerHTML = parts.join("");
  }

  el("sync-shift").hidden = !readShiftTeam(selected);
  el("forward-team").hidden = !team.length;
}

function renderMeal() {
  const day = getDay(selected);
  const text = day.meal.text.trim();
  el("meal-pill").hidden = !text;
  el("meal-pill").textContent = text ? "Girildi" : "";
  el("meal-body").innerHTML = text
    ? `<p class="meal-text">${esc(text)}</p>${day.meal.updatedAt ? `<p class="meal-updated">Son güncelleme: ${esc(formatStamp(day.meal.updatedAt))}</p>` : ""}`
    : `<div class="empty"><strong>Menü girilmemiş</strong>Yemekhanenin menüsünü yazın; dünkü menüyü tek tuşla kopyalayabilirsiniz.</div>`;
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
  return `<article class="${classes.join(" ")}">
    <div class="note-header">
      <span class="note-author">${esc(note.author || "Ekip")}</span>
      <span class="note-time">${esc(formatStamp(note.ts))}</span>
    </div>
    <div class="note-text">${esc(note.text)}</div>
    <div class="note-actions">
      <button class="mini-btn${note.pinned ? " is-on" : ""}" type="button" data-note-pin="${esc(note.id)}" aria-label="${note.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}" title="${note.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}" aria-pressed="${note.pinned}">${ICON_PIN}</button>
      <button class="mini-btn${note.done ? " is-on" : ""}" type="button" data-note-done="${esc(note.id)}" aria-label="${note.done ? "Açık olarak işaretle" : "Tamamlandı olarak işaretle"}" title="${note.done ? "Açık olarak işaretle" : "Tamamlandı"}" aria-pressed="${note.done}">${ICON_CHECK}</button>
      <button class="mini-btn" type="button" data-note-delete="${esc(note.id)}" aria-label="Notu sil" title="Sil">${ICON_TRASH}</button>
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
      pinned: "Sabitlenen not yok.",
      open: "Açık not yok; her şey tamam.",
    };
    el("note-list").innerHTML = `<div class="empty"><strong>${notes.length ? "" : "Liste boş"}</strong>${messages[noteFilter]}</div>`;
  } else {
    el("note-list").innerHTML = notes.map(noteHtml).join("");
  }
  const open = state.notes.filter((note) => !note.done).length;
  const badge = el("badge-notlar");
  badge.hidden = !open;
  badge.textContent = open > 9 ? "9+" : String(open);
}

function renderLinks() {
  const links = state.links.filter((link) => link.url);
  const chips = links
    .map(
      (link) => `<a class="link-chip" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
        ${ICON_LINK}<span>${esc(link.label)}</span>
      </a>`,
    )
    .join("");
  el("quick-links").innerHTML = chips + `<button class="link-chip is-empty" type="button" data-goto="ayarlar">+ Bağlantı ekle</button>`;
}

function renderLinkEditor() {
  el("link-editor").innerHTML = state.links
    .map(
      (link) => `<div class="link-row" data-id="${esc(link.id)}">
        <input data-link="label" type="text" maxlength="30" value="${esc(link.label)}" placeholder="Ad (PACS)" aria-label="Bağlantı adı" />
        <input data-link="url" type="url" maxlength="300" value="${esc(link.url)}" placeholder="https://…" aria-label="Bağlantı adresi" inputmode="url" />
        <button class="mini-btn" type="button" data-delete-link="${esc(link.id)}" aria-label="${esc(link.label)} bağlantısını sil" title="Sil">${ICON_TRASH}</button>
      </div>`,
    )
    .join("");
}

function renderSettings() {
  const titleInput = el("set-title");
  const deptInput = el("set-dept");
  if (document.activeElement !== titleInput) titleInput.value = state.settings.title;
  if (document.activeElement !== deptInput) deptInput.value = state.settings.dept;
  el("set-theme").value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  renderStats();
  const saved = state.updatedAt ? new Date(state.updatedAt) : null;
  el("version-note").textContent = saved ? `Son kayıt: ${formatStamp(state.updatedAt)} · Sürüm 1.0` : "Sürüm 1.0 · Henüz kayıt yok";
  el("badge-ekip").hidden = !getDay(selected).team.length;
  el("badge-ekip").textContent = String(getDay(selected).team.length);
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
  currentView = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.view === view);
  });
  renderTabs();
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
  renderBrand();
  renderDate();
  renderWeekstrip();
  renderTeam();
  renderMeal();
  renderNotes();
  renderLinks();
  renderSettings();
}

/* ---------- Nöbet listesinden aktarma ---------- */
function readShiftTeam(dateKey) {
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
      if (name) list.push({ name, role: "Radyolog", shift: "08–16", note: SHIFT_DEVICES[index] || "" });
    });
    (Array.isArray(day.evening) ? day.evening : []).forEach((id) => {
      const name = nameOf(id);
      if (name) list.push({ name, role: "Radyolog", shift: "16–24", note: "Akşam" });
    });
    (Array.isArray(day.night) ? day.night : []).forEach((id) => {
      const name = nameOf(id);
      if (name) list.push({ name, role: "Radyolog", shift: "24–08", note: "Gece" });
    });
    return list.length ? list : null;
  } catch (error) {
    return null;
  }
}

function importShiftTeam() {
  const list = readShiftTeam(selected);
  if (!list || !list.length) {
    toast("Bu tarih için nöbet listesi bulunamadı.", true);
    return;
  }
  const day = ensureDay(selected);
  let added = 0;
  for (const person of list) {
    const exists = day.team.some((member) => member.name === person.name && member.shift === person.shift);
    if (exists) continue;
    day.team.push({ id: uid(), name: person.name, role: person.role, shift: person.shift, phone: "", note: person.note });
    added += 1;
  }
  if (!added) {
    toast("Ekipte bu kişiler zaten var.");
    return;
  }
  save();
  render();
  toast(`${added} kişi nöbet listesinden eklendi.`);
}

/* ---------- Paylaşım ---------- */
function buildShareText() {
  const day = getDay(selected);
  const lines = [`${state.settings.dept || "Radyoloji"} · ${longDate(selected)} ${weekdayOf(selected)}`, "", "GÜNÜN EKİBİ"];
  const team = sortTeam(day.team);
  if (team.length) {
    for (const member of team) {
      const extras = [member.role, member.phone ? `tel: ${member.phone}` : "", member.note].filter(Boolean).join(" · ");
      lines.push(`• ${member.shift || "—"} · ${member.name}${extras ? ` (${extras})` : ""}`);
    }
  } else {
    lines.push("• Henüz girilmedi");
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
  if (!/^https?:$/.test(location.protocol)) return "";
  const day = getDay(selected);
  const payload = {
    v: 1,
    date: selected,
    team: day.team.map((member) => ({ name: member.name, role: member.role, shift: member.shift, phone: member.phone, note: member.note })),
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
    if (day.team.some((item) => item.name === member.name && item.shift === member.shift)) continue;
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

/* ---------- Diyaloglar ---------- */
let confirmResolver = null;
function askConfirm({ title = "Emin misiniz?", text = "", ok = "Sil" } = {}) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    el("confirm-title").textContent = title;
    el("confirm-text").textContent = text;
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
  editingMemberId = memberId || null;
  const member = memberId ? getDay(selected).team.find((item) => item.id === memberId) : null;
  el("member-title").textContent = member ? "Ekip üyesini düzenle" : "Ekip üyesi ekle";
  el("m-name").value = member ? member.name : "";
  el("m-role").value = member && member.role ? member.role : ROLES[0];
  el("m-shift").value = member && member.shift ? member.shift : SHIFTS[0];
  el("m-phone").value = member ? member.phone : "";
  el("m-note").value = member ? member.note : "";
  el("m-error").hidden = true;
  el("m-delete").hidden = !member;
  openDialog(el("member-dialog"));
  setTimeout(() => el("m-name").focus(), 60);
}

function openMealDialog() {
  el("meal-textarea").value = getDay(selected).meal.text;
  openDialog(el("meal-dialog"));
  setTimeout(() => el("meal-textarea").focus(), 60);
}

/* ---------- Olaylar ---------- */
function bindEvents() {
  el("prev-day").addEventListener("click", () => changeDay(-1));
  el("next-day").addEventListener("click", () => changeDay(1));
  el("date-input").addEventListener("change", (event) => {
    if (event.target.value) setDate(event.target.value);
  });

  el("weekstrip").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-date]");
    if (chip) setDate(chip.dataset.date);
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

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

  el("edit-links").addEventListener("click", () => {
    switchView("ayarlar");
    setTimeout(() => {
      const box = el("link-editor");
      if (box && typeof box.scrollIntoView === "function") box.scrollIntoView({ block: "center" });
    }, 80);
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
      role: el("m-role").value,
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
    state.author = author;
    state.notes.push({ id: uid(), text, author, ts: Date.now(), pinned: el("note-pin").checked, done: false });
    el("note-text").value = "";
    el("note-pin").checked = false;
    save();
    render();
    toast("Not eklendi.");
  });

  el("note-author").addEventListener("input", () => {
    state.author = el("note-author").value.trim();
    saveSoon();
  });

  el("note-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    noteFilter = button.dataset.filter;
    renderNotes();
  });

  el("add-link").addEventListener("click", () => {
    if (state.links.length >= 12) {
      toast("En fazla 12 bağlantı eklenebilir.", true);
      return;
    }
    state.links.push({ id: uid(), label: "", url: "" });
    save();
    renderLinkEditor();
    const last = el("link-editor").lastElementChild?.querySelector('input[data-link="label"]');
    if (last) last.focus();
  });

  el("link-editor").addEventListener("input", (event) => {
    const row = event.target.closest(".link-row");
    const field = event.target.dataset.link;
    if (!row || !field) return;
    const link = state.links.find((item) => item.id === row.dataset.id);
    if (!link) return;
    link[field] = event.target.value.slice(0, field === "url" ? 300 : 30);
    renderLinks();
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
    el("note-author").value = state.author || "";
    save();
    renderLinkEditor();
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
    renderLinkEditor();
    render();
    toast("Tüm veriler silindi.");
  });

  el("set-title").addEventListener("input", (event) => {
    state.settings.title = event.target.value.slice(0, 40);
    renderBrand();
    saveSoon();
  });

  el("set-dept").addEventListener("input", (event) => {
    state.settings.dept = event.target.value.slice(0, 40);
    renderBrand();
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

    const deleteLink = event.target.closest("[data-delete-link]");
    if (deleteLink) {
      state.links = state.links.filter((link) => link.id !== deleteLink.dataset.deleteLink);
      save();
      renderLinkEditor();
      renderLinks();
      return;
    }

    const pin = event.target.closest("[data-note-pin]");
    if (pin) {
      const note = state.notes.find((item) => item.id === pin.dataset.notePin);
      if (note) {
        note.pinned = !note.pinned;
        save();
        renderNotes();
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
    if (event.key.toLowerCase() === "n") {
      switchView("notlar");
      setTimeout(() => el("note-text").focus(), 40);
      return;
    }
    if (event.key === "ArrowLeft") changeDay(-1);
    if (event.key === "ArrowRight") changeDay(1);
  });

  window.addEventListener("focus", () => {
    if (document.activeElement && document.activeElement.closest("dialog")) return;
    renderDate();
  });
}

function applyTheme(theme) {
  const value = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = value;
  state.settings.theme = value;
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch (error) {
    /* yoksay */
  }
  el("set-theme").value = value;
  el("theme-toggle").setAttribute("aria-label", value === "dark" ? "Aydınlık temaya geç" : "Gece temasına geç");
}

/* ---------- Başlangıç ---------- */
function init() {
  fillSelect(el("m-role"), ROLES);
  fillSelect(el("m-shift"), SHIFTS);
  applyTheme(document.documentElement.dataset.theme);
  el("note-author").value = state.author || "";
  renderLinkEditor();
  bindEvents();
  switchView(currentView);
  render();
  applySharedHash();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* çevrimdışı destek yoksa uygulama yine çalışır */
    });
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
