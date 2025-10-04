import { hasKanji } from "../helpers/text.ts";

const LIMIT = 20;
const UNIT_SEP = "\u{241f}";
const RECORD_SEP = "\u{241e}";
const GROUP_SEP = "\u{241d}";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/+$/, "") || "";
const fetchingIndex = fetch(`${BASE}/data/index/words-v1.usv`).then((r) =>
  r.text(),
);

function isInParams(heystack: string, needle: string): boolean {
  const openParam = heystack.indexOf("(");
  if (openParam === -1) return false;
  return heystack.indexOf(needle) > openParam;
}

export type WordSearchResult = {
  id: number;
  phrase: string;
  match: string;
  writings: string[];
  readings: string[];
  glossary: string[];
};

async function findWords(search: {
  phrase: string;
  writing: string | null;
  reading: string | null;
  glossary: string | null;
}): Promise<void> {
  const index = await fetchingIndex;

  let foundCount = 0;

  let i = 0;
  let record = 0;
  let unitStart = 0;
  let groupStart = 0;
  let matchContent: string | null = null;

  for (const ch of index) {
    const len = ch.length;

    if (ch === UNIT_SEP) {
      if (!matchContent) {
        let unitContent: string | undefined;
        let haystack: string | undefined;
        let needle: string | null | undefined;

        if (search.reading && record === 1) {
          unitContent = index.slice(unitStart, i);
          haystack = unitContent;
          needle = search.reading;
        } else if (search.writing && record === 2) {
          unitContent = index.slice(unitStart, i);
          haystack = unitContent;
          needle = search.writing;
        } else if (search.glossary && record === 3) {
          unitContent = index.slice(unitStart, i);
          haystack = unitContent.toLowerCase();
          needle = search.glossary;
        }

        if (
          needle &&
          unitContent &&
          haystack?.toLowerCase().includes(needle.toLowerCase()) &&
          !(search.glossary && isInParams(haystack, needle))
        ) {
          matchContent = unitContent;
        }
      }

      unitStart = i + len;
    } else if (ch === RECORD_SEP) {
      record += 1;

      unitStart = i + len;
    } else if (ch === GROUP_SEP) {
      if (matchContent) {
        const group = index.slice(groupStart, i).trim();
        const [idStr, readingRec, writingRec, glossaryRec] = group.split(
          `${UNIT_SEP}${RECORD_SEP}`,
        );
        const id = Number.parseInt(idStr, 10);

        const result: WordSearchResult = {
          id,
          phrase: search.phrase,
          match: matchContent,
          readings: readingRec.split(UNIT_SEP),
          writings: writingRec.split(UNIT_SEP),
          glossary: glossaryRec.split(UNIT_SEP),
        };

        self.postMessage(result);

        foundCount += 1;
        matchContent = null;

        if (foundCount === LIMIT) break;
      }

      record = 0;

      unitStart = i + len;
      groupStart = i + len;
    }

    i += len;
  }
}

addEventListener("message", async (event: MessageEvent<string>) => {
  const phrase = event.data.trim();
  if (!phrase) return;

  const searchWriting = hasKanji(phrase);
  const searchReading = !searchWriting && /^[a-zA-Z0-9\s:;'`,.-]+$/.test(phrase);
  const searchGlossary = !searchWriting && !searchReading;

  findWords({
    phrase,
    writing: searchWriting ? phrase : null,
    reading: searchReading ? phrase : null,
    glossary: searchGlossary ? phrase.toLowerCase() : null,
  });
});