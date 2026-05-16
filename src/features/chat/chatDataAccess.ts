import { liveQuery, type Subscription } from 'dexie';
import { chatDb } from '@/persistence/ChatDatabase';
import { messageDb } from '@/persistence/MessageDatabase';
import type { Chat, ChatRecord } from '@/types/chat';
import type { Msg, MessageRecord } from '@/types/msg';
import { withTimeout } from '@/utils/timeout';
import { getChatDefaultsSnapshot } from '@/features/chat/useChatDefaults';
import { mapChatRecordToChat } from '@/features/chat/chatMappers';
import { mapMessageRecordToMsg } from '@/features/msg/messageMappers';
import { isChatSearchEnabled } from '@/config/chatSearch';
import { searchChatsInDatabase } from '@/features/chat/search/chatSearchService';
import { DEFAULT_HISTORY_MESSAGE_LIMIT } from '@/config/chat';

const CHAT_LOAD_TIMEOUT = 15000;
const CHAT_MUTATION_TIMEOUT = 10000;
const CHAT_DELETE_TIMEOUT = 15000;
const CHAT_WITH_MESSAGES_TIMEOUT = 20000;

const toChatObject = (record: ChatRecord): Chat => mapChatRecordToChat(record);

const toMessageObject = (record: MessageRecord): Msg => mapMessageRecordToMsg(record);

export const createChat = async (
  title = '',
  historyMsgCount?: number,
  model?: string,
  provider?: string
): Promise<{ success: boolean; chat?: Chat; error?: string }> => {
  try {
    const defaults = getChatDefaultsSnapshot();
    const effectiveHistoryCount =
      historyMsgCount ?? defaults.historyMsgCount ?? DEFAULT_HISTORY_MESSAGE_LIMIT;

    const chatRecord = await withTimeout(
      chatDb.createNewChat(
        title,
        undefined,
        undefined,
        effectiveHistoryCount,
        model,
        provider,
        defaults.systemPrompt,
        defaults.reasoningStrength,
      ),
      { timeout: CHAT_MUTATION_TIMEOUT, timeoutMessage: '创建新聊天超时' }
    );

    const chat = toChatObject(chatRecord);
    return { success: true, chat };
  } catch (error: any) {
    console.error('[chatDataAccess] 创建聊天失败:', error);
    return {
      success: false,
      error: error?.message || '创建聊天失败',
    };
  }
};

export const loadAllChats = async (): Promise<{ success: boolean; chats?: Chat[]; error?: string }> => {
  try {
    const chatRecords = await withTimeout(chatDb.getAllChats(), {
      timeout: CHAT_LOAD_TIMEOUT,
      timeoutMessage: '加载所有聊天超时',
    });

    return { success: true, chats: chatRecords.map(toChatObject) };
  } catch (error: any) {
    console.error('[chatDataAccess] 加载聊天失败:', error);
    return {
      success: false,
      error: error?.message || '加载聊天失败',
    };
  }
};

export const subscribeToChatList = (
  handlers: {
    next: (chats: Chat[]) => void;
    error?: (error: unknown) => void;
  }
): Subscription => {
  return liveQuery(async () => {
    const chatRecords = await chatDb.getAllChats();
    return chatRecords
      .map(toChatObject)
      .sort((a, b) => (b.lastMsgTime ?? b.time ?? 0) - (a.lastMsgTime ?? a.time ?? 0));
  }).subscribe({
    next: handlers.next,
    error: handlers.error,
  });
};

export const loadChatWithMessages = async (
  chatId: string
): Promise<{ success: boolean; chat?: Chat; messages?: Msg[]; error?: string }> => {
  try {
    const [chatRecord, messageRecords] = await withTimeout(
      Promise.all([chatDb.getChatById(chatId), messageDb.getChatMessages(chatId)]),
      { timeout: CHAT_WITH_MESSAGES_TIMEOUT, timeoutMessage: `加载聊天 ${chatId} 及其消息超时` }
    );

    if (!chatRecord) {
      return { success: false, error: `聊天不存在: ${chatId}` };
    }

    return {
      success: true,
      chat: toChatObject(chatRecord),
      messages: messageRecords.map(toMessageObject),
    };
  } catch (error: any) {
    console.error('[chatDataAccess] 加载聊天失败:', error);
    return {
      success: false,
      error: error?.message || '加载聊天失败',
    };
  }
};

export const updateChat = async (
  chatId: string,
  updates: Partial<Chat>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const chatUpdates: Partial<ChatRecord> = {};

    if (updates.short !== undefined) chatUpdates.short = updates.short;
    if (updates.lastMsgPreview !== undefined) chatUpdates.lastMsgPreview = updates.lastMsgPreview;
    if (updates.messageCount !== undefined) chatUpdates.messageCount = updates.messageCount;
    if (updates.pinned !== undefined) chatUpdates.pinned = updates.pinned;
    if (updates.systemPrompt !== undefined) chatUpdates.systemPrompt = updates.systemPrompt;
    if (updates.historyMsgCount !== undefined) chatUpdates.historyMsgCount = updates.historyMsgCount;
    if (updates.temperature !== undefined) chatUpdates.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) chatUpdates.maxTokens = updates.maxTokens;
    if (updates.topP !== undefined) chatUpdates.topP = updates.topP;
    if (updates.frequencyPenalty !== undefined) chatUpdates.frequencyPenalty = updates.frequencyPenalty;
    if (updates.memoryTable !== undefined) chatUpdates.memoryTable = updates.memoryTable;
    if (updates.model !== undefined) chatUpdates.model = updates.model;
    if (updates.provider !== undefined) chatUpdates.provider = updates.provider;
    if (updates.reasoningStrength !== undefined) chatUpdates.reasoningStrength = updates.reasoningStrength;

    await withTimeout(chatDb.updateChat(chatId, chatUpdates), {
      timeout: CHAT_MUTATION_TIMEOUT,
      timeoutMessage: `更新聊天 ${chatId} 超时`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[chatDataAccess] 更新聊天失败:', error);
    return {
      success: false,
      error: error?.message || '更新聊天失败',
    };
  }
};

export const deleteChat = async (
  chatId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await withTimeout(
      Promise.all([chatDb.deleteChat(chatId), messageDb.deleteChatMessages(chatId)]),
      { timeout: CHAT_DELETE_TIMEOUT, timeoutMessage: `删除聊天 ${chatId} 及其消息超时` }
    );

    return { success: true };
  } catch (error: any) {
    console.error('[chatDataAccess] 删除聊天失败:', error);
    return {
      success: false,
      error: error?.message || '删除聊天失败',
    };
  }
};

export const chatExists = async (
  chatId: string
): Promise<{ success: boolean; exists?: boolean; error?: string }> => {
  try {
    const chatRecord = await withTimeout(chatDb.getChatById(chatId), {
      timeout: CHAT_MUTATION_TIMEOUT,
      timeoutMessage: `检查聊天 ${chatId} 是否存在超时`,
    });

    return { success: true, exists: !!chatRecord };
  } catch (error: any) {
    console.error('[chatDataAccess] 检查聊天存在失败:', error);
    return {
      success: false,
      error: error?.message || '检查聊天存在失败',
    };
  }
};

export const getChatById = async (
  chatId: string
): Promise<{ success: boolean; chat?: Chat; error?: string }> => {
  try {
    const chatRecord = await withTimeout(chatDb.getChatById(chatId), {
      timeout: CHAT_MUTATION_TIMEOUT,
      timeoutMessage: `获取聊天 ${chatId} 超时`,
    });

    if (!chatRecord) {
      return { success: false, error: `聊天不存在: ${chatId}` };
    }

    return { success: true, chat: toChatObject(chatRecord) };
  } catch (error: any) {
    console.error('[chatDataAccess] 获取聊天失败:', error);
    return {
      success: false,
      error: error?.message || '获取聊天失败',
    };
  }
};

export const getChatInfo = async (
  chatId: string
): Promise<{ success: boolean; chat?: Chat; exists?: boolean; error?: string }> => {
  try {
    const chatRecord = await withTimeout(chatDb.getChatById(chatId), {
      timeout: CHAT_MUTATION_TIMEOUT,
      timeoutMessage: `获取聊天信息 ${chatId} 超时`,
    });

    if (!chatRecord) {
      return { success: true, exists: false };
    }

    return { success: true, exists: true, chat: toChatObject(chatRecord) };
  } catch (error: any) {
    console.error('[chatDataAccess] 获取聊天信息失败:', error);
    return {
      success: false,
      error: error?.message || '获取聊天信息失败',
    };
  }
};

export const searchChats = async (
  query: string
): Promise<{ success: boolean; chats?: Chat[]; error?: string }> => {
  try {
    if (!isChatSearchEnabled) {
      return { success: true, chats: [] };
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return loadAllChats();
    }

    const searchResult = await searchChatsInDatabase(trimmed, { limit: 50 });

    const matchedChats = new Map<string, Chat>();
    for (const match of searchResult.results) {
      if (!matchedChats.has(match.chat.id)) {
        matchedChats.set(match.chat.id, match.chat);
      }
    }

    return { success: true, chats: Array.from(matchedChats.values()) };
  } catch (error: any) {
    console.error('[chatDataAccess] 搜索聊天失败:', error);
    return {
      success: false,
      error: error?.message || '搜索聊天失败',
    };
  }
};

export const findNextActiveChat = async (
  excludeChatId: string
): Promise<{ success: boolean; nextActiveChatId?: string; nextActiveChat?: Chat; error?: string }> => {
  try {
    const allChats = await withTimeout(chatDb.getAllChats(), {
      timeout: CHAT_LOAD_TIMEOUT,
      timeoutMessage: '查找下一个激活聊天时获取所有聊天超时',
    });

    const availableChats = allChats.filter((chat) => chat.id !== excludeChatId);
    if (availableChats.length === 0) {
      return { success: true, nextActiveChatId: '0' };
    }

    availableChats.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const nextChat = toChatObject(availableChats[0]);

    return {
      success: true,
      nextActiveChatId: nextChat.id,
      nextActiveChat: nextChat,
    };
  } catch (error: any) {
    console.error('[chatDataAccess] 查找下一个激活聊天失败:', error);
    return {
      success: false,
      error: error?.message || '查找下一个激活聊天失败',
    };
  }
};
