<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
    defineProps<{
        content?: string;
        isActive?: boolean;
    }>(),
    {
        content: "",
        isActive: false,
    }
);

// 保证内容一直可用，避免调用方传入 null/undefined
const displayText = computed(() => props.content || "");

// 维持旧接口：在思考态且未闭合 </think> 时显示光标
const shouldShowCursor = computed(() => {
    if (!props.isActive) {
        return false;
    }

    const text = displayText.value;
    if (!text) {
        return true;
    }

    return !text.includes("</think>");
});
</script>

<template>
    <div class="thinking-animation">
        <div class="text-container">
            <div class="animated-text" v-html="displayText" />
            <span v-if="shouldShowCursor" class="cursor" aria-hidden="true" />
        </div>
    </div>
</template>

<style scoped>
.thinking-animation {
    display: inline-flex;
    align-items: flex-start;
}

.text-container {
    position: relative;
    display: inline-flex;
    min-height: 1.2em;
    line-height: 1.5;
    word-break: break-word;
}

.animated-text {
    display: inline;
    white-space: pre-wrap;
}

.cursor {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background-color: var(--primary-color, #18a058);
    margin-left: 2px;
    animation: blink 1s steps(2, start) infinite;
    vertical-align: text-bottom;
}

@keyframes blink {
    0%, 50% {
        opacity: 1;
    }

    51%, 100% {
        opacity: 0;
    }
}
</style>
