<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from 'vue-i18n';
import { useCurrentModel } from "@/features/currentModel/useCurrentModel";
import { Check, Search, ChevronDown } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "vue-router";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { CREATE_NEW_CHAT } from "@/features/chat/useChatStore";
import { getCurrentModelConfig } from "@/features/chat/useChat";
import { useChat } from "@/views/Chat/composables/useChat";
import { useProviderService } from '@/features/provider/providerService';

const providerService = useProviderService();
const { setCurrentModelAndProvider } = useCurrentModel();
const showPopover = ref(false);
const searchQuery = ref("");
const router = useRouter();
const { chatId } = useRouteChat();
const { t } = useI18n();
const { updateChat } = useChat();

// 是否处于“新会话”状态（根路由）
const isNewChat = computed(() => chatId.value === CREATE_NEW_CHAT);

// 只展示激活且有模型的供应商
const activeProvidersWithModels = computed(() => {
    return providerService.providerList.value.filter(
        (provider) =>
            provider.isActive &&
            providerService.getProviderSelectedModels(provider.key)?.length > 0
    );
});

// 根据搜索条件过滤模型
const filteredData = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();

    if (!query) {
        return activeProvidersWithModels.value.map((provider) => ({
            ...provider,
            models: providerService.getProviderSelectedModels(provider.key) || [],
        }));
    }

    return activeProvidersWithModels.value
        .map((provider) => {
            const models = providerService.getProviderSelectedModels(provider.key) || [];
            const filteredModels = models.filter((model) =>
                model.toLowerCase().includes(query)
            );
            return { ...provider, models: filteredModels };
        })
        .filter((provider) => provider.models.length > 0);
});

// 获取当前有效的模型和供应商（从数据库读取，确保一致性）
const currentModel = ref<string>('');
const currentProvider = ref<string>('');

// 异步获取当前模型和供应商
const updateCurrentModelAndProvider = async () => {
    await providerService.ready();
    const modelConfig = await getCurrentModelConfig(chatId.value);
    if (modelConfig.success && modelConfig.model && modelConfig.provider) {
        currentModel.value = modelConfig.model;
        currentProvider.value = modelConfig.provider;
    } else {
        console.warn('[ModelSwitch] 获取模型配置失败:', modelConfig.error);
        currentModel.value = '';
        currentProvider.value = '';
    }
};

// 监听chatId变化
watch(
    () => chatId.value,
    () => {
        updateCurrentModelAndProvider();
    },
    { immediate: true }
);

// 当供应商列表完成初始化后再次同步，避免刷新后的竞态显示
watch(
    () => providerService.providerList.value.length,
    (length) => {
        if (length > 0) {
            updateCurrentModelAndProvider();
        }
    }
);

// 移除对 chatStore 的依赖，模型变化通过数据库读取

// 判断模型是否被选中（供应商+模型唯一）
const isModelSelected = (model: string, providerKey: string) => {
    return currentModel.value === model && currentProvider.value === providerKey;
};

// 选择模型
const handleModelSelect = async (model: string, providerKey: string) => {
    if (!isNewChat.value && chatId.value) {
        // 在会话路由中，直接更新数据库中的会话级别模型配置
        const result = await updateChat(chatId.value, { model, provider: providerKey });
        if (!result.success) {
            console.error('[ModelSwitch] 更新会话模型配置失败:', result.error);
        }
    } else {
        // 在新建会话状态，更新全局模型配置
        // 仅更新设置数据库，确保 send.ts 能读取到最新配置
        try {
            await setCurrentModelAndProvider(model, providerKey);
        } catch (error) {
            console.error('更新设置数据库失败:', error);
        }
    }
    
    // 手动触发UI更新，确保显示最新的模型选择
    await updateCurrentModelAndProvider();
    
    showPopover.value = false;
};

const goToSettings = () => {
    router.push("/setting");
};
</script>

<template>
    <div class="flex items-center justify-center min-w-0">
        <Popover v-model:open="showPopover">
            <PopoverTrigger as-child>
                <button
                    class="group inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-sm transition-colors duration-200 border border-transparent hover:bg-bg-200 dark:hover:bg-white/10 text-text-300 hover:text-text-100"
                    :title="
                        currentModel && currentProvider
                            ? currentModel
                            : t('chat.model.notSet')
                    "
                >
                    <span class="truncate max-w-[180px]">
                        {{
                            currentModel && currentProvider
                                ? currentModel
                                : t('chat.model.notSet')
                        }}
                    </span>
                    <ChevronDown :size="14" :stroke-width="1.75" class="opacity-60 group-hover:opacity-100" />
                </button>
            </PopoverTrigger>
            <PopoverContent class="min-w-[280px] max-w-[320px] flex flex-col p-1 gap-1 bg-bg-100 border border-border-200 shadow-xl rounded-xl">
                <div class="p-2">
                    <div class="relative">
                        <Search class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-text-400" :size="14" />
                        <Input
                            v-model="searchQuery"
                            :placeholder="t('common.filter')"
                            class="h-9 pl-9 pr-3 bg-bg-200/50 border-transparent focus:bg-bg-100 focus:border-border-300 text-sm"
                        />
                    </div>
                </div>
                <ScrollArea class="h-[240px] px-1">
                    <!-- 无可用模型时的提示信息 -->
                    <div v-if="filteredData.length === 0" class="p-4 text-center">
                        <div class="mb-2 text-text-400 text-sm">
                            {{ t('chat.model.noModels') }}
                        </div>
                        <div
                            class="text-sm font-medium cursor-pointer hover:underline text-text-200"
                            @click="goToSettings"
                        >
                            {{ t('chat.model.configureFirst') }}
                        </div>
                    </div>

                    <!-- 按供应商分组显示模型列表 -->
                    <div v-else class="pb-1">
                        <div
                            v-for="providerData in filteredData"
                            :key="providerData.key"
                            class="mb-2 last:mb-0"
                        >
                            <!-- 供应商标题 -->
                            <div
                                class="text-xs font-semibold px-3 py-1.5 text-text-400 uppercase tracking-wider"
                            >
                                {{ providerData.displayName }}
                            </div>

                            <!-- 该供应商下的模型列表 -->
                            <div
                                v-for="model in providerData.models"
                                :key="`${providerData.key}-${model}`"
                                class="cursor-pointer mx-1 px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors duration-200 group"
                                :class="isModelSelected(model, providerData.key) ? 'bg-bg-200 dark:bg-white/10 text-text-100' : 'text-text-300 hover:bg-bg-200 dark:hover:bg-white/10 hover:text-text-100'"
                                @click="handleModelSelect(model, providerData.key)"
                            >
                                <span class="truncate" :title="model">{{ model }}</span>
                                <Check
                                    v-if="isModelSelected(model, providerData.key)"
                                    :size="14"
                                    class="flex-shrink-0 text-text-100"
                                />
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    </div>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind classes */
</style>
