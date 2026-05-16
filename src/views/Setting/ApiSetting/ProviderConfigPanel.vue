<script setup lang="ts">
import { computed } from "vue";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import ProviderBasicConfig from "./ProviderBasicConfig.vue";
import ModelManager from "./ModelManager.vue";
import { Provider } from "@/types";
import { useI18n } from "vue-i18n";
import { ArrowLeft } from "lucide-vue-next";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
    selectedProvider: Provider;
    isCompactLayout?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(["toggle-provider", "close"]);

const { t } = useI18n();

const isProviderActive = computed(() => {
    return !!props.selectedProvider.isActive;
});

const isCompactLayout = computed(() => props.isCompactLayout ?? false);

const toggleProvider = (checked: boolean) => {
    emit("toggle-provider", props.selectedProvider.key, checked);
};

const handleClose = () => {
    emit("close");
};
</script>

<template>
    <div
        class="provider-config flex-1 flex flex-col min-h-0"
        :class="isCompactLayout ? 'w-full' : ''"
    >
        <!-- 配置标题栏 -->
        <div class="px-6 py-2 border-b">
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                    <Button
                        v-if="isCompactLayout"
                        variant="ghost"
                        size="icon"
                        class="-ml-2"
                        @click="handleClose"
                    >
                        <ArrowLeft class="h-4 w-4" />
                        <span class="sr-only">{{ t("common.back") }}</span>
                    </Button>
                    <h2 class="text-lg font-semibold">
                        {{ props.selectedProvider.displayName }}
                    </h2>
                </div>
                <!-- 启用/禁用开关 -->
                <div class="flex items-center space-x-2">
                    <span class="text-sm">{{ t("common.enable") }}</span>
                    <Switch
                        :model-value="isProviderActive"
                        @update:model-value="toggleProvider"
                    />
                </div>
            </div>
        </div>

        <!-- 配置表单区域 -->
        <ScrollArea class="flex-1 min-h-0">
            <div
                class="scroll-content w-full"
                :class="isCompactLayout ? 'p-4' : 'p-6'"
            >
                <div class="space-y-6">
                    <ProviderBasicConfig
                        :selected-provider="props.selectedProvider"
                    />
                    <ModelManager :selected-provider="props.selectedProvider" />
                </div>
            </div>
        </ScrollArea>
    </div>
</template>
<style scoped>
.provider-config {
    background-color: var(--bg-100);
}
.border-b {
    border-color: var(--border-color-primary);
}
h2,
span,
p {
    color: var(--color-text);
}
p.text-sm,
span.text-sm {
    color: var(--text-secondary-color);
}
.disabled-provider-notice {
    background-color: var(--color-background-mute);
    border: 1px solid var(--border-color-primary);
}
</style>
