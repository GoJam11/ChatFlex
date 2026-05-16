<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onUnmounted, computed, shallowRef, watchEffect } from "vue";
import { toast } from "vue-sonner";
import { useChatStore, type ScrollFn } from "@/features/chat/useChatStore.ts";
import { useSettingStore } from "@/features/setting/useSettingStore.ts";
import MsgItem from "@/views/Chat/MsgItem/MsgItem.vue";
import AgentStepsBlock from "@/views/Chat/MsgItem/AgentStepsBlock.vue";
import { resendMessage } from "@/features/send/send";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { useMessages } from "@/features/msg/useMessages";
import { useScroll, useElementSize } from "@vueuse/core";
import { useMessageList } from "@/features/msg/useMessageList.ts";
import { groupMessages, type MessageGroup } from "@/features/msg/useMessageGroups.ts";

import { Msg, MessageContent, MessageStatus } from "@/types/msg.ts";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-vue-next";
import { useI18n } from 'vue-i18n';

const chatStore = useChatStore();
const settingStore = useSettingStore();
const { t } = useI18n();
const { chatId } = useRouteChat();
const { deleteMessage, editMessage } = useMessages();

// 使用消息列表 composable
const {
    messages: currentMsgList,
    isLoading,
    error,
    hasLoadedInitialData,
} = useMessageList(chatId);

const displayMessages = computed(() => currentMsgList.value);

// 消息分组
const messageGroups = shallowRef<MessageGroup[]>([]);
watchEffect(() => {
    const msgs: any[] = displayMessages.value;
    messageGroups.value = groupMessages(msgs);
});

// 按照成功案例的模式创建ScrollArea ref
const scrollAreaRef = ref<{ viewport: HTMLElement } | null>(null);

// 使用VueUse监听ScrollArea的viewport
const { y: scrollY, arrivedState } = useScroll(() => scrollAreaRef.value?.viewport);

// 使用useElementSize获取viewport的尺寸信息
const { height: viewportHeight } = useElementSize(() => scrollAreaRef.value?.viewport);

const ASSISTANT_ACTIVE_STATUSES = new Set<MessageStatus>([
    MessageStatus.WAITING,
    MessageStatus.THINKING,
    MessageStatus.GENERATING,
]);

const isAwaitingAssistant = ref(false);
const lastTrackedMessageId = ref<string | null>(null);
const alignmentSpacerHeight = ref(0);
const alignedMessageId = ref<string | null>(null);

const getMessageElement = (viewportEl: HTMLElement, messageId: string) =>
    viewportEl.querySelector(
        `[data-message-id="${messageId}"]`
    ) as HTMLElement | null;

const getAssistantSibling = (messageEl: HTMLElement | null) => {
    if (!messageEl) {
        return null;
    }

    let sibling = messageEl.nextElementSibling as HTMLElement | null;
    while (sibling) {
        const messageId = sibling.dataset?.messageId;
        if (messageId) {
            return sibling.dataset?.role === "assistant" ? sibling : null;
        }
        sibling = sibling.nextElementSibling as HTMLElement | null;
    }
    return null;
};

const calculateSpacerHeightForMessage = (
    messageEl: HTMLElement,
    viewportEl: HTMLElement
) => {
    const viewportSize =
        viewportHeight.value || viewportEl.clientHeight || 0;

    if (!viewportSize) {
        return 0;
    }

    const assistantEl = getAssistantSibling(messageEl);
    const assistantHeight = assistantEl?.offsetHeight ?? 0;

    return Math.max(
        viewportSize - messageEl.offsetHeight - assistantHeight,
        0
    );
};

const refreshAlignmentSpacer = () => {
    if (!alignedMessageId.value) {
        alignmentSpacerHeight.value = 0;
        return;
    }

    const viewportEl = scrollAreaRef.value?.viewport;
    if (!viewportEl) {
        return;
    }

    const target = getMessageElement(viewportEl, alignedMessageId.value);
    if (!target) {
        alignmentSpacerHeight.value = 0;
        alignedMessageId.value = null;
        return;
    }

    alignmentSpacerHeight.value = calculateSpacerHeightForMessage(
        target,
        viewportEl
    );
};

const alignMessageToTop = async (messageId: string) => {
    await nextTick();

    const viewportEl = scrollAreaRef.value?.viewport;
    if (!viewportEl) {
        return;
    }

    const target = getMessageElement(viewportEl, messageId);
    if (!target) {
        return;
    }

    alignedMessageId.value = messageId;
    alignmentSpacerHeight.value = calculateSpacerHeightForMessage(
        target,
        viewportEl
    );

    await nextTick();

    const targetTop = target.offsetTop - viewportEl.offsetTop;
    viewportEl.scrollTo({ top: targetTop, behavior: "auto" });
};

watch(
    displayMessages,
    (newMessages, oldMessages) => {
        const lastMessage = newMessages.length
            ? newMessages[newMessages.length - 1]
            : null;

        if (!oldMessages) {
            lastTrackedMessageId.value = lastMessage?.id ?? null;
            if (
                lastMessage?.role === "assistant" &&
                ASSISTANT_ACTIVE_STATUSES.has(lastMessage.status)
            ) {
                isAwaitingAssistant.value = true;
            } else {
                isAwaitingAssistant.value = false;
            }
            return;
        }

        if (!lastMessage) {
            lastTrackedMessageId.value = null;
            isAwaitingAssistant.value = false;
            return;
        }

        const hasLastChanged =
            lastTrackedMessageId.value !== lastMessage.id;

        if (hasLastChanged) {
            lastTrackedMessageId.value = lastMessage.id;

            if (lastMessage.role === "user") {
                isAwaitingAssistant.value = true;
                void alignMessageToTop(lastMessage.id);
                return;
            }

            if (lastMessage.role === "assistant") {
                isAwaitingAssistant.value = ASSISTANT_ACTIVE_STATUSES.has(
                    lastMessage.status
                );
                return;
            }

            isAwaitingAssistant.value = false;
            return;
        }

        if (lastMessage.role === "assistant") {
            const isActive = ASSISTANT_ACTIVE_STATUSES.has(
                lastMessage.status
            );
            isAwaitingAssistant.value = isActive;
            if (!isActive) {
                lastTrackedMessageId.value = lastMessage.id;
            }
        }
    },
    { immediate: true }
);

const bottomSpacerHeight = computed(() => {
    if (!isAwaitingAssistant.value) {
        return 0;
    }

    return Math.max(0, alignmentSpacerHeight.value);
});

watch(isAwaitingAssistant, (awaiting) => {
    if (!awaiting) {
        alignmentSpacerHeight.value = 0;
        alignedMessageId.value = null;
        return;
    }

    nextTick(() => refreshAlignmentSpacer());
});

watch(
    displayMessages,
    () => {
        if (isAwaitingAssistant.value) {
            nextTick(() => refreshAlignmentSpacer());
        }
    },
    { deep: true, flush: "post" }
);

watch(viewportHeight, () => {
    if (isAwaitingAssistant.value) {
        nextTick(() => refreshAlignmentSpacer());
    }
});



// 按照成功案例的模式实现scrollToBottom
const scrollToBottom = (force = false, behavior: "smooth" | "auto" = "smooth") => {
    // 如果设置为置顶布局且不是强制滚动，不执行传统的滚动到底部
    if (settingStore.messageScrollBehavior === "top" && !force) {
        return;
    }

    const viewportEl = scrollAreaRef.value?.viewport;
    if (!viewportEl) {
        return;
    }

    const scrollBehavior: ScrollBehavior = behavior === "auto" ? "auto" : "smooth";

    viewportEl.scrollTo({
        top: viewportEl.scrollHeight,
        behavior: scrollBehavior,
    });
};

// 滚动按钮显示阈值（距离底部的像素）
const SCROLL_THRESHOLD = 200;

// 使用computed计算是否应该显示滚动按钮（完全基于VueUse响应式数据）
const showScrollButton = computed(() => {
    // 如果到达底部，不显示按钮
    if (arrivedState.bottom) {
        return false;
    }
    
    // 检查是否有有效的尺寸数据
    if (!viewportHeight.value || viewportHeight.value <= 0) {
        return false;
    }
    
    // 计算距离底部的距离，当用户向上滚动超过阈值时显示按钮
    return scrollY.value > SCROLL_THRESHOLD;
});

// 点击按钮滚动到底部
const handleScrollToBottom = () => {
    scrollToBottom(true);
};

const scrollToTarget: ScrollFn = (
    position = "bottom",
    onlyScrollWhenAtBottom = false
) => {
    if (onlyScrollWhenAtBottom && !arrivedState.bottom) {
        return;
    }

    const viewportEl = scrollAreaRef.value?.viewport;
    if (!viewportEl) {
        return;
    }

    if (position === "bottom") {
        scrollToBottom(true, "auto");
        return;
    }

    if (position === "top") {
        viewportEl.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }

    if (typeof position === "number") {
        viewportEl.scrollTo({ top: position, behavior: "smooth" });
    }
};

// 设置滚动函数到 chatStore
onMounted(() => {
    chatStore.scrollTo = scrollToTarget;
});

onUnmounted(() => {
    chatStore.scrollTo = () => {};
});


async function handleRetry(item: Msg) {
    if (chatStore.isChatBusy(chatId.value)) {
        toast.error(t('chat.processing'));
        return;
    }

    try {
        const result = await resendMessage({ chatId: chatId.value, messageId: item.id });

        if (!result.success) {
            throw new Error(result.error || t('messages.retryFailed'));
        }
    } catch (e: any) {
        console.error("MsgList handleRetry error:", e);
        toast.error(e.message || t('errors.networkError'));
    }
}

async function handleDelete(item: Msg) {
    if (chatStore.isChatBusy(chatId.value)) {
        toast.error(t('chat.processing'));
        return;
    }

    try {
        const result = await deleteMessage(chatId.value, item.id);
        if (result.success) {
            toast.success(t('messages.deleteSuccess'));
        } else {
            throw new Error(result.error || t('messages.deleteFailed'));
        }
    } catch (e: any) {
        console.error("MsgList handleDelete error:", e);
        toast.error(e.message || t('messages.deleteFailed'));
    }
}

async function handleEdit(item: Msg, newContent: MessageContent) {
    if (chatStore.isChatBusy(chatId.value)) {
        toast.error(t('chat.processing'));
        return;
    }

    try {
        const result = await editMessage(chatId.value, item.id, newContent);
        if (result.success) {
            toast.success(t('messages.editSuccess'));
        } else {
            throw new Error(result.error || t('messages.editFailed'));
        }
    } catch (e: any) {
        toast.error(e.message || t('messages.editFailed'));
    }
}

// 监听聊天切换
watch(
    () => chatId.value,
    async (newChatId, oldChatId) => {
        await nextTick();

        alignmentSpacerHeight.value = 0;
        alignedMessageId.value = null;

        // 只有在真正切换到不同聊天时才滚动到底部
        // 避免在同一聊天内的操作中触发不必要的滚动
        if (newChatId !== oldChatId) {
            scrollToBottom(true, "auto"); // 强制滚动到底部
        }
    },
    { immediate: true }
);

watch(
    hasLoadedInitialData,
    (loaded) => {
        if (loaded) {
            nextTick(() => scrollToBottom(true, "auto"));
        }
    },
    { immediate: false }
);

</script>

<template>
    <div class="flex-grow relative h-full overflow-hidden">
        <ScrollArea ref="scrollAreaRef" class="h-full select-text text-base">
            <div class="px-4 py-6 max-w-3xl mx-auto w-full">
                <template v-for="group in messageGroups" :key="group.id">
                    <!-- 用户消息 -->
                    <MsgItem
                        v-if="group.userMessage"
                        :item="group.userMessage"
                        @retry="handleRetry"
                        @delete="handleDelete"
                        @edit="handleEdit"
                    />

                    <!-- 中间步骤（思考+工具调用）合并展示 -->
                    <AgentStepsBlock
                        v-if="group.steps.length > 0"
                        :steps="group.steps"
                        :final-message="group.finalAssistant"
                    />

                    <!-- 最终 assistant 回答 -->
                    <MsgItem
                        v-if="group.finalAssistant"
                        :item="group.finalAssistant"
                        :show-actions="true"
                        :hide-thinking="group.steps.length > 0"
                        :hide-tool-message="true"
                        @retry="handleRetry"
                        @delete="handleDelete"
                        @edit="handleEdit"
                    />
                </template>
            </div>
            <div
                v-if="bottomSpacerHeight > 0"
                class="w-full shrink-0 pointer-events-none"
                :style="{ height: `${bottomSpacerHeight}px` }"
            />
        </ScrollArea>

        <!-- 滚动到底部按钮 -->
        <Transition name="fade">
            <Button
                v-if="showScrollButton"
                class="absolute bottom-5 right-5 w-8 h-8 rounded-full shadow-md z-10 bg-bg-100 border border-border-200 hover:bg-bg-200 text-text-200"
                size="icon"
                variant="ghost"
                @click="handleScrollToBottom"
            >
                <ChevronDown class="h-4 w-4" />
            </Button>
        </Transition>
    </div>
</template>

<style scoped>
/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>

