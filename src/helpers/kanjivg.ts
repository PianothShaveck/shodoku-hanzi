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

const KANJIVG_KEY: InjectionKey<KanjiVGStore> = Symbol("kanjivg");
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

type KanjiVGStore = {
  strokesEl: Ref<SVGGElement | null>;
  viewBox: Ref<string | null>;
  components: ComputedRef<Map<string, KanjiComponent[]>>;
  syncing: Ref<boolean>;
};

const parser = new DOMParser();

function hexOf(h: string | null): string | null {
  if (!h) return null;
  return h.toLowerCase();
}

export function provideKanjiVG(hex: MaybeRefOrGetter<string | null>) {
  const strokesEl = ref<SVGGElement | null>(null);
  const viewBox = ref<string | null>("0,0,1024,1024");
  const syncing = ref(false);

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
        const svgText = await fetch(`${BASE}/kanjivg/kanji/${hv}.svg`).then((r) =>
          r.text(),
        );
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const g = doc.querySelector("g") as SVGGElement | null;
        strokesEl.value = g ?? (doc.documentElement as unknown as SVGGElement);

        const vb = (doc.documentElement as unknown as SVGSVGElement).viewBox?.baseVal;
        if (vb) viewBox.value = `${vb.x},${vb.y},${vb.width},${vb.height}`;
        else viewBox.value = "0,0,1024,1024";

        const compUrl = `${BASE}/data/components-v1/${hv}.json`;
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