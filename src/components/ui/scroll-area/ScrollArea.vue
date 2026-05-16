<script setup lang="ts">
import type { ScrollAreaRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ref, computed } from "vue"
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaViewport,
} from "reka-ui"
import { cn } from "@/lib/utils"
import ScrollBar from "./ScrollBar.vue"

const props = defineProps<ScrollAreaRootProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

// 创建ScrollAreaRoot的ref
const scrollAreaRootRef = ref<{ viewport: HTMLElement } | null>(null)

// 计算viewport属性以确保响应式
const viewport = computed(() => scrollAreaRootRef.value?.viewport)

// 暴露viewport给父组件使用（按照成功案例的模式）
defineExpose({
  viewport
})
</script>

<template>
    <ScrollAreaRoot
        ref="scrollAreaRootRef"
        v-bind="delegatedProps"
        :class="cn('relative overflow-hidden', props.class)"
    >
        <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
            <slot />
        </ScrollAreaViewport>
        <ScrollBar />
        <ScrollAreaCorner />
    </ScrollAreaRoot>
</template>
