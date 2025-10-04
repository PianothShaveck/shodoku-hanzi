import fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import unzip from "unzip-stream";

const MMHZ_ZIP =
  "https://github.com/skishore/makemeahanzi/archive/refs/heads/master.zip";
const CEDICT_ZIP =
  "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip";

// Fallback per IDS (CHISE / CJKVI)
const CJKVI_IDS_RAW =
  "https://raw.githubusercontent.com/cjkvi/cjkvi-ids/master/ids.txt";

async function download(url, path, { unzipToDir = null } = {}) {
  const res = await fetch(url);

  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  let stream = Readable.fromWeb(res.body);

  if (unzipToDir) {
    stream = stream.pipe(unzip.Extract({ path: unzipToDir }));
  } else {
    stream = stream.pipe(fs.createWriteStream(path));
  }

  await finished(stream);
  // eslint-disable-next-line no-console
  console.log(`Downloaded: ${url}`);
}

async function fetchToPath(url, outPath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await fs.promises.mkdir(fs.promises.dirname ? await fs.promises.dirname(outPath) : outPath.split("/").slice(0, -1).join("/"), { recursive: true }).catch(() => {});
  const ws = fs.createWriteStream(outPath);
  await finished(Readable.fromWeb(res.body).pipe(ws));
  // eslint-disable-next-line no-console
  console.log(`Downloaded: ${url} -> ${outPath}`);
}

await download(
  MMHZ_ZIP,
  fileURLToPath(import.meta.resolve("../assets/makemeahanzi.zip")),
  { unzipToDir: fileURLToPath(import.meta.resolve("../assets/makemeahanzi")) },
);

await download(
  CEDICT_ZIP,
  fileURLToPath(import.meta.resolve("../assets/cedict.zip")),
  { unzipToDir: fileURLToPath(import.meta.resolve("../assets")) },
);

// Move/normalize CEDICT to cedict_ts.u8
{
  const base = fileURLToPath(import.meta.resolve("../assets"));
  const dir = await fs.promises.readdir(base);
  const src = dir.find((f) => /^cedict_1_0_ts_utf-8.*\.u8$/.test(f));
  if (src) {
    await fs.promises.copyFile(`${base}/${src}`, `${base}/cedict_ts.u8`);
    // eslint-disable-next-line no-console
    console.log(`CEDICT ready: assets/cedict_ts.u8`);
  }
}

// Verifica file Make Me A Hanzi (graphics.txt, dictionary.txt, ids.txt).
// In alcuni ZIP sono in radice, in altri in data/. Se ids.txt manca,
// lo scarichiamo da CJKVI e lo salviamo accanto agli altri.
{
  const mdir = fileURLToPath(import.meta.resolve("../assets/makemeahanzi"));
  const root = (await fs.promises.readdir(mdir)).find((n) =>
    /^makemeahanzi-/.test(n),
  );
  if (!root) {
    throw new Error("makemeahanzi root not found after unzip");
  }
  const base = `${mdir}/${root}`;

  async function exists(p) {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async function resolveOne(name) {
    const candidates = [`${base}/${name}`, `${base}/data/${name}`];
    for (const p of candidates) {
      if (await exists(p)) {
        // eslint-disable-next-line no-console
        console.log(`Found: ${p}`);
        return p;
      }
    }
    return null;
  }

  const g = await resolveOne("graphics.txt");
  if (!g) throw new Error(`Could not find graphics.txt in ${base} or ${base}/data/`);
  const d = await resolveOne("dictionary.txt");
  if (!d) throw new Error(`Could not find dictionary.txt in ${base} or ${base}/data/`);

  let ids = await resolveOne("ids.txt");
  if (!ids) {
    // Fallback: scarica da CJKVI e salva in base/ids.txt
    const out = `${base}/ids.txt`;
    await fetchToPath(CJKVI_IDS_RAW, out);
    if (!(await exists(out))) {
      throw new Error(`Downloaded ids.txt but cannot access it at ${out}`);
    }
    // eslint-disable-next-line no-console
    console.log(`Using CJKVI ids.txt fallback at: ${out}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Found: ${ids}`);
  }
}