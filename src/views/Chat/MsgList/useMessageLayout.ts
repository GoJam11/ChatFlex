import {
    ref,
    computed,
    watch,
    nextTick,
    onMounted,
    onUnmounted,
    readonly,
    type Ref,
} from "vue";
import { useMessageStore } from "@/features/msg/useMessageStore";
import { useChatStore, CREATE_NEW_CHAT } from "@/features/chat/useChatStore";
import { useRouteChat } from "@/features/chat/useRouteChat";
import { MessageStatus } from "@/types/msg";
import type { Msg } from "@/types/msg";

/**
 * useMessageLayout - 消息布局管理 hooks
 * 实现用户消息置顶显示，为AI回答预留最大空间
 */
export const useMessageLayout = (
    containerRef: Ref<HTMLElement | null>,
    enableAutoTop: boolean = true
) => {
    console.log("[useMessageLayout] 🚀 Hooks初始化开始");

    const spacerHeight = ref(0);
    const { chatId } = useRouteChat();
    const messageStore = useMessageStore();
    const resizeObserver = ref<ResizeObserver | null>(null);
    const currentAiMessageEl = ref<HTMLElement | null>(null);
    const lastProcessedMessageCount = ref(0);
    const currentAiMessageId = ref<string | null>(null);
    const isAiGenerating = ref(false);

    console.log("[useMessageLayout] 📝 初始状态:", {
        chatId: chatId.value,
        containerRefExists: !!containerRef.value,
    });

    // 计算当前消息列表
    const currentMsgList = computed(() => {
        if (!chatId.value || chatId.value === CREATE_NEW_CHAT) {
            console.log(
                "[useMessageLayout] 📋 消息列表为空 - 无聊天ID或新聊天"
            );
            return [];
        }
        const messages = messageStore.getMessages(chatId.value);
        console.log("[useMessageLayout] 📋 当前消息列表:", {
            chatId: chatId.value,
            messageCount: messages.length,
            messages: messages.map((m) => ({ id: m.id, role: m.role })),
        });
        return messages;
    });

    /**
     * 等待容器准备就绪
     */
    const waitForContainer = async (
        maxRetries = 10
    ): Promise<HTMLElement | null> => {
        for (let i = 0; i < maxRetries; i++) {
            if (containerRef.value) {
                console.log("[useMessageLayout] ✅ Container已准备就绪");
                return containerRef.value;
            }
            console.log(
                `[useMessageLayout] ⏳ 等待Container准备 (${
                    i + 1
                }/${maxRetries})`
            );
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        console.error("[useMessageLayout] ❌ Container等待超时");
        return null;
    };

    /**
     * 检测新用户消息并处理置顶
     */
    const detectAndHandleNewUserMessage = async (
        newMessages: Msg[],
        oldMessages: Msg[] = []
    ) => {
        console.log("[useMessageLayout] 🔍 检测新用户消息:", {
            newCount: newMessages.length,
            oldCount: oldMessages.length,
            lastProcessedCount: lastProcessedMessageCount.value,
        });

        // 检查是否有消息数量增加，且新增的是用户消息
        if (newMessages.length > lastProcessedMessageCount.value) {
            const newestMessage = newMessages[newMessages.length - 1];
            const userMessages = newMessages.filter((m) => m.role === "user");
            const oldUserMessages = oldMessages.filter(
                (m) => m.role === "user"
            );

            console.log("[useMessageLayout] 📊 消息增长分析:", {
                newestMessage: {
                    id: newestMessage?.id,
                    role: newestMessage?.role,
                },
                userMessagesCount: userMessages.length,
                oldUserMessagesCount: oldUserMessages.length,
            });

            // 检查是否有新的用户消息
            if (userMessages.length > oldUserMessages.length) {
                const newUserMessage = userMessages[userMessages.length - 1];
                console.log("[useMessageLayout] ✅ 发现新用户消息:", {
                    id: newUserMessage.id,
                    role: newUserMessage.role,
                    content:
                        typeof newUserMessage.content === "string"
                            ? `${newUserMessage.content.substring(0, 50)}...`
                            : "[非文本内容]",
                });

                // 等待容器准备就绪
                const container = await waitForContainer();
                if (container) {
                    await nextTick();
                    console.log(
                        "[useMessageLayout] ⏰ nextTick完成，开始处理置顶"
                    );
                    handleUserMessageTop(newUserMessage.id);
                }
            } else {
                console.log("[useMessageLayout] ❌ 消息增长但不是用户消息");
            }
        } else {
            console.log("[useMessageLayout] ❌ 消息数量未增长或已处理");
        }

        // 更新已处理的消息数量
        lastProcessedMessageCount.value = newMessages.length;
    };

    /**
     * 处理用户消息置顶
     */
    const handleUserMessageTop = (messageId: string) => {
        console.log("[useMessageLayout] 📌 开始处理用户消息置顶:", {
            messageId,
        });

        const container = containerRef.value;
        if (!container) {
            console.error("[useMessageLayout] ❌ Container ref 不可用");
            return;
        }

        console.log("[useMessageLayout] 📦 Container信息:", {
            tagName: container.tagName,
            className: container.className,
            clientHeight: container.clientHeight,
            scrollHeight: container.scrollHeight,
        });

        const messageEl = container.querySelector(
            `[data-message-id="${messageId}"]`
        ) as HTMLElement;
        if (messageEl) {
            console.log("[useMessageLayout] 🎯 找到消息元素:", {
                messageId,
                tagName: messageEl.tagName,
                className: messageEl.className,
                offsetHeight: messageEl.offsetHeight,
                dataRole: messageEl.dataset.role,
            });

            // 先计算占位高度
            console.log("[useMessageLayout] 📏 开始计算占位高度");
            calculateSpacer(messageEl);

            // 等待占位元素渲染后再滚动
            nextTick(() => {
                console.log(
                    "[useMessageLayout] 🔄 占位元素渲染完成，开始滚动到用户消息位置"
                );

                // 使用容器直接滚动，更精确的控制
                const containerScrollTop =
                    messageEl.offsetTop - container.offsetTop;
                console.log("[useMessageLayout] 📍 计算滚动位置:", {
                    messageOffsetTop: messageEl.offsetTop,
                    containerOffsetTop: container.offsetTop,
                    targetScrollTop: containerScrollTop,
                });

                container.scrollTo({
                    top: containerScrollTop,
                    behavior: "smooth",
                });
            });

            // 监听对应AI消息的高度变化
            console.log("[useMessageLayout] 👁️ 设置AI消息观察者");
            setupAiMessageObserver(messageEl);
        } else {
            console.error("[useMessageLayout] ❌ 未找到消息元素:", {
                messageId,
                querySelector: `[data-message-id="${messageId}"]`,
                allMessageElements: Array.from(
                    container.querySelectorAll("[data-message-id]")
                ).map((el) => ({
                    id: el.getAttribute("data-message-id"),
                    role: el.getAttribute("data-role"),
                })),
            });

            // 延迟重试，DOM可能还没完全渲染
            setTimeout(() => {
                console.log("[useMessageLayout] 🔄 延迟重试查找消息元素");
                const retryMessageEl = container.querySelector(
                    `[data-message-id="${messageId}"]`
                ) as HTMLElement;
                if (retryMessageEl) {
                    console.log("[useMessageLayout] ✅ 重试成功找到消息元素");
                    calculateSpacer(retryMessageEl);
                    nextTick(() => {
                        const containerScrollTop =
                            retryMessageEl.offsetTop - container.offsetTop;
                        container.scrollTo({
                            top: containerScrollTop,
                            behavior: "smooth",
                        });
                    });
                    setupAiMessageObserver(retryMessageEl);
                } else {
                    console.error(
                        "[useMessageLayout] ❌ 重试后仍未找到消息元素"
                    );
                }
            }, 200);
        }
    };

    /**
     * 设置AI消息的ResizeObserver
     */
    const setupAiMessageObserver = (userMessageEl: HTMLElement) => {
        console.log("[useMessageLayout] 👁️ 设置AI消息ResizeObserver");

        // 清除之前的观察者
        if (resizeObserver.value) {
            console.log("[useMessageLayout] 🧹 清除之前的ResizeObserver");
            resizeObserver.value.disconnect();
        }

        // 查找对应的AI消息
        const aiMessageEl = userMessageEl.nextElementSibling as HTMLElement;
        if (aiMessageEl && aiMessageEl.dataset.role === "assistant") {
            console.log("[useMessageLayout] 🤖 找到AI消息元素:", {
                tagName: aiMessageEl.tagName,
                className: aiMessageEl.className,
                offsetHeight: aiMessageEl.offsetHeight,
                dataRole: aiMessageEl.dataset.role,
                dataMessageId: aiMessageEl.dataset.messageId,
            });

            currentAiMessageEl.value = aiMessageEl;

            // 创建新的ResizeObserver监听AI消息高度变化
            resizeObserver.value = new ResizeObserver((entries) => {
                console.log("[useMessageLayout] 📐 ResizeObserver触发:", {
                    entriesCount: entries.length,
                    newHeight: entries[0]?.contentRect.height,
                    target: entries[0]?.target.getAttribute("data-message-id"),
                });

                // 重新计算占位高度
                calculateSpacer(userMessageEl);

                // AI内容变化后，确保用户消息仍然在顶部
                nextTick(() => {
                    const container = containerRef.value;
                    if (container) {
                        const containerScrollTop =
                            userMessageEl.offsetTop - container.offsetTop;
                        console.log(
                            "[useMessageLayout] 🔄 AI内容变化后重新定位用户消息:",
                            {
                                targetScrollTop: containerScrollTop,
                            }
                        );
                        container.scrollTo({
                            top: containerScrollTop,
                            behavior: "auto", // AI内容变化时使用即时滚动，避免频繁动画
                        });
                    }
                });
            });

            resizeObserver.value.observe(aiMessageEl);
            console.log("[useMessageLayout] ✅ ResizeObserver已设置");
        } else {
            console.warn("[useMessageLayout] ⚠️ 未找到对应的AI消息:", {
                hasNextSibling: !!aiMessageEl,
                nextSiblingRole: aiMessageEl?.dataset.role,
                nextSiblingTag: aiMessageEl?.tagName,
            });
        }
    };

    /**
     * 计算占位高度
     */
    const calculateSpacer = (userMessageEl: HTMLElement) => {
        console.log("[useMessageLayout] 📏 开始计算占位高度");

        const container = containerRef.value;
        if (!container) {
            console.error("[useMessageLayout] ❌ Container不可用于计算");
            return;
        }

        // 只有在AI相关流程中才计算占位高度
        if (!currentAiMessageId.value) {
            console.log("[useMessageLayout] ⏭️ 无AI消息关联，跳过占位计算");
            spacerHeight.value = 0;
            return;
        }

        try {
            const containerHeight = container.clientHeight;
            const userHeight = userMessageEl.offsetHeight;

            // 查找对应的AI消息（下一个兄弟元素）
            const aiMessageEl = userMessageEl.nextElementSibling as HTMLElement;
            const aiHeight = aiMessageEl?.offsetHeight || 0;

            // 计算占位高度：容器高度 - 用户消息高度 - AI消息高度
            const calculatedHeight = containerHeight - userHeight - aiHeight;
            const finalHeight = Math.max(0, calculatedHeight);

            console.log("[useMessageLayout] 📊 占位高度计算详情:", {
                containerHeight,
                userHeight,
                aiHeight,
                calculatedHeight,
                finalHeight,
                previousSpacerHeight: spacerHeight.value,
                isAiGenerating: isAiGenerating.value,
                aiMessageId: currentAiMessageId.value,
            });

            spacerHeight.value = finalHeight;

            console.log(
                "[useMessageLayout] ✅ 占位高度已更新:",
                spacerHeight.value
            );
        } catch (error) {
            console.error(
                "[useMessageLayout] ❌ 计算占位高度时发生错误:",
                error
            );
            spacerHeight.value = 0;
        }
    };

    /**
     * 重新计算当前布局（用于AI消息内容变化时）
     */
    const recalculateLayout = () => {
        console.log("[useMessageLayout] 🔄 重新计算布局");

        const container = containerRef.value;
        if (!container) {
            console.warn("[useMessageLayout] ⚠️ Container不可用，无法重新计算");
            return;
        }

        // 查找最后一个用户消息
        const userMessages = container.querySelectorAll(
            '[data-message-id][data-role="user"]'
        );
        const lastUserMessage = userMessages[
            userMessages.length - 1
        ] as HTMLElement;

        console.log("[useMessageLayout] 🔍 查找用户消息:", {
            totalUserMessages: userMessages.length,
            lastUserMessageId: lastUserMessage?.dataset.messageId,
        });

        if (lastUserMessage) {
            console.log("[useMessageLayout] 🎯 对最后用户消息重新计算");
            calculateSpacer(lastUserMessage);
        } else {
            console.warn("[useMessageLayout] ⚠️ 未找到用户消息");
        }
    };

    /**
     * 重置布局（清除占位高度）
     */
    const resetLayout = () => {
        console.log("[useMessageLayout] 🔄 重置布局:", {
            previousSpacerHeight: spacerHeight.value,
            hasResizeObserver: !!resizeObserver.value,
            hasCurrentAiMessage: !!currentAiMessageEl.value,
            currentAiMessageId: currentAiMessageId.value,
            isAiGenerating: isAiGenerating.value,
        });

        spacerHeight.value = 0;
        lastProcessedMessageCount.value = 0;
        currentAiMessageId.value = null;
        isAiGenerating.value = false;

        // 清理ResizeObserver
        if (resizeObserver.value) {
            console.log("[useMessageLayout] 🧹 断开ResizeObserver连接");
            resizeObserver.value.disconnect();
            resizeObserver.value = null;
        }
        currentAiMessageEl.value = null;

        console.log("[useMessageLayout] ✅ 布局重置完成");
    };

    // 监听消息变化，自动处理置顶
    watch(
        currentMsgList,
        (newMessages, oldMessages) => {
            console.log("[useMessageLayout] 👀 消息列表变化监听触发:", {
                newCount: newMessages.length,
                oldCount: oldMessages?.length || 0,
                chatId: chatId.value,
                enableAutoTop,
            });

            // 只有在启用自动置顶时才检测新用户消息
            if (enableAutoTop) {
                detectAndHandleNewUserMessage(newMessages, oldMessages || []);
            }

            // 检测AI消息创建，重新设置ResizeObserver
            if (newMessages.length > (oldMessages?.length || 0)) {
                const newestMessage = newMessages[newMessages.length - 1];
                if (newestMessage.role === "assistant") {
                    console.log(
                        "[useMessageLayout] 🤖 检测到新AI消息，重新设置观察者"
                    );
                    currentAiMessageId.value = newestMessage.id;
                    isAiGenerating.value =
                        newestMessage.status === MessageStatus.GENERATING ||
                        newestMessage.status === MessageStatus.THINKING ||
                        newestMessage.status === MessageStatus.WAITING;

                    console.log("[useMessageLayout] 🔄 AI消息状态:", {
                        messageId: newestMessage.id,
                        status: newestMessage.status,
                        isGenerating: isAiGenerating.value,
                    });

                    // 查找对应的用户消息
                    const userMessages = newMessages.filter(
                        (m) => m.role === "user"
                    );
                    if (userMessages.length > 0) {
                        const lastUserMessage =
                            userMessages[userMessages.length - 1];
                        setTimeout(async () => {
                            const container = await waitForContainer();
                            if (container) {
                                const userMessageEl = container.querySelector(
                                    `[data-message-id="${lastUserMessage.id}"]`
                                ) as HTMLElement;
                                if (userMessageEl) {
                                    console.log(
                                        "[useMessageLayout] 🔄 重新设置AI消息观察者"
                                    );
                                    setupAiMessageObserver(userMessageEl);
                                    // 重新计算占位高度
                                    calculateSpacer(userMessageEl);
                                }
                            }
                        }, 100); // 给DOM一点时间渲染
                    }
                }
            }

            // 监听AI消息状态变化
            if (currentAiMessageId.value) {
                const currentAiMessage = newMessages.find(
                    (m) => m.id === currentAiMessageId.value
                );
                if (currentAiMessage) {
                    const wasGenerating = isAiGenerating.value;
                    const nowGenerating =
                        currentAiMessage.status === MessageStatus.GENERATING ||
                        currentAiMessage.status === MessageStatus.THINKING ||
                        currentAiMessage.status === MessageStatus.WAITING;

                    if (wasGenerating && !nowGenerating) {
                        console.log(
                            "[useMessageLayout] ✅ AI回复完成，保持置顶布局避免视觉跳跃:",
                            {
                                messageId: currentAiMessage.id,
                                oldStatus: "generating",
                                newStatus: currentAiMessage.status,
                                maintainSpacerHeight: spacerHeight.value,
                            }
                        );

                        // AI回复完成，但保持占位高度避免视觉突然变化
                        isAiGenerating.value = false;

                        // 不清除currentAiMessageId，保持状态跟踪
                        // 不清除ResizeObserver，继续监听AI内容变化
                        console.log(
                            "[useMessageLayout] 🎯 会话内保持布局稳定，占位高度维持:",
                            spacerHeight.value
                        );
                    } else if (!wasGenerating && nowGenerating) {
                        isAiGenerating.value = true;
                        console.log(
                            "[useMessageLayout] 🔄 AI开始生成，状态更新:",
                            {
                                messageId: currentAiMessage.id,
                                status: currentAiMessage.status,
                            }
                        );
                    }
                }
            }
        },
        {
            flush: "post", // 确保DOM更新后执行
        }
    );

    // 监听聊天切换，重置布局
    watch(chatId, (newChatId, oldChatId) => {
        console.log("[useMessageLayout] 💬 聊天切换监听触发:", {
            newChatId,
            oldChatId,
        });
        // 聊天切换时始终重置布局（重新进入会话场景）
        if (newChatId !== oldChatId) {
            console.log("[useMessageLayout] 🔄 聊天切换，清除布局状态");
            resetLayout();
        }
    });

    // 组件卸载时清理
    onUnmounted(() => {
        console.log("[useMessageLayout] 🏁 组件卸载，执行清理");
        resetLayout();
    });

    return {
        spacerHeight,
        handleUserMessageTop,
        calculateSpacer,
        recalculateLayout,
        resetLayout,
        // 导出状态用于其他组件判断
        isAiGenerating: readonly(isAiGenerating),
        currentAiMessageId: readonly(currentAiMessageId),
    };
};
