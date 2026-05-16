import Dexie from 'dexie';
import type { Chat, ChatRecord, ReasoningStrength } from '@/types/chat';
import type { MessageRecord } from '@/types/msg';
import { v4 as uuid } from 'uuid';
import { chatFlexDb } from './chatflex-db';
import { withTimeout, checkDbHealth } from '@/utils/timeout';
import { generateMessagePreview } from '@/utils/messagePreview';

const chatsTable = chatFlexDb.chats;
const messagesTable = chatFlexDb.messages;

function createChatRecord(
  short: string,
  historyMsgCount?: number,
  model?: string,
  provider?: string,
  id?: string,
  time?: number,
  systemPrompt?: string,
  reasoningStrength: ReasoningStrength = 'default',
): ChatRecord {
  const chatId = id ?? uuid();
  const createdAt = time ?? Date.now();

  return {
    id: chatId,
    short,
    time: createdAt,
    updated: Date.now(),
    lastMsgPreview: short || '新的对话',
    lastMsgTime: createdAt,
    messageCount: 0,
    historyMsgCount,
    systemPrompt,
    model,
    provider,
    reasoningStrength,
  };
}

function toChatRecord(chat: Chat): ChatRecord {
  return {
    id: chat.id,
    short: chat.short,
    time: chat.time,
    lastMsgPreview: chat.lastMsgPreview || '',
    lastMsgTime: chat.lastMsgTime,
    messageCount: chat.messageCount || 0,
    updated: Date.now(),
    pinned: chat.pinned,
    systemPrompt: chat.systemPrompt,
    historyMsgCount: chat.historyMsgCount,
    temperature: chat.temperature,
    maxTokens: chat.maxTokens,
    topP: chat.topP,
    frequencyPenalty: chat.frequencyPenalty,
    memoryTable: chat.memoryTable,
    model: chat.model,
    provider: chat.provider,
    reasoningStrength: chat.reasoningStrength,
  };
}

async function resolveLatestMessage(chatId: string): Promise<MessageRecord | undefined> {
  return withTimeout(
    messagesTable
      .where('[chatId+timestamp]')
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .last(),
    { timeout: 10000, timeoutMessage: `读取聊天 ${chatId} 最新消息超时` },
  );
}

async function resolveMessageCount(chatId: string): Promise<number> {
  return withTimeout(
    messagesTable.where('chatId').equals(chatId).count(),
    { timeout: 10000, timeoutMessage: `统计聊天 ${chatId} 消息数量超时` },
  );
}

export class ChatDatabase {
  get chats() {
    return chatsTable;
  }

  async createNewChat(
    short: string = '',
    id?: string,
    time?: number,
    historyMsgCount?: number,
    model?: string,
    provider?: string,
    systemPrompt?: string,
    reasoningStrength: ReasoningStrength = 'default',
  ): Promise<ChatRecord> {
    const record = createChatRecord(
      short,
      historyMsgCount,
      model,
      provider,
      id,
      time,
      systemPrompt,
      reasoningStrength,
    );

    await withTimeout(
      chatsTable.put(record),
      { timeout: 10000, timeoutMessage: `创建聊天 ${record.id} 超时` },
    );

    return record;
  }

  async createChatFromObject(chat: Chat): Promise<string> {
    const record = toChatRecord(chat);

    await withTimeout(
      chatsTable.put(record),
      { timeout: 10000, timeoutMessage: `写入聊天 ${record.id} 超时` },
    );

    return record.id;
  }

  async getChatById(id: string): Promise<ChatRecord | undefined> {
    return withTimeout(
      chatsTable.get(id),
      { timeout: 8000, timeoutMessage: `获取聊天 ${id} 超时` },
    );
  }

  async getAllChats(): Promise<ChatRecord[]> {
    return withTimeout(
      chatsTable.orderBy('updated').reverse().toArray(),
      { timeout: 15000, timeoutMessage: '获取全部聊天超时' },
    );
  }

  async updateChat(id: string, changes: Partial<ChatRecord>): Promise<void> {
    await withTimeout(
      chatsTable.update(id, { ...changes, updated: Date.now() }),
      { timeout: 10000, timeoutMessage: `更新聊天 ${id} 超时` },
    );
  }

  async deleteChat(id: string): Promise<void> {
    await withTimeout(
      chatsTable.delete(id),
      { timeout: 10000, timeoutMessage: `删除聊天 ${id} 超时` },
    );
  }

  async updateMessageStats(
    chatId: string,
    messageCount?: number,
    lastMsgPreview?: string,
    lastMsgTime?: number,
  ): Promise<void> {
    let resolvedCount = messageCount;
    let resolvedPreview = lastMsgPreview;
    let resolvedTime = lastMsgTime;

    if (resolvedCount === undefined || resolvedPreview === undefined || resolvedTime === undefined) {
      const [count, lastMessage] = await Promise.all([
        resolvedCount === undefined ? resolveMessageCount(chatId) : Promise.resolve(resolvedCount),
        resolvedPreview === undefined || resolvedTime === undefined
          ? resolveLatestMessage(chatId)
          : Promise.resolve(undefined),
      ]);

      resolvedCount = resolvedCount ?? count;
      if (resolvedPreview === undefined || resolvedTime === undefined) {
        const message = (resolvedPreview === undefined || resolvedTime === undefined)
          ? await resolveLatestMessage(chatId)
          : undefined;
        if (message) {
          const previewText = generateMessagePreview(message.content);
          resolvedPreview = previewText.length > 20 ? `${previewText.slice(0, 20)}...` : previewText;
          resolvedTime = message.timestamp;
        } else {
          resolvedPreview = '';
          resolvedTime = undefined;
        }
      }
    }

    await withTimeout(
      chatsTable.update(chatId, {
        messageCount: resolvedCount ?? 0,
        lastMsgPreview: resolvedPreview ?? '',
        lastMsgTime: resolvedTime,
        updated: Date.now(),
      }),
      { timeout: 10000, timeoutMessage: `更新聊天 ${chatId} 的统计信息超时` },
    );
  }
}

export const chatDb = new ChatDatabase();

export async function checkChatDbHealth(): Promise<boolean> {
  return checkDbHealth(async () => {
    try {
      await chatsTable.limit(1).toArray();
      return true;
    } catch {
      return false;
    }
  });
}
