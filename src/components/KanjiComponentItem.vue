<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { kanjiComponentRoute } from "../router.ts";
import type { KanjiComponent } from "../types.ts";

const props = defineProps<{
  literal: string;
  original?: string | null;
  parts?: KanjiComponent[];
}>();

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

const svgEl = ref<SVGSVGElement | null>(null);
const groupContainer = ref<SVGGElement | null>(null);
const hasStrokes = ref(false);
const viewBox = ref("0,0,1024,1024");

async function loadSvg(char: string) {
  hasStrokes.value = false;
  const cp = [...char][0].codePointAt(0) ?? 0;
  const hex = cp.toString(16).padStart(5, "0");
  const url = `${BASE}/kanjivg/kanji/${hex}.svg`;

  try {
    const svgText = await fetch(url).then((r) => (r.ok ? r.text() : ""));
    if (!svgText) {
      hasStrokes.value = false;
      groupContainer.value?.replaceChildren();
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgRoot = doc.documentElement as unknown as SVGSVGElement;
    const vb = svgRoot.viewBox?.baseVal;
    if (vb) viewBox.value = `${vb.x},${vb.y},${vb.width},${vb.height}`;
    else viewBox.value = "0,0,1024,1024";

    const g = svgRoot.querySelector("g") as SVGGElement | null;
    if (!g) {
      hasStrokes.value = false;
      groupContainer.value?.replaceChildren();
      return;
    }

    hasStrokes.value = true;
    const clone = g.cloneNode(true) as SVGGElement;
    groupContainer.value?.replaceChildren(clone);
  } catch {
    hasStrokes.value = false;
    groupContainer.value?.replaceChildren();
  }
}

watch(() => props.literal, (ch) => ch && loadSvg(ch), { immediate: true });
onMounted(() => props.literal && loadSvg(props.literal));
</script>

<template>
  <RouterLink :to="kanjiComponentRoute(literal)" class="component-item">
    <svg v-if="hasStrokes" ref="svgEl" :viewBox="viewBox" class="mini">
      <g ref="groupContainer" class="mini-strokes" />
    </svg>
    <div v-else class="mini mini-fallback">
      <span class="text">{{ literal }}</span>
    </div>

    <span class="label">{{ literal }}</span>
  </RouterLink>
</template>

<style scoped>
.component-item { display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; color: inherit; }
.mini { background: var(--background-strong); width: 2.8rem; height: 2.8rem; border-radius: 6px; display: inline-block; flex-shrink: 0; }
.mini-strokes :deep(path) { stroke: #fff; stroke-width: 2px; stroke-linecap: round; stroke-linejoin: round; fill: none; }
.mini-fallback { display: inline-flex; align-items: center; justify-content: center; }
.mini-fallback .text { font-size: 1.6rem; line-height: 1; }
.label { font-size: 1.2rem; }
</style>