import { liveQuery, type Subscription } from 'dexie';
import { messageDb } from '@/persistence/MessageDatabase';
import { v4 as uuid } from 'uuid';
import {
  MessageContent,
  MessageRecord,
  MessageRole,
  MessageStatus,
  Msg,
  ToolInvocation,
  isErrorMessageRecord,
} from '@/types/msg';
import { withTimeout } from '@/utils/timeout';
import { mapMessageRecordToMsg } from '@/features/msg/messageMappers';

const MESSAGE_MUTATION_TIMEOUT = 10000;
const MESSAGE_LOAD_TIMEOUT = 20000;
const CHAT_DELETE_TIMEOUT = 15000;

const generateShortText = (content: MessageContent): string => {
  if (typeof content === 'string') {
    return content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }

  if (Array.isArray(content)) {
    const firstText = content.find((item) => typeof item === 'string');
    if (firstText) {
      const text = String(firstText);
      return text.slice(0, 50) + (text.length > 50 ? '...' : '');
    }
    return '[多媒体消息]';
  }

  if (content && typeof content === 'object' && (content as any).type === 'image') {
    return '[图片消息]';
  }

  return '[消息]';
};

const toMessageObject = (record: MessageRecord): Msg => {
  const mapped = mapMessageRecordToMsg(record);

  if (!mapped.short) {
    return {
      ...mapped,
      short: generateShortText(record.content),
    } as Msg;
  }

  if (isErrorMessageRecord(record) && !('errorMsg' in mapped)) {
    return { ...mapped, errorMsg: record.errorMsg } as Msg;
  }

  return mapped;
};

export const createMessage = async (
  chatId: string,
  content: MessageContent,
  role: MessageRole,
  options: {
    model?: string;
    provider?: string;
    status?: MessageStatus;
    timestamp?: number;
    thinkContent?: string;
    short?: string;
    toolInvocation?: ToolInvocation;
  } = {}
): Promise<{ success: boolean; message?: Msg; error?: string }> => {
  try {
    const messageId = uuid();
    const status = options.status || MessageStatus.COMPLETED;

    const baseRecord: MessageRecord = {
      id: messageId,
      chatId,
      content,
      role,
      status,
      timestamp: options.timestamp || Date.now(),
      model: options.model,
      provider: options.provider,
      thinkContent: options.thinkContent,
      short: options.short || generateShortText(content),
      toolInvocation: options.toolInvocation,
    } as MessageRecord;

    const messageRecord =
      status === MessageStatus.ERROR
        ? ({ ...baseRecord, errorMsg: 'Error message not provided' } as MessageRecord)
        : baseRecord;

    await withTimeout(messageDb.addMessage(messageRecord), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `创建消息 ${messageId} 超时`,
    });

    return { success: true, message: toMessageObject(messageRecord) };
  } catch (error: any) {
    console.error('[messageDataAccess] 创建消息失败:', error);
    return {
      success: false,
      error: error?.message || '创建消息失败',
    };
  }
};

export const updateMessage = async (
  messageId: string,
  updates: Partial<Omit<Msg, 'id' | 'chatId'>> & { errorMsg?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const recordUpdates: Partial<Omit<MessageRecord, 'id' | 'chatId'>> = {
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.status !== undefined && { status: updates.status as MessageStatus }),
      ...(updates.model !== undefined && { model: updates.model }),
      ...(updates.provider !== undefined && { provider: updates.provider }),
      ...(updates.thinkContent !== undefined && { thinkContent: updates.thinkContent }),
      ...(updates.short !== undefined && { short: updates.short }),
      ...(updates.timestamp !== undefined && { timestamp: updates.timestamp }),
      ...(updates.usage !== undefined && { usage: updates.usage }),
      ...(updates.raw !== undefined && { raw: updates.raw }),
      ...(updates.messages !== undefined && { messages: updates.messages as MessageRecord['messages'] }),
      ...(updates.toolInvocation !== undefined && { toolInvocation: updates.toolInvocation }),
    };

    if (updates.status === MessageStatus.ERROR) {
      (recordUpdates as any).errorMsg = (updates as any).errorMsg || 'Unknown error';
    }

    await withTimeout(messageDb.updateMessage(messageId, recordUpdates), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `更新消息 ${messageId} 超时`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[messageDataAccess] 更新消息失败:', error);
    return {
      success: false,
      error: error?.message || '更新消息失败',
    };
  }
};

export const getChatMessages = async (
  chatId: string
): Promise<{ success: boolean; messages?: Msg[]; error?: string }> => {
  try {
    const messageRecords = await withTimeout(messageDb.getChatMessages(chatId), {
      timeout: MESSAGE_LOAD_TIMEOUT,
      timeoutMessage: `获取聊天 ${chatId} 的消息超时`,
    });

    return { success: true, messages: messageRecords.map(toMessageObject) };
  } catch (error: any) {
    console.error('[messageDataAccess] 获取聊天消息失败:', error);
    return {
      success: false,
      error: error?.message || '获取聊天消息失败',
    };
  }
};

export const getMessagesForChats = async (
  chatIds: string[]
): Promise<{ success: boolean; messagesByChat?: Record<string, Msg[]>; error?: string }> => {
  if (chatIds.length === 0) {
    return { success: true, messagesByChat: {} };
  }

  try {
    const messageRecords = await withTimeout(
      messageDb.messages.where('chatId').anyOf(chatIds).toArray(),
      {
        timeout: MESSAGE_LOAD_TIMEOUT,
        timeoutMessage: `批量获取聊天消息超时 (${chatIds.length})`,
      }
    );

    const grouped = new Map<string, Msg[]>();

    for (const record of messageRecords) {
      const existing = grouped.get(record.chatId);
      const message = toMessageObject(record);
      if (existing) {
        existing.push(message);
      } else {
        grouped.set(record.chatId, [message]);
      }
    }

    const result: Record<string, Msg[]> = {};
    grouped.forEach((messages, chatId) => {
      result[chatId] = messages.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    });

    for (const chatId of chatIds) {
      if (!(chatId in result)) {
        result[chatId] = [];
      }
    }

    return {
      success: true,
      messagesByChat: result,
    };
  } catch (error: any) {
    console.error('[messageDataAccess] 批量获取聊天消息失败:', error);
    return {
      success: false,
      error: error?.message || '批量获取聊天消息失败',
    };
  }
};

export const subscribeToChatMessages = (
  chatId: string,
  handlers: {
    next: (messages: Msg[]) => void;
    error?: (error: unknown) => void;
  }
): Subscription | null => {
  if (!chatId) {
    handlers.next([]);
    return null;
  }

  return liveQuery(async () => {
    const messageRecords = await messageDb.getChatMessages(chatId);
    return messageRecords.map(toMessageObject);
  }).subscribe({
    next: handlers.next,
    error: handlers.error,
  });
};

export const getMessage = async (
  messageId: string
): Promise<{ success: boolean; message?: Msg; exists?: boolean; error?: string }> => {
  try {
    const messageRecord = await withTimeout(messageDb.getMessage(messageId), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `获取消息 ${messageId} 超时`,
    });

    if (!messageRecord) {
      return { success: true, exists: false };
    }

    return { success: true, exists: true, message: toMessageObject(messageRecord) };
  } catch (error: any) {
    console.error('[messageDataAccess] 获取消息失败:', error);
    return {
      success: false,
      error: error?.message || '获取消息失败',
    };
  }
};

export const deleteMessage = async (
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await withTimeout(messageDb.deleteMessage(messageId), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `删除消息 ${messageId} 超时`,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[messageDataAccess] 删除消息失败:', error);
    return {
      success: false,
      error: error?.message || '删除消息失败',
    };
  }
};

export const deleteMessagesAfter = async (
  messageId: string
): Promise<{ success: boolean; deletedMessageIds?: string[]; error?: string }> => {
  try {
    const messageResult = await getMessage(messageId);
    if (!messageResult.success || !messageResult.message) {
      return { success: false, error: '指定的消息不存在' };
    }

    const messageRecord = await withTimeout(messageDb.getMessage(messageId), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `删除消息之后获取消息记录 ${messageId} 超时`,
    });

    if (!messageRecord) {
      return { success: false, error: '指定的消息不存在' };
    }

    const chatId = messageRecord.chatId;
    const timestamp = messageResult.message.timestamp || 0;

    const allMessagesResult = await getChatMessages(chatId);
    if (!allMessagesResult.success || !allMessagesResult.messages) {
      return { success: false, error: '获取聊天消息失败' };
    }

    const messagesToDelete = allMessagesResult.messages.filter((msg) => (msg.timestamp || 0) > timestamp);

    const deletedMessageIds: string[] = [];
    for (const msg of messagesToDelete) {
      const deleteResult = await deleteMessage(msg.id);
      if (deleteResult.success) {
        deletedMessageIds.push(msg.id);
      }
    }

    return { success: true, deletedMessageIds };
  } catch (error: any) {
    console.error('[messageDataAccess] 删除消息之后的消息失败:', error);
    return {
      success: false,
      error: error?.message || '删除消息之后的消息失败',
    };
  }
};

export const deleteMessageAndAfter = async (
  messageId: string
): Promise<{ success: boolean; deletedMessageIds?: string[]; error?: string }> => {
  try {
    const messageResult = await getMessage(messageId);
    if (!messageResult.success || !messageResult.message) {
      return { success: false, error: '指定的消息不存在' };
    }

    const messageRecord = await withTimeout(messageDb.getMessage(messageId), {
      timeout: MESSAGE_MUTATION_TIMEOUT,
      timeoutMessage: `删除消息及之后获取消息记录 ${messageId} 超时`,
    });

    if (!messageRecord) {
      return { success: false, error: '指定的消息不存在' };
    }

    const chatId = messageRecord.chatId;
    const timestamp = messageResult.message.timestamp || 0;

    const allMessagesResult = await getChatMessages(chatId);
    if (!allMessagesResult.success || !allMessagesResult.messages) {
      return { success: false, error: '获取聊天消息失败' };
    }

    const messagesToDelete = allMessagesResult.messages.filter((msg) => (msg.timestamp || 0) >= timestamp);

    const deletedMessageIds: string[] = [];
    for (const msg of messagesToDelete) {
      const deleteResult = await deleteMessage(msg.id);
      if (deleteResult.success) {
        deletedMessageIds.push(msg.id);
      }
    }

    return { success: true, deletedMessageIds };
  } catch (error: any) {
    console.error('[messageDataAccess] 删除消息及其之后的消息失败:', error);
    return {
      success: false,
      error: error?.message || '删除消息及其之后的消息失败',
    };
  }
};

export const deleteChatMessages = async (
  chatId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await withTimeout(messageDb.deleteChatMessages(chatId), {
      timeout: CHAT_DELETE_TIMEOUT,
      timeoutMessage: `删除聊天 ${chatId} 的所有消息超时`,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[messageDataAccess] 删除聊天消息失败:', error);
    return {
      success: false,
      error: (error as Error)?.message || '删除聊天消息失败',
    };
  }
};
