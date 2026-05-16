/**
 * UI设置相关类型定义
 */

// 主题类型
export type ThemeType = "light" | "dark" | "system";

// 消息滚动行为类型
export type MessageScrollBehavior = "top" | "bottom";

/**
 * 模型总结配置接口
 */
export interface SummaryConfig {
  enabled: boolean;
  model?: string;
  provider?: string;
  apiKey?: string;
  baseURL?: string;
  useSeparateModel?: boolean;
}

/**
 * 快捷键配置接口
 */
export interface ShortcutConfig {
  globalShortcutEnabled: boolean;
  globalShortcut: string;
  sendMessageWithModifier: boolean;
  newChatShortcut: string;
}

/**
 * 完整UI设置接口
 */
export interface UISetting {
  // 总结相关设置
  summary: SummaryConfig;

  // 快捷键相关设置
  shortcuts: ShortcutConfig;

  // UI显示设置
  showTokenUsage: boolean;
  theme: ThemeType;
  messageScrollBehavior: MessageScrollBehavior;
  showEditConfigMenu: boolean;
  showGlobalShortcutSettings: boolean;
}
