<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "vue-sonner";
import { Plus, RotateCcw } from "lucide-vue-next";
import { Provider } from "@/types";
import { useI18n } from 'vue-i18n';
import { useProviderService } from '@/features/provider/providerService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

interface Props {
    open: boolean;
    selectedProvider: Provider;
    availableModels: string[]; // 从父组件传入的可用模型列表
    isFetching: boolean;
}

interface Emits {
    (e: 'update:open', value: boolean): void;
    (e: 'fetch-all-models'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const providerService = useProviderService();
const { t } = useI18n();

const dialogFilterKeyword = ref("");

// 弹窗中显示的全部模型
const getDialogDisplayModels = computed(() => {
    const models = props.availableModels;

    if (!dialogFilterKeyword.value) {
        return models;
    }
    return models.filter((model: string) =>
        model.toLowerCase().includes(dialogFilterKeyword.value.toLowerCase())
    );
});

const addAllModelsToSelected = async () => {
    const providerId = props.selectedProvider.key;
    const availableModels = props.availableModels;
    const selectedModels = providerService.getProviderSelectedModels(providerId);
    const unselectedModels = availableModels.filter(
        (model: string) => !selectedModels.includes(model)
    );

    if (unselectedModels.length === 0) {
        toast.info(t('allModelsDialog.allModelsAdded'));
        // 关闭弹窗
        emit('update:open', false);
        return;
    }

    await providerService.updateProvider(providerId, {
        selectedModels: [...selectedModels, ...unselectedModels],
    });
    toast.success(t('allModelsDialog.modelsAddedSuccess', { count: unselectedModels.length }));

    // 添加完成后关闭弹窗
    emit('update:open', false);
};

const replaceAllModels = async () => {
    const providerId = props.selectedProvider.key;
    const availableModels = props.availableModels;

    if (availableModels.length === 0) {
        toast.warning(t('allModelsDialog.noAvailableModels'));
        return;
    }

    await providerService.updateProvider(providerId, {
        selectedModels: [...availableModels],
    });

    toast.success(t('allModelsDialog.modelsReplacedSuccess', { count: availableModels.length }));

    // 替换完成后关闭弹窗
    emit('update:open', false);
};

const addModelToSelected = async (modelName: string) => {
    await providerService.addModelToProvider(props.selectedProvider.key, modelName);
    toast.success(t('allModelsDialog.modelAddedSuccess', { name: modelName }));
};

const isModelSelected = (modelName: string) => {
    return providerService.isModelSelectedByProvider(
        props.selectedProvider.key,
        modelName
    );
};

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            emit('fetch-all-models');
        }
    },
    { immediate: true }
);
</script>

<template>
    <Dialog :open="props.open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-[600px] max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{{ t('allModelsDialog.title') }}</DialogTitle>
            </DialogHeader>
            
            <!-- 弹窗内的筛选区 -->
            <div class="mb-3 flex-shrink-0">
                <Input
                    v-model="dialogFilterKeyword"
                    class="w-full"
                    :placeholder="t('allModelsDialog.filterPlaceholder')"
                    type="text"
                />
            </div>
            
            <!-- 弹窗内的模型列表 - 设置固定高度和滚动 -->
            <div class="flex-1 min-h-0 overflow-scroll">
                <div
                    v-if="getDialogDisplayModels.length > 0"
                    class="h-full overflow-y-auto ios-model-list rounded-xl p-4"
                >
                    <div class="space-y-2">
                        <div
                            v-for="(model, index) in getDialogDisplayModels"
                            :key="index"
                            class="model-item flex items-center justify-between p-3 rounded-lg shadow-sm"
                        >
                            <span class="text-sm">
                                {{ model }}
                            </span>
                            <div class="flex space-x-2">
                                <!-- 添加按钮（未选择的模型） -->
                                <Button
                                    v-if="!isModelSelected(model)"
                                    size="sm"
                                    @click="addModelToSelected(model)"
                                >
                                    <Plus class="mr-1 h-3 w-3" />
                                    {{ t('allModelsDialog.add') }}
                                </Button>
                                <span v-else class="text-sm text-muted-foreground">
                                    {{ t('allModelsDialog.added') }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 弹窗内无模型时的提示 -->
                <div class="empty-models text-center py-8 h-full flex items-center justify-center" v-else>
                    <div v-if="props.isFetching" class="flex flex-col items-center gap-2">
                        <RotateCcw class="h-5 w-5 animate-spin text-muted-foreground" />
                        <p class="text-sm text-muted-foreground">
                            {{ t('common.loading') }}
                        </p>
                    </div>
                    <div v-else>
                        <p class="text-sm">
                            {{ t('allModelsDialog.noModels') }}
                        </p>
                        <p class="text-xs mt-1">
                            {{ t('allModelsDialog.noModelsDescription') }}
                        </p>
                    </div>
                </div>
            </div>
            
            <DialogFooter class="flex-shrink-0 gap-2">
                <Button
                    variant="outline"
                    :disabled="props.isFetching || props.availableModels.length === 0"
                    @click="addAllModelsToSelected"
                >
                    {{ t('allModelsDialog.addAll') }}
                </Button>
                <Button
                    :disabled="props.isFetching || props.availableModels.length === 0"
                    @click="replaceAllModels"
                >
                    {{ t('allModelsDialog.replaceAll') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
.ios-model-list {
    background-color: var(--color-background-mute);
}
.model-item {
    background-color: var(--color-background);
}
label,
span,
p {
    color: var(--color-text);
}
.empty-models p {
    color: var(--text-secondary-color);
}
</style>
