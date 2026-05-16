<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';
import type { ProviderType } from "@/types/provider";

interface Props {
    show: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    show: false,
});

const emit = defineEmits<{
    (e: "update:show", value: boolean): void;
    (e: "save", name: string, providerType: ProviderType): void;
}>();

// Using vue-sonner for toast notifications
const { t } = useI18n();
const providerName = ref("");
const providerType = ref<ProviderType>("openai");

// 监听模态框显示状态，重置表单
watch(
    () => props.show,
    (newVal) => {
        if (newVal) {
            providerName.value = "";
            providerType.value = "openai";
        }
    }
);

const handleSave = () => {
    const name = providerName.value.trim();
    if (!name) {
        toast.warning(t('apiModal.pleaseEnterProviderName'));
        return;
    }
    emit("save", name, providerType.value);
};

const handleEnterSave = (event: KeyboardEvent) => {
    // 阻止事件冒泡，防止触发按钮
    event.preventDefault();
    event.stopPropagation();
    handleSave();
};

const handleClose = () => {
    emit("update:show", false);
};
</script>

<template>
    <Dialog :open="props.show" @update:open="handleClose">
        <DialogContent class="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{{ t('apiModal.addCustomProvider') }}</DialogTitle>
            </DialogHeader>
            <div class="py-4">
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {{ t('apiModal.providerType') }} <span class="text-red-500">*</span>
                        </label>
                        <Select v-model="providerType">
                            <SelectTrigger class="w-full">
                                <SelectValue :placeholder="t('apiModal.selectProviderType')" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">
                                    {{ t('apiModal.providerTypeOpenAI') }}
                                </SelectItem>
                                <SelectItem value="ollama">
                                    {{ t('apiModal.providerTypeOllama') }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p class="text-sm text-muted-foreground">
                            {{ t('apiModal.providerTypeDescription') }}
                        </p>
                    </div>

                    <div class="space-y-2">
                        <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {{ t('apiModal.providerName') }} <span class="text-red-500">*</span>
                        </label>
                        <Input
                            v-model="providerName"
                            :placeholder="t('apiModal.providerNamePlaceholder')"
                            @keydown.enter="handleEnterSave"
                        />
                        <p class="text-sm text-muted-foreground">
                            {{ t('apiModal.configDescription') }}
                        </p>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="handleClose">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="handleSave">
                    {{ t('common.create') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
