import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// Ricrea la tabella come nell'originale (stesso nome/chiavi)
db.exec(`DROP TABLE IF EXISTS word_furigana`);
db.exec(`
  CREATE TABLE word_furigana (
    writing TEXT NOT NULL,
    reading TEXT NOT NULL,
    furigana BLOB,
    PRIMARY KEY (writing ASC, reading)
  )
`);

// Usa OR REPLACE per evitare errori di chiave primaria su duplicati
const insert = db.prepare(`
  INSERT OR REPLACE INTO word_furigana (writing, reading, furigana)
  VALUES (?, ?, ?)
`);

// Regex Han (CJK) per capire quali char devono ricevere la sillaba pinyin
const HAN_RE = /\p{Script=Han}/u;

// Segmentatore "smart":
// - reading: pinyin separato da spazi => ["zhong1","guo2",...]
// - writing: per ogni Hanzi associa la sillaba successiva;
//            per caratteri non Hanzi inserisce solo { ruby: ch } senza rt;
// - se al termine avanzano sillabe pinyin non assegnate, ritorna null (non coerente).
function segmentSmart(writing, reading) {
  if (!writing || !reading) return null;

  const syl = reading.trim().split(/\s+/).filter(Boolean);
  if (syl.length === 0) return null;

  const chars = [...writing];
  const out = [];
  let sIdx = 0;

  for (const ch of chars) {
    if (HAN_RE.test(ch)) {
      if (sIdx >= syl.length) {
        // pinyin insufficiente per tutte le Hanzi
        return null;
      }
      out.push({ ruby: ch, rt: syl[sIdx++] });
    } else {
      // punteggiatura, lettere latine, spazi, ecc.: senza rt
      out.push({ ruby: ch });
    }
  }

  // se sono rimaste sillabe pinyin non assegnate, mismatch
  if (sIdx !== syl.length) return null;

  return out;
}

const tx = db.transaction(() => {
  // Itera su tutte le parole
  const words = db.prepare("SELECT id FROM words").all();

  for (const { id } of words) {
    const wrs = db
      .prepare("SELECT text FROM word_writings WHERE word = ?")
      .all(id)
      .map((r) => r.text);

    const rds = db
      .prepare("SELECT text FROM word_readings WHERE word = ?")
      .all(id)
      .map((r) => r.text);

    // Deduplica coppie (writing, reading) per parola
    const seen = new Set(); // chiave: `${w}\t${r}`

    for (const w of wrs) {
      for (const r of rds) {
        const key = `${w}\t${r}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const fur = segmentSmart(w, r);
        if (fur) {
          insert.run(w, r, JSON.stringify(fur));
        }
      }
    }
  }
});

tx();
