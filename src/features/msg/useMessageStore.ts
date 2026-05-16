import { ref, computed } from "vue";
import { defineStore } from "pinia";
import type { Msg, MessageRecord, ToolInvocation } from "@/types/msg";
import { messageDb } from "@/persistence/MessageDatabase";
import { mapMessageRecordToMsg } from "@/features/msg/messageMappers";

type StoreToolInvocation = Omit<ToolInvocation, 'output'> & { output?: unknown };
type StoreMsg = Omit<Msg, 'raw' | 'messages' | 'toolInvocation'> & {
    raw?: unknown;
    messages?: readonly unknown[];
    toolInvocation?: StoreToolInvocation;
};

export const useMessageStore = defineStore("message", () => {
    // --- 状态定义 ---

    // 按聊天ID存储消息列表 Map<chatId, StoreMsg[]>
    const messageMap = ref<Map<string, StoreMsg[]>>(new Map());

    // 加载状态
    const isLoadingMessages = ref(false);

    const toMessageObject = (record: MessageRecord): Msg => mapMessageRecordToMsg(record);

    // --- 状态更新方法 ---

    function setMessages(chatId: string, messages: Msg[]) {
        // 仅在存储层将深类型字段降级为 unknown
        const storeMessages = messages as unknown as StoreMsg[];
        messageMap.value.set(chatId, storeMessages);
    }

    function getMessages(chatId: string): Msg[] {
        const arr = messageMap.value.get(chatId) || [];
        return arr as unknown as Msg[];
    }

    function hasMessages(chatId: string): boolean {
        const messages = messageMap.value.get(chatId);
        return messages ? messages.length > 0 : false;
    }

    function addMessage(chatId: string, message: Msg) {
        const storeMessage = message as unknown as StoreMsg;
        const messages = messageMap.value.get(chatId) || [];
        const newMessages = [...messages, storeMessage];
        messageMap.value.set(chatId, newMessages);
    }

    function updateMessage(chatId: string, message: Msg) {
        const messages = messageMap.value.get(chatId);
        if (!messages) return;

        const msgIndex = messages.findIndex((m) => m.id === message.id);
        if (msgIndex > -1) {
            const oldMessage = messages[msgIndex];

            // 明确地合并字段，避免深层类型推导
            const updatedMessage: StoreMsg = {
                id: oldMessage.id,
                role: oldMessage.role,
                status: message.status ?? oldMessage.status,
                content: message.content ?? oldMessage.content,
                short: message.short ?? oldMessage.short,
                model: message.model ?? oldMessage.model,
                provider: message.provider ?? oldMessage.provider,
                timestamp: message.timestamp ?? oldMessage.timestamp,
                thinkContent: message.thinkContent ?? oldMessage.thinkContent,
                usage: message.usage ?? oldMessage.usage,
                raw: (message.raw ?? oldMessage.raw) as unknown,
                messages: (message.messages ?? oldMessage.messages) as readonly unknown[],
                errorMsg: message.errorMsg ?? oldMessage.errorMsg,
                toolInvocation: message.toolInvocation ?? oldMessage.toolInvocation,
            };

            // 创建新的数组来触发响应式更新
            const newMessages = [...messages];
            newMessages[msgIndex] = updatedMessage;
            messageMap.value.set(chatId, newMessages);
        }
    }

    async function removeMessages(chatId: string, messageIds: string[]): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            const messageRecords: MessageRecord[] = [];

            for (const messageId of messageIds) {
                const record = await messageDb.getMessage(messageId);
                if (record) {
                    messageRecords.push(record);
                }
            }

            for (const record of messageRecords) {
                await messageDb.deleteMessage(record.id);
            }

            // 2. 更新内存中的状态
            const messages = messageMap.value.get(chatId);
            if (messages) {
                const newMessages = messages.filter(
                    (msg) => !messageIds.includes(msg.id)
                );
                messageMap.value.set(chatId, newMessages);
            }

            return { success: true };
        } catch (error: any) {
            console.error('[MessageStore] removeMessages 失败:', error);
            return {
                success: false,
                error: error.message || '删除消息失败'
            };
        }
    }

    async function editMessage(chatId: string, messageId: string, newContent: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            const shortText = newContent.slice(0, 50) + (newContent.length > 50 ? '...' : '');

            await messageDb.updateMessage(messageId, {
                content: newContent,
                short: shortText,
            });

            const updatedRecord = await messageDb.getMessage(messageId);

            if (updatedRecord) {
                const updatedMessage = toMessageObject(updatedRecord);
                updateMessage(chatId, updatedMessage);
            }

            return { success: true };
        } catch (error: any) {
            console.error('[MessageStore] editMessage 失败:', error);
            return {
                success: false,
                error: error.message || '编辑消息失败'
            };
        }
    }

    function clearMessages(chatId: string) {
        messageMap.value.delete(chatId);
    }

    function setLoadingState(loading: boolean) {
        isLoadingMessages.value = loading;
    }

    // --- 计算属性 ---

    // 获取指定聊天的消息数量
    const getMessageCount = computed(() => {
        return (chatId: string) => getMessages(chatId).length;
    });

    // 获取指定聊天的最后一条消息预览
    const getLastMessagePreview = computed(() => {
        return (chatId: string) => {
            const messages = getMessages(chatId);
            if (messages.length === 0) return "";

            const lastMessage = messages[messages.length - 1];
            return (
                lastMessage.short ||
                lastMessage.content?.toString().slice(0, 50) ||
                ""
            );
        };
    });

    return {
        // 状态
        messageMap,
        isLoadingMessages,

        // 方法
        setMessages,
        getMessages,
        hasMessages,
        addMessage,
        updateMessage,
        removeMessages,
        editMessage,
        clearMessages,
        setLoadingState,

        // 计算属性
        getMessageCount,
        getLastMessagePreview,
    };
});
