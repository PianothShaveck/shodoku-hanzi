<script setup lang="ts">
import simplifySvgPath from "@luncheon/simplify-svg-path";
import { computed, ref, shallowReactive, watch } from "vue";
import { sleep } from "../helpers/time.ts";

const props = defineProps<{ practiceStrokes: string[]; animate?: boolean; animatePause?: boolean }>();
const emit = defineEmits<{ stroke: [value: string] }>();

type Point = { x: number; y: number };
const el = ref<SVGGElement | null>(null);
const svg = computed(() => el.value?.closest("svg"));
const viewBox = computed(() => svg.value?.viewBox.baseVal);
const points = shallowReactive<Point[]>([]);

function toSVGCoords(event: PointerEvent): Point {
  if (!svg.value) return { x: event.x, y: event.y };
  const p = svg.value.createSVGPoint();
  p.x = event.clientX; p.y = event.clientY;
  const inv = svg.value.getScreenCTM()?.inverse();
  const pt = p.matrixTransform(inv);
  return { x: pt.x, y: pt.y };
}

function handlePointerDown(e: PointerEvent) { if (!e.isPrimary) return; e.preventDefault(); el.value?.setPointerCapture(e.pointerId); points.push(toSVGCoords(e)); }
function handlePointerMove(e: PointerEvent) { if (points.length === 0 || !e.isPrimary) return; points.push(toSVGCoords(e)); }
function handlePointerUp(e: PointerEvent) { if (!e.isPrimary) return; if (points.length > 1) emit("stroke", simplifySvgPath(points)); el.value?.releasePointerCapture(e.pointerId); points.splice(0, points.length); svg.value?.parentElement?.click(); }

function strokeKeyframes(stroke: SVGPathElement): Keyframe[] { const l = stroke.getTotalLength(); return [{ strokeDasharray: l, strokeDashoffset: l }, { strokeDasharray: l, strokeDashoffset: 0 }]; }
const strokeAnimationOptions = { duration: 500, easing: "ease-in-out" };
const animations: Animation[] = [];
function startAnimation() { if (!el.value) return; for (const s of el.value.querySelectorAll<SVGPathElement>("path.stroke")) { const a = s.animate(strokeKeyframes(s), strokeAnimationOptions); a.pause(); animations.push(a); } playAnimations(); }
async function playAnimations() { let a = animations.at(0); while (a) { a.play(); await a.finished; animations.shift(); a = animations.at(0); if (a) await sleep(100); } }
watch(() => props.animate, (s) => s && startAnimation());
watch(() => props.animatePause, (p) => (p ? animations.at(0)?.pause() : animations.at(0)?.play()));
</script>

<template>
  <g ref="el" class="canvas" @pointerdown="handlePointerDown" @pointermove="handlePointerMove" @pointerup="handlePointerUp">
    <rect v-if="viewBox" class="background" :x="viewBox.x" :y="viewBox.y" :width="viewBox.width" :height="viewBox.height" />
    <g class="practice-strokes">
      <path v-for="(stroke, i) of practiceStrokes" :key="i" class="stroke practice-stroke" :d="stroke" />
    </g>
    <polyline class="stroke current-stroke" :points="points.map(({ x, y }) => `${x},${y}`).join(' ')" />
  </g>
</template>

<style scoped>
.canvas { cursor: crosshair; touch-action: none; }
.background { fill: transparent; stroke: none; }
.stroke { fill: none; stroke: #fff; stroke-width: 22px; stroke-linecap: round; stroke-linejoin: round; }
</style>