import { watch, computed, ref, readonly } from "vue";
import { CREATE_NEW_CHAT } from "@/features/chat/useChatStore";
import { useMessageStore } from "@/features/msg/useMessageStore";
import { useRouteChat } from "@/features/chat/useRouteChat";
import type { Chat } from "@/types/chat";
import type { Msg } from "@/types/msg";
import { chatDb } from "@/persistence/ChatDatabase";
import { messageDb } from "@/persistence/MessageDatabase";
import { mapChatRecordToChat } from "@/features/chat/chatMappers";
import { mapMessageRecordToMsg } from "@/features/msg/messageMappers";

/**
 * 统一的聊天数据管理 composable
 * 负责协调消息 Store 与数据库，监听路由变化，提供统一的数据管理接口
 * 整合了数据加载功能（原 useChatLoader）
 */
export function useChatData() {
    const messageStore = useMessageStore();
    const { chatId } = useRouteChat();

    const loadError = ref<string | null>(null);

    /**
     * 加载指定聊天的消息
     */
    async function loadChatMessages(chatId: string): Promise<{
        success: boolean;
        chat?: Chat;
        messages?: Msg[];
        error?: string;
    }> {
        try {
            console.log("[ChatData] 开始加载聊天消息:", chatId);
            const [chatRecord, messageRecords] = await Promise.all([
                chatDb.getChatById(chatId),
                messageDb.getChatMessages(chatId),
            ]);

            if (!chatRecord) {
                const errorMessage = `聊天不存在: ${chatId}`;
                console.error("[ChatData] 聊天消息加载失败:", errorMessage);
                return { success: false, error: errorMessage };
            }

            console.log(
                "[ChatData] 聊天消息加载成功:",
                messageRecords.length
            );

            return {
                success: true,
                chat: mapChatRecordToChat(chatRecord),
                messages: messageRecords.map(mapMessageRecordToMsg),
            };
        } catch (error: any) {
            console.error("[ChatData] 聊天消息加载异常:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 加载指定聊天的消息并同步到Store
     */
    async function loadAndSyncChatMessages(chatIdToLoad: string): Promise<{
        success: boolean;
        error?: string;
        skipped?: boolean;
    }> {
        if (!chatIdToLoad || chatIdToLoad === CREATE_NEW_CHAT) {
            loadError.value = null;
            return { success: true, skipped: true };
        }

        // 检查消息是否已加载
        if (messageStore.hasMessages(chatIdToLoad)) {
            console.log("[ChatData] 消息已存在，跳过加载");
            loadError.value = null;
            return { success: true, skipped: true };
        }

        messageStore.setLoadingState(true);

        try {
            const result = await loadChatMessages(chatIdToLoad);

            if (result.success && result.messages) {
                // 存储消息
                messageStore.setMessages(chatIdToLoad, result.messages);

                if (result.chat) {
                    const existingChat = await chatDb.getChatById(
                        chatIdToLoad
                    );
                    if (!existingChat) {
                        console.warn(
                            `[ChatData] 聊天 ${chatIdToLoad} 不存在于数据库，已跳过本地缓存更新`
                        );
                    }
                }

                loadError.value = null;
                return { success: true };
            } else {
                const errorMessage =
                    result.error || `聊天 ${chatIdToLoad} 消息加载失败`;
                console.error(
                    `[ChatData] 加载聊天 [${chatIdToLoad}] 失败:`,
                    errorMessage
                );
                loadError.value = errorMessage;
                return { success: false, error: errorMessage };
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : `聊天 ${chatIdToLoad} 消息加载异常`;
            console.error(
                `[ChatData] 加载聊天 [${chatIdToLoad}] 异常:`,
                error
            );
            loadError.value = errorMessage;
            return { success: false, error: errorMessage };
        } finally {
            messageStore.setLoadingState(false);
        }
    }

    // --- 计算属性 ---

    const currentMessages = computed(() => {
        if (!chatId.value || chatId.value === CREATE_NEW_CHAT) {
            return [];
        }
        return messageStore.getMessages(chatId.value);
    });

    const isMsgListEmpty = computed(() => {
        if (messageStore.isLoadingMessages) {
            return false;
        }
        return currentMessages.value.length === 0;
    });

    // 监听路由变化，加载对应的消息
    watch(
        () => chatId.value,
        async (newChatId) => {
            if (!newChatId || newChatId === CREATE_NEW_CHAT) {
                loadError.value = null;
                return;
            }

            const result = await loadAndSyncChatMessages(newChatId);
            if (!result.success && result.error) {
                console.warn(
                    `[ChatData] 聊天 ${newChatId} 消息同步失败:`,
                    result.error
                );
            }
        },
        { immediate: true }
    );

    return {
        // 状态
        chatId,
        currentMessages,
        isMsgListEmpty,
        loadError: readonly(loadError),

        // Store引用
        messageStore,

        // 数据加载方法（原 useChatLoader 功能）
        loadChatMessages,

        // 数据管理方法
        loadAndSyncChatMessages,
    };
}
