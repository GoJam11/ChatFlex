/**
 * 国际化配置
 */
import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// 支持的语言
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// 语言显示名称 - 使用原生名称以避免循环依赖
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  'zh-CN': '简体中文', // Native name in Chinese
  'en-US': 'English'    // Native name in English
};

// 获取本地化的语言名称
export function getLocalizedLanguageName(locale: SupportedLocale, currentLocale?: SupportedLocale): string {
  const current = currentLocale || getCurrentLocale();
  
  // 如果 i18n 还未初始化，使用原生名称
  if (!i18n?.global) {
    return LOCALE_NAMES[locale];
  }
  
  // 使用 i18n 获取本地化名称
  try {
    return i18n.global.t(`settings.language.${locale === 'zh-CN' ? 'zhCN' : 'enUS'}`);
  } catch {
    return LOCALE_NAMES[locale];
  }
}

// 获取浏览器默认语言
function getBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language;
  
  // 精确匹配
  if (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale)) {
    return browserLang as SupportedLocale;
  }
  
  // 前缀匹配
  const langPrefix = browserLang.split('-')[0];
  switch (langPrefix) {
    case 'zh':
      return 'zh-CN';
    case 'en':
      return 'en-US';
    default:
      return 'zh-CN'; // 默认中文
  }
}

// 获取存储的语言设置
function getStoredLocale(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem('chatflex-locale');
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale;
    }
  } catch (error) {
    console.warn('[i18n] Failed to get stored locale setting:', error);
  }
  return null;
}

// 保存语言设置
export function saveLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem('chatflex-locale', locale);
  } catch (error) {
    console.warn('[i18n] Failed to save locale setting:', error);
  }
}

// 获取初始语言
function getInitialLocale(): SupportedLocale {
  return getStoredLocale() || getBrowserLocale();
}

// 创建i18n实例
export const i18n = createI18n({
  legacy: false, // 使用Composition API模式
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  },
  globalInjection: true,
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV
});

// 切换语言
export async function switchLocale(locale: SupportedLocale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}`);
    return;
  }

  i18n.global.locale.value = locale;
  saveLocale(locale);
  
  // 更新HTML lang属性
  document.documentElement.lang = locale;
  
  console.log(`[i18n] Language switched to: ${LOCALE_NAMES[locale]} (${locale})`);
}

// 获取当前语言
export function getCurrentLocale(): SupportedLocale {
  return i18n.global.locale.value as SupportedLocale;
}

// 获取文本方向（为将来支持RTL语言做准备）
export function getTextDirection(locale: SupportedLocale = getCurrentLocale()): 'ltr' | 'rtl' {
  // 目前支持的语言都是LTR
  return 'ltr';
}

// 格式化数字
export function formatNumber(
  value: number, 
  locale: SupportedLocale = getCurrentLocale(),
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch (error) {
    console.warn('[i18n] Number formatting failed:', error);
    return value.toString();
  }
}

// 格式化日期
export function formatDate(
  date: Date | number | string,
  locale: SupportedLocale = getCurrentLocale(),
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  } catch (error) {
    console.warn('[i18n] Date formatting failed:', error);
    return date.toString();
  }
}

// 格式化相对时间
export function formatRelativeTime(
  date: Date | number | string,
  locale: SupportedLocale = getCurrentLocale()
): string {
  try {
    const now = new Date();
    const target = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (Math.abs(diffDays) < 1) {
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      if (Math.abs(diffHours) < 1) {
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return rtf.format(diffMinutes, 'minute');
      }
      return rtf.format(diffHours, 'hour');
    }
    
    return rtf.format(diffDays, 'day');
  } catch (error) {
    console.warn('[i18n] Relative time formatting failed:', error);
    return formatDate(date, locale, { dateStyle: 'short', timeStyle: 'short' });
  }
}

// 格式化文件大小
export function formatFileSize(
  bytes: number,
  locale: SupportedLocale = getCurrentLocale()
): string {
  const units = locale === 'zh-CN' 
    ? ['字节', 'KB', 'MB', 'GB', 'TB']
    : ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
  if (bytes === 0) return `0 ${units[0]}`;
  
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  
  return `${formatNumber(size, locale, { maximumFractionDigits: 1 })} ${units[i]}`;
}

// 获取语言相关的设置
export function getLocaleSettings(locale: SupportedLocale = getCurrentLocale()) {
  return {
    locale,
    name: LOCALE_NAMES[locale],
    direction: getTextDirection(locale),
    dateFormat: locale === 'zh-CN' ? 'YYYY年MM月DD日' : 'MM/DD/YYYY',
    timeFormat: locale === 'zh-CN' ? 'HH:mm:ss' : 'h:mm:ss A',
    currency: locale === 'zh-CN' ? 'CNY' : 'USD',
    numberFormat: {
      decimal: locale === 'zh-CN' ? '.' : '.',
      thousands: locale === 'zh-CN' ? ',' : ','
    }
  };
}