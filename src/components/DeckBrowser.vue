<script setup lang="ts">
import { hskDecks, newsFrequencyDecks } from "../helpers/decks.ts";
import DeckBrowserCategory from "./DeckBrowserCategory.vue";
import DeckBrowserCustom from "./DeckBrowserCustom.vue";
</script>

<template>
  <ul class="categories">
    <li>
      <DeckBrowserCategory
        title="HSK"
        category="hsk"
        :deck-templates="hskDecks"
      />
    </li>

    <li>
      <DeckBrowserCategory
        title="Frequency"
        category="freq"
        :deck-templates="newsFrequencyDecks"
      />
    </li>

    <li>
      <DeckBrowserCustom />
    </li>
  </ul>
</template>

<style scoped>
.categories {
  list-style: none;
  margin: 0;
  padding: 0;

  & > li:not(:first-child) {
    margin-block-start: 1em;
  }
}
</style>