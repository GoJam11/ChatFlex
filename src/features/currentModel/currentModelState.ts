
import { computed } from "vue";
import { useSettingStore } from "@/features/setting/useSettingStore";

function store() {
  return useSettingStore();
}

export const currentModelRef = computed({
  get: () => store().currentModel || "",
  set: (value: string) => {
    store().currentModel = value;
  },
});

export const currentProviderRef = computed({
  get: () => store().currentProvider || "",
  set: (value: string) => {
    store().currentProvider = value;
  },
});

export function setCurrentModelOnly(model: string): Promise<void> {
  store().currentModel = model;
  return Promise.resolve();
}

export function setCurrentProviderOnly(provider: string): Promise<void> {
  store().currentProvider = provider;
  return Promise.resolve();
}

export function setCurrentModelAndProvider(model: string, provider: string): Promise<void> {
  const s = store();
  s.currentModel = model;
  s.currentProvider = provider;
  return Promise.resolve();
}
