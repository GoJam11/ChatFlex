import Dexie from 'dexie';
import { v4 as uuid } from 'uuid';
import { chatFlexDb } from './chatflex-db';
import { chatDb } from './ChatDatabase';
import type { MessageContent, MessageRecord, MessageRole, Msg } from '@/types/msg';
import { MessageStatus, isErrorMsg } from '@/types/msg';
import { withTimeout } from '@/utils/timeout';
import { generateMessagePreview } from '@/utils/messagePreview';

const messagesTable = chatFlexDb.messages;

export class MessageDatabase {
  get messages() {
    return messagesTable;
  }

  async addMessage(message: MessageRecord): Promise<string> {
    await withTimeout(
      messagesTable.put(message),
      { timeout: 10000, timeoutMessage: `添加消息 ${message.id} 超时` },
    );

    await chatDb.updateMessageStats(message.chatId);
    return message.id;
  }

  async getMessage(id: string): Promise<MessageRecord | undefined> {
    return withTimeout(
      messagesTable.get(id),
      { timeout: 8000, timeoutMessage: `获取消息 ${id} 超时` },
    );
  }

  async getChatMessages(chatId: string): Promise<MessageRecord[]> {
    return withTimeout(
      messagesTable
        .where('[chatId+timestamp]')
        .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
        .sortBy('timestamp'),
      { timeout: 20000, timeoutMessage: `获取聊天 ${chatId} 消息列表超时` },
    );
  }

  async updateMessage(
    id: string,
    changes: Partial<Omit<MessageRecord, 'id' | 'chatId'>>,
  ): Promise<void> {
    const existing = await this.getMessage(id);

    const normalizedChanges = { ...changes } as Partial<Omit<MessageRecord, 'id' | 'chatId'>> & {
      messages?: MessageRecord['messages'];
    };

    // 保持 messages 字段仅由显式传入时更新，避免从 raw 推断，降低类型复杂度

    await withTimeout(
      messagesTable.update(id, normalizedChanges),
      { timeout: 10000, timeoutMessage: `更新消息 ${id} 超时` },
    );

    if (existing) {
      await chatDb.updateMessageStats(existing.chatId);
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const record = await this.getMessage(id);

    await withTimeout(
      messagesTable.delete(id),
      { timeout: 8000, timeoutMessage: `删除消息 ${id} 超时` },
    );

    if (record) {
      await chatDb.updateMessageStats(record.chatId);
    }
  }

  async deleteChatMessages(chatId: string): Promise<void> {
    await withTimeout(
      messagesTable
        .where('chatId')
        .equals(chatId)
        .delete(),
      { timeout: 20000, timeoutMessage: `删除聊天 ${chatId} 消息超时` },
    );

    await chatDb.updateMessageStats(chatId, 0, '', undefined);
  }

  async createMessageFromObject(chatId: string, msg: Msg): Promise<string> {
    const baseRecord = {
      id: msg.id,
      chatId,
      content: msg.content,
      short: msg.short ?? this.generateShortText(msg.content),
      role: msg.role,
      model: msg.model,
      provider: msg.provider,
      status: msg.status,
      timestamp: msg.timestamp || Date.now(),
      thinkContent: msg.thinkContent,
      usage: msg.usage,
      raw: msg.raw,
      messages: msg.messages,
      toolInvocation: msg.toolInvocation,
    };

    const messageRecord: MessageRecord = isErrorMsg(msg)
      ? { ...baseRecord, errorMsg: msg.errorMsg ?? 'Unknown error' } as MessageRecord
      : baseRecord as MessageRecord;

    return await this.addMessage(messageRecord);
  }

  async createUserMessage(chatId: string, content: MessageContent): Promise<{ success: boolean; message?: Msg; error?: string }> {
    try {
      const message: Msg = {
        id: uuid(),
        content,
        role: 'user',
        status: MessageStatus.COMPLETED,
        timestamp: Date.now(),
      } as Msg;

      await this.createMessageFromObject(chatId, message);
      return { success: true, message };
    } catch (error: any) {
      console.error('[MessageDatabase] 创建用户消息失败:', error);
      return { success: false, error: error.message || '创建用户消息失败' };
    }
  }

  async createAssistantMessage(
    chatId: string,
    model: string,
    provider: string,
  ): Promise<{ success: boolean; message?: Msg; error?: string }> {
    try {
      const message: Msg = {
        id: uuid(),
        content: '',
        role: 'assistant',
        status: MessageStatus.WAITING,
        timestamp: Date.now(),
        model,
        provider,
      } as Msg;

      await this.createMessageFromObject(chatId, message);
      return { success: true, message };
    } catch (error: any) {
      console.error('[MessageDatabase] 创建助手消息失败:', error);
      return { success: false, error: error.message || '创建助手消息失败' };
    }
  }

  private generateShortText(content: MessageContent): string {
    const preview = generateMessagePreview(content);
    return preview.length > 50 ? `${preview.slice(0, 50)}...` : preview;
  }
}

export const messageDb = new MessageDatabase();
