<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useRoute } from "vue-router";
import KanjiComponentItem from "./KanjiComponentItem.vue";

const props = defineProps<{ literal?: string | null }>();

const UNIT_SEP = "\u241f";
const RECORD_SEP = "\u241e";
const INDEX_URL = `${import.meta.env.BASE_URL}data/index/kanji-radicals-v1.usv`;

let INDEX_TEXT = "";
let INDEX_MAP: Map<string, string> | null = null;

const route = useRoute();
const currentLiteral = computed(() => {
  if (props.literal && [...props.literal].length === 1) return props.literal;
  const p = route.params.kanji;
  if (typeof p === "string" && [...p].length === 1) return p;
  return null;
});

const components = ref<string[]>([]);

function isLikelyComponentChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (!cp) return false;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df) ||
    (cp >= 0x2a700 && cp <= 0x2b73f) ||
    (cp >= 0x2b740 && cp <= 0x2b81f) ||
    (cp >= 0x2b820 && cp <= 0x2ceaf) ||
    (cp >= 0x2e80 && cp <= 0x2eff) ||
    (cp >= 0x2f00 && cp <= 0x2fd5) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

async function loadIndexOnce() {
  if (INDEX_TEXT) return;
  const txt = await fetch(INDEX_URL).then((r) => r.text());
  INDEX_TEXT = txt.replace(/^\uFEFF/, "").replace(/\r/g, "");
}

function buildIndexMap() {
  if (INDEX_MAP) return;
  INDEX_MAP = new Map();
  const lines = INDEX_TEXT.split("\n");

  for (const line of lines) {
    if (!line) continue;
    const iUnit = line.indexOf(UNIT_SEP);
    if (iUnit < 0) continue;
    const lit = line.slice(0, iUnit);
    const iRec1 = line.indexOf(RECORD_SEP, iUnit + 1);
    if (iRec1 < 0) continue;
    const iRec2 = line.indexOf(RECORD_SEP, iRec1 + 1);
    if (iRec2 < 0) continue;
    const radicalsJoined = line.slice(iRec1 + 1, iRec2);
    INDEX_MAP.set(lit, radicalsJoined);
  }
}

function refresh() {
  const lit = currentLiteral.value;
  if (!lit || !INDEX_MAP) {
    components.value = [];
    return;
  }

  const radJoined = INDEX_MAP.get(lit) ?? "";
  if (!radJoined) {
    components.value = [];
    return;
  }

  const list: string[] = [];
  for (const c of radJoined) if (isLikelyComponentChar(c)) list.push(c);

  const seen = new Set<string>();
  components.value = list.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));
}

onMounted(async () => {
  await loadIndexOnce();
  buildIndexMap();
  refresh();
});
watch(currentLiteral, refresh);
</script>

<template>
  <section>
    <h2>
      Components
      <template v-if="components.length > 0"> ({{ components.length }}) </template>
    </h2>

    <ul class="component-list" v-if="components.length > 0">
      <li v-for="c in components" :key="c">
        <KanjiComponentItem :literal="c" :parts="[]" />
      </li>
    </ul>
    <p v-else>No components found.</p>
  </section>
</template>

<style scoped>
.component-list {
  display: grid;
  gap: 1ex;
  grid-template-columns: 1fr 1fr;
  list-style: none;
  margin: 0;
  padding: 0;
  @media screen and (max-width: 60ch) {
    display: flex; flex-direction: column;
  }
}
</style>