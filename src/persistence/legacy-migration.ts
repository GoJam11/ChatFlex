import Dexie, { Table } from 'dexie';
import { chatFlexDb } from './chatflex-db';
import type { ChatRecord } from '@/types/chat';
import type { MessageContent, MessageRecord, MessageRole, MessageStatus } from '@/types/msg';
import { generateMessagePreview } from '@/utils/messagePreview';
import { chatDb } from './ChatDatabase';
import { createLogger } from '@/utils/logger';
const log = createLogger('LegacyMigration');

// 标记位，避免重复迁移造成性能浪费（逻辑保持幂等，重复执行也不会破坏数据）
const MIGRATION_FLAG_KEY = 'chatflex.migration.legacy.v1.done';

type LegacyChat = Partial<ChatRecord> & {
  id: string;
  time: number;
};

type LegacyMessage = {
  id: string;
  chatId: string;
  content: MessageContent;
  role: MessageRole;
  status?: MessageStatus | string;
  timestamp?: number;
  model?: string;
  provider?: string;
  thinkContent?: string;
  short?: string;
  usage?: any;
  raw?: any;
  messages?: readonly any[];
};

async function readLegacyTable<T = any>(dbName: string, tableName: string): Promise<T[]> {
  try {
    const db = new Dexie(dbName);
    // 不声明版本与 stores，直接打开已存在的旧库；若不存在或表不存在将抛错
    await db.open();
    const table = db.table(tableName) as Table<T, any>;
    const rows = await table.toArray();
    await db.close();
    return rows as T[];
  } catch (e) {
    // 旧库或表不存在，按无数据处理
    return [];
  }
}

function toChatRecord(legacy: LegacyChat): ChatRecord {
  return {
    id: legacy.id,
    short: legacy.short ?? '',
    time: legacy.time ?? Date.now(),
    lastMsgPreview: legacy.lastMsgPreview ?? '',
    lastMsgTime: legacy.lastMsgTime,
    messageCount: legacy.messageCount ?? 0,
    updated: legacy.updated ?? Date.now(),
    pinned: legacy.pinned,
    systemPrompt: legacy.systemPrompt,
    historyMsgCount: legacy.historyMsgCount,
    temperature: legacy.temperature,
    maxTokens: legacy.maxTokens,
    topP: legacy.topP,
    frequencyPenalty: legacy.frequencyPenalty,
    memoryTable: legacy.memoryTable,
    model: legacy.model,
    provider: legacy.provider,
    reasoningStrength: legacy.reasoningStrength,
  };
}

function toMessageRecord(legacy: LegacyMessage): MessageRecord {
  const preview = generateMessagePreview(legacy.content);
  const short = legacy.short ?? (preview.length > 50 ? `${preview.slice(0, 50)}...` : preview);

  return {
    id: legacy.id,
    chatId: legacy.chatId,
    content: legacy.content,
    short,
    role: legacy.role,
    model: legacy.model,
    provider: legacy.provider,
    status: (legacy.status as MessageStatus) ?? ('completed' as MessageStatus),
    timestamp: legacy.timestamp ?? Date.now(),
    thinkContent: legacy.thinkContent,
    usage: legacy.usage as any,
    raw: legacy.raw as any,
    messages: legacy.messages as any,
  } as MessageRecord;
}

export async function migrateLegacyDatabases(): Promise<{ chatsMigrated: number; messagesMigrated: number }> {
  // 已执行过且业务幂等时可跳过
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_FLAG_KEY)) {
      log.debug('Legacy migration already completed, skipping');
      return { chatsMigrated: 0, messagesMigrated: 0 };
    }
  } catch { /* SSR/非浏览器环境忽略 */ }

  // 读取旧库（ChatDatabase v30 / MessageDatabase v40）
  const [legacyChats, legacyMessages]: [LegacyChat[], LegacyMessage[]] = await Promise.all([
    readLegacyTable<LegacyChat>('ChatDatabase', 'chats'),
    readLegacyTable<LegacyMessage>('MessageDatabase', 'messages'),
  ]);

  if ((!legacyChats || legacyChats.length === 0) && (!legacyMessages || legacyMessages.length === 0)) {
    try { localStorage.setItem(MIGRATION_FLAG_KEY, '1'); } catch { /* ignore */ }
    log.info('No legacy data found to migrate');
    return { chatsMigrated: 0, messagesMigrated: 0 };
  }

  let chatsMigrated = 0;
  let messagesMigrated = 0;

  // 现有的新库主键集合，用于去重
  const existingChatIds = new Set<string>(
    (await chatFlexDb.chats.toCollection().primaryKeys()) as string[]
  );

  // 批量准备插入的聊天
  const chatInserts: ChatRecord[] = [];
  for (const c of legacyChats) {
    if (!c?.id) continue;
    if (existingChatIds.has(c.id)) continue;
    chatInserts.push(toChatRecord(c));
  }

  // 先插入缺失的聊天记录
  if (chatInserts.length > 0) {
    await chatFlexDb.chats.bulkPut(chatInserts);
    chatsMigrated += chatInserts.length;
  }

  // 迁移消息（分 chat 过滤，避免一次性写入过大数组）
  // 构建 chatId -> messages[] 的映射，便于分批处理
  const msgsByChat = new Map<string, LegacyMessage[]>();
  for (const m of legacyMessages) {
    if (!m?.id || !m?.chatId) continue;
    if (!msgsByChat.has(m.chatId)) msgsByChat.set(m.chatId, []);
    msgsByChat.get(m.chatId)!.push(m);
  }

  // 遍历每个 chat 的消息，跳过在新库已存在的消息
  for (const [chatId, msgs] of msgsByChat.entries()) {
    const toInsert: MessageRecord[] = [];

    // 采用逐条存在性检查，避免 bulk 覆盖现有数据
    for (const m of msgs) {
      const exists = await chatFlexDb.messages.get(m.id);
      if (exists) continue;
      toInsert.push(toMessageRecord(m));
    }

    if (toInsert.length > 0) {
      await chatFlexDb.messages.bulkPut(toInsert);
      messagesMigrated += toInsert.length;
    }

    // 刷新该会话的统计信息（数量、最后一条预览与时间）
    try {
      await chatDb.updateMessageStats(chatId);
    } catch { /* ignore single chat failure */ }
  }

  // 若成功完成迁移或无可迁移项，设置标记
  try { localStorage.setItem(MIGRATION_FLAG_KEY, '1'); } catch { /* ignore */ }

  log.info(`Legacy migration complete: ${chatsMigrated} chats, ${messagesMigrated} messages`);
  return { chatsMigrated, messagesMigrated };
}
