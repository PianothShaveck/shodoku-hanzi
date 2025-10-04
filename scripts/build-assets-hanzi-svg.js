import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

// Trova un file in makemeahanzi sia in radice che in data/
async function resolveMmhzFile(name) {
  const root = fileURLToPath(import.meta.resolve("../assets/makemeahanzi"));
  const dir = (await fs.readdir(root)).find((n) => /^makemeahanzi-/.test(n));
  if (!dir) throw new Error("makemeahanzi root not found");
  const base = `${root}/${dir}`;
  const candidates = [`${base}/${name}`, `${base}/data/${name}`];
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {}
  }
  throw new Error(`Cannot find ${name} under ${base} or ${base}/data`);
}

const outDir = fileURLToPath(import.meta.resolve("../public/kanjivg/kanji"));
await fs.mkdir(outDir, { recursive: true });

const graphicsPath = await resolveMmhzFile("graphics.txt");

const rl = readline.createInterface({
  input: createReadStream(graphicsPath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

function medianToPath(points) {
  // points = [[x,y],[x,y],...]
  if (!Array.isArray(points) || points.length === 0) return null;
  const [x0, y0] = points[0];
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    d += ` L ${x} ${y}`;
  }
  return d;
}

for await (const line of rl) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  const ch = obj.character;
  const hex = [...ch][0].codePointAt(0).toString(16).padStart(5, "0");

  const medians = obj.medians ?? [];

  // Un path per ogni stroke (centerline). Il colore/width lo controlliamo via CSS nel componente.
  const svgPaths = medians
    .map((poly) => medianToPath(poly))
    .filter(Boolean)
    .map((d) => `<path d="${d}" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke" />`)
    .join("");

  // Flip verticale: portiamo il sistema 0..1024 del dataset (y in giù) in uno “visivo” dritto.
  // NOTA: trasformazione applicata solo alla guida; il canvas dell’utente resta non trasformato.
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g id="kvg:${hex}" transform="translate(0,1024) scale(1,-1)">
    ${svgPaths}
  </g>
</svg>
`;

  await fs.writeFile(`${outDir}/${hex}.svg`, svg, "utf8");
}