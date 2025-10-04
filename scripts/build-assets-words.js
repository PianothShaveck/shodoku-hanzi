import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

await fs.mkdir(new URL("../public/data/words-v1", import.meta.url), {
  recursive: true,
});

const db = new Database(fileURLToPath(import.meta.resolve("../assets.db")));
db.pragma("journal_mode = WAL");

// pulizia ricorsiva degli empty/null
function stripNull(obj) {
  if (typeof obj !== "object" || obj == null) return obj;

  if (Array.isArray(obj)) {
    return obj
      .map(stripNull)
      .filter(
        (v) =>
          v !== null &&
          v !== false &&
          v !== "" &&
          !(Array.isArray(v) && v.length === 0),
      );
  }

  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => [k, stripNull(v)])
      .filter(
        ([, v]) =>
          v !== null &&
          v !== false &&
          v !== "" &&
          !(Array.isArray(v) && v.length === 0),
      ),
  );
}

/* ========== PREPARE STATEMENTS SEMPLICI ========== */

// tutti gli id
const selectWordIds = db.prepare(`SELECT id FROM words`);

// writings (con priorità)
const selectWritings = db.prepare(`
  SELECT
    ww.text,
    COALESCE(ww.ateji,0) AS ateji,
    COALESCE(ww.irregular,0) AS irregular,
    COALESCE(ww.rare,0) AS rare,
    COALESCE(ww.outdated,0) AS outdated,
    COALESCE(ww.search_only,0) AS search_only,
    wp.freq AS p_freq,
    wp.ichi AS p_ichi,
    wp.news AS p_news,
    wp.spec AS p_spec
  FROM word_writings ww
  LEFT JOIN word_priority wp
    ON wp.word = ww.word AND wp.writing = ww.text
  WHERE ww.word = ?
  ORDER BY (wp.freq IS NOT NULL) DESC, wp.freq ASC, ww.text ASC
`);

// readings (con priorità)
const selectReadings = db.prepare(`
  SELECT
    wr.text,
    COALESCE(wr.no_kanji,0) AS no_kanji,
    COALESCE(wr.gikun,0) AS gikun,
    COALESCE(wr.irregular,0) AS irregular,
    COALESCE(wr.rare,0) AS rare,
    COALESCE(wr.outdated,0) AS outdated,
    COALESCE(wr.search_only,0) AS search_only,
    wp.freq AS p_freq,
    wp.ichi AS p_ichi,
    wp.news AS p_news,
    wp.spec AS p_spec
  FROM word_readings wr
  LEFT JOIN word_priority wp
    ON wp.word = wr.word AND wp.reading = wr.text
  WHERE wr.word = ?
  ORDER BY (wp.freq IS NOT NULL) DESC, wp.freq ASC, wr.text ASC
`);

// reading -> writings (useWith)
const selectReadingUseWith = db.prepare(`
  SELECT reading, writing
  FROM word_reading_writing_pairs
  WHERE word = ?
`);

// furigana per la parola
const selectFurigana = db.prepare(`
  SELECT writing, reading, furigana
  FROM word_furigana
  WHERE
    writing IN (SELECT text FROM word_writings WHERE word = ?)
    AND reading IN (SELECT text FROM word_readings WHERE word = ?)
`);

// meanings base
const selectMeanings = db.prepare(`
  SELECT id, info, pos, misc, COALESCE(kana_preferred,0) AS kana_preferred
  FROM word_meanings
  WHERE word = ?
  ORDER BY id
`);

// gloss per meaning
const selectGloss = db.prepare(`
  SELECT text
  FROM word_meaning_glossary
  WHERE word = ? AND meaning = ?
  ORDER BY seq
`);

// useWith writing/reading per meaning
const selectUseWithWriting = db.prepare(`
  SELECT writing
  FROM word_meaning_writing_pairs
  WHERE word = ? AND meaning = ?
`);
const selectUseWithReading = db.prepare(`
  SELECT reading
  FROM word_meaning_reading_pairs
  WHERE word = ? AND meaning = ?
`);

/* ========== BUILD SEQUENZIALE ========== */

let count = 0;

for (const { id } of selectWordIds.iterate()) {
  // 1) writings
  const writings = selectWritings.all(id).map((r) => {
    const prio =
      r.p_freq == null && r.p_ichi == null && r.p_news == null && r.p_spec == null
        ? null
        : { freq: r.p_freq, ichi: r.p_ichi, news: r.p_news, spec: r.p_spec };
    return stripNull({
      text: r.text,
      ateji: !!r.ateji,
      irregular: !!r.irregular,
      rare: !!r.rare,
      outdated: !!r.outdated,
      searchOnly: !!r.search_only,
      priority: prio,
    });
  });

  // 2) readings + useWith
  const readingRows = selectReadings.all(id);
  const useWithMap = new Map(); // reading -> string[]
  for (const row of selectReadingUseWith.iterate(id)) {
    const arr = useWithMap.get(row.reading) ?? [];
    arr.push(row.writing);
    useWithMap.set(row.reading, arr);
  }
  const readings = readingRows.map((r) => {
    const prio =
      r.p_freq == null && r.p_ichi == null && r.p_news == null && r.p_spec == null
        ? null
        : { freq: r.p_freq, ichi: r.p_ichi, news: r.p_news, spec: r.p_spec };
    return stripNull({
      text: r.text,
      noKanji: !!r.no_kanji,
      gikun: !!r.gikun,
      irregular: !!r.irregular,
      rare: !!r.rare,
      outdated: !!r.outdated,
      searchOnly: !!r.search_only,
      useWith: useWithMap.get(r.text) ?? undefined,
      priority: prio,
    });
  });

  // 3) furigana
  const furigana = selectFurigana.all(id, id).map((r) => ({
    writing: r.writing,
    reading: r.reading,
    furigana: JSON.parse(r.furigana),
  }));

  // 4) meanings (con gloss e useWith)
  const meanings = [];
  for (const m of selectMeanings.all(id)) {
    const writeWith = selectUseWithWriting.all(id, m.id).map((x) => x.writing);
    const readWith = selectUseWithReading.all(id, m.id).map((x) => x.reading);
    const gloss = selectGloss.all(id, m.id).map((x) => x.text);

    // pos/misc sono salvati come JSON in DB; se arrivano come stringhe, parse
    let pos = [];
    let misc = [];
    try {
      pos = Array.isArray(m.pos) ? m.pos : JSON.parse(m.pos ?? "[]");
    } catch {}
    try {
      misc = Array.isArray(m.misc) ? m.misc : JSON.parse(m.misc ?? "[]");
    } catch {}

    meanings.push(
      stripNull({
        info: m.info || undefined,
        pos,
        misc,
        kanaPreferred: !!m.kana_preferred,
        useWithWriting: writeWith.length ? writeWith : undefined,
        useWithReading: readWith.length ? readWith : undefined,
        glossary: gloss,
      }),
    );
  }

  // 5) scrivi il file in modo SEQUENZIALE
  const path = new URL(`../public/data/words-v1/${id}.json`, import.meta.url);
  await fs.writeFile(
    path,
    JSON.stringify(
      stripNull({
        id,
        writings,
        readings,
        furigana,
        meanings,
      }),
    ),
  );

  count += 1;
  if (count % 5000 === 0) {
    // eslint-disable-next-line no-console
    console.log(`words ${count} written...`);
  }
}