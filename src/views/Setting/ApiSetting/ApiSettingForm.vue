<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCurrentModel } from "@/features/currentModel/useCurrentModel";
import { useUnifiedModelManager } from "@/features/model/useUnifiedModelManager";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import AddProviderModal from "./AddProviderModal.vue";
import ProviderList from "./ProviderList.vue";
import ProviderConfigPanel from "./ProviderConfigPanel.vue";
import { useProviderService } from '@/features/provider/providerService';

const providerService = useProviderService();
const { currentProvider } = useCurrentModel();
const { fetchProviderModels } = useUnifiedModelManager();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
// Using vue-sonner for toast notifications

// 当前选中的供应商
const selectedProviderId = ref<string>("");

// 响应式布局状态
const isCompactLayout = ref(false);
const showConfigPanel = ref(true);

const updateLayoutMode = (force = false) => {
    const compact = window.innerWidth < 900;
    const previous = isCompactLayout.value;
    isCompactLayout.value = compact;

    if (compact) {
        if (force || previous !== compact) {
            showConfigPanel.value = false;
        }
    } else {
        showConfigPanel.value = true;
    }
};

const handleResize = () => updateLayoutMode();

// 供应商列表
const providers = providerService.providerList;

// 初始化选中的供应商
const initializeSelectedProvider = () => {
    if (providers.value.length > 0) {
        // 优先选择当前配置的默认供应商
        if (
            currentProvider.value &&
            providers.value.some((p) => p.key === currentProvider.value)
        ) {
            selectedProviderId.value = currentProvider.value;
        } else {
            // 如果没有默认供应商或找不到，则选择第一个供应商
            selectedProviderId.value = providers.value[0].key;
        }
    }
};

// 监听模型存储的默认供应商变化，自动更新选中的供应商
watch(
    currentProvider,
    (newProvider) => {
        if (newProvider && providers.value.some((p) => p.key === newProvider)) {
            selectedProviderId.value = newProvider;
        }
    }
);

// 监听供应商列表变化，确保选中的供应商有效
watch(
    providers,
    () => {
        if (
            !selectedProviderId.value ||
            !providers.value.some((p) => p.key === selectedProviderId.value)
        ) {
            initializeSelectedProvider();
        }
    },
    { immediate: true }
);

// 当前选中的供应商对象
const selectedProvider = computed(() => {
    return providers.value.find((p) => p.key === selectedProviderId.value);
});

// 添加供应商模态框状态
const addProviderModalShow = ref(false);

// 选择供应商
const selectProvider = (providerId: string) => {
    selectedProviderId.value = providerId;
    if (isCompactLayout.value) {
        showConfigPanel.value = true;
    }
};

// 打开添加供应商模态框
const openAddProviderModal = () => {
    addProviderModalShow.value = true;
};

// 处理从添加供应商模态框保存事件
const handleAddProviderSave = async (name: string, providerType: import("@/types/provider").ProviderType) => {
    const isOllama = providerType === "ollama";
    const newProviderKey = await providerService.addProvider({
        name,
        baseUrl: isOllama ? "http://127.0.0.1:11434" : "",
        apiKey: isOllama ? "ollama" : "",
        models: [],
        providerType,
    });
    toast.success(t('apiSetting.providerAddedSuccess', { name }));
    addProviderModalShow.value = false;

    // 自动选中新添加的供应商
    if (newProviderKey) {
        selectedProviderId.value = newProviderKey;
        if (isCompactLayout.value) {
            showConfigPanel.value = true;
        }
    }
};

// 删除供应商
const handleRemoveProvider = async (providerId: string, providerName: string) => {
    const success = await providerService.removeProvider(providerId);
    
    if (success) {
        // 如果删除的是当前选中的供应商，切换到第一个供应商
        if (selectedProviderId.value === providerId) {
            const remainingProviders = providers.value.filter(
                (p) => p.key !== providerId
            );
            selectedProviderId.value =
                remainingProviders.length > 0 ? remainingProviders[0].key : "";
        }
        toast.success(t('apiSetting.providerDeletedSuccess', { name: providerName }));
    } else {
        toast.error(t('apiSetting.providerDeleteFailed', { name: providerName }));
    }
};

// 切换供应商激活状态
const toggleProvider = async (providerId: string, checked: boolean) => {
    await providerService.setProviderActive(providerId, checked);

    // 如果是启用，则尝试更新该供应商的模型列表
    if (checked) {
        try {
            await fetchProviderModels(providerId);
            console.log(
                `Successfully updated model list for ${providerId} on toggle.`
            );
        } catch (error) {
            console.warn(
                `Failed to update model list for ${providerId} on toggle:`,
                error
            );
            // The store now handles setting the error state, so no need to show a message here.
            // The UI will react to the error state in the provider config.
        }
    }
};

// 处理重命名供应商
const handleRenameProvider = async (providerId: string, newName: string) => {
    try {
        await providerService.updateProvider(providerId, { displayName: newName });
        toast.success(t('apiSetting.providerRenamedSuccess', { name: newName }));
    } catch (error) {
        console.error("Rename provider failed:", error);
        toast.error(t('apiSetting.providerRenameFailed'));
    }
};

// 处理删除供应商
const handleDeleteProvider = async (providerId: string, providerName: string) => {
    await handleRemoveProvider(providerId, providerName);
};

const closeConfigPanel = () => {
    if (isCompactLayout.value) {
        showConfigPanel.value = false;
    }
};

// 检查是否需要自动弹出添加供应商窗口
onMounted(() => {
    providerService.ready().then(() => {
        initializeSelectedProvider();
    }).catch((error) => {
        console.error('[ApiSettingForm] Failed to initialize providers:', error);
    });
    updateLayoutMode(true);
    window.addEventListener('resize', handleResize);
    if (route.query.showAddProvider === 'true') {
        // 延迟一点时间确保组件完全加载
        setTimeout(() => {
            openAddProviderModal();
            // 清理URL中的查询参数，防止刷新时再次弹出
            router.replace({ query: { ...route.query, showAddProvider: undefined } });
        }, 300);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
});
</script>

<template>
    <div class="ios-settings-container h-full flex flex-col bg-gray-50 dark:bg-transparent overflow-hidden min-h-0">
        <!-- 页头 -->
        <div class="px-6 pt-6 pb-4">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-text-100">{{ t('apiSetting.pageTitle') }}</h2>
                    <p class="text-sm text-text-300 mt-1">
                        {{ t('apiSetting.pageDescription') }}
                    </p>
                </div>
            </div>
        </div>

        <!-- 供应商列表和配置面板 -->
        <div
            :class="[
                'flex flex-1 overflow-hidden min-h-0',
                isCompactLayout ? 'flex-col' : ''
            ]"
        >
        <template v-if="isCompactLayout">
            <!-- 紧凑布局下仅渲染一个视图 -->
            <ProviderList
                v-if="!showConfigPanel || !selectedProvider"
                :providers="providers"
                :selected-provider-id="selectedProviderId"
                :is-compact-layout="isCompactLayout"
                @select-provider="selectProvider"
                @add-provider="openAddProviderModal"
                @rename-provider="handleRenameProvider"
                @delete-provider="handleDeleteProvider"
                @toggle-provider="toggleProvider"
            />
            <ProviderConfigPanel
                v-else
                :selected-provider="selectedProvider"
                :is-compact-layout="isCompactLayout"
                @remove-provider="handleRemoveProvider"
                @toggle-provider="toggleProvider"
                @close="closeConfigPanel"
            />
        </template>
        <template v-else>
            <!-- 宽屏布局下同时渲染列表和配置 -->
            <ProviderList
                :providers="providers"
                :selected-provider-id="selectedProviderId"
                :is-compact-layout="isCompactLayout"
                @select-provider="selectProvider"
                @add-provider="openAddProviderModal"
                @rename-provider="handleRenameProvider"
                @delete-provider="handleDeleteProvider"
                @toggle-provider="toggleProvider"
            />
            <ProviderConfigPanel
                v-if="selectedProvider"
                :selected-provider="selectedProvider"
                :is-compact-layout="isCompactLayout"
                @remove-provider="handleRemoveProvider"
                @toggle-provider="toggleProvider"
                @close="closeConfigPanel"
            />
            <!-- 未选中供应商时的空状态 -->
            <div
                v-else
                class="flex-1 flex items-center justify-center"
            >
                <div class="text-center">
                    <p class="text-lg text-gray-500 dark:text-gray-400 mb-2">
                        {{ t('apiSetting.selectProvider') }}
                    </p>
                    <p class="text-sm text-gray-400 dark:text-gray-500">
                        {{ t('apiSetting.selectProviderDesc') }}
                    </p>
                </div>
            </div>
        </template>
        </div>

        <!-- 添加供应商模态框 -->
        <AddProviderModal
            v-model:show="addProviderModalShow"
            @save="handleAddProviderSave"
        />
    </div>
</template>

<style scoped>
.provider-section {
    transition: all 0.3s ease;
}
.ios-settings-container {
    background-color: var(--bg-100);
}
</style>
