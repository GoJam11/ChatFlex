/**
 * useMessages
 * 
 * 消息管理功能的组合式函数
 * 职责：
 * 1. 提供消息列表获取功能
 * 2. 处理消息删除的业务逻辑
 * 3. 处理消息编辑的业务逻辑 (支持 MessageContent)
 * 4. 管理操作过程中的状态
 * 5. 协调 Store 和 Service 层的调用
 * 6. 提供统一的错误处理
 */

import { ref } from 'vue';
import { useMessageStore } from '@/features/msg/useMessageStore';
import type { MessageContent } from '@/types/msg';
import { contentToString } from '@/utils/messageUtils';

export function useMessages() {
    const messageStore = useMessageStore();
    
    // 操作状态管理
    const isDeleting = ref(false);
    const isEditing = ref(false);
    const operatingMessageId = ref<string | null>(null);
    
    
    /**
     * 删除消息
     * @param chatId 聊天 ID
     * @param messageId 消息 ID
     */
    async function deleteMessage(
        chatId: string,
        messageId: string
    ): Promise<{
        success: boolean;
        error?: string;
    }> {
        if (isDeleting.value) {
            return {
                success: false,
                error: '正在删除其他消息，请稍后再试'
            };
        }
        
        
        try {
            isDeleting.value = true;
            operatingMessageId.value = messageId;
            
            const result = await messageStore.removeMessages(chatId, [messageId]);
            
            return result;
            
        } catch (error: any) {
            console.error('[useMessages] 删除消息失败:', error);
            return {
                success: false,
                error: error.message || '删除消息失败'
            };
        } finally {
            isDeleting.value = false;
            operatingMessageId.value = null;
        }
    }
    
    /**
     * 编辑消息 (支持 MessageContent 类型)
     * @param chatId 聊天 ID
     * @param messageId 消息 ID
     * @param newContent 新内容 (MessageContent 类型)
     */
    async function editMessage(
        chatId: string,
        messageId: string,
        newContent: MessageContent
    ): Promise<{
        success: boolean;
        error?: string;
    }> {
        if (isEditing.value) {
            return {
                success: false,
                error: '正在编辑其他消息，请稍后再试'
            };
        }
        
        
        const textContent = contentToString(newContent);
        if (!textContent.trim()) {
            return {
                success: false,
                error: '消息内容不能为空'
            };
        }
        
        try {
            isEditing.value = true;
            operatingMessageId.value = messageId;
            
            // 使用 store 的 editMessage 方法，传入转换后的字符串
            const result = await messageStore.editMessage(chatId, messageId, textContent);
            
            return result;
            
        } catch (error: any) {
            console.error('[useMessages] 编辑消息失败:', error);
            return {
                success: false,
                error: error.message || '编辑消息失败'
            };
        } finally {
            isEditing.value = false;
            operatingMessageId.value = null;
        }
    }
    
    /**
     * 检查是否可以操作消息
     * @param messageId 消息 ID
     */
    function canOperateMessage(messageId: string): boolean {
        return !isDeleting.value && !isEditing.value || 
               operatingMessageId.value === messageId;
    }
    
    /**
     * 取消当前操作
     */
    function cancelOperation(): void {
        isDeleting.value = false;
        isEditing.value = false;
        operatingMessageId.value = null;
    }
    
    return {
        // 状态
        isDeleting,
        isEditing,
        operatingMessageId,
        
        // 方法
        deleteMessage,
        editMessage,
        canOperateMessage,
        cancelOperation
    };
}