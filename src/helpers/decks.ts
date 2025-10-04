import { Deck } from "../types.ts";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, ""); // es. "/shodoku-hanzi"

export function deckLabel(deck: Deck): string {
  if (deck.category === "hsk") {
    return deck.label;
  }
  if (deck.category === "freq") {
    return `Frequency ${deck.label}`;
  }
  return deck.label;
}

export function categoryLabel(name: string): string {
  if (name === "hsk") return "HSK";
  if (name === "freq") return "Frequency";
  return name;
}

// helper per comporre un URL relativo alla base
function listPath(rel: string) {
  return `${BASE}/${rel}`;
}

// HSK 1..6 + 7–9 combinati
export const hskDecks = [
  {
    name: "hsk-01",
    label: "HSK Level 1",
    priority: 1,
    content: listPath("data/kanji-lists/hsk-01.csv"),
  },
  {
    name: "hsk-02",
    label: "HSK Level 2",
    priority: 2,
    content: listPath("data/kanji-lists/hsk-02.csv"),
  },
  {
    name: "hsk-03",
    label: "HSK Level 3",
    priority: 3,
    content: listPath("data/kanji-lists/hsk-03.csv"),
  },
  {
    name: "hsk-04",
    label: "HSK Level 4",
    priority: 4,
    content: listPath("data/kanji-lists/hsk-04.csv"),
  },
  {
    name: "hsk-05",
    label: "HSK Level 5",
    priority: 5,
    content: listPath("data/kanji-lists/hsk-05.csv"),
  },
  {
    name: "hsk-06",
    label: "HSK Level 6",
    priority: 6,
    content: listPath("data/kanji-lists/hsk-06.csv"),
  },
  {
    name: "hsk-07-09",
    label: "HSK Levels 7–9",
    priority: 7,
    content: listPath("data/kanji-lists/hsk-07-09.csv"),
  },
];

// Frequency
export const frequencyDecks = [
  {
    name: "news-top-50",
    label: "Top 50",
    priority: 3,
    content: listPath("data/kanji-lists/news-top-50.csv"),
  },
  {
    name: "news-top-100",
    label: "Top 100",
    priority: 13,
    content: listPath("data/kanji-lists/news-top-100.csv"),
  },
  {
    name: "news-top-200",
    label: "Top 200",
    priority: 25,
    content: listPath("data/kanji-lists/news-top-200.csv"),
  },
  {
    name: "news-top-500",
    label: "Top 500",
    priority: 50,
    content: listPath("data/kanji-lists/news-top-500.csv"),
  },
  {
    name: "news-top-1000",
    label: "Top 1000",
    priority: 80,
    content: listPath("data/kanji-lists/news-top-1000.csv"),
  },
  {
    name: "news-top-2500",
    label: "Top 2501",
    priority: 100,
    content: listPath("data/kanji-lists/news-top-2500.csv"),
  },
];

// Retrocompatibilità
export const jlptDecks = [];
export const newsFrequencyDecks = frequencyDecks;
export const genkiDecks = [];
export const basicKanjiDecks = [];
export const jouyouDecks = [];