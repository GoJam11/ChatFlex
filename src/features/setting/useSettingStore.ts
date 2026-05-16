
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useStorage } from '@vueuse/core';
import type {
  MessageScrollBehavior,
  ThemeType,
} from '@/types/uiSetting';

const STORAGE_PREFIX = 'chatflex:settings:';

function key(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}

function getDefaultShortcut(): string {
  if (typeof navigator === 'undefined') {
    return 'Alt+Shift+Space';
  }
  return navigator.userAgent.indexOf('Mac') !== -1 ? 'Option+Shift+Space' : 'Alt+Shift+Space';
}

interface SettingsState {
  currentModel: string;
  currentProvider: string;
  defaultModelTemperature: number | null;
  defaultModelMaxTokens: number | null;
  enableAiSummary: boolean;
  enableSeparateSummaryModel: boolean;
  summaryModel: string;
  summaryProvider: string;
  summaryApiKey: string | null;
  summaryBaseURL: string | null;
  // 记忆模型配置
  enableSeparateMemoryModel: boolean;
  memoryModel: string;
  memoryProvider: string;
  // 默认模型配置
  enableDefaultModel: boolean;
  defaultModel: string;
  defaultProvider: string;
  enableGlobalShortcut: boolean;
  globalShortcut: string;
  sendMessageWithModifier: boolean;
  newChatShortcut: string;
  showTokenUsage: boolean;
  theme: ThemeType;
  messageScrollBehavior: MessageScrollBehavior;
  showEditConfigMenu: boolean;
  showGlobalShortcutSettings: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  currentModel: '',
  currentProvider: '',
  defaultModelTemperature: null,
  defaultModelMaxTokens: null,
  enableAiSummary: true,
  enableSeparateSummaryModel: false,
  summaryModel: '',
  summaryProvider: '',
  summaryApiKey: null,
  summaryBaseURL: null,
  // 记忆模型配置
  enableSeparateMemoryModel: false,
  memoryModel: '',
  memoryProvider: '',
  // 默认模型配置
  enableDefaultModel: false,
  defaultModel: '',
  defaultProvider: '',
  enableGlobalShortcut: false,
  globalShortcut: getDefaultShortcut(),
  sendMessageWithModifier: false,
  newChatShortcut: 'CommandOrControl+N',
  showTokenUsage: true,
  theme: 'system',
  messageScrollBehavior: 'bottom',
  showEditConfigMenu: true,
  showGlobalShortcutSettings: false,
};

export const useSettingStore = defineStore('app-settings', () => {
  const state = useStorage<SettingsState>(key('state'), DEFAULT_SETTINGS, undefined, {
    mergeDefaults: true,
    writeDefaults: true,
  });

  const bind = <K extends keyof SettingsState>(prop: K) => computed({
    get: () => state.value[prop],
    set: (value: SettingsState[K]) => {
      if (state.value[prop] === value) {
        return;
      }
      state.value = { ...state.value, [prop]: value };
    },
  });

  const isReady = computed(() => true);
  const ensureInitialized = (): Promise<void> => Promise.resolve();

  return {
    isReady,
    ensureInitialized,
    currentModel: bind('currentModel'),
    currentProvider: bind('currentProvider'),
    defaultModelTemperature: bind('defaultModelTemperature'),
    defaultModelMaxTokens: bind('defaultModelMaxTokens'),
    enableAiSummary: bind('enableAiSummary'),
    enableSeparateSummaryModel: bind('enableSeparateSummaryModel'),
    summaryModel: bind('summaryModel'),
    summaryProvider: bind('summaryProvider'),
    summaryApiKey: bind('summaryApiKey'),
    summaryBaseURL: bind('summaryBaseURL'),
    // 记忆模型配置
    enableSeparateMemoryModel: bind('enableSeparateMemoryModel'),
    memoryModel: bind('memoryModel'),
    memoryProvider: bind('memoryProvider'),
    // 默认模型配置
    enableDefaultModel: bind('enableDefaultModel'),
    defaultModel: bind('defaultModel'),
    defaultProvider: bind('defaultProvider'),
    enableGlobalShortcut: bind('enableGlobalShortcut'),
    globalShortcut: bind('globalShortcut'),
    sendMessageWithModifier: bind('sendMessageWithModifier'),
    newChatShortcut: bind('newChatShortcut'),
    showTokenUsage: bind('showTokenUsage'),
    theme: bind('theme'),
    messageScrollBehavior: bind('messageScrollBehavior'),
    showEditConfigMenu: bind('showEditConfigMenu'),
    showGlobalShortcutSettings: bind('showGlobalShortcutSettings'),
  };
});
