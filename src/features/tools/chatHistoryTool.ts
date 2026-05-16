import { tool, type ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { chatDb } from '@/persistence/ChatDatabase';
import { messageDb } from '@/persistence/MessageDatabase';
import { generateMessagePreview } from '@/utils/messagePreview';
import {
  CHAT_HISTORY_SEARCH_TOOL_ID,
  CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  CHAT_HISTORY_LIST_CHATS_TOOL_ID,
  CHAT_HISTORY_TOOL_IDS,
} from './chatHistoryToolIds';

export {
  CHAT_HISTORY_SEARCH_TOOL_ID,
  CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  CHAT_HISTORY_LIST_CHATS_TOOL_ID,
  CHAT_HISTORY_TOOL_IDS,
} from './chatHistoryToolIds';

const MAX_SNIPPET_LENGTH = 200;
const MAX_MESSAGE_CONTENT_LENGTH = 1000;
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MESSAGES_LIMIT = 50;
const DEFAULT_CHATS_LIMIT = 20;

type ToolExecutionContext = {
  chatId?: string;
};

function getChatIdFromToolContext(options?: ToolExecutionOptions): string | null {
  const context = options?.experimental_context;
  if (!context || typeof context !== 'object') {
    return null;
  }

  const { chatId } = context as ToolExecutionContext;
  if (!chatId || typeof chatId !== 'string') {
    return null;
  }

  return chatId;
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function buildSnippet(text: string, query: string, length = MAX_SNIPPET_LENGTH): string {
  const cleanText = text.trim();
  if (!cleanText) {
    return cleanText;
  }

  const normalizedQuery = query.toLowerCase();
  const lower = cleanText.toLowerCase();
  const index = lower.indexOf(normalizedQuery);

  if (index === -1) {
    return truncateText(cleanText, length);
  }

  const half = Math.max(0, Math.floor((length - normalizedQuery.length) / 2));
  const start = Math.max(0, index - half);
  const end = Math.min(cleanText.length, start + length);
  return cleanText.slice(start, end);
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// chatHistory_search - 按关键词搜索聊天记录
const chatHistorySearchToolDefinition = {
  name: CHAT_HISTORY_SEARCH_TOOL_ID,
  description:
    '在所有历史会话中按关键词搜索聊天记录，返回匹配的会话列表。可用于查找之前讨论过的话题、查找特定问题的解决方案或回顾历史对话。',
  parameters: z.object({
    query: z
      .string()
      .min(1, '请输入搜索关键词。')
      .describe('要搜索的关键词，将在会话标题、消息内容中进行匹配。'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('最大返回结果数量，默认为 10，最大为 50。'),
    includeMessages: z
      .boolean()
      .optional()
      .describe('是否在消息内容中搜索，默认为 true。设为 false 则仅搜索会话标题。'),
  }),
  execute: async (
    { query, limit, includeMessages }: { query: string; limit?: number; includeMessages?: boolean },
    options?: ToolExecutionOptions,
  ) => {
    try {
      const currentChatId = getChatIdFromToolContext(options);
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return '搜索未执行：请输入有效的搜索关键词。';
      }

      const normalizedQuery = trimmedQuery.toLowerCase();
      const maxResults = Math.min(limit ?? DEFAULT_SEARCH_LIMIT, 50);
      const shouldSearchMessages = includeMessages !== false;

      const allChats = await chatDb.getAllChats();
      const matchedResults: Array<{
        chatId: string;
        title: string;
        snippet: string;
        matchType: 'title' | 'message';
        lastMsgTime?: number;
        messageCount: number;
      }> = [];

      // 排除当前会话
      const chatsToSearch = currentChatId
        ? allChats.filter((chat) => chat.id !== currentChatId)
        : allChats;

      // 按更新时间排序，最新的在前
      chatsToSearch.sort((a, b) => (b.updated || 0) - (a.updated || 0));

      // 在会话标题和预览中搜索
      for (const chat of chatsToSearch) {
        if (matchedResults.length >= maxResults) break;

        const titleMatch = chat.short?.toLowerCase().includes(normalizedQuery);
        const previewMatch = chat.lastMsgPreview?.toLowerCase().includes(normalizedQuery);

        if (titleMatch || previewMatch) {
          const matchText = titleMatch ? chat.short : chat.lastMsgPreview;
          matchedResults.push({
            chatId: chat.id,
            title: chat.short || '未命名会话',
            snippet: buildSnippet(matchText || '', trimmedQuery),
            matchType: 'title',
            lastMsgTime: chat.lastMsgTime,
            messageCount: chat.messageCount || 0,
          });
        }
      }

      // 在消息内容中搜索
      if (shouldSearchMessages && matchedResults.length < maxResults) {
        const matchedChatIds = new Set(matchedResults.map((r) => r.chatId));

        for (const chat of chatsToSearch) {
          if (matchedResults.length >= maxResults) break;
          if (matchedChatIds.has(chat.id)) continue;

          const messages = await messageDb.getChatMessages(chat.id);
          for (const msg of messages) {
            const contentPreview = generateMessagePreview(msg.content);
            if (contentPreview.toLowerCase().includes(normalizedQuery)) {
              matchedResults.push({
                chatId: chat.id,
                title: chat.short || '未命名会话',
                snippet: buildSnippet(contentPreview, trimmedQuery),
                matchType: 'message',
                lastMsgTime: chat.lastMsgTime,
                messageCount: chat.messageCount || 0,
              });
              break;
            }
          }
        }
      }

      if (matchedResults.length === 0) {
        return `未找到包含 "${trimmedQuery}" 的历史对话。`;
      }

      const formattedResults = matchedResults.map((result, index) => ({
        序号: index + 1,
        会话ID: result.chatId,
        标题: result.title,
        匹配类型: result.matchType === 'title' ? '标题匹配' : '消息匹配',
        匹配片段: result.snippet,
        最后消息时间: result.lastMsgTime ? formatTimestamp(result.lastMsgTime) : '未知',
        消息数量: result.messageCount,
      }));

      return JSON.stringify(
        {
          总结: `找到 ${matchedResults.length} 个包含 "${trimmedQuery}" 的历史对话`,
          结果: formattedResults,
          提示: '使用 chatHistory_getMessages 工具并传入会话ID可获取完整对话内容',
        },
        null,
        2,
      );
    } catch (error) {
      console.error('[chatHistorySearchTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `搜索历史对话失败：${message}`;
    }
  },
};

// chatHistory_getMessages - 获取特定会话的消息历史
const chatHistoryGetMessagesToolDefinition = {
  name: CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  description:
    '获取指定会话的完整消息历史。需要提供会话ID（可通过 chatHistory_search 或 chatHistory_listChats 获取）。',
  parameters: z.object({
    chatId: z.string().min(1, '请输入会话ID。').describe('要获取消息的会话ID。'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('最大返回消息数量，默认为 50，最大为 100。'),
    offset: z.number().int().min(0).optional().describe('分页偏移量，默认为 0，从最新消息开始。'),
  }),
  execute: async (
    { chatId, limit, offset }: { chatId: string; limit?: number; offset?: number },
    options?: ToolExecutionOptions,
  ) => {
    try {
      const currentChatId = getChatIdFromToolContext(options);

      // 防止读取当前会话
      if (currentChatId && chatId === currentChatId) {
        return '无法读取当前会话的历史记录，请指定其他会话ID。';
      }

      const chat = await chatDb.getChatById(chatId);
      if (!chat) {
        return `未找到ID为 "${chatId}" 的会话。请确认会话ID是否正确。`;
      }

      const allMessages = await messageDb.getChatMessages(chatId);
      const maxMessages = Math.min(limit ?? DEFAULT_MESSAGES_LIMIT, 100);
      const startIndex = offset ?? 0;

      // 按时间倒序（最新的在前），然后应用分页
      const sortedMessages = [...allMessages].reverse();
      const pagedMessages = sortedMessages.slice(startIndex, startIndex + maxMessages);

      if (pagedMessages.length === 0) {
        return `会话 "${chat.short || '未命名会话'}" 暂无消息记录。`;
      }

      const formattedMessages = pagedMessages.map((msg, index) => {
        const contentPreview = generateMessagePreview(msg.content);
        return {
          序号: startIndex + index + 1,
          角色: msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role,
          内容: truncateText(contentPreview, MAX_MESSAGE_CONTENT_LENGTH),
          时间: formatTimestamp(msg.timestamp),
        };
      });

      return JSON.stringify(
        {
          会话信息: {
            会话ID: chat.id,
            标题: chat.short || '未命名会话',
            创建时间: chat.time ? formatTimestamp(chat.time) : '未知',
            消息总数: allMessages.length,
          },
          消息列表: formattedMessages,
          分页信息: {
            当前偏移: startIndex,
            返回数量: pagedMessages.length,
            总消息数: allMessages.length,
            是否有更多: startIndex + pagedMessages.length < allMessages.length,
          },
        },
        null,
        2,
      );
    } catch (error) {
      console.error('[chatHistoryGetMessagesTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `获取会话消息失败：${message}`;
    }
  },
};

// chatHistory_listChats - 列出所有会话
const chatHistoryListChatsToolDefinition = {
  name: CHAT_HISTORY_LIST_CHATS_TOOL_ID,
  description:
    '列出所有历史会话，按最后更新时间排序。用于浏览历史对话列表或获取会话ID以进一步查看详细内容。',
  parameters: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('最大返回会话数量，默认为 20，最大为 50。'),
    offset: z.number().int().min(0).optional().describe('分页偏移量，默认为 0。'),
  }),
  execute: async (
    { limit, offset }: { limit?: number; offset?: number },
    options?: ToolExecutionOptions,
  ) => {
    try {
      const currentChatId = getChatIdFromToolContext(options);
      const allChats = await chatDb.getAllChats();

      // 排除当前会话
      const chatsToList = currentChatId
        ? allChats.filter((chat) => chat.id !== currentChatId)
        : allChats;

      // 按更新时间排序
      chatsToList.sort((a, b) => (b.updated || 0) - (a.updated || 0));

      const maxChats = Math.min(limit ?? DEFAULT_CHATS_LIMIT, 50);
      const startIndex = offset ?? 0;
      const pagedChats = chatsToList.slice(startIndex, startIndex + maxChats);

      if (pagedChats.length === 0) {
        return '暂无历史对话记录。';
      }

      const formattedChats = pagedChats.map((chat, index) => ({
        序号: startIndex + index + 1,
        会话ID: chat.id,
        标题: chat.short || '未命名会话',
        最后消息预览: truncateText(chat.lastMsgPreview || '', 50),
        最后消息时间: chat.lastMsgTime ? formatTimestamp(chat.lastMsgTime) : '未知',
        消息数量: chat.messageCount || 0,
      }));

      return JSON.stringify(
        {
          总结: `共有 ${chatsToList.length} 个历史对话`,
          会话列表: formattedChats,
          分页信息: {
            当前偏移: startIndex,
            返回数量: pagedChats.length,
            总会话数: chatsToList.length,
            是否有更多: startIndex + pagedChats.length < chatsToList.length,
          },
          提示: '使用 chatHistory_getMessages 工具并传入会话ID可获取完整对话内容',
        },
        null,
        2,
      );
    } catch (error) {
      console.error('[chatHistoryListChatsTool] 执行失败:', error);
      const message = error instanceof Error ? error.message : '未知错误';
      return `获取会话列表失败：${message}`;
    }
  },
};

export const chatHistorySearchTool = tool({
  title: 'Chat History · Search',
  description: chatHistorySearchToolDefinition.description,
  inputSchema: chatHistorySearchToolDefinition.parameters,
  execute: chatHistorySearchToolDefinition.execute,
});

export const chatHistoryGetMessagesTool = tool({
  title: 'Chat History · Get Messages',
  description: chatHistoryGetMessagesToolDefinition.description,
  inputSchema: chatHistoryGetMessagesToolDefinition.parameters,
  execute: chatHistoryGetMessagesToolDefinition.execute,
});

export const chatHistoryListChatsTool = tool({
  title: 'Chat History · List Chats',
  description: chatHistoryListChatsToolDefinition.description,
  inputSchema: chatHistoryListChatsToolDefinition.parameters,
  execute: chatHistoryListChatsToolDefinition.execute,
});
