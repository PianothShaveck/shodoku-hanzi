import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

await fs.mkdir(new URL("../public/data/kanji-vocab-v1", import.meta.url), {
  recursive: true,
});

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// Prende tutte le coppie (kanji.literal -> lista di word id) senza dipendere da word_lists.
// Ordina per priorità di frequenza (word_priority.freq se esiste), altrimenti per scrittura.
const selectKanji = db.prepare(`
  SELECT codepoint, literal FROM kanji
`);

// Trova tutte le parole che contengono il carattere nella scrittura
const selectWordsForChar = db.prepare(`
  SELECT
    ww.word AS word,
    MIN(COALESCE(wp.freq, 2147483647)) AS rank,
    MIN(ww.text) AS any_writing
  FROM word_writings ww
  LEFT JOIN word_priority wp
    ON wp.word = ww.word AND wp.writing = ww.text
  WHERE instr(ww.text, ?) > 0
    AND COALESCE(ww.search_only, 0) = 0
  GROUP BY ww.word
  ORDER BY rank ASC, any_writing ASC
`);

let i = 0;
for (const row of selectKanji.iterate()) {
  const { codepoint, literal } = row;

  const words = [];
  for (const rec of selectWordsForChar.iterate(literal)) {
    words.push(rec.word);
  }

  const hex = codepoint.toString(16).padStart(5, "0");
  const fileURL = new URL(
    `../public/data/kanji-vocab-v1/${hex}.json`,
    import.meta.url,
  );

  const data = {
    codepoint,
    literal,
    words,
  };

  await fs.writeFile(fileURL, JSON.stringify(data));

  i += 1;
  if (i % 200 === 0) {
    // eslint-disable-next-line no-console
    console.log(i, fileURL.pathname);
  }
}