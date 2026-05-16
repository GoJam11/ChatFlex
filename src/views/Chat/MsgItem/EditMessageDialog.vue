<script setup lang="ts">
import { ref, watch } from "vue";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/features/i18n/useI18n";

interface Props {
    open: boolean;
    textContent: string;
}

interface Emits {
    (e: "update:open", value: boolean): void;
    (e: "save", content: string): void;
    (e: "cancel"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();

const editContent = ref("");

watch(
    () => props.open,
    (newOpen) => {
        if (newOpen) {
            editContent.value = props.textContent;
        }
    }
);

function handleSave() {
    emit("save", editContent.value);
}

function handleCancel() {
    emit("cancel");
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>{{ t('chat.editMessage.title') }}</DialogTitle>
            </DialogHeader>

            <Textarea
                v-model="editContent"
                :placeholder="t('chat.editMessage.placeholder')"
                class="min-h-[200px] max-h-[400px] resize-y"
            />

            <DialogFooter>
                <Button variant="outline" @click="handleCancel">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="handleSave">
                    {{ t('common.save') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
