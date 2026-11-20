// tools/cep_yedek.json'daki cep numaralarini AES-GCM ile sifreler, phones.enc uretir.
// Sifre komut satirindan veya PANOPASS ortam degiskeninden gelir; kodda saklanmaz.
// Kullanim: node tools/encrypt_phones.mjs "yeni-sifre"
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const PASS = process.argv[2] || process.env.PANOPASS;
if (!PASS) {
  console.error('Sifre gerekli: node tools/encrypt_phones.mjs "sifre"');
  process.exit(1);
}
const ITERATIONS = 100000;
const enc = new TextEncoder();

const b64 = (bytes) => Buffer.from(bytes).toString("base64");

const rows = JSON.parse(readFileSync("tools/cep_yedek.json", "utf8"));
const map = {};
for (const row of rows) map[row.id] = row.mobile;

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const baseKey = await webcrypto.subtle.importKey("raw", enc.encode(PASS), "PBKDF2", false, ["deriveKey"]);
const aesKey = await webcrypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  baseKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"],
);
const cipher = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(JSON.stringify(map)));

const out = { v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(cipher) };
writeFileSync("phones.enc", JSON.stringify(out), "utf8");
console.log(`phones.enc yazildi: ${rows.length} cep numarasi sifrelendi`);