<script setup>
import EditArea from "@/views/Chat/EditArea/EditArea.vue";
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
    <div class="h-full flex flex-col py-3">
        <div class="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p class="m-0 text-2xl font-semibold text-text-100 text-center leading-9">
                {{ t('home.greeting') }}
            </p>
        </div>

        <div class="pb-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <EditArea />
        </div>
    </div>
</template>
