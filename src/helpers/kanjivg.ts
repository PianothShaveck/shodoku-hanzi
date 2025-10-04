import {
  computed,
  ComputedRef,
  inject,
  InjectionKey,
  MaybeRefOrGetter,
  provide,
  Ref,
  ref,
  toValue,
  watch,
} from "vue";

import { KanjiComponent } from "../types.ts";

type KanjiVGStore = {
  strokesEl: Ref<SVGGElement | null>;
  viewBox: Ref<string | null>;
  components: ComputedRef<Map<string, KanjiComponent[]>>;
  syncing: Ref<boolean>;
};

const KANJIVG_KEY: InjectionKey<KanjiVGStore> = Symbol("kanjivg");

const parser = new DOMParser();

function hexOf(h: string | null): string | null {
  if (!h) return null;
  return h.toLowerCase();
}

export function provideKanjiVG(hex: MaybeRefOrGetter<string | null>) {
  const strokesEl = ref<SVGGElement | null>(null);
  const viewBox = ref<string | null>("0,0,1024,1024");
  const syncing = ref(false);

  // cache for components json
  const compInfo = ref<{ literal: string; kanji: Record<number, string[]> } | null>(
    null,
  );

  watch(
    () => toValue(hex),
    async (value) => {
      const hv = hexOf(value);
      if (!hv) return;

      syncing.value = true;
      try {
        // 1) Fetch the stroke SVG we generated from Make Me A Hanzi
        const svgText = await fetch(`/kanjivg/kanji/${hv}.svg`).then((r) =>
          r.text(),
        );
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const g = doc.getElementById(`kvg:${hv}`) as SVGGElement | null;
        // Fallback: if no id, take the first g
        strokesEl.value =
          g ??
          (doc.querySelector("g") as SVGGElement | null) ??
          (doc.documentElement as unknown as SVGGElement);
        const vb = doc.documentElement.viewBox?.baseVal;
        if (vb) {
          viewBox.value = `${vb.x},${vb.y},${vb.width},${vb.height}`;
        } else {
          viewBox.value = "0,0,1024,1024";
        }

        // 2) Component info (precomputed JSON) for the picker & component view
        const compUrl = `/data/components-v1/${hv}.json`;
        try {
          compInfo.value = await fetch(compUrl).then((r) =>
            r.ok ? r.json() : null,
          );
        } catch {
          compInfo.value = null;
        }
      } finally {
        syncing.value = false;
      }
    },
    { immediate: true },
  );

  const components = computed(() => {
    // The original component API grouped by literal and duplicates/variations.
    // We don’t have per-part groupings in our SVG; instead, we expose a simple map
    // with one entry containing a single KanjiComponent describing the “component” itself
    // and leave the UI to use our /components-v1 files for related lists.
    const map = new Map<string, KanjiComponent[]>();
    if (compInfo.value?.literal) {
      const lit = compInfo.value.literal;
      map.set(lit, [
        {
          element: lit,
          original: null,
          position: [],
          radical: null,
          phon: null,
        },
      ]);
    }
    return map;
  });

  provide(KANJIVG_KEY, { strokesEl, viewBox, components, syncing });
}

export function useKanjiVG(): ComputedRef<SVGGElement | null> {
  const store = inject(KANJIVG_KEY, null);
  return computed(() => {
    const clone = store?.strokesEl.value?.cloneNode(true) as SVGGElement | null;
    return clone ?? null;
  });
}

export function useKanjiVGViewBox(): ComputedRef<string> {
  const store = inject(KANJIVG_KEY, null);
  return computed(() => store?.viewBox.value ?? "0,0,1024,1024");
}

export function useKanjiVGComponents(): ComputedRef<Map<string, KanjiComponent[]>> {
  const store = inject(KANJIVG_KEY, null);
  return computed(() => store?.components.value ?? new Map());
}

export function useKanjiVGSyncing(): ComputedRef<boolean> {
  const store = inject(KANJIVG_KEY, null);
  return computed(() => store?.syncing.value ?? false);
}