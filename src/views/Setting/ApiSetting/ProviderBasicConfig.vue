<script setup lang="ts">
import { computed, ref } from "vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import { Provider } from "@/types";
import { Eye, EyeOff, RotateCcw } from "lucide-vue-next";
import { useProviderService } from '@/features/provider/providerService';
import { isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { providerConfigs } from '@/config/provider';

interface Props {
    selectedProvider: Provider;
}

const props = defineProps<Props>();
const providerService = useProviderService();
const { t } = useI18n();
// Using vue-sonner for toast notifications

// API密钥显示状态
const showApiKey = ref(false);

const fullUrl = computed(() => {
    const baseUrl = props.selectedProvider.baseUrl;
    if (!baseUrl) {
        return "";
    }
    // 确保URL末尾没有斜杠，然后我们自己添加
    const trimmedUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmedUrl}/chat/completion`;
});

const setBaseUrl = async (value: string | number) => {
    await providerService.updateProvider(props.selectedProvider.key, {
        baseUrl: String(value),
    });
};

const setApiKey = async (value: string | number) => {
    await providerService.updateProvider(props.selectedProvider.key, {
        apiKey: String(value),
    });
};

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const checkUrlValidity = (url: string) => {
    if (url) {
        if (!isValidUrl(url)) {
            toast.warning(
                t('apiConfig.invalidUrlError')
            );
        }
    }
};

async function openApiKeyUrl() {
    const url = "https://www.chatflex.app/";
    try {
        if (typeof window !== "undefined" && isTauri()) {
            await openUrl(url);
            return;
        }

        if (typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    } catch (error) {
        console.error("Failed to open external url:", error);
    }
}

const getDefaultBaseUrl = (): string | undefined => {
    const presetProvider = providerConfigs.get(props.selectedProvider.key);
    return presetProvider?.defaultBaseUrl ?? presetProvider?.baseUrl;
}

const resetBaseUrl = async () => {
    const defaultUrl = getDefaultBaseUrl();
    if (defaultUrl) {
        await setBaseUrl(defaultUrl);
        toast.success(t('apiConfig.baseUrlResetSuccess', { url: defaultUrl }));
    }
}
</script>

<template>
    <div class="space-y-6">
        <!-- Base URL 配置 -->
        <div v-if="props.selectedProvider.showBaseUrl" class="config-group">
            <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium"> Base URL </label>
                <Button
                    v-if="getDefaultBaseUrl()"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2"
                    @click="resetBaseUrl"
                >
                    <RotateCcw class="w-3 h-3 mr-1" />
                    重置
                </Button>
            </div>
            <Input
                :model-value="props.selectedProvider.baseUrl"
                :placeholder="t('apiConfig.baseUrlPlaceholder')"
                class="ios-input"
                @update:model-value="setBaseUrl"
                @blur="checkUrlValidity(props.selectedProvider.baseUrl || '')"
            />
            <p v-if="props.selectedProvider.baseUrl" class="mt-2 text-xs">
                {{ t('apiConfig.chatApiEndpoint') }}: {{ fullUrl }}
            </p>
        </div>

        <!-- API Key 配置 -->
        <div v-if="props.selectedProvider.showApiKey" class="config-group">
            <label class="block text-sm font-medium mb-2"> {{ t('apiConfig.apiKey') }} </label>
            <div class="relative">
                <Input
                    :model-value="props.selectedProvider.apiKey"
                    :placeholder="t('apiConfig.apiKeyPlaceholder')"
                    :type="showApiKey ? 'text' : 'password'"
                    class="ios-input pr-10"
                    @update:model-value="setApiKey"
                />
                <button
                    type="button"
                    class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    @click="showApiKey = !showApiKey"
                >
                    <Eye v-if="!showApiKey" class="w-4 h-4" />
                    <EyeOff v-else class="w-4 h-4" />
                </button>
            </div>
            <p
                class="mt-2 text-xs cursor-pointer hover:underline"
                @click="openApiKeyUrl"
            >
                {{ t('apiConfig.howToGetApiKey') }}
            </p>
        </div>
    </div>
</template>
<style scoped>
label,
p {
    color: var(--color-text);
}
p.text-xs {
    color: var(--text-secondary-color);
}
</style>
