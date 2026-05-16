import Dexie from 'dexie';
import { chatFlexDb, type ToolRecord } from './chatflex-db';
import {
  KNOWLEDGE_BASE_LIST_TOOL_ID,
  KNOWLEDGE_BASE_READ_TOOL_ID,
  KNOWLEDGE_BASE_SEARCH_TOOL_ID,
} from '@/features/tools/knowledgeBaseToolIds';
import {
  CHAT_HISTORY_SEARCH_TOOL_ID,
  CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  CHAT_HISTORY_LIST_CHATS_TOOL_ID,
} from '@/features/tools/chatHistoryToolIds';

const LEGACY_KNOWLEDGE_BASE_TOOL_ID = 'knowledgeBase';

// Old dot-notation IDs that need migration to underscore notation
const LEGACY_DOT_TO_UNDERSCORE: Record<string, string> = {
  'knowledgeBase.list': KNOWLEDGE_BASE_LIST_TOOL_ID,
  'knowledgeBase.read': KNOWLEDGE_BASE_READ_TOOL_ID,
  'knowledgeBase.search': KNOWLEDGE_BASE_SEARCH_TOOL_ID,
  'chatHistory.search': CHAT_HISTORY_SEARCH_TOOL_ID,
  'chatHistory.getMessages': CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  'chatHistory.listChats': CHAT_HISTORY_LIST_CHATS_TOOL_ID,
};

interface ToolMetadata {
  id: string;
  name: string;
  description: string;
}

const KNOWLEDGE_BASE_TOOL_METADATA: ToolMetadata[] = [
  {
    id: KNOWLEDGE_BASE_LIST_TOOL_ID,
    name: 'Knowledge Base · List',
    description: '列出绑定知识库中的文件和目录',
  },
  {
    id: KNOWLEDGE_BASE_READ_TOOL_ID,
    name: 'Knowledge Base · Read',
    description: '读取绑定知识库中文本文件的内容',
  },
  {
    id: KNOWLEDGE_BASE_SEARCH_TOOL_ID,
    name: 'Knowledge Base · Search',
    description: '在绑定的知识库中搜索特定文本',
  },
];

const CHAT_HISTORY_TOOL_METADATA: ToolMetadata[] = [
  {
    id: CHAT_HISTORY_SEARCH_TOOL_ID,
    name: 'Chat History · Search',
    description: '按关键词搜索历史会话和消息内容',
  },
  {
    id: CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
    name: 'Chat History · Get Messages',
    description: '获取指定会话的完整消息历史',
  },
  {
    id: CHAT_HISTORY_LIST_CHATS_TOOL_ID,
    name: 'Chat History · List Chats',
    description: '列出所有历史会话',
  },
];

const createDefaultTools = (): ToolRecord[] => {
  const timestamp = Date.now();
  const defaults: ToolRecord[] = [
    {
      id: 'searchWeb',
      name: 'Web Search',
      description: '使用 Tavily 实时检索网页信息并返回带引用的摘要',
      enabled: false,
      updatedAt: timestamp,
    },
    {
      id: 'fetchWeb',
      name: 'Fetch Web Content',
      description: '抓取网页正文内容并返回纯文本摘要',
      enabled: false,
      updatedAt: timestamp,
    },
    ...KNOWLEDGE_BASE_TOOL_METADATA.map<ToolRecord>((metadata) => ({
      ...metadata,
      enabled: false,
      updatedAt: timestamp,
    })),
    ...CHAT_HISTORY_TOOL_METADATA.map<ToolRecord>((metadata) => ({
      ...metadata,
      enabled: false,
      updatedAt: timestamp,
    })),
  ];

  return defaults;
};

class ToolDatabase {
  private async ensureDefaults(): Promise<void> {
    const defaults = createDefaultTools();
    await Promise.all(
      defaults.map(async (tool) => {
        try {
          await chatFlexDb.tools.add(tool);
        } catch (error) {
          if (!(error instanceof Dexie.ConstraintError)) {
            throw error;
          }
        }
      }),
    );

    await this.migrateLegacyKnowledgeBaseTool();
    await this.migrateDotNotationToolIds();
  }

  async getAllTools(): Promise<ToolRecord[]> {
    await this.ensureDefaults();
    return chatFlexDb.tools.toArray();
  }

  async getToolById(id: string): Promise<ToolRecord | undefined> {
    await this.ensureDefaults();
    return chatFlexDb.tools.get(id);
  }

  async getEnabledTools(): Promise<ToolRecord[]> {
    await this.ensureDefaults();
    return chatFlexDb.tools.filter((tool) => tool.enabled).toArray();
  }

  async getEnabledToolIds(): Promise<string[]> {
    const tools = await this.getEnabledTools();
    return tools.map((tool) => tool.id);
  }

  async disableAllTools(): Promise<void> {
    await this.ensureDefaults();
    const timestamp = Date.now();
    await chatFlexDb.tools
      .filter((tool) => tool.enabled)
      .modify((tool) => {
        tool.enabled = false;
        tool.updatedAt = timestamp;
      });
  }

  async enableTool(id: string): Promise<void> {
    await this.setToolEnabled(id, true);
  }

  async setToolEnabled(id: string, enabled: boolean): Promise<void> {
    await this.ensureDefaults();
    await this.setToolEnabledInternal(id, enabled);
  }

  async setToolsEnabled(ids: readonly string[], enabled: boolean): Promise<void> {
    await this.ensureDefaults();
    for (const id of ids) {
      await this.setToolEnabledInternal(id, enabled);
    }
  }

  private async setToolEnabledInternal(id: string, enabled: boolean): Promise<void> {
    const tool = await chatFlexDb.tools.get(id);
    if (!tool) {
      throw new Error(`[ToolDatabase] Tool not found: ${id}`);
    }

    if (tool.enabled === enabled) {
      return;
    }

    await chatFlexDb.tools.update(id, {
      enabled,
      updatedAt: Date.now(),
    });
  }

  private async migrateLegacyKnowledgeBaseTool(): Promise<void> {
    const legacy = await chatFlexDb.tools.get(LEGACY_KNOWLEDGE_BASE_TOOL_ID);
    if (!legacy) {
      return;
    }

    const timestamp = Date.now();
    await Promise.all(
      KNOWLEDGE_BASE_TOOL_METADATA.map(async (metadata) => {
        const existing = await chatFlexDb.tools.get(metadata.id);
        if (!existing) {
          await chatFlexDb.tools.add({
            ...metadata,
            enabled: legacy.enabled,
            updatedAt: timestamp,
          });
          return;
        }

        if (legacy.enabled && !existing.enabled) {
          await chatFlexDb.tools.update(metadata.id, {
            enabled: true,
            updatedAt: timestamp,
          });
        }
      }),
    );

    await chatFlexDb.tools.delete(LEGACY_KNOWLEDGE_BASE_TOOL_ID);
  }

  private async migrateDotNotationToolIds(): Promise<void> {
    for (const [oldId, newId] of Object.entries(LEGACY_DOT_TO_UNDERSCORE)) {
      const legacy = await chatFlexDb.tools.get(oldId);
      if (!legacy) continue;

      const existing = await chatFlexDb.tools.get(newId);
      if (existing) {
        // Preserve enabled state from old record
        if (legacy.enabled && !existing.enabled) {
          await chatFlexDb.tools.update(newId, {
            enabled: true,
            updatedAt: Date.now(),
          });
        }
      }
      await chatFlexDb.tools.delete(oldId);
    }
  }
}

export const toolDb = new ToolDatabase();
