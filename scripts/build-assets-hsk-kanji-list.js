import fs from "node:fs/promises";

const src = new URL("../assets/hsk30.txt", import.meta.url);
const dst = new URL("../public/data/kanji-lists/", import.meta.url);
await fs.mkdir(dst, { recursive: true });

const txt = await fs.readFile(src, "utf8");

// Utility: cifra cinese -> numero
const CN_DIG = new Map([
  ["一", 1],
  ["二", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);

function parseHeader(line) {
  // match “…级汉字表”
  const m = line.trim().match(/^([一二三四五六七八九十]+)级汉字表$/);
  if (!m) return null;
  const s = m[1];

  // OCR particolare: "七一九级汉字表" = "七—九级汉字表"
  // se contiene più di un numero e in mezzo c'è "一" come "trattino", trattiamo come range 7–9
  if (s.length === 3 && s[0] in Object.fromEntries(CN_DIG) && s[1] === "一" && s[2] in Object.fromEntries(CN_DIG)) {
    const a = CN_DIG.get(s[0]);
    const b = CN_DIG.get(s[2]);
    if (a && b && a < b) return { range: [a, b] }; // {range:[7,9]}
  }

  // livello singolo (1..10)
  let val = 0;
  for (const ch of s) {
    const n = CN_DIG.get(ch) ?? 0;
    // “十” come 10
    if (n === 10) {
      val = val === 0 ? 10 : val + 10;
    } else {
      val += n;
    }
  }
  if (val >= 1 && val <= 10) return { level: val };
  return null;
}

const levels = new Map(); // "01","02",…,"07-09" -> Set
let currentKey = null;

for (const raw of txt.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;

  // ignora le sezioni delle “手写字表”
  if (/(初等手写字表|中等手写字表|高等手写字表)/.test(line)) {
    currentKey = null;
    continue;
  }

  const head = parseHeader(line);
  if (head) {
    if (head.level && head.level <= 6) {
      currentKey = String(head.level).padStart(2, "0");
      if (!levels.has(currentKey)) levels.set(currentKey, new Set());
    } else if (head.range && head.range[0] === 7 && head.range[1] === 9) {
      currentKey = "07-09";
      if (!levels.has(currentKey)) levels.set(currentKey, new Set());
    } else {
      currentKey = null; // non supportiamo altri casi
    }
    continue;
  }

  // linee “N\t字”
  const m = line.match(/^\s*\d+\s+(\S)\s*$/);
  if (m && currentKey) {
    levels.get(currentKey).add(m[1]);
  }
}

// scrivi i CSV: 01..06 + 07-09 se presente
for (const key of [...levels.keys()].sort()) {
  const name = key === "07-09" ? "hsk-07-09.csv" : `hsk-${key}.csv`;
  const file = new URL(name, dst);
  await fs.writeFile(file, [...levels.get(key)].join("\n") + "\n", "utf8");
}