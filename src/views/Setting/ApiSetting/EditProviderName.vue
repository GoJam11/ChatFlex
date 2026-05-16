<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit } from "lucide-vue-next";
import { useI18n } from 'vue-i18n';
import { useProviderService } from '@/features/provider/providerService';

interface Props {
    providerKey: string;
    displayName: string;
    isPreset?: boolean;
}

const props = defineProps<Props>();
const providerService = useProviderService();
const { t } = useI18n();

const showEditNameModal = ref(false);
const newProviderName = ref("");

// 使用父组件传递的isPreset属性
const isPresetProvider = computed(() => {
    return props.isPreset ?? false;
});

watch(
    () => props.displayName,
    (newName) => {
        newProviderName.value = newName;
    }
);

const openEditNameModal = () => {
    newProviderName.value = props.displayName;
    showEditNameModal.value = true;
};

const handleUpdateProviderName = async () => {
    if (newProviderName.value.trim()) {
        await providerService.updateProvider(props.providerKey, {
            displayName: newProviderName.value.trim(),
        });
        showEditNameModal.value = false;
    }
};
</script>

<template>
    <div class="flex items-center">
        <h2 class="text-xl font-semibold pr-1">
            {{ props.displayName }}
        </h2>
        <Button 
            v-if="!isPresetProvider"
            size="sm" 
            variant="ghost" 
            class="ml-2 h-8 w-8 p-0" 
            @click="openEditNameModal"
        >
            <Edit class="h-4 w-4" />
        </Button>
    </div>

    <Dialog :open="showEditNameModal" @update:open="(value) => showEditNameModal = value">
        <DialogContent class="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>{{ t('apiModal.editProviderName') }}</DialogTitle>
            </DialogHeader>
            <div class="py-4">
                <Input
                    v-model="newProviderName"
                    :placeholder="t('apiModal.newProviderNamePlaceholder')"
                    @keyup.enter="handleUpdateProviderName"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" @click="showEditNameModal = false">
                    {{ t('common.cancel') }}
                </Button>
                <Button @click="handleUpdateProviderName">
                    {{ t('common.save') }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
