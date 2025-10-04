import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const outDir = new URL("../public/data/kanji-lists/", import.meta.url);
await fs.mkdir(outDir, { recursive: true });

const ranges = [
  ["top-50", 1, 50],
  ["top-100", 51, 100],
  ["top-200", 101, 200],
  ["top-500", 201, 500],
  ["top-1000", 501, 1000],
  ["top-2500", 1001, 2500],
];

const charByRank = [];
{
  const url = new URL("../assets/frequency.csv", import.meta.url);
  const rl = readline.createInterface({
    input: createReadStream(fileURLToPath(url), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || line.startsWith("/*")) continue;
    const [rankStr, ch] = line.split(",");
    const rank = Number.parseInt(rankStr, 10);
    if (Number.isFinite(rank) && ch?.trim()) {
      charByRank[rank] = ch.trim();
    }
  }
}

for (const [name, from, to] of ranges) {
  const out = [];
  for (let r = from; r <= to; r += 1) {
    const ch = charByRank[r];
    if (ch) out.push(ch);
  }
  const file = new URL(`news-${name}.csv`, outDir);
  await fs.writeFile(file, out.join("\n") + "\n", "utf8");
}