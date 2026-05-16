<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Input } from "@/components/ui/input";
import { toast } from "vue-sonner";
import { Activity, Trash2, RotateCcw, Plus, X, Edit, MoreHorizontal, Box } from "lucide-vue-next";
import AddCustomModelModal from "./AddCustomModelModal.vue";
import AllModelsDialog from "./AllModelsDialog.vue";
import OllamaModelManager from "./OllamaModelManager.vue";
import { Provider, resolveProviderBaseUrl } from "@/types";
import { useUnifiedModelManager } from "@/features/model/useUnifiedModelManager";
import { useI18n } from 'vue-i18n';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProviderService } from '@/features/provider/providerService';
import {
    Item, ItemGroup, ItemContent, ItemTitle, ItemMedia, ItemActions,
} from "@/components/ui/item";

interface Props {
    selectedProvider: Provider;
}

const props = defineProps<Props>();
const providerService = useProviderService();
const { isFetchingAllModels, fetchAllModels, testProviderModel } = useUnifiedModelManager();
// Using vue-sonner for toast notifications
const { t } = useI18n();


// 本地保存从 API 获取的模型列表
const availableModels = ref<string[]>([]);

// 模型测试状态
const testingModels = ref(new Set<string>());

// 弹窗状态
const showAllModelsDialog = ref(false);

// 重命名相关状态
const showRenameDialog = ref(false);
const renamingModel = ref("");
const newModelName = ref("");

const filterKeyword = ref("");
const MAX_DISPLAYED_MODELS = 50;
const isShowingAllSelectedModels = ref(false);

const getCurrentDisplayModels = computed(() => {
    const providerId = props.selectedProvider.key;
    // 只显示已选择的模型
    const models = providerService.getProviderSelectedModels(providerId);

    if (!filterKeyword.value) {
        return models;
    }
    return models.filter((model: string) =>
        model.toLowerCase().includes(filterKeyword.value.toLowerCase())
    );
});

const displayedModels = computed(() => {
    const models = getCurrentDisplayModels.value;
    if (isShowingAllSelectedModels.value) {
        return models;
    }
    return models.slice(0, MAX_DISPLAYED_MODELS);
});

const isModelListTruncated = computed(() => {
    return !isShowingAllSelectedModels.value && getCurrentDisplayModels.value.length > MAX_DISPLAYED_MODELS;
});

// 计算属性：判断获取全部模型按钮是否应该禁用
const isFetchAllModelsDisabled = computed(() => {
    const providerId = props.selectedProvider.key;
    const provider = providerService.getProvider(providerId);
    
    const baseUrl = resolveProviderBaseUrl(provider);

    if (providerId === 'ollama') {
        return isFetchingAllModels.value || !baseUrl;
    } else {
        return isFetchingAllModels.value || !baseUrl || !provider?.apiKey;
    }
});

// 计算属性：判断获取全部模型按钮是否在加载状态
const isFetchAllModelsLoading = computed(() => {
    return isFetchingAllModels.value;
});

const handleFetchAllModels = async () => {
    if (isFetchAllModelsLoading.value) {
        return;
    }
    const providerId = props.selectedProvider.key;

    try {
        // 使用独立的 fetchAllModels 方法
        const models = await fetchAllModels(providerId);

        // 保存到本地状态
        availableModels.value = models;

        // 检查是否成功获取到模型
        if (models.length === 0) {
            toast.warning(t('modelManager.noModelsWarning'));
            console.warn("not get models");
            return;
        }

        toast.success(t('modelManager.fetchModelsSuccess', { count: models.length }));
    } catch (error) {
        toast.error(String(error));
    }
};

const openAllModelsDialog = async () => {
    availableModels.value = [];
    showAllModelsDialog.value = true;
};

const handleShowAllSelectedModels = () => {
    isShowingAllSelectedModels.value = true;
};


const removeModelFromSelected = async (modelName: string) => {
    await providerService.removeModelFromProvider(props.selectedProvider.key, modelName);
    toast.success(t('modelManager.modelRemovedSuccess', { name: modelName }));
};


const showAddCustomModelModal = ref(false);

const handleAddCustomModel = async (modelName: string) => {
    const providerId = props.selectedProvider.key;
    await providerService.addModelToProvider(providerId, modelName);
    toast.success(t('modelManager.customModelAddedSuccess', { name: modelName }));
};

// 删除全部模型
const removeAllModels = async () => {
    const providerId = props.selectedProvider.key;
    const selectedModels = providerService.getProviderSelectedModels(providerId);

    if (selectedModels.length === 0) {
        toast.warning(t('modelManager.noModelsToDelete'));
        return;
    }

    await providerService.updateProvider(providerId, { selectedModels: [] });

    toast.success(t('modelManager.modelsDeletedSuccess', { count: selectedModels.length }));
};

// 确认删除全部模型
const confirmDeleteAll = async () => {
    await removeAllModels();
};

// 测试模型
const testModel = async (modelName: string) => {
    const providerId = props.selectedProvider.key;

    // 添加到测试状态
    testingModels.value.add(modelName);

    try {
        // 统一使用 testProviderModel 方法
        await testProviderModel(providerId, modelName);
    } finally {
        // 从测试状态中移除
        testingModels.value.delete(modelName);
    }
};

// 重命名模型
const startRenameModel = (modelName: string) => {
    renamingModel.value = modelName;
    newModelName.value = modelName;
    showRenameDialog.value = true;
};

const confirmRenameModel = async () => {
    const providerId = props.selectedProvider.key;
    const oldName = renamingModel.value;
    const newName = newModelName.value.trim();

    if (!newName) {
        toast.warning(t('modelManager.enterModelName'));
        return;
    }

    if (newName === oldName) {
        showRenameDialog.value = false;
        return;
    }

    // 检查新名称是否已存在
    const existingModels = providerService.getProviderSelectedModels(providerId);
    if (existingModels.includes(newName)) {
        toast.warning(t('modelManager.modelNameExists'));
        return;
    }

    // 执行重命名：先添加新模型，再删除旧模型
    try {
        await providerService.addModelToProvider(providerId, newName);
        await providerService.removeModelFromProvider(providerId, oldName);
        toast.success(t('modelManager.modelRenamedSuccess', { name: newName }));
        showRenameDialog.value = false;
    } catch (error) {
        toast.error(t('modelManager.renameFailed'));
        console.error("Rename model failed:", error);
    }
};

const cancelRenameModel = () => {
    showRenameDialog.value = false;
    renamingModel.value = "";
    newModelName.value = "";
};

watch(
    () => props.selectedProvider.key,
    () => {
        isShowingAllSelectedModels.value = false;
    }
);

watch(filterKeyword, () => {
    isShowingAllSelectedModels.value = false;
});

watch(getCurrentDisplayModels, (models) => {
    if (models.length <= MAX_DISPLAYED_MODELS) {
        isShowingAllSelectedModels.value = false;
    }
});
</script>

<template>
    <div v-if="props.selectedProvider.key !== 'ollama'" class="config-group">
        <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-medium">{{ t('modelManager.models') }}</label>
            <div class="flex gap-2 space-x-2">
                <!-- 获取全部模型按钮 -->
                <div
                    class="flex items-center cursor-pointer"
                    :class="{
                        'opacity-50 cursor-not-allowed': isFetchAllModelsDisabled,
                    }"
                    @click="openAllModelsDialog"
                >
                    <RotateCcw
                        :class="{
                            'animate-spin': isFetchAllModelsLoading,
                        }"
                        class="mr-1 h-4 w-4"
                    />
                    <span
                        class="text-xs"
                        style="font-size: 12px"
                    >{{ t('modelManager.fetchAllModels') }}</span>
                </div>
                
                <!-- 下拉菜单，包含其他操作 -->
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <div class="flex items-center cursor-pointer">
                            <MoreHorizontal class="h-4 w-4" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="showAddCustomModelModal = true">
                            <Plus class="mr-2 h-4 w-4" />
                            <span>{{ t('modelManager.addCustomModel') }}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            :disabled="getCurrentDisplayModels.length === 0"
                            @click="confirmDeleteAll"
                        >
                            <Trash2 class="mr-2 h-4 w-4" />
                            <span>{{ t('modelManager.deleteAll') }}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <!-- 筛选区 -->
        <div class="mb-3">
            <div class="relative">
                <Input
                    v-model="filterKeyword"
                    :placeholder="t('modelManager.filterPlaceholder')"
                    type="text"
                />
                <button
                    v-if="filterKeyword"
                    class="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm"
                    type="button"
                    @click="filterKeyword = ''"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
        </div>

        <!-- 可用模型列表 -->
        <ItemGroup v-if="getCurrentDisplayModels.length > 0" class="gap-2">
            <Item
                v-for="(model, index) in displayedModels"
                :key="index"
                variant="outline"
                size="sm"
            >
                <ItemMedia variant="icon">
                    <Box class="size-4" />
                </ItemMedia>
                <ItemContent>
                    <ItemTitle>{{ model }}</ItemTitle>
                </ItemContent>
                <ItemActions>
                    <TooltipProvider>
                        <!-- 重命名按钮 -->
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 w-8 p-0 text-muted-foreground"
                                    @click="startRenameModel(model)"
                                >
                                    <Edit class="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {{ t('modelManager.rename') }}
                            </TooltipContent>
                        </Tooltip>
                        <!-- 测试按钮 -->
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 w-8 p-0 text-muted-foreground"
                                    :disabled="testingModels.has(model)"
                                    @click="testModel(model)"
                                >
                                    <Activity
                                        :class="{
                                            'animate-pulse': testingModels.has(model),
                                        }"
                                        class="h-4 w-4"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {{ t('modelManager.test') }}
                            </TooltipContent>
                        </Tooltip>
                        <!-- 移除按钮 -->
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-8 w-8 p-0 text-muted-foreground"
                                    @click="removeModelFromSelected(model)"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {{ t('modelManager.delete') }}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </ItemActions>
            </Item>
        </ItemGroup>
        <div
            v-if="isModelListTruncated"
            class="mt-3 text-center space-y-2"
        >
            <p class="text-xs text-muted-foreground">
                {{ t('modelManager.displayingLimitedModels', { count: MAX_DISPLAYED_MODELS }) }}
            </p>
            <Button
                size="sm"
                variant="outline"
                @click="handleShowAllSelectedModels"
            >
                {{ t('modelManager.loadAllModels', { total: getCurrentDisplayModels.length }) }}
            </Button>
        </div>

        <!-- 无模型时的提示 -->
        <div v-else class="empty-models text-center py-8">
            <p class="text-sm">
                {{ t('modelManager.noSelectedModels') }}
            </p>
            <p class="text-xs mt-1">
                {{ t('modelManager.noSelectedModelsDescription') }}
            </p>
        </div>
    </div>

    <!-- Ollama模型管理器 -->
    <div v-if="props.selectedProvider.key === 'ollama'" class="mt-6">
        <OllamaModelManager />
    </div>

    <!-- 全部模型弹窗 -->
    <AllModelsDialog
        v-model:open="showAllModelsDialog"
        :selected-provider="props.selectedProvider"
        :available-models="availableModels"
        :is-fetching="isFetchAllModelsLoading"
        @fetch-all-models="handleFetchAllModels"
    />

    <!-- 添加自定义模型模态框 -->
    <AddCustomModelModal
        v-model:show="showAddCustomModelModal"
        @add-model="handleAddCustomModel"
    />

    <!-- 重命名模型弹框 -->
    <Dialog
        :open="showRenameDialog"
        @update:open="(value) => (showRenameDialog = value)"
    >
        <DialogContent class="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{{ t('modelManager.renameModel') }}</DialogTitle>
            </DialogHeader>
            <div class="py-4">
                <Input
                    v-model="newModelName"
                    :placeholder="t('modelManager.modelNamePlaceholder')"
                    autofocus
                    @keydown.enter="confirmRenameModel"
                    @keydown.escape="cancelRenameModel"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" @click="cancelRenameModel">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="confirmRenameModel">
                    {{ t('common.confirm') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
<style scoped>
label,
span,
p {
    color: var(--color-text);
}
.empty-models p {
    color: var(--text-secondary-color);
}
</style>
