<script setup lang="ts">
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import { Plus, CheckCircle, Pencil, Trash2, Power, PowerOff } from "lucide-vue-next";
import RenameProviderModal from "./RenameProviderModal.vue";
import { Provider } from "@/types";

interface Props {
    providers: Provider[];
    selectedProviderId: string;
    isCompactLayout?: boolean;
}

const props = defineProps<Props>();
const isCompactLayout = computed(() => props.isCompactLayout ?? false);

const emit = defineEmits([
    "select-provider",
    "add-provider",
    "rename-provider",
    "delete-provider",
    "toggle-provider",
]);

// Using vue-sonner for toast notifications
const { t } = useI18n();

const isProviderActive = (provider: Provider) => {
    return !!provider.isActive;
};

const selectProvider = (providerId: string) => {
    emit("select-provider", providerId);
};

const openAddProviderModal = () => {
    emit("add-provider");
};

// 重命名模态框相关状态
const showRenameModal = ref(false);
const currentRenameProvider = ref<Provider | null>(null);

function handleRenameProviderItem(provider: Provider) {
    console.log("Rename provider", provider);
    currentRenameProvider.value = provider;
    showRenameModal.value = true;
}

function handleDeleteProviderItem(provider: Provider) {
    console.log("Delete provider", provider);
    emit("delete-provider", provider.key, provider.displayName);
}

function handleToggleProviderItem(provider: Provider) {
    console.log("Toggle provider status", provider);
    emit("toggle-provider", provider.key, !provider.isActive);
}

// 处理重命名确认
async function handleRenameConfirm(providerId: string, newName: string) {
    try {
        emit("rename-provider", providerId, newName);
        toast.success(t('apiSetting.providerRenamedSuccess', { name: newName }));
    } catch (error) {
        console.error("Rename failed:", error);
        toast.error(t('apiSetting.providerRenameFailed'));
    }
}
</script>

<template>
    <div
        class="provider-sidebar border-r flex flex-col"
        :class="[
            isCompactLayout ? 'w-full border-b flex-1' : 'w-64',
            isCompactLayout ? 'border-r-0' : ''
        ]"
    >
        <!-- 标题栏 -->
        <div class="p-4 border-b">
            <h3 class="text-lg font-semibold">
                {{ t('apiModal.providers') }}
            </h3>
        </div>

        <!-- 供应商列表 -->
        <div class="flex-1 overflow-y-auto">
            <div class="p-2 space-y-1">
                <div v-for="provider in props.providers" :key="provider.key">
                    <ContextMenu>
                        <ContextMenuTrigger as-child>
                            <div
                                class="provider-item flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200"
                                :class="{
                                    'provider-item-selected':
                                        props.selectedProviderId ===
                                        provider.key,
                                    'provider-item-hover':
                                        props.selectedProviderId !==
                                        provider.key,
                                }"
                                @click="selectProvider(provider.key)"
                            >
                                <div class="flex items-center space-x-3 flex-1">
                                    <div class="flex-shrink-0">
                                        <!-- 供应商图标或状态指示器 -->
                                        <div
                                            class="w-3 h-3 rounded-full"
                                            :class="{
                                                'status-active':
                                                    isProviderActive(provider),
                                                'status-inactive':
                                                    !isProviderActive(provider),
                                            }"
                                        />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-medium truncate">
                                            {{ provider.displayName }}
                                        </p>
                                        <p class="text-xs">
                                            {{ t('apiModal.clickToConfigure') }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent class="w-auto">
                            <ContextMenuItem
                                class="flex items-center"
                                @click="handleToggleProviderItem(provider)"
                            >
                                <Power v-if="!provider.isActive" class="mr-2 h-4 w-4" />
                                <PowerOff v-else class="mr-2 h-4 w-4" />
                                <span>{{ provider.isActive ? t('common.disable') : t('common.enable') }}</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                                v-if="provider.origin !== 'preset'"
                                class="flex items-center"
                                @click="handleRenameProviderItem(provider)"
                            >
                                <Pencil class="mr-2 h-4 w-4" />
                                <span>{{ t('common.rename') }}</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                                v-if="provider.showDelete"
                                class="flex items-center"
                                @click="handleDeleteProviderItem(provider)"
                            >
                                <Trash2 class="mr-2 h-4 w-4" />
                                <span>{{ t('apiModal.deleteProvider') }}</span>
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                </div>
            </div>
        </div>

        <!-- 添加供应商按钮 -->
        <div class="p-4 border-t">
            <Button class="w-full" @click="openAddProviderModal">
                <Plus class="mr-2 h-4 w-4" />
                {{ t('apiModal.addProvider') }}
            </Button>
        </div>
    </div>

    <!-- 重命名供应商模态框 -->
    <RenameProviderModal
        v-model:show="showRenameModal"
        :provider-item="currentRenameProvider"
        @confirm="handleRenameConfirm"
    />
</template>
<style scoped>
.provider-sidebar {
    max-height: 100%;
    background-color: var(--color-background);
    border-color: var(--border-color-primary);
}
.provider-item-selected {
    background-color: var(--side-active-bg-color);
    color: var(--side-text-color);
}
.provider-item-hover:hover {
    background-color: var(--side-hover-bg-color);
}
.status-active {
    background-color: #34d399;
}
.status-inactive {
    background-color: var(--text-secondary-color);
}
h3,
p {
    color: var(--color-text);
}
p.text-xs {
    color: var(--text-secondary-color);
}
.border-b,
.border-t {
    border-color: var(--border-color-primary);
}
</style>
