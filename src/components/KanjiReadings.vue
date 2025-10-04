<script setup lang="ts">
import { computed } from "vue";
import { KanjiInfo } from "../types.ts";

const props = defineProps<{ kanji: KanjiInfo }>();

const pinyin = computed(() => {
  const all = [];
  if (props.kanji.kunYomi) all.push(...props.kanji.kunYomi);
  if (props.kanji.onYomi) all.push(...props.kanji.onYomi);
  // de-duplicate
  return [...new Set(all.filter(Boolean))];
});
</script>

<template>
  <section>
    <h2>Pinyin</h2>
    <dl class="kanji-readings">
      <dt>读音</dt>
      <div class="dd-items">
        <dd v-for="reading of pinyin" :key="reading">{{ reading }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.kanji-readings {
  gap: 1em;
  display: grid;
  grid-template-columns: max-content auto;
}
.dd-items {
  gap: 0.5ex 1ex;
  display: flex;
  flex-wrap: wrap;
}
dd {
  background: oklch(from var(--background-strong) l c h / 0.6);
  border-radius: 0.5ex;
  padding-inline: 0.5ex;
  margin: 0;
}
dt {
  font-weight: 600;
}
</style>