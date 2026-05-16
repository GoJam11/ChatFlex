<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon: Component
  text: string
  shortcut?: string[]
  isActive?: boolean
}

defineProps<Props>()

defineEmits<{
  click: []
}>()
</script>

<template>
    <button
        class="group flex w-full items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors duration-150 text-sm font-medium outline-none hover:bg-black/[0.06] dark:hover:bg-white/10"
        :class="isActive ? 'bg-black/[0.06] dark:bg-white/10 text-text-100' : 'text-text-100'"
        tabindex="0"
        @click="$emit('click')"
    >
        <div class="flex min-w-0 items-center gap-2">
            <div
                class="flex items-center justify-center transition-colors"
                :class="isActive ? 'text-text-100' : 'text-text-300 group-hover:text-text-200'"
            >
                <component :is="icon" :size="16" />
            </div>
            <div class="truncate">
                {{ text }}
            </div>
        </div>
        <div v-if="shortcut && shortcut.length" class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-text-400">
            <div class="flex items-center gap-0.5">
                <kbd v-for="key in shortcut" :key="key" class="font-sans min-w-[1.2em] h-[1.2em] flex items-center justify-center rounded bg-bg-200/50 px-1 border border-border-200/50">
                    {{ key }}
                </kbd>
            </div>
        </div>
    </button>
</template>
