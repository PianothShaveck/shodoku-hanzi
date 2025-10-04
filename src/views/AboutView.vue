<script setup lang="ts">
import { deckBrowserRoute, reviewRoute } from "../router.ts";
</script>

<template>
  <article class="about-view">
    <h2>About Shodoku (Hanzi Edition)</h2>

    <p>
      Shodoku is a minimalist study app for Chinese characters (Hanzi) with a strong
      emphasis on handwriting and context. You learn by writing characters on a large
      practice canvas, exploring their component structure, and immediately seeing
      words that use them. Spaced repetition schedules your reviews so you can
      remember efficiently.
    </p>

    <section id="section:usage">
      <h3>How to use</h3>

      <p>
        Start by
        <RouterLink :to="deckBrowserRoute">selecting a deck</RouterLink>
        (for example HSK levels or frequency lists). Decks decide which characters
        enter your review queue and in what order. You can activate multiple decks.
      </p>

      <p>
        Then
        <RouterLink :to="reviewRoute">begin a review</RouterLink>.
        You’ll usually start with handwriting practice. Use the hint button to
        reveal the next stroke when you’re unsure; you can also auto‑draw the next
        stroke and compare it with your attempt. When you’re ready, reveal the
        answer and rate the difficulty — this updates the spaced‑repetition schedule.
      </p>

      <p>
        Scroll to see each character’s components and real words that contain it.
        The writing view shows animated stroke order (centerline path) and a
        reference grid to help with proportions.
      </p>

      <ul>
        <li>Use the component picker in Dictionary to find characters by parts.</li>
        <li>Bookmark words you like (star icon) — they appear in Dictionary → Bookmarks.</li>
        <li>Settings lets you tune review limits, fuzz, and “known” thresholds.</li>
      </ul>
    </section>

    <section id="section:data-sources">
      <h3>Data Sources</h3>

      <ul>
        <li>
          Handwriting strokes and centerline paths are derived from
          <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me A Hanzi</a>.
          Component decomposition (IDS) is based on
          <a href="https://github.com/cjkvi/cjkvi-ids" target="_blank" rel="noopener">CJKVI IDS</a>.
        </li>

        <li>
          Dictionary entries (words), pinyin, and English definitions come from
          <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noopener">CC‑CEDICT</a>.
        </li>

        <li>
          HSK character lists are built from the HSK 3.0 materials (OCR’ed list).
        </li>

        <li>
          Frequency lists: this build uses a supplied character frequency file.
          If you publish a fork, please document your frequency source here.
        </li>
      </ul>

      <p class="note">
        All third‑party datasets retain their respective licenses; see their pages
        for details.
      </p>
    </section>

    <section id="section:privacy">
      <h3>Privacy & Offline</h3>

      <p>
        Shodoku is offline‑first. Reviews, decks, bookmarks, and preferences are stored
        locally in your browser. You can optionally enable a simple “remote sync”
        in Settings by pointing the app to a personal storage endpoint (e.g. a gist
        or a small server) — this is entirely under your control.
      </p>
    </section>

    <section id="section:development">
      <h3>Development</h3>

      <p>
        This project is open source under the
        <a href="https://github.com/runarberg/shodoku/blob/main/LICENSE.txt" target="_blank" rel="noopener">MIT License</a>.
        The original application was created by
        <strong>Rúnar Berg Baugsson Sigríðarson</strong>. This Hanzi‑focused fork adapts the
        data pipeline and UI wording for Chinese.
      </p>

      <ul>
        <li>
          Source code (this fork): 
          <a href="https://github.com/pianothshaveck/shodoku-hanzi" target="_blank" rel="noopener">github.com/placeholder/shodoku-hanzi</a>
          <!-- replace with your repository URL -->
        </li>
        <li>
          Issues / feedback:
          <a href="https://github.com/pianothshaveck/shodoku-hanzi/issues" target="_blank" rel="noopener">open an issue</a>
          <!-- replace with your issues URL -->
        </li>
        <li>
          Original project:
          <a href="https://github.com/runarberg/shodoku" target="_blank" rel="noopener">github.com/runarberg/shodoku</a>
        </li>
      </ul>
    </section>

    <section id="section:credits">
      <h3>Credits</h3>

      <ul>
        <li>Original author: <strong>Rúnar Berg Baugsson Sigríðarson</strong></li>
        <li>Chinese edition: <strong>Aldo Roberto Pessolano</strong></li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.about-view a {
  color: var(--accent-color);
  font-weight: 600;
  text-decoration: none;
}
.note {
  color: var(--text-light);
}
</style>