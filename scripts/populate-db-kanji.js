import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

import Database from "better-sqlite3";

/**
 * Resolve a Make Me A Hanzi data file that may live either at:
 *   assets/makemeahanzi/<root>/<name>
 * or
 *   assets/makemeahanzi/<root>/data/<name>
 */
async function resolveMmhzFile(name) {
  const root = fileURLToPath(import.meta.resolve("../assets/makemeahanzi"));
  const entries = await fs.readdir(root);
  const dir = entries.find((n) => /^makemeahanzi-/.test(n));
  if (!dir) throw new Error("makemeahanzi root not found");
  const base = `${root}/${dir}`;
  const candidates = [`${base}/${name}`, `${base}/data/${name}`];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }
  throw new Error(`Cannot find ${name} under ${base} or ${base}/data`);
}

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// Recreate tables (schema identical to original project)
db.exec(`DROP TABLE IF EXISTS kanji`);
db.exec(`
  CREATE TABLE kanji (
    codepoint INTEGER PRIMARY KEY,
    literal TEXT NOT NULL,
    radical INTEGER,
    freq INTEGER,
    grade TEXT,
    stroke_count INTEGER
  )
`);

db.exec(`DROP TABLE IF EXISTS kanji_readings`);
db.exec(`
  CREATE TABLE kanji_readings (
    kanji INTEGER REFERENCES kanji (codepoint) NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    seq INTIGER,
    PRIMARY KEY (kanji ASC, type, seq)
  )
`);

db.exec(`DROP TABLE IF EXISTS kanji_meanings`);
db.exec(`
  CREATE TABLE kanji_meanings (
    kanji INTEGER REFERENCES kanji (codepoint) NOT NULL,
    text TEXT NOT NULL,
    seq INTEGER NOT NULL,
    PRIMARY KEY (kanji ASC, seq)
  )
`);

const insertKanji = db.prepare(`
  INSERT INTO kanji (codepoint, literal, radical, grade, freq, stroke_count)
  VALUES (@codepoint, @literal, @radical, @grade, @freq, @strokeCount)
`);

const insertKanjiReading = db.prepare(`
  INSERT INTO kanji_readings (kanji, type, text, seq)
  VALUES (@codepoint, @type, @reading, @seq)
`);

const insertKanjiMeaning = db.prepare(`
  INSERT INTO kanji_meanings (kanji, text, seq)
  VALUES (@codepoint, @meaning, @seq)
`);

// Load radicals map (literal -> radical number) from assets/radicals.csv
const radicalsMap = new Map();
{
  const url = new URL("../assets/radicals.csv", import.meta.url);
  const txt = await fs.readFile(url, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [numStr, chars] = line.split(",");
    const num = Number.parseInt(numStr, 10);
    if (!Number.isFinite(num)) continue;
    for (const ch of chars ?? "") {
      if (ch) radicalsMap.set(ch, num);
    }
  }
}

// Stroke data from Make Me A Hanzi graphics.txt
const mmhzGraphics = new Map(); // char -> { strokes: [] }
{
  const path = await resolveMmhzFile("graphics.txt");
  const rl = readline.createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    const ch = obj.character;
    mmhzGraphics.set(ch, obj);
  }
}

// Dictionary from Make Me A Hanzi: pinyin, definition, radical char
const mmhzDict = new Map(); // char -> { definition?: string, pinyin?: string[], radical?: string }
{
  const path = await resolveMmhzFile("dictionary.txt");
  const rl = readline.createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    const ch = obj.character;
    const entry = {
      definition: obj.definition,
      pinyin: obj.pinyin,
      radical: obj.radical,
    };
    mmhzDict.set(ch, entry);
  }
}

// CEDICT single-character entries to enrich pinyin + meanings
const cedictSingle = new Map(); // char -> { pinyin: Set<string>, meanings: string[] }
{
  const url = new URL("../assets/cedict_ts.u8", import.meta.url);
  const rl = readline.createInterface({
    input: createReadStream(url, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || line.startsWith("#")) continue;
    // trad simp [PINYIN] /m1/m2/...
    const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+?)\/\s*$/);
    if (!m) continue;
    const [, trad, simp, py, defsRaw] = m;
    const defs = defsRaw.split("/").map((s) => s.trim()).filter(Boolean);
    const pushChar = (c) => {
      if ([...c].length !== 1) return;
      const prev =
        cedictSingle.get(c) ?? ({ pinyin: new Set(), meanings: [] });
      prev.pinyin.add(py);
      for (const d of defs) {
        if (prev.meanings.length < 5) prev.meanings.push(d);
      }
      cedictSingle.set(c, prev);
    };
    pushChar(trad);
    pushChar(simp);
  }
}

// Frequency ranking from your CSV
const freqRank = new Map(); // char -> rank
{
  const url = new URL("../assets/frequency.csv", import.meta.url);
  const rl = readline.createInterface({
    input: createReadStream(url, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || line.startsWith("/*")) continue;
    const parts = line.split(",");
    if (parts.length < 2) continue;
    const rank = Number.parseInt(parts[0], 10);
    const ch = parts[1]?.trim();
    if (Number.isFinite(rank) && ch && [...ch].length === 1) {
      freqRank.set(ch, rank);
    }
  }
}

// HSK 3.0 list (characters), include them all
const hskChars = new Set();
{
  const url = new URL("../assets/hsk30.txt", import.meta.url);
  const txt = await fs.readFile(url, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || /汉字表/.test(line)) continue;
    const m = line.match(/^\s*\d+\s+(\S)\s*$/);
    if (m) hskChars.add(m[1]);
  }
}

// Universe of chars to insert
const chars = new Set([
  ...mmhzGraphics.keys(),
  ...cedictSingle.keys(),
  ...hskChars,
]);

// Insert all rows
const toCode = (ch) => ch.codePointAt(0) ?? 0;

for (const ch of chars) {
  const codepoint = toCode(ch);
  const graphics = mmhzGraphics.get(ch);
  const dict = mmhzDict.get(ch);
  const ced = cedictSingle.get(ch);

  const strokeCount = graphics?.strokes?.length ?? null;

  // Try to identify a radical number:
  // - prefer the radical literal that MMHZ dictionary gives (e.g. "氵")
  // - else try direct mapping on the char itself
  let radicalNumber = null;
  if (dict?.radical && radicalsMap.has(dict.radical)) {
    radicalNumber = radicalsMap.get(dict.radical);
  } else if (radicalsMap.has(ch)) {
    radicalNumber = radicalsMap.get(ch);
  }

  const freq = freqRank.get(ch) ?? null;

  insertKanji.run({
    codepoint,
    literal: ch,
    radical: radicalNumber ?? null,
    grade: null,
    freq,
    strokeCount,
  });

  // readings: store pinyin in "on" to minimize front-end changes
  {
    const pinyins = new Set();
    if (Array.isArray(dict?.pinyin)) {
      for (const p of dict.pinyin) if (p) pinyins.add(p);
    }
    if (ced?.pinyin) for (const p of ced.pinyin) pinyins.add(p);

    let seq = 0;
    for (const py of pinyins) {
      seq += 1;
      insertKanjiReading.run({
        codepoint,
        type: "on",
        reading: py,
        seq,
      });
    }
  }

  // meanings: prefer CEDICT (first few), else MMHZ definition
  {
    const meanings = [];
    if (ced?.meanings?.length) meanings.push(...ced.meanings);
    else if (dict?.definition) meanings.push(dict.definition);
    if (meanings.length === 0) meanings.push("—");

    let seq = 0;
    for (const m of meanings) {
      seq += 1;
      insertKanjiMeaning.run({ codepoint, meaning: m, seq });
    }
  }
}