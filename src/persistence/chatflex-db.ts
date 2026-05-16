import Dexie, { Table } from 'dexie';
import type { ChatRecord } from '@/types/chat';
import type { ImageRecord, MessageRecord } from '@/types/msg';
import type { ProviderRecord } from '@/types/provider';
import type { Prompt } from '@/types/prompt';
import type { McpServerRecord } from '@/types/mcp';

export interface AttachmentRecord {
  id: string;
  chatId: string;
  messageId: string;
  type: 'image' | 'file' | 'link';
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface CachedImage {
  url: string; // Primary key - the URL of the image
  data: Uint8Array; // The image binary data as a typed array for reliable cloning
  mimeType: string; // The MIME type of the image
  fileName: string; // Extracted filename
  cachedAt: number; // Timestamp when cached
  lastAccessed: number; // Timestamp when last accessed
  size: number; // Size in bytes
}

export interface ProviderModelRecord {
  providerKey: string;
  modelName: string;
  createdAt: number;
}

export interface ToolRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: number;
}

export interface McpToolStateRecord {
  /** 会话 ID */
  chatId: string;
  /** 已启用的 MCP 工具 ID 列表 (JSON 数组字符串) */
  enabledTools: string;
  updatedAt: number;
}

class ChatFlexDatabase extends Dexie {
  chats!: Table<ChatRecord, string>;
  messages!: Table<MessageRecord, string>;
  files!: Table<ImageRecord, number>;
  attachments!: Table<AttachmentRecord, string>;
  imageCache!: Table<CachedImage, string>;
  providers!: Table<ProviderRecord, string>;
  providerModels!: Table<ProviderModelRecord, number>;
  prompts!: Table<Prompt, string>;
  tools!: Table<ToolRecord, string>;
  mcpServers!: Table<McpServerRecord, string>;
  mcpToolStates!: Table<McpToolStateRecord, string>;

  constructor() {
    super('ChatFlexDB');

    // Version 1 - Original schema
    this.version(1).stores({
      cf_chats: 'id, updated, time',
      cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
      cf_files: '++id, createdAt, name, mimeType',
      cf_attachments: 'id, messageId, chatId, createdAt, type',
    });

    // Version 2 - Add image cache table
    this.version(2).stores({
      cf_chats: 'id, updated, time',
      cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
      cf_files: '++id, createdAt, name, mimeType',
      cf_attachments: 'id, messageId, chatId, createdAt, type',
      cf_imageCache: 'url, cachedAt, lastAccessed, size',
    });

    // Version 3 - Add provider configuration table
    this.version(3).stores({
      cf_chats: 'id, updated, time',
      cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
      cf_files: '++id, createdAt, name, mimeType',
      cf_attachments: 'id, messageId, chatId, createdAt, type',
      cf_imageCache: 'url, cachedAt, lastAccessed, size',
      cf_providers: 'key, origin, isActive',
    });

    // Version 4 - Add prompt library table
    this.version(4).stores({
      cf_chats: 'id, updated, time',
      cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
      cf_files: '++id, createdAt, name, mimeType',
      cf_attachments: 'id, messageId, chatId, createdAt, type',
      cf_imageCache: 'url, cachedAt, lastAccessed, size',
      cf_providers: 'key, origin, isActive',
      cf_prompts: 'id, updatedAt, createdAt, title',
    });

    // Version 5 - Add provider models table
    this.version(5).stores({
      cf_chats: 'id, updated, time',
      cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
      cf_files: '++id, createdAt, name, mimeType',
      cf_attachments: 'id, messageId, chatId, createdAt, type',
      cf_imageCache: 'url, cachedAt, lastAccessed, size',
      cf_providers: 'key, origin, isActive',
      cf_prompts: 'id, updatedAt, createdAt, title',
      cf_providerModels: '++id, providerKey, modelName',
    });

    // Version 6 - Add tools table
    this.version(6)
      .stores({
        cf_chats: 'id, updated, time',
        cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
        cf_files: '++id, createdAt, name, mimeType',
        cf_attachments: 'id, messageId, chatId, createdAt, type',
        cf_imageCache: 'url, cachedAt, lastAccessed, size',
        cf_providers: 'key, origin, isActive',
        cf_prompts: 'id, updatedAt, createdAt, title',
        cf_providerModels: '++id, providerKey, modelName',
        cf_tools: 'id, name, enabled, updatedAt',
      })
      .upgrade(async (transaction) => {
        const toolsTable = transaction.table<ToolRecord>('cf_tools');
        const existing = await toolsTable.get('searchWeb');
        if (!existing) {
          await toolsTable.add({
            id: 'searchWeb',
            name: 'Web Search',
            description: '使用 Tavily 实时检索网页信息并返回带引用的摘要',
            enabled: false,
            updatedAt: Date.now(),
          });
        }
      });

    // Version 7 - Add knowledgeBasePath to chats table
    this.version(7)
      .stores({
        cf_chats: 'id, updated, time, knowledgeBasePath',
        cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
        cf_files: '++id, createdAt, name, mimeType',
        cf_attachments: 'id, messageId, chatId, createdAt, type',
        cf_imageCache: 'url, cachedAt, lastAccessed, size',
        cf_providers: 'key, origin, isActive',
        cf_prompts: 'id, updatedAt, createdAt, title',
        cf_providerModels: '++id, providerKey, modelName',
        cf_tools: 'id, name, enabled, updatedAt',
      })
      .upgrade(() => {
        // No migration needed, just add the new field to the schema
      });

    // Version 8 - Add MCP servers and tool states tables
    this.version(8)
      .stores({
        cf_chats: 'id, updated, time, knowledgeBasePath',
        cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
        cf_files: '++id, createdAt, name, mimeType',
        cf_attachments: 'id, messageId, chatId, createdAt, type',
        cf_imageCache: 'url, cachedAt, lastAccessed, size',
        cf_providers: 'key, origin, isActive',
        cf_prompts: 'id, updatedAt, createdAt, title',
        cf_providerModels: '++id, providerKey, modelName',
        cf_tools: 'id, name, enabled, updatedAt',
        cf_mcpServers: 'id, name, enabled, createdAt, updatedAt',
        cf_mcpToolStates: 'chatId, updatedAt',
      })
      .upgrade(() => {
        // No migration needed, just add the new tables
      });

    // Version 9 - Add filePath to cf_files table for file system storage
    this.version(9)
      .stores({
        cf_chats: 'id, updated, time, knowledgeBasePath',
        cf_messages: 'id, chatId, timestamp, [chatId+timestamp], status',
        cf_files: '++id, createdAt, name, mimeType, filePath',
        cf_attachments: 'id, messageId, chatId, createdAt, type',
        cf_imageCache: 'url, cachedAt, lastAccessed, size',
        cf_providers: 'key, origin, isActive',
        cf_prompts: 'id, updatedAt, createdAt, title',
        cf_providerModels: '++id, providerKey, modelName',
        cf_tools: 'id, name, enabled, updatedAt',
        cf_mcpServers: 'id, name, enabled, createdAt, updatedAt',
        cf_mcpToolStates: 'chatId, updatedAt',
      })
      .upgrade(() => {
        // No data migration needed here - image migration is handled separately
      });

    this.chats = this.table('cf_chats');
    this.messages = this.table('cf_messages');
    this.files = this.table('cf_files');
    this.attachments = this.table('cf_attachments');
    this.imageCache = this.table('cf_imageCache');
    this.providers = this.table('cf_providers');
    this.providerModels = this.table('cf_providerModels');
    this.prompts = this.table('cf_prompts');
    this.tools = this.table('cf_tools');
    this.mcpServers = this.table('cf_mcpServers');
    this.mcpToolStates = this.table('cf_mcpToolStates');
  }
}

export const chatFlexDb = new ChatFlexDatabase();
