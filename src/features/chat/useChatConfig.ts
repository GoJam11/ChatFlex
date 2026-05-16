import { updateChat } from "@/features/chat/chatDataAccess";
import type { MemoryEntry, ReasoningStrength } from "@/types/chat";

/**
 * 会话配置管理 Composable
 * 
 * 职责：
 * 1. 处理会话配置的持久化
 * 2. 协调内存状态和数据库状态的同步
 * 3. 提供配置更新的统一接口
 */
export const useChatConfig = () => {
    /**
     * 更新会话模型配置
     * @param chatId 会话ID
     * @param model 模型名称
     * @param provider 供应商ID
     */
    const updateChatModel = async (chatId: string, model?: string, provider?: string): Promise<{
        success: boolean;
        error?: string;
    }> => {
        // 异步持久化，不阻塞用户操作
        try {
            const result = await updateChat(chatId, { model, provider });
            if (!result.success) {
                console.warn('[useChatConfig] 会话模型配置持久化失败:', result.error);
            }
            return result;
        } catch (error: any) {
            console.warn('[useChatConfig] 会话模型配置持久化异常:', error);
            return { success: false, error: error.message || '持久化失败' };
        }
    };

    /**
     * 更新会话系统提示
     * @param chatId 会话ID
     * @param systemPrompt 系统提示
     */
    const updateChatSystemPrompt = async (
        chatId: string,
        systemPrompt?: string,
        reasoningStrength?: ReasoningStrength,
    ): Promise<{
        success: boolean;
        error?: string;
    }> => {
        // 异步持久化，不阻塞用户操作
        try {
            const result = await updateChat(chatId, { systemPrompt, reasoningStrength });
            if (!result.success) {
                console.warn('[useChatConfig] 系统提示持久化失败:', result.error);
            }
            return result;
        } catch (error: any) {
            console.warn('[useChatConfig] 系统提示持久化异常:', error);
            return { success: false, error: error.message || '持久化失败' };
        }
    };

    /**
     * 更新会话配置
     * @param chatId 会话ID
     * @param config 配置对象
     */
    const updateChatConfig = async (chatId: string, config: {
        systemPrompt?: string;
        historyMsgCount?: number;
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        frequencyPenalty?: number;
        memoryTable?: MemoryEntry[];
        model?: string;
        provider?: string;
        reasoningStrength?: ReasoningStrength;
    }): Promise<{
        success: boolean;
        error?: string;
    }> => {
        // 异步持久化，不阻塞用户操作
        try {
            const result = await updateChat(chatId, config);
            if (!result.success) {
                console.warn('[useChatConfig] 会话配置持久化失败:', result.error);
            }
            return result;
        } catch (error: any) {
            console.warn('[useChatConfig] 会话配置持久化异常:', error);
            return { success: false, error: error.message || '持久化失败' };
        }
    };

    return {
        updateChatModel,
        updateChatSystemPrompt,
        updateChatConfig,
    };
};