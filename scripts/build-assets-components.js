import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

import Database from "better-sqlite3";

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));

const UNIT_SEP = "\u{241f}";   // ␟
const RECORD_SEP = "\u{241e}"; // ␞

// 1) stroke counts dal DB (ordinamenti)
const strokeCounts = new Map();
{
  const rows = db.prepare("SELECT literal, stroke_count FROM kanji").all();
  for (const r of rows) strokeCounts.set(r.literal, r.stroke_count ?? 0);
}

// 2) radicals.csv (solo metadati se combacia col literal)
const radicalsInfo = new Map(); // literal -> { number, en, jp }
{
  const url = new URL("../assets/radicals.csv", import.meta.url);
  const txt = await fs.readFile(url, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [numStr, chars, , en, jp] = line.split(/\s*,\s*/);
    const info = { number: Number.parseInt(numStr, 10), en, jp };
    if (!Number.isFinite(info.number)) continue;
    for (const ch of chars ?? "") radicalsInfo.set(ch, info);
  }
}

// 3) trova ids.txt
async function resolveMmhzFile(name) {
  const root = fileURLToPath(import.meta.resolve("../assets/makemeahanzi"));
  const dir = (await fs.readdir(root)).find((n) => /^makemeahanzi-/.test(n));
  if (!dir) throw new Error("makemeahanzi root not found");
  const base = `${root}/${dir}`;
  const candidates = [`${base}/${name}`, `${base}/data/${name}`];
  for (const p of candidates) { try { await fs.access(p); return p; } catch {} }
  throw new Error(`Cannot find ${name} under ${base} or ${base}/data`);
}

// 4) util: U+XXXX -> char
function decodeUPlus(token) {
  const m = token.match(/^U\+([0-9A-Fa-f]{4,6})$/);
  if (!m) return token;
  const cp = parseInt(m[1], 16);
  try { return String.fromCodePoint(cp); } catch { return token; }
}

// 5) IDS operator presente?
const IDS_OP_RE = /[\u2FF0-\u2FFB]/;
function hasIDSOperator(str) { return IDS_OP_RE.test(str); }

// 6) componente valido (Han + radicals + kangxi + compat)
function isLikelyComponentChar(ch) {
  const cp = ch.codePointAt(0);
  if (!cp) return false;
  return (
    (cp >= 0x4E00 && cp <= 0x9FFF) ||
    (cp >= 0x3400 && cp <= 0x4DBF) ||
    (cp >= 0x20000 && cp <= 0x2A6DF) ||
    (cp >= 0x2A700 && cp <= 0x2B73F) ||
    (cp >= 0x2B740 && cp <= 0x2B81F) ||
    (cp >= 0x2B820 && cp <= 0x2CEAF) ||
    (cp >= 0x2E80 && cp <= 0x2EFF) ||
    (cp >= 0x2F00 && cp <= 0x2FD5) ||
    (cp >= 0xF900 && cp <= 0xFAFF)
  );
}

// 7) costruisci mappa: kanji -> Set(componenti)
const componentsOf = new Map();
{
  const path = await resolveMmhzFile("ids.txt");
  const rl = readline.createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // ids.txt (CJKVI) è in genere "U+XXXX<TAB>字<TAB>IDS"
    // prendiamo sempre 3 colonne se presenti; altrimenti ripieghiamo sugli spazi.
    let cols = line.split("\t");
    if (cols.length < 2) cols = line.split(/\s+/);

    const head = cols[0];
    const col2 = cols[1] ?? "";
    const col3 = cols[2] ?? "";

    const literal = decodeUPlus(head);
    // preferisci la 3ª colonna (IDS); se assente usa la 2ª (ma di solito è solo il char base)
    const ids = col3 || col2 || "";
    if (!ids || !hasIDSOperator(ids)) continue;

    const set = componentsOf.get(literal) ?? new Set();

    // estrai terminali scorrendo i codepoint
    for (const t of ids) {
      if (!isLikelyComponentChar(t)) continue;
      if (t === literal) continue;
      set.add(t);
    }

    if (set.size > 0) componentsOf.set(literal, set);
  }
}

// 8) indice inverso: componente -> lista di kanji
const kanjiOfComponent = new Map();
for (const [kanji, comps] of componentsOf) {
  for (const comp of comps) {
    let s = kanjiOfComponent.get(comp);
    if (!s) { s = new Set(); kanjiOfComponent.set(comp, s); }
    s.add(kanji);
  }
}

// 9) salva JSON per ogni componente
await fs.mkdir(new URL("../public/data/components-v1", import.meta.url), { recursive: true });

for (const [literal, kanjiSet] of kanjiOfComponent) {
  const info = radicalsInfo.get(literal);
  const bySC = new Map();
  for (const k of kanjiSet) {
    const sc = strokeCounts.get(k) ?? 0;
    if (!bySC.has(sc)) bySC.set(sc, []);
    bySC.get(sc).push(k);
  }
  // ordina per sc, poi per char
  const ordered = [...bySC.entries()]
    .sort(([a],[b]) => a - b)
    .map(([sc, arr]) => [sc, arr.sort((a,b)=>a.localeCompare(b))]);

  const payload = {
    literal,
    radical: info ? { original: literal, number: info.number, en: info.en, jp: info.jp } : undefined,
    meaning: info?.en,
    reading: undefined,
    strokeCount: strokeCounts.get(literal) ?? undefined,
    variations: undefined,
    variationOf: undefined,
    kanji: Object.fromEntries(ordered),
  };

  const hex = [...literal][0].codePointAt(0).toString(16).padStart(5, "0");
  const file = new URL(`../public/data/components-v1/${hex}.json`, import.meta.url);
  await fs.writeFile(file, JSON.stringify(payload));
}

// 10) index radicals-kanji (solo radicali classici, se presenti)
await fs.mkdir(new URL("../public/data/index", import.meta.url), { recursive: true });

{
  const fileURL = new URL(`../public/data/index/radicals-kanji-v1.usv`, import.meta.url);
  const out = [];
  for (const [literal, info] of radicalsInfo) {
    const sc = strokeCounts.get(literal) ?? 0;
    const kanji = kanjiOfComponent.get(literal);
    const kanjiLiterals = kanji ? [...kanji].join("") : "";
    out.push(`${literal}${UNIT_SEP}${sc}${RECORD_SEP}${kanjiLiterals}${RECORD_SEP}${RECORD_SEP}\n`);
  }
  await fs.writeFile(fileURL, out.join(""));
}

// 11) index kanji-radicals (ora usa SEMPRE i literal reali in prima colonna)
{
  const fileURL = new URL(`../public/data/index/kanji-radicals-v1.usv`, import.meta.url);
  const out = [];
  for (const [kanji, comps] of componentsOf) {
    const sc = strokeCounts.get(kanji) ?? 0;
    const list = [...comps]
      .sort((a, b) => (strokeCounts.get(a) ?? 1e9) - (strokeCounts.get(b) ?? 1e9) || a.localeCompare(b))
      .join("");
    out.push(`${kanji}${UNIT_SEP}${sc}${RECORD_SEP}${list}${RECORD_SEP}${RECORD_SEP}\n`);
  }
  await fs.writeFile(fileURL, out.join(""));
}

console.log(`componentsOf size = ${componentsOf.size}`);