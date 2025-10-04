import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

import Database from "better-sqlite3";

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// Recreate tables (same names as original)
db.exec("DROP TABLE IF EXISTS words");
db.exec("CREATE TABLE words (id INTEGER PRIMARY KEY)");

db.exec("DROP TABLE IF EXISTS word_writings");
db.exec(`
  CREATE TABLE word_writings (
    word INTEGER NOT NULL REFERENCES words (id),
    text TEXT NOT NULL,
    ateji INTEGER,
    irregular INTEGER,
    rare INTEGER,
    outdated INTEGER,
    search_only INTEGER,
    UNIQUE (word, text ASC)
  )
`);

db.exec("DROP TABLE IF EXISTS word_readings");
db.exec(`
  CREATE TABLE word_readings (
    word INTEGER NOT NULL REFERENCES words (id),
    text TEXT NOT NULL,
    no_kanji INTEGER,
    gikun INTEGER,
    irregular INTEGER,
    rare INTEGER,
    outdated INTEGER,
    search_only INTEGER,
    UNIQUE (word, text ASC)
  )
`);

db.exec("DROP TABLE IF EXISTS word_meanings");
db.exec(`
  CREATE TABLE word_meanings (
    id INTEGER NOT NULL,
    word INTEGER REFERENCES words (id),
    info TEXT,
    pos BLOB,
    misc BLOB,
    kana_preferred INTEGER,
    PRIMARY KEY (id ASC, word)
  )
`);

db.exec("DROP TABLE IF EXISTS word_meaning_glossary");
db.exec(`
  CREATE TABLE word_meaning_glossary (
    word INTEGER NOT NULL REFERENCES words (id),
    meaning INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (word ASC, meaning, seq),
    FOREIGN KEY (word, meaning) REFERENCES word_meanings (word, id)
  )
`);

db.exec("DROP INDEX IF EXISTS word_meaning_glossary_index");
db.exec(
  "CREATE INDEX word_meaning_glossary_index ON word_meaning_glossary (word, text ASC)",
);

db.exec("DROP TABLE IF EXISTS word_priority");
db.exec(`
  CREATE TABLE word_priority (
    word INTEGER NOT NULL REFERENCES words (id),
    writing TEXT,
    reading TEXT,
    freq INTEGER,
    news INTEGER,
    ichi INTEGER,
    spec INTEGER,
    gai INTEGER,
    UNIQUE (word ASC, writing),
    UNIQUE (word ASC, reading),
    FOREIGN KEY (word, writing) REFERENCES word_writings (word, text),
    FOREIGN KEY (word, reading) REFERENCES word_readings (word, text)
  )
`);

db.exec("DROP TABLE IF EXISTS word_reading_writing_pairs");
db.exec(`
  CREATE TABLE word_reading_writing_pairs (
    word INTEGER NOT NULL REFERENCES words (id),
    writing TEXT NOT NULL,
    reading TEXT NOT NULL,
    UNIQUE (word, writing ASC, reading),
    FOREIGN KEY (word, writing) REFERENCES word_writings (word, text),
    FOREIGN KEY (word, reading) REFERENCES word_readings (word, text)
  )
`);

db.exec("DROP TABLE IF EXISTS word_meaning_writing_pairs");
db.exec(`
  CREATE TABLE word_meaning_writing_pairs (
    word INTEGER NOT NULL REFERENCES words (id),
    meaning INTEGER NOT NULL,
    writing TEXT NOT NULL,
    FOREIGN KEY (word, meaning) REFERENCES word_meanings (word, id),
    FOREIGN KEY (word, writing) REFERENCES word_writings (word, text)
  )
`);

db.exec("DROP TABLE IF EXISTS word_meaning_reading_pairs");
db.exec(`
  CREATE TABLE word_meaning_reading_pairs (
    word INTEGER NOT NULL REFERENCES words (id),
    meaning INTEGER NOT NULL,
    reading TEXT NOT NULL,
    FOREIGN KEY (word, meaning) REFERENCES word_meanings (word, id),
    FOREIGN KEY (word, reading) REFERENCES word_readings (word, text)
  )
`);

const insertWord = db.prepare("INSERT INTO words (id) VALUES (?)");
const insertW = db.prepare(`
  INSERT INTO word_writings (word, text, ateji, irregular, rare, outdated, search_only)
  VALUES (@wordId, @text, 0, 0, 0, 0, 0)
`);
const insertR = db.prepare(`
  INSERT INTO word_readings (word, text, no_kanji, gikun, irregular, rare, outdated, search_only)
  VALUES (@wordId, @text, 0, 0, 0, 0, 0, 0)
`);
const insertMeaning = db.prepare(`
  INSERT INTO word_meanings (id, word, info, pos, misc, kana_preferred)
  VALUES (@meaningId, @wordId, null, json('[]'), json('[]'), 0)
`);
const insertGloss = db.prepare(`
  INSERT INTO word_meaning_glossary (word, meaning, seq, text)
  VALUES (@wordId, @meaningId, @seq, @text)
`);
const insertPair = db.prepare(`
  INSERT INTO word_reading_writing_pairs (word, writing, reading)
  VALUES (?, ?, ?)
`);

// Parse CEDICT
const url = new URL("../assets/cedict_ts.u8", import.meta.url);
const rl = readline.createInterface({
  input: createReadStream(url, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let wordId = 0;

db.exec("BEGIN");
for await (const line of rl) {
  if (!line || line.startsWith("#")) continue;
  // trad simp [PINYIN] /m1/m2/...
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+?)\/\s*$/);
  if (!m) continue;
  const [, trad, simp, pinyin, defsRaw] = m;
  const defs = defsRaw.split("/").map((s) => s.trim()).filter(Boolean);

  wordId += 1;
  insertWord.run(wordId);

  // writings: both simp + trad
  insertW.run({ wordId, text: simp });
  if (trad !== simp) insertW.run({ wordId, text: trad });

  // reading
  insertR.run({ wordId, text: pinyin });

  // reading-writing pair(s)
  insertPair.run(wordId, simp, pinyin);
  if (trad !== simp) insertPair.run(wordId, trad, pinyin);

  // meanings (one meaning object with many glosses)
  const meaningId = 1;
  insertMeaning.run({ meaningId, wordId });
  let seq = 0;
  for (const g of defs) {
    seq += 1;
    insertGloss.run({ wordId, meaningId, seq, text: g });
  }
}
db.exec("COMMIT");

// No priorities for now (word_priority left empty)