<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ viewBox: string }>();

const box = computed(() => {
  const [x, y, width, height] = props.viewBox.split(",");
  return {
    x: Number.parseInt(x),
    y: Number.parseInt(y),
    width: Number.parseInt(width),
    height: Number.parseInt(height),
  };
});

const midLineX = computed(() => box.value.x + box.value.width / 2);
const midLineY = computed(() => box.value.y + box.value.height / 2);
</script>

<template>
  <g class="kanji-strokes-background">
    <rect
      class="background"
      :x="box.x"
      :y="box.y"
      :width="box.width"
      :height="box.height"
      rx="5"
    />
    <line class="midline" :x1="box.x + 8" :y1="midLineY" :x2="box.x + box.width - 8" :y2="midLineY" />
    <line class="midline" :x1="midLineX" :y1="box.y + 8" :x2="midLineX" :y2="box.y + box.height - 8" />

    <line class="quartline" :x1="midLineX / 2" :y1="box.y + 8" :x2="midLineX / 2" :y2="box.y + box.height - 8" />
    <line class="quartline" :x1="(3 * midLineX) / 2" :y1="box.y + 8" :x2="(3 * midLineX) / 2" :y2="box.y + box.height - 8" />
    <line class="quartline" :x1="box.x + 8" :y1="midLineY / 2" :x2="box.x + box.width - 8" :y2="midLineY / 2" />
    <line class="quartline" :x1="box.x + 8" :y1="(3 * midLineY) / 2" :x2="box.x + box.width - 8" :y2="(3 * midLineY) / 2" />
  </g>
</template>

<style scoped>
.background { fill: var(--background-strong); }
.midline, .quartline { stroke: rgba(255,255,255,0.35); }
.midline    { stroke-width: 6px; stroke-dasharray: 20 20; stroke-linecap: round; }
.quartline  { stroke-width: 3px; stroke-dasharray: 10 18; stroke-linecap: round; }
</style>