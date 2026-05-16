<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "vue-sonner";
import { useI18n } from 'vue-i18n';

interface Props {
    show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(["update:show", "add-model"]);
const { t } = useI18n();
// Using vue-sonner for toast notifications

const customModelName = ref("");

const handleAddModel = () => {
    if (!customModelName.value.trim()) {
        toast.warning(t('apiModal.modelNameRequired'));
        return;
    }
    emit("add-model", customModelName.value.trim());
    emit("update:show", false);
};

const handleClose = () => {
    emit("update:show", false);
};
</script>

<template>
    <Dialog :open="props.show" @update:open="handleClose">
        <DialogContent class="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{{ t('apiModal.addCustomModel') }}</DialogTitle>
            </DialogHeader>
            <div class="py-4">
                <Input
                    v-model="customModelName"
                    :placeholder="t('apiModal.modelNamePlaceholder')"
                    @keyup.enter="handleAddModel"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" @click="handleClose">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="handleAddModel">
                    {{ t('common.confirm') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
