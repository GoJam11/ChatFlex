import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useStorage } from '@vueuse/core';

const STORAGE_KEY = 'chatflex:memory:state';

interface MemoryState {
  content: string;
  lastUpdated: number | null;
  isGenerating: boolean;
  memoryEnabled: boolean;
}

const DEFAULT_STATE: MemoryState = {
  content: '',
  lastUpdated: null,
  isGenerating: false,
  memoryEnabled: true,
};

export const useMemoryStore = defineStore('memory', () => {
  const state = useStorage<MemoryState>(STORAGE_KEY, DEFAULT_STATE, undefined, {
    mergeDefaults: true,
    writeDefaults: true,
  });

  const content = computed({
    get: () => state.value.content,
    set: (value: string) => {
      state.value = { ...state.value, content: value };
    },
  });

  const lastUpdated = computed({
    get: () => state.value.lastUpdated,
    set: (value: number | null) => {
      state.value = { ...state.value, lastUpdated: value };
    },
  });

  const isGenerating = computed({
    get: () => state.value.isGenerating,
    set: (value: boolean) => {
      state.value = { ...state.value, isGenerating: value };
    },
  });

  const memoryEnabled = computed({
    get: () => state.value.memoryEnabled,
    set: (value: boolean) => {
      state.value = { ...state.value, memoryEnabled: value };
    },
  });

  const hasMemory = computed(() => content.value.trim().length > 0);

  function setMemory(text: string) {
    content.value = text;
    lastUpdated.value = Date.now();
  }

  function clearMemory() {
    content.value = '';
    lastUpdated.value = null;
  }

  return {
    content,
    lastUpdated,
    isGenerating,
    memoryEnabled,
    hasMemory,
    setMemory,
    clearMemory,
  };
});
