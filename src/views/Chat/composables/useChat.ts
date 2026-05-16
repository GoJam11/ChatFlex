import { computed, readonly, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessageStore } from '@/features/msg/useMessageStore';
import { useSettingStore } from '@/features/setting/useSettingStore';
import type { Chat } from '@/types/chat';
import type { Msg } from '@/types/msg';
import { summarizeConversation } from '@/features/send/summary';
import { savePendingKnowledgeBasePath } from '@/features/tools/knowledgeBaseTool';
import {
    createChat as createChatRecord,
    deleteChat as deleteChatRecord,
    updateChat as persistChatUpdate,
    chatExists as checkChatExists,
    getChatInfo as fetchChatInfo,
    findNextActiveChat as locateNextChat,
    loadAllChats as fetchAllChats,
} from '@/features/chat/chatDataAccess';
import { getChatMessages } from '@/features/msg/messageDataAccess';

/**
 * Chat Composable - 聊天业务操作
 *
 * 职责：
 * 1. 聊天CRUD操作（创建、删除、重命名）
 * 2. 聊天业务操作（导出、总结、切换等）
 * 3. 不涉及数据加载和状态管理
 */
export function useChat() {
    const messageStore = useMessageStore();
    const settingStore = useSettingStore();
    const router = useRouter();

    const loading = ref(false);
    const error = ref<string | null>(null);

    /**
     * 创建新聊天
     */
    const createChat = async (title?: string): Promise<{
        success: boolean;
        chat?: Chat;
        error?: string;
    }> => {
        loading.value = true;
        error.value = null;

        try {
            await settingStore.ensureInitialized();

            // 从数据库读取全局模型配置
            const globalModel = settingStore.currentModel || 'gpt-4o-mini';
            const globalProvider = settingStore.currentProvider || 'openai';
            const createResult = await createChatRecord(
                title || '',
                undefined,
                globalModel,
                globalProvider,
            );

            if (!createResult.success || !createResult.chat) {
                throw new Error(createResult.error || '创建聊天失败');
            }

            // 保存待定知识库路径到新创建的会话
            await savePendingKnowledgeBasePath(createResult.chat.id);

            return { success: true, chat: createResult.chat };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error.value = errorMessage;
            console.error('[useChat] 创建聊天异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        } finally {
            loading.value = false;
        }
    };


    /**
     * 删除聊天
     */
    const deleteChat = async (chatId: string): Promise<{
        success: boolean;
        deletedChatId?: string;
        error?: string;
    }> => {
        loading.value = true;
        error.value = null;

        try {

            const deleteResult = await deleteChatRecord(chatId);

            if (!deleteResult.success) {
                throw new Error(deleteResult.error || '删除聊天失败');
            }

            return {
                success: true,
                deletedChatId: chatId
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error.value = errorMessage;
            console.error('[useChat] 删除聊天异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        } finally {
            loading.value = false;
        }
    };

    /**
     * 更新聊天
     */
    const updateChat = async (chatId: string, updates: Partial<Chat>): Promise<{
        success: boolean;
        error?: string;
    }> => {
        loading.value = true;
        error.value = null;

        try {

            const updateResult = await persistChatUpdate(chatId, updates);
            if (!updateResult.success) {
                throw new Error(updateResult.error || '更新聊天失败');
            }

            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error.value = errorMessage;
            console.error('[useChat] 更新聊天异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        } finally {
            loading.value = false;
        }
    };

    /**
     * 检查聊天是否存在
     */
    const chatExists = async (chatId: string): Promise<{
        success: boolean;
        exists?: boolean;
        error?: string;
    }> => {
        try {

            return await checkChatExists(chatId);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('[useChat] 检查聊天存在异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    /**
     * 获取聊天基本信息
     */
    const getChatInfo = async (chatId: string): Promise<{
        success: boolean;
        chat?: Chat;
        exists?: boolean;
        error?: string;
    }> => {
        try {

            return await fetchChatInfo(chatId);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('[useChat] 获取聊天信息异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    /**
     * 查找下一个激活聊天
     */
    const findNextActiveChat = async (excludeChatId: string): Promise<{
        success: boolean;
        nextActiveChatId?: string;
        nextActiveChat?: Chat;
        error?: string;
    }> => {
        try {

            return await locateNextChat(excludeChatId);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('[useChat] 查找下一个激活聊天异常:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    /**
     * 复杂业务编排：删除聊天并找到下一个激活聊天
     * 这是一个典型的业务编排场景，组合多个原子操作
     */
    const deleteChatAndFindNext = async (chatId: string): Promise<{
        success: boolean;
        deletedChatId?: string;
        nextActiveChatId?: string;
        nextActiveChat?: Chat;
        nextActiveMessages?: Msg[];
        error?: string;
    }> => {
        loading.value = true;
        error.value = null;

        try {
            // 1. 删除指定聊天
            const deleteResult = await deleteChat(chatId);

            if (!deleteResult.success) {
                throw new Error(deleteResult.error || '删除聊天失败');
            }

            // 2. 查找下一个激活聊天
            const findResult = await findNextActiveChat(chatId);

            if (!findResult.success) {
                throw new Error(findResult.error || '查找下一个激活聊天失败');
            }

            let nextActiveMessages: Msg[] = [];

            // 3. 如果找到了新的激活聊天，加载其消息
            if (findResult.nextActiveChatId && findResult.nextActiveChatId !== "0") {

                const messagesResult = await getChatMessages(findResult.nextActiveChatId);
                if (messagesResult.success && messagesResult.messages) {
                    nextActiveMessages = messagesResult.messages;
                }
            }

            return {
                success: true,
                deletedChatId: chatId,
                nextActiveChatId: findResult.nextActiveChatId,
                nextActiveChat: findResult.nextActiveChat,
                nextActiveMessages
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error.value = errorMessage;
            console.error('[useChat] 删除聊天并查找下一个激活聊天失败:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        } finally {
            loading.value = false;
        }
    };

    /**
     * 导出聊天历史
     * 获取所有聊天和对应的消息数据
     */
    const exportChatHistory = async (): Promise<{
        success: boolean;
        data?: Array<Chat & { messages: Msg[] }>;
        error?: string;
    }> => {
        loading.value = true;
        error.value = null;

        try {

            // 1. 获取所有聊天
            const chatsResult = await fetchAllChats();
            if (!chatsResult.success || !chatsResult.chats) {
                throw new Error(chatsResult.error || '获取聊天列表失败');
            }

            // 2. 为每个聊天获取消息
            const chatsWithMessages = await Promise.all(
                chatsResult.chats.map(async (chat) => {
                    const messagesResult = await getChatMessages(chat.id);
                    return {
                        ...chat,
                        messages: messagesResult.success && messagesResult.messages ? messagesResult.messages : [],
                    };
                })
            );

            return {
                success: true,
                data: chatsWithMessages
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            error.value = errorMessage;
            console.error('[useChat] 导出聊天历史失败:', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        } finally {
            loading.value = false;
        }
    };

    /**
     * 总结会话 - 生成会话标题
     * 使用 features/send/summary.ts 处理核心总结逻辑
     */
    const summarizeChat = async (chatId: string): Promise<{
        success: boolean;
        title?: string;
        error?: string;
    }> => {
        try {
            await settingStore.ensureInitialized();

            // 1. 检查是否启用AI总结
            if (!settingStore.enableAiSummary) {
                return { success: true }; // 不算错误，只是跳过
            }

            const summaryResult = await summarizeConversation({ chatId });

            if (!summaryResult.success) {
                return { success: false, error: summaryResult.error };
            }

            return { success: true, title: summaryResult.title };

        } catch (error: any) {
            console.error('[useChat] 总结会话失败:', error);
            return { success: false, error: error.message || '总结会话失败' };
        }
    };

    // 响应式状态
    const isLoading = computed(() => loading.value);
    const hasError = computed(() => error.value !== null);
    const errorMessage = computed(() => error.value);

    return {
        // 状态
        isLoading: readonly(isLoading),
        hasError: readonly(hasError),
        errorMessage: readonly(errorMessage),

        // 基础聊天操作 - 原子化操作
        createChat,
        deleteChat,
        updateChat,
        chatExists,
        getChatInfo,
        findNextActiveChat,

        // 复杂业务编排
        deleteChatAndFindNext,
        exportChatHistory,
        summarizeChat,


        // 完整的删除并切换方法，包含Store状态管理
        deleteChatAndSwitch: async (chatId: string): Promise<{
            success: boolean;
            error?: string;
            switchedToNewChat?: boolean;
            newActiveChatId?: string;
            newActiveMessages?: Msg[];
        }> => {
            try {

                // 1. 调用删除并查找下一个聊天的核心逻辑
                const result = await deleteChatAndFindNext(chatId);

                if (!result.success) {
                    return {
                        success: false,
                        error: result.error,
                        switchedToNewChat: false
                    };
                }

                // 如果找到了新的激活聊天，导航到新聊天
                if (result.nextActiveChatId && result.nextActiveChatId !== "0") {
                    await router.push({ name: 'Chat', params: { uuid: result.nextActiveChatId } });

                    // 如果有消息，设置到Store中
                    if (result.nextActiveMessages) {
                        messageStore.setMessages(result.nextActiveChatId, result.nextActiveMessages);
                    }

                    return {
                        success: true,
                        switchedToNewChat: true,
                        newActiveChatId: result.nextActiveChatId,
                        newActiveMessages: result.nextActiveMessages
                    };
                } else {
                    // 没有其他聊天了，导航到首页
                    await router.push({ name: 'Layout' });

                    return {
                        success: true,
                        switchedToNewChat: false,
                        newActiveChatId: "0"
                    };
                }

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('[useChat] deleteChatAndSwitch 异常:', errorMessage);

                return {
                    success: false,
                    error: errorMessage,
                    switchedToNewChat: false
                };
            }
        },
    };
}
