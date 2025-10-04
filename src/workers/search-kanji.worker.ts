import { hasKanji } from "../helpers/text.ts";

const LIMIT = 6;
const UNIT_SEP = "\u{241f}";
const RECORD_SEP = "\u{241e}";
const GROUP_SEP = "\u{241d}";

const BASE = (import.meta as any).env?.BASE_URL?.replace(/\/+$/, "") || "";

const fetchingIndex = fetch(`${BASE}/data/index/kanji-v1.usv`).then((r) =>
  r.text(),
);

export type KanjiSearchResult = {
  id: number;
  match: string;
  kunYomi: string[];
  onYomi: string[];
  meanings: string[];
};

function includes(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function find(search: { pinyin?: string; en?: string }): Promise<KanjiSearchResult[]> {
  const index = await fetchingIndex;

  const found: KanjiSearchResult[] = [];
  let i = 0;
  let recordNumber = 0;
  let unitStart = 0;
  let groupStart = 0;
  let matchContent: string | null = null;

  for (const ch of index) {
    const len = ch.length;

    if (ch === UNIT_SEP) {
      if (!matchContent) {
        let unitContent: string | undefined;
        if (recordNumber === 1 && search.pinyin) {
          unitContent = index.slice(unitStart + len, i);
          if (includes(unitContent.replaceAll(".", " "), search.pinyin)) {
            matchContent = search.pinyin;
          }
        } else if (recordNumber === 2 && search.pinyin) {
          unitContent = index.slice(unitStart + len, i);
          if (includes(unitContent.replaceAll(".", " "), search.pinyin)) {
            matchContent = search.pinyin;
          }
        } else if (recordNumber === 3 && search.en) {
          unitContent = index.slice(unitStart + len, i);
          if (includes(unitContent, search.en)) {
            matchContent = search.en;
          }
        }
      }
      unitStart = i;
    } else if (ch === RECORD_SEP) {
      recordNumber += 1;
      unitStart = i;
    } else if (ch === GROUP_SEP) {
      if (matchContent) {
        const group = index.slice(groupStart + len, i).trim();
        const [literal, kunRec, onRec, meaningRec] = group.split(
          `${UNIT_SEP}${RECORD_SEP}`,
        );
        const id = literal.codePointAt(0) ?? -1;

        found.push({
          id,
          match: matchContent,
          kunYomi: kunRec.split(UNIT_SEP),
          onYomi: onRec.split(UNIT_SEP),
          meanings: meaningRec.split(UNIT_SEP),
        });
        matchContent = null;

        if (found.length === LIMIT) break;
      }

      recordNumber = 0;
      unitStart = i;
      groupStart = i;
    }

    i += len;
  }

  return found;
}

addEventListener("message", async (event: MessageEvent<string>) => {
  const phrase = event.data.trim();
  if (!phrase) return;

  let results: KanjiSearchResult[] = [];

  if (hasKanji(phrase)) {
    results = [];
  } else if (/^[a-zA-Z0-9\s:;'`,.-]+$/.test(phrase)) {
    results = await find({ pinyin: phrase });
    if (results.length < LIMIT) {
      const extra = await find({ en: phrase });
      const seen = new Set(results.map((r) => r.id));
      for (const e of extra) if (!seen.has(e.id)) results.push(e);
    }
  } else {
    results = await find({ en: phrase });
  }

  self.postMessage(results);
});