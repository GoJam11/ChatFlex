<template>
    <div class="relative">
        <Search
            v-if="!isSearching"
            class="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-text-400"
        />
        <LoaderCircle
            v-else
            class="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 animate-spin text-text-400"
        />
        <Input
            :model-value="searchQuery"
            :placeholder="getPlaceholder()"
            class="h-8 w-full rounded-lg bg-black/[0.04] dark:bg-white/5 border-0 pl-9 pr-3 text-xs text-text-100 placeholder:text-text-400 focus-visible:ring-1 focus-visible:ring-border-300 focus-visible:ring-offset-0 focus-visible:border-border-300 dark:focus-visible:border-white/20 shadow-none"
            @update:model-value="(value) => $emit('update:searchQuery', String(value))"
            @focus="$emit('focus')"
        />
    </div>
</template>

<script setup lang="ts">
import {Search, LoaderCircle} from 'lucide-vue-next';
import {Input} from '@/components/ui/input';
import { useI18n } from 'vue-i18n';

interface Props {
    searchQuery: string;
    isSearching: boolean;
}

interface Emits {
    (e: 'update:searchQuery', value: string): void;
    (e: 'focus'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const { t } = useI18n();

// 动态占位符
function getPlaceholder() {
    return t('chat.searchChats');
}
</script>
