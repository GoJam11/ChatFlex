<template>
    <Dialog :open="showModal" @update:open="(value) => showModal = value">
        <DialogContent class="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{{ t('apiModal.renameProvider') }}</DialogTitle>
            </DialogHeader>
            <div class="py-4">
                <Input
                    v-model="inputValue"
                    :placeholder="t('apiModal.providerNamePlaceholder')"
                    autofocus
                    @keydown="handleKeydown"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" @click="handleCancel">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="handleConfirm">
                    {{ t('common.confirm') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';

import {Provider} from "@/types";

interface Props {
    show: boolean;
    providerItem: Provider | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:show", value: boolean): void;
    (e: "confirm", providerId: string, newName: string): void;
}>();

// Using vue-sonner for toast notifications
const { t } = useI18n();
const showModal = ref(false);
const inputValue = ref("");

// 监听 props.show 的变化
watch(
    () => props.show,
    (newVal) => {
        showModal.value = newVal;
        if (newVal && props.providerItem) {
            inputValue.value = props.providerItem.displayName;
        }
    },
    { immediate: true }
);

// 监听 showModal 的变化
watch(showModal, (newVal) => {
    if (!newVal) {
        emit("update:show", false);
    }
});

const handleConfirm = () => {
    const newName = inputValue.value.trim();
    if (!newName) {
        toast.warning(t('apiModal.pleaseEnterProviderName'));
        return;
    }
    
    if (props.providerItem) {
        emit("confirm", props.providerItem.key, newName);
    }
    showModal.value = false;
};

const handleCancel = () => {
    showModal.value = false;
};

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
        event.preventDefault();
        handleConfirm();
    } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
    }
};
</script>