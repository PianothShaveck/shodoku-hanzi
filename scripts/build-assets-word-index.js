import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

await fs.mkdir(new URL("../public/data/index", import.meta.url), {
  recursive: true,
});

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// Costruiamo l'indice senza riferirci a word_lists.
// L'ordinamento è: frequenza (word_priority.freq) ASC NULLS LAST,
// poi min(ichi, news, spec) ASC NULLS LAST, poi scrittura.
const selectWords = db.prepare(`
  SELECT
    words.id AS id,
    json_group_array(DISTINCT wr.text)
      FILTER (WHERE wr.text IS NOT NULL) AS readings,
    json_group_array(DISTINCT ww.text)
      FILTER (WHERE ww.text IS NOT NULL) AS writings,
    json_group_array(DISTINCT wmg.text ORDER BY wmg.meaning, wmg.seq)
      FILTER (WHERE wmg.text IS NOT NULL) AS glossary
  FROM words
  LEFT JOIN word_readings wr ON wr.word = words.id
  LEFT JOIN word_writings ww ON ww.word = words.id
  LEFT JOIN word_meaning_glossary wmg ON wmg.word = words.id
  LEFT JOIN word_priority wp_r ON (wp_r.word = words.id AND wp_r.reading = wr.text)
  LEFT JOIN word_priority wp_w ON (wp_w.word = words.id AND wp_w.writing = ww.text)
  GROUP BY words.id
  ORDER BY
    MIN(COALESCE(wp_r.freq, wp_w.freq)) ASC NULLS LAST,
    MIN(COALESCE(wp_r.ichi, wp_w.ichi, wp_r.news, wp_w.news, wp_r.spec, wp_w.spec)) ASC NULLS LAST,
    MIN(ww.text) ASC
`);

const fileURL = new URL(`../public/data/index/words-v1.usv`, import.meta.url);
const file = await fs.open(fileURL, "w");
const fileStream = file.createWriteStream();

const UNIT_SEP = "\u{241f}";
const RECORD_SEP = "\u{241e}";
const GROUP_SEP = "\u{241d}";

for (const row of selectWords.iterate()) {
  const { id } = row;
  const readings = JSON.parse(row.readings ?? "[]").join(UNIT_SEP);
  const writings = JSON.parse(row.writings ?? "[]").join(UNIT_SEP);
  const glossary = JSON.parse(row.glossary ?? "[]").join(UNIT_SEP);

  const line = [id, readings, writings, glossary].join(
    `${UNIT_SEP}${RECORD_SEP}`,
  );

  fileStream.write(`${line}${UNIT_SEP}${RECORD_SEP}${GROUP_SEP}\n`);
}