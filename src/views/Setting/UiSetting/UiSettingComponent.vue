<template>
    <div class="flex flex-col gap-6">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">{{ t('settings.uiSettings.pageTitle') }}</h2>
                <p class="text-sm text-text-300 mt-1">
                    {{ t('settings.uiSettings.pageDescription') }}
                </p>
            </div>
        </div>

    <!-- 界面显示 -->
    <div>
        <p class="section-title">
            {{ t('settings.uiSettings.interfaceDisplay') }}
        </p>
        <Card>
            <CardContent class="space-y-4">
                <!-- 显示Token用量 -->
                <div class="flex items-center justify-between">
                    <span class="setting-label">{{ t('settings.uiSettings.showTokenUsage') }}</span>
                    <Switch
                        :model-value="showTokenUsage"
                        @update:model-value="updateShowTokenUsage"
                    />
                </div>
                <p class="setting-description">
                    {{ t('settings.uiSettings.showTokenUsageDesc') }}
                </p>

                <!-- 语言设置 -->
                <div class="flex items-center justify-between">
                    <span class="setting-label">{{ $t('common.language') }}</span>
                    <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                        <Select
                            :model-value="currentLocale"
                            @update:model-value="(value) => value && changeLocale(value as any)"
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue :placeholder="$t('common.language')" />
                            </SelectTrigger>
                            <SelectContent
                                :side-offset="5"
                                :collision-padding="{ top: 100 }"
                            >
                                <SelectItem
                                    v-for="locale in availableLocales"
                                    :key="locale.code"
                                    :value="locale.code"
                                >
                                    {{ locale.name }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p class="setting-description">
                    {{ t('settings.language.description') }}
                </p>

                <!-- 外观主题 由于windows theme需要rust调整 先不支持 -->
                <!-- <div class="flex items-center justify-between">
                    <span class="setting-label">{{ $t('setting.theme') }}</span>
                    <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                        <Select
                            :model-value="theme"
                            @update:model-value="(value) => value && updateTheme(value as ThemeType)"
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue :placeholder="$t('setting.theme')" />
                            </SelectTrigger>
                            <SelectContent
                                :side-offset="5"
                                :collision-padding="{ top: 100 }"
                            >
                                <SelectItem value="light">
                                    {{ $t('setting.lightMode') }}
                                </SelectItem>
                                <SelectItem value="dark">
                                    {{ $t('setting.darkMode') }}
                                </SelectItem>
                                <SelectItem value="system">
                                    {{ $t('setting.systemMode') }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p class="setting-description">
                    {{ t('settings.theme.description') }}
                </p> -->
            </CardContent>
        </Card>
    </div>

    <!-- 快捷键设置 -->
    <div>
        <p class="section-title">
            {{ t('settings.uiSettings.shortcuts') }}
        </p>
        <Card>
            <CardContent class="space-y-4">
                <!-- 全局快捷键 -->
                <div
                    v-if="showGlobalShortcutSettings"
                    class="flex items-center justify-between"
                >
                    <span class="setting-label">{{ t('settings.uiSettings.globalShortcut') }}</span>
                    <Switch
                        :model-value="enableGlobalShortcut"
                        @update:model-value="handleGlobalShortcutToggle"
                    />
                </div>
                <p
                    v-if="showGlobalShortcutSettings"
                    class="setting-description"
                >
                    {{ t('settings.uiSettings.globalShortcutDesc') }}
                </p>

                <!-- 快捷键配置 -->
                <div
                    v-if="showGlobalShortcutSettings && enableGlobalShortcut"
                    class="flex items-start justify-between"
                >
                    <span class="setting-label">{{ t('settings.uiSettings.shortcutCombo') }}</span>
                    <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                        <div class="flex items-center gap-2 w-full">
                            <Input
                                ref="shortcutInput"
                                v-model="currentShortcut"
                                :placeholder="globalShortcut"
                                readonly
                                class="flex-1"
                                @keydown="handleShortcutKeydown"
                                @focus="isRecording = true"
                                @blur="handleShortcutBlur"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                @click="resetToDefault"
                            >
                                {{ t('settings.uiSettings.reset') }}
                            </Button>
                        </div>
                        <span class="setting-hint text-xs text-right">
                            {{
                                isRecording
                                    ? t('settings.uiSettings.recordingHint')
                                    : t('settings.uiSettings.shortcutHint')
                            }}
                        </span>
                        <span
                            v-if="shortcutError"
                            class="setting-hint text-red-500 text-xs text-right"
                        >
                            {{ shortcutError }}
                        </span>
                    </div>
                </div>

                <!-- 发送消息快捷键 -->
                <div class="flex items-center justify-between">
                    <span class="setting-label">{{ t('settings.uiSettings.sendShortcut') }}</span>
                    <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                        <Select
                            :model-value="
                                sendMessageWithModifier
                                    ? 'modifier'
                                    : 'enter'
                            "
                            @update:model-value="
                                (value) =>
                                    updateSendMessageWithModifier(
                                        value === 'modifier'
                                    )
                            "
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                                :side-offset="5"
                                :collision-padding="{ top: 100 }"
                            >
                                <SelectItem value="enter">
                                    {{ t('settings.uiSettings.enterSend') }}
                                </SelectItem>
                                <SelectItem value="modifier">
                                    {{ t('settings.uiSettings.ctrlEnterSend') }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p class="setting-description">
                    {{ t('settings.uiSettings.sendShortcutDesc') }}
                </p>

                <!-- 新建会话快捷键 -->
                <div
                    v-if="envStore.showSomeShortCuts"
                    class="flex items-center justify-between"
                >
                    <span class="setting-label">{{ t('settings.uiSettings.newChatShortcut') }}</span>
                    <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                        <div class="shortcut-display">
                            {{ newChatShortcutDisplay }}
                        </div>
                    </div>
                </div>
                <p
                    v-if="envStore.showSomeShortCuts"
                    class="setting-description"
                >
                    {{ t('settings.uiSettings.newChatShortcutDesc') }}
                </p>
            </CardContent>
        </Card>
    </div>
    </div>
</template>


<script setup lang="ts">
import { computed, ref } from "vue";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useEnvStore } from "@/features/app/useEnvStore.ts";
import type { ThemeType } from "@/types/uiSetting";
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/features/setting/useSettingStore";
import { useI18n } from "vue-i18n";
import { getCurrentLocale, switchLocale, SUPPORTED_LOCALES, LOCALE_NAMES, type SupportedLocale } from "@/i18n";

const envStore = useEnvStore();
const settingStore = useSettingStore();
const {
    showTokenUsage,
    enableGlobalShortcut,
    globalShortcut,
    sendMessageWithModifier,
    showGlobalShortcutSettings,
    theme,
} = storeToRefs(settingStore);

const { t } = useI18n();

const currentLocale = computed(() => getCurrentLocale());
const availableLocales = computed(() =>
    SUPPORTED_LOCALES.map((code) => ({
        code,
        name: LOCALE_NAMES[code],
    }))
);

const changeLocale = async (locale: SupportedLocale) => {
    await switchLocale(locale);
};

const isRecording = ref(false);
const currentShortcut = ref("");
const shortcutError = ref("");
const shortcutInput = ref<HTMLInputElement>();

const globalShortcutError = ref("");

async function toggleShortcut(enabled: boolean): Promise<boolean> {
    void enabled;
    globalShortcutError.value = "";
    return true;
}

async function updateShortcut(shortcut: string): Promise<boolean> {
    void shortcut;
    globalShortcutError.value = "";
    return true;
}

const newChatShortcutDisplay = computed(() => {
    const isMac = navigator.userAgent.indexOf("Mac") !== -1;
    return isMac ? "⌘ + N" : "Ctrl + N";
});

function updateShowTokenUsage(show: boolean) {
    showTokenUsage.value = show;
}

function updateSendMessageWithModifier(withModifier: boolean) {
    sendMessageWithModifier.value = withModifier;
}

async function handleGlobalShortcutToggle(enabled: boolean) {
    enableGlobalShortcut.value = enabled;
    const success = await toggleShortcut(enabled);
    if (success) {
        shortcutError.value = "";
    } else {
        shortcutError.value = globalShortcutError.value;
    }
}

function formatShortcut(keys: string[]): string {
    const isMac = navigator.userAgent.indexOf("Mac") !== -1;

    const keyMap: Record<string, string> = {
        Meta: "Command",
        Control: "CommandOrControl",
        Ctrl: "CommandOrControl",
        Alt: isMac ? "Option" : "Alt",
        Shift: "Shift",
        Space: "Space",
        Return: "Return",
        Tab: "Tab",
        Escape: "Escape",
    };

    return keys
        .filter((key) => key && key.trim())
        .map((key) => keyMap[key] || key.toUpperCase())
        .join("+");
}

function handleShortcutKeydown(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isRecording.value) return;

    const keys: string[] = [];

    if (event.metaKey) keys.push("Meta");
    if (event.ctrlKey) keys.push("Control");
    if (event.altKey) keys.push("Alt");
    if (event.shiftKey) keys.push("Shift");

    let mainKey = event.key;
    if (["Meta", "Control", "Alt", "Shift"].includes(mainKey)) {
        return;
    }

    if (mainKey === " ") {
        mainKey = "Space";
    } else if (mainKey === "Escape") {
        mainKey = "Escape";
    } else if (mainKey === "Tab") {
        mainKey = "Tab";
    } else if (mainKey === "Enter") {
        mainKey = "Return";
    } else if (event.code === "Space") {
        mainKey = "Space";
    } else if (event.altKey && event.code.startsWith("Key")) {
        mainKey = event.code.substring(3);
    } else if (event.altKey && event.code.startsWith("Digit")) {
        mainKey = event.code.substring(5);
    }

    if (mainKey && (mainKey === "Space" || mainKey.trim())) {
        keys.push(mainKey);

        if (keys.length < 2) {
            shortcutError.value = "快捷键需要包含至少一个修饰键（Command/Ctrl/Option/Shift）";
            return;
        }

        const formattedShortcut = formatShortcut(keys);
        currentShortcut.value = formattedShortcut;
        void applyNewShortcut(formattedShortcut);
    }
}

async function applyNewShortcut(shortcut: string) {
    try {
        const success = await updateShortcut(shortcut);
        if (success) {
            globalShortcut.value = shortcut;
            shortcutError.value = "";
        } else {
            shortcutError.value = globalShortcutError.value;
        }
    } catch (error) {
        shortcutError.value = `更新失败: ${error}`;
    }

    isRecording.value = false;
    shortcutInput.value?.blur();
}

function handleShortcutBlur() {
    setTimeout(() => {
        isRecording.value = false;
        currentShortcut.value = "";
    }, 100);
}

async function resetToDefault() {
    const defaultShortcut =
        navigator.userAgent.indexOf("Mac") !== -1
            ? "Option+Space"
            : "Alt+Space";

    await applyNewShortcut(defaultShortcut);
}

function updateTheme(value: ThemeType) {
    theme.value = value;
}
</script>


<style scoped>
/* 设置标签 */
.setting-label {
    display: block;
    color: var(--color-text);
    font-size: 0.875rem;
}

/* 提示文字 */
.setting-hint {
    font-size: 0.75rem;
    color: var(--text-secondary-color);
}

/* 描述文字 */
.setting-description {
    font-size: 0.75rem;
    color: var(--text-secondary-color);
    line-height: 1.5;
}

/* 标题样式 */
.section-title {
    font-weight: bold;
    color: var(--color-text);
    margin-bottom: 0.5rem;
}

/* 快捷键显示样式 */
.shortcut-display {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas,
        "Liberation Mono", Menlo, monospace;
    text-align: center;
    min-width: 80px;
}
</style>
