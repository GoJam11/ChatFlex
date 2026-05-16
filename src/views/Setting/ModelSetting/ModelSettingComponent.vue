<template>
    <div class="flex flex-col gap-6">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-text-100">{{ t('settings.modelSettings.pageTitle') }}</h2>
                <p class="text-sm text-text-300 mt-1">
                    {{ t('settings.modelSettings.pageDescription') }}
                </p>
            </div>
        </div>

        <!-- 默认模型 -->
        <div>
            <p class="section-title">
                {{ t('settings.modelSettings.defaultModel') }}
            </p>
            <Card>
                <CardContent class="space-y-4">
                    <!-- 启用默认模型开关 -->
                    <div class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.modelSettings.enableDefaultModel') }}</span>
                        <Switch
                            :model-value="enableDefaultModel"
                            @update:model-value="updateEnableDefaultModel"
                        />
                    </div>
                    <p class="setting-description">
                        {{ t('settings.modelSettings.enableDefaultModelDesc') }}
                    </p>

                    <!-- 默认模型选择器 -->
                    <div v-if="enableDefaultModel" class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.modelSettings.selectDefaultModel') }}</span>
                        <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                            <Select
                                :model-value="selectedDefaultModelKey"
                                :disabled="!hasAvailableModels"
                                @update:model-value="(value: any) => selectedDefaultModelKey = String(value || '')"
                            >
                                <SelectTrigger class="w-full">
                                    <SelectValue :placeholder="t('settings.modelSettings.selectDefaultModelPlaceholder')" />
                                </SelectTrigger>
                                <SelectContent
                                    :side-offset="5"
                                    :collision-padding="{ top: 100 }"
                                >
                                    <SelectItem
                                        v-for="option in modelOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <span
                                v-if="enableDefaultModel && !hasAvailableModels"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.modelSettings.noModelsConfigured') }}
                            </span>
                            <span
                                v-else-if="enableDefaultModel && !selectedDefaultModelKey"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.modelSettings.defaultModelRequired') }}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 总结模型 -->
        <div>
            <p class="section-title">
                {{ t('settings.modelSettings.summaryModel') }}
            </p>
            <Card>
                <CardContent class="space-y-4">
                    <!-- AI 总结会话开关 -->
                    <div class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.uiSettings.aiSummary') }}</span>
                        <Switch
                            :model-value="enableAiSummary"
                            @update:model-value="updateSummaryEnabled"
                        />
                    </div>
                    <p class="setting-description">
                        {{ t('settings.uiSettings.aiSummaryDesc') }}
                    </p>

                    <!-- 是否使用单独的总结模型 -->
                    <div
                        v-if="enableAiSummary"
                        class="flex items-center justify-between"
                    >
                        <span class="setting-label">{{ t('settings.uiSettings.separateModel') }}</span>
                        <Switch
                            :model-value="enableSeparateSummaryModel"
                            @update:model-value="updateSeparateSummaryModel"
                        />
                    </div>
                    <p
                        v-if="enableAiSummary"
                        class="setting-description"
                    >
                        {{ t('settings.uiSettings.separateModelDesc') }}
                    </p>

                    <!-- 总结模型选择器 -->
                    <div v-if="showSummaryModelSelector" class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.uiSettings.summaryModel') }}</span>
                        <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                            <Select
                                :model-value="selectedSummaryModelKey"
                                :disabled="!hasAvailableModels"
                                @update:model-value="(value: any) => selectedSummaryModelKey = String(value || '')"
                            >
                                <SelectTrigger class="w-full">
                                    <SelectValue :placeholder="t('settings.uiSettings.selectSummaryModel')" />
                                </SelectTrigger>
                                <SelectContent
                                    :side-offset="5"
                                    :collision-padding="{ top: 100 }"
                                >
                                    <SelectItem
                                        v-for="option in modelOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <span
                                v-if="enableSeparateSummaryModel && !hasAvailableModels"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.uiSettings.noModelsConfigured') }}
                            </span>
                            <span
                                v-else-if="enableSeparateSummaryModel && !selectedSummaryModelKey"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.uiSettings.summaryModelRequired') }}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 记忆模型 -->
        <div>
            <p class="section-title">
                {{ t('settings.modelSettings.memoryModel') }}
            </p>
            <Card>
                <CardContent class="space-y-4">
                    <!-- 是否使用单独的记忆模型 -->
                    <div class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.modelSettings.enableSeparateMemoryModel') }}</span>
                        <Switch
                            :model-value="enableSeparateMemoryModel"
                            @update:model-value="updateSeparateMemoryModel"
                        />
                    </div>
                    <p class="setting-description">
                        {{ t('settings.modelSettings.enableSeparateMemoryModelDesc') }}
                    </p>

                    <!-- 记忆模型选择器 -->
                    <div v-if="enableSeparateMemoryModel" class="flex items-center justify-between">
                        <span class="setting-label">{{ t('settings.modelSettings.selectMemoryModel') }}</span>
                        <div class="flex flex-col items-end gap-1 flex-1 max-w-xs">
                            <Select
                                :model-value="selectedMemoryModelKey"
                                :disabled="!hasAvailableModels"
                                @update:model-value="(value: any) => selectedMemoryModelKey = String(value || '')"
                            >
                                <SelectTrigger class="w-full">
                                    <SelectValue :placeholder="t('settings.modelSettings.selectMemoryModel')" />
                                </SelectTrigger>
                                <SelectContent
                                    :side-offset="5"
                                    :collision-padding="{ top: 100 }"
                                >
                                    <SelectItem
                                        v-for="option in modelOptions"
                                        :key="option.value"
                                        :value="option.value"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <span
                                v-if="enableSeparateMemoryModel && !hasAvailableModels"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.modelSettings.noModelsConfigured') }}
                            </span>
                            <span
                                v-else-if="enableSeparateMemoryModel && !selectedMemoryModelKey"
                                class="setting-hint text-red-500 text-xs text-right"
                            >
                                {{ t('settings.modelSettings.memoryModelRequired') }}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>


<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/features/setting/useSettingStore";
import { useI18n } from "vue-i18n";
import { useProviderService } from '@/features/provider/providerService';

const providerService = useProviderService();
const settingStore = useSettingStore();
const {
    enableAiSummary,
    enableSeparateSummaryModel,
    summaryModel,
    summaryProvider,
    enableDefaultModel,
    defaultModel,
    defaultProvider,
    enableSeparateMemoryModel,
    memoryModel,
    memoryProvider,
} = storeToRefs(settingStore);

const { t } = useI18n();

const hasAvailableModels = computed(() =>
    providerService.activeProviders.value.some(
        (provider) => (provider.selectedModels || []).length > 0
    )
);

const showSummaryModelSelector = computed(
    () => enableAiSummary.value && enableSeparateSummaryModel.value
);

const modelOptions = computed(() => {
    const options: Array<{ label: string; value: string }> = [];

    providerService.activeProviders.value.forEach((provider) => {
        const selectedModels = provider.selectedModels || [];
        selectedModels.forEach((model) => {
            options.push({
                label: `${model} (${provider.displayName || provider.key})`,
                value: `${provider.key}/${model}`,
            });
        });
    });

    return options;
});

// 默认模型选择器
const selectedDefaultModelKey = computed({
    get: () => {
        if (defaultProvider.value && defaultModel.value) {
            return `${defaultProvider.value}/${defaultModel.value}`;
        }
        return "";
    },
    set: (value: string) => {
        if (value) {
            const separatorIndex = value.indexOf("/");
            if (separatorIndex !== -1) {
                defaultProvider.value = value.substring(0, separatorIndex);
                defaultModel.value = value.substring(separatorIndex + 1);
                return;
            }
        }

        defaultProvider.value = "";
        defaultModel.value = "";
    },
});

// 总结模型选择器
const selectedSummaryModelKey = computed({
    get: () => {
        if (summaryProvider.value && summaryModel.value) {
            return `${summaryProvider.value}/${summaryModel.value}`;
        }
        return "";
    },
    set: (value: string) => {
        if (value) {
            const separatorIndex = value.indexOf("/");
            if (separatorIndex !== -1) {
                summaryProvider.value = value.substring(0, separatorIndex);
                summaryModel.value = value.substring(separatorIndex + 1);
                return;
            }
            const colonIndex = value.indexOf(":");
            if (colonIndex !== -1) {
                summaryProvider.value = value.substring(0, colonIndex);
                summaryModel.value = value.substring(colonIndex + 1);
                return;
            }
        }

        summaryProvider.value = "";
        summaryModel.value = "";
    },
});

// 记忆模型选择器
const selectedMemoryModelKey = computed({
    get: () => {
        if (memoryProvider.value && memoryModel.value) {
            return `${memoryProvider.value}/${memoryModel.value}`;
        }
        return "";
    },
    set: (value: string) => {
        if (value) {
            const separatorIndex = value.indexOf("/");
            if (separatorIndex !== -1) {
                memoryProvider.value = value.substring(0, separatorIndex);
                memoryModel.value = value.substring(separatorIndex + 1);
                return;
            }
        }

        memoryProvider.value = "";
        memoryModel.value = "";
    },
});

watch(
    () => modelOptions.value,
    (newOptions, oldOptions) => {
        if (newOptions.length > 0 && oldOptions && oldOptions.length > 0) {
            // 检查总结模型
            const summaryKey = selectedSummaryModelKey.value;
            if (summaryKey && !newOptions.some((option) => option.value === summaryKey)) {
                selectedSummaryModelKey.value = "";
            }
            // 检查默认模型
            const defaultKey = selectedDefaultModelKey.value;
            if (defaultKey && !newOptions.some((option) => option.value === defaultKey)) {
                selectedDefaultModelKey.value = "";
            }
            // 检查记忆模型
            const memoryKey = selectedMemoryModelKey.value;
            if (memoryKey && !newOptions.some((option) => option.value === memoryKey)) {
                selectedMemoryModelKey.value = "";
            }
        }
    }
);

onMounted(() => {
    const legacyKey = localStorage.getItem("chat/summaryModelKey");
    if (!summaryProvider.value && !summaryModel.value && legacyKey && legacyKey.includes(":")) {
        const colonIndex = legacyKey.indexOf(":");
        summaryProvider.value = legacyKey.substring(0, colonIndex);
        summaryModel.value = legacyKey.substring(colonIndex + 1);
        localStorage.removeItem("chat/summaryModelKey");
        console.log("[ModelSetting] Migrated legacy summary model selection.");
    }
});

function updateEnableDefaultModel(enabled: boolean) {
    enableDefaultModel.value = enabled;
}

function updateSummaryEnabled(enabled: boolean) {
    enableAiSummary.value = enabled;
}

function updateSeparateSummaryModel(enabled: boolean) {
    enableSeparateSummaryModel.value = enabled;
}

function updateSeparateMemoryModel(enabled: boolean) {
    enableSeparateMemoryModel.value = enabled;
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
</style>
