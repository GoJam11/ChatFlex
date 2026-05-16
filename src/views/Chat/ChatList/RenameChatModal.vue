<template>
    <Dialog v-model:open="showModal">
        <DialogContent class="max-w-md">
            <DialogHeader>
                <DialogTitle>{{ t('chat.renameModal.title') }}</DialogTitle>
            </DialogHeader>
            
            <div class="py-4">
                <Input
                    v-model="inputValue"
                    :placeholder="t('chat.renameModal.placeholder')"
                    autofocus
                    class="w-full"
                    @keydown="handleKeydown"
                />
            </div>
            
            <DialogFooter>
                <div class="flex justify-end space-x-2">
                    <Button variant="outline" @click="handleCancel">
                        {{ t('common.cancel') }}
                    </Button>
                    <Button @click="handleConfirm">
                        {{ t('common.confirm') }}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "vue-sonner";
import type { Chat } from "@/types/chat.ts";
import { useI18n } from "@/features/i18n/useI18n";

interface Props {
    show: boolean;
    chatItem: Chat | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: "update:show", value: boolean): void;
    (e: "confirm", chatId: string, newTitle: string): void;
}>();

const { t } = useI18n();
const showModal = ref(false);
const inputValue = ref("");

// 监听 props.show 的变化
watch(
    () => props.show,
    (newVal) => {
        showModal.value = newVal;
        if (newVal && props.chatItem) {
            inputValue.value = props.chatItem.short || t('chat.renameModal.newChatDefault');
        }
    },
    { immediate: true }
);

// 监听 showModal 的变化，同步到父组件
watch(showModal, (newVal) => {
    if (newVal !== props.show) {
        emit("update:show", newVal);
    }
});

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
    }
};

const handleCancel = () => {
    showModal.value = false;
};

const handleConfirm = () => {
    const newTitle = inputValue.value?.trim();
    
    if (!newTitle) {
        toast.warning(t('chat.renameModal.emptyTitleWarning'));
        return;
    }
    
    if (!props.chatItem) {
        toast.error(t('chat.renameModal.chatNotFoundError'));
        return;
    }
    
    if (newTitle === props.chatItem.short) {
        showModal.value = false;
        return;
    }
    
    emit("confirm", props.chatItem.id, newTitle);
    showModal.value = false;
};
</script>

<style scoped>
.flex {
    display: flex;
}

.justify-end {
    justify-content: flex-end;
}

.space-x-2 > * + * {
    margin-left: 8px;
}
</style>
