# Shodoku 书读 (Chinese)

> Learn Hanzi by writing and reading it

This fork adapts Shodoku from Japanese Kanji to Mandarin Chinese (Hanzi). It uses:

- Make Me A Hanzi for stroke paths and decomposition (radicals/components)
- CC‑CEDICT for words, pinyin, and definitions
- Your HSK 3.0 character list (hsk30.txt)
- Your character frequency list (frequency.csv)

It keeps the same web app and asset formats as the original, so the UI, SRS, and offline behavior continue to work.

## Prerequisites

- Node 18+
- macOS/Linux/WSL recommended
- Disk space ~3–5 GB for temporary assets

## Prepare local assets

Place your two input files in the assets directory:

- assets/hsk30.txt  (the HSK 3.0 character list you provided)
- assets/frequency.csv  (your frequency list, CSV as provided)

## Build the data

1) Download data (Make Me A Hanzi + CC‑CEDICT):

```bash
node scripts/fetch-assets.js
```

2) Populate the SQLite database:

```bash
# Hanzi (characters: codepoint, pinyin, meanings, strokes, radicals)
node scripts/populate-db-kanji.js

# CC‑CEDICT words/readings/meanings
node scripts/populate-db-words.js

# Generate per-(writing,reading) ruby-like mapping with pinyin per character
node scripts/populate-db-words-pinyin.js
```

3) Build data assets:

```bash
# Per‑character info (meanings/pinyin/strokes/frequency) and Kanji (Hanzi) vocab index
node scripts/build-assets-kanji.js
node scripts/build-assets-kanji-vocab.js
node scripts/build-assets-kanji-index.js
node scripts/build-assets-word-index.js

# Components/radicals and component index for the Component Picker
node scripts/build-assets-components.js

# Stroke SVGs produced from Make Me A Hanzi paths (keeps the existing stroke UI)
node scripts/build-assets-hanzi-svg.js

# HSK deck lists + frequency deck lists (reuse the 'news-top-*' filenames to avoid UI churn)
node scripts/build-assets-hsk-kanji-list.js
node scripts/build-assets-frequency-lists.js
```

Notes:
- Sentences are optional. The app tolerates no sentence assets.

## Run the dev server

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```


## Deploy to GitHub Pages (same as original)

1) Commit the built assets in `public/` (we ship small JSON split files, so this is OK).
2) Push to a GitHub repository with Pages enabled.
3) Set Pages “Build and deployment” Source to “Deploy from a branch” and select the branch (typically main) and root.
4) If deploying to a project site (username.github.io/repo), keep 404.html and index.html SPA redirect scripts as they are.