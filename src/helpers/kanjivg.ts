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
  components: ComputedRef<Map<string, KanjiComponent>>;
  syncing: Ref<boolean>;
};

const KANJIVG_NAMESPACE = "http://kanjivg.tagaini.net";
const KANJIVG_KEY: InjectionKey<KanjiVGStore> = Symbol("kanjivg");

const RADICAL_TYPES = ["general", "tradit", "nelson"];

const parser = new DOMParser();

function gatherPositions(el: SVGElement): string[] {
  const positions = [];

  let ancestor = el.closest("[data-position]");
  while (ancestor instanceof SVGElement) {
    positions.push(ancestor.dataset.position as string);
    ancestor = ancestor.parentElement?.closest("[data-position]") ?? null;
  }

  return positions;
}

export function provideKanjiVG(hex: MaybeRefOrGetter<string | null>) {
  const strokesEl = ref<SVGGElement | null>(null);
  const viewBox = ref<string | null>(null);
  const syncing = ref(false);

  watch(
    () => toValue(hex),
    async (hexValue) => {
      if (!hexValue) {
        return;
      }

      syncing.value = true;

      try {
        const response = await fetch(`/kanjivg/kanji/${hexValue}.svg`);
        const svgText = await response.text();
        const svg = parser.parseFromString(svgText, "image/svg+xml");

        if (svg.documentElement instanceof SVGSVGElement) {
          const { x, y, width, height } = svg.documentElement.viewBox.baseVal;

          viewBox.value = `${x},${y},${width},${height}`;
        }

        const strokes = svg.getElementById(
          `kvg:${hexValue}`,
        ) as SVGGElement | null;

        if (strokes) {
          for (const el of [...strokes.querySelectorAll("*"), strokes]) {
            if (!(el instanceof SVGElement)) {
              continue;
            }

            for (const attr of [...el.attributes]) {
              if (attr.namespaceURI === KANJIVG_NAMESPACE) {
                el.dataset[attr.localName] = attr.value;
                el.removeAttributeNS(KANJIVG_NAMESPACE, attr.localName);
              }
            }

            el.removeAttribute("xmlns:kvg");
          }
        }

        strokesEl.value = strokes;
      } finally {
        syncing.value = false;
      }
    },
    { immediate: true },
  );

  const components = computed(() => {
    const group = strokesEl.value;

    if (!group) {
      return new Map();
    }

    const map = new Map<string, KanjiComponent[]>();
    const radicals: Record<string, string> = {};

    function insertComponent(el: SVGGElement) {
      if (el.dataset.part && Number.parseInt(el.dataset.part) > 1) {
        return;
      }

      const literal = el.dataset.element as string;
      const info = {
        element: literal,
        original: el.dataset.original ?? null,
        position: gatherPositions(el),
        radical: el.dataset.radical ?? null,
        phon: el.dataset.phon ?? null,
      };

      let found = map.get(literal);
      if (!found) {
        found = [info];
        map.set(literal, found);
      } else {
        found.push(info);
      }

      if (info.radical) {
        radicals[info.radical] = literal;
      }
    }

    if (group.dataset.radical) {
      insertComponent(group);
    }

    for (const el of group.querySelectorAll<SVGGElement>("g[data-element]")) {
      insertComponent(el);
    }

    const sorted = new Map<string, KanjiComponent[]>();
    for (const type of RADICAL_TYPES) {
      const literal = radicals[type];
      const component = map.get(literal);
      if (component) {
        component.sort((a, b) => {
          if (a.radical) {
            if (b.radical) {
              return (
                RADICAL_TYPES.indexOf(a.radical) -
                RADICAL_TYPES.indexOf(b.radical)
              );
            }

            return -1;
          }
          if (b.radical) {
            return -1;
          }

          return 0;
        });

        sorted.set(literal, component);
        map.delete(literal);
      }
    }

    for (const [literal, component] of map) {
      sorted.set(literal, component);
    }

    return sorted;
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

  return computed(() => store?.viewBox.value ?? "0,0,109,109");
}

export function useKanjiVGComponents(): ComputedRef<
  Map<string, KanjiComponent[]>
> {
  const store = inject(KANJIVG_KEY, null);

  return computed(() => store?.components.value ?? new Map());
}

export function useKanjiVGSyncing(): ComputedRef<boolean> {
  const store = inject(KANJIVG_KEY, null);

  return computed(() => store?.syncing.value ?? false);
}
