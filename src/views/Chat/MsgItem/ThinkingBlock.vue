<script setup lang="ts">
import { computed } from "vue";
import { Msg, MessageStatus } from "@/types/msg.ts";
import { useI18n } from "@/features/i18n/useI18n";
import { useChatStore } from "@/features/chat/useChatStore";

const props = defineProps<{
    item: Msg;
}>();

const { t } = useI18n();
const chatStore = useChatStore();

const statusLabel = computed(() => {
    switch (props.item.status) {
        case MessageStatus.WAITING:
            return t('chat.thinkingBlock.waitingResponse');
        case MessageStatus.THINKING:
            return t('chat.thinking');
        case MessageStatus.GENERATING:
            return t('chat.generating');
        case MessageStatus.COMPLETED:
            return t('chat.thinkingBlock.completed');
        case MessageStatus.ERROR:
            return t('common.error');
        default:
            return t('chat.thinking');
    }
});

const inlineLabel = computed(() => {
    const base = t('chat.thinkingBlock.title');
    const status = statusLabel.value;
    return status ? `${base} · ${status}` : base;
});

function openThinkingPanel() {
    if (!props.item.thinkContent) {
        return;
    }
    chatStore.openRightPanel({ type: "thinkingDetails", message: props.item });
}
</script>

<template>
    <button v-if="item.thinkContent" class="think-inline-trigger" type="button" @click="openThinkingPanel">
        <span class="think-inline-text">
            {{ inlineLabel }}
        </span>
    </button>
</template>

<style scoped lang="less">
.think-inline-trigger {
    background: transparent;
    border: none;
    color: var(--text-color-2);
    cursor: pointer;
    display: block;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 0;
    text-align: left;
    width: 100%;

    &:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
    }
}

.think-inline-text {
    display: block;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
