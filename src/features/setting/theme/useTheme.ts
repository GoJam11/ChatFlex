import { computed, watchEffect } from "vue";
import { usePreferredColorScheme } from "@vueuse/core";
import { useSettingStore } from "@/features/setting/useSettingStore";
import type { ThemeType } from '@/types/uiSetting';

/**
 * 主题管理组合式函数
 * 用于处理应用的主题切换逻辑
 */
export function useTheme() {
    const settingStore = useSettingStore();
    const preferredColorScheme = usePreferredColorScheme();

    // 计算当前实际应用的主题
    const currentTheme = computed(() => {
        if (settingStore.theme === "system") {
            return preferredColorScheme.value === "dark" ? "dark" : "light";
        }
        return settingStore.theme;
    });

    // 应用主题到文档
    function applyTheme(theme: string) {
        if (typeof document !== "undefined") {
            const htmlElement = document.documentElement;
            
            // 移除旧的主题类
            htmlElement.classList.remove("light", "dark");
            
            // 根据当前主题设置或使用当前设置的主题
            const actualTheme = settingStore.theme === "system" ? theme : settingStore.theme;
            
            // 添加新的主题类（如果不是浅色主题）
            if (actualTheme === "dark") {
                htmlElement.classList.add("dark");
            }
            
            // 设置data属性便于CSS选择器使用
            // 如果是系统主题，设置为实际的主题值，否则设置为用户选择的主题
            htmlElement.setAttribute("data-theme", actualTheme);
        }
    }

    // 监听主题变化并应用
    watchEffect(() => {
        applyTheme(currentTheme.value);
    });

    // 设置主题
    function setTheme(theme: string) {
        settingStore.theme = theme as ThemeType;
    }

    return {
        currentTheme,
        setTheme,
        applyTheme,
    };
}