import { MaybeRefOrGetter, Ref, ref, toValue, watch } from "vue";

import { Sentence } from "../types.ts";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function useSentence(
  id: MaybeRefOrGetter<number>,
): Ref<Sentence | null> {
  const sentenceInfo = ref<Sentence | null>(null);

  watch(
    () => toValue(id),
    async (value) => {
      const response = await fetch(`${BASE}/data/sentences-v1/${value}.json`);
      const data = await response.json();

      sentenceInfo.value = data;
    },
    { immediate: true },
  );

  return sentenceInfo;
}